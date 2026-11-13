import { molecule } from "../molecule";
import { describeShape } from "../testHarness";

describeShape(molecule);

import { describe, expect, it } from "vitest";
import { createRng } from "../../util/rng";
import { PALETTES } from "../../palettes";
import { createRasterHelper } from "../raster/helper";
import { inferBonds, parseAtoms } from "../molecule";

function gen(atoms: string, bonds = "", count = 8000) {
  return molecule.generate({
    count,
    rng: createRng("mol"),
    params: { atom_scale: 1, bond_density: 0.15 },
    expr: { atoms, bonds },
    data: [],
    raster: createRasterHelper(null),
    palette: PALETTES.magma,
    seed: "mol",
  });
}

describe("molecule specifics", () => {
  it("default is water: O, H, H with two O–H bonds and no H–H bond", () => {
    const { atoms } = parseAtoms(molecule.expr[0]!.default);
    expect(atoms.map((a) => a.el)).toEqual(["O", "H", "H"]);
    expect(inferBonds(atoms)).toEqual([
      [0, 1],
      [0, 2],
    ]);
    const out = gen(molecule.expr[0]!.default);
    expect(out.regions.filter((r) => r.id.startsWith("atom_")).map((r) => r.label)).toEqual(["O", "H", "H"]);
    expect(out.regions.some((r) => r.id === "bonds")).toBe(true);
  });

  it("provides per-particle colours in [0, 1], distinct for O and H", () => {
    const out = gen("O 0 0 0; H 0.757 0.586 0; H -0.757 0.586 0");
    expect(out.colors).toBeDefined();
    const c = out.colors!;
    expect(c.length).toBe(8000 * 3);
    for (const v of c) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    const first = (region: string) => {
      const ri = out.regions.findIndex((r) => r.id === region);
      const i = out.regionLocal.findIndex((r) => r === ri);
      return [c[i * 3]!, c[i * 3 + 1]!, c[i * 3 + 2]!];
    };
    const o = first("atom_0"),
      h = first("atom_1");
    expect(Math.hypot(o[0]! - h[0]!, o[1]! - h[1]!, o[2]! - h[2]!)).toBeGreaterThan(0.15);
  });

  it("uses explicit bonds, normalises element case and skips malformed entries", () => {
    const out = gen("c 0 0 0; o 1.16 0 0; O -1.16 0 0; Xx nope", "0-1;0-2");
    expect(out.regions.filter((r) => r.id.startsWith("atom_")).map((r) => r.label)).toEqual(["C", "O", "O"]);
    expect(out.warnings!.some((w) => w.includes("malformed"))).toBe(true);
  });

  it("falls back to water with a warning on invalid input", () => {
    const out = gen("not a molecule");
    expect(out.warnings!.some((w) => w.includes("showing water"))).toBe(true);
    expect(out.regions.filter((r) => r.id.startsWith("atom_")).length).toBe(3);
  });

  it("caps at 60 atoms and keeps exact count", () => {
    const many = Array.from({ length: 80 }, (_, i) => `C ${(i % 9) * 1.5} ${Math.floor(i / 9) * 1.5} 0`).join("; ");
    const out = gen(many, "", 16384);
    expect(out.regions.filter((r) => r.id.startsWith("atom_")).length).toBe(60);
    expect(out.positions.length).toBe(16384 * 3);
    expect(out.warnings!.some((w) => w.includes("first 60"))).toBe(true);
  });
});
