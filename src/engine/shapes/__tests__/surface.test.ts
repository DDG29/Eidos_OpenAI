import { surface } from "../surface";
import { describeShape } from "../testHarness";

describeShape(surface);

import { describe, expect, it } from "vitest";
import { createRng } from "../../util/rng";
import { PALETTES } from "../../palettes";
import { createRasterHelper } from "../raster/helper";

function gen(f: string, params: Record<string, number> = {}, count = 16384) {
  const p = Object.fromEntries(surface.params.map((s) => [s.key, s.default]));
  return surface.generate({ count, rng: createRng("surf"), params: { ...p, ...params }, expr: { f }, data: [], raster: createRasterHelper(null), palette: PALETTES.aurora, seed: "surf" });
}

describe("surface specifics", () => {
  it("evaluates f in the XZ plane with height in Y (world z = −y) and uses the knobs", () => {
    const out = gen("0.5*x + a*y/10", { a: 4 });
    for (let i = 0; i < 16384; i += 97) {
      const x = out.positions[i * 3]!,
        h = out.positions[i * 3 + 1]!,
        z = out.positions[i * 3 + 2]!;
      expect(h).toBeCloseTo(0.5 * x + (4 * -z) / 10, 4);
    }
  });

  it("peaks are higher than valleys", () => {
    const out = gen("0.3*sin(3*x)*cos(3*y)");
    const ids = out.regions.map((r) => r.id);
    let minPeak = Infinity,
      maxValley = -Infinity;
    for (let i = 0; i < 16384; i++) {
      const id = ids[out.regionLocal[i]!];
      const h = out.positions[i * 3 + 1]!;
      if (id === "peaks") minPeak = Math.min(minPeak, h);
      if (id === "valleys") maxValley = Math.max(maxValley, h);
    }
    expect(minPeak).toBeGreaterThan(maxValley);
  });

  it("repairs trivial mistakes and falls back on invalid expressions, with warnings", () => {
    expect(gen("0.2*Math.sin(3*x").warnings!.some((w) => w.includes("repaired"))).toBe(true);
    expect(gen("foo(x)").warnings!.some((w) => w.includes("invalid"))).toBe(true);
  });

  it("compresses huge heights into canonical space", () => {
    const out = gen("40*x*y");
    for (const v of out.positions) expect(Math.abs(v)).toBeLessThanOrEqual(1.6);
  });
});
