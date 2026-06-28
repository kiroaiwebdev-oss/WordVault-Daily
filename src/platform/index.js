// Adapter registry + detection. The platform is chosen from window.__PLATFORM__
// (stamped by the per-platform build) or a ?platform= query override for testing.

import { StandaloneAdapter } from "./standalone.js";
import { CrazyGamesAdapter } from "./crazygames.js";
import { GameDistributionAdapter } from "./gamedistribution.js";
import { PokiAdapter } from "./poki.js";
import { Y8Adapter } from "./y8.js";
import { GamePixAdapter } from "./gamepix.js";
import { GameMonetizeAdapter } from "./gamemonetize.js";
import { PlaygamaAdapter } from "./playgama.js";

export const REGISTRY = {
  standalone: StandaloneAdapter,
  crazygames: CrazyGamesAdapter,
  gamedistribution: GameDistributionAdapter,
  poki: PokiAdapter,
  y8: Y8Adapter,
  gamepix: GamePixAdapter,
  gamemonetize: GameMonetizeAdapter,
  playgama: PlaygamaAdapter,
};

export function detectPlatform() {
  let id = "standalone";
  if (typeof window !== "undefined") {
    if (window.__PLATFORM__ && REGISTRY[window.__PLATFORM__]) {
      id = window.__PLATFORM__;
    } else {
      try {
        const q = new URLSearchParams(window.location.search).get("platform");
        if (q && REGISTRY[q]) id = q;
      } catch (e) {}
    }
  }
  return id;
}

export function createAdapter(id) {
  const Cls = REGISTRY[id] || REGISTRY.standalone;
  return new Cls();
}
