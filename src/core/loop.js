// Game loop with real-time dt, clamped to avoid fast-forward after tab switches.
// Supports pause/resume and registers update + render callbacks.

export class Loop {
  constructor({ update, render, maxDt = 0.05 } = {}) {
    this.update = update || (() => {});
    this.render = render || (() => {});
    this.maxDt = maxDt;
    this.running = false;
    this.paused = false;
    this.last = 0;
    this._raf = null;
    this._tick = this._tick.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.paused = false;
    this.last = (typeof performance !== "undefined" ? performance.now() : Date.now());
    this._raf = requestFrame(this._tick);
  }

  stop() {
    this.running = false;
    if (this._raf != null) cancelFrame(this._raf);
    this._raf = null;
  }

  pause() {
    this.paused = true;
  }

  resume() {
    if (!this.paused) return;
    this.paused = false;
    // Reset timestamp so dt does not spike after a long pause.
    this.last = (typeof performance !== "undefined" ? performance.now() : Date.now());
  }

  _tick(now) {
    if (!this.running) return;
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > this.maxDt) dt = this.maxDt;
    if (dt < 0) dt = 0;
    if (!this.paused) {
      this.update(dt);
    }
    this.render(dt, this.paused);
    this._raf = requestFrame(this._tick);
  }
}

function requestFrame(cb) {
  if (typeof requestAnimationFrame !== "undefined") return requestAnimationFrame(cb);
  return setTimeout(() => cb(Date.now()), 16);
}

function cancelFrame(id) {
  if (typeof cancelAnimationFrame !== "undefined") return cancelAnimationFrame(id);
  return clearTimeout(id);
}
