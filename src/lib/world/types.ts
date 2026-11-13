/** World Spec — the contract between Claude (writer) and the Morfogénesis engine (executor). Spec §8.1. */

export type Level = "curioso" | "prepa" | "universidad" | "experto";
export type Lang = "es" | "en";
export type PaletteId = "aurora" | "magma" | "abismo" | "bioluz" | "solar" | "tinta" | "jade" | "nebulosa";
export type BeatKind =
  | "hook"
  | "concept"
  | "mechanism"
  | "zoom"
  | "compare"
  | "misconception"
  | "interactive"
  | "check"
  | "application"
  | "recap"
  | "finale";
export type Transition = "flow" | "swirl" | "explode" | "fold" | "rain" | "dissolve";
export type CameraPreset =
  | "orbit_close"
  | "orbit_wide"
  | "top_down"
  | "side"
  | "inside"
  | "dolly_in"
  | "dolly_out"
  | "low_angle";
export type ColorMode = "palette" | "region" | "radial" | "height" | "single";
export type ColorRole = "primary" | "secondary" | "accent" | "glow";
export type Ambient = "calm" | "wonder" | "tense" | "playful" | "triumphant";
export type ShapeId =
  | "sphere"
  | "shell"
  | "torus"
  | "torusKnot"
  | "helix"
  | "galaxy"
  | "lattice"
  | "grid"
  | "wave"
  | "surface"
  | "parametric"
  | "curve"
  | "field"
  | "molecule"
  | "orbits"
  | "network"
  | "layers"
  | "tree"
  | "cell"
  | "bars"
  | "scatter"
  | "text"
  | "glyph"
  | "image"
  | "nebula"
  | "vortex"
  | "flow"
  | "burst";

export const LEVELS: readonly Level[] = ["curioso", "prepa", "universidad", "experto"];
export const PALETTE_IDS: readonly PaletteId[] = ["aurora", "magma", "abismo", "bioluz", "solar", "tinta", "jade", "nebulosa"];
export const BEAT_KINDS: readonly BeatKind[] = [
  "hook",
  "concept",
  "mechanism",
  "zoom",
  "compare",
  "misconception",
  "interactive",
  "check",
  "application",
  "recap",
  "finale",
];
export const TRANSITIONS: readonly Transition[] = ["flow", "swirl", "explode", "fold", "rain", "dissolve"];
export const CAMERA_PRESETS: readonly CameraPreset[] = [
  "orbit_close",
  "orbit_wide",
  "top_down",
  "side",
  "inside",
  "dolly_in",
  "dolly_out",
  "low_angle",
];
export const COLOR_MODES: readonly ColorMode[] = ["palette", "region", "radial", "height", "single"];
export const COLOR_ROLES: readonly ColorRole[] = ["primary", "secondary", "accent", "glow"];
export const AMBIENTS: readonly Ambient[] = ["calm", "wonder", "tense", "playful", "triumphant"];
export const SHAPE_IDS: readonly ShapeId[] = [
  "sphere",
  "shell",
  "torus",
  "torusKnot",
  "helix",
  "galaxy",
  "lattice",
  "grid",
  "wave",
  "surface",
  "parametric",
  "curve",
  "field",
  "molecule",
  "orbits",
  "network",
  "layers",
  "tree",
  "cell",
  "bars",
  "scatter",
  "text",
  "glyph",
  "image",
  "nebula",
  "vortex",
  "flow",
  "burst",
];

export interface KV<T> {
  key: string;
  value: T;
}
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Layer {
  shape: ShapeId;
  params: KV<number>[];
  expr: KV<string>[];
  data: number[];
  share: number;
  position: Vec3;
  rotation: Vec3;
  scale: number;
  colorMode: ColorMode;
  tint: ColorRole;
}

export interface Sentence {
  text: string;
  factIds: string[];
}

export interface Annotation {
  layerIndex: number;
  regionId: string;
  text: string;
}

export interface Knob {
  enabled: boolean;
  label: string;
  layerIndex: number;
  paramKey: string;
  min: number;
  max: number;
  initial: number;
  step: number;
  unit: string;
  readout: string;
}

export interface Choice {
  text: string;
  misconceptionId: string;
}

export interface Check {
  enabled: boolean;
  question: string;
  choices: Choice[];
  correctIndex: number;
  allowFreeText: boolean;
  idealAnswer: string;
  explanation: string;
  conceptIds: string[];
}

export interface Beat {
  id: string;
  kind: BeatKind;
  title: string;
  sentences: Sentence[];
  conceptIds: string[];
  layers: Layer[];
  transition: Transition;
  camera: CameraPreset;
  annotations: Annotation[];
  knob: Knob;
  check: Check;
  ambient: Ambient;
  weight: number;
}

export interface Concept {
  id: string;
  name: string;
  summary: string;
  dependsOn: string[];
}

export interface WorldSpec {
  title: string;
  subtitle: string;
  language: Lang;
  level: Level;
  palette: PaletteId;
  concepts: Concept[];
  beats: Beat[];
  closing: string;
  nextTopics: string[];
}

/* ——— Fact ledger (§8.5) ——— */

export interface Citation {
  kind: "page" | "char" | "block" | "web";
  citedText: string;
  documentIndex: number;
  documentTitle: string;
  startPage?: number;
  endPage?: number;
  startChar?: number;
  endChar?: number;
  startBlock?: number;
  endBlock?: number;
  url?: string;
  title?: string;
}

export interface Fact {
  id: string;
  text: string;
  conceptId: string | null;
  citations: Citation[];
  origin: "source" | "web" | "general";
  /** Demo worlds only: literal substring of the source used by `pnpm demo:cite`. */
  quote?: string;
}

export interface Misconception {
  id: string;
  wrongIdea: string;
  correction: string;
  factIds: string[];
}

export interface SourceProfile {
  title: string;
  domain: string;
  difficulty: Level;
  palette: PaletteId;
  visualMotifs: string[];
  numbers: string[];
}

/* ——— Mastery (§8.6) ——— */

export interface Mastery {
  attempts: number;
  correct: number;
  partial: number;
  score: number;
  lastResult: "correct" | "partial" | "incorrect" | "skipped" | null;
}

/* ——— Verification ——— */

export type Verdict = "supported" | "partial" | "general" | "unsupported" | "contradicted";

export interface SentenceVerdict {
  index: number;
  verdict: Verdict;
  supportingFactIds: string[];
  note: string;
  revised: boolean;
  /** Original sentence when the Skeptic replaced it. */
  originalText?: string;
}

/* ——— Telemetry (§9.11) ——— */

export type AgentName =
  | "reader"
  | "cartographer"
  | "director"
  | "skeptic"
  | "repair"
  | "tutor"
  | "evaluator"
  | "gardener"
  | "brancher"
  | "lens"
  | "compiler";

export interface AgentRun {
  id: string;
  agent: AgentName;
  model: string;
  effort: string;
  startedAt: string;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  webSearches: number;
  webFetches: number;
  costUsd: number | null;
  stopReason: string;
  thinkingSummary: string;
  replay: boolean;
}

export interface ReportItem {
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
  beatId?: string;
}

export interface SpecReport {
  corrections: ReportItem[];
}

export interface LintReport {
  score: number;
  errors: ReportItem[];
  warnings: ReportItem[];
}

export interface InsertedSegment {
  afterBeatId: string;
  beats: Beat[];
  reason: "remedial" | "branch";
  createdAt: string;
  meta: Record<string, string>;
}

export interface AskReplay {
  question: string;
  beatId: string;
  answer: { text: string; factIds: string[] }[];
  project?: { caption: string; layers: Layer[]; transition: Transition; camera: CameraPreset } | null;
}

export interface WorldSource {
  mode: "pdf" | "image" | "url" | "text" | "topic";
  title: string;
  pages?: number;
  url?: string;
  fileName?: string;
}

export interface World {
  id: string;
  schemaVersion: 1;
  createdAt: string;
  origin: "demo" | "forged" | "shared" | "imported";
  source: WorldSource;
  spec: WorldSpec;
  facts: Fact[];
  misconceptions: Misconception[];
  verification: Record<string, SentenceVerdict[]>;
  inserted: InsertedSegment[];
  levelVariants: Partial<Record<Level, Record<string, Sentence[]>>>;
  mastery: Record<string, Mastery>;
  telemetry: AgentRun[];
  specReport: SpecReport;
  lintReport: LintReport;
  sessionToken?: string;
  posterBeat?: string;
  demoAssets?: {
    remedials?: Record<string, Beat[]>;
    askReplays?: AskReplay[];
    forgeReplay?: string;
    branches?: Record<string, Beat[]>;
  };
}
