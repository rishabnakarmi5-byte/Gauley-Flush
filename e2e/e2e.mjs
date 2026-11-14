// End-to-end flows against a local `wrangler dev` (see e2e/run.mjs). Plain Playwright, no test runner.
import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'node:fs';

const BASE = process.env.BASE || 'http://127.0.0.1:8799';
const TTL_BASE = process.env.TTL_BASE || 'http://127.0.0.1:8800';
const SHOTS = process.env.SHOTS || '/tmp/claude-0/-home-user-Gauley-Flush/95042db1-aa15-5da1-9f52-690eb010b44a/scratchpad/shots';
mkdirSync(SHOTS, { recursive: true });

const exe = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--disable-dev-shm-usage'] });

// ---------- tiny harness ----------
const results = [];
let failN = 0;
async function step(name, fn, pages = {}) {
  const t0 = Date.now();
  try {
    await Promise.race([fn(), new Promise((_, rej) => setTimeout(() => rej(new Error('step watchdog: 45s')), 45000))]);
    results.push({ name, ok: true });
    console.log(`  ok   ${name} (${Date.now() - t0}ms)`);
  } catch (e) {
    results.push({ name, ok: false, err: e });
    console.log(`  FAIL ${name}\n       ${String(e.message || e).split('\n').slice(0, 4).join('\n       ')}`);
    for (const [k, p] of Object.entries(pages)) {
      try { await p.screenshot({ path: `${SHOTS}/FAIL-${++failN}-${k}.png` }); } catch { /* page gone */ }
    }
  }
}
const assert = (c, m) => { if (!c) throw new Error(m || 'assertion failed'); };
const eq = (a, b, m) => assert(a === b, `${m || 'expected equal'}: got ${JSON.stringify(a)} want ${JSON.stringify(b)}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, msg, ms = 8000) {
  const t0 = Date.now();
  let last;
  while (Date.now() - t0 < ms) {
    try { const v = await fn(); if (v) return v; } catch (e) { last = e; }
    await sleep(100);
  }
  throw new Error(`timeout: ${msg}${last ? ' (' + last.message.split('\n')[0] + ')' : ''}`);
}

const T = (id) => `[data-testid="${id}"]`;
const num = (s) => Number(String(s).replace('−', '-').replace(/[^0-9+\-]/g, '')) ;
const pot = async (p) => num(await p.textContent(T('pot-raw')));
const netOf = async (p, name) => num(await p.textContent(T(`net-${name}`)));
const potIs = (p, n) => until(async () => (await pot(p)) === n, `pot to be ${n} (is ${'?'})`);
const netIs = (p, name, n) => until(async () => (await netOf(p, name)) === n, `${name} net to be ${n}`);
const shot = (p, name) => p.screenshot({ path: `${SHOTS}/${name}.png` });

// installs a WebSocket wrapper so tests can hold incoming messages and drop sockets
const wsHook = () => {
  const Native = window.WebSocket;
  window.__sockets = [];
  window.__hold = false;
  window.__queue = [];
  window.WebSocket = class extends Native {
    constructor(...a) {
      if (window.__blockWs) a[0] = 'ws://127.0.0.1:1/blocked';
      super(...a);
      window.__sockets.push(this);
    }
    set onmessage(fn) {
      super.onmessage = (e) => { if (window.__hold && typeof e.data === 'string' && e.data.startsWith('{"t":"state"')) window.__queue.push(() => fn.call(this, e)); else fn.call(this, e); };
    }
  };
  window.__release = () => { window.__hold = false; const q = window.__queue; window.__queue = []; q.forEach((f) => f()); };
  window.__dropSockets = () => window.__sockets.forEach((s) => { try { s.close(); } catch { /* */ } });
};

async function phone(name, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, ...opts });
  ctx.setDefaultTimeout(8000);
  await ctx.addInitScript(wsHook);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(`  [pageerror ${name}]`, e.message));
  return { ctx, page, name };
}

async function raw(code, tokens, base = BASE) {
  const ws = new WebSocket(`${base.replace('http', 'ws')}/api/rooms/${code}/ws`);
  const msgs = [];
  ws.onmessage = (e) => { try { msgs.push(JSON.parse(e.data)); } catch { /* pong */ } };
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('ws failed')); });
  ws.send(JSON.stringify({ t: 'hello', tokens }));
  await until(() => msgs.some((m) => m.t === 'state'), 'raw hello snapshot');
  return {
    msgs,
    async act(actionId, action) {
      const n = msgs.length;
      ws.send(JSON.stringify({ t: 'act', actionId, action }));
      return until(() => msgs.slice(n).find((m) => m.t === 'ack' && m.actionId === actionId), `ack for ${actionId}`);
    },
    last: () => [...msgs].reverse().find((m) => m.t === 'state'),
    close: () => ws.close(),
  };
}

// =====================================================================
console.log(`E2E against ${BASE}`);
let code, A, B, C;
const put = { Ram: 0, Sita: 0, Hari: 0 };

console.log('\nPhone flow: 3 browser contexts');
await step('config endpoint says Google is off and button is hidden', async () => {
  const cfg = await (await fetch(`${BASE}/api/config`)).json();
  eq(cfg.googleClientId, '', 'googleClientId');
  A = await phone('Ram');
  await A.page.goto(BASE + '/');
  await A.page.waitForSelector(T('create'));
  eq(await A.page.locator(T('google-btn')).count(), 0, 'google button count');
  await shot(A.page, '01-home');
});

await step('host creates a table and gets a 4-letter code', async () => {
  await A.page.fill(T('name-input'), 'Ram');
  await A.page.click(T('create'));
  await A.page.waitForSelector(T('room-code'));
  code = (await A.page.textContent(T('room-code'))).trim();
  assert(/^[A-HJ-NP-Z]{4}$/.test(code), `bad code ${code}`);
  assert(A.page.url().endsWith(`#/r/${code}`), 'url has code');
  await A.page.waitForSelector(T('qr'));
}, { A: undefined });

await step('friends join via the shared link; duplicate names are refused with a toast', async () => {
  B = await phone('Sita');
  await B.page.goto(`${BASE}/#/r/${code}`);
  await B.page.waitForSelector(T('join-name'));
  await B.page.fill(T('join-name'), 'Sita');
  await B.page.click(T('join-go'));
  await B.page.waitForSelector(T('room-code'));
  C = await phone('Hari');
  await C.page.goto(`${BASE}/#/r/${code}`);
  await C.page.fill(T('join-name'), 'ram');
  await C.page.click(T('join-go'));
  await C.page.waitForSelector(`${T('toast')}`);
  assert((await C.page.textContent(T('toast'))).includes('already has that name'), 'duplicate-name toast');
  await C.page.fill(T('join-name'), 'Hari');
  await C.page.click(T('join-go'));
  await C.page.waitForSelector(T('room-code'));
  await until(async () => (await A.page.locator(`${T('players')} li`).count()) === 3, 'host sees 3 players');
}, { A: undefined });

await step('classic limits toggle (per player) and host rules update live', async () => {
  await C.page.click(`${T('classic-toggle')}`);
  await until(async () => (await A.page.textContent(T('player-Hari'))).includes('classic'), 'host sees Hari on classic');
  await A.page.fill(T('set-max'), '5000');
  await A.page.click(T('save-settings'));
  await until(async () => (await B.page.inputValue(T('set-max'))) === '5000', 'guest sees new max');
  assert(await B.page.locator(T('set-max')).isDisabled(), 'non-host settings are read-only');
  await A.page.evaluate(() => window.scrollTo(0, 0));
  await sleep(500);
  await shot(A.page, '02-lobby');
});

await step('host deals; everyone lands on the table; boot puts Rs 30 in the pot', async () => {
  await A.page.click(T('deal'));
  for (const p of [A, B, C]) await p.page.waitForSelector(T('table-screen'));
  for (const [p, n] of [[A, 'Ram'], [B, 'Sita'], [C, 'Hari']]) {
    await p.page.click(T('boot')); put[n] += 10;
  }
  for (const p of [A, B, C]) await potIs(p.page, 30);
  await netIs(B.page, 'Ram', -10);
});

await step('typed amount above max bet is blocked in the UI and on the server', async () => {
  await B.page.click(T('type-toggle'));
  await B.page.fill(T('amount-input'), '6000');
  assert(await B.page.locator(T('chaal')).isDisabled(), 'chaal disabled over max');
  assert((await B.page.textContent(T('chaal'))).includes('Max bet'), 'max bet label');
  await B.page.click(T('type-toggle'));
  await B.page.click(T('clear'));
  const tok = await A.page.evaluate((c) => JSON.parse(localStorage.getItem('gf:room:' + c)).tokens, code);
  const r = await raw(code, tok.map((t) => ({ seat: t.seat, token: t.token })));
  const ack = await r.act('big-1', { type: 'bet', by: 's1', seat: 's1', amount: 6000 });
  eq(ack.ok, false, 'server rejects over max');
  r.close();
});

await step('chips accumulate into a pending amount; Chaal confirms (free-form player)', async () => {
  await B.page.click(T('chip-50'));
  await B.page.click(T('chip-20'));
  eq((await B.page.textContent(T('pending'))).replace(/\s/g, ''), 'Rs70', 'pending shows Rs 70');
  await B.page.click(T('chaal')); put.Sita += 70;
  for (const p of [A, B, C]) await potIs(p.page, 100);
  await netIs(A.page, 'Sita', -80);
  eq((await B.page.textContent(T('pending'))).replace(/\s/g, ''), 'Rs0', 'pending cleared');
});

await step('classic player: blind may bet stake or 2x; seeing cards moves to 2x/4x; limits enforced on server', async () => {
  await C.page.waitForSelector(T('classic-70'));
  await C.page.waitForSelector(T('classic-140'));
  assert((await C.page.textContent(T('blindseen'))).includes('BLIND'), 'shows BLIND');
  await C.page.click(T('see'));
  await C.page.waitForSelector(T('classic-280'));
  assert((await C.page.textContent(T('blindseen'))).includes('SEEN'), 'shows SEEN');
  assert(!(await C.page.locator(T('classic-70')).count()), 'blind button gone');
  const tok = await C.page.evaluate((c) => JSON.parse(localStorage.getItem('gf:room:' + c)).tokens, code);
  const r = await raw(code, tok.map((t) => ({ seat: t.seat, token: t.token })));
  const ack = await r.act('lim-1', { type: 'bet', by: 's3', seat: 's3', amount: 7 });
  eq(ack.ok, false, 'server rejects off-limit bet'); eq(ack.code, 'limit', 'error code');
  r.close();
  await C.page.click(T('classic-140')); put.Hari += 140;   // seen: 2x stake, sets stake to 70
  for (const p of [A, B, C]) await potIs(p.page, 240);
});

await step('typed amount bet by host', async () => {
  await A.page.click(T('type-toggle'));
  await A.page.fill(T('amount-input'), '25');
  await A.page.click(T('chaal')); put.Ram += 25;
  for (const p of [A, B, C]) await potIs(p.page, 265);
  await netIs(B.page, 'Ram', -35);
});

await step('duplicate actionId replay never double-bets; foreign seats are refused', async () => {
  const tok = await A.page.evaluate((c) => JSON.parse(localStorage.getItem('gf:room:' + c)).tokens, code);
  const r = await raw(code, tok.map((t) => ({ seat: t.seat, token: t.token })));
  const bet = { type: 'bet', by: 's1', seat: 's1', amount: 10 };
  const a1 = await r.act('dup-1', bet);
  const a2 = await r.act('dup-1', bet);
  const a3 = await r.act('dup-1', bet);
  eq(a1.ok, true, 'first ok'); eq(a2.duplicate, true, 'second flagged duplicate'); eq(a3.duplicate, true, 'third flagged duplicate');
  await potIs(B.page, 275);
  const f = await r.act('foreign-1', { type: 'bet', by: 's2', seat: 's2', amount: 10 });
  eq(f.ok, false, 'cannot act for a seat whose token was not presented'); eq(f.code, 'forbidden', 'forbidden');
  const snap = JSON.stringify(r.last());
  assert(!snap.includes(tok[0].token), 'snapshot never contains seat tokens');
  r.close();
  put.Ram += 10;
});

await step('undo takes back your own latest bet only', async () => {
  assert(!(await B.page.locator(T('undo')).count()), 'Sita has no undo (not her latest)');
  await A.page.click(T('undo')); put.Ram -= 10;
  for (const p of [A, B, C]) await potIs(p.page, 265);
});

await step('table mid-hand screenshot', async () => { await sleep(900); await shot(B.page, '03-table-mid-hand'); });

await step('pack: Hari packs, pot stays, hand continues', async () => {
  await C.page.click(T('pack'));
  await until(async () => (await A.page.textContent(T('seat-Hari'))).includes('packed'), 'Hari marked packed');
  await potIs(A.page, 265);
  assert((await C.page.textContent(T('actionbar'))).includes('You packed'), 'packed message');
  assert((await A.page.textContent(T('feed'))).includes('Hari packed'), 'feed shows pack');
});

await step('stale client gets a friendly error toast (two people claim at once)', async () => {
  await B.page.evaluate(() => { window.__hold = true; });
  await A.page.click(T('iwon'));
  await B.page.waitForTimeout(400);
  await B.page.waitForSelector(T('iwon')); // B still sees old UI
  await B.page.click(T('iwon'));
  await B.page.waitForSelector(T('toast'));
  const txt = await B.page.textContent(T('toast'));
  assert(/claim/i.test(txt), `toast mentions claim: ${txt}`);
  await B.page.evaluate(() => window.__release());
  await B.page.waitForSelector(T('claim-answer'));
});

await step('claim freezes betting; a packed participant can reject; claimant can re-claim', async () => {
  await C.page.waitForSelector(T('claim-answer'));
  await shot(B.page, '04-claim');
  assert((await C.page.textContent(T('claim-banner'))).includes('Ram'), 'banner names claimant');
  await C.page.click(T('reject'));
  await A.page.waitForSelector(T('bet-panel'));
  eq(await A.page.locator(T('claim-banner')).count(), 0, 'banner gone after reject');
  await A.page.click(T('iwon'));
  await B.page.waitForSelector(T('claim-answer'));
});

await step('another participant confirms: pot goes to the claimant, ledger stays zero-sum', async () => {
  await B.page.click(T('confirm'));
  const expectRam = 265 - put.Ram, expectSita = -put.Sita, expectHari = -put.Hari;
  for (const p of [A, B, C]) {
    await netIs(p.page, 'Ram', expectRam);
    await netIs(p.page, 'Sita', expectSita);
    await netIs(p.page, 'Hari', expectHari);
    await potIs(p.page, 0);
  }
  eq(expectRam + expectSita + expectHari, 0, 'sums to zero');
  await A.page.click(T('open-history'));
  await A.page.waitForSelector(T('history-sheet'));
  assert((await A.page.textContent(T('hist-row'))).includes('Ram won'), 'history lists winner');
  await A.page.keyboard.press('Escape');
});

await step('reload keeps the seat (token in localStorage)', async () => {
  await B.page.reload();
  await B.page.waitForSelector(T('table-screen'));
  assert((await B.page.textContent(T('seat-Sita'))).includes('you'), 'still Sita (seat tagged you)');
  await netIs(B.page, 'Sita', -put.Sita);
});

await step('reconnect: banner, disabled actions, then state resync after missed events', async () => {
  await B.ctx.setOffline(true);
  await B.page.evaluate(() => { window.__blockWs = true; window.__dropSockets(); });
  await B.page.waitForSelector(T('reconnecting'));
  assert(await B.page.locator(T('end-game')).isDisabled(), 'actions disabled while offline');
  await A.page.click(T('new-hand'));          // happens while Sita is away
  await A.page.waitForSelector(T('boot'));
  await B.ctx.setOffline(false);
  await B.page.evaluate(() => { window.__blockWs = false; window.dispatchEvent(new Event('online')); });
  await B.page.waitForSelector(T('boot'), { timeout: 20000 });
  await until(async () => (await B.page.locator(T('reconnecting')).count()) === 0, 'banner clears');
}, { A: A.page, B: B.page });

await step('hand 2: sit out, last-one-standing wins automatically', async () => {
  await C.page.click(T('sit-out'));
  await A.page.click(T('boot')); put.Ram = 10;
  await B.page.click(T('boot'));
  await potIs(A.page, 20);
  await B.page.click(T('chip-20')); await B.page.click(T('chip-10'));
  await B.page.click(T('chaal'));
  await potIs(A.page, 50);
  await A.page.click(T('pack'));
  await until(async () => (await A.page.textContent(T('status'))).includes('Between hands') || (await A.page.textContent(T('status'))).includes('Chai'), 'hand finished automatically');
  await potIs(A.page, 0);
  assert((await A.page.textContent(T('feed'))).includes('everyone else packed'), 'auto-win feed line');
});

await step('end game: connected players agree, disconnected ones do not block', async () => {
  await A.page.click(T('end-game'));
  await B.page.waitForSelector(T('endvote'));
  await C.page.waitForSelector(T('endvote'));
  await C.page.close();                      // Hari's phone dies
  await sleep(1200);
  await B.page.click(T('agree-end'));
  for (const p of [A, B]) await p.page.waitForSelector(T('transfers'));
});

await step('settlement: minimal transfers, 5% prompt only for winners, paid ticks sync', async () => {
  const ram = 265 - 35 - 10 /*hand1 contributions of Ram were 35*/;
  const tr = await A.page.locator(T('transfer')).allTextContents();
  eq(tr.length, 2, 'two transfers');
  assert(tr.some((t) => /Hari pays Ram/.test(t) && /150/.test(t)), 'Hari pays Ram 150');
  assert(tr.some((t) => /Sita pays Ram/.test(t) && /70/.test(t)), 'Sita pays Ram 70');
  const thanks = await A.page.textContent(T('thanks'));
  assert(/Send 5% of your winnings \(Rs 11\) to the developer/.test(thanks), `prompt text: ${thanks}`);
  eq(await B.page.locator(T('thanks')).count(), 0, 'loser sees no prompt');
  await shot(A.page, '05-settle');
  // paid tick by payee syncs to payer
  const row = A.page.locator(T('transfer')).filter({ hasText: 'Sita pays Ram' });
  await row.locator(T('tick')).click();
  await until(async () => (await B.page.locator(`${T('transfer')}.paid`).count()) === 1, 'tick synced to Sita');
  assert(await B.page.locator(`${T('transfer')}:not(.paid) ${T('tick')}`).first().isDisabled(), 'only payer/payee can tick');
  void ram;
});

await step('opt-in thanks choice survives reload and shows the developer QR', async () => {
  await A.page.click(T('thanks-yes'));
  await A.page.waitForSelector(T('dev-qr'));
  await A.page.reload();
  await A.page.waitForSelector(T('dev-qr'));
  const ok = await A.page.evaluate(() => { const i = document.querySelector('[data-testid="dev-qr"]'); return i.complete && i.naturalWidth > 0; });
  assert(ok, 'dev-qr.png loads');
});

await step('losers who were offline see no prompt either; host can reopen to keep playing', async () => {
  const page = await C.ctx.newPage();
  await page.goto(`${BASE}/#/r/${code}`);
  await page.waitForSelector(T('transfers'));
  eq(await page.locator(T('thanks')).count(), 0, 'Hari sees no prompt');
  assert((await page.textContent(T('final-Hari'))).includes('150'), 'Hari final net');
  await page.close();
  await A.page.click(T('reopen'));
  await B.page.waitForSelector(T('table-screen'));
  await A.page.waitForSelector(T('table-screen'));
});

// ---------------------------------------------------------------------
console.log('\nTablet mode');
let TB, TP;
await step('tablet: add players locally, a phone can still join the same room', async () => {
  TB = await browser.newContext({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 2, hasTouch: true });
  TB.setDefaultTimeout(8000);
  await TB.addInitScript(wsHook);
  TP = await TB.newPage();
  await TP.goto(BASE + '/#/tablet');
  const names = ['Ram', 'Sita', 'Hari', 'Maya'];
  for (let i = 0; i < 3; i++) await TP.fill(T(`tablet-name-${i}`), names[i]);
  await TP.click('text=+ Add another player');
  await TP.fill(T('tablet-name-3'), names[3]);
  await TP.click(T('tablet-start'));
  await TP.waitForSelector(T('room-code'));
  await until(async () => (await TP.locator(`${T('players')} li`).count()) === 4, 'four local seats');
  const tcode = (await TP.textContent(T('room-code'))).trim();
  const D = await phone('Dev');
  await D.page.goto(`${BASE}/#/r/${tcode}`);
  await D.page.fill(T('join-name'), 'Dev');
  await D.page.click(T('join-go'));
  await D.page.waitForSelector(T('room-code'));
  await until(async () => (await TP.locator(`${T('players')} li`).count()) === 5, 'phone joined tablet room');
  await D.ctx.close();
  TP.on('dialog', (d) => d.accept());
  await TP.click(`${T('player-Dev')} >> text=Remove`);
  await until(async () => (await TP.locator(`${T('players')} li`).count()) === 4, 'Dev removed (net 0, so fully gone)');
});

await step('tablet: deal, per-seat boot, select seat then act', async () => {
  await TP.click(T('deal'));
  await TP.waitForSelector(T('table-screen'));
  for (const n of ['Ram', 'Sita', 'Hari']) await TP.click(T(`seat-boot-${n}`));
  await TP.click(T('seat-Maya'));
  await TP.click(T('sit-out'));
  await potIs(TP, 30);
  await TP.click(T('seat-Ram'));
  await TP.click(T('chip-100')); await TP.click(T('chaal'));
  await potIs(TP, 130);
  await TP.click(T('seat-Sita'));
  assert((await TP.textContent(T('acting'))).includes('Sita'), 'acting as Sita');
  await TP.click(T('chip-50')); await TP.click(T('chaal'));
  await potIs(TP, 180);
  await sleep(900);
  await shot(TP, '06-tablet-table');
  await TP.setViewportSize({ width: 768, height: 1024 });
  await sleep(300);
  await shot(TP, '07-tablet-table-portrait');
  await TP.setViewportSize({ width: 1024, height: 768 });
});

await step('tablet: a claimant cannot confirm their own claim; another seat can', async () => {
  await TP.click(T('seat-Ram'));
  await TP.click(T('iwon'));
  await TP.waitForSelector(T('claim-wait'));
  eq(await TP.locator(T('confirm')).count(), 0, 'no confirm for the claimant seat');
  await TP.click(T('seat-Hari'));
  await TP.waitForSelector(T('confirm'));
  await TP.click(T('confirm'));
  await potIs(TP, 0);
  await netIs(TP, 'Ram', 180 - 10 - 100);
  await netIs(TP, 'Sita', -60);
  await netIs(TP, 'Hari', -10);
  await netIs(TP, 'Maya', 0);
});

await step('tablet: cancelling a boot-stage hand refunds boots', async () => {
  await TP.click(T('new-hand'));
  await TP.click(T('seat-boot-Maya'));
  await potIs(TP, 10);
  await netIs(TP, 'Maya', -10);
  await TP.click(T('cancel-hand'));
  await netIs(TP, 'Maya', 0);
  await potIs(TP, 0);
});

await step('tablet: reload keeps every seat; end game with all-seat agree; square players', async () => {
  await TP.reload();
  await TP.waitForSelector(T('table-screen'));
  eq(await TP.locator('.seat.mine').count(), 4, 'all four seats still controlled');
  await TP.click(T('end-game'));
  await TP.click(T('agree-end'));
  await TP.waitForSelector(T('transfers'));
  assert((await TP.textContent(T('final-Maya'))).includes('square'), 'Maya is square');
  eq(await TP.locator(T('thanks')).count(), 1, 'only the winner (Ram) gets a prompt, shown on the tablet');
  await shot(TP, '08-tablet-settle');
});

// ---------------------------------------------------------------------
console.log('\nHousekeeping');
await step('rooms expire after inactivity (alarm), here with a 4s TTL', async () => {
  const r = await (await fetch(`${TTL_BASE}/api/rooms`, { method: 'POST', body: JSON.stringify({ name: 'Temp' }) })).json();
  const info = async () => (await (await fetch(`${TTL_BASE}/api/rooms/${r.code}/info`)).json()).exists;
  assert(await info(), 'exists right after creation');
  await until(async () => !(await info()), 'room deleted by alarm', 20000);
});

await step('bad codes and unknown rooms are handled', async () => {
  const bad = await fetch(`${BASE}/api/rooms/ABC/info`);
  eq(bad.status, 400, 'bad code length');
  const none = await (await fetch(`${BASE}/api/rooms/ZZZZ/info`)).json();
  eq(none.exists, false, 'no such room');
  const j = await fetch(`${BASE}/api/rooms/ZZZZ/join`, { method: 'POST', body: JSON.stringify({ name: 'x' }) });
  eq(j.status, 404, 'join unknown');
  const blank = await fetch(`${BASE}/api/rooms`, { method: 'POST', body: JSON.stringify({ name: '   ' }) });
  eq(blank.status, 400, 'blank name refused');
  const html = await fetch(`${BASE}/api/rooms`, { method: 'POST', body: JSON.stringify({ name: '<b>x</b>' }) });
  const hj = await html.json();
  assert(hj.code, 'name with markup is accepted but sanitised');
});

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} e2e steps passed`);
console.log(`screenshots: ${SHOTS}`);
process.exit(failed.length ? 1 : 0);
