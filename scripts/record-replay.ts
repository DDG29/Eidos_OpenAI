// pnpm record-replay --world <id> [--base http://localhost:3000] [--quality deep]
// Records a real forge of content/sources/<id>.md through a running server that has an API key, and writes
// public/replays/<id>.forge.json with `synthetic: false`. The forge reducer plays recorded and synthesized replays
// the same way. Thinking summaries are kept as streamed; review the file before committing it.
import { readFileSync, writeFileSync } from "node:fs";
import { SSEParser } from "../src/lib/sse/parse";

const arg = (k: string, d?: string) => {
  const i = process.argv.indexOf(`--${k}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const id = arg("world");
const base = arg("base", "http://localhost:3000")!;
const quality = arg("quality", "deep")!;
if (!id || !/^[a-z0-9-]+$/.test(id)) {
  console.error("usage: pnpm record-replay --world <id> [--base http://localhost:3000] [--quality fast|deep|master]");
  process.exit(1);
}

const health = (await fetch(`${base}/api/health`).then((r) => r.json()).catch(() => null)) as { live?: boolean } | null;
if (!health) {
  console.error(`[record-replay] no server at ${base}. Start it with ANTHROPIC_API_KEY set (pnpm dev or pnpm start).`);
  process.exit(1);
}
if (!health.live) {
  console.error("[record-replay] the server is in Demo Mode (no API key). Nothing was recorded; use pnpm synth-replay instead.");
  process.exit(1);
}

const source = readFileSync(`content/sources/${id}.md`, "utf8");
const world = JSON.parse(readFileSync(`public/worlds/${id}.json`, "utf8")) as { spec: { level: string; language: string } };
const fd = new FormData();
fd.set("mode", "text");
fd.set("text", source.slice(0, 60000));
fd.set("level", world.spec.level);
fd.set("lang", world.spec.language);
fd.set("quality", quality);

const res = await fetch(`${base}/api/forge`, { method: "POST", body: fd, headers: { accept: "text/event-stream" } });
if (!res.ok || !res.body) {
  console.error(`[record-replay] forge failed: HTTP ${res.status} ${await res.text().catch(() => "")}`);
  process.exit(1);
}
const t0 = Date.now();
const events: { t: number; type: string; data: unknown }[] = [];
const parser = new SSEParser();
const decoder = new TextDecoder();
let cost = 0;
for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
  for (const e of parser.push(decoder.decode(chunk, { stream: true }))) {
    const data = JSON.parse(e.data) as Record<string, unknown>;
    // The encrypted session token is per user and per day: never store it in a public file.
    if (e.event === "session") data.sessionToken = null;
    if (e.event === "usage" && typeof data.costUsd === "number") cost += data.costUsd;
    events.push({ t: Date.now() - t0, type: e.event, data });
    if (e.event === "error") console.error(`[record-replay] error event: ${JSON.stringify(data).slice(0, 300)}`);
  }
}
const out = { kind: "forge", worldId: id, recordedAt: new Date().toISOString(), synthetic: false, events };
writeFileSync(`public/replays/${id}.forge.json`, JSON.stringify(out) + "\n");
console.log(`✓ public/replays/${id}.forge.json: ${events.length} events, ${Math.round((Date.now() - t0) / 1000)} s, $${cost.toFixed(3)}`);
