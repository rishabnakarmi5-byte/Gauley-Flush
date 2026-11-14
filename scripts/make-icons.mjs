// Regenerates PNG icons and the placeholder developer QR from HTML using local Chromium.
// Usage: node scripts/make-icons.mjs   (needs playwright + a Chromium at /opt/pw-browsers/chromium or default)
import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'node:fs';

const svg = readFileSync(new URL('../public/icon.svg', import.meta.url), 'utf8');
const exe = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const out = (f) => new URL(`../public/${f}`, import.meta.url).pathname;

async function shot(html, size, file, omitBg = false) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<body style="margin:0;background:#0a2a1e">${html}</body>`);
  await page.screenshot({ path: out(file), omitBackground: omitBg });
  await page.close();
}
const icon = (size, pad = 0) => `<div style="width:${size}px;height:${size}px;background:#0a2a1e;display:flex;align-items:center;justify-content:center"><div style="width:${size - pad * 2}px;height:${size - pad * 2}px">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div></div>`;
await shot(icon(192), 192, 'icon-192.png');
await shot(icon(512), 512, 'icon-512.png');
await shot(icon(180), 180, 'apple-touch-icon.png');
await shot(icon(512, 64), 512, 'icon-maskable-512.png');

const placeholder = `<div style="width:512px;height:512px;background:#fbf4dd;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:Georgia,serif;color:#07251a;box-sizing:border-box;border:14px dashed #b98a22;text-align:center;padding:30px">
  <div style="font-size:150px;line-height:1">&#9638;</div>
  <div style="font-size:40px;font-weight:700;margin-top:18px">Developer QR<br>coming soon</div>
  <div style="font-size:20px;margin-top:18px;opacity:.7">placeholder: replace public/dev-qr.png</div></div>`;
await shot(placeholder, 512, 'dev-qr.png');
await browser.close();
console.log('icons written');
