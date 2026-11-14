import { DurableObject } from 'cloudflare:workers';
import { apply, createRoom, type Action, type State } from '../engine';
import type { ClientMsg, JoinResponse, PublicState, ServerMsg, Snapshot } from '../shared/protocol';
import type { Feedback } from './feedback';
import { verifyGoogleIdToken } from './google';

export interface Env {
  ROOM: DurableObjectNamespace<Room>;
  FEEDBACK: DurableObjectNamespace<Feedback>;
  /** secret: owner key for GET /api/feedback/export (wrangler secret put ADMIN_KEY) */
  ADMIN_KEY?: string;
  ASSETS?: Fetcher;
  GOOGLE_CLIENT_ID?: string;
  ROOM_TTL_MS?: string;
}

interface Secrets {
  tokens: Record<string, string>;
  subs: Record<string, string>;
}
interface Attachment { seats: string[] }

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

function randomToken() {
  const b = crypto.getRandomValues(new Uint8Array(24));
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

function safeEq(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export function toPublic(s: State): PublicState {
  const { recentIds: _r, ...rest } = s;
  return { ...rest, status: s.hand ? s.hand.status : 'idle' };
}

export class Room extends DurableObject<Env> {
  private state: State | null = null;
  private secrets: Secrets = { tokens: {}, subs: {} };
  private lastActive = 0;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    this.ctx.blockConcurrencyWhile(async () => {
      const m = await this.ctx.storage.get(['state', 'secrets', 'lastActive']);
      this.state = (m.get('state') as State | undefined) ?? null;
      this.secrets = (m.get('secrets') as Secrets | undefined) ?? { tokens: {}, subs: {} };
      this.lastActive = (m.get('lastActive') as number | undefined) ?? 0;
    });
  }

  private ttl() {
    const n = Number(this.env.ROOM_TTL_MS);
    return Number.isFinite(n) && n > 0 ? n : 24 * 3600 * 1000;
  }

  private async persist() {
    this.lastActive = Date.now();
    await this.ctx.storage.put({ state: this.state, secrets: this.secrets, lastActive: this.lastActive });
    await this.ctx.storage.setAlarm(this.lastActive + this.ttl());
  }

  async alarm() {
    const idle = Date.now() - this.lastActive;
    if (idle >= this.ttl() - 50) {
      this.broadcastRaw({ t: 'closed', reason: 'This table expired after 24 hours of silence.' });
      for (const ws of this.ctx.getWebSockets()) { try { ws.close(1000, 'expired'); } catch { /* ignore */ } }
      this.state = null;
      this.secrets = { tokens: {}, subs: {} };
      await this.ctx.storage.deleteAll();
    } else {
      await this.ctx.storage.setAlarm(this.lastActive + this.ttl());
    }
  }

  // ---------- HTTP ----------
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      if (path === '/ws') return this.upgrade(request);
      if (path === '/info') {
        if (!this.state) return json({ exists: false });
        return json({
          exists: true,
          code: this.state.code,
          players: this.state.players.filter((p) => !p.left).length,
          phase: this.state.phase,
          full: this.state.players.filter((p) => !p.left).length >= 12,
        });
      }
      if (request.method !== 'POST') return json({ error: 'Not found' }, 404);
      const body = (await request.json().catch(() => ({}))) as { name?: string; code?: string; credential?: string };
      if (path === '/init') return await this.init(body);
      if (path === '/join') return await this.join(body);
      return json({ error: 'Not found' }, 404);
    } catch (e) {
      console.error('room fetch error', e);
      return json({ error: 'Something went wrong on our side. Try again.' }, 500);
    }
  }

  private async identity(credential: unknown) {
    const cid = this.env.GOOGLE_CLIENT_ID;
    if (!cid || !credential) return null;
    return verifyGoogleIdToken(credential, cid);
  }

  private async init(body: { name?: string; code?: string; credential?: string }) {
    if (this.state) return json({ error: 'exists' }, 409);
    if (typeof body.code !== 'string') return json({ error: 'bad code' }, 400);
    const id = await this.identity(body.credential);
    const r = createRoom(body.code, body.name ?? id?.name ?? '', Date.now());
    if ('error' in r) return json({ error: r.error }, 400);
    this.state = r;
    const token = randomToken();
    this.secrets = { tokens: { s1: token }, subs: id ? { s1: id.sub } : {} };
    if (id?.picture && /^https:\/\/[a-z0-9.-]+\.googleusercontent\.com\//i.test(id.picture)) this.state.players[0].avatar = id.picture.slice(0, 300);
    await this.persist();
    const out: JoinResponse = { code: this.state.code, seat: 's1', token };
    return json(out);
  }

  private async join(body: { name?: string; credential?: string }) {
    if (!this.state) return json({ error: 'No table with that code. Check the letters?' }, 404);
    const id = await this.identity(body.credential);
    if (id) {
      const seat = Object.keys(this.secrets.subs).find((k) => this.secrets.subs[k] === id.sub && this.state!.players.some((p) => p.id === k && !p.left));
      if (seat) {
        const out: JoinResponse = { code: this.state.code, seat, token: this.secrets.tokens[seat], recovered: true };
        return json(out);
      }
    }
    const seat = `s${this.state.nextSeat}`;
    const picture = id?.picture && /^https:\/\/[a-z0-9.-]+\.googleusercontent\.com\//i.test(id.picture) ? id.picture.slice(0, 300) : undefined;
    const res = apply(this.state, { type: 'join', by: seat, id: seat, name: body.name ?? id?.name ?? '', avatar: picture, actionId: `join-${seat}` } as Action, { now: Date.now(), connected: this.connectedSeats() });
    if (!res.ok) return json({ error: res.error, code: res.code }, 400);
    this.state = res.state;
    const token = randomToken();
    this.secrets.tokens[seat] = token;
    if (id) this.secrets.subs[seat] = id.sub;
    await this.persist();
    this.broadcastState();
    const out: JoinResponse = { code: this.state.code, seat, token };
    return json(out);
  }

  // ---------- WebSocket ----------
  private upgrade(request: Request) {
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected websocket', { status: 426 });
    if (!this.state) return json({ error: 'No such table' }, 404);
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ seats: [] } satisfies Attachment);
    return new Response(null, { status: 101, webSocket: client });
  }

  private seatsOf(ws: WebSocket): string[] {
    const a = ws.deserializeAttachment() as Attachment | null;
    return a?.seats ?? [];
  }

  connectedSeats(except?: WebSocket): string[] {
    const set = new Set<string>();
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue;
      for (const s of this.seatsOf(ws)) set.add(s);
    }
    return [...set];
  }

  private snapshotFor(ws: WebSocket, except?: WebSocket): Snapshot {
    return {
      t: 'state',
      state: toPublic(this.state!),
      connected: this.connectedSeats(except),
      you: this.seatsOf(ws).filter((s) => this.state!.players.some((p) => p.id === s)),
      serverNow: Date.now(),
    };
  }

  private send(ws: WebSocket, msg: ServerMsg) {
    try { ws.send(JSON.stringify(msg)); } catch { /* socket gone */ }
  }

  private broadcastRaw(msg: ServerMsg) {
    for (const ws of this.ctx.getWebSockets()) this.send(ws, msg);
  }

  private broadcastState(except?: WebSocket) {
    if (!this.state) return;
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue;
      this.send(ws, this.snapshotFor(ws, except));
    }
  }

  /** after connectivity changes: let the engine re-evaluate vote state, then broadcast */
  private async connectivityChanged(except?: WebSocket) {
    if (!this.state) return;
    const res = apply(this.state, { type: 'sync', by: 'system' }, { now: Date.now(), connected: this.connectedSeats(except) });
    if (res.ok) {
      const changed = res.state.phase !== this.state.phase || res.state.version !== this.state.version;
      this.state = res.state;
      if (changed) await this.persist();
    }
    this.broadcastState(except);
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    if (typeof raw !== 'string' || raw.length > 8192) return;
    let msg: ClientMsg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (!msg || typeof msg !== 'object') return;
    if (!this.state) { this.send(ws, { t: 'closed', reason: 'This table no longer exists.' }); return; }

    if (msg.t === 'hello') {
      const seats: string[] = [];
      for (const t of Array.isArray(msg.tokens) ? msg.tokens.slice(0, 30) : []) {
        const good = typeof t?.seat === 'string' && typeof t?.token === 'string' && this.secrets.tokens[t.seat] && safeEq(this.secrets.tokens[t.seat], t.token);
        if (good && !seats.includes(t.seat)) seats.push(t.seat);
      }
      ws.serializeAttachment({ seats } satisfies Attachment);
      await this.touch();
      await this.connectivityChanged();
      return;
    }

    const mine = this.seatsOf(ws);
    if (msg.t === 'act') {
      const action = msg.action as Action | undefined;
      if (typeof msg.actionId !== 'string' || msg.actionId.length > 64 || !action || typeof action !== 'object') {
        this.send(ws, { t: 'ack', actionId: String(msg.actionId ?? ''), ok: false, error: 'Bad request.', code: 'bad_action' });
        return;
      }
      if (typeof action.by !== 'string' || !mine.includes(action.by) || action.type === 'join' || action.type === 'sync') {
        this.send(ws, { t: 'ack', actionId: msg.actionId, ok: false, error: 'This device is not allowed to play that seat.', code: 'forbidden' });
        return;
      }
      const res = apply(this.state, { ...action, actionId: msg.actionId }, { now: Date.now(), connected: this.connectedSeats() });
      if (!res.ok) {
        this.send(ws, { t: 'ack', actionId: msg.actionId, ok: false, error: res.error, code: res.code });
        this.send(ws, this.snapshotFor(ws));
        return;
      }
      if (res.duplicate) {
        this.send(ws, { t: 'ack', actionId: msg.actionId, ok: true, duplicate: true });
        this.send(ws, this.snapshotFor(ws));
        return;
      }
      this.state = res.state;
      this.dropDeadTokens();
      await this.persist();
      this.send(ws, { t: 'ack', actionId: msg.actionId, ok: true });
      this.broadcastState();
      return;
    }

    if (msg.t === 'addLocal') {
      const hostId = this.state.hostId;
      if (!mine.includes(hostId) || typeof msg.actionId !== 'string' || msg.actionId.length > 64) {
        this.send(ws, { t: 'ack', actionId: String(msg.actionId ?? ''), ok: false, error: 'Only the host device can add players.', code: 'forbidden' });
        return;
      }
      const seat = `s${this.state.nextSeat}`;
      const res = apply(this.state, { type: 'join', by: hostId, id: seat, name: String(msg.name ?? ''), actionId: msg.actionId }, { now: Date.now(), connected: this.connectedSeats() });
      if (!res.ok) {
        this.send(ws, { t: 'ack', actionId: msg.actionId, ok: false, error: res.error, code: res.code });
        return;
      }
      if (res.duplicate) {
        this.send(ws, { t: 'ack', actionId: msg.actionId, ok: true, duplicate: true });
        this.send(ws, this.snapshotFor(ws));
        return;
      }
      this.state = res.state;
      const token = randomToken();
      this.secrets.tokens[seat] = token;
      ws.serializeAttachment({ seats: [...mine, seat] } satisfies Attachment);
      await this.persist();
      this.send(ws, { t: 'seat', seat, token, name: this.state.players.find((p) => p.id === seat)!.name });
      this.send(ws, { t: 'ack', actionId: msg.actionId, ok: true });
      this.broadcastState();
    }
  }

  private dropDeadTokens() {
    if (!this.state) return;
    for (const seat of Object.keys(this.secrets.tokens)) {
      if (!this.state.players.some((p) => p.id === seat)) { delete this.secrets.tokens[seat]; delete this.secrets.subs[seat]; }
    }
  }

  private async touch() {
    this.lastActive = Date.now();
    await this.ctx.storage.put('lastActive', this.lastActive);
    await this.ctx.storage.setAlarm(this.lastActive + this.ttl());
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string) {
    try { ws.close(code, reason); } catch { /* already closed */ }
    await this.connectivityChanged(ws);
  }

  async webSocketError(ws: WebSocket) {
    await this.connectivityChanged(ws);
  }
}
