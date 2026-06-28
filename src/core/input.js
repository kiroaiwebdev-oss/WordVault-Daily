// Unified input: physical keyboard for letter entry + an event bus the UI keyboard
// also feeds into. preventDefault is applied to keys that would scroll the page.

const LETTER_RE = /^[a-z]$/;

export class Input {
  constructor() {
    this.listeners = { key: [], enter: [], backspace: [] };
    this.enabled = true;
    this._onKeyDown = this._onKeyDown.bind(this);
  }

  attach(target) {
    this.target = target || (typeof window !== "undefined" ? window : null);
    if (this.target && this.target.addEventListener) {
      this.target.addEventListener("keydown", this._onKeyDown);
    }
  }

  detach() {
    if (this.target && this.target.removeEventListener) {
      this.target.removeEventListener("keydown", this._onKeyDown);
    }
  }

  on(type, cb) {
    if (this.listeners[type]) this.listeners[type].push(cb);
    return () => this.off(type, cb);
  }

  off(type, cb) {
    const arr = this.listeners[type];
    if (!arr) return;
    const i = arr.indexOf(cb);
    if (i >= 0) arr.splice(i, 1);
  }

  emit(type, payload) {
    const arr = this.listeners[type];
    if (!arr) return;
    for (const cb of arr.slice()) cb(payload);
  }

  // Programmatic entry used by the on-screen keyboard.
  press(letter) {
    if (!this.enabled) return;
    const k = String(letter || "").toLowerCase();
    if (k === "enter") this.emit("enter");
    else if (k === "backspace" || k === "back" || k === "del") this.emit("backspace");
    else if (LETTER_RE.test(k)) this.emit("key", k);
  }

  _onKeyDown(e) {
    if (!this.enabled) return;
    // Do not hijack browser shortcuts (Ctrl/Cmd/Alt combos) or fullscreen Esc.
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const key = (e.key || "").toLowerCase();
    if (key === "enter") {
      this.emit("enter");
    } else if (key === "backspace" || key === "delete") {
      this.emit("backspace");
    } else if (LETTER_RE.test(key)) {
      this.emit("key", key);
    } else if (key === " ") {
      // Prevent page scroll on space; otherwise ignore.
      if (e.preventDefault) e.preventDefault();
    }
  }
}
