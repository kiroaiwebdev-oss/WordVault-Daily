// Theme palettes. Seven are mapped to days of the week (auto-theme), the rest are
// unlockable cosmetics purchasable in the shop. Each theme sets CSS variables.

export const THEMES = {
  // --- Day-of-week themes (index 0 = Sunday ... 6 = Saturday) ---
  aurora:   { name: "Aurora",   day: 0, price: 0, vars: { "--accent": "#7aa2f7", "--accent-2": "#bb9af7", "--bg-1": "#0d1224", "--bg-2": "#161b33", "--glow": "#7aa2f7" } },
  ember:    { name: "Ember",    day: 1, price: 0, vars: { "--accent": "#f5803e", "--accent-2": "#ffb454", "--bg-1": "#1c1411", "--bg-2": "#2a1a12", "--glow": "#f5803e" } },
  meadow:   { name: "Meadow",   day: 2, price: 0, vars: { "--accent": "#6cc070", "--accent-2": "#a7e08a", "--bg-1": "#0e1a12", "--bg-2": "#13261a", "--glow": "#6cc070" } },
  tide:     { name: "Tide",     day: 3, price: 0, vars: { "--accent": "#2bb1c4", "--accent-2": "#5fd6c6", "--bg-1": "#08191e", "--bg-2": "#0e2730", "--glow": "#2bb1c4" } },
  blossom:  { name: "Blossom",  day: 4, price: 0, vars: { "--accent": "#e06c9f", "--accent-2": "#f3a0c4", "--bg-1": "#1d1019", "--bg-2": "#2a1622", "--glow": "#e06c9f" } },
  goldday:  { name: "Goldrush", day: 5, price: 0, vars: { "--accent": "#f5c542", "--accent-2": "#ffe08a", "--bg-1": "#1b1708", "--bg-2": "#2a2210", "--glow": "#f5c542" } },
  dusk:     { name: "Dusk",     day: 6, price: 0, vars: { "--accent": "#9d7cf4", "--accent-2": "#c4b0ff", "--bg-1": "#120e22", "--bg-2": "#1c1633", "--glow": "#9d7cf4" } },

  // --- Cosmetic themes (unlockable) ---
  classic:  { name: "Classic",  day: null, price: 0,   vars: { "--accent": "#6aaa64", "--accent-2": "#86c97f", "--bg-1": "#0f1115", "--bg-2": "#181b22", "--glow": "#6aaa64" } },
  midnight: { name: "Midnight", day: null, price: 150, vars: { "--accent": "#5b7cfa", "--accent-2": "#8aa3ff", "--bg-1": "#06070d", "--bg-2": "#0d1018", "--glow": "#5b7cfa" } },
  neon:     { name: "Neon",     day: null, price: 300, vars: { "--accent": "#19f0c3", "--accent-2": "#7df0ff", "--bg-1": "#05080a", "--bg-2": "#0a1216", "--glow": "#19f0c3" } },
  sunset:   { name: "Sunset",   day: null, price: 300, vars: { "--accent": "#ff6a88", "--accent-2": "#ffb37b", "--bg-1": "#1a0e16", "--bg-2": "#2a1320", "--glow": "#ff6a88" } },
  mono:     { name: "Mono",     day: null, price: 250, vars: { "--accent": "#b8c0cc", "--accent-2": "#e6ebf2", "--bg-1": "#0c0d10", "--bg-2": "#15171c", "--glow": "#b8c0cc" } },
  royal:    { name: "Royal",    day: null, price: 500, vars: { "--accent": "#d4af37", "--accent-2": "#f3e3a0", "--bg-1": "#0d0a18", "--bg-2": "#161029", "--glow": "#d4af37" } },
};

const DAY_THEME_BY_INDEX = {};
for (const id in THEMES) {
  if (THEMES[id].day != null) DAY_THEME_BY_INDEX[THEMES[id].day] = id;
}

// Returns the theme id for the given date's day of week.
export function dayThemeId(date = new Date()) {
  return DAY_THEME_BY_INDEX[date.getDay()] || "classic";
}

export function dayName(date = new Date()) {
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][date.getDay()];
}

export function resolveTheme(state, date = new Date()) {
  if (state.settings.autoTheme) return dayThemeId(date);
  const active = state.themes.active;
  return THEMES[active] ? active : "classic";
}

// Apply a theme's CSS variables to a root element (document.documentElement).
export function applyTheme(root, themeId, highContrast) {
  const theme = THEMES[themeId] || THEMES.classic;
  for (const k in theme.vars) {
    root.style.setProperty(k, theme.vars[k]);
  }
  // High-contrast swaps present/correct to colorblind-friendly orange/blue.
  if (highContrast) {
    root.style.setProperty("--c-correct", "#f5793a");
    root.style.setProperty("--c-present", "#85c0f9");
  } else {
    root.style.setProperty("--c-correct", "#6aaa64");
    root.style.setProperty("--c-present", "#c9b458");
  }
  return theme;
}
