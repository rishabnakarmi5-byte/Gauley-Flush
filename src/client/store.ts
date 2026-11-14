import { useEffect, useState } from 'preact/hooks';
import type { Action } from '../engine/types';
import type { ClientMsg, ConfigResponse, JoinResponse, ServerMsg, Snapshot } from '../shared/protocol';

export interface SeatToken { seat: string; token: string; name: string }
export interface Session {
  code: string;
  tokens: SeatToken[];
  active?: string;
  tablet?: boolean;
  pendingNames?: string[];
}
export interface Toast { id: number; text: string; kind: 'info' | 'error' | 'good' }

export interface AppState {
  route: { name: 'home' | 'room' | 'tablet' | 'how' | 'feedback'; code?: string };
  session: Session | null;
  snap: Snapshot | null;
  online: boolean;
  everConnected: boolean;
  closedReason: string | null;
  toasts: Toast[];
  config: ConfigResponse;
  pending: Record<string, number>;
  sheet: null | 'history' | 'menu' | 'how' | 'share' | 'settings';
}

let S: AppState = {
  route: { name: 'home' }, session: null, snap: null, online: false, everConnected: false, closedReason: null,
  toasts: [], config: { googleClientId: '' }, pending: {}, sheet: null,
};
const listeners = new Set<() => void>();
export const getState = () => S;
export function setState(patch: Partial<AppState>) {
  S = { ...S, ...patch };
  listeners.forEach((l) => l());
}
export function useStore(): AppState {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((x) => x + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return S;
}

// ---------- local storage (always guarded) ----------
const ls = {
  get(k: string): string | null { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  del(k: string) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};
export function loadSession(code: string): Session | null {
  const raw = ls.get(`gf:room:${code}`);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as Session;
    return s && s.code === code && Array.isArray(s.tokens) ? s : null;
  } catch { return null; }
}
export function saveSession(s: Session) {
  ls.set(`gf:room:${s.code}`, JSON.stringify(s));
  ls.set('gf:last', s.code);
  if (S.session?.code === s.code) setState({ session: s });
}
export const lastRoom = () => ls.get('gf:last');
export function forgetRoom(code: string) {
  ls.del(`gf:room:${code}`);
  if (ls.get('gf:last') === code) ls.del('gf:last');
}
export const savedName = () => ls.get('gf:name') ?? '';
export const saveName = (n: string) => ls.set('gf:name', n);

// ---------- toasts ----------
let toastId = 1;
export function toast(text: string, kind: Toast['kind'] = 'info', ms = 3200) {
  const id = toastId++;
  setState({ toasts: [...S.toasts.slice(-2), { id, text, kind }] });
  setTimeout(() => setState({ toasts: S.toasts.filter((t) => t.id !== id) }), ms);
}

// ---------- API ----------
async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, body === undefined ? undefined : { method: 'POST', body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

export async function loadConfig() {
  try { setState({ config: await api<ConfigResponse>('/api/config') }); } catch { /* optional */ }
}

export async function createTable(name: string, credential?: string, extra?: { tablet?: boolean; pendingNames?: string[] }) {
  const r = await api<JoinResponse>('/api/rooms', { name, credential });
  saveName(name);
  saveSession({ code: r.code, tokens: [{ seat: r.seat, token: r.token, name }], active: r.seat, ...extra });
  location.hash = `#/r/${r.code}`;
}

export async function joinTable(code: string, name: string, credential?: string) {
  const r = await api<JoinResponse>(`/api/rooms/${code}/join`, { name, credential });
  saveName(name);
  const prev = loadSession(code);
  const tokens = [...(prev?.tokens ?? []).filter((t) => t.seat !== r.seat), { seat: r.seat, token: r.token, name }];
  saveSession({ code, tokens, active: r.seat });
  setState({ closedReason: null });
  openRoom(code);
  return r;
}

export async function roomInfo(code: string) {
  return api<{ exists: boolean; players?: number; phase?: string; full?: boolean }>(`/api/rooms/${code}/info`);
}

// ---------- connection ----------
let ws: WebSocket | null = null;
let wsCode: string | null = null;
let attempt = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
let heartbeat: ReturnType<typeof setInterval> | undefined;
let lastPong = 0;
const pending = new Map<string, { msg: ClientMsg; at: number; resolve: (ok: boolean) => void }>();
const recent = new Map<string, number>();

function wsUrl(code: string) {
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/rooms/${code}/ws`;
}

export function openRoom(code: string) {
  if (wsCode === code && ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  closeRoom(false);
  wsCode = code;
  const session = loadSession(code);
  setState({ session, snap: null, online: false, everConnected: false, closedReason: null, pending: {} });
  if (session) connect();
}

export function closeRoom(clear = true) {
  clearTimeout(reconnectTimer);
  clearInterval(heartbeat);
  if (ws) { const w = ws; ws = null; w.onclose = null; w.onmessage = null; w.onerror = null; try { w.close(); } catch { /* */ } }
  wsCode = null;
  attempt = 0;
  if (clear) setState({ snap: null, online: false, session: null });
}

function connect() {
  if (!wsCode) return;
  const session = loadSession(wsCode);
  if (!session) return;
  clearTimeout(reconnectTimer);
  let sock: WebSocket;
  try { sock = new WebSocket(wsUrl(wsCode)); } catch { scheduleReconnect(); return; }
  ws = sock;
  sock.onopen = () => {
    const s = loadSession(wsCode!);
    send({ t: 'hello', tokens: (s?.tokens ?? []).map(({ seat, token }) => ({ seat, token })) });
    lastPong = Date.now();
    clearInterval(heartbeat);
    heartbeat = setInterval(() => {
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      if (Date.now() - lastPong > 25000) { try { ws.close(); } catch { /* */ } return; }
      try { ws.send('ping'); } catch { /* */ }
    }, 10000);
  };
  sock.onmessage = (e) => {
    lastPong = Date.now();
    if (e.data === 'pong') return;
    let m: ServerMsg;
    try { m = JSON.parse(e.data as string); } catch { return; }
    onServer(m);
  };
  sock.onclose = () => {
    if (ws !== sock) return;
    clearInterval(heartbeat);
    setState({ online: false });
    scheduleReconnect();
  };
  sock.onerror = () => { /* close follows */ };
}

function scheduleReconnect() {
  if (!wsCode || S.closedReason) return;
  clearTimeout(reconnectTimer);
  const delay = Math.min(8000, 400 * 2 ** attempt) * (0.75 + Math.random() * 0.5);
  attempt++;
  reconnectTimer = setTimeout(connect, delay);
}

/** called on tab foreground / network back */
export function nudgeConnection() {
  if (!wsCode || S.closedReason) return;
  if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
    attempt = 0;
    connect();
  } else if (ws.readyState === WebSocket.OPEN) {
    // verify the socket is actually alive after phone sleep
    lastPong = 0;
    try { ws.send('ping'); } catch { /* */ }
    setTimeout(() => { if (ws && ws.readyState === WebSocket.OPEN && lastPong === 0) { try { ws.close(); } catch { /* */ } } }, 3000);
  }
}

/** network came back: do not trust the old socket, open a fresh one (the server de-dups replays) */
export function reconnectNow() {
  if (!wsCode || S.closedReason) return;
  clearTimeout(reconnectTimer);
  clearInterval(heartbeat);
  if (ws) { const w = ws; ws = null; w.onclose = null; w.onmessage = null; w.onerror = null; try { w.close(); } catch { /* */ } }
  attempt = 0;
  connect();
}

function send(m: ClientMsg) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m));
}

function onServer(m: ServerMsg) {
  if (m.t === 'state') {
    const cur = S.snap;
    if (cur && m.state.version < cur.state.version) return; // stale
    attempt = 0;
    setState({ snap: m, online: true, everConnected: true });
    // keep active seat valid
    const sess = S.session;
    if (sess) {
      const mine = m.you;
      if (mine.length && (!sess.active || !mine.includes(sess.active))) {
        sess.active = mine[0];
        saveSession({ ...sess });
      }
      // finish tablet setup: add pending local players
      if (sess.pendingNames?.length && !flushing) {
        flushPending(sess);
      }
    }
    // replay anything unacked (same actionIds => server de-dups)
    for (const [, p] of pending) if (Date.now() - p.at < 30000) send(p.msg);
    return;
  }
  if (m.t === 'ack') {
    const p = pending.get(m.actionId);
    if (p) {
      pending.delete(m.actionId);
      p.resolve(m.ok);
    }
    if (!m.ok) toast(m.error, 'error');
    return;
  }
  if (m.t === 'seat') {
    const sess = loadSession(wsCode!);
    if (sess) {
      sess.tokens = [...sess.tokens.filter((t) => t.seat !== m.seat), { seat: m.seat, token: m.token, name: m.name }];
      saveSession(sess);
    }
    return;
  }
  if (m.t === 'closed') {
    setState({ closedReason: m.reason });
    if (wsCode) forgetRoom(wsCode);
  }
}

let flushing = false;

async function flushPending(sess: Session) {
  flushing = true;
  const list = [...sess.pendingNames!];
  const done = loadSession(sess.code)!;
  done.pendingNames = [];
  saveSession(done);
  for (const name of list) await addLocalPlayer(name, true);
  flushing = false;
}

export function newId() {
  try { return crypto.randomUUID(); } catch { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`; }
}

export function addLocalPlayer(name: string, quiet = false): Promise<boolean> {
  const actionId = newId();
  const msg: ClientMsg = { t: 'addLocal', actionId, name };
  return new Promise((resolve) => {
    if (!S.online) { if (!quiet) toast('You are offline. Hang on…', 'error'); resolve(false); return; }
    pending.set(actionId, { msg, at: Date.now(), resolve });
    send(msg);
  });
}

type DistOmit<T, K extends keyof any> = T extends any ? Omit<T, K> : never;
type Intent = DistOmit<Action, 'by'> & { by?: string };

/** send an intent for the active seat (or an explicit `by`). Resolves true when the server accepted it. */
export function act(intent: Intent): Promise<boolean> {
  if (!S.online) { toast('You are offline. Reconnecting…', 'error'); return Promise.resolve(false); }
  const by = intent.by ?? (intent as { seat?: string }).seat ?? S.session?.active;
  if (!by) return Promise.resolve(false);
  const action = { ...intent, by } as Action;
  // collapse accidental double-taps on the very same button
  const key = JSON.stringify(action);
  const now = Date.now();
  if ((recent.get(key) ?? 0) > now - 600) return Promise.resolve(false);
  recent.set(key, now);
  if (recent.size > 50) for (const [k, t] of recent) if (t < now - 2000) recent.delete(k);
  const actionId = newId();
  const msg: ClientMsg = { t: 'act', actionId, action };
  return new Promise((resolve) => {
    pending.set(actionId, { msg, at: now, resolve });
    send(msg);
    setTimeout(() => { const p = pending.get(actionId); if (p && Date.now() - p.at >= 30000) { pending.delete(actionId); p.resolve(false); } }, 30500);
  });
}

export function setActive(seat: string) {
  const s = S.session;
  if (s) saveSession({ ...s, active: seat });
}
export function setPending(seat: string, amount: number) {
  setState({ pending: { ...S.pending, [seat]: Math.max(0, Math.min(amount, 100_000_000)) } });
}

// ---------- hash routing ----------
export function syncRoute() {
  const h = location.hash.replace(/^#/, '');
  const m = /^\/r\/([A-Za-z]{4})$/.exec(h);
  if (m) {
    const code = m[1].toUpperCase();
    setState({ route: { name: 'room', code }, sheet: null });
    openRoom(code);
  } else if (h === '/tablet') {
    closeRoom();
    setState({ route: { name: 'tablet' }, sheet: null });
  } else if (h === '/feedback') {
    closeRoom();
    setState({ route: { name: 'feedback' }, sheet: null });
  } else if (h === '/how') {
    closeRoom();
    setState({ route: { name: 'how' }, sheet: null });
  } else {
    closeRoom();
    setState({ route: { name: 'home' }, sheet: null });
  }
}

export function startClient() {
  window.addEventListener('hashchange', syncRoute);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { nudgeConnection(); requestWake(); } });
  window.addEventListener('online', reconnectNow);
  window.addEventListener('offline', () => { if (wsCode) setState({ online: false }); });
  window.addEventListener('pageshow', nudgeConnection);
  void loadConfig();
  syncRoute();
}

// ---------- wake lock ----------
let wake: WakeLockSentinel | null = null;
export async function requestWake() {
  try {
    if (S.route.name !== 'room' || document.visibilityState !== 'visible') return;
    if (wake && !wake.released) return;
    wake = (await navigator.wakeLock?.request('screen')) ?? null;
  } catch { /* unsupported or denied */ }
}
