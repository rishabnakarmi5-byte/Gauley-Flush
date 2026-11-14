// Laligurans (Rhododendron arboreum): a rounded truss of five-lobed blossoms above a whorl of long leaves.
import { type Drawing, p, c, g, flat, fit } from './kit';
import { frame, pt, xy, f } from './geom';

const flower = (cx: number, cy: number, r: number, rot: number) => {
  const els = [];
  let d = '';
  for (let k = 0; k < 5; k++) {
    const a0 = rot + 72 * k - 36, a1 = rot + 72 * k + 36, am = rot + 72 * k;
    const v0 = pt(cx, cy, 0.6 * r, a0), v1 = pt(cx, cy, 0.6 * r, a1);
    if (k === 0) d += `M${xy(v0)}`;
    d += `C${xy(pt(cx, cy, 1.05 * r, am - 28))} ${xy(pt(cx, cy, 1.05 * r, am + 28))} ${xy(v1)}`;
  }
  els.push(p(d + 'Z'));
  let v = '';
  for (let k = 0; k < 5; k++) v += `M${xy(pt(cx, cy, 0.14 * r, rot + 72 * k + 36))}L${xy(pt(cx, cy, 0.6 * r, rot + 72 * k + 36))}`;
  els.push(p(v));
  for (let k = 0; k < 5; k++) {
    const T = frame(cx, cy, rot + 72 * k);
    els.push(p(`M${T(0.06 * r, 0)}C${T(0.3 * r, -0.1 * r)} ${T(0.5 * r, 0.04 * r)} ${T(0.66 * r, 0)}`));
    const [x, y] = T(0.7 * r, 0).split(' ').map(Number); els.push(c(x, y, 1.4));
  }
  return els;
};
const leaf = (x: number, y: number, len: number, ang: number) => {
  const T = frame(x, y, ang), w = len * 0.17;
  return [p(`M${T(0, 0)}C${T(len * 0.22, -w * 1.25)} ${T(len * 0.7, -w)} ${T(len, 0)}C${T(len * 0.7, w)} ${T(len * 0.22, w * 1.25)} ${T(0, 0)}Z`), p(`M${T(len * 0.04, 0)}L${T(len * 0.9, 0)}`)];
};
const truss = [
  flower(200, 150, 27, 0),
  ...Array.from({ length: 6 }, (_, k) => { const [x, y] = pt(200, 150, 56, 60 * k); return flower(x, y, 27, 36 + 12 * k); }),
  ...Array.from({ length: 6 }, (_, k) => { const [x, y] = pt(200, 150, 92, 30 + 60 * k); return flower(x, y, 16, 20 * k); }),
];
export const rhododendron: Drawing = [fit([95, 57, 305, 340], flat(
  truss,
  p('M200 238V268'),
  [64, 100, 132, 228, 260, 296].map((a, i) => leaf(200, 268, [78, 96, 108, 108, 96, 78][i], a)),
))];
