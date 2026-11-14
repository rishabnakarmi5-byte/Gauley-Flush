import { describe, it, expect, beforeEach } from 'vitest';
import { verifyGoogleIdToken, resetGoogleCache } from '../src/worker/google';

const enc = (o: unknown) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');

async function setup() {
  const kp = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const jwk = (await crypto.subtle.exportKey('jwk', kp.publicKey)) as any;
  jwk.kid = 'k1';
  const sign = async (payload: any, header: any = { alg: 'RS256', kid: 'k1', typ: 'JWT' }, key = kp.privateKey) => {
    const h = enc(header), p = enc(payload);
    const sig = Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${h}.${p}`))).toString('base64url');
    return `${h}.${p}.${sig}`;
  };
  return { jwk, sign, fetchJwks: async () => [jwk] };
}
const NOW = 1_700_000_000_000;
const good = { iss: 'https://accounts.google.com', aud: 'cid', sub: '123', exp: NOW / 1000 + 600, name: 'Ram', picture: 'https://lh3.googleusercontent.com/a' };

describe('google id token verification', () => {
  beforeEach(() => resetGoogleCache());
  it('accepts a valid token', async () => {
    const { sign, fetchJwks } = await setup();
    const r = await verifyGoogleIdToken(await sign(good), 'cid', { fetchJwks, now: NOW });
    expect(r).toEqual({ sub: '123', name: 'Ram', picture: good.picture });
  });
  it('accepts the bare issuer form', async () => {
    const { sign, fetchJwks } = await setup();
    expect(await verifyGoogleIdToken(await sign({ ...good, iss: 'accounts.google.com' }), 'cid', { fetchJwks, now: NOW })).not.toBeNull();
  });
  it('rejects wrong aud, iss, expired, tampered, wrong key, empty client id, junk', async () => {
    const { sign, fetchJwks } = await setup();
    const opts = { fetchJwks, now: NOW };
    expect(await verifyGoogleIdToken(await sign({ ...good, aud: 'other' }), 'cid', opts)).toBeNull();
    expect(await verifyGoogleIdToken(await sign({ ...good, iss: 'https://evil.com' }), 'cid', opts)).toBeNull();
    expect(await verifyGoogleIdToken(await sign({ ...good, exp: NOW / 1000 - 1 }), 'cid', opts)).toBeNull();
    const t = await sign(good);
    const [h, , s] = t.split('.');
    expect(await verifyGoogleIdToken(`${h}.${enc({ ...good, sub: '999' })}.${s}`, 'cid', opts)).toBeNull();
    const other = await setup();
    expect(await verifyGoogleIdToken(await other.sign(good), 'cid', opts)).toBeNull();
    expect(await verifyGoogleIdToken(t, '', opts)).toBeNull();
    expect(await verifyGoogleIdToken('a.b.c', 'cid', opts)).toBeNull();
    expect(await verifyGoogleIdToken(undefined, 'cid', opts)).toBeNull();
    expect(await verifyGoogleIdToken(await sign(good, { alg: 'none', kid: 'k1' }), 'cid', opts)).toBeNull();
  });
});
