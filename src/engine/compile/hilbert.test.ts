import { describe, expect, it } from "vitest";
import { argsort, hilbert3 } from "./hilbert";

describe("hilbert3", () => {
  it("is a bijection on a small grid", () => {
    const bits = 3;
    const side = 1 << bits;
    const seen = new Set<number>();
    for (let x = 0; x < side; x++) for (let y = 0; y < side; y++) for (let z = 0; z < side; z++) seen.add(hilbert3(x, y, z, bits));
    expect(seen.size).toBe(side ** 3);
    expect(Math.max(...seen)).toBe(side ** 3 - 1);
  });
  it("is local: consecutive indices are adjacent cells", () => {
    const bits = 3;
    const side = 1 << bits;
    const byIndex = new Map<number, [number, number, number]>();
    for (let x = 0; x < side; x++) for (let y = 0; y < side; y++) for (let z = 0; z < side; z++) byIndex.set(hilbert3(x, y, z, bits), [x, y, z]);
    for (let i = 1; i < side ** 3; i++) {
      const a = byIndex.get(i - 1)!,
        b = byIndex.get(i)!;
      expect(Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])).toBe(1);
    }
  });
});

describe("argsort", () => {
  it("sorts stably", () => {
    const k = new Float64Array([3, 1, 2, 1, 0]);
    expect(Array.from(argsort(k))).toEqual([4, 1, 3, 2, 0]);
  });
});
