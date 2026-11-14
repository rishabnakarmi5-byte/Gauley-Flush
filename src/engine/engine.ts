import type {
  Action, ActionEnvelope, Ctx, FeedItem, Hand, HandRecord, Player, Result, Settings, State, Status, Transfer,
} from './types';

export const MAX_PLAYERS = 12;
export const MAX_NAME = 16;
export const DEFAULT_SETTINGS: Settings = { boot: 10, chips: [5, 10, 20, 50, 100], maxBet: 10000 };
const MAX_MONEY = 1_000_000;
const RECENT_IDS = 300;
const FEED_MAX = 40;
const HISTORY_MAX = 200;

// ---------- helpers ----------

export function cleanName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  // strip control chars + angle brackets, collapse whitespace, trim
  const s = raw.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}<>]/gu, '').replace(/\s+/g, ' ').trim();
  const len = [...s].length;
  if (len < 1 || len > MAX_NAME) return null;
  return s;
}

const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n);

export function statusOf(s: State): Status {
  return s.hand ? s.hand.status : 'idle';
}

export function createRoom(code: string, hostName: string, now: number, hostId = 's1'): State | { error: string } {
  const name = cleanName(hostName);
  if (!name) return { error: `Names must be 1-${MAX_NAME} characters.` };
  return {
    version: 1,
    code,
    hostId,
    phase: 'open',
    settings: { ...DEFAULT_SETTINGS, chips: [...DEFAULT_SETTINGS.chips] },
    players: [{ id: hostId, name, net: 0, left: false, classic: false }],
    nextSeat: 2,
    hand: null,
    handNo: 0,
    pot: 0,
    history: [],
    feed: [],
    nextFeed: 1,
    lastAward: null,
    endVote: null,
    paid: {},
    thanks: {},
    recentIds: [],
    createdAt: now,
  };
}

export const activePlayers = (s: State) => s.players.filter((p) => !p.left);
export const getPlayer = (s: State, id: unknown) => (typeof id === 'string' ? s.players.find((p) => p.id === id) : undefined);
export const inHand = (s: State, id: string) => !!s.hand && s.hand.boots.includes(id);
export const isPacked = (s: State, id: string) => !!s.hand && s.hand.packed.includes(id);
export const liveBettors = (s: State) => (s.hand ? s.hand.boots.filter((id) => !s.hand!.packed.includes(id)) : []);
export const sumNets = (s: State) => s.players.reduce((a, p) => a + p.net, 0);

export function thanksAmount(net: number): number {
  if (net <= 0) return 0;
  return Math.max(1, Math.round(net * 0.05));
}

/** Allowed exact bet sizes for a classic-limits player; null means free-form. */
export function allowedBets(s: State, id: string): number[] | null {
  const p = getPlayer(s, id);
  if (!p || !p.classic || !s.hand) return null;
  const stake = s.hand.stake;
  const max = s.settings.maxBet;
  const seen = s.hand.seen.includes(id);
  const raw = seen ? [stake * 2, stake * 4] : [stake, stake * 2];
  return [...new Set(raw.map((x) => Math.min(x, max)))];
}

export function settle(s: State): Transfer[] {
  const idx = new Map(s.players.map((p, i) => [p.id, i]));
  const debtors = s.players.filter((p) => p.net < 0).map((p) => ({ id: p.id, amt: -p.net }));
  const creditors = s.players.filter((p) => p.net > 0).map((p) => ({ id: p.id, amt: p.net }));
  const pick = (arr: { id: string; amt: number }[]) => {
    let best = -1;
    for (let i = 0; i < arr.length; i++) {
      if (arr[i].amt <= 0) continue;
      if (best < 0 || arr[i].amt > arr[best].amt || (arr[i].amt === arr[best].amt && idx.get(arr[i].id)! < idx.get(arr[best].id)!)) best = i;
    }
    return best;
  };
  const out: Transfer[] = [];
  for (;;) {
    const d = pick(debtors);
    const c = pick(creditors);
    if (d < 0 || c < 0) break;
    const amount = Math.min(debtors[d].amt, creditors[c].amt);
    out.push({ from: debtors[d].id, to: creditors[c].id, amount, key: `${debtors[d].id}>${creditors[c].id}` });
    debtors[d].amt -= amount;
    creditors[c].amt -= amount;
  }
  return out;
}

const err = (error: string, code: string): Result => ({ error, code });

function feed(s: State, ctx: Ctx, item: Omit<FeedItem, 'id' | 't'>) {
  s.feed.push({ id: s.nextFeed++, t: ctx.now, ...item });
  if (s.feed.length > FEED_MAX) s.feed.splice(0, s.feed.length - FEED_MAX);
}

function isConnected(ctx: Ctx, id: string) {
  return !ctx.connected || ctx.connected.includes(id);
}

function hostLike(s: State, by: string, ctx: Ctx) {
  if (by === s.hostId) return true;
  const host = getPlayer(s, s.hostId);
  const hostGone = !host || host.left || !isConnected(ctx, s.hostId);
  return hostGone && !!getPlayer(s, by) && !getPlayer(s, by)!.left;
}

function validateSettings(a: { boot?: number; chips?: number[]; maxBet?: number }, cur: Settings): Settings | string {
  const next: Settings = { boot: cur.boot, chips: [...cur.chips], maxBet: cur.maxBet };
  if (a.maxBet !== undefined) {
    if (!isInt(a.maxBet) || a.maxBet < 1 || a.maxBet > MAX_MONEY) return `Max bet must be a whole number from 1 to ${MAX_MONEY}.`;
    next.maxBet = a.maxBet;
  }
  if (a.boot !== undefined) {
    if (!isInt(a.boot) || a.boot < 1 || a.boot > MAX_MONEY) return `Boot must be a whole number from 1 to ${MAX_MONEY}.`;
    next.boot = a.boot;
  }
  if (a.chips !== undefined) {
    if (!Array.isArray(a.chips) || a.chips.length < 1 || a.chips.length > 8) return 'Pick between 1 and 8 chips.';
    if (!a.chips.every((c) => isInt(c) && c >= 1 && c <= MAX_MONEY)) return 'Chips must be whole numbers of rupees.';
    next.chips = [...new Set(a.chips)].sort((x, y) => x - y);
  }
  if (next.boot > next.maxBet) return 'Boot cannot be bigger than the max bet.';
  if (next.chips.some((c) => c > next.maxBet)) return 'A chip is bigger than the max bet.';
  return next;
}

function award(s: State, ctx: Ctx, winner: string, how: 'claim' | 'last') {
  const hand = s.hand!;
  const pot = s.pot;
  const w = getPlayer(s, winner)!;
  w.net += pot;
  s.pot = 0;
  const rec: HandRecord = {
    no: hand.no,
    result: 'won',
    how,
    winner,
    pot,
    participants: hand.boots.map((id) => ({ id, contrib: hand.contrib[id] ?? 0, packed: hand.packed.includes(id) })),
    at: ctx.now,
  };
  s.history.push(rec);
  if (s.history.length > HISTORY_MAX) s.history.shift();
  s.lastAward = { hand: structuredClone(hand), winner, pot, how };
  s.hand = null;
  feed(s, ctx, { type: 'win', by: winner, amount: pot, text: how });
}

function refundAndClear(s: State, ctx: Ctx, hand: Hand) {
  for (const id of Object.keys(hand.contrib)) {
    const p = getPlayer(s, id);
    if (p) p.net += hand.contrib[id];
  }
  s.pot = 0;
  s.history.push({
    no: hand.no,
    result: 'void',
    winner: null,
    pot: 0,
    participants: hand.boots.map((id) => ({ id, contrib: 0, packed: hand.packed.includes(id) })),
    at: ctx.now,
  });
  if (s.history.length > HISTORY_MAX) s.history.shift();
  s.hand = null;
}

function charge(s: State, hand: Hand, id: string, amount: number) {
  const p = getPlayer(s, id)!;
  p.net -= amount;
  s.pot += amount;
  hand.contrib[id] = (hand.contrib[id] ?? 0) + amount;
}

function refund(s: State, hand: Hand, id: string, amount: number) {
  const p = getPlayer(s, id)!;
  p.net += amount;
  s.pot -= amount;
  hand.contrib[id] -= amount;
}

function evalEnd(s: State, ctx: Ctx) {
  if (!s.endVote || s.phase !== 'open' || s.hand) return;
  const need = activePlayers(s).filter((p) => isConnected(ctx, p.id) || p.id === s.endVote!.by);
  if (need.every((p) => s.endVote!.agree.includes(p.id))) {
    s.phase = 'settled';
    s.endVote = null;
    s.paid = {};
    s.thanks = {};
    feed(s, ctx, { type: 'settled' });
  }
}

// ---------- reducer ----------

export function apply(prev: State, envelope: ActionEnvelope, ctx: Ctx): Result {
  const a = envelope as Action & { actionId?: string };
  if (!a || typeof a !== 'object' || typeof a.type !== 'string') return err('That did not look like a move.', 'bad_action');
  if (a.actionId !== undefined && (typeof a.actionId !== 'string' || a.actionId.length > 64)) return err('Bad action id.', 'bad_action');
  if (a.actionId && prev.recentIds.includes(a.actionId)) return { state: prev, duplicate: true };

  const s: State = structuredClone(prev);
  const r = reduce(s, a, ctx);
  if (r) return r;
  s.version = prev.version + 1;
  if (a.actionId) {
    s.recentIds.push(a.actionId);
    if (s.recentIds.length > RECENT_IDS) s.recentIds.splice(0, s.recentIds.length - RECENT_IDS);
  }
  return { state: s };
}

/** mutates s; returns an error Result or undefined on success */
function reduce(s: State, a: Action, ctx: Ctx): Result | undefined {
  if (a.type === 'sync') {
    if (a.by !== 'system') return err('Nice try.', 'forbidden');
    evalEnd(s, ctx);
    return;
  }
  if (a.type === 'join') {
      if (s.phase !== 'open') return err('The table is settled. Ask the host to reopen it.', 'settled');
      if (a.by !== a.id && a.by !== s.hostId) return err('You cannot add that player.', 'forbidden');
      if (activePlayers(s).length >= MAX_PLAYERS) return err(`Table is full (${MAX_PLAYERS} players max).`, 'full');
      const name = cleanName(a.name);
      if (!name) return err(`Names must be 1-${MAX_NAME} characters.`, 'bad_name');
      if (s.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) return err('Someone already has that name at this table.', 'name_taken');
      if (typeof a.id !== 'string' || !/^s\d{1,4}$/.test(a.id) || getPlayer(s, a.id)) return err('Bad seat.', 'bad_action');
      const p: Player = { id: a.id, name, net: 0, left: false, classic: false };
      if (typeof a.avatar === 'string' && a.avatar.length <= 300 && /^https:\/\/[a-z0-9.-]+\.googleusercontent\.com\//i.test(a.avatar)) p.avatar = a.avatar;
      s.players.push(p);
      s.nextSeat = Math.max(s.nextSeat, parseInt(a.id.slice(1), 10) + 1);
      feed(s, ctx, { type: 'join', by: p.id });
      return;
    }
  const actor = getPlayer(s, a.by);
  if (!actor || actor.left) return err('You are not at this table.', 'not_seated');
  const status = statusOf(s);
  const hand = s.hand;

  // seat-targeted actions: `by` must be the seat itself (the DO maps tokens -> seats)
  const seatOf = (id: unknown) => {
    const p = getPlayer(s, id);
    return p && !p.left ? p : undefined;
  };

  switch (a.type) {
    case 'removePlayer': {
      const t = seatOf(a.target);
      if (!t) return err('No such player.', 'bad_target');
      if (t.id !== a.by && !hostLike(s, a.by, ctx)) return err('Only the host can remove players.', 'forbidden');
      if (t.id === s.hostId) return err('Hand the host role to someone else first.', 'forbidden');
      if (hand && hand.boots.includes(t.id)) return err(`${t.name} is in a live hand. Finish or void it first.`, 'in_hand');
      if (s.endVote) s.endVote.agree = s.endVote.agree.filter((x) => x !== t.id);
      if (hand) hand.sitOut = hand.sitOut.filter((x) => x !== t.id);
      if (t.net === 0) {
        s.players = s.players.filter((p) => p.id !== t.id);
      } else {
        t.left = true;
      }
      feed(s, ctx, { type: 'leave', by: t.id });
      if (s.endVote && s.endVote.by === t.id) s.endVote = null;
      evalEnd(s, ctx);
      return;
    }
    case 'transferHost': {
      if (!hostLike(s, a.by, ctx)) return err('Only the host can hand over the keys.', 'forbidden');
      const t = seatOf(a.target);
      if (!t) return err('No such player.', 'bad_target');
      s.hostId = t.id;
      feed(s, ctx, { type: 'host', by: t.id });
      return;
    }
    case 'settings': {
      if (!hostLike(s, a.by, ctx)) return err('Only the host can change the rules.', 'forbidden');
      if (hand) return err('Settings are locked during a hand.', 'wrong_status');
      if (s.phase !== 'open') return err('The table is settled.', 'settled');
      const next = validateSettings(a, s.settings);
      if (typeof next === 'string') return err(next, 'bad_value');
      s.settings = next;
      feed(s, ctx, { type: 'settings' });
      return;
    }
    case 'setClassic': {
      if (a.by !== a.seat) return err('Only you can change your own limits.', 'forbidden');
      if (typeof a.on !== 'boolean') return err('Bad value.', 'bad_value');
      if (hand && hand.boots.includes(a.seat)) return err('Not mid-hand. Change it after this hand.', 'in_hand');
      actor.classic = a.on;
      return;
    }
    case 'newHand': {
      if (s.phase !== 'open') return err('The table is settled. Reopen it first.', 'settled');
      if (!hostLike(s, a.by, ctx)) return err('Only the host can deal a new hand.', 'forbidden');
      if (hand) return err('A hand is already running.', 'wrong_status');
      if (s.endVote) return err('An end-game vote is open. Cancel it to keep playing.', 'wrong_status');
      if (activePlayers(s).length < 2) return err('You need at least 2 players. Chai first, invite a friend.', 'not_enough');
      s.handNo += 1;
      s.hand = {
        no: s.handNo, status: 'boot', boots: [], sitOut: [], contrib: {}, packed: [], seen: [],
        stake: s.settings.boot, log: [], claimBy: null, startedAt: ctx.now,
      };
      s.lastAward = null;
      feed(s, ctx, { type: 'newHand', by: a.by, amount: s.settings.boot });
      return;
    }
    case 'boot': {
      if (a.by !== a.seat) return err('You can only boot for yourself.', 'forbidden');
      if (!hand || hand.status !== 'boot') return err(hand ? 'Betting has started, wait for the next hand.' : 'No hand is running.', 'wrong_status');
      if (hand.boots.includes(a.seat)) return err('You already booted.', 'duplicate');
      hand.boots.push(a.seat);
      hand.sitOut = hand.sitOut.filter((x) => x !== a.seat);
      charge(s, hand, a.seat, s.settings.boot);
      hand.log.push({ n: hand.log.length + 1, type: 'boot', by: a.seat, amount: s.settings.boot, prevStake: hand.stake });
      feed(s, ctx, { type: 'boot', by: a.seat, amount: s.settings.boot });
      return;
    }
    case 'sitOut': {
      if (a.by !== a.seat) return err('You can only sit out for yourself.', 'forbidden');
      if (!hand || hand.status !== 'boot') return err('Nothing to sit out of right now.', 'wrong_status');
      if (hand.boots.includes(a.seat)) return err('You already booted.', 'wrong_status');
      if (!hand.sitOut.includes(a.seat)) hand.sitOut.push(a.seat);
      feed(s, ctx, { type: 'sitOut', by: a.seat });
      return;
    }
    case 'bet': {
      if (a.by !== a.seat) return err('You can only bet for yourself.', 'forbidden');
      if (!hand || (hand.status !== 'boot' && hand.status !== 'betting')) {
        return err(hand?.status === 'claimed' ? 'A claim is pending. Reject it to keep betting.' : 'No hand is running.', 'wrong_status');
      }
      if (!hand.boots.includes(a.seat)) return err('You are not in this hand. Wait for the next one.', 'not_in_hand');
      if (hand.packed.includes(a.seat)) return err('You packed. Wait for the next hand.', 'packed');
      if (!isInt(a.amount) || a.amount < 1) return err('Bet a whole number of rupees, at least Rs 1.', 'bad_amount');
      if (a.amount > s.settings.maxBet) return err(`Max bet is Rs ${s.settings.maxBet}.`, 'bad_amount');
      if (hand.status === 'boot' && hand.boots.length < 2) return err('Need at least 2 players booted before the first chaal.', 'wrong_status');
      const allowed = allowedBets(s, a.seat);
      if (allowed && !allowed.includes(a.amount)) {
        return err(`Classic limits: bet ${allowed.map((x) => 'Rs ' + x).join(' or ')}.`, 'limit');
      }
      const prevStake = hand.stake;
      const seen = hand.seen.includes(a.seat);
      hand.stake = actor.classic && seen ? Math.max(1, Math.floor(a.amount / 2)) : a.amount;
      if (hand.status === 'boot') hand.status = 'betting';
      charge(s, hand, a.seat, a.amount);
      hand.log.push({ n: hand.log.length + 1, type: 'bet', by: a.seat, amount: a.amount, prevStake });
      feed(s, ctx, { type: 'bet', by: a.seat, amount: a.amount });
      return;
    }
    case 'seeCards': {
      if (a.by !== a.seat) return err('Peek at your own cards only.', 'forbidden');
      if (!actor.classic) return err('Turn on classic limits to track blind/seen.', 'wrong_status');
      if (!hand || hand.status === 'claimed') return err('Not now.', 'wrong_status');
      if (!hand.boots.includes(a.seat) || hand.packed.includes(a.seat)) return err('You are not playing this hand.', 'not_in_hand');
      if (hand.seen.includes(a.seat)) return err('Already seen.', 'duplicate');
      hand.seen.push(a.seat);
      feed(s, ctx, { type: 'see', by: a.seat });
      return;
    }
    case 'pack':
    case 'packFor': {
      const target = a.seat;
      if (a.type === 'pack' && a.by !== a.seat) return err('You can only pack for yourself.', 'forbidden');
      if (a.type === 'packFor') {
        if (!hostLike(s, a.by, ctx)) return err('Only the host can pack someone.', 'forbidden');
        if (isConnected(ctx, target)) return err('They are still connected. Let them pack themselves.', 'forbidden');
      }
      if (!hand || hand.status !== 'betting') return err(hand?.status === 'claimed' ? 'A claim is pending. Reject it first.' : 'You can only pack once betting has started.', 'wrong_status');
      if (!hand.boots.includes(target)) return err('Not in this hand.', 'not_in_hand');
      if (hand.packed.includes(target)) return err('Already packed.', 'duplicate');
      hand.packed.push(target);
      hand.log.push({ n: hand.log.length + 1, type: 'pack', by: target, amount: 0, prevStake: hand.stake });
      feed(s, ctx, { type: 'pack', by: target });
      const left = liveBettors(s);
      if (left.length === 1) award(s, ctx, left[0], 'last');
      return;
    }
    case 'undo': {
      if (a.by !== a.seat) return err('You can only undo your own move.', 'forbidden');
      if (!hand || hand.status !== 'betting') return err('Undo only works while betting is open.', 'wrong_status');
      const last = hand.log[hand.log.length - 1];
      if (!last || last.by !== a.seat || (last.type !== 'bet' && last.type !== 'pack')) return err('Only your own latest move can be undone.', 'not_latest');
      hand.log.pop();
      if (last.type === 'bet') {
        refund(s, hand, a.seat, last.amount);
        hand.stake = last.prevStake;
      } else {
        hand.packed = hand.packed.filter((x) => x !== a.seat);
      }
      feed(s, ctx, { type: 'undo', by: a.seat, amount: last.amount, text: last.type });
      return;
    }
    case 'claim': {
      if (a.by !== a.seat) return err('You can only claim for yourself.', 'forbidden');
      if (!hand || hand.status !== 'betting') return err(hand?.status === 'claimed' ? 'Someone already claimed.' : 'Nothing to claim yet.', 'wrong_status');
      if (!hand.boots.includes(a.seat) || hand.packed.includes(a.seat)) return err('Only un-packed players can claim.', 'not_in_hand');
      hand.status = 'claimed';
      hand.claimBy = a.seat;
      feed(s, ctx, { type: 'claim', by: a.seat });
      return;
    }
    case 'withdrawClaim': {
      if (!hand || hand.status !== 'claimed') return err('No claim to withdraw.', 'wrong_status');
      if (hand.claimBy !== a.seat || a.by !== a.seat) return err('Only the claimant can withdraw.', 'forbidden');
      hand.status = 'betting';
      hand.claimBy = null;
      feed(s, ctx, { type: 'withdraw', by: a.seat });
      return;
    }
    case 'confirmClaim':
    case 'rejectClaim': {
      if (a.by !== a.seat) return err('Bad seat.', 'forbidden');
      if (!hand || hand.status !== 'claimed' || !hand.claimBy) return err('There is no claim to answer.', 'wrong_status');
      if (!hand.boots.includes(a.seat)) return err('Only players who were in this hand can answer a claim.', 'not_in_hand');
      if (a.seat === hand.claimBy) return err('You cannot confirm your own claim. Ask someone else.', 'self_confirm');
      const claimant = hand.claimBy;
      if (a.type === 'confirmClaim') {
        award(s, ctx, claimant, 'claim');
      } else {
        hand.status = 'betting';
        hand.claimBy = null;
        feed(s, ctx, { type: 'reject', by: a.seat, to: claimant });
      }
      return;
    }
    case 'voidHand': {
      if (!hand) return err('No hand to void.', 'wrong_status');
      if (!hostLike(s, a.by, ctx)) return err('Only the host can void a hand.', 'forbidden');
      refundAndClear(s, ctx, hand);
      feed(s, ctx, { type: 'void', by: a.by });
      return;
    }
    case 'undoAward': {
      if (!hostLike(s, a.by, ctx)) return err('Only the host can undo an award.', 'forbidden');
      if (hand || !s.lastAward) return err('Nothing to undo. It is only possible before the next hand starts.', 'wrong_status');
      if (s.phase !== 'open') return err('The table is settled.', 'settled');
      const la = s.lastAward;
      if (la.hand.boots.some((id) => { const p = getPlayer(s, id); return !p || p.left; })) return err('Someone from that hand has left the table, so it cannot be reopened.', 'wrong_status');
      const w = getPlayer(s, la.winner)!;
      w.net -= la.pot;
      s.pot = la.pot;
      const h = structuredClone(la.hand);
      h.status = 'betting';
      h.claimBy = null;
      if (la.how === 'last') {
        const lastEntry = h.log.pop();
        if (lastEntry && lastEntry.type === 'pack') h.packed = h.packed.filter((x) => x !== lastEntry.by);
      }
      s.hand = h;
      for (let i = s.history.length - 1; i >= 0; i--) {
        if (s.history[i].no === h.no && s.history[i].result === 'won') { s.history.splice(i, 1); break; }
      }
      s.lastAward = null;
      feed(s, ctx, { type: 'undoAward', by: a.by });
      return;
    }
    case 'proposeEnd': {
      if (a.by !== a.seat) return err('Bad seat.', 'forbidden');
      if (s.phase !== 'open') return err('Already settled.', 'settled');
      if (hand) return err('Finish the live hand first.', 'wrong_status');
      if (s.endVote) return err('A vote is already open.', 'duplicate');
      s.endVote = { by: a.seat, agree: [a.seat] };
      feed(s, ctx, { type: 'proposeEnd', by: a.seat });
      evalEnd(s, ctx);
      return;
    }
    case 'agreeEnd': {
      if (a.by !== a.seat) return err('Bad seat.', 'forbidden');
      if (!s.endVote) return err('No end-game vote is open.', 'wrong_status');
      if (!s.endVote.agree.includes(a.seat)) s.endVote.agree.push(a.seat);
      evalEnd(s, ctx);
      return;
    }
    case 'cancelEnd': {
      if (!s.endVote) return err('No end-game vote is open.', 'wrong_status');
      s.endVote = null;
      feed(s, ctx, { type: 'cancelEnd', by: a.by });
      return;
    }
    case 'forceEnd': {
      if (!hostLike(s, a.by, ctx)) return err('Only the host can force the end.', 'forbidden');
      if (s.phase !== 'open') return err('Already settled.', 'settled');
      if (hand) return err('Finish the live hand first.', 'wrong_status');
      s.phase = 'settled';
      s.endVote = null;
      s.paid = {};
      s.thanks = {};
      feed(s, ctx, { type: 'settled' });
      return;
    }
    case 'reopen': {
      if (!hostLike(s, a.by, ctx)) return err('Only the host can reopen the table.', 'forbidden');
      if (s.phase !== 'settled') return err('The table is already open.', 'wrong_status');
      s.phase = 'open';
      s.paid = {};
      s.thanks = {};
      feed(s, ctx, { type: 'reopen', by: a.by });
      return;
    }
    case 'markPaid': {
      if (s.phase !== 'settled') return err('Settle up first.', 'wrong_status');
      if (typeof a.paid !== 'boolean' || typeof a.key !== 'string') return err('Bad value.', 'bad_value');
      const t = settle(s).find((x) => x.key === a.key);
      if (!t) return err('No such payment.', 'bad_target');
      if (a.by !== a.seat) return err('Bad seat.', 'forbidden');
      if (a.seat !== t.from && a.seat !== t.to) return err('Only the payer or the payee can tick this.', 'forbidden');
      if (a.paid) s.paid[a.key] = true; else delete s.paid[a.key];
      return;
    }
    case 'thanks': {
      if (a.by !== a.seat) return err('Bad seat.', 'forbidden');
      if (s.phase !== 'settled') return err('Settle up first.', 'wrong_status');
      if (a.choice !== 'yes' && a.choice !== 'no') return err('Bad value.', 'bad_value');
      if (actor.net <= 0) return err('Only winners get this prompt.', 'forbidden');
      s.thanks[a.seat] = a.choice;
      return;
    }
    default:
      return err('Unknown move.', 'bad_action');
  }
}
