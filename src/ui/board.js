// The guess board: 6 rows x 5 tiles. Handles tile letters, sequential flip
// reveal animation, invalid-word shake, win bounce, and skin classes.

import { el, clear } from "./dom.js";

export class Board {
  constructor(container, { rows = 6, cols = 5 } = {}) {
    this.container = container;
    this.rows = rows;
    this.cols = cols;
    this.cells = []; // cells[row][col] = tile element
    this.build();
  }

  build() {
    clear(this.container);
    this.cells = [];
    this.container.classList.add("board");
    // Reset any inline grid overrides from a previous bonus-row game.
    this.container.style.gridTemplateRows = "";
    this.container.style.aspectRatio = "";
    this.rows = this._baseRows || this.rows;
    this._baseRows = this.rows;
    for (let r = 0; r < this.rows; r++) {
      const rowEl = el("div", { class: "board__row", dataset: { row: String(r) } });
      const rowCells = [];
      for (let c = 0; c < this.cols; c++) {
        const inner = el("div", { class: "tile__inner" }, [
          el("div", { class: "tile__face tile__front" }),
          el("div", { class: "tile__face tile__back" }),
        ]);
        const tile = el("div", { class: "tile", dataset: { row: String(r), col: String(c) } }, [inner]);
        rowEl.appendChild(tile);
        rowCells.push(tile);
      }
      this.container.appendChild(rowEl);
      this.cells.push(rowCells);
    }
  }

  applySkin(cls) {
    this.container.className = "board " + (cls || "skin-default");
  }

  _setFaceText(tile, ch) {
    const front = tile.querySelector(".tile__front");
    const back = tile.querySelector(".tile__back");
    front.textContent = ch ? ch.toUpperCase() : "";
    back.textContent = ch ? ch.toUpperCase() : "";
  }

  // Update the active (current) row's letters as the player types.
  setCurrent(rowIndex, text) {
    if (rowIndex < 0 || rowIndex >= this.rows) return;
    const row = this.cells[rowIndex];
    for (let c = 0; c < this.cols; c++) {
      const ch = text[c] || "";
      const tile = row[c];
      this._setFaceText(tile, ch);
      tile.classList.toggle("tile--filled", !!ch);
      if (ch && (text.length - 1 === c)) {
        tile.classList.add("tile--pop");
        setTimeout(() => tile.classList.remove("tile--pop"), 120);
      }
    }
  }

  // Instantly render a completed row with its result states (used when restoring).
  renderRow(rowIndex, guess, result) {
    const row = this.cells[rowIndex];
    for (let c = 0; c < this.cols; c++) {
      const tile = row[c];
      this._setFaceText(tile, guess[c]);
      tile.classList.add("tile--filled", "tile--revealed", `tile--${result[c]}`);
      tile.classList.add("flipped");
    }
  }

  // Animated reveal of a guessed row. onLetter(state, index) fires per flip.
  revealRow(rowIndex, guess, result, { onLetter, onDone, stepMs = 260 } = {}) {
    const row = this.cells[rowIndex];
    let i = 0;
    const flipNext = () => {
      if (i >= this.cols) {
        if (onDone) onDone();
        return;
      }
      const c = i;
      const tile = row[c];
      this._setFaceText(tile, guess[c]);
      tile.classList.add("tile--flipping");
      // Apply color at the midpoint of the flip (when back face shows).
      setTimeout(() => {
        tile.classList.add("flipped", "tile--revealed", `tile--${result[c]}`);
        if (onLetter) onLetter(result[c], c, tile);
      }, stepMs / 2);
      setTimeout(() => {
        tile.classList.remove("tile--flipping");
      }, stepMs);
      i++;
      setTimeout(flipNext, stepMs * 0.65);
    };
    flipNext();
  }

  shakeRow(rowIndex) {
    const rowEl = this.container.children[rowIndex];
    if (!rowEl) return;
    rowEl.classList.remove("board__row--shake");
    // force reflow to restart the animation
    void rowEl.offsetWidth;
    rowEl.classList.add("board__row--shake");
    setTimeout(() => rowEl.classList.remove("board__row--shake"), 600);
  }

  bounceRow(rowIndex) {
    const row = this.cells[rowIndex];
    row.forEach((tile, c) => {
      setTimeout(() => {
        tile.classList.add("tile--bounce");
        setTimeout(() => tile.classList.remove("tile--bounce"), 600);
      }, c * 90);
    });
  }

  // Highlight a single tile (used by the Reveal booster).
  lockTile(rowIndex, col, ch) {
    const tile = this.cells[rowIndex] && this.cells[rowIndex][col];
    if (!tile) return;
    this._setFaceText(tile, ch);
    tile.classList.add("tile--filled", "tile--hintlock");
    setTimeout(() => tile.classList.remove("tile--hintlock"), 1200);
  }

  // Return the center coordinates (viewport) of a tile for particle spawns.
  tileCenter(rowIndex, col) {
    const tile = this.cells[rowIndex] && this.cells[rowIndex][col];
    if (!tile) return { x: 0, y: 0 };
    const r = tile.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  // Append one extra row (used by the rewarded "one more guess" continue).
  addExtraRow() {
    const r = this.rows;
    const rowEl = el("div", { class: "board__row board__row--bonus", dataset: { row: String(r) } });
    const rowCells = [];
    for (let c = 0; c < this.cols; c++) {
      const inner = el("div", { class: "tile__inner" }, [
        el("div", { class: "tile__face tile__front" }),
        el("div", { class: "tile__face tile__back" }),
      ]);
      const tile = el("div", { class: "tile", dataset: { row: String(r), col: String(c) } }, [inner]);
      rowEl.appendChild(tile);
      rowCells.push(tile);
    }
    this.container.appendChild(rowEl);
    this.cells.push(rowCells);
    this.rows += 1;
    // Keep the grid proportional as rows grow.
    this.container.style.gridTemplateRows = `repeat(${this.rows}, 1fr)`;
    this.container.style.aspectRatio = `5 / ${this.rows}`;
  }

  reset() {
    this.build();
  }
}
