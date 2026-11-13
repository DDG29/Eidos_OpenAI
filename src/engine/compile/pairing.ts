import type { Transition } from "@/lib/world/types";
import { DUST_REGION, type ShapeBuffer } from "../types";
import { createRng } from "../util/rng";
import { argsort, hilbertKeys } from "./hilbert";

const COHERENT: ReadonlySet<Transition> = new Set(["flow", "swirl", "fold"]);
export const DEFAULT_STAGGER: Record<Transition, number> = { flow: 0.35, swirl: 0.25, explode: 0.15, fold: 0.3, rain: 0.45, dissolve: 0.2 };
export const TRANSITION_INDEX: Record<Transition, number> = { flow: 0, swirl: 1, explode: 2, fold: 3, rain: 4, dissolve: 5 };

const GROUP = 2 ** 30; // dust sorts after shape particles

function keysWithDust(buf: ShapeBuffer): Float64Array {
  const n = buf.count;
  const keys = hilbertKeys(buf.positions, n, 4, 10, (i) => buf.regionIds[i] !== DUST_REGION);
  for (let i = 0; i < n; i++) if (buf.regionIds[i] === DUST_REGION) keys[i] = keys[i]! + GROUP;
  return keys;
}

/** Canonical order for the first beat: Hilbert order of its own particles (shape first, dust last). */
export function canonicalOrder(buf: ShapeBuffer): Uint32Array {
  return argsort(keysWithDust(buf), buf.count);
}

/**
 * Pair `next` against the already-ordered `prev` (spec 5.8). Returns perm such that slot j of the result
 * takes particle perm[j] of `next`. Coherent transitions keep Hilbert neighbours together; scattering ones
 * use a seeded random permutation.
 */
export function pairOrder(prev: ShapeBuffer | null, next: ShapeBuffer, transition: Transition, seed: string): Uint32Array {
  const n = next.count;
  if (!prev) return canonicalOrder(next);
  const rng = createRng(`pair:${seed}`);
  if (!COHERENT.has(transition)) {
    const perm = new Uint32Array(n);
    for (let i = 0; i < n; i++) perm[i] = i;
    for (let i = n - 1; i > 0; i--) {
      const j = rng.int(i + 1);
      const t = perm[i]!;
      perm[i] = perm[j]!;
      perm[j] = t;
    }
    return perm;
  }
  const sortedA = argsort(keysWithDust(prev), n); // rank → slot of prev
  const sortedB = argsort(keysWithDust(next), n); // rank → index of next
  // Window swaps in rank space break up visible banding (spec 5.8 "mixed refinement").
  const W = 64;
  for (let start = 0; start < n; start += W) {
    const end = Math.min(n, start + W);
    for (let k = 0; k < 16; k++) {
      const a = start + rng.int(end - start),
        b = start + rng.int(end - start);
      const t = sortedB[a]!;
      sortedB[a] = sortedB[b]!;
      sortedB[b] = t;
    }
  }
  const perm = new Uint32Array(n);
  for (let r = 0; r < n; r++) perm[sortedA[r]!] = sortedB[r]!;
  return perm;
}

/** Apply a permutation to every per-particle array of a buffer (returns a new buffer). */
export function permuteBuffer(buf: ShapeBuffer, perm: Uint32Array): ShapeBuffer {
  const n = buf.count;
  const positions = new Float32Array(n * 4);
  const aux = new Float32Array(n * 4);
  const colors = new Uint8Array(n * 4);
  const regionIds = new Uint16Array(n);
  for (let j = 0; j < n; j++) {
    const s = perm[j]!;
    positions.set(buf.positions.subarray(s * 4, s * 4 + 4), j * 4);
    aux.set(buf.aux.subarray(s * 4, s * 4 + 4), j * 4);
    colors.set(buf.colors.subarray(s * 4, s * 4 + 4), j * 4);
    regionIds[j] = buf.regionIds[s]!;
  }
  return { ...buf, positions, aux, colors, regionIds };
}

/** Per-slot constants shared by every beat (so density culling never pops between beats). */
export function slotRandoms(n: number): Float32Array {
  const rng = createRng("eidos:slots");
  const out = new Float32Array(n * 2);
  for (let i = 0; i < n * 2; i++) out[i] = rng.next();
  return out;
}

/** Stagger delays in [0,1] for the destination shape of a transition (spec 5.8 table). */
export function staggerDelays(dest: ShapeBuffer, transition: Transition, randoms: Float32Array): Float32Array {
  const n = dest.count;
  const d = new Float32Array(n);
  const p = dest.positions;
  const c = dest.bounds.center;
  if (transition === "explode" || transition === "dissolve") {
    for (let i = 0; i < n; i++) d[i] = randoms[i * 2 + 1]!;
    return d;
  }
  let lo = Infinity,
    hi = -Infinity;
  const val = (i: number) => {
    switch (transition) {
      case "flow":
        return p[i * 4]!;
      case "swirl":
        return Math.hypot(p[i * 4]! - c[0], p[i * 4 + 2]! - c[2]);
      case "fold":
        return p[i * 4 + 1]!;
      case "rain":
        return -p[i * 4 + 1]!;
    }
    return 0;
  };
  for (let i = 0; i < n; i++) {
    if (dest.regionIds[i] === DUST_REGION) continue;
    const v = val(i);
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const span = hi - lo || 1;
  for (let i = 0; i < n; i++) d[i] = Math.min(1, Math.max(0, (val(i) - lo) / span));
  return d;
}
