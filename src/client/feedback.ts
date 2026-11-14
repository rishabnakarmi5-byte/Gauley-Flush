// Per-device identity and the tiny client for POST /api/feedback. Votes are remembered in localStorage (always guarded).
const ls = {
  get(k: string): string | null { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

let memId = '';
export function deviceId(): string {
  const have = ls.get('gf:device');
  if (have && /^[A-Za-z0-9-]{8,64}$/.test(have)) return have;
  if (memId) return memId;
  let id: string;
  try { id = crypto.randomUUID(); } catch { id = `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`; }
  memId = id;
  ls.set('gf:device', id);
  return id;
}

export type Vote = 'up' | 'down';
export const getVote = (lineId: string): Vote | null => {
  const v = ls.get(`gf:vote:${lineId}`);
  return v === 'up' || v === 'down' ? v : null;
};
export const rememberVote = (lineId: string, v: Vote) => ls.set(`gf:vote:${lineId}`, v);

export async function sendFeedback(f: { lineId: string; lang: string; vote: Vote; text?: string }): Promise<boolean> {
  try {
    const res = await fetch('/api/feedback', {
      method: 'POST', headers: { 'content-type': 'application/json' }, keepalive: true,
      body: JSON.stringify({ ...f, deviceId: deviceId() }),
    });
    return res.ok;
  } catch { return false; }
}
