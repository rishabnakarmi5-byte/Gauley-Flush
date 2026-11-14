// Torana: Newar door tympanum. Flamed arch, lotus medallion, scrolling nagas and lintel.
import { type Drawing, p, c, flat, mirror, g, fit, petalUp } from './kit';
import { f, pt, xy, frame } from './geom';

const CX = 200, CY = 210;
const spiral = (cx: number, cy: number, r0: number, turns: number, dir: 1 | -1) => {
  let d = ''; const n = 40;
  for (let i = 0; i <= n; i++) { const t = i / n, a = dir * t * turns * 2 * Math.PI, r = r0 * (1 - 0.88 * t); d += `${i ? 'L' : 'M'}${f(cx + r * Math.cos(a))} ${f(cy + r * Math.sin(a))}`; }
  return d;
};
const flames = (() => { let d = ''; const n = 21; for (let i = 0; i < n; i++) { const a = -88 + (176 / (n - 1)) * i, T = frame(CX, CY, a); d += `M${T(128, 0)}C${T(132, -6)} ${T(140, -4)} ${T(146, 0)}C${T(140, 4)} ${T(132, 6)} ${T(128, 0)}`; } return d; })();
const arcPath = (r: number) => `M${CX - r} 340V${CY}A${r} ${r} 0 0 1 ${CX + r} ${CY}V340`;
const petals8 = Array.from({ length: 8 }, (_, i) => g(`rotate(${i * 45} ${CX} ${CY + 14})`, p(petalUp(CX, CY + 14 - 14, 40, 11))));
export const torana: Drawing = [fit([40, 60, 360, 360], [
  p(arcPath(150)), p(arcPath(142)), p(arcPath(112)), p(arcPath(104)), p(flames),
  p(`M${CX - 150} 340H${CX + 150}`), p(`M${CX - 160} 348H${CX + 160}V360H${CX - 160}Z`), p(`M${CX - 150} 340V348M${CX + 150} 340V348`),
  c(CX, CY + 14, 54), c(CX, CY + 14, 46), petals8, c(CX, CY + 14, 8),
  // scrolling nagas either side of the medallion
  ...mirror(p(spiral(CX - 82, CY + 14, 24, 2.3, -1)), p(spiral(CX - 74, CY + 96, 17, 2, 1)), p(`M${CX - 106} ${CY + 14}C${CX - 112} ${CY + 40} ${CX - 98} ${CY + 70} ${CX - 90} ${CY + 82}`)),
  p(`M${CX - 14} 340V300M${CX + 14} 340V300M${CX - 14} 300Q${CX} 288 ${CX + 14} 300`),
])];
