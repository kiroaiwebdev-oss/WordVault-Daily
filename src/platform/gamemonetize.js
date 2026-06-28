// GameMonetize adapter. Uses the SDK options object + window.sdk.showBanner().
// Ad lifecycle events are wired through the SDK options in index.html; this adapter
// triggers ads and resumes audio on completion, with a built-in fallback.

import { PlatformAdapter } from "./adapter.js";
import { waitForGlobal, safe, fallbackAd } from "./sdkUtil.js";

export class GameMonetizeAdapter extends PlatformAdapter {
  constructor() {
    super();
    this.name = "gamemonetize";
    this.sdk = null;
  }

  async init() {
    this.sdk = await waitForGlobal("sdk", 5000);
    // Listen for SDK ad events bubbled to window (configured in the SDK options).
    if (typeof window !== "undefined") {
      window.__gm_onResume = () => this._emitMute(false);
      window.__gm_onPause = () => this._emitMute(true);
    }
  }

  async showInterstitial() {
    if (!this.sdk || !this.sdk.showBanner) return await fallbackAd({ rewarded: false });
    this._emitMute(true);
    await new Promise((res) => { try { this.sdk.showBanner(); } catch (e) {} setTimeout(res, 8000); });
    this._emitMute(false);
    return true;
  }

  async showRewardedAd() {
    // GameMonetize rewarded uses the same banner call with reward handled via events.
    if (!this.sdk || !this.sdk.showBanner) return await fallbackAd({ rewarded: true });
    this._emitMute(true);
    await new Promise((res) => { try { this.sdk.showBanner(); } catch (e) {} setTimeout(res, 8000); });
    this._emitMute(false);
    return true;
  }

  async saveData() { return false; }
  async loadData() { return null; }
}
