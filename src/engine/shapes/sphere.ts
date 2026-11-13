import { createNoise3 } from "../util/noise";
import { PointBuilder } from "./helpers";
import type { ShapeDefinition } from "./types";

export const sphere: ShapeDefinition = {
  id: "sphere",
  title: "Volumetric sphere",
  doc: "A glowing ball of particles, denser toward the center. Reads as a nucleus, atom, planet, droplet or 'one unit'.",
  goodFor: ["atomic nuclei", "planets and stars", "a single cell or droplet", "a blastema", "'one unit' of something"],
  params: [
    { key: "radius", default: 1, min: 0.2, max: 1, doc: "outer radius", scalesExtent: true },
    { key: "noise", default: 0.05, min: 0, max: 0.5, doc: "surface roughness" },
    { key: "core_density", default: 1.5, min: 0.5, max: 4, doc: "how strongly particles concentrate toward the center" },
  ],
  expr: [],
  regions: [
    { id: "core", doc: "inner 30% of the radius" },
    { id: "body", doc: "the rest of the ball" },
  ],
  motionDoc: "slow pulse",
  generate({ count, rng, params, seed }) {
    const R = params.radius!;
    const roughness = params.noise!;
    const exp = 1 / (3 * (params.core_density! / 1.5));
    const nz = createNoise3(`sphere:${seed}`);
    const b = new PointBuilder();
    const core = b.region({ id: "core", motion: { type: "pulse", speed: 0.5 }, colorRole: "glow" });
    const body = b.region({ id: "body", motion: { type: "pulse", speed: 0.5 }, colorRole: "primary" });
    const d = [0, 0, 0];
    for (let i = 0; i < count; i++) {
      rng.dir(d);
      const u = Math.pow(rng.next(), exp);
      const n = 1 + roughness * nz(d[0]! * 2.2, d[1]! * 2.2, d[2]! * 2.2);
      const r = R * u * n;
      b.push(d[0]! * r, d[1]! * r, d[2]! * r, u < 0.3 ? core : body, u);
    }
    return b.build(count, rng);
  },
};
