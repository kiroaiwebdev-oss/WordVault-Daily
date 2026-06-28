// Daily mission templates. Three are picked deterministically per day.

export const MISSION_TEMPLATES = [
  { id: "win_daily", name: "Daily Solver", desc: "Win today's daily puzzle.", goal: 1, reward: 30, evt: "dailyWin" },
  { id: "play_2", name: "Warm Up", desc: "Finish 2 games (any mode).", goal: 2, reward: 25, evt: "gameFinished" },
  { id: "play_4", name: "Marathon", desc: "Finish 4 games (any mode).", goal: 4, reward: 45, evt: "gameFinished" },
  { id: "quick_4", name: "Sharp Mind", desc: "Win in 4 guesses or fewer.", goal: 1, reward: 35, evt: "quickWin4" },
  { id: "quick_3", name: "Quick Thinker", desc: "Win in 3 guesses or fewer.", goal: 1, reward: 55, evt: "quickWin3" },
  { id: "no_hint", name: "Unassisted", desc: "Win a game without a hint.", goal: 1, reward: 40, evt: "noHintWin" },
  { id: "hard_win", name: "Hard Way", desc: "Win a game in Hard Mode.", goal: 1, reward: 50, evt: "hardWin" },
  { id: "earn_coins", name: "Coin Hunter", desc: "Earn 40 coins from games.", goal: 40, reward: 20, evt: "coinsEarned" },
];
