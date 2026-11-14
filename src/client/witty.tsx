import { useEffect, useRef, useState } from 'preact/hooks';
import { LINES, type Line, type LineMood } from './lines';
import { Sheet, reducedMotion } from './components';
import { IconThumbDown, IconThumbUp } from './icons';
import { getVote, rememberVote, sendFeedback, type Vote } from './feedback';
import { toast } from './store';

const ROTATE_MS = 40_000;

/** the pool for a mood: lines of that mood, topped up with 'any' when there are only a few, 'any' alone as the fallback */
function poolFor(mood: LineMood): Line[] {
  const own = LINES.filter((l) => l.mood === mood);
  const any = LINES.filter((l) => l.mood === 'any');
  if (!own.length) return any.length ? any : LINES;
  return own.length < 4 ? [...own, ...any] : own;
}

const used = new Map<string, Set<string>>();
/** random pick that never repeats until the pool is exhausted, then starts over (but not with the line just shown) */
export function pickLine(mood: LineMood, avoid?: string): Line | null {
  const pool = poolFor(mood);
  if (!pool.length) return null;
  let seen = used.get(mood);
  if (!seen) { seen = new Set(); used.set(mood, seen); }
  let fresh = pool.filter((l) => !seen!.has(l.id) && l.id !== avoid);
  if (!fresh.length) { seen.clear(); fresh = pool.filter((l) => l.id !== avoid); if (!fresh.length) fresh = pool; }
  const line = fresh[Math.floor(Math.random() * fresh.length)];
  seen.add(line.id);
  return line;
}

const scriptOf = (s: string) => (/[ऀ-ॿ]/.test(s) ? 'deva' : /[ༀ-࿿]/.test(s) ? 'tib' : 'latn');

type View = 0 | 1 | 2;
const VIEW_LABEL = (l: Line, v: View) => (v === 0 ? l.lang : v === 1 ? `${l.lang} · romanised` : 'English');

export function WittyLine(props: { mood: LineMood; trigger?: unknown; class?: string }) {
  const { mood } = props;
  const [line, setLine] = useState<Line | null>(() => pickLine(mood));
  const [view, setView] = useState<View>(0);
  const [vote, setVote] = useState<Vote | null>(() => (line ? getVote(line.id) : null));
  const [sheet, setSheet] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  const lineRef = useRef(line);
  lineRef.current = line;

  const swap = (fn: () => void) => {
    const el = box.current;
    if (!el || reducedMotion() || typeof el.animate !== 'function') { fn(); return; }
    el.getAnimations().forEach((a) => a.cancel());
    const out = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, easing: 'ease-out', fill: 'forwards' });
    out.onfinish = () => {
      fn();
      el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, easing: 'cubic-bezier(.2,.9,.25,1.05)', fill: 'both' });
    };
  };
  const next = () => swap(() => {
    const l = pickLine(mood, lineRef.current?.id);
    setLine(l); setView(0); setVote(l ? getVote(l.id) : null);
  });

  // rotate on a timer, and straight away when the context (mood / event) changes
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    next();
  }, [mood, props.trigger]);
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') next(); }, ROTATE_MS);
    return () => clearInterval(t);
  }, [mood]);

  if (!line) return null;
  const text = view === 0 ? line.script : view === 1 ? line.roman : line.en;
  const sc = view === 0 ? scriptOf(line.script) : 'latn';
  const cast = (v: Vote) => {
    setVote(v);
    rememberVote(line.id, v);
    void sendFeedback({ lineId: line.id, lang: line.lang, vote: v });
    if (v === 'down') setSheet(true);
  };

  return (
    <div class={`witty ${props.class ?? ''}`} data-testid="witty" data-line={line.id}>
      <div class="witty-main" ref={box}>
        <button class="witty-text" data-testid="witty-text" data-view={view} onClick={() => setView(((view + 1) % 3) as View)} aria-label="Tap to translate">
          <span class="witty-label">{VIEW_LABEL(line, view)}</span>
          <span class={`witty-copy s-${sc}`} data-testid="witty-copy">{text}</span>
        </button>
      </div>
      <div class="witty-votes">
        <button class={`icon-btn thumb ${vote === 'up' ? 'on up' : ''}`} data-testid="witty-up" aria-pressed={vote === 'up'} aria-label="Good line" onClick={() => cast('up')}><IconThumbUp size={19} filled={vote === 'up'} /></button>
        <button class={`icon-btn thumb ${vote === 'down' ? 'on down' : ''}`} data-testid="witty-down" aria-pressed={vote === 'down'} aria-label="Something is off" onClick={() => cast('down')}><IconThumbDown size={19} filled={vote === 'down'} /></button>
      </div>
      {sheet && <FeedbackSheet line={line} onClose={() => setSheet(false)} />}
    </div>
  );
}

function FeedbackSheet(props: { line: Line; onClose: () => void }) {
  const { line } = props;
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    const ok = await sendFeedback({ lineId: line.id, lang: line.lang, vote: 'down', text: text.trim() });
    setBusy(false);
    toast(ok ? 'Thanks, noted.' : 'Could not send that. Try again later.', ok ? 'good' : 'error');
    if (ok) props.onClose();
  };
  return (
    <Sheet title="What's off?" onClose={props.onClose} testid="feedback-sheet">
      <blockquote class={`fb-quote s-${scriptOf(line.script)}`}>{line.script}<small>{line.en}</small></blockquote>
      <label class="field">
        <span>Tell us (optional)</span>
        <textarea data-testid="feedback-text" rows={4} maxLength={300} value={text} placeholder="Wrong word, grammar, not funny…"
          onInput={(e) => setText((e.target as HTMLTextAreaElement).value)} />
        <em class="count">{text.length}/300</em>
      </label>
      <button class="btn primary" data-testid="feedback-send" disabled={busy} onClick={send}>Send</button>
      <button class="btn text" onClick={props.onClose}>Skip</button>
    </Sheet>
  );
}
