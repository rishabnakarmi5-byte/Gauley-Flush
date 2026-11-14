// Starts `wrangler dev` (local workerd + Durable Objects), runs the Playwright flows, tears everything down.
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = Number(process.env.E2E_PORT || 8799);
const persist = mkdtempSync(join(tmpdir(), 'gf-e2e-'));

function startWrangler(port, extra = []) {
  const p = spawn('npx', ['wrangler', 'dev', '--port', String(port), '--persist-to', join(persist, String(port)), '--ip', '127.0.0.1', '--inspector-port', String(port + 500), ...extra], { stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  let log = '';
  p.stdout.on('data', (d) => (log += d));
  p.stderr.on('data', (d) => (log += d));
  const ready = new Promise((resolve, reject) => {
    const t0 = Date.now();
    const iv = setInterval(async () => {
      try {
        const r = await fetch(`http://127.0.0.1:${port}/api/config`);
        if (r.ok) { clearInterval(iv); resolve(); }
      } catch { /* not yet */ }
      if (Date.now() - t0 > 90000) { clearInterval(iv); reject(new Error('wrangler did not start:\n' + log.slice(-2000))); }
    }, 500);
  });
  const kill = () => { try { process.kill(-p.pid, 'SIGKILL'); } catch { /* gone */ } };
  return { ready, kill };
}

const main = startWrangler(PORT);
const ttl = startWrangler(PORT + 1, ['--var', 'ROOM_TTL_MS:4000']);
const killAll = () => { main.kill(); ttl.kill(); };
process.on('exit', killAll);
process.on('SIGINT', () => { killAll(); process.exit(130); });

let code = 1;
try {
  await Promise.all([main.ready, ttl.ready]);
  const t = spawn('node', ['e2e/e2e.mjs'], { stdio: 'inherit', env: { ...process.env, BASE: `http://127.0.0.1:${PORT}`, TTL_BASE: `http://127.0.0.1:${PORT + 1}` } });
  code = await new Promise((r) => t.on('exit', r));
} catch (e) {
  console.error(e);
} finally {
  killAll();
}
process.exit(code ?? 1);
