import { z } from "zod";
import { AMBIENTS, BEAT_KINDS, CAMERA_PRESETS, COLOR_MODES, COLOR_ROLES, LEVELS, PALETTE_IDS, SHAPE_IDS, TRANSITIONS } from "./types";

/**
 * "Send" schemas: the JSON Schemas given to Claude in `output_config.format` (spec 8.2). They follow the
 * structured-output rules: every object closed and fully required, no unions, no numeric/length bounds.
 * Ranges live in the prompt and are enforced afterwards by the sanitizer (`sanitize.ts`).
 */

const str = () => z.string();
const num = () => z.number();
const tuple = <T extends readonly [string, ...string[]]>(v: T) => z.enum(v);

export const KVNumberSchema = z.object({ key: str(), value: num() });
export const KVStringSchema = z.object({ key: str(), value: str() });
export const Vec3Schema = z.object({ x: num(), y: num(), z: num() });

export const LayerSchema = z.object({
  shape: tuple(SHAPE_IDS as unknown as [string, ...string[]]),
  params: z.array(KVNumberSchema),
  expr: z.array(KVStringSchema),
  data: z.array(num()),
  share: num(),
  position: Vec3Schema,
  rotation: Vec3Schema,
  scale: num(),
  colorMode: tuple(COLOR_MODES as unknown as [string, ...string[]]),
  tint: tuple(COLOR_ROLES as unknown as [string, ...string[]]),
});

export const SentenceSchema = z.object({ text: str(), factIds: z.array(str()) });
export const AnnotationSchema = z.object({ layerIndex: num(), regionId: str(), text: str() });
export const KnobSchema = z.object({
  enabled: z.boolean(),
  label: str(),
  layerIndex: num(),
  paramKey: str(),
  min: num(),
  max: num(),
  initial: num(),
  step: num(),
  unit: str(),
  readout: str(),
});
export const ChoiceSchema = z.object({ text: str(), misconceptionId: str() });
export const CheckSchema = z.object({
  enabled: z.boolean(),
  question: str(),
  choices: z.array(ChoiceSchema),
  correctIndex: num(),
  allowFreeText: z.boolean(),
  idealAnswer: str(),
  explanation: str(),
  conceptIds: z.array(str()),
});

export const BeatSchema = z.object({
  id: str(),
  kind: tuple(BEAT_KINDS as unknown as [string, ...string[]]),
  title: str(),
  sentences: z.array(SentenceSchema),
  conceptIds: z.array(str()),
  layers: z.array(LayerSchema),
  transition: tuple(TRANSITIONS as unknown as [string, ...string[]]),
  camera: tuple(CAMERA_PRESETS as unknown as [string, ...string[]]),
  annotations: z.array(AnnotationSchema),
  knob: KnobSchema,
  check: CheckSchema,
  ambient: tuple(AMBIENTS as unknown as [string, ...string[]]),
  weight: num(),
});

export const ConceptSchema = z.object({ id: str(), name: str(), summary: str(), dependsOn: z.array(str()) });

export const WorldPlanSchema = z.object({
  title: str(),
  subtitle: str(),
  language: z.enum(["es", "en"]),
  level: tuple(LEVELS as unknown as [string, ...string[]]),
  palette: tuple(PALETTE_IDS as unknown as [string, ...string[]]),
  concepts: z.array(ConceptSchema),
  beats: z.array(BeatSchema),
  closing: str(),
  nextTopics: z.array(str()),
});

export const BeatsPatchSchema = z.object({ beats: z.array(BeatSchema), conceptsAdded: z.array(ConceptSchema) });

export const VerificationSchema = z.object({
  results: z.array(
    z.object({
      beatId: str(),
      index: num(),
      verdict: z.enum(["supported", "partial", "general", "unsupported", "contradicted"]),
      supportingFactIds: z.array(str()),
      note: str(),
      revision: str(),
    }),
  ),
});

export const GradeSchema = z.object({
  verdict: z.enum(["correct", "partial", "incorrect", "off_topic"]),
  matchedMisconceptionId: str(),
  missingIdea: str(),
  feedback: str(),
  conceptIds: z.array(str()),
  confidence: num(),
});

export const LensSchema = z.object({ beats: z.array(z.object({ id: str(), sentences: z.array(SentenceSchema) })) });

export const ProjectSceneSchema = z.object({
  caption: str(),
  layers: z.array(LayerSchema),
  transition: tuple(TRANSITIONS as unknown as [string, ...string[]]),
  camera: tuple(CAMERA_PRESETS as unknown as [string, ...string[]]),
});

export type JsonSchema = Record<string, unknown>;

const UNSUPPORTED = ["minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "minLength", "maxLength", "maxItems", "pattern", "format", "multipleOf", "$schema"];

/** Zod → JSON Schema in the subset accepted by structured outputs (normalized defensively). */
export function toApiSchema(schema: z.ZodType): JsonSchema {
  const raw = z.toJSONSchema(schema, { target: "draft-2020-12", io: "output" }) as JsonSchema;
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (!node || typeof node !== "object") return node;
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (UNSUPPORTED.includes(k)) continue;
      o[k] = walk(v);
    }
    if (o.type === "object" && o.properties && typeof o.properties === "object") {
      o.additionalProperties = false;
      o.required = Object.keys(o.properties as object);
    }
    if (o.type === "array" && typeof o.minItems === "number" && (o.minItems as number) > 1) o.minItems = 1;
    return o;
  };
  return walk(raw) as JsonSchema;
}

export const API_SCHEMAS = {
  world: () => toApiSchema(WorldPlanSchema),
  beatsPatch: () => toApiSchema(BeatsPatchSchema),
  verification: () => toApiSchema(VerificationSchema),
  grade: () => toApiSchema(GradeSchema),
  lens: () => toApiSchema(LensSchema),
  projectScene: () => toApiSchema(ProjectSceneSchema),
} as const;

/** Rule checker used by tests and `pnpm schema:check` (spec 8.2). */
export function checkApiSchemaRules(schema: JsonSchema): string[] {
  const problems: string[] = [];
  const visit = (node: unknown, path: string) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach((n, i) => visit(n, `${path}[${i}]`));
    const o = node as Record<string, unknown>;
    if ("anyOf" in o || "oneOf" in o || "allOf" in o) problems.push(`${path}: union`);
    if (Array.isArray(o.type)) problems.push(`${path}: type array`);
    for (const k of UNSUPPORTED) if (k in o) problems.push(`${path}: unsupported keyword ${k}`);
    if (typeof o.minItems === "number" && o.minItems > 1) problems.push(`${path}: minItems > 1`);
    if (o.type === "object") {
      if (o.additionalProperties !== false) problems.push(`${path}: additionalProperties not false`);
      const props = Object.keys((o.properties as object) ?? {});
      const req = (o.required as string[]) ?? [];
      for (const p of props) if (!req.includes(p)) problems.push(`${path}.${p}: not required`);
    }
    for (const [k, v] of Object.entries(o)) visit(v, `${path}.${k}`);
  };
  visit(schema, "$");
  return problems;
}
