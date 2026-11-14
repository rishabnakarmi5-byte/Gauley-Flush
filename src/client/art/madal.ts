// Madal: barrel drum with laced heads and a carrying cord.
import { type Drawing, p, e, flat, fit } from './kit';
import { f } from './geom';

const top = (x: number) => 150 - 28 * Math.sin(((x - 70) / 260) * Math.PI);   // barrel bulge
const bot = (x: number) => 250 + 28 * Math.sin(((x - 70) / 260) * Math.PI);
const lace = (() => {
  let d = '';
  const n = 14;
  for (let i = 0; i < n; i++) {
    const xa = 84 + (i * (232)) / n, xb = 84 + ((i + 1) * 232) / n;
    d += `M${f(xa)} ${f(top(xa) + 1)}L${f(xb)} ${f(bot(xb) - 1)}`;
    d += `M${f(xa)} ${f(bot(xa) - 1)}L${f(xb)} ${f(top(xb) + 1)}`;
  }
  return d;
})();
const outline = (() => {
  let t = `M70 ${f(top(70))}`, b = `M70 ${f(bot(70))}`;
  for (let x = 80; x <= 330; x += 10) { t += `L${x} ${f(top(x))}`; b += `L${x} ${f(bot(x))}`; }
  return [p(t), p(b)];
})();
export const madal: Drawing = [fit([60, 89, 350, 278], [
  outline, p(lace),
  e(330, 200, 20, 50), e(330, 200, 13, 33), e(330, 200, 6, 15),
  p('M70 150C56 170 56 230 70 250'),
  p('M96 128C120 76 280 76 304 128'), p('M104 126C128 90 272 90 296 126'),
])];
