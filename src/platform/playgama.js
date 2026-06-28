// Playgama (Playgama Bridge) adapter. Uses window.bridge from the Playgama Bridge
// SDK: advertisement.showRewarded/showInterstitial, storage for cloud save, and
// platform.sendMessage for lifecycle. All calls feature-detected with fallback.

import { PlatformAdapter } from "./adapter.js";
import { waitForGlobal, safe, fallbackAd } from "./sdkUtil.js";

export class PlaygamaAdapter extends PlatformAdapter {
  constructor() {
    super();
    this.name = "playgama";
    this.bridge = null;
  }

  async init() {
    this.bridge = await waitForGlobal("bridge", 5000);
    if (!this.bridge) return;
    await new Promise((resolve) => {
      try {
        if (this.bridge.initialize) this.bridge.initialize().then(resolve).catch(resolve);
        else resolve();
      } catch (e) { resolve(); }
      setTimeout(resolve, 4000);
    });
    // Subscribe to ad state for muting.
    safe(() => {
      const ad = this.bridge.advertisement;
      if (ad && ad.on) {
        ad.on("rewarded_state_changed", (st) => {
          if (st === "opened") this._emitMute(true);
          if (st === "closed" || st === "failed" || st === "rewarded") this._emitMute(false);
        });
        ad.on("interstitial_state_changed", (st) => {
          if (st === "opened") this._emitMute(true);
          if (st === "closed" || st === "failed") this._emitMute(false);
        });
      }
    });
  }

  loadingFinished() {
    safe(() => this.bridge && this.bridge.platform && this.bridge.platform.sendMessage &&
      this.bridge.platform.sendMessage("game_ready"));
  }
  gameplayStart() {
    safe(() => this.bridge && this.bridge.platform && this.bridge.platform.sendMessage &&
      this.bridge.platform.sendMessage("gameplay_started"));
  }
  gameplayStop() {
    safe(() => this.bridge && this.bridge.platform && this.bridge.platform.sendMessage &&
      this.bridge.platform.sendMessage("gameplay_stopped"));
  }

  async showInterstitial() {
    const ad = this.bridge && this.bridge.advertisement;
    if (!ad || !ad.showInterstitial) return await fallbackAd({ rewarded: false });
    try { ad.showInterstitial(); } catch (e) {}
    return true;
  }

  async showRewardedAd() {
    const ad = this.bridge && this.bridge.advertisement;
    if (!ad || !ad.showRewarded) return await fallbackAd({ rewarded: true });
    return await new Promise((resolve) => {
      let settled = false;
      const done = (ok) => { if (!settled) { settled = true; resolve(ok); } };
      safe(() => {
        if (ad.on) {
          ad.on("rewarded_state_changed", (st) => {
            if (st === "rewarded") done(true);
            if (st === "closed" || st === "failed") done(false);
          });
        }
        ad.showRewarded();
      });
      setTimeout(async () => { if (!settled) done(await fallbackAd({ rewarded: true })); }, 12000);
    });
  }

  async saveData(key, value) {
    return await safeStorage(() => {
      const st = this.bridge && this.bridge.storage;
      if (st && st.set) return st.set(key, value);
      return false;
    });
  }

  async loadData(key) {
    return await safeStorage(() => {
      const st = this.bridge && this.bridge.storage;
      if (st && st.get) return st.get(key);
      return null;
    }, null);
  }
}

function safeStorage(fn, fallback = false) {
  return new Promise((resolve) => {
    try {
      const r = fn();
      if (r && typeof r.then === "function") r.then((v) => resolve(v == null ? fallback : v)).catch(() => resolve(fallback));
      else resolve(r == null ? fallback : r);
    } catch (e) { resolve(fallback); }
  });
}
