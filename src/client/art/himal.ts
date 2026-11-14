// A quiet Himalayan range: layered ridges with Machhapuchhre's fishtail at the centre, a pale sun and terraced foothills.
import { type Drawing, p, c, flat } from './kit';
import { f } from './geom';

type P = [number, number];
/** Ridge through points with slightly concave (steeper near the summit) slopes. */
const ridge = (pts: P[], k = 0.6): string => {
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], dx = x1 - x0, dy = y1 - y0;
    const asc = y1 < y0;
    const cx = asc ? x0 + k * dx : x0 + (1 - k) * dx, cy = asc ? y0 + (1 - k) * dy : y0 + k * dy;
    d += `Q${f(cx)} ${f(cy)} ${x1} ${y1}`;
  }
  return d;
};
const back = ridge([
  [24, 250], [48, 226], [64, 236], [96, 182], [110, 194], [142, 134], [158, 148], [182, 98],
  [205, 62], [215, 98], [226, 68], // fishtail: two summits and the notch between them
  [246, 120], [258, 112], [286, 168], [300, 160], [324, 206], [340, 198], [376, 232],
]);
const mid = ridge([
  [24, 290], [56, 264], [80, 276], [114, 240], [136, 252], [166, 216], [190, 240], [216, 228],
  [242, 240], [270, 214], [294, 234], [322, 254], [348, 240], [376, 266],
], 0.55);
const front = [
  p('M24 318C70 304 110 322 170 312C230 302 300 322 376 308'),
  p('M24 340C80 328 140 344 210 336C270 328 330 342 376 332'),
  p('M24 362C100 352 170 364 240 358C300 352 340 362 376 356'),
];
// shaded faces below each summit (right-hand flank), kept inside the back range
const faces = [
  'M207 68C202 100 194 134 182 164M211 90C209 112 204 134 196 154',
  'M227 74C232 100 242 126 252 150M224 96C227 112 232 128 238 140',
  'M144 138C140 158 130 178 122 196M156 152C153 166 148 176 142 188',
  'M184 100C180 122 176 140 168 160',
  'M288 172C289 184 286 194 282 204M260 114C262 134 268 150 272 164',
  'M98 184C94 198 88 210 82 222',
  'M326 208C325 218 322 226 318 232',
];
// a few wind-drawn clouds between the ranges
const clouds = [
  p('M52 252C70 246 92 248 108 254'), p('M276 240C296 234 320 236 340 244'), p('M120 262C132 258 148 258 160 262'),
];
export const himal: Drawing = flat(p(back), p(mid), p(faces.join('')), clouds, front, c(334, 96, 12), c(334, 96, 16));
