import { wave } from "../wave";
import { describeShape } from "../testHarness";

describeShape(wave);

import { describe, expect, it } from "vitest";
import { run } from "../testHarness";

describe("wave specifics", () => {
  it("one source region per source, and local amplitude in motionParam", () => {
    const out = run(wave, 16384, { sources: 3 });
    expect(out.regions.map((r) => r.id)).toEqual(["surface", "source_0", "source_1", "source_2"]);
    for (const m of out.motionParam) {
      expect(m).toBeGreaterThanOrEqual(0);
      expect(m).toBeLessThanOrEqual(1);
    }
  });
});
