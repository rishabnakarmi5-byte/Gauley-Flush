// Dharahara (Bhimsen) tower: slender tapering shaft, balcony, cupola and mast.
import { type Drawing, p, c, flat, mirror, fit } from './kit';
import { f } from './geom';

const hw = (y: number) => 22 - ((340 - y) / 230) * 6; // half width at y
const bands = (() => { let d = ''; for (let k = 1; k <= 9; k++) { const y = 340 - k * 24; d += `M${f(200 - hw(y) - 2)} ${f(y)}H${f(200 + hw(y) + 2)}`; } return d; })();
const windows = (() => { let d = ''; for (let k = 0; k < 9; k++) { const y = 340 - k * 24 - 14; d += `M196 ${f(y)}V${f(y - 7)}a4 4 0 0 1 8 0V${f(y)}`; } return d; })();
export const dharahara: Drawing = [fit([140, 26, 260, 376], [
  p('M178 340L180 120M222 340L220 120'), p('M176 120H224'),
  p(bands), p(windows),
  // balcony
  p('M166 112H234'), p('M160 120H240'), p('M160 120C160 124 164 126 170 126H230C236 126 240 124 240 120'),
  p('M168 112V98M180 112V98M192 112V98M208 112V98M220 112V98M232 112V98'), p('M166 98H234'),
  // upper chamber & cupola
  p('M180 98V76M220 98V76'), p('M176 76H224'),
  p('M178 76C178 54 222 54 222 76'), p('M200 58V30'), p('M200 36L224 42L200 48'), c(200, 28, 2.4),
  // plinth and door
  p('M160 340H240'), p('M154 348H246'), p('M146 356H254'), p('M140 364H260'), p('M140 364V376H260V364'),
  p('M190 340V326a10 10 0 0 1 20 0V340'),
])];
