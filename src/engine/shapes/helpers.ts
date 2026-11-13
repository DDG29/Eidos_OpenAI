import type { Rng } from "../util/rng";
import type { ShapeOutput, ShapeRegionOut } from "./types";

/** Split `count` into integer parts proportional to `weights` (sum exactly `count`). */
export function allocate(count: number, weights: readonly number[]): number[] {
  const total = weights.reduce((s, w) => s + Math.max(0, w), 0) || 1;
  const raw = weights.map((w) => (Math.max(0, w) / total) * count);
  const out = raw.map(Math.floor);
  let rest = count - out.reduce((s, v) => s + v, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0]);
  for (let k = 0; rest > 0 && order.length > 0; k = (k + 1) % order.length, rest--) out[order[k]![1]]! += 1;
  return out;
}

/** Growable point buffer with a final exact-count resample (spec 6.1 rule: exactly `count`). */
export class PointBuilder {
  private px: number[] = [];
  private mp: number[] = [];
  private rg: number[] = [];
  private cl: number[] | null = null;
  private sz: number[] | null = null;
  readonly regions: ShapeRegionOut[] = [];
  private regionIndex = new Map<string, number>();
  warnings: string[] = [];

  region(r: ShapeRegionOut): number {
    const existing = this.regionIndex.get(r.id);
    if (existing !== undefined) return existing;
    const idx = this.regions.length;
    this.regions.push(r);
    this.regionIndex.set(r.id, idx);
    return idx;
  }

  get length() {
    return this.rg.length;
  }

  push(x: number, y: number, z: number, region: number, motionParam = 0, size?: number, color?: readonly [number, number, number]) {
    this.px.push(x, y, z);
    this.mp.push(motionParam);
    this.rg.push(region);
    if (size !== undefined || this.sz) {
      if (!this.sz) this.sz = new Array(this.rg.length - 1).fill(1);
      this.sz.push(size ?? 1);
    }
    if (color || this.cl) {
      if (!this.cl) this.cl = new Array((this.rg.length - 1) * 3).fill(-1);
      if (color) this.cl.push(color[0], color[1], color[2]);
      else this.cl.push(-1, -1, -1);
    }
  }

  /** Exactly `count` points: uniform subset if too many, jittered duplicates if too few. */
  build(count: number, rng: Rng, jitter = 0.004): ShapeOutput {
    const m = this.rg.length;
    const positions = new Float32Array(count * 3);
    const motionParam = new Float32Array(count);
    const regionLocal = new Uint16Array(count);
    const colors = this.cl ? new Float32Array(count * 3) : undefined;
    const sizes = this.sz ? new Float32Array(count) : undefined;
    if (m === 0) {
      // Degenerate: a tiny ball so the shape is never empty.
      const r = this.region({ id: "body", motion: { type: "none", speed: 0 } });
      for (let i = 0; i < count; i++) {
        const d = [0, 0, 0];
        rng.dir(d);
        const rr = 0.1 * Math.cbrt(rng.next());
        positions.set([d[0]! * rr, d[1]! * rr, d[2]! * rr], i * 3);
        regionLocal[i] = r;
      }
      this.warnings.push("generator produced no points");
      return { positions, motionParam, regionLocal, regions: this.regions, warnings: this.warnings };
    }
    let pick: (i: number) => number;
    if (m >= count) {
      // Deterministic uniform subset preserving order (selection sampling, Knuth Algorithm S).
      const chosen = new Uint32Array(count);
      let needed = count;
      let k = 0;
      for (let i = 0; i < m && needed > 0; i++) {
        if (rng.next() * (m - i) < needed) {
          chosen[k++] = i;
          needed--;
        }
      }
      pick = (i) => chosen[i]!;
    } else {
      pick = (i) => (i < m ? i : rng.int(m));
    }
    for (let i = 0; i < count; i++) {
      const s = pick(i);
      const dup = m < count && i >= m;
      const j = dup ? jitter : 0;
      positions[i * 3] = this.px[s * 3]! + (j ? rng.normal() * j : 0);
      positions[i * 3 + 1] = this.px[s * 3 + 1]! + (j ? rng.normal() * j : 0);
      positions[i * 3 + 2] = this.px[s * 3 + 2]! + (j ? rng.normal() * j : 0);
      motionParam[i] = this.mp[s]!;
      regionLocal[i] = this.rg[s]!;
      if (colors && this.cl) {
        colors[i * 3] = this.cl[s * 3]!;
        colors[i * 3 + 1] = this.cl[s * 3 + 1]!;
        colors[i * 3 + 2] = this.cl[s * 3 + 2]!;
      }
      if (sizes && this.sz) sizes[i] = this.sz[s]!;
    }
    return { positions, motionParam, regionLocal, regions: this.regions, colors, sizes, warnings: this.warnings };
  }
}

/** Center on the bounding-box center and scale so the largest |coordinate| equals `target`. */
export function normalizeExtent(pos: Float32Array, target = 1, center = true): number {
  const n = pos.length / 3;
  if (n === 0) return 1;
  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity,
    maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity;
  for (let i = 0; i < n; i++) {
    const x = pos[i * 3]!,
      y = pos[i * 3 + 1]!,
      z = pos[i * 3 + 2]!;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  const cx = center ? (minX + maxX) / 2 : 0,
    cy = center ? (minY + maxY) / 2 : 0,
    cz = center ? (minZ + maxZ) / 2 : 0;
  let ext = 0;
  for (let i = 0; i < n; i++) {
    pos[i * 3] = pos[i * 3]! - cx;
    pos[i * 3 + 1] = pos[i * 3 + 1]! - cy;
    pos[i * 3 + 2] = pos[i * 3 + 2]! - cz;
    ext = Math.max(ext, Math.abs(pos[i * 3]!), Math.abs(pos[i * 3 + 1]!), Math.abs(pos[i * 3 + 2]!));
  }
  const s = ext > 1e-9 ? target / ext : 1;
  for (let i = 0; i < pos.length; i++) pos[i] = pos[i]! * s;
  return s;
}

export function sanitize(pos: Float32Array, limit = 50) {
  for (let i = 0; i < pos.length; i++) {
    const v = pos[i]!;
    pos[i] = Number.isFinite(v) ? Math.max(-limit, Math.min(limit, v)) : 0;
  }
}

/** Uniform point in the unit ball. */
export function inBall(rng: Rng, out: number[], radius = 1, power = 1 / 3) {
  rng.dir(out);
  const r = radius * Math.pow(rng.next(), power);
  out[0]! *= r;
  out[1]! *= r;
  out[2]! *= r;
}

/** Point on a thin tube of radius `r` around point p with tangent t (gaussian-ish radial falloff). */
export function aroundTube(rng: Rng, p: readonly number[], tangent: readonly number[], r: number, out: number[]) {
  // Build an orthonormal frame from the tangent.
  const tx = tangent[0]!,
    ty = tangent[1]!,
    tz = tangent[2]!;
  const tl = Math.hypot(tx, ty, tz) || 1;
  const ux = tx / tl,
    uy = ty / tl,
    uz = tz / tl;
  const az = 0;
  let ax = 0,
    ay = 1;
  if (Math.abs(uy) > 0.9) {
    ax = 1;
    ay = 0;
  }
  let nx = uy * az - uz * ay,
    ny = uz * ax - ux * az,
    nz = ux * ay - uy * ax;
  const nl = Math.hypot(nx, ny, nz) || 1;
  nx /= nl;
  ny /= nl;
  nz /= nl;
  const bx = uy * nz - uz * ny,
    by = uz * nx - ux * nz,
    bz = ux * ny - uy * nx;
  const ang = rng.next() * Math.PI * 2;
  const rad = r * Math.sqrt(rng.next());
  const c = Math.cos(ang) * rad,
    s = Math.sin(ang) * rad;
  out[0] = p[0]! + nx * c + bx * s;
  out[1] = p[1]! + ny * c + by * s;
  out[2] = p[2]! + nz * c + bz * s;
}

export function clamp(v: number, a: number, b: number) {
  return v < a ? a : v > b ? b : v;
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** Parse "a|b|c" label lists. */
export function parseLabels(s: string | undefined): string[] {
  if (!s) return [];
  return s
    .split("|")
    .map((x) => x.trim())
    .filter((x) => x.length > 0)
    .slice(0, 80);
}

/** Parse "0-1;1-2" edge lists with index bounds. */
export function parseEdges(s: string | undefined, maxIndex: number): [number, number][] {
  if (!s) return [];
  const out: [number, number][] = [];
  for (const part of s.split(/[;,\s]+/)) {
    const m = /^(\d+)-(\d+)$/.exec(part.trim());
    if (!m) continue;
    const a = Number(m[1]),
      b = Number(m[2]);
    if (a !== b && a < maxIndex && b < maxIndex) out.push([a, b]);
  }
  return out.slice(0, 400);
}
