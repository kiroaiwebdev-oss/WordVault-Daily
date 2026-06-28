// Shop catalog: consumable boosters/powerups and cosmetic tile skins.

export const BOOSTERS = [
  { id: "hint", name: "Hint", desc: "Reveal a high-value letter in the answer.", icon: "💡", price: 30 },
  { id: "reveal", name: "Reveal Tile", desc: "Lock in one correct letter on the board.", icon: "🔓", price: 50 },
  { id: "skip", name: "Skip Puzzle", desc: "Skip a practice word for a fresh one.", icon: "⏭️", price: 20 },
];

export const BOOSTER_BY_ID = Object.fromEntries(BOOSTERS.map((b) => [b.id, b]));

// Tile skins apply a CSS class to the board for a distinct look.
export const SKINS = [
  { id: "default", name: "Standard", desc: "The classic clean tiles.", price: 0, cls: "skin-default", preview: "Aa" },
  { id: "rounded", name: "Pebble", desc: "Soft rounded tiles.", price: 120, cls: "skin-rounded", preview: "Aa" },
  { id: "glass", name: "Glass", desc: "Frosted glass tiles with depth.", price: 200, cls: "skin-glass", preview: "Aa" },
  { id: "neon", name: "Neon Glow", desc: "Glowing arcade tiles.", price: 280, cls: "skin-neon", preview: "Aa" },
  { id: "wood", name: "Woodblock", desc: "Warm wooden letter tiles.", price: 240, cls: "skin-wood", preview: "Aa" },
];

export const SKIN_BY_ID = Object.fromEntries(SKINS.map((s) => [s.id, s]));

// Coin packs purchasable via rewarded ad (free coins) or shown as IAP-style on portals.
export const COIN_PACKS = [
  { id: "ad_small", name: "Free Coins", desc: "Watch a short ad for coins.", icon: "🎬", reward: 50, ad: true },
];
