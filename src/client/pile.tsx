import { useLayoutEffect, useRef } from 'preact/hooks';
import { Art, ART } from './art';
import { AnimatedNumber, ArtStrip, pickArt } from './components';
import { fmt } from './format';
import { arcFly, centerOf, reduced } from './fly';
import { Money } from './note';
import { buildPile, type Contribution, type Piece } from './notes';
import type { RoomCtx } from './room';

interface Geom { dx: number; dy: number; w: number; h: number; rot: number }

/** The pot as a heap of mock banknotes inside the slowly turning mandala. Face values add up exactly to the pot. */
export function PotPile(props: { c: RoomCtx }) {
  const { c } = props;
  const st = c.st;
  const h = st.hand;
  const handNo = h?.no ?? st.handNo;
  const contribs: Contribution[] = (h?.log ?? []).filter((e) => e.type !== 'pack' && e.amount > 0).map((e) => ({ n: e.n, amount: e.amount, by: e.by }));
  const logged = contribs.reduce((s, x) => s + x.amount, 0);
  // the engine keeps pot == sum of the log; if that ever drifts, show the difference as one extra anonymous note so the heap still equals the pot
  if (st.pot > logged) contribs.push({ n: 9999, amount: st.pot - logged });
  const pieces = buildPile(handNo, contribs);
  const sig = pieces.map((p) => `${p.key}:${p.value}x${p.qty}`).join('|');

  const root = useRef<HTMLDivElement>(null);
  const els = useRef(new Map<string, HTMLElement>());
  const geoms = useRef(new Map<string, Geom>());
  const prev = useRef<Piece[] | null>(null);

  useLayoutEffect(() => {
    const rootEl = root.current;
    if (!rootEl) return;
    const rr = rootEl.getBoundingClientRect();
    const rc = { x: rr.left + rr.width / 2, y: rr.top + rr.height / 2 };
    const measure = (p: Piece) => {
      const el = els.current.get(p.key);
      const inner = el?.firstElementChild as HTMLElement | null;
      if (!el || !inner) return;
      const r = el.getBoundingClientRect();
      geoms.current.set(p.key, { dx: r.left + r.width / 2 - rc.x, dy: r.top + r.height / 2 - rc.y, w: inner.offsetWidth, h: inner.offsetHeight, rot: p.rot });
    };

    const before = prev.current;
    prev.current = pieces;
    const lastFeed = st.feed[st.feed.length - 1];
    const seatPoint = (id?: string): { x: number; y: number } | null => {
      if (!id) return null;
      if (id === c.active || (c.you.includes(id) && !c.tablet)) return centerOf(document.querySelector('[data-testid="actionbar"]')) ?? null;
      return centerOf(document.querySelector(`[data-seat="${id}"]`));
    };
    const barPoint = (id?: string) => {
      if (id && (id === c.active || (c.you.includes(id) && !c.tablet))) {
        const b = document.querySelector('[data-testid="chaal"]') ?? document.querySelector('[data-testid="actionbar"]');
        const p = centerOf(b);
        if (p) return p;
      }
      return seatPoint(id);
    };

    if (before && !reduced() && document.visibilityState === 'visible') {
      const have = new Set(before.map((p) => p.key));
      const now = new Set(pieces.map((p) => p.key));
      const added = pieces.filter((p) => !have.has(p.key));
      const removed = before.filter((p) => !now.has(p.key));

      // notes that left: sweep to the winner, return to whoever bet them (undo, void), otherwise just dissolve
      if (removed.length) {
        const winner = lastFeed?.type === 'win' ? lastFeed.by : undefined;
        removed.forEach((p, i) => {
          const g = geoms.current.get(p.key);
          const src = els.current.get(p.key)?.firstElementChild as HTMLElement | null;
          if (!g || !src) return;
          const target = winner ? seatPoint(winner) : lastFeed?.type === 'undo' || lastFeed?.type === 'void' ? seatPoint(p.by) : null;
          if (!target) return;
          const node = src.cloneNode(true) as HTMLElement;
          void arcFly(node, g.w, g.h, { x: rc.x + g.dx, y: rc.y + g.dy, rot: g.rot, scale: 1 }, { x: target.x, y: target.y, rot: g.rot + (i % 2 ? 40 : -40), scale: 0.55 },
            { duration: 640 + Math.min(i, 12) * 22, delay: Math.min(i, 14) * 38, fadeOut: true });
        });
      }

      // new notes arrive from the bettor's seat (or the action bar for my own bet); a bulk change (resync, undo award) just fades in
      const srcs = new Set(added.map((p) => p.src));
      const single = added.length > 0 && added.length <= 14 && srcs.size === 1 && !srcs.has(-1) && !srcs.has(9999);
      if (single) {
        const origin = barPoint(added[0].by);
        if (origin) {
          added.forEach((p, i) => {
            const el = els.current.get(p.key);
            const inner = el?.firstElementChild as HTMLElement | null;
            if (!el || !inner) return;
            measure(p);
            const g = geoms.current.get(p.key)!;
            const node = inner.cloneNode(true) as HTMLElement;
            el.style.visibility = 'hidden';
            void arcFly(node, g.w, g.h, { x: origin.x, y: origin.y, rot: g.rot - 50, scale: 0.7 }, { x: rc.x + g.dx, y: rc.y + g.dy, rot: g.rot, scale: 1 },
              { duration: 720, delay: i * 70, fadeIn: true }).then(() => {
              el.style.visibility = '';
              el.classList.remove('settle'); void el.offsetWidth; el.classList.add('settle');
            });
          });
        }
      } else {
        for (const p of added) els.current.get(p.key)?.classList.add('pile-in');
      }
    }
    for (const p of pieces) measure(p);
    // prune bookkeeping for notes that are gone (keep them one pass so a removal can still clone them)
    const live = new Set(pieces.map((p) => p.key));
    for (const k of els.current.keys()) if (!live.has(k) && !before?.some((p) => p.key === k)) { els.current.delete(k); geoms.current.delete(k); }
  }, [sig, handNo]);

  const total = pieces.reduce((s, p) => s + p.value * p.qty, 0);
  return (
    <div class="pile" id="pot" ref={root} data-testid="pile" data-total={total} data-count={pieces.length} aria-hidden="true">
      {pieces.map((p) => (
        <div key={p.key} class={`pile-piece ${p.value <= 2 ? 'is-coin' : ''}`} data-testid="pile-note" data-value={p.value} data-qty={p.qty}
          ref={(el) => { if (el) els.current.set(p.key, el); }}
          style={{ '--x': p.x, '--y': p.y, '--r': `${p.rot}deg` } as never}>
          <Money value={p.value} qty={p.qty} />
        </div>
      ))}
    </div>
  );
}

// ---------- the pot: mandala stage + total numeral ----------
function statusLine(c: RoomCtx): string {
  const { st } = c;
  const h = st.hand;
  if (!h) return st.endVote ? 'End-game vote in progress' : st.handNo ? 'Between hands. Chai time.' : 'Waiting to deal';
  if (h.status === 'boot') return `Boot stage · ${h.boots.length} in`;
  if (h.status === 'claimed') return `${c.name(h.claimBy ?? undefined)} claims the pot`;
  return `Betting open · ${h.boots.length - h.packed.length} in the hand`;
}

/** culture motif for this hand (never the mandala, the dhaka strip or the flags, which are used elsewhere) */
export function handMotif(handNo: number) {
  const pool = (ART.culture as readonly string[]).filter((n) => !['mandala', 'dhaka', 'prayer-flags'].includes(n));
  return pickArt(pool.length ? pool : ART.culture, pool[Math.abs(handNo) % Math.max(1, pool.length)] ?? '');
}

export function Pot(props: { c: RoomCtx }) {
  const { st } = props.c;
  const classicStake = st.hand && st.players.some((p) => p.classic && st.hand!.boots.includes(p.id));
  return (
    <section class="pot-block" data-testid="pot-wrap">
      <div class="pot-stage">
        <Art name={pickArt(ART.culture, 'mandala')} class="mandala spin" draw />
        <PotPile c={props.c} />
      </div>
      <div class="pot-label">Pot</div>
      <div class="pot-amount" data-testid="pot"><span class="cur">Rs</span><AnimatedNumber value={st.pot} format={(n) => n.toLocaleString('en-IN')} /></div>
      <div class="pot-raw" data-testid="pot-raw" aria-hidden="true">{st.pot}</div>
      <div class="pot-status" data-testid="status">{statusLine(props.c)}</div>
      {classicStake && st.hand!.status !== 'boot' && <div class="pot-stake">stake {fmt(st.hand!.stake)}</div>}
    </section>
  );
}

export { ArtStrip };
