import { describe, expect, it } from 'vitest';
import { buildFan, buildPile, DENOMS, PILE_CAP, pieceTotal, poseOf, splitGreedy, type Contribution } from '../src/client/notes';

const sum = (c: Contribution[]) => c.reduce((s, x) => s + x.amount, 0);

describe('splitGreedy', () => {
  it('uses the largest denominations first', () => {
    expect(splitGreedy(1385)).toEqual([1000, 100, 100, 100, 50, 20, 10, 5]);
    expect(splitGreedy(8)).toEqual([5, 2, 1]);
    expect(splitGreedy(0)).toEqual([]);
  });
  it('always sums exactly', () => {
    for (let n = 0; n < 5000; n += 7) expect(splitGreedy(n).reduce((a, b) => a + b, 0)).toBe(n);
    expect(splitGreedy(1)).toEqual([1]);
    expect(DENOMS[0]).toBe(1000);
  });
});

describe('buildPile', () => {
  const small: Contribution[] = [
    { n: 1, amount: 10, by: 's1' }, { n: 2, amount: 10, by: 's2' }, { n: 3, amount: 10, by: 's3' },
    { n: 4, amount: 70, by: 's2' }, { n: 5, amount: 140, by: 's3' }, { n: 6, amount: 25, by: 's1' },
  ];
  it('pile face values equal the pot exactly', () => {
    expect(pieceTotal(buildPile(3, small))).toBe(sum(small));
  });
  it('is deterministic: same inputs give identical pieces and poses', () => {
    expect(buildPile(3, small)).toEqual(buildPile(3, small));
    expect(poseOf(3, 4, 1)).toEqual(poseOf(3, 4, 1));
    expect(poseOf(3, 4, 1)).not.toEqual(poseOf(4, 4, 1));
  });
  it('undo removes exactly that bet\'s notes and leaves every other note untouched', () => {
    const before = buildPile(3, small);
    const after = buildPile(3, small.slice(0, -1));
    const removed = before.filter((p) => !after.some((q) => q.key === p.key));
    expect(removed.length).toBeGreaterThan(0);
    expect(removed.every((p) => p.src === 6)).toBe(true);
    expect(pieceTotal(removed)).toBe(25);
    for (const q of after) expect(before.find((p) => p.key === q.key)).toEqual(q);
  });
  it('re-bundles the oldest contributions to stay under the cap and still sums exactly', () => {
    const many: Contribution[] = [];
    for (let i = 1; i <= 60; i++) many.push({ n: i, amount: 7 + (i % 5) * 13, by: `s${i % 3}` });
    const p = buildPile(2, many);
    expect(p.length).toBeLessThanOrEqual(PILE_CAP);
    expect(pieceTotal(p)).toBe(sum(many));
    // the newest contribution still has its own notes; the oldest were merged
    expect(p.some((x) => x.src === 60)).toBe(true);
    expect(p.some((x) => x.src === 1)).toBe(false);
    expect(p.some((x) => x.src === -1)).toBe(true);
  });
  it('huge pots collapse equal notes into wads but never lose a rupee', () => {
    const big: Contribution[] = [{ n: 1, amount: 987_654 }, { n: 2, amount: 123_457 }];
    const p = buildPile(1, big);
    expect(p.length).toBeLessThanOrEqual(PILE_CAP);
    expect(pieceTotal(p)).toBe(sum(big));
  });
  it('sum is exact for random hands and caps', () => {
    let seed = 12345;
    const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let t = 0; t < 300; t++) {
      const n = 1 + Math.floor(rnd() * 80);
      const cs: Contribution[] = Array.from({ length: n }, (_, i) => ({ n: i + 1, amount: 1 + Math.floor(rnd() * (rnd() < 0.1 ? 20000 : 300)) }));
      const p = buildPile(1 + (t % 9), cs);
      expect(pieceTotal(p)).toBe(sum(cs));
      expect(p.length).toBeLessThanOrEqual(PILE_CAP);
    }
  });
  it('ignores zero-amount entries (packs)', () => {
    expect(buildPile(1, [{ n: 1, amount: 0 }, { n: 2, amount: 20 }]).map((p) => p.src)).toEqual([2]);
  });
});

describe('buildFan', () => {
  it('stays small and sums exactly', () => {
    for (const n of [1, 5, 70, 385, 1385, 12_345]) {
      const f = buildFan(n);
      expect(f.length).toBeLessThanOrEqual(7);
      expect(pieceTotal(f)).toBe(n);
    }
  });
});
