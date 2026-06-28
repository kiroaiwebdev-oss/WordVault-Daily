// Daily mission engine. Generates a deterministic set of 3 missions per day,
// tracks progress against gameplay events, and grants rewards on claim.

import { MISSION_TEMPLATES } from "../config/missions.js";
import { mulberry32, hashString } from "../core/rng.js";

export function ensureMissions(state, day) {
  if (state.missions.day === day && Array.isArray(state.missions.list) && state.missions.list.length) {
    return state.missions.list;
  }
  const rng = mulberry32(hashString("missions-" + day));
  const pool = MISSION_TEMPLATES.slice();
  // Fisher-Yates with seeded rng for a stable daily selection.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  // Always include the daily win mission, then two others.
  const chosen = [];
  const daily = pool.find((m) => m.id === "win_daily");
  if (daily) chosen.push(daily);
  for (const m of pool) {
    if (chosen.length >= 3) break;
    if (m.id === "win_daily") continue;
    chosen.push(m);
  }
  state.missions.day = day;
  state.missions.list = chosen.map((m) => ({
    id: m.id, name: m.name, desc: m.desc, goal: m.goal, reward: m.reward, evt: m.evt,
    progress: 0, done: false, claimed: false,
  }));
  return state.missions.list;
}

// Feed an event with an amount. Returns missions that became complete.
export function progressMissions(state, evt, amount = 1) {
  const completed = [];
  for (const m of state.missions.list || []) {
    if (m.done || m.evt !== evt) continue;
    m.progress = Math.min(m.goal, m.progress + amount);
    if (m.progress >= m.goal) {
      m.done = true;
      completed.push(m);
    }
  }
  return completed;
}

export function claimMission(state, id) {
  const m = (state.missions.list || []).find((x) => x.id === id);
  if (!m || !m.done || m.claimed) return 0;
  m.claimed = true;
  state.coins += m.reward;
  return m.reward;
}

// Report game outcome -> fire all relevant mission events at once.
export function reportGameToMissions(state, ctx) {
  const completed = [];
  const push = (arr) => arr.forEach((m) => completed.push(m));
  push(progressMissions(state, "gameFinished", 1));
  if (ctx.won) {
    if (ctx.isDaily) push(progressMissions(state, "dailyWin", 1));
    if (ctx.rows <= 4) push(progressMissions(state, "quickWin4", 1));
    if (ctx.rows <= 3) push(progressMissions(state, "quickWin3", 1));
    if (ctx.hintsUsed === 0) push(progressMissions(state, "noHintWin", 1));
    if (ctx.hardMode) push(progressMissions(state, "hardWin", 1));
    if (ctx.coinsEarned) push(progressMissions(state, "coinsEarned", ctx.coinsEarned));
  }
  return completed;
}
