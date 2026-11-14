import { useEffect, useRef } from 'preact/hooks';
import { useStore } from './store';

declare global { interface Window { google?: any } }

export interface GoogleProfile { credential: string; name?: string; picture?: string }

let loading: Promise<void> | null = null;
function loadGsi(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => { loading = null; reject(new Error('gsi')); };
      document.head.appendChild(s);
    });
  }
  return loading;
}

function decode(credential: string): { name?: string; picture?: string } {
  try {
    const p = credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(escape(atob(p)));
    const o = JSON.parse(json);
    return { name: o.name, picture: o.picture };
  } catch { return {}; }
}

/** Renders "Continue with Google" only when the server advertises a client id. */
export function GoogleButton(props: { onProfile: (p: GoogleProfile) => void }) {
  const { config } = useStore();
  const box = useRef<HTMLDivElement>(null);
  const id = config.googleClientId;
  useEffect(() => {
    if (!id) return;
    let dead = false;
    loadGsi().then(() => {
      if (dead || !box.current) return;
      window.google.accounts.id.initialize({
        client_id: id,
        callback: (r: { credential: string }) => props.onProfile({ credential: r.credential, ...decode(r.credential) }),
      });
      window.google.accounts.id.renderButton(box.current, { theme: 'filled_black', size: 'large', text: 'continue_with', shape: 'pill', width: 280 });
    }).catch(() => {});
    return () => { dead = true; };
  }, [id]);
  if (!id) return null;
  return <div class="google-wrap" data-testid="google-btn"><div ref={box} /></div>;
}
