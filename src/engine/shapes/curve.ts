import { compileOrRepair, type Compiled } from "../paramath";
import { allocate, PointBuilder } from "./helpers";
import type { ShapeDefinition } from "./types";

// Default: a conical spiral that rises and widens, so start and end are clearly apart.
const DEFAULTS = { x: "(0.25+0.12*t)*cos(3*t)", y: "0.28*t-0.88", z: "(0.25+0.12*t)*sin(3*t)" } as const;
const AXES = ["x", "y", "z"] as const;
const VARS = ["t"];

/** Keep coordinates as written up to ±1.2, then compress smoothly toward ±1.5 (continuous, so knobs never jump). */
function fitScale(ext: number): number {
  if (!(ext > 1e-9)) return 1;
  if (ext < 0.3) return 0.3 / ext;
  if (ext <= 1.2) return 1;
  return (1.2 + 0.3 * Math.tanh((ext - 1.2) / 0.3)) / ext;
}

export const curve: ShapeDefinition = {
  id: "curve",
  title: "Parametric curve",
  doc: "A glowing tube along x(t), y(t), z(t) for t from t_min to t_max, with marked start and end; light pulses travel from start to end. Trajectories, orbits, graphs of one-variable functions (x = t, y = f(t), z = 0), paths, timelines. Coordinates are used as written (keep them within about ±1). Put a, b or c in the formulas with a knob, e.g. y = \"0.8*((1+a/100)^(t*30)-1)/((1+15/100)^30-1)\", x = \"t*2-1\", t ∈ [0, 1], with a knob on a as the interest rate in %.",
  goodFor: ["a trajectory or orbit", "the graph of a function", "compound interest growth with a rate knob", "a path or timeline", "a comet with a bright head", "a spiral or Lissajous figure"],
  params: [
    { key: "t_min", default: 0, min: -20, max: 20, doc: "start of t" },
    { key: "t_max", default: 6.2832, min: -20, max: 20, doc: "end of t" },
    { key: "thickness", default: 0.03, min: 0.005, max: 0.2, doc: "tube radius (canonical units)" },
    { key: "glow_head", default: 0, min: 0, max: 1, doc: "concentrates particles and brightness at the end, like a comet head" },
    { key: "a", default: 0, min: -10, max: 10, doc: "free coefficient available to the expressions" },
    { key: "b", default: 0, min: -10, max: 10, doc: "free coefficient available to the expressions" },
    { key: "c", default: 0, min: -10, max: 10, doc: "free coefficient available to the expressions" },
  ],
  expr: AXES.map((k) => ({
    key: k,
    kind: "paramath" as const,
    default: DEFAULTS[k],
    maxLength: 400,
    vars: VARS,
    doc: `${k} coordinate as a function of t (also i, n and the knobs a, b, c)`,
  })),
  regions: [
    { id: "curve", doc: "the tube along the curve" },
    { id: "start", doc: "bead at t = t_min" },
    { id: "end", doc: "bead at t = t_max (the comet head when glow_head > 0)" },
  ],
  motionDoc: "pulses of light travel from start to end",
  generate({ count, rng, params, expr, seed }) {
    const b = new PointBuilder();
    let slots: Record<string, number> = {};
    let scopeSize = 0;
    const fns: Compiled[] = AXES.map((k) => {
      const c = compileOrRepair(expr[k] ?? DEFAULTS[k], VARS, DEFAULTS[k], seed);
      if (c.repaired) b.warnings.push(`curve: expression ${k} was repaired to "${c.used}" (${c.error})`);
      if (c.fellBack) b.warnings.push(`curve: invalid expression ${k} (${c.error}); using the default`);
      slots = c.result.slots;
      scopeSize = c.result.scopeSize;
      return c.result.fn!;
    });
    const scope = new Float64Array(scopeSize);
    scope[slots.n!] = count;
    scope[slots.a!] = params.a!;
    scope[slots.b!] = params.b!;
    scope[slots.c!] = params.c!;
    const t0 = params.t_min!,
      t1 = params.t_max!;
    const tube = params.thickness!;
    const glow = params.glow_head!;
    // Dense knot table (exact evaluations), then everything is interpolated along it by arc length.
    const K = 8192;
    const P = new Float64Array((K + 1) * 3);
    let ext = 0;
    for (let k = 0; k <= K; k++) {
      scope[slots.t!] = t0 + ((t1 - t0) * k) / K;
      scope[slots.i!] = k / K;
      for (let a = 0; a < 3; a++) {
        const v = fns[a]!(scope);
        P[k * 3 + a] = v;
        ext = Math.max(ext, Math.abs(v));
      }
    }
    const s = fitScale(ext);
    for (let k = 0; k < P.length; k++) P[k] = P[k]! * s;
    const cum = new Float64Array(K + 1);
    for (let k = 1; k <= K; k++) cum[k] = cum[k - 1]! + Math.hypot(P[k * 3]! - P[k * 3 - 3]!, P[k * 3 + 1]! - P[k * 3 - 2]!, P[k * 3 + 2]! - P[k * 3 - 1]!);
    const total = cum[K]!;
    if (!(total > 1e-9)) b.warnings.push("curve: the curve has zero length (t_min = t_max or constant expressions)");

    const flow = { type: "flow" as const, speed: 0.5 };
    const curveReg = b.region({ id: "curve", motion: flow, colorRole: "primary" });
    const startReg = b.region({ id: "start", motion: flow, colorRole: "secondary" });
    const endReg = b.region({ id: "end", motion: flow, colorRole: "glow" });
    const [nCurve, nStart, nEnd] = allocate(count, [0.93 - 0.06 * glow, 0.03, 0.04 + 0.06 * glow]);

    // Density along the arc: uniform, plus (with glow_head) a ramp of up to 5× toward the end.
    // w(f) = 1 − 0.8g + 0.8g·5f⁴ integrates to 1 over f ∈ [0, 1]. Its CDF F(f) = (1−g)f + g·f⁵ is inverted by
    // Newton steps warm-started from the previous (stratified, increasing) sample.
    const g = 0.8 * glow;
    let fPrev = 0;
    const cdfInv = (y: number) => {
      if (g < 1e-6) return y;
      let f = fPrev;
      for (let it = 0; it < 6; it++) {
        const f4 = f * f * f * f;
        f -= ((1 - g) * f + g * f4 * f - y) / ((1 - g) + 5 * g * f4);
        f = f < 0 ? 0 : f > 1 ? 1 : f;
      }
      fPrev = f;
      return f;
    };
    const pos = (f: number, out: number[]) => {
      // f: arc-length fraction → knot segment (binary search), interpolated position and tangent.
      const target = f * total;
      let lo = 0,
        hi = K - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (cum[mid]! <= target) lo = mid;
        else hi = mid - 1;
      }
      const segLen = cum[lo + 1]! - cum[lo]!;
      const w = total > 1e-9 ? Math.min(1, Math.max(0, (target - cum[lo]!) / Math.max(segLen, 1e-12))) : f;
      const k = total > 1e-9 ? lo : Math.min(K - 1, Math.floor(f * K));
      for (let a = 0; a < 3; a++) {
        out[a] = P[k * 3 + a]! + (P[k * 3 + 3 + a]! - P[k * 3 + a]!) * w;
        out[3 + a] = P[k * 3 + 3 + a]! - P[k * 3 + a]!;
      }
      return (k + w) / K;
    };
    const q = [0, 0, 0, 0, 0, 0];
    for (let k = 0; k < nCurve!; k++) {
      const f = cdfInv((k + rng.next()) / nCurve!);
      const tn = pos(f, q);
      let tx = q[3]!,
        ty = q[4]!,
        tz = q[5]!;
      const tl = Math.hypot(tx, ty, tz);
      if (tl < 1e-12) {
        tx = 1;
        ty = 0;
        tz = 0;
      } else {
        tx /= tl;
        ty /= tl;
        tz /= tl;
      }
      const ref = Math.abs(ty) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      let nx = ty * ref[2]! - tz * ref[1]!,
        ny = tz * ref[0]! - tx * ref[2]!,
        nz = tx * ref[1]! - ty * ref[0]!;
      const nl = Math.hypot(nx, ny, nz) || 1;
      nx /= nl;
      ny /= nl;
      nz /= nl;
      const bx = ty * nz - tz * ny,
        by = tz * nx - tx * nz,
        bz = tx * ny - ty * nx;
      const ang = rng.next() * Math.PI * 2;
      // Gaussian-ish cross-section: a bright core that fades to the tube radius.
      const rad = tube * Math.min(1, Math.abs(rng.normal()) * 0.55);
      const c = Math.cos(ang) * rad,
        sn = Math.sin(ang) * rad;
      const size = 1 + glow * 0.9 * f ** 6;
      b.push(q[0]! + nx * c + bx * sn, q[1]! + ny * c + by * sn, q[2]! + nz * c + bz * sn, curveReg, tn, size);
    }
    const d = [0, 0, 0];
    const bead = (n: number, f: number, r: number, reg: number, size: number) => {
      const tn = pos(f, q);
      for (let k = 0; k < n; k++) {
        rng.dir(d);
        const rr = r * Math.pow(rng.next(), 0.45);
        b.push(q[0]! + d[0]! * rr, q[1]! + d[1]! * rr, q[2]! + d[2]! * rr, reg, tn, size);
      }
    };
    bead(nStart!, 0, tube * 2, startReg, 1);
    bead(nEnd!, 1, tube * (2.2 + 2 * glow), endReg, 1 + 0.6 * glow);
    const out = b.build(count, rng);
    // Safety net: tube/beads/thickness can poke past the fitted centreline; never leave canonical space.
    let maxAbs = 0;
    for (let k = 0; k < out.positions.length; k++) maxAbs = Math.max(maxAbs, Math.abs(out.positions[k]!));
    if (maxAbs > 1.55) for (let k = 0; k < out.positions.length; k++) out.positions[k] = (out.positions[k]! * 1.55) / maxAbs;
    return out;
  },
};
