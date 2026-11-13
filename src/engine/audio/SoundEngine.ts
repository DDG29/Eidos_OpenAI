import type { Ambient, PaletteId } from "@/lib/world/types";

/**
 * Generative soundscape (spec 12.6). Off by default, started only after a user gesture. A detuned sine +
 * triangle drone on the palette's tonic through a low-pass filter and a procedural convolution reverb;
 * ambient layers per beat; short event signatures.
 */

const TONIC_HZ: Record<PaletteId, number> = {
  aurora: 220.0, // A3
  magma: 146.83, // D3
  abismo: 164.81, // E3
  bioluz: 196.0, // G3
  solar: 130.81, // C3
  tinta: 174.61, // F3
  jade: 233.08, // Bb3
  nebulosa: 185.0, // F#3
};

const PENTA = [0, 2, 4, 7, 9, 12, 14, 16];
const semi = (hz: number, n: number) => hz * Math.pow(2, n / 12);

export type SoundEvent = "beat" | "correct" | "crack" | "grow" | "constellation";

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private reverb: ConvolverNode | null = null;
  private wet: GainNode | null = null;
  private drone: OscillatorNode[] = [];
  private ambientNodes: AudioNode[] = [];
  private ambientTimer: number | null = null;
  private tonic = TONIC_HZ.aurora;
  private palette: PaletteId = "aurora";
  private ambient: Ambient = "calm";
  volume = 0.5;
  enabled = false;
  reducedMotion = false;

  /** Must be called from a user gesture (autoplay policy). */
  async start(): Promise<boolean> {
    if (typeof window === "undefined") return false;
    try {
      if (!this.ctx) {
        const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new Ctx();
        this.build();
      }
      if (this.ctx.state !== "running") await this.ctx.resume();
      this.enabled = true;
      this.applyVolume();
      this.setScene(this.palette, this.ambient, true);
      return true;
    } catch {
      return false;
    }
  }

  stop() {
    this.enabled = false;
    if (!this.ctx || !this.master) return;
    this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
    if (this.ambientTimer) window.clearInterval(this.ambientTimer);
    this.ambientTimer = null;
  }

  setVolume(v: number) {
    this.volume = Math.min(1, Math.max(0, v));
    this.applyVolume();
  }

  private applyVolume() {
    if (!this.ctx || !this.master) return;
    // −18 dB at the default volume (0.5) as the spec asks: 10^(−18/20) ≈ 0.126.
    const g = this.enabled ? 0.252 * this.volume : 0;
    this.master.gain.setTargetAtTime(g, this.ctx.currentTime, 0.4);
  }

  private build() {
    const ctx = this.ctx!;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);
    this.filter = ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = 520;
    this.filter.Q.value = 0.6;
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse(3);
    this.wet = ctx.createGain();
    this.wet.gain.value = 0.55;
    this.filter.connect(this.master);
    this.filter.connect(this.reverb);
    this.reverb.connect(this.wet);
    this.wet.connect(this.master);
  }

  /** Procedural impulse response: noise with exponential decay. */
  private impulse(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    let seed = 1234567;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = rnd() * Math.exp((-5 * i) / len);
    }
    return buf;
  }

  private voice(freq: number, type: OscillatorType, gain: number, detuneCents = 0): { osc: OscillatorNode; amp: GainNode } {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = detuneCents;
    const amp = ctx.createGain();
    amp.gain.value = gain;
    osc.connect(amp);
    amp.connect(this.filter!);
    osc.start();
    return { osc, amp };
  }

  setScene(palette: PaletteId, ambient: Ambient, force = false) {
    const changed = palette !== this.palette || ambient !== this.ambient;
    this.palette = palette;
    this.ambient = ambient;
    this.tonic = TONIC_HZ[palette] ?? TONIC_HZ.aurora;
    if (!this.ctx || !this.enabled || (!changed && !force)) return;
    const now = this.ctx.currentTime;
    for (const o of this.drone) o.stop(now + 1.2);
    for (const n of this.ambientNodes) (n as GainNode).gain?.setTargetAtTime(0, now, 0.4);
    if (this.ambientTimer) window.clearInterval(this.ambientTimer);
    this.ambientTimer = null;
    const a = this.voice(this.tonic / 2, "sine", 0.0001, -4);
    const b = this.voice(this.tonic / 2, "triangle", 0.0001, 4);
    a.amp.gain.setTargetAtTime(0.32, now, 1.2);
    b.amp.gain.setTargetAtTime(0.14, now, 1.2);
    this.drone = [a.osc, b.osc];
    this.ambientNodes = [a.amp, b.amp];
    const minor = ambient === "tense";
    if (ambient === "wonder" || ambient === "triumphant") {
      const fifth = this.voice(semi(this.tonic / 2, 7), "sine", 0.0001);
      const oct = this.voice(this.tonic, "sine", 0.0001);
      fifth.amp.gain.setTargetAtTime(ambient === "triumphant" ? 0.14 : 0.09, now, 1.5);
      oct.amp.gain.setTargetAtTime(0.06, now, 1.5);
      if (ambient === "triumphant") {
        const third = this.voice(semi(this.tonic, 4), "sine", 0.0001);
        third.amp.gain.setTargetAtTime(0.06, now, 1.5);
        this.drone.push(third.osc);
        this.ambientNodes.push(third.amp);
      }
      this.drone.push(fifth.osc, oct.osc);
      this.ambientNodes.push(fifth.amp, oct.amp);
    }
    if (minor) {
      const m3 = this.voice(semi(this.tonic / 2, 3), "sine", 0.0001);
      m3.amp.gain.setTargetAtTime(0.08, now, 1.5);
      // slow tremolo
      const lfo = this.ctx.createOscillator();
      const depth = this.ctx.createGain();
      lfo.frequency.value = 4.2;
      depth.gain.value = 0.03;
      lfo.connect(depth);
      depth.connect(m3.amp.gain);
      lfo.start();
      this.drone.push(m3.osc, lfo);
      this.ambientNodes.push(m3.amp);
    }
    if (ambient === "playful" && !this.reducedMotion) {
      let k = 0;
      this.ambientTimer = window.setInterval(() => this.pluck(semi(this.tonic, PENTA[k++ % 5]!), 0.05, 0.9), 1400);
    }
  }

  /** Morph progress opens the filter during transitions and closes it at rest. */
  setMorph(bell: number) {
    if (!this.ctx || !this.filter || !this.enabled) return;
    this.filter.frequency.setTargetAtTime(520 + 1800 * bell, this.ctx.currentTime, 0.15);
  }

  private pluck(freq: number, gain: number, decay: number, type: OscillatorType = "sine", at = 0) {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(gain, t + 0.015);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    osc.connect(amp);
    amp.connect(this.filter!);
    osc.start(t);
    osc.stop(t + decay + 0.05);
    return { osc, amp, t };
  }

  event(kind: SoundEvent) {
    if (!this.ctx || !this.enabled) return;
    const T = this.tonic;
    switch (kind) {
      case "beat":
        this.pluck(semi(T * 2, PENTA[Math.floor(Math.random() * 5)]!), 0.06, 1.4);
        break;
      case "correct":
        [0, 4, 7].forEach((n, i) => this.pluck(semi(T * 2, n), 0.08, 1.6, "triangle", i * 0.11));
        break;
      case "crack": {
        this.pluck(T / 4, 0.3, 0.9, "sine");
        const ctx = this.ctx;
        const len = Math.floor(ctx.sampleRate * 0.4);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp((-8 * i) / len);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const g = ctx.createGain();
        g.gain.value = this.reducedMotion ? 0.04 : 0.12;
        src.connect(g);
        g.connect(this.filter!);
        src.start();
        break;
      }
      case "grow": {
        const p = this.pluck(T, 0.07, 1.8, "sine");
        p?.osc.frequency.exponentialRampToValueAtTime(T * 2, p.t + 1.2);
        break;
      }
      case "constellation":
        [0, 7, 12, 16].forEach((n, i) => this.pluck(semi(T, n), 0.05, 3.5, "sine", i * 0.05));
        break;
    }
  }
}

let singleton: SoundEngine | null = null;
export function getSoundEngine(): SoundEngine {
  singleton ??= new SoundEngine();
  return singleton;
}
