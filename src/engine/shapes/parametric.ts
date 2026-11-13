import { compileOrRepair, type Compiled } from "../paramath";
import { allocate, PointBuilder } from "./helpers";
import type { ShapeDefinition } from "./types";

const DEFAULTS = { x: "sin(v)*cos(u)", y: "cos(v)", z: "sin(v)*sin(u)" } as const;
const AXES = ["x", "y", "z"] as const;
const VARS = ["u", "v"];

/** Keep coordinates as written up to ±1.2, then compress smoothly toward ±1.5 (continuous, so knobs never jump). */
function fitScale(ext: number): number {
  if (!(ext > 1e-9)) return 1;
  if (ext < 0.3) return 0.3 / ext;
  if (ext <= 1.2) return 1;
  return (1.2 + 0.3 * Math.tanh((ext - 1.2) / 0.3)) / ext;
}

export const parametric: ShapeDefinition = {
  id: "parametric",
  title: "Parametric surface",
  doc: "Any surface given by x(u,v), y(u,v), z(u,v) (default: unit sphere, u ∈ [0, 2π] around, v ∈ [0, π] pole to pole), evenly filled by area, with its u and v boundary curves highlighted. Shells, Klein bottles, Möbius strips, leaves, wings. Coordinates are used as written (keep them within about ±1). Put a, b or c in the formulas and a knob on it, e.g. x = \"(1+a/10)*sin(v)*cos(u)\" to stretch it live.",
  goodFor: ["a Möbius strip", "a seashell spiral", "a Klein bottle", "a leaf or a wing", "a saddle or minimal surface", "morphing one surface into another with a knob"],
  params: [
    { key: "u_min", default: 0, min: -10, max: 10, doc: "start of the u range" },
    { key: "u_max", default: 6.2832, min: -10, max: 10, doc: "end of the u range" },
    { key: "v_min", default: 0, min: -10, max: 10, doc: "start of the v range" },
    { key: "v_max", default: 3.1416, min: -10, max: 10, doc: "end of the v range" },
    { key: "thickness", default: 0.01, min: 0, max: 0.2, doc: "scatter of particles off the surface (canonical units)" },
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
    doc: `${k} coordinate as a function of u, v (also i, n and the knobs a, b, c)`,
  })),
  regions: [
    { id: "surface", doc: "the surface" },
    { id: "u_edge", doc: "the boundary curves at u = u_min and u = u_max (a seam if the surface closes)" },
    { id: "v_edge", doc: "the boundary curves at v = v_min and v = v_max (single points at a sphere's poles)" },
  ],
  motionDoc: "rotates slowly around the vertical axis",
  generate({ count, rng, params, expr, seed }) {
    const b = new PointBuilder();
    let fns: Compiled[] = [];
    let scope = new Float64Array(0);
    let slots: Record<string, number> = {};
    const compileAll = (useDefaults: boolean) => {
      fns = AXES.map((k) => {
        const src = useDefaults ? DEFAULTS[k] : (expr[k] ?? DEFAULTS[k]);
        const c = compileOrRepair(src, VARS, DEFAULTS[k], seed);
        if (c.repaired) b.warnings.push(`parametric: expression ${k} was repaired to "${c.used}" (${c.error})`);
        if (c.fellBack) b.warnings.push(`parametric: invalid expression ${k} (${c.error}); using the default`);
        slots = c.result.slots;
        scope = new Float64Array(c.result.scopeSize);
        return c.result.fn!;
      });
      scope[slots.n!] = count;
      scope[slots.a!] = params.a!;
      scope[slots.b!] = params.b!;
      scope[slots.c!] = params.c!;
    };
    compileAll(false);
    const su = () => slots.u!,
      sv = () => slots.v!,
      si = () => slots.i!;
    const evalAt = (u: number, v: number, i: number, out: Float64Array, o = 0) => {
      scope[su()] = u;
      scope[sv()] = v;
      scope[si()] = i;
      out[o] = fns[0]!(scope);
      out[o + 1] = fns[1]!(scope);
      out[o + 2] = fns[2]!(scope);
    };
    let u0 = params.u_min!,
      u1 = params.u_max!,
      v0 = params.v_min!,
      v1 = params.v_max!;
    const widen = (lo: number, hi: number, name: string): [number, number] => {
      if (Math.abs(hi - lo) >= 0.01) return [lo, hi];
      b.warnings.push(`parametric: ${name} range is empty; widened to 0.01`);
      return [lo, lo + (hi >= lo ? 0.01 : -0.01)];
    };
    [u0, u1] = widen(u0, u1, "u");
    [v0, v1] = widen(v0, v1, "v");

    // Node grid: G×G cells over (u, v). Cell areas (two triangles) give the area-correct sampling weights,
    // equivalent to rejecting uniform (u, v) samples by |r_u × r_v| but at a fixed, deterministic cost.
    const G = 112;
    const N1 = G + 1;
    const nodes = new Float64Array(N1 * N1 * 3);
    const buildNodes = () => {
      for (let j = 0; j <= G; j++)
        for (let i = 0; i <= G; i++) evalAt(u0 + ((u1 - u0) * i) / G, v0 + ((v1 - v0) * j) / G, (j * N1 + i) / (N1 * N1), nodes, (j * N1 + i) * 3);
    };
    buildNodes();
    let ext = 0;
    for (let k = 0; k < nodes.length; k++) ext = Math.max(ext, Math.abs(nodes[k]!));
    let cellArea = new Float64Array(G * G);
    const normals = new Float32Array(G * G * 3);
    const computeAreas = () => {
      let total = 0;
      for (let j = 0; j < G; j++)
        for (let i = 0; i < G; i++) {
          const p00 = (j * N1 + i) * 3,
            p10 = p00 + 3,
            p01 = p00 + N1 * 3,
            p11 = p01 + 3;
          const ax = nodes[p10]! - nodes[p00]!,
            ay = nodes[p10 + 1]! - nodes[p00 + 1]!,
            az = nodes[p10 + 2]! - nodes[p00 + 2]!;
          const bx = nodes[p01]! - nodes[p00]!,
            by = nodes[p01 + 1]! - nodes[p00 + 1]!,
            bz = nodes[p01 + 2]! - nodes[p00 + 2]!;
          const cx = nodes[p11]! - nodes[p10]!,
            cy = nodes[p11 + 1]! - nodes[p10 + 1]!,
            cz = nodes[p11 + 2]! - nodes[p10 + 2]!;
          const dx = nodes[p11]! - nodes[p01]!,
            dy = nodes[p11 + 1]! - nodes[p01 + 1]!,
            dz = nodes[p11 + 2]! - nodes[p01 + 2]!;
          const n1x = ay * bz - az * by,
            n1y = az * bx - ax * bz,
            n1z = ax * by - ay * bx;
          const n2x = cy * dz - cz * dy,
            n2y = cz * dx - cx * dz,
            n2z = cx * dy - cy * dx;
          const area = 0.5 * (Math.hypot(n1x, n1y, n1z) + Math.hypot(n2x, n2y, n2z));
          cellArea[j * G + i] = area;
          total += area;
          const nx = n1x + n2x,
            ny = n1y + n2y,
            nz = n1z + n2z;
          const nl = Math.hypot(nx, ny, nz) || 1;
          normals[(j * G + i) * 3] = nx / nl;
          normals[(j * G + i) * 3 + 1] = ny / nl;
          normals[(j * G + i) * 3 + 2] = nz / nl;
        }
      return total;
    };
    let totalArea = computeAreas();
    if (!(ext > 1e-6) || !(totalArea > 1e-12)) {
      b.warnings.push("parametric: the surface collapses to a point or a curve; showing the default sphere");
      compileAll(true);
      [u0, u1, v0, v1] = [0, Math.PI * 2, 0, Math.PI];
      buildNodes();
      ext = 0;
      for (let k = 0; k < nodes.length; k++) ext = Math.max(ext, Math.abs(nodes[k]!));
      cellArea = new Float64Array(G * G);
      totalArea = computeAreas();
    }
    const s = fitScale(ext);
    const thick = params.thickness!;
    const rot = { type: "rotate" as const, speed: 0.1 };
    const surf = b.region({ id: "surface", motion: rot, colorRole: "primary" });
    const uEdge = b.region({ id: "u_edge", motion: rot, colorRole: "accent" });
    const vEdge = b.region({ id: "v_edge", motion: rot, colorRole: "glow" });

    // Boundary curves, sampled by arc length. A degenerate curve (a pole) or a pair of coincident curves
    // (the seam of a closed surface) is not a real edge, so it only gets a token share.
    const KE = 256;
    const curves = [
      { reg: uEdge, at: (t: number): [number, number] => [u0, v0 + (v1 - v0) * t] },
      { reg: uEdge, at: (t: number): [number, number] => [u1, v0 + (v1 - v0) * t] },
      { reg: vEdge, at: (t: number): [number, number] => [u0 + (u1 - u0) * t, v0] },
      { reg: vEdge, at: (t: number): [number, number] => [u0 + (u1 - u0) * t, v1] },
    ];
    const pts = curves.map(() => new Float64Array((KE + 1) * 3));
    const lens = curves.map((cv, ci) => {
      let L = 0;
      for (let k = 0; k <= KE; k++) {
        const [u, v] = cv.at(k / KE);
        evalAt(u, v, k / KE, pts[ci]!, k * 3);
        if (k > 0) {
          const a = pts[ci]!;
          L += Math.hypot(a[k * 3]! - a[k * 3 - 3]!, a[k * 3 + 1]! - a[k * 3 - 2]!, a[k * 3 + 2]! - a[k * 3 - 1]!);
        }
      }
      return L;
    });
    // Same points in the same or reversed order (a Möbius strip glues its u-ends reversed).
    const coincide = (a: Float64Array, c: Float64Array) => {
      let d = 0,
        dr = 0;
      for (let k = 0; k <= KE; k++)
        for (let ax = 0; ax < 3; ax++) {
          d = Math.max(d, Math.abs(a[k * 3 + ax]! - c[k * 3 + ax]!));
          dr = Math.max(dr, Math.abs(a[k * 3 + ax]! - c[(KE - k) * 3 + ax]!));
        }
      return Math.min(d, dr) < 1e-3 * Math.max(ext, 1e-6);
    };
    const seamU = coincide(pts[0]!, pts[1]!),
      seamV = coincide(pts[2]!, pts[3]!);
    const maxLen = Math.max(...lens, 1e-9);
    const weights = lens.map((L, ci) => {
      const seam = ci < 2 ? seamU : seamV;
      return seam || L < 0.02 * maxLen ? 0.02 * maxLen : L;
    });
    const sumLen = lens.reduce((acc2, L) => acc2 + L, 0);
    const edgeFrac = sumLen > 1e-9 ? (0.12 * weights.reduce((acc2, w) => acc2 + w, 0)) / Math.max(sumLen, ...weights) : 0.01;
    const [nSurf, nEdge] = allocate(count, [1 - edgeFrac, edgeFrac]);
    const shares = allocate(nEdge!, weights);
    const cdf = new Float64Array(G * G);
    let acc = 0;
    for (let k = 0; k < G * G; k++) {
      acc += cellArea[k]!;
      cdf[k] = acc;
    }
    const p = new Float64Array(3);
    for (let k = 0; k < nSurf!; k++) {
      // Stratified pick over the area CDF (binary search).
      const target = ((k + rng.next()) / nSurf!) * acc;
      let lo = 0,
        hi = G * G - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (cdf[mid]! < target) lo = mid + 1;
        else hi = mid;
      }
      const ci = lo % G,
        cj = (lo / G) | 0;
      const fu = (ci + rng.next()) / G,
        fv = (cj + rng.next()) / G;
      evalAt(u0 + (u1 - u0) * fu, v0 + (v1 - v0) * fv, k / count, p);
      const off = (rng.next() - 0.5) * thick;
      const no = lo * 3;
      b.push(p[0]! * s + normals[no]! * off, p[1]! * s + normals[no + 1]! * off, p[2]! * s + normals[no + 2]! * off, surf, fu);
    }

    curves.forEach((cv, ci) => {
      const a = pts[ci]!;
      const n = shares[ci]!;
      for (let k = 0; k < n; k++) {
        const t = (k + rng.next()) / n;
        const f = t * KE;
        const kk = Math.min(KE - 1, Math.floor(f));
        const w = f - kk;
        const j = 0.004;
        b.push(
          (a[kk * 3]! + (a[kk * 3 + 3]! - a[kk * 3]!) * w) * s + rng.normal() * j,
          (a[kk * 3 + 1]! + (a[kk * 3 + 4]! - a[kk * 3 + 1]!) * w) * s + rng.normal() * j,
          (a[kk * 3 + 2]! + (a[kk * 3 + 5]! - a[kk * 3 + 2]!) * w) * s + rng.normal() * j,
          cv.reg,
          t,
          1.1,
        );
      }
    });
    const out = b.build(count, rng);
    // Safety net: tube/beads/thickness can poke past the fitted centreline; never leave canonical space.
    let maxAbs = 0;
    for (let k = 0; k < out.positions.length; k++) maxAbs = Math.max(maxAbs, Math.abs(out.positions[k]!));
    if (maxAbs > 1.55) for (let k = 0; k < out.positions.length; k++) out.positions[k] = (out.positions[k]! * 1.55) / maxAbs;
    return out;
  },
};
