// On-screen keyboard. Touch-friendly (touch-action: manipulation), updates key
// colors from guess results without downgrading (correct > present > absent).

import { el, clear } from "./dom.js";

const ROWS = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["enter", "z", "x", "c", "v", "b", "n", "m", "backspace"],
];

export class Keyboard {
  constructor(container, onPress) {
    this.container = container;
    this.onPress = onPress || (() => {});
    this.keyEls = {};
    this.build();
  }

  build() {
    clear(this.container);
    this.container.classList.add("keyboard");
    this.keyEls = {};
    for (const row of ROWS) {
      const rowEl = el("div", { class: "keyboard__row" });
      for (const key of row) {
        const wide = key === "enter" || key === "backspace";
        const label = key === "enter" ? "Enter" : key === "backspace" ? "⌫" : key.toUpperCase();
        const btn = el("button", {
          class: "key" + (wide ? " key--wide" : ""),
          type: "button",
          "aria-label": key,
          dataset: { key },
        }, [label]);
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          this.onPress(key);
        });
        rowEl.appendChild(btn);
        this.keyEls[key] = btn;
      }
      this.container.appendChild(rowEl);
    }
  }

  setEnabled(enabled) {
    for (const k in this.keyEls) this.keyEls[k].disabled = !enabled;
  }

  // states: { a: 'correct'|'present'|'absent', ... }
  applyStates(states) {
    for (const k in this.keyEls) {
      const btn = this.keyEls[k];
      btn.classList.remove("key--correct", "key--present", "key--absent");
      const st = states[k];
      if (st) btn.classList.add("key--" + st);
    }
  }

  pulse(key) {
    const btn = this.keyEls[key];
    if (!btn) return;
    btn.classList.add("key--press");
    setTimeout(() => btn.classList.remove("key--press"), 120);
  }

  reset() {
    this.applyStates({});
  }
}
