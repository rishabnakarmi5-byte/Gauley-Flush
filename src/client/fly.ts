const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const COLORS = ['#c0392b', '#2b6cb0', '#2f855a', '#6b46c1', '#1a202c'];

function center(el: Element | null) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (!r.width && !r.height) return null;
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/** Animate small chips flying between two elements. Purely decorative. */
export function flyChips(from: Element | null, to: Element | null, amount: number, colorIdx = 0) {
  if (reduced()) return;
  const a = center(from), b = center(to);
  if (!a || !b || typeof Element.prototype.animate !== 'function') return;
  const count = Math.max(1, Math.min(6, Math.round(Math.log10(Math.max(1, amount)) * 2) + 1));
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'fly-chip';
    el.style.background = COLORS[(colorIdx + i) % COLORS.length];
    const jx = (Math.random() - 0.5) * 26, jy = (Math.random() - 0.5) * 18;
    el.style.left = '0px';
    el.style.top = '0px';
    document.body.appendChild(el);
    const mid = { x: (a.x + b.x) / 2 + (Math.random() - 0.5) * 60, y: Math.min(a.y, b.y) - 30 - Math.random() * 40 };
    const anim = el.animate(
      [
        { transform: `translate(${a.x - 11}px, ${a.y - 11}px) scale(0.6)`, opacity: 0 },
        { transform: `translate(${a.x - 11}px, ${a.y - 11}px) scale(1)`, opacity: 1, offset: 0.12 },
        { transform: `translate(${mid.x - 11}px, ${mid.y - 11}px) scale(1.15)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${b.x - 11 + jx}px, ${b.y - 11 + jy}px) scale(0.85)`, opacity: 1, offset: 0.92 },
        { transform: `translate(${b.x - 11 + jx}px, ${b.y - 11 + jy}px) scale(0.7)`, opacity: 0 },
      ],
      { duration: 700 + i * 60, delay: i * 70, easing: 'cubic-bezier(.25,.7,.3,1)', fill: 'both' },
    );
    anim.onfinish = () => el.remove();
    anim.oncancel = () => el.remove();
  }
}

export function haptic(ms = 18) {
  try { navigator.vibrate?.(ms); } catch { /* unsupported */ }
}
