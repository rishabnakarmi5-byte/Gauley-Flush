// Hand-held mani wheel: lotus-banded drum, finial, handle and weighted chain.
import { type Drawing, p, e, c, g, mirror, flat, petalUp, fit } from './kit';
import { pt, xy, f } from './geom';

const motifs = [-70, -35, 0, 35, 70].map(a => {
  const x = 200 + 62 * Math.sin((a * Math.PI) / 180), s = Math.cos((a * Math.PI) / 180);
  return p(`M${f(x)} ${f(178 - 12)}Q${f(x + 9 * s)} 178 ${f(x)} ${f(178 + 12)}Q${f(x - 9 * s)} 178 ${f(x)} ${f(178 - 12)}Z`);
});
export const prayerWheel: Drawing = [fit([136, 44, 318, 336], [
  e(200, 116, 64, 10), p('M136 116V232M264 116V232'), p('M136 232C150 246 250 246 264 232'),
  p('M136 134Q200 148 264 134'), p('M136 150Q200 164 264 150'), p('M136 204Q200 218 264 204'), p('M136 220Q200 234 264 220'),
  motifs, p('M200 164V194'),
  p('M186 106V98H214V106'), p('M188 98C188 82 212 82 212 98'), p('M200 84V64'), c(200, 58, 5), p('M198 53L200 44L202 53'),
  p('M200 244V260'), p('M186 258H214'), p('M192 258V328C192 338 208 338 208 328V258'), p('M192 276H208M192 294H208'),
  p('M256 130C292 130 312 150 306 196'), c(306, 208, 12), p('M300 196H312'),
])];
