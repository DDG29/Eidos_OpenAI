import * as THREE from "three";
import * as Comlink from "comlink";
import {
  BlendFunction,
  BloomEffect,
  ChromaticAberrationEffect,
  EffectComposer,
  EffectPass,
  NoiseEffect,
  RenderPass,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
} from "postprocessing";
import type { CameraPreset, Transition } from "@/lib/world/types";
import { CameraRig, type Pose } from "../camera/CameraRig";
import type { BuiltBeat, ProgramInput } from "../compile/program";
import type { ShapeWorkerApi } from "../compile/shape.worker";
import { ParticleField, type GpuShape } from "../field/ParticleField";
import { QualityManager, TIERS, type Tier } from "../quality/QualityManager";
import { BG_FRAG, BG_VERT } from "../shaders/passes.glsl";
import { DUST_REGION, type ShapeBuffer } from "../types";
import { ProgramClient, type BuiltEvent } from "./ProgramClient";
import { stageStore } from "./stageStore";

export interface ProgramOptions {
  cameras: CameraPreset[];
  /** per-beat framing (1 asymmetric, 0 centered); default 1 */
  frames?: number[];
  /** per-beat: main form is flat (text/glyph/chart) → frontal camera */
  faces?: boolean[];
  /** morph from whatever is on screen into beat 0 over this many ms (route change), 0 = cut */
  enterMs?: number;
  /** bloom multiplier per beat (ambient) */
  bloomBoost?: number[];
}

interface EventState {
  from: GpuShape;
  to: GpuShape;
  trans: THREE.DataTexture;
  transition: Transition;
  t: number; // 0..1
  duration: number; // s
  hold: boolean; // stays after finishing until released
  fromPose: Pose;
  toPose: Pose;
  onDone?: () => void;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

let workerSingleton: Comlink.Remote<ShapeWorkerApi> | null = null;
function getWorker(): Comlink.Remote<ShapeWorkerApi> {
  if (!workerSingleton) {
    const w = new Worker(new URL("../compile/shape.worker.ts", import.meta.url), { type: "module", name: "eidos-shapes" });
    workerSingleton = Comlink.wrap<ShapeWorkerApi>(w);
    void workerSingleton.init(window.location.origin);
  }
  return workerSingleton;
}

export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly rig = new CameraRig();
  field!: ParticleField;
  quality: QualityManager;
  private composer!: EffectComposer;
  private bloom!: BloomEffect;
  private chroma: ChromaticAberrationEffect | null = null;
  private noise: NoiseEffect | null = null;
  private vignette: VignetteEffect | null = null;
  private bg: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private randoms: Float32Array | null = null;
  private clock = 0;
  private motionClock = 0;
  private lastFrame = 0;
  private program: { client: ProgramClient; opts: ProgramOptions } | null = null;
  private entry: { shape: GpuShape; pose: Pose } | null = null;
  private poses = new Map<number, Pose>();
  private scroll = { i: 0, s: 1, jump: 0 };
  private event: EventState | null = null;
  private pointer = { ndc: new THREE.Vector2(), active: false, lastMove: -10, touch: false };
  private raycaster = new THREE.Raycaster();
  private disposed = false;
  private hidden = false;
  reducedMotion = false;
  frozen = false;
  private rmFade = { alpha: 1, shownBeat: -1, target: -1 };
  private bindPending = false;
  highlight = { lo: -1, hi: -1, dim: 0, dimTarget: 0 };
  crack = { value: 0, target: 0, spore: 0, sporeTarget: 0 };
  /** listeners called once per frame after rendering (annotations, perf HUD) */
  readonly frameListeners = new Set<(stage: Stage) => void>();
  bloomBase = 1;
  private bloomBoost = 1;
  private flashState: { t: number; color: THREE.Color } | null = null;

  private constructor(
    readonly canvas: HTMLCanvasElement,
    tier: Tier,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "high-performance", stencil: false, depth: false });
    this.renderer.setClearColor(0x04050a, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.quality = new QualityManager(tier, window.devicePixelRatio || 1);
    this.quality.onChange = (s, step) => this.onQualityChange(step);
    const bgMat = new THREE.ShaderMaterial({
      vertexShader: BG_VERT,
      fragmentShader: BG_FRAG,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uCenter: { value: new THREE.Vector2(0.6, 0.5) },
        uAspect: { value: new THREE.Vector2(1.6, 1) },
        uInk0: { value: new THREE.Color(0x04050a) },
        uInk1: { value: new THREE.Color(0x0a0c14) },
      },
    });
    this.bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat);
    this.bg.frustumCulled = false;
    this.bg.renderOrder = -1;
    this.scene.add(this.bg);
    this.buildPipeline();
  }

  static async create(canvas: HTMLCanvasElement, tier: Tier): Promise<Stage> {
    const s = new Stage(canvas, tier);
    s.randoms = null;
    return s;
  }

  get tier(): Tier {
    return this.quality.state.tier;
  }

  get N(): number {
    return this.field.N;
  }

  private buildPipeline() {
    const spec = TIERS[this.quality.state.tier];
    if (this.field) {
      this.scene.remove(this.field.points);
      this.field.dispose();
    }
    this.field = new ParticleField(this.renderer, { side: spec.side, lowQuality: spec.lowQualityNoise });
    this.field.uniform<number>("uPointSize").value = spec.pointSize;
    this.scene.add(this.field.points);
    this.composer?.dispose();
    this.composer = new EffectComposer(this.renderer, { frameBufferType: THREE.HalfFloatType, multisampling: 0 });
    this.composer.addPass(new RenderPass(this.scene, this.rig.camera));
    this.bloom = new BloomEffect({ mipmapBlur: true, luminanceThreshold: 0.15, luminanceSmoothing: 0.4, intensity: spec.bloom || 0, radius: 0.72 });
    const effects: ConstructorParameters<typeof EffectPass>[1][] = [];
    if (spec.bloom > 0) effects.push(this.bloom);
    this.chroma = spec.chromatic ? new ChromaticAberrationEffect({ offset: new THREE.Vector2(0.0006, 0.0006), radialModulation: true, modulationOffset: 0.25 }) : null;
    if (this.chroma) effects.push(this.chroma);
    this.noise = spec.grain ? new NoiseEffect({ blendFunction: BlendFunction.SOFT_LIGHT, premultiply: false }) : null;
    if (this.noise) {
      this.noise.blendMode.opacity.value = 0.035;
      effects.push(this.noise);
    }
    this.vignette = spec.vignette ? new VignetteEffect({ offset: 0.3, darkness: 0.75 }) : null;
    if (this.vignette) effects.push(this.vignette);
    effects.push(new ToneMappingEffect({ mode: ToneMappingMode.AGX }));
    this.composer.addPass(new EffectPass(this.rig.camera, ...effects));
    this.resize();
    stageStore.setState({ tier: this.quality.state.tier, particles: this.field.N, dpr: this.quality.state.dpr });
    // Re-upload the active program into the new field.
    this.entry = null;
    this.event = null;
    this.randoms = null;
    if (this.program) void this.reloadProgram();
  }

  private onQualityChange(step: string) {
    const s = this.quality.state;
    if (step === "tier" || (step === "upgrade" && TIERS[s.tier].side !== this.field.S)) {
      // Recompile with the new particle count: the worker regenerates shapes in the background.
      this.buildPipeline();
      return;
    }
    this.field.uniform<number>("uDensity").value = s.density;
    if (this.chroma) this.chroma.blendMode.opacity.value = s.effects ? 1 : 0;
    if (this.noise) this.noise.blendMode.opacity.value = s.effects ? 0.035 : 0;
    this.resize();
    stageStore.setState({ dpr: s.dpr });
  }

  setTier(tier: Tier) {
    this.quality.state.tier = tier;
    this.quality.state.dpr = Math.min(window.devicePixelRatio || 1, TIERS[tier].maxDpr);
    this.quality.locked = true;
    this.buildPipeline();
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    const dpr = this.quality.state.dpr;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.composer?.setSize(w, h, false);
    this.rig.layout = w < 768 && h > w ? "mobile" : "desktop";
    this.rig.viewOffsetY = this.rig.layout === "mobile" ? 0.2 : 0;
    this.rig.resize(w, h);
    this.field.uniform<number>("uPixelRatio").value = dpr;
    // Point size compensates density so fewer particles still read as a solid form.
    const spec = TIERS[this.quality.state.tier];
    this.field.uniform<number>("uPointSize").value = spec.pointSize * Math.sqrt(Math.min(1.6, Math.max(0.7, h / 900)));
    const bgU = this.bg.material.uniforms;
    (bgU.uAspect!.value as THREE.Vector2).set(w / h, 1);
    (bgU.uCenter!.value as THREE.Vector2).set(this.rig.layout === "desktop" ? 0.62 : 0.5, this.rig.layout === "desktop" ? 0.5 : 0.7);
  }

  /* ——————————————————— programs ——————————————————— */

  async loadProgram(input: ProgramInput, opts: ProgramOptions): Promise<ProgramClient> {
    const sized: ProgramInput = { ...input, count: this.field.N };
    const prev = this.currentShape();
    if (prev) this.entry = { shape: prev, pose: { ...this.rig.pose, target: this.rig.pose.target.clone() } };
    if (this.program && this.program.client.id !== input.id) this.program.client.dispose();
    const client = new ProgramClient(getWorker(), sized);
    await client.init();
    this.program = { client, opts };
    this.poses.clear();
    this.event = null;
    this.scroll = { i: 0, s: opts.enterMs ? 0 : 1, jump: 0 };
    stageStore.setState({ programId: input.id, beat: 0, stable: false, status: "ready" });
    // A newer loadProgram (fast route change) may replace this client at any await below; then this one stops.
    const current = () => this.program?.client === client;
    try {
      const randoms = await client.randoms();
      if (!current()) return client;
      this.randoms = randoms;
      await this.prepare(0);
      if (opts.enterMs && this.entry && current()) {
        // Timed morph from the previous scene into beat 0 (spec 5.12).
        const b0 = await client.ensure(0);
        if (!current() || !this.fits(b0)) return client;
        const g = this.uploadBuilt(b0);
        this.startEvent(this.entry.shape, g, this.transTex(b0), input.beats[0]?.transition ?? "flow", opts.enterMs / 1000, false, this.entry.pose, this.poseOf(0, b0.buffer));
      }
    } catch (e) {
      if (current()) throw e;
    }
    return client;
  }

  private async reloadProgram() {
    if (!this.program) return;
    const { client, opts } = this.program;
    const input = { ...client.input, count: this.field.N };
    const fresh = new ProgramClient(getWorker(), input);
    await fresh.init();
    this.program = { client: fresh, opts };
    this.randoms = await fresh.randoms();
    this.poses.clear();
    await this.prepare(this.scroll.i);
  }

  get client(): ProgramClient | null {
    return this.program?.client ?? null;
  }

  /** Replace beats (insertions) keeping the view stable. */
  async updateProgram(input: ProgramInput, fromIndex: number, cameras: CameraPreset[]) {
    if (!this.program) return;
    await this.program.client.update({ ...input, count: this.field.N }, fromIndex);
    this.program.opts.cameras = cameras;
    for (const k of [...this.poses.keys()]) if (k >= fromIndex) this.poses.delete(k);
    await this.prepare(this.scroll.i);
  }

  private transTex(b: BuiltBeat | BuiltEvent): THREE.DataTexture {
    if (!this.randoms) this.randoms = new Float32Array(this.field.N * 2);
    return this.field.uploadTrans(`${b.key}:t`, b.delays, this.randoms);
  }

  private uploadBuilt(b: BuiltBeat | BuiltEvent): GpuShape {
    return this.field.upload(b.key, b.buffer, b.pivots);
  }

  /**
   * After a tier change the field is rebuilt with a new particle count at once, while buffers compiled for the old
   * count can still arrive (the replacement program client is initializing). Those are skipped, never uploaded.
   */
  private fits(b: BuiltBeat | BuiltEvent | null | undefined): b is BuiltBeat | BuiltEvent {
    return !!b && b.buffer.count === this.field.N;
  }

  private poseOf(i: number, buf: ShapeBuffer): Pose {
    let p = this.poses.get(i);
    if (!p) {
      const cam = this.program?.opts.cameras[i] ?? "orbit_close";
      p = this.rig.poseFor(cam, buf.bounds, this.program?.opts.frames?.[i] ?? 1, this.program?.opts.faces?.[i] ?? false);
      this.poses.set(i, p);
    }
    return p;
  }

  private async prepare(i: number) {
    const c = this.program?.client;
    if (!c) return;
    const need = [i, i - 1].filter((k) => k >= 0 && k < c.length);
    try {
      await Promise.all(need.map((k) => c.ensure(k)));
    } catch (e) {
      // The program was replaced (route change, tier change) while its beats were compiling: nothing to do.
      if (this.program?.client !== c) return;
      throw e;
    }
    c.prefetch(i, 2);
    this.bindPending = true;
  }

  /** Scroll-driven state from the ScrollConductor: active index i, local progress s ∈ [0,1]. */
  setScroll(i: number, s: number, jump = 0) {
    const c = this.program?.client;
    if (!c) return;
    const idx = Math.max(0, Math.min(c.length - 1, i));
    const changed = idx !== this.scroll.i;
    this.scroll = { i: idx, s: Math.min(1, Math.max(0, s)), jump };
    if (changed) {
      stageStore.setState({ beat: idx, stable: false });
      if (this.event && (this.event.hold || this.event.t >= 1)) this.releaseEvent();
      void this.prepare(idx);
    }
  }

  get activeIndex() {
    return this.scroll.i;
  }

  /** The beat buffer currently displayed as destination (for picking and annotations). */
  currentBuffer(): ShapeBuffer | null {
    if (this.event) return this.event.t > 0.5 ? this.event.to.buffer : this.event.from.buffer;
    return this.field.to?.buffer ?? null;
  }

  private currentShape(): GpuShape | null {
    if (this.event) return this.event.t >= 0.5 ? this.event.to : this.event.from;
    if (!this.field.to) return null;
    return this.field.morph >= 0.5 || !this.field.from ? this.field.to : this.field.from;
  }

  /* ——————————————————— event morphs ——————————————————— */

  private startEvent(from: GpuShape, to: GpuShape, trans: THREE.DataTexture, transition: Transition, duration: number, hold: boolean, fromPose: Pose, toPose: Pose, onDone?: () => void) {
    this.event = { from, to, trans, transition, t: this.reducedMotion ? 1 : 0, duration: Math.max(0.05, duration), hold, fromPose, toPose, onDone };
    this.field.bind(from, to, transition, trans);
    stageStore.setState({ stable: false });
  }

  /** Morph to an ad-hoc composition (knob change, Tutor projection) and hold it until released. */
  eventTo(built: BuiltEvent, transition: Transition, durationMs: number, opts: { hold?: boolean; camera?: CameraPreset; onDone?: () => void } = {}) {
    const from = this.currentShape();
    if (!from || !this.fits(built)) return;
    const to = this.uploadBuilt(built);
    const fromPose = { ...this.rig.pose, target: this.rig.pose.target.clone() };
    const toPose = opts.camera ? this.rig.poseFor(opts.camera, built.buffer.bounds) : fromPose;
    this.startEvent(from, to, this.transTex(built), transition, durationMs / 1000, opts.hold ?? true, fromPose, toPose, opts.onDone);
  }

  /** Return from an event shape to the scroll-driven binding with a short morph. */
  releaseEvent(durationMs = 450) {
    const ev = this.event;
    const c = this.program?.client;
    if (!ev || !c) {
      this.event = null;
      return;
    }
    const target = c.peek(this.scroll.i);
    if (!this.fits(target)) {
      this.event = null;
      this.bindPending = true;
      return;
    }
    const g = this.uploadBuilt(target);
    const pose = this.poseOf(this.scroll.i, target.buffer);
    this.startEvent(ev.t >= 0.5 ? ev.to : ev.from, g, this.transTex(target), "flow", durationMs / 1000, false, { ...this.rig.pose, target: this.rig.pose.target.clone() }, pose);
  }

  get eventActive() {
    return !!this.event;
  }

  /* ——————————————————— per frame ——————————————————— */

  private bindScroll() {
    const c = this.program?.client;
    if (!c) return false;
    const i = this.scroll.i;
    const to = c.peek(i);
    if (!this.fits(to)) return false;
    const prev = i > 0 ? c.peek(i - 1) : null;
    const fromBuilt = this.fits(prev) ? prev : null;
    const toG = this.uploadBuilt(to);
    let fromG: GpuShape;
    if (fromBuilt) fromG = this.uploadBuilt(fromBuilt);
    else if (i === 0 && this.entry) fromG = this.entry.shape;
    else fromG = toG;
    if (this.field.from !== fromG || this.field.to !== toG || this.field.transition !== c.input.beats[i]!.transition) {
      this.field.bind(fromG, toG, c.input.beats[i]!.transition, this.transTex(to));
    }
    this.bindPending = false;
    return true;
  }

  pointerMove(clientX: number, clientY: number, touch: boolean) {
    const r = this.canvas.getBoundingClientRect();
    this.pointer.ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.pointer.active = true;
    this.pointer.touch = touch;
    this.pointer.lastMove = this.clock;
    this.rig.pointer(this.pointer.ndc.x, this.pointer.ndc.y);
  }

  pointerLeave() {
    this.pointer.active = false;
  }

  /** Project a world point to CSS pixels. */
  project(v: THREE.Vector3, out: THREE.Vector3): { x: number; y: number; behind: boolean } {
    out.copy(v).project(this.rig.camera);
    const w = this.canvas.clientWidth,
      h = this.canvas.clientHeight;
    return { x: ((out.x + 1) / 2) * w, y: ((1 - out.y) / 2) * h, behind: out.z > 1 };
  }

  tick = (timeSec: number) => {
    if (this.disposed) return;
    const dt = this.lastFrame ? Math.min(0.1, timeSec - this.lastFrame) : 1 / 60;
    this.lastFrame = timeSec;
    if (this.hidden) return;
    if (!this.frozen) {
      this.clock += dt;
      if (!this.reducedMotion) this.motionClock += dt;
    }
    this.quality.sample(timeSec);
    if (this.bindPending || (!this.event && !this.field.to)) this.bindScroll();

    let morph: number;
    let hold = 0;
    let fromPose: Pose | null = null;
    let toPose: Pose | null = null;
    if (this.event) {
      const ev = this.event;
      if (ev.t < 1) ev.t = Math.min(1, ev.t + dt / ev.duration);
      morph = ev.t;
      fromPose = ev.fromPose;
      toPose = ev.toPose;
      if (ev.t >= 1 && !ev.hold) {
        const done = ev.onDone;
        this.event = null;
        this.bindPending = true;
        this.bindScroll();
        morph = 1;
        const c = this.program?.client;
        const cur = c?.peek(this.scroll.i);
        if (cur) toPose = this.poseOf(this.scroll.i, cur.buffer);
        fromPose = toPose;
        this.scroll.s = Math.max(this.scroll.s, 0.35);
        done?.();
      }
    } else {
      const s = this.scroll.s;
      morph = smooth(0, 0.35, s);
      hold = smooth(0.45, 1, s);
      const c = this.program?.client;
      const i = this.scroll.i;
      const to = c?.peek(i);
      if (to) {
        toPose = this.poseOf(i, to.buffer);
        const prev = i > 0 ? c?.peek(i - 1) : null;
        fromPose = prev ? this.poseOf(i - 1, prev.buffer) : (this.entry?.pose ?? toPose);
      }
    }

    // Reduced motion: no morph travel, a short fade between static forms instead.
    if (this.reducedMotion && !this.event) {
      const target = morph >= 0.5 ? 1 : 0;
      const key = this.scroll.i * 2 + target;
      if (this.rmFade.target !== key) {
        this.rmFade.target = key;
        this.rmFade.alpha = Math.min(this.rmFade.alpha, 1);
      }
      if (this.rmFade.shownBeat !== key) {
        this.rmFade.alpha -= dt / 0.2;
        if (this.rmFade.alpha <= 0) {
          this.rmFade.alpha = 0;
          this.rmFade.shownBeat = key;
        }
      } else this.rmFade.alpha = Math.min(1, this.rmFade.alpha + dt / 0.2);
      morph = this.rmFade.shownBeat % 2 === 1 ? 1 : 0;
      this.field.uniform<number>("uGlobalAlpha").value = this.rmFade.alpha;
    } else this.field.uniform<number>("uGlobalAlpha").value = 1;

    this.field.morph = morph;
    if (fromPose && toPose) this.rig.setBlend(fromPose, toPose, morph, hold, this.scroll.jump);
    this.rig.reducedMotion = this.reducedMotion || this.frozen;
    this.rig.setDrift(!this.frozen);
    this.rig.update(dt, this.frozen ? 0 : this.clock);

    // highlight / crack easing
    const h = this.highlight;
    h.dim += (h.dimTarget - h.dim) * Math.min(1, dt / 0.24);
    this.field.uniform<number>("uDimOthers").value = h.dim;
    this.field.uniform<number>("uHighlightLo").value = h.dim > 0.01 ? h.lo : -1;
    this.field.uniform<number>("uHighlightHi").value = h.hi;
    const ck = this.crack;
    ck.value += (ck.target - ck.value) * Math.min(1, dt / 0.25);
    ck.spore += (ck.sporeTarget - ck.spore) * Math.min(1, dt / 1.2);
    this.field.uniform<number>("uCrack").value = ck.value;
    this.field.uniform<number>("uSpore").value = ck.spore;
    this.field.uniform<number>("uTwinkle").value = this.frozen || this.reducedMotion ? 0 : 1;
    if (this.flashState) {
      this.flashState.t += dt / 1.3;
      const f = this.flashState.t;
      this.field.uniform<number>("uFlash").value = f;
      this.field.uniform<THREE.Color>("uFlashColor").value.copy(this.flashState.color);
      if (f >= 1) {
        this.flashState = null;
        this.field.uniform<number>("uFlash").value = 0;
      }
    }

    // cursor ray
    let pointer: { origin: THREE.Vector3; dir: THREE.Vector3; strength: number } | null = null;
    const pointerFresh = this.clock - this.pointer.lastMove < (this.pointer.touch ? 0.25 : 4);
    if (this.pointer.active && pointerFresh && !this.reducedMotion && !this.frozen && (!this.event || this.event.t >= 1)) {
      this.raycaster.setFromCamera(this.pointer.ndc, this.rig.camera);
      pointer = { origin: this.raycaster.ray.origin, dir: this.raycaster.ray.direction, strength: 2.2 };
    }
    this.field.update(dt, this.frozen ? 12 : this.clock, this.frozen ? 12 : this.motionClock, pointer);

    this.bloom.intensity = TIERS[this.quality.state.tier].bloom * this.bloomBase * this.bloomBoost;
    this.composer.render(dt);

    const stable = !this.event && !this.bindPending && (this.scroll.s >= 0.45 || this.scroll.s === 0) && !!this.field.to;
    const st = stageStore.getState();
    if (st.stable !== stable || Math.abs(st.fps - this.quality.state.fps) > 2) stageStore.setState({ stable, fps: Math.round(this.quality.state.fps) });
    for (const l of this.frameListeners) l(this);
  };

  get motionTime(): number {
    return this.frozen ? 12 : this.motionClock;
  }

  /** Motion pivots of the shape currently shown (layer 0–2, 3 = dust). */
  currentPivots(): [number, number, number][] {
    const g = this.currentShape();
    return (g?.pivots ?? []).map((v) => [v.x, v.y, v.z] as [number, number, number]);
  }

  pivotOf(layer: number): [number, number, number] {
    const g = this.currentShape();
    const v = g?.pivots[layer];
    return v ? [v.x, v.y, v.z] : [0, 0, 0];
  }

  /** Highlight a region (or an aggregate range) and dim the rest (spec 5.10.2). */
  setHighlight(region: { index: number; range?: [number, number] } | null) {
    if (!region) {
      this.highlight.dimTarget = 0;
      return;
    }
    this.highlight.lo = region.range ? region.range[0] : region.index;
    this.highlight.hi = region.range ? region.range[1] : region.index;
    this.highlight.dimTarget = 1;
  }

  /** Fracture along a random plane through the shape center (La Grieta, spec 4.8.6). */
  setCrack(on: boolean, spores = on) {
    if (on && this.crack.target === 0) {
      const buf = this.currentBuffer();
      const c = buf?.bounds.center ?? [0, 0, 0];
      const n = new THREE.Vector3(Math.random() - 0.5, (Math.random() - 0.5) * 0.6, Math.random() - 0.5).normalize();
      this.field.uniform<THREE.Vector4>("uCrackPlane").value.set(n.x, n.y, n.z, n.x * c[0] + n.y * c[1] + n.z * c[2]);
    }
    this.crack.target = on ? 1 : 0;
    this.crack.sporeTarget = spores ? 1 : 0;
  }

  /** Radial colour wave from the center (correct answer), 0→1 over ~1.2 s. */
  flash(color: string) {
    this.flashState = { t: 0, color: new THREE.Color(color) };
  }

  setBloomBoost(v: number) {
    this.bloomBoost = v;
  }

  setHidden(hidden: boolean) {
    this.hidden = hidden;
    if (!hidden) this.lastFrame = 0;
  }

  /** Nearest region to a screen point among sampled particles of the current shape (spec 5.10.1). */
  regionCount(buf: ShapeBuffer, regionIndex: number) {
    let n = 0;
    for (let i = 0; i < buf.count; i++) if (buf.regionIds[i] === regionIndex) n++;
    return n;
  }

  isDust(region: number) {
    return region === DUST_REGION;
  }

  dispose() {
    this.disposed = true;
    this.program?.client.dispose();
    this.field.dispose();
    this.composer.dispose();
    this.renderer.dispose();
  }
}
