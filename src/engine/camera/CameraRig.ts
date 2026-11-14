import * as THREE from "three";
import type { CameraPreset } from "@/lib/world/types";

/** Camera presets relative to the beat bounds (spec 5.9.1): distance × r, elevation°, azimuth°. */
export const PRESETS: Record<CameraPreset, { dist: number; dist2?: number; elev: number; azim: number; near?: number }> = {
  orbit_close: { dist: 2.2, elev: 15, azim: 30 },
  orbit_wide: { dist: 3.6, elev: 20, azim: 45 },
  top_down: { dist: 3.0, elev: 82, azim: 0 },
  side: { dist: 2.8, elev: 2, azim: 90 },
  inside: { dist: 0.45, elev: 5, azim: 0, near: 0.01 },
  dolly_in: { dist: 3.4, dist2: 1.5, elev: 12, azim: 25 },
  dolly_out: { dist: 1.5, dist2: 3.6, elev: 18, azim: 35 },
  low_angle: { dist: 2.5, elev: -18, azim: 20 },
};

export interface Pose {
  target: THREE.Vector3;
  dist: number;
  /** end distance for dolly presets (reached at the end of the hold phase) */
  dist2: number;
  elev: number; // radians
  azim: number; // radians
  fov: number;
  near: number;
  /** horizontal framing: 1 = asymmetric (shape in columns 6–12 on desktop), 0 = centered */
  frame: number;
}

export interface Bounds {
  center: [number, number, number];
  radius: number;
}

const DEG = Math.PI / 180;

export type Layout = "desktop" | "mobile";

function wrapAngle(a: number) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  layout: Layout = "desktop";
  reducedMotion = false;
  /** horizontal view offset as a fraction of width (negative moves content right) */
  viewOffsetX = -0.18;
  viewOffsetY = 0;
  private base: Pose;
  private drift = 0;
  private driftT = 0;
  private driftActive = true;
  private parallax = new THREE.Vector2();
  private parallaxTarget = new THREE.Vector2();
  private size = { w: 1, h: 1 };
  private zoomOverride: { pose: Pose; t: number; dir: 1 | -1 } | null = null;

  constructor() {
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.05, 200);
    this.base = this.poseFor("orbit_close", { center: [0, 0, 0], radius: 1 });
  }

  /** `front` forces a frontal view for flat forms (text, glyphs, charts) so they stay legible. */
  poseFor(preset: CameraPreset, b: Bounds, frame = 1, front = false): Pose {
    const base = PRESETS[preset] ?? PRESETS.orbit_close;
    const p = front && preset !== "inside" && preset !== "top_down" ? { ...base, elev: Math.max(-6, Math.min(6, base.elev * 0.25)), azim: 0 } : base;
    const r = Math.max(0.3, b.radius);
    const mobile = this.layout === "mobile";
    // Preset distances are in "bounding radii"; FIT converts them so orbit_close frames the shape at ~70% of
    // the viewport height with a 40° FOV (spec 4.12 #2: 45–75%).
    const FIT = 1.75;
    // Portrait phones: the horizontal field of view is the narrow one, so wide forms (a word, a book) need more
    // distance; scaling by 1/aspect keeps the bounding sphere within ~80 % of the screen width.
    const k = (mobile ? Math.max(1.15, 0.95 / Math.max(0.3, this.camera.aspect)) : 1) * FIT;
    return {
      target: new THREE.Vector3(...b.center),
      dist: p.dist * r * k,
      dist2: (p.dist2 ?? p.dist) * r * k,
      elev: p.elev * DEG,
      azim: p.azim * DEG,
      fov: mobile ? 50 : 40,
      near: p.near ?? Math.max(0.02, r * 0.02),
      frame,
    };
  }

  /** Blend two poses with the morph progress t ∈ [0,1]; `hold` ∈ [0,1] drives dolly presets; `jump` lifts long jumps. */
  setBlend(a: Pose, b: Pose, t: number, hold = 0, jump = 0) {
    const e = easeInOutCubic(Math.min(1, Math.max(0, t)));
    const dA = a.dist + (a.dist2 - a.dist) * 1; // a is at the end of its hold
    const dB = b.dist + (b.dist2 - b.dist) * easeInOutCubic(Math.min(1, Math.max(0, hold)));
    const azA = a.azim;
    const azB = azA + wrapAngle(b.azim - azA);
    const bell = Math.sin(Math.PI * e);
    this.base = {
      target: a.target.clone().lerp(b.target, e),
      dist: (dA + (dB - dA) * e) * (1 + 0.3 * jump * bell),
      dist2: b.dist2,
      elev: a.elev + (b.elev - a.elev) * e,
      azim: azA + (azB - azA) * e,
      fov: a.fov + (b.fov - a.fov) * e,
      near: Math.min(a.near, b.near),
      frame: a.frame + (b.frame - a.frame) * e,
    };
  }

  setPose(p: Pose) {
    this.base = { ...p, target: p.target.clone() };
  }

  get pose(): Pose {
    return this.base;
  }

  /** Temporary close-up on a region ("Muéstrame más de cerca"), 1.2 s, until reset. */
  zoomTo(center: THREE.Vector3, radius: number) {
    const pose: Pose = { ...this.base, target: center.clone(), dist: Math.max(radius * 3.2, 0.25), dist2: Math.max(radius * 3.2, 0.25) };
    this.zoomOverride = { pose, t: 0, dir: 1 };
  }

  clearZoom() {
    if (this.zoomOverride) this.zoomOverride.dir = -1;
  }

  pointer(nx: number, ny: number) {
    this.parallaxTarget.set(nx, ny);
  }

  setDrift(active: boolean) {
    this.driftActive = active;
  }

  resize(w: number, h: number) {
    this.size = { w, h };
    this.camera.aspect = w / h;
    this.applyViewOffset();
  }

  private appliedFrame = -1;

  applyViewOffset() {
    const { w, h } = this.size;
    this.appliedFrame = this.base.frame;
    const ox = this.layout === "desktop" ? this.viewOffsetX * w * this.base.frame : 0;
    const oy = this.layout === "mobile" ? this.viewOffsetY * h : 0;
    if (ox === 0 && oy === 0) this.camera.clearViewOffset();
    else this.camera.setViewOffset(w, h, ox, oy, w, h);
    this.camera.updateProjectionMatrix();
  }

  update(dt: number, time: number) {
    // Drift is a slow bounded sway (±9°) rather than an endless orbit: an accumulating azimuth would
    // eventually turn flat forms (text, charts) edge-on during long holds.
    if (!this.reducedMotion && this.driftActive) this.driftT += dt;
    this.drift = this.reducedMotion ? 0 : 0.16 * Math.sin(this.driftT * 0.025 / 0.16);
    const k = 1 - Math.exp(-dt * 4);
    this.parallax.lerp(this.reducedMotion ? new THREE.Vector2() : this.parallaxTarget, k);
    let p = this.base;
    if (this.zoomOverride) {
      const z = this.zoomOverride;
      z.t = Math.min(1, Math.max(0, z.t + (dt / 1.2) * z.dir));
      const e = easeInOutCubic(z.t);
      p = {
        ...p,
        target: p.target.clone().lerp(z.pose.target, e),
        dist: p.dist + (z.pose.dist - p.dist) * e,
      };
      if (z.dir === -1 && z.t <= 0) this.zoomOverride = null;
    }
    const elevWobble = this.reducedMotion ? 0 : Math.sin(time * 0.21) * 2 * DEG;
    const azim = p.azim + this.drift + this.parallax.x * 1.5 * DEG;
    const elev = Math.max(-1.5, Math.min(1.5, p.elev + elevWobble + this.parallax.y * 1.5 * DEG));
    const cam = this.camera;
    cam.position.set(
      p.target.x + p.dist * Math.cos(elev) * Math.sin(azim),
      p.target.y + p.dist * Math.sin(elev),
      p.target.z + p.dist * Math.cos(elev) * Math.cos(azim),
    );
    cam.up.set(0, 1, 0);
    cam.lookAt(p.target);
    if (Math.abs(this.appliedFrame - p.frame) > 0.002) this.applyViewOffset();
    if (cam.fov !== p.fov || cam.near !== p.near) {
      cam.fov = p.fov;
      cam.near = p.near;
      cam.far = Math.max(50, p.dist * 30);
      cam.updateProjectionMatrix();
    }
  }
}
