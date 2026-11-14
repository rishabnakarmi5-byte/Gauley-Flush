// Ring mandala: empty centre (r < 96), lotus ring, beaded rings, four T-gates. 12-fold + 4-fold symmetric.
import { type Drawing, c, p, flat, radial, g, petalUp } from './kit';
import { pt, xy, frame, f } from './geom';

const CX = 200, CY = 200;
const petals = (n: number, off: number, r0: number, L: number, w: number, inner: boolean) => {
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = off + (360 / n) * i, T = frame(CX, CY, a);
    const shape = (s: number, u0: number) => {
      const U = (t: number) => r0 + u0 + t * L * s;
      const W = w * s;
      return `M${T(U(0), 0)}C${T(U(0.08), -W * 0.75)} ${T(U(0.3), -W * 1.1)} ${T(U(0.56), -W * 0.82)}C${T(U(0.76), -W * 0.55)} ${T(U(0.88), -W * 0.14)} ${T(U(1), 0)}C${T(U(0.88), W * 0.14)} ${T(U(0.76), W * 0.55)} ${T(U(0.56), W * 0.82)}C${T(U(0.3), W * 1.1)} ${T(U(0.08), W * 0.75)} ${T(U(0), 0)}`;
    };
    d += shape(1, 0);
    if (inner) d += shape(0.58, 0.1 * L);
  }
  return d;
};
const ticks = (n: number, r0: number, r1: number, off = 0) => {
  let d = '';
  for (let i = 0; i < n; i++) { const a = off + (360 / n) * i; d += `M${xy(pt(CX, CY, r0, a))}L${xy(pt(CX, CY, r1, a))}`; }
  return d;
};
const beads = (n: number, r: number, rb: number, off = 0) => {
  let d = '';
  for (let i = 0; i < n; i++) { const ang = off + (360 / n) * i; const m = ang % 90; if (m < 6 || m > 84) continue; const [x, y] = pt(CX, CY, r, ang); d += `M${f(x - rb)} ${f(y)}a${rb} ${rb} 0 1 0 ${2 * rb} 0a${rb} ${rb} 0 1 0 ${-2 * rb} 0`; }
  return d;
};
// one T-gate at the top, rotated 4x
const rt = (r: number) => CY - r;
const gate = [
  p(`M193 ${rt(149)}V${rt(160)}H178V${rt(168)}H222V${rt(160)}H207V${rt(149)}`),
  p(`M186 ${rt(164)}H214`),
];
const ticksSkip = (n: number, r0: number, r1: number, skip: number) => {
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = (360 / n) * i; const m = a % 90; if (m < skip || m > 90 - skip) continue;
    d += `M${xy(pt(CX, CY, r0, a))}L${xy(pt(CX, CY, r1, a))}`;
  }
  return d;
};

export const mandala: Drawing = flat(
  c(CX, CY, 96), c(CX, CY, 99),
  radial(16, CX, CY, p(petalUp(200, 97, 42, 15)), p(petalUp(200, 90, 24, 8.5))),
  g('rotate(11.25 200 200)', radial(16, CX, CY, p(petalUp(200, 97, 28, 6.5)))),
  c(CX, CY, 147), c(CX, CY, 150),
  p(beads(48, 157, 1.8, 3.75)),
  c(CX, CY, 172), c(CX, CY, 176),
  p(ticksSkip(120, 173.5, 175, 11)),
  radial(4, CX, CY, gate),
);
