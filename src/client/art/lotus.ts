// Lotus in full bloom: two layered rows of ogee petals (back row hidden behind the front row), calyx and pond ripples.
import { type Drawing, p, flat, fit, petalCtrl } from './kit';
import { type Pt, cubicPts, rotPts, hideBehind } from './geom';

const CX = 200, CY = 316;
/** polyline outline of a petal rotated about the shared base */
const outline = (ang: number, h: number, w: number): Pt[] => {
  const pts: Pt[] = [];
  for (const seg of petalCtrl(CX, CY, h, w)) pts.push(...cubicPts(seg as Pt[], 28));
  return rotPts(pts, ang, CX, CY);
};
const layers = [
  ...[[-13, 158, 26], [13, 158, 26], [-39, 150, 26], [39, 150, 26], [-65, 128, 26], [65, 128, 26]],
  ...[[0, 196, 27], [-26, 186, 27], [26, 186, 27], [-52, 168, 27], [52, 168, 27], [-78, 140, 27], [78, 140, 27]],
].map(([a, h, w]) => ({ a, h, w, poly: outline(a, h, w) }));
const parts = layers.flatMap((l, i) => {
  const occ = layers.slice(0, i).map(o => o.poly);
  const vein = rotPts([[CX, CY - l.h * 0.3], [CX, CY - l.h * 0.7]], l.a, CX, CY);
  const veinPts: Pt[] = Array.from({ length: 12 }, (_, k) => [vein[0][0] + ((vein[1][0] - vein[0][0]) * k) / 11, vein[0][1] + ((vein[1][1] - vein[0][1]) * k) / 11]);
  return [p(hideBehind(l.poly, occ)), p(hideBehind(veinPts, occ))];
});
const calyx = [p('M122 326C146 350 254 350 278 326'), p('M138 338C164 356 236 356 262 338')];
const pond = [p('M64 372C130 358 270 358 336 372'), p('M104 384C160 374 240 374 296 384')];
export const lotus: Drawing = [fit([63, 120, 337, 384], flat(parts, calyx, pond))];
