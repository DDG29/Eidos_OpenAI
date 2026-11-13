// pnpm eval — evaluation harness (spec 14.6).
// Static mode (default, no key): deterministic metrics over every demo world in public/worlds.
// Live mode (EVAL_LIVE=1) forges each source with the real pipeline and needs ANTHROPIC_API_KEY.
// Output: evals/report.json and evals/report.md.
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { WorldFileSchema } from "../src/lib/world/worldFile";
import { sanitizeWorldSpec } from "../src/lib/world/sanitize";
import { lintWorld } from "../src/lib/lint/pedagogy";
import { READABILITY_RANGES, readability } from "../src/lib/readability";
import { probeRegionsCached } from "../src/server/world/regionProbe";
import { loadFontsFromDisk } from "../src/test/fonts";
import type { Beat, World } from "../src/lib/world/types";

if (process.env.EVAL_LIVE === "1") {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("[eval] EVAL_LIVE=1 needs ANTHROPIC_API_KEY. Nothing was run; the static report is unchanged.");
    process.exit(1);
  }
  console.error("[eval] Live mode forges every source through /api/forge with a 6 USD cap; run `pnpm bake --world <id>` per source, then `pnpm eval` again to score the baked worlds.");
  process.exit(1);
}

loadFontsFromDisk();
const dir = "public/worlds";
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".json") && f !== "index.json" && !f.startsWith("_") && !f.startsWith("zz-") && !f.startsWith("eidos-pitch"))
  .sort();

interface Row {
  id: string;
  title: string;
  level: string;
  origin: string;
  schemaValid: boolean;
  sanitizerCorrections: number;
  lintScore: number;
  lintWarnings: number;
  citationCoverage: number; // % of trunk sentences with factIds
  supported: number; // % of verified sentences with verdict "supported"
  verificationKind: string;
  ledgerCoverage: number; // % of facts used by at least one trunk sentence
  shapes: number;
  transitions: number;
  cameras: number;
  checks: number;
  checksWithMisconceptionDistractor: number;
  readability: number;
  readabilityRange: [number, number];
  readabilityInRange: boolean;
  liveTelemetry: boolean;
}

const pct = (a: number, b: number) => (b ? Math.round((1000 * a) / b) / 10 : 0);
const rows: Row[] = [];

for (const f of files) {
  const raw = JSON.parse(readFileSync(join(dir, f), "utf8")) as unknown;
  const parsed = WorldFileSchema.safeParse(raw);
  const w = (parsed.success ? parsed.data : raw) as unknown as World;
  const trunk = w.spec.beats.filter((b) => b.kind !== "finale");
  const sentences = trunk.flatMap((b) => b.sentences);
  const factIds = new Set(w.facts.map((x) => x.id));
  const probe = (l: Beat["layers"][number]) => probeRegionsCached(l, w.spec.palette);
  const ctx = { factIds, conceptIds: new Set(w.spec.concepts.map((c) => c.id)), misconceptionIds: new Set(w.misconceptions.map((m) => m.id)), regionProbe: probe, enforceArc: true };
  const { report } = sanitizeWorldSpec(w.spec, ctx);
  const lint = lintWorld(w.spec, { facts: w.facts, misconceptions: w.misconceptions, sourceKind: "document", regionsOf: (b, li) => probe(b.layers[li]!) });
  const verdicts = Object.values(w.verification ?? {}).flat();
  const used = new Set(trunk.flatMap((b) => b.sentences.flatMap((s) => s.factIds)));
  const checks = w.spec.beats.filter((b) => b.kind === "check");
  const lang = w.spec.language;
  const range = READABILITY_RANGES[lang][w.spec.level];
  const score = readability(sentences.map((s) => s.text).join(" "), lang);
  const demoNote = verdicts.some((v) => /demostración|demo world/i.test(v.note));
  rows.push({
    id: f.replace(/\.json$/, ""),
    title: w.spec.title,
    level: w.spec.level,
    origin: w.origin,
    schemaValid: parsed.success,
    sanitizerCorrections: report.filter((r) => r.severity !== "info").length,
    lintScore: lint.score,
    lintWarnings: lint.warnings.length,
    citationCoverage: pct(sentences.filter((s) => s.factIds.length > 0).length, sentences.length),
    supported: pct(verdicts.filter((v) => v.verdict === "supported").length, verdicts.length),
    verificationKind: demoNote ? "literal-quote check" : "skeptic",
    ledgerCoverage: pct([...factIds].filter((id) => used.has(id)).length, factIds.size),
    shapes: new Set(trunk.flatMap((b) => b.layers.map((l) => l.shape))).size,
    transitions: new Set(w.spec.beats.map((b) => b.transition)).size,
    cameras: new Set(w.spec.beats.map((b) => b.camera)).size,
    checks: checks.length,
    checksWithMisconceptionDistractor: checks.filter((b) => b.check.choices.some((c, i) => i !== b.check.correctIndex && c.misconceptionId)).length,
    readability: Math.round(score),
    readabilityRange: range,
    readabilityInRange: score >= range[0] && score <= range[1],
    liveTelemetry: (w.telemetry ?? []).some((t) => !t.replay),
  });
}

const avg = (k: keyof Row) => Math.round((10 * rows.reduce((s, r) => s + Number(r[k]), 0)) / Math.max(1, rows.length)) / 10;
const summary = {
  worlds: rows.length,
  lintScore: avg("lintScore"),
  citationCoverage: avg("citationCoverage"),
  supported: avg("supported"),
  ledgerCoverage: avg("ledgerCoverage"),
  shapes: avg("shapes"),
  readabilityInRange: rows.filter((r) => r.readabilityInRange).length,
};

mkdirSync("evals", { recursive: true });
const ranAt = new Date().toISOString();
writeFileSync("evals/report.json", JSON.stringify({ mode: "static", ranAt, summary, rows }, null, 2) + "\n");

const md = [
  "# EIDOS evaluation report",
  "",
  `Mode: **static** (no API key; deterministic metrics over the demo worlds). Generated ${ranAt.slice(0, 10)} by \`pnpm eval\`.`,
  "",
  "Demo worlds were written by hand from the sources in `content/sources/` (DECISIONS #5). Their verification is a",
  "literal-quote check computed by `pnpm demo:cite`, not a Skeptic run, so the *supported* column measures that every",
  "cited sentence points at a passage that exists verbatim in the source. Latency, cost and the independent judge",
  "need live runs and are not reported here.",
  "",
  "| World | Level | Schema | Sanitizer fixes | Lint | Sentences cited | Supported | Ledger used | Shapes · transitions · cameras | Checks with misconception distractor | Readability (range) |",
  "|---|---|---|---|---|---|---|---|---|---|---|",
  ...rows.map(
    (r) =>
      `| ${r.title} | ${r.level} | ${r.schemaValid ? "valid" : "invalid"} | ${r.sanitizerCorrections} | ${r.lintScore} (${r.lintWarnings} warn.) | ${r.citationCoverage} % | ${r.supported} % (${r.verificationKind}) | ${r.ledgerCoverage} % | ${r.shapes} · ${r.transitions} · ${r.cameras} | ${r.checksWithMisconceptionDistractor}/${r.checks} | ${r.readability} ${r.readabilityInRange ? "✓" : "✗"} (${r.readabilityRange[0]}–${r.readabilityRange[1] > 150 ? "∞" : r.readabilityRange[1]}) |`,
  ),
  "",
  `**Averages over ${summary.worlds} worlds:** lint ${summary.lintScore} · sentences cited ${summary.citationCoverage} % · supported ${summary.supported} % · ledger used ${summary.ledgerCoverage} % · ${summary.shapes} distinct shapes per world · readability in range for ${summary.readabilityInRange}/${summary.worlds}.`,
  "",
  "Readability: INFLESZ for Spanish, Flesch reading ease for English, computed over the trunk narration.",
  "",
].join("\n");
writeFileSync("evals/report.md", md);
console.log(md);
