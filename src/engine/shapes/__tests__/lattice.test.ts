import { lattice } from "../lattice";
import { describeShape } from "../testHarness";

describeShape(lattice);

import { describe, expect, it } from "vitest";
import { run } from "../testHarness";

describe("lattice specifics", () => {
  it("defects appear only with defect > 0 and bonds only with bonds = 1", () => {
    expect(run(lattice, 16384).regions.map((r) => r.id)).toEqual(["atoms", "bonds"]);
    expect(run(lattice, 16384, { defect: 0.1, bonds: 0 }).regions.map((r) => r.id)).toEqual(["atoms", "defects"]);
  });

  it.each([0, 1, 2, 3])("kind %i produces atoms and bonds", (kind) => {
    const out = run(lattice, 16384, { kind });
    const present = new Set(out.regionLocal);
    expect(present.size).toBe(2);
  });
});
