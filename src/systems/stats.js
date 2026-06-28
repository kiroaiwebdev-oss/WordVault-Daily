// Statistics + streak tracking and the guess-distribution histogram.

// Record a completed game. `won` boolean, `rows` = number of guesses used (1..6),
// `day` = the daily puzzle number (or null for practice — practice still counts
// toward played/wins but not the daily streak).
export function recordResult(state, { won, rows, day, isDaily }) {
  const s = state.stats;
  s.played += 1;
  if (won) {
    s.wins += 1;
    if (rows >= 1 && rows <= 6) s.distribution[rows - 1] += 1;
  }

  if (isDaily) {
    if (won) {
      // Streak continues if the previous win was the immediately preceding day.
      if (s.lastWinDay === day - 1) s.currentStreak += 1;
      else s.currentStreak = 1;
      s.lastWinDay = day;
      if (s.currentStreak > s.maxStreak) s.maxStreak = s.currentStreak;
    } else {
      s.currentStreak = 0;
    }
  }
  return s;
}

export function winRate(state) {
  const s = state.stats;
  if (s.played === 0) return 0;
  return Math.round((s.wins / s.played) * 100);
}

export function maxDistribution(state) {
  return Math.max(1, ...state.stats.distribution);
}
