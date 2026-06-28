// Boot entry: pick the platform adapter, wire core systems, create the game,
// run the loop, and surface a friendly fatal-error screen if anything throws.

import { detectPlatform, createAdapter } from "./platform/index.js";
import { Store } from "./systems/save.js";
import { AudioEngine } from "./core/audio.js";
import { Input } from "./core/input.js";
import { Loop } from "./core/loop.js";
import { Particles } from "./ui/particles.js";
import { Game } from "./game/game.js";

function ref(id) {
  return document.getElementById(id);
}

async function boot() {
  const refs = {
    hud: ref("hud"),
    home: ref("home"),
    play: ref("play"),
    board: ref("board"),
    keyboard: ref("keyboard"),
    boosters: ref("boosters"),
    message: ref("message"),
    overlay: ref("overlay"),
    toasts: ref("toasts"),
    fx: ref("fx"),
    loading: ref("loading"),
    loadingBar: ref("loading-bar"),
    loadingTip: ref("loading-tip"),
  };

  const platformId = detectPlatform();
  const adapter = createAdapter(platformId);

  const audio = new AudioEngine();
  const input = new Input();
  const particles = new Particles(refs.fx);
  const store = new Store(adapter);

  // Loading progress simulation (covers SDK init + asset readiness).
  const tips = [
    "Tip: Common starters like CRANE or SLATE reveal a lot.",
    "Tip: Hard Mode forces you to reuse every revealed clue.",
    "Tip: A new puzzle unlocks every day — keep your streak alive!",
    "Tip: Spend coins on boosters, skins and themes in the Shop.",
    "Tip: Watch how letters turn 🟩 green and 🟨 yellow.",
  ];
  if (refs.loadingTip) refs.loadingTip.textContent = tips[Math.floor(Math.random() * tips.length)];

  let progress = 0;
  const tick = setInterval(() => {
    progress = Math.min(90, progress + 8 + Math.random() * 12);
    if (refs.loadingBar) refs.loadingBar.style.width = progress + "%";
  }, 90);

  try {
    await adapter.init();
    await store.load();
  } catch (e) {
    // Non-fatal: continue with defaults/localStorage.
    console.warn("Init warning:", e);
  }

  // Audio unlock on first user gesture (autoplay-policy compliant).
  const unlock = () => {
    audio.unlock();
    audio.setSfxEnabled(store.state.settings.sfx);
    if (store.state.settings.music && !adapter.muted) audio.setMusicEnabled(true);
  };
  ["pointerdown", "keydown", "touchstart"].forEach((evt) =>
    window.addEventListener(evt, unlock, { once: true, passive: true })
  );

  input.attach(window);

  const loop = new Loop({
    update: (dt) => particles.update(dt),
    render: () => particles.render(),
    maxDt: 0.05,
  });

  // Resize handling for the particle canvas (dpr-aware, visualViewport-safe).
  const resize = () => particles.resize();
  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", resize);
  if (window.visualViewport) window.visualViewport.addEventListener("resize", resize);
  resize();

  const game = new Game({ refs, adapter, store, audio, input, particles, loop });
  window.__GAME__ = game; // exposed for the test harness

  await game.boot();
  loop.start();

  // Finish the loading bar and fade the splash out.
  clearInterval(tick);
  if (refs.loadingBar) refs.loadingBar.style.width = "100%";
  setTimeout(() => {
    if (refs.loading) {
      refs.loading.classList.add("loading--done");
      setTimeout(() => refs.loading && refs.loading.parentNode && refs.loading.parentNode.removeChild(refs.loading), 500);
    }
  }, 350);
}

function fatal(err) {
  console.error(err);
  const root = document.getElementById("loading") || document.body;
  const box = document.createElement("div");
  box.className = "fatal";
  box.innerHTML =
    '<div class="fatal__card"><h2>Something went wrong</h2>' +
    "<p>The game failed to start. Please reload the page.</p>" +
    '<button class="btn btn--accent" onclick="location.reload()">Reload</button></div>';
  root.appendChild(box);
}

boot().catch(fatal);
