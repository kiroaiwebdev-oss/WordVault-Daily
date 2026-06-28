// GamePix adapter. Uses window.GamePix SDK. Interstitial + rewarded ads with
// adblock-safe fallback. Loading + happy moments reported when supported.

import { PlatformAdapter } from "./adapter.js";
import { waitForGlobal, safe, fallbackAd } from "./sdkUtil.js";

export class GamePixAdapter extends PlatformAdapter {
  constructor() {
    super();
    this.name = "gamepix";
    this.sdk = null;
  }

  async init() {
    this.sdk = await waitForGlobal("GamePix", 4000);
  }

  loadingFinished() {
    safe(() => this.sdk && this.sdk.ready && this.sdk.ready());
  }
  happyTime() {
    safe(() => this.sdk && this.sdk.happyMoment && this.sdk.happyMoment());
  }

  async showInterstitial() {
    if (!this.sdk || !this.sdk.interstitialAd) return await fallbackAd({ rewarded: false });
    this._emitMute(true);
    await promiseOrTimeout(() => this.sdk.interstitialAd(), 9000);
    this._emitMute(false);
    return true;
  }

  async showRewardedAd() {
    if (!this.sdk || !this.sdk.rewardAd) return await fallbackAd({ rewarded: true });
    this._emitMute(true);
    const res = await promiseOrTimeout(() => this.sdk.rewardAd(), 12000, null);
    this._emitMute(false);
    if (res === null) return await fallbackAd({ rewarded: true });
    // GamePix resolves with { success: true } or boolean depending on version.
    if (res && typeof res === "object") return !!res.success;
    return !!res;
  }

  async saveData() { return false; }
  async loadData() { return null; }
}

function promiseOrTimeout(fn, ms, timeoutVal = null) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (v) => { if (!settled) { settled = true; resolve(v); } };
    try {
      const p = fn();
      if (p && typeof p.then === "function") p.then((v) => done(v === undefined ? true : v)).catch(() => done(false));
      else done(true);
    } catch (e) { done(false); }
    setTimeout(() => done(timeoutVal), ms);
  });
}
