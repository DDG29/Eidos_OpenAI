import { listShapes } from "@/engine/shapes/registry";
import type { ShapeDefinition } from "@/engine/shapes/types";

/** Shape catalog text for the Director / Gardener / Brancher prompts, generated from the registry (spec 6.1, 9.6.3). */

function fmtNum(n: number) {
  return Number.isInteger(n) ? String(n) : String(+n.toFixed(4));
}

export function catalogEntry(s: ShapeDefinition): string {
  const params = s.params.length
    ? s.params.map((p) => `${p.key} ${fmtNum(p.default)} [${fmtNum(p.min)}..${fmtNum(p.max)}${p.integer ? " int" : ""}] ${p.doc}`).join("; ")
    : "none";
  const expr = s.expr.length
    ? s.expr.map((e) => `${e.key} (${e.kind}${e.vars?.length ? `, variables ${e.vars.join(", ")}` : ""}; max ${e.maxLength} chars; default "${e.default.length > 80 ? e.default.slice(0, 77) + "…" : e.default}") ${e.doc}`).join("; ")
    : "none";
  const data = s.data ? `${s.data.doc} (${s.data.minLength}–${s.data.maxLength} numbers)` : "none";
  const regions = s.regions.map((r) => `${r.id}${r.conditional ? "*" : ""}`).join(", ");
  return [`### ${s.id} — ${s.title}`, s.doc, `Good for: ${s.goodFor.join(", ")}.`, `Params: ${params}.`, `Expressions: ${expr}.`, `Data: ${data}.`, `Regions: ${regions}.`, `Motion: ${s.motionDoc}.`].join("\n");
}

export const CATALOG_PREAMBLE = `Each layer uses one shape below. "params" are {key, value} pairs from the list (other keys are dropped; values are clamped to the range). Region IDs marked * only exist for some parameter values; "{i}" means an index (0-based), e.g. bar_2. Shapes with ParaMath expressions also take free coefficients a, b, c (params a, b, c in [-10, 10]) that a knob can control — e.g. a "curve" with y = "0.8*((1 + a/100)^(t*30) - 1)/((1 + 15/100)^30 - 1)" and a knob on param "a" (interest rate in %).`;

export function buildCatalog(): string {
  return [CATALOG_PREAMBLE, "", ...listShapes().map(catalogEntry).join("\n\n").split("\n")].join("\n") + "\n";
}

/** One line per shape for the Tutor (spec 9.7.5). */
export function buildShortCatalog(): string {
  return (
    listShapes()
      .map((s) => `- ${s.id}: ${s.goodFor.slice(0, 3).join(", ")}; params ${s.params.slice(0, 4).map((p) => p.key).join(", ") || "none"}; regions ${s.regions.map((r) => r.id).join(", ")}`)
      .join("\n") + "\n"
  );
}
