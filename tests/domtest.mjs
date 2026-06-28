// DOM/render harness: boots the REAL game with a stubbed DOM, then drives input
// and asserts behavior — letters render, evaluation flips, a win is detected and
// rewarded, invalid words are rejected, hard mode enforces clues, the keyboard
// works, and a button audit confirms no dead controls on the live screens.

import { setupDom, sleep } from "./fakedom.mjs";

setupDom();

const { Game } = await import("../src/game/game.js");
const { Store } = await import("../src/systems/save.js");
const { AudioEngine } = await import("../src/core/audio.js");
const { Input } = await import("../src/core/input.js");
const { Loop } = await import("../src/core/loop.js");
const { Particles } = await import("../src/ui/particles.js");
const { StandaloneAdapter } = await import("../src/platform/standalone.js");

let pass = 0;
const checks = [];
function check(name, cond) {
  if (cond) { pass++; console.log("  ✓ " + name); }
  else { console.error("  ✗ " + name); process.exitCode = 1; }
}

function refsFromDom() {
  const ids = ["hud","rail","home","play","board","keyboard","boosters","message","overlay","toasts","fx","loading","loading-bar","loading-tip"];
  const r = {};
  for (const id of ids) r[id.replace(/-(\w)/g, (_, c) => c.toUpperCase())] = document.getElementById(id);
  // map ids with dashes
  r.loadingBar = document.getElementById("loading-bar");
  r.loadingTip = document.getElementById("loading-tip");
  return r;
}

function collectButtons(node, out = []) {
  if (!node) return out;
  if (node.tagName === "BUTTON") out.push(node);
  for (const c of node.children) collectButtons(c, out);
  return out;
}

function type(game, word) {
  for (const ch of word) game.onKey(ch);
}

async function main() {
  console.log("DOM/render harness");

  const refs = refsFromDom();
  const adapter = new StandaloneAdapter();
  const audio = new AudioEngine();
  const input = new Input();
  const particles = new Particles(refs.fx);
  const store = new Store(adapter);
  const loop = new Loop({ update() {}, render() {} });

  await store.load();
  const game = new Game({ refs, adapter, store, audio, input, particles, loop });
  await game.boot();
  game.screens.close(); // dismiss first-run how-to overlay

  check("home screen renders content", refs.home.children.length > 0);
  check("hud renders chips", refs.hud.children.length >= 3);

  // --- Start practice and play a winning game ---
  game.startPractice();
  game.session.answer = "crane";
  check("board has 6 rows", game.board.cells.length === 6);
  check("keyboard built (a key exists)", !!game.keyboard.keyEls["a"]);

  type(game, "cr");
  check("typed letters render on board front face", game.board.cells[0][0].querySelector(".tile__front").textContent === "C");
  game.onBackspace();
  check("backspace removes a letter", game.session.current === "c");
  type(game, "rane"); // now 'crane'
  check("current buffer filled to 5", game.session.current === "crane");

  game.onEnter();
  await sleep(3200);
  check("win detected", game.session.status === "won");
  check("guess recorded", game.session.guesses.length === 1);
  check("win incremented stats", store.state.stats.wins >= 1);
  check("coins awarded on win", store.state.coins > 50);
  check("results overlay shown", refs.overlay.children.length > 0);

  // Button audit on the results overlay.
  let resultBtns = collectButtons(refs.overlay);
  let dead = resultBtns.filter((b) => !b.disabled && !(b._listeners.click && b._listeners.click.length));
  check("results overlay: no dead buttons (" + resultBtns.length + " audited)", dead.length === 0);
  game.screens.close();
  game.quitToHome();

  // --- Invalid word rejection ---
  game.startPractice();
  game.session.answer = "crane";
  type(game, "zzzzz"); // not a valid word
  const beforeGuesses = game.session.guesses.length;
  game.onEnter();
  await sleep(50);
  check("invalid word not accepted", game.session.guesses.length === beforeGuesses);
  check("invalid word shows a toast", refs.toasts.children.length > 0);

  // --- Hard mode enforcement ---
  game.quitToHome();
  store.state.settings.hardMode = true;
  game.startPractice();
  game.session.answer = "crane";
  // First guess 'slate' -> reveals some letters; then a guess ignoring greens should be blocked.
  game.session.answer = "crane";
  type(game, "crane".slice(0,0)); // noop
  // make a guess "crook" so 'c' green at pos0, 'r' present etc.
  type(game, "crisp");
  game.onEnter();
  await sleep(2000);
  // Now 'c' is green at position 0 (answer crane). A guess not starting with c should be rejected.
  const before2 = game.session.guesses.length;
  type(game, "blink");
  game.onEnter();
  await sleep(50);
  check("hard mode blocks guess that drops a green", game.session.guesses.length === before2);
  store.state.settings.hardMode = false;
  game.screens.close();
  game.quitToHome();

  // --- Keyboard click drives input ---
  game.startPractice();
  game.session.answer = "table";
  game.keyboard.keyEls["t"].click();
  check("clicking keyboard key types a letter", game.session.current === "t");

  // --- Booster: hint marks a clue ---
  store.state.inventory.hint = 1;
  game._updateBoosterBar();
  const huBefore = game.session.hintsUsed;
  game.boosterBtns.hint.btn.click();
  check("hint booster reveals a clue", game.session.hintsUsed === huBefore + 1 && game.session.clues.length > 0);

  game.quitToHome();

  // --- Button audit across home + a couple of opened panels ---
  let homeBtns = collectButtons(refs.home);
  let homeDead = homeBtns.filter((b) => !b.disabled && !(b._listeners.click && b._listeners.click.length));
  check("home: no dead buttons (" + homeBtns.length + " audited)", homeDead.length === 0);

  game.screens.openShop();
  let shopBtns = collectButtons(refs.overlay);
  let shopDead = shopBtns.filter((b) => !b.disabled && !(b._listeners.click && b._listeners.click.length));
  check("shop: no dead buttons (" + shopBtns.length + " audited)", shopDead.length === 0);
  game.screens.close();

  game.screens.openSettings();
  let setBtns = collectButtons(refs.overlay);
  let setDead = setBtns.filter((b) => !b.disabled && !(b._listeners.click && b._listeners.click.length));
  check("settings: no dead buttons (" + setBtns.length + " audited)", setDead.length === 0);
  game.screens.close();

  // Keyboard audit
  let keyBtns = collectButtons(refs.keyboard);
  let keyDead = keyBtns.filter((b) => !(b._listeners.click && b._listeners.click.length));
  check("keyboard: all keys wired (" + keyBtns.length + ")", keyDead.length === 0 && keyBtns.length === 28);

  // Desktop rail audit
  let railBtns = collectButtons(refs.rail);
  let railDead = railBtns.filter((b) => !(b._listeners.click && b._listeners.click.length));
  check("rail: nav built + all wired (" + railBtns.length + ")", railBtns.length === 8 && railDead.length === 0);

  console.log(`DOM harness: ${pass} checks passed`);
}

main().catch((e) => { console.error(e); process.exit(1); });
