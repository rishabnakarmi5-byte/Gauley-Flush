// Pure banknote-pile maths. No DOM, no randomness beyond a seeded PRNG, so every phone draws the identical pile.

/** Face values, largest first. 2 and 1 are drawn as coins. */
export const DENOMS = [1000, 500, 100, 50, 20, 10, 5, 2, 1] as const;
export const NOTE_VALUES = [1000, 500, 100, 50, 20, 10, 5] as const;
export const PILE_CAP = 40;

export interface Contribution {
  /** stable id of the contribution (the hand-log entry number) */
  n: number;
  amount: number;
  by?: string;
}

export interface Piece {
  key: string;
  /** face value of one piece (1000, 500 ... 5 are notes, 2 and 1 are coins) */
  value: number;
  /** how many identical pieces this one stands for (1, except for a compressed wad of huge pots) */
  qty: number;
  /** contribution number this piece came from, or -1 for a re-bundled piece */
  src: number;
  by?: string;
  /** resting pose in the pile, unit square: x,y in [-1,1], rot in degrees */
  x: number;
  y: number;
  rot: number;
}

/** Greedy split into 1000, 500, 100, 50, 20, 10, 5, 2, 1. Always sums exactly to `amount`. */
export function splitGreedy(amount: number): number[] {
  let left = Math.max(0, Math.floor(amount));
  const out: number[] = [];
  for (const d of DENOMS) {
    while (left >= d) { out.push(d); left -= d; }
    if (!left) break;
  }
  return out;
}

function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash3(a: number, b: number, c: number) {
  let h = 2166136261 >>> 0;
  for (const v of [a, b, c]) { h ^= (v | 0) + 0x9e3779b9; h = Math.imul(h, 16777619) >>> 0; h ^= h >>> 13; }
  return h >>> 0;
}

/** Deterministic pose from (hand number, contribution index, note index). */
export function poseOf(hand: number, src: number, idx: number): { x: number; y: number; rot: number } {
  const r = mulberry32(hash3(hand, src + 7, idx + 3));
  const ang = r() * Math.PI * 2;
  const rad = Math.pow(r(), 0.85);
  return { x: Math.cos(ang) * rad, y: Math.sin(ang) * rad, rot: (r() - 0.5) * 80 };
}

function piecesFor(hand: number, src: number, amount: number, by?: string): Piece[] {
  return splitGreedy(amount).map((value, i) => ({
    key: `${hand}.${src}.${i}`, value, qty: 1, src, by, ...poseOf(hand, src, i),
  }));
}

/**
 * Build the pile for a hand. Each contribution is split greedily. If that exceeds `cap` pieces, the OLDEST contributions
 * are merged into one bundle and re-split into higher denominations (as little merging as will fit). If even a full merge
 * has too many pieces (a pot above ~40,000), identical notes collapse into a single wad with a quantity.
 * The face values of the returned pieces (value * qty) always add up exactly to the sum of the contributions.
 */
export function buildPile(hand: number, contribs: Contribution[], cap = PILE_CAP): Piece[] {
  const list = contribs.filter((c) => c.amount > 0);
  const single = list.flatMap((c) => piecesFor(hand, c.n, c.amount, c.by));
  if (single.length <= cap) return single;
  const bundle = (k: number): Piece[] => {
    const total = list.slice(0, k).reduce((s, c) => s + c.amount, 0);
    return piecesFor(hand, -1, total);
  };
  for (let k = 2; k <= list.length; k++) {
    const p = [...bundle(k), ...list.slice(k).flatMap((c) => piecesFor(hand, c.n, c.amount, c.by))];
    if (p.length <= cap) return p;
  }
  // everything merged and still above the cap: collapse equal denominations into wads
  const total = list.reduce((s, c) => s + c.amount, 0);
  const counts = new Map<number, number>();
  for (const v of splitGreedy(total)) counts.set(v, (counts.get(v) ?? 0) + 1);
  let i = 0;
  return [...counts].map(([value, qty]) => ({ key: `${hand}.-2.${i}`, value, qty, src: -1, ...poseOf(hand, -2, i++) }));
}

export const pieceTotal = (p: Piece[]) => p.reduce((s, x) => s + x.value * x.qty, 0);

/** A compact fan for the pending bet (no pile semantics): at most `cap` pieces, sums exactly. */
export function buildFan(amount: number, cap = 7): Piece[] {
  return buildPile(0, [{ n: 1, amount }], cap);
}
