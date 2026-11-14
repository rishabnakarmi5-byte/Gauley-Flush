// Mock Nepali rupee notes and coins, drawn as SVG. Everything here is a DRAWING, deliberately marked "नमुना · MOCK".
import type { JSX } from 'preact';

export type NoteValue = 5 | 10 | 20 | 50 | 100 | 500 | 1000;

/** One map to correct the colours: paper = note body, ink = engraving lines and numerals. */
export const NOTE_COLOURS: Record<NoteValue, { paper: string; paper2: string; ink: string }> = {
  5: { paper: '#d9c1c8', paper2: '#cdaab5', ink: '#7d4a5e' },      // dusty mauve / pink
  10: { paper: '#cabf97', paper2: '#bcae7c', ink: '#5f5428' },     // olive-brown
  20: { paper: '#e2b88c', paper2: '#d6a06b', ink: '#9a5420' },     // orange
  50: { paper: '#bab8d8', paper2: '#a3a0cb', ink: '#46448a' },     // violet-blue
  100: { paper: '#b7d0b2', paper2: '#9fc09a', ink: '#3a6a42' },    // green
  500: { paper: '#d4b995', paper2: '#c4a077', ink: '#74502c' },    // brown / tan
  1000: { paper: '#b5c3ce', paper2: '#9fb1bf', ink: '#3b566c' },   // blue-grey
};

/**
 * Future swap to real photos: put an image URL here (for example '/notes/100.jpg') and that denomination is rendered
 * as the photo, with the same "नमुना" watermark on top, instead of the drawn note. Empty on purpose for now.
 */
export const NOTE_PHOTOS: Partial<Record<NoteValue, string>> = {};

const DEVA: Record<NoteValue, string> = { 5: '५', 10: '१०', 20: '२०', 50: '५०', 100: '१००', 500: '५००', 1000: '१०००' };
export const isNoteValue = (v: number): v is NoteValue => v in NOTE_COLOURS;

const f = (n: number) => (Math.round(n * 10) / 10).toString();

let cache: { rosette: string; band: string; band2: string; ring: string; hatch: string } | null = null;
function patterns() {
  if (cache) return cache;
  // guilloche rosette: rotated ellipses plus a fine inner star
  const rosette: string[] = [];
  const ellipse = (rx: number, ry: number, rot: number) => {
    const pts: string[] = [];
    for (let i = 0; i <= 48; i++) {
      const t = (i / 48) * Math.PI * 2;
      const x = Math.cos(t) * rx, y = Math.sin(t) * ry;
      const c = Math.cos(rot), s = Math.sin(rot);
      pts.push(`${i ? 'L' : 'M'}${f(x * c - y * s)} ${f(x * s + y * c)}`);
    }
    return pts.join('') + 'Z';
  };
  for (let k = 0; k < 12; k++) rosette.push(ellipse(27, 10.5, (k * Math.PI) / 12));
  for (let k = 0; k < 8; k++) rosette.push(ellipse(15, 6, (k * Math.PI) / 8 + 0.2));
  // wavy guilloche bands
  const wave = (y: number, amp: number, len: number, phase: number, x0 = 10, x1 = 200) => {
    let d = '';
    for (let x = x0; x <= x1; x += 2) d += `${x === x0 ? 'M' : 'L'}${x} ${f(y + Math.sin((x / len) * Math.PI * 2 + phase) * amp)}`;
    return d;
  };
  const band = [0, 1, 2, 3].map((i) => wave(10 + i * 1.4, 1.6, 18 + i * 2, i * 0.9)).join('');
  const band2 = [0, 1, 2].map((i) => wave(88 + i * 1.5, 1.4, 14 + i * 3, i * 1.3)).join('');
  const ring: string[] = [];
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    ring.push(`M${f(Math.cos(a) * 30)} ${f(Math.sin(a) * 30)}L${f(Math.cos(a) * 33)} ${f(Math.sin(a) * 33)}`);
  }
  let hatch = '';
  for (let x = 76; x <= 200; x += 3) hatch += `M${x} 76L${x + 7} 83`;
  cache = { rosette: rosette.join(''), band, band2, ring: ring.join(''), hatch };
  return cache;
}

function Mark(props: { cls?: string }) {
  return <span class={`note-mark ${props.cls ?? ''}`}>{'नमुना'}</span>;
}

export function Note(props: { value: NoteValue; class?: string }): JSX.Element {
  const v = props.value;
  const photo = NOTE_PHOTOS[v];
  if (photo) {
    return (
      <div class={`note note-photo ${props.class ?? ''}`} data-value={v}>
        <img src={photo} alt={`Rs ${v}`} draggable={false} />
        <Mark />
      </div>
    );
  }
  const c = NOTE_COLOURS[v];
  const p = patterns();
  const big = String(v).length >= 4 ? 22 : 27;
  return (
    <div class={`note ${props.class ?? ''}`} data-value={v} style={{ '--paper': c.paper, '--ink': c.ink } as never}>
      <svg viewBox="0 0 210 100" aria-hidden="true" focusable="false">
        <rect width="210" height="100" fill={c.paper} />
        <rect x="0" y="0" width="210" height="22" fill={c.paper2} opacity=".35" />
        <rect x="0" y="80" width="210" height="20" fill={c.paper2} opacity=".35" />
        <g fill="none" stroke={c.ink} stroke-linejoin="round" stroke-linecap="round">
          <rect x="4.5" y="4.5" width="201" height="91" rx="2" stroke-width=".9" opacity=".75" />
          <rect x="7.5" y="7.5" width="195" height="85" rx="1.5" stroke-width=".4" opacity=".5" />
          <path d={p.band} stroke-width=".35" opacity=".5" />
          <path d={p.band2} stroke-width=".35" opacity=".5" />
          <g transform="translate(47 50)">
            <path d={p.rosette} stroke-width=".35" opacity=".55" />
            <path d={p.ring} stroke-width=".5" opacity=".6" />
            <circle r="34.5" stroke-width=".6" opacity=".6" />
            <circle r="6" stroke-width=".8" opacity=".8" />
          </g>
          <path d={p.hatch} stroke-width=".3" opacity=".35" />
          <path d="M80 76 L94 56 L101 63 L115 40 L127 62 L135 54 L152 76" stroke-width="1" opacity=".85" />
          <path d="M108 50 L115 40 L121 50 M92 59 L94 56 L97 60" stroke-width=".6" opacity=".7" />
          <circle cx="143" cy="40" r="4.5" stroke-width=".6" opacity=".7" />
          <path d="M80 76 H152" stroke-width=".5" opacity=".6" />
        </g>
        <g fill={c.ink}>
          <text class="n-deva" x="116" y="29" text-anchor="middle" font-size="11" opacity=".9">{'रुपैयाँ'}</text>
          <text class="n-lat" x="192" y="41" text-anchor="end" font-size={big} font-weight="600" letter-spacing="-.5">{v}</text>
          <text class="n-deva" x="192" y="62" text-anchor="end" font-size="16">{DEVA[v]}</text>
          <text class="n-lat" x="13" y="19" font-size="8.5" font-weight="600">{v}</text>
          <text class="n-lat" x="197" y="92" text-anchor="end" font-size="8.5" font-weight="600">{v}</text>
          <g transform="rotate(-17 105 52)" opacity=".34">
            <text class="n-deva" x="105" y="57" text-anchor="middle" font-size="12.5" font-weight="600" letter-spacing="1.2" stroke={c.paper} stroke-width="2.4" paint-order="stroke">{'नमुना · MOCK'}</text>
          </g>
        </g>
      </svg>
    </div>
  );
}

export function Coin(props: { value: 1 | 2; class?: string }): JSX.Element {
  return (
    <div class={`coin ${props.class ?? ''}`} data-value={props.value}>
      <svg viewBox="0 0 40 40" aria-hidden="true" focusable="false">
        <circle cx="20" cy="20" r="19" fill="#b8ad96" />
        <circle cx="20" cy="20" r="17.2" fill="none" stroke="#5d5545" stroke-width=".8" stroke-dasharray="1.2 1.6" opacity=".7" />
        <circle cx="20" cy="20" r="13" fill="none" stroke="#5d5545" stroke-width=".6" opacity=".6" />
        <text class="n-lat" x="20" y="26" text-anchor="middle" font-size="16" font-weight="600" fill="#4a4336">{props.value}</text>
      </svg>
    </div>
  );
}

/** Any piece of a pile: a note, or a coin for Rs 1 and Rs 2. `qty` > 1 draws a small stack with a count. */
export function Money(props: { value: number; qty?: number; class?: string }): JSX.Element | null {
  const { value, qty = 1 } = props;
  const mk = () => (value === 1 || value === 2 ? <Coin value={value} class={props.class} /> : isNoteValue(value) ? <Note value={value} class={props.class} /> : null);
  if (!mk()) return null;
  if (qty <= 1) return mk();
  return (
    <div class="wad">
      <div class="wad-under" aria-hidden="true">{mk()}</div>
      <div class="wad-under w2" aria-hidden="true">{mk()}</div>
      {mk()}
      <span class="wad-count">{'×'}{qty}</span>
    </div>
  );
}
