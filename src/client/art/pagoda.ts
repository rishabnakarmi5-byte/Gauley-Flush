// Nyatapola-style five-tier temple on a stepped plinth.
import { type Drawing, p, c, flat, fit } from './kit';
import { f } from './geom';

const CX = 200;
const W0 = 132, SHRINK = 0.84, SP = 54;
const roofY = (k: number) => 308 - k * SP;
const roofW = (k: number) => W0 * Math.pow(SHRINK, k);

const plinth = (() => {
  const steps = [176, 160, 144, 128, 112];
  const d: string[] = [];
  let y = 376;
  steps.forEach((hw, i) => { d.push(`M${CX - hw} ${y}H${CX + hw}`); const ny = y - 9; d.push(`M${CX - hw} ${y}V${ny}M${CX + hw} ${y}V${ny}`); y = ny; });
  d.push(`M${CX - 112} ${y}H${CX + 112}`);
  // central stair edges
  d.push(`M${CX - 20} 376V${y}M${CX + 20} 376V${y}`);
  return p(d.join(''));
})();
const baseTop = 376 - 5 * 9; // 331

const tiers = Array.from({ length: 5 }, (_, k) => {
  const ye = roofY(k), W = roofW(k);
  const els: string[] = [];
  // eave (curved, tips upturned)
  els.push(`M${f(CX - W)} ${f(ye - 9)}Q${f(CX - W + 12)} ${f(ye + 4)} ${f(CX - W + 34)} ${f(ye + 3)}H${f(CX + W - 34)}Q${f(CX + W - 12)} ${f(ye + 4)} ${f(CX + W)} ${f(ye - 9)}`);
  // second eave line (tile edge)
  els.push(`M${f(CX - W + 8)} ${f(ye - 6)}Q${f(CX - W + 18)} ${f(ye - 1)} ${f(CX - W + 38)} ${f(ye - 2)}H${f(CX + W - 38)}Q${f(CX + W - 18)} ${f(ye - 1)} ${f(CX + W - 8)} ${f(ye - 6)}`);
  // roof slope up to ridge
  const rw = W * 0.58, ry = ye - 36;
  els.push(`M${f(CX - W)} ${f(ye - 9)}C${f(CX - W * 0.84)} ${f(ye - 18)} ${f(CX - W * 0.7)} ${f(ye - 30)} ${f(CX - rw)} ${f(ry)}H${f(CX + rw)}C${f(CX + W * 0.7)} ${f(ye - 30)} ${f(CX + W * 0.84)} ${f(ye - 18)} ${f(CX + W)} ${f(ye - 9)}`);
  // tile lines
  for (const t of [0.34, 0.62]) {
    const yy = ye - 9 - (ye - 9 - ry) * t, wx = W - (W - rw) * Math.pow(t, 0.9) - W * 0.03 * t;
    els.push(`M${f(CX - wx)} ${f(yy)}H${f(CX + wx)}`);
  }
  // fringe ticks under the eave
  let t = '';
  for (let x = -W + 40; x <= W - 40; x += 8) t += `M${f(CX + x)} ${f(ye + 3)}v4`;
  els.push(t);
  return p(els.join(''));
});
// walls between roofs + struts
const walls = Array.from({ length: 5 }, (_, k) => {
  const ye = roofY(k), W = roofW(k);
  const rw = W * 0.58, ry = ye - 36;
  const topY = k < 4 ? roofY(k + 1) + 3 : ry - 14;
  const wallHW = k < 4 ? roofW(k + 1) * 0.62 : rw * 0.6;
  const els: string[] = [];
  els.push(`M${f(CX - wallHW)} ${f(ry)}V${f(topY)}M${f(CX + wallHW)} ${f(ry)}V${f(topY)}`);
  if (k < 4) {
    const Wn = roofW(k + 1);
    // struts: from wall base outwards-up to the eave above
    for (const [a, b] of [[0.9, 0.95], [0.62, 0.7], [0.34, 0.42]] as const) {
      for (const s of [-1, 1]) els.push(`M${f(CX + s * wallHW * a)} ${f(ry + 1)}L${f(CX + s * Wn * b)} ${f(roofY(k + 1) + 5)}`);
    }
    // central window
    els.push(`M${f(CX - 7)} ${f(ry - 4)}V${f(topY + 8)}H${f(CX + 7)}V${f(ry - 4)}`);
  }
  return p(els.join(''));
});
// ground storey
const ground = (() => {
  const hw = roofW(0) * 0.7, top = roofY(0) + 3;
  const els: string[] = [`M${CX - hw} ${baseTop}V${top}M${CX + hw} ${baseTop}V${top}`];
  for (const x of [-0.46, -0.22, 0.22, 0.46]) els.push(`M${f(CX + x * hw * 1.4)} ${baseTop}V${top + 6}`);
  els.push(`M${CX - hw} ${top + 6}H${CX + hw}`);
  els.push(`M${CX - 14} ${baseTop}V${top + 18}H${CX + 14}V${baseTop}`);
  return p(els.join(''));
})();
const topY = roofY(4) - 36;
const gajur = [
  p(`M${CX - 16} ${topY}V${topY - 12}H${CX + 16}V${topY}`),
  p(`M${CX - 12} ${topY - 12}C${CX - 14} ${topY - 34} ${CX + 14} ${topY - 34} ${CX + 12} ${topY - 12}`),
  p(`M${CX} ${topY - 30}V${topY - 62}`),
  p(`M${CX - 5} ${topY - 40}H${CX + 5}M${CX - 4} ${topY - 47}H${CX + 4}`),
  c(CX, topY - 66, 3.2),
];

export const pagoda: Drawing = [fit([24, topY - 70, 376, 376], [plinth, ground, tiers, walls, gajur])];
