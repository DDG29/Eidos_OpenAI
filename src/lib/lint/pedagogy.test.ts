import { describe, expect, it } from "vitest";
import { facts, misconceptions, validSpec, beat, checkBeat } from "@/test/worldFixture";
import { makeLayer } from "@/lib/world/layer";
import type { WorldSpec } from "@/lib/world/types";
import { lintWorld } from "./pedagogy";

const lint = (spec: WorldSpec, sourceKind: "document" | "general" = "document") => lintWorld(spec, { facts, misconceptions, sourceKind });
const codes = (spec: WorldSpec) => {
  const r = lint(spec);
  return [...r.errors, ...r.warnings].map((x) => x.code);
};

describe("pedagogical linter", () => {
  it("passes a well-formed world with no errors", () => {
    const r = lint(validSpec());
    expect(r.errors).toEqual([]);
    expect(r.score).toBeGreaterThanOrEqual(90);
  });

  const mutate = (fn: (s: WorldSpec) => void) => {
    const s = validSpec();
    fn(s);
    return s;
  };

  type Mut = (s: WorldSpec) => void;
  const cases: [string, Mut][] = [
    ["ARC_FIRST", (s) => void (s.beats[0]!.kind = "concept")],
    ["ARC_LAST", (s) => void (s.beats[s.beats.length - 1]!.kind = "recap")],
    ["BEAT_COUNT", (s) => void s.beats.splice(2, 3)],
    ["NO_MECHANISM", (s) => s.beats.forEach((b) => void (b.kind === "mechanism" && (b.kind = "concept")))],
    ["CHECK_COUNT", (s) => void (s.beats[6] = beat("b07", "concept", "wave"))],
    ["CHECK_EARLY", (s) => void (s.beats[1] = checkBeat("b02", "sphere"))],
    ["CHECK_CHOICES", (s) => void s.beats[3]!.check.choices.splice(1, 2)],
    ["CHECK_DISTRACTOR", (s) => s.beats[3]!.check.choices.forEach((c) => void (c.misconceptionId = ""))],
    ["NO_MISCONCEPTION_BEAT", (s) => void (s.beats[4]!.kind = "concept")],
    ["SENTENCE_COUNT", (s) => void (s.beats[1]!.sentences = [s.beats[1]!.sentences[0]!])],
    ["SENTENCE_LONG", (s) => void (s.beats[1]!.sentences[0]!.text = Array.from({ length: 40 }, () => "luz").join(" ") + ".")],
    ["CITATION_COVERAGE", (s) => s.beats.forEach((b) => b.sentences.forEach((x) => void (x.factIds = [])))],
    ["SHAPE_REPEAT", (s) => [1, 2, 5, 7].forEach((i) => void (s.beats[i]!.layers = [makeLayer("sphere")]))],
    ["SHAPE_CAMERA_REPEAT", (s) => void (s.beats[2]!.layers = [makeLayer("sphere")])],
    ["TRANSITION_VARIETY", (s) => s.beats.forEach((b) => void (b.transition = "flow"))],
    ["SHAPE_VARIETY", (s) => s.beats.forEach((b, i) => void (b.layers = [makeLayer(i % 2 ? "sphere" : "nebula")]))],
    ["PARAMATH", (s) => void (s.beats[2]!.layers = [makeLayer("surface", { expr: [{ key: "f", value: "window.x" }] })])],
    [
      "READABILITY",
      (s) => s.beats.forEach((b) => b.sentences.forEach((x) => void (x.text = "La fotofosforilación acíclica bioenergética transmembranal electroquímica."))),
    ],
    ["CONCEPT_CYCLE", (s) => void (s.concepts[0]!.dependsOn = ["C02"])],
    ["CHECK_UNSEEN_CONCEPT", (s) => void (s.beats[3]!.check.conceptIds = ["C02"])],
  ];
  it.each(cases)("flags %s", (code, fn) => {
    expect(codes(validSpec())).not.toContain(code);
    expect(codes(mutate(fn))).toContain(code);
  });

  it("does not require citation coverage for general-knowledge sources", () => {
    const s = mutate((x) => x.beats.forEach((b) => b.sentences.forEach((y) => (y.factIds = []))));
    expect(lint(s, "general").warnings.map((w) => w.code)).not.toContain("CITATION_COVERAGE");
  });
});
