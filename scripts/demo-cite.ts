// pnpm demo:cite — turns each demo fact's literal `quote` into a char_location citation against its source.
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { World } from "../src/lib/world/types";
import { paragraphAt } from "../src/lib/world/paragraph";

const dir = "public/worlds";
let failures = 0;
const only = process.argv[2];
const files = readdirSync(dir).filter((f) => f.endsWith(".json") && !f.startsWith("_") && f !== "index.json" && f !== "eidos-pitch.json" && (!only || f.replace(/\.en\.json$|\.json$/, "") === only));
for (const f of files) {
  const world = JSON.parse(readFileSync(join(dir, f), "utf8")) as World;
  const isEn = f.endsWith(".en.json");
  const base = f.replace(/\.en\.json$|\.json$/, "");
  const srcPath = join("content/sources", `${base}${isEn ? ".en" : ""}.md`);
  if (!existsSync(srcPath)) {
    console.error(`✗ ${f}: missing source ${srcPath}`);
    failures++;
    continue;
  }
  const source = readFileSync(srcPath, "utf8");
  const title = (/^#\s+(.+)$/m.exec(source)?.[1] ?? world.source.title).trim();
  let n = 0;
  for (const fact of world.facts) {
    if (!fact.quote) {
      if (fact.origin === "source") {
        console.error(`✗ ${f}: fact ${fact.id} has origin "source" but no quote`);
        failures++;
      }
      continue;
    }
    const start = source.indexOf(fact.quote);
    if (start < 0) {
      console.error(`✗ ${f}: fact ${fact.id} quote not found literally in ${srcPath}:\n    "${fact.quote}"`);
      failures++;
      continue;
    }
    const paragraph = paragraphAt(source, start);
    fact.citations = [{ kind: "char", citedText: fact.quote, documentIndex: 0, documentTitle: title, startChar: start, endChar: start + fact.quote.length, paragraph }];
    fact.origin = "source";
    n++;
  }
  world.source = { ...world.source, mode: "text", title };
  // Demo verification is a literal-citation check (no Skeptic call without an API key); the note says so.
  const cited = new Set(world.facts.filter((x) => x.citations.length > 0).map((x) => x.id));
  const note = isEn ? "Literal citation checked (demo world, reviewed by hand)" : "Cita literal comprobada (mundo de demostración, revisado a mano)";
  world.verification = {};
  for (const b of world.spec.beats) {
    if (b.kind === "finale") continue;
    world.verification[b.id] = b.sentences.map((s, index) =>
      s.factIds.length === 0
        ? { index, verdict: "general" as const, supportingFactIds: [], note: "", revised: false }
        : s.factIds.every((id) => cited.has(id))
          ? { index, verdict: "supported" as const, supportingFactIds: s.factIds, note, revised: false }
          : { index, verdict: "partial" as const, supportingFactIds: s.factIds.filter((id) => cited.has(id)), note: isEn ? "Some cited facts have no passage" : "Algunos hechos citados no tienen pasaje", revised: false },
    );
  }
  writeFileSync(join(dir, f), JSON.stringify(world, null, 1) + "\n");
  console.log(`✓ ${f}: ${n} citations`);
}
if (failures) {
  console.error(`\n${failures} problem(s).`);
  process.exit(1);
}
