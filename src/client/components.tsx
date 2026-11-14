import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import QRCode from 'qrcode';
import type { Player } from '../engine/types';
import { fmt, initials } from './format';
import { getState, nudgeConnection, setState, toast, useStore } from './store';

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
        <div class="sheet-head">
          <h2>{props.title}</h2>
          <button class="icon-btn" aria-label="Close" onClick={props.onClose}>{'✕'}</button>
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
      <span class="spinner" /> {everConnected ? 'Reconnecting… your seat is safe' : 'Connecting to the table…'}
    </div>
  );
}

export function AnimatedNumber(props: { value: number; format?: (n: number) => string }) {
  const [shown, setShown] = useState(props.value);
  const from = useRef(props.value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current, b = props.value;
    if (a === b) return;
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / 450);
      const v = Math.round(a + (b - a) * (1 - Math.pow(1 - k, 3)));
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(tick); else from.current = b;
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); from.current = b; };
  }, [props.value]);
  return <>{(props.format ?? fmt)(shown)}</>;
}

export function Avatar(props: { p: Pick<Player, 'name' | 'avatar'>; size?: number }) {
  const s = props.size ?? 36;
  const hue = [...props.p.name].reduce((a, c) => a + c.charCodeAt(0), 0) * 47 % 360;
  return props.p.avatar ? (
    <img class="avatar" src={props.p.avatar} alt="" width={s} height={s} referrerpolicy="no-referrer" style={{ width: s, height: s }} />
  ) : (
    <span class="avatar" style={{ width: s, height: s, background: `hsl(${hue} 45% 32%)`, fontSize: s * 0.45 }}>{initials(props.p.name)}</span>
  );
}

export function QR(props: { text: string; size?: number }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let live = true;
    QRCode.toDataURL(props.text, { margin: 1, width: (props.size ?? 220) * 2, color: { dark: '#07251a', light: '#fbf4dd' } })
      .then((u) => live && setSrc(u)).catch(() => {});
    return () => { live = false; };
  }, [props.text]);
  return src ? <img class="qr" src={src} alt={`QR code for ${props.text}`} width={props.size ?? 220} height={props.size ?? 220} data-testid="qr" /> : <div class="qr" style={{ width: props.size ?? 220, height: props.size ?? 220 }} />;
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

export function Logo(props: { small?: boolean }) {
  return (
    <div class={`logo ${props.small ? 'small' : ''}`}>
      <img src="/icon.svg" alt="" width={props.small ? 28 : 64} height={props.small ? 28 : 64} />
      <span>Gauley Flush</span>
    </div>
  );
}

export function closeSheet() { setState({ sheet: null }); }
export function openSheet(s: NonNullable<ReturnType<typeof getState>['sheet']>) { setState({ sheet: s }); }

export function Spinner() { return <span class="spinner" />; }
