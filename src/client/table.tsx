import { useEffect, useRef, useState } from 'preact/hooks';
import { allowedBets } from '../engine';
import type { Player } from '../engine/types';
import { AnimatedNumber, Avatar, openSheet, shareRoom } from './components';
import { feedText, fmt, signed } from './format';
import { flyChips, haptic } from './fly';
import type { RoomCtx } from './room';
import { act, setActive, setPending, getState, useStore } from './store';

// ---------- top bar ----------
export function TopBar(props: { c: RoomCtx }) {
  const { c } = props;
  const { online } = useStore();
  return (
    <header class="topbar">
      <button class="code-pill" data-testid="code-pill" onClick={() => openSheet('menu')} aria-label="Table menu">
        <span class={`dot ${online ? 'on' : ''}`} /> {c.st.code}
      </button>
      <div class="top-title">{c.st.hand ? `Hand #${c.st.hand.no}` : c.st.handNo ? `${c.st.handNo} hand${c.st.handNo === 1 ? '' : 's'} played` : 'New table'}</div>
      <button class="icon-btn" data-testid="open-history" aria-label="Hand history" onClick={() => openSheet('history')}>{'⏱'}</button>
      <button class="icon-btn" data-testid="open-menu" aria-label="Menu" onClick={() => openSheet('menu')}>{'☰'}</button>
    </header>
  );
}

// ---------- pot ----------
function statusLine(c: RoomCtx): string {
  const { st } = c;
  const h = st.hand;
  if (!h) return st.endVote ? 'End-game vote in progress' : st.handNo ? 'Between hands. Chai time.' : 'Waiting to deal';
  if (h.status === 'boot') return `Boot stage · ${h.boots.length} in`;
  if (h.status === 'claimed') return `${c.name(h.claimBy ?? undefined)} claims the pot`;
  return `Betting open · ${h.boots.length - h.packed.length} in the hand`;
}

export function Pot(props: { c: RoomCtx }) {
  const { st } = props.c;
  const classicStake = st.hand && st.players.some((p) => p.classic && st.hand!.boots.includes(p.id));
  return (
    <div class="felt-center">
      <div class="pot" id="pot" data-testid="pot-wrap" key={st.hand?.no ?? 0}>
        <div class="pot-label">POT</div>
        <div class="pot-amount" data-testid="pot"><AnimatedNumber value={st.pot} /></div>
        <div class="pot-raw" data-testid="pot-raw" aria-hidden="true">{st.pot}</div>
        <div class="pot-status" data-testid="status">{statusLine(props.c)}</div>
        {classicStake && st.hand!.status !== 'boot' && <div class="pot-stake">stake {fmt(st.hand!.stake)}</div>}
      </div>
    </div>
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
  const cls = ['seat', bootable ? 'bootable' : '', mine ? 'mine' : '', selected ? 'selected' : '', inHand ? 'inhand' : '', packed ? 'packed' : '', p.left ? 'left' : '', !online && !p.left ? 'offline' : '', claimant ? 'claimant' : ''].join(' ');
  return (
    <div class={cls} data-seat={p.id} data-testid={`seat-${p.name}`} onClick={() => { if (mine && c.tablet) setActive(p.id); }}>
      <Avatar p={p} size={34} />
      <div class="seat-name">{p.id === c.st.hostId && <span title="host">{'\u265b'} </span>}{p.name}</div>
      <div class={`net ${p.net > 0 ? 'up' : p.net < 0 ? 'down' : 'even'}`} data-testid={`net-${p.name}`}>{signed(p.net)}</div>
      <div class="seat-tags">
        {mine && !c.tablet && <i class="you">you</i>}
        {p.left ? <i>left</i> : packed ? <i>packed</i> : inHand ? <i class="in">in{p.classic ? (seen ? ' \u00b7 seen' : ' \u00b7 blind') : ''}</i> : h ? <i>{h.sitOut.includes(p.id) ? 'sitting out' : 'waiting'}</i> : null}
        {!online && !p.left && <i class="off">offline</i>}
        {contrib > 0 && <i class="put">in for {fmt(contrib)}</i>}
      </div>
      {bootable && <button class="btn tiny primary seat-boot" data-testid={`seat-boot-${p.name}`} onClick={(e) => { e.stopPropagation(); void act({ type: 'boot', by: p.id, seat: p.id }); }}>Boot</button>}
    </div>
  );
}

export function Seats(props: { c: RoomCtx }) {
  return (
    <div class="seats" data-testid="seats">
      {props.c.st.players.map((p) => <Seat key={p.id} c={props.c} p={p} />)}
    </div>
  );
}

// ---------- feed ----------
export function Feed(props: { c: RoomCtx }) {
  const items = props.c.st.feed.slice(-4).reverse();
  return (
    <ul class="feed" data-testid="feed">
      {items.map((f, i) => <li key={f.id} class={i === 0 ? 'fresh' : ''}>{feedText(f, props.c.name)}</li>)}
      {!items.length && <li>Nothing yet. Someone has to boot first.</li>}
    </ul>
  );
}

// ---------- chip fly animation ----------
export function useFlyEffects(c: RoomCtx) {
  const last = useRef<number | null>(null);
  const feed = c.st.feed;
  useEffect(() => {
    const maxId = feed.length ? feed[feed.length - 1].id : 0;
    if (last.current === null) { last.current = maxId; return; }
    const fresh = feed.filter((f) => f.id > (last.current ?? 0));
    last.current = Math.max(last.current, maxId);
    const pot = document.getElementById('pot');
    for (const f of fresh) {
      const seat = f.by ? document.querySelector(`[data-seat="${f.by}"]`) : null;
      if (f.type === 'bet' || f.type === 'boot') flyChips(seat, pot, f.amount ?? 10, f.type === 'boot' ? 0 : 1);
      else if (f.type === 'win') flyChips(pot, seat, f.amount ?? 10, 2);
      else if (f.type === 'undo' && f.text === 'bet') flyChips(pot, seat, f.amount ?? 10, 3);
      if (f.type === 'win' && seat) { seat.classList.add('winner'); setTimeout(() => seat.classList.remove('winner'), 1800); }
    }
  }, [feed.length ? feed[feed.length - 1].id : 0]);
}

// ---------- action bar ----------
function chipClass(i: number) { return `chip chip-${i % 5}`; }

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
          {limits.map((n) => <button key={n} class="btn primary big" data-testid={`classic-${n}`} onClick={() => send(n)}>Chaal {fmt(n)}</button>)}
        </div>
      ) : (
        <>
          <div class="chips" data-testid="chips">
            {st.settings.chips.map((v, i) => (
              <button key={v} class={chipClass(i)} data-testid={`chip-${v}`} aria-label={`Add Rs ${v}`} onClick={() => { setPending(seat, amount + v); haptic(8); }}>
                <span>{v >= 1000 ? `${v / 1000}k` : v}</span>
              </button>
            ))}
          </div>
          <div class="amount-row">
            {typing ? (
              <input class="amount-input" data-testid="amount-input" inputMode="numeric" autoFocus value={amount ? String(amount) : ''} placeholder="Rs"
                onInput={(e) => setPending(seat, Number((e.target as HTMLInputElement).value.replace(/[^0-9]/g, '')) || 0)} />
            ) : (
              <div class="amount" data-testid="pending">{fmt(amount)}</div>
            )}
            <button class="btn tiny ghost" onClick={() => setTyping(!typing)} data-testid="type-toggle">{typing ? 'Chips' : 'Type'}</button>
            <button class="btn tiny ghost" data-testid="clear" disabled={!amount} onClick={() => setPending(seat, 0)}>Clear</button>
          </div>
          <button class="btn primary big chaal" data-testid="chaal" disabled={amount < 1 || amount > st.settings.maxBet} onClick={() => send(amount)}>
            {amount > st.settings.maxBet ? `Max bet is ${fmt(st.settings.maxBet)}` : amount ? `Chaal ${fmt(amount)}` : 'Pick chips to chaal'}
          </button>
        </>
      )}
      <div class="sec-row">
        <button class="btn danger" data-testid="pack" onClick={() => act({ type: 'pack', seat })}>Pack</button>
        {c.me.classic && !seen && <button class="btn secondary" data-testid="see" onClick={() => act({ type: 'seeCards', seat })}>See cards</button>}
        <button class="btn gold" data-testid="iwon" onClick={() => act({ type: 'claim', seat })}>I won</button>
        {canUndo && <button class="btn ghost" data-testid="undo" onClick={() => act({ type: 'undo', seat })}>Undo</button>}
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
          <button class="btn ghost" data-testid="cancel-end" onClick={() => act({ type: 'cancelEnd' })}>Not yet</button>
          {c.hostLike && <button class="btn danger" data-testid="force-end" onClick={() => act({ type: 'forceEnd', by: hostBy })}>Force end</button>}
        </div>
      </div>
    );
  } else if (!h) {
    body = (
      <div class="idle-bar">
        {c.hostLike
          ? <button class="btn primary big" data-testid="new-hand" disabled={st.players.filter((p) => !p.left).length < 2} onClick={() => act({ type: 'newHand', by: hostBy })}>New hand</button>
          : <div class="muted center">Waiting for {c.name(st.hostId)} to deal.</div>}
        <div class="sec-row">
          <button class="btn secondary" data-testid="end-game" onClick={() => act({ type: 'proposeEnd', seat })}>End game</button>
          {c.hostLike && st.lastAward && <button class="btn ghost" data-testid="undo-award-bar" onClick={() => act({ type: 'undoAward', by: hostBy })}>Undo last award</button>}
        </div>
      </div>
    );
  } else if (h.status === 'boot') {
    const bootOptions = !booted ? (
      <div class="boot-bar">
        <button class="btn primary big" data-testid="boot" onClick={() => act({ type: 'boot', seat })}>Boot {fmt(st.settings.boot)}</button>
        <button class="btn ghost" data-testid="sit-out" onClick={() => act({ type: 'sitOut', seat })}>{h.sitOut.includes(seat) ? 'Sitting out' : 'Sit out'}</button>
      </div>
    ) : h.boots.length >= 2 ? <BetPanel c={c} /> : <div class="muted center" data-testid="wait-boot">You are in. Waiting for one more player to boot{'…'}</div>;
    body = (
      <>
        {bootOptions}
        {c.hostLike && <div class="sec-row"><button class="btn ghost" data-testid="cancel-hand" onClick={() => act({ type: 'voidHand', by: hostBy })}>Cancel hand (refund boots)</button></div>}
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
          {canUndo && <button class="btn ghost" data-testid="undo" onClick={() => act({ type: 'undo', seat })}>Undo pack</button>}
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
          <button class="btn ghost" data-testid="withdraw" onClick={() => act({ type: 'withdrawClaim', seat })}>Withdraw claim</button>
        </div>
      );
    } else if (eligible) {
      body = (
        <div class="vote" data-testid="claim-answer">
          <p><b>{c.name(claimant)}</b> says they won {fmt(st.pot)}.</p>
          <div class="sec-row">
            <button class="btn primary big" data-testid="confirm" onClick={() => act({ type: 'confirmClaim', seat })}>Confirm</button>
            <button class="btn danger" data-testid="reject" onClick={() => act({ type: 'rejectClaim', seat })}>Reject</button>
          </div>
        </div>
      );
    } else {
      const otherSeat = c.tablet ? c.you.find((id) => h.boots.includes(id) && id !== claimant) : undefined;
      body = <div class="muted center" data-testid="claim-spectate">{c.tablet && otherSeat ? `Tap ${c.name(otherSeat)}'s seat to confirm or reject.` : 'A claim is pending. Only players from this hand can answer it.'}</div>;
    }
  }
  return (
    <div class={`actionbar ${online ? '' : 'offline'}`} data-testid="actionbar">
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
      <span class="gavel">{'⚖'}</span>
      <div><b>{props.c.name(h.claimBy ?? undefined)}</b> says <i>"I won"</i>. Pot {fmt(props.c.st.pot)} is on hold. Betting frozen.</div>
    </div>
  );
}

export function Table(props: { c: RoomCtx }) {
  const { c } = props;
  useFlyEffects(c);
  return (
    <div class={`screen table ${c.tablet ? 'tablet' : ''}`} data-testid="table-screen">
      <TopBar c={c} />
      <div class="table-grid">
        <div class="table-main scroll">
          <Pot c={c} />
          <ClaimBanner c={c} />
          <Seats c={c} />
          <Feed c={c} />
        </div>
        <ActionBar c={c} />
      </div>
    </div>
  );
}
