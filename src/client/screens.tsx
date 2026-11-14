import { useEffect, useState } from 'preact/hooks';
import { Logo, Spinner } from './components';
import { GoogleButton, type GoogleProfile } from './google';
import { createTable, forgetRoom, joinTable, lastRoom, loadSession, roomInfo, savedName, toast, useStore } from './store';

export function HowItWorks() {
  return (
    <div class="how">
      <p>Gauley Flush is the <b>pot and the ledger</b>, nothing else. Deal with a real deck. The app never sees cards and never decides who wins. It only remembers the money so nobody needs Rs 5 notes.</p>
      <ol>
        <li><b>Boot.</b> Host taps <i>New hand</i>. Everyone taps <i>Boot</i> to throw the boot amount into the pot, or sits out.</li>
        <li><b>Chaal.</b> Once two or more have booted, anyone in the hand can bet any amount, any time. No turn police. Tap chips, then <i>Chaal</i>. Once the first chaal lands, boot is closed.</li>
        <li><b>Pack.</b> Folding forfeits what you put in. If only one player is left, they take the pot automatically.</li>
        <li><b>Show.</b> Think you won? Tap <i>I won</i>. Any one other player from that hand taps <i>Confirm</i> and the pot is yours. Disagree? <i>Reject</i> and betting resumes.</li>
        <li><b>Mistakes happen.</b> Undo your own latest chaal or pack. The host can void a hand (all refunded) or undo the last award until the next hand starts.</li>
        <li><b>Classic limits</b> (optional, per player). Blind players bet the stake or double. Seen players bet double or quadruple. Free-form is the default.</li>
        <li><b>End game.</b> When everyone agrees, the app shows who pays whom with the fewest transfers. Tick each one off as the real money moves (eSewa, Fonepay, cash, whatever).</li>
      </ol>
      <p class="muted">Net numbers are live: green is up, red is down. Everything adds up to zero, always.</p>
    </div>
  );
}

export function How() {
  return (
    <div class="screen center-screen">
      <Logo />
      <h1>How it works</h1>
      <div class="card"><HowItWorks /></div>
      <a class="btn ghost" href="#/">Back</a>
    </div>
  );
}

export function Home() {
  const { config } = useStore();
  const [name, setName] = useState(savedName());
  const [code, setCode] = useState('');
  const [google, setGoogle] = useState<GoogleProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const resume = lastRoom();
  const resumeOk = resume && loadSession(resume);

  const create = async () => {
    if (!name.trim()) return toast('Pick a name first. Even "Chacha" works.', 'error');
    setBusy(true);
    try { await createTable(name.trim(), google?.credential); } catch (e) { toast((e as Error).message, 'error'); }
    setBusy(false);
  };
  const join = () => {
    if (!/^[A-Za-z]{4}$/.test(code)) return toast('Table codes are 4 letters.', 'error');
    location.hash = `#/r/${code.toUpperCase()}`;
  };
  const gp = (p: GoogleProfile) => { setGoogle(p); if (p.name) setName(p.name.slice(0, 16)); toast('Signed in. Your seat will follow you across devices.', 'good'); };

  return (
    <div class="screen home">
      <Logo />
      <p class="tagline">The pot, the chaals and the hisab. Real cards, zero Rs 5 notes.</p>

      {resumeOk && (
        <a class="card resume" href={`#/r/${resume}`} data-testid="resume">
          <span>Back to table <b class="code-inline">{resume}</b></span>
          <span class="arrow">{'→'}</span>
        </a>
      )}

      <div class="card">
        <label class="field">
          <span>Your name</span>
          <input data-testid="name-input" value={name} maxLength={16} autocomplete="off" placeholder="e.g. Bikash" onInput={(e) => setName((e.target as HTMLInputElement).value)} />
        </label>
        {config.googleClientId && <GoogleButton onProfile={gp} />}
        <button class="btn primary big" data-testid="create" disabled={busy} onClick={create}>{busy ? <Spinner /> : 'Create a table'}</button>
      </div>

      <div class="card">
        <label class="field">
          <span>Got a code?</span>
          <input data-testid="code-input" class="code-input" value={code} maxLength={4} autocapitalize="characters" autocomplete="off" placeholder="ABCD"
            onInput={(e) => setCode((e.target as HTMLInputElement).value.replace(/[^A-Za-z]/g, '').toUpperCase())}
            onKeyDown={(e) => { if (e.key === 'Enter') join(); }} />
        </label>
        <button class="btn secondary big" data-testid="join" onClick={join}>Join table</button>
      </div>

      <div class="row-links">
        <a class="btn ghost" href="#/tablet" data-testid="tablet-mode">Tablet mode (one device, everyone)</a>
        <a class="btn ghost" href="#/how">How it works</a>
      </div>
    </div>
  );
}

export function TabletSetup() {
  const [names, setNames] = useState<string[]>(['', '', '']);
  const [busy, setBusy] = useState(false);
  const set = (i: number, v: string) => setNames(names.map((n, j) => (j === i ? v : n)));
  const start = async () => {
    const list = names.map((n) => n.trim()).filter(Boolean);
    if (list.length < 2) return toast('You need at least two players.', 'error');
    if (new Set(list.map((n) => n.toLowerCase())).size !== list.length) return toast('Two players share a name. Add an initial?', 'error');
    setBusy(true);
    try { await createTable(list[0], undefined, { tablet: true, pendingNames: list.slice(1) }); }
    catch (e) { toast((e as Error).message, 'error'); }
    setBusy(false);
  };
  return (
    <div class="screen home">
      <Logo small />
      <h1>Tablet mode</h1>
      <p class="tagline">One device on the table runs everyone's seat. Add the players, pass it around. Friends with phones can still join by code.</p>
      <div class="card">
        {names.map((n, i) => (
          <label class="field" key={i}>
            <span>Player {i + 1}{i === 0 ? ' (host)' : ''}</span>
            <input data-testid={`tablet-name-${i}`} value={n} maxLength={16} autocomplete="off" onInput={(e) => set(i, (e.target as HTMLInputElement).value)} />
          </label>
        ))}
        {names.length < 12 && <button class="btn ghost" onClick={() => setNames([...names, ''])}>+ Add another player</button>}
        <button class="btn primary big" data-testid="tablet-start" disabled={busy} onClick={start}>{busy ? <Spinner /> : 'Start table'}</button>
      </div>
      <a class="btn ghost" href="#/">Back</a>
    </div>
  );
}

export function JoinForm(props: { code: string; note?: string }) {
  const [name, setName] = useState(savedName());
  const [google, setGoogle] = useState<GoogleProfile | null>(null);
  const [info, setInfo] = useState<{ exists: boolean; players?: number; full?: boolean; phase?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { roomInfo(props.code).then(setInfo).catch(() => setInfo({ exists: false })); }, [props.code]);
  const go = async (credential?: string) => {
    if (!credential && !name.trim()) return toast('Type your name first.', 'error');
    setBusy(true);
    try { await joinTable(props.code, name.trim(), credential); } catch (e) { toast((e as Error).message, 'error'); }
    setBusy(false);
  };
  const gp = async (p: GoogleProfile) => { setGoogle(p); if (p.name) setName(p.name.slice(0, 16)); await go(p.credential); };
  return (
    <div class="screen home">
      <Logo small />
      <h1>Table <span class="code-inline" data-testid="join-code">{props.code}</span></h1>
      {props.note && <p class="tagline">{props.note}</p>}
      {info && !info.exists && <div class="card warn">No table with that code. Check the letters, or ask the host to read them out again.<a class="btn ghost" href="#/">Home</a></div>}
      {info?.exists && info.full && <div class="card warn">This table is full (12 players).</div>}
      {info?.exists && !info.full && (
        <div class="card">
          <p class="muted">{info.players} {info.players === 1 ? 'player' : 'players'} at the table{info.phase === 'settled' ? ' (settled; ask the host to reopen)' : ''}.</p>
          <label class="field">
            <span>Your name</span>
            <input data-testid="join-name" value={name} maxLength={16} autocomplete="off" onInput={(e) => setName((e.target as HTMLInputElement).value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void go(google?.credential); }} />
          </label>
          <GoogleButton onProfile={gp} />
          <button class="btn primary big" data-testid="join-go" disabled={busy} onClick={() => go(google?.credential)}>{busy ? <Spinner /> : 'Sit down'}</button>
        </div>
      )}
      {!info && <Spinner />}
      <a class="btn ghost" href="#/">Home</a>
    </div>
  );
}

export function Expired(props: { code: string; reason: string }) {
  return (
    <div class="screen center-screen">
      <Logo small />
      <div class="card warn">
        <h2>Table closed</h2>
        <p>{props.reason}</p>
        <a class="btn primary" href="#/" onClick={() => forgetRoom(props.code)}>Back home</a>
      </div>
    </div>
  );
}
