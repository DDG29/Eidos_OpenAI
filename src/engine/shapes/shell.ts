import { createNoise3 } from "../util/noise";
import { PointBuilder } from "./helpers";
import type { ShapeDefinition } from "./types";

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export const shell: ShapeDefinition = {
  id: "shell",
  title: "Spherical shell",
  doc: "A hollow sphere: particles only on a thin skin, optionally cut open at the top to reveal the inside (bright rim on the cut). Membranes, bubbles, horizons, atmospheres, the surface of a star.",
  goodFor: ["a cell membrane", "a soap bubble", "an event horizon", "a planet's atmosphere", "the surface of a star", "opening a container to look inside"],
  params: [
    { key: "radius", default: 1, min: 0.2, max: 1, doc: "shell radius", scalesExtent: true },
    { key: "thickness", default: 0.03, min: 0, max: 0.3, doc: "skin thickness as a fraction of the radius (grows inward)" },
    { key: "noise", default: 0.04, min: 0, max: 0.4, doc: "surface roughness (simplex displacement)" },
    { key: "opening", default: 0, min: 0, max: 0.9, doc: "fraction of the sphere cut away from the top, to show the interior (0 = closed)" },
  ],
  expr: [],
  regions: [
    { id: "surface", doc: "the skin of the sphere" },
    { id: "rim", doc: "bright edge of the cut (only when opening > 0)", conditional: true },
  ],
  motionDoc: "rotates slowly around the vertical axis",
  generate({ count, rng, params, seed }) {
    const R = params.radius!;
    const thick = params.thickness!;
    const rough = params.noise!;
    const opening = params.opening!;
    const nz = createNoise3(`shell:${seed}`);
    const b = new PointBuilder();
    const rot = { type: "rotate" as const, speed: 0.1 };
    const surf = b.region({ id: "surface", motion: rot, colorRole: "primary" });
    const open = opening > 1e-3;
    const rim = open ? b.region({ id: "rim", motion: rot, colorRole: "glow" }) : -1;
    // Cut plane: keep y ≤ yc (unit sphere). Sampling the Fibonacci lattice only inside the kept band is the
    // same as "discard and redistribute": density stays uniform and the count is exact.
    const yc = 1 - 2 * opening;
    const rimCount = open ? Math.round(count * 0.07) : 0;
    const n = count - rimCount;
    const band = yc + 1;
    const spacing = Math.sqrt((4 * Math.PI * (band / 2)) / Math.max(n, 1));
    const displace = (x: number, y: number, z: number) => 1 + rough * nz(x * 2.1 + 3.3, y * 2.1, z * 2.1 - 1.7);
    for (let k = 0; k < n; k++) {
      // Jitter by up to half a lattice cell to break the spiral moiré.
      let y = -1 + (band * (k + 0.5)) / n + (rng.next() - 0.5) * spacing * 0.9;
      y = Math.min(yc, Math.max(-1, y));
      const rho = Math.sqrt(Math.max(0, 1 - y * y));
      const phi = k * GOLDEN_ANGLE + ((rng.next() - 0.5) * spacing) / Math.max(rho, 0.05);
      const x = Math.cos(phi) * rho,
        z = Math.sin(phi) * rho;
      const r = R * (1 - thick * rng.next()) * displace(x, y, z);
      b.push(x * r, y * r, z * r, surf, (y + 1) / 2);
    }
    if (open) {
      const ringR = Math.sqrt(Math.max(0, 1 - yc * yc));
      const tubeR = Math.max(0.012, thick * 0.6);
      for (let k = 0; k < rimCount; k++) {
        const phi = rng.next() * Math.PI * 2;
        const cx = Math.cos(phi) * ringR,
          cz = Math.sin(phi) * ringR;
        // Gaussian cross-section around the cut circle, pulled slightly inward so it hugs the skin.
        const s = 1 + rng.normal() * tubeR * 0.5 - thick * 0.5;
        const y = yc + rng.normal() * tubeR * 0.5;
        const r = R * displace(cx, yc, cz);
        b.push(cx * s * r, y * r, cz * s * r, rim, phi / (Math.PI * 2), 1.15);
      }
    }
    return b.build(count, rng);
  },
};
