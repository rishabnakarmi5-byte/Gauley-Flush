import type { JSX } from 'preact';

type P = { size?: number; filled?: boolean; class?: string };
const base = (p: P) => ({
  width: p.size ?? 22, height: p.size ?? 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  'stroke-width': 1.5, 'stroke-linecap': 'round' as const, 'stroke-linejoin': 'round' as const, 'aria-hidden': true, class: `icon ${p.class ?? ''}`,
});

export const IconMenu = (p: P): JSX.Element => <svg {...base(p)}><path d="M4 8h16M4 16h16" /></svg>;
export const IconClose = (p: P): JSX.Element => <svg {...base(p)}><path d="M6 6l12 12M18 6L6 18" /></svg>;
export const IconHistory = (p: P): JSX.Element => <svg {...base(p)}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>;
export const IconCheck = (p: P): JSX.Element => <svg {...base(p)}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
export const IconShare = (p: P): JSX.Element => <svg {...base(p)}><path d="M12 15V4M8 8l4-4 4 4M5 13v6h14v-6" /></svg>;
export const IconScales = (p: P): JSX.Element => <svg {...base(p)}><path d="M12 4v16M7 20h10M5 8h14M5 8l-2.5 6a3 3 0 005 0zM19 8l-2.5 6a3 3 0 005 0z" /></svg>;
export const IconThumbUp = (p: P): JSX.Element => (
  <svg {...base(p)} fill={p.filled ? 'currentColor' : 'none'} fill-opacity={p.filled ? 0.22 : 0}>
    <path d="M7 11v9H4.5a1 1 0 01-1-1v-7a1 1 0 011-1zM7 11l3.2-6.2a1.6 1.6 0 013 .9L12.7 9H18a2 2 0 012 2.3l-1 6.5a2 2 0 01-2 1.7H7" />
  </svg>
);
export const IconThumbDown = (p: P): JSX.Element => (
  <svg {...base(p)} fill={p.filled ? 'currentColor' : 'none'} fill-opacity={p.filled ? 0.22 : 0}>
    <path d="M7 13V4H4.5a1 1 0 00-1 1v7a1 1 0 001 1zM7 13l3.2 6.2a1.6 1.6 0 003-.9L12.7 15H18a2 2 0 002-2.3l-1-6.5a2 2 0 00-2-1.7H7" />
  </svg>
);
export const IconPlus = (p: P): JSX.Element => <svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>;
export const IconArrow = (p: P): JSX.Element => <svg {...base(p)}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
export const IconCrown = (p: P): JSX.Element => <svg {...base(p)}><path d="M4 18h16M5 18L4 8l5 4 3-6 3 6 5-4-1 10" /></svg>;
