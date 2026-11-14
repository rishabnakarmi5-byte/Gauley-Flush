// Regenerates the PNG icons from public/icon.svg using local Chromium. (It never touches public/dev-qr.png.)
// Usage: node scripts/make-icons.mjs   (needs playwright + a Chromium at /opt/pw-browsers/chromium or default)
import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'node:fs';

const svg = readFileSync(new URL('../public/icon.svg', import.meta.url), 'utf8');
const exe = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const out = (f) => new URL(`../public/${f}`, import.meta.url).pathname;

async function shot(html, size, file, omitBg = false) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<body style="margin:0;background:#0d0c0a">${html}</body>`);
  await page.screenshot({ path: out(file), omitBackground: omitBg });
  await page.close();
}
const icon = (size, pad = 0) => `<div style="width:${size}px;height:${size}px;background:#0d0c0a;display:flex;align-items:center;justify-content:center"><div style="width:${size - pad * 2}px;height:${size - pad * 2}px">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div></div>`;
await shot(icon(192), 192, 'icon-192.png');
await shot(icon(512), 512, 'icon-512.png');
await shot(icon(180), 180, 'apple-touch-icon.png');
await shot(icon(512, 64), 512, 'icon-maskable-512.png');

await browser.close();
console.log('icons written');
