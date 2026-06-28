// Player progression: XP, levels, and titles. Level curve grows each level.

export const TITLES = [
  { level: 1, name: "Rookie" },
  { level: 3, name: "Speller" },
  { level: 6, name: "Wordsmith" },
  { level: 10, name: "Lexicon" },
  { level: 15, name: "Sage" },
  { level: 22, name: "Maestro" },
  { level: 30, name: "Grandmaster" },
  { level: 45, name: "Legend" },
];

// XP required to advance FROM the given level to the next.
export function xpForLevel(level) {
  return 80 + (level - 1) * 40;
}

export function titleForLevel(level) {
  let title = TITLES[0].name;
  for (const t of TITLES) {
    if (level >= t.level) title = t.name;
  }
  return title;
}

// Add XP; returns { leveledUp, levelsGained, newLevel }.
export function addXp(state, amount) {
  state.xp = Math.max(0, (state.xp || 0) + amount);
  let leveledUp = false;
  let levelsGained = 0;
  while (state.xp >= xpForLevel(state.level)) {
    state.xp -= xpForLevel(state.level);
    state.level += 1;
    leveledUp = true;
    levelsGained++;
  }
  state.profile.title = titleForLevel(state.level);
  return { leveledUp, levelsGained, newLevel: state.level };
}

export function levelProgress(state) {
  const need = xpForLevel(state.level);
  return { have: state.xp, need, pct: Math.max(0, Math.min(1, state.xp / need)) };
}
