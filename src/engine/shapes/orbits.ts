import { allocate, clamp, PointBuilder } from "./helpers";
import type { ShapeDefinition } from "./types";

/** Must match the tilt of the shader's orbit axis (rotX(0.35) in applyMotion, type 7) so circular orbits stay on their rings. */
const PLANE_TILT = 0.35;
const GOLDEN = 2.399963229728653;

export const orbits: ShapeDefinition = {
  id: "orbits",
  title: "Orbital system",
  doc: "A central body with concentric, optionally elliptical or mutually inclined orbits; each orbit carries one body that circles at a Kepler-like rate (inner orbits faster). Solar systems, moons and satellites, cycles; a Bohr-style atom only with the caveat that electrons do not really orbit.",
  goodFor: ["the solar system", "moons and artificial satellites", "a Bohr-model atom (with a caveat)", "planetary periods and Kepler's laws", "recurring cycles"],
  params: [
    { key: "rings", default: 3, min: 1, max: 8, integer: true, doc: "number of orbits (ignored when data gives the radii)" },
    { key: "center_size", default: 0.18, min: 0.05, max: 0.4, doc: "radius of the central body" },
    { key: "body_size", default: 0.05, min: 0.01, max: 0.15, doc: "radius of each orbiting body" },
    { key: "tilt", default: 0.15, min: 0, max: 1, doc: "inclination spread between orbits (0 = coplanar, 1 = crossed, atom-like)" },
    { key: "eccentricity", default: 0, min: 0, max: 0.6, doc: "orbit ellipticity; the central body sits at a focus" },
  ],
  expr: [],
  data: { doc: "optional orbit radii in [0.2, 1], one per orbit (up to 8); ring_i follows data order", minLength: 0, maxLength: 8 },
  regions: [
    { id: "center", doc: "the central body (star, nucleus, planet)" },
    { id: "ring_{i}", doc: "orbit path i (0 = innermost, or data order when radii are given)" },
    { id: "body_{i}", doc: "the body travelling on orbit i" },
  ],
  motionDoc: "bodies circle the center, inner orbits faster (Kepler-like)",
  generate({ count, rng, params, data }) {
    const centerR = params.center_size!;
    const bodyR = params.body_size!;
    const tilt = params.tilt!;
    const ecc = params.eccentricity!;
    const minA = centerR * 1.15 + bodyR + 0.04;
    let radii: number[];
    if (data.length > 0) {
      radii = data.slice(0, 8).map((v) => Math.max(clamp(Number.isFinite(v) ? v : 0.5, 0.2, 1), minA));
    } else {
      const n = Math.round(params.rings!);
      const inner = Math.min(0.85, minA + 0.06);
      radii = Array.from({ length: n }, (_, i) => inner + (1 - inner) * (n === 1 ? 0.55 : i / (n - 1)));
    }
    const rings = radii.map((a, i) => {
      // Small deterministic per-orbit variety (golden-ratio sequence), so the system never looks mechanical.
      const g = (i * 0.618034 + 0.31) % 1;
      const e = ecc * (0.65 + 0.35 * g);
      const inc = tilt * 1.25 * (i % 2 === 0 ? 1 : -1) * (0.35 + 0.65 * ((i * 0.754877666 + 0.3) % 1));
      return { a, e, b: a * Math.sqrt(1 - e * e), omega: i * GOLDEN + 0.7, node: i * GOLDEN * 1.3, inc, bodyE: (i * 2.1 + 0.5) % (Math.PI * 2) };
    });
    // Scale so the farthest point (apoapsis + body) lands at ~1; motionParam must be the final orbit radius.
    let maxR = centerR * 1.5;
    for (const o of rings) maxR = Math.max(maxR, o.a * (1 + o.e) + bodyR * 1.6);
    const S = 1 / maxR;

    const b = new PointBuilder();
    const center = b.region({ id: "center", motion: { type: "pulse", speed: 0.4 }, colorRole: "glow" });
    // Kepler: shader angular speed = speed / param, so speed ∝ a^-1/2 gives ω ∝ a^-3/2.
    const ringIds = rings.map((o, i) => b.region({ id: `ring_${i}`, motion: { type: "orbit", speed: 0.25 / Math.sqrt(Math.max(o.a * S, 0.2)) }, colorRole: "secondary" }));
    const bodyIds = rings.map((o, i) => b.region({ id: `body_${i}`, motion: { type: "orbit", speed: 0.25 / Math.sqrt(Math.max(o.a * S, 0.2)) }, colorRole: "accent" }));

    const nR = rings.length;
    const bodyShare = Math.min(0.36, 0.06 * nR);
    const [nCenter, nRings, nBodies] = allocate(count, [0.22, 0.78 - bodyShare, bodyShare]) as [number, number, number];
    const ringCounts = allocate(nRings, rings.map((o) => o.a * (1 + o.e * 0.3)));
    const bodyCounts = allocate(nBodies, rings.map(() => 1));

    const cT = Math.cos(PLANE_TILT),
      sT = Math.sin(PLANE_TILT);
    const out = [0, 0, 0];
    // Orbital-plane point (x, z) → inclined about the node line → tilted onto the shader's orbit plane.
    const place = (o: (typeof rings)[number], px: number, py: number, pz: number) => {
      const nx = Math.cos(o.node),
        nz = Math.sin(o.node);
      const ci = Math.cos(o.inc),
        si = Math.sin(o.inc);
      // Rodrigues rotation about the unit axis (nx, 0, nz).
      const dot = px * nx + pz * nz;
      const cx = -nz * py,
        cy = nz * px - nx * pz,
        cz = nx * py;
      const rx = px * ci + cx * si + nx * dot * (1 - ci);
      const ry = py * ci + cy * si;
      const rz = pz * ci + cz * si + nz * dot * (1 - ci);
      out[0] = rx * S;
      out[1] = (cT * ry - sT * rz) * S;
      out[2] = (sT * ry + cT * rz) * S;
      return out;
    };
    const orbitPoint = (o: (typeof rings)[number], E: number) => {
      const x = o.a * (Math.cos(E) - o.e),
        z = o.b * Math.sin(E);
      const co = Math.cos(o.omega),
        so = Math.sin(o.omega);
      return [x * co - z * so, z * co + x * so] as const;
    };

    const d = [0, 0, 0];
    for (let k = 0; k < nCenter; k++) {
      rng.dir(d);
      const corona = rng.next() < 0.14;
      const u = rng.next();
      const r = corona ? centerR * (1 + 0.5 * Math.pow(u, 1.6)) : centerR * Math.pow(u, 0.5);
      b.push(d[0]! * r * S, d[1]! * r * S, d[2]! * r * S, center, r / (centerR * 1.5), corona ? 0.7 : 1.2);
    }
    rings.forEach((o, i) => {
      const mp = o.a * S;
      const tube = 0.0045 + 0.0025 * o.a;
      for (let k = 0; k < ringCounts[i]!; k++) {
        const [x, z] = orbitPoint(o, rng.next() * Math.PI * 2);
        const p = place(o, x + rng.normal() * tube, rng.normal() * tube, z + rng.normal() * tube);
        b.push(p[0]!, p[1]!, p[2]!, ringIds[i]!, mp, 0.75);
      }
      const [bx, bz] = orbitPoint(o, o.bodyE);
      for (let k = 0; k < bodyCounts[i]!; k++) {
        rng.dir(d);
        const halo = rng.next() < 0.12;
        const r = halo ? bodyR * (1 + 0.6 * rng.next()) : bodyR * Math.pow(rng.next(), 0.45);
        const p = place(o, bx + d[0]! * r, d[1]! * r, bz + d[2]! * r);
        b.push(p[0]!, p[1]!, p[2]!, bodyIds[i]!, mp, halo ? 0.7 : 1.1);
      }
    });
    return b.build(count, rng);
  },
};
