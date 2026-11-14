// Krishna Mandir, Patan: stepped plinth, three arcaded storeys, a curvilinear shikhara and corner pinnacles.
import { type Drawing, p, e, c, flat, mirror, fit } from './kit';
import { f, cubicXatY } from './geom';

const CX = 200;
const arch = (x: number, y0: number, a: number, H: number) =>
  `M${f(x - a)} ${f(y0)}V${f(y0 - H * 0.52)}Q${f(x - a)} ${f(y0 - H * 0.86)} ${f(x)} ${f(y0 - H)}Q${f(x + a)} ${f(y0 - H * 0.86)} ${f(x + a)} ${f(y0 - H * 0.52)}V${f(y0)}`;

/** curvilinear spire */
const shikhara = (cx: number, yb: number, W: number, h: number, ribs: number) => {
  const px = [W, W, 0.52 * W, 0.17 * W], py = [0, -0.34 * h, -0.62 * h, -0.86 * h];
  const half = (y: number) => cubicXatY(px, py.map(v => yb + v), y);
  const side = `C${f(cx + px[1])} ${f(yb + py[1])} ${f(cx + px[2])} ${f(yb + py[2])} ${f(cx + px[3])} ${f(yb + py[3])}`;
  const sideL = `C${f(cx - px[1])} ${f(yb + py[1])} ${f(cx - px[2])} ${f(yb + py[2])} ${f(cx - px[3])} ${f(yb + py[3])}`;
  const els = [
    p(`M${f(cx + W)} ${f(yb)}${side}L${f(cx + 0.12 * W)} ${f(yb - 0.9 * h)}`),
    p(`M${f(cx - W)} ${f(yb)}${sideL}L${f(cx - 0.12 * W)} ${f(yb - 0.9 * h)}`),
  ];
  let d = '';
  for (let k = 1; k <= ribs; k++) { const y = yb - (k / (ribs + 1)) * 0.84 * h, hw = half(y); d += `M${f(cx - hw)} ${f(y)}H${f(cx + hw)}`; }
  els.push(p(d));
  els.push(e(cx, yb - 0.92 * h, 0.2 * W, 0.028 * h)); // amalaka
  els.push(p(`M${f(cx - 0.08 * W)} ${f(yb - 0.95 * h)}V${f(yb - 0.97 * h)}M${f(cx)} ${f(yb - 0.95 * h)}V${f(yb - h)}`));
  els.push(c(cx, yb - h - 1.6, 1.8));
  return els;
};

const plinth = (() => {
  const d: string[] = []; let y = 376;
  for (const hw of [176, 160, 144]) { d.push(`M${CX - hw} ${y}H${CX + hw}V${y - 9}H${CX - hw}Z`); y -= 9; }
  d.push(`M${CX - 24} 376V349M${CX + 24} 376V349`);
  return p(d.join(''));
})();
// storeys: [halfwidth, floor y, ceiling y]
const storeys = [[108, 349, 296], [88, 288, 244], [68, 236, 200]] as const;
const body = storeys.flatMap(([hw, y0, y1], i) => {
  const H = (y0 - y1) - 6, a = hw / 3 - 8;
  const els = [
    p(`M${CX - hw} ${y0}V${y1}M${CX + hw} ${y0}V${y1}`),
    p(`M${CX - hw - 10} ${y1}H${CX + hw + 10}M${CX - hw - 6} ${y1 - 5}H${CX + hw + 6}`),
    p(`M${CX - hw} ${y1}V${y1 + 4}`),
  ];
  for (const k of [-1, 0, 1]) els.push(p(arch(CX + k * (hw * 2) / 3, y0, a, H)));
  for (const s of [-1, 1]) els.push(p(`M${CX + s * hw / 3} ${y0}V${y1 + 6}`));
  // dentil
  let t = ''; for (let x = -hw - 6; x <= hw + 6; x += 8) t += `M${CX + x} ${y1}v4`;
  els.push(p(t));
  return els;
});
const small = [
  ...shikhara(CX - 100, 296 - 5, 17, 52, 4), ...shikhara(CX + 100, 296 - 5, 17, 52, 4),
  ...shikhara(CX - 78, 244 - 5, 15, 46, 3), ...shikhara(CX + 78, 244 - 5, 15, 46, 3),
  ...shikhara(CX - 58, 200 - 5, 13, 40, 3), ...shikhara(CX + 58, 200 - 5, 13, 40, 3),
];
const main = shikhara(CX, 200 - 5, 40, 150, 9);
export const krishnaMandir: Drawing = [fit([24, 42, 376, 376], [plinth, body, small, main])];
