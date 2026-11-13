import { z } from "zod";
import { BeatSchema, ConceptSchema, SentenceSchema } from "@/lib/world/schema";
import { FactSchema, MisconceptionSchema } from "@/lib/world/worldFile";

/** Request schemas of the API routes (spec 10.2), shared by the client and the server validators. */

export const LevelEnum = z.enum(["curioso", "prepa", "universidad", "experto"]);
export const LangEnum = z.enum(["es", "en"]);
export const QualityEnum = z.enum(["fast", "deep", "master"]);

const LedgerFact = FactSchema.pick({ id: true, text: true, conceptId: true, origin: true, citations: true });

export const BeatSummarySchema = z.object({
  id: z.string().max(12),
  kind: z.string().max(16),
  title: z.string().max(120),
  shapes: z.array(z.string().max(16)).max(3),
  sentences: z.array(z.string().max(300)).max(6),
});

export const GradeRequestSchema = z.object({
  question: z.string().min(1).max(300),
  idealAnswer: z.string().max(600),
  answer: z.string().min(1).max(800),
  misconceptions: z.array(MisconceptionSchema).max(12),
  facts: z.array(LedgerFact.pick({ id: true, text: true })).max(80),
  level: LevelEnum,
  lang: LangEnum,
});
export type GradeRequest = z.infer<typeof GradeRequestSchema>;

export interface GradeResult {
  verdict: "correct" | "partial" | "incorrect" | "off_topic";
  matchedMisconceptionId: string;
  missingIdea: string;
  feedback: string;
  conceptIds: string[];
  confidence: number;
}

export const GrowRequestSchema = z.object({
  worldSummary: z.array(BeatSummarySchema).max(40),
  checkBeat: BeatSchema,
  answer: z.string().max(800),
  grade: z.object({ verdict: z.string().max(20), missingIdea: z.string().max(400), matchedMisconceptionId: z.string().max(8) }),
  facts: z.array(LedgerFact).max(80),
  misconceptions: z.array(MisconceptionSchema).max(12),
  concepts: z.array(ConceptSchema).max(24),
  palette: z.string().max(12),
  idPrefix: z.string().regex(/^[rx]\d{2}$/),
  level: LevelEnum,
  lang: LangEnum,
  quality: QualityEnum,
});
export type GrowRequest = z.infer<typeof GrowRequestSchema>;

export const ForkRequestSchema = GrowRequestSchema.omit({ checkBeat: true, answer: true, grade: true }).extend({
  fromBeatId: z.string().max(12),
  question: z.string().min(3).max(300),
});
export type ForkRequest = z.infer<typeof ForkRequestSchema>;

export const LensRequestSchema = z.object({
  beats: z.array(z.object({ id: z.string().max(12), sentences: z.array(SentenceSchema).max(6) })).max(40),
  targetLevel: LevelEnum,
  lang: LangEnum,
});
export type LensRequest = z.infer<typeof LensRequestSchema>;

export const AskRequestSchema = z.object({
  sessionToken: z.string().max(4000).optional(),
  worldId: z.string().max(64),
  beat: BeatSummarySchema,
  regionId: z.string().max(60).optional(),
  question: z.string().min(1).max(600),
  history: z.array(z.object({ q: z.string().max(600), a: z.string().max(2000) })).max(3),
  level: LevelEnum,
  lang: LangEnum,
  facts: z.array(LedgerFact.pick({ id: true, text: true })).max(80),
});
export type AskRequest = z.infer<typeof AskRequestSchema>;
