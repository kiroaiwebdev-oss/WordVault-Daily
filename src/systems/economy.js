// Economy: coins, purchases (boosters, skins, themes), daily reward ladder.

import { BOOSTER_BY_ID, SKIN_BY_ID } from "../config/shop.js";
import { THEMES } from "../config/themes.js";

export function addCoins(state, amount) {
  state.coins = Math.max(0, (state.coins || 0) + amount);
  return state.coins;
}

export function spend(state, amount) {
  if (state.coins < amount) return false;
  state.coins -= amount;
  return true;
}

export function buyBooster(state, id) {
  const b = BOOSTER_BY_ID[id];
  if (!b) return { ok: false, reason: "Unknown item" };
  if (!spend(state, b.price)) return { ok: false, reason: "Not enough coins" };
  state.inventory[id] = (state.inventory[id] || 0) + 1;
  return { ok: true, item: b };
}

export function useBooster(state, id) {
  if ((state.inventory[id] || 0) <= 0) return false;
  state.inventory[id] -= 1;
  return true;
}

export function buySkin(state, id) {
  const sk = SKIN_BY_ID[id];
  if (!sk) return { ok: false, reason: "Unknown skin" };
  if (state.skins.owned.includes(id)) return { ok: false, reason: "Already owned" };
  if (!spend(state, sk.price)) return { ok: false, reason: "Not enough coins" };
  state.skins.owned.push(id);
  return { ok: true, item: sk };
}

export function equipSkin(state, id) {
  if (!state.skins.owned.includes(id)) return false;
  state.skins.active = id;
  return true;
}

export function buyTheme(state, id) {
  const t = THEMES[id];
  if (!t) return { ok: false, reason: "Unknown theme" };
  if (state.themes.owned.includes(id)) return { ok: false, reason: "Already owned" };
  if (!spend(state, t.price)) return { ok: false, reason: "Not enough coins" };
  state.themes.owned.push(id);
  return { ok: true, item: t };
}

export function equipTheme(state, id) {
  if (!state.themes.owned.includes(id)) return false;
  state.themes.active = id;
  state.settings.autoTheme = false; // manually choosing a theme disables auto
  return true;
}

// Daily reward ladder: escalating coins for consecutive claim days.
const REWARD_LADDER = [20, 30, 40, 50, 75, 100, 150];

export function dailyRewardInfo(state, day) {
  const dr = state.dailyReward;
  const canClaim = dr.lastClaimDay !== day;
  let nextStreak = dr.streak;
  if (canClaim) {
    nextStreak = dr.lastClaimDay === day - 1 ? dr.streak + 1 : 1;
  }
  const idx = Math.min(REWARD_LADDER.length - 1, Math.max(0, nextStreak - 1));
  return { canClaim, amount: REWARD_LADDER[idx], streak: nextStreak, ladder: REWARD_LADDER };
}

export function claimDailyReward(state, day) {
  const info = dailyRewardInfo(state, day);
  if (!info.canClaim) return { ok: false, amount: 0 };
  state.dailyReward.streak = info.streak;
  state.dailyReward.lastClaimDay = day;
  addCoins(state, info.amount);
  return { ok: true, amount: info.amount, streak: info.streak };
}
