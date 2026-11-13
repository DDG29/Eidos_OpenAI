import { grid } from "../grid";
import { describeShape } from "../testHarness";

describeShape(grid);

import { describe, expect, it } from "vitest";
import { createRng } from "../../util/rng";
import { PALETTES } from "../../palettes";
import { createRasterHelper } from "../raster/helper";

function gen(params: Record<string, number>, data: number[], count = 16384) {
  const p = Object.fromEntries(grid.params.map((s) => [s.key, s.default]));
  return grid.generate({ count, rng: createRng("grid"), params: { ...p, ...params }, expr: {}, data, raster: createRasterHelper(null), palette: PALETTES.aurora, seed: "grid" });
}

describe("grid specifics", () => {
  it("one default well at the centre is the lowest point and owns its region", () => {
    const out = gen({}, []);
    expect(out.regions.map((r) => r.id)).toEqual(["grid", "well_0"]);
    let minY = Infinity,
      at = -1;
    for (let i = 0; i < 16384; i++)
      if (out.positions[i * 3 + 1]! < minY) {
        minY = out.positions[i * 3 + 1]!;
        at = i;
      }
    expect(Math.hypot(out.positions[at * 3]!, out.positions[at * 3 + 2]!)).toBeLessThan(0.1);
    expect(out.regions[out.regionLocal[at]!]!.id).toBe("well_0");
  });

  it("data triples place wells; incomplete triples are ignored", () => {
    const out = gen({ wells: 0 }, [-0.5, 0.5, 1, 0.5, -0.5, 0.8, 0.9]);
    expect(out.regions.map((r) => r.id)).toEqual(["grid", "well_0", "well_1"]);
    const present = new Set(out.regionLocal);
    expect(present.has(1) && present.has(2)).toBe(true);
  });

  it("wells = 0 without data gives a flat grid", () => {
    const out = gen({ wells: 0 }, []);
    let maxAbsY = 0;
    for (let i = 0; i < 16384; i++) maxAbsY = Math.max(maxAbsY, Math.abs(out.positions[i * 3 + 1]!));
    expect(maxAbsY).toBeLessThan(0.02);
  });

  it("deep stacked wells stay in canonical space", () => {
    const out = gen({ depth: 1.5, spread: 0.8 }, [0, 0, 2, 0.1, 0, 2, -0.1, 0, 2]);
    for (const v of out.positions) expect(Math.abs(v)).toBeLessThanOrEqual(1.6);
  });
});
