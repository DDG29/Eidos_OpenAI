import { z } from "zod";
import { BeatSchema, SentenceSchema, WorldPlanSchema, LayerSchema } from "./schema";

/** Validation of persisted / imported / shared world files (`.eidos.json`, public/worlds/*.json). */

export const CitationSchema = z.object({
  kind: z.enum(["page", "char", "block", "web"]),
  citedText: z.string(),
  documentIndex: z.number(),
  documentTitle: z.string(),
  startPage: z.number().optional(),
  endPage: z.number().optional(),
  startChar: z.number().optional(),
  endChar: z.number().optional(),
  startBlock: z.number().optional(),
  endBlock: z.number().optional(),
  url: z.string().optional(),
  title: z.string().optional(),
});

export const FactSchema = z.object({
  id: z.string().regex(/^F\d{2,3}$/),
  text: z.string().min(1).max(400),
  conceptId: z.string().nullable(),
  citations: z.array(CitationSchema),
  origin: z.enum(["source", "web", "general"]),
  quote: z.string().optional(),
});

export const MisconceptionSchema = z.object({ id: z.string().regex(/^M\d{2}$/), wrongIdea: z.string(), correction: z.string(), factIds: z.array(z.string()) });

const VerdictSchema = z.object({
  index: z.number(),
  verdict: z.enum(["supported", "partial", "general", "unsupported", "contradicted"]),
  supportingFactIds: z.array(z.string()),
  note: z.string(),
  revised: z.boolean(),
  originalText: z.string().optional(),
});

const AgentRunSchema = z.object({
  id: z.string(),
  agent: z.string(),
  model: z.string(),
  effort: z.string(),
  startedAt: z.string(),
  durationMs: z.number(),
  inputTokens: z.number(),
  outputTokens: z.number(),
  cacheReadTokens: z.number(),
  cacheWriteTokens: z.number(),
  webSearches: z.number(),
  webFetches: z.number(),
  costUsd: z.number().nullable(),
  stopReason: z.string(),
  thinkingSummary: z.string(),
  replay: z.boolean(),
});

const ReportItemSchema = z.object({ severity: z.enum(["error", "warning", "info"]), code: z.string(), message: z.string(), beatId: z.string().optional() });

export const AskReplaySchema = z.object({
  question: z.string(),
  beatId: z.string(),
  answer: z.array(z.object({ text: z.string(), factIds: z.array(z.string()) })),
  project: z.object({ caption: z.string(), layers: z.array(LayerSchema), transition: z.string(), camera: z.string() }).nullable().optional(),
});

export const WorldFileSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  schemaVersion: z.literal(1),
  createdAt: z.string(),
  origin: z.enum(["demo", "forged", "shared", "imported"]),
  source: z.object({ mode: z.enum(["pdf", "image", "url", "text", "topic"]), title: z.string(), pages: z.number().optional(), url: z.string().optional(), fileName: z.string().optional() }),
  spec: WorldPlanSchema,
  facts: z.array(FactSchema),
  misconceptions: z.array(MisconceptionSchema),
  verification: z.record(z.string(), z.array(VerdictSchema)),
  inserted: z.array(z.object({ afterBeatId: z.string(), beats: z.array(BeatSchema), reason: z.enum(["remedial", "branch"]), createdAt: z.string(), meta: z.record(z.string(), z.string()) })),
  levelVariants: z.record(z.string(), z.record(z.string(), z.array(SentenceSchema))),
  mastery: z.record(z.string(), z.object({ attempts: z.number(), correct: z.number(), partial: z.number(), score: z.number(), lastResult: z.enum(["correct", "partial", "incorrect", "skipped"]).nullable() })),
  telemetry: z.array(AgentRunSchema),
  specReport: z.object({ corrections: z.array(ReportItemSchema) }),
  lintReport: z.object({ score: z.number(), errors: z.array(ReportItemSchema), warnings: z.array(ReportItemSchema) }),
  sessionToken: z.string().optional(),
  posterBeat: z.string().optional(),
  frames: z.array(z.number()).optional(),
  demoAssets: z
    .object({
      remedials: z.record(z.string(), z.array(BeatSchema)).optional(),
      askReplays: z.array(AskReplaySchema).optional(),
      forgeReplay: z.string().optional(),
      branches: z.record(z.string(), z.array(BeatSchema)).optional(),
    })
    .optional(),
});

export type WorldFile = z.infer<typeof WorldFileSchema>;
