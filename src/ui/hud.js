// HUD — the persistent top bar (coins, level + XP, streak) plus the in-game
// action row (hint, hard-mode badge, pause). Pure view layer: game.js calls update().

import { el } from "./dom.js";
import { levelProgress } from "../systems/profile.js";

export class Hud {
  constructor(root, handlers = {}) {
    this.root = root;
    this.handlers = handlers;
    this.build();
  }

  build() {
    this.root.classList.add("hud");
    this.btnHome = el("button", { class: "hud__icon", type: "button", "aria-label": "Menu", title: "Menu" }, ["📖"]);

    this.coins = el("span", { class: "chip__val" }, ["0"]);
    this.coinChip = el("button", { class: "chip chip--coins", type: "button", title: "Get coins" }, [
      el("span", { class: "chip__ic" }, ["🪙"]), this.coins,
    ]);

    this.streak = el("span", { class: "chip__val" }, ["0"]);
    this.streakChip = el("div", { class: "chip chip--streak", title: "Daily streak" }, [
      el("span", { class: "chip__ic" }, ["🔥"]), this.streak,
    ]);

    this.levelNum = el("span", { class: "lvl__num" }, ["1"]);
    this.xpFill = el("div", { class: "lvl__fill" });
    this.levelChip = el("button", { class: "chip chip--level", type: "button", title: "Profile" }, [
      el("span", { class: "lvl__badge" }, [this.levelNum]),
      el("div", { class: "lvl__bar" }, [this.xpFill]),
    ]);

    this.btnSettings = el("button", { class: "hud__icon", type: "button", "aria-label": "Settings", title: "Settings" }, ["⚙️"]);

    // Brand text shows only where there's room (hidden on tight widths via CSS).
    this.title = el("div", { class: "hud__title" }, ["WordVault"]);
    const left = el("div", { class: "hud__left" }, [this.btnHome, this.title]);
    const center = el("div", { class: "hud__center" }, [this.coinChip, this.levelChip, this.streakChip]);
    const right = el("div", { class: "hud__right" }, [this.btnSettings]);

    this.root.appendChild(left);
    this.root.appendChild(center);
    this.root.appendChild(right);

    this.btnHome.addEventListener("click", () => this.handlers.onHome && this.handlers.onHome());
    this.btnSettings.addEventListener("click", () => this.handlers.onSettings && this.handlers.onSettings());
    this.coinChip.addEventListener("click", () => this.handlers.onCoins && this.handlers.onCoins());
    this.levelChip.addEventListener("click", () => this.handlers.onProfile && this.handlers.onProfile());
  }

  setHomeMode(isHome) {
    // On the home screen the icon is a logo; during play it's a pause/menu button.
    this.btnHome.textContent = isHome ? "📖" : "⏸";
    this.btnHome.title = isHome ? "WordVault" : "Pause";
  }

  update(state) {
    this.coins.textContent = String(state.coins);
    this.streak.textContent = String(state.stats.currentStreak);
    this.levelNum.textContent = String(state.level);
    const p = levelProgress(state);
    this.xpFill.style.width = Math.round(p.pct * 100) + "%";
  }

  pulseCoins() {
    this.coinChip.classList.remove("chip--pulse");
    void this.coinChip.offsetWidth;
    this.coinChip.classList.add("chip--pulse");
  }
}
