/** Quality tiers (spec 5.13) with live degradation driven by a 2 s FPS window. */

export type Tier = 0 | 1 | 2 | 3;

export interface TierSpec {
  side: number; // N = side²
  maxDpr: number;
  bloom: number; // intensity, 0 = off
  chromatic: boolean;
  grain: boolean;
  vignette: boolean;
  lowQualityNoise: boolean;
  pointSize: number;
}

export const TIERS: Record<Tier, TierSpec> = {
  3: { side: 400, maxDpr: 2, bloom: 1.05, chromatic: true, grain: true, vignette: true, lowQualityNoise: false, pointSize: 7.5 },
  2: { side: 283, maxDpr: 1.5, bloom: 0.95, chromatic: false, grain: true, vignette: true, lowQualityNoise: false, pointSize: 9.5 },
  1: { side: 188, maxDpr: 1, bloom: 0.85, chromatic: false, grain: false, vignette: true, lowQualityNoise: true, pointSize: 12 },
  0: { side: 128, maxDpr: 1, bloom: 0, chromatic: false, grain: false, vignette: false, lowQualityNoise: true, pointSize: 15 },
};

export type DegradeStep = "dpr" | "density" | "effects" | "tier";

export interface QualityState {
  tier: Tier;
  dpr: number;
  density: number;
  effects: boolean;
  fps: number;
}

export class QualityManager {
  state: QualityState;
  private frames: number[] = [];
  private lowSince = -1;
  private highSince = -1;
  private lastUpgrade = -Infinity;
  private steps: DegradeStep[] = [];
  locked = false;
  onChange: ((s: QualityState, step: DegradeStep | "upgrade") => void) | null = null;

  constructor(tier: Tier, deviceDpr: number) {
    this.state = { tier, dpr: Math.min(deviceDpr, TIERS[tier].maxDpr), density: 1, effects: true, fps: 60 };
  }

  get spec(): TierSpec {
    return TIERS[this.state.tier];
  }

  /** Feed one frame timestamp (seconds). */
  sample(now: number) {
    this.frames.push(now);
    while (this.frames.length && this.frames[0]! < now - 2) this.frames.shift();
    if (this.frames.length < 10) return;
    const span = now - this.frames[0]!;
    const fps = span > 0 ? (this.frames.length - 1) / span : 60;
    this.state.fps = fps;
    if (this.locked) return;
    if (fps < 45) {
      if (this.lowSince < 0) this.lowSince = now;
      this.highSince = -1;
      if (now - this.lowSince >= 2) {
        this.degrade();
        this.lowSince = now;
        this.frames = [];
      }
    } else if (fps > 58) {
      this.lowSince = -1;
      if (this.highSince < 0) this.highSince = now;
      if (now - this.highSince >= 6 && now - this.lastUpgrade > 60 && this.steps.length) {
        this.upgrade();
        this.lastUpgrade = now;
        this.highSince = now;
      }
    } else {
      this.lowSince = -1;
      this.highSince = -1;
    }
  }

  private degrade() {
    const s = this.state;
    let step: DegradeStep | null = null;
    if (s.dpr > 1) {
      s.dpr = Math.max(1, s.dpr - 0.5);
      step = "dpr";
    } else if (s.density > 0.6) {
      s.density = 0.6;
      step = "density";
    } else if (s.effects) {
      s.effects = false;
      step = "effects";
    } else if (s.tier > 0) {
      s.tier = (s.tier - 1) as Tier;
      s.density = 1;
      step = "tier";
    }
    if (step) {
      this.steps.push(step);
      this.onChange?.(s, step);
    }
  }

  private upgrade() {
    const s = this.state;
    const last = this.steps.pop();
    if (last === "dpr") s.dpr = Math.min(s.dpr + 0.5, TIERS[s.tier].maxDpr);
    else if (last === "density") s.density = 1;
    else if (last === "effects") s.effects = true;
    else if (last === "tier") s.tier = Math.min(3, s.tier + 1) as Tier;
    this.onChange?.(s, "upgrade");
  }
}

/** GPU tier detection with detect-gpu and locally hosted benchmarks (CSP: connect-src 'self'). */
export async function detectTier(): Promise<Tier> {
  try {
    const { getGPUTier } = await import("detect-gpu");
    const res = await getGPUTier({ benchmarksURL: "/benchmarks", failIfMajorPerformanceCaveat: false });
    const isMobile = !!res.isMobile;
    // detect-gpu tiers: 0 (blocklisted/unknown) … 3 (fast).
    let tier = (res.tier ?? 1) as number;
    if (isMobile) tier = Math.min(tier, 2);
    if (res.type === "FALLBACK" || res.type === "BLOCKLISTED") tier = isMobile ? 1 : 2;
    return Math.max(0, Math.min(3, tier)) as Tier;
  } catch {
    return typeof navigator !== "undefined" && /Mobi|Android/i.test(navigator.userAgent) ? 1 : 2;
  }
}

export function supportsWebGL2(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const c = document.createElement("canvas");
    return !!c.getContext("webgl2");
  } catch {
    return false;
  }
}
