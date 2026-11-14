export interface GoogleIdentity {
  sub: string;
  name?: string;
  picture?: string;
}

interface Jwk { kid: string; kty: string; alg?: string; n: string; e: string }
let cache: { keys: Jwk[]; at: number } | null = null;

export type JwksFetcher = () => Promise<Jwk[]>;

const defaultFetcher: JwksFetcher = async () => {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/certs');
  if (!res.ok) throw new Error('jwks fetch failed');
  const j = (await res.json()) as { keys: Jwk[] };
  return j.keys;
};

const b64urlToBytes = (s: string) => {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '='));
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
};
const b64urlJson = (s: string) => JSON.parse(new TextDecoder().decode(b64urlToBytes(s)));

/** Verify a Google Identity Services ID token (RS256, aud/iss/exp checked). Returns null on any failure. */
export async function verifyGoogleIdToken(
  token: unknown,
  clientId: string,
  opts: { fetchJwks?: JwksFetcher; now?: number } = {},
): Promise<GoogleIdentity | null> {
  if (!clientId || typeof token !== 'string' || token.length > 4096) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const header = b64urlJson(parts[0]);
    const payload = b64urlJson(parts[1]);
    if (header.alg !== 'RS256' || typeof header.kid !== 'string') return null;
    const now = opts.now ?? Date.now();
    const fetchJwks = opts.fetchJwks ?? defaultFetcher;
    let key = cache?.keys.find((k) => k.kid === header.kid);
    if (!key || !cache || now - cache.at > 3600_000) {
      const keys = await fetchJwks();
      cache = { keys, at: now };
      key = keys.find((k) => k.kid === header.kid);
    }
    if (!key) return null;
    const ck = await crypto.subtle.importKey(
      'jwk',
      { kty: key.kty, n: key.n, e: key.e, alg: 'RS256', ext: true },
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const okSig = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5', ck, b64urlToBytes(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    );
    if (!okSig) return null;
    if (payload.aud !== clientId) return null;
    if (payload.iss !== 'accounts.google.com' && payload.iss !== 'https://accounts.google.com') return null;
    if (typeof payload.exp !== 'number' || payload.exp * 1000 <= now) return null;
    if (typeof payload.sub !== 'string' || !payload.sub) return null;
    return {
      sub: payload.sub,
      name: typeof payload.name === 'string' ? payload.name : undefined,
      picture: typeof payload.picture === 'string' ? payload.picture : undefined,
    };
  } catch {
    return null;
  }
}

export function resetGoogleCache() { cache = null; }
