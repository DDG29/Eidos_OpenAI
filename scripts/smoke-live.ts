// pnpm smoke:live — full live pipeline on content/smoke/fuente-corta.md (Fast), then ask, grade, grow and lens.
// Hard limit: aborts as soon as the estimated cumulative cost exceeds 2 USD (spec 14.5).
import { readFileSync } from "node:fs";
import { makeClient, streamAgent, type StreamAgent } from "../src/server/ai/claude";
import { runForge } from "../src/server/forge/runForge";
import { ask, grade, grow, lens } from "../src/server/agents/live";
import { loadFontsFromDisk } from "../src/test/fonts";
import type { AgentRun } from "../src/lib/world/types";

const key = process.env.ANTHROPIC_API_KEY?.trim();
if (!key) {
  console.error("smoke:live needs ANTHROPIC_API_KEY. Nothing was run (Demo Mode covers the no-key path).");
  process.exit(1);
}
loadFontsFromDisk();
const LIMIT = 2;
let spent = 0;
const ctrl = new AbortController();
const onRun = (r: AgentRun) => {
  spent += r.costUsd ?? 0;
  console.log(
    `  ${r.agent.padEnd(12)} ${r.model.padEnd(18)} ${(r.durationMs / 1000).toFixed(1)}s  in ${r.inputTokens} out ${r.outputTokens} cache ${r.cacheReadTokens}  $${(r.costUsd ?? 0).toFixed(4)}  (total $${spent.toFixed(3)})`,
  );
  if (spent > LIMIT) {
    console.error(`Cost limit of ${LIMIT} USD exceeded — aborting.`);
    ctrl.abort();
  }
};
const stream: StreamAgent = (req, h, o) => streamAgent(req, h, { ...o, signal: ctrl.signal });
const t0 = Date.now();
const text = readFileSync("content/smoke/fuente-corta.md", "utf8");
const events: string[] = [];
const res = await runForge({ mode: "text", text, level: "prepa", lang: "es", quality: "fast" }, (e) => events.push(e), {
  stream,
  apiKey: key,
  client: makeClient(key),
  signal: ctrl.signal,
  onSpend: onRun,
});
console.log(`forge: ${res.spec.beats.length} beats, ${res.ledger.facts.length} facts, lint ${res.lintReport.score}, ${((Date.now() - t0) / 1000).toFixed(0)} s, ${events.length} events`);
const o = { apiKey: key, signal: ctrl.signal, stream, onRun };
const b = res.spec.beats[2]!;
await ask(
  {
    worldId: res.worldId,
    sessionToken: res.sessionToken ?? undefined,
    beat: { id: b.id, kind: b.kind, title: b.title, shapes: b.layers.map((l) => l.shape), sentences: b.sentences.map((s) => s.text) },
    question: "¿Puedes explicarlo con otras palabras?",
    history: [],
    level: "prepa",
    lang: "es",
    facts: res.ledger.facts.map((f) => ({ id: f.id, text: f.text })),
  },
  () => {},
  o,
  makeClient(key),
);
const check = res.spec.beats.find((x) => x.kind === "check")!;
const g = await grade(
  {
    question: check.check.question,
    idealAnswer: check.check.idealAnswer,
    answer: "No estoy seguro, creo que es al azar.",
    misconceptions: res.ledger.misconceptions,
    facts: res.ledger.facts.map((f) => ({ id: f.id, text: f.text })),
    level: "prepa",
    lang: "es",
  },
  o,
);
console.log(`grade: ${g.verdict}`);
const summary = res.spec.beats.map((x) => ({ id: x.id, kind: x.kind, title: x.title, shapes: x.layers.map((l) => l.shape), sentences: x.sentences.map((s) => s.text) }));
const facts = res.ledger.facts.map((f) => ({ id: f.id, text: f.text, conceptId: f.conceptId, origin: f.origin, citations: f.citations.slice(0, 1) }));
const grown = await grow(
  {
    worldSummary: summary,
    checkBeat: check,
    answer: "al azar",
    grade: { verdict: g.verdict, missingIdea: g.missingIdea, matchedMisconceptionId: g.matchedMisconceptionId },
    facts,
    misconceptions: res.ledger.misconceptions,
    concepts: res.spec.concepts,
    palette: res.spec.palette,
    idPrefix: "r01",
    level: "prepa",
    lang: "es",
    quality: "fast",
  },
  () => {},
  o,
);
console.log(`grow: ${grown.length} beats`);
const l = await lens({ beats: res.spec.beats.slice(0, 3).map((x) => ({ id: x.id, sentences: x.sentences })), targetLevel: "curioso", lang: "es" }, o);
console.log(`lens: ${l.beats.length} beats rewritten`);
console.log(`\nSmoke test passed: $${spent.toFixed(3)} in ${((Date.now() - t0) / 1000).toFixed(0)} s.`);
