import { clamp, PointBuilder } from "./helpers";
import type { ShapeDefinition } from "./types";

const SOURCES: [number, number][][] = [
  [[0, 0]],
  [
    [-0.32, 0],
    [0.32, 0],
  ],
  [
    [0, -0.36],
    [-0.31, 0.18],
    [0.31, 0.18],
  ],
];

export const wave: ShapeDefinition = {
  id: "wave",
  title: "Wave surface",
  doc: "A circular water-like surface (horizontal XZ disc drawn as a mesh) rippling out from 1–3 point sources; with 2–3 sources the ripples interfere into bright and calm bands. Mechanical waves, sound, light, interference, superposition, tides.",
  goodFor: ["ripples on a pond", "two-slit interference", "sound spreading from a speaker", "superposition of waves", "tides and swells"],
  params: [
    { key: "sources", default: 1, min: 1, max: 3, integer: true, doc: "number of point sources (2 = classic interference)" },
    { key: "wavelength", default: 0.25, min: 0.05, max: 1, doc: "distance between crests" },
    { key: "amplitude", default: 0.12, min: 0, max: 0.4, doc: "crest height at the source" },
    { key: "damping", default: 0.8, min: 0, max: 3, doc: "how fast the ripples fade with distance" },
    { key: "resolution", default: 120, min: 40, max: 220, integer: true, doc: "mesh lines per side (capped by particle count)" },
  ],
  expr: [],
  regions: [
    { id: "surface", doc: "the rippling surface" },
    { id: "source_{i}", doc: "the glowing bead at each point source" },
  ],
  motionDoc: "the surface swells, more where the waves are strong",
  generate({ count, rng, params }) {
    const nSrc = clamp(Math.round(params.sources!), 1, 3);
    const lambda = params.wavelength!;
    const amp = params.amplitude!;
    const damping = params.damping!;
    const srcs = SOURCES[nSrc - 1]!;
    const k = (Math.PI * 2) / lambda;
    // Snapshot height (Σ cosines) and the local amplitude of the standing pattern |Σ A·e^{ikd}| (≈0 on nodal lines).
    const sample = (x: number, z: number, out: [number, number]) => {
      let h = 0,
        re = 0,
        im = 0;
      for (const [sx, sz] of srcs) {
        const d = Math.hypot(x - sx, z - sz);
        const env = amp * Math.exp(-damping * d);
        h += env * Math.cos(k * d);
        re += env * Math.cos(k * d);
        im += env * Math.sin(k * d);
      }
      out[0] = h;
      out[1] = Math.hypot(re, im);
    };
    const b = new PointBuilder();
    const wav = { type: "wave" as const, speed: 0.6 };
    const surf = b.region({ id: "surface", motion: wav, colorRole: "primary" });
    const srcRegs = srcs.map((_, i) => b.region({ id: `source_${i}`, motion: { type: "pulse" as const, speed: 0.8 }, colorRole: "glow" }));
    const srcCount = Math.round(count * 0.012);
    const meshCount = count - srcCount * nSrc;
    // Lines per side: enough points per line (≥ 1.5·L) that each mesh line reads as a line, not dots.
    const L = Math.max(8, Math.min(Math.round(params.resolution!), Math.floor(Math.sqrt(meshCount / 2.4))));
    // Lines are clipped to the unit disc; each line's share is proportional to its chord length.
    const chords: number[] = [];
    let total = 0;
    for (let l = 0; l < L; l++) {
      const c = -1 + ((l + 0.5) * 2) / L;
      const half = Math.sqrt(Math.max(0, 1 - c * c));
      chords.push(half);
      total += 2 * half * 2;
    }
    const hv: [number, number] = [0, 0];
    // Crests get up to 1.7× the density of troughs (0.3×) so the ripple rings also read from straight above:
    // per line, a weight table over K knots is inverted (stratified inverse-CDF), then the height is exact.
    const K = Math.max(128, Math.min(1024, Math.ceil((2 / lambda) * 12)));
    const cw = new Float64Array(K + 1);
    let assigned = 0,
      acc = 0;
    for (let dir = 0; dir < 2; dir++)
      for (let l = 0; l < L; l++) {
        const c = -1 + ((l + 0.5) * 2) / L;
        const half = chords[l]!;
        acc += 2 * half;
        const target = Math.round((acc / total) * meshCount);
        const n = target - assigned;
        assigned = target;
        if (n <= 0) continue;
        let prevW = 0;
        for (let k = 0; k <= K; k++) {
          const t = -half + (2 * half * k) / K;
          sample(dir ? c : t, dir ? t : c, hv);
          const w = 1 + 0.7 * clamp(hv[0] / (hv[1] + 0.15 * amp + 1e-9), -1, 1);
          cw[k] = k === 0 ? 0 : cw[k - 1]! + (w + prevW) / 2;
          prevW = w;
        }
        const W = cw[K]!;
        let seg = 0;
        for (let j = 0; j < n; j++) {
          const target = ((j + rng.next()) / n) * W;
          while (seg < K - 1 && cw[seg + 1]! < target) seg++;
          const f = (target - cw[seg]!) / Math.max(cw[seg + 1]! - cw[seg]!, 1e-12);
          const t = -half + (2 * half * (seg + f)) / K;
          const x = dir ? c : t,
            z = dir ? t : c;
          sample(x, z, hv);
          // motionParam: local amplitude in units of the shader's swell (0.12), so the swell matches the ripple.
          b.push(x, hv[0], z, surf, Math.min(1, hv[1] / 0.12));
        }
      }
    const d = [0, 0, 0];
    srcs.forEach(([sx, sz], i) => {
      sample(sx, sz, hv);
      const r = 0.035;
      for (let j = 0; j < srcCount; j++) {
        rng.dir(d);
        const rr = r * Math.cbrt(rng.next());
        b.push(sx + d[0]! * rr, hv[0] + d[1]! * rr + r * 0.6, sz + d[2]! * rr, srcRegs[i]!, 1, 1.2);
      }
    });
    return b.build(count, rng);
  },
};
