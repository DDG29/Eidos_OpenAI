import { describe, expect, it } from "vitest";
import { QualityManager, TIERS } from "./QualityManager";

describe("QualityManager", () => {
  it("degrades in the specified order when fps < 45 for 2 s", () => {
    const q = new QualityManager(3, 2);
    const steps: string[] = [];
    q.onChange = (_s, step) => steps.push(step);
    let t = 0;
    for (let i = 0; i < 30 * 12; i++) {
      t += 1 / 30;
      q.sample(t);
    }
    expect(steps.slice(0, 4)).toEqual(["dpr", "dpr", "density", "effects"]);
  });
  it("tiers have N = side² as specified", () => {
    expect(TIERS[3].side ** 2).toBe(160000);
    expect(TIERS[2].side ** 2).toBe(80089);
    expect(TIERS[1].side ** 2).toBe(35344);
    expect(TIERS[0].side ** 2).toBe(16384);
  });
});
