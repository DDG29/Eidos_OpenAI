import { beforeAll, describe, expect, it } from "vitest";
import { createRng } from "../util/rng";
import { PALETTES } from "../palettes";
import { createRasterHelper } from "./raster/helper";
import type { ShapeDefinition, ShapeOutput } from "./types";
import { loadFontsFromDisk } from "@/test/fonts";


export function run(def: ShapeDefinition, count: number, overrides: Record<string, number> = {}, seed = "t"): ShapeOutput {
  const params: Record<string, number> = {};
  for (const p of def.params) params[p.key] = p.default;
  Object.assign(params, overrides);
  const expr: Record<string, string> = {};
  for (const e of def.expr) expr[e.key] = e.default;
  const dataSpec = def.data;
  const data = dataSpec ? Array.from({ length: Math.max(dataSpec.minLength, Math.min(6, dataSpec.maxLength)) }, (_, i) => ((i * 37) % 11) / 10 + 0.1) : [];
  return def.generate({ count, rng: createRng(`${def.id}:${seed}`), params, expr, data, raster: createRasterHelper(null), palette: PALETTES.aurora, seed });
}

export function check(def: ShapeDefinition, out: ShapeOutput, count: number, params: Record<string, number> = {}) {
  let minExt = 0.3;
  for (const p of def.params) if (p.scalesExtent && params[p.key] !== undefined) minExt = Math.min(minExt, 0.3 * (params[p.key]! / p.max));
  expect(out.positions.length).toBe(count * 3);
  expect(out.motionParam.length).toBe(count);
  expect(out.regionLocal.length).toBe(count);
  let ext = 0;
  for (let i = 0; i < out.positions.length; i++) {
    const v = out.positions[i]!;
    expect(Number.isFinite(v)).toBe(true);
    ext = Math.max(ext, Math.abs(v));
  }
  for (let i = 0; i < count; i++) {
    expect(Number.isFinite(out.motionParam[i]!)).toBe(true);
    expect(out.regionLocal[i]!).toBeLessThan(out.regions.length);
  }
  expect(ext).toBeGreaterThanOrEqual(minExt);
  expect(ext).toBeLessThanOrEqual(1.6);
  if (out.colors) expect(out.colors.length).toBe(count * 3);
  if (out.sizes) expect(out.sizes.length).toBe(count);
}

/** Standard contract tests for one shape (spec §14.1). */
export function describeShape(def: ShapeDefinition) {
  beforeAll(() => loadFontsFromDisk());
  describe(`shape ${def.id}`, () => {
  it("defaults @ 16 384 and 160 000: exact count, finite, extent, regions", () => {
    for (const count of [16384, 160000]) {
      const out = run(def, count);
      check(def, out, count);
      const present = new Set<number>();
      for (let i = 0; i < count; i++) present.add(out.regionLocal[i]!);
      for (const spec of def.regions) {
        if (spec.conditional) continue;
        const re = new RegExp("^" + spec.id.replace("{i}", "\\d+") + "$");
        const idxs = out.regions.map((r, i) => (re.test(r.id) ? i : -1)).filter((i) => i >= 0);
        expect(idxs.length, `${def.id}: region ${spec.id} declared`).toBeGreaterThan(0);
        const isParent = out.regions.some((r) => r.parent && re.test(r.parent));
        if (!isParent) expect(idxs.some((i) => present.has(i)), `${def.id}: region ${spec.id} has particles`).toBe(true);
      }
    }
  });

  it("is deterministic for the same seed", () => {
    const a = run(def, 16384);
    const b = run(def, 16384);
    expect(Buffer.from(a.positions.buffer).equals(Buffer.from(b.positions.buffer))).toBe(true);
    const c = run(def, 16384, {}, "other");
    if (def.id !== "text") expect(Buffer.from(a.positions.buffer).equals(Buffer.from(c.positions.buffer))).toBe(false);
  });

  it.each(def.params.flatMap((p) => [[p.key, p.min] as const, [p.key, p.max] as const]))("extreme %s = %s", (key, value) => {
    check(def, run(def, 16384, { [key]: value }), 16384, { [key]: value });
  });

  it("all-min and all-max @ 160 000", () => {
    const mins = Object.fromEntries(def.params.map((p) => [p.key, p.min]));
    const maxs = Object.fromEntries(def.params.map((p) => [p.key, p.max]));
    check(def, run(def, 160000, mins), 160000, mins);
    check(def, run(def, 160000, maxs), 160000, maxs);
  });
});
}
