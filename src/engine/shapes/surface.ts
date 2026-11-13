import { compileOrRepair } from "../paramath";
import { PointBuilder } from "./helpers";
import type { ParamSpec, ShapeDefinition } from "./types";

const DEFAULT_F = "0.3*sin(3*x)*cos(3*y)";

const FREE_COEFFS: ParamSpec[] = [
  { key: "a", default: 0, min: -10, max: 10, doc: "free coefficient available to the expressions" },
  { key: "b", default: 0, min: -10, max: 10, doc: "free coefficient available to the expressions" },
  { key: "c", default: 0, min: -10, max: 10, doc: "free coefficient available to the expressions" },
];

/** Keep coordinates as written up to ±1.2, then compress smoothly toward ±1.5 (continuous, so knobs never jump). */
function fitScale(ext: number): number {
  if (!(ext > 1e-9)) return 1;
  if (ext < 0.3) return 0.3 / ext;
  if (ext <= 1.2) return 1;
  return (1.2 + 0.3 * Math.tanh((ext - 1.2) / 0.3)) / ext;
}

export const surface: ShapeDefinition = {
  id: "surface",
  title: "Surface z = f(x, y)",
  doc: "A 3D plot of a two-variable function drawn as a mesh: x and y run over [-1, 1] on the floor (XZ plane) and f is the height. Loss landscapes, probability densities, topography, any f(x, y). Heights are used as written (keep them within about ±1). Put a knob on a, b or c to reshape it live, e.g. f = \"0.4*exp(-(x^2+y^2)/(0.1+a/10))\" with a knob on a for the width.",
  goodFor: ["a loss landscape with valleys", "a 2D gaussian / probability density", "a saddle point", "an abstract topography", "interference of two variables"],
  params: [
    { key: "resolution", default: 140, min: 40, max: 260, integer: true, doc: "mesh lines per side (capped by particle count)" },
    { key: "height_scale", default: 1, min: 0.1, max: 2, doc: "multiplies f before drawing" },
    ...FREE_COEFFS,
  ],
  expr: [
    {
      key: "f",
      kind: "paramath",
      default: DEFAULT_F,
      maxLength: 400,
      vars: ["x", "y"],
      doc: "height as a function of x, y ∈ [-1, 1] (also i, n and the knobs a, b, c)",
    },
  ],
  regions: [
    { id: "surface", doc: "the whole mesh" },
    { id: "peaks", doc: "the highest 10% of the surface" },
    { id: "valleys", doc: "the lowest 10% of the surface" },
  ],
  motionDoc: "still",
  generate({ count, rng, params, expr, seed }) {
    const hs = params.height_scale!;
    const b = new PointBuilder();
    const comp = compileOrRepair(expr.f ?? DEFAULT_F, ["x", "y"], DEFAULT_F, seed);
    if (comp.repaired) b.warnings.push(`surface: expression f was repaired to "${comp.used}" (${comp.error})`);
    if (comp.fellBack) b.warnings.push(`surface: invalid expression f (${comp.error}); using the default`);
    const fn = comp.result.fn!;
    const slots = comp.result.slots;
    const scope = new Float64Array(comp.result.scopeSize);
    const sx = slots.x!,
      sy = slots.y!,
      si = slots.i!;
    scope[slots.n!] = count;
    scope[slots.a!] = params.a!;
    scope[slots.b!] = params.b!;
    scope[slots.c!] = params.c!;
    const f = (x: number, y: number, i: number) => {
      scope[sx] = x;
      scope[sy] = y;
      scope[si] = i;
      return fn(scope) * hs;
    };
    const still = { type: "none" as const, speed: 0 };
    const surf = b.region({ id: "surface", motion: still, colorRole: "primary" });
    const peaks = b.region({ id: "peaks", motion: still, colorRole: "glow" });
    const valleys = b.region({ id: "valleys", motion: still, colorRole: "secondary" });
    // Lines per side: ≥ 1.5·L points per line so each mesh line reads as a line, not dots.
    const L = Math.max(8, Math.min(Math.round(params.resolution!), Math.floor(Math.sqrt(count / 3))));
    const step = 2 / (L - 1);
    // Per line, a K-knot table of 3D arc length lets steep walls keep the same density as flat parts.
    const K = Math.min(512, Math.max(64, L * 2));
    const nLines = 2 * L;
    const cum = new Float64Array(nLines * (K + 1));
    const lineLen = new Float64Array(nLines);
    let total = 0;
    for (let l = 0; l < nLines; l++) {
      const fixed = -1 + (l % L) * step;
      const alongX = l < L;
      const base = l * (K + 1);
      let acc = 0,
        px = 0,
        py = 0;
      for (let k = 0; k <= K; k++) {
        const t = -1 + (2 * k) / K;
        const h = alongX ? f(t, fixed, l / nLines) : f(fixed, t, l / nLines);
        if (k > 0) acc += Math.hypot(t - px, h - py);
        cum[base + k] = acc;
        px = t;
        py = h;
      }
      lineLen[l] = acc;
      total += acc;
    }
    const xs = new Float32Array(count),
      ys = new Float32Array(count),
      zs = new Float32Array(count);
    let o = 0,
      acc = 0,
      assigned = 0;
    let minH = Infinity,
      maxH = -Infinity;
    for (let l = 0; l < nLines; l++) {
      acc += lineLen[l]!;
      const target = l === nLines - 1 ? count : Math.round((acc / Math.max(total, 1e-12)) * count);
      const n = target - assigned;
      assigned = target;
      const fixed = -1 + (l % L) * step;
      const alongX = l < L;
      const base = l * (K + 1);
      const len = lineLen[l]!;
      let seg = 0;
      for (let j = 0; j < n; j++) {
        const s = ((j + rng.next()) / n) * len;
        while (seg < K - 1 && cum[base + seg + 1]! < s) seg++;
        const fr = (s - cum[base + seg]!) / Math.max(cum[base + seg + 1]! - cum[base + seg]!, 1e-12);
        const t = -1 + (2 * (seg + fr)) / K;
        const x = alongX ? t : fixed,
          y = alongX ? fixed : t;
        const h = f(x, y, o / Math.max(count - 1, 1));
        // Math convention: x to the right, y going away from the viewer (−Z), height up (+Y).
        xs[o] = x;
        ys[o] = h;
        zs[o] = -y;
        if (h < minH) minH = h;
        if (h > maxH) maxH = h;
        o++;
      }
    }
    const hExt = Math.max(Math.abs(minH), Math.abs(maxH));
    // Only compress (never enlarge) heights: a flat or gentle f stays as written.
    const hScale = hExt > 1.2 ? fitScale(hExt) : 1;
    // 10% / 90% height quantiles from a 1024-bin histogram (O(n), exact enough for colouring).
    const range = maxH - minH;
    let lo = -Infinity,
      hi = Infinity;
    if (range > 1e-6) {
      const BINS = 1024;
      const hist = new Uint32Array(BINS);
      for (let i = 0; i < o; i++) hist[Math.min(BINS - 1, Math.floor(((ys[i]! - minH) / range) * BINS))]!++;
      let accN = 0;
      for (let k = 0; k < BINS; k++) {
        accN += hist[k]!;
        if (lo === -Infinity && accN >= o * 0.1) lo = minH + ((k + 1) / BINS) * range;
        if (accN >= o * 0.9) {
          hi = minH + (k / BINS) * range;
          break;
        }
      }
    }
    for (let i = 0; i < o; i++) {
      const h = ys[i]!;
      const reg = h >= hi ? peaks : h <= lo ? valleys : surf;
      b.push(xs[i]!, h * hScale, zs[i]!, reg, range > 1e-6 ? (h - minH) / range : 0.5);
    }
    return b.build(count, rng);
  },
};
