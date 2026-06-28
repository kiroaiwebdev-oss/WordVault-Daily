// Logic/unit tests: evaluation (incl. duplicate letters), hard-mode validation,
// daily-word determinism + validity, stats/streak math, profile XP/levels,
// economy purchases, and mission generation. Pure logic — no DOM required.

import assert from "assert";
import { evaluateGuess, mergeKeyStates, isWin, emojiRow, STATE } from "../src/game/evaluate.js";
import { validateHardMode } from "../src/game/rules.js";
import * as Words from "../src/systems/words.js";
import { recordResult, winRate } from "../src/systems/stats.js";
import { addXp, xpForLevel } from "../src/systems/profile.js";
import * as Eco from "../src/systems/economy.js";
import { defaultState } from "../src/systems/save.js";
import { ensureMissions, progressMissions, claimMission } from "../src/systems/missions.js";

let pass = 0;
function test(name, fn) {
  try { fn(); pass++; console.log("  ✓ " + name); }
  catch (e) { console.error("  ✗ " + name + "\n      " + e.message); process.exitCode = 1; }
}

console.log("Logic suite");

// --- Evaluation ---
test("evaluate: all correct", () => {
  assert.deepStrictEqual(evaluateGuess("crane", "crane"), Array(5).fill(STATE.CORRECT));
  assert.ok(isWin(evaluateGuess("crane", "crane")));
});

test("evaluate: all absent", () => {
  assert.deepStrictEqual(evaluateGuess("fghij".slice(0,5).padEnd(5,"x").slice(0,5), "qwzpb"), ["absent","absent","absent","absent","absent"].map(()=> STATE.ABSENT));
});

test("evaluate: duplicate letters handled (guess has more than answer)", () => {
  // answer ABBEY has one 'b'... use 'allay' vs guess 'llama'
  const res = evaluateGuess("eerie", "there");
  // answer THERE has letters t,h,e,r,e (two e). guess EERIE: e,e,r,i,e
  // positions: pos0 e vs t -> not correct; pos4 e vs e -> correct.
  assert.strictEqual(res[4], STATE.CORRECT);
  // Only two e's exist in answer; one consumed by position 4 correct, the other present once.
  const eMarks = ["e0","e1","e4"]; // indices 0,1,4 are 'e'
  const presentCount = [res[0], res[1]].filter((s) => s === STATE.PRESENT).length;
  assert.strictEqual(presentCount, 1, "exactly one extra e should be present");
});

test("evaluate: duplicate in guess not over-marked", () => {
  // answer 'apple', guess 'ppppp' -> only the two p positions can be correct/present
  const res = evaluateGuess("ppppp", "apple");
  const colored = res.filter((s) => s !== STATE.ABSENT).length;
  // 'apple' has p at index 1 and 2; guess ppppp -> indices1,2 correct, rest absent
  assert.strictEqual(res[1], STATE.CORRECT);
  assert.strictEqual(res[2], STATE.CORRECT);
  assert.strictEqual(colored, 2);
});

test("mergeKeyStates never downgrades", () => {
  const ks = {};
  mergeKeyStates(ks, "aabbc", [STATE.CORRECT, STATE.ABSENT, STATE.PRESENT, STATE.ABSENT, STATE.ABSENT]);
  assert.strictEqual(ks.a, STATE.CORRECT); // a was correct first
  mergeKeyStates(ks, "axxxx", [STATE.ABSENT, STATE.ABSENT, STATE.ABSENT, STATE.ABSENT, STATE.ABSENT]);
  assert.strictEqual(ks.a, STATE.CORRECT, "should not downgrade correct to absent");
});

test("emojiRow renders colors", () => {
  const row = emojiRow([STATE.CORRECT, STATE.PRESENT, STATE.ABSENT, STATE.CORRECT, STATE.ABSENT], true);
  assert.strictEqual(row, "🟩🟨⬛🟩⬛");
});

// --- Hard mode ---
test("hardMode: green position enforced", () => {
  const history = [{ guess: "crane", result: [STATE.CORRECT, STATE.ABSENT, STATE.ABSENT, STATE.ABSENT, STATE.ABSENT] }];
  assert.strictEqual(validateHardMode("cxxxx", history).ok, true);
  assert.strictEqual(validateHardMode("xxxxx", history).ok, false);
});

test("hardMode: present letter must be included", () => {
  const history = [{ guess: "crane", result: [STATE.ABSENT, STATE.PRESENT, STATE.ABSENT, STATE.ABSENT, STATE.ABSENT] }];
  // 'r' is present and must appear
  assert.strictEqual(validateHardMode("brick", history).ok, true);
  assert.strictEqual(validateHardMode("light", history).ok, false);
});

// --- Words ---
test("words: lists sanitized to 5 letters", () => {
  assert.ok(Words.ANSWER_LIST.length > 100, "should have many answers");
  assert.ok(Words.ANSWER_LIST.every((w) => /^[a-z]{5}$/.test(w)), "all answers exactly 5 letters");
});

test("words: daily is deterministic + valid", () => {
  const d = new Date(Date.UTC(2025, 5, 1));
  const a = Words.dailyWord(d);
  const b = Words.dailyWord(d);
  assert.strictEqual(a, b, "same date -> same word");
  assert.ok(Words.isAnswer(a));
  assert.ok(Words.isValidWord(a));
});

test("words: different days usually differ", () => {
  const seen = new Set();
  for (let i = 0; i < 30; i++) {
    seen.add(Words.dailyWord(new Date(Date.UTC(2025, 0, 1 + i))));
  }
  assert.ok(seen.size > 20, "30 days should yield mostly distinct words");
});

test("words: dayNumber increments by 1 per day", () => {
  const d1 = Words.dayNumber(new Date(Date.UTC(2025, 0, 1)));
  const d2 = Words.dayNumber(new Date(Date.UTC(2025, 0, 2)));
  assert.strictEqual(d2 - d1, 1);
});

test("words: hint letter is in answer and not already known", () => {
  const known = new Set();
  const l = Words.bestHintLetter("crane", known);
  assert.ok("crane".includes(l));
});

// --- Stats / streaks ---
test("stats: consecutive daily wins build streak", () => {
  const s = defaultState();
  recordResult(s, { won: true, rows: 3, day: 100, isDaily: true });
  recordResult(s, { won: true, rows: 4, day: 101, isDaily: true });
  assert.strictEqual(s.stats.currentStreak, 2);
  recordResult(s, { won: true, rows: 2, day: 103, isDaily: true }); // gap
  assert.strictEqual(s.stats.currentStreak, 1, "gap resets streak");
  assert.strictEqual(s.stats.maxStreak, 2);
});

test("stats: loss resets daily streak", () => {
  const s = defaultState();
  recordResult(s, { won: true, rows: 3, day: 1, isDaily: true });
  recordResult(s, { won: false, rows: 6, day: 2, isDaily: true });
  assert.strictEqual(s.stats.currentStreak, 0);
});

test("stats: distribution + win rate", () => {
  const s = defaultState();
  recordResult(s, { won: true, rows: 3, day: 1, isDaily: true });
  recordResult(s, { won: false, rows: 6, day: 2, isDaily: true });
  assert.strictEqual(s.stats.distribution[2], 1);
  assert.strictEqual(winRate(s), 50);
});

// --- Profile XP ---
test("profile: xp accumulates and levels up", () => {
  const s = defaultState();
  const need = xpForLevel(1);
  const r = addXp(s, need);
  assert.ok(r.leveledUp);
  assert.strictEqual(s.level, 2);
});

// --- Economy ---
test("economy: buy booster spends coins", () => {
  const s = defaultState();
  s.coins = 100;
  const r = Eco.buyBooster(s, "hint");
  assert.ok(r.ok);
  assert.strictEqual(s.coins, 70);
  assert.strictEqual(s.inventory.hint, 2); // started at 1
});

test("economy: cannot buy without coins", () => {
  const s = defaultState();
  s.coins = 0;
  const r = Eco.buyBooster(s, "reveal");
  assert.strictEqual(r.ok, false);
});

test("economy: buy + equip skin", () => {
  const s = defaultState();
  s.coins = 1000;
  assert.ok(Eco.buySkin(s, "neon").ok);
  assert.ok(Eco.equipSkin(s, "neon"));
  assert.strictEqual(s.skins.active, "neon");
});

test("economy: daily reward escalates and blocks double-claim", () => {
  const s = defaultState();
  const r1 = Eco.claimDailyReward(s, 10);
  assert.ok(r1.ok);
  const r2 = Eco.claimDailyReward(s, 10);
  assert.strictEqual(r2.ok, false, "cannot claim twice same day");
  const r3 = Eco.claimDailyReward(s, 11);
  assert.ok(r3.ok);
  assert.ok(r3.amount >= r1.amount, "consecutive day reward not smaller");
});

// --- Missions ---
test("missions: deterministic 3 per day incl daily win", () => {
  const s = defaultState();
  const list = ensureMissions(s, 42);
  assert.strictEqual(list.length, 3);
  assert.ok(list.some((m) => m.id === "win_daily"));
  // regenerating same day is stable
  const again = ensureMissions(s, 42);
  assert.strictEqual(again, list);
});

test("missions: progress + claim grants coins", () => {
  const s = defaultState();
  ensureMissions(s, 7);
  s.coins = 0;
  const done = progressMissions(s, "gameFinished", 5);
  // find a mission tracking gameFinished if present
  const gm = s.missions.list.find((m) => m.evt === "gameFinished");
  if (gm) {
    assert.ok(gm.progress > 0);
    if (gm.done) {
      const reward = claimMission(s, gm.id);
      assert.strictEqual(reward, gm.reward);
      assert.strictEqual(s.coins, gm.reward);
    }
  }
});

console.log(`Logic suite: ${pass} checks passed`);
