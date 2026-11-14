// Boudhanath / Swayambhu stupa: dome, harmika with the all-seeing eyes and the "1" nose, 13-tier spire, parasol, flag lines.
import { type Drawing, p, c, mirror, flat, fit } from './kit';
import { f } from './geom';

const CX = 200;
// plinth: three stepped terraces
const plinth = [
  p('M24 376H376V360H360V344H344V328H328'),
  p('M24 376V360H40V344H56V328H72'),
  p('M72 328H328'),
];
// prayer wheels row on the middle terrace
const wheels = (() => { let d = ''; for (let i = 0; i < 17; i++) { const x = 66 + i * 16.5; d += `M${f(x - 3)} 352a3 3 0 1 0 6 0a3 3 0 1 0 -6 0`; } return d; })();
// dome
const dome = [
  p('M92 328C90 262 134 226 200 226C266 226 310 262 308 328'),
  p('M104 328C104 272 142 240 200 240C258 240 296 272 296 328'),
  p('M92 316Q200 330 308 316'),
];
const harmika = [
  p('M168 226V192H232V226'),
  p('M162 192H238M162 192V186H238V192'),
  // eyes
  ...mirror(
    p('M176 205C182 199 192 199 197 205C192 210 182 210 176 205Z'),
    p('M174 196C180 191 192 191 198 196'),
    p('M186 203.5a2.4 2.4 0 1 0 0.1 0'),
  ),
  c(200, 193, 1.6),
  p('M197 212C203 210 206 215 202 219C199 222 199 224 200 226'),
];
// 13-tier spire
const tiers = (() => {
  const out: string[] = [];
  const y0 = 186, y1 = 104, n = 13;
  const halfAt = (y: number) => 16 - ((y0 - y) / (y0 - y1)) * 8;
  for (let k = 0; k < n; k++) {
    const y = y0 - ((k + 1) / n) * (y0 - y1);
    const h = halfAt(y) + 2.2;
    out.push(`M${f(CX - h)} ${f(y)}H${f(CX + h)}`);
  }
  return out.join('');
})();
const spire = [
  ...mirror(p('M184 186L192 104')),
  p(tiers),
  // lotus base, parasol, pinnacle
  p('M185 104C187 96 192 94 200 94C208 94 213 96 215 104Z'),
  p('M172 94C176 76 224 76 228 94Z'),
  p('M200 76V58'),
  c(200, 68, 2.6),
  c(200, 53, 4),
  p('M196 53L200 44L204 53'),
];
// prayer flag strings radiating from the pinnacle to the terrace corners
const strings = mirror(p('M198 44L72 328'), p('M198 44L56 344'), p('M198 44L40 360'));

export const stupa: Drawing = [fit([24, 44, 376, 376], [plinth, p(wheels), dome, harmika, spire, strings])];
