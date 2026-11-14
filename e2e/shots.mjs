// Design review screenshots (2x). Usage: BASE=http://127.0.0.1:8799 SHOTS=/some/dir node e2e/shots.mjs
// Needs a running `wrangler dev` started with --var GOOGLE_CLIENT_ID: --var ADMIN_KEY:test-admin-key
import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'node:fs';

const BASE = process.env.BASE || 'http://127.0.0.1:8799';
const SHOTS = process.env.SHOTS || '/tmp/claude-0/-home-user-Gauley-Flush/95042db1-aa15-5da1-9f52-690eb010b44a/scratchpad/shots2';
mkdirSync(SHOTS, { recursive: true });
const exe = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const T = (id) => `[data-testid="${id}"]`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (p, name, o = {}) => p.screenshot({ path: `${SHOTS}/${name}.png`, ...o });

async function phone(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, ...opts });
  ctx.setDefaultTimeout(8000);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  return { ctx, page };
}
const pot = async (p) => Number(await p.textContent(T('pot-raw')));
async function potIs(p, n) { for (let i = 0; i < 80; i++) { if ((await pot(p)) === n) return; await sleep(100); } throw new Error(`pot never ${n}`); }
async function typeBet(p, n) {
  if (!(await p.locator(T('amount-input')).count())) await p.click(T('type-toggle'));
  await p.fill(T('amount-input'), String(n));
  await p.click(T('chaal'));
}

const A = await phone(), B = await phone(), C = await phone();
await A.page.goto(BASE + '/');
await A.page.waitForSelector(T('create'));
await sleep(2000);
await shot(A.page, '01-home');
await A.page.fill(T('name-input'), 'Ram');
await A.page.click(T('create'));
await A.page.waitForSelector(T('room-code'));
const code = (await A.page.textContent(T('room-code'))).trim();
for (const [P, n] of [[B, 'Sita'], [C, 'Hari']]) {
  await P.page.goto(`${BASE}/#/r/${code}`);
  await P.page.fill(T('join-name'), n);
  await P.page.click(T('join-go'));
  await P.page.waitForSelector(T('room-code'));
}
await sleep(2200);
await shot(A.page, '02-lobby');
await shot(A.page, '02b-lobby-full', { fullPage: true });
await A.page.click(T('deal'));
for (const P of [A, B, C]) await P.page.waitForSelector(T('table-screen'));
await A.page.click(T('boot'));
await sleep(1800);
await shot(A.page, '03-table-boot-stage');
await B.page.click(T('boot')); await C.page.click(T('boot'));
await potIs(A.page, 30);
await sleep(300);
// pot of 1,385: 30 + 540 + 355 + 460
await typeBet(A.page, 540); await potIs(B.page, 570);
await typeBet(B.page, 355); await potIs(B.page, 925);
await typeBet(C.page, 460); await potIs(B.page, 1385);
await sleep(2200);
await shot(B.page, '04-table-mid-hand-1385');
await shot(B.page, '04b-table-mid-hand-scrolled', { fullPage: false, clip: { x: 0, y: 0, width: 360, height: 740 } });
// pending stack
await B.page.click(T('type-toggle'));
for (const v of [100, 50, 20, 5]) await B.page.click(T(`chip-${v}`));
await sleep(700);
await shot(B.page, '05-pending-stack');
await B.page.click(T('clear'));
// witty: three states (clip the table page around the line)
const wt = B.page.locator(T('witty'));
await wt.scrollIntoViewIfNeeded();
await sleep(500);
await shot(B.page, '06-witty-1-script');
await B.page.click(T('witty-text')); await sleep(700);
await shot(B.page, '06-witty-2-roman');
await B.page.click(T('witty-text')); await sleep(700);
await shot(B.page, '06-witty-3-english');
await B.page.click(T('witty-down')); await sleep(900);
await shot(B.page, '07-feedback-sheet');
await B.page.fill(T('feedback-text'), 'The second word is wrong.');
await B.page.click(T('feedback-send')); await sleep(900);
// claim banner
await A.page.click(T('iwon'));
await C.page.waitForSelector(T('claim-banner'));
await sleep(700);
await shot(C.page, '08-claim-banner');
console.log('reject'); await C.page.click(T('reject'));
await A.page.waitForSelector(T('bet-panel'));
// big pot: 40+ notes, re-bundled
const tok = async (P) => await P.page.evaluate((c) => JSON.parse(localStorage.getItem('gf:room:' + c)).tokens, code);
console.log('ws'); const tokens = [...(await tok(A)), ...(await tok(B)), ...(await tok(C))].map((t) => ({ seat: t.seat, token: t.token }));
const ws = new WebSocket(`${BASE.replace('http', 'ws')}/api/rooms/${code}/ws`);
await new Promise((r) => (ws.onopen = r));
ws.send(JSON.stringify({ t: 'hello', tokens }));
await sleep(500);
for (let i = 0; i < 24; i++) {
  const seat = tokens[i % 3].seat;
  ws.send(JSON.stringify({ t: 'act', actionId: `big-${i}`, action: { type: 'bet', by: seat, seat, amount: 37 + (i % 4) * 11 } }));
  await sleep(60);
}
console.log('bets sent'); await sleep(2500);
console.log('big pot', await pot(B.page), 'notes', await B.page.locator(T('pile-note')).count());
await shot(B.page, '09-table-big-pot');
ws.close();
// history sheet: finish the hand
await A.page.click(T('iwon'));
await B.page.waitForSelector(T('confirm'));
await B.page.click(T('confirm'));
await potIs(A.page, 0);
await sleep(1500);
await shot(A.page, '10-table-after-award');
await A.page.click(T('open-history'));
await sleep(900);
await shot(A.page, '11-history-sheet');
await A.page.keyboard.press('Escape');
// settle with QR
await A.page.click(T('end-game'));
await B.page.waitForSelector(T('endvote'));
await B.page.click(T('agree-end'));
await C.page.click(T('agree-end'));
await A.page.waitForSelector(T('transfers'));
await sleep(2200);
await shot(A.page, '12-settle');
await A.page.waitForSelector(T('thanks-yes'));
await A.page.click(T('thanks-yes'));
await A.page.waitForSelector(T('dev-qr'));
await sleep(1000);
await A.page.locator(T('dev-qr')).scrollIntoViewIfNeeded();
await sleep(400);
await shot(A.page, '12b-settle-qr');
await shot(A.page, '12c-settle-full', { fullPage: true });

// tablet
const TB = await browser.newContext({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 2, hasTouch: true });
const TP = await TB.newPage();
await TP.goto(BASE + '/#/tablet');
const names = ['Ram', 'Sita', 'Hari', 'Maya'];
for (let i = 0; i < 3; i++) await TP.fill(T(`tablet-name-${i}`), names[i]);
await TP.click('text=+ Add another player');
await TP.fill(T('tablet-name-3'), names[3]);
await TP.click(T('tablet-start'));
await TP.waitForSelector(T('room-code'));
for (let i = 0; i < 40; i++) { if ((await TP.locator(`${T('players')} li`).count()) === 4) break; await sleep(100); }
await TP.click(T('deal'));
await TP.waitForSelector(T('table-screen'));
for (const n of ['Ram', 'Sita', 'Hari']) await TP.click(T(`seat-boot-${n}`));
await TP.click(T('seat-Ram')); await TP.click(T('chip-100')); await TP.click(T('chip-50')); await TP.click(T('chaal'));
await TP.click(T('seat-Sita')); await TP.click(T('chip-100')); await TP.click(T('chip-20')); await TP.click(T('chaal'));
await sleep(2400);
await TP.click(T('chip-50'));
await sleep(600);
await shot(TP, '13-tablet-landscape');
await TP.setViewportSize({ width: 768, height: 1024 });
await sleep(1200);
await shot(TP, '14-tablet-portrait');

// owner page
const O = await phone();
await O.page.goto(BASE + '/#/feedback');
await O.page.fill(T('admin-key'), 'wrong');
await O.page.click(T('admin-load'));
await O.page.waitForSelector(T('admin-error'));
await shot(O.page, '15-owner-wrong-key');
await O.page.fill(T('admin-key'), 'test-admin-key');
await O.page.click(T('admin-load'));
await O.page.waitForSelector(T('admin-summary'));
await sleep(500);
await shot(O.page, '16-owner-feedback');
await browser.close();
console.log('shots in', SHOTS);
process.exit(0);
