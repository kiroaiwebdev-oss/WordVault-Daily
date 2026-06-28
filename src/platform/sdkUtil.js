// Helpers shared by platform adapters: wait for a global SDK to load, safely call
// possibly-missing SDK methods, and a built-in fallback "ad" overlay so the game
// stays fully functional with an adblocker or unfilled ads.

export function waitForGlobal(path, timeoutMs = 6000) {
  return new Promise((resolve) => {
    const parts = path.split(".");
    const get = () => {
      let o = typeof window !== "undefined" ? window : {};
      for (const p of parts) {
        if (o == null) return undefined;
        o = o[p];
      }
      return o;
    };
    const existing = get();
    if (existing) return resolve(existing);
    const start = Date.now();
    const t = setInterval(() => {
      const v = get();
      if (v) {
        clearInterval(t);
        resolve(v);
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(t);
        resolve(null);
      }
    }, 100);
  });
}

// Synchronous safe call: never throws, returns fallback on any error.
export function safe(fn, fallback = undefined) {
  try {
    const v = fn();
    return v === undefined ? fallback : v;
  } catch (e) {
    return fallback;
  }
}

// Fallback ad: a short, skippable in-game overlay shown when no SDK is available
// (e.g. adblock or standalone build). Resolves true so rewarded flow still works
// in dev/standalone — real portals override showRewardedAd with their SDK.
export function fallbackAd({ rewarded = true, label = "Sponsored message" } = {}) {
  return new Promise((resolve) => {
    if (typeof document === "undefined") return resolve(rewarded);
    const overlay = document.createElement("div");
    overlay.className = "ad-fallback";
    overlay.setAttribute("role", "dialog");
    let remaining = rewarded ? 4 : 3;
    overlay.innerHTML = `
      <div class="ad-fallback__card">
        <div class="ad-fallback__tag">${label}</div>
        <div class="ad-fallback__logo">WordVault</div>
        <p class="ad-fallback__msg">Enjoying the game? Thanks for playing!</p>
        <div class="ad-fallback__count">Continue in <span>${remaining}</span>s</div>
        <button class="btn btn--ghost ad-fallback__skip" type="button" disabled>Skip</button>
      </div>`;
    document.body.appendChild(overlay);
    const countEl = overlay.querySelector(".ad-fallback__count span");
    const skipBtn = overlay.querySelector(".ad-fallback__skip");
    const finish = (completed) => {
      clearInterval(timer);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      resolve(rewarded ? completed : true);
    };
    const timer = setInterval(() => {
      remaining -= 1;
      if (countEl) countEl.textContent = String(Math.max(0, remaining));
      if (remaining <= 1) {
        skipBtn.disabled = false;
        skipBtn.textContent = rewarded ? "Claim Reward" : "Continue";
      }
      if (remaining <= 0) finish(true);
    }, 1000);
    skipBtn.addEventListener("click", () => finish(true));
  });
}
