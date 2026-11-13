import { describe, expect, it } from "vitest";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { listShapes, regionMatchesSpec, resolveParams } from "../registry";

describe("shape registry", () => {
  it("every registered shape has its own contract test file", () => {
    const files = new Set(readdirSync(join(__dirname)).map((f) => f.replace(".test.ts", "")));
    for (const s of listShapes()) expect(files.has(s.id), s.id).toBe(true);
  });
  it("params are well-formed", () => {
    for (const s of listShapes()) {
      for (const p of s.params) {
        expect(p.min, `${s.id}.${p.key}`).toBeLessThanOrEqual(p.default);
        expect(p.default, `${s.id}.${p.key}`).toBeLessThanOrEqual(p.max);
        expect(p.key).toMatch(/^[a-z][a-z0-9_]*$/);
      }
      expect(s.doc.length).toBeGreaterThan(20);
    }
  });
  it("resolves params with clamping, rounding and unknown-key reporting", () => {
    const helix = listShapes().find((s) => s.id === "helix")!;
    const r = resolveParams(helix, [
      { key: "strands", value: 1.6 },
      { key: "turns", value: 99 },
      { key: "bogus", value: 1 },
    ]);
    expect(r.params.strands).toBe(2);
    expect(r.params.turns).toBe(10);
    expect(r.params.radius).toBe(0.35);
    expect(r.unknown).toEqual(["bogus"]);
  });
  it("matches region patterns", () => {
    const text = listShapes().find((s) => s.id === "text")!;
    expect(regionMatchesSpec(text, "char_3")).toBe(true);
    expect(regionMatchesSpec(text, "glyphs")).toBe(true);
    expect(regionMatchesSpec(text, "char_x")).toBe(false);
  });
});
