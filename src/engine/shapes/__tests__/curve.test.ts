import { curve } from "../curve";
import { describeShape } from "../testHarness";

describeShape(curve);

import { describe, expect, it } from "vitest";
import { createRng } from "../../util/rng";
import { PALETTES } from "../../palettes";
import { createRasterHelper } from "../raster/helper";

function gen(expr: Record<string, string>, params: Record<string, number> = {}, count = 16384) {
  const p = Object.fromEntries(curve.params.map((s) => [s.key, s.default]));
  const e = Object.fromEntries(curve.expr.map((s) => [s.key, s.default]));
  return curve.generate({ count, rng: createRng("curve"), params: { ...p, ...params }, expr: { ...e, ...expr }, data: [], raster: createRasterHelper(null), palette: PALETTES.aurora, seed: "curve" });
}

function centroid(out: ReturnType<typeof gen>, id: string) {
  const ri = out.regions.findIndex((r) => r.id === id);
  const c = [0, 0, 0];
  let n = 0;
  for (let i = 0; i < out.regionLocal.length; i++)
    if (out.regionLocal[i] === ri) {
      for (let a = 0; a < 3; a++) c[a]! += out.positions[i * 3 + a]!;
      n++;
    }
  return c.map((v) => v / n);
}

describe("curve specifics", () => {
  it("keeps coordinates as written and marks start and end", () => {
    const out = gen({ x: "t*2-1", y: "0.5*t", z: "0" }, { t_min: 0, t_max: 1 });
    const s = centroid(out, "start"),
      e = centroid(out, "end");
    expect(s[0]).toBeCloseTo(-1, 1);
    expect(e[0]).toBeCloseTo(1, 1);
    expect(e[1]).toBeCloseTo(0.5, 1);
  });

  it("a knob on `a` changes the curve (compound interest example)", () => {
    const y = "0.8*((1+a/100)^(t*30)-1)/((1+15/100)^30-1)";
    const lo = centroid(gen({ x: "t*2-1", y, z: "0" }, { t_min: 0, t_max: 1, a: 3 }), "end");
    const hi = centroid(gen({ x: "t*2-1", y, z: "0" }, { t_min: 0, t_max: 1, a: 10 }), "end");
    expect(hi[1]!).toBeGreaterThan(lo[1]! + 0.1);
  });

  it("motionParam is t normalised from start (0) to end (1)", () => {
    const out = gen({}, {});
    const si = out.regions.findIndex((r) => r.id === "start"),
      ei = out.regions.findIndex((r) => r.id === "end");
    for (let i = 0; i < out.regionLocal.length; i++) {
      if (out.regionLocal[i] === si) expect(out.motionParam[i]!).toBeLessThan(0.01);
      if (out.regionLocal[i] === ei) expect(out.motionParam[i]!).toBeGreaterThan(0.99);
    }
  });
});
