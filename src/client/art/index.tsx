// Line-art library. INTERFACE IS FIXED: other code imports { Art, ART, type ArtName } from here.
import type { JSX } from 'preact';
import { DRAWINGS } from './registry';
import { renderEl } from './render';

export const ART = {
  gods: ['ganesh', 'laxmi', 'buddha'] as const,
  culture: [
    'mandala', 'pagoda', 'stupa', 'himal', 'prayer-flags', 'dhaka',
    'krishna-mandir', 'dharahara', 'vajra', 'lotus', 'kalash', 'butter-lamp', 'singing-bowl', 'madal', 'khukuri',
    'prayer-wheel', 'doko', 'rhododendron', 'mithila-fish', 'torana',
  ] as const,
};
export type ArtName = (typeof ART.gods)[number] | (typeof ART.culture)[number];

/** Renders one line drawing. Stroke uses currentColor; size comes from the class / parent. */
export function Art(props: { name: ArtName; class?: string; draw?: boolean }): JSX.Element {
  return (
    <svg class={`art ${props.draw ? 'art-draw' : ''} ${props.class ?? ''}`} viewBox="0 0 400 400" fill="none"
      stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" data-art={props.name} aria-hidden="true">
      {(DRAWINGS[props.name] ?? []).map(renderEl)}
    </svg>
  );
}
