import type Anthropic from "@anthropic-ai/sdk";
import { nanoid } from "nanoid";
import { EidosError, asEidosError } from "@/lib/errors";
import { API_SCHEMAS } from "@/lib/world/schema";
import { sanitizeBeat, sanitizeWorldSpec, type SanitizeContext } from "@/lib/world/sanitize";
import { lintWorld } from "@/lib/lint/pedagogy";
import type { AgentRun, Beat, Fact, Layer, LintReport, ReportItem, Sentence, SentenceVerdict, WorldSpec } from "@/lib/world/types";
import { IncrementalArrayScanner } from "@/lib/json/incrementalArray";
import { routeFor } from "@/server/ai/models";
import { textOf, type AgentContentBlock, type StreamAgent } from "@/server/ai/claude";
import { CARTOGRAPHER_MODE_RULES, CARTOGRAPHER_SYSTEM, FACT_RANGE, READER_SYSTEM, SKEPTIC_SYSTEM, directorSystem, learnerProfile } from "@/server/agents/prompts";
import { LedgerStream, parseLedger, renderLedgerForDirector, type ApiCitation, type Ledger } from "@/server/agents/cartographer/parseLedger";
import { applyVerdicts, type SkepticResult } from "@/server/agents/verdicts";
import { generalFallback, ingest, type IngestRequest, type Ingested } from "@/server/ingest";
import { sealSession } from "@/server/session/token";
import { probeRegionsCached } from "@/server/world/regionProbe";

/** Forge orchestration (spec 10.4): ingest → (reader) → cartographer → director ⇢ skeptic batches → world. */

export type Emit = (event: string, data: unknown) => void;

export interface ForgeDeps {
  stream: StreamAgent;
  apiKey: string;
  client: Anthropic;
  signal: AbortSignal;
  onSpend?: (run: AgentRun) => void;
  /** Resume after a failed later stage: reuse the ledger, skip ingest and the Cartographer (spec 3.5, 10.3). */
  resume?: { ledger: Ledger; sessionToken: string | null; sourceTitle: string };
}

const BEATS_RANGE = { fast: [8, 10], deep: [10, 13], master: [12, 14] } as const;
const SYS = (text: string, cache = true) => ({ type: "text" as const, text, ...(cache ? { cache_control: { type: "ephemeral" as const, ttl: "1h" as const } } : {}) });

export interface ForgeResult {
  worldId: string;
  spec: WorldSpec;
  ledger: Ledger;
  verification: Record<string, SentenceVerdict[]>;
  telemetry: AgentRun[];
  specReport: ReportItem[];
  lintReport: LintReport;
  sessionToken: string | null;
  sourceTitle: string;
  pages?: number;
}

export async function runForge(req: IngestRequest, emit: Emit, deps: ForgeDeps): Promise<ForgeResult> {
  const started = Date.now();
  const worldId = nanoid(10);
  const telemetry: AgentRun[] = [];
  const track = (run: AgentRun) => {
    telemetry.push(run);
    deps.onSpend?.(run);
    emit("usage", run);
  };
  const call = async (...args: Parameters<StreamAgent>) => {
    try {
      const r = await deps.stream(...args);
      track(r.run);
      return r;
    } catch (e) {
      const run = (e as { run?: AgentRun }).run;
      if (run) track(run);
      throw e;
    }
  };
  const opts = { apiKey: deps.apiKey, signal: deps.signal };

  let ing: Ingested;
  let ledger: Ledger;
  let sessionToken: string | null;
  if (deps.resume) {
    ing = { mode: req.mode, blocks: [], userText: "", tools: [], fileIds: [], docTitles: [], texts: new Map(), sourceTitle: deps.resume.sourceTitle };
    ledger = deps.resume.ledger;
    sessionToken = deps.resume.sessionToken;
    emit("session", { sessionToken, worldId });
    emit("ledger", { facts: ledger.facts, concepts: ledger.concepts, misconceptions: ledger.misconceptions, profile: ledger.profile });
  } else {
    /* ——— ingest (+ Reader in photo mode) ——— */
    emit("stage", { stage: "ingest", status: "start", detail: { mode: req.mode } });
    try {
      ing = await ingest(deps.client, req, {
        readImage: async (image) => {
          emit("stage", { stage: "reader", status: "start" });
          const route = routeFor("reader", req.quality);
          const r = await call(
            {
              agent: "reader",
              ...route,
              system: [SYS(READER_SYSTEM), SYS(learnerProfile(req.level, req.lang), false)],
              messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data } }, { type: "text", text: "Read this image now, following the exact sections." }] }],
            },
            { onThinking: (d) => emit("thinking", { agent: "reader", delta: d }) },
            opts,
          );
          emit("stage", { stage: "reader", status: "done" });
          return textOf(r.content);
        },
      });
    } catch (e) {
      const err = asEidosError(e);
      emit("stage", { stage: "ingest", status: "error", detail: err.toJSON() });
      throw err;
    }
    emit("stage", { stage: "ingest", status: "done", detail: { title: ing.sourceTitle, pages: ing.pages } });
    sessionToken = sealSession({ fileIds: ing.fileIds, mode: req.mode, docTitles: ing.docTitles });
    emit("session", { sessionToken, worldId });

    /* ——— Cartographer ——— */
    ledger = await runCartographer(req, ing, emit, call, opts);
    emit("ledger", { facts: ledger.facts, concepts: ledger.concepts, misconceptions: ledger.misconceptions, profile: ledger.profile });


  }

  /* ——— Director (+ Skeptic in parallel) ——— */
  const factIds = new Set(ledger.facts.map((f) => f.id));
  const ctx: SanitizeContext = {
    factIds,
    conceptIds: new Set(ledger.concepts.map((c) => c.id)),
    misconceptionIds: new Set(ledger.misconceptions.map((m) => m.id)),
    regionProbe: (l: Layer) => probeRegionsCached(l),
  };
  const skeptic = new SkepticQueue(ledger, req, call, opts, emit, factIds);
  const directed = await runDirector(req, ing, ledger, ctx, emit, call, opts, (b) => skeptic.add(b));
  let { spec } = directed;
  const specReport = [...directed.report];

  /* ——— lint + one repair pass ——— */
  const sourceKind = ing.mode === "general" ? "general" : "document";
  let lint = lintWorld(spec, { facts: ledger.facts, misconceptions: ledger.misconceptions, sourceKind });
  if (lint.errors.length) {
    emit("stage", { stage: "repair", status: "start", detail: { errors: lint.errors.length } });
    try {
      const route = routeFor("director", req.quality);
      const r = await call(
        {
          agent: "repair",
          ...route,
          system: [SYS(directorSystem()), SYS(learnerProfile(req.level, req.lang, req.focus), false)],
          messages: [
            {
              role: "user",
              content: `${renderLedgerForDirector(ledger)}\n<current_world>\n${JSON.stringify(spec)}\n</current_world>\n<problems>\n${lint.errors.map((e) => `- ${e.beatId ? `[${e.beatId}] ` : ""}${e.message}`).join("\n")}\n</problems>\nFix exactly these problems and return the full corrected world. Keep everything else unchanged.`,
            },
          ],
          format: API_SCHEMAS.world(),
        },
        { onThinking: (d) => emit("thinking", { agent: "repair", delta: d }) },
        opts,
      );
      const repaired = sanitizeWorldSpec(JSON.parse(textOf(r.content)), ctx);
      spec = repaired.spec;
      specReport.push(...repaired.report);
      lint = lintWorld(spec, { facts: ledger.facts, misconceptions: ledger.misconceptions, sourceKind });
      emit("stage", { stage: "repair", status: "done" });
    } catch (e) {
      emit("stage", { stage: "repair", status: "error", detail: asEidosError(e).toJSON() });
    }
    if (lint.errors.length) {
      spec = autoFix(spec, ctx);
      lint = lintWorld(spec, { facts: ledger.facts, misconceptions: ledger.misconceptions, sourceKind });
    }
    // re-verify beats whose narration changed after the first pass
    for (const b of spec.beats) skeptic.add(b);
  }
  emit("world", { spec, specReport: { corrections: specReport }, lintReport: lint, worldId, source: { mode: req.mode, title: ing.sourceTitle, pages: ing.pages } });

  /* ——— wait for the Skeptic ——— */
  emit("stage", { stage: "skeptic", status: "progress", detail: { pending: skeptic.pending } });
  const { verification, sentences } = await skeptic.finish(spec);
  const finalSpec: WorldSpec = { ...spec, beats: spec.beats.map((b) => (sentences[b.id] ? { ...b, sentences: sentences[b.id]! } : b)) };
  emit("stage", { stage: "skeptic", status: skeptic.failed ? "error" : "done", detail: skeptic.failed ? { code: "EIDOS_E_SCHEMA", message: "incomplete verification", recoverable: true } : undefined });

  const totalCostUsd = telemetry.reduce((s, r) => s + (r.costUsd ?? 0), 0);
  emit("done", { worldId, totalCostUsd, durationMs: Date.now() - started });
  return { worldId, spec: finalSpec, ledger, verification, telemetry, specReport, lintReport: lint, sessionToken, sourceTitle: ing.sourceTitle, pages: ing.pages };
}

type Call = (...args: Parameters<StreamAgent>) => ReturnType<StreamAgent>;

async function runCartographer(req: IngestRequest, ingIn: Ingested, emit: Emit, call: Call, opts: { apiKey: string; signal: AbortSignal }): Promise<Ledger> {
  let ing = ingIn;
  for (let attempt = 0; attempt < 2; attempt++) {
    emit("stage", { stage: "cartographer", status: "start", detail: { mode: ing.mode } });
    const route = routeFor("cartographer", req.quality);
    const [lo, hi] = FACT_RANGE[req.quality];
    const ruleKey = ing.mode === "general" ? "general" : (ing.mode as keyof typeof CARTOGRAPHER_MODE_RULES);
    const profile = `${learnerProfile(req.level, req.lang, req.focus)}\nFacts to extract: between ${lo} and ${hi}, scaled to the length of the source.\nMode rules:\n${CARTOGRAPHER_MODE_RULES[ruleKey]}`;
    const stream = new LedgerStream({}, ing.mode !== "general");
    const fetched: { url: string; title?: string; text?: string }[] = [];
    try {
      const r = await call(
        {
          agent: "cartographer",
          ...route,
          system: [SYS(CARTOGRAPHER_SYSTEM), SYS(profile, false)],
          messages: [{ role: "user", content: [...ing.blocks, { type: "text", text: `${ing.userText ? ing.userText + "\n" : ""}Build the fact ledger now, following the exact format.` }] }],
          ...(ing.tools.length ? { tools: ing.tools } : {}),
        },
        {
          onThinking: (d) => emit("thinking", { agent: "cartographer", delta: d }),
          onText: (d, i) => {
            stream.text(d, i);
            for (const f of stream.drain()) emit("fact", f);
          },
          onCitation: (c, i) => stream.citation(c as unknown as ApiCitation, i),
          onBlockStart: (b) => {
            const blk = b as unknown as { type: string; name?: string; input?: { query?: string; url?: string }; content?: unknown };
            if (blk.type === "server_tool_use" && blk.name === "web_search" && blk.input?.query) emit("search", { agent: "cartographer", query: blk.input.query });
            if (blk.type === "web_search_tool_result" && Array.isArray(blk.content))
              emit("search", { agent: "cartographer", results: (blk.content as { title?: string; url?: string }[]).slice(0, 8).map((x) => ({ title: x.title ?? "", url: x.url ?? "" })) });
          },
        },
        opts,
      );
      const urls = new Map<number, { url: string; title?: string }>();
      const texts = new Map(ing.texts);
      let k = ing.blocks.filter((b) => b.type === "document").length;
      for (const blk of r.content as unknown as { type: string; content?: { url?: string; content?: { title?: string; source?: { data?: string } } } }[]) {
        if (blk.type === "web_fetch_tool_result" && blk.content?.url) {
          urls.set(k, { url: blk.content.url, title: blk.content.content?.title });
          if (typeof blk.content.content?.source?.data === "string") {
            texts.set(k, blk.content.content.source.data);
            fetched.push({ url: blk.content.url, title: blk.content.content.title, text: blk.content.content.source.data });
          }
          k++;
        }
      }
      if (ing.mode === "url" && fetched.length === 0) throw new EidosError("EIDOS_E_URL_UNREACHABLE", "web_fetch returned no document");
      const blocks = (r.content as AgentContentBlock[])
        .filter((b): b is Extract<AgentContentBlock, { type: "text" }> => b.type === "text")
        .map((b) => ({ text: b.text, citations: ((b as unknown as { citations?: ApiCitation[] }).citations ?? []) as ApiCitation[] }));
      const ledger = parseLedger(blocks, { urls, texts }, ing.mode !== "general");
      if (ledger.facts.length < 4) throw new EidosError("EIDOS_E_SCHEMA", "the ledger came back nearly empty");
      for (const f of stream.drain()) emit("fact", f);
      emit("stage", { stage: "cartographer", status: "done", detail: { facts: ledger.facts.length, concepts: ledger.concepts.length, misconceptions: ledger.misconceptions.length, warnings: ledger.warnings } });
      return ledger;
    } catch (e) {
      const err = asEidosError(e);
      if (err.code === "EIDOS_E_WEB_DISABLED" && ing.mode === "topic") {
        // The organization disabled web tools: explain from general knowledge, never presented as verified.
        emit("error", { code: "EIDOS_E_WEB_DISABLED", message: err.message, stage: "cartographer", recoverable: true });
        ing = generalFallback(ing);
        continue;
      }
      emit("stage", { stage: "cartographer", status: "error", detail: err.toJSON() });
      throw err;
    }
  }
  throw new EidosError("EIDOS_E_UNKNOWN", "cartographer failed");
}

async function runDirector(
  req: IngestRequest,
  ing: Ingested,
  ledger: Ledger,
  ctx: SanitizeContext,
  emit: Emit,
  call: Call,
  opts: { apiKey: string; signal: AbortSignal },
  onBeat: (b: Beat) => void,
): Promise<{ spec: WorldSpec; report: ReportItem[] }> {
  const [minB, maxB] = BEATS_RANGE[req.quality];
  const route = routeFor("director", req.quality);
  for (let attempt = 0; attempt < 2; attempt++) {
    emit("stage", { stage: "director", status: "start" });
    const emitted = new Set<string>();
    const report: ReportItem[] = [];
    const scanner = new IncrementalArrayScanner(
      "beats",
      (raw) => {
        const b = sanitizeBeat(raw, emitted.size, ctx, report);
        if (emitted.has(b.id)) return;
        emitted.add(b.id);
        emit("beat", b);
        onBeat(b);
      },
      (prefix) => emit("meta", { title: prefix.title, subtitle: prefix.subtitle, palette: prefix.palette, level: prefix.level, language: prefix.language, concepts: prefix.concepts }),
    );
    const photo = ing.mode === "image" ? "\nThe learner uploaded a photo: apply the photo rule for the first beat." : "";
    const maxTokens = attempt === 0 ? route.maxTokens : Math.min(128_000, Math.round(route.maxTokens * 1.5));
    try {
      const r = await call(
        {
          agent: "director",
          ...route,
          maxTokens,
          system: [SYS(directorSystem()), SYS(learnerProfile(req.level, req.lang, req.focus) + photo, false)],
          messages: [
            {
              role: "user",
              content: `${renderLedgerForDirector(ledger)}\n<constraints>\nbeats: ${attempt === 0 ? `${minB}–${maxB}` : `${minB}–10`} · checks: 2–3 · first beat uses shape "image": ${ing.mode === "image"}\n</constraints>\nDesign the world now.`,
            },
          ],
          format: API_SCHEMAS.world(),
        },
        { onThinking: (d) => emit("thinking", { agent: "director", delta: d }), onText: (d) => scanner.push(d) },
        opts,
      );
      if (r.message.stop_reason === "max_tokens") {
        emit("error", { code: "EIDOS_E_TRUNCATED", stage: "director", recoverable: true, message: "truncated" });
        if (attempt === 0) continue;
      }
      let raw: unknown;
      try {
        raw = JSON.parse(textOf(r.content));
      } catch {
        if (attempt === 0) continue;
        throw new EidosError("EIDOS_E_SCHEMA", "the world JSON did not parse");
      }
      const { spec, report: rep } = sanitizeWorldSpec(raw, ctx);
      emit("stage", { stage: "director", status: "done", detail: { beats: spec.beats.length } });
      return { spec, report: [...report, ...rep] };
    } catch (e) {
      const err = asEidosError(e);
      emit("stage", { stage: "director", status: "error", detail: err.toJSON() });
      throw err;
    }
  }
  throw new EidosError("EIDOS_E_SCHEMA", "director failed twice");
}

/** Mechanical fixes when the repair pass did not clear every error (spec 9.6.4). */
function autoFix(spec: WorldSpec, ctx: SanitizeContext): WorldSpec {
  let beats = [...spec.beats];
  const checks = beats.map((b, i) => [b, i] as const).filter(([b]) => b.kind === "check");
  for (const [b, i] of checks) if (i < 2) beats[i] = { ...b, kind: "concept", check: { ...b.check, enabled: false } };
  let n = 0;
  beats = beats.map((b) => {
    if (b.kind !== "check") return b;
    n++;
    return n > 3 ? { ...b, kind: "recap", check: { ...b.check, enabled: false } } : b;
  });
  const fixed = sanitizeWorldSpec({ ...spec, beats: beats.slice(0, 14) }, ctx);
  return fixed.spec;
}

/** Skeptic batches of 2–4 beats, up to 3 in parallel, as beats stream in (spec 9.6.7, 10.4). */
class SkepticQueue {
  private queue: Beat[] = [];
  private running = 0;
  private results = new Map<string, SkepticResult[]>();
  private done = new Set<string>();
  private inflight = new Set<Promise<void>>();
  private lastText = new Map<string, string>();
  failed = false;
  constructor(
    private ledger: Ledger,
    private req: IngestRequest,
    private call: Call,
    private opts: { apiKey: string; signal: AbortSignal },
    private emit: Emit,
    private factIds: ReadonlySet<string>,
  ) {}

  get pending() {
    return this.queue.length + this.running;
  }

  add(b: Beat) {
    if (b.kind === "finale" || b.kind === "check") return;
    const key = JSON.stringify(b.sentences);
    if (this.lastText.get(b.id) === key) return;
    this.lastText.set(b.id, key);
    this.queue.push(b);
    this.pump(false);
  }

  private pump(flush: boolean) {
    while (this.running < 3 && (this.queue.length >= 2 || (flush && this.queue.length > 0))) {
      const batch = this.queue.splice(0, 4);
      this.running++;
      const p = this.verify(batch).finally(() => {
        this.running--;
        this.inflight.delete(p);
        this.pump(flush);
      });
      this.inflight.add(p);
    }
  }

  private async verify(batch: Beat[]) {
    const facts = new Map(this.ledger.facts.map((f) => [f.id, f]));
    const lines = batch.flatMap((b) =>
      b.sentences.map((s, i) => {
        const cited = s.factIds
          .map((id) => facts.get(id))
          .filter((f): f is Fact => !!f)
          .map((f) => `    ${f.id}: ${f.text}${f.citations[0] ? ` — passage: "${f.citations[0].citedText.slice(0, 280)}"` : ""}`)
          .join("\n");
        return `[${b.id} #${i}] ${s.text}\n  cited facts:\n${cited || "    (none)"}`;
      }),
    );
    const index = this.ledger.facts.map((f) => `${f.id}: ${f.text}`).join("\n");
    const route = routeFor("skeptic", this.req.quality);
    try {
      const r = await this.call(
        {
          agent: "skeptic",
          ...route,
          system: [SYS(SKEPTIC_SYSTEM, false)],
          messages: [{ role: "user", content: `Learner level: ${this.req.level}.\n<sentences>\n${lines.join("\n")}\n</sentences>\n<fact_index>\n${index}\n</fact_index>\nReturn one result per sentence; beatId and index as given in brackets.` }],
          format: API_SCHEMAS.verification(),
          showThinking: true,
        },
        { onThinking: (d) => this.emit("thinking", { agent: "skeptic", delta: d }) },
        this.opts,
      );
      const parsed = JSON.parse(textOf(r.content)) as { results: SkepticResult[] };
      for (const b of batch) {
        const res = parsed.results.filter((x) => x.beatId === b.id);
        this.results.set(b.id, res);
        const applied = applyVerdicts(b, res, this.factIds);
        this.done.add(b.id);
        this.emit("verify", { beatId: b.id, results: applied.verdicts, revisedSentences: applied.sentences });
      }
    } catch (e) {
      this.failed = true;
      this.emit("error", { code: asEidosError(e).code, stage: "skeptic", recoverable: true, message: "verification incomplete" });
    }
  }

  async finish(spec: WorldSpec): Promise<{ verification: Record<string, SentenceVerdict[]>; sentences: Record<string, Sentence[]> }> {
    this.pump(true);
    while (this.inflight.size) await Promise.race([...this.inflight]);
    const verification: Record<string, SentenceVerdict[]> = {};
    const sentences: Record<string, Sentence[]> = {};
    for (const b of spec.beats) {
      const res = this.results.get(b.id);
      if (!res) continue;
      const applied = applyVerdicts(b, res, this.factIds);
      verification[b.id] = applied.verdicts;
      sentences[b.id] = applied.sentences;
    }
    return { verification, sentences };
  }
}
