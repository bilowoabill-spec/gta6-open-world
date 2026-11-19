// Synthesized sound for Solara Bay: every effect and the music loop are
// built with WebAudio oscillators and noise — no audio files at all.
export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.musicTimer = null;
    this.musicStep = 0;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenOn = false;
  }

  // Must be called from a user gesture (the Start button).
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    // Engine hum: a low sawtooth whose pitch follows speed.
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 50;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    const engineFilter = this.ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 320;
    this.engineOsc.connect(engineFilter);
    engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
    // Police siren: two alternating tones.
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'sine';
    this.sirenOsc.frequency.value = 700;
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.master);
    this.sirenOsc.start();
    this.sirenPhase = 0;
    this.startMusic();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  engine(speed01) {
    if (!this.ctx) return;
    this.engineGain.gain.value = speed01 > 0.02 ? 0.05 + speed01 * 0.06 : 0;
    this.engineOsc.frequency.value = 48 + speed01 * 130;
  }

  siren(on) {
    if (!this.ctx) return;
    this.sirenOn = on;
    this.sirenGain.gain.value = on ? 0.045 : 0;
  }

  // Wail the siren between two tones; call every frame while on.
  updateSiren(dt) {
    if (!this.ctx || !this.sirenOn) return;
    this.sirenPhase = (this.sirenPhase + dt * 1.6) % 2;
    this.sirenOsc.frequency.value = this.sirenPhase < 1 ? 720 : 980;
  }

  blip(freq, dur, type, vol) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = type || 'square';
    o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol || 0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur);
  }

  noise(dur, vol, filterFreq) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = filterFreq || 1200;
    const g = this.ctx.createGain();
    g.gain.value = vol || 0.25;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
  }

  shot() { this.noise(0.12, 0.3, 2400); this.blip(160, 0.08, 'square', 0.1); }
  thugShot() { this.noise(0.1, 0.12, 1800); }
  pickup() { this.blip(660, 0.09, 'sine', 0.15); setTimeout(() => this.blip(990, 0.12, 'sine', 0.15), 90); }
  cash() { this.blip(880, 0.08, 'sine', 0.14); setTimeout(() => this.blip(1174, 0.1, 'sine', 0.14), 80); setTimeout(() => this.blip(1568, 0.14, 'sine', 0.14), 160); }
  missionDone() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.blip(f, 0.16, 'triangle', 0.16), i * 110)); }
  busted() { [392, 330, 262].forEach((f, i) => setTimeout(() => this.blip(f, 0.25, 'sawtooth', 0.12), i * 160)); }
  click() { this.blip(440, 0.05, 'square', 0.08); }
  crash() { this.noise(0.25, 0.3, 500); }

  // A laid-back synthwave-ish loop: bass notes with a soft lead.
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const bass = [110, 110, 130.8, 98, 110, 110, 146.8, 164.8];
    const lead = [440, 523, 659, 523, 587, 659, 784, 659];
    this.musicTimer = setInterval(() => {
      if (this.muted) return;
      const i = this.musicStep % 8;
      this.musicNote(bass[i], 0.42, 'triangle', 0.07);
      if (this.musicStep % 2 === 0) this.musicNote(lead[i], 0.3, 'sine', 0.045);
      this.musicStep++;
    }, 300);
  }

  musicNote(freq, dur, type, vol) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = type; o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur);
  }
}
