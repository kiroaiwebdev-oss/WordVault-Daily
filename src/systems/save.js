// Persistence layer. Reads/writes a single namespaced JSON blob through the
// platform adapter (cloud save when available, else localStorage). Round-trip safe.

const KEY = "wordvault.save.v1";

export function defaultState() {
  return {
    v: 1,
    createdAt: Date.now(),
    coins: 50,
    xp: 0,
    level: 1,
    profile: { name: "Player", title: "Rookie", avatar: 0 },
    settings: {
      sfx: true,
      music: true,
      hardMode: false,
      highContrast: false,
      autoTheme: true,
      theme: "classic",
    },
    stats: {
      played: 0,
      wins: 0,
      currentStreak: 0,
      maxStreak: 0,
      distribution: [0, 0, 0, 0, 0, 0],
      lastWinDay: null,
    },
    daily: null, // { day, guesses:[{guess,result}], status }
    achievements: {}, // id -> true
    missions: { day: null, list: [] },
    dailyReward: { lastClaimDay: null, streak: 0 },
    inventory: { hint: 1, reveal: 1, skip: 0 },
    skins: { owned: ["default"], active: "default" },
    themes: { owned: ["classic"], active: "classic" },
    collectibles: [], // earned collectible ids
    firstRunDone: false,
    lastSeenDay: null,
  };
}

// Deep-merge loaded data over defaults so new fields always exist.
function reconcile(loaded) {
  const base = defaultState();
  if (!loaded || typeof loaded !== "object") return base;
  const out = { ...base, ...loaded };
  out.settings = { ...base.settings, ...(loaded.settings || {}) };
  out.stats = { ...base.stats, ...(loaded.stats || {}) };
  out.stats.distribution = Array.isArray(loaded?.stats?.distribution) && loaded.stats.distribution.length === 6
    ? loaded.stats.distribution.slice()
    : base.stats.distribution.slice();
  out.profile = { ...base.profile, ...(loaded.profile || {}) };
  out.inventory = { ...base.inventory, ...(loaded.inventory || {}) };
  out.skins = { ...base.skins, ...(loaded.skins || {}) };
  out.themes = { ...base.themes, ...(loaded.themes || {}) };
  out.dailyReward = { ...base.dailyReward, ...(loaded.dailyReward || {}) };
  out.missions = { ...base.missions, ...(loaded.missions || {}) };
  out.achievements = { ...(loaded.achievements || {}) };
  if (!Array.isArray(out.collectibles)) out.collectibles = [];
  return out;
}

export class Store {
  constructor(adapter) {
    this.adapter = adapter;
    this.state = defaultState();
    this._saveTimer = null;
  }

  async load() {
    let raw = null;
    try {
      if (this.adapter && this.adapter.loadData) {
        raw = await this.adapter.loadData(KEY);
      }
    } catch (e) {
      raw = null;
    }
    if (raw == null) raw = localGet(KEY);
    let parsed = null;
    if (raw != null) {
      try {
        parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      } catch (e) {
        parsed = null;
      }
    }
    this.state = reconcile(parsed);
    return this.state;
  }

  // Debounced save to avoid hammering storage on rapid changes.
  save() {
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this.flush(), 250);
  }

  async flush() {
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
      this._saveTimer = null;
    }
    const json = JSON.stringify(this.state);
    localSet(KEY, json);
    try {
      if (this.adapter && this.adapter.saveData) {
        await this.adapter.saveData(KEY, json);
      }
    } catch (e) {
      // localStorage already has it; cloud is best-effort.
    }
  }

  reset() {
    this.state = defaultState();
    this.flush();
  }
}

function localGet(k) {
  try {
    if (typeof localStorage !== "undefined") return localStorage.getItem(k);
  } catch (e) {}
  return memStore[k] != null ? memStore[k] : null;
}

function localSet(k, v) {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(k, v);
      return;
    }
  } catch (e) {}
  memStore[k] = v;
}

const memStore = {};
export { KEY };
