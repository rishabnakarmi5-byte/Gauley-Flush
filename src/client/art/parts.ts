// shared sub-drawings
import { type El, p, g, petalCtrl, flat } from './kit';
import { type Pt, cubicPts, rotPts, hideBehind } from './geom';

/** Lotus throne seen from the front: a row of petals with a taller back row peeking between them (hidden lines removed). y0 = petal base line. */
export const lotusSeat = (cx: number, y0: number, n = 9, gap = 36, h = 44, w = 17, fan = 4): El[] => {
  const half = (n - 1) / 2;
  const poly = (x: number, hh: number, ww: number, ang: number): Pt[] => {
    const pts: Pt[] = [];
    for (const seg of petalCtrl(x, y0, hh, ww)) pts.push(...cubicPts(seg as Pt[], 20));
    return rotPts(pts, ang, x, y0);
  };
  const front = Array.from({ length: n }, (_, k) => { const i = k - half; return poly(cx + i * gap, h, w, i * fan); });
  const back = Array.from({ length: n + 1 }, (_, k) => { const i = k - half - 0.5; return poly(cx + i * gap, h * 1.12, w * 1.0, i * fan); });
  const d = (pts: Pt[]) => 'M' + pts.map(q => `${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join('L');
  return [...front.map(q => p(d(q))), ...back.map(q => p(hideBehind(q, front)))];
};

/** Fist gripping a vertical shaft at (x,y): four stacked finger capsules and a thumb. */
export const fistGrip = (x: number, y: number): El[] => {
  const els: El[] = [];
  for (let k = 0; k < 4; k++) {
    const yy = y + k * 6.2;
    els.push(p(`M${x - 7} ${yy}H${x + 7}a3.1 3.1 0 0 1 0 6.2H${x - 7}a3.1 3.1 0 0 1 0 -6.2Z`));
  }
  els.push(p(`M${x + 10} ${y + 2}C${x + 15} ${y + 3} ${x + 15} ${y + 11} ${x + 10} ${y + 13}`));
  els.push(p(`M${x - 6} ${y + 24.8}C${x - 5} ${y + 29} ${x + 5} ${y + 29} ${x + 6} ${y + 24.8}`));
  return els;
};

/** Row of small scallop arcs (hair curls) starting at x, y, n curls of width cw. */
export const scallops = (x: number, y: number, n: number, cw: number): string => {
  let d = `M${x} ${y}`;
  for (let i = 0; i < n; i++) d += `a${cw / 2} ${cw / 2} 0 0 1 ${cw} 0`;
  return d;
};

/** Open halo arc of radius r about (cx,cy), spanning +-a degrees from straight up. */
export const haloArc = (cx: number, cy: number, r: number, a: number): string => {
  const rad = (a * Math.PI) / 180;
  const dx = r * Math.sin(rad), dy = -r * Math.cos(rad);
  const f = (v: number) => Math.round(v * 10) / 10;
  return `M${f(cx - dx)} ${f(cy + dy)}A${r} ${r} 0 ${a > 90 ? 1 : 0} 1 ${f(cx + dx)} ${f(cy + dy)}`;
};

/** Open hand, wrist at (0,0), fingers pointing down (+y), palm to viewer. Scale s. Returns path d. */
export const handDown = (s = 1): string => {
  const f = (v: number) => Math.round(v * s * 10) / 10;
  const lens = [17, 20, 21, 18], x0 = -12.6, wf = 5.4, gap = 1.2, py = 20;
  let d = `M${f(-8)} 0C${f(-10)} ${f(8)} ${f(x0)} ${f(12)} ${f(x0)} ${f(py)}`;
  lens.forEach((len, i) => {
    const xl = x0 + i * (wf + gap), xr = xl + wf, yb = py + len, bend = (i - 1.5) * 0.5;
    d += `C${f(xl)} ${f(py + len * 0.5)} ${f(xl + bend)} ${f(yb - wf / 2)} ${f(xl + bend + 0.1)} ${f(yb - wf / 2)}A${f(wf / 2)} ${f(wf / 2)} 0 0 0 ${f(xr + bend)} ${f(yb - wf / 2)}C${f(xr + bend)} ${f(py + len * 0.5)} ${f(xr)} ${f(py + 2)} ${f(xr)} ${f(py - 1)}`;
    if (i < lens.length - 1) d += `M${f(xr + gap)} ${f(py - 1)}`;
  });
  const xe = x0 + 4 * wf + 3 * gap;
  d += `M${f(xe)} ${f(py - 4)}C${f(xe + 7)} ${f(py - 1)} ${f(xe + 11)} ${f(py + 8)} ${f(xe + 9)} ${f(py + 14)}C${f(xe + 7)} ${f(py + 17)} ${f(xe + 3)} ${f(py + 14)} ${f(xe + 1)} ${f(py + 8)}`;
  d += `M${f(xe)} ${f(py - 4)}C${f(xe + 1)} ${f(py - 12)} ${f(8)} ${f(4)} ${f(8)} 0`;
  return d;
};
