import { compileOrRepair } from "@/engine/paramath";
import { getShape, regionMatchesSpec, resolveParams } from "@/engine/shapes/registry";
import { parseSvgPath } from "@/engine/shapes/raster/svgPath";
import type { ShapeDefinition } from "@/engine/shapes/types";
import {
  AMBIENTS,
  BEAT_KINDS,
  CAMERA_PRESETS,
  COLOR_MODES,
  COLOR_ROLES,
  LEVELS,
  PALETTE_IDS,
  SHAPE_IDS,
  TRANSITIONS,
  type Ambient,
  type Annotation,
  type Beat,
  type BeatKind,
  type CameraPreset,
  type Check,
  type ColorMode,
  type ColorRole,
  type Concept,
  type Knob,
  type Layer,
  type Level,
  type PaletteId,
  type ReportItem,
  type Sentence,
  type ShapeId,
  type Transition,
  type WorldSpec,
} from "./types";
import { validateReadout } from "./readout";

/** Strict validation + sanitation of Claude's World Spec (spec 8.3): clamp instead of reject, report everything. */

export interface SanitizeContext {
  factIds: ReadonlySet<string>;
  conceptIds: ReadonlySet<string>;
  misconceptionIds: ReadonlySet<string>;
  /** returns the region ids a layer actually produces (runs the generator at a small count) */
  regionProbe?: (layer: Layer) => string[];
  /** id prefix for generated ids ("b" for trunk, "r01" remedial, "x01" branch) */
  idPrefix?: string;
  /** trunk worlds must start with hook and end with finale */
  enforceArc?: boolean;
}

export const LIMITS = { beatTitle: 80, sentence: 260, annotation: 40, question: 220, choice: 120, worldTitle: 90, subtitle: 160, closing: 900, explanation: 500, idealAnswer: 500, label: 60, unit: 16, readout: 160, conceptName: 60, conceptSummary: 260, nextTopic: 90 };

const ALIASES: Record<string, string> = {
  torus_knot: "torusKnot",
  torusknot: "torusKnot",
  "torus-knot": "torusKnot",
  knot: "torusKnot",
  "orbit-close": "orbit_close",
  "orbit-wide": "orbit_wide",
  "top-down": "top_down",
  topdown: "top_down",
  "dolly-in": "dolly_in",
  "dolly-out": "dolly_out",
  "low-angle": "low_angle",
};

function normEnum<T extends string>(v: unknown, allowed: readonly T[], fallback: T, report: ReportItem[], what: string, beatId?: string): T {
  if (typeof v !== "string") return fallback;
  const raw = v.trim();
  const alias = ALIASES[raw.toLowerCase()] ?? raw;
  const hit = allowed.find((a) => a.toLowerCase() === alias.toLowerCase());
  if (hit) return hit;
  report.push({ severity: "warning", code: "ENUM", message: `Unknown ${what} "${raw}" → ${fallback}`, beatId });
  return fallback;
}

const str = (v: unknown, max: number, fallback = ""): string => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : fallback);
const num = (v: unknown, fallback: number): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

export function editDistance(a: string, b: string): number {
  const m = a.length,
    n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...new Array<number>(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0]![j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++) d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m]![n]!;
}

function sanitizeExpr(def: ShapeDefinition, key: string, value: string, report: ReportItem[], beatId: string): string | null {
  const spec = def.expr.find((e) => e.key === key);
  if (!spec) {
    report.push({ severity: "warning", code: "EXPR_UNKNOWN", message: `${def.id}: unknown expression "${key}" dropped`, beatId });
    return null;
  }
  const v = value.slice(0, spec.maxLength);
  switch (spec.kind) {
    case "paramath": {
      const r = compileOrRepair(v, spec.vars ?? [], spec.default);
      if (r.fellBack) {
        report.push({ severity: "error", code: "PARAMATH", message: `${def.id}.${key}: ${r.error ?? "invalid"} — replaced by default`, beatId });
        return spec.default;
      }
      if (r.repaired) report.push({ severity: "info", code: "PARAMATH_REPAIRED", message: `${def.id}.${key} repaired`, beatId });
      return r.used;
    }
    case "svgpath": {
      const p = parseSvgPath(v, spec.maxLength);
      if (!p.ok) {
        report.push({ severity: "error", code: "SVGPATH", message: `${def.id}.${key}: ${p.error} — replaced by default`, beatId });
        return spec.default;
      }
      return v;
    }
    case "text":
      return v.replace(/[<>{}[\]\\`$]/g, "").slice(0, spec.maxLength) || spec.default;
    default:
      return v;
  }
}

export function sanitizeLayer(raw: unknown, report: ReportItem[], beatId: string): Layer {
  const o = obj(raw);
  let shape = normEnum<ShapeId>(o.shape, SHAPE_IDS, "nebula", report, "shape", beatId);
  let def = getShape(shape);
  if (!def) {
    report.push({ severity: "warning", code: "SHAPE_MISSING", message: `shape "${shape}" not available → nebula`, beatId });
    shape = "nebula";
    def = getShape("nebula")!;
  }
  const kvIn = arr(o.params)
    .map(obj)
    .filter((p) => typeof p.key === "string")
    .map((p) => ({ key: String(p.key), value: num(p.value, NaN) }));
  const { params, unknown } = resolveParams(def, kvIn.filter((p) => Number.isFinite(p.value)));
  if (unknown.length) report.push({ severity: "warning", code: "PARAM_UNKNOWN", message: `${shape}: unknown params ${unknown.join(", ")} dropped`, beatId });
  for (const p of kvIn) {
    const spec = def.params.find((s) => s.key === p.key);
    if (spec && Number.isFinite(p.value) && (p.value < spec.min || p.value > spec.max))
      report.push({ severity: "info", code: "PARAM_CLAMPED", message: `${shape}.${p.key} ${p.value} clamped to [${spec.min}, ${spec.max}]`, beatId });
  }
  const given = new Set(kvIn.map((p) => p.key));
  const paramsOut = def.params.filter((p) => given.has(p.key)).map((p) => ({ key: p.key, value: params[p.key]! }));
  const exprOut: { key: string; value: string }[] = [];
  for (const e of arr(o.expr).map(obj)) {
    if (typeof e.key !== "string" || typeof e.value !== "string" || e.value.trim() === "") continue;
    const v = sanitizeExpr(def, e.key, e.value, report, beatId);
    if (v !== null && !exprOut.some((x) => x.key === e.key)) exprOut.push({ key: e.key, value: v });
  }
  let data = arr(o.data).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (def.data) {
    if (data.length > def.data.maxLength) report.push({ severity: "info", code: "DATA_TRUNCATED", message: `${shape}: data truncated to ${def.data.maxLength}`, beatId });
    data = data.slice(0, def.data.maxLength);
  } else data = [];
  const pos = obj(o.position);
  const rot = obj(o.rotation);
  return {
    shape,
    params: paramsOut,
    expr: exprOut,
    data,
    share: clamp(num(o.share, 1), 0, 1),
    position: { x: clamp(num(pos.x, 0), -2.5, 2.5), y: clamp(num(pos.y, 0), -2.5, 2.5), z: clamp(num(pos.z, 0), -2.5, 2.5) },
    rotation: { x: clamp(num(rot.x, 0), -360, 360), y: clamp(num(rot.y, 0), -360, 360), z: clamp(num(rot.z, 0), -360, 360) },
    scale: clamp(num(o.scale, 1), 0.2, 2),
    colorMode: normEnum<ColorMode>(o.colorMode, COLOR_MODES, "palette", report, "colorMode", beatId),
    tint: normEnum<ColorRole>(o.tint, COLOR_ROLES, "primary", report, "tint", beatId),
  };
}

function sanitizeSentences(raw: unknown, ctx: SanitizeContext, report: ReportItem[], beatId: string): Sentence[] {
  return arr(raw)
    .map(obj)
    .map((s) => {
      const text = str(s.text, LIMITS.sentence);
      const ids = arr(s.factIds).filter((x): x is string => typeof x === "string");
      const valid = ids.filter((id) => ctx.factIds.has(id));
      if (valid.length !== ids.length) report.push({ severity: "warning", code: "FACT_REF", message: `unknown fact ids ${ids.filter((i) => !ctx.factIds.has(i)).join(", ")} dropped`, beatId });
      return { text, factIds: Array.from(new Set(valid)) };
    })
    .filter((s) => s.text.length > 0);
}

const NEUTRAL_KNOB: Knob = { enabled: false, label: "", layerIndex: 0, paramKey: "", min: 0, max: 0, initial: 0, step: 0, unit: "", readout: "" };
const NEUTRAL_CHECK: Check = { enabled: false, question: "", choices: [], correctIndex: 0, allowFreeText: false, idealAnswer: "", explanation: "", conceptIds: [] };

export function sanitizeBeat(raw: unknown, index: number, ctx: SanitizeContext, report: ReportItem[]): Beat {
  const o = obj(raw);
  const prefix = ctx.idPrefix ?? "b";
  const fallbackId = prefix === "b" ? `b${String(index + 1).padStart(2, "0")}` : `${prefix}${String.fromCharCode(97 + index)}`;
  const id = typeof o.id === "string" && /^[a-z]\d{2}[a-z]?$/i.test(o.id.trim()) ? o.id.trim() : fallbackId;
  const kind = normEnum<BeatKind>(o.kind, BEAT_KINDS, "concept", report, "kind", id);
  let layers = arr(o.layers)
    .slice(0, 3)
    .map((l) => sanitizeLayer(l, report, id));
  if (layers.length === 0) {
    report.push({ severity: "warning", code: "NO_LAYERS", message: "beat without layers → nebula", beatId: id });
    layers = [sanitizeLayer({ shape: "nebula", share: 0.9 }, report, id)];
  }
  const shareSum = layers.reduce((s, l) => s + l.share, 0);
  if (shareSum > 1) layers = layers.map((l) => ({ ...l, share: l.share / shareSum }));

  // Annotations against the regions each layer really produces.
  const regionCache = new Map<number, string[]>();
  const regionsOf = (li: number): string[] => {
    if (!regionCache.has(li)) regionCache.set(li, ctx.regionProbe ? ctx.regionProbe(layers[li]!) : []);
    return regionCache.get(li)!;
  };
  const annotations: Annotation[] = [];
  for (const a of arr(o.annotations).map(obj)) {
    const li = Math.round(num(a.layerIndex, 0));
    const text = str(a.text, LIMITS.annotation);
    const rid = typeof a.regionId === "string" ? a.regionId.trim() : "";
    if (!layers[li] || !text || !rid) {
      report.push({ severity: "warning", code: "ANNOTATION", message: `annotation "${text || rid}" dropped (invalid layer or empty)`, beatId: id });
      continue;
    }
    const def = getShape(layers[li]!.shape);
    const produced = regionsOf(li);
    let match = produced.length ? produced.find((r) => r === rid) : def && regionMatchesSpec(def, rid) ? rid : undefined;
    if (!match && produced.length) {
      const near = produced.map((r) => [r, editDistance(r.toLowerCase(), rid.toLowerCase())] as const).sort((x, y) => x[1] - y[1])[0];
      if (near && near[1] <= 2) {
        match = near[0];
        report.push({ severity: "info", code: "ANNOTATION_FUZZY", message: `region "${rid}" → "${match}"`, beatId: id });
      }
    }
    if (!match) {
      report.push({ severity: "warning", code: "ANNOTATION_REGION", message: `region "${rid}" not produced by ${layers[li]!.shape}; annotation dropped`, beatId: id });
      continue;
    }
    if (annotations.length < 4) annotations.push({ layerIndex: li, regionId: match, text });
  }

  // Knob
  const k = obj(o.knob);
  let knob: Knob = { ...NEUTRAL_KNOB };
  if (k.enabled === true) {
    const li = Math.round(num(k.layerIndex, 0));
    const layer = layers[li];
    const def = layer ? getShape(layer.shape) : undefined;
    const p = def?.params.find((x) => x.key === k.paramKey);
    if (!layer || !def || !p) {
      report.push({ severity: "warning", code: "KNOB", message: `knob on "${String(k.paramKey)}" is not a parameter of layer ${li}; disabled`, beatId: id });
    } else {
      let min = clamp(num(k.min, p.min), p.min, p.max);
      let max = clamp(num(k.max, p.max), p.min, p.max);
      if (min > max) [min, max] = [max, min];
      if (min === max) {
        min = p.min;
        max = p.max;
      }
      const step = num(k.step, 0) > 0 ? num(k.step, 0) : p.integer ? 1 : +((max - min) / 100).toPrecision(2);
      const readout = str(k.readout, LIMITS.readout);
      const rv = validateReadout(readout);
      if (!rv.ok) report.push({ severity: "warning", code: "READOUT", message: `readout has invalid expressions: ${rv.errors.join("; ")}`, beatId: id });
      knob = {
        enabled: true,
        label: str(k.label, LIMITS.label, p.key),
        layerIndex: li,
        paramKey: p.key,
        min,
        max,
        initial: clamp(num(k.initial, (min + max) / 2), min, max),
        step,
        unit: str(k.unit, LIMITS.unit),
        readout,
      };
    }
  }

  // Check
  const c = obj(o.check);
  let check: Check = { ...NEUTRAL_CHECK };
  if (c.enabled === true || kind === "check") {
    const choices = arr(c.choices)
      .map(obj)
      .map((ch) => {
        const mid = typeof ch.misconceptionId === "string" ? ch.misconceptionId.trim() : "";
        const validMid = mid && ctx.misconceptionIds.has(mid) ? mid : "";
        if (mid && !validMid) report.push({ severity: "warning", code: "MISCONCEPTION_REF", message: `unknown misconception "${mid}"`, beatId: id });
        return { text: str(ch.text, LIMITS.choice), misconceptionId: validMid };
      })
      .filter((ch) => ch.text)
      .slice(0, 4);
    const correctIndex = clamp(Math.round(num(c.correctIndex, 0)), 0, Math.max(0, choices.length - 1));
    if (choices[correctIndex]) choices[correctIndex]!.misconceptionId = "";
    check = {
      enabled: true,
      question: str(c.question, LIMITS.question),
      choices,
      correctIndex,
      allowFreeText: c.allowFreeText !== false,
      idealAnswer: str(c.idealAnswer, LIMITS.idealAnswer),
      explanation: str(c.explanation, LIMITS.explanation),
      conceptIds: arr(c.conceptIds).filter((x): x is string => typeof x === "string" && ctx.conceptIds.has(x)),
    };
  }

  const conceptIds = arr(o.conceptIds).filter((x): x is string => typeof x === "string");
  const validConcepts = conceptIds.filter((x) => ctx.conceptIds.has(x));
  if (validConcepts.length !== conceptIds.length) report.push({ severity: "info", code: "CONCEPT_REF", message: `unknown concept ids dropped`, beatId: id });

  return {
    id,
    kind,
    title: str(o.title, LIMITS.beatTitle),
    sentences: sanitizeSentences(o.sentences, ctx, report, id),
    conceptIds: validConcepts,
    layers,
    transition: normEnum<Transition>(o.transition, TRANSITIONS, "flow", report, "transition", id),
    camera: normEnum<CameraPreset>(o.camera, CAMERA_PRESETS, "orbit_close", report, "camera", id),
    annotations,
    knob,
    check: kind === "check" || check.enabled ? check : NEUTRAL_CHECK,
    ambient: normEnum<Ambient>(o.ambient, AMBIENTS, "calm", report, "ambient", id),
    weight: clamp(num(o.weight, 1), 0.6, 2),
  };
}

export function sanitizeConcepts(raw: unknown, report: ReportItem[]): Concept[] {
  const seen = new Set<string>();
  const out: Concept[] = [];
  for (const c of arr(raw).map(obj)) {
    const id = typeof c.id === "string" ? c.id.trim() : "";
    if (!/^C\d{2}$/.test(id) || seen.has(id)) {
      report.push({ severity: "info", code: "CONCEPT_ID", message: `concept "${id}" dropped (invalid or duplicate id)` });
      continue;
    }
    seen.add(id);
    out.push({ id, name: str(c.name, LIMITS.conceptName, id), summary: str(c.summary, LIMITS.conceptSummary), dependsOn: [] });
    out[out.length - 1]!.dependsOn = arr(c.dependsOn).filter((x): x is string => typeof x === "string");
  }
  for (const c of out) c.dependsOn = c.dependsOn.filter((d) => seen.has(d) && d !== c.id);
  return out;
}

/** Full sanitation of a Director/Repair World Spec. */
export function sanitizeWorldSpec(raw: unknown, ctx: SanitizeContext): { spec: WorldSpec; report: ReportItem[] } {
  const report: ReportItem[] = [];
  const o = obj(raw);
  const concepts = sanitizeConcepts(o.concepts, report);
  const allConcepts = new Set([...ctx.conceptIds, ...concepts.map((c) => c.id)]);
  const bctx: SanitizeContext = { ...ctx, conceptIds: allConcepts };
  let beats = arr(o.beats).map((b, i) => sanitizeBeat(b, i, bctx, report));
  // Unique, ordered ids for the trunk.
  const seen = new Set<string>();
  beats = beats.map((b, i) => {
    const want = `b${String(i + 1).padStart(2, "0")}`;
    if (b.id !== want || seen.has(b.id)) {
      if (b.id !== want) report.push({ severity: "info", code: "BEAT_ID", message: `beat id "${b.id}" → "${want}"`, beatId: want });
    }
    seen.add(want);
    return { ...b, id: want };
  });
  if (ctx.enforceArc !== false && beats.length) {
    if (beats[0]!.kind !== "hook") {
      report.push({ severity: "info", code: "ARC_HOOK", message: `first beat relabelled as hook (was ${beats[0]!.kind})`, beatId: beats[0]!.id });
      beats[0] = { ...beats[0]!, kind: "hook", check: NEUTRAL_CHECK };
    }
    if (beats[beats.length - 1]!.kind !== "finale") {
      report.push({ severity: "info", code: "ARC_FINALE", message: "finale beat appended" });
      beats.push(
        sanitizeBeat(
          { id: `b${String(beats.length + 1).padStart(2, "0")}`, kind: "finale", title: str(o.title, LIMITS.beatTitle), sentences: [], layers: [{ shape: "nebula", share: 0.6 }], transition: "dissolve", camera: "orbit_wide", ambient: "triumphant", weight: 1.25 },
          beats.length,
          bctx,
          report,
        ),
      );
    }
  }
  const spec: WorldSpec = {
    title: str(o.title, LIMITS.worldTitle, "EIDOS"),
    subtitle: str(o.subtitle, LIMITS.subtitle),
    language: o.language === "en" ? "en" : "es",
    level: normEnum<Level>(o.level, LEVELS, "prepa", report, "level"),
    palette: normEnum<PaletteId>(o.palette, PALETTE_IDS, "aurora", report, "palette"),
    concepts,
    beats,
    closing: str(o.closing, LIMITS.closing),
    nextTopics: arr(o.nextTopics)
      .filter((x): x is string => typeof x === "string")
      .map((x) => x.trim().slice(0, LIMITS.nextTopic))
      .filter(Boolean)
      .slice(0, 3),
  };
  return { spec, report };
}
