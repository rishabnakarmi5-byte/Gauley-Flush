import { CODE_LETTERS, CODE_RE, type ConfigResponse } from '../shared/protocol';
import { Room, type Env } from './room';

export { Room };

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

function newCode() {
  const b = crypto.getRandomValues(new Uint8Array(4));
  return [...b].map((x) => CODE_LETTERS[x % CODE_LETTERS.length]).join('');
}

function stubFor(env: Env, code: string) {
  return env.ROOM.get(env.ROOM.idFromName(code));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean); // api, rooms, CODE, action
    if (parts[0] !== 'api') return env.ASSETS ? env.ASSETS.fetch(request) : new Response('Not found', { status: 404 });

    if (parts[1] === 'config' && request.method === 'GET') {
      const body: ConfigResponse = { googleClientId: env.GOOGLE_CLIENT_ID ?? '' };
      return json(body);
    }

    if (parts[1] === 'rooms' && parts.length === 2 && request.method === 'POST') {
      const text = await request.text();
      if (text.length > 6000) return json({ error: 'Too big.' }, 413);
      let body: { name?: string; credential?: string } = {};
      try { body = JSON.parse(text || '{}'); } catch { return json({ error: 'Bad JSON.' }, 400); }
      for (let i = 0; i < 10; i++) {
        const code = newCode();
        const res = await stubFor(env, code).fetch('https://room/init', {
          method: 'POST', body: JSON.stringify({ ...body, code }),
        });
        if (res.status === 409) continue;
        return new Response(res.body, { status: res.status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
      }
      return json({ error: 'Could not find a free table code. Try again.' }, 503);
    }

    if (parts[1] === 'rooms' && parts.length >= 4 || (parts[1] === 'rooms' && parts.length === 3)) {
      const code = (parts[2] ?? '').toUpperCase();
      if (!CODE_RE.test(code)) return json({ error: 'Table codes are 4 letters.' }, 400);
      const stub = stubFor(env, code);
      const action = parts[3] ?? 'info';
      if (action === 'info' && request.method === 'GET') return stub.fetch('https://room/info');
      if (action === 'join' && request.method === 'POST') {
        const text = await request.text();
        if (text.length > 6000) return json({ error: 'Too big.' }, 413);
        return stub.fetch('https://room/join', { method: 'POST', body: text });
      }
      if (action === 'ws') return stub.fetch(new Request('https://room/ws', request));
    }
    return json({ error: 'Not found' }, 404);
  },
} satisfies ExportedHandler<Env>;
