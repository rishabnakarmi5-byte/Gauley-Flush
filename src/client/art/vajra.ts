// Vajra (dorje): central sphere, two lotus bowls, five prongs per end (centre + four curving in).
import { type Drawing, p, c, g, mirror, flat, petalUp, fit } from './kit';

const half = [
  p('M182 186H218'), p('M178 178H222'), p('M186 186C186 190 188 194 190 196M214 186C214 190 212 194 210 196'),
  // lotus bowl
  ...[-56, -28, 0, 28, 56].map(a => g(`rotate(${a} 200 176)`, p(petalUp(200, 176, 36, 12)))),
  // central prong
  p('M194 140C195 112 198 84 200 54C202 84 205 112 206 140'),
  // outer prongs curving in to meet the tip
  p('M214 160C250 150 262 108 238 76C228 62 210 56 201 54'),
  p('M210 152C240 142 250 108 230 80C222 68 208 60 201 58'),
  // inner prongs
  p('M208 150C226 132 228 104 214 82'),
  p('M205 148C218 130 218 108 208 90'),
];
const upper = mirror(half);
export const vajra: Drawing = [fit([150, 54, 250, 346], [upper, g('translate(0 400) scale(1 -1)', upper), c(200, 200, 15), c(200, 200, 9)])];
