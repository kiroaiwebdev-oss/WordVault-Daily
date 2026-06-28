// GameDistribution adapter. Uses window.gdsdk (GD HTML5 SDK). Ads are shown via
// showAd / preloadAd; rewarded completion is detected via SDK events when present.
// Falls back to the built-in overlay when the SDK is blocked/unavailable.

import { PlatformAdapter } from "./adapter.js";
import { waitForGlobal, safe, fallbackAd } from "./sdkUtil.js";

export class GameDistributionAdapter extends PlatformAdapter {
  constructor() {
    super();
    this.name = "gamedistribution";
    this.sdk = null;
    this._rewardResolve = null;
  }

  async init() {
    this.sdk = await waitForGlobal("gdsdk");
    // GD also dispatches SDK_GAME_START/PAUSE through a callback config set in HTML.
    if (typeof window !== "undefined") {
      window.addEventListener("message", (e) => {
        const d = e && e.data;
        if (!d || typeof d !== "object") return;
        if (d.type === "SDK_REWARDED_WATCH_COMPLETE" && this._rewardResolve) {
          this._rewardResolve(true);
          this._rewardResolve = null;
        }
      });
    }
  }

  gameplayStart() {
    safe(() => this.sdk && this.sdk.preloadAd && this.sdk.preloadAd("interstitial"));
  }
  gameplayStop() {}

  async showInterstitial() {
    if (!this.sdk || !this.sdk.showAd) return await fallbackAd({ rewarded: false });
    this._emitMute(true);
    await safeShow(() => this.sdk.showAd("interstitial"));
    this._emitMute(false);
    return true;
  }

  async showRewardedAd() {
    if (!this.sdk || !this.sdk.showAd) return await fallbackAd({ rewarded: true });
    return await new Promise((resolve) => {
      let settled = false;
      const done = (ok) => { if (!settled) { settled = true; this._emitMute(false); resolve(ok); } };
      this._rewardResolve = (ok) => done(ok);
      this._emitMute(true);
      const p = safe(() => this.sdk.showAd("rewarded"));
      if (p && typeof p.then === "function") {
        p.then(() => done(true)).catch(() => done(false));
      }
      setTimeout(async () => { if (!settled) done(await fallbackAd({ rewarded: true })); }, 9000);
    });
  }

  async saveData() { return false; } // GD has no cloud save; Store uses localStorage
  async loadData() { return null; }
}

function safeShow(fn) {
  return new Promise((resolve) => {
    try {
      const r = fn();
      if (r && typeof r.then === "function") r.then(resolve).catch(resolve);
      else setTimeout(resolve, 300);
    } catch (e) {
      resolve();
    }
  });
}
