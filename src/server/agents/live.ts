import type Anthropic from "@anthropic-ai/sdk";
import { EidosError } from "@/lib/errors";
import { API_SCHEMAS, LayerSchema } from "@/lib/world/schema";
import { sanitizeBeat, sanitizeLayer, type SanitizeContext } from "@/lib/world/sanitize";
import type { AgentRun, Beat, Level, ReportItem, Sentence } from "@/lib/world/types";
import type { AskRequest, ForkRequest, GradeRequest, GradeResult, GrowRequest, LensRequest } from "@/lib/api/schemas";
import { routeFor } from "@/server/ai/models";
import { textOf, type StreamAgent } from "@/server/ai/claude";
import { EVALUATOR_SYSTEM, LENS_MAX_WORDS, LENS_SYSTEM, LEVEL_DESCRIPTION, LANG_NAME, SKEPTIC_SYSTEM, brancherSystem, gardenerSystem, learnerProfile, tutorSystem, wrapLearnerText } from "./prompts";
import { applyVerdicts, type SkepticResult } from "./verdicts";
import { openSession } from "@/server/session/token";
import { probeRegionsCached } from "@/server/world/regionProbe";
import { z } from "zod";

/** Agents used after the forge (spec 9.7–9.10). Each is a single-turn request (spec 9.7.3). */

type Emit = (event: string, data: unknown) => void;
type Opts = { apiKey: string; signal: AbortSignal; stream: StreamAgent; onRun: (r: AgentRun) => void };
const SYS = (text: string, cache = true) => ({ type: "text" as const, text, ...(cache ? { cache_control: { type: "ephemeral" as const, ttl: "1h" as const } } : {}) });

function ctxFrom(facts: { id: string }[], concepts: { id: string }[], misconceptions: { id: string }[], prefix: string): SanitizeContext {
  return {
    factIds: new Set(facts.map((f) => f.id)),
    conceptIds: new Set(concepts.map((c) => c.id)),
    misconceptionIds: new Set(misconceptions.map((m) => m.id)),
    regionProbe: (l) => probeRegionsCached(l),
    idPrefix: prefix,
    enforceArc: false,
  };
}

async function tracked(o: Opts, ...args: Parameters<StreamAgent>) {
  try {
    const r = await o.stream(...args);
    o.onRun(r.run);
    return r;
  } catch (e) {
    const run = (e as { run?: AgentRun }).run;
    if (run) o.onRun(run);
    throw e;
  }
}

/* ——— Evaluator ——— */
export async function grade(req: GradeRequest, o: Opts): Promise<GradeResult> {
  const route = routeFor("evaluator", "deep");
  const mis = req.misconceptions.map((m) => `${m.id}: ${m.wrongIdea}`).join("\n");
  const r = await tracked(
    o,
    {
      agent: "evaluator",
      ...route,
      system: [SYS(EVALUATOR_SYSTEM, false), SYS(`Learner level: ${req.level} — ${LEVEL_DESCRIPTION[req.level]}. Language for feedback: ${LANG_NAME[req.lang]}.`, false)],
      messages: [
        {
          role: "user",
          content: `<question>${req.question}</question>\n<ideal_answer>${req.idealAnswer}</ideal_answer>\n<misconceptions>\n${mis || "none"}\n</misconceptions>\n<facts>\n${req.facts.map((f) => `${f.id}: ${f.text}`).join("\n")}\n</facts>\n${wrapLearnerText("learner_answer", req.answer)}`,
        },
      ],
      format: API_SCHEMAS.grade(),
      showThinking: false,
    },
    {},
    o,
  );
  const g = JSON.parse(textOf(r.content)) as GradeResult;
  const misIds = new Set(req.misconceptions.map((m) => m.id));
  return {
    verdict: (["correct", "partial", "incorrect", "off_topic"] as const).find((v) => v === String(g.verdict).toLowerCase()) ?? "partial",
    matchedMisconceptionId: misIds.has(g.matchedMisconceptionId) ? g.matchedMisconceptionId : "",
    missingIdea: String(g.missingIdea ?? "").slice(0, 300),
    feedback: String(g.feedback ?? "").slice(0, 400),
    conceptIds: Array.isArray(g.conceptIds) ? g.conceptIds.slice(0, 6) : [],
    confidence: Math.min(1, Math.max(0, Number(g.confidence) || 0)),
  };
}

/* ——— Lens ——— */
export async function lens(req: LensRequest, o: Opts): Promise<{ beats: { id: string; sentences: Sentence[] }[] }> {
  const route = routeFor("lens", "deep");
  const r = await tracked(
    o,
    {
      agent: "lens",
      ...route,
      system: [SYS(LENS_SYSTEM, false), SYS(`Target level: ${req.targetLevel} — ${LEVEL_DESCRIPTION[req.targetLevel]}. Language: ${LANG_NAME[req.lang]}. Word limit per sentence: ${LENS_MAX_WORDS[req.targetLevel]}.`, false)],
      messages: [{ role: "user", content: `<beats>\n${JSON.stringify(req.beats)}\n</beats>\nRewrite every beat now.` }],
      format: API_SCHEMAS.lens(),
      showThinking: false,
    },
    {},
    o,
  );
  const out = JSON.parse(textOf(r.content)) as { beats: { id: string; sentences: Sentence[] }[] };
  // Each sentence may only cite facts the original beat cited (spec 9.10).
  const allowed = new Map(req.beats.map((b) => [b.id, new Set(b.sentences.flatMap((s) => s.factIds))]));
  return {
    beats: out.beats
      .filter((b) => allowed.has(b.id))
      .map((b) => ({
        id: b.id,
        sentences: b.sentences
          .slice(0, 5)
          .map((s) => ({ text: String(s.text).slice(0, 260), factIds: (s.factIds ?? []).filter((f) => allowed.get(b.id)!.has(f)) }))
          .filter((s) => s.text.trim()),
      })),
  };
}

/* ——— Gardener / Brancher ——— */
async function quickSkeptic(beats: Beat[], facts: { id: string; text: string }[], level: Level, o: Opts): Promise<Map<string, ReturnType<typeof applyVerdicts>>> {
  const out = new Map<string, ReturnType<typeof applyVerdicts>>();
  const verifiable = beats.filter((b) => b.kind !== "check" && b.sentences.length);
  if (!verifiable.length) return out;
  const route = routeFor("skeptic", "fast");
  const f = new Map(facts.map((x) => [x.id, x]));
  const lines = verifiable.flatMap((b) => b.sentences.map((s, i) => `[${b.id} #${i}] ${s.text}\n  cited: ${s.factIds.map((id) => `${id}: ${f.get(id)?.text ?? "?"}`).join(" | ") || "(none)"}`));
  try {
    const r = await tracked(
      o,
      {
        agent: "skeptic",
        ...route,
        system: [SYS(SKEPTIC_SYSTEM, false)],
        messages: [{ role: "user", content: `Learner level: ${level}.\n<sentences>\n${lines.join("\n")}\n</sentences>\n<fact_index>\n${facts.map((x) => `${x.id}: ${x.text}`).join("\n")}\n</fact_index>` }],
        format: API_SCHEMAS.verification(),
        showThinking: false,
      },
      {},
      o,
    );
    const parsed = JSON.parse(textOf(r.content)) as { results: SkepticResult[] };
    const ids = new Set(facts.map((x) => x.id));
    for (const b of verifiable) out.set(b.id, applyVerdicts(b, parsed.results, ids));
  } catch {
    /* verification is best-effort here; beats show as unverified */
  }
  return out;
}

async function patch(kind: "gardener" | "brancher", req: GrowRequest | ForkRequest, userContent: string, emit: Emit, o: Opts) {
  const route = routeFor(kind, req.quality);
  const r = await tracked(
    o,
    {
      agent: kind,
      ...route,
      system: [SYS(kind === "gardener" ? gardenerSystem() : brancherSystem()), SYS(learnerProfile(req.level, req.lang), false)],
      messages: [{ role: "user", content: userContent }],
      format: API_SCHEMAS.beatsPatch(),
    },
    { onThinking: (d) => emit("thinking", { agent: kind, delta: d }) },
    o,
  );
  const raw = JSON.parse(textOf(r.content)) as { beats: unknown[]; conceptsAdded: unknown[] };
  const report: ReportItem[] = [];
  const ctx = ctxFrom(req.facts, req.concepts, req.misconceptions, req.idPrefix);
  const beats = (raw.beats ?? []).slice(0, kind === "gardener" ? 3 : 4).map((b, i) => sanitizeBeat(b, i, ctx, report));
  // ids follow the prefix in order (r01a, r01b, …) regardless of what came back
  beats.forEach((b, i) => (b.id = `${req.idPrefix}${String.fromCharCode(97 + i)}`));
  const verified = await quickSkeptic(beats, req.facts, req.level, o);
  for (const b of beats) {
    const v = verified.get(b.id);
    const out = v ? { ...b, sentences: v.sentences } : b;
    emit("beat", out);
    if (v) emit("verify", { beatId: b.id, results: v.verdicts, revisedSentences: v.sentences });
  }
  return beats;
}

export function summaryText(req: GrowRequest | ForkRequest): string {
  return req.worldSummary.map((b) => `${b.id} (${b.kind}) ${b.title} — shapes: ${b.shapes.join(", ")} — ${b.sentences.join(" ")}`).join("\n");
}

function ledgerText(req: GrowRequest | ForkRequest): string {
  return `<fact_ledger>\n${req.facts.map((f) => `${f.id} [${f.conceptId ?? "C00"}] ${f.text}`).join("\n")}\n</fact_ledger>\n<misconceptions>\n${req.misconceptions.map((m) => `${m.id} | ${m.wrongIdea} | ${m.correction}`).join("\n")}\n</misconceptions>\n<world>\n${summaryText(req)}\n</world>\npalette: ${req.palette}`;
}

export function grow(req: GrowRequest, emit: Emit, o: Opts) {
  const mis = req.misconceptions.find((m) => m.id === req.grade.matchedMisconceptionId);
  const focus = mis ? `${mis.id}: ${mis.wrongIdea}` : req.grade.missingIdea || req.checkBeat.check.question;
  return patch(
    "gardener",
    req,
    `${ledgerText(req)}\n<check_beat>\n${JSON.stringify(req.checkBeat)}\n</check_beat>\nMisunderstanding: ${focus}\nEvaluator verdict: ${req.grade.verdict}\n${wrapLearnerText("learner_answer", req.answer)}\nID prefix: ${req.idPrefix}\nGrow the remedial chapter now.`,
    emit,
    o,
  );
}

export function fork(req: ForkRequest, emit: Emit, o: Opts) {
  return patch("brancher", req, `${ledgerText(req)}\nThe branch starts after beat ${req.fromBeatId}.\n${wrapLearnerText("learner_question", req.question)}\nID prefix: ${req.idPrefix}\nCreate the branch now.`, emit, o);
}

/* ——— Tutor ——— */
const ProjectInput = z.object({ caption: z.string().max(140), layers: z.array(LayerSchema).max(3), transition: z.string(), camera: z.string() });

export async function ask(req: AskRequest, emit: Emit, o: Opts, client: Anthropic) {
  void client;
  const route = routeFor("tutor", "deep");
  const session = openSession(req.sessionToken);
  const docs: Anthropic.Beta.Messages.BetaContentBlockParam[] = [];
  if (session) for (const [i, id] of session.fileIds.entries()) docs.push({ type: "document", source: { type: "file", file_id: id }, title: session.docTitles[i] ?? "Source", citations: { enabled: true }, cache_control: { type: "ephemeral", ttl: "1h" } } as Anthropic.Beta.Messages.BetaContentBlockParam);
  // The fact ledger as custom content: block i = fact i, so content_block_location maps straight to fact ids.
  docs.push({
    type: "document",
    title: "Fact ledger",
    citations: { enabled: true },
    source: { type: "content", content: req.facts.map((f) => ({ type: "text", text: `${f.id}: ${f.text}` })) },
  } as Anthropic.Beta.Messages.BetaContentBlockParam);
  const ledgerIndex = docs.length - 1;
  const history = req.history.map((h) => `Q: ${h.q}\nA: ${h.a}`).join("\n\n");
  const projectTool = {
    name: "project_scene",
    description: "Show a temporary 3D form in the scene to illustrate your answer. Use it only when a visual would genuinely help, after writing your answer.",
    input_schema: API_SCHEMAS.projectScene(),
  } as unknown as Anthropic.Beta.Messages.BetaTool;
  const r = await tracked(
    o,
    {
      agent: "tutor",
      ...route,
      system: [SYS(tutorSystem()), SYS(`Learner level: ${req.level} — ${LEVEL_DESCRIPTION[req.level]}. Language: ${LANG_NAME[req.lang]}.`, false)],
      messages: [
        {
          role: "user",
          content: [
            ...docs,
            {
              type: "text",
              text: `<scene>\nBeat ${req.beat.id} (${req.beat.kind}): ${req.beat.title}\nShapes: ${req.beat.shapes.join(", ")}\nNarration: ${req.beat.sentences.join(" ")}${req.regionId ? `\nThe learner tapped the region: ${req.regionId}` : ""}\n</scene>\n${history ? `<conversation_so_far>\n${history}\n</conversation_so_far>\n` : ""}${wrapLearnerText("learner_question", req.question)}`,
            },
          ],
        },
      ],
      tools: [projectTool],
      showThinking: false,
    },
    {
      onText: (d) => emit("text", { delta: d }),
      onCitation: (c) => {
        const x = c as unknown as { type: string; document_index?: number; start_block_index?: number; end_block_index?: number; cited_text?: string };
        if (x.type === "content_block_location" && x.document_index === ledgerIndex) {
          const ids = req.facts.slice(x.start_block_index ?? 0, Math.max((x.start_block_index ?? 0) + 1, x.end_block_index ?? 0)).map((f) => f.id);
          emit("citation", { factIds: ids });
        } else {
          // citations into the original document: match the passage to the closest fact by text overlap
          const ct = (x.cited_text ?? "").toLowerCase();
          const hit = req.facts.find((f) => ct && (f.text.toLowerCase().includes(ct.slice(0, 40)) || ct.includes(f.text.toLowerCase().slice(0, 40))));
          emit("citation", { factIds: hit ? [hit.id] : [], passage: x.cited_text ?? "" });
        }
      },
    },
    o,
  );
  for (const b of r.content) {
    const blk = b as unknown as { type: string; name?: string; input?: unknown };
    if (blk.type === "tool_use" && blk.name === "project_scene") {
      const p = ProjectInput.safeParse(blk.input);
      if (!p.success) continue;
      const report: ReportItem[] = [];
      emit("project", { caption: p.data.caption, layers: p.data.layers.map((l) => sanitizeLayer(l, report, "project")), transition: p.data.transition, camera: p.data.camera });
    }
  }
}

export function assertKey(key: string | null): asserts key is string {
  if (!key) throw new EidosError("EIDOS_E_NO_KEY", "no API key", false);
}

