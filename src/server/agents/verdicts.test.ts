import { describe, expect, it } from "vitest";
import { beat } from "@/test/worldFixture";
import { applyVerdicts, type SkepticResult } from "./verdicts";

const facts = new Set(["F01", "F02", "F03"]);
const b = () =>
  beat("b02", "concept", "sphere", {
    sentences: [
      { text: "Uno.", factIds: ["F01"] },
      { text: "Dos.", factIds: ["F02"] },
      { text: "Tres.", factIds: [] },
      { text: "Cuatro.", factIds: ["F03"] },
    ],
  });
const r = (index: number, verdict: SkepticResult["verdict"], revision = "", support: string[] = []): SkepticResult => ({ beatId: "b02", index, verdict, supportingFactIds: support, note: "nota", revision });

describe("applyVerdicts", () => {
  it("keeps supported/general, revises partial with facts, drops contradicted", () => {
    const out = applyVerdicts(b(), [r(0, "supported", "", ["F01"]), r(1, "partial", "Dos revisada.", ["F02"]), r(2, "general"), r(3, "contradicted")], facts);
    expect(out.sentences.map((s) => s.text)).toEqual(["Uno.", "Dos revisada.", "Tres."]);
    expect(out.verdicts.map((v) => [v.index, v.verdict, v.revised])).toEqual([
      [0, "supported", false],
      [1, "supported", true],
      [2, "general", false],
    ]);
    expect(out.verdicts[1]!.originalText).toBe("Dos.");
  });
  it("partial without revision stays amber", () => {
    const out = applyVerdicts(b(), [r(0, "partial")], facts);
    expect(out.verdicts[0]).toMatchObject({ verdict: "partial", revised: false });
  });
  it("never leaves fewer than 2 sentences: rescues the best unsupported as partial", () => {
    const out = applyVerdicts(b(), [r(0, "contradicted"), r(1, "unsupported"), r(2, "contradicted"), r(3, "unsupported")], facts);
    expect(out.sentences).toHaveLength(2);
    expect(out.verdicts.every((v) => v.verdict === "partial")).toBe(true);
  });
  it("ignores supporting facts that are not in the ledger (no faithful revision → sentence removed)", () => {
    const out = applyVerdicts(b(), [r(1, "unsupported", "Otra.", ["F99"])], facts);
    const texts = out.sentences.map((s) => s.text);
    expect(texts).not.toContain("Otra.");
    expect(texts).not.toContain("Dos.");
    expect(texts).toHaveLength(3);
  });
});
