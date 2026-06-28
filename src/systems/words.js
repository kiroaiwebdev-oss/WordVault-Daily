// Word system: sanitizes bundled lists, selects the deterministic daily word,
// validates guesses, and exposes letter-frequency data for the hint system.

import { ANSWERS, EXTRA_VALID } from "../data/words.js";
import { seededIndex } from "../core/rng.js";

const WORD_RE = /^[a-z]{5}$/;
export const EPOCH = Date.UTC(2024, 0, 1); // WordVault #1 = 2024-01-01 (UTC)

function sanitize(list) {
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const w = String(raw || "").toLowerCase().trim();
    if (WORD_RE.test(w) && !seen.has(w)) {
      seen.add(w);
      out.push(w);
    }
  }
  return out;
}

export const ANSWER_LIST = sanitize(ANSWERS);
const ANSWER_SET = new Set(ANSWER_LIST);
export const VALID_SET = (() => {
  const s = new Set(ANSWER_LIST);
  for (const w of sanitize(EXTRA_VALID)) s.add(w);
  return s;
})();

// Letter frequency across the answer pool (used by the hint system).
export const LETTER_FREQ = (() => {
  const freq = {};
  for (const w of ANSWER_LIST) {
    for (const ch of w) freq[ch] = (freq[ch] || 0) + 1;
  }
  return freq;
})();

export function isValidWord(word) {
  const w = String(word || "").toLowerCase();
  return VALID_SET.has(w);
}

export function isAnswer(word) {
  return ANSWER_SET.has(String(word || "").toLowerCase());
}

// Day number since EPOCH (UTC) — this is the WordVault puzzle number.
export function dayNumber(date = new Date()) {
  const utcMidnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.floor((utcMidnight - EPOCH) / 86400000);
}

// Deterministic daily answer. Everyone gets the same word for a given day.
export function dailyWord(date = new Date()) {
  const n = dayNumber(date);
  const idx = seededIndex("wordvault-daily-" + n, ANSWER_LIST.length);
  return ANSWER_LIST[idx];
}

// Random practice word (not date-bound).
export function randomWord(rand = Math.random) {
  return ANSWER_LIST[Math.floor(rand() * ANSWER_LIST.length) % ANSWER_LIST.length];
}

// Rank remaining letters by frequency, excluding ones already known.
export function bestHintLetter(answer, knownLetters = new Set()) {
  const letters = Array.from(new Set(answer.split("")));
  let best = null;
  let bestScore = -1;
  for (const ch of letters) {
    if (knownLetters.has(ch)) continue;
    const score = LETTER_FREQ[ch] || 0;
    if (score > bestScore) {
      bestScore = score;
      best = ch;
    }
  }
  return best;
}
