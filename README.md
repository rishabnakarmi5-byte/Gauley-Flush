# Gauley Flush

A digital pot and ledger for the Nepali card game **Flush** (Teen Patti, "chal"). Play with a real deck; the app replaces the Rs 5/10 notes. It never deals cards and never judges hands. It tracks boot, chaals, the pot, everyone's running credit/debit in real time, and at the end tells you who pays whom.

- Cloudflare Worker + one SQLite-backed Durable Object (`Room`) per table, WebSocket Hibernation API, rooms expire after 24h of silence.
- Pure TypeScript game engine in `src/engine/` (reducer: `apply(state, action, ctx) -> {state} | {error}`), shared by the Durable Object and the tests. All money logic lives there.
- Vite + Preact frontend with hand-written CSS and self-hosted fonts (Fraunces, Inter, Noto Serif Devanagari/Tibetan), served by Workers static assets from the same Worker.

## Run locally

```bash
npm install
npm run dev          # builds the frontend, then `wrangler dev` on http://localhost:8787
```

Open it on a phone on the same network with `http://<your-ip>:8787` (add `--ip 0.0.0.0` to the wrangler command if needed). For frontend hot reload run `npx wrangler dev` in one terminal and `npm run dev:ui` in another (Vite proxies `/api` to wrangler).

## Test

```bash
npm test             # vitest: engine unit tests, randomized property test, Google token verification
npm run typecheck    # tsc --noEmit
npm run e2e          # builds, starts two local `wrangler dev` instances, runs Playwright flows
```

The e2e runner uses the pre-installed Chromium at `/opt/pw-browsers/chromium` when present (no `playwright install` needed). `npm run e2e` also checks that the banknote pile equals the pot, the witty line, and the feedback API. Screenshots go to `$SHOTS` (default is the scratchpad `shots/` directory, see `e2e/e2e.mjs`).

## Deploy

```bash
npx wrangler login
npm run deploy       # builds, then `wrangler deploy` (worker name: gauley-flush)
npx wrangler deploy --dry-run   # sanity check without publishing
```

The `v1` migration uses `new_sqlite_classes`, so it works on the free plan.

## Developer QR

Winners (net > 0) get an opt-in "send 5% to the developer" prompt that shows `public/dev-qr.png` (a real eSewa QR, portrait, shown uncropped on a white panel). To change it, replace that one file. `scripts/make-icons.mjs` regenerates only the app icons and never touches it.

## Banknotes (the pot)

The pot is a heap of drawn mock Nepali notes (`src/client/note.tsx`). Each contribution is split greedily (1000, 500, 100, 50, 20, 10, 5, then coins 2 and 1) in `src/client/notes.ts`; poses are seeded from (hand, contribution, note) so every phone shows the same heap, and above 40 pieces the oldest contributions are re-bundled into larger notes (it always adds up exactly; covered by `tests/notes.test.ts`).

- Correct the colours in one place: `NOTE_COLOURS` in `src/client/note.tsx`.
- Swap in real photos later: put an image URL in `NOTE_PHOTOS` (same file), for example `NOTE_PHOTOS[100] = '/notes/100.jpg'` and drop the file in `public/notes/`. That denomination is then shown as the photo with the same "नमुना" watermark on top. The map is empty today.

## Witty lines and feedback

Lines live in `src/client/lines.ts`; tap a line to cycle script, romanised, English. Thumbs up/down are stored per device in `localStorage` and sent to `POST /api/feedback`, which is kept by a SQLite Durable Object (`Feedback`, migration `v2`, one instance named `global`; one row per device and line, 20,000 rows total and 500 per device at most, rate limited).

Owner access: set a secret key, then open `/#/feedback` and type it.

```bash
npx wrangler secret put ADMIN_KEY      # production
cp .dev.vars.example .dev.vars         # local `wrangler dev`
```

`GET /api/feedback/export?key=KEY` returns `{ summary: [{lineId, lang, up, down}], comments: [{lineId, lang, vote, text, at}] }`; add `&format=csv` for CSV (one row per vote, or `&view=summary`). Without a matching `ADMIN_KEY` the route answers 404.

## Enable Google sign-in (optional)

1. In Google Cloud Console create an OAuth client of type **Web application** and add your site origin (for example `https://gauley-flush.<you>.workers.dev`, plus `http://localhost:8787` for local testing) to the authorised JavaScript origins.
2. Put the client id in `wrangler.jsonc` under `vars.GOOGLE_CLIENT_ID` (or `npx wrangler secret put`-style dashboard var), then redeploy.
3. The client reads it from `GET /api/config` and shows "Continue with Google". ID tokens are verified server-side against Google's JWKS (signature, `aud`, `iss`, `exp`) and the seat is tied to the Google `sub`, so joining the same table from another device with the same Google account recovers the seat.

With `GOOGLE_CLIENT_ID` empty (default) the button is hidden and everything works with name + code.

## How it plays

Host taps **New hand**, everyone taps **Boot** (or sits out), anyone in the hand bets any amount with chips at any time (no turn order), **Pack** forfeits, **I won** asks one other player from the hand to **Confirm** (or Reject). Undo your own last chaal; the host can void a hand or undo the last award. Optional per-player classic limits (blind/seen). When everyone connected agrees, **End game** shows the minimal "A pays B Rs X" transfers.

Tablet mode: one device creates the table, adds everyone's name locally and acts for every seat (pick a seat, then act). Friends with phones can still join the same table by code.

## Layout

```
src/engine/    pure game engine (types, reducer, settlement)
src/worker/    Worker entry, Room Durable Object, Google token verification
src/client/    Preact UI (store.ts holds the WebSocket + state)
src/shared/    wire protocol types
tests/         vitest suites
e2e/           Playwright flows + runner for wrangler dev
public/        manifest, icons, dev-qr.png
```
