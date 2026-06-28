// Home screen: hero, primary play CTAs, today's missions, daily-reward access,
// and the menu card grid. Rebuilt from state via render(); every button wired.

import { el, clear } from "./dom.js";
import { dayName } from "../config/themes.js";
import { dailyRewardInfo } from "../systems/economy.js";

export class Home {
  constructor(root, api) {
    this.root = root;
    this.api = api;
  }

  render() {
    const s = this.api.state();
    const day = this.api.dayNumber();
    const now = this.api.now();
    clear(this.root);
    this.root.className = "home";

    // Hero
    const hero = el("div", { class: "home__hero" }, [
      el("div", { class: "logo" }, [
        el("span", { class: "logo__word" }, ["WORD"]),
        el("span", { class: "logo__vault" }, ["VAULT"]),
      ]),
      el("div", { class: "home__subtitle" }, [`${dayName(now)} · ${this.api.themeName()} theme`]),
      el("div", { class: "home__puzzle" }, [`Daily Puzzle #${day}`]),
    ]);
    this.root.appendChild(hero);

    // Primary CTAs
    const dailyStatus = this.api.dailyStatus();
    let dailyLabel = "▶ Play Daily";
    let dailySub = "Today's word";
    if (dailyStatus.status === "won") { dailyLabel = "✓ Daily Complete"; dailySub = `Solved in ${dailyStatus.rows}`; }
    else if (dailyStatus.status === "lost") { dailyLabel = "Daily Finished"; dailySub = "Come back tomorrow"; }
    else if (dailyStatus.status === "playing") { dailyLabel = "⏵ Continue Daily"; dailySub = `${dailyStatus.rows} guesses in`; }

    const playDaily = el("button", { class: "btn btn--hero", type: "button" }, [
      el("span", { class: "btn__main" }, [dailyLabel]),
      el("span", { class: "btn__sub" }, [dailySub]),
    ]);
    playDaily.addEventListener("click", () => {
      this.api.sfx("click");
      if (dailyStatus.status === "playing") this.api.continueDaily();
      else if (dailyStatus.status === "new") this.api.startDaily();
      else this.api.viewDailyResult();
    });

    const playPractice = el("button", { class: "btn btn--hero btn--secondary", type: "button" }, [
      el("span", { class: "btn__main" }, ["🎲 Practice"]),
      el("span", { class: "btn__sub" }, ["Unlimited words"]),
    ]);
    playPractice.addEventListener("click", () => { this.api.sfx("click"); this.api.startPractice(); });

    this.root.appendChild(el("div", { class: "home__cta" }, [playDaily, playPractice]));

    // Daily reward banner (if claimable)
    const rInfo = dailyRewardInfo(s, day);
    if (rInfo.canClaim) {
      const claim = el("button", { class: "home__reward-banner", type: "button" }, [
        el("span", {}, ["🎁 Daily reward ready!"]),
        el("span", { class: "home__reward-amt" }, [`+${rInfo.amount} 🪙`]),
      ]);
      claim.addEventListener("click", () => { this.api.sfx("click"); this.api.openDailyReward(); });
      this.root.appendChild(claim);
    }

    // Missions
    this.root.appendChild(this._missions(s));

    // Menu grid
    const grid = el("div", { class: "home__menu" });
    const mk = (icon, label, fn, badge) => {
      const b = el("button", { class: "menu-card", type: "button" }, [
        badge ? el("span", { class: "menu-card__badge" }, [String(badge)]) : null,
        el("span", { class: "menu-card__icon" }, [icon]),
        el("span", { class: "menu-card__label" }, [label]),
      ].filter(Boolean));
      b.addEventListener("click", () => { this.api.sfx("click"); fn(); });
      return b;
    };
    grid.appendChild(mk("🛒", "Shop", () => this.api.openShop()));
    grid.appendChild(mk("🎨", "Skins", () => this.api.openSkins()));
    grid.appendChild(mk("🌈", "Themes", () => this.api.openThemes()));
    grid.appendChild(mk("🏆", "Achievements", () => this.api.openAchievements()));
    grid.appendChild(mk("📊", "Stats", () => this.api.openStats()));
    grid.appendChild(mk("❓", "How to Play", () => this.api.openHowTo()));
    this.root.appendChild(grid);

    this.root.appendChild(el("div", { class: "home__footer" }, ["A new word every day · Made with ♥ · v1.2"]));
  }

  _missions(s) {
    const wrap = el("div", { class: "missions" }, [el("div", { class: "missions__title" }, ["Today's Missions"])]);
    const list = this.api.missions();
    for (const m of list) {
      const pct = Math.min(1, m.progress / m.goal);
      const fill = el("div", { class: "mission__fill" });
      fill.style.width = Math.round(pct * 100) + "%";
      let action;
      if (m.claimed) {
        action = el("div", { class: "mission__done" }, ["✓"]);
      } else if (m.done) {
        action = el("button", { class: "btn btn--accent btn--sm", type: "button" }, [`Claim +${m.reward}`]);
        action.addEventListener("click", () => {
          this.api.sfx("coin");
          this.api.claimMission(m.id);
          this.render();
        });
      } else {
        action = el("div", { class: "mission__prog" }, [`${m.progress}/${m.goal}`]);
      }
      wrap.appendChild(el("div", { class: "mission" }, [
        el("div", { class: "mission__info" }, [
          el("div", { class: "mission__name" }, [m.name]),
          el("div", { class: "mission__bar" }, [fill]),
        ]),
        action,
      ]));
    }
    return wrap;
  }
}
