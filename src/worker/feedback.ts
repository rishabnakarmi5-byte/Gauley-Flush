import { DurableObject } from 'cloudflare:workers';
import { MAX_PER_DEVICE, MAX_ROWS, RATE, csvCell, parseFeedback, type FeedbackInput } from './feedback-core';

interface Row { device: string; line: string; lang: string; vote: string; text: string; at: number }

export class Feedback extends DurableObject {
  private hits = new Map<string, number[]>();

  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env as never);
    this.ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS fb (
      device TEXT NOT NULL, line TEXT NOT NULL, lang TEXT NOT NULL, vote TEXT NOT NULL, text TEXT NOT NULL, at INTEGER NOT NULL,
      PRIMARY KEY (device, line)) WITHOUT ROWID`);
    this.ctx.storage.sql.exec('CREATE INDEX IF NOT EXISTS fb_line ON fb (line)');
  }

  private limited(key: string, max: number, now: number) {
    const arr = (this.hits.get(key) ?? []).filter((t) => now - t < 60_000);
    arr.push(now);
    this.hits.set(key, arr);
    if (this.hits.size > 2000) for (const [k, v] of this.hits) if (!v.length || now - v[v.length - 1] > 60_000) this.hits.delete(k);
    return arr.length > max;
  }

  async submit(input: FeedbackInput, ip: string): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
    const now = Date.now();
    if (this.limited(`d:${input.deviceId}`, RATE.device, now) || this.limited(`i:${ip}`, RATE.ip, now) || this.limited('g', RATE.global, now)) {
      return { ok: false, status: 429, error: 'Slow down a little.' };
    }
    const sql = this.ctx.storage.sql;
    const exists = sql.exec('SELECT 1 AS x FROM fb WHERE device = ? AND line = ?', input.deviceId, input.lineId).toArray().length > 0;
    if (!exists) {
      const total = Number(sql.exec('SELECT COUNT(*) AS n FROM fb').one().n);
      if (total >= MAX_ROWS) return { ok: false, status: 507, error: 'Feedback is full for now.' };
      const mine = Number(sql.exec('SELECT COUNT(*) AS n FROM fb WHERE device = ?', input.deviceId).one().n);
      if (mine >= MAX_PER_DEVICE) return { ok: false, status: 429, error: 'That is plenty of feedback from one device. Thank you!' };
    }
    sql.exec(
      `INSERT INTO fb (device, line, lang, vote, text, at) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (device, line) DO UPDATE SET lang = excluded.lang, vote = excluded.vote,
         text = CASE WHEN excluded.text <> '' THEN excluded.text ELSE (CASE WHEN fb.vote = excluded.vote THEN fb.text ELSE '' END) END,
         at = excluded.at`,
      input.deviceId, input.lineId, input.lang, input.vote, input.text, now,
    );
    return { ok: true };
  }

  async exportData(): Promise<{ summary: { lineId: string; lang: string; up: number; down: number }[]; comments: { lineId: string; lang: string; vote: string; text: string; at: number }[]; rows: Row[] }> {
    const sql = this.ctx.storage.sql;
    const summary = sql.exec(
      `SELECT line AS lineId, MAX(lang) AS lang, SUM(vote = 'up') AS up, SUM(vote = 'down') AS down FROM fb GROUP BY line ORDER BY down DESC, up DESC, line`,
    ).toArray().map((r) => ({ lineId: String(r.lineId), lang: String(r.lang), up: Number(r.up), down: Number(r.down) }));
    const comments = sql.exec(`SELECT line, lang, vote, text, at FROM fb WHERE text <> '' ORDER BY at DESC LIMIT 5000`).toArray()
      .map((r) => ({ lineId: String(r.line), lang: String(r.lang), vote: String(r.vote), text: String(r.text), at: Number(r.at) }));
    const rows = sql.exec('SELECT device, line, lang, vote, text, at FROM fb ORDER BY line, at').toArray() as unknown as Row[];
    return { summary, comments, rows };
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
    if (url.pathname === '/submit' && request.method === 'POST') {
      const parsed = parseFeedback(await request.json().catch(() => null));
      if (typeof parsed === 'string') return json({ error: parsed }, 400);
      const r = await this.submit(parsed, request.headers.get('x-client-ip') ?? 'unknown');
      return r.ok ? json({ ok: true }) : json({ error: r.error }, r.status);
    }
    if (url.pathname === '/export' && request.method === 'GET') {
      const { summary, comments, rows } = await this.exportData();
      if (url.searchParams.get('format') === 'csv') {
        const lines: string[] = [];
        if (url.searchParams.get('view') === 'summary') {
          lines.push('lineId,lang,up,down');
          for (const s of summary) lines.push([s.lineId, s.lang, s.up, s.down].map(csvCell).join(','));
        } else {
          lines.push('lineId,lang,vote,text,at');
          for (const r of rows) lines.push([r.line, r.lang, r.vote, r.text, new Date(r.at).toISOString()].map(csvCell).join(','));
        }
        return new Response(lines.join('\r\n') + '\r\n', {
          headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="gauley-feedback.csv"', 'cache-control': 'no-store' },
        });
      }
      return json({ summary, comments });
    }
    return json({ error: 'Not found' }, 404);
  }
}
