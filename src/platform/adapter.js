// Base PlatformAdapter. The game ONLY talks to these methods, never to a portal
// SDK directly. Subclasses override what a given portal supports; everything has
// a safe default so the game never crashes or soft-locks.

export class PlatformAdapter {
  constructor() {
    this.name = "base";
    this.muted = false; // platform-level mute (takes priority over in-game toggle)
    this._muteListeners = [];
  }

  async init() {}                 // handshake with the SDK
  loadingFinished() {}            // tell the portal loading is done
  gameplayStart() {}              // a round/level has started
  gameplayStop() {}               // a round/level ended or paused
  happyTime() {}                  // signal a celebratory moment (win)

  isMobile() {
    if (typeof navigator === "undefined") return false;
    return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");
  }

  // Ads — return booleans/Promises. Default = no real ad, but never block the game.
  async showRewardedAd() { return true; }   // resolve true only on real completion
  async showInterstitial() { return true; }

  // Persistence — default to localStorage via the Store fallback (returns null here).
  async saveData() { return false; }
  async loadData() { return null; }

  // Mute change subscription (portals like CrazyGames push mute state).
  onMuteChange(cb) {
    if (typeof cb === "function") this._muteListeners.push(cb);
  }
  _emitMute(muted) {
    this.muted = !!muted;
    for (const cb of this._muteListeners) {
      try { cb(this.muted); } catch (e) {}
    }
  }
}
