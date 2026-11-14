import type { JSX } from 'preact';
import type { El } from './kit';

const SC = { pathLength: 1, 'vector-effect': 'non-scaling-stroke' } as const;
export function renderEl(el: El, key: number): JSX.Element {
  switch (el.k) {
    case 'path': return <path key={key} d={el.d} {...SC} />;
    case 'circle': return <circle key={key} cx={el.cx} cy={el.cy} r={el.r} {...SC} />;
    case 'ellipse': return <ellipse key={key} cx={el.cx} cy={el.cy} rx={el.rx} ry={el.ry} {...SC} />;
    case 'line': return <line key={key} x1={el.x1} y1={el.y1} x2={el.x2} y2={el.y2} {...SC} />;
    case 'dot': return <circle key={key} cx={el.cx} cy={el.cy} r={el.r} fill="currentColor" stroke="none" />;
    case 'g': return <g key={key} transform={el.t}>{el.c.map(renderEl)}</g>;
  }
}
