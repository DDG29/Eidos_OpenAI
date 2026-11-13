import { createNoise3, fbm3 } from "../util/noise";
import { PointBuilder } from "./helpers";
import type { ShapeDefinition } from "./types";

export const nebula: ShapeDefinition = {
  id: "nebula",
  title: "Noise nebula",
  doc: "A soft cloud of particles with filaments, shaped by fractal noise. Ambience, chaos before understanding, gas, clouds, uncertainty.",
  goodFor: ["the initial chaos", "gas and dust clouds", "uncertainty", "a calm ambient background", "molecules floating in air"],
  params: [
    { key: "scale", default: 1.2, min: 0.3, max: 3, doc: "noise frequency (higher = smaller clumps)" },
    { key: "density_contrast", default: 0.6, min: 0, max: 1, doc: "how clumpy the cloud is" },
    { key: "filaments", default: 0.5, min: 0, max: 1, doc: "share of particles in thin filaments" },
  ],
  expr: [],
  regions: [
    { id: "cloud", doc: "the diffuse body" },
    { id: "filaments", doc: "thin bright strands" },
  ],
  motionDoc: "gentle thermal drift",
  generate({ count, rng, params, seed }) {
    const nz = createNoise3(`nebula:${seed}`);
    const sc = params.scale!;
    const contrast = params.density_contrast!;
    const filShare = params.filaments! * 0.45;
    const b = new PointBuilder();
    const cloud = b.region({ id: "cloud", motion: { type: "thermal", speed: 0.1 }, colorRole: "secondary" });
    const fil = b.region({ id: "filaments", motion: { type: "thermal", speed: 0.1 }, colorRole: "accent" });
    const p = [0, 0, 0];
    let guard = 0;
    const filTarget = Math.round(count * filShare);
    let nFil = 0;
    while (b.length < count && guard < count * 60) {
      guard++;
      rng.dir(p);
      const r = Math.pow(rng.next(), 0.55);
      const x = p[0]! * r,
        y = p[1]! * r * 0.72,
        z = p[2]! * r;
      const f = fbm3(nz, x * sc + 3.1, y * sc - 1.7, z * sc + 0.4, 3);
      const falloff = 1 - r * r * 0.6;
      if (nFil < filTarget && Math.abs(f) < 0.035) {
        b.push(x, y, z, fil, r, 1.15);
        nFil++;
        continue;
      }
      const dens = (1 - contrast) * 0.7 + contrast * Math.max(0, f + 0.3) * 2.6;
      if (rng.next() < dens * falloff) b.push(x, y, z, cloud, r);
    }
    return b.build(count, rng);
  },
};
