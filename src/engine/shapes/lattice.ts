import { allocate, PointBuilder } from "./helpers";
import type { ShapeDefinition } from "./types";

type V3 = [number, number, number];

/** Lattice sites (in cell units) and nearest-neighbour bonds for each kind. */
function buildLattice(kind: number, cells: number): { sites: V3[]; bonds: [number, number][]; nn: number } {
  const sites: V3[] = [];
  const key = (p: V3) => `${Math.round(p[0] * 4)},${Math.round(p[1] * 4)},${Math.round(p[2] * 4)}`;
  const index = new Map<string, number>();
  const add = (p: V3) => {
    const k = key(p);
    if (index.has(k)) return;
    index.set(k, sites.length);
    sites.push(p);
  };
  let nn = 1;
  if (kind === 3) {
    // Honeycomb (graphene) in the XY plane, bond length 1, patch of roughly 2·cells hexagons per side.
    nn = 1;
    const n = cells * 2;
    const ax = Math.sqrt(3);
    const halfW = (n * ax) / 2,
      halfH = n * 0.75 + 0.5;
    for (let j = -n - 2; j <= n + 2; j++)
      for (let i = -n - 2; i <= n + 2; i++) {
        const ox = i * ax + (j & 1 ? ax / 2 : 0);
        const oy = j * 1.5;
        for (const [dx, dy] of [
          [0, 0.5],
          [0, -0.5],
        ] as const) {
          const x = ox + dx,
            y = oy + dy;
          if (Math.abs(x) <= halfW + 1e-6 && Math.abs(y) <= halfH + 1e-6) add([x, y, 0]);
        }
      }
  } else {
    for (let x = 0; x <= cells; x++) for (let y = 0; y <= cells; y++) for (let z = 0; z <= cells; z++) add([x, y, z]);
    if (kind === 1) {
      nn = Math.sqrt(3) / 2;
      for (let x = 0; x < cells; x++) for (let y = 0; y < cells; y++) for (let z = 0; z < cells; z++) add([x + 0.5, y + 0.5, z + 0.5]);
    } else if (kind === 2) {
      nn = Math.SQRT1_2;
      for (let a = 0; a <= cells; a++)
        for (let u = 0; u < cells; u++)
          for (let v = 0; v < cells; v++) {
            add([a, u + 0.5, v + 0.5]);
            add([u + 0.5, a, v + 0.5]);
            add([u + 0.5, v + 0.5, a]);
          }
    }
    for (const s of sites) {
      s[0] -= cells / 2;
      s[1] -= cells / 2;
      s[2] -= cells / 2;
    }
  }
  let bonds = nearestBonds(sites, nn);
  if (kind === 3) {
    // Trim dangling edge atoms (fewer than 2 neighbours) so the sheet ends in clean hexagons.
    for (let pass = 0; pass < 2; pass++) {
      const deg = new Uint8Array(sites.length);
      for (const [i, j] of bonds) {
        deg[i]!++;
        deg[j]!++;
      }
      const kept = sites.filter((_, i) => deg[i]! >= 2);
      if (kept.length === sites.length || kept.length < 6) break;
      sites.splice(0, sites.length, ...kept);
      bonds = nearestBonds(sites, nn);
    }
  }
  return { sites, bonds, nn };
}

/** All pairs at the nearest-neighbour distance (spatial hash on a grid of cell size nn). */
function nearestBonds(sites: V3[], nn: number): [number, number][] {
  const bonds: [number, number][] = [];
  const grid = new Map<string, number[]>();
  const cellOf = (p: V3) => [Math.floor(p[0] / nn), Math.floor(p[1] / nn), Math.floor(p[2] / nn)] as const;
  sites.forEach((p, i) => {
    const [cx, cy, cz] = cellOf(p);
    const k = `${cx},${cy},${cz}`;
    const list = grid.get(k);
    if (list) list.push(i);
    else grid.set(k, [i]);
  });
  sites.forEach((p, i) => {
    const [cx, cy, cz] = cellOf(p);
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dz = -1; dz <= 1; dz++) {
          const list = grid.get(`${cx + dx},${cy + dy},${cz + dz}`);
          if (!list) continue;
          for (const j of list) {
            if (j <= i) continue;
            const q = sites[j]!;
            const d = Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]);
            if (Math.abs(d - nn) < 1e-3) bonds.push([i, j]);
          }
        }
  });
  return bonds;
}

export const lattice: ShapeDefinition = {
  id: "lattice",
  title: "Crystal lattice",
  doc: "A block of a crystal: atoms as distinct glowing balls on a regular lattice, joined by nearest-neighbour bonds; optional vacancies shown as hollow ghosts. Kind 0 simple cubic, 1 body-centred cubic (iron), 2 face-centred cubic (copper, NaCl sublattice), 3 flat hexagonal sheet (graphene).",
  goodFor: ["solids and crystals", "table salt or metals", "graphene", "the structure of matter", "defects and vacancies in a crystal", "thermal vibration of atoms"],
  params: [
    { key: "kind", default: 0, min: 0, max: 3, integer: true, doc: "0 simple cubic, 1 BCC, 2 FCC, 3 hexagonal sheet (graphene, in the XY plane)" },
    { key: "cells", default: 3, min: 1, max: 6, integer: true, doc: "unit cells per side (hexagonal: about 2·cells hexagons per side)" },
    { key: "atom_size", default: 0.08, min: 0.02, max: 0.2, doc: "atom ball radius in canonical units (capped so neighbours never merge)" },
    { key: "bonds", default: 1, min: 0, max: 1, integer: true, doc: "draw nearest-neighbour bonds (1 = yes)" },
    { key: "defect", default: 0, min: 0, max: 0.3, doc: "fraction of empty sites (vacancies), to talk about defects" },
  ],
  expr: [],
  regions: [
    { id: "atoms", doc: "all atoms" },
    { id: "bonds", doc: "nearest-neighbour bonds (when bonds = 1)", conditional: true },
    { id: "defects", doc: "hollow ghost spheres marking vacancies (when defect > 0)", conditional: true },
  ],
  motionDoc: "atoms jitter thermally",
  generate({ count, rng, params }) {
    const kind = Math.round(params.kind!);
    const cells = Math.round(params.cells!);
    const showBonds = params.bonds! >= 0.5;
    const defect = params.defect!;
    const { sites, bonds, nn } = buildLattice(kind, cells);
    // Canonical scale: the farthest site sits at 1 − atom radius (computed after the radius cap).
    let ext = 0;
    for (const s of sites) ext = Math.max(ext, Math.abs(s[0]), Math.abs(s[1]), Math.abs(s[2]));
    ext = ext || 1;
    let atomR = params.atom_size!;
    let scale = (1 - atomR) / ext;
    atomR = Math.min(atomR, 0.42 * nn * scale);
    scale = (1 - atomR) / ext;
    const bondR = Math.max(0.006, atomR * 0.2);
    // Vacancies: an exact, seeded subset of sites.
    const vacant = new Uint8Array(sites.length);
    let nVac = Math.round(defect * sites.length);
    if (defect > 0 && nVac === 0 && sites.length > 1) nVac = 1;
    nVac = Math.min(nVac, sites.length - 1);
    const order = sites.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = rng.int(i + 1);
      [order[i], order[j]] = [order[j]!, order[i]!];
    }
    for (let i = 0; i < nVac; i++) vacant[order[i]!] = 1;
    const liveBonds = showBonds ? bonds.filter(([i, j]) => !vacant[i] && !vacant[j]) : [];

    const b = new PointBuilder();
    const mot = { type: "thermal" as const, speed: 0.3 };
    const atoms = b.region({ id: "atoms", motion: mot, colorRole: "primary" });
    const bondReg = liveBonds.length ? b.region({ id: "bonds", motion: mot, colorRole: "secondary" }) : -1;
    const defReg = nVac > 0 ? b.region({ id: "defects", motion: mot, colorRole: "accent" }) : -1;
    const nAtoms = sites.length - nVac;
    // Bonds get a share that grows with how much bond length there is relative to atom count.
    const bondShare = liveBonds.length ? Math.min(0.32, 0.14 + (0.05 * liveBonds.length) / Math.max(nAtoms, 1)) : 0;
    const defShare = nVac ? Math.min(0.08, 0.25 * (nVac / sites.length) + 0.01) : 0;
    const [cAtoms, cBonds, cDef] = allocate(count, [1 - bondShare - defShare, bondShare, defShare]);
    const perAtom = allocate(cAtoms!, new Array(Math.max(nAtoms, 1)).fill(1));
    const d = [0, 0, 0];
    let ai = 0;
    for (let s = 0; s < sites.length; s++) {
      if (vacant[s]) continue;
      const p = sites[s]!;
      const n = perAtom[ai++] ?? 0;
      for (let k = 0; k < n; k++) {
        rng.dir(d);
        // 30% on a thin skin gives each ball a crisp edge; the rest fills it, denser toward the centre.
        const u = rng.next() < 0.3 ? 1 - 0.1 * rng.next() : Math.pow(rng.next(), 0.5);
        const r = atomR * u;
        b.push(p[0] * scale + d[0]! * r, p[1] * scale + d[1]! * r, p[2] * scale + d[2]! * r, atoms, u);
      }
    }
    if (liveBonds.length) {
      const len = nn * scale - 2 * atomR * 0.85;
      const per = allocate(cBonds!, new Array(liveBonds.length).fill(1));
      liveBonds.forEach(([i, j], bi) => {
        const p = sites[i]!,
          q = sites[j]!;
        const ux = (q[0] - p[0]) / nn,
          uy = (q[1] - p[1]) / nn,
          uz = (q[2] - p[2]) / nn;
        // Any vector not parallel to the bond gives the perpendicular frame.
        const ref: V3 = Math.abs(uy) < 0.9 ? [0, 1, 0] : [1, 0, 0];
        let nx = uy * ref[2] - uz * ref[1],
          ny = uz * ref[0] - ux * ref[2],
          nz = ux * ref[1] - uy * ref[0];
        const nl = Math.hypot(nx, ny, nz) || 1;
        nx /= nl;
        ny /= nl;
        nz /= nl;
        const bx = uy * nz - uz * ny,
          by = uz * nx - ux * nz,
          bz = ux * ny - uy * nx;
        const n = per[bi] ?? 0;
        for (let k = 0; k < n; k++) {
          const t = rng.next();
          const along = atomR * 0.85 + t * Math.max(len, 0);
          const ang = rng.next() * Math.PI * 2;
          const rad = bondR * Math.sqrt(rng.next());
          const c = Math.cos(ang) * rad,
            sn = Math.sin(ang) * rad;
          b.push(p[0] * scale + ux * along + nx * c + bx * sn, p[1] * scale + uy * along + ny * c + by * sn, p[2] * scale + uz * along + nz * c + bz * sn, bondReg, t, 0.9);
        }
      });
    }
    if (nVac > 0) {
      const per = allocate(cDef!, new Array(nVac).fill(1));
      for (let v = 0; v < nVac; v++) {
        const p = sites[order[v]!]!;
        for (let k = 0; k < (per[v] ?? 0); k++) {
          rng.dir(d);
          const r = atomR * (1.05 + 0.05 * rng.next());
          b.push(p[0] * scale + d[0]! * r, p[1] * scale + d[1]! * r, p[2] * scale + d[2]! * r, defReg, 1, 0.9);
        }
      }
    }
    return b.build(count, rng);
  },
};
