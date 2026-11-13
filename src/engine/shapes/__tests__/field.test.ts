import { field } from "../field";
import { describeShape } from "../testHarness";

describeShape(field);

import { describe, expect, it } from "vitest";
import { run } from "../testHarness";

describe("field specifics", () => {
  it("the default dipole has a source and a sink, and flow params span 0..1", () => {
    const out = run(field, 16384);
    const ids = new Set(Array.from(out.regionLocal, (r) => out.regions[r]!.id));
    expect(ids.has("sources")).toBe(true);
    expect(ids.has("sinks")).toBe(true);
    // + charge at x = −0.4 is the source.
    const srcIdx = out.regions.findIndex((r) => r.id === "sources");
    let sx = 0,
      n = 0;
    for (let i = 0; i < 16384; i++)
      if (out.regionLocal[i] === srcIdx) {
        sx += out.positions[i * 3]!;
        n++;
      }
    expect(sx / n).toBeLessThan(-0.2);
    for (const m of out.motionParam) {
      expect(m).toBeGreaterThanOrEqual(0);
      expect(m).toBeLessThanOrEqual(1);
    }
  });

  it("planar lines stay in the XY plane", () => {
    const out = run(field, 16384);
    for (let i = 0; i < 16384; i++) expect(Math.abs(out.positions[i * 3 + 2]!)).toBeLessThan(0.1);
  });
});
