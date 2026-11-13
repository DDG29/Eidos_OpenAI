import { createNoise3, fbm3 } from "../util/noise";
import { createRng, type Rng } from "../util/rng";
import { allocate, normalizeExtent, PointBuilder } from "./helpers";
import type { ShapeDefinition } from "./types";

type V3 = [number, number, number];

/** Cut plane normal: faces the camera, slightly up and right, so the opening's rim reads in the default view. */
const CUT_DIR: V3 = (() => {
  const l = Math.hypot(0.35, 0.3, 1);
  return [0.35 / l, 0.3 / l, 1 / l];
})();

interface Body {
  /** distance from the origin to the cell surface along the unit direction (x, y, z) */
  radius(x: number, y: number, z: number): number;
  /** largest value radius() can return (for volume sampling) */
  rMax: number;
}

/** Is p inside the cell surface scaled by s? (cells are star-shaped around the origin) */
function insideBody(body: Body, x: number, y: number, z: number, s: number): boolean {
  const r = Math.sqrt(x * x + y * y + z * z);
  if (r < 1e-9) return true;
  return r < body.radius(x / r, y / r, z / r) * s;
}

/**
 * Low-frequency function of direction tabulated on a 48×96 (y, azimuth) grid with bilinear lookup:
 * simplex noise per particle is the dominant cost otherwise.
 */
function directionTable(fn: (x: number, y: number, z: number) => number): (x: number, y: number, z: number) => number {
  const NV = 48,
    NU = 96;
  const t = new Float32Array((NV + 1) * (NU + 1));
  for (let i = 0; i <= NV; i++) {
    const y = -1 + (2 * i) / NV;
    const rr = Math.sqrt(Math.max(0, 1 - y * y));
    for (let j = 0; j <= NU; j++) {
      const a = -Math.PI + (2 * Math.PI * j) / NU;
      t[i * (NU + 1) + j] = fn(Math.cos(a) * rr, y, Math.sin(a) * rr);
    }
  }
  return (x, y, z) => {
    const fv = ((Math.max(-1, Math.min(1, y)) + 1) / 2) * NV;
    const fu = ((Math.atan2(z, x) + Math.PI) / (2 * Math.PI)) * NU;
    const i = Math.min(NV - 1, fv | 0),
      j = Math.min(NU - 1, fu | 0);
    const dv = fv - i,
      du = fu - j;
    const k = i * (NU + 1) + j;
    return (t[k]! * (1 - du) + t[k + 1]! * du) * (1 - dv) + (t[k + NU + 1]! * (1 - du) + t[k + NU + 2]! * du) * dv;
  };
}

function randomUnit(rng: Rng): V3 {
  const d = [0, 0, 0];
  rng.dir(d);
  return d as V3;
}

/** Orthonormal basis (axis, u, v) for a capsule/disc orientation. */
function basis(a: V3): [V3, V3, V3] {
  const h: V3 = Math.abs(a[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  let u: V3 = [a[1] * h[2] - a[2] * h[1], a[2] * h[0] - a[0] * h[2], a[0] * h[1] - a[1] * h[0]];
  const l = Math.hypot(...u) || 1;
  u = [u[0] / l, u[1] / l, u[2] / l];
  const v: V3 = [a[1] * u[2] - a[2] * u[1], a[2] * u[0] - a[0] * u[2], a[0] * u[1] - a[1] * u[0]];
  return [a, u, v];
}

export const cell: ShapeDefinition = {
  id: "cell",
  title: "Cell (cutaway)",
  doc: "A textbook cell with a cutaway opening: membrane, nucleus with nucleolus, mitochondria with cristae, folded ER around the nucleus and cytoplasm. kind 1 = boxy plant cell with wall, central vacuole and chloroplasts with stacked thylakoids; kind 2 = rod bacterium with wall, flagellum and a tangled nucleoid.",
  goodFor: ["cell biology and organelles", "photosynthesis in a plant cell", "cellular respiration (mitochondria)", "transcription in the nucleus", "prokaryote vs eukaryote", "how a virus enters a cell"],
  params: [
    { key: "kind", default: 0, min: 0, max: 2, integer: true, doc: "0 animal, 1 plant, 2 bacterium" },
    { key: "organelles", default: 1, min: 0, max: 1, integer: true, doc: "1 = draw mitochondria, ER and chloroplasts (bacteria: ribosomes)" },
    { key: "cutaway", default: 0.35, min: 0, max: 0.8, doc: "how much of the front is cut away to show the interior" },
  ],
  expr: [],
  regions: [
    { id: "membrane", doc: "the cell (plasma) membrane" },
    { id: "wall", doc: "cell wall (plant and bacterium only; includes the bacterial flagellum)", conditional: true },
    { id: "nucleus", doc: "nuclear envelope and chromatin (bacterium: the nucleoid DNA and plasmids)" },
    { id: "nucleolus", doc: "dense body inside the nucleus (not in bacteria)", conditional: true },
    { id: "mitochondria", doc: "capsules with inner folds (organelles = 1, not in bacteria)", conditional: true },
    { id: "chloroplasts", doc: "green lenses with stacked thylakoids (plant with organelles = 1)", conditional: true },
    { id: "er", doc: "endoplasmic reticulum: folded sheets around the nucleus (organelles = 1, not in bacteria)", conditional: true },
    { id: "cytoplasm", doc: "faint interior dust (bacterium: with ribosome granules)" },
  ],
  motionDoc: "cytoplasm jitters thermally; the nucleus pulses",
  generate({ count, rng, params }) {
    const kind = Math.round(params.kind!);
    const withOrg = params.organelles! >= 0.5;
    const cut = params.cutaway!;
    const planeD = 1 - 2 * cut;
    // Fixed layout seed: organelles stay put when the cutaway knob turns or the beat changes.
    const lrng = createRng(`cell:layout:${kind}`);
    const nz = createNoise3("cell:membrane");
    const b = new PointBuilder();
    const thermal = (speed: number) => ({ type: "thermal" as const, speed });

    const membrane = b.region({ id: "membrane", motion: thermal(0.08), colorRole: "primary" });
    const wall = kind !== 0 ? b.region({ id: "wall", motion: { type: "none", speed: 0 }, colorRole: "secondary" }) : -1;
    const nucleus = b.region({ id: "nucleus", motion: { type: "pulse", speed: 0.3 }, colorRole: "accent" });
    const nucleolus = kind !== 2 ? b.region({ id: "nucleolus", motion: { type: "pulse", speed: 0.3 }, colorRole: "glow" }) : -1;
    const mito = withOrg && kind !== 2 ? b.region({ id: "mitochondria", motion: thermal(0.2), colorRole: "glow" }) : -1;
    const chloro = withOrg && kind === 1 ? b.region({ id: "chloroplasts", motion: thermal(0.12), colorRole: "primary" }) : -1;
    const er = withOrg && kind !== 2 ? b.region({ id: "er", motion: thermal(0.1), colorRole: "secondary" }) : -1;
    const cyto = b.region({ id: "cytoplasm", motion: thermal(0.15), colorRole: "secondary" });

    // ---- cell body -------------------------------------------------------------------------------
    let body: Body;
    if (kind === 1) {
      const B = 0.72,
        C = 0.62;
      // Superellipsoid |x|^6 + |y/B|^6 + |z/C|^6 = 1: a rounded box.
      body = {
        radius: (x, y, z) => {
          const x2 = x * x,
            y2 = (y / B) ** 2,
            z2 = (z / C) ** 2;
          return Math.pow(x2 * x2 * x2 + y2 * y2 * y2 + z2 * z2 * z2, -1 / 6);
        },
        rMax: 1.15,
      };
    } else if (kind === 2) {
      const HL = 0.6,
        R = 0.38;
      // Ray from the origin to a capsule of half-length HL and radius R along x.
      body = {
        radius: (x, y, z) => {
          const perp = Math.sqrt(y * y + z * z);
          if (perp > 1e-6 && (Math.abs(x) / perp) * R <= HL) return R / perp;
          const bq = Math.abs(x) * HL;
          return bq + Math.sqrt(Math.max(0, bq * bq - (HL * HL - R * R)));
        },
        rMax: HL + R,
      };
    } else {
      body = {
        radius: directionTable((x, y, z) => (1 + 0.07 * nz(x * 1.4, y * 1.4, z * 1.4)) / Math.sqrt(x * x + (y / 0.86) ** 2 + (z / 0.92) ** 2)),
        rMax: 1.08,
      };
    }
    const isCut = (p: readonly number[]) => cut > 0 && p[0]! * CUT_DIR[0] + p[1]! * CUT_DIR[1] + p[2]! * CUT_DIR[2] > planeD;

    // ---- interior layout (fixed seed) ---------------------------------------------------------------
    const nucC: V3 = kind === 1 ? [-0.6, 0.16, 0.02] : [-0.12, 0.06, -0.08];
    const nucR = kind === 1 ? 0.21 : 0.34;
    const vac = { c: [0.2, -0.02, 0] as V3, r: [0.56, 0.46, 0.4] as V3 };
    const inVacuole = (x: number, y: number, z: number, s = 1) =>
      kind === 1 && ((x - vac.c[0]) / vac.r[0]) ** 2 + ((y - vac.c[1]) / vac.r[1]) ** 2 + ((z - vac.c[2]) / vac.r[2]) ** 2 < s * s;
    const occupied: { c: V3; r: number }[] = [{ c: nucC, r: nucR + (withOrg ? 0.2 : 0.04) }];
    const place = (r: number, tries = 400): V3 | null => {
      for (let t = 0; t < tries; t++) {
        const p: V3 = [lrng.range(-1, 1), lrng.range(-1, 1), lrng.range(-1, 1)];
        if (!insideBody(body, p[0], p[1], p[2], 0.84) || inVacuole(p[0], p[1], p[2], 1.12)) continue;
        if (occupied.some((o) => Math.hypot(p[0] - o.c[0], p[1] - o.c[1], p[2] - o.c[2]) < o.r + r)) continue;
        occupied.push({ c: p, r });
        return p;
      }
      return null;
    };
    const chloroplasts = chloro >= 0 ? Array.from({ length: 11 }, () => ({ c: place(0.15), axes: basis(randomUnit(lrng)) })).filter((o) => o.c) : [];
    const mitochondria = mito >= 0 ? Array.from({ length: kind === 1 ? 5 : 9 }, () => ({ c: place(0.13), axes: basis(randomUnit(lrng)) })).filter((o) => o.c) : [];
    const nucleolusC: V3 = [nucC[0] + nucR * 0.25, nucC[1] + nucR * 0.15, nucC[2] + nucR * 0.2];

    // ---- budget -------------------------------------------------------------------------------------
    const w =
      kind === 1
        ? { membrane: 0.1, wall: 0.16, nucleus: 0.1, nucleolus: 0.025, mito: 0.07, chloro: 0.2, er: 0.08, cyto: 0.265 }
        : kind === 2
          ? { membrane: 0.16, wall: 0.28, nucleus: 0.24, nucleolus: 0, mito: 0, chloro: 0, er: 0, cyto: 0.32 }
          : { membrane: 0.22, wall: 0, nucleus: 0.17, nucleolus: 0.04, mito: 0.16, chloro: 0, er: 0.15, cyto: 0.26 };
    const [nMem, nWall, nNuc, nNucl, nMito, nChl, nEr, nCyto] = allocate(count, [
      w.membrane,
      w.wall,
      w.nucleus,
      w.nucleolus,
      mito >= 0 && mitochondria.length ? w.mito : 0,
      chloro >= 0 && chloroplasts.length ? w.chloro : 0,
      er >= 0 ? w.er : 0,
      w.cyto,
    ]) as number[] as [number, number, number, number, number, number, number, number];

    const tmp = [0, 0, 0];
    // Shell at scale `s` of the cell surface, cut by the plane; the band just behind the cut is brightened.
    const shell = (n: number, region: number, s0: number, s1: number) => {
      let made = 0;
      for (let guard = 0; made < n && guard < n * 30; guard++) {
        rng.dir(tmp);
        const r = body.radius(tmp[0]!, tmp[1]!, tmp[2]!) * (s0 + (s1 - s0) * rng.next());
        const x = tmp[0]! * r,
          y = tmp[1]! * r,
          z = tmp[2]! * r;
        const along = x * CUT_DIR[0] + y * CUT_DIR[1] + z * CUT_DIR[2];
        if (cut > 0 && along > planeD) continue;
        const rim = cut > 0 && planeD - along < 0.035;
        b.push(x, y, z, region, r, rim ? 1.4 : 1);
        made++;
      }
    };
    shell(nMem, membrane, kind === 0 ? 0.985 : 0.925, kind === 0 ? 1.0 : 0.94);
    if (wall >= 0) {
      const nFlag = kind === 2 ? Math.round(nWall * 0.16) : 0;
      shell(nWall - nFlag, wall, 0.965, 1.0);
      // Bacterial flagellum: a helical whip leaving the +x pole.
      for (let k = 0; k < nFlag; k++) {
        const t = rng.next();
        const amp = 0.035 + 0.05 * t;
        const ph = t * 16;
        b.push(0.97 + t * 0.75 + rng.normal() * 0.006, Math.sin(ph) * amp + rng.normal() * 0.006, Math.cos(ph) * amp + rng.normal() * 0.006, wall, t, 0.8);
      }
    }

    // ---- nucleus ------------------------------------------------------------------------------------
    if (kind === 2) {
      // Nucleoid: a long tangled DNA loop (sum of incommensurate sinusoids) plus two small plasmid rings.
      const nPlas = Math.round(nNuc * 0.12);
      for (let k = 0; k < nNuc - nPlas; k++) {
        const t = rng.next() * Math.PI * 2;
        const x = 0.4 * Math.sin(3 * t + 0.3) + 0.08 * Math.sin(17 * t);
        const y = 0.16 * Math.sin(5 * t + 1.1) + 0.05 * Math.cos(13 * t);
        const z = 0.16 * Math.cos(7 * t + 0.4) + 0.05 * Math.sin(11 * t + 2);
        b.push(x + rng.normal() * 0.006, y + rng.normal() * 0.006, z + rng.normal() * 0.006, nucleus, t / (Math.PI * 2), 0.9);
      }
      const plasmids: V3[] = [
        [0.62, 0.17, 0.08],
        [-0.55, -0.15, -0.1],
      ];
      for (let k = 0; k < nPlas; k++) {
        const c = plasmids[k % 2]!;
        const a = rng.next() * Math.PI * 2;
        b.push(c[0] + Math.cos(a) * 0.06 + rng.normal() * 0.004, c[1] + Math.sin(a) * 0.06 + rng.normal() * 0.004, c[2] + rng.normal() * 0.004, nucleus, 1, 1);
      }
    } else {
      // Double envelope (with the cut applied) + clumpy chromatin inside.
      const nEnv = Math.round(nNuc * 0.55);
      let made = 0;
      for (let guard = 0; made < nEnv && guard < nEnv * 30; guard++) {
        rng.dir(tmp);
        const r = nucR * (rng.next() < 0.5 ? 1 : 0.94) + rng.normal() * 0.004;
        const p = [nucC[0] + tmp[0]! * r, nucC[1] + tmp[1]! * r, nucC[2] + tmp[2]! * r];
        if (isCut(p)) continue;
        b.push(p[0]!, p[1]!, p[2]!, nucleus, 1, 1.05);
        made++;
      }
      made = 0;
      for (let guard = 0; made < nNuc - nEnv && guard < (nNuc - nEnv) * 40; guard++) {
        rng.dir(tmp);
        const r = nucR * 0.9 * Math.cbrt(rng.next());
        const p = [nucC[0] + tmp[0]! * r, nucC[1] + tmp[1]! * r, nucC[2] + tmp[2]! * r];
        if (fbm3(nz, p[0]! * 7, p[1]! * 7, p[2]! * 7, 2) < 0.05) continue;
        b.push(p[0]!, p[1]!, p[2]!, nucleus, r / nucR, 0.8);
        made++;
      }
      const nlR = nucR * 0.3;
      for (let k = 0; k < nNucl; k++) {
        rng.dir(tmp);
        const r = nlR * Math.pow(rng.next(), 0.5);
        b.push(nucleolusC[0] + tmp[0]! * r, nucleolusC[1] + tmp[1]! * r, nucleolusC[2] + tmp[2]! * r, nucleolus, r / nlR, 1.1);
      }
    }

    // ---- organelles ---------------------------------------------------------------------------------
    const toWorld = (c: V3, ax: [V3, V3, V3], a: number, u: number, v: number) => [
      c[0] + ax[0][0] * a + ax[1][0] * u + ax[2][0] * v,
      c[1] + ax[0][1] * a + ax[1][1] * u + ax[2][1] * v,
      c[2] + ax[0][2] * a + ax[1][2] * u + ax[2][2] * v,
    ];
    if (mitochondria.length && nMito > 0) {
      const per = allocate(nMito, mitochondria.map(() => 1));
      const HL = kind === 1 ? 0.06 : 0.08,
        R = kind === 1 ? 0.045 : 0.055;
      mitochondria.forEach((m, i) => {
        for (let k = 0; k < per[i]!; k++) {
          let a: number, u: number, v: number;
          if (rng.next() < 0.55) {
            // Outer capsule surface.
            const s = rng.next() * (2 * HL + 2 * R) - HL - R;
            const ang = rng.next() * Math.PI * 2;
            const rad = Math.abs(s) > HL ? Math.sqrt(Math.max(0, R * R - (Math.abs(s) - HL) ** 2)) : R;
            a = s;
            u = Math.cos(ang) * rad;
            v = Math.sin(ang) * rad;
          } else {
            // Cristae: transverse folds growing from alternating sides.
            const f = rng.int(5);
            a = -HL + ((f + 0.5) / 5) * 2 * HL + rng.normal() * 0.003;
            const side = f % 2 === 0 ? 1 : -1;
            u = side * (R * 0.85 - rng.next() * R * 1.3);
            v = (rng.next() * 2 - 1) * R * 0.75;
            u += Math.sin(v * 60) * 0.006;
          }
          const p = toWorld(m.c!, m.axes, a, u, v);
          b.push(p[0]!, p[1]!, p[2]!, mito, (a + HL + R) / (2 * (HL + R)), 0.95);
        }
      });
    }
    if (chloroplasts.length && nChl > 0) {
      const per = allocate(nChl, chloroplasts.map(() => 1));
      const RA = 0.13,
        RU = 0.065,
        RV = 0.085;
      chloroplasts.forEach((c, i) => {
        for (let k = 0; k < per[i]!; k++) {
          let a: number, u: number, v: number;
          if (rng.next() < 0.4) {
            rng.dir(tmp);
            a = tmp[0]! * RA;
            u = tmp[1]! * RU;
            v = tmp[2]! * RV;
          } else {
            // Grana: three stacks of five thylakoid discs along the long axis.
            const g = rng.int(3);
            const disc = rng.int(5);
            const ang = rng.next() * Math.PI * 2;
            const rad = 0.032 * Math.sqrt(rng.next());
            a = (g - 1) * 0.075 + Math.cos(ang) * rad;
            v = Math.sin(ang) * rad;
            u = (disc - 2) * 0.011;
          }
          const p = toWorld(c.c!, c.axes, a, u, v);
          b.push(p[0]!, p[1]!, p[2]!, chloro, 0.5, 1);
        }
      });
    }
    if (er >= 0 && nEr > 0) {
      // Folded sheets (cisternae) wrapped around the nucleus, broken into patches; a few ribosome dots.
      const sheets = 3;
      const patches = Array.from({ length: sheets }, (_, k) => directionTable((x, y, z) => nz(x * 2.2 + k * 3.1, y * 2.2, z * 2.2 - k)));
      let made = 0;
      for (let guard = 0; made < nEr && guard < nEr * 40; guard++) {
        rng.dir(tmp);
        const sIdx = rng.int(sheets);
        if (patches[sIdx]!(tmp[0]!, tmp[1]!, tmp[2]!) < -0.05) continue;
        const theta = Math.atan2(tmp[2]!, tmp[0]!);
        const fold = 0.016 * Math.sin(theta * 9 + sIdx * 2 + tmp[1]! * 7);
        const rough = rng.next() < 0.15 ? 0.012 : 0;
        const r = nucR + 0.06 + sIdx * (kind === 1 ? 0.035 : 0.05) + fold + rough + rng.normal() * 0.003;
        const p: V3 = [nucC[0] + tmp[0]! * r, nucC[1] + tmp[1]! * r, nucC[2] + tmp[2]! * r];
        if (!insideBody(body, p[0], p[1], p[2], 0.9) || inVacuole(p[0], p[1], p[2])) continue;
        b.push(p[0], p[1], p[2], er, sIdx / (sheets - 1), rough ? 1.15 : 0.85);
        made++;
      }
    }

    // ---- cytoplasm ----------------------------------------------------------------------------------
    const nRibo = kind === 2 && withOrg ? Math.round(nCyto * 0.35) : 0;
    // Uniform in the star-shaped body: direction accepted with probability (R(d)/Rmax)³, then r = R(d)·∛u.
    const fill = kind === 0 ? 0.97 : 0.9;
    let made = 0;
    for (let guard = 0; made < nCyto - nRibo && guard < nCyto * 60; guard++) {
      rng.dir(tmp);
      const R = body.radius(tmp[0]!, tmp[1]!, tmp[2]!);
      const q = R / body.rMax;
      if (rng.next() > q * q * q) continue;
      const r = R * fill * Math.cbrt(rng.next());
      const x = tmp[0]! * r,
        y = tmp[1]! * r,
        z = tmp[2]! * r;
      if (inVacuole(x, y, z)) continue;
      if (kind !== 2 && (x - nucC[0]) ** 2 + (y - nucC[1]) ** 2 + (z - nucC[2]) ** 2 < (nucR * 1.02) ** 2) continue;
      if (cut > 0 && x * CUT_DIR[0] + y * CUT_DIR[1] + z * CUT_DIR[2] > planeD && rng.next() > 0.18) continue;
      b.push(x, y, z, cyto, r, 0.55);
      made++;
    }
    if (kind === 1) {
      // Faint tonoplast so the empty central vacuole reads as a volume.
      const nTono = Math.round((nCyto - made) * 0.5);
      for (let k = 0; k < nTono; k++) {
        rng.dir(tmp);
        const p = [vac.c[0] + tmp[0]! * vac.r[0], vac.c[1] + tmp[1]! * vac.r[1], vac.c[2] + tmp[2]! * vac.r[2]];
        if (isCut(p)) continue;
        b.push(p[0]!, p[1]!, p[2]!, cyto, 1, 0.5);
      }
    }
    if (nRibo > 0) {
      const granules = Math.max(8, Math.round(nRibo / 7));
      for (let g = 0; g < granules; g++) {
        let c: V3 = [0, 0, 0];
        for (let t = 0; t < 30; t++) {
          c = [lrng.range(-1, 1), lrng.range(-0.4, 0.4), lrng.range(-0.4, 0.4)];
          if (insideBody(body, c[0], c[1], c[2], 0.82)) break;
        }
        const n = Math.round(nRibo / granules);
        for (let k = 0; k < n; k++) b.push(c[0] + rng.normal() * 0.008, c[1] + rng.normal() * 0.008, c[2] + rng.normal() * 0.008, cyto, 1, 1.1);
      }
    }
    const out = b.build(count, rng);
    normalizeExtent(out.positions, 1, kind === 2);
    return out;
  },
};
