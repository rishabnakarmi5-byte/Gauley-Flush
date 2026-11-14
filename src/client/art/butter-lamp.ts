// Butter lamp (diyo): flame, cup on a lotus-ringed stem and flared foot.
import { type Drawing, p, e, c, g, mirror, flat, petalUp, fit } from './kit';
import { pt, xy } from './geom';

const flame = [
  p('M200 62C216 90 216 112 200 126C184 112 184 90 200 62Z'),
  p('M200 90C207 102 207 112 200 118C193 112 193 102 200 90Z'),
];
const rays = (() => { let d = ''; for (const a of [-80, -55, -30, 30, 55, 80]) { d += `M${xy(pt(200, 100, 38, a))}L${xy(pt(200, 100, 52, a))}`; } return d; })();
const cup = [
  e(200, 136, 56, 9),
  p('M144 136C146 176 174 196 200 196C226 196 254 176 256 136'),
  p('M152 156Q200 174 248 156'),
  ...[-2, -1, 0, 1, 2].map(i => g(`rotate(${i * 16} ${200 + i * 20} 156)`, p(petalUp(200 + i * 20, 188, 26, 8)))).slice(0, 0),
];
const stem = mirror(
  p('M190 196V208C178 212 176 224 190 230V246'),
  p('M190 246C186 266 156 276 132 300'),
);
const foot = [p('M132 300H268'), p('M126 308H274'), p('M132 300C128 304 126 306 126 308M268 300C272 304 274 306 274 308'), e(200, 222, 14, 4)];
export const butterLamp: Drawing = [fit([126, 55, 274, 308], [flame, p(rays), cup, stem, foot])];
