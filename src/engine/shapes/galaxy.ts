import { allocate, clamp, PointBuilder } from "./helpers";
import type { ShapeDefinition } from "./types";

export const galaxy: ShapeDefinition = {
  id: "galaxy",
  title: "Spiral galaxy",
  doc: "A flat spiral disc in the horizontal (XZ) plane: a bright bulge, logarithmic arms with clumps and a faint halo; inner parts turn faster. Galaxies, hurricanes, whirlpools, 'many things organized', spread from a center. Use a top_down or high camera to see the arms.",
  goodFor: ["a spiral galaxy", "a hurricane seen from above", "a whirlpool", "many things self-organizing", "diffusion from a center"],
  params: [
    { key: "arms", default: 2, min: 1, max: 6, integer: true, doc: "number of spiral arms" },
    { key: "twist", default: 3, min: 0.5, max: 8, doc: "how tightly the arms wind (about twist/4 full turns from the bulge to the rim)" },
    { key: "core", default: 0.18, min: 0.05, max: 0.5, doc: "radius of the bright central bulge" },
    { key: "spread", default: 0.3, min: 0.05, max: 1, doc: "scatter of stars around each arm (1 = almost a plain disc)" },
    { key: "thickness", default: 0.08, min: 0.01, max: 0.3, doc: "vertical thickness of the disc" },
  ],
  expr: [],
  regions: [
    { id: "core", doc: "the bright central bulge" },
    { id: "arms", doc: "the spiral arms and the disc between them" },
    { id: "halo", doc: "sparse spherical halo around the disc" },
  ],
  motionDoc: "differential rotation: the inside turns faster than the rim",
  generate({ count, rng, params }) {
    const arms = Math.round(params.arms!);
    const twist = params.twist!;
    const coreR = params.core!;
    const spread = params.spread!;
    const thick = params.thickness!;
    const b = new PointBuilder();
    const mot = { type: "differential" as const, speed: 0.35 };
    const core = b.region({ id: "core", motion: mot, colorRole: "glow" });
    const arm = b.region({ id: "arms", motion: mot, colorRole: "primary" });
    const halo = b.region({ id: "halo", motion: mot, colorRole: "secondary" });
    const gauss = () => clamp(rng.normal(), -3, 3);
    const [nCore, nArms, nHalo] = allocate(count, [0.08 + coreR * 0.55, 0.84 - coreR * 0.3, 0.07]);
    // Bulge: exponential radial profile, slightly flattened.
    const d = [0, 0, 0];
    for (let k = 0; k < nCore!; k++) {
      rng.dir(d);
      const r = Math.min(coreR * 1.8, -coreR * 0.5 * Math.log(1 - rng.next() * 0.98));
      b.push(d[0]! * r, d[1]! * r * 0.62, d[2]! * r, core, r);
    }
    // Arms: θ(r) follows a log spiral normalised so the full winding from bulge to rim is twist·π/2.
    const r0 = Math.max(coreR * 0.7, 0.04);
    const lnSpan = Math.log(1 / r0);
    const wind = twist * (Math.PI / 2);
    const dn = 1 / arms;
    let k = 0;
    while (k < nArms!) {
      // r = u^0.85 makes the surface density fall off ~1/r: bright inside, arms still reach the rim.
      const r = r0 + (1 - r0) * Math.pow(rng.next(), 0.85);
      const a = rng.int(arms);
      // Scatter: a tight ridge plus a wider inter-arm haze, both growing with `spread` (sigma in distance units).
      const wide = rng.next() < 0.3 + spread * 0.4;
      // Clumpy star-forming knots: thin the ridge where a deterministic ripple along the arm is low.
      const knot = Math.sin(r * 31 + a * 1.7) * Math.sin(r * 13.3 + a * 4.1);
      if (!wide && knot < -0.2 && rng.next() < 0.8) continue;
      const sigD = wide ? spread * (0.15 + 0.35 * r) : spread * (0.05 + 0.1 * r);
      const th = a * dn * Math.PI * 2 + (wind * Math.log(r / r0)) / lnSpan + (gauss() * sigD) / r;
      const rr = r + gauss() * sigD * 0.35;
      const h = thick * (1 - 0.6 * r) + 0.008;
      b.push(Math.cos(th) * rr, gauss() * h * 0.5, Math.sin(th) * rr, arm, clamp(r, 0, 1), wide ? 0.9 : 1.05);
      k++;
    }
    // Halo: sparse, roughly spherical, falls off with radius.
    for (let k = 0; k < nHalo!; k++) {
      rng.dir(d);
      const r = 0.15 + 0.9 * Math.pow(rng.next(), 0.7);
      b.push(d[0]! * r, d[1]! * r * 0.55, d[2]! * r, halo, r, 0.8);
    }
    return b.build(count, rng);
  },
};
