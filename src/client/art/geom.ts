// small geometry helpers for generated drawings
export const rad = (d: number) => (d * Math.PI) / 180;
export const f = (v: number) => (Math.round(v * 10) / 10).toString();
export const pt = (cx: number, cy: number, r: number, deg: number): [number, number] =>
  [cx + r * Math.sin(rad(deg)), cy - r * Math.cos(rad(deg))]; // deg 0 = up, clockwise
export const xy = (a: [number, number]) => `${f(a[0])} ${f(a[1])}`;
/** frame at angle: u outward, v perpendicular (clockwise) */
export const frame = (cx: number, cy: number, deg: number) => {
  const s = Math.sin(rad(deg)), c = Math.cos(rad(deg));
  return (u: number, v: number): string => `${f(cx + u * s + v * c)} ${f(cy - u * c + v * s)}`;
};

/** x of a cubic bezier (x,y arrays of 4) at height y, by bisection (y monotone along the curve). */
export const cubicXatY = (px: number[], py: number[], y: number): number => {
  const at = (a: number[], t: number) => { const u = 1 - t; return u * u * u * a[0] + 3 * u * u * t * a[1] + 3 * u * t * t * a[2] + t * t * t * a[3]; };
  let lo = 0, hi = 1; const up = py[3] < py[0];
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2, ym = at(py, m); if ((ym > y) === up) lo = m; else hi = m; }
  return at(px, (lo + hi) / 2);
};

export type Pt = [number, number];
export const cubicPts = (c: Pt[], n = 20): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([u * u * u * c[0][0] + 3 * u * u * t * c[1][0] + 3 * u * t * t * c[2][0] + t * t * t * c[3][0],
      u * u * u * c[0][1] + 3 * u * u * t * c[1][1] + 3 * u * t * t * c[2][1] + t * t * t * c[3][1]]);
  }
  return out;
};
export const rotPts = (pts: Pt[], deg: number, cx: number, cy: number): Pt[] => {
  const a = rad(deg), s = Math.sin(a), c = Math.cos(a);
  return pts.map(([x, y]) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c]);
};
export const inPoly = (pt: Pt, poly: Pt[]): boolean => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
/** Visible runs of `line` (a polyline) outside every occluder polygon, as an SVG path d. */
export const hideBehind = (line: Pt[], occluders: Pt[][]): string => {
  let d = '', open = false;
  for (const q of line) {
    const hidden = occluders.some(o => inPoly(q, o));
    if (hidden) open = false; else { d += `${open ? 'L' : 'M'}${f(q[0])} ${f(q[1])}`; open = true; }
  }
  return d;
};
