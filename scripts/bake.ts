// pnpm bake --world <id> — forge a demo world with the real pipeline (Text mode, Deep) from content/sources/<id>.md.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { makeClient, streamAgent } from "../src/server/ai/claude";
import { runForge } from "../src/server/forge/runForge";
import { loadFontsFromDisk } from "../src/test/fonts";
import type { World } from "../src/lib/world/types";

const at = process.argv.indexOf("--world");
const id = at >= 0 ? process.argv[at + 1] : undefined;
const key = process.env.ANTHROPIC_API_KEY?.trim();
if (!id) {
  console.error("usage: pnpm bake --world <id>");
  process.exit(1);
}
if (!key) {
  console.error("bake needs ANTHROPIC_API_KEY. Without it, demo worlds are authored by hand (docs/authoring/WORLD_AUTHORING.md).");
  process.exit(1);
}
loadFontsFromDisk();
const text = readFileSync(`content/sources/${id}.md`, "utf8");
const events: { t: number; type: string; data: unknown }[] = [];
const t0 = Date.now();
const res = await runForge(
  { mode: "text", text, level: "prepa", lang: id.endsWith(".en") ? "en" : "es", quality: "deep" },
  (type, data) => events.push({ t: Date.now() - t0, type, data }),
  { stream: streamAgent, apiKey: key, client: makeClient(key), signal: new AbortController().signal },
);
const world: World = {
  id,
  schemaVersion: 1,
  createdAt: new Date().toISOString(),
  origin: "demo",
  source: { mode: "text", title: res.sourceTitle },
  spec: res.spec,
  facts: res.ledger.facts,
  misconceptions: res.ledger.misconceptions,
  verification: res.verification,
  inserted: [],
  levelVariants: {},
  mastery: {},
  telemetry: res.telemetry,
  specReport: { corrections: res.specReport },
  lintReport: res.lintReport,
};
writeFileSync(`public/worlds/${id}.json`, JSON.stringify(world, null, 1) + "\n");
mkdirSync("public/replays", { recursive: true });
writeFileSync(`public/replays/${id}.forge.json`, JSON.stringify({ kind: "forge", worldId: id, recordedAt: new Date().toISOString(), synthetic: false, events }));
console.log(`baked ${id}: ${res.spec.beats.length} beats. Add remedials, lens variants and ask replays, then: pnpm worlds:check ${id}`);
