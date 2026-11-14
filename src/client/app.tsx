import { useEffect } from 'preact/hooks';
import { ConnBanner, Toasts, closeSheet } from './components';
import { Expired, Home, How, JoinForm, TabletSetup } from './screens';
import { HistorySheet, HowSheet, Lobby, MenuSheet, Settle, makeCtx } from './room';
import { Table } from './table';
import { forgetRoom, requestWake, useStore } from './store';
import { Spinner } from './components';

function Room(props: { code: string }) {
  const s = useStore();
  const { session, snap, sheet, closedReason } = s;
  useEffect(() => { void requestWake(); }, [props.code]);
  if (closedReason) return <Expired code={props.code} reason={closedReason} />;
  if (!session || !session.tokens.length) return <JoinForm code={props.code} />;
  if (!snap) {
    return (
      <div class="screen center-screen"><Spinner /><p class="muted">Finding your table {props.code}{'…'}</p>
        <a class="btn ghost" href="#/" onClick={() => forgetRoom(props.code)}>Cancel</a></div>
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
      {st.phase === 'settled' ? <Settle c={c} /> : st.handNo === 0 && !st.hand ? <Lobby c={c} /> : <Table c={c} />}
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
      {route.name === 'home' && <Home />}
      {route.name === 'tablet' && <TabletSetup />}
      {route.name === 'how' && <How />}
      {route.name === 'room' && route.code && <Room code={route.code} />}
      <Toasts />
    </>
  );
}
