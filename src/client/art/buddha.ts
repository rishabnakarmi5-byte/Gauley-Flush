// Shakyamuni, seated vajrasana, bhumisparsha (earth-touching) mudra.
import { type Drawing, p, c, g, mirror, flat, dot, fit } from './kit';
import { lotusSeat, scallops, haloArc, handDown } from './parts';

const halo = [c(200, 98, 62), c(200, 98, 67)];
const hair = [
  p('M176 82C174 56 186 40 200 40C214 40 226 56 224 82'), // ushnisha + head crown
  p('M174 84C184 76 192 78 200 86C208 78 216 76 226 84'), // hairline, widow's peak
  p(scallops(179, 74, 6, 7.6)),
  p(scallops(180, 64, 5, 8)),
  p(scallops(185, 54, 4, 7.4)),
  p('M200 40C206 32 206 26 200 20C194 26 194 32 200 40Z'), // flame jewel
];
const face = mirror(
  p('M174 84C172 108 176 128 188 140C194 146 200 147 200 147'),
  p('M174 100C164 102 160 122 162 142C163 150 168 148 172 138'), // long ear
  p('M181 106Q189 111 196 106'),
  p('M178 99C186 94 194 96 199 102'),
);
const nose = p('M200 102C200 112 199 119 196 123C198 126 202 126 204 123');
const mouth = [p('M192 134Q200 138 208 134'), p('M195 138Q200 141 205 138')];
const urna = dot(200, 92, 1.5);
const neck = [...mirror(p('M190 146V162')), p('M191 154Q200 158 209 154')];
const shoulders = [
  p('M190 160C166 160 146 168 138 186'),
  p('M210 160C234 160 254 168 262 186'),
];
// robe edge across chest (covers viewer-right shoulder), right shoulder bare
const robe = [
  p('M210 160C204 184 186 208 160 228'),
  p('M218 166C212 190 194 214 168 234'),
  p('M262 186C276 214 282 244 272 270'),
  p('M160 228C170 244 190 252 212 252C240 252 262 246 272 238'),
  p('M236 176C242 200 238 226 228 244'),
  p('M250 184C260 208 258 230 250 244'),
];
const armBhumi = [
  p('M138 186C126 214 122 248 116 282'),
  p('M158 208C146 232 140 258 136 290'),
  g('translate(127 284) rotate(-3) scale(-1 1)', p(handDown(1.25))),
];
const lapHand = [
  p('M172 296C182 288 218 288 232 298C220 310 184 312 172 296Z'),
  p('M182 297C190 294 208 294 222 298'),
];
const legs = mirror(
  p('M158 262C152 263 146 265 140 267'),
  p('M118 273C92 282 66 300 56 324C64 348 140 354 200 348'),
  p('M146 326C166 334 182 336 200 334'),
);
const seat = lotusSeat(200, 405, 9, 33, 42, 16, 4);

export const buddha: Drawing = [fit([30, 20, 370, 405], [
  halo, hair, face, nose, mouth, urna, neck, shoulders, robe, armBhumi, lapHand, legs, seat,
])];
