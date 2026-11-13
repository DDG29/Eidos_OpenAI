import type { ColorRole } from "@/lib/world/types";
import { hexToRgb, mixRgb, type Palette, type RGB } from "../palettes";
import { allocate, parseEdges, PointBuilder } from "./helpers";
import type { ShapeDefinition } from "./types";

// Water: O–H 0.957 Å, H–O–H 104.5°.
const DEFAULT_ATOMS = "O 0 0 0; H 0.757 0.586 0; H -0.757 0.586 0";
const MAX_ATOMS = 60;
const MAX_BONDS = 90;

interface Element {
  cpk: RGB;
  /** covalent radius, Å */
  cov: number;
  role: ColorRole;
}

const ELEMENTS: Record<string, Element> = {
  H: { cpk: [1, 1, 1], cov: 0.31, role: "glow" },
  C: { cpk: [0.42, 0.42, 0.45], cov: 0.76, role: "secondary" },
  N: { cpk: [0.19, 0.31, 0.97], cov: 0.71, role: "primary" },
  O: { cpk: [1, 0.08, 0.08], cov: 0.66, role: "accent" },
  P: { cpk: [1, 0.5, 0], cov: 1.07, role: "accent" },
  S: { cpk: [1, 0.9, 0.2], cov: 1.05, role: "accent" },
  Cl: { cpk: [0.12, 0.94, 0.12], cov: 1.02, role: "primary" },
  Na: { cpk: [0.67, 0.36, 0.95], cov: 1.66, role: "secondary" },
  Fe: { cpk: [0.88, 0.4, 0.2], cov: 1.32, role: "accent" },
};
const OTHER: Element = { cpk: [1, 0.45, 0.75], cov: 0.8, role: "accent" };

interface Atom {
  el: string;
  x: number;
  y: number;
  z: number;
}

/** "C 0 0 0; O 1.21 0 0" → atoms. Malformed entries are skipped and reported. */
export function parseAtoms(src: string | undefined): { atoms: Atom[]; errors: string[]; truncated: boolean } {
  const atoms: Atom[] = [];
  const errors: string[] = [];
  let truncated = false;
  for (const raw of (src ?? "").split(/[;\n]+/)) {
    const part = raw.trim();
    if (!part) continue;
    const m = /^([A-Za-z]{1,2})[\s,]+(\S+)[\s,]+(\S+)[\s,]+(\S+)$/.exec(part);
    const nums = m ? [Number(m[2]), Number(m[3]), Number(m[4])] : [];
    if (!m || !nums.every((v) => Number.isFinite(v) && Math.abs(v) < 1000)) {
      errors.push(`'${part.slice(0, 24)}'`);
      continue;
    }
    if (atoms.length >= MAX_ATOMS) {
      truncated = true;
      break;
    }
    const sym = m[1]!;
    atoms.push({ el: sym[0]!.toUpperCase() + sym.slice(1).toLowerCase(), x: nums[0]!, y: nums[1]!, z: nums[2]! });
  }
  return { atoms, errors, truncated };
}

/** Bonds by distance: closer than 1.9 Å and than 1.2× the sum of covalent radii (so water's H···H is not a bond). */
export function inferBonds(atoms: Atom[]): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < atoms.length; i++)
    for (let j = i + 1; j < atoms.length; j++) {
      const a = atoms[i]!,
        b = atoms[j]!;
      const d = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
      const lim = Math.min(1.9, 1.2 * ((ELEMENTS[a.el] ?? OTHER).cov + (ELEMENTS[b.el] ?? OTHER).cov));
      if (d > 0.1 && d < lim) out.push([i, j]);
    }
  return out.slice(0, MAX_BONDS);
}

/** CPK colour pulled 60% toward the nearest palette colour, so elements stay distinct but on-palette. */
function tint(cpk: RGB, palette: Palette): RGB {
  let best: RGB = hexToRgb(palette.primary);
  let bd = Infinity;
  for (const role of ["primary", "secondary", "accent", "glow"] as const) {
    const c = hexToRgb(palette[role]);
    const d = (c[0] - cpk[0]) ** 2 + (c[1] - cpk[1]) ** 2 + (c[2] - cpk[2]) ** 2;
    if (d < bd) {
      bd = d;
      best = c;
    }
  }
  return mixRgb(cpk, best, 0.6);
}

export const molecule: ShapeDefinition = {
  id: "molecule",
  title: "Ball-and-stick molecule",
  doc: "A ball-and-stick molecule from element symbols and coordinates in ångströms (default: water). Atoms are coloured by element (CPK, tuned to the palette) and each atom is its own region atom_0, atom_1… in input order. Chemistry, water, CO₂, glucose, simplified ATP, drugs.",
  goodFor: ["a water molecule", "carbon dioxide", "methane or glucose", "a drug binding motif", "bonds and molecular geometry"],
  params: [
    { key: "atom_scale", default: 1, min: 0.3, max: 2, doc: "atom ball size (1 = ball-and-stick, 2 ≈ space-filling)" },
    { key: "bond_density", default: 0.15, min: 0, max: 0.4, doc: "share of particles in the bonds" },
  ],
  expr: [
    {
      key: "atoms",
      kind: "molecule",
      default: DEFAULT_ATOMS,
      maxLength: 2000,
      doc: 'atoms as "Element x y z" in ångströms separated by ";", e.g. "C 0 0 0; O 1.16 0 0; O -1.16 0 0" (max 60)',
    },
    {
      key: "bonds",
      kind: "edges",
      default: "",
      maxLength: 600,
      doc: 'optional bonds as atom index pairs "0-1;0-2" (max 90); if empty they are inferred from distances',
    },
  ],
  regions: [
    { id: "atom_{i}", doc: "each atom, in input order; label = element symbol" },
    { id: "bonds", doc: "all bonds (when the molecule has bonds and bond_density > 0)", conditional: true },
  ],
  motionDoc: "atoms jitter thermally",
  generate({ count, rng, params, expr, palette }) {
    const b = new PointBuilder();
    let { atoms, errors, truncated } = parseAtoms(expr.atoms);
    if (errors.length) b.warnings.push(`molecule: skipped malformed atom entries ${errors.slice(0, 3).join(", ")}${errors.length > 3 ? "…" : ""}`);
    if (truncated) b.warnings.push(`molecule: only the first ${MAX_ATOMS} atoms are drawn`);
    if (atoms.length === 0) {
      b.warnings.push("molecule: no valid atoms; showing water");
      atoms = parseAtoms(DEFAULT_ATOMS).atoms;
    }
    let bonds: [number, number][] = [];
    const bondSrc = (expr.bonds ?? "").trim();
    if (bondSrc) {
      const seen = new Set<string>();
      for (const [i, j] of parseEdges(bondSrc, atoms.length)) {
        const k = i < j ? `${i}-${j}` : `${j}-${i}`;
        if (!seen.has(k)) {
          seen.add(k);
          bonds.push([i, j]);
        }
      }
      if (bonds.length === 0) b.warnings.push("molecule: no valid bonds in the bonds list; inferring them from distances");
      if (bonds.length > MAX_BONDS) b.warnings.push(`molecule: only the first ${MAX_BONDS} bonds are drawn`);
      bonds = bonds.slice(0, MAX_BONDS);
    }
    if (bonds.length === 0) bonds = inferBonds(atoms);

    const scaleA = params.atom_scale!;
    const els = atoms.map((a) => ELEMENTS[a.el] ?? OTHER);
    const radiiA = els.map((e) => 0.5 * e.cov * scaleA);
    // Centre on the bounding box and fit the outermost ball surface to extent 1.
    let mnx = Infinity,
      mny = Infinity,
      mnz = Infinity,
      mxx = -Infinity,
      mxy = -Infinity,
      mxz = -Infinity;
    for (const a of atoms) {
      mnx = Math.min(mnx, a.x);
      mxx = Math.max(mxx, a.x);
      mny = Math.min(mny, a.y);
      mxy = Math.max(mxy, a.y);
      mnz = Math.min(mnz, a.z);
      mxz = Math.max(mxz, a.z);
    }
    const cx = (mnx + mxx) / 2,
      cy = (mny + mxy) / 2,
      cz = (mnz + mxz) / 2;
    let ext = 0;
    atoms.forEach((a, i) => {
      const r = radiiA[i]!;
      ext = Math.max(ext, Math.abs(a.x - cx) + r, Math.abs(a.y - cy) + r, Math.abs(a.z - cz) + r);
    });
    const s = 1 / Math.max(ext, 1e-6);
    const P = atoms.map((a) => [(a.x - cx) * s, (a.y - cy) * s, (a.z - cz) * s] as const);
    const radii = radiiA.map((r) => r * s);
    const colors = els.map((e) => tint(e.cpk, palette));

    const mot = { type: "thermal" as const, speed: 0.4 };
    const regs = atoms.map((a, i) => b.region({ id: `atom_${i}`, label: a.el, motion: mot, colorRole: els[i]!.role }));
    const bondShare = bonds.length ? params.bond_density! : 0;
    const bondReg = bondShare > 0 ? b.region({ id: "bonds", motion: mot, colorRole: "secondary" }) : -1;
    const [nAtoms, nBonds] = allocate(count, [1 - bondShare, bondShare]);
    // Particles per atom ∝ r² (surface-like), so small H atoms stay visible next to big ones.
    const perAtom = allocate(nAtoms!, radii.map((r) => r * r));
    const d = [0, 0, 0];
    atoms.forEach((_, i) => {
      const [px, py, pz] = P[i]!;
      const r = radii[i]!;
      const col = colors[i]!;
      for (let k = 0; k < perAtom[i]!; k++) {
        rng.dir(d);
        // 35% on a thin skin for a crisp ball edge, the rest filling the volume.
        const u = rng.next() < 0.35 ? 1 - 0.08 * rng.next() : Math.cbrt(rng.next());
        b.push(px + d[0]! * r * u, py + d[1]! * r * u, pz + d[2]! * r * u, regs[i]!, u, 1, col);
      }
    });
    if (bondReg >= 0) {
      const bondR0 = 0.075 * Math.sqrt(scaleA) * s;
      const lens = bonds.map(([i, j]) => Math.max(1e-6, Math.hypot(P[j]![0] - P[i]![0], P[j]![1] - P[i]![1], P[j]![2] - P[i]![2]) - 0.8 * (radii[i]! + radii[j]!)));
      const perBond = allocate(nBonds!, lens);
      const secondary = hexToRgb(palette.secondary);
      bonds.forEach(([i, j], bi) => {
        const p = P[i]!,
          q = P[j]!;
        const L = Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) || 1;
        const ux = (q[0] - p[0]) / L,
          uy = (q[1] - p[1]) / L,
          uz = (q[2] - p[2]) / L;
        const ref = Math.abs(uy) < 0.9 ? [0, 1, 0] : [1, 0, 0];
        let nx = uy * ref[2]! - uz * ref[1]!,
          ny = uz * ref[0]! - ux * ref[2]!,
          nz = ux * ref[1]! - uy * ref[0]!;
        const nl = Math.hypot(nx, ny, nz) || 1;
        nx /= nl;
        ny /= nl;
        nz /= nl;
        const bx = uy * nz - uz * ny,
          by = uz * nx - ux * nz,
          bz = ux * ny - uy * nx;
        // The stick runs between the two ball surfaces (slightly inside them so it looks attached).
        const a0 = radii[i]! * 0.8,
          a1 = L - radii[j]! * 0.8;
        // Never thicker than 60% of the smaller ball, so a stick cannot swallow a hydrogen.
        const bondR = Math.min(bondR0, 0.6 * Math.min(radii[i]!, radii[j]!));
        const ci = mixRgb(colors[i]!, secondary, 0.3),
          cj = mixRgb(colors[j]!, secondary, 0.3);
        for (let k = 0; k < perBond[bi]!; k++) {
          const t = a0 + (a1 - a0) * rng.next();
          const ang = rng.next() * Math.PI * 2;
          const rad = bondR * Math.sqrt(rng.next());
          const c = Math.cos(ang) * rad,
            sn = Math.sin(ang) * rad;
          // Classic split-colour stick: each half takes its atom's colour.
          b.push(p[0] + ux * t + nx * c + bx * sn, p[1] + uy * t + ny * c + by * sn, p[2] + uz * t + nz * c + bz * sn, bondReg, t / L, 0.9, t < L / 2 ? ci : cj);
        }
      });
    }
    return b.build(count, rng);
  },
};
