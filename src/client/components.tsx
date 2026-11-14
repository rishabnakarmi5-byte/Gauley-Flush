import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import QRCode from 'qrcode';
import type { Player } from '../engine/types';
import { Art, ART, type ArtName } from './art';
import { IconClose } from './icons';
import { fmt, initials } from './format';
import { getState, nudgeConnection, setState, toast, useStore } from './store';

export const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** First of the preferred art names that exists in the list, else any (library grows; never hardcode a name). */
export function pickArt(list: readonly string[], ...preferred: string[]): ArtName {
  const hit = preferred.find((n) => list.includes(n));
  return (hit ?? list[0] ?? 'mandala') as ArtName;
}
export const godArt = (...pref: string[]) => pickArt(ART.gods, ...pref);

/** Faint line drawing that draws itself in when the screen appears. */
export function ArtBackdrop(props: { name: ArtName; class?: string }) {
  return (
    <div class={`backdrop ${props.class ?? ''}`} aria-hidden="true">
      <Art name={props.name} class="art-hero" draw />
    </div>
  );
}

/** A thin divider cut out of a drawing: the viewBox is fitted to the drawn content so only the pattern band shows. */
export function ArtStrip(props: { name: ArtName; class?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const svg = ref.current?.querySelector('svg');
    if (!svg) return;
    try {
      const b = svg.getBBox();
      if (b.width > 1 && b.height > 1) {
        svg.setAttribute('viewBox', `${b.x - 2} ${b.y - 2} ${b.width + 4} ${b.height + 4}`);
        svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
      }
    } catch { /* not rendered yet */ }
  }, [props.name]);
  return <div class={`art-strip ${props.class ?? ''}`} ref={ref} aria-hidden="true"><Art name={props.name} draw /></div>;
}

export function Sheet(props: { title: string; onClose: () => void; children: ComponentChildren; testid?: string }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') props.onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
  return (
    <div class="sheet-wrap" data-testid={props.testid}>
      <div class="sheet-backdrop" onClick={props.onClose} />
      <div class="sheet" role="dialog" aria-label={props.title}>
        <div class="sheet-grab" aria-hidden="true" />
        <div class="sheet-head">
          <h2>{props.title}</h2>
          <button class="icon-btn" aria-label="Close" data-testid="sheet-close" onClick={props.onClose}><IconClose /></button>
        </div>
        <div class="sheet-body">{props.children}</div>
      </div>
    </div>
  );
}

export function Toasts() {
  const { toasts } = useStore();
  return (
    <div class="toasts" aria-live="polite">
      {toasts.map((t) => <div key={t.id} class={`toast ${t.kind}`} data-testid="toast">{t.text}</div>)}
    </div>
  );
}

export function ConnBanner() {
  const { online, everConnected, session, closedReason } = useStore();
  if (closedReason || !session) return null;
  if (online) return null;
  return (
    <div class="conn-banner" role="status" data-testid="reconnecting" onClick={nudgeConnection}>
      <span class="spinner" /> {everConnected ? 'Reconnecting. Your seat is safe.' : 'Connecting to the table…'}
    </div>
  );
}

/** Money numeral that counts up or down. Instant under prefers-reduced-motion. */
export function AnimatedNumber(props: { value: number; format?: (n: number) => string }) {
  const [shown, setShown] = useState(props.value);
  const from = useRef(props.value);
  useEffect(() => {
    const a = from.current, b = props.value;
    if (a === b) return;
    if (reducedMotion()) { from.current = b; setShown(b); return; }
    const start = performance.now();
    const dur = Math.min(900, 420 + Math.abs(b - a) * 0.6);
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / dur);
      const e = 1 - Math.pow(1 - k, 4);
      const v = Math.round(a + (b - a) * e);
      from.current = v;
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(tick); else from.current = b;
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); };
  }, [props.value]);
  return <>{(props.format ?? fmt)(shown)}</>;
}

/** An initial in a hairline circle. No coloured blobs, no photos. */
export function Avatar(props: { p: Pick<Player, 'name' | 'avatar'>; size?: number }) {
  const s = props.size ?? 32;
  return <span class="avatar" aria-hidden="true" style={{ width: `${s}px`, height: `${s}px`, minWidth: `${s}px`, fontSize: `${s * 0.44}px` }}>{initials(props.p.name)}</span>;
}

export function QR(props: { text: string; size?: number }) {
  const [src, setSrc] = useState('');
  const size = props.size ?? 220;
  useEffect(() => {
    let live = true;
    QRCode.toDataURL(props.text, { margin: 1, width: size * 3, color: { dark: '#0d0c0a', light: '#efe9dc' } })
      .then((u) => live && setSrc(u)).catch(() => {});
    return () => { live = false; };
  }, [props.text]);
  return src
    ? <img class="qr" src={src} alt={`QR code for ${props.text}`} width={size} height={size} data-testid="qr" />
    : <div class="qr" style={{ width: `${size}px`, height: `${size}px` }} />;
}

export const roomLink = (code: string) => `${location.origin}/#/r/${code}`;

export async function shareRoom(code: string) {
  const url = roomLink(code);
  try {
    if (navigator.share) { await navigator.share({ title: 'Gauley Flush', text: `Join my Flush table ${code}`, url }); return; }
  } catch { /* cancelled */ }
  try { await navigator.clipboard.writeText(url); toast('Link copied. Paste it in the group chat.', 'good'); }
  catch { toast(url, 'info', 6000); }
}

/** The mark: a minimal gold ring with a lotus-bud G. Also used as the favicon. */
export function Mark(props: { size?: number }) {
  const s = props.size ?? 28;
  return (
    <svg class="mark" width={s} height={s} viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
      <circle cx="32" cy="32" r="28" />
      <path d="M43 25.5A14 14 0 1032 46v-6.5h-6" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  );
}

export function Logo(props: { small?: boolean }) {
  return (
    <div class={`logo ${props.small ? 'small' : ''}`}>
      <Mark size={props.small ? 24 : 36} />
      <span>Gauley Flush</span>
    </div>
  );
}

export function closeSheet() { setState({ sheet: null }); }
export function openSheet(s: NonNullable<ReturnType<typeof getState>['sheet']>) { setState({ sheet: s }); }

export function Spinner() { return <span class="spinner" />; }
