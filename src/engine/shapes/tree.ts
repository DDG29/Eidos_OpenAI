import { createRng } from "../util/rng";
import { allocate, normalizeExtent, PointBuilder } from "./helpers";
import type { ShapeDefinition } from "./types";

/** Segment budget: branches^depth explodes (4^9 ≈ 262k tips), so the deepest levels are thinned, then cut. */
const MAX_SEGMENTS = 6000;

interface Seg {
  p: [number, number, number];
  d: [number, number, number];
  u: [number, number, number];
  v: [number, number, number];
  len: number;
  r0: number;
  r1: number;
  level: number;
  tip: boolean;
}

function frame(d: readonly number[]): { u: [number, number, number]; v: [number, number, number] } {
  const ax = Math.abs(d[1]!) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  let ux = d[1]! * ax[2]! - d[2]! * ax[1]!,
    uy = d[2]! * ax[0]! - d[0]! * ax[2]!,
    uz = d[0]! * ax[1]! - d[1]! * ax[0]!;
  const l = Math.hypot(ux, uy, uz) || 1;
  ux /= l;
  uy /= l;
  uz /= l;
  return { u: [ux, uy, uz], v: [d[1]! * uz - d[2]! * uy, d[2]! * ux - d[0]! * uz, d[0]! * uy - d[1]! * ux] };
}

export const tree: ShapeDefinition = {
  id: "tree",
  title: "Branching tree",
  doc: "A 3D recursively branching tree: a trunk splitting into 2–4 branches per level, tapering with depth, optionally crowned with leaf clusters. Biological trees, phylogenies, decision trees, fractals, river tributaries (turn it upside down), dendrites, growth.",
  goodFor: ["a tree and photosynthesis", "a phylogenetic tree of life", "a decision tree", "fractal self-similarity", "a river basin (rotated 180°)", "neuron dendrites"],
  params: [
    { key: "depth", default: 6, min: 2, max: 9, integer: true, doc: "branching levels after the trunk (very deep, wide trees are thinned to ~6000 segments)" },
    { key: "branch_angle", default: 28, min: 5, max: 70, doc: "angle between a branch and its parent, in degrees" },
    { key: "decay", default: 0.72, min: 0.5, max: 0.9, doc: "length ratio child / parent" },
    { key: "branches", default: 2, min: 2, max: 4, integer: true, doc: "children per branch" },
    { key: "leaves", default: 1, min: 0, max: 1, integer: true, doc: "1 = leaf clusters at the branch tips" },
    { key: "asymmetry", default: 0.2, min: 0, max: 1, doc: "0 = perfectly regular, 1 = a dominant leader and irregular side branches" },
  ],
  expr: [],
  regions: [
    { id: "trunk", doc: "the trunk (first segment)" },
    { id: "branches", doc: "all branches and twigs" },
    { id: "leaves", doc: "leaf clusters around the tips (only when leaves = 1)", conditional: true },
  ],
  motionDoc: "branches and leaves sway very gently",
  generate({ count, rng, params }) {
    const depth = Math.round(params.depth!);
    const nb = Math.round(params.branches!);
    const angle = (params.branch_angle! * Math.PI) / 180;
    const decay = params.decay!;
    const asym = params.asymmetry!;
    const withLeaves = params.leaves! >= 0.5;
    const b = new PointBuilder();
    // Fixed structural seed: the same parameters always grow the same tree (stable across beats).
    const srng = createRng("tree:structure");

    const trunkDir: [number, number, number] = [0, 1, 0];
    const segs: Seg[] = [{ p: [0, 0, 0], d: trunkDir, ...frame(trunkDir), len: 1, r0: 0.075, r1: 0.06, level: 0, tip: true }];
    let level: Seg[] = [segs[0]!];
    let pruned = false;
    for (let L = 1; L <= depth && level.length; L++) {
      const expected = level.length * nb;
      const room = MAX_SEGMENTS - segs.length;
      if (room < level.length) {
        pruned = true;
        break;
      }
      const keep = expected > room ? (room - level.length) / (expected - level.length) : 1;
      if (keep < 1) pruned = true;
      const next: Seg[] = [];
      for (const par of level) {
        const base = L * 1.5708 + srng.next() * asym * 1.2;
        for (let k = 0; k < nb; k++) {
          // Child 0 is the leader: straighter and longer as asymmetry grows; the leader is never pruned.
          if (k > 0 && srng.next() > keep) continue;
          const lead = k === 0 && nb > 1;
          const jitter = (srng.next() - 0.5) * asym;
          const th = angle * (lead ? 1 - 0.55 * asym : 1 + 0.3 * asym) * (1 + 0.4 * jitter);
          const phi = base + (2 * Math.PI * k) / nb + jitter;
          const wx = Math.cos(phi) * par.u[0] + Math.sin(phi) * par.v[0],
            wy = Math.cos(phi) * par.u[1] + Math.sin(phi) * par.v[1],
            wz = Math.cos(phi) * par.u[2] + Math.sin(phi) * par.v[2];
          let dx = Math.cos(th) * par.d[0] + Math.sin(th) * wx,
            dy = Math.cos(th) * par.d[1] + Math.sin(th) * wy + 0.08,
            dz = Math.cos(th) * par.d[2] + Math.sin(th) * wz;
          const dl = Math.hypot(dx, dy, dz) || 1;
          dx /= dl;
          dy /= dl;
          dz /= dl;
          const d: [number, number, number] = [dx, dy, dz];
          const len = par.len * decay * (lead ? 1 + 0.25 * asym : 1 - 0.2 * asym) * (1 + 0.3 * asym * (srng.next() - 0.5));
          const r0 = Math.max(0.004, par.r1 * (lead ? 0.92 : 0.8));
          const child: Seg = {
            p: [par.p[0] + par.d[0] * par.len, par.p[1] + par.d[1] * par.len, par.p[2] + par.d[2] * par.len],
            d,
            ...frame(d),
            len,
            r0,
            r1: Math.max(0.003, r0 * 0.78),
            level: L,
            tip: true,
          };
          par.tip = false;
          next.push(child);
          segs.push(child);
        }
      }
      level = next;
    }
    if (pruned) b.warnings.push(`tree thinned to ${segs.length} segments (branches^depth is very large)`);

    const trunk = b.region({ id: "trunk", motion: { type: "none", speed: 0 }, colorRole: "secondary" });
    const branches = b.region({ id: "branches", motion: { type: "wave", speed: 0.3 }, colorRole: "primary" });
    const leaves = withLeaves ? b.region({ id: "leaves", motion: { type: "wave", speed: 0.3 }, colorRole: "accent" }) : -1;
    const tips = segs.filter((s) => s.tip && s.level > 0);
    const [nTrunk, nBranches, nLeaves] = allocate(count, withLeaves && tips.length ? [0.12, 0.5, 0.38] : [0.18, 0.82, 0]) as [number, number, number];
    const rest = segs.slice(1);
    const segCounts = allocate(nBranches, rest.map((s) => s.len * ((s.r0 + s.r1) / 2 + 0.012)));
    const maxLevel = Math.max(1, ...segs.map((s) => s.level));

    const tube = (s: Seg, n: number, region: number, mp: (t: number) => number) => {
      for (let k = 0; k < n; k++) {
        const t = rng.next();
        const r = s.r0 + (s.r1 - s.r0) * t;
        const a = rng.next() * Math.PI * 2;
        // Bias toward the surface so limbs read as cylinders, not lines.
        const rr = r * (0.55 + 0.45 * Math.sqrt(rng.next()));
        const c = Math.cos(a) * rr,
          sn = Math.sin(a) * rr;
        const l = t * s.len;
        b.push(
          s.p[0] + s.d[0] * l + s.u[0] * c + s.v[0] * sn,
          s.p[1] + s.d[1] * l + s.u[1] * c + s.v[1] * sn,
          s.p[2] + s.d[2] * l + s.u[2] * c + s.v[2] * sn,
          region,
          mp(t),
          r > 0.02 ? 1 : 0.85,
        );
      }
    };
    tube(segs[0]!, nTrunk, trunk, () => 0);
    rest.forEach((s, i) => tube(s, segCounts[i]!, branches, (t) => 0.1 + 0.22 * ((s.level - 1 + t) / maxLevel)));
    if (leaves >= 0) {
      const leafCounts = allocate(nLeaves, tips.map(() => 1));
      tips.forEach((s, i) => {
        // A soft cluster around the outer half of each tip twig.
        const sig = Math.max(0.025, s.len * 0.45);
        for (let k = 0; k < leafCounts[i]!; k++) {
          const t = 0.5 + 0.7 * rng.next();
          b.push(
            s.p[0] + s.d[0] * s.len * t + rng.normal() * sig,
            s.p[1] + s.d[1] * s.len * t + rng.normal() * sig * 0.8,
            s.p[2] + s.d[2] * s.len * t + rng.normal() * sig,
            leaves,
            0.32 + 0.1 * rng.next(),
            0.9,
          );
        }
      });
    }
    const out = b.build(count, rng);
    normalizeExtent(out.positions, 1, true);
    return out;
  },
};
