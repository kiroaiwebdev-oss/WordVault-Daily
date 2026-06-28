// Platform/SDK probes: mock portal SDKs and assert the adapter contract —
// rewarded ads grant ONLY on real completion, deny on adblock/error, the mute
// signal propagates, interstitials resolve, and cloud save round-trips. Also
// verifies the Store falls back to localStorage when the adapter has no cloud.

import { setupDom } from "./fakedom.mjs";
setupDom();

const { CrazyGamesAdapter } = await import("../src/platform/crazygames.js");
const { PlatformAdapter } = await import("../src/platform/adapter.js");
const { Store } = await import("../src/systems/save.js");

let pass = 0;
function check(name, cond) {
  if (cond) { pass++; console.log("  ✓ " + name); }
  else { console.error("  ✗ " + name); process.exitCode = 1; }
}

function mockCrazy({ outcome }) {
  return {
    SDK: {
      init: () => Promise.resolve(),
      game: { loadingStop() {}, gameplayStart() {}, gameplayStop() {}, happytime() {} },
      ad: {
        requestAd(type, cbs) {
          cbs.adStarted && cbs.adStarted();
          setTimeout(() => {
            if (outcome === "finished") cbs.adFinished && cbs.adFinished();
            else cbs.adError && cbs.adError("no-fill");
          }, 0);
        },
      },
      data: {
        _store: {},
        setItem(k, v) { this._store[k] = v; },
        getItem(k) { return this._store[k] != null ? this._store[k] : null; },
      },
    },
  };
}

async function main() {
  console.log("SDK probe suite");

  // 1. Rewarded grants only on completion.
  window.CrazyGames = mockCrazy({ outcome: "finished" });
  let cg = new CrazyGamesAdapter();
  await cg.init();
  let muteTrail = [];
  cg.onMuteChange((m) => muteTrail.push(m));
  const grantedOk = await cg.showRewardedAd();
  check("rewarded resolves true on completion", grantedOk === true);
  check("mute toggled on (start) then off (finish)", muteTrail[0] === true && muteTrail[muteTrail.length - 1] === false);

  // 2. Rewarded denied on adblock/error.
  window.CrazyGames = mockCrazy({ outcome: "error" });
  cg = new CrazyGamesAdapter();
  await cg.init();
  const grantedFail = await cg.showRewardedAd();
  check("rewarded resolves false on ad error (adblock-safe deny)", grantedFail === false);

  // 3. Interstitial resolves.
  window.CrazyGames = mockCrazy({ outcome: "finished" });
  cg = new CrazyGamesAdapter();
  await cg.init();
  // requestAd midgame -> adFinished
  const inter = await cg.showInterstitial();
  check("interstitial resolves true", inter === true);

  // 4. Cloud save round-trip via SDK data module.
  window.CrazyGames = mockCrazy({ outcome: "finished" });
  cg = new CrazyGamesAdapter();
  await cg.init();
  await cg.saveData("k", JSON.stringify({ a: 1 }));
  const loaded = await cg.loadData("k");
  check("cloud save round-trips through SDK", loaded === JSON.stringify({ a: 1 }));

  // 5. Store uses adapter cloud save, then reconciles defaults.
  const store = new Store(cg);
  store.state.coins = 999;
  await store.flush();
  const store2 = new Store(cg);
  await store2.load();
  check("Store persists + reloads via adapter cloud", store2.state.coins === 999);

  // 6. Store falls back to localStorage when adapter has no cloud (base adapter).
  const base = new PlatformAdapter();
  const ls = new Store(base);
  ls.state.coins = 123;
  await ls.flush();
  const ls2 = new Store(base);
  await ls2.load();
  check("Store falls back to localStorage when no cloud", ls2.state.coins === 123);

  // 7. Base adapter never throws and stays non-blocking.
  const baseReward = await base.showRewardedAd();
  check("base adapter rewarded resolves (non-blocking)", baseReward === true);

  console.log(`SDK probe suite: ${pass} checks passed`);
}

main().catch((e) => { console.error(e); process.exit(1); });
