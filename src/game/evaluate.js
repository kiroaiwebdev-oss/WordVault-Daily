// Guess evaluation with correct duplicate-letter handling (two-pass algorithm).
// Returns an array of states: "correct" | "present" | "absent" per position.

export const STATE = {
  CORRECT: "correct",
  PRESENT: "present",
  ABSENT: "absent",
  EMPTY: "empty",
  TBD: "tbd",
};

export function evaluateGuess(guess, answer) {
  guess = String(guess).toLowerCase();
  answer = String(answer).toLowerCase();
  const n = answer.length;
  const result = new Array(n).fill(STATE.ABSENT);
  const counts = {};

  // First pass: mark exact (correct) matches and count remaining answer letters.
  for (let i = 0; i < n; i++) {
    if (guess[i] === answer[i]) {
      result[i] = STATE.CORRECT;
    } else {
      counts[answer[i]] = (counts[answer[i]] || 0) + 1;
    }
  }

  // Second pass: mark present (right letter, wrong place) only while counts remain.
  for (let i = 0; i < n; i++) {
    if (result[i] === STATE.CORRECT) continue;
    const ch = guess[i];
    if (counts[ch] > 0) {
      result[i] = STATE.PRESENT;
      counts[ch]--;
    }
  }

  return result;
}

// Merge new per-letter results into a keyboard color map without downgrading.
// Priority: correct > present > absent.
const RANK = { correct: 3, present: 2, absent: 1 };
export function mergeKeyStates(keyStates, guess, result) {
  guess = String(guess).toLowerCase();
  for (let i = 0; i < guess.length; i++) {
    const ch = guess[i];
    const next = result[i];
    const cur = keyStates[ch];
    if (!cur || RANK[next] > RANK[cur]) {
      keyStates[ch] = next;
    }
  }
  return keyStates;
}

export function isWin(result) {
  return result.length > 0 && result.every((s) => s === STATE.CORRECT);
}

// Build an emoji grid for sharing (spoiler-free; only colors, no letters).
export function emojiRow(result, dark = true) {
  const map = dark
    ? { correct: "🟩", present: "🟨", absent: "⬛" }
    : { correct: "🟩", present: "🟨", absent: "⬜" };
  return result.map((s) => map[s] || "⬜").join("");
}
