// Minimal DOM + browser-global stub sufficient to boot the real WordVault game
// headlessly in Node. Implements the subset of the DOM API the game touches:
// elements, classList, style, events (with click()), querySelector by class/tag,
// canvas 2d context, localStorage, rAF, getComputedStyle, navigator, performance.

class ClassList {
  constructor(el) { this.el = el; this.set = new Set(); }
  _sync() { this.el._className = Array.from(this.set).join(" "); }
  add(...c) { c.forEach((x) => x && this.set.add(x)); this._sync(); }
  remove(...c) { c.forEach((x) => this.set.delete(x)); this._sync(); }
  toggle(c, force) {
    const has = this.set.has(c);
    const want = force === undefined ? !has : !!force;
    if (want) this.set.add(c); else this.set.delete(c);
    this._sync();
    return want;
  }
  contains(c) { return this.set.has(c); }
}

class Style {
  constructor() { this._props = {}; }
  setProperty(k, v) { this._props[k] = v; }
  getPropertyValue(k) { return this._props[k] || ""; }
}

let nextId = 1;

class El {
  constructor(tag) {
    this.tagName = (tag || "div").toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.classList = new ClassList(this);
    this._className = "";
    this.style = new Style();
    this.dataset = {};
    this.attributes = {};
    this._listeners = {};
    this._text = "";
    this._html = "";
    this.disabled = false;
    this.checked = false;
    this.value = "";
    this._uid = nextId++;
  }
  get className() { return this._className; }
  set className(v) {
    this._className = v || "";
    this.classList.set = new Set(String(v || "").split(/\s+/).filter(Boolean));
  }
  get id() { return this.attributes.id || ""; }
  set id(v) { this.attributes.id = v; }
  get firstChild() { return this.children[0] || null; }
  get parentElement() { return this.parentNode; }
  get textContent() { return this._text; }
  set textContent(v) { this._text = String(v == null ? "" : v); this.children = []; }
  get innerHTML() { return this._html; }
  set innerHTML(v) { this._html = String(v == null ? "" : v); }
  get offsetWidth() { return 100; }
  get clientWidth() { return this._cw != null ? this._cw : 300; }
  get clientHeight() { return this._ch != null ? this._ch : 300; }
  appendChild(c) {
    if (!c) return c;
    c.parentNode = this;
    this.children.push(c);
    return c;
  }
  removeChild(c) {
    const i = this.children.indexOf(c);
    if (i >= 0) this.children.splice(i, 1);
    if (c) c.parentNode = null;
    return c;
  }
  setAttribute(k, v) { this.attributes[k] = v; if (k === "id") this.id = v; }
  getAttribute(k) { return this.attributes[k]; }
  removeAttribute(k) { delete this.attributes[k]; }
  addEventListener(type, cb) { (this._listeners[type] = this._listeners[type] || []).push(cb); }
  removeEventListener(type, cb) {
    const a = this._listeners[type]; if (!a) return;
    const i = a.indexOf(cb); if (i >= 0) a.splice(i, 1);
  }
  dispatch(type, evt = {}) {
    const a = this._listeners[type] || [];
    const e = Object.assign({ type, target: this, preventDefault() {}, stopPropagation() {} }, evt);
    a.slice().forEach((cb) => cb(e));
  }
  click() { this.dispatch("click", { target: this }); }
  focus() {}
  select() {}
  getBoundingClientRect() { return { left: 0, top: 0, right: 300, bottom: 300, width: 300, height: 300 }; }
  getContext() { return makeCtx(); }
  // --- selector helpers ---
  _matches(sel) {
    if (sel.startsWith(".")) return this.classList.contains(sel.slice(1));
    return this.tagName === sel.toUpperCase();
  }
  _descendants(out = []) {
    for (const c of this.children) { out.push(c); c._descendants(out); }
    return out;
  }
  querySelector(sel) {
    const token = sel.trim().split(/\s+/).pop();
    return this._descendants().find((d) => d._matches(token)) || null;
  }
  querySelectorAll(sel) {
    const token = sel.trim().split(/\s+/).pop();
    return this._descendants().filter((d) => d._matches(token));
  }
  set width(v) { this._width = v; }
  get width() { return this._width || 300; }
  set height(v) { this._height = v; }
  get height() { return this._height || 300; }
}

function makeCtx() {
  return {
    setTransform() {}, clearRect() {}, save() {}, restore() {}, translate() {},
    rotate() {}, fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {},
    closePath() {}, fill() {}, arc() {}, set fillStyle(v) {}, get fillStyle() { return "#000"; },
    set globalAlpha(v) {}, get globalAlpha() { return 1; },
  };
}

class FakeDocument {
  constructor() {
    this._byId = {};
    this.documentElement = new El("html");
    this.body = new El("body");
    this.hidden = false;
    this._listeners = {};
  }
  createElement(tag) { return new El(tag); }
  createTextNode(t) { const e = new El("#text"); e.textContent = t; return e; }
  getElementById(id) { return this._byId[id] || null; }
  register(id, el) { el.id = id; this._byId[id] = el; }
  addEventListener(type, cb) { (this._listeners[type] = this._listeners[type] || []).push(cb); }
  removeEventListener() {}
  dispatch(type, evt = {}) { (this._listeners[type] || []).slice().forEach((cb) => cb(Object.assign({ type }, evt))); }
  execCommand() { return true; }
}

export function setupDom() {
  const document = new FakeDocument();
  const store = {};
  const localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { for (const k in store) delete store[k]; },
  };

  const win = {
    document,
    localStorage,
    devicePixelRatio: 1,
    innerWidth: 390,
    innerHeight: 780,
    location: { search: "" },
    _listeners: {},
    addEventListener(type, cb) { (this._listeners[type] = this._listeners[type] || []).push(cb); },
    removeEventListener() {},
    dispatch(type, evt = {}) { (this._listeners[type] || []).slice().forEach((cb) => cb(Object.assign({ type }, evt))); },
    requestAnimationFrame: (cb) => setTimeout(() => cb(Date.now()), 0),
    cancelAnimationFrame: (id) => clearTimeout(id),
    getComputedStyle: () => ({ getPropertyValue: () => "" }),
    navigator: { userAgent: "node-test", clipboard: { writeText: async () => true } },
    performance: { now: () => Date.now() },
    AudioContext: undefined, // keep audio silent in tests
    visualViewport: null,
  };

  // Wire globals. Some (navigator, performance) are read-only getters in Node,
  // so assign defensively via defineProperty and fall back gracefully.
  const setGlobal = (key, value) => {
    try { globalThis[key] = value; }
    catch (e) {
      try { Object.defineProperty(globalThis, key, { value, configurable: true, writable: true }); }
      catch (e2) { /* leave Node's built-in in place */ }
    }
  };
  setGlobal("window", win);
  setGlobal("document", document);
  setGlobal("localStorage", localStorage);
  setGlobal("navigator", win.navigator);
  setGlobal("requestAnimationFrame", win.requestAnimationFrame);
  setGlobal("cancelAnimationFrame", win.cancelAnimationFrame);
  setGlobal("getComputedStyle", win.getComputedStyle);
  // Use the real Node performance if present; only stub when missing.
  if (typeof globalThis.performance === "undefined") setGlobal("performance", win.performance);

  // Create the DOM shell the game expects (matches index.html ids).
  for (const id of ["hud", "home", "play", "board", "keyboard", "boosters", "message", "overlay", "toasts", "fx", "loading", "loading-bar", "loading-tip"]) {
    const el = document.createElement(id === "fx" ? "canvas" : "div");
    document.register(id, el);
    document.body.appendChild(el);
  }

  return { window: win, document, localStorage };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
