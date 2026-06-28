// Hard-mode rule validation. In hard mode, every revealed hint must be reused:
//  - greens (correct) must stay in the same position
//  - yellows (present) must appear somewhere in the next guess

import { STATE } from "./evaluate.js";

const ORD = ["1st", "2nd", "3rd", "4th", "5th", "6th"];

export function validateHardMode(guess, history) {
  guess = String(guess).toLowerCase();
  // Required greens: position -> letter
  const greens = {};
  // Required presents: letter -> minimum count that must appear
  const presentCounts = {};

  for (const entry of history) {
    const g = entry.guess.toLowerCase();
    const res = entry.result;
    const localPresent = {};
    for (let i = 0; i < res.length; i++) {
      if (res[i] === STATE.CORRECT) {
        greens[i] = g[i];
      } else if (res[i] === STATE.PRESENT) {
        localPresent[g[i]] = (localPresent[g[i]] || 0) + 1;
      }
    }
    // A letter's required-present count is the max seen across rows.
    for (const ch in localPresent) {
      presentCounts[ch] = Math.max(presentCounts[ch] || 0, localPresent[ch]);
    }
  }

  // Check greens.
  for (const pos in greens) {
    const i = Number(pos);
    if (guess[i] !== greens[pos]) {
      return {
        ok: false,
        reason: `${ORD[i]} letter must be ${greens[pos].toUpperCase()}`,
      };
    }
  }

  // Check presents (count occurrences in guess).
  const guessCounts = {};
  for (const ch of guess) guessCounts[ch] = (guessCounts[ch] || 0) + 1;
  for (const ch in presentCounts) {
    if ((guessCounts[ch] || 0) < presentCounts[ch]) {
      return { ok: false, reason: `Guess must contain ${ch.toUpperCase()}` };
    }
  }

  return { ok: true, reason: "" };
}
