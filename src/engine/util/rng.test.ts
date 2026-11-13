import { describe, expect, it } from "vitest";
import { createRng, hashString } from "./rng";

describe("rng", () => {
  it("is deterministic per seed and differs across seeds", () => {
    const a = createRng("x");
    const b = createRng("x");
    const c = createRng("y");
    const sa = Array.from({ length: 5 }, () => a.next());
    expect(Array.from({ length: 5 }, () => b.next())).toEqual(sa);
    expect(Array.from({ length: 5 }, () => c.next())).not.toEqual(sa);
  });
  it("stays in [0,1) with a roughly uniform mean", () => {
    const r = createRng(42);
    let sum = 0;
    for (let i = 0; i < 20000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      sum += v;
    }
    expect(Math.abs(sum / 20000 - 0.5)).toBeLessThan(0.01);
  });
  it("produces unit directions and normal samples", () => {
    const r = createRng("d");
    const v = [0, 0, 0];
    r.dir(v);
    expect(Math.hypot(v[0]!, v[1]!, v[2]!)).toBeCloseTo(1, 6);
    let m = 0;
    for (let i = 0; i < 10000; i++) m += r.normal();
    expect(Math.abs(m / 10000)).toBeLessThan(0.05);
  });
  it("hashes strings stably", () => {
    expect(hashString("eidos")).toBe(hashString("eidos"));
    expect(hashString("eidos")).not.toBe(hashString("eidoS"));
  });
});
