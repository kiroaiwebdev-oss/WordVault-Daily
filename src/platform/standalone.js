// Standalone adapter for itch.io / direct hosting / local dev.
// No portal SDK: ads use the built-in fallback overlay, saves use localStorage.

import { PlatformAdapter } from "./adapter.js";
import { fallbackAd } from "./sdkUtil.js";

export class StandaloneAdapter extends PlatformAdapter {
  constructor() {
    super();
    this.name = "standalone";
  }

  async showRewardedAd() {
    return await fallbackAd({ rewarded: true });
  }

  async showInterstitial() {
    return await fallbackAd({ rewarded: false });
  }

  // localStorage handled by Store fallback; report not-handled so Store uses local.
  async saveData() { return false; }
  async loadData() { return null; }
}
