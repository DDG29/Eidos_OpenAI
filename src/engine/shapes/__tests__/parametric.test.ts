import { parametric } from "../parametric";
import { describeShape } from "../testHarness";

describeShape(parametric);

import { describe, expect, it } from "vitest";
import { run } from "../testHarness";

describe("parametric specifics", () => {
  it("the default is a unit sphere without pole crowding", () => {
    const out = run(parametric, 16384);
    let polar = 0;
    for (let i = 0; i < 16384; i++) {
      const r = Math.hypot(out.positions[i * 3]!, out.positions[i * 3 + 1]!, out.positions[i * 3 + 2]!);
      expect(Math.abs(r - 1)).toBeLessThan(0.03);
      if (Math.abs(out.positions[i * 3 + 1]!) > 0.9) polar++;
    }
    // Area-correct: the caps |y| > 0.9 hold 10% of a sphere's area.
    expect(polar / 16384).toBeGreaterThan(0.07);
    expect(polar / 16384).toBeLessThan(0.13);
  });
});
