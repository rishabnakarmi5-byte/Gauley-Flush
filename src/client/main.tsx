import { render } from 'preact';
import { App } from './app';
import { startClient } from './store';
import './fonts.css';
import './styles.css';

render(<App />, document.getElementById('app')!);
startClient();

// block pinch / double-tap zoom on iOS
document.addEventListener('gesturestart', (e) => e.preventDefault());
let lastTouch = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTouch < 300 && (e.target as HTMLElement).closest('button, .seat, .tile')) e.preventDefault();
  lastTouch = now;
}, { passive: false });

if ('serviceWorker' in navigator && false) navigator.serviceWorker.register('/sw.js');
