import { normalizeExtent, PointBuilder } from "./helpers";
import type { ShapeDefinition } from "./types";

export const torusKnot: ShapeDefinition = {
  id: "torusKnot",
  title: "Torus knot",
  doc: "A tube that winds p times around a ring axis and q times through its hole, drawn facing the viewer. Topology, entanglement, complex cycles, 'everything is connected'. p=2, q=3 is the trefoil; coprime p, q give one knot, otherwise interlinked loops.",
  goodFor: ["topology and knots", "entanglement", "a complex cycle", "connection and interdependence", "a trefoil logo-like emblem"],
  params: [
    { key: "p", default: 2, min: 1, max: 7, integer: true, doc: "windings around the ring axis" },
    { key: "q", default: 3, min: 1, max: 9, integer: true, doc: "windings through the hole (lobes seen from the front)" },
    { key: "tube", default: 0.12, min: 0.02, max: 0.3, doc: "tube radius (canonical units)" },
  ],
  expr: [],
  regions: [{ id: "knot", doc: "the whole knotted tube" }],
  motionDoc: "rotates slowly around the vertical axis",
  generate({ count, rng, params }) {
    const p = Math.round(params.p!);
    const q = Math.round(params.q!);
    const tubeParam = params.tube!;
    const b = new PointBuilder();
    const knot = b.region({ id: "knot", motion: { type: "rotate", speed: 0.15 }, colorRole: "primary" });
    // Centerline: the classic (p,q) torus knot on a torus of radii 2 and 1 (max radius 3), scaled to ~1 below.
    const K = 1024 * Math.max(p, q);
    const cx = new Float64Array(K + 1),
      cy = new Float64Array(K + 1),
      cz = new Float64Array(K + 1),
      cum = new Float64Array(K + 1);
    const S = 1 / 3;
    for (let k = 0; k <= K; k++) {
      const t = (k / K) * Math.PI * 2;
      const rr = 2 + Math.cos(q * t);
      cx[k] = rr * Math.cos(p * t) * S;
      cy[k] = rr * Math.sin(p * t) * S;
      cz[k] = -Math.sin(q * t) * S;
      if (k > 0) cum[k] = cum[k - 1]! + Math.hypot(cx[k]! - cx[k - 1]!, cy[k]! - cy[k - 1]!, cz[k]! - cz[k - 1]!);
    }
    const total = cum[K]!;
    const tube = tubeParam * 0.9;
    let seg = 0;
    for (let k = 0; k < count; k++) {
      // Stratified arc-length sampling keeps the tube evenly filled however tight the knot is.
      const s = ((k + rng.next()) / count) * total;
      while (seg < K - 1 && cum[seg + 1]! < s) seg++;
      const f = (s - cum[seg]!) / Math.max(cum[seg + 1]! - cum[seg]!, 1e-12);
      const x = cx[seg]! + (cx[seg + 1]! - cx[seg]!) * f,
        y = cy[seg]! + (cy[seg + 1]! - cy[seg]!) * f,
        z = cz[seg]! + (cz[seg + 1]! - cz[seg]!) * f;
      let tx = cx[seg + 1]! - cx[seg]!,
        ty = cy[seg + 1]! - cy[seg]!,
        tz = cz[seg + 1]! - cz[seg]!;
      const tl = Math.hypot(tx, ty, tz) || 1;
      tx /= tl;
      ty /= tl;
      tz /= tl;
      // Frame: N = T × Z is never degenerate because the knot always advances around the Z axis (p ≥ 1).
      let nx = ty,
        ny = -tx;
      const nl = Math.hypot(nx, ny) || 1;
      nx /= nl;
      ny /= nl;
      const bx = ty * 0 - tz * ny,
        by = tz * nx - tx * 0,
        bz = tx * ny - ty * nx;
      const ang = rng.next() * Math.PI * 2;
      // 70% on the skin for a crisp tubular silhouette, 30% filling the core.
      const rad = tube * (rng.next() < 0.7 ? 1 - 0.08 * rng.next() : Math.sqrt(rng.next()));
      const c = Math.cos(ang) * rad,
        sn = Math.sin(ang) * rad;
      b.push(x + nx * c + bx * sn, y + ny * c + by * sn, z + bz * sn, knot, s / total);
    }
    const out = b.build(count, rng);
    normalizeExtent(out.positions, 1);
    return out;
  },
};
