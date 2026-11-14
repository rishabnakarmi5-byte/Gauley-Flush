// Doko: conical woven basket with its namlo head-strap.
import { type Drawing, p, e, flat, fit } from './kit';
import { f } from './geom';

// outline: top rim ellipse, tapering walls with a rounded foot
const TOP = 120, BOT = 330, HWT = 92, HWB = 38;
const hw = (y: number) => HWB + (HWT - HWB) * Math.pow((BOT - y) / (BOT - TOP), 0.9);
const weave = (() => {
  let d = '';
  const clip = (x0: number, y0: number, x1: number, y1: number) => {
    // clip the segment to y in [TOP+8, BOT] and |x-200| <= hw(y) - 1 by sampling
    let pts: [number, number][] = [];
    for (let i = 0; i <= 60; i++) { const t = i / 60, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t; if (y >= TOP + 6 && y <= BOT - 2 && Math.abs(x - 200) <= hw(y) - 1.5) pts.push([x, y]); }
    if (pts.length > 1) d += `M${f(pts[0][0])} ${f(pts[0][1])}L${f(pts[pts.length - 1][0])} ${f(pts[pts.length - 1][1])}`;
  };
  for (let k = -12; k <= 12; k++) {
    const x = 200 + k * 16;
    clip(x - 120, TOP, x + 120, TOP + 240); // diagonal one way
    clip(x + 120, TOP, x - 120, TOP + 240); // other way
  }
  return d;
})();
const wall = (s: 1 | -1) => { let d = `M${f(200 + s * hw(TOP))} ${TOP}`; for (let y = TOP + 6; y <= BOT; y += 6) d += `L${f(200 + s * hw(y))} ${y}`; return d; };
export const doko: Drawing = [fit([108, 40, 292, 341], [
  e(200, TOP, HWT, 12), e(200, TOP, HWT - 8, 9),
  p(wall(1)), p(wall(-1)),
  p(`M${f(200 - HWB)} ${BOT}C${f(200 - HWB + 6)} ${BOT + 14} ${f(200 + HWB - 6)} ${BOT + 14} ${f(200 + HWB)} ${BOT}`),
  p(weave),
  p(`M${f(200 - hw(TOP + 10))} ${TOP + 8}C130 ${TOP - 70} 190 ${TOP - 80} 200 ${TOP - 80}C210 ${TOP - 80} 270 ${TOP - 70} ${f(200 + hw(TOP + 10))} ${TOP + 8}`),
  p(`M${f(200 - hw(TOP + 10) + 5)} ${TOP + 8}C136 ${TOP - 58} 190 ${TOP - 68} 200 ${TOP - 68}C210 ${TOP - 68} 264 ${TOP - 58} ${f(200 + hw(TOP + 10) - 5)} ${TOP + 8}`),
])];
