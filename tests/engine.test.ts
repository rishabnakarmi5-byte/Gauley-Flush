import { describe, it, expect } from 'vitest';
import { apply, allowedBets, createRoom, settle, sumNets, thanksAmount, cleanName, statusOf, type State } from '../src/engine';
import { room, ok, bad, net, startBetting, NOW } from './helpers';

const inv = (s: State) => expect(sumNets(s) + s.pot).toBe(0);

describe('room & players', () => {
  it('creates a room with defaults', () => {
    const s = createRoom('ABCD', '  Ram  ', NOW) as State;
    expect(s.players[0].name).toBe('Ram');
    expect(s.settings).toEqual({ boot: 10, chips: [5, 10, 20, 50, 100], maxBet: 10000 });
    expect(statusOf(s)).toBe('idle');
  });
  it('rejects empty / long names, sanitises markup characters', () => {
    expect('error' in (createRoom('ABCD', '   ', NOW))).toBe(true);
    expect('error' in (createRoom('ABCD', 'x'.repeat(17), NOW))).toBe(true);
    expect(cleanName('<b>Hi</b>')).toBe('bHi/b');
    expect(cleanName('a\u0000b\n c')).toBe('ab c');
    expect(cleanName(5 as any)).toBeNull();
  });
  it('names are unique case-insensitively and capped at 12 players', () => {
    let s = room(2, ['Ram', 'Sita']);
    bad(s, { type: 'join', by: 's3', id: 's3', name: 'ram' }, 'name_taken');
    s = room(12);
    bad(s, { type: 'join', by: 's13', id: 's13', name: 'Extra' }, 'full');
  });
  it('a player cannot add another player; host can', () => {
    const s = room(2);
    bad(s, { type: 'join', by: 's2', id: 's9', name: 'Ghost' }, 'forbidden');
    ok(s, { type: 'join', by: 's1', id: 's9', name: 'Local' });
  });
  it('only host changes settings, validated, locked during hand', () => {
    let s = room(2);
    bad(s, { type: 'settings', by: 's2', boot: 20 }, 'forbidden');
    bad(s, { type: 'settings', by: 's1', boot: 0 });
    bad(s, { type: 'settings', by: 's1', boot: 1.5 });
    bad(s, { type: 'settings', by: 's1', boot: NaN });
    bad(s, { type: 'settings', by: 's1', boot: 20000 });
    bad(s, { type: 'settings', by: 's1', chips: [] });
    bad(s, { type: 'settings', by: 's1', chips: [5, -1] });
    bad(s, { type: 'settings', by: 's1', chips: [20000] });
    s = ok(s, { type: 'settings', by: 's1', boot: 20, chips: [100, 5, 5, 20], maxBet: 500 });
    expect(s.settings).toEqual({ boot: 20, chips: [5, 20, 100], maxBet: 500 });
    s = ok(s, { type: 'newHand', by: 's1' });
    bad(s, { type: 'settings', by: 's1', boot: 10 }, 'wrong_status');
  });
  it('transfers host; remove player rules', () => {
    let s = room(3);
    bad(s, { type: 'transferHost', by: 's2', target: 's3' }, 'forbidden');
    bad(s, { type: 'removePlayer', by: 's2', target: 's3' }, 'forbidden');
    bad(s, { type: 'removePlayer', by: 's1', target: 's1' }, 'forbidden');
    s = ok(s, { type: 'removePlayer', by: 's1', target: 's3' });
    expect(s.players.map((p) => p.id)).toEqual(['s1', 's2']);
    s = ok(s, { type: 'transferHost', by: 's1', target: 's2' });
    expect(s.hostId).toBe('s2');
  });
  it('cannot remove a player in a live hand; nonzero net leaves them listed as left', () => {
    let s = room(3);
    s = startBetting(s, ['s1', 's2']);
    bad(s, { type: 'removePlayer', by: 's1', target: 's2' }, 'in_hand');
    s = ok(s, { type: 'removePlayer', by: 's1', target: 's3' }); // never booted, net 0
    s = ok(s, { type: 'voidHand', by: 's1' });
    s = startBetting(s, ['s1', 's2']);
    s = ok(s, { type: 'pack', by: 's2', seat: 's2' }); // s1 wins
    s = ok(s, { type: 'removePlayer', by: 's1', target: 's2' }); // not in a live hand now, net -20
    const p = s.players.find((x) => x.id === 's2')!;
    expect(p.left).toBe(true);
    expect(settle(s).some((t) => t.from === 's2')).toBe(true);
    bad(s, { type: 'join', by: 's7', id: 's7', name: 'P2' }, 'name_taken');
  });
  it('self leave when net is zero', () => {
    let s = room(3);
    s = ok(s, { type: 'removePlayer', by: 's3', target: 's3' });
    expect(s.players.length).toBe(2);
  });
});

describe('hand lifecycle', () => {
  it('needs 2 players, host only (or anyone if host disconnected)', () => {
    let s = room(2);
    bad(s, { type: 'newHand', by: 's2' }, 'forbidden');
    ok(s, { type: 'newHand', by: 's2' }, { now: NOW, connected: ['s2'] });
    bad(room(1), { type: 'newHand', by: 's1' }, 'not_enough');
    s = ok(s, { type: 'newHand', by: 's1' });
    bad(s, { type: 'newHand', by: 's1' }, 'wrong_status');
    expect(s.hand!.status).toBe('boot');
    expect(s.hand!.stake).toBe(10);
  });
  it('boot charges boot amount into pot; double boot rejected; zero-sum', () => {
    let s = room(3);
    s = ok(s, { type: 'newHand', by: 's1' });
    s = ok(s, { type: 'boot', by: 's1', seat: 's1' });
    expect(s.pot).toBe(10);
    expect(net(s, 's1')).toBe(-10);
    bad(s, { type: 'boot', by: 's1', seat: 's1' }, 'duplicate');
    bad(s, { type: 'boot', by: 's2', seat: 's1' }, 'forbidden');
    inv(s);
  });
  it('first chaal needs >=2 booted and a booted bettor; then boot closes', () => {
    let s = room(3);
    s = ok(s, { type: 'newHand', by: 's1' });
    s = ok(s, { type: 'boot', by: 's1', seat: 's1' });
    bad(s, { type: 'bet', by: 's1', seat: 's1', amount: 10 }, 'wrong_status');
    s = ok(s, { type: 'boot', by: 's2', seat: 's2' });
    bad(s, { type: 'bet', by: 's3', seat: 's3', amount: 10 }, 'not_in_hand');
    s = ok(s, { type: 'bet', by: 's2', seat: 's2', amount: 10 });
    expect(s.hand!.status).toBe('betting');
    bad(s, { type: 'boot', by: 's3', seat: 's3' }, 'wrong_status');
    inv(s);
  });
  it('sitOut only in boot stage and before booting', () => {
    let s = room(3);
    bad(s, { type: 'sitOut', by: 's3', seat: 's3' }, 'wrong_status');
    s = ok(s, { type: 'newHand', by: 's1' });
    s = ok(s, { type: 'sitOut', by: 's3', seat: 's3' });
    s = ok(s, { type: 'boot', by: 's3', seat: 's3' });
    expect(s.hand!.sitOut).toEqual([]);
    bad(s, { type: 'sitOut', by: 's3', seat: 's3' }, 'wrong_status');
  });
  it('cancel in boot stage refunds boots', () => {
    let s = room(3);
    s = ok(s, { type: 'newHand', by: 's1' });
    s = ok(s, { type: 'boot', by: 's1', seat: 's1' });
    s = ok(s, { type: 'boot', by: 's2', seat: 's2' });
    bad(s, { type: 'voidHand', by: 's2' }, 'forbidden');
    s = ok(s, { type: 'voidHand', by: 's1' });
    expect(s.pot).toBe(0);
    expect(s.players.every((p) => p.net === 0)).toBe(true);
    expect(statusOf(s)).toBe('idle');
    expect(s.history[0].result).toBe('void');
  });
  it('bets validate integers and bounds', () => {
    let s = room(2);
    s = ok(s, { type: 'newHand', by: 's1' });
    s = ok(s, { type: 'boot', by: 's1', seat: 's1' });
    s = ok(s, { type: 'boot', by: 's2', seat: 's2' });
    for (const amount of [0, -5, 1.5, NaN, Infinity, 10001, '10' as any, null as any]) {
      bad(s, { type: 'bet', by: 's1', seat: 's1', amount });
    }
    s = ok(s, { type: 'bet', by: 's1', seat: 's1', amount: 1 });
    s = ok(s, { type: 'bet', by: 's1', seat: 's1', amount: 10000 });
    expect(s.pot).toBe(20 + 1 + 10000);
    inv(s);
  });
  it('free-form: no turn order', () => {
    let s = room(3);
    s = startBetting(s, ['s1', 's2', 's3']);
    s = ok(s, { type: 'bet', by: 's1', seat: 's1', amount: 7 });
    s = ok(s, { type: 'bet', by: 's1', seat: 's1', amount: 33 });
    inv(s);
  });
  it('wrong-status actions are rejected', () => {
    const s = room(2);
    bad(s, { type: 'bet', by: 's1', seat: 's1', amount: 10 }, 'wrong_status');
    bad(s, { type: 'boot', by: 's1', seat: 's1' }, 'wrong_status');
    bad(s, { type: 'pack', by: 's1', seat: 's1' }, 'wrong_status');
    bad(s, { type: 'claim', by: 's1', seat: 's1' }, 'wrong_status');
    bad(s, { type: 'confirmClaim', by: 's2', seat: 's2' }, 'wrong_status');
    bad(s, { type: 'undo', by: 's1', seat: 's1' }, 'wrong_status');
    bad(s, { type: 'voidHand', by: 's1' }, 'wrong_status');
    bad(s, { type: 'undoAward', by: 's1' }, 'wrong_status');
    bad(s, { type: 'agreeEnd', by: 's1', seat: 's1' }, 'wrong_status');
    bad(s, { type: 'bet', by: 'nobody', seat: 'nobody', amount: 10 }, 'not_seated');
    bad(s, { type: 'nope', by: 's1' } as any, 'bad_action');
  });
});

describe('classic limits', () => {
  function classicRoom() {
    let s = room(3);
    s = ok(s, { type: 'setClassic', by: 's1', seat: 's1', on: true });
    s = ok(s, { type: 'setClassic', by: 's2', seat: 's2', on: true });
    s = ok(s, { type: 'newHand', by: 's1' });
    for (const id of ['s1', 's2', 's3']) s = ok(s, { type: 'boot', by: id, seat: id });
    return s;
  }
  it('only the player toggles own limits; not mid-hand', () => {
    let s = room(2);
    bad(s, { type: 'setClassic', by: 's1', seat: 's2', on: true }, 'forbidden');
    s = startBetting(s, ['s1', 's2']);
    bad(s, { type: 'setClassic', by: 's1', seat: 's1', on: true }, 'in_hand');
  });
  it('blind may bet stake or 2x stake only', () => {
    let s = classicRoom();
    expect(allowedBets(s, 's1')).toEqual([10, 20]);
    bad(s, { type: 'bet', by: 's1', seat: 's1', amount: 15 }, 'limit');
    bad(s, { type: 'bet', by: 's1', seat: 's1', amount: 40 }, 'limit');
    s = ok(s, { type: 'bet', by: 's1', seat: 's1', amount: 20 });
    expect(s.hand!.stake).toBe(20); // blind bet X => stake X
  });
  it('seen may bet 2x or 4x stake; seen bet X sets stake X/2', () => {
    let s = classicRoom();
    s = ok(s, { type: 'seeCards', by: 's2', seat: 's2' });
    expect(allowedBets(s, 's2')).toEqual([20, 40]);
    bad(s, { type: 'bet', by: 's2', seat: 's2', amount: 10 }, 'limit');
    s = ok(s, { type: 'bet', by: 's2', seat: 's2', amount: 40 });
    expect(s.hand!.stake).toBe(20);
    // blind classic s1 now: 20 or 40
    expect(allowedBets(s, 's1')).toEqual([20, 40]);
    // free-form s3 unconstrained and sets stake to X
    s = ok(s, { type: 'bet', by: 's3', seat: 's3', amount: 7 });
    expect(s.hand!.stake).toBe(7);
    inv(s);
  });
  it('seeCards is irreversible, needs classic, once only', () => {
    let s = classicRoom();
    bad(s, { type: 'seeCards', by: 's3', seat: 's3' }, 'wrong_status');
    s = ok(s, { type: 'seeCards', by: 's1', seat: 's1' });
    bad(s, { type: 'seeCards', by: 's1', seat: 's1' }, 'duplicate');
  });
  it('clamps to maxBet', () => {
    let s = room(2);
    s = ok(s, { type: 'settings', by: 's1', maxBet: 30, chips: [5, 10] });
    s = ok(s, { type: 'setClassic', by: 's1', seat: 's1', on: true });
    s = ok(s, { type: 'newHand', by: 's1' });
    s = ok(s, { type: 'boot', by: 's1', seat: 's1' });
    s = ok(s, { type: 'boot', by: 's2', seat: 's2' });
    s = ok(s, { type: 'seeCards', by: 's1', seat: 's1' });
    expect(allowedBets(s, 's1')).toEqual([20, 30]);
    s = ok(s, { type: 'bet', by: 's1', seat: 's1', amount: 30 });
    expect(s.hand!.stake).toBe(15);
  });
  it('undo restores previous stake', () => {
    let s = classicRoom();
    s = ok(s, { type: 'bet', by: 's1', seat: 's1', amount: 20 });
    expect(s.hand!.stake).toBe(20);
    s = ok(s, { type: 'undo', by: 's1', seat: 's1' });
    expect(s.hand!.stake).toBe(10);
  });
});

describe('pack, undo, claim', () => {
  it('pack forfeits; last un-packed player auto-wins', () => {
    let s = room(3);
    s = startBetting(s, ['s1', 's2', 's3']); // pot 40
    s = ok(s, { type: 'pack', by: 's2', seat: 's2' });
    expect(statusOf(s)).toBe('betting');
    bad(s, { type: 'bet', by: 's2', seat: 's2', amount: 10 }, 'packed');
    bad(s, { type: 'pack', by: 's2', seat: 's2' }, 'duplicate');
    s = ok(s, { type: 'pack', by: 's3', seat: 's3' });
    expect(statusOf(s)).toBe('idle');
    expect(net(s, 's1')).toBe(20);
    expect(net(s, 's2')).toBe(-10);
    expect(net(s, 's3')).toBe(-10);
    expect(s.pot).toBe(0);
    expect(s.history[0]).toMatchObject({ winner: 's1', pot: 40, how: 'last' });
    inv(s);
  });
  it('cannot pack in boot stage', () => {
    let s = room(2);
    s = ok(s, { type: 'newHand', by: 's1' });
    s = ok(s, { type: 'boot', by: 's1', seat: 's1' });
    s = ok(s, { type: 'boot', by: 's2', seat: 's2' });
    bad(s, { type: 'pack', by: 's2', seat: 's2' }, 'wrong_status');
  });
  it('host packs a disconnected player only', () => {
    let s = startBetting(room(3), ['s1', 's2', 's3']);
    bad(s, { type: 'packFor', by: 's1', seat: 's2' }, 'forbidden'); // connected
    bad(s, { type: 'packFor', by: 's2', seat: 's3' }, 'forbidden', { now: NOW, connected: ['s1', 's2'] });
    s = ok(s, { type: 'packFor', by: 's1', seat: 's3' }, { now: NOW, connected: ['s1', 's2'] });
    expect(s.hand!.packed).toEqual(['s3']);
  });
  it('undo only own latest bet/pack while betting', () => {
    let s = room(3);
    s = startBetting(s, ['s1', 's2', 's3']);
    bad(s, { type: 'undo', by: 's2', seat: 's2' }, 'not_latest');
    s = ok(s, { type: 'bet', by: 's2', seat: 's2', amount: 50 });
    bad(s, { type: 'undo', by: 's1', seat: 's1' }, 'not_latest');
    bad(s, { type: 'undo', by: 's1', seat: 's2' }, 'forbidden');
    const pot = s.pot;
    s = ok(s, { type: 'undo', by: 's2', seat: 's2' });
    expect(s.pot).toBe(pot - 50);
    s = ok(s, { type: 'pack', by: 's3', seat: 's3' });
    s = ok(s, { type: 'undo', by: 's3', seat: 's3' });
    expect(s.hand!.packed).toEqual([]);
    inv(s);
  });
  it('undo of first bet keeps betting open and boots can not be undone', () => {
    let s = room(2);
    s = startBetting(s, ['s1', 's2']);
    s = ok(s, { type: 'undo', by: 's1', seat: 's1' });
    expect(statusOf(s)).toBe('betting');
    bad(s, { type: 'undo', by: 's1', seat: 's1' }, 'not_latest');
  });
  it('claim → confirm by another participant pays pot', () => {
    let s = room(3);
    s = startBetting(s, ['s1', 's2']); // s3 did not boot
    s = ok(s, { type: 'claim', by: 's1', seat: 's1' });
    expect(statusOf(s)).toBe('claimed');
    bad(s, { type: 'bet', by: 's2', seat: 's2', amount: 10 }, 'wrong_status');
    bad(s, { type: 'undo', by: 's1', seat: 's1' }, 'wrong_status');
    bad(s, { type: 'confirmClaim', by: 's1', seat: 's1' }, 'self_confirm');
    bad(s, { type: 'confirmClaim', by: 's3', seat: 's3' }, 'not_in_hand');
    s = ok(s, { type: 'confirmClaim', by: 's2', seat: 's2' });
    expect(net(s, 's1')).toBe(10);
    expect(net(s, 's2')).toBe(-10);
    expect(statusOf(s)).toBe('idle');
    inv(s);
  });
  it('packed participants can confirm / reject; packed cannot claim', () => {
    let s = room(3);
    s = startBetting(s, ['s1', 's2', 's3']);
    s = ok(s, { type: 'pack', by: 's3', seat: 's3' });
    bad(s, { type: 'claim', by: 's3', seat: 's3' }, 'not_in_hand');
    s = ok(s, { type: 'claim', by: 's1', seat: 's1' });
    s = ok(s, { type: 'rejectClaim', by: 's3', seat: 's3' });
    expect(statusOf(s)).toBe('betting');
    s = ok(s, { type: 'claim', by: 's2', seat: 's2' });
    s = ok(s, { type: 'confirmClaim', by: 's3', seat: 's3' });
    expect(net(s, 's2')).toBe(40 - 10);
    inv(s);
  });
  it('claimant can withdraw; others cannot', () => {
    let s = startBetting(room(2), ['s1', 's2']);
    s = ok(s, { type: 'claim', by: 's1', seat: 's1' });
    bad(s, { type: 'withdrawClaim', by: 's2', seat: 's2' }, 'forbidden');
    s = ok(s, { type: 'withdrawClaim', by: 's1', seat: 's1' });
    expect(statusOf(s)).toBe('betting');
    bad(s, { type: 'withdrawClaim', by: 's1', seat: 's1' }, 'wrong_status');
  });
  it('host voids a live hand: everything refunded', () => {
    let s = startBetting(room(3), ['s1', 's2', 's3'], 100);
    s = ok(s, { type: 'voidHand', by: 's1' });
    expect(s.players.every((p) => p.net === 0)).toBe(true);
    expect(s.pot).toBe(0);
  });
  it('undoAward restores the hand until next hand starts', () => {
    let s = startBetting(room(2), ['s1', 's2'], 50);
    s = ok(s, { type: 'claim', by: 's2', seat: 's2' });
    s = ok(s, { type: 'confirmClaim', by: 's1', seat: 's1' });
    expect(net(s, 's2')).toBe(70 - 10);
    bad(s, { type: 'undoAward', by: 's2' }, 'forbidden');
    s = ok(s, { type: 'undoAward', by: 's1' });
    expect(statusOf(s)).toBe('betting');
    expect(s.pot).toBe(70);
    expect(s.history.length).toBe(0);
    inv(s);
    s = ok(s, { type: 'claim', by: 's1', seat: 's1' });
    s = ok(s, { type: 'confirmClaim', by: 's2', seat: 's2' });
    s = ok(s, { type: 'newHand', by: 's1' });
    bad(s, { type: 'undoAward', by: 's1' }, 'wrong_status');
  });
  it('undoAward after auto-win un-packs the last pack', () => {
    let s = startBetting(room(2), ['s1', 's2']);
    s = ok(s, { type: 'pack', by: 's2', seat: 's2' });
    expect(statusOf(s)).toBe('idle');
    s = ok(s, { type: 'undoAward', by: 's1' });
    expect(s.hand!.packed).toEqual([]);
    expect(statusOf(s)).toBe('betting');
    inv(s);
  });
});

describe('dedup', () => {
  it('same actionId is applied once', () => {
    let s = room(2);
    s = ok(s, { type: 'newHand', by: 's1' });
    s = ok(s, { type: 'boot', by: 's1', seat: 's1' });
    const a = { type: 'boot', by: 's2', seat: 's2', actionId: 'dup-1' } as const;
    const r1 = apply(s, a, { now: NOW });
    expect(r1.error).toBeUndefined();
    const r2 = apply(r1.state!, a, { now: NOW });
    expect(r2.duplicate).toBe(true);
    expect(r2.state).toBe(r1.state);
    const b = { type: 'bet', by: 's1', seat: 's1', amount: 10, actionId: 'dup-2' } as const;
    const r3 = apply(r1.state!, b, { now: NOW });
    const r4 = apply(r3.state!, b, { now: NOW });
    expect(r4.state!.pot).toBe(r3.state!.pot);
    expect(r4.state!.version).toBe(r3.state!.version);
  });
  it('failed actions are not remembered, version bumps on success only', () => {
    const s = room(2);
    const r = apply(s, { type: 'bet', by: 's1', seat: 's1', amount: 5, actionId: 'x' }, { now: NOW });
    expect(r.error).toBeDefined();
    expect(s.recentIds).toEqual([]);
    const r2 = apply(s, { type: 'newHand', by: 's1', actionId: 'y' }, { now: NOW });
    expect(r2.state!.version).toBe(s.version + 1);
  });
});

describe('end game & settlement', () => {
  it('needs idle; takes effect when all connected agree', () => {
    let s = room(3);
    s = startBetting(s, ['s1', 's2']);
    bad(s, { type: 'proposeEnd', by: 's1', seat: 's1' }, 'wrong_status');
    s = ok(s, { type: 'claim', by: 's1', seat: 's1' });
    s = ok(s, { type: 'confirmClaim', by: 's2', seat: 's2' });
    s = ok(s, { type: 'proposeEnd', by: 's1', seat: 's1' });
    bad(s, { type: 'newHand', by: 's1' }, 'wrong_status');
    s = ok(s, { type: 'agreeEnd', by: 's2', seat: 's2' });
    expect(s.phase).toBe('open');
    s = ok(s, { type: 'agreeEnd', by: 's3', seat: 's3' });
    expect(s.phase).toBe('settled');
    bad(s, { type: 'newHand', by: 's1' }, 'settled');
    bad(s, { type: 'join', by: 's4', id: 's4', name: 'Late' }, 'settled');
  });
  it('disconnected players do not block; sync re-evaluates', () => {
    let s = room(3);
    s = ok(s, { type: 'proposeEnd', by: 's1', seat: 's1' }, { now: NOW, connected: ['s1', 's2', 's3'] });
    s = ok(s, { type: 'agreeEnd', by: 's2', seat: 's2' });
    expect(s.phase).toBe('open');
    const r = apply(s, { type: 'sync', by: 'system' }, { now: NOW, connected: ['s1', 's2'] });
    expect(r.state!.phase).toBe('settled');
  });
  it('clients cannot fake sync; any player can cancel; host can force', () => {
    let s = room(3);
    bad(s, { type: 'sync', by: 's1' } as any);
    s = ok(s, { type: 'proposeEnd', by: 's2', seat: 's2' });
    s = ok(s, { type: 'cancelEnd', by: 's3' });
    expect(s.endVote).toBeNull();
    bad(s, { type: 'forceEnd', by: 's2' }, 'forbidden');
    s = ok(s, { type: 'forceEnd', by: 's1' });
    expect(s.phase).toBe('settled');
  });
  it('reopen continues play and clears paid/thanks', () => {
    let s = room(2);
    s = ok(s, { type: 'forceEnd', by: 's1' });
    bad(s, { type: 'reopen', by: 's2' }, 'forbidden');
    s = ok(s, { type: 'reopen', by: 's1' });
    s = ok(s, { type: 'newHand', by: 's1' });
    expect(statusOf(s)).toBe('boot');
  });
  it('minimal greedy settlement is deterministic and zeroes everyone', () => {
    let s = room(4);
    s.players[0].net = 100; s.players[1].net = 100; s.players[2].net = -150; s.players[3].net = -50;
    const t = settle(s);
    expect(t).toEqual([
      { from: 's3', to: 's1', amount: 100, key: 's3>s1' },
      { from: 's3', to: 's2', amount: 50, key: 's3>s2' },
      { from: 's4', to: 's2', amount: 50, key: 's4>s2' },
    ]);
    const bal: Record<string, number> = {};
    for (const x of t) { bal[x.from] = (bal[x.from] ?? 0) - x.amount; bal[x.to] = (bal[x.to] ?? 0) + x.amount; }
    for (const p of s.players) expect(p.net - (bal[p.id] ?? 0)).toBe(0);
  });
  it('markPaid: payer or payee only, settled only, synced', () => {
    let s = room(3);
    s = startBetting(s, ['s1', 's2'], 30);
    s = ok(s, { type: 'pack', by: 's2', seat: 's2' });
    s = ok(s, { type: 'forceEnd', by: 's1' });
    const t = settle(s)[0];
    expect(t).toMatchObject({ from: 's2', to: 's1', amount: 10 });
    bad(s, { type: 'markPaid', by: 's3', seat: 's3', key: t.key, paid: true }, 'forbidden');
    bad(s, { type: 'markPaid', by: 's1', seat: 's1', key: 'zz>zz', paid: true }, 'bad_target');
    s = ok(s, { type: 'markPaid', by: 's1', seat: 's1', key: t.key, paid: true });
    expect(s.paid[t.key]).toBe(true);
    s = ok(s, { type: 'markPaid', by: 's2', seat: 's2', key: t.key, paid: false });
    expect(s.paid[t.key]).toBeUndefined();
    bad(room(2), { type: 'markPaid', by: 's1', seat: 's1', key: 'a', paid: true }, 'wrong_status');
  });
  it('thanks: only net>0, only settled, recorded; amount rule', () => {
    let s = room(3);
    s = startBetting(s, ['s1', 's2'], 30);
    s = ok(s, { type: 'pack', by: 's2', seat: 's2' }); // s1 +40, s2 -40
    bad(s, { type: 'thanks', by: 's1', seat: 's1', choice: 'yes' }, 'wrong_status');
    s = ok(s, { type: 'forceEnd', by: 's1' });
    bad(s, { type: 'thanks', by: 's2', seat: 's2', choice: 'yes' }, 'forbidden');
    bad(s, { type: 'thanks', by: 's3', seat: 's3', choice: 'yes' }, 'forbidden');
    bad(s, { type: 'thanks', by: 's1', seat: 's1', choice: 'maybe' as any }, 'bad_value');
    s = ok(s, { type: 'thanks', by: 's1', seat: 's1', choice: 'yes' });
    expect(s.thanks).toEqual({ s1: 'yes' });
    expect(thanksAmount(0)).toBe(0);
    expect(thanksAmount(-5)).toBe(0);
    expect(thanksAmount(3)).toBe(1);
    expect(thanksAmount(10)).toBe(1);
    expect(thanksAmount(100)).toBe(5);
    expect(thanksAmount(130)).toBe(7);
  });
});
