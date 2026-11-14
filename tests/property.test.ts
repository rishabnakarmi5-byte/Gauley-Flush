import { describe, it, expect } from 'vitest';
import { apply, settle, sumNets, type Action, type State, MAX_PLAYERS } from '../src/engine';
import { room, NOW } from './helpers';

function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

const TYPES = ['join','removePlayer','transferHost','settings','setClassic','newHand','boot','boot','sitOut','bet','bet','bet','bet','seeCards','pack','packFor','undo','claim','withdrawClaim','confirmClaim','rejectClaim','voidHand','undoAward','proposeEnd','agreeEnd','cancelEnd','forceEnd','reopen','markPaid','thanks'];

function randomAction(r: () => number, s: State): Action {
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const ids = [...s.players.map((p) => p.id), 'ghost'];
  const seat = r() < 0.9 ? pick(ids) : pick(['s1', 'zz']);
  const by = r() < 0.9 ? seat : pick(ids);
  const wild = [0, -1, 1, 5, 10, 20, 40, 100, 9999, 10000, 10001, 1.5, NaN, Infinity, '7', null, undefined, 2 ** 53];
  const amount = r() < 0.6 ? pick([5, 10, 20, 40, 80, 100, 7, 33]) : pick(wild);
  const type = pick(TYPES);
  switch (type) {
    case 'join': { const id = `s${s.nextSeat + (r() < 0.1 ? 0 : Math.floor(r()*3))}`; return { type, by: r() < 0.7 ? id : 's1', id, name: pick(['Aa','Bb','Cc','<x>','', 'N'.repeat(20), `P${Math.floor(r()*30)}`]) }; }
    case 'removePlayer': return { type, by, target: pick(ids) };
    case 'transferHost': return { type, by, target: pick(ids) };
    case 'settings': return { type, by: r() < 0.8 ? 's1' : by, boot: r() < 0.5 ? (pick(wild) as any) : undefined, chips: r() < 0.3 ? (pick([[1,2],[],[5,-5],[10,10,20]]) as any) : undefined, maxBet: r() < 0.3 ? (pick(wild) as any) : undefined };
    case 'setClassic': return { type, by, seat, on: r() < 0.6 };
    case 'newHand': case 'voidHand': case 'undoAward': case 'cancelEnd': case 'forceEnd': case 'reopen': return { type, by: r() < 0.7 ? 's1' : by } as Action;
    case 'bet': return { type, by, seat, amount: amount as number };
    case 'markPaid': { const t = settle(s); const k = t.length ? pick(t) : null; return { type, by, seat: k && r() < 0.7 ? pick([k.from, k.to]) : seat, key: k ? k.key : 'x>y', paid: r() < 0.5 }; }
    case 'thanks': return { type, by, seat, choice: r() < 0.5 ? 'yes' : 'no' };
    default: return { type, by, seat } as Action;
  }
}

function check(s: State, ctx: string) {
  const pot = s.hand ? Object.values(s.hand.contrib).reduce((a, b) => a + b, 0) : 0;
  const bad = (m: string) => { throw new Error(`${m} @ ${ctx}`); };
  if (sumNets(s) + s.pot !== 0) bad(`zero-sum broken: nets ${sumNets(s)} pot ${s.pot}`);
  if (s.pot < 0) bad('negative pot');
  if (s.pot !== pot) bad(`pot ${s.pot} != contributions ${pot}`);
  if (!s.hand && s.pot !== 0) bad('pot without hand');
  for (const p of s.players) if (!Number.isSafeInteger(p.net)) bad('non-integer net');
  if (!Number.isInteger(s.pot)) bad('non-integer pot');
  if (s.hand) {
    if (!Number.isInteger(s.hand.stake) || s.hand.stake < 1) bad('bad stake');
    for (const v of Object.values(s.hand.contrib)) if (!Number.isInteger(v) || v < 0) bad('bad contribution');
    if (s.hand.status === 'betting' && s.hand.boots.length - s.hand.packed.length < 2) bad('betting with <2 live');
  }
  if (s.players.filter((p) => !p.left).length > MAX_PLAYERS) bad('too many players');
  const names = s.players.map((p) => p.name.toLowerCase());
  if (new Set(names).size !== names.length) bad('dup names');
  if (!s.players.some((p) => p.id === s.hostId && !p.left)) bad('host missing');
  for (const p of s.players) if (p.left && p.net === 0) bad('left with zero net should be removed');
  if (s.phase === 'settled') {
    const t = settle(s);
    const bal: Record<string, number> = {};
    for (const x of t) {
      if (!Number.isInteger(x.amount) || x.amount <= 0) bad('bad transfer');
      bal[x.from] = (bal[x.from] ?? 0) - x.amount; bal[x.to] = (bal[x.to] ?? 0) + x.amount;
    }
    for (const p of s.players) if (p.net - (bal[p.id] ?? 0) !== 0) bad('settlement does not zero out');
    if (t.length > Math.max(0, s.players.length - 1)) bad('too many transfers');
  }
}

describe('property: random sequences', () => {
  it('keeps invariants across thousands of random valid+invalid sequences', () => {
    let steps = 0, okCount = 0, errCount = 0, hands = 0, settled = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const r = rng(seed);
      const n = 2 + Math.floor(r() * 11);
      let s = room(n);
      for (let i = 0; i < 400; i++) {
        const a = randomAction(r, s);
        const connected = r() < 0.7 ? undefined : s.players.filter(() => r() < 0.7).map((p) => p.id);
        const res = apply(s, { ...a, actionId: r() < 0.1 ? `id${Math.floor(r() * 20)}` : `a${seed}-${i}` } as any, { now: NOW + i, connected });
        steps++;
        if (res.error) {
          errCount++;
        } else {
          okCount++;
          s = res.state;
          if (!res.duplicate && s.hand === null && s.history.length && s.history[s.history.length-1].at === NOW + i) hands++;
        }
        check(s, `seed ${seed} step ${i} ${JSON.stringify(a)}`);
        if (s.phase === 'settled') settled++;
      }
    }
    expect(steps).toBe(160000);
    expect(okCount).toBeGreaterThan(5000);
    expect(errCount).toBeGreaterThan(5000);
    expect(hands).toBeGreaterThan(50);
    expect(settled).toBeGreaterThan(50);
  });

  it('smart play (mostly valid moves) completes many hands and settles cleanly', () => {
    let completed = 0;
    for (let seed = 1000; seed < 1300; seed++) {
      const r = rng(seed);
      const n = 2 + Math.floor(r() * 11);
      let s = room(n);
      const go = (a: Action, c?: string[]) => { const x = apply(s, a as any, { now: NOW, connected: c }); if (!x.error) s = x.state; check(s, `smart ${seed}`); return !x.error; };
      for (let h = 0; h < 12; h++) {
        go({ type: 'newHand', by: 's1' });
        for (const p of s.players) if (r() < 0.85) go({ type: 'boot', by: p.id, seat: p.id });
        const live = () => s.hand ? s.hand.boots.filter((x) => !s.hand!.packed.includes(x)) : [];
        for (let k = 0; k < 10 && s.hand; k++) {
          const l = live(); if (!l.length) break;
          const who = l[Math.floor(r() * l.length)];
          const roll = r();
          if (roll < 0.6) go({ type: 'bet', by: who, seat: who, amount: [5, 10, 20, 50][Math.floor(r() * 4)] });
          else if (roll < 0.8) go({ type: 'pack', by: who, seat: who });
          else if (roll < 0.9) go({ type: 'undo', by: who, seat: who });
        }
        if (s.hand?.status === 'betting') {
          const l = live();
          go({ type: 'claim', by: l[0], seat: l[0] });
          const other = s.hand?.boots.find((x) => x !== l[0]);
          if (other) go({ type: r() < 0.7 ? 'confirmClaim' : 'rejectClaim', by: other, seat: other });
        }
        if (s.hand) go({ type: 'voidHand', by: 's1' });
        else completed++;
      }
      go({ type: 'forceEnd', by: 's1' });
      expect(s.phase).toBe('settled');
      expect(s.pot).toBe(0);
      check(s, 'final');
    }
    expect(completed).toBeGreaterThan(300);
  });
});
