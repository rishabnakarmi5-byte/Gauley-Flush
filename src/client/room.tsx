import { useEffect, useState } from 'preact/hooks';
import { allowedBets, settle } from '../engine';
import type { Player } from '../engine/types';
import type { PublicState } from '../shared/protocol';
import { Avatar, QR, Sheet, closeSheet, openSheet, roomLink, shareRoom } from './components';
import { fmt, nameOf, signed } from './format';
import { HowItWorks } from './screens';
import { act, addLocalPlayer, forgetRoom, setActive, toast } from './store';

export interface RoomCtx {
  st: PublicState;
  you: string[];
  connected: string[];
  active: string;
  me: Player;
  name: (id?: string) => string;
  hostLike: boolean;
  /** seat id to use as `by` for host-only actions (null if this device is not host-like) */
  hostBy: string | null;
  isHost: boolean;
  tablet: boolean;
}

export function makeCtx(st: PublicState, you: string[], connected: string[], activeSeat: string | undefined): RoomCtx | null {
  const active = activeSeat && you.includes(activeSeat) ? activeSeat : you[0];
  const me = st.players.find((p) => p.id === active);
  if (!active || !me) return null;
  const hostConnected = connected.includes(st.hostId);
  // "host-like" mirrors the engine: the host seat, or any player while the host is offline
  const hostBy = you.includes(st.hostId) ? st.hostId : !hostConnected ? active : null;
  return { st, you, connected, active, me, name: nameOf(st.players), hostLike: !!hostBy, hostBy, isHost: you.includes(st.hostId), tablet: you.length > 1 };
}

// ---------- settings ----------
export function SettingsForm(props: { c: RoomCtx }) {
  const { st } = props.c;
  const [boot, setBoot] = useState(String(st.settings.boot));
  const [maxBet, setMaxBet] = useState(String(st.settings.maxBet));
  const [chips, setChips] = useState(st.settings.chips.join(', '));
  useEffect(() => { setBoot(String(st.settings.boot)); setMaxBet(String(st.settings.maxBet)); setChips(st.settings.chips.join(', ')); }, [st.version === 0, st.settings.boot, st.settings.maxBet, st.settings.chips.join(',')]);
  const locked = !!st.hand || !props.c.hostLike;
  const save = () => {
    const chipList = chips.split(/[,\s]+/).filter(Boolean).map(Number);
    void act({ by: props.c.hostBy ?? undefined, type: 'settings', boot: Number(boot), maxBet: Number(maxBet), chips: chipList }).then((ok) => ok && toast('Rules saved', 'good'));
  };
  const digits = (set: (v: string) => void) => (e: Event) => set((e.target as HTMLInputElement).value.replace(/[^0-9]/g, ''));
  return (
    <div class="settings" data-testid="settings">
      <label class="field"><span>Boot amount (Rs)</span>
        <input data-testid="set-boot" inputMode="numeric" value={boot} disabled={locked} onInput={digits(setBoot)} /></label>
      <label class="field"><span>Chip presets (comma separated)</span>
        <input data-testid="set-chips" value={chips} disabled={locked} onInput={(e) => setChips((e.target as HTMLInputElement).value.replace(/[^0-9, ]/g, ''))} /></label>
      <label class="field"><span>Max single bet (Rs)</span>
        <input data-testid="set-max" inputMode="numeric" value={maxBet} disabled={locked} onInput={digits(setMaxBet)} /></label>
      {st.hand ? <p class="muted">Rules are locked while a hand is live.</p> : !props.c.hostLike ? <p class="muted">Only the host can change the rules.</p>
        : <button class="btn secondary" data-testid="save-settings" onClick={save}>Save rules</button>}
    </div>
  );
}

// ---------- players list (lobby + menu) ----------
export function PlayersList(props: { c: RoomCtx; manage?: boolean }) {
  const { c } = props;
  const st = c.st;
  return (
    <ul class="plist" data-testid="players">
      {st.players.map((p) => {
        const online = c.connected.includes(p.id);
        const inLive = !!st.hand && st.hand.boots.includes(p.id);
        return (
          <li key={p.id} class={p.left ? 'left' : ''} data-testid={`player-${p.name}`}>
            <Avatar p={p} size={34} />
            <div class="pname">
              <b>{p.name}</b>
              <small>
                {p.id === st.hostId ? 'host · ' : ''}{c.you.includes(p.id) ? (c.tablet ? 'this device · ' : 'you · ') : ''}
                {p.left ? 'left' : online ? 'online' : 'offline'}{p.classic ? ' · classic limits' : ''}
              </small>
            </div>
            {props.manage && !p.left && (
              <div class="pactions">
                {c.hostLike && p.id !== st.hostId && (
                  <button class="btn tiny ghost" onClick={() => act({ by: c.hostBy ?? undefined, type: 'transferHost', target: p.id })}>Make host</button>
                )}
                {(c.hostLike || c.you.includes(p.id)) && p.id !== st.hostId && (
                  <button class="btn tiny danger" disabled={inLive} title={inLive ? 'In a live hand' : ''}
                    onClick={() => { if (confirm(`Remove ${p.name}?${p.net !== 0 ? ' They will stay in the settlement as "left".' : ''}`)) void act({ by: c.you.includes(p.id) ? p.id : c.hostBy ?? undefined, type: 'removePlayer', target: p.id }); }}>
                    {c.you.includes(p.id) && p.id === c.active ? 'Leave' : 'Remove'}
                  </button>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function ClassicToggle(props: { c: RoomCtx }) {
  const { c } = props;
  return (
    <label class="toggle" data-testid="classic-toggle">
      <input type="checkbox" checked={c.me.classic} disabled={!!c.st.hand && c.st.hand.boots.includes(c.me.id)}
        onChange={(e) => void act({ type: 'setClassic', seat: c.active, on: (e.target as HTMLInputElement).checked })} />
      <span class="knob" />
      <span>Classic limits for {c.tablet ? c.me.name : 'me'} <small>(blind / seen)</small></span>
    </label>
  );
}

function AddLocal() {
  const [name, setName] = useState('');
  const add = async () => {
    if (!name.trim()) return;
    if (await addLocalPlayer(name.trim())) setName('');
  };
  return (
    <div class="addlocal">
      <input data-testid="add-local-name" placeholder="Add someone without a phone" value={name} maxLength={16}
        onInput={(e) => setName((e.target as HTMLInputElement).value)} onKeyDown={(e) => { if (e.key === 'Enter') void add(); }} />
      <button class="btn secondary" data-testid="add-local" onClick={add}>Add</button>
    </div>
  );
}

// ---------- lobby ----------
export function Lobby(props: { c: RoomCtx }) {
  const { c } = props;
  const st = c.st;
  const canDeal = c.hostLike;
  return (
    <div class="screen lobby">
      <div class="lobby-top">
        <div class="code-label">Table code</div>
        <div class="code-big" data-testid="room-code">{st.code}</div>
        <QR text={roomLink(st.code)} size={176} />
        <div class="link-row">
          <button class="btn ghost" data-testid="share" onClick={() => shareRoom(st.code)}>Share invite link</button>
        </div>
        <p class="muted small">Friends scan this or type the 4 letters on the home screen.</p>
      </div>

      <div class="card">
        <h3>At the table ({st.players.filter((p) => !p.left).length}/12)</h3>
        <PlayersList c={c} manage />
        {c.isHost && st.players.filter((p) => !p.left).length < 12 && <AddLocal />}
        <ClassicToggle c={c} />
      </div>

      <div class="card">
        <h3>House rules</h3>
        <SettingsForm c={c} />
      </div>

      <div class="lobby-cta">
        <button class="btn primary big" data-testid="deal" disabled={!canDeal || st.players.filter((p) => !p.left).length < 2}
          onClick={() => act({ by: c.hostBy ?? undefined, type: 'newHand' })}>
          {st.players.filter((p) => !p.left).length < 2 ? 'Waiting for a 2nd player…' : canDeal ? 'Deal the first hand' : 'Waiting for the host to deal'}
        </button>
        <button class="btn ghost" onClick={() => openSheet('how')}>How it works</button>
        <button class="btn ghost" onClick={() => { if (confirm('Leave this table?')) { void act({ type: 'removePlayer', target: c.active }).then(() => { forgetRoom(st.code); location.hash = '#/'; }); } }}>Leave table</button>
      </div>
    </div>
  );
}

// ---------- sheets ----------
export function HistorySheet(props: { c: RoomCtx }) {
  const { st, name } = props.c;
  const list = [...st.history].reverse();
  return (
    <Sheet title="Hand history" onClose={closeSheet} testid="history-sheet">
      {!list.length && <p class="muted">No hands finished yet. Deal one!</p>}
      {list.map((h) => (
        <details key={h.no + '-' + h.at} class="hist" data-testid="hist-row">
          <summary>
            <b>#{h.no}</b>{' '}
            {h.result === 'void' ? <span class="muted">voided, all refunded</span> : <span><b>{name(h.winner ?? undefined)}</b> won {fmt(h.pot)}{h.how === 'last' ? ' (last standing)' : ''}</span>}
          </summary>
          <ul>
            {h.participants.map((p) => (
              <li key={p.id}>{name(p.id)}{p.packed ? ' (packed)' : ''}<span>{h.result === 'void' ? '' : `put in ${fmt(p.contrib)}`}</span></li>
            ))}
          </ul>
        </details>
      ))}
      {st.hand && <p class="muted">Hand #{st.hand.no} is live. Pot {fmt(st.pot)}.</p>}
    </Sheet>
  );
}

export function MenuSheet(props: { c: RoomCtx }) {
  const { c } = props;
  const st = c.st;
  return (
    <Sheet title="Table menu" onClose={closeSheet} testid="menu-sheet">
      <section>
        <h3>Invite</h3>
        <div class="menu-qr"><QR text={roomLink(st.code)} size={150} />
          <div><div class="code-big small">{st.code}</div><button class="btn ghost" onClick={() => shareRoom(st.code)}>Share link</button></div></div>
      </section>
      <section>
        <h3>Players</h3>
        <PlayersList c={c} manage />
        {c.isHost && st.players.filter((p) => !p.left).length < 12 && <AddLocal />}
      </section>
      <section>
        <h3>My table settings</h3>
        <ClassicToggle c={c} />
      </section>
      <section>
        <h3>House rules</h3>
        <SettingsForm c={c} />
      </section>
      {c.hostLike && (
        <section>
          <h3>Host tools</h3>
          <div class="stack">
            {st.hand && <button class="btn danger" data-testid="void-hand" onClick={() => { if (confirm('Void this hand and refund everyone?')) { void act({ by: c.hostBy ?? undefined, type: 'voidHand' }); closeSheet(); } }}>Void this hand (refund all)</button>}
            {!st.hand && st.lastAward && <button class="btn secondary" data-testid="undo-award" onClick={() => { void act({ by: c.hostBy ?? undefined, type: 'undoAward' }); closeSheet(); }}>Undo last award ({fmt(st.lastAward.pot)} to {c.name(st.lastAward.winner)})</button>}
            {!st.hand && <button class="btn secondary" onClick={() => { void act({ by: c.hostBy ?? undefined, type: 'forceEnd' }); closeSheet(); }}>Force end game now</button>}
          </div>
        </section>
      )}
      <section>
        <button class="btn ghost" onClick={() => { closeSheet(); setTimeout(() => openSheet('how'), 0); }}>How it works</button>
        <button class="btn ghost" onClick={() => { if (confirm('Leave this table? Your balance stays on the ledger.')) { void act({ type: 'removePlayer', target: c.active }).then(() => { forgetRoom(st.code); location.hash = '#/'; }); } }}>Leave table</button>
      </section>
    </Sheet>
  );
}

export function HowSheet() {
  return <Sheet title="How it works" onClose={closeSheet} testid="how-sheet"><HowItWorks /></Sheet>;
}

// ---------- settle ----------
const DEV_QR = '/dev-qr.png';

export function Settle(props: { c: RoomCtx }) {
  const { c } = props;
  const st = c.st;
  const transfers = settle(st as any);
  const bal = (n: number) => (n > 0 ? 'up' : n < 0 ? 'down' : 'even');
  const myWinners = c.you.map((id) => st.players.find((p) => p.id === id)!).filter((p) => p && p.net > 0);
  return (
    <div class="screen settle">
      <h1>Settle up</h1>
      <p class="tagline">Game over. Here is who pays whom, in the fewest transfers.</p>

      <div class="card">
        <h3>Transfers</h3>
        {!transfers.length && <p class="muted" data-testid="all-square">Everyone is square. Rare. Suspicious. Beautiful.</p>}
        <ul class="transfers" data-testid="transfers">
          {transfers.map((t) => {
            const paid = !!st.paid[t.key];
            const mine = c.you.includes(t.from) ? t.from : c.you.includes(t.to) ? t.to : null;
            return (
              <li key={t.key} class={paid ? 'paid' : ''} data-testid="transfer">
                <div class="who"><b>{c.name(t.from)}</b> pays <b>{c.name(t.to)}</b></div>
                <div class="amt">{fmt(t.amount)}</div>
                <button class={`tick ${paid ? 'on' : ''}`} disabled={!mine} aria-pressed={paid} aria-label={paid ? 'Mark unpaid' : 'Mark paid'} data-testid="tick"
                  onClick={() => mine && act({ type: 'markPaid', by: mine, seat: mine, key: t.key, paid: !paid })}>
                  {paid ? '✓ Paid' : 'Paid?'}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div class="card">
        <h3>Final standings</h3>
        <ul class="standings">
          {[...st.players].sort((a, b) => b.net - a.net).map((p) => (
            <li key={p.id} data-testid={`final-${p.name}`}>
              <Avatar p={p} size={30} /><span class="n">{p.name}{p.left ? ' (left)' : ''}</span>
              {p.net === 0 ? <span class="square">square</span> : <span class={`net ${bal(p.net)}`}>{signed(p.net)}</span>}
            </li>
          ))}
        </ul>
      </div>

      {myWinners.map((p) => {
        const n = Math.max(1, Math.round(p.net * 0.05));
        const choice = st.thanks[p.id];
        return (
          <div class="card thanks" key={p.id} data-testid="thanks">
            {c.tablet && <div class="muted">For {p.name}</div>}
            {!choice && (
              <>
                <h3>Feeling generous?</h3>
                <p>Send 5% of your winnings ({fmt(n)}) to the developer as thanks?</p>
                <div class="row">
                  <button class="btn primary" data-testid="thanks-yes" onClick={() => act({ type: 'thanks', by: p.id, seat: p.id, choice: 'yes' })}>Yes, {fmt(n)}</button>
                  <button class="btn ghost" data-testid="thanks-no" onClick={() => act({ type: 'thanks', by: p.id, seat: p.id, choice: 'no' })}>Not now</button>
                </div>
                <p class="muted small">Totally optional. It does not change anyone's settlement.</p>
              </>
            )}
            {choice === 'yes' && (
              <>
                <h3>Dhanyabad!</h3>
                <p>Scan to send {fmt(n)}. You are a legend.</p>
                <img class="dev-qr" src={DEV_QR} alt="Developer payment QR" data-testid="dev-qr" />
                <button class="btn ghost" onClick={() => act({ type: 'thanks', by: p.id, seat: p.id, choice: 'no' })}>Actually, skip it</button>
              </>
            )}
            {choice === 'no' && (
              <>
                <p>No worries. Enjoy the winnings.</p>
                <button class="btn ghost" onClick={() => act({ type: 'thanks', by: p.id, seat: p.id, choice: 'yes' })}>Changed my mind</button>
              </>
            )}
          </div>
        );
      })}

      <div class="settle-actions">
        <button class="btn ghost" onClick={() => openSheet('history')}>Hand history</button>
        {c.hostLike && <button class="btn secondary" data-testid="reopen" onClick={() => act({ by: c.hostBy ?? undefined, type: 'reopen' })}>Reopen table (play on)</button>}
        <a class="btn ghost" href="#/" onClick={() => forgetRoom(st.code)}>Leave</a>
      </div>
    </div>
  );
}
