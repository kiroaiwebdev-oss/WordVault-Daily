// Achievement engine: evaluates definitions, unlocks new ones, grants rewards.

import { ACHIEVEMENTS } from "../config/achievements.js";

export function evaluateAchievements(state, ctx = null) {
  const newlyUnlocked = [];
  for (const a of ACHIEVEMENTS) {
    if (state.achievements[a.id]) continue;
    let ok = false;
    try {
      ok = !!a.check(state, ctx);
    } catch (e) {
      ok = false;
    }
    if (ok) {
      state.achievements[a.id] = true;
      if (a.reward) state.coins += a.reward;
      newlyUnlocked.push(a);
    }
  }
  return newlyUnlocked;
}

export function achievementProgress(state) {
  const total = ACHIEVEMENTS.length;
  const done = ACHIEVEMENTS.filter((a) => state.achievements[a.id]).length;
  return { done, total, pct: total ? done / total : 0 };
}
