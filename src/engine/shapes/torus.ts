import { PointBuilder } from "./helpers";
import type { ShapeDefinition } from "./types";

// The ring stands facing the camera (axis ≈ +Z), leaning back 20° so the default views read it as a donut.
const LEAN = (20 * Math.PI) / 180;
const CL = Math.cos(LEAN),
  SL = Math.sin(LEAN);

export const torus: ShapeDefinition = {
  id: "torus",
  title: "Torus",
  doc: "A donut-shaped ring standing toward the viewer, as a hollow skin or a filled volume. Rings, magnetic field loops, cycles, closed processes, topological doughnuts.",
  goodFor: ["a ring or loop", "a magnetic confinement ring (tokamak)", "a cycle that repeats", "a topological doughnut", "a frame around something"],
  params: [
    { key: "major", default: 0.75, min: 0.3, max: 1, doc: "radius of the ring (center of the tube)", scalesExtent: true },
    { key: "minor", default: 0.22, min: 0.02, max: 0.5, doc: "radius of the tube" },
    { key: "fill", default: 0.2, min: 0, max: 1, doc: "share of particles inside the tube (0 = only the skin, 1 = solid volume)" },
  ],
  expr: [],
  regions: [{ id: "ring", doc: "the whole torus" }],
  motionDoc: "rotates slowly around the vertical axis",
  generate({ count, rng, params }) {
    const R = params.major!;
    const r = params.minor!;
    const fill = params.fill!;
    const b = new PointBuilder();
    const ring = b.region({ id: "ring", motion: { type: "rotate", speed: 0.2 }, colorRole: "primary" });
    for (let k = 0; k < count; k++) {
      const inside = rng.next() < fill;
      // Cross-section radius: skin points keep a hair of depth; volume points are uniform over the disc.
      const rho = inside ? r * Math.sqrt(rng.next()) : r * (1 - 0.06 * rng.next());
      // Area/volume element ∝ (R + rho·cosθ): rejection-sample θ so the outer side is not under-filled.
      let th = 0;
      for (let tries = 0; tries < 16; tries++) {
        th = rng.next() * Math.PI * 2;
        if (rng.next() * (R + rho) <= R + rho * Math.cos(th)) break;
      }
      const ph = rng.next() * Math.PI * 2;
      const w = R + rho * Math.cos(th);
      const x = w * Math.cos(ph),
        y = w * Math.sin(ph),
        z = rho * Math.sin(th);
      b.push(x, y * CL - z * SL, y * SL + z * CL, ring, ph / (Math.PI * 2));
    }
    return b.build(count, rng);
  },
};
