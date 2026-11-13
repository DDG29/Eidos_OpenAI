import type { Remote } from "comlink";
import type { Layer, Transition } from "@/lib/world/types";
import type { BuiltBeat, ProgramInput } from "../compile/program";
import type { ShapeWorkerApi } from "../compile/shape.worker";
import type { ImageLike } from "../shapes/types";

export type BuiltEvent = Omit<BuiltBeat, "index">;

/** Main-thread handle on a compiled program in the shape worker: dedupes requests, keeps a small LRU. */
export class ProgramClient {
  private cache = new Map<number, BuiltBeat>();
  private inflight = new Map<number, Promise<BuiltBeat>>();
  private maxCache = 6;
  private randomsP: Promise<Float32Array> | null = null;
  readonly id: string;
  input: ProgramInput;
  genMs: number[] = [];
  private version = 0;

  constructor(
    private worker: Remote<ShapeWorkerApi>,
    input: ProgramInput,
  ) {
    this.id = input.id;
    this.input = input;
  }

  async init() {
    await this.worker.setProgram(this.input);
  }

  get length() {
    return this.input.beats.length;
  }

  /** Replace the beat list (remedial/branch insertion). Cached beats before `fromIndex` stay valid. */
  async update(input: ProgramInput, fromIndex: number) {
    this.version++;
    this.input = input;
    for (const k of [...this.cache.keys()]) if (k >= fromIndex) this.cache.delete(k);
    this.inflight.clear();
    await this.worker.setProgram(input);
  }

  async setImage(img: ImageLike | null) {
    await this.worker.setImage(this.id, img);
    this.cache.clear();
  }

  randoms(): Promise<Float32Array> {
    this.randomsP ??= this.worker.randoms(this.id);
    return this.randomsP;
  }

  peek(i: number): BuiltBeat | undefined {
    return this.cache.get(i);
  }

  ensure(i: number): Promise<BuiltBeat> {
    const hit = this.cache.get(i);
    if (hit) {
      this.cache.delete(i);
      this.cache.set(i, hit);
      return Promise.resolve(hit);
    }
    const fl = this.inflight.get(i);
    if (fl) return fl;
    const v = this.version;
    const p = this.worker.build(this.id, i).then((b) => {
      const built = b as BuiltBeat & { ms: number };
      this.genMs.push(built.ms);
      if (this.genMs.length > 20) this.genMs.shift();
      if (v === this.version) {
        this.cache.set(i, built);
        while (this.cache.size > this.maxCache) this.cache.delete(this.cache.keys().next().value as number);
      }
      this.inflight.delete(i);
      return built;
    });
    this.inflight.set(i, p);
    return p;
  }

  prefetch(center: number, radius = 2) {
    for (let d = 1; d <= radius; d++) {
      for (const i of [center + d, center - d]) if (i >= 0 && i < this.length && !this.cache.has(i)) void this.ensure(i).catch(() => {});
    }
  }

  buildEvent(layers: Layer[], againstIndex: number | null, transition: Transition, dustFraction = 0.06, seed = "event"): Promise<BuiltEvent> {
    return this.worker.buildEvent(this.id, layers, againstIndex, transition, dustFraction, seed) as Promise<BuiltEvent>;
  }

  dispose() {
    void this.worker.drop(this.id);
    this.cache.clear();
  }
}
