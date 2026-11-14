// Banknote flights between two places on screen. Decorative only; the pile in the DOM is always the source of truth.
// Everything animates transform and opacity with the Web Animations API (compositor friendly, 60fps).

export const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export interface Pt { x: number; y: number }
export interface Pose extends Pt { rot: number; scale: number }

export function centerOf(el: Element | null | undefined): Pt | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (!r.width && !r.height) return null;
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

let layer: HTMLElement | null = null;
/** A fixed, click-through layer on <body> so flights are never clipped by scrolling panels. */
export function flyLayer(): HTMLElement {
  if (layer && layer.isConnected) return layer;
  layer = document.createElement('div');
  layer.id = 'fly-layer';
  document.body.appendChild(layer);
  return layer;
}

/** spring-like ease: a touch of overshoot, then settle */
export function spring(t: number): number {
  const c1 = 1.25, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

export interface FlyOpts {
  duration?: number;
  delay?: number;
  /** how far (px) the arc rises above the straight line */
  lift?: number;
  /** fade out at the end (sweeps), instead of staying put */
  fadeOut?: boolean;
  /** fade in at the start */
  fadeIn?: boolean;
}

/**
 * Fly `node` (a clone, appended to the fly layer) from pose a to pose b on a quadratic arc with rotation.
 * Resolves when finished and removes the node.
 */
export function arcFly(node: HTMLElement, w: number, h: number, a: Pose, b: Pose, o: FlyOpts = {}): Promise<void> {
  const lay = flyLayer();
  node.style.cssText += `;position:fixed;left:0;top:0;margin:0;width:${w}px;height:${h}px;pointer-events:none;will-change:transform,opacity;`;
  lay.appendChild(node);
  const lift = o.lift ?? Math.min(160, 50 + Math.hypot(b.x - a.x, b.y - a.y) * 0.22);
  const cx = (a.x + b.x) / 2 + (b.x - a.x) * 0.05, cy = Math.min(a.y, b.y) - lift;
  const frames: Keyframe[] = [];
  const N = 18;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const e = spring(t);
    const pt = (1 - e) * (1 - e), pm = 2 * (1 - e) * e, pe = e * e;
    const x = pt * a.x + pm * cx + pe * b.x;
    const y = pt * a.y + pm * cy + pe * b.y;
    const rot = a.rot + (b.rot - a.rot) * e;
    const sc = a.scale + (b.scale - a.scale) * e + Math.sin(Math.PI * t) * 0.1;
    const fadeIn = o.fadeIn ? Math.min(1, t / 0.15) : 1;
    const fadeOut = o.fadeOut ? (t > 0.7 ? Math.max(0, 1 - (t - 0.7) / 0.3) : 1) : 1;
    frames.push({ transform: `translate(${x - w / 2}px, ${y - h / 2}px) rotate(${rot}deg) scale(${sc})`, opacity: Math.min(fadeIn, fadeOut), offset: t });
  }
  return new Promise((resolve) => {
    const done = () => { node.remove(); resolve(); };
    try {
      const anim = node.animate(frames, { duration: o.duration ?? 780, delay: o.delay ?? 0, easing: 'linear', fill: 'both' });
      anim.onfinish = done;
      anim.oncancel = done;
    } catch { done(); }
  });
}

export function haptic(ms = 18) {
  try { navigator.vibrate?.(ms); } catch { /* unsupported */ }
}
