// Pure helpers for the feedback Durable Object (kept free of `cloudflare:workers` so vitest can import them).
export const MAX_ROWS = 20_000;
export const MAX_PER_DEVICE = 500;
export const MAX_TEXT = 300;
export const MAX_LINE_ID = 40;
/** rate limits (per rolling minute): per device, per client IP and for the whole table */
export const RATE = { device: 20, ip: 40, global: 300 };

export interface FeedbackInput { lineId: string; lang: string; vote: 'up' | 'down'; text: string; deviceId: string }

/** drop control characters (keeps newlines out too) and collapse whitespace */
export function cleanText(s: string, max: number): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029\u200b\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

/** validate a POST body. Returns the clean input or an error message. */
export function parseFeedback(raw: unknown): FeedbackInput | string {
  if (!raw || typeof raw !== 'object') return 'Bad body.';
  const b = raw as Record<string, unknown>;
  if (typeof b.lineId !== 'string') return 'lineId required.';
  const lineId = cleanText(b.lineId, 200);
  if (!lineId || lineId.length > MAX_LINE_ID) return `lineId must be 1-${MAX_LINE_ID} characters.`;
  if (b.vote !== 'up' && b.vote !== 'down') return 'vote must be "up" or "down".';
  if (typeof b.deviceId !== 'string' || !/^[A-Za-z0-9-]{8,64}$/.test(b.deviceId)) return 'Bad deviceId.';
  if (b.text !== undefined && typeof b.text !== 'string') return 'text must be a string.';
  if (typeof b.text === 'string' && cleanText(b.text, 10_000).length > MAX_TEXT) return `text must be at most ${MAX_TEXT} characters.`;
  const lang = typeof b.lang === 'string' ? cleanText(b.lang, 40) : '';
  return { lineId, lang, vote: b.vote, text: typeof b.text === 'string' ? cleanText(b.text, MAX_TEXT) : '', deviceId: b.deviceId };
}

/** constant-time string comparison (compares SHA-256 digests so even the length does not leak) */
export async function keyMatches(given: string | null, secret: string | undefined): Promise<boolean> {
  if (!secret || !given) return false;
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(given)), crypto.subtle.digest('SHA-256', enc.encode(secret))]);
  const x = new Uint8Array(a), y = new Uint8Array(b);
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}

export const csvCell = (v: string | number) => {
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // spreadsheet formula injection
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

