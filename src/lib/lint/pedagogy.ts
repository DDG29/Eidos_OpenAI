import { compileParaMath } from "@/engine/paramath";
import { getShape } from "@/engine/shapes/registry";
import { parseSvgPath } from "@/engine/shapes/raster/svgPath";
import { READABILITY_RANGES, readability, words } from "@/lib/readability";
import type { Beat, Fact, LintReport, Misconception, ReportItem, WorldSpec } from "@/lib/world/types";

/**
 * Pedagogical linter (spec 8.8). Pure function: errors block (trigger a repair pass), warnings inform.
 * Score 0–100 starts at 100, −12 per error, −3 per warning.
 */

export interface LintOptions {
  facts: Fact[];
  misconceptions: Misconception[];
  /** "document" sources expect ≥80% cited sentences; "general" (no-tools topic mode) does not. */
  sourceKind: "document" | "general";
  /** region ids produced per (beatId, layerIndex) — optional; when present annotations are checked */
  regionsOf?: (beat: Beat, layerIndex: number) => string[];
}

export function lintWorld(spec: WorldSpec, opts: LintOptions): LintReport {
  const errors: ReportItem[] = [];
  const warnings: ReportItem[] = [];
  const err = (code: string, message: string, beatId?: string) => errors.push({ severity: "error", code, message, beatId });
  const warn = (code: string, message: string, beatId?: string) => warnings.push({ severity: "warning", code, message, beatId });
  const beats = spec.beats;

  // Arc
  if (beats[0]?.kind !== "hook") err("ARC_FIRST", "The first beat must be a hook.");
  if (beats[beats.length - 1]?.kind !== "finale") err("ARC_LAST", "The last beat must be the finale.");
  if (beats.length < 8 || beats.length > 14) err("BEAT_COUNT", `The trunk has ${beats.length} beats; it must have 8–14.`);
  if (!beats.some((b) => b.kind === "mechanism")) err("NO_MECHANISM", "At least one mechanism beat is required.");
  const checks = beats.map((b, i) => [b, i] as const).filter(([b]) => b.kind === "check");
  if (checks.length < 2 || checks.length > 3) err("CHECK_COUNT", `There are ${checks.length} check beats; there must be 2–3.`);
  for (const [b, i] of checks) if (i < 2) err("CHECK_EARLY", "Checks cannot be in the first two positions.", b.id);
  if (opts.misconceptions.length > 0 && !beats.some((b) => b.kind === "misconception")) warn("NO_MISCONCEPTION_BEAT", "The ledger lists misconceptions but no misconception beat names one.");

  // Checks quality
  for (const [b] of checks) {
    const c = b.check;
    if (!c.enabled) err("CHECK_DISABLED", "A check beat must have check.enabled = true.", b.id);
    if (c.choices.length < 3 || c.choices.length > 4) err("CHECK_CHOICES", `A check needs 3–4 choices (has ${c.choices.length}).`, b.id);
    if (c.correctIndex < 0 || c.correctIndex >= c.choices.length) err("CHECK_CORRECT", "correctIndex is out of range.", b.id);
    if (!c.question.trim()) err("CHECK_QUESTION", "The check has no question.", b.id);
    const linked = c.choices.some((ch, i) => i !== c.correctIndex && ch.misconceptionId);
    if (!linked) err("CHECK_DISTRACTOR", "At least one distractor must be tied to a misconception ID.", b.id);
  }

  // Sentences
  let trunkSentences = 0;
  let cited = 0;
  for (const b of beats) {
    if (b.kind === "finale") continue;
    if (b.sentences.length < 2 || b.sentences.length > 5) warn("SENTENCE_COUNT", `Beat has ${b.sentences.length} sentences (2–5 expected).`, b.id);
    for (const s of b.sentences) {
      trunkSentences++;
      if (s.factIds.length) cited++;
      const n = words(s.text).length;
      if (n > 32) warn("SENTENCE_LONG", `A sentence has ${n} words (max 32).`, b.id);
    }
  }
  if (opts.sourceKind === "document" && trunkSentences > 0 && cited / trunkSentences < 0.8)
    warn("CITATION_COVERAGE", `${Math.round((100 * cited) / trunkSentences)}% of sentences cite facts (≥ 80% expected).`);

  // Variety
  const mainShape = (b: Beat) => b.layers[0]?.shape ?? "nebula";
  const shapeUses = new Map<string, number>();
  for (const b of beats) {
    if (b.kind === "finale") continue;
    for (const s of new Set(b.layers.map((l) => l.shape))) shapeUses.set(s, (shapeUses.get(s) ?? 0) + 1);
  }
  for (const [s, n] of shapeUses) if (n > 3) warn("SHAPE_REPEAT", `Shape "${s}" appears in ${n} beats (max 3).`);
  for (let i = 1; i < beats.length; i++) {
    const a = beats[i - 1]!,
      b = beats[i]!;
    if (b.kind === "finale") continue;
    if (mainShape(a) === mainShape(b) && a.camera === b.camera) warn("SHAPE_CAMERA_REPEAT", `Consecutive beats repeat shape "${mainShape(b)}" with camera "${b.camera}".`, b.id);
  }
  const transitions = new Set(beats.map((b) => b.transition));
  if (transitions.size < 4) warn("TRANSITION_VARIETY", `Only ${transitions.size} distinct transitions (≥ 4 expected).`);
  if (shapeUses.size < 6) warn("SHAPE_VARIETY", `Only ${shapeUses.size} distinct shapes (≥ 6 expected).`);

  // Expressions and glyphs
  for (const b of beats) {
    b.layers.forEach((l, li) => {
      const def = getShape(l.shape);
      if (!def) return;
      for (const e of l.expr) {
        const spec = def.expr.find((x) => x.key === e.key);
        if (!spec) continue;
        if (spec.kind === "paramath" && !compileParaMath(e.value, spec.vars ?? []).ok) err("PARAMATH", `Layer ${li} expression "${e.key}" does not compile.`, b.id);
        if (spec.kind === "svgpath" && !parseSvgPath(e.value).ok) err("SVGPATH", `Layer ${li} glyph path is invalid.`, b.id);
      }
    });
    if (opts.regionsOf)
      for (const a of b.annotations) {
        const produced = b.layers[a.layerIndex] ? opts.regionsOf(b, a.layerIndex) : [];
        if (!produced.includes(a.regionId)) warn("ANNOTATION_REGION", `Annotation "${a.text}" points to missing region "${a.regionId}".`, b.id);
      }
  }

  // Readability
  const range = READABILITY_RANGES[spec.language][spec.level];
  const narr = beats
    .filter((b) => b.kind !== "finale")
    .flatMap((b) => b.sentences.map((s) => s.text))
    .join(" ");
  if (narr.trim()) {
    const score = readability(narr, spec.language);
    if (score < range[0] || score > range[1])
      warn("READABILITY", `${spec.language === "es" ? "INFLESZ" : "Flesch"} ${score.toFixed(0)} is outside the ${spec.level} range [${range[0]}, ${range[1] > 150 ? "∞" : range[1]}].`);
  }

  // Concept graph
  const deps = new Map(spec.concepts.map((c) => [c.id, c.dependsOn]));
  const state = new Map<string, number>();
  let cyclic = false;
  const visit = (id: string) => {
    if (state.get(id) === 1) {
      cyclic = true;
      return;
    }
    if (state.get(id) === 2) return;
    state.set(id, 1);
    for (const d of deps.get(id) ?? []) visit(d);
    state.set(id, 2);
  };
  for (const id of deps.keys()) visit(id);
  if (cyclic) warn("CONCEPT_CYCLE", "Concept dependencies contain a cycle.");

  // Checks only ask about presented concepts
  for (const [b, i] of checks) {
    const before = new Set(beats.slice(0, i).flatMap((x) => x.conceptIds));
    const missing = b.check.conceptIds.filter((c) => !before.has(c));
    if (missing.length) warn("CHECK_UNSEEN_CONCEPT", `Check asks about concepts not presented earlier: ${missing.join(", ")}.`, b.id);
  }

  void opts.facts;
  const score = Math.max(0, Math.min(100, 100 - errors.length * 12 - warnings.length * 3));
  return { score, errors, warnings };
}
