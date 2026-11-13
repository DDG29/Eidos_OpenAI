import * as THREE from "three";
import { GPUComputationRenderer, type Variable } from "three/examples/jsm/misc/GPUComputationRenderer.js";
import type { Transition } from "@/lib/world/types";
import { DEFAULT_STAGGER, TRANSITION_INDEX } from "../compile/pairing";
import { OFFSET_FRAG, POINTS_FRAG, POINTS_VERT, VELOCITY_FRAG } from "../shaders/passes.glsl";
import type { ShapeBuffer } from "../types";

/** GPU-resident textures of one composed beat. */
export interface GpuShape {
  key: string;
  buffer: ShapeBuffer;
  pos: THREE.DataTexture;
  aux: THREE.DataTexture;
  col: THREE.DataTexture;
  pivots: THREE.Vector3[];
}

function dataTex(data: Float32Array | Uint8Array, S: number): THREE.DataTexture {
  const isFloat = data instanceof Float32Array;
  const t = new THREE.DataTexture(data, S, S, THREE.RGBAFormat, isFloat ? THREE.FloatType : THREE.UnsignedByteType);
  t.minFilter = THREE.NearestFilter;
  t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.flipY = false;
  // Palette colours are authored as sRGB hex; let the GPU linearize them on sampling.
  if (!isFloat) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

export interface FieldOptions {
  side: number; // S, N = S²
  lowQuality: boolean;
}

/**
 * The persistent particle system (spec 5.3–5.6). N = S² particles, always alive. A morph is two bound
 * shapes + uMorph; everything else (motion, transitions, cursor offsets) is evaluated on the GPU.
 */
export class ParticleField {
  readonly S: number;
  readonly N: number;
  readonly points: THREE.Points;
  readonly material: THREE.ShaderMaterial;
  private gpu: GPUComputationRenderer | null = null;
  private velVar: Variable | null = null;
  private offVar: Variable | null = null;
  private zeroOffset: THREE.DataTexture;
  private shapes = new Map<string, GpuShape>();
  private trans = new Map<string, THREE.DataTexture>();
  private lru: string[] = [];
  private maxCached = 8;
  from: GpuShape | null = null;
  to: GpuShape | null = null;
  transition: Transition = "flow";
  private pointerIdleFor = 999;
  private gpgpuSupported = true;

  constructor(
    private renderer: THREE.WebGLRenderer,
    opts: FieldOptions,
  ) {
    this.S = opts.side;
    this.N = opts.side * opts.side;
    const S = this.S;
    const refs = new Float32Array(this.N * 2);
    for (let i = 0; i < this.N; i++) {
      refs[i * 2] = ((i % S) + 0.5) / S;
      refs[i * 2 + 1] = (Math.floor(i / S) + 0.5) / S;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(this.N * 3), 3));
    geo.setAttribute("aRef", new THREE.BufferAttribute(refs, 2));
    this.zeroOffset = dataTex(new Float32Array(this.N * 4), S);

    const empty = dataTex(new Float32Array(this.N * 4), S);
    const emptyCol = dataTex(new Uint8Array(this.N * 4), S);
    const pivots = () => [0, 1, 2, 3].map(() => new THREE.Vector3());
    const maxPoint = Math.min(64, (renderer.getContext().getParameter(renderer.getContext().ALIASED_POINT_SIZE_RANGE) as Float32Array)[1] ?? 64);
    this.material = new THREE.ShaderMaterial({
      vertexShader: POINTS_VERT,
      fragmentShader: POINTS_FRAG,
      defines: opts.lowQuality ? { LOW_QUALITY: "" } : {},
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      uniforms: {
        tFrom: { value: empty },
        tTo: { value: empty },
        tFromAux: { value: empty },
        tToAux: { value: empty },
        tFromCol: { value: emptyCol },
        tToCol: { value: emptyCol },
        tTrans: { value: empty },
        tOffsetTex: { value: this.zeroOffset },
        uMorph: { value: 1 },
        uStagger: { value: 0.35 },
        uTransition: { value: 0 },
        uTime: { value: 0 },
        uMotionTime: { value: 0 },
        uTurbulence: { value: 0.35 },
        uSwirl: { value: 2.4 },
        uBurst: { value: 0.9 },
        uRain: { value: 1.6 },
        uCrack: { value: 0 },
        uCrackPlane: { value: new THREE.Vector4(1, 0, 0, 0) },
        uShapeRadius: { value: 1 },
        uPivotFrom: { value: pivots() },
        uPivotTo: { value: pivots() },
        uDensity: { value: 1 },
        uHighlightLo: { value: -1 },
        uHighlightHi: { value: -1 },
        uDimOthers: { value: 0 },
        uPointSize: { value: 9 },
        uPixelRatio: { value: 1 },
        uMaxPointSize: { value: maxPoint },
        uFogDensity: { value: 0.12 },
        uFogStart: { value: 2.5 },
        uTwinkle: { value: 1 },
        uGlobalAlpha: { value: 1 },
        uSpore: { value: 0 },
        uDustAlpha: { value: 1 },
        uIntensity: { value: 1.3 },
        uFlash: { value: 0 },
        uFlashColor: { value: new THREE.Color(0x6cf5b0) },
      },
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.initGpgpu(opts.lowQuality);
  }

  private initGpgpu(lowQuality: boolean) {
    const S = this.S;
    try {
      const gl = this.renderer.getContext() as WebGL2RenderingContext;
      const floatRT = !!gl.getExtension("EXT_color_buffer_float");
      const halfRT = !!gl.getExtension("EXT_color_buffer_half_float");
      if (!floatRT && !halfRT) throw new Error("no renderable float textures");
      const gpu = new GPUComputationRenderer(S, S, this.renderer);
      if (!floatRT) gpu.setDataType(THREE.HalfFloatType);
      const v0 = gpu.createTexture();
      const o0 = gpu.createTexture();
      const vel = gpu.addVariable("tVelocity", VELOCITY_FRAG, v0);
      const off = gpu.addVariable("tOffset", OFFSET_FRAG, o0);
      gpu.setVariableDependencies(vel, [off, vel]);
      gpu.setVariableDependencies(off, [off, vel]);
      const u = this.material.uniforms;
      // Velocity pass needs the full morph state (it evaluates morphBase for the cursor force).
      Object.assign(vel.material.uniforms, {
        tFrom: u.tFrom,
        tTo: u.tTo,
        tFromAux: u.tFromAux,
        tToAux: u.tToAux,
        tTrans: u.tTrans,
        uMorph: u.uMorph,
        uStagger: u.uStagger,
        uTransition: u.uTransition,
        uTime: u.uTime,
        uMotionTime: u.uMotionTime,
        uTurbulence: u.uTurbulence,
        uSwirl: u.uSwirl,
        uBurst: u.uBurst,
        uRain: u.uRain,
        uCrack: u.uCrack,
        uCrackPlane: u.uCrackPlane,
        uShapeRadius: u.uShapeRadius,
        uPivotFrom: u.uPivotFrom,
        uPivotTo: u.uPivotTo,
        uDt: { value: 0 },
        uPointer: { value: new THREE.Vector3() },
        uPointerDir: { value: new THREE.Vector3(0, 0, -1) },
        uPointerStrength: { value: 0 },
      });
      if (lowQuality) vel.material.defines = { ...(vel.material.defines ?? {}), LOW_QUALITY: "" };
      Object.assign(off.material.uniforms, { uDt: vel.material.uniforms.uDt, uShapeRadius: u.uShapeRadius });
      const err = gpu.init();
      if (err) throw new Error(err);
      this.gpu = gpu;
      this.velVar = vel;
      this.offVar = off;
    } catch {
      // Without GPGPU the cursor layer is disabled; the morph itself still works.
      this.gpgpuSupported = false;
      this.gpu = null;
    }
  }

  get hasPointerLayer() {
    return this.gpgpuSupported;
  }

  /** Upload (or reuse) a composed shape. `key` must uniquely identify buffer contents. */
  upload(key: string, buffer: ShapeBuffer, pivots: [number, number, number][]): GpuShape {
    const hit = this.shapes.get(key);
    if (hit) {
      this.touch(key);
      return hit;
    }
    if (buffer.count !== this.N) throw new Error(`buffer has ${buffer.count} particles, field expects ${this.N}`);
    const g: GpuShape = {
      key,
      buffer,
      pos: dataTex(buffer.positions, this.S),
      aux: dataTex(buffer.aux, this.S),
      col: dataTex(buffer.colors, this.S),
      pivots: [0, 1, 2, 3].map((i) => new THREE.Vector3(...(pivots[i] ?? buffer.bounds.center))),
    };
    this.shapes.set(key, g);
    this.touch(key);
    this.evict();
    return g;
  }

  /** Stagger-delay texture for (destination shape, transition). */
  uploadTrans(key: string, delays: Float32Array, randoms: Float32Array): THREE.DataTexture {
    const hit = this.trans.get(key);
    if (hit) return hit;
    const data = new Float32Array(this.N * 4);
    for (let i = 0; i < this.N; i++) {
      data[i * 4] = delays[i]!;
      data[i * 4 + 1] = randoms[i * 2]!;
      data[i * 4 + 2] = randoms[i * 2 + 1]!;
    }
    const t = dataTex(data, this.S);
    this.trans.set(key, t);
    if (this.trans.size > this.maxCached * 2) {
      const first = this.trans.keys().next().value as string;
      if (first !== key) {
        this.trans.get(first)?.dispose();
        this.trans.delete(first);
      }
    }
    return t;
  }

  has(key: string) {
    return this.shapes.has(key);
  }

  private touch(key: string) {
    this.lru = this.lru.filter((k) => k !== key);
    this.lru.push(key);
  }

  private evict() {
    while (this.lru.length > this.maxCached) {
      const victim = this.lru.find((k) => k !== this.from?.key && k !== this.to?.key);
      if (!victim) break;
      const g = this.shapes.get(victim);
      g?.pos.dispose();
      g?.aux.dispose();
      g?.col.dispose();
      this.shapes.delete(victim);
      this.lru = this.lru.filter((k) => k !== victim);
    }
  }

  /** Bind a morph pair. */
  bind(from: GpuShape, to: GpuShape, transition: Transition, trans: THREE.DataTexture, stagger = DEFAULT_STAGGER[transition]) {
    const u = this.material.uniforms;
    this.from = from;
    this.to = to;
    this.transition = transition;
    u.tFrom!.value = from.pos;
    u.tFromAux!.value = from.aux;
    u.tFromCol!.value = from.col;
    u.tTo!.value = to.pos;
    u.tToAux!.value = to.aux;
    u.tToCol!.value = to.col;
    u.tTrans!.value = trans;
    u.uTransition!.value = TRANSITION_INDEX[transition];
    u.uStagger!.value = stagger;
    (u.uPivotFrom!.value as THREE.Vector3[]).forEach((v, i) => v.copy(from.pivots[i]!));
    (u.uPivotTo!.value as THREE.Vector3[]).forEach((v, i) => v.copy(to.pivots[i]!));
    u.uShapeRadius!.value = Math.max(from.buffer.bounds.radius, to.buffer.bounds.radius, 0.3);
  }

  set morph(m: number) {
    this.material.uniforms.uMorph!.value = Math.min(1, Math.max(0, m));
  }
  get morph(): number {
    return this.material.uniforms.uMorph!.value as number;
  }

  uniform<T = unknown>(name: string): { value: T } {
    return this.material.uniforms[name] as { value: T };
  }

  /** Per-frame update. `pointer` null means no cursor influence. */
  update(dt: number, time: number, motionTime: number, pointer: { origin: THREE.Vector3; dir: THREE.Vector3; strength: number } | null) {
    const u = this.material.uniforms;
    u.uTime!.value = time;
    u.uMotionTime!.value = motionTime;
    if (!this.gpu || !this.velVar || !this.offVar) return;
    const strength = pointer?.strength ?? 0;
    this.pointerIdleFor = strength > 0 ? 0 : this.pointerIdleFor + dt;
    // Skip the GPGPU passes once the spring has settled: identical image, far less GPU work.
    if (this.pointerIdleFor > 3) {
      u.tOffsetTex!.value = this.zeroOffset;
      return;
    }
    const vu = this.velVar.material.uniforms;
    vu.uDt!.value = Math.min(Math.max(dt, 0), 1 / 30);
    vu.uPointerStrength!.value = strength;
    if (pointer) {
      (vu.uPointer!.value as THREE.Vector3).copy(pointer.origin);
      (vu.uPointerDir!.value as THREE.Vector3).copy(pointer.dir);
    }
    this.gpu.compute();
    u.tOffsetTex!.value = this.gpu.getCurrentRenderTarget(this.offVar).texture;
  }

  dispose() {
    for (const g of this.shapes.values()) {
      g.pos.dispose();
      g.aux.dispose();
      g.col.dispose();
    }
    for (const t of this.trans.values()) t.dispose();
    this.shapes.clear();
    this.trans.clear();
    this.zeroOffset.dispose();
    this.points.geometry.dispose();
    this.material.dispose();
    this.gpu?.dispose();
  }
}
