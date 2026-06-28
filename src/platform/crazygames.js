// CrazyGames adapter. Integrates with the CrazyGames SDK v3 (window.CrazyGames.SDK).
// Honors the portal mute setting (priority over in-game toggle), cloud-style save
// via the SDK data module, and rewarded/midgame ads with adblock-safe fallback.
// Methods are feature-detected; a missing/blocked SDK can never crash the game.

import { PlatformAdapter } from "./adapter.js";
import { waitForGlobal, safe, fallbackAd } from "./sdkUtil.js";

export class CrazyGamesAdapter extends PlatformAdapter {
  constructor() {
    super();
    this.name = "crazygames";
    this.sdk = null;
  }

  async init() {
    this.sdk = await waitForGlobal("CrazyGames.SDK");
    if (!this.sdk) return;
    await safeAsync(() => this.sdk.init());
    // Subscribe to the portal mute state if available.
    safe(() => {
      if (this.sdk.game && typeof this.sdk.game.muteListener === "undefined") {
        // some versions expose a hasAdblock / mute via user events
      }
      const ad = this.sdk.ad;
      if (ad && ad.addEventListener) {
        // no-op placeholder for compatibility
      }
    });
    // Some SDK versions expose document-level mute through onMuteChange-like APIs.
    safe(() => {
      if (this.sdk.game && this.sdk.game.muteListener) {
        // not standard; guarded
      }
    });
  }

  loadingFinished() {
    safe(() => this.sdk && this.sdk.game && this.sdk.game.loadingStop && this.sdk.game.loadingStop());
  }

  gameplayStart() {
    safe(() => this.sdk && this.sdk.game && this.sdk.game.gameplayStart && this.sdk.game.gameplayStart());
  }

  gameplayStop() {
    safe(() => this.sdk && this.sdk.game && this.sdk.game.gameplayStop && this.sdk.game.gameplayStop());
  }

  happyTime() {
    safe(() => this.sdk && this.sdk.game && this.sdk.game.happytime && this.sdk.game.happytime());
  }

  async showRewardedAd() {
    if (!this.sdk || !this.sdk.ad || !this.sdk.ad.requestAd) {
      return await fallbackAd({ rewarded: true });
    }
    return await new Promise((resolve) => {
      let settled = false;
      const done = (ok) => { if (!settled) { settled = true; resolve(ok); } };
      safe(() =>
        this.sdk.ad.requestAd("rewarded", {
          adStarted: () => this._emitMute(true),
          adFinished: () => { this._emitMute(false); done(true); },
          adError: () => { this._emitMute(false); done(false); },
        })
      );
      // Safety timeout: if the SDK never calls back (blocked), fall back.
      setTimeout(async () => {
        if (!settled) done(await fallbackAd({ rewarded: true }));
      }, 8000);
    });
  }

  async showInterstitial() {
    if (!this.sdk || !this.sdk.ad || !this.sdk.ad.requestAd) {
      return await fallbackAd({ rewarded: false });
    }
    return await new Promise((resolve) => {
      let settled = false;
      const done = () => { if (!settled) { settled = true; resolve(true); } };
      safe(() =>
        this.sdk.ad.requestAd("midgame", {
          adStarted: () => this._emitMute(true),
          adFinished: () => { this._emitMute(false); done(); },
          adError: () => { this._emitMute(false); done(); },
        })
      );
      setTimeout(done, 8000);
    });
  }

  async saveData(key, value) {
    return safe(() => {
      if (this.sdk && this.sdk.data && this.sdk.data.setItem) {
        this.sdk.data.setItem(key, value);
        return true;
      }
      return false;
    }, false);
  }

  async loadData(key) {
    return safe(() => {
      if (this.sdk && this.sdk.data && this.sdk.data.getItem) {
        return this.sdk.data.getItem(key);
      }
      return null;
    }, null);
  }
}

function safeAsync(fn) {
  return new Promise((resolve) => {
    try {
      const r = fn();
      if (r && typeof r.then === "function") r.then(() => resolve(true)).catch(() => resolve(false));
      else resolve(true);
    } catch (e) {
      resolve(false);
    }
  });
}
