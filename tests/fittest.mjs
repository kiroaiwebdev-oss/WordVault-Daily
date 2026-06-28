// Proves Board.fit() never produces a board that overflows its wrapper, across a
// wide range of viewport/wrapper sizes and orientations (the core "responsive" fix).

import { setupDom } from "./fakedom.mjs";
setupDom();
const { Board } = await import("../src/ui/board.js");

let pass = 0;
function check(name, cond) {
  if (cond) { pass++; console.log("  ✓ " + name); }
  else { console.error("  ✗ " + name); process.exitCode = 1; }
}

console.log("Board fit / responsiveness suite");

// Representative wrapper sizes (width x height) — phones, tablets, desktop card,
// short landscape, ultrawide, tiny.
const sizes = [
  [320, 480], [360, 640], [390, 700], [414, 560], [768, 900], [834, 1112],
  [440, 720], [440, 300], [600, 200], [1200, 900], [280, 900], [1000, 380],
];

const wrap = document.createElement("div");
const boardEl = document.createElement("div");
wrap.appendChild(boardEl);
const board = new Board(boardEl, { rows: 6, cols: 5 });

for (const [w, h] of sizes) {
  wrap._cw = w; wrap._ch = h;
  board.fit();
  const bw = parseInt(boardEl.style.width, 10);
  const bh = parseInt(boardEl.style.height, 10);
  const fitsW = bw <= w;
  const fitsH = bh <= h;
  const ratioOk = Math.abs(bw / bh - 5 / 6) < 0.02;
  check(`fit ${w}x${h} -> ${bw}x${bh} (within bounds + ratio)`, fitsW && fitsH && ratioOk);
}

// Bonus 7th row keeps fitting.
board.addExtraRow();
wrap._cw = 390; wrap._ch = 700;
board.fit();
const bw = parseInt(boardEl.style.width, 10);
const bh = parseInt(boardEl.style.height, 10);
check(`7-row board fits 390x700 -> ${bw}x${bh}`, bw <= 390 && bh <= 700 && Math.abs(bw / bh - 5 / 7) < 0.02);

console.log(`Fit suite: ${pass} checks passed`);
