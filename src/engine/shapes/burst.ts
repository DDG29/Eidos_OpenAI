import { PointBuilder } from "./helpers";
import type { ShapeDefinition } from "./types";

export const burst: ShapeDefinition = {
  id: "burst",
  title: "Radial burst",
  doc: "A bright core with rays of light shooting outward in every direction. Emphasis, a sudden insight, an explosion, the Big Bang, an exothermic reaction, the arrival of light.",
  goodFor: ["a hook moment of astonishment", "the Big Bang", "an explosion or exothermic reaction", "sunlight arriving", "an 'aha' moment", "a cut in DNA (small, placed on the site)"],
  params: [
    { key: "rays", default: 64, min: 8, max: 256, integer: true, doc: "number of rays" },
    { key: "length", default: 1, min: 0.3, max: 1, doc: "ray length (overall size)", scalesExtent: true },
    { key: "core", default: 0.12, min: 0.02, max: 0.4, doc: "core radius" },
    { key: "randomness", default: 0.3, min: 0, max: 1, doc: "irregularity of ray directions and lengths" },
  ],
  expr: [],
  regions: [
    { id: "core", doc: "the bright center" },
    { id: "rays", doc: "the rays" },
  ],
  motionDoc: "pulses",
  generate({ count, rng, params }) {
    const b = new PointBuilder();
    const nRays = Math.round(params.rays!);
    const L = params.length!;
    const core = params.core!;
    const rnd = params.randomness!;
    const pulse = { type: "pulse" as const, speed: 0.8 };
    const coreR = b.region({ id: "core", motion: pulse, colorRole: "glow" });
    const raysR = b.region({ id: "rays", motion: pulse, colorRole: "accent" });
    // Ray directions on a Fibonacci sphere, jittered by `randomness`.
    const dirs: [number, number, number, number][] = [];
    const ga = Math.PI * (3 - Math.sqrt(5));
    for (let k = 0; k < nRays; k++) {
      const y = 1 - (2 * (k + 0.5)) / nRays;
      const r = Math.sqrt(1 - y * y);
      let d: [number, number, number] = [Math.cos(ga * k) * r, y, Math.sin(ga * k) * r];
      if (rnd > 0) {
        const j = [0, 0, 0];
        rng.dir(j);
        d = [d[0] + j[0]! * rnd * 0.35, d[1] + j[1]! * rnd * 0.35, d[2] + j[2]! * rnd * 0.35];
        const l = Math.hypot(...d) || 1;
        d = [d[0] / l, d[1] / l, d[2] / l];
      }
      const len = L * (1 - rnd * 0.55 * rng.next());
      dirs.push([d[0], d[1], d[2], len]);
    }
    const nCore = Math.round(count * 0.32);
    const p = [0, 0, 0];
    for (let i = 0; i < nCore; i++) {
      rng.dir(p);
      const r = core * Math.pow(rng.next(), 0.8);
      b.push(p[0]! * r, p[1]! * r, p[2]! * r, coreR, r / core, 1.15);
    }
    for (let i = nCore; i < count; i++) {
      const d = dirs[rng.int(nRays)]!;
      // denser near the core, thinning toward the tips like a streak of light
      const t = core + (d[3] - core) * Math.pow(rng.next(), 1.6);
      const w = 0.006 + 0.012 * (1 - t / Math.max(d[3], 1e-3));
      b.push(d[0] * t + rng.normal() * w, d[1] * t + rng.normal() * w, d[2] * t + rng.normal() * w, raysR, t / Math.max(d[3], 1e-3));
    }
    return b.build(count, rng);
  },
};
