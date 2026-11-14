// Kalash: round copper pot, mango leaves and a coconut.
import { type Drawing, p, e, c, g, mirror, flat, petalUp, fit } from './kit';
import { f } from './geom';

const garland = (() => { let d = 'M154 268'; for (let i = 0; i < 8; i++) d += 'a6.5 6.5 0 0 0 13 0'; return d; })();
const pot = [
  ...mirror(
    p('M182 160C182 182 168 198 156 214C138 238 136 282 158 318C170 334 186 340 200 340'),
    p('M176 150C178 154 182 158 182 160'),
  ),
  e(200, 148, 26, 5),
  p('M182 176Q200 182 218 176'), p('M168 204Q200 214 232 204'),
  p('M144 244Q200 258 256 244'),
  p(garland),
  ...[-2, -1, 0, 1, 2].map(i => g(`rotate(${180 + i * 12} ${200 + i * 20} 282)`, p(petalUp(200 + i * 20, 282, 30, 8)))),
  p('M174 340L170 352H230L226 340'),
  p('M178 340Q200 346 222 340'),
];
const leaf = (x: number, a: number) => g(`rotate(${a} ${x} 146)`, [p(petalUp(x, 146, 92, 11)), p(`M${x} 146V${146 - 76}`)]);
const leaves = [leaf(178, -62), leaf(190, -34), leaf(210, 34), leaf(222, 62)];
const coconut = [e(200, 114, 22, 27), p('M186 94C192 84 208 84 214 94'), p('M193 90C196 84 204 84 207 90'), p('M180 108C184 134 216 134 220 108')];
export const kalash: Drawing = [fit([92, 64, 308, 352], [leaves, coconut, pot])];
