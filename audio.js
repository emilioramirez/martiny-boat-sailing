// ── SailingAudio ─────────────────────────────────────────────────────────────
// Web Audio API synthesis — no external files.
// Call start() once from a user-gesture handler, then update() every frame.

class SailingAudio {
  constructor() {
    this._ctx        = null;
    this._ready      = false;
    this._masterGain = null;
    this._noiseBuf   = null;

    // Continuous source gain nodes (modulated each frame)
    this._waterGain = null;
    this._luffGain  = null;

    // Category output gain nodes (volume controls)
    this._catWaterGain   = null;
    this._catLuffGain    = null;
    this._catEffectsGain = null;

    // Volume defaults — loaded from localStorage so UI shows correct values before AudioContext starts
    this._volDefaults = this._loadVolumeDefaults();
  }

  suspend() {
    if (this._ctx && this._ctx.state === 'running') this._ctx.suspend();
  }

  resume() {
    if (this._ctx && this._ctx.state === 'suspended') this._ctx.resume();
  }

  // ── Call once on first user gesture ─────────────────────────────────────
  start() {
    if (this._ctx) {
      if (this._ctx.state === 'suspended') this._ctx.resume();
      return;
    }
    try {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { return; }

    this._masterGain = this._ctx.createGain();
    this._masterGain.connect(this._ctx.destination);

    this._catWaterGain   = this._ctx.createGain();
    this._catLuffGain    = this._ctx.createGain();
    this._catEffectsGain = this._ctx.createGain();
    this._catWaterGain.connect(this._masterGain);
    this._catLuffGain.connect(this._masterGain);
    this._catEffectsGain.connect(this._masterGain);

    // Apply saved/default volumes
    this._masterGain.gain.value      = this._volDefaults.master;
    this._catWaterGain.gain.value    = this._volDefaults.water;
    this._catLuffGain.gain.value     = this._volDefaults.luff;
    this._catEffectsGain.gain.value  = this._volDefaults.effects;

    this._noiseBuf = this._makeNoiseBuf(2);
    this._buildWater();
    this._buildLuff();
    this._ready = true;
  }

  // ── Called every frame ───────────────────────────────────────────────────
  update({ boatSpeed, trimStatus, windSpeed, absAWA }) {
    if (!this._ready) return;

    // Water: scales with speed — two layers so multiplier kept moderate
    this._waterGain.gain.value = Math.max(0, boatSpeed - 0.3) * 0.009;

    // Luff: discrete flap scheduling — rate proportional to depth in no-go × wind speed
    const luffing = trimStatus === 'luffing';

    // Master output gain fades in/out for smooth entry/exit
    const luffNow    = this._luffGain.gain.value;
    const luffTarget = luffing ? 1.0 : 0;
    this._luffGain.gain.value = luffNow + (luffTarget - luffNow) * (luffing ? 0.15 : 0.22);

    if (luffing) {
      const noGo        = CONSTANTS.NO_GO_ZONE_DEG;
      const depthFactor = Math.max(0, 1 - absAWA / noGo);       // 0 at edge, 1 at 0°
      const windFactor  = Math.min(windSpeed, 25) / 15;
      const flapFactor  = Math.max(0.25, Math.min(1.4, windFactor * (0.5 + depthFactor)));

      const baseInterval = 0.10; // 100ms between flaps at flapFactor = 1
      const interval     = baseInterval / flapFactor;
      const now          = this._ctx.currentTime;

      if (this._nextFlapTime < now) this._nextFlapTime = now;

      // Schedule flaps up to 120ms ahead (lookahead prevents audio glitches)
      while (this._nextFlapTime < now + 0.12) {
        this._scheduleFlap(this._nextFlapTime, flapFactor);
        this._nextFlapTime += interval * (0.55 + Math.random() * 0.9); // 55–145% jitter
      }
    }
  }

  // ── One-shot events ──────────────────────────────────────────────────────

  playTack() {
    if (!this._ready) return;
    const now = this._ctx.currentTime;
    this._noiseShot(now, 0.20, 'bandpass', 1100, 2.5, 0.22);
    this._oscShot(now, 'sine', 300, 110, 0.18, 0, 0.24);
  }

  playJibe() {
    if (!this._ready) return;
    const now = this._ctx.currentTime;
    this._noiseShot(now, 0.30, 'bandpass', 550, 2, 0.30);
    this._oscShot(now, 'sine', 160, 45, 0.28, 0, 0.35);
  }

  playBuoyPing() {
    if (!this._ready) return;
    const now = this._ctx.currentTime;
    this._oscShot(now, 'sine',  880, 880,  0.32, 0.05, 1.3);
    this._oscShot(now, 'sine', 1320, 1320, 0.20, 0.05, 1.1);
  }

  playCollision() {
    if (!this._ready) return;
    const now = this._ctx.currentTime;
    this._oscShot(now, 'sine', 95, 22, 0.55, 0, 0.45);
    this._noiseShot(now, 0.40, 'lowpass', 280, 1, 0.38);
  }

  playCompletion() {
    if (!this._ready) return;
    // Ascending C5 – E5 – G5
    [[523.25, 1.4], [659.25, 1.2], [783.99, 1.5]].forEach(([freq, dur], i) => {
      const t = this._ctx.currentTime + i * 0.14;
      this._oscShot(t, 'sine', freq, freq, 0.25, 0.05, dur);
    });
  }

  // ── Continuous loop builders ─────────────────────────────────────────────

  _buildWater() {
    this._waterGain = this._ctx.createGain();
    this._waterGain.gain.value = 0;

    // Layer 1 — deep hull rumble (LPF 90 Hz)
    // LFOs: 0.37, 0.61, 1.19 Hz — ratios ≈ 1 : 1.65 : 3.22 (all irrational)
    {
      const src = this._ctx.createBufferSource();
      src.buffer = this._noiseBuf; src.loop = true;

      const lpf = this._ctx.createBiquadFilter();
      lpf.type = 'lowpass'; lpf.frequency.value = 90; lpf.Q.value = 0.5;

      const am = this._ctx.createGain();
      this._multiLFO(am.gain, 0.55, [0.37, 0.61, 1.19], [0.12, 0.18, 0.15]);

      src.connect(lpf); lpf.connect(am); am.connect(this._waterGain);
      src.start();
    }

    // Layer 2 — water burble (BPF 380 Hz)
    // LFOs: 1.43, 2.31, 3.67 Hz — ratios ≈ 1 : 1.62 : 2.57 (all irrational)
    {
      const src = this._ctx.createBufferSource();
      src.buffer = this._noiseBuf; src.loop = true;

      const bpf = this._ctx.createBiquadFilter();
      bpf.type = 'bandpass'; bpf.frequency.value = 380; bpf.Q.value = 1.8;

      const am = this._ctx.createGain();
      this._multiLFO(am.gain, 0.46, [1.43, 2.31, 3.67], [0.10, 0.16, 0.13]);

      src.connect(bpf); bpf.connect(am); am.connect(this._waterGain);
      src.start();
    }

    this._waterGain.connect(this._catWaterGain);
  }

  _buildLuff() {
    // Output gain fades in/out; individual flap bursts connect through it
    this._luffGain = this._ctx.createGain();
    this._luffGain.gain.value = 0;
    this._luffGain.connect(this._catLuffGain);
    this._nextFlapTime = 0;
  }

  // ── Luff flap scheduling ────────────────────────────────────────────────

  // One discrete flap: garruchos rattling on mast track — metallic, high, short
  _scheduleFlap(when, flapFactor) {
    const vol = Math.min(flapFactor, 1.4) * 0.18;
    this._flapBurst(when,          vol * 0.6, 1800, 2.5, 0.004, 0.055); // slide knock
    this._flapBurst(when + 0.003,  vol * 1.0, 3200, 3.5, 0.002, 0.035); // metallic ring
    this._flapBurst(when + 0.001,  vol * 0.7, 5000, 2.8, 0.001, 0.018); // high click
  }

  // Single noise burst: fast attack → exponential decay through BPF
  _flapBurst(when, gain, bpfFreq, bpfQ, attack, decay) {
    const ctx = this._ctx;
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuf;

    const bpf = ctx.createBiquadFilter();
    bpf.type = 'bandpass';
    bpf.frequency.value = bpfFreq;
    bpf.Q.value = bpfQ;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(gain, when + attack);
    g.gain.exponentialRampToValueAtTime(0.001, when + attack + decay);

    src.connect(bpf); bpf.connect(g); g.connect(this._luffGain);
    src.start(when, Math.random() * 1.5);
    src.stop(when + attack + decay + 0.02);
  }

  // ── Shared modulation helper ─────────────────────────────────────────────

  // Attach N sine LFOs to an AudioParam at irrational-ratio frequencies.
  // Their beating creates a modulation pattern that never repeats.
  _multiLFO(param, base, rates, depths) {
    param.setValueAtTime(base, 0);
    rates.forEach((rate, i) => {
      const lfo = this._ctx.createOscillator();
      lfo.type  = 'sine';
      lfo.frequency.value = rate;
      const d = this._ctx.createGain();
      d.gain.value = depths[i];
      lfo.connect(d); d.connect(param);
      lfo.start();
    });
  }

  // ── One-shot helpers ─────────────────────────────────────────────────────

  _noiseShot(when, gainPeak, filterType, filterFreq, filterQ, duration) {
    const ctx = this._ctx;
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuf;
    src.loop   = true;

    const flt = ctx.createBiquadFilter();
    flt.type = filterType;
    flt.frequency.value = filterFreq;
    flt.Q.value = filterQ;

    const g = ctx.createGain();
    g.gain.setValueAtTime(gainPeak, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + duration);

    src.connect(flt); flt.connect(g); g.connect(this._catEffectsGain);
    src.start(when, Math.random() * 1.5);
    src.stop(when + duration + 0.02);
  }

  // holdTime: seconds at peak gain before decay starts
  _oscShot(when, type, freqStart, freqEnd, gainPeak, holdTime, duration) {
    const ctx = this._ctx;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, when);
    if (freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), when + duration);
    }

    const g = ctx.createGain();
    g.gain.setValueAtTime(gainPeak, when);
    if (holdTime > 0) g.gain.setValueAtTime(gainPeak, when + holdTime);
    g.gain.exponentialRampToValueAtTime(0.001, when + duration);

    osc.connect(g); g.connect(this._catEffectsGain);
    osc.start(when);
    osc.stop(when + duration + 0.02);
  }

  // ── Volume control ───────────────────────────────────────────────────────

  setVol(cat, pct) {
    const v = Math.max(0, Math.min(1.5, pct));
    this._volDefaults[cat] = v;
    if (this._ready) {
      if (cat === 'master')  this._masterGain.gain.value      = v;
      if (cat === 'water')   this._catWaterGain.gain.value    = v;
      if (cat === 'luff')    this._catLuffGain.gain.value     = v;
      if (cat === 'effects') this._catEffectsGain.gain.value  = v;
    }
    this._saveVolumes();
  }

  getVol(cat) { return this._volDefaults[cat] ?? 1.0; }

  _saveVolumes() {
    try {
      localStorage.setItem('sailsim_audio', JSON.stringify(this._volDefaults));
    } catch (e) {}
  }

  _loadVolumeDefaults() {
    try {
      const d = JSON.parse(localStorage.getItem('sailsim_audio') || 'null');
      return {
        master:  d?.master  ?? 0.75,
        water:   d?.water   ?? 1.0,
        luff:    d?.luff    ?? 1.0,
        effects: d?.effects ?? 1.0,
      };
    } catch (e) {
      return { master: 0.75, water: 1.0, luff: 1.0, effects: 1.0 };
    }
  }

  // ── Buffer factory ───────────────────────────────────────────────────────

  _makeNoiseBuf(seconds) {
    const ctx    = this._ctx;
    const frames = Math.ceil(ctx.sampleRate * seconds);
    const buf    = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data   = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }
}
