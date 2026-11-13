import { shell } from "../shell";
import { describeShape } from "../testHarness";

describeShape(shell);

import { describe, expect, it } from "vitest";
import { run } from "../testHarness";

describe("shell specifics", () => {
  it("an opening removes the top cap and adds a rim", () => {
    const out = run(shell, 16384, { opening: 0.4, noise: 0 });
    expect(out.regions.map((r) => r.id)).toEqual(["surface", "rim"]);
    for (let i = 0; i < 16384; i++) expect(out.positions[i * 3 + 1]!).toBeLessThan(0.25);
  });
});
