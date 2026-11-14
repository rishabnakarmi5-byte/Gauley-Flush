// Khukuri with its kaudi (cho) notch, fuller and horn handle.
import { type Drawing, p, c, flat, fit } from './kit';

export const khukuri: Drawing = [fit([51, 160, 372, 284], [
  p('M150 168C230 164 326 188 372 268'), // spine
  p('M372 268C348 288 296 290 252 270C216 254 192 222 156 204'), // belly / edge
  p('M156 204C158 198 164 196 168 198C166 202 164 206 156 204'), // kaudi notch
  p('M176 178C248 176 330 204 356 258'), // fuller
  p('M184 188C244 188 316 214 340 252'),
  p('M150 166V200M140 166V200'), // bolster
  p('M140 168C112 172 84 168 62 160M140 198C112 194 84 190 62 184'), // handle
  p('M62 160C50 168 50 176 62 184'), c(56, 172, 5),
  p('M120 170V196M102 169V192M84 166V189'), // grip rings
])];
