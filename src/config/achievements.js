// Achievement definitions. Each has a `check(state, ctx)` predicate evaluated
// after relevant events. ctx carries the latest game outcome.

export const ACHIEVEMENTS = [
  { id: "first_win", name: "First Blood", desc: "Win your first puzzle.", icon: "🏆", reward: 20,
    check: (s) => s.stats.wins >= 1 },
  { id: "win_10", name: "Ten Down", desc: "Win 10 puzzles.", icon: "🔟", reward: 50,
    check: (s) => s.stats.wins >= 10 },
  { id: "win_50", name: "Half Century", desc: "Win 50 puzzles.", icon: "💯", reward: 150,
    check: (s) => s.stats.wins >= 50 },
  { id: "streak_3", name: "On a Roll", desc: "Reach a 3-day streak.", icon: "🔥", reward: 40,
    check: (s) => s.stats.maxStreak >= 3 },
  { id: "streak_7", name: "Week Warrior", desc: "Reach a 7-day streak.", icon: "📆", reward: 100,
    check: (s) => s.stats.maxStreak >= 7 },
  { id: "streak_30", name: "Unstoppable", desc: "Reach a 30-day streak.", icon: "⚡", reward: 400,
    check: (s) => s.stats.maxStreak >= 30 },
  { id: "ace", name: "Hole in One", desc: "Solve in a single guess.", icon: "🎯", reward: 200,
    check: (s, c) => c && c.won && c.rows === 1 },
  { id: "clutch", name: "Clutch", desc: "Win on the 6th guess.", icon: "😅", reward: 30,
    check: (s, c) => c && c.won && c.rows === 6 },
  { id: "hard_win", name: "No Mercy", desc: "Win a puzzle in Hard Mode.", icon: "💀", reward: 60,
    check: (s, c) => c && c.won && c.hardMode },
  { id: "no_hint", name: "Pure Skill", desc: "Win without using a hint.", icon: "🧠", reward: 40,
    check: (s, c) => c && c.won && c.hintsUsed === 0 },
  { id: "level_10", name: "Lexicon", desc: "Reach level 10.", icon: "⭐", reward: 120,
    check: (s) => s.level >= 10 },
  { id: "collector", name: "Curator", desc: "Own 3 themes.", icon: "🎨", reward: 80,
    check: (s) => (s.themes.owned ? s.themes.owned.length : 0) >= 3 },
  { id: "rich", name: "Treasure Vault", desc: "Hold 500 coins at once.", icon: "💰", reward: 0,
    check: (s) => s.coins >= 500 },
];

export function achievementById(id) {
  return ACHIEVEMENTS.find((a) => a.id === id) || null;
}
