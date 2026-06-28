# WordVault Daily — Deployment Guide

A polished, dependency-free HTML5 daily word game. Pure vanilla ES modules, tiny
footprint (~68 KB zipped per platform), fully responsive, iframe-safe, and
adblock-safe. This guide covers local testing, building per-platform packages,
and uploading to each supported portal.

---

## 1. Run it locally

ES modules must be served over HTTP (not `file://`):

```bash
npm run serve        # then open http://localhost:8080
# or: node tools/serve.mjs 8080
```

Run the automated test suites (no dependencies needed):

```bash
npm test             # logic + DOM harness + SDK probes
npm run test:logic   # pure logic only
npm run test:dom     # boots the real game headlessly and drives input
npm run test:sdk     # mocks portal SDKs and checks the ad/save contract
```

## 2. Build per-platform packages

```bash
npm run build                 # builds ALL platforms into dist/
node tools/build.mjs crazygames poki   # build a subset
```

Each build produces `dist/<platform>/` and `dist/<platform>.zip` with:
- `index.html` at the **zip root** (required by every portal),
- the correct portal SDK `<script>` injected,
- `window.__PLATFORM__` set so the right adapter is selected,
- a fresh **cache-busting version token** stamped on `styles.css` and `main.js`.

You can also test any adapter locally without rebuilding via a query param:
`http://localhost:8080/?platform=crazygames`.

## 3. Platform-specific upload notes

The game **never crashes if an SDK is blocked or an ad is unfilled** — it always
falls back to a built-in skippable overlay and a "continue / give up" path, so
there are no soft-locks.

| Platform | Upload | What YOU must provide |
|---|---|---|
| **itch.io / standalone** | Upload `dist/standalone.zip`, mark as "play in browser". | Nothing. |
| **CrazyGames** | Upload `dist/crazygames.zip`. | Nothing for SDK; submit through the CrazyGames developer portal. |
| **GameDistribution** | Upload `dist/gamedistribution.zip`. | Replace `__GD_GAME_ID__` in `index.html` with your GD game id. |
| **Poki** | Upload `dist/poki.zip` (Poki Inspector / dev dashboard). | Nothing for SDK; follow Poki's QA checklist. |
| **Y8** | Upload `dist/y8.zip`. | Replace `__Y8_API_KEY__` with your Y8 API key. |
| **GamePix** | Upload `dist/gamepix.zip`. | Nothing for SDK; register the game in GamePix dashboard. |
| **GameMonetize** | Upload `dist/gamemonetize.zip`. | Replace `__GM_GAME_ID__` with your GameMonetize game id. |
| **Playgama (Bridge)** | Upload `dist/playgama.zip`. | Configure the game in the Playgama dashboard. |
| **CoolMath Games** | Use `dist/standalone.zip`. | Submit via CoolMath's partner process (no ad SDK required). |

> Placeholders like `__GD_GAME_ID__` only appear in the builds for portals that
> require an account-specific id. Search-and-replace them in the generated
> `dist/<platform>/index.html` (or re-zip after editing) before submitting.

## 4. What's wired for monetization

- **Rewarded ads**: "Watch & Earn" coins in the Shop, refill boosters, and a
  one-time "watch for a bonus guess" continue on loss. Rewards are granted **only
  on real ad completion**; denied on adblock/error.
- **Interstitials**: shown occasionally when returning to the home screen
  (rate-limited), with audio muted/paused during the ad and resumed after.
- **Gameplay signals**: `gameplayStart` / `gameplayStop` fire on the correct
  transitions; `happyTime` fires on wins.
- **Cloud save**: used automatically where the portal SDK supports it
  (CrazyGames, Playgama); otherwise `localStorage`.
- **Mute priority**: a portal mute signal overrides the in-game audio toggle.

## 5. Cache busting

Every build stamps a unique version token onto the CSS and entry script, so
re-uploads never serve stale assets. No manual cache management needed.

## 6. Architecture (for future expansion)

```
src/core/      loop, input, audio, rng         (game-agnostic engine)
src/game/      game.js (state machine), evaluate, rules
src/systems/   words, stats, profile, economy, missions, achievements, save
src/ui/        board, keyboard, hud, screens, home, particles, dom helpers
src/platform/  one adapter per portal + detection registry (the only ad/save seam)
src/config/    data-driven content: themes, achievements, missions, shop
src/data/      bundled word lists
tools/         build.mjs (packaging), serve.mjs (local server)
tests/         selftest (logic), domtest (DOM/render), sdkprobe (SDK contract)
```

Add words in `src/data/words.js`, themes in `src/config/themes.js`, achievements
in `src/config/achievements.js`, shop items in `src/config/shop.js`. The game
talks to portals **only** through `src/platform/adapter.js` — add a new portal by
dropping in one adapter file and registering it in `src/platform/index.js`.
