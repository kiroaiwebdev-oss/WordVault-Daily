// Game orchestrator: state machine, gameplay flow, and wiring between the engine,
// UI components, systems, and the platform adapter. The single source of truth.

import { Board } from "../ui/board.js";
import { Keyboard } from "../ui/keyboard.js";
import { Hud } from "../ui/hud.js";
import { Screens } from "../ui/screens.js";
import { Home } from "../ui/home.js";
import { el, clear, qs } from "../ui/dom.js";

import { evaluateGuess, mergeKeyStates, isWin, emojiRow, STATE } from "./evaluate.js";
import { validateHardMode } from "./rules.js";
import * as Words from "../systems/words.js";
import { recordResult } from "../systems/stats.js";
import { addXp } from "../systems/profile.js";
import { evaluateAchievements } from "../systems/achievements.js";
import { ensureMissions, reportGameToMissions, claimMission } from "../systems/missions.js";
import * as Eco from "../systems/economy.js";
import { resolveTheme, applyTheme, THEMES } from "../config/themes.js";
import { SKIN_BY_ID } from "../config/shop.js";

export const GS = { LOADING: "loading", MENU: "menu", PLAYING: "playing", RESULTS: "results" };

const WIN_COINS_DAILY = [60, 48, 38, 30, 22, 15];
const WIN_XP_DAILY = [60, 52, 44, 36, 30, 24];

export class Game {
  constructor({ refs, adapter, store, audio, input, particles, loop }) {
    this.refs = refs;
    this.adapter = adapter;
    this.store = store;
    this.audio = audio;
    this.input = input;
    this.particles = particles;
    this.loop = loop;

    this.state = GS.LOADING;
    this.session = null;
    this.inputLocked = false;
    this.gamesSinceAd = 0;
    this._lastResultPayload = null;

    this.api = this._buildApi();
  }

  get save() { return this.store.state; }

  // ---- boot ------------------------------------------------------------
  async boot() {
    this.hud = new Hud(this.refs.hud, {
      onHome: () => {
        this.audio.unlock();
        this.sfx("click");
        // Context-aware: pause during play, quit from results, how-to on the menu.
        if (this.state === GS.PLAYING) this.pauseGame();
        else if (this.state === GS.RESULTS) this.quitToHome();
        else this.screens.openHowTo();
      },
      onSettings: () => { this.audio.unlock(); this.sfx("click"); this.screens.openSettings(); },
      onCoins: () => { this.audio.unlock(); this.sfx("click"); this.screens.openShop(); },
      onProfile: () => { this.audio.unlock(); this.sfx("click"); this.screens.openProfile(); },
    });
    this.screens = new Screens(this.refs.overlay, this.refs.toasts, this.api);
    this.home = new Home(this.refs.home, this.api);
    this.board = new Board(this.refs.board, { rows: 6, cols: 5 });
    this.keyboard = new Keyboard(this.refs.keyboard, (k) => { this.audio.unlock(); this.onKey(k); });
    this._buildBoosterBar();

    ensureMissions(this.save, Words.dayNumber(this.now()));
    this.applyVisualState();
    this.hud.update(this.save);

    this._wireInput();
    this._wireLifecycle();

    // Reconcile daily: if stored daily is from a previous day, archive/clear it.
    this._reconcileDaily();

    this.setState(GS.MENU);
    this.home.render();
    this.hud.setHomeMode(true);

    // First-run experience.
    if (!this.save.firstRunDone) {
      this.screens.openHowTo(() => {
        this.save.firstRunDone = true;
        this.store.save();
      });
    }

    this.adapter.loadingFinished();
  }

  now() { return new Date(); }

  // ---- visuals (theme + skin) -----------------------------------------
  applyVisualState() {
    const themeId = resolveTheme(this.save, this.now());
    applyTheme(document.documentElement, themeId, this.save.settings.highContrast);
    const skin = SKIN_BY_ID[this.save.skins.active] || SKIN_BY_ID.default;
    this.board.applySkin(skin.cls);
  }

  themeName() {
    const id = resolveTheme(this.save, this.now());
    return (THEMES[id] || THEMES.classic).name;
  }

  // ---- state machine ---------------------------------------------------
  setState(s) {
    this.state = s;
    const onPlay = s === GS.PLAYING;
    this.refs.play.classList.toggle("hidden", !(onPlay || s === GS.RESULTS));
    this.refs.home.classList.toggle("hidden", !(s === GS.MENU));
    this.input.enabled = onPlay && !this.inputLocked;
    this.keyboard.setEnabled(onPlay && !this.inputLocked);
    this.hud.setHomeMode(s === GS.MENU);
  }

  // ---- daily reconciliation -------------------------------------------
  _reconcileDaily() {
    const today = Words.dayNumber(this.now());
    const d = this.save.daily;
    if (d && d.day !== today) {
      // A new day started while a previous daily was unfinished -> count as loss
      // for streak purposes only if it was still playing.
      if (d.status === "playing") {
        recordResult(this.save, { won: false, rows: d.guesses.length, day: d.day, isDaily: true });
      }
      this.save.daily = null;
    }
    // Refresh missions for today.
    ensureMissions(this.save, today);
    this.save.lastSeenDay = today;
    this.store.save();
  }

  dailyStatus() {
    const today = Words.dayNumber(this.now());
    const d = this.save.daily;
    if (d && d.day === today) {
      return { status: d.status, rows: d.guesses.length };
    }
    return { status: "new", rows: 0 };
  }

  // ---- starting games --------------------------------------------------
  startDaily() {
    const today = Words.dayNumber(this.now());
    const answer = Words.dailyWord(this.now());
    this.save.daily = {
      day: today,
      answer,
      guesses: [],
      status: "playing",
      hintsUsed: 0,
      hardMode: this.save.settings.hardMode,
      maxRows: 6,
    };
    this.store.save();
    this._beginSessionFromDaily();
  }

  continueDaily() {
    const today = Words.dayNumber(this.now());
    const d = this.save.daily;
    if (!d || d.day !== today) return this.startDaily();
    if (d.status !== "playing") return this.viewDailyResult();
    this._beginSessionFromDaily();
  }

  _beginSessionFromDaily() {
    const d = this.save.daily;
    this.session = {
      mode: "daily",
      day: d.day,
      answer: d.answer,
      guesses: d.guesses.slice(),
      current: "",
      status: d.status,
      hintsUsed: d.hintsUsed || 0,
      hardMode: !!d.hardMode,
      maxRows: d.maxRows || 6,
      keyStates: {},
      knownLetters: new Set(),
      revealedPositions: new Set(),
      clues: [],
      awarded: false,
      continued: false,
    };
    this._enterPlay();
  }

  startPractice() {
    this.session = {
      mode: "practice",
      day: null,
      answer: Words.randomWord(),
      guesses: [],
      current: "",
      status: "playing",
      hintsUsed: 0,
      hardMode: this.save.settings.hardMode,
      maxRows: 6,
      keyStates: {},
      knownLetters: new Set(),
      revealedPositions: new Set(),
      clues: [],
      awarded: false,
      continued: false,
    };
    this._enterPlay();
  }

  _enterPlay() {
    this.board.reset();
    this.applyVisualState();
    this.keyboard.reset();
    this.inputLocked = false;
    // Rebuild board state from existing guesses (continuing a daily).
    for (let i = 0; i < this.session.guesses.length; i++) {
      const g = this.session.guesses[i];
      this.board.renderRow(i, g.guess, g.result);
      mergeKeyStates(this.session.keyStates, g.guess, g.result);
    }
    this.keyboard.applyStates(this.session.keyStates);
    this._renderModeBadge();
    this._renderClues();
    this._updateBoosterBar();
    this.setState(GS.PLAYING);
    // Size the board to fit the current viewport once layout is ready.
    if (typeof requestAnimationFrame !== "undefined") requestAnimationFrame(() => this.board.fit());
    else this.board.fit();
    this.adapter.gameplayStart();
    if (this.save.settings.music) this.audio.startMusic();
  }

  _renderModeBadge() {
    const badge = this.refs.message;
    clear(badge);
    const label = this.session.mode === "daily" ? `Daily #${this.session.day}` : "Practice";
    const tags = el("div", { class: "message__tags" }, [
      el("span", { class: "tag tag--mode" }, [label]),
      this.session.hardMode ? el("span", { class: "tag tag--hard" }, ["HARD"]) : null,
    ].filter(Boolean));
    badge.appendChild(tags);
    this.cluesEl = el("div", { class: "clues" });
    badge.appendChild(this.cluesEl);
  }

  _renderClues() {
    if (!this.cluesEl) return;
    clear(this.cluesEl);
    for (const c of this.session.clues) {
      this.cluesEl.appendChild(el("span", { class: "clue" }, [c]));
    }
  }

  // ---- input -----------------------------------------------------------
  _wireInput() {
    this.input.on("key", (k) => this.onKey(k));
    this.input.on("enter", () => this.onEnter());
    this.input.on("backspace", () => this.onBackspace());
  }

  onKey(k) {
    if (k === "enter") return this.onEnter();
    if (k === "backspace") return this.onBackspace();
    if (this.state !== GS.PLAYING || this.inputLocked || this.screens.isOpen()) return;
    const s = this.session;
    if (s.current.length >= 5) return;
    s.current += k;
    this.board.setCurrent(s.guesses.length, s.current);
    this.keyboard.pulse(k);
    this.sfx("key");
  }

  onBackspace() {
    if (this.state !== GS.PLAYING || this.inputLocked || this.screens.isOpen()) return;
    const s = this.session;
    if (s.current.length === 0) return;
    s.current = s.current.slice(0, -1);
    this.board.setCurrent(s.guesses.length, s.current);
    this.sfx("back");
  }

  onEnter() {
    if (this.state !== GS.PLAYING || this.inputLocked || this.screens.isOpen()) return;
    const s = this.session;
    const row = s.guesses.length;
    if (s.current.length < 5) {
      this.board.shakeRow(row);
      this.screens.toast("Not enough letters", "warn");
      this.sfx("error");
      return;
    }
    if (!Words.isValidWord(s.current)) {
      this.board.shakeRow(row);
      this.screens.toast("Not in word list", "warn");
      this.sfx("error");
      return;
    }
    if (s.hardMode) {
      const v = validateHardMode(s.current, s.guesses);
      if (!v.ok) {
        this.board.shakeRow(row);
        this.screens.toast(v.reason, "warn");
        this.sfx("error");
        return;
      }
    }
    this._submit(s.current);
  }

  _submit(guess) {
    const s = this.session;
    const row = s.guesses.length;
    const result = evaluateGuess(guess, s.answer);
    s.guesses.push({ guess, result });
    s.current = "";
    this.inputLocked = true;
    this.input.enabled = false;
    this.keyboard.setEnabled(false);

    let goodCount = 0;
    this.board.revealRow(row, guess, result, {
      onLetter: (st, c, tile) => {
        if (st === STATE.CORRECT) { this.sfx("flipGood"); goodCount++; this._spark(row, c, "var(--c-correct)"); }
        else if (st === STATE.PRESENT) { this.sfx("flip"); this._spark(row, c, "var(--c-present)", 6); }
        else { this.sfx("flip"); }
      },
      onDone: () => {
        mergeKeyStates(s.keyStates, guess, result);
        this.keyboard.applyStates(s.keyStates);
        this._persistDaily();
        const won = isWin(result);
        if (won) return this._win(row + 1);
        if (s.guesses.length >= s.maxRows) return this._lose();
        // continue
        this.inputLocked = false;
        this.input.enabled = true;
        this.keyboard.setEnabled(true);
        // Combo feedback for a strong guess (3+ greens)
        if (goodCount >= 3) this.screens.toast(goodCount === 5 ? "Incredible!" : "Nice!", "success", 900);
      },
    });
  }

  _persistDaily() {
    if (this.session.mode !== "daily") return;
    const d = this.save.daily;
    if (!d) return;
    d.guesses = this.session.guesses.slice();
    d.status = this.session.status;
    d.hintsUsed = this.session.hintsUsed;
    d.maxRows = this.session.maxRows;
    this.store.save();
  }

  // ---- win / lose ------------------------------------------------------
  _win(rows) {
    const s = this.session;
    s.status = "won";
    this.sfx("win");
    this.adapter.happyTime();
    this.board.bounceRow(rows - 1);
    const ace = rows === 1;
    if (ace || this.save.stats.currentStreak + 1 >= 5) this.particles.goldenRain(90);
    this.particles.confetti(ace ? 160 : 120);

    const earned = this._award(true, rows);
    this._finishGame(true, rows, earned);
  }

  _lose() {
    const s = this.session;
    // Offer a one-time continue via rewarded ad (no soft-lock; skippable).
    if (!s.continued) {
      this._offerContinue();
      return;
    }
    s.status = "lost";
    this.sfx("lose");
    const earned = this._award(false, s.guesses.length);
    this._finishGame(false, s.guesses.length, earned);
  }

  _offerContinue() {
    const s = this.session;
    // Build a custom prompt (adblock-safe: "Give Up" always available).
    const body = el("div", { class: "continue" }, [
      el("p", {}, ["Out of guesses! Watch a short ad to reveal a letter and earn one extra guess."]),
    ]);
    const watch = el("button", { class: "btn btn--accent btn--block", type: "button" }, ["🎬 Watch & Continue"]);
    const give = el("button", { class: "btn btn--ghost btn--block", type: "button" }, ["Give Up"]);
    const footer = el("div", { class: "menu-list" }, [watch, give]);
    const dlg = this.screens.open("One More Guess?", body, { cls: "panel--narrow", footer });
    watch.addEventListener("click", async () => {
      this.sfx("click");
      watch.disabled = true; watch.textContent = "Loading…";
      const ok = await this._rewardedAd();
      if (ok) {
        dlg.close();
        s.continued = true;
        s.maxRows += 1;
        this.board.addExtraRow();
        this._useReveal(true);
        this.inputLocked = false;
        this.input.enabled = true;
        this.keyboard.setEnabled(true);
        this._persistDaily();
        this.screens.toast("Bonus guess granted!", "success");
      } else {
        watch.disabled = false; watch.textContent = "🎬 Watch & Continue";
        this.screens.toast("Ad not available", "warn");
      }
    });
    give.addEventListener("click", () => {
      this.sfx("click");
      dlg.close();
      s.continued = true;
      this._lose();
    });
  }

  _award(won, rows) {
    const s = this.session;
    let coins = 0, xp = 0;
    if (won) {
      const base = s.mode === "daily" ? 1 : 0.6;
      coins = Math.round((WIN_COINS_DAILY[Math.min(5, rows - 1)] || 15) * base);
      xp = Math.round((WIN_XP_DAILY[Math.min(5, rows - 1)] || 24) * base);
      if (s.hardMode) { coins = Math.round(coins * 1.25); xp = Math.round(xp * 1.25); }
    } else {
      coins = 5; xp = 12;
    }
    Eco.addCoins(this.save, coins);
    const lvl = addXp(this.save, xp);
    s._leveledUp = lvl.leveledUp;
    s._newLevel = lvl.newLevel;
    return { coins, xp };
  }

  _finishGame(won, rows, earned) {
    const s = this.session;
    s.status = won ? "won" : "lost";

    // Stats + persistence
    recordResult(this.save, { won, rows, day: s.day, isDaily: s.mode === "daily" });
    this._persistDaily();

    // Achievements
    const ctx = { won, rows, hardMode: s.hardMode, hintsUsed: s.hintsUsed, coinsEarned: earned.coins, isDaily: s.mode === "daily" };
    const newAch = evaluateAchievements(this.save, ctx);

    // Missions
    reportGameToMissions(this.save, ctx);

    // Persist daily summary for re-viewing
    if (s.mode === "daily" && this.save.daily) {
      this.save.daily.coinsEarned = earned.coins;
      this.save.daily.xpEarned = earned.xp;
    }

    this.store.save();
    this.hud.update(this.save);
    this.hud.pulseCoins();
    this.adapter.gameplayStop();

    const shareText = this._shareText(won, rows);
    const payload = {
      won, answer: s.answer, rows, mode: s.mode, day: s.day,
      coinsEarned: earned.coins, xpEarned: earned.xp, shareText, newAchievements: newAch,
    };
    this._lastResultPayload = payload;
    this.setState(GS.RESULTS);

    const delay = won ? 1400 : 900;
    setTimeout(() => {
      if (s._leveledUp) this.screens.toast(`Level up! You reached level ${s._newLevel} ⭐`, "success", 2200);
      this.screens.openResults(payload);
    }, delay);
  }

  viewDailyResult() {
    const d = this.save.daily;
    if (!d) return;
    // Rebuild a read-only session for display.
    this.session = {
      mode: "daily", day: d.day, answer: d.answer, guesses: d.guesses.slice(),
      current: "", status: d.status, hintsUsed: d.hintsUsed || 0, hardMode: !!d.hardMode,
      maxRows: d.maxRows || 6, keyStates: {}, knownLetters: new Set(), revealedPositions: new Set(),
      clues: [], awarded: true, continued: true,
    };
    this.board.reset();
    this.applyVisualState();
    for (let i = 0; i < d.guesses.length; i++) {
      this.board.renderRow(i, d.guesses[i].guess, d.guesses[i].result);
      mergeKeyStates(this.session.keyStates, d.guesses[i].guess, d.guesses[i].result);
    }
    this.keyboard.applyStates(this.session.keyStates);
    this._renderModeBadge();
    this._updateBoosterBar();
    this.setState(GS.RESULTS);
    if (typeof requestAnimationFrame !== "undefined") requestAnimationFrame(() => this.board.fit());
    const won = d.status === "won";
    this.screens.openResults({
      won, answer: d.answer, rows: d.guesses.length, mode: "daily", day: d.day,
      coinsEarned: d.coinsEarned || 0, xpEarned: d.xpEarned || 0,
      shareText: this._shareText(won, d.guesses.length), newAchievements: [],
    });
  }

  _shareText(won, rows) {
    const s = this.session;
    const dark = !this.save.settings.highContrast;
    const head = s.mode === "daily"
      ? `WordVault #${s.day} ${won ? rows : "X"}/6${s.hardMode ? "*" : ""}`
      : `WordVault Practice ${won ? rows : "X"}/6${s.hardMode ? "*" : ""}`;
    const grid = s.guesses.map((g) => emojiRow(g.result, dark)).join("\n");
    return head + "\n\n" + grid;
  }

  // ---- particles -------------------------------------------------------
  _spark(row, col, color, count = 12) {
    const c = this.board.tileCenter(row, col);
    const rect = this.refs.fx.getBoundingClientRect();
    this.particles.burst(c.x - rect.left, c.y - rect.top, this._cssColor(color), count, { spread: 4, life: 0.7 });
  }

  _cssColor(v) {
    if (v && v.startsWith("var(")) {
      const name = v.slice(4, -1).trim();
      const val = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return val || "#6aaa64";
    }
    return v;
  }

  // ---- boosters --------------------------------------------------------
  _buildBoosterBar() {
    const bar = this.refs.boosters;
    clear(bar);
    this.boosterBtns = {};
    const mk = (id, icon, label) => {
      const badge = el("span", { class: "booster__badge" }, ["0"]);
      const btn = el("button", { class: "booster", type: "button", title: label }, [
        el("span", { class: "booster__ic" }, [icon]),
        el("span", { class: "booster__label" }, [label]),
        badge,
      ]);
      btn.addEventListener("click", () => { this.audio.unlock(); this.onBooster(id); });
      bar.appendChild(btn);
      this.boosterBtns[id] = { btn, badge };
    };
    mk("hint", "💡", "Hint");
    mk("reveal", "🔓", "Reveal");
    mk("skip", "⏭️", "Skip");
  }

  _updateBoosterBar() {
    if (!this.boosterBtns) return;
    for (const id of ["hint", "reveal", "skip"]) {
      const ref = this.boosterBtns[id];
      const n = this.save.inventory[id] || 0;
      ref.badge.textContent = String(n);
      ref.badge.classList.toggle("booster__badge--zero", n === 0);
      // Skip only meaningful in practice.
      const disabled = this.state !== GS.PLAYING || (id === "skip" && (!this.session || this.session.mode !== "practice"));
      ref.btn.disabled = disabled;
      ref.btn.classList.toggle("booster--off", disabled);
    }
  }

  onBooster(id) {
    if (this.state !== GS.PLAYING) return;
    const n = this.save.inventory[id] || 0;
    if (n <= 0) return this._refillBooster(id);
    if (id === "hint") {
      if (!this._useHint()) { this.screens.toast("No new letters to hint", "info"); return; }
    } else if (id === "reveal") {
      if (!this._useReveal()) { this.screens.toast("Nothing left to reveal", "info"); return; }
    } else if (id === "skip") {
      if (this.session.mode !== "practice") return;
      Eco.useBooster(this.save, "skip");
      this.store.save();
      this.startPractice();
      this.screens.toast("New word!", "info");
      this._updateBoosterBar();
      this.hud.update(this.save);
      return;
    }
    Eco.useBooster(this.save, id);
    this.store.save();
    this._updateBoosterBar();
  }

  _useHint() {
    const s = this.session;
    const letter = Words.bestHintLetter(s.answer, s.knownLetters);
    if (!letter) return false;
    s.knownLetters.add(letter);
    s.hintsUsed++;
    s.clues.push(`Has ${letter.toUpperCase()}`);
    this._renderClues();
    if (!s.keyStates[letter] || s.keyStates[letter] === "absent") {
      s.keyStates[letter] = "present";
      this.keyboard.applyStates(s.keyStates);
    }
    this.sfx("coin");
    this.screens.toast(`The word contains "${letter.toUpperCase()}"`, "success");
    this._persistDaily();
    return true;
  }

  _useReveal(free = false) {
    const s = this.session;
    let pos = -1;
    for (let i = 0; i < s.answer.length; i++) {
      if (!s.revealedPositions.has(i)) { pos = i; break; }
    }
    if (pos === -1) return false;
    s.revealedPositions.add(pos);
    const letter = s.answer[pos];
    s.knownLetters.add(letter);
    if (!free) s.hintsUsed++;
    s.clues.push(`#${pos + 1} = ${letter.toUpperCase()}`);
    this._renderClues();
    s.keyStates[letter] = "correct";
    this.keyboard.applyStates(s.keyStates);
    this.sfx("coin");
    this.screens.toast(`Position ${pos + 1} is "${letter.toUpperCase()}"`, "success");
    this._persistDaily();
    return true;
  }

  _refillBooster(id) {
    const body = el("div", {}, [el("p", {}, ["You're out of this booster. Watch a short ad for +1, or visit the Shop."])]);
    const watch = el("button", { class: "btn btn--accent btn--block", type: "button" }, ["🎬 Watch for +1"]);
    const shop = el("button", { class: "btn btn--ghost btn--block", type: "button" }, ["🛒 Open Shop"]);
    const footer = el("div", { class: "menu-list" }, [watch, shop]);
    const dlg = this.screens.open("Out of Boosters", body, { cls: "panel--narrow", footer });
    watch.addEventListener("click", async () => {
      this.sfx("click");
      watch.disabled = true; watch.textContent = "Loading…";
      const ok = await this._rewardedAd();
      if (ok) {
        this.save.inventory[id] = (this.save.inventory[id] || 0) + 1;
        this.store.save();
        this._updateBoosterBar();
        dlg.close();
        this.screens.toast("+1 booster!", "success");
      } else {
        watch.disabled = false; watch.textContent = "🎬 Watch for +1";
        this.screens.toast("Ad not available", "warn");
      }
    });
    shop.addEventListener("click", () => { this.sfx("click"); dlg.close(); this.screens.openShop(); });
  }

  // ---- ads -------------------------------------------------------------
  async _rewardedAd() {
    this.audio.suspend();
    let ok = false;
    try { ok = await this.adapter.showRewardedAd(); } catch (e) { ok = false; }
    this.audio.resume();
    return !!ok;
  }

  async _maybeInterstitial() {
    this.gamesSinceAd++;
    if (this.gamesSinceAd >= 3) {
      this.gamesSinceAd = 0;
      this.audio.suspend();
      try { await this.adapter.showInterstitial(); } catch (e) {}
      this.audio.resume();
    }
  }

  // ---- navigation / lifecycle -----------------------------------------
  quitToHome() {
    this.screens.close();
    this.adapter.gameplayStop();
    this.session = null;
    this.setState(GS.MENU);
    this.applyVisualState();
    this.hud.update(this.save);
    this.home.render();
  }

  onResultsClosed() {
    // Called when the results panel is dismissed.
    if (this.state === GS.RESULTS) {
      this.quitToHome();
      this._maybeInterstitial();
    }
  }

  resumeFromPause() {
    if (this.state === GS.PLAYING) {
      this.loop.resume();
      this.input.enabled = !this.inputLocked;
      this.keyboard.setEnabled(!this.inputLocked);
      this.adapter.gameplayStart();
      if (this.save.settings.music) this.audio.startMusic();
    }
  }

  pauseGame() {
    if (this.state === GS.PLAYING && !this.screens.isOpen()) {
      // Input is blocked by the open-modal guard, so we don't disable it here
      // (avoids any soft-lock if a sub-screen closes without an explicit resume).
      this.adapter.gameplayStop();
      this.audio.stopMusic();
      this.screens.openPause();
    }
  }

  _wireLifecycle() {
    if (typeof window !== "undefined") {
      const onResize = () => {
        if (this.state === GS.PLAYING || this.state === GS.RESULTS) this.board.fit();
      };
      this._onResize = onResize;
      window.addEventListener("resize", onResize);
      window.addEventListener("orientationchange", () => setTimeout(onResize, 150));
      if (window.visualViewport && window.visualViewport.addEventListener) {
        window.visualViewport.addEventListener("resize", onResize);
      }
    }
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
          this.loop.pause();
          this.audio.suspend();
          this.adapter.gameplayStop();
        } else {
          this.loop.resume();
          if (!this.adapter.muted) this.audio.resume();
          if (this.state === GS.PLAYING) this.adapter.gameplayStart();
        }
      });
    }
    if (typeof window !== "undefined") {
      window.addEventListener("blur", () => { this.audio.stopMusic(); });
      window.addEventListener("focus", () => { this.loop.resume(); if (this.save.settings.music && !this.adapter.muted) this.audio.startMusic(); });
    }
    // Adapter mute (portal) takes priority over the in-game toggle.
    this.adapter.onMuteChange((muted) => {
      this.audio.setPlatformMuted(muted);
    });
  }

  // ---- settings --------------------------------------------------------
  setSetting(key, val) {
    this.save.settings[key] = val;
    if (key === "sfx") this.audio.setSfxEnabled(val);
    if (key === "music") this.audio.setMusicEnabled(val);
    if (key === "autoTheme" || key === "highContrast") this.applyVisualState();
    if (key === "autoTheme" && val) {
      // re-resolve to today's theme
      this.applyVisualState();
    }
    this.store.save();
    this.hud.update(this.save);
    if (this.state === GS.MENU) this.home.render();
  }

  // ---- shareable / clipboard ------------------------------------------
  async share(text) {
    try {
      if (navigator.share) {
        await navigator.share({ text });
        return true;
      }
    } catch (e) { /* user cancelled or unsupported -> fall through to clipboard */ }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) {}
    // Legacy fallback
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch (e) { return false; }
  }

  sfx(name) {
    if (this.audio && typeof this.audio[name] === "function") this.audio[name]();
  }

  // ---- API surface for UI components ----------------------------------
  _buildApi() {
    return {
      state: () => this.save,
      now: () => this.now(),
      dayNumber: () => Words.dayNumber(this.now()),
      themeName: () => this.themeName(),
      sfx: (n) => this.sfx(n),
      missions: () => this.save.missions.list || [],
      dailyStatus: () => this.dailyStatus(),

      startDaily: () => this.startDaily(),
      continueDaily: () => this.continueDaily(),
      startPractice: () => this.startPractice(),
      viewDailyResult: () => this.viewDailyResult(),
      quitToHome: () => this.quitToHome(),
      resumeFromPause: () => this.resumeFromPause(),
      onResultsClosed: () => this.onResultsClosed(),

      openShop: () => this.screens.openShop(),
      openSkins: () => this.screens.openSkins(),
      openThemes: () => this.screens.openThemes(),
      openAchievements: () => this.screens.openAchievements(),
      openStats: () => this.screens.openStats(),
      openHowTo: () => this.screens.openHowTo(),
      openProfile: () => this.screens.openProfile(),
      openDailyReward: () => this.screens.openDailyReward(),

      setSetting: (k, v) => this.setSetting(k, v),
      setAvatar: (i) => { this.save.profile.avatar = i; this.store.save(); this.hud.update(this.save); },
      resetProgress: () => { this.store.reset(); ensureMissions(this.save, Words.dayNumber(this.now())); this.applyVisualState(); this.hud.update(this.save); this.home.render(); this._updateBoosterBar(); },

      buyBooster: (id) => { const r = Eco.buyBooster(this.save, id); if (r.ok) { this.store.save(); this.hud.update(this.save); this._updateBoosterBar(); } return r; },
      buySkin: (id) => { const r = Eco.buySkin(this.save, id); if (r.ok) { this.store.save(); this.hud.update(this.save); } return r; },
      equipSkin: (id) => { const ok = Eco.equipSkin(this.save, id); if (ok) { this.store.save(); this.applyVisualState(); } return ok; },
      buyTheme: (id) => { const r = Eco.buyTheme(this.save, id); if (r.ok) { this.store.save(); this.hud.update(this.save); } return r; },
      equipTheme: (id) => { const ok = Eco.equipTheme(this.save, id); if (ok) { this.store.save(); this.applyVisualState(); if (this.state === GS.MENU) this.home.render(); } return ok; },

      claimMission: (id) => { const r = claimMission(this.save, id); if (r) { this.store.save(); this.hud.update(this.save); } return r; },
      claimDailyReward: () => { const r = Eco.claimDailyReward(this.save, Words.dayNumber(this.now())); if (r.ok) { this.store.save(); this.hud.update(this.save); this.home.render(); } return r; },
      watchAdForCoins: async () => { const ok = await this._rewardedAd(); if (ok) { Eco.addCoins(this.save, 50); this.store.save(); this.hud.update(this.save); this.hud.pulseCoins(); } return ok; },
      share: (t) => this.share(t),
    };
  }
}
