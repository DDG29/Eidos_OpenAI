import { clamp, PointBuilder } from "./helpers";
import type { ShapeDefinition } from "./types";

interface Well {
  x: number;
  z: number;
  m: number;
}

const DEFAULT_WELLS: Well[][] = [
  [],
  [{ x: 0, z: 0, m: 1 }],
  [
    { x: -0.42, z: 0.05, m: 1 },
    { x: 0.45, z: -0.1, m: 0.6 },
  ],
  [
    { x: -0.45, z: 0.3, m: 1 },
    { x: 0.45, z: 0.3, m: 0.75 },
    { x: 0, z: -0.45, m: 0.5 },
  ],
];

const MAX_WELLS = 6;

export const grid: ShapeDefinition = {
  id: "grid",
  title: "Spacetime grid with wells",
  doc: "A square mesh of lines in the horizontal (XZ) plane that sinks into smooth funnels around masses. Gravity and spacetime curvature, potential wells, energy landscapes, any 'surface that deforms'. Place and weigh wells with data.",
  goodFor: ["gravity bending spacetime", "a potential well", "an energy landscape with minima", "a black hole's funnel", "how a mass deforms a surface"],
  params: [
    { key: "resolution", default: 40, min: 10, max: 80, integer: true, doc: "grid lines per side" },
    { key: "wells", default: 1, min: 0, max: 3, integer: true, doc: "number of wells at preset positions (ignored when data is given)" },
    { key: "depth", default: 0.6, min: 0, max: 1.5, doc: "depth of a unit-mass well (deep stacks are softly limited)" },
    { key: "spread", default: 0.25, min: 0.05, max: 0.8, doc: "width of each well's funnel" },
  ],
  expr: [],
  data: {
    doc: "optional wells as triples [x1, z1, m1, x2, z2, m2, …]: position in [-1, 1] and mass (negative = hill); overrides `wells`, up to 6",
    minLength: 0,
    maxLength: MAX_WELLS * 3,
  },
  regions: [
    { id: "grid", doc: "the mesh lines" },
    { id: "well_{i}", doc: "the stretch of mesh near each well (one per well; none when wells = 0 and no data)", conditional: true },
  ],
  motionDoc: "still (pair with a wave layer for ripples)",
  generate({ count, rng, params, data }) {
    const L = Math.round(params.resolution!);
    const depth = params.depth!;
    const spread = params.spread!;
    let wells: Well[] = [];
    for (let i = 0; i + 2 < data.length && wells.length < MAX_WELLS; i += 3) {
      const [x, z, m] = [data[i]!, data[i + 1]!, data[i + 2]!];
      if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(m)) continue;
      wells.push({ x: clamp(x, -1, 1), z: clamp(z, -1, 1), m: clamp(m, -2, 2) });
    }
    if (wells.length === 0) wells = DEFAULT_WELLS[clamp(Math.round(params.wells!), 0, 3)]!;
    // y = −Σ mᵢ·depth / (1 + (dᵢ/spread)²), softly limited past 0.9 so stacked wells stay in canonical space.
    const height = (x: number, z: number) => {
      let y = 0;
      for (const w of wells) {
        const dx = x - w.x,
          dz = z - w.z;
        y -= (w.m * depth) / (1 + (dx * dx + dz * dz) / (spread * spread));
      }
      const a = Math.abs(y);
      return a <= 0.9 ? y : Math.sign(y) * (0.9 + 0.5 * Math.tanh((a - 0.9) / 0.5));
    };
    const b = new PointBuilder();
    const still = { type: "none" as const, speed: 0 };
    const gridReg = b.region({ id: "grid", motion: still, colorRole: "primary" });
    const wellRegs = wells.map((_, i) => b.region({ id: `well_${i}`, motion: still, colorRole: i % 2 ? "glow" : "accent" }));
    const spacing = 2 / (L - 1);
    // Mesh points within this radius of a well belong to it; ≥ 0.6·spacing guarantees every well catches a line.
    const wellR = Math.max(spread * 1.2, spacing * 0.6);
    // Each line is resampled by 3D arc length so the steep funnel walls stay as dense as the flat parts.
    const K = 160;
    const lineLen = new Float64Array(2 * L);
    const cum = new Float64Array(2 * L * (K + 1));
    const ys = new Float64Array(2 * L * (K + 1));
    let total = 0;
    for (let l = 0; l < 2 * L; l++) {
      const fixed = -1 + (l % L) * spacing;
      const alongX = l < L;
      let acc = 0;
      let px = 0,
        py = 0,
        pz = 0;
      for (let k = 0; k <= K; k++) {
        const t = -1 + (2 * k) / K;
        const x = alongX ? t : fixed,
          z = alongX ? fixed : t;
        const y = height(x, z);
        if (k > 0) acc += Math.hypot(x - px, y - py, z - pz);
        cum[l * (K + 1) + k] = acc;
        ys[l * (K + 1) + k] = y;
        px = x;
        py = y;
        pz = z;
      }
      lineLen[l] = acc;
      total += acc;
    }
    let minY = 0,
      maxY = 0;
    for (let i = 0; i < ys.length; i++) {
      minY = Math.min(minY, ys[i]!);
      maxY = Math.max(maxY, ys[i]!);
    }
    const yShift = -(minY + maxY) / 2;
    const yRange = Math.max(maxY - minY, 1e-6);
    let acc = 0;
    let assigned = 0;
    for (let l = 0; l < 2 * L; l++) {
      acc += lineLen[l]!;
      const target = Math.round((acc / total) * count);
      const n = target - assigned;
      assigned = target;
      const fixed = -1 + (l % L) * spacing;
      const alongX = l < L;
      const base = l * (K + 1);
      const len = lineLen[l]!;
      let seg = 0;
      for (let k = 0; k < n; k++) {
        const s = ((k + rng.next()) / n) * len;
        while (seg < K - 1 && cum[base + seg + 1]! < s) seg++;
        const f = (s - cum[base + seg]!) / Math.max(cum[base + seg + 1]! - cum[base + seg]!, 1e-12);
        const t = -1 + (2 * (seg + f)) / K;
        const x = alongX ? t : fixed,
          z = alongX ? fixed : t;
        const y = height(x, z);
        let reg = gridReg;
        for (let w = 0; w < wells.length; w++) {
          const ww = wells[w]!;
          if (Math.hypot(x - ww.x, z - ww.z) < wellR) {
            reg = wellRegs[w]!;
            break;
          }
        }
        const j = 0.0025;
        b.push(x + rng.normal() * j, y + yShift + rng.normal() * j, z + rng.normal() * j, reg, (maxY - y) / yRange);
      }
    }
    return b.build(count, rng);
  },
};
