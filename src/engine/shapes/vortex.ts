import { createNoise3 } from "../util/noise";
import { allocate, PointBuilder } from "./helpers";
import type { ShapeDefinition } from "./types";

export const vortex: ShapeDefinition = {
  id: "vortex",
  title: "Accretion disk and funnel",
  doc: "A swirling disk with spiral streaks around a dark center (a sparse sphere outlining the shadow), a bright photon ring at its inner edge, a funnel plunging below and optional polar jets. Black holes, drains and whirlpools, tornadoes, cyclones, attractors.",
  goodFor: ["a black hole and its accretion disk", "a whirlpool or bathtub drain", "a tornado or hurricane eye", "a gravity well", "an attractor in a dynamical system", "quasar jets"],
  params: [
    { key: "disk_radius", default: 1, min: 0.4, max: 1, doc: "outer radius of the disk", scalesExtent: true },
    { key: "inner_radius", default: 0.18, min: 0.05, max: 0.4, doc: "radius of the dark center (capped at 40% of the disk)" },
    { key: "funnel_depth", default: 0.6, min: 0, max: 1.2, doc: "depth of the funnel below the disk (0 = none)" },
    { key: "photon_ring", default: 1, min: 0, max: 1, integer: true, doc: "1 = bright thin ring hugging the dark center" },
    { key: "jets", default: 0, min: 0, max: 1, integer: true, doc: "1 = two narrow polar jets" },
  ],
  expr: [],
  regions: [
    { id: "disk", doc: "the swirling disk" },
    { id: "photon_ring", doc: "thin bright ring at the inner edge (photon_ring = 1)", conditional: true },
    { id: "funnel", doc: "the horn plunging below the center (funnel_depth > 0)", conditional: true },
    { id: "jets", doc: "the two polar jets (jets = 1)", conditional: true },
    { id: "horizon", doc: "faint sparse sphere outlining the dark shadow" },
  ],
  motionDoc: "the disk turns with differential rotation (inner faster); the photon ring spins; jets stream outward",
  generate({ count, rng, params, seed }) {
    const R = params.disk_radius!;
    const rh = Math.min(params.inner_radius!, 0.4 * R);
    const D = params.funnel_depth!;
    const withRing = params.photon_ring! >= 0.5;
    const withJets = params.jets! >= 0.5;
    const withFunnel = D > 0.02;
    const rp = rh * 1.5;
    const r0 = Math.min(rh * 2.2, R * 0.75); // disk inner edge (beyond the photon ring)
    const nz = createNoise3(`vortex:${seed}`);
    // The streak perturbation is smooth, so a 96² table replaces ~2 simplex calls per disk particle.
    const NT = 96;
    const table = new Float32Array((NT + 1) * (NT + 1));
    for (let i = 0; i <= NT; i++) for (let j = 0; j <= NT; j++) table[i * (NT + 1) + j] = nz((-1 + (2 * j) / NT) * R * 3, 0, (-1 + (2 * i) / NT) * R * 3);
    const streakNoise = (x: number, z: number) => {
      const fu = ((x / R + 1) / 2) * NT,
        fv = ((z / R + 1) / 2) * NT;
      const j = Math.max(0, Math.min(NT - 1, fu | 0)),
        i = Math.max(0, Math.min(NT - 1, fv | 0));
      const du = fu - j,
        dv = fv - i;
      const k = i * (NT + 1) + j;
      return (table[k]! * (1 - du) + table[k + 1]! * du) * (1 - dv) + (table[k + NT + 1]! * (1 - du) + table[k + NT + 2]! * du) * dv;
    };
    const b = new PointBuilder();
    const disk = b.region({ id: "disk", motion: { type: "differential", speed: 0.6 }, colorRole: "primary" });
    const ring = withRing ? b.region({ id: "photon_ring", motion: { type: "rotate", speed: 0.8 }, colorRole: "glow" }) : -1;
    const funnel = withFunnel ? b.region({ id: "funnel", motion: { type: "differential", speed: 0.6 }, colorRole: "secondary" }) : -1;
    const jets = withJets ? b.region({ id: "jets", motion: { type: "flow", speed: 1.2 }, colorRole: "accent" }) : -1;
    const horizon = b.region({ id: "horizon", motion: { type: "rotate", speed: 0.1 }, colorRole: "secondary" });
    const [nDisk, nRing, nFunnel, nJets, nHorizon] = allocate(count, [
      1 - (withRing ? 0.08 : 0) - (withFunnel ? 0.16 : 0) - (withJets ? 0.12 : 0) - 0.05,
      withRing ? 0.08 : 0,
      withFunnel ? 0.16 : 0,
      withJets ? 0.12 : 0,
      0.05,
    ]) as [number, number, number, number, number];

    // Disk: surface density ∝ r^-1.4 (inverse CDF in r^0.6), two-armed log-spiral streaks, flared thickness.
    const g = 0.6;
    const a0 = Math.pow(r0, g),
      a1 = Math.pow(R, g);
    let made = 0;
    for (let guard = 0; made < nDisk && guard < nDisk * 20; guard++) {
      const r = Math.pow(a0 + (a1 - a0) * rng.next(), 1 / g);
      const phi = rng.next() * Math.PI * 2;
      const x = Math.cos(phi) * r,
        z = Math.sin(phi) * r;
      const streak = 0.5 + 0.5 * Math.cos(2 * (phi - 3.2 * Math.log(r / R)) + 1.8 * streakNoise(x, z));
      if (rng.next() > 0.15 + 0.85 * streak * streak) continue;
      const h = (0.012 + 0.04 * (r / R) ** 2) * R;
      b.push(x, rng.normal() * h * 0.5, z, disk, r / R, r < r0 * 1.4 ? 1.15 : 1);
      made++;
    }
    for (let k = 0; k < nRing; k++) {
      const phi = rng.next() * Math.PI * 2;
      const r = rp + rng.normal() * rh * 0.04;
      b.push(Math.cos(phi) * r, rng.normal() * rh * 0.04, Math.sin(phi) * r, ring, 1, 1.3);
    }
    if (withFunnel) {
      // Horn: s = depth fraction, r(s) = rh + (r0 - rh)(1 - s)²; streaks twist as they descend.
      made = 0;
      for (let guard = 0; made < nFunnel && guard < nFunnel * 20; guard++) {
        const s = rng.next();
        const r = rh + (r0 - rh) * (1 - s) ** 2;
        if (rng.next() > Math.pow(r / r0, 0.6)) continue;
        const phi = rng.next() * Math.PI * 2;
        if (rng.next() > 0.45 + 0.55 * (0.5 + 0.5 * Math.cos(3 * (phi - 5 * s)))) continue;
        const rr = r * (1 + rng.normal() * 0.03);
        b.push(Math.cos(phi) * rr, -D * s, Math.sin(phi) * rr, funnel, s, 0.9);
        made++;
      }
    }
    if (withJets) {
      const L = 1.35;
      for (let k = 0; k < nJets; k++) {
        const s = Math.pow(rng.next(), 1.4);
        const y0 = rh * 1.1;
        const y = y0 + (L - y0) * s;
        const w = 0.012 + 0.08 * s;
        const sign = k % 2 === 0 ? 1 : -1;
        b.push(rng.normal() * w * 0.5, sign * y, rng.normal() * w * 0.5, jets, s, 1.05);
      }
    }
    const d = [0, 0, 0];
    for (let k = 0; k < nHorizon; k++) {
      rng.dir(d);
      b.push(d[0]! * rh, d[1]! * rh, d[2]! * rh, horizon, 0, 0.45);
    }
    return b.build(count, rng);
  },
};
