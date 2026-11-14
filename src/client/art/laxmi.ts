// Gaja Laxmi-style Laxmi: seated on an open lotus, four arms (two lotuses, coins, kalash), crown, halo.
import { type Drawing, p, c, e, g, mirror, flat, dot, petalUp, fit } from './kit';
import { lotusSeat, haloArc, handDown, fistGrip } from './parts';

const halo = [p(haloArc(200, 100, 86, 118)), p(haloArc(200, 100, 80, 118))];
const crown = mirror(
  p('M200 14C203 26 210 34 214 44C218 54 228 58 234 66'),
  p('M200 26C202 34 208 42 210 48'),
  p('M182 46Q200 52 218 46'),
  p('M168 70Q200 78 232 70'),
  p('M168 70C166 74 166 80 168 84'),
);
const crownJewel = [c(200, 17, 3), c(200, 64, 3.2)];
const face = mirror(
  p('M176 84C174 106 178 124 188 134C194 140 200 141 200 141'),
  p('M178 100C170 102 168 112 170 126C171 130 174 128 175 124'), // ear
  c(172, 134, 4.5), // earring
  p('M183 103Q189 108 195 103'),
  p('M178 96C186 91 194 92 199 98'),
);
const nose = p('M200 98C200 108 199 114 196 118C198 121 202 121 204 118');
const mouth = [p('M192 128Q196 126 200 128Q204 126 208 128'), p('M195 131Q200 134 205 131')];
const bindi = dot(200, 88, 1.5);
const torso = mirror(
  p('M192 140V150'),
  p('M192 150C172 152 152 160 144 176'),
  p('M154 180C162 200 168 214 170 230'),
  p('M172 190C176 202 190 206 198 196'),
  p('M182 152C186 170 214 170 218 152'),
  p('M186 160C190 172 210 172 214 160'),
);
const belt = [p('M170 230Q200 242 230 230'), p('M171 237Q200 249 229 237'), c(200, 243, 3.2)];
const skirt = mirror(
  p('M171 238C168 270 158 300 138 330'),
  p('M190 250C192 280 188 308 178 336'),
  p('M182 246C182 276 174 304 160 334'),
  p('M171 238C176 250 188 252 196 250'),
);
const hem = p('M138 330C160 340 240 340 262 330');
const arms = mirror(
  p('M146 164C122 154 102 156 90 148'),
  p('M152 186C126 182 106 172 92 152'),
  p('M148 190C128 214 112 242 100 266'),
  p('M158 212C146 232 130 252 118 270'),
);
const fist = fistGrip(87, 122);
const lotusL = [
  p('M87 122C85 110 82 100 80 90'),
  p(petalUp(80, 92, 46, 15)),
  g('rotate(-26 80 92)', p(petalUp(80, 92, 38, 12))),
  g('rotate(26 80 92)', p(petalUp(80, 92, 38, 12))),
];
const lotusR = [g('translate(400 0) scale(-1 1)', [lotusL, fist])];
const varada = [g('translate(109 269) rotate(-6) scale(-1 1)', p(handDown(1.1)))];
const coins = [c(114, 314, 4.5), c(120, 327, 4.5), c(110, 340, 4.5)];
const kalash = [g('translate(-8 24)', [
  p('M290 238H314'),
  p('M290 238C278 230 280 212 290 206H314C324 212 326 230 314 238'),
  p('M292 206C294 200 310 200 312 206'),
  e(302, 194, 7, 6),
  p('M296 190C288 182 290 174 296 170M302 188V168M308 190C316 182 314 174 308 170'),
])];
const palm = [p('M278 272C286 282 304 282 312 272'), p('M280 262C276 266 276 270 279 273M310 262C314 266 314 270 311 273')];
const lotusTop = e(200, 348, 82, 11);
const seat = lotusSeat(200, 410, 9, 33, 40, 15.5, 4);

export const laxmi: Drawing = [fit([31, 14, 369, 410], [
  halo, crown, crownJewel, face, nose, mouth, bindi, torso, belt, skirt, hem, arms, fist, lotusL, lotusR, varada, coins, kalash, palm, lotusTop, seat,
])];
