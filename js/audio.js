'use strict';
/* ============================================================
   RECOIL RUMBLE — audio.js
   All sound is synthesized with WebAudio. No asset files.
   Sound.init() must be called from a user gesture.
   ============================================================ */

const Sound = {
  ctx: null,
  master: null,
  sfxGain: null,
  muted: false,
  noiseBuf: null,

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.9;
    this.sfxGain.connect(this.master);
    // shared 1s white-noise buffer
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    Music.setup(this.ctx, this.master);
  },

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 1;
    return this.muted;
  },

  /* ----- low-level helpers ----- */
  env(gainNode, t0, peak, attack, decay, sustainLevel = 0) {
    const g = gainNode.gain;
    g.setValueAtTime(0.0001, t0);
    g.exponentialRampToValueAtTime(Math.max(peak, 0.0001), t0 + attack);
    g.exponentialRampToValueAtTime(Math.max(sustainLevel, 0.0001), t0 + attack + decay);
  },

  osc(type, freq, t0, dur, peak, freqEnd, dest) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (freqEnd !== undefined && freqEnd !== freq) o.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), t0 + dur);
    const g = c.createGain();
    this.env(g, t0, peak, 0.005, dur - 0.005);
    o.connect(g); g.connect(dest || this.sfxGain);
    o.start(t0); o.stop(t0 + dur + 0.02);
  },

  noise(t0, dur, peak, filterType, filterFreq, filterEnd, q = 1) {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = filterType;
    f.frequency.setValueAtTime(filterFreq, t0);
    if (filterEnd !== undefined) f.frequency.exponentialRampToValueAtTime(Math.max(filterEnd, 20), t0 + dur);
    f.Q.value = q;
    const g = c.createGain();
    this.env(g, t0, peak, 0.004, dur - 0.004);
    src.connect(f); f.connect(g); g.connect(this.sfxGain);
    src.start(t0, Math.random()); src.stop(t0 + dur + 0.02);
  },

  /* ----- public: play a named effect ----- */
  play(name, opt = {}) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const v = opt.vol !== undefined ? opt.vol : 1;
    switch (name) {
      case 'pistol':
        this.noise(t, 0.09, 0.5 * v, 'bandpass', 1800, 500, 1.2);
        this.osc('square', 220, t, 0.06, 0.25 * v, 90);
        break;
      case 'magnum':
        this.noise(t, 0.16, 0.65 * v, 'bandpass', 1200, 300, 1);
        this.osc('square', 150, t, 0.12, 0.4 * v, 60);
        break;
      case 'uzi':
        this.noise(t, 0.05, 0.32 * v, 'bandpass', 2600, 900, 1.4);
        this.osc('square', 330, t, 0.035, 0.16 * v, 160);
        break;
      case 'ar':
        this.noise(t, 0.07, 0.42 * v, 'bandpass', 2100, 700, 1.2);
        this.osc('square', 260, t, 0.05, 0.2 * v, 110);
        break;
      case 'shotgun':
        this.noise(t, 0.25, 0.7 * v, 'lowpass', 2800, 350);
        this.osc('square', 120, t, 0.15, 0.45 * v, 50);
        break;
      case 'sniper':
        this.noise(t, 0.3, 0.6 * v, 'bandpass', 900, 200, 0.8);
        this.osc('sawtooth', 600, t, 0.22, 0.22 * v, 80);
        break;
      case 'minigun':
        this.noise(t, 0.045, 0.3 * v, 'bandpass', 3000, 1200, 1.6);
        this.osc('square', 400 + Math.random() * 60, t, 0.03, 0.14 * v, 200);
        break;
      case 'spinup':
        this.osc('sawtooth', 80, t, 0.3, 0.1 * v, 240);
        break;
      case 'rocketfire':
        this.noise(t, 0.5, 0.45 * v, 'lowpass', 1400, 300);
        this.osc('sawtooth', 110, t, 0.4, 0.25 * v, 45);
        break;
      case 'flame':
        this.noise(t, 0.09, 0.13 * v, 'lowpass', 1100 + Math.random() * 500, 400);
        break;
      case 'explosion':
        this.noise(t, 0.7, 0.95 * v, 'lowpass', 2200, 90);
        this.osc('sine', 90, t, 0.5, 0.7 * v, 28);
        this.osc('triangle', 60, t + 0.02, 0.4, 0.4 * v, 30);
        break;
      case 'hit':
        this.noise(t, 0.06, 0.28 * v, 'bandpass', 900, 350, 1.2);
        this.osc('triangle', 240, t, 0.05, 0.2 * v, 130);
        break;
      case 'jump':
        this.osc('square', 280, t, 0.12, 0.16 * v, 540);
        break;
      case 'djump':
        this.osc('square', 380, t, 0.12, 0.16 * v, 760);
        this.osc('square', 570, t + 0.05, 0.1, 0.1 * v, 880);
        break;
      case 'land':
        this.noise(t, 0.08, 0.2 * v, 'lowpass', 600, 150);
        break;
      case 'bounce':
        this.osc('triangle', 320, t, 0.07, 0.18 * v, 180);
        break;
      case 'throw':
        this.noise(t, 0.12, 0.18 * v, 'bandpass', 1400, 500, 1);
        break;
      case 'beep':
        this.osc('square', 1250, t, 0.06, 0.16 * v, 1250);
        break;
      case 'pickup':
        this.osc('square', 520, t, 0.08, 0.22 * v);
        this.osc('square', 660, t + 0.07, 0.08, 0.22 * v);
        this.osc('square', 880, t + 0.14, 0.12, 0.24 * v);
        break;
      case 'powerup':
        this.osc('square', 440, t, 0.09, 0.2 * v);
        this.osc('square', 554, t + 0.08, 0.09, 0.2 * v);
        this.osc('square', 659, t + 0.16, 0.09, 0.2 * v);
        this.osc('square', 880, t + 0.24, 0.18, 0.26 * v);
        break;
      case 'crate':
        this.noise(t, 0.15, 0.3 * v, 'lowpass', 900, 250);
        this.osc('triangle', 140, t, 0.1, 0.2 * v, 80);
        break;
      case 'dryfire':
        this.osc('square', 950, t, 0.04, 0.1 * v, 600);
        break;
      case 'ko':
        this.osc('sawtooth', 800, t, 0.55, 0.3 * v, 90);
        this.noise(t, 0.3, 0.3 * v, 'bandpass', 1600, 300, 1);
        break;
      case 'respawn':
        this.osc('triangle', 300, t, 0.25, 0.18 * v, 900);
        break;
      case 'click':
        this.osc('square', 700, t, 0.05, 0.15 * v, 500);
        break;
      case 'select':
        this.osc('square', 520, t, 0.07, 0.2 * v);
        this.osc('square', 780, t + 0.06, 0.1, 0.2 * v);
        break;
      case 'count':
        this.osc('square', 440, t, 0.12, 0.3 * v);
        break;
      case 'fight':
        this.osc('square', 660, t, 0.1, 0.32 * v);
        this.osc('square', 880, t + 0.09, 0.22, 0.34 * v);
        this.noise(t, 0.25, 0.25 * v, 'highpass', 2000);
        break;
      case 'win':
        [523, 659, 784, 1047].forEach((f, i) => this.osc('square', f, t + i * 0.12, 0.16, 0.26 * v));
        this.noise(t + 0.4, 0.5, 0.18 * v, 'highpass', 3500);
        break;
    }
  }
};

/* ------------------------------------------------------------
   Music: a light, upbeat chiptune loop scheduled with lookahead.
   ------------------------------------------------------------ */
const Music = {
  ctx: null, out: null, playing: false,
  bpm: 112, step: 0, nextTime: 0, timer: null, enabled: true,

  // A-minor pentatonic-ish groove. 32 sixteenth steps = 2 bars.
  bass: [57, 0, 57, 0, 60, 0, 57, 0, 55, 0, 55, 0, 52, 0, 55, 0,
         57, 0, 57, 0, 60, 0, 62, 0, 64, 0, 62, 0, 60, 0, 55, 0],
  lead: [0, 0, 69, 0, 0, 72, 0, 69, 0, 0, 67, 0, 64, 0, 0, 0,
         0, 0, 69, 0, 0, 72, 0, 76, 0, 0, 74, 0, 72, 0, 67, 0],
  hat:  [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0,
         1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1],
  kick: [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0,
         1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0],

  setup(ctx, master) {
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.out.gain.value = 0.16;
    this.out.connect(master);
  },

  midi(n) { return 440 * Math.pow(2, (n - 69) / 12); },

  note(type, freq, t, dur, vol) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = type; o.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.out);
    o.start(t); o.stop(t + dur + 0.02);
  },

  drum(t, isKick) {
    const c = this.ctx;
    if (isKick) {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(130, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.1);
      const g = c.createGain();
      g.gain.setValueAtTime(0.5, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      o.connect(g); g.connect(this.out);
      o.start(t); o.stop(t + 0.14);
    } else {
      const src = c.createBufferSource();
      src.buffer = Sound.noiseBuf; src.loop = true;
      const f = c.createBiquadFilter();
      f.type = 'highpass'; f.frequency.value = 7000;
      const g = c.createGain();
      g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
      src.connect(f); f.connect(g); g.connect(this.out);
      src.start(t, Math.random()); src.stop(t + 0.06);
    }
  },

  schedule() {
    if (!this.playing) return;
    const stepDur = 60 / this.bpm / 4;
    while (this.nextTime < this.ctx.currentTime + 0.15) {
      const i = this.step % 32;
      if (this.bass[i]) this.note('triangle', this.midi(this.bass[i] - 12), this.nextTime, stepDur * 1.8, 0.5);
      if (this.lead[i]) this.note('square', this.midi(this.lead[i]), this.nextTime, stepDur * 1.1, 0.12);
      if (this.kick[i]) this.drum(this.nextTime, true);
      if (this.hat[i]) this.drum(this.nextTime, false);
      this.nextTime += stepDur;
      this.step++;
    }
  },

  start() {
    if (!this.ctx || this.playing || !this.enabled) return;
    this.playing = true;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.05;
    this.timer = setInterval(() => this.schedule(), 60);
  },

  stop() {
    this.playing = false;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  },

  toggle() {
    this.enabled = !this.enabled;
    if (!this.enabled) this.stop(); else this.start();
    return this.enabled;
  }
};
