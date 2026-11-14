// Drawing kit: drawings are plain data (El trees). Both the Preact <Art/> and the
// standalone-SVG preview script consume the very same data.
export type El =
  | { k: 'path'; d: string }
  | { k: 'circle'; cx: number; cy: number; r: number }
  | { k: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  | { k: 'line'; x1: number; y1: number; x2: number; y2: number }
  | { k: 'dot'; cx: number; cy: number; r: number }
  | { k: 'g'; t: string; c: El[] };
export type Drawing = El[];
type In = El | In[];

export const flat = (...xs: In[]): El[] => xs.flat(Infinity as 1) as El[];
export const p = (d: string): El => ({ k: 'path', d });
export const c = (cx: number, cy: number, r: number): El => ({ k: 'circle', cx, cy, r });
export const e = (cx: number, cy: number, rx: number, ry: number): El => ({ k: 'ellipse', cx, cy, rx, ry });
export const l = (x1: number, y1: number, x2: number, y2: number): El => ({ k: 'line', x1, y1, x2, y2 });
export const dot = (cx: number, cy: number, r = 1.6): El => ({ k: 'dot', cx, cy, r });
export const g = (t: string, ...c: In[]): El => ({ k: 'g', t, c: flat(c) });
/** Draw the elements and their mirror image about the vertical axis x=200. */
export const mirror = (...c: In[]): El[] => {
  const f = flat(c);
  return [...f, g('translate(400,0) scale(-1,1)', f)];
};
/** n rotated copies about (cx,cy). */
export const radial = (n: number, cx: number, cy: number, ...c: In[]): El[] => {
  const f = flat(c);
  return Array.from({ length: n }, (_, i) => g(`rotate(${+(360 / n * i).toFixed(3)} ${cx} ${cy})`, f));
};
export const at = (x: number, y: number, s: number, ...c: In[]): El => g(`translate(${x} ${y}) scale(${s})`, c);
export const n1 = (v: number) => +v.toFixed(1);

const f2 = (v: number) => +v.toFixed(2);
const SC = 'pathLength="1" vector-effect="non-scaling-stroke"';
export function elToString(el: El): string {
  switch (el.k) {
    case 'path': return `<path d="${el.d}" ${SC}/>`;
    case 'circle': return `<circle cx="${f2(el.cx)}" cy="${f2(el.cy)}" r="${f2(el.r)}" ${SC}/>`;
    case 'ellipse': return `<ellipse cx="${f2(el.cx)}" cy="${f2(el.cy)}" rx="${f2(el.rx)}" ry="${f2(el.ry)}" ${SC}/>`;
    case 'line': return `<line x1="${f2(el.x1)}" y1="${f2(el.y1)}" x2="${f2(el.x2)}" y2="${f2(el.y2)}" ${SC}/>`;
    case 'dot': return `<circle cx="${f2(el.cx)}" cy="${f2(el.cy)}" r="${el.r}" fill="currentColor" stroke="none"/>`;
    case 'g': return `<g transform="${el.t}">${el.c.map(elToString).join('')}</g>`;
  }
}
export const drawingToString = (d: Drawing) => d.map(elToString).join('');

/** Control points of an open-lotus petal pointing up from base (x,by), height h, half-width w (ogee tip): M p0 then 4 cubics. */
export const petalCtrl = (x: number, by: number, h: number, w: number): [number, number][][] => {
  const X = (k: number) => n1(x + k * w), Y = (k: number) => n1(by - k * h);
  return [
    [[x, by], [X(-0.6), Y(0.08)], [X(-1), Y(0.32)], [X(-0.86), Y(0.56)]],
    [[X(-0.86), Y(0.56)], [X(-0.7), Y(0.77)], [X(-0.25), Y(0.87)], [x, Y(1)]],
    [[x, Y(1)], [X(0.25), Y(0.87)], [X(0.7), Y(0.77)], [X(0.86), Y(0.56)]],
    [[X(0.86), Y(0.56)], [X(1), Y(0.32)], [X(0.6), Y(0.08)], [x, by]],
  ];
};
/** Open-lotus petal path pointing up from base (x,by), height h, half-width w (ogee tip). */
export const petalUp = (x: number, by: number, h: number, w: number): string => {
  const c = petalCtrl(x, by, h, w);
  return `M${x} ${by}` + c.map(([, a, b, d]) => `C${a[0]} ${a[1]} ${b[0]} ${b[1]} ${d[0]} ${d[1]}`).join('');
};

/** Scale+translate `els` (whose bbox is x0,y0,x1,y1) into the 400-box with a 24px margin (or a custom box). */
export const fit = (bb: [number, number, number, number], els: In[], box: [number, number, number, number] = [24, 24, 376, 376]): El => {
  if ((globalThis as { __ARTNOFIT?: boolean }).__ARTNOFIT) return g('translate(0 0)', els);
  const [x0, y0, x1, y1] = bb, [bx0, by0, bx1, by1] = box;
  const s = Math.min((bx1 - bx0) / (x1 - x0), (by1 - by0) / (y1 - y0));
  const tx = (bx0 + bx1) / 2 - s * (x0 + x1) / 2, ty = (by0 + by1) / 2 - s * (y0 + y1) / 2;
  return g(`translate(${+tx.toFixed(2)} ${+ty.toFixed(2)}) scale(${+s.toFixed(4)})`, els);
};
