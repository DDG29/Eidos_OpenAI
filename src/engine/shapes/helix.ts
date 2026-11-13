import { aroundTube, PointBuilder } from "./helpers";
import type { ShapeDefinition } from "./types";

export const helix: ShapeDefinition = {
  id: "helix",
  title: "Helix (single or double)",
  doc: "One or two helical strands, optionally joined by base-pair rungs, that can unwind from one end. DNA, springs, solenoids, spiral timelines, alpha helices.",
  goodFor: ["DNA", "replication and transcription (unwind)", "springs and solenoids", "alpha helices", "spiral timelines"],
  params: [
    { key: "strands", default: 2, min: 1, max: 2, integer: true, doc: "number of strands" },
    { key: "turns", default: 3, min: 1, max: 10, doc: "full turns along the height" },
    { key: "radius", default: 0.35, min: 0.1, max: 0.6, doc: "helix radius" },
    { key: "height", default: 2, min: 0.5, max: 2, doc: "total height before normalization" },
    { key: "base_pairs", default: 1, min: 0, max: 1, integer: true, doc: "draw rungs between strands (1 = yes)" },
    { key: "unwind", default: 0, min: 0, max: 1, doc: "separates the strands from the top end (replication, transcription)" },
  ],
  expr: [],
  regions: [
    { id: "strand_a", doc: "first backbone" },
    { id: "strand_b", doc: "second backbone (double helix only)", conditional: true },
    { id: "base_pairs", doc: "rungs between the strands (double helix with base_pairs = 1)", conditional: true },
    { id: "unwound", doc: "the opened stretch when unwind > 0", conditional: true },
  ],
  motionDoc: "rotates slowly around its axis",
  generate({ count, rng, params }) {
    const strands = Math.round(params.strands!);
    const turns = params.turns!;
    const R = params.radius!;
    const H = params.height!;
    const pairs = strands === 2 && params.base_pairs! >= 0.5;
    const unwind = params.unwind!;
    const b = new PointBuilder();
    const rot = { type: "rotate" as const, speed: 0.25 };
    const sa = b.region({ id: "strand_a", motion: rot, colorRole: "primary" });
    const sb = strands === 2 ? b.region({ id: "strand_b", motion: rot, colorRole: "secondary" }) : sa;
    const bp = pairs ? b.region({ id: "base_pairs", motion: rot, colorRole: "accent" }) : -1;
    const uw = unwind > 0.01 ? b.region({ id: "unwound", motion: rot, colorRole: "glow" }) : -1;
    const phase = (150 / 180) * Math.PI; // major/minor groove offset
    const tube = 0.035 + R * 0.04;
    // Points along strand at parameter s ∈ [0,1] (0 = bottom).
    const strandPoint = (s: number, which: 0 | 1, out: number[]) => {
      const ang = s * turns * Math.PI * 2 + (which ? phase : 0);
      const open = unwind > 0 ? Math.max(0, (s - (1 - unwind)) / Math.max(unwind, 1e-3)) : 0;
      const sep = open * open * (R * 1.8);
      const rr = R + sep * 0.35;
      out[0] = Math.cos(ang) * rr + (which ? sep : -sep);
      out[1] = (s - 0.5) * H;
      out[2] = Math.sin(ang) * rr;
      return open;
    };
    const pairShare = pairs ? 0.24 : 0;
    const strandCount = Math.round((count * (1 - pairShare)) / strands);
    const p = [0, 0, 0],
      q = [0, 0, 0],
      t = [0, 0, 0],
      o = [0, 0, 0];
    for (let w = 0; w < strands; w++) {
      for (let k = 0; k < strandCount; k++) {
        const s = rng.next();
        const open = strandPoint(s, w as 0 | 1, p);
        strandPoint(Math.min(1, s + 0.002), w as 0 | 1, q);
        t[0] = q[0]! - p[0]!;
        t[1] = q[1]! - p[1]!;
        t[2] = q[2]! - p[2]!;
        aroundTube(rng, p, t, tube, o);
        b.push(o[0]!, o[1]!, o[2]!, open > 0.05 && uw >= 0 ? uw : w === 0 ? sa : sb, s);
      }
    }
    if (pairs) {
      const rungs = Math.max(4, Math.round(turns * 10));
      const per = Math.max(1, Math.round((count * pairShare) / rungs));
      for (let r = 0; r < rungs; r++) {
        const s = (r + 0.5) / rungs;
        const openA = strandPoint(s, 0, p);
        strandPoint(s, 1, q);
        if (openA > 0.15) continue; // rungs are broken where the strands opened
        for (let k = 0; k < per; k++) {
          const u = 0.08 + rng.next() * 0.84;
          const j = 0.012;
          b.push(p[0]! + (q[0]! - p[0]!) * u + rng.normal() * j, p[1]! + (q[1]! - p[1]!) * u + rng.normal() * j, p[2]! + (q[2]! - p[2]!) * u + rng.normal() * j, bp, s, 0.9);
        }
      }
    }
    const out = b.build(count, rng);
    // Normalize so the height spans [-1, 1] while keeping proportions.
    let ext = 0;
    for (let i = 0; i < out.positions.length; i++) ext = Math.max(ext, Math.abs(out.positions[i]!));
    const s = ext > 0 ? 1 / ext : 1;
    for (let i = 0; i < out.positions.length; i++) out.positions[i] = out.positions[i]! * s;
    return out;
  },
};
