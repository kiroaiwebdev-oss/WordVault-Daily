// Synthesized audio engine (WebAudio). No asset files => tiny bundle.
// Gesture-gated: the AudioContext is only created after a user interaction.
// Supports SFX + a lightweight generative background music bed.
// A platform mute (set by a portal SDK) takes priority over the in-game toggle.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.enabledSfx = true;
    this.enabledMusic = true;
    this.platformMuted = false;
    this.unlocked = false;
    this._musicTimer = null;
    this._musicStep = 0;
  }

  // Create the context lazily on first user gesture.
  unlock() {
    if (this.unlocked) return;
    const AC = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.8;
      this.sfxGain.connect(this.master);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.18;
      this.musicGain.connect(this.master);

      this.unlocked = true;
      if (this.ctx.state === "suspended") this.ctx.resume();
    } catch (e) {
      this.ctx = null;
    }
  }

  _live() {
    return this.unlocked && this.ctx && !this.platformMuted;
  }

  setSfxEnabled(v) {
    this.enabledSfx = !!v;
  }

  setMusicEnabled(v) {
    this.enabledMusic = !!v;
    if (this.enabledMusic) this.startMusic();
    else this.stopMusic();
  }

  setPlatformMuted(v) {
    this.platformMuted = !!v;
    if (this.master) {
      try {
        this.master.gain.value = this.platformMuted ? 0 : 0.9;
      } catch (e) {}
    }
    if (this.platformMuted) this.stopMusic();
    else if (this.enabledMusic) this.startMusic();
  }

  // --- SFX --------------------------------------------------------------
  _tone({ freq = 440, type = "sine", dur = 0.12, gain = 0.5, attack = 0.005, decay = 0.1, freqEnd = null }) {
    if (!this._live() || !this.enabledSfx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (freqEnd != null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), now + dur);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(gain, now + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, now + attack + decay);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + attack + decay + 0.02);
  }

  key() {
    this._tone({ freq: 220, type: "triangle", gain: 0.25, dur: 0.05, decay: 0.06 });
  }
  back() {
    this._tone({ freq: 160, type: "square", gain: 0.18, dur: 0.05, decay: 0.05 });
  }
  flip() {
    this._tone({ freq: 380, type: "sine", gain: 0.22, dur: 0.07, decay: 0.08, freqEnd: 460 });
  }
  flipGood() {
    this._tone({ freq: 520, type: "sine", gain: 0.28, dur: 0.09, decay: 0.1, freqEnd: 660 });
  }
  error() {
    this._tone({ freq: 140, type: "sawtooth", gain: 0.3, dur: 0.18, decay: 0.2, freqEnd: 90 });
  }
  coin() {
    this._tone({ freq: 880, type: "square", gain: 0.22, dur: 0.06, decay: 0.07 });
    setTimeout(() => this._tone({ freq: 1320, type: "square", gain: 0.2, dur: 0.08, decay: 0.1 }), 60);
  }
  click() {
    this._tone({ freq: 300, type: "triangle", gain: 0.2, dur: 0.04, decay: 0.05 });
  }
  win() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) =>
      setTimeout(() => this._tone({ freq: f, type: "triangle", gain: 0.35, dur: 0.16, decay: 0.18 }), i * 110)
    );
  }
  lose() {
    const notes = [392, 330, 262];
    notes.forEach((f, i) =>
      setTimeout(() => this._tone({ freq: f, type: "sawtooth", gain: 0.28, dur: 0.18, decay: 0.22 }), i * 150)
    );
  }
  fanfare() {
    const notes = [523, 659, 784, 1047, 1319];
    notes.forEach((f, i) =>
      setTimeout(() => this._tone({ freq: f, type: "triangle", gain: 0.4, dur: 0.18, decay: 0.2 }), i * 90)
    );
  }

  // --- Music ------------------------------------------------------------
  startMusic() {
    if (!this._live() || !this.enabledMusic) return;
    if (this._musicTimer) return;
    // Gentle ambient arpeggio in a pentatonic scale; non-intrusive.
    const scale = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25];
    const step = () => {
      if (!this._live() || !this.enabledMusic) {
        this.stopMusic();
        return;
      }
      const ctx = this.ctx;
      const now = ctx.currentTime;
      const note = scale[(this._musicStep * 3) % scale.length];
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = note / (this._musicStep % 8 === 0 ? 2 : 1);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.5, now + 0.08);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
      osc.connect(g);
      g.connect(this.musicGain);
      osc.start(now);
      osc.stop(now + 1.0);
      this._musicStep++;
    };
    this._musicTimer = setInterval(step, 520);
    step();
  }

  stopMusic() {
    if (this._musicTimer) {
      clearInterval(this._musicTimer);
      this._musicTimer = null;
    }
  }

  suspend() {
    this.stopMusic();
    if (this.ctx && this.ctx.state === "running") {
      try { this.ctx.suspend(); } catch (e) {}
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === "suspended") {
      try { this.ctx.resume(); } catch (e) {}
    }
    if (this.enabledMusic) this.startMusic();
  }
}
