// pnpm synth-replay --world <id> [--write-telemetry]
// Builds a plausible forge replay from a finished demo world (spec 12.1): realistic stage timing, short thinking
// summaries written from the world's own content, estimated usage. Always marked `synthetic: true`.
import { mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import type { AgentRun, World } from "../src/lib/world/types";
import { costOf } from "../src/lib/pricing";
import { createRng } from "../src/engine/util/rng";

const at = process.argv.indexOf("--world");
const only = at >= 0 ? process.argv[at + 1] : undefined;
const files = readdirSync("public/worlds").filter((f) => f.endsWith(".json") && !f.startsWith("_") && !f.startsWith("zz-") && f !== "index.json" && f !== "eidos-pitch.json" && (!only || f.replace(/\.json$/, "") === only || f.replace(/\.en\.json$/, "") === only));

const tokens = (s: string) => Math.ceil(s.length / 3.6);

function run(agent: AgentRun["agent"], model: string, effort: string, startedAt: number, durationMs: number, input: number, output: number, cacheRead = 0, thinking = ""): AgentRun {
  return {
    id: `${agent}-${startedAt}`,
    agent,
    model,
    effort,
    startedAt: new Date(Date.UTC(2026, 10, 13, 12) + startedAt).toISOString(),
    durationMs,
    inputTokens: input,
    outputTokens: output,
    cacheReadTokens: cacheRead,
    cacheWriteTokens: 0,
    webSearches: 0,
    webFetches: 0,
    costUsd: costOf(model, { input_tokens: input, output_tokens: output, cache_read_input_tokens: cacheRead }),
    stopReason: "end_turn",
    thinkingSummary: thinking,
    replay: true,
  };
}

for (const f of files) {
  const path = `public/worlds/${f}`;
  const w = JSON.parse(readFileSync(path, "utf8")) as World;
  const es = w.spec.language === "es";
  const rng = createRng(`synth:${w.id}`);
  const ev: { t: number; type: string; data: unknown }[] = [];
  const push = (t: number, type: string, data: unknown) => ev.push({ t: Math.round(t), type, data });
  const concepts = w.spec.concepts;
  const hook = w.spec.beats[0]!;
  const mis = w.misconceptions[0];
  const firstCheck = w.spec.beats.findIndex((b) => b.kind === "check");
  const source = readFileSync(`content/sources/${f.replace(/\.json$/, ".md")}`, "utf8");

  const cartoThoughts = es
    ? [
        `Leo la fuente completa sobre «${w.spec.title}» y separo mecanismos, definiciones y cifras.`,
        `Cada hecho debe sostenerse solo y llevar su pasaje: resuelvo pronombres y nombro el sujeto.`,
        `Identifico ${concepts.length} conceptos; ${concepts[1]?.name ?? concepts[0]?.name} depende de ${concepts[0]?.name}.`,
        mis ? `Un malentendido frecuente: «${mis.wrongIdea}». Lo anoto con los hechos que lo corrigen.` : `Busco malentendidos frecuentes y los hechos que los corrigen.`,
        `Propongo la paleta ${w.spec.palette} y motivos visuales sacados de la propia fuente.`,
      ]
    : [
        `Reading the whole source on “${w.spec.title}”, separating mechanisms, definitions and numbers.`,
        `Each fact must stand on its own and carry its passage: resolving pronouns, naming the subject.`,
        `${concepts.length} concepts; ${concepts[1]?.name ?? concepts[0]?.name} depends on ${concepts[0]?.name}.`,
        mis ? `A common misconception: “${mis.wrongIdea}”. Noting the facts that correct it.` : `Looking for common misconceptions and the facts that correct them.`,
        `Suggesting the ${w.spec.palette} palette and visual motifs taken from the source itself.`,
      ];
  const dirThoughts = es
    ? [
        `Abro con una imagen que sorprenda: «${hook.title}».`,
        `Presento ${concepts[0]?.name} antes de usarlo en el mecanismo.`,
        `Formas que se transforman con sentido: cada escena hereda algo de la anterior.`,
        firstCheck >= 0 ? `La primera comprobación va en la escena ${firstCheck + 1}, cuando ya hay con qué razonar.` : `Coloco las comprobaciones cuando ya hay con qué razonar.`,
        `El error común se deshace con una transición de disolución.`,
      ]
    : [
        `Opening with an image that surprises: “${hook.title}”.`,
        `Introducing ${concepts[0]?.name} before the mechanism uses it.`,
        `Forms that morph with meaning: every scene inherits something from the previous one.`,
        firstCheck >= 0 ? `The first check goes in scene ${firstCheck + 1}, once there is something to reason with.` : `Placing the checks once there is something to reason with.`,
        `The common misconception falls apart with a dissolve transition.`,
      ];
  const skepThought = es ? "Reviso que cada oración diga solo lo que dicen sus hechos citados." : "Checking that every sentence says only what its cited facts say.";

  let t = 0;
  push(t, "stage", { stage: "ingest", status: "start", detail: { mode: "text" } });
  t += 1800;
  push(t, "stage", { stage: "ingest", status: "done", detail: { title: w.source.title } });
  push(t, "session", { sessionToken: null, worldId: w.id });
  // Cartographer: thinking, then a fact every ~0.6 s
  const cartoStart = t;
  push(t, "stage", { stage: "cartographer", status: "start", detail: { mode: "text" } });
  cartoThoughts.slice(0, 2).forEach((line, i) => push(t + 900 + i * 1700, "thinking", { agent: "cartographer", delta: line + "\n" }));
  t += 4200;
  w.facts.forEach((fact, i) => {
    push(t + i * 600, "fact", fact);
    if (i === Math.floor(w.facts.length / 3)) push(t + i * 600 + 200, "thinking", { agent: "cartographer", delta: cartoThoughts[2] + "\n" });
    if (i === Math.floor((2 * w.facts.length) / 3)) push(t + i * 600 + 200, "thinking", { agent: "cartographer", delta: cartoThoughts[3] + "\n" });
  });
  t += w.facts.length * 600 + 400;
  push(t - 200, "thinking", { agent: "cartographer", delta: cartoThoughts[4] + "\n" });
  push(t, "ledger", { facts: w.facts, concepts, misconceptions: w.misconceptions, profile: { title: w.spec.title, domain: "", difficulty: w.spec.level, palette: w.spec.palette, visualMotifs: [], numbers: [] } });
  const cartoOut = tokens(w.facts.map((x) => x.text).join("\n")) + 900;
  const cartoRun = run("cartographer", "claude-opus-5-5", "high", cartoStart, t - cartoStart, tokens(source) + 2600, cartoOut, 0, cartoThoughts.join(" "));
  push(t, "usage", cartoRun);
  push(t, "stage", { stage: "cartographer", status: "done", detail: { facts: w.facts.length, concepts: concepts.length, misconceptions: w.misconceptions.length } });

  // Director: meta early, a beat every ~2.5 s; the Skeptic checks pairs in parallel
  const dirStart = t;
  push(t, "stage", { stage: "director", status: "start" });
  dirThoughts.forEach((line, i) => push(t + 600 + i * 2400, "thinking", { agent: "director", delta: line + "\n" }));
  t += 3600;
  push(t, "meta", { title: w.spec.title, subtitle: w.spec.subtitle, palette: w.spec.palette, level: w.spec.level, language: w.spec.language, concepts });
  const runs: AgentRun[] = [cartoRun];
  let pending: string[] = [];
  w.spec.beats.forEach((b, i) => {
    const bt = t + 1500 + i * 2500;
    push(bt, "beat", b);
    if (b.kind !== "finale" && b.kind !== "check") pending.push(b.id);
    if (pending.length === 2 || (i === w.spec.beats.length - 1 && pending.length)) {
      const vt = bt + 2600 + rng.range(0, 900);
      if (pending.length === 2) push(vt - 1800, "thinking", { agent: "skeptic", delta: skepThought + "\n" });
      for (const id of pending) {
        const beat = w.spec.beats.find((x) => x.id === id)!;
        push(vt, "verify", { beatId: id, results: w.verification[id] ?? [], revisedSentences: beat.sentences });
      }
      const sk = run("skeptic", "claude-sonnet-5-5", "medium", vt - 2600, 2600, 2200 + tokens(JSON.stringify(w.facts)) , 600, 0, skepThought);
      runs.push(sk);
      push(vt, "usage", sk);
      pending = [];
    }
  });
  t += 1500 + w.spec.beats.length * 2500;
  const dirRun = run("director", "claude-opus-5-5", "high", dirStart, t - dirStart, tokens(JSON.stringify(w.facts)) + 1400, tokens(JSON.stringify(w.spec)) + 1800, 9200, dirThoughts.join(" "));
  runs.splice(1, 0, dirRun);
  push(t, "usage", dirRun);
  push(t, "stage", { stage: "director", status: "done", detail: { beats: w.spec.beats.length } });
  push(t + 100, "world", { spec: w.spec, specReport: w.specReport, lintReport: w.lintReport, worldId: w.id, source: w.source });
  t += 4200;
  push(t, "stage", { stage: "skeptic", status: "done" });
  const total = runs.reduce((s, r) => s + (r.costUsd ?? 0), 0);
  push(t + 50, "done", { worldId: w.id, totalCostUsd: Math.round(total * 1000) / 1000, durationMs: t });
  ev.sort((a, b) => a.t - b.t);

  mkdirSync("public/replays", { recursive: true });
  const out = `public/replays/${f.replace(/\.json$/, "")}.forge.json`;
  writeFileSync(out, JSON.stringify({ kind: "forge", worldId: w.id, recordedAt: new Date().toISOString(), synthetic: true, events: ev }));
  // the Engine Room of demo worlds shows this synthetic telemetry, labelled as a replay
  w.telemetry = runs.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  w.demoAssets = { ...(w.demoAssets ?? {}), forgeReplay: `/replays/${f.replace(/\.json$/, "")}.forge.json` };
  writeFileSync(path, JSON.stringify(w, null, 1) + "\n");
  console.log(`✓ ${out}: ${ev.length} events, ${(t / 1000).toFixed(0)} s, est. $${total.toFixed(3)}`);
}
