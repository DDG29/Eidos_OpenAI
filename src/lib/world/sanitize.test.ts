import { describe, expect, it } from "vitest";
import { sanitizeWorldSpec, editDistance } from "./sanitize";
import { validSpec } from "@/test/worldFixture";

const ctx = {
  factIds: new Set(["F01", "F02"]),
  conceptIds: new Set(["C01", "C02"]),
  misconceptionIds: new Set(["M01"]),
  regionProbe: (l: { shape: string }) => (l.shape === "helix" ? ["strand_a", "strand_b", "base_pairs"] : l.shape === "sphere" ? ["core", "body"] : ["cloud", "filaments"]),
};

describe("sanitizeWorldSpec", () => {
  it("keeps a valid world essentially unchanged", () => {
    const raw = validSpec();
    raw.beats = raw.beats.map((b) => ({ ...b, layers: b.layers.map((l) => ({ ...l, shape: ["sphere", "helix", "text", "nebula"].includes(l.shape) ? l.shape : "sphere" })) }));
    const { spec, report } = sanitizeWorldSpec(raw, ctx);
    expect(spec.beats.length).toBe(raw.beats.length);
    expect(report.filter((r) => r.severity === "error")).toEqual([]);
  });

  it("clamps instead of rejecting pathological values", () => {
    const raw = validSpec() as unknown as { beats: Record<string, unknown>[] };
    const b = raw.beats[1]! as Record<string, unknown>;
    b.weight = 99;
    b.layers = [
      { shape: "Sphere", params: [{ key: "radius", value: 50 }, { key: "bogus", value: 1 }], expr: [], data: [], share: 3, position: { x: 99, y: -99, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: 9, colorMode: "REGION", tint: "accent" },
      { shape: "torus_knot", params: [], expr: [], data: [], share: 3, position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: 0.01, colorMode: "palette", tint: "primary" },
    ];
    const { spec, report } = sanitizeWorldSpec(raw, ctx);
    const out = spec.beats[1]!;
    expect(out.weight).toBe(2);
    expect(out.layers[0]!.shape).toBe("sphere");
    expect(out.layers[0]!.colorMode).toBe("region");
    expect(out.layers[0]!.params.find((p) => p.key === "radius")!.value).toBe(1);
    expect(out.layers[0]!.position.x).toBe(2.5);
    expect(out.layers[0]!.scale).toBe(2);
    expect(out.layers.reduce((s, l) => s + l.share, 0)).toBeLessThanOrEqual(1.0001);
    expect(report.some((r) => r.code === "PARAM_UNKNOWN")).toBe(true);
  });

  it("drops unknown fact ids and fixes check references", () => {
    const raw = validSpec();
    raw.beats[1]!.sentences[0]!.factIds = ["F01", "F99"];
    raw.beats[3]!.check.choices[1]!.misconceptionId = "M42";
    raw.beats[3]!.check.correctIndex = 9;
    const { spec } = sanitizeWorldSpec(raw, ctx);
    expect(spec.beats[1]!.sentences[0]!.factIds).toEqual(["F01"]);
    expect(spec.beats[3]!.check.choices[1]!.misconceptionId).toBe("");
    expect(spec.beats[3]!.check.correctIndex).toBe(2);
  });

  it("matches annotation regions fuzzily or drops them", () => {
    const raw = validSpec();
    raw.beats[2]!.layers = [{ ...raw.beats[2]!.layers[0]!, shape: "helix" }];
    raw.beats[2]!.annotations = [
      { layerIndex: 0, regionId: "strand-a", text: "Hebra A" },
      { layerIndex: 0, regionId: "membrane", text: "Membrana" },
    ];
    const { spec } = sanitizeWorldSpec(raw, ctx);
    expect(spec.beats[2]!.annotations).toEqual([{ layerIndex: 0, regionId: "strand_a", text: "Hebra A" }]);
  });

  it("validates knobs against the shape's parameters", () => {
    const raw = validSpec();
    raw.beats[2]!.layers = [{ ...raw.beats[2]!.layers[0]!, shape: "helix" }];
    raw.beats[2]!.knob = { enabled: true, label: "Vueltas", layerIndex: 0, paramKey: "turns", min: -5, max: 50, initial: 3, step: 0.5, unit: "", readout: "{value} vueltas" };
    raw.beats[5]!.knob = { enabled: true, label: "X", layerIndex: 0, paramKey: "nope", min: 0, max: 1, initial: 0, step: 0.1, unit: "", readout: "" };
    const { spec } = sanitizeWorldSpec(raw, ctx);
    expect(spec.beats[2]!.knob).toMatchObject({ enabled: true, min: 1, max: 10, paramKey: "turns" });
    expect(spec.beats[5]!.knob.enabled).toBe(false);
  });

  it("enforces hook first, finale last and sequential ids", () => {
    const raw = validSpec();
    raw.beats[0]!.kind = "concept";
    raw.beats.pop();
    raw.beats[3]!.id = "b02";
    const { spec, report } = sanitizeWorldSpec(raw, ctx);
    expect(spec.beats[0]!.kind).toBe("hook");
    expect(spec.beats[spec.beats.length - 1]!.kind).toBe("finale");
    expect(spec.beats.map((b) => b.id)).toEqual(spec.beats.map((_, i) => `b${String(i + 1).padStart(2, "0")}`));
    expect(report.some((r) => r.code === "ARC_FINALE")).toBe(true);
  });

  it("replaces invalid ParaMath and glyph paths with defaults and reports errors", () => {
    const raw = validSpec();
    raw.beats[1]!.layers = [{ ...raw.beats[1]!.layers[0]!, shape: "text", expr: [{ key: "content", value: "<script>HOLA" }] }];
    const { spec } = sanitizeWorldSpec(raw, ctx);
    expect(spec.beats[1]!.layers[0]!.expr[0]!.value).toBe("scriptHOLA");
  });

  it("computes edit distance", () => {
    expect(editDistance("strand_a", "strand-a")).toBe(1);
    expect(editDistance("abc", "abc")).toBe(0);
  });
});
