// pnpm worlds:check — strict schema + sanitizer + pedagogical linter + shape generation for every demo world.
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { WorldFileSchema } from "../src/lib/world/worldFile";
import { sanitizeBeat, sanitizeWorldSpec } from "../src/lib/world/sanitize";
import { lintWorld } from "../src/lib/lint/pedagogy";
import { composeScene } from "../src/engine/compile/compose";
import { probeRegionsCached } from "../src/server/world/regionProbe";
import { summarize } from "../src/lib/world/summary";
import { loadFontsFromDisk } from "../src/test/fonts";
import type { Beat, ReportItem, World } from "../src/lib/world/types";

loadFontsFromDisk();
const dir = "public/worlds";
const only = process.argv[2];
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".json") && f !== "index.json")
  .filter((f) => !only || f.startsWith(only))
  .sort();
let failed = 0;
const manifest: (ReturnType<typeof summarize> & { hasEnglish: boolean })[] = [];

for (const f of files) {
  const problems: string[] = [];
  const notes: string[] = [];
  const raw = JSON.parse(readFileSync(join(dir, f), "utf8")) as unknown;
  const parsed = WorldFileSchema.safeParse(raw);
  if (!parsed.success) {
    problems.push(...parsed.error.issues.slice(0, 12).map((i) => `schema: ${i.path.join(".")} ${i.message}`));
    console.log(`✗ ${f}\n  ${problems.join("\n  ")}`);
    failed++;
    continue;
  }
  const w = parsed.data as unknown as World;
  const internal = f.startsWith("_") || f.startsWith("eidos-pitch");
  const factIds = new Set(w.facts.map((x) => x.id));
  const conceptIds = new Set(w.spec.concepts.map((c) => c.id));
  const misIds = new Set(w.misconceptions.map((m) => m.id));
  const probe = (l: Beat["layers"][number]) => probeRegionsCached(l, w.spec.palette);
  const ctx = { factIds, conceptIds, misconceptionIds: misIds, regionProbe: probe, enforceArc: !internal };

  // 1. sanitizer must not need to fix anything substantive
  const { spec, report } = sanitizeWorldSpec(w.spec, ctx);
  const serious = report.filter((r) => r.severity !== "info");
  for (const r of serious) (r.severity === "error" ? problems : notes).push(`sanitize ${r.code}${r.beatId ? ` @${r.beatId}` : ""}: ${r.message}`);
  if (JSON.stringify(spec.beats.map((b) => b.annotations)) !== JSON.stringify(w.spec.beats.map((b) => b.annotations))) problems.push("sanitize changed annotations (invalid region ids)");

  // 2. linter
  if (!internal) {
    const lint = lintWorld(w.spec, { facts: w.facts, misconceptions: w.misconceptions, sourceKind: "document", regionsOf: (b, li) => probe(b.layers[li]!) });
    for (const e of lint.errors) problems.push(`lint ${e.code}${e.beatId ? ` @${e.beatId}` : ""}: ${e.message}`);
    if (lint.warnings.length > 3) problems.push(`lint: ${lint.warnings.length} warnings (max 3): ${lint.warnings.map((x) => x.code).join(", ")}`);
    for (const x of lint.warnings) notes.push(`lint ${x.code}${x.beatId ? ` @${x.beatId}` : ""}: ${x.message}`);
    notes.push(`lint score ${lint.score}`);
  }

  // 3. every beat (trunk, remedials, branches) generates without fallbacks or NaN
  const allBeats: Beat[] = [...w.spec.beats, ...Object.values(w.demoAssets?.remedials ?? {}).flat(), ...Object.values(w.demoAssets?.branches ?? {}).flat()];
  for (const b of allBeats) {
    const buf = composeScene({ layers: b.layers, palette: w.spec.palette, count: 16384, dustFraction: 0.06, seed: `check:${b.id}` });
    for (let i = 0; i < buf.positions.length; i++)
      if (!Number.isFinite(buf.positions[i]!)) {
        problems.push(`beat ${b.id}: non-finite positions`);
        break;
      }
    for (const warn of buf.warnings) (/(replaced by nebula|failed)/.test(warn) ? problems : notes).push(`beat ${b.id}: ${warn}`);
  }

  // 4. facts and citations
  if (!internal) {
    for (const x of w.facts) if (x.origin === "source" && x.citations.length === 0) problems.push(`fact ${x.id} has no citation (run pnpm demo:cite)`);
    const used = new Set(w.spec.beats.flatMap((b) => b.sentences.flatMap((s) => s.factIds)));
    notes.push(`ledger coverage ${Math.round((100 * [...factIds].filter((id) => used.has(id)).length) / Math.max(1, factIds.size))}%`);
  }

  // 5. demo assets
  const checkIds = new Set(w.spec.beats.filter((b) => b.kind === "check").map((b) => b.id));
  for (const [afterId, beats] of Object.entries(w.demoAssets?.remedials ?? {})) {
    if (!checkIds.has(afterId)) problems.push(`remedials keyed by "${afterId}" which is not a check beat`);
    const rep: ReportItem[] = [];
    beats.forEach((b, i) => sanitizeBeat(b, i, { ...ctx, idPrefix: b.id.slice(0, 3) }, rep));
    for (const r of rep.filter((x) => x.severity === "error")) problems.push(`remedial ${afterId}: ${r.message}`);
    for (const r of rep.filter((x) => x.severity === "warning")) notes.push(`remedial ${afterId}: ${r.code} ${r.message}`);
    if (!beats.some((b) => b.kind === "check")) problems.push(`remedials after ${afterId} need a follow-up check beat`);
  }
  if (!internal) {
    for (const c of checkIds) if (!w.demoAssets?.remedials?.[c]) problems.push(`no precomposed remedial for check ${c}`);
    const levels = Object.keys(w.levelVariants);
    if (levels.length < 4) problems.push(`level variants: ${levels.length}/4`);
    for (const [lvl, byBeat] of Object.entries(w.levelVariants)) {
      for (const b of w.spec.beats) {
        if (b.kind === "finale") continue;
        const v = byBeat[b.id];
        if (!v) {
          problems.push(`level ${lvl}: missing beat ${b.id}`);
          continue;
        }
        const allowed = new Set(b.sentences.flatMap((s) => s.factIds));
        for (const s of v) for (const id of s.factIds) if (!allowed.has(id)) problems.push(`level ${lvl} @${b.id}: fact ${id} not cited by the original beat`);
        if (v.length < 2 || v.length > 5) notes.push(`level ${lvl} @${b.id}: ${v.length} sentences`);
      }
    }
    const asks = w.demoAssets?.askReplays ?? [];
    if (asks.length < 3) problems.push(`askReplays: ${asks.length}/3`);
    for (const a of asks) {
      if (!w.spec.beats.some((b) => b.id === a.beatId)) problems.push(`askReplay "${a.question}" points to missing beat ${a.beatId}`);
      for (const p of a.answer) for (const id of p.factIds) if (!factIds.has(id)) problems.push(`askReplay "${a.question}": unknown fact ${id}`);
    }
    for (const b of w.spec.beats) if (!w.verification[b.id] && b.kind !== "finale") notes.push(`no verification for ${b.id}`);
  }

  const ok = problems.length === 0;
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗"} ${f} — ${w.spec.beats.length} beats, ${w.facts.length} facts`);
  for (const p of problems) console.log(`  ✗ ${p}`);
  if (process.argv.includes("--verbose") || !ok) for (const n of notes) console.log(`  · ${n}`);
  if (!internal && ok) {
    const base = f.replace(/\.en\.json$|\.json$/, "");
    manifest.push({ ...summarize(w), id: base, hasEnglish: existsSync(join(dir, `${base}.en.json`)) });
  }
}
if (!only) writeFileSync(join(dir, "index.json"), JSON.stringify({ generatedAt: new Date().toISOString(), worlds: manifest }, null, 1) + "\n");
if (failed) {
  console.log(`\n${failed} world(s) failed.`);
  process.exit(1);
}
console.log(`\nAll ${files.length} world files passed.`);
