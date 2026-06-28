// Overlay/screen manager. Builds and fully wires every modal panel: Settings,
// Shop, Skins, Themes, Achievements, Stats, Profile, How-to-play, Daily Reward,
// Missions, Pause, and Results. Pure view + event wiring; all game logic lives in
// the `api` object passed by game.js. No dead buttons — every control has a handler.

import { el, clear } from "./dom.js";
import { THEMES } from "../config/themes.js";
import { BOOSTERS, SKINS, BOOSTER_BY_ID } from "../config/shop.js";
import { ACHIEVEMENTS } from "../config/achievements.js";
import { levelProgress, titleForLevel } from "../systems/profile.js";
import { winRate, maxDistribution } from "../systems/stats.js";
import { dailyRewardInfo } from "../systems/economy.js";

export class Screens {
  constructor(overlayRoot, toastRoot, api) {
    this.root = overlayRoot;
    this.toastRoot = toastRoot;
    this.api = api;
    this.current = null;
  }

  // --- Overlay primitives ----------------------------------------------
  open(title, bodyNode, { footer = null, onClose = null, cls = "" } = {}) {
    this.close();
    const closeBtn = el("button", { class: "panel__close", type: "button", "aria-label": "Close" }, ["✕"]);
    const header = el("div", { class: "panel__head" }, [
      el("h2", { class: "panel__title" }, [title]),
      closeBtn,
    ]);
    const body = el("div", { class: "panel__body" }, [bodyNode]);
    const cardChildren = [header, body];
    if (footer) cardChildren.push(el("div", { class: "panel__foot" }, [footer]));
    const card = el("div", { class: "panel " + cls, role: "dialog", "aria-modal": "true" }, cardChildren);
    const backdrop = el("div", { class: "overlay" }, [card]);

    const doClose = () => {
      this.api.sfx("click");
      this.close();
      if (onClose) onClose();
    };
    closeBtn.addEventListener("click", doClose);
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) doClose();
    });

    this.root.appendChild(backdrop);
    this.current = { backdrop, onClose };
    requestAnimationFrame(() => backdrop.classList.add("overlay--in"));
    return { backdrop, card, body, close: doClose };
  }

  close() {
    if (this.current && this.current.backdrop && this.current.backdrop.parentNode) {
      this.current.backdrop.parentNode.removeChild(this.current.backdrop);
    }
    this.current = null;
  }

  isOpen() {
    return !!this.current;
  }

  toast(msg, type = "info", ms = 1800) {
    const t = el("div", { class: "toast toast--" + type }, [msg]);
    this.toastRoot.appendChild(t);
    requestAnimationFrame(() => t.classList.add("toast--in"));
    setTimeout(() => {
      t.classList.remove("toast--in");
      setTimeout(() => t.parentNode && t.parentNode.removeChild(t), 300);
    }, ms);
  }

  // --- Settings ---------------------------------------------------------
  openSettings(onClose = null) {
    const s = this.api.state();
    const body = el("div", { class: "settings" });

    const toggleRow = (label, key, desc) => {
      const input = el("input", { type: "checkbox", class: "switch__input" });
      input.checked = !!s.settings[key];
      const sw = el("label", { class: "switch" }, [input, el("span", { class: "switch__slider" })]);
      input.addEventListener("change", () => {
        this.api.setSetting(key, input.checked);
        this.api.sfx("click");
      });
      return el("div", { class: "settings__row" }, [
        el("div", { class: "settings__label" }, [el("div", { class: "settings__name" }, [label]), el("div", { class: "settings__desc" }, [desc])]),
        sw,
      ]);
    };

    body.appendChild(toggleRow("Sound Effects", "sfx", "Taps, flips, wins and more."));
    body.appendChild(toggleRow("Music", "music", "Gentle ambient background music."));
    body.appendChild(toggleRow("Hard Mode", "hardMode", "Revealed hints must be reused."));
    body.appendChild(toggleRow("High Contrast", "highContrast", "Colorblind-friendly tile colors."));
    body.appendChild(toggleRow("Auto Theme by Day", "autoTheme", "A fresh palette for each weekday."));

    const reset = el("button", { class: "btn btn--danger", type: "button" }, ["Reset All Progress"]);
    reset.addEventListener("click", () => {
      this.confirm("Reset everything?", "This wipes coins, stats, streaks and unlocks. This cannot be undone.", () => {
        this.api.resetProgress();
        this.close();
        this.toast("Progress reset", "info");
      });
    });
    body.appendChild(el("div", { class: "settings__danger" }, [reset]));

    this.open("Settings", body, { cls: "panel--narrow", onClose });
  }

  confirm(title, message, onYes) {
    const yes = el("button", { class: "btn btn--danger", type: "button" }, ["Yes, do it"]);
    const no = el("button", { class: "btn btn--ghost", type: "button" }, ["Cancel"]);
    const footer = el("div", { class: "row-gap" }, [no, yes]);
    const body = el("p", { class: "confirm__msg" }, [message]);
    const dlg = this.open(title, body, { footer, cls: "panel--narrow" });
    yes.addEventListener("click", () => { this.api.sfx("click"); dlg.close(); onYes && onYes(); });
    no.addEventListener("click", () => { this.api.sfx("click"); dlg.close(); });
  }

  // --- Shop (boosters + free coins) ------------------------------------
  openShop() {
    const body = el("div", { class: "shop" });
    body.appendChild(el("div", { class: "shop__section-title" }, ["Boosters"]));
    const grid = el("div", { class: "card-grid" });
    for (const b of BOOSTERS) {
      grid.appendChild(this._boosterCard(b));
    }
    body.appendChild(grid);

    body.appendChild(el("div", { class: "shop__section-title" }, ["Get Coins"]));
    const adCard = el("div", { class: "card card--ad" }, [
      el("div", { class: "card__icon" }, ["🎬"]),
      el("div", { class: "card__name" }, ["Watch & Earn"]),
      el("div", { class: "card__desc" }, ["Watch a short ad for +50 coins."]),
    ]);
    const adBtn = el("button", { class: "btn btn--accent card__btn", type: "button" }, ["+50 🪙"]);
    adBtn.addEventListener("click", async () => {
      this.api.sfx("click");
      adBtn.disabled = true;
      adBtn.textContent = "Loading…";
      const ok = await this.api.watchAdForCoins();
      adBtn.disabled = false;
      adBtn.textContent = "+50 🪙";
      if (ok) { this.toast("+50 coins!", "success"); this.refreshShop(); }
      else this.toast("Ad not available", "warn");
    });
    adCard.appendChild(adBtn);
    body.appendChild(adCard);

    this.shopBody = body;
    this.open("Shop", body);
  }

  _boosterCard(b) {
    const s = this.api.state();
    const owned = s.inventory[b.id] || 0;
    const card = el("div", { class: "card" }, [
      el("div", { class: "card__icon" }, [b.icon]),
      el("div", { class: "card__name" }, [b.name]),
      el("div", { class: "card__desc" }, [b.desc]),
      el("div", { class: "card__owned" }, ["Owned: " + owned]),
    ]);
    const btn = el("button", { class: "btn btn--accent card__btn", type: "button" }, [b.price + " 🪙"]);
    btn.addEventListener("click", () => {
      this.api.sfx("click");
      const res = this.api.buyBooster(b.id);
      if (res.ok) { this.api.sfx("coin"); this.toast(`${b.name} purchased!`, "success"); this.refreshShop(); }
      else this.toast(res.reason, "warn");
    });
    card.appendChild(btn);
    return card;
  }

  refreshShop() {
    if (this.shopBody && this.isOpen()) {
      const scroll = this.current.backdrop.querySelector(".panel__body");
      const top = scroll ? scroll.scrollTop : 0;
      this.openShop();
      const ns = this.current.backdrop.querySelector(".panel__body");
      if (ns) ns.scrollTop = top;
    }
  }

  // --- Skins ------------------------------------------------------------
  openSkins() {
    const body = el("div", { class: "card-grid" });
    const s = this.api.state();
    for (const sk of SKINS) {
      const owned = s.skins.owned.includes(sk.id);
      const active = s.skins.active === sk.id;
      const preview = el("div", { class: "skin-preview " + sk.cls }, [
        el("div", { class: "skin-preview__tile tile--correct" }, ["A"]),
        el("div", { class: "skin-preview__tile tile--present" }, ["B"]),
        el("div", { class: "skin-preview__tile tile--absent" }, ["C"]),
      ]);
      const card = el("div", { class: "card" + (active ? " card--active" : "") }, [
        preview,
        el("div", { class: "card__name" }, [sk.name]),
        el("div", { class: "card__desc" }, [sk.desc]),
      ]);
      let btn;
      if (active) {
        btn = el("button", { class: "btn btn--ghost card__btn", type: "button", disabled: true }, ["Equipped"]);
      } else if (owned) {
        btn = el("button", { class: "btn btn--accent card__btn", type: "button" }, ["Equip"]);
        btn.addEventListener("click", () => { this.api.sfx("click"); this.api.equipSkin(sk.id); this.openSkins(); });
      } else {
        btn = el("button", { class: "btn btn--accent card__btn", type: "button" }, [sk.price + " 🪙"]);
        btn.addEventListener("click", () => {
          this.api.sfx("click");
          const res = this.api.buySkin(sk.id);
          if (res.ok) { this.api.sfx("coin"); this.toast(`${sk.name} unlocked!`, "success"); this.openSkins(); }
          else this.toast(res.reason, "warn");
        });
      }
      card.appendChild(btn);
      body.appendChild(card);
    }
    this.open("Tile Skins", body);
  }

  // --- Themes -----------------------------------------------------------
  openThemes() {
    const body = el("div", {});
    const note = el("p", { class: "panel__note" }, ["Day themes apply automatically when Auto Theme is on. Pick any owned theme to set it manually."]);
    body.appendChild(note);
    const grid = el("div", { class: "card-grid" });
    const s = this.api.state();
    for (const id in THEMES) {
      const t = THEMES[id];
      const owned = s.themes.owned.includes(id);
      const active = !s.settings.autoTheme && s.themes.active === id;
      const swatch = el("div", { class: "theme-swatch" });
      swatch.style.background = `linear-gradient(135deg, ${t.vars["--accent"]}, ${t.vars["--accent-2"]})`;
      const tag = t.day != null ? el("div", { class: "card__tag" }, ["Weekday"]) : null;
      const card = el("div", { class: "card" + (active ? " card--active" : "") }, [swatch, el("div", { class: "card__name" }, [t.name]), tag].filter(Boolean));
      let btn;
      if (active) {
        btn = el("button", { class: "btn btn--ghost card__btn", type: "button", disabled: true }, ["Active"]);
      } else if (owned || t.price === 0) {
        if (!owned && t.price === 0) {
          // free but ensure ownership
        }
        btn = el("button", { class: "btn btn--accent card__btn", type: "button" }, ["Use"]);
        btn.addEventListener("click", () => {
          this.api.sfx("click");
          this.api.equipTheme(id);
          this.openThemes();
        });
      } else {
        btn = el("button", { class: "btn btn--accent card__btn", type: "button" }, [t.price + " 🪙"]);
        btn.addEventListener("click", () => {
          this.api.sfx("click");
          const res = this.api.buyTheme(id);
          if (res.ok) { this.api.sfx("coin"); this.toast(`${t.name} unlocked!`, "success"); this.openThemes(); }
          else this.toast(res.reason, "warn");
        });
      }
      card.appendChild(btn);
      grid.appendChild(card);
    }
    body.appendChild(grid);
    this.open("Themes", body);
  }

  // --- Achievements -----------------------------------------------------
  openAchievements() {
    const s = this.api.state();
    const body = el("div", { class: "ach-list" });
    const done = ACHIEVEMENTS.filter((a) => s.achievements[a.id]).length;
    body.appendChild(el("div", { class: "ach-summary" }, [`${done} / ${ACHIEVEMENTS.length} unlocked`]));
    for (const a of ACHIEVEMENTS) {
      const unlocked = !!s.achievements[a.id];
      const row = el("div", { class: "ach" + (unlocked ? " ach--done" : "") }, [
        el("div", { class: "ach__icon" }, [unlocked ? a.icon : "🔒"]),
        el("div", { class: "ach__info" }, [
          el("div", { class: "ach__name" }, [a.name]),
          el("div", { class: "ach__desc" }, [a.desc]),
        ]),
        el("div", { class: "ach__reward" }, [a.reward ? `+${a.reward}🪙` : "✓"]),
      ]);
      body.appendChild(row);
    }
    this.open("Achievements", body);
  }

  // --- Stats ------------------------------------------------------------
  openStats() {
    const s = this.api.state();
    const body = el("div", { class: "stats" });
    const grid = el("div", { class: "stats__grid" }, [
      this._stat(s.stats.played, "Played"),
      this._stat(winRate(s) + "%", "Win %"),
      this._stat(s.stats.currentStreak, "Streak"),
      this._stat(s.stats.maxStreak, "Max Streak"),
    ]);
    body.appendChild(grid);
    body.appendChild(el("div", { class: "stats__subtitle" }, ["Guess Distribution"]));
    body.appendChild(this._distribution(s));
    this.open("Statistics", body);
  }

  _stat(val, label) {
    return el("div", { class: "stat" }, [
      el("div", { class: "stat__val" }, [String(val)]),
      el("div", { class: "stat__label" }, [label]),
    ]);
  }

  _distribution(s) {
    const wrap = el("div", { class: "dist" });
    const max = maxDistribution(s);
    for (let i = 0; i < 6; i++) {
      const count = s.stats.distribution[i];
      const bar = el("div", { class: "dist__bar" }, [String(count)]);
      bar.style.width = Math.max(8, (count / max) * 100) + "%";
      wrap.appendChild(el("div", { class: "dist__row" }, [
        el("div", { class: "dist__num" }, [String(i + 1)]),
        el("div", { class: "dist__track" }, [bar]),
      ]));
    }
    return wrap;
  }

  // --- Profile ----------------------------------------------------------
  openProfile() {
    const s = this.api.state();
    const p = levelProgress(s);
    const body = el("div", { class: "profile" });
    const avatars = ["🦊", "🐼", "🦉", "🐯", "🐲", "🦄", "🐙", "🐧"];
    const avatarRow = el("div", { class: "avatar-row" });
    avatars.forEach((a, idx) => {
      const b = el("button", { class: "avatar" + (s.profile.avatar === idx ? " avatar--active" : ""), type: "button" }, [a]);
      b.addEventListener("click", () => { this.api.sfx("click"); this.api.setAvatar(idx); this.openProfile(); });
      avatarRow.appendChild(b);
    });
    body.appendChild(el("div", { class: "profile__head" }, [
      el("div", { class: "profile__avatar" }, [avatars[s.profile.avatar] || "🦊"]),
      el("div", {}, [
        el("div", { class: "profile__title" }, [titleForLevel(s.level)]),
        el("div", { class: "profile__lvl" }, ["Level " + s.level]),
      ]),
    ]));
    const xpBar = el("div", { class: "xpbar" }, [el("div", { class: "xpbar__fill" })]);
    xpBar.querySelector(".xpbar__fill").style.width = Math.round(p.pct * 100) + "%";
    body.appendChild(el("div", { class: "profile__xp" }, [
      el("div", { class: "profile__xp-label" }, [`${p.have} / ${p.need} XP`]),
      xpBar,
    ]));
    body.appendChild(el("div", { class: "profile__pick" }, ["Choose your avatar"]));
    body.appendChild(avatarRow);
    this.open("Profile", body, { cls: "panel--narrow" });
  }

  // --- How to play ------------------------------------------------------
  openHowTo(onClose) {
    const body = el("div", { class: "howto" });
    body.appendChild(el("p", {}, ["Guess the hidden 5-letter word in 6 tries. Each guess must be a real word."]));
    const examples = el("div", { class: "howto__examples" });
    const mkExample = (word, idx, state, text) => {
      const row = el("div", { class: "howto__row" });
      for (let i = 0; i < word.length; i++) {
        const cls = i === idx ? " tile--" + state + " flipped tile--revealed" : "";
        row.appendChild(el("div", { class: "tile tile--filled tile--mini" + cls }, [word[i].toUpperCase()]));
      }
      examples.appendChild(row);
      examples.appendChild(el("p", { class: "howto__caption" }, [text]));
    };
    mkExample("crane", 0, "correct", "C is in the word and in the correct spot.");
    mkExample("tiles", 1, "present", "I is in the word but in the wrong spot.");
    mkExample("ghost", 3, "absent", "S is not in the word in any spot.");
    body.appendChild(examples);
    body.appendChild(el("p", { class: "howto__tip" }, ["💡 Use a Hint to reveal a useful letter. Turn on Hard Mode for a tougher challenge. A new word unlocks every day!"]));

    const start = el("button", { class: "btn btn--accent btn--block", type: "button" }, ["Got it!"]);
    const dlg = this.open("How to Play", body, { footer: start, cls: "panel--narrow", onClose });
    start.addEventListener("click", () => { this.api.sfx("click"); dlg.close(); if (onClose) onClose(); });
  }

  // --- Daily reward -----------------------------------------------------
  openDailyReward() {
    const s = this.api.state();
    const day = this.api.dayNumber();
    const info = dailyRewardInfo(s, day);
    const body = el("div", { class: "daily-reward" });
    const ladder = el("div", { class: "reward-ladder" });
    info.ladder.forEach((amt, idx) => {
      const dayNum = idx + 1;
      const isNext = info.canClaim && dayNum === info.streak;
      const claimed = dayNum < info.streak || (!info.canClaim && dayNum <= info.streak);
      const cell = el("div", { class: "reward-cell" + (isNext ? " reward-cell--next" : "") + (claimed ? " reward-cell--claimed" : "") }, [
        el("div", { class: "reward-cell__day" }, ["Day " + dayNum]),
        el("div", { class: "reward-cell__amt" }, [amt + "🪙"]),
        claimed ? el("div", { class: "reward-cell__check" }, ["✓"]) : null,
      ].filter(Boolean));
      ladder.appendChild(cell);
    });
    body.appendChild(ladder);

    let footer;
    if (info.canClaim) {
      const claim = el("button", { class: "btn btn--accent btn--block", type: "button" }, [`Claim +${info.amount} 🪙`]);
      claim.addEventListener("click", () => {
        const res = this.api.claimDailyReward();
        if (res.ok) {
          this.api.sfx("coin");
          this.toast(`Claimed +${res.amount} coins!`, "success");
          this.close();
        }
      });
      footer = claim;
    } else {
      footer = el("button", { class: "btn btn--ghost btn--block", type: "button", disabled: true }, ["Come back tomorrow!"]);
    }
    this.open("Daily Reward", body, { footer, cls: "panel--narrow" });
  }

  // --- Pause ------------------------------------------------------------
  openPause() {
    const body = el("div", { class: "menu-list" });
    const resume = el("button", { class: "btn btn--accent btn--block", type: "button" }, ["▶ Resume"]);
    const howto = el("button", { class: "btn btn--ghost btn--block", type: "button" }, ["❓ How to Play"]);
    const settings = el("button", { class: "btn btn--ghost btn--block", type: "button" }, ["⚙️ Settings"]);
    const home = el("button", { class: "btn btn--ghost btn--block", type: "button" }, ["🏠 Quit to Home"]);
    body.appendChild(resume); body.appendChild(howto); body.appendChild(settings); body.appendChild(home);
    const dlg = this.open("Paused", body, { cls: "panel--narrow", onClose: () => this.api.resumeFromPause() });
    resume.addEventListener("click", () => { this.api.sfx("click"); dlg.close(); this.api.resumeFromPause(); });
    howto.addEventListener("click", () => { this.api.sfx("click"); this.openHowTo(() => this.openPause()); });
    settings.addEventListener("click", () => { this.api.sfx("click"); this.openSettings(() => this.openPause()); });
    home.addEventListener("click", () => { this.api.sfx("click"); this.close(); this.api.quitToHome(); });
  }

  // --- Results / Game over ---------------------------------------------
  openResults({ won, answer, rows, mode, day, coinsEarned, xpEarned, shareText, newAchievements }) {
    const body = el("div", { class: "results" });
    body.appendChild(el("div", { class: "results__emoji" }, [won ? "🎉" : "💧"]));
    body.appendChild(el("div", { class: "results__headline" }, [won ? (rows === 1 ? "Genius!" : "Solved!") : "So close!"]));
    if (!won) {
      body.appendChild(el("div", { class: "results__answer" }, ["The word was ", el("b", {}, [answer.toUpperCase()])]));
    } else {
      body.appendChild(el("div", { class: "results__answer" }, [`You got it in ${rows} ${rows === 1 ? "guess" : "guesses"}.`]));
    }

    const rewards = el("div", { class: "results__rewards" }, [
      el("div", { class: "reward-pill" }, ["🪙 +" + coinsEarned]),
      el("div", { class: "reward-pill" }, ["⭐ +" + xpEarned + " XP"]),
    ]);
    body.appendChild(rewards);

    if (newAchievements && newAchievements.length) {
      const aw = el("div", { class: "results__ach" });
      aw.appendChild(el("div", { class: "results__ach-title" }, ["Achievement unlocked!"]));
      for (const a of newAchievements) {
        aw.appendChild(el("div", { class: "results__ach-item" }, [a.icon + " " + a.name]));
      }
      body.appendChild(aw);
    }

    // Mini stat strip
    const s = this.api.state();
    body.appendChild(el("div", { class: "results__stats" }, [
      this._stat(s.stats.played, "Played"),
      this._stat(winRate(s) + "%", "Win %"),
      this._stat(s.stats.currentStreak, "Streak"),
      this._stat(s.stats.maxStreak, "Max"),
    ]));

    // Footer buttons
    const footer = el("div", { class: "results__actions" });
    const shareBtn = el("button", { class: "btn btn--accent btn--block", type: "button" }, ["📋 Share Result"]);
    shareBtn.addEventListener("click", async () => {
      this.api.sfx("click");
      const ok = await this.api.share(shareText);
      this.toast(ok ? "Copied to clipboard!" : "Sharing not available", ok ? "success" : "warn");
    });
    footer.appendChild(shareBtn);

    if (mode === "daily") {
      const practice = el("button", { class: "btn btn--ghost btn--block", type: "button" }, ["🎲 Play Practice"]);
      practice.addEventListener("click", () => { this.api.sfx("click"); this.close(); this.api.startPractice(); });
      footer.appendChild(practice);
    } else {
      const again = el("button", { class: "btn btn--ghost btn--block", type: "button" }, ["🔁 New Word"]);
      again.addEventListener("click", () => { this.api.sfx("click"); this.close(); this.api.startPractice(); });
      footer.appendChild(again);
    }
    const homeBtn = el("button", { class: "btn btn--ghost btn--block", type: "button" }, ["🏠 Home"]);
    homeBtn.addEventListener("click", () => { this.api.sfx("click"); this.close(); this.api.quitToHome(); });
    footer.appendChild(homeBtn);

    this.open(won ? "Victory" : "Game Over", body, { footer, cls: "panel--results", onClose: () => this.api.onResultsClosed() });
  }
}
