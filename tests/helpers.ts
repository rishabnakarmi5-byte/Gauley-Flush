import { apply, createRoom, type Action, type Ctx, type State } from '../src/engine';

export const NOW = 1_700_000_000_000;
let counter = 0;
export function room(n: number, names?: string[]): State {
  let s = createRoom('ABCD', names?.[0] ?? 'P1', NOW) as State;
  for (let i = 2; i <= n; i++) {
    const r = apply(s, { type: 'join', by: `s${i}`, id: `s${i}`, name: names?.[i - 1] ?? `P${i}` }, { now: NOW });
    if (!r.ok) throw new Error(r.error);
    s = r.state;
  }
  return s;
}
export function ok(s: State, a: Action, ctx: Ctx = { now: NOW }): State {
  const r = apply(s, { ...a, actionId: `t${++counter}` } as any, ctx);
  if (!r.ok) throw new Error(`expected ok, got ${r.code}: ${r.error} for ${JSON.stringify(a)}`);
  return r.state;
}
export function bad(s: State, a: Action, code?: string, ctx: Ctx = { now: NOW }) {
  const r = apply(s, a as any, ctx);
  if (r.ok) throw new Error(`expected error for ${JSON.stringify(a)}`);
  if (code && r.code !== code) throw new Error(`expected code ${code} got ${r.code} (${r.error})`);
  return r;
}
export const net = (s: State, id: string) => s.players.find((p) => p.id === id)!.net;
/** new hand + everyone boots + first bet by s1 */
export function startBetting(s: State, ids: string[], amount = 10): State {
  s = ok(s, { type: 'newHand', by: 's1' });
  for (const id of ids) s = ok(s, { type: 'boot', by: id, seat: id });
  s = ok(s, { type: 'bet', by: ids[0], seat: ids[0], amount });
  return s;
}
