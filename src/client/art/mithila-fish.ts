// Madhubani-style pair of fish curving around one another, with diamond scales and fanned tails.
import { type Drawing, p, c, mirror, flat, fit } from './kit';
import { f, pt, xy } from './geom';

const CX = 200, CY = 200, R = 108, A0 = 20, A1 = 150;
const ang = (t: number) => A0 + (A1 - A0) * t;
const wid = (t: number) => 38 * Math.pow(Math.sin(Math.PI * (0.25 + 0.55 * t)), 0.8) * (1 - 0.35 * t);
const outer = (t: number) => pt(CX, CY, R + wid(t), ang(t));
const inner = (t: number) => pt(CX, CY, R - wid(t), ang(t));
const N = 36;
const poly = (fn: (t: number) => [number, number], t0 = 0, t1 = 1, n = N) => { let d = ''; for (let i = 0; i <= n; i++) { const t = t0 + (t1 - t0) * (i / n); d += `${i ? 'L' : 'M'}${xy(fn(t))}`; } return d; };
const body = poly(outer) + `L${xy(inner(1))}` + poly(inner, 1, 0).replace(/^M/, 'L') + `Q${xy(pt(CX, CY, R, A0 - 12))} ${xy(outer(0))}`;
const scales = (() => {
  let d = ''; const n = 7, t0 = 0.26, t1 = 0.96;
  for (let i = 0; i < n; i++) { const a = t0 + ((t1 - t0) * i) / n, b = t0 + ((t1 - t0) * (i + 1)) / n; d += `M${xy(outer(a))}L${xy(inner(b))}M${xy(inner(a))}L${xy(outer(b))}`; }
  return d;
})();
const rungs = (() => { let d = ''; const n = 7, t0 = 0.26, t1 = 0.96; for (let i = 0; i <= n; i++) { const t = t0 + ((t1 - t0) * i) / n; d += `M${xy(outer(t))}L${xy(inner(t))}`; } return d; })();
const gill = `M${xy(outer(0.19))}Q${xy(pt(CX, CY, R + 6, ang(0.15)))} ${xy(inner(0.19))}`;
const tail = (() => {
  const o = outer(1), i = inner(1), mid = pt(CX, CY, R, A1);
  const to = pt(CX, CY, R + 40, A1 + 24), ti = pt(CX, CY, R - 40, A1 + 24), tn = pt(CX, CY, R, A1 + 16);
  return `M${xy(o)}Q${xy(pt(CX, CY, R + 34, A1 + 10))} ${xy(to)}Q${xy(pt(CX, CY, R + 6, A1 + 6))} ${xy(tn)}Q${xy(pt(CX, CY, R - 6, A1 + 6))} ${xy(ti)}Q${xy(pt(CX, CY, R - 34, A1 + 10))} ${xy(i)}`
    + `M${xy(mid)}L${xy(tn)}M${xy(mid)}L${xy(pt(CX, CY, R + 22, A1 + 18))}M${xy(mid)}L${xy(pt(CX, CY, R - 22, A1 + 18))}`;
})();
// dorsal fin (outer side) as a row of scallops, ventral fin inside
const fin = (() => {
  let d = ''; const n = 3, t0 = 0.36, t1 = 0.72;
  for (let i = 0; i < n; i++) { const a = t0 + ((t1 - t0) * i) / n, b = t0 + ((t1 - t0) * (i + 1)) / n; const m = (a + b) / 2; d += `M${xy(outer(a))}Q${xy(pt(CX, CY, R + wid(m) + 22, ang(m)))} ${xy(outer(b))}`; }
  d += `M${xy(inner(0.42))}Q${xy(pt(CX, CY, R - wid(0.5) - 24, ang(0.5)))} ${xy(inner(0.6))}`;
  return d;
})();
const eye = pt(CX, CY, R + 2, ang(0.08));
const half = [p(body), p(scales), p(rungs), p(gill), p(tail), p(fin), c(eye[0], eye[1], 5.5), c(eye[0], eye[1], 2)];
export const mithilaFish: Drawing = flat(
  mirror(half),
  // beaded border
  p(((() => { let d = ''; for (let i = 0; i < 48; i++) { const [x, y] = pt(CX, CY, 176, i * 7.5); d += `M${f(x - 1.6)} ${f(y)}a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0 -3.2 0`; } return d; })())),
);
