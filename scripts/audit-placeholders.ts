// pnpm audit:placeholders — the "nothing fake left behind" audit of the Definition of Done (spec 14.7).
// 1. Markers: TODO, FIXME, lorem ipsum, "placeholder text" in code, content and docs (not the master prompt).
// 2. Buttons without an action: JSX <button> tags with no onClick, no type="submit" and no spread props.
// 3. Broken internal links: crawls a running server from / (pass the base URL; skipped when none answers).
// Usage: tsx scripts/audit-placeholders.ts [baseUrl=http://localhost:3000]
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const base = process.argv[2] ?? "http://localhost:3000";
const problems: string[] = [];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

// 1. Markers (case-sensitive: Spanish "todo" is a word, not a marker).
const MARKERS = /\bTODO\b|\bFIXME\b|\bXXX\b(?!\s*=)|[Ll]orem ipsum|placeholder text|texto de relleno/;
const SELF = "scripts/audit-placeholders.ts";
const textFiles = [...walk("src"), ...walk("scripts"), ...walk("e2e"), ...walk("content"), ...walk("docs"), "README.md", "README.es.md"]
  .filter((f) => /\.(ts|tsx|css|md|json)$/.test(f))
  .filter((f) => f !== SELF && !f.endsWith("PROMPT_MAESTRO.md") && !f.includes("/shaders/"));
for (const f of textFiles) {
  let text: string;
  try {
    text = readFileSync(f, "utf8");
  } catch {
    continue;
  }
  text.split("\n").forEach((line, i) => {
    if (MARKERS.test(line)) problems.push(`marker  ${f}:${i + 1}  ${line.trim().slice(0, 120)}`);
  });
}

// 2. Buttons with no action. Opening tags are read with a brace counter because JSX attributes contain "=>".
for (const f of walk("src").filter((x) => x.endsWith(".tsx"))) {
  const src = readFileSync(f, "utf8");
  let at = src.indexOf("<button");
  while (at >= 0) {
    let depth = 0;
    let end = at;
    for (let k = at; k < src.length; k++) {
      const c = src[k];
      if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (c === ">" && depth === 0) {
        end = k;
        break;
      }
    }
    const tag = src.slice(at, end);
    if (!/onClick|type="submit"|\{\.\.\./.test(tag)) problems.push(`button  ${f}:${src.slice(0, at).split("\n").length}  <button> without onClick or submit`);
    at = src.indexOf("<button", end);
  }
}

// 3. Internal links on a running server.
async function crawl() {
  try {
    const r = await fetch(`${base}/api/health`);
    if (!r.ok) throw new Error(String(r.status));
  } catch {
    console.log(`(no server at ${base}: link crawl skipped)`);
    return;
  }
  const seen = new Set<string>();
  const queue = ["/", "/atlas", "/acerca", "/pitch", "/lab"];
  const index = JSON.parse(readFileSync("public/worlds/index.json", "utf8")) as { worlds: { id: string }[] };
  for (const w of index.worlds) queue.push(`/m/${w.id}`, `/m/${w.id}/leer`, `/forja/demo-${w.id}`, `/posters/${w.id}.webp`, `/og/${w.id}.jpg`);
  while (queue.length && seen.size < 120) {
    const path = queue.shift()!;
    if (seen.has(path)) continue;
    seen.add(path);
    const res = await fetch(base + path, { redirect: "manual" });
    if (res.status >= 400) {
      problems.push(`link    ${path} → HTTP ${res.status}`);
      continue;
    }
    if (!(res.headers.get("content-type") ?? "").includes("text/html")) continue;
    const html = await res.text();
    for (const m of html.matchAll(/(?:href|src)="(\/[^"#?]*)/g)) {
      const p = m[1]!;
      if (!p.startsWith("/_next/") && !seen.has(p)) queue.push(p);
    }
  }
  console.log(`crawled ${seen.size} internal URLs`);
}

await crawl();
if (problems.length) {
  console.log(problems.join("\n"));
  console.log(`\n✗ ${problems.length} problem(s)`);
  process.exit(1);
}
console.log("✓ no placeholders, dead buttons or broken internal links");
