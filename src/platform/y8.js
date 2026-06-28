// Y8 adapter. Uses the ID Net / Y8 ads bridge (window.ID) when present, else the
// built-in fallback. Y8 cloud save uses the Y8 Account API when available.

import { PlatformAdapter } from "./adapter.js";
import { waitForGlobal, safe, fallbackAd } from "./sdkUtil.js";

export class Y8Adapter extends PlatformAdapter {
  constructor() {
    super();
    this.name = "y8";
    this.sdk = null;
  }

  async init() {
    this.sdk = await waitForGlobal("ID", 4000);
  }

  async showInterstitial() {
    if (!this.sdk || !this.sdk.showAd) return await fallbackAd({ rewarded: false });
    this._emitMute(true);
    await new Promise((res) => { try { this.sdk.showAd("interstitial", res); } catch (e) { res(); } setTimeout(res, 9000); });
    this._emitMute(false);
    return true;
  }

  async showRewardedAd() {
    if (!this.sdk || !this.sdk.showAd) return await fallbackAd({ rewarded: true });
    return await new Promise((resolve) => {
      let settled = false;
      const done = (ok) => { if (!settled) { settled = true; this._emitMute(false); resolve(ok); } };
      this._emitMute(true);
      try {
        this.sdk.showAd("rewardedVideo", { rewardedCallback: () => done(true), closeCallback: () => done(false) });
      } catch (e) { done(false); }
      setTimeout(async () => { if (!settled) done(await fallbackAd({ rewarded: true })); }, 10000);
    });
  }

  async saveData() { return false; }
  async loadData() { return null; }
}
