import { createRng } from "../util/rng";
import { allocate, parseLabels, PointBuilder } from "./helpers";
import type { ShapeDefinition } from "./types";

/** Data box: x ∈ [-0.9, 0.9], y and z ∈ [-0.62, 0.62]; axes sit just outside it. */
const BX = 0.9,
  BY = 0.62,
  AX = 1,
  AY = 0.72;

export const scatter: ShapeDefinition = {
  id: "scatter",
  title: "Scatter plot / data line",
  doc: "Data points as glowing dots (or soft clusters) in a 2D or 3D frame with axes, optionally joined in data order as a line. Data are x,y pairs (or x,y,z triples with dims = 3), each axis rescaled to fill the frame.",
  goodFor: ["a correlation", "a time series", "exponential vs linear growth", "an embedding cloud (with cluster_spread)", "measurements from an experiment", "labelled points such as 'king' and 'queen'"],
  params: [
    { key: "dims", default: 2, min: 2, max: 3, integer: true, doc: "2 = data are x,y pairs; 3 = x,y,z triples in a cube" },
    { key: "connect", default: 0, min: 0, max: 1, integer: true, doc: "1 = join the points in data order with a line" },
    { key: "point_size", default: 0.03, min: 0.01, max: 0.1, doc: "dot radius" },
    { key: "cluster_spread", default: 0.02, min: 0, max: 0.2, doc: "extra gaussian spread of each dot (clouds for embeddings)" },
  ],
  expr: [{ key: "labels", kind: "labels", default: "", maxLength: 2000, doc: "optional: one name = the series; several names 'A|B|…' = per-point labels in data order" }],
  data: { doc: "flat list x1, y1, x2, y2, … (or x, y, z triples when dims = 3), up to 300 points", minLength: 2, maxLength: 900 },
  regions: [
    { id: "points", doc: "all data points (an aggregate of point_i when per-point labels are given)" },
    { id: "point_{i}", doc: "data point i, only when several labels are given (one region per labelled point)", conditional: true },
    { id: "line", doc: "the connecting line (connect = 1)", conditional: true },
    { id: "axis", doc: "the axes with ticks" },
  ],
  motionDoc: "still",
  generate({ count, rng, params, expr, data }) {
    const b = new PointBuilder();
    const dims = params.dims! >= 2.5 ? 3 : 2;
    const connect = params.connect! >= 0.5;
    const size = params.point_size!;
    const spread = params.cluster_spread!;
    const labels = parseLabels(expr.labels);

    const vals = data.filter((v) => Number.isFinite(v));
    let pts: number[][] = [];
    for (let i = 0; i + dims <= vals.length && pts.length < 300; i += dims) pts.push(vals.slice(i, i + dims));
    if (pts.length === 0) {
      b.warnings.push("scatter without data; showing an illustrative noisy trend");
      const g = createRng("scatter:default");
      pts = Array.from({ length: 40 }, (_, i) => {
        const x = i / 39;
        return dims === 3 ? [x, 0.6 * x + 0.15 * g.normal(), g.normal() * 0.3] : [x, 0.6 * x + 0.15 * g.normal()];
      });
    }
    // Rescale each axis independently to the data box (a constant axis sits in the middle).
    const half = [BX, BY, BY];
    const mapped = pts.map((p) => [0, 0, 0]);
    for (let a = 0; a < dims; a++) {
      let lo = Infinity,
        hi = -Infinity;
      for (const p of pts) {
        lo = Math.min(lo, p[a]!);
        hi = Math.max(hi, p[a]!);
      }
      pts.forEach((p, i) => (mapped[i]![a] = hi > lo ? ((p[a]! - lo) / (hi - lo)) * 2 * half[a]! - half[a]! : 0));
    }

    const perPoint = labels.length >= 2;
    const pointsId = b.region({ id: "points", label: perPoint ? undefined : labels[0], motion: { type: "none", speed: 0 }, colorRole: "primary" });
    const pointRegion = mapped.map((_, i) =>
      perPoint && i < labels.length ? b.region({ id: `point_${i}`, label: labels[i], motion: { type: "none", speed: 0 }, colorRole: "accent", parent: "points" }) : pointsId,
    );
    const lineId = connect && mapped.length > 1 ? b.region({ id: "line", motion: { type: "none", speed: 0 }, colorRole: "secondary" }) : -1;
    const axisId = b.region({ id: "axis", motion: { type: "none", speed: 0 }, colorRole: "glow" });
    const [nPts, nLine, nAxis] = allocate(count, [lineId >= 0 ? 0.68 : 0.9, lineId >= 0 ? 0.22 : 0, 0.1]) as [number, number, number];

    const sigma = size * 0.45 + spread;
    const ptCounts = allocate(nPts, mapped.map(() => 1));
    mapped.forEach((p, i) => {
      for (let k = 0; k < ptCounts[i]!; k++) {
        // Gaussian dot truncated at 3σ: a bright core with a soft rim.
        let x = 0,
          y = 0,
          z = 0;
        do {
          x = rng.normal();
          y = rng.normal();
          z = rng.normal();
        } while (x * x + y * y + z * z > 9);
        b.push(p[0]! + x * sigma, p[1]! + y * sigma, p[2]! + z * (dims === 3 ? sigma : Math.min(sigma, size)), pointRegion[i]!, i / Math.max(1, mapped.length - 1), 1);
      }
    });
    if (lineId >= 0) {
      const lens = mapped.slice(1).map((q, i) => Math.hypot(q[0]! - mapped[i]![0]!, q[1]! - mapped[i]![1]!, q[2]! - mapped[i]![2]!));
      const total = lens.reduce((s, l) => s + l, 0) || 1;
      const segCounts = allocate(nLine, lens.map((l) => l + 1e-4));
      let acc = 0;
      lens.forEach((len, i) => {
        const p = mapped[i]!,
          q = mapped[i + 1]!;
        for (let k = 0; k < segCounts[i]!; k++) {
          const t = rng.next();
          const j = 0.004;
          b.push(p[0]! + (q[0]! - p[0]!) * t + rng.normal() * j, p[1]! + (q[1]! - p[1]!) * t + rng.normal() * j, p[2]! + (q[2]! - p[2]!) * t + rng.normal() * j, lineId, (acc + len * t) / total, 0.75);
        }
        acc += len;
      });
    }
    // Axes from the lower-left(-back) corner, with 5 ticks each.
    const corner = [-AX, -AY, dims === 3 ? -AY : 0];
    const axes: [number, number][] = dims === 3 ? [[0, 2 * AX], [1, 2 * AY], [2, 2 * AY]] : [[0, 2 * AX], [1, 2 * AY]];
    const axisCounts = allocate(nAxis, axes.map(([, len]) => len));
    axes.forEach(([a, len], ai) => {
      const nTick = Math.round(axisCounts[ai]! * 0.2);
      for (let k = 0; k < axisCounts[ai]!; k++) {
        const p = corner.slice();
        if (k < nTick) {
          // Tick: a short stub perpendicular to the axis.
          p[a] = p[a]! + (((k % 5) + 1) / 5) * len;
          const perp = a === 0 ? 1 : 0;
          p[perp] = p[perp]! - 0.035 * rng.next();
        } else p[a] = p[a]! + len * rng.next();
        b.push(p[0]! + rng.normal() * 0.003, p[1]! + rng.normal() * 0.003, p[2]! + rng.normal() * 0.003, axisId, 0, 0.8);
      }
    });
    return b.build(count, rng);
  },
};
