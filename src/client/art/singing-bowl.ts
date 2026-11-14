// Himalayan singing bowl on its ring cushion, with the striker beside it.
import { type Drawing, p, e, g, flat, fit } from './kit';

const bowl = [
  e(190, 170, 122, 22),
  p('M80 170C84 250 136 300 190 300C244 300 296 250 300 170'),
  ...[200, 222, 250].map(y => { const hw = 110 * Math.sqrt(1 - Math.pow((y - 170) / 130, 2)); return p(`M${190 - hw} ${y}A${hw} ${hw * 0.17} 0 0 0 ${190 + hw} ${y}`); }),
  p('M118 306C150 326 230 326 262 306'), p('M130 318C160 332 220 332 250 318'),
];
const waves = [p('M148 120A60 60 0 0 1 232 120'), p('M128 100A82 82 0 0 1 252 100'), p('M108 80A104 104 0 0 1 272 80')];
const striker = [
  p('M60 360L304 340'),
  p('M60 360C52 364 52 372 60 374L304 352C312 350 312 342 304 340'),
  p('M258 344.5L258 357'), p('M270 343.5L270 356'), p('M282 342.5L282 355'),
  p('M60 360L304 340'),
];
export const singingBowl: Drawing = [fit([54, 40, 312, 374], [waves, bowl, striker])];
