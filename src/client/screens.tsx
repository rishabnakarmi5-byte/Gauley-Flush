import { useEffect, useState } from 'preact/hooks';
import { ArtBackdrop, Logo, Spinner, godArt } from './components';
import { IconArrow } from './icons';
import { GoogleButton, type GoogleProfile } from './google';
import { createTable, forgetRoom, joinTable, lastRoom, loadSession, roomInfo, savedName, toast, useStore } from './store';
import { WittyLine } from './witty';

export function HowItWorks() {
  const steps: [string, string][] = [
    ['Boot', 'Host taps New hand. Everyone taps Boot to put the boot amount in the pot, or sits out.'],
    ['Chaal', 'Once two or more have booted, anyone in the hand can bet any amount, any time. No turn police. Tap notes, then Chaal. After the first chaal, boot is closed.'],
    ['Pack', 'Folding forfeits what you put in. If only one player is left, they take the pot automatically.'],
    ['Show', 'Think you won? Tap I won. Any one other player from that hand taps Confirm and the pot is yours. Disagree? Reject and betting resumes.'],
    ['Mistakes happen', 'Undo your own latest chaal or pack. The host can void a hand (all refunded) or undo the last award until the next hand starts.'],
    ['Classic limits', 'Optional, per player. Blind players bet the stake or double. Seen players bet double or quadruple. Free-form is the default.'],
    ['End game', 'When everyone agrees, the app shows who pays whom with the fewest transfers. Tick each one off as the real money moves.'],
  ];
  return (
    <div class="how">
      <p class="lede">Gauley Flush is the <b>pot and the ledger</b>, nothing else. Deal with a real deck. The app never sees cards and never decides who wins. It only remembers the money, so nobody needs a pocketful of Rs 5 notes.</p>
      <ol>
        {steps.map(([h, t]) => <li key={h}><b>{h}</b><span>{t}</span></li>)}
      </ol>
      <p class="muted">Net numbers are live: jade is up, sindoor is down. Everything adds up to zero, always.</p>
    </div>
  );
}

export function How() {
  return (
    <div class="screen narrow">
      <Logo small />
      <h1>How it works</h1>
      <HowItWorks />
      <a class="btn text" href="#/">Back</a>
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
      <ArtBackdrop name={godArt('ganesh')} class="home-art" />
      <header class="hero">
        <Logo />
        <p class="tagline">The pot, the chaals and the hisab.<br />Real cards, zero Rs 5 notes.</p>
      </header>

      {resumeOk && (
        <a class="resume" href={`#/r/${resume}`} data-testid="resume">
          <span>Back to table <b class="code-inline">{resume}</b></span>
          <IconArrow size={20} />
        </a>
      )}

      <section class="stack">
        <label class="field">
          <span>Your name</span>
          <input data-testid="name-input" value={name} maxLength={16} autocomplete="off" placeholder="e.g. Bikash" onInput={(e) => setName((e.target as HTMLInputElement).value)} />
        </label>
        {config.googleClientId && <GoogleButton onProfile={gp} />}
        <button class="btn primary" data-testid="create" disabled={busy} onClick={create}>{busy ? <Spinner /> : 'Create a table'}</button>
      </section>

      <div class="or"><span>or join one</span></div>

      <section class="stack">
        <label class="field">
          <span>Table code</span>
          <input data-testid="code-input" class="code-input" value={code} maxLength={4} autocapitalize="characters" autocomplete="off" placeholder="ABCD"
            onInput={(e) => setCode((e.target as HTMLInputElement).value.replace(/[^A-Za-z]/g, '').toUpperCase())}
            onKeyDown={(e) => { if (e.key === 'Enter') join(); }} />
        </label>
        <button class="btn outline" data-testid="join" onClick={join}>Join table</button>
      </section>

      <WittyLine mood="home" class="home-witty" />

      <nav class="quiet-links">
        <a href="#/tablet" data-testid="tablet-mode">Tablet mode</a>
        <span aria-hidden="true">·</span>
        <a href="#/how">How it works</a>
      </nav>
      <footer class="legal">
        <a href="/privacy.html">Privacy</a><span aria-hidden="true">·</span><a href="/terms.html">Terms</a>
      </footer>
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
    <div class="screen narrow">
      <Logo small />
      <h1>Tablet mode</h1>
      <p class="lede">One device on the table runs everyone's seat. Add the players and pass it around. Friends with phones can still join by code.</p>
      <section class="stack">
        {names.map((n, i) => (
          <label class="field" key={i}>
            <span>Player {i + 1}{i === 0 ? ' (host)' : ''}</span>
            <input data-testid={`tablet-name-${i}`} value={n} maxLength={16} autocomplete="off" onInput={(e) => set(i, (e.target as HTMLInputElement).value)} />
          </label>
        ))}
        {names.length < 12 && <button class="btn text" onClick={() => setNames([...names, ''])}>+ Add another player</button>}
        <button class="btn primary" data-testid="tablet-start" disabled={busy} onClick={start}>{busy ? <Spinner /> : 'Start table'}</button>
      </section>
      <a class="btn text" href="#/">Back</a>
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
    <div class="screen narrow">
      <Logo small />
      <div class="eyebrow">Table</div>
      <h1 class="code-title"><span data-testid="join-code">{props.code}</span></h1>
      {props.note && <p class="lede">{props.note}</p>}
      {info && !info.exists && <p class="notice">No table with that code. Check the letters, or ask the host to read them out again.</p>}
      {info?.exists && info.full && <p class="notice">This table is full (12 players).</p>}
      {info?.exists && !info.full && (
        <section class="stack">
          <p class="muted">{info.players} {info.players === 1 ? 'player' : 'players'} at the table{info.phase === 'settled' ? ' (settled; ask the host to reopen)' : ''}.</p>
          <label class="field">
            <span>Your name</span>
            <input data-testid="join-name" value={name} maxLength={16} autocomplete="off" onInput={(e) => setName((e.target as HTMLInputElement).value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void go(google?.credential); }} />
          </label>
          <GoogleButton onProfile={gp} />
          <button class="btn primary" data-testid="join-go" disabled={busy} onClick={() => go(google?.credential)}>{busy ? <Spinner /> : 'Sit down'}</button>
        </section>
      )}
      {!info && <Spinner />}
      <a class="btn text" href="#/">Home</a>
    </div>
  );
}

export function Expired(props: { code: string; reason: string }) {
  return (
    <div class="screen narrow">
      <Logo small />
      <h1>Table closed</h1>
      <p class="lede">{props.reason}</p>
      <a class="btn primary" href="#/" onClick={() => forgetRoom(props.code)}>Back home</a>
    </div>
  );
}

// ---------- owner feedback page (#/feedback) ----------
interface Summary { lineId: string; lang: string; up: number; down: number }
interface Comment { lineId: string; lang: string; vote: string; text: string; at: number }

export function FeedbackAdmin() {
  const [key, setKey] = useState('');
  const [data, setData] = useState<{ summary: Summary[]; comments: Comment[] } | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const url = (extra = '') => `/api/feedback/export?key=${encodeURIComponent(key)}${extra}`;
  const load = async () => {
    setBusy(true); setErr('');
    try {
      const res = await fetch(url());
      if (!res.ok) { setErr(res.status === 404 ? 'That key did not work.' : 'Could not load feedback.'); setData(null); }
      else {
        const d = (await res.json()) as { summary: Summary[]; comments: Comment[] };
        d.summary.sort((a, b) => b.down - a.down || b.up - a.up);
        setData(d);
      }
    } catch { setErr('Network trouble. Try again.'); }
    setBusy(false);
  };
  const csv = async () => {
    const res = await fetch(url('&format=csv'));
    if (!res.ok) return setErr('Could not download.');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(await res.blob());
    a.download = 'gauley-feedback.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };
  const by = new Map<string, Comment[]>();
  for (const c of data?.comments ?? []) by.set(c.lineId, [...(by.get(c.lineId) ?? []), c]);
  return (
    <div class="screen narrow wide-admin">
      <Logo small />
      <h1>Line feedback</h1>
      {!data && (
        <section class="stack">
          <label class="field"><span>Owner key</span>
            <input data-testid="admin-key" type="password" autocomplete="off" value={key} onInput={(e) => setKey((e.target as HTMLInputElement).value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && key) void load(); }} /></label>
          {err && <p class="notice" data-testid="admin-error">{err}</p>}
          <button class="btn primary" data-testid="admin-load" disabled={!key || busy} onClick={load}>{busy ? <Spinner /> : 'Show feedback'}</button>
        </section>
      )}
      {data && (
        <>
          <div class="admin-actions">
            <span class="muted">{data.summary.length} lines rated</span>
            <button class="btn outline slim" data-testid="admin-csv" onClick={csv}>Download CSV</button>
          </div>
          {err && <p class="notice">{err}</p>}
          <ul class="fb-list" data-testid="admin-summary">
            {data.summary.map((s) => (
              <li key={s.lineId} data-testid="admin-row">
                <div class="fb-head">
                  <span><b>{s.lineId}</b> <small class="muted">{s.lang}</small></span>
                  <span class="fb-votes"><i class="jade">{s.up} up</i><i class="sindoor">{s.down} down</i></span>
                </div>
                {(by.get(s.lineId) ?? []).map((c, i) => <p class="fb-comment" key={i}><small class="muted">{c.vote}</small> {c.text}</p>)}
              </li>
            ))}
            {!data.summary.length && <li class="muted">Nothing yet.</li>}
          </ul>
        </>
      )}
      <a class="btn text" href="#/">Home</a>
    </div>
  );
}
