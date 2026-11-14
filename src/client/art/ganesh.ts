// Ganesh: seated frontal, broken (his right = viewer left) tusk, trunk to his left toward a bowl of modak.
import { type Drawing, p, c, e, g, mirror, flat, dot, petalUp, fit } from './kit';
import { lotusSeat, fistGrip } from './parts';
import { type Pt, cubicPts, hideBehind } from './geom';

const halo = [p('M82 144A122 122 0 1 1 318 144'), p('M89 142A115 115 0 1 1 311 142')];
const crown = mirror(
  p('M200 8C204 24 214 34 220 48C224 58 234 62 242 72'),
  p('M200 22C203 32 210 40 214 50C218 58 224 62 230 66'),
  p('M180 52Q200 60 220 52'),
  p('M166 64Q200 72 234 64'),
  p('M160 78Q200 86 240 78'),
);
const crownJewel = [c(200, 11, 3), c(200, 70, 3.5)];
const head = mirror(
  p('M240 79C247 98 247 124 241 142C237 156 229 168 219 178'),
  p('M178 106C180 95 190 91 197 99'),
  p('M171 132C176 127 184 127 189 132C184 136 176 136 171 132Z'),
  dot(179.5, 132.3, 1.2),
  p('M168 125C174 119 184 119 191 125'),
);
const forehead = p('M200 86C203 90 203 96 200 102C197 96 197 90 200 86Z');
const ears = mirror(
  p('M159 98C142 86 120 84 106 92C94 100 88 120 90 140C92 160 108 176 128 182C142 186 152 182 158 176'),
  p('M152 112C138 104 122 104 112 112C104 120 102 136 104 148C108 162 120 170 134 172'),
  p('M146 126C136 124 128 128 124 136'),
);
const trunk = [
  p('M164 124C172 116 188 114 195 124C189 148 184 196 196 232C212 266 256 284 292 262'),
  p('M236 124C228 116 212 114 205 124C211 148 218 190 228 214C238 236 268 244 284 238'),
  p('M284 238C298 240 300 254 292 262'),
  p('M192 176C200 180 206 180 212 176'),
];
const tuskFull = p('M221 174C236 174 250 182 254 196C246 188 234 184 222 184Z');
const tuskBroken = p('M180 174C172 175 166 180 164 188L168 186L169 192L173 185C176 182 179 181 182 180Z');
const torso = mirror(
  p('M150 206C132 236 120 276 146 306'),
  p('M178 196C168 200 158 203 150 204'),
  p('M168 206C172 216 180 222 186 224'),
  p('M176 202C178 212 182 218 188 220'),
);
const belly = [
  p('M136 284C172 300 228 300 264 284'),
  p('M148 304C170 322 230 322 252 304'),
  p('M196 272C198 278 202 278 204 272'),
];
const arms = mirror(
  p('M150 204C124 198 96 202 75 190'),
  p('M154 232C122 232 82 222 57 190'),
  p('M112 203C116 211 116 220 112 228'),
  p('M92 204C95 209 95 216 92 221'),
);
// lower arms: the one on the viewer's right passes behind the trunk, so its lines are cut where the trunk is
const trunkPoly: Pt[] = [
  ...cubicPts([[195, 124], [189, 148], [184, 196], [196, 232]], 14), ...cubicPts([[196, 232], [212, 266], [256, 284], [292, 262]], 20),
  ...cubicPts([[292, 262], [300, 254], [298, 240], [284, 238]], 8),
  ...cubicPts([[284, 238], [268, 244], [238, 236], [228, 214]], 14), ...cubicPts([[228, 214], [218, 190], [211, 148], [205, 124]], 14),
];
const lowerL = [p('M146 250C126 254 112 268 102 286'), p('M152 274C138 284 122 298 106 306')];
const lowerR = [
  p(hideBehind(cubicPts([[254, 250], [274, 254], [288, 268], [298, 286]], 24), [trunkPoly])),
  p(hideBehind(cubicPts([[248, 274], [262, 284], [278, 298], [294, 306]], 24), [trunkPoly])),
];
const fist = fistGrip(66, 166);
const axe = [
  p('M66 78V166M66 191V226'),
  p('M66 78C42 68 24 88 30 118C44 112 56 112 66 114'),
  p('M44 90C40 98 40 106 42 112'),
  p('M66 78V62'),
];
const lotus = [
  p('M334 118V166'),
  p(petalUp(334, 128, 44, 13)),
  g('rotate(-24 334 128)', p(petalUp(334, 128, 36, 11))),
  g('rotate(24 334 128)', p(petalUp(334, 128, 36, 11))),
];
const abhaya = [
  p('M70 304C62 300 60 288 62 272L64 256C65 250 71 250 72 256L74 270L76 250C77 244 83 244 84 250L84 270L87 252C88 246 94 247 94 253L92 272L96 262C98 258 103 260 102 265L96 290C94 302 82 308 70 304Z'),
  c(80, 286, 5),
];
const bowl = [g('translate(12 -8)', [
  p('M290 300H348'),
  p('M290 300C292 322 346 322 348 300'),
  p('M304 322H334'),
  p('M298 300C298 288 306 280 310 274C314 280 322 288 322 300'),
  p('M326 300C326 290 333 284 337 280C341 286 346 292 346 300'),
])];
const legs = mirror(
  p('M150 304C108 306 62 322 58 346C56 366 120 374 200 366'),
  p('M156 322C124 326 96 336 90 348'),
);
const soles = [p('M176 346C184 334 216 334 224 346C216 358 184 358 176 346Z'), c(200, 346, 5)];
const seat = lotusSeat(200, 414, 9, 33, 40, 16, 4);

export const ganesh: Drawing = [fit([29, -9, 369, 414], [
  halo, crown, crownJewel, head, forehead, ears, trunk, tuskFull, tuskBroken, torso, belly, arms, lowerL, lowerR, fist, g('translate(400 0) scale(-1 1)', fist), axe, lotus, abhaya, bowl, legs, seat,
])];
