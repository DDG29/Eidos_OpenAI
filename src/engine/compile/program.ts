import type { Layer, PaletteId, Transition } from "@/lib/world/types";
import type { ImageLike } from "../shapes/types";
import type { ShapeBuffer } from "../types";
import { hashString } from "../util/rng";
import { composeScene } from "./compose";
import { pairOrder, permuteBuffer, slotRandoms, staggerDelays } from "./pairing";

/** One renderable step of a program (a beat, a landing movement, a theater state…). */
export interface ProgramBeat {
  id: string;
  layers: Layer[];
  transition: Transition;
  dustFraction: number;
}

export interface ProgramInput {
  id: string;
  palette: PaletteId;
  count: number;
  beats: ProgramBeat[];
}

export interface BuiltBeat {
  index: number;
  key: string;
  buffer: ShapeBuffer;
  delays: Float32Array;
  pivots: [number, number, number][];
}

function beatKey(b: ProgramBeat, palette: PaletteId, count: number, programId: string): string {
  return `${hashString(JSON.stringify([programId, b.id, b.layers, b.dustFraction, palette, count]))}`;
}

/**
 * Deterministic program compiler shared by the web worker and Node tests/scripts. Pairing is sequential
 * (spec 5.8): order(i) = pair(order(i−1), shape(i)). Only permutations are kept for every beat; full
 * buffers are rebuilt on demand (composition is deterministic) and a small cache keeps the hot ones.
 */
export class ProgramCompiler {
  private image: ImageLike | null = null;
  private program: ProgramInput | null = null;
  private chainKeys: string[] = [];
  private perms = new Map<string, Uint32Array>(); // chainKey → permutation
  private cache = new Map<string, ShapeBuffer>(); // chainKey → permuted buffer
  private randoms: Float32Array | null = null;
  private maxCache = 4;

  setImage(img: ImageLike | null) {
    this.image = img;
    this.perms.clear();
    this.cache.clear();
  }

  setProgram(p: ProgramInput) {
    this.program = p;
    let prev = "root";
    this.chainKeys = p.beats.map((b) => {
      prev = `${hashString(`${prev}|${beatKey(b, p.palette, p.count, p.id)}|${b.transition}`)}`;
      return prev;
    });
    if (!this.randoms || this.randoms.length !== p.count * 2) this.randoms = slotRandoms(p.count);
  }

  get length() {
    return this.program?.beats.length ?? 0;
  }

  getRandoms(): Float32Array {
    if (!this.randoms) throw new Error("no program");
    return this.randoms;
  }

  private compose(i: number): ShapeBuffer {
    const p = this.program!;
    const b = p.beats[i]!;
    return composeScene({ layers: b.layers, palette: p.palette, count: p.count, dustFraction: b.dustFraction, seed: `${p.id}:${b.id}`, image: this.image });
  }

  private remember(key: string, buf: ShapeBuffer) {
    this.cache.delete(key);
    this.cache.set(key, buf);
    while (this.cache.size > this.maxCache) this.cache.delete(this.cache.keys().next().value as string);
  }

  /** Permuted buffer of beat i (computes the chain up to i if needed). */
  buffer(i: number): ShapeBuffer {
    const key = this.chainKeys[i];
    if (key === undefined) throw new Error(`beat ${i} out of range`);
    const hit = this.cache.get(key);
    if (hit) return hit;
    const raw = this.compose(i);
    let perm = this.perms.get(key);
    if (!perm) {
      const prev = i > 0 ? this.buffer(i - 1) : null;
      perm = pairOrder(prev, raw, this.program!.beats[i]!.transition, key);
      this.perms.set(key, perm);
    }
    const out = permuteBuffer(raw, perm);
    this.remember(key, out);
    return out;
  }

  build(i: number): BuiltBeat {
    const buf = this.buffer(i);
    const b = this.program!.beats[i]!;
    const pivots: [number, number, number][] = [0, 1, 2].map((li) => {
      const l = b.layers[li];
      return l ? [l.position?.x ?? 0, l.position?.y ?? 0, l.position?.z ?? 0] : [...buf.bounds.center];
    });
    pivots.push([...buf.bounds.center]);
    return { index: i, key: this.chainKeys[i]!, buffer: buf, delays: staggerDelays(buf, b.transition, this.getRandoms()), pivots };
  }

  /**
   * One-off composition paired against beat `againstIndex` (knob regeneration, Tutor projection, crack spores).
   * Uses coherent pairing so the event morph flows.
   */
  buildEvent(layers: Layer[], againstIndex: number | null, transition: Transition, dustFraction = 0.06, seed = "event"): Omit<BuiltBeat, "index"> {
    const p = this.program!;
    const raw = composeScene({ layers, palette: p.palette, count: p.count, dustFraction, seed: `${p.id}:${seed}`, image: this.image });
    const prev = againstIndex !== null && againstIndex >= 0 && againstIndex < this.length ? this.buffer(againstIndex) : null;
    const perm = pairOrder(prev, raw, transition, `${seed}:${againstIndex}`);
    const buf = permuteBuffer(raw, perm);
    const pivots: [number, number, number][] = [0, 1, 2].map((li) => {
      const l = layers[li];
      return l ? [l.position?.x ?? 0, l.position?.y ?? 0, l.position?.z ?? 0] : [...buf.bounds.center];
    });
    pivots.push([...buf.bounds.center]);
    return { key: `event:${hashString(JSON.stringify([layers, againstIndex, seed, p.count]))}`, buffer: buf, delays: staggerDelays(buf, transition, this.getRandoms()), pivots };
  }

  keyOf(i: number) {
    return this.chainKeys[i];
  }
}
