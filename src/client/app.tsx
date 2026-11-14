import type { ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';
import { ConnBanner, Toasts, closeSheet } from './components';
import { Expired, FeedbackAdmin, Home, How, JoinForm, TabletSetup } from './screens';
import { HistorySheet, HowSheet, Lobby, MenuSheet, Settle, makeCtx } from './room';
import { Table } from './table';
import { forgetRoom, requestWake, useStore } from './store';
import { Spinner } from './components';

/** remounts on a key change so the screen cross-fades and rises in (CSS .route) and its line art draws itself again */
function Fade(props: { k: string; children: ComponentChildren }) {
  return <div class="route" key={props.k}>{props.children}</div>;
}

function Room(props: { code: string }) {
  const s = useStore();
  const { session, snap, sheet, closedReason } = s;
  useEffect(() => { void requestWake(); }, [props.code]);
  if (closedReason) return <Expired code={props.code} reason={closedReason} />;
  if (!session || !session.tokens.length) return <JoinForm code={props.code} />;
  if (!snap) {
    return (
      <div class="screen narrow center-screen"><Spinner /><p class="muted">Finding your table {props.code}{'…'}</p>
        <a class="btn text" href="#/" onClick={() => forgetRoom(props.code)}>Cancel</a></div>
    );
  }
  const c = makeCtx(snap.state, snap.you, snap.connected, session.active);
  if (!c) {
    // our tokens were not accepted (seat removed, or table was reset): offer to sit down again
    return <JoinForm code={props.code} note="We could not find your old seat at this table." />;
  }
  const st = c.st;
  return (
    <>
      {st.phase === 'settled' ? <Fade k="settle"><Settle c={c} /></Fade> : st.handNo === 0 && !st.hand ? <Fade k="lobby"><Lobby c={c} /></Fade> : <Fade k="table"><Table c={c} /></Fade>}
      {sheet === 'history' && <HistorySheet c={c} />}
      {sheet === 'menu' && <MenuSheet c={c} />}
      {sheet === 'how' && <HowSheet />}
    </>
  );
}

export function App() {
  const { route } = useStore();
  useEffect(() => { closeSheet(); }, [route.name, route.code]);
  return (
    <>
      <ConnBanner />
      {route.name === 'home' && <Fade k="home"><Home /></Fade>}
      {route.name === 'tablet' && <Fade k="tablet"><TabletSetup /></Fade>}
      {route.name === 'how' && <Fade k="how"><How /></Fade>}
      {route.name === 'feedback' && <Fade k="feedback"><FeedbackAdmin /></Fade>}
      {route.name === 'room' && route.code && <Room code={route.code} />}
      <Toasts />
    </>
  );
}
