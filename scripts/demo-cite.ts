// pnpm demo:cite — turns each demo fact's literal `quote` into a char_location citation against its source.
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { World } from "../src/lib/world/types";

const dir = "public/worlds";
let failures = 0;
const files = readdirSync(dir).filter((f) => f.endsWith(".json") && !f.startsWith("_") && f !== "index.json");
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
    fact.citations = [{ kind: "char", citedText: fact.quote, documentIndex: 0, documentTitle: title, startChar: start, endChar: start + fact.quote.length }];
    fact.origin = "source";
    n++;
  }
  world.source = { ...world.source, mode: "text", title };
  writeFileSync(join(dir, f), JSON.stringify(world, null, 1) + "\n");
  console.log(`✓ ${f}: ${n} citations`);
}
if (failures) {
  console.error(`\n${failures} problem(s).`);
  process.exit(1);
}
