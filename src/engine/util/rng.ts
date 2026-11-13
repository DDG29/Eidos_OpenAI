/** Seeded PRNG (sfc32) + string hashing. Determinism is a hard requirement (spec 5.1 #8). */

export interface Rng {
  /** uniform in [0, 1) */
  next(): number;
  range(min: number, max: number): number;
  int(maxExclusive: number): number;
  /** standard normal (Box–Muller) */
  normal(): number;
  /** uniform direction on the unit sphere, written into out[o..o+2] */
  dir(out: Float32Array | number[], o?: number): void;
  fork(label: string): Rng;
  readonly seed: number;
}

/** cyrb128: four 32-bit hashes of a string, good avalanche for seeding sfc32. */
export function hash128(str: string): [number, number, number, number] {
  let h1 = 1779033703,
    h2 = 3144134277,
    h3 = 1013904242,
    h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

export function hashString(str: string): number {
  return hash128(str)[0];
}

function sfc32(a: number, b: number, c: number, d: number): () => number {
  return () => {
    a |= 0;
    b |= 0;
    c |= 0;
    d |= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

export function createRng(seed: string | number): Rng {
  const key = typeof seed === "number" ? `n:${seed}` : seed;
  const [a, b, c, d] = hash128(key);
  const raw = sfc32(a, b, c, d);
  // Warm up: the first outputs of sfc32 correlate with the seed words.
  for (let i = 0; i < 12; i++) raw();
  let spare: number | null = null;
  const rng: Rng = {
    seed: a,
    next: raw,
    range: (min, max) => min + (max - min) * raw(),
    int: (n) => Math.floor(raw() * n),
    normal: () => {
      if (spare !== null) {
        const s = spare;
        spare = null;
        return s;
      }
      let u = 0;
      while (u === 0) u = raw();
      const v = raw();
      const m = Math.sqrt(-2 * Math.log(u));
      spare = m * Math.sin(2 * Math.PI * v);
      return m * Math.cos(2 * Math.PI * v);
    },
    dir: (out, o = 0) => {
      const z = 2 * raw() - 1;
      const t = 2 * Math.PI * raw();
      const r = Math.sqrt(Math.max(0, 1 - z * z));
      out[o] = r * Math.cos(t);
      out[o + 1] = r * Math.sin(t);
      out[o + 2] = z;
    },
    fork: (label) => createRng(`${key}/${label}`),
  };
  return rng;
}
