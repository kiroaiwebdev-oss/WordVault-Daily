// Poki adapter. Uses window.PokiSDK. gameplayStart/Stop drive Poki analytics;
// rewardedBreak() resolves true only when the player watched to completion.

import { PlatformAdapter } from "./adapter.js";
import { waitForGlobal, safe, fallbackAd } from "./sdkUtil.js";

export class PokiAdapter extends PlatformAdapter {
  constructor() {
    super();
    this.name = "poki";
    this.sdk = null;
  }

  async init() {
    this.sdk = await waitForGlobal("PokiSDK");
    await new Promise((resolve) => {
      if (!this.sdk || !this.sdk.init) return resolve();
      try {
        this.sdk.init().then(resolve).catch(resolve);
      } catch (e) { resolve(); }
      setTimeout(resolve, 4000);
    });
    safe(() => this.sdk && this.sdk.gameLoadingStart && this.sdk.gameLoadingStart());
  }

  loadingFinished() {
    safe(() => this.sdk && this.sdk.gameLoadingFinished && this.sdk.gameLoadingFinished());
  }
  gameplayStart() {
    safe(() => this.sdk && this.sdk.gameplayStart && this.sdk.gameplayStart());
  }
  gameplayStop() {
    safe(() => this.sdk && this.sdk.gameplayStop && this.sdk.gameplayStop());
  }
  happyTime() {
    safe(() => this.sdk && this.sdk.happyTime && this.sdk.happyTime());
  }

  async showInterstitial() {
    if (!this.sdk || !this.sdk.commercialBreak) return await fallbackAd({ rewarded: false });
    this._emitMute(true);
    await promiseOrTimeout(() => this.sdk.commercialBreak(), 9000);
    this._emitMute(false);
    return true;
  }

  async showRewardedAd() {
    if (!this.sdk || !this.sdk.rewardedBreak) return await fallbackAd({ rewarded: true });
    this._emitMute(true);
    const ok = await promiseOrTimeout(() => this.sdk.rewardedBreak(), 12000, false);
    this._emitMute(false);
    if (ok === null) return await fallbackAd({ rewarded: true });
    return !!ok;
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
