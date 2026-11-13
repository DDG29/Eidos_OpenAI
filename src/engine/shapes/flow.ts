import { compileOrRepair } from "../paramath";
import { aroundTube, PointBuilder } from "./helpers";
import type { ShapeDefinition } from "./types";

type V3 = [number, number, number];

/** Built-in paths, t ∈ [0, 1]. */
function presetPoint(preset: number, t: number): V3 {
  const a = t * Math.PI * 2;
  switch (preset) {
    case 1: // meandering river, left → right
      return [-1 + 2 * t, 0.08 * Math.sin(a * 1.5), 0.42 * Math.sin(a * 2.2) * (0.6 + 0.4 * Math.cos(a))];
    case 2: // figure eight: double circulation (two loops sharing a center)
      return [0.95 * Math.sin(a), 0.12 * Math.sin(2 * a), 0.48 * Math.sin(2 * a)];
    case 3: // rising spiral
      return [0.6 * Math.cos(a * 3), -0.95 + 1.9 * t, 0.6 * Math.sin(a * 3)];
    default: // closed loop (cycle)
      return [0.9 * Math.cos(a), 0.15 * Math.sin(a * 2), 0.62 * Math.sin(a)];
  }
}

export const flow: ShapeDefinition = {
  id: "flow",
  title: "Flow tube",
  doc: "A glowing tube of particles along a path with pulses of light travelling from source to sink. Circulation, cycles, rivers, supply chains, energy flows. Use a preset or draw your own path with ParaMath x(t), y(t), z(t), t ∈ [0, 1].",
  goodFor: ["blood circulation (preset 2)", "the water cycle (preset 0)", "a river or canal network (preset 1)", "energy flowing through a system", "a supply chain", "a rising spiral of growth (preset 3)"],
  params: [
    { key: "preset", default: 0, min: 0, max: 3, integer: true, doc: "0 loop, 1 meandering river, 2 figure eight (double circulation), 3 rising spiral; ignored when x, y, z are given" },
    { key: "radius", default: 0.05, min: 0.01, max: 0.2, doc: "tube radius" },
    { key: "speed", default: 1, min: 0.1, max: 3, doc: "speed of the travelling pulses" },
    { key: "a", default: 0, min: -10, max: 10, doc: "free coefficient available to the expressions" },
    { key: "b", default: 0, min: -10, max: 10, doc: "free coefficient available to the expressions" },
    { key: "c", default: 0, min: -10, max: 10, doc: "free coefficient available to the expressions" },
  ],
  expr: [
    { key: "x", kind: "paramath", default: "", maxLength: 400, vars: ["t"], doc: "optional custom path x(t), t ∈ [0, 1]; give x, y and z together" },
    { key: "y", kind: "paramath", default: "", maxLength: 400, vars: ["t"], doc: "optional custom path y(t)" },
    { key: "z", kind: "paramath", default: "", maxLength: 400, vars: ["t"], doc: "optional custom path z(t)" },
  ],
  regions: [
    { id: "stream", doc: "the tube" },
    { id: "source", doc: "where the flow starts (open paths; for loops, an arbitrary start)" },
    { id: "sink", doc: "where the flow ends" },
  ],
  motionDoc: "pulses of light travel along the tube",
  generate({ count, rng, params, expr, seed }) {
    const b = new PointBuilder();
    const speed = params.speed!;
    const R = params.radius!;
    const preset = Math.round(params.preset!);
    const custom = (expr.x ?? "").trim() && (expr.y ?? "").trim() && (expr.z ?? "").trim();
    let path: (t: number) => V3 = (t) => presetPoint(preset, t);
    if (custom) {
      const fx = compileOrRepair(expr.x!, ["t"], "cos(t*tau)", seed);
      const fy = compileOrRepair(expr.y!, ["t"], "0", seed);
      const fz = compileOrRepair(expr.z!, ["t"], "sin(t*tau)", seed);
      if (fx.fellBack || fy.fellBack || fz.fellBack) b.warnings.push("invalid path expression replaced by a default");
      const scope = new Float64Array(fx.result.scopeSize);
      const sl = fx.result.slots;
      scope[sl.a!] = params.a!;
      scope[sl.b!] = params.b!;
      scope[sl.c!] = params.c!;
      scope[sl.n!] = count;
      path = (t) => {
        scope[sl.t!] = t;
        scope[sl.i!] = t;
        return [fx.result.fn!(scope), fy.result.fn!(scope), fz.result.fn!(scope)];
      };
    }
    // Arc-length table so particles are spread evenly along the path.
    const M = 512;
    const pts: V3[] = [];
    const cum = new Float64Array(M + 1);
    for (let k = 0; k <= M; k++) pts.push(path(k / M));
    for (let k = 1; k <= M; k++) cum[k] = cum[k - 1]! + Math.hypot(pts[k]![0] - pts[k - 1]![0], pts[k]![1] - pts[k - 1]![1], pts[k]![2] - pts[k - 1]![2]);
    const total = cum[M]! || 1;
    const atLen = (s: number): [V3, V3, number] => {
      let lo = 0,
        hi = M;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (cum[mid]! < s) lo = mid;
        else hi = mid;
      }
      const f = (s - cum[lo]!) / Math.max(1e-9, cum[hi]! - cum[lo]!);
      const p0 = pts[lo]!,
        p1 = pts[hi]!;
      const p: V3 = [p0[0] + (p1[0] - p0[0]) * f, p0[1] + (p1[1] - p0[1]) * f, p0[2] + (p1[2] - p0[2]) * f];
      return [p, [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], (lo + f) / M];
    };
    const motion = { type: "flow" as const, speed };
    const stream = b.region({ id: "stream", motion, colorRole: "primary" });
    const source = b.region({ id: "source", motion, colorRole: "accent" });
    const sink = b.region({ id: "sink", motion, colorRole: "glow" });
    const o = [0, 0, 0];
    for (let i = 0; i < count; i++) {
      const [p, tan, t] = atLen(rng.next() * total);
      // a bright core with a softer halo makes the tube read as a current, not a pipe
      const rr = rng.next() < 0.7 ? R * 0.55 : R;
      aroundTube(rng, p, tan, rr, o);
      const region = t < 0.06 ? source : t > 0.94 ? sink : stream;
      b.push(o[0]!, o[1]!, o[2]!, region, t, region === stream ? 1 : 1.2);
    }
    const out = b.build(count, rng);
    let ext = 0;
    for (const v of out.positions) ext = Math.max(ext, Math.abs(v));
    if (ext > 1.2 || ext < 0.5) {
      const s = 1 / (ext || 1);
      for (let k = 0; k < out.positions.length; k++) out.positions[k] = out.positions[k]! * s;
    }
    return out;
  },
};
