import { useEffect, useRef, useState } from 'preact/hooks';
import { allowedBets } from '../engine';
import type { Player } from '../engine/types';
import { ART, Art } from './art';
import { ArtStrip, openSheet, pickArt } from './components';
import { IconHistory, IconMenu, IconScales } from './icons';
import { feedText, fmt, signed } from './format';
import { haptic } from './fly';
import type { LineMood } from './lines';
import { Money, isNoteValue } from './note';
import { buildFan } from './notes';
import { Pot, handMotif } from './pile';
import type { RoomCtx } from './room';
import { act, setActive, setPending, useStore } from './store';
import { WittyLine } from './witty';

// ---------- top bar ----------
export function TopBar(props: { c: RoomCtx }) {
  const { c } = props;
  const { online } = useStore();
  return (
    <header class="topbar">
      <button class="code-pill" data-testid="code-pill" onClick={() => openSheet('menu')} aria-label="Table menu">
        <span class={`dot ${online ? 'on' : ''}`} /> <span class="code-text">{c.st.code}</span>
      </button>
      <div class="top-title">{c.st.hand ? `Hand ${c.st.hand.no}` : c.st.handNo ? `${c.st.handNo} hand${c.st.handNo === 1 ? '' : 's'} played` : 'New table'}</div>
      <button class="icon-btn" data-testid="open-history" aria-label="Hand history" onClick={() => openSheet('history')}><IconHistory /></button>
      <button class="icon-btn" data-testid="open-menu" aria-label="Menu" onClick={() => openSheet('menu')}><IconMenu /></button>
    </header>
  );
}

// ---------- seats ----------
function Seat(props: { c: RoomCtx; p: Player }) {
  const { c, p } = props;
  const h = c.st.hand;
  const mine = c.you.includes(p.id);
  const inHand = !!h && h.boots.includes(p.id);
  const packed = !!h && h.packed.includes(p.id);
  const online = c.connected.includes(p.id);
  const contrib = h?.contrib[p.id] ?? 0;
  const seen = !!h && h.seen.includes(p.id);
  const claimant = h?.claimBy === p.id;
  const selected = c.tablet && c.active === p.id;
  const bootable = c.tablet && mine && h?.status === 'boot' && !inHand && !p.left;
  const lastFeed = c.st.feed[c.st.feed.length - 1];
  const won = !h && lastFeed?.type === 'win' && lastFeed.by === p.id;
  const cls = ['seat', bootable ? 'bootable' : '', mine ? 'mine' : '', selected ? 'selected' : '', inHand ? 'inhand' : '', packed ? 'packed' : '', p.left ? 'left' : '', !online && !p.left ? 'offline' : '', claimant ? 'claimant' : '', won ? 'winner' : ''].join(' ');
  const state = p.left ? 'left' : packed ? 'packed' : inHand ? `in${p.classic ? (seen ? ' \u00b7 seen' : ' \u00b7 blind') : ''}` : h ? (h.sitOut.includes(p.id) ? 'sat out' : 'waiting') : '';
  const meta = [p.id === c.st.hostId ? 'host' : '', mine && !c.tablet ? 'you' : '', claimant ? 'claims the pot' : '', state, !online && !p.left ? 'offline' : ''].filter(Boolean);
  return (
    <li class={cls} data-seat={p.id} data-testid={`seat-${p.name}`} onClick={() => { if (mine && c.tablet) setActive(p.id); }}>
      <div class="seat-who">
        <div class="seat-name">{p.name}</div>
        <div class="seat-meta">{meta.map((m, i) => <span key={m} class={m === 'you' ? 'you' : m === 'claims the pot' ? 'claim' : m.startsWith('in') ? 'in' : ''}>{i ? ' \u00b7 ' : ''}{m}</span>)}</div>
      </div>
      {bootable
        ? <button class="btn outline slim seat-boot" data-testid={`seat-boot-${p.name}`} onClick={(e) => { e.stopPropagation(); void act({ type: 'boot', by: p.id, seat: p.id }); }}>Boot</button>
        : <div class="seat-in" title="in this hand">{contrib > 0 ? fmt(contrib) : ''}</div>}
      <div class={`net ${p.net > 0 ? 'up' : p.net < 0 ? 'down' : 'even'}`} data-testid={`net-${p.name}`}>{signed(p.net)}</div>
    </li>
  );
}

export function Seats(props: { c: RoomCtx }) {
  return (
    <ul class="seats" data-testid="seats">
      {props.c.st.players.map((p) => <Seat key={p.id} c={props.c} p={p} />)}
    </ul>
  );
}

// ---------- feed ----------
export function Feed(props: { c: RoomCtx }) {
  const items = props.c.st.feed.slice(-3).reverse();
  return (
    <ul class="feed" data-testid="feed">
      {items.map((f, i) => <li key={f.id} class={i === 0 ? 'fresh' : ''}>{feedText(f, props.c.name)}</li>)}
      {!items.length && <li>Nothing yet. Someone has to boot first.</li>}
    </ul>
  );
}

function tableMood(c: RoomCtx): { mood: LineMood; trigger: string } {
  const st = c.st, h = st.hand;
  const last = st.feed[st.feed.length - 1];
  let evt = 0;
  for (let i = st.feed.length - 1; i >= 0; i--) if (st.feed[i].type === 'pack' || st.feed[i].type === 'win') { evt = st.feed[i].id; break; }
  let mood: LineMood = 'bet';
  if (!h) mood = last?.type === 'win' ? 'win' : 'any';
  else if (h.status === 'boot') mood = 'boot';
  else if (last?.type === 'pack') mood = 'pack';
  return { mood, trigger: `${mood}:${evt}` };
}

// ---------- action bar ----------

function PendingFan(props: { amount: number }) {
  const pieces = props.amount > 0 ? buildFan(props.amount, 6) : [];
  return (
    <div class="fan" aria-hidden="true">
      {pieces.map((p, i) => (
        <div key={`${p.value}.${i}`} class={`fan-piece ${p.value <= 2 ? 'is-coin' : ''}`}
          style={{ '--i': i, '--n': pieces.length, '--r': `${(i - (pieces.length - 1) / 2) * 7 + p.rot * 0.12}deg` } as never}>
          <Money value={p.value} qty={p.qty} />
        </div>
      ))}
    </div>
  );
}

function BetPanel(props: { c: RoomCtx }) {
  const { c } = props;
  const { pending } = useStore();
  const st = c.st;
  const h = st.hand!;
  const seat = c.active;
  const amount = pending[seat] ?? 0;
  const [typing, setTyping] = useState(false);
  const limits = allowedBets(st as any, seat);
  const seen = h.seen.includes(seat);
  const send = async (n: number) => {
    setPending(seat, 0);
    const ok = await act({ type: 'bet', seat, amount: n });
    if (ok) haptic(); else setPending(seat, n);
  };
  const lastEntry = h.log[h.log.length - 1];
  const canUndo = h.status === 'betting' && lastEntry && lastEntry.by === seat && lastEntry.type !== 'boot';

  return (
    <div class="bet-panel" data-testid="bet-panel">
      {c.me.classic && (
        <div class="blindseen" data-testid="blindseen">
          <span class={`pill ${seen ? 'seen' : 'blind'}`}>{seen ? 'SEEN' : 'BLIND'}</span>
          <span class="muted">classic limits{limits ? ` · allowed ${limits.map(fmt).join(' / ')}` : ''}</span>
        </div>
      )}
      {limits ? (
        <div class="classic-bets">
          {limits.map((n) => <button key={n} class="btn primary" data-testid={`classic-${n}`} onClick={() => send(n)}>Chaal {fmt(n)}</button>)}
        </div>
      ) : (
        <>
          <div class="tiles" data-testid="chips">
            {st.settings.chips.map((v) => (
              <button key={v} class={`tile ${isNoteValue(v) || v <= 2 ? 'has-note' : 'plain'}`} data-testid={`chip-${v}`} aria-label={`Add Rs ${v}`}
                onClick={() => { setPending(seat, amount + v); haptic(8); }}>
                {isNoteValue(v) || v === 1 || v === 2 ? <Money value={v} /> : <span class="tile-num">{v.toLocaleString('en-IN')}</span>}
              </button>
            ))}
          </div>
          <div class="amount-row">
            <PendingFan amount={amount} />
            {typing ? (
              <input class="amount-input" data-testid="amount-input" inputMode="numeric" autoFocus value={amount ? String(amount) : ''} placeholder="Rs"
                onInput={(e) => setPending(seat, Number((e.target as HTMLInputElement).value.replace(/[^0-9]/g, '')) || 0)} />
            ) : (
              <div class="amount" data-testid="pending">{fmt(amount)}</div>
            )}
            <button class="btn text slim" onClick={() => setTyping(!typing)} data-testid="type-toggle">{typing ? 'Notes' : 'Type'}</button>
            <button class="btn text slim" data-testid="clear" disabled={!amount} onClick={() => setPending(seat, 0)}>Clear</button>
          </div>
          <button class="btn primary chaal" data-testid="chaal" disabled={amount < 1 || amount > st.settings.maxBet} onClick={() => send(amount)}>
            {amount > st.settings.maxBet ? `Max bet is ${fmt(st.settings.maxBet)}` : amount ? `Chaal ${fmt(amount)}` : 'Pick notes to chaal'}
          </button>
        </>
      )}
      <div class="sec-row">
        <button class="btn text danger" data-testid="pack" onClick={() => act({ type: 'pack', seat })}>Pack</button>
        {c.me.classic && !seen && <button class="btn text" data-testid="see" onClick={() => act({ type: 'seeCards', seat })}>See cards</button>}
        <button class="btn text gold" data-testid="iwon" onClick={() => act({ type: 'claim', seat })}>I won</button>
        {canUndo && <button class="btn text" data-testid="undo" onClick={() => act({ type: 'undo', seat })}>Undo</button>}
      </div>
    </div>
  );
}

export function ActionBar(props: { c: RoomCtx }) {
  const { c } = props;
  const { online } = useStore();
  const st = c.st;
  const h = st.hand;
  const seat = c.active;
  const me = c.me;
  const booted = !!h && h.boots.includes(seat);
  const packed = !!h && h.packed.includes(seat);
  const who = c.tablet ? <div class="acting" data-testid="acting">Acting as <b>{me.name}</b>{c.tablet ? <small> (tap a seat to switch)</small> : null}</div> : null;
  const hostBy = c.hostBy ?? undefined;
  const barRef = useRef<HTMLDivElement>(null);
  // let toasts sit just above the bar instead of covering the pot or the code
  useEffect(() => {
    const el = barRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const set = () => document.documentElement.style.setProperty('--bar-h', `${el.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => { ro.disconnect(); document.documentElement.style.removeProperty('--bar-h'); };
  }, []);

  let body;
  if (st.endVote && !h) {
    const v = st.endVote;
    const agreed = v.agree.includes(seat);
    const mineLeft = c.you.filter((id) => !v.agree.includes(id));
    body = (
      <div class="vote" data-testid="endvote">
        <p><b>{c.name(v.by)}</b> wants to end the game. {v.agree.length} of {st.players.filter((p) => !p.left).length} agree.</p>
        <div class="sec-row">
          {!agreed || mineLeft.length ? <button class="btn primary" data-testid="agree-end" onClick={async () => { for (const id of mineLeft) await act({ type: 'agreeEnd', by: id, seat: id }); }}>{c.tablet ? 'We all agree' : 'I agree'}</button> : <span class="muted">You agreed. Waiting for the others.</span>}
          <button class="btn text" data-testid="cancel-end" onClick={() => act({ type: 'cancelEnd' })}>Not yet</button>
          {c.hostLike && <button class="btn text danger" data-testid="force-end" onClick={() => act({ type: 'forceEnd', by: hostBy })}>Force end</button>}
        </div>
      </div>
    );
  } else if (!h) {
    body = (
      <div class="idle-bar">
        {c.hostLike
          ? <button class="btn primary" data-testid="new-hand" disabled={st.players.filter((p) => !p.left).length < 2} onClick={() => act({ type: 'newHand', by: hostBy })}>New hand</button>
          : <div class="muted center">Waiting for {c.name(st.hostId)} to deal.</div>}
        <div class="sec-row">
          <button class="btn outline" data-testid="end-game" onClick={() => act({ type: 'proposeEnd', seat })}>End game</button>
          {c.hostLike && st.lastAward && <button class="btn text" data-testid="undo-award-bar" onClick={() => act({ type: 'undoAward', by: hostBy })}>Undo last award</button>}
        </div>
      </div>
    );
  } else if (h.status === 'boot') {
    const bootOptions = !booted ? (
      <div class="boot-bar">
        <button class="btn primary" data-testid="boot" onClick={() => act({ type: 'boot', seat })}>Boot {fmt(st.settings.boot)}</button>
        <button class="btn text" data-testid="sit-out" onClick={() => act({ type: 'sitOut', seat })}>{h.sitOut.includes(seat) ? 'Sitting out' : 'Sit out'}</button>
      </div>
    ) : h.boots.length >= 2 ? <BetPanel c={c} /> : <div class="muted center" data-testid="wait-boot">You are in. Waiting for one more player to boot{'…'}</div>;
    body = (
      <>
        {bootOptions}
        {c.hostLike && <div class="sec-row"><button class="btn text" data-testid="cancel-hand" onClick={() => act({ type: 'voidHand', by: hostBy })}>Cancel hand (refund boots)</button></div>}
      </>
    );
  } else if (h.status === 'betting') {
    if (booted && !packed) body = <BetPanel c={c} />;
    else {
      const lastEntry = h.log[h.log.length - 1];
      const canUndo = booted && packed && lastEntry && lastEntry.by === seat && lastEntry.type === 'pack';
      body = (
        <div class="idle-bar">
          <div class="muted center">{packed ? 'You packed. Watch the drama.' : 'You are out of this hand. You will boot in next time.'}</div>
          {canUndo && <button class="btn text" data-testid="undo" onClick={() => act({ type: 'undo', seat })}>Undo pack</button>}
        </div>
      );
    }
  } else {
    const claimant = h.claimBy!;
    const eligible = h.boots.includes(seat) && seat !== claimant;
    if (seat === claimant) {
      body = (
        <div class="vote" data-testid="claim-wait">
          <p>Waiting for another player from this hand to confirm {'…'}</p>
          <button class="btn text" data-testid="withdraw" onClick={() => act({ type: 'withdrawClaim', seat })}>Withdraw claim</button>
        </div>
      );
    } else if (eligible) {
      body = (
        <div class="vote" data-testid="claim-answer">
          <p><b>{c.name(claimant)}</b> says they won {fmt(st.pot)}.</p>
          <div class="sec-row">
            <button class="btn primary" data-testid="confirm" onClick={() => act({ type: 'confirmClaim', seat })}>Confirm</button>
            <button class="btn text danger" data-testid="reject" onClick={() => act({ type: 'rejectClaim', seat })}>Reject</button>
          </div>
        </div>
      );
    } else {
      const otherSeat = c.tablet ? c.you.find((id) => h.boots.includes(id) && id !== claimant) : undefined;
      body = <div class="muted center" data-testid="claim-spectate">{c.tablet && otherSeat ? `Tap ${c.name(otherSeat)}'s seat to confirm or reject.` : 'A claim is pending. Only players from this hand can answer it.'}</div>;
    }
  }
  return (
    <div class={`actionbar ${online ? '' : 'offline'}`} data-testid="actionbar" ref={barRef}>
      <fieldset class="bar-fields" disabled={!online}>
        {who}
        {body}
      </fieldset>
    </div>
  );
}

export function ClaimBanner(props: { c: RoomCtx }) {
  const h = props.c.st.hand;
  if (!h || h.status !== 'claimed') return null;
  return (
    <div class="claim-banner" data-testid="claim-banner">
      <IconScales size={20} />
      <div><b>{props.c.name(h.claimBy ?? undefined)}</b> says <i>"I won"</i>. Pot {fmt(props.c.st.pot)} is on hold. Betting frozen.</div>
    </div>
  );
}

export function Table(props: { c: RoomCtx }) {
  const { c } = props;
  const { mood, trigger } = tableMood(c);
  const motif = handMotif(c.st.hand?.no ?? c.st.handNo);
  const strip = pickArt(ART.culture, 'dhaka', 'prayer-flags');
  useEffect(() => { document.body.classList.add('on-table'); return () => document.body.classList.remove('on-table'); }, []);
  return (
    <div class={`screen table ${c.tablet ? 'tablet' : ''}`} data-testid="table-screen">
      <TopBar c={c} />
      <ArtStrip name={strip} class="table-strip" />
      <div class="table-grid">
        <div class="table-main scroll">
          <Art name={motif} class="watermark" key={motif} draw />
          <Pot c={c} />
          <WittyLine mood={mood} trigger={trigger} class="table-witty" />
          <ClaimBanner c={c} />
          <Seats c={c} />
          <Feed c={c} />
        </div>
        <ActionBar c={c} />
      </div>
    </div>
  );
}
