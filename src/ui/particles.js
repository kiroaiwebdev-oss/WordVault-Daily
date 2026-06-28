// Lightweight canvas particle layer for juice: confetti, bursts, golden sparkles.
// Pointer-events:none so it never blocks taps. Pooled to avoid per-frame churn.

export class Particles {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext("2d") : null;
    this.items = [];
    this.dpr = 1;
    this.w = 0;
    this.h = 0;
  }

  resize() {
    if (!this.canvas) return;
    const dpr = Math.min(2, (typeof window !== "undefined" && window.devicePixelRatio) || 1);
    this.dpr = dpr;
    const rect = this.canvas.getBoundingClientRect();
    this.w = Math.max(1, rect.width);
    this.h = Math.max(1, rect.height);
    this.canvas.width = Math.floor(this.w * dpr);
    this.canvas.height = Math.floor(this.h * dpr);
    if (this.ctx) this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  _spawn(p) {
    if (this.items.length > 600) return;
    this.items.push(p);
  }

  burst(x, y, color = "#6aaa64", count = 16, opts = {}) {
    const spread = opts.spread || 6;
    const life = opts.life || 0.9;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (0.5 + Math.random()) * spread * 30;
      this._spawn({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 40,
        g: 420,
        life,
        maxLife: life,
        size: 3 + Math.random() * 4,
        color,
        shape: opts.shape || "rect",
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 10,
      });
    }
  }

  confetti(count = 120) {
    const colors = ["#6aaa64", "#c9b458", "#f5b14c", "#7aa2f7", "#e06c9f", "#ffffff"];
    for (let i = 0; i < count; i++) {
      this._spawn({
        x: Math.random() * this.w,
        y: -20 - Math.random() * this.h * 0.4,
        vx: (Math.random() - 0.5) * 120,
        vy: 80 + Math.random() * 160,
        g: 240,
        life: 2.2 + Math.random() * 1.5,
        maxLife: 3.7,
        size: 5 + Math.random() * 6,
        color: colors[(Math.random() * colors.length) | 0],
        shape: "rect",
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 12,
      });
    }
  }

  goldenRain(count = 80) {
    for (let i = 0; i < count; i++) {
      this._spawn({
        x: Math.random() * this.w,
        y: -20 - Math.random() * this.h * 0.5,
        vx: (Math.random() - 0.5) * 60,
        vy: 120 + Math.random() * 200,
        g: 180,
        life: 2.5 + Math.random() * 1.5,
        maxLife: 4,
        size: 4 + Math.random() * 5,
        color: Math.random() > 0.5 ? "#f5d142" : "#ffe9a0",
        shape: "star",
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 14,
      });
    }
  }

  update(dt) {
    const items = this.items;
    for (let i = items.length - 1; i >= 0; i--) {
      const p = items[i];
      p.life -= dt;
      if (p.life <= 0) {
        items.splice(i, 1);
        continue;
      }
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
  }

  render() {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.clearRect(0, 0, this.w, this.h);
    for (const p of this.items) {
      const alpha = Math.max(0, Math.min(1, p.life / p.maxLife));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.shape === "star") {
        this._star(ctx, p.size);
      } else {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      }
      ctx.restore();
    }
  }

  _star(ctx, r) {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }

  get count() {
    return this.items.length;
  }

  clear() {
    this.items.length = 0;
    if (this.ctx) this.ctx.clearRect(0, 0, this.w, this.h);
  }
}
