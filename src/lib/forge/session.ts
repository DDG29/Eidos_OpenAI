"use client";

import { create } from "zustand";
import type { AgentRun, Beat, Concept, Fact, LintReport, Misconception, PaletteId, Sentence, SentenceVerdict, SourceProfile, World, WorldSpec, WorldSource } from "@/lib/world/types";
import { postSSE } from "@/lib/sse/client";
import { saveWorld } from "@/lib/storage/worlds";
import type { ForgeRequest } from "./request";

/**
 * A forge session lives outside React (spec 3.5): it keeps streaming after the learner enters the world early,
 * and the player subscribes to it. Live SSE and replays feed the same reducer (spec 12.1 ReplayTransport).
 */

export type StageName = "ingest" | "reader" | "cartographer" | "director" | "skeptic" | "repair" | "compiler";
export type StageStatus = "waiting" | "start" | "progress" | "done" | "error";

export interface StageState {
  status: StageStatus;
  detail?: Record<string, unknown>;
  error?: { code: string; message?: string; recoverable?: boolean };
  thinking: string;
}

export interface ForgeState {
  id: string;
  worldId: string | null;
  replay: boolean;
  synthetic: boolean;
  speed: number;
  startedAt: number;
  stages: Record<StageName, StageState>;
  facts: Fact[];
  ledger: { concepts: Concept[]; misconceptions: Misconception[]; profile: SourceProfile | null } | null;
  meta: { title?: string; subtitle?: string; palette?: PaletteId } | null;
  beats: Beat[];
  verified: Record<string, { results: SentenceVerdict[]; sentences: Sentence[] }>;
  compiled: Set<string>;
  world: { spec: WorldSpec; lintReport: LintReport; specReport: { corrections: unknown[] }; source?: WorldSource } | null;
  runs: AgentRun[];
  searches: string[];
  sessionToken: string | null;
  errors: { code: string; stage?: string; message?: string; recoverable?: boolean }[];
  done: { worldId: string; totalCostUsd: number; durationMs: number } | null;
  source: WorldSource | null;
  imageData: ForgeRequest["imageData"];
  savedWorld: World | null;
}

const emptyStage = (): StageState => ({ status: "waiting", thinking: "" });

function initial(id: string, replay: boolean): ForgeState {
  return {
    id,
    worldId: null,
    replay,
    synthetic: false,
    speed: 1,
    startedAt: Date.now(),
    stages: { ingest: emptyStage(), reader: emptyStage(), cartographer: emptyStage(), director: emptyStage(), skeptic: emptyStage(), repair: emptyStage(), compiler: emptyStage() },
    facts: [],
    ledger: null,
    meta: null,
    beats: [],
    verified: {},
    compiled: new Set(),
    world: null,
    runs: [],
    searches: [],
    sessionToken: null,
    errors: [],
    done: null,
    source: null,
    imageData: null,
    savedWorld: null,
  };
}

interface ForgeStore {
  sessions: Record<string, ForgeState>;
  apply: (id: string, event: string, data: unknown) => void;
  start: (id: string, replay: boolean) => void;
  patch: (id: string, p: Partial<ForgeState>) => void;
}

export const useForgeStore = create<ForgeStore>((set, get) => ({
  sessions: {},
  start: (id, replay) => set({ sessions: { ...get().sessions, [id]: initial(id, replay) } }),
  patch: (id, p) => {
    const s = get().sessions[id];
    if (s) set({ sessions: { ...get().sessions, [id]: { ...s, ...p } } });
  },
  apply: (id, event, data) => {
    const prev = get().sessions[id];
    if (!prev) return;
    const s: ForgeState = { ...prev, stages: { ...prev.stages } };
    const d = data as Record<string, unknown>;
    switch (event) {
      case "stage": {
        const name = d.stage as StageName;
        const st = { ...(s.stages[name] ?? emptyStage()) };
        st.status = d.status as StageStatus;
        if (d.detail) st.detail = d.detail as Record<string, unknown>;
        if (d.status === "error") st.error = d.detail as StageState["error"];
        s.stages[name] = st;
        break;
      }
      case "thinking": {
        const agent = (d.agent as string) === "repair" ? "repair" : (d.agent as StageName);
        if (s.stages[agent]) s.stages[agent] = { ...s.stages[agent], thinking: (s.stages[agent].thinking + (d.delta as string)).slice(-1600) };
        break;
      }
      case "search":
        if (typeof d.query === "string") s.searches = [...s.searches, d.query].slice(-8);
        break;
      case "session":
        s.sessionToken = (d.sessionToken as string | null) ?? null;
        s.worldId = (d.worldId as string) ?? s.worldId;
        break;
      case "fact":
        s.facts = [...s.facts, data as Fact];
        break;
      case "ledger":
        s.facts = (d.facts as Fact[]) ?? s.facts;
        s.ledger = { concepts: d.concepts as Concept[], misconceptions: d.misconceptions as Misconception[], profile: (d.profile as SourceProfile) ?? null };
        break;
      case "meta":
        s.meta = { title: d.title as string, subtitle: d.subtitle as string, palette: d.palette as PaletteId };
        break;
      case "beat": {
        const b = data as Beat;
        s.beats = [...s.beats.filter((x) => x.id !== b.id), b];
        break;
      }
      case "verify":
        s.verified = { ...s.verified, [d.beatId as string]: { results: d.results as SentenceVerdict[], sentences: d.revisedSentences as Sentence[] } };
        break;
      case "world":
        s.world = { spec: d.spec as WorldSpec, lintReport: d.lintReport as LintReport, specReport: d.specReport as { corrections: unknown[] }, source: d.source as WorldSource | undefined };
        s.worldId = (d.worldId as string) ?? s.worldId;
        if (d.source) s.source = d.source as WorldSource;
        // the final spec is authoritative; keep streamed beats in its order
        s.beats = (d.spec as WorldSpec).beats;
        break;
      case "usage":
        s.runs = [...s.runs, data as AgentRun];
        break;
      case "error":
        s.errors = [...s.errors, d as ForgeState["errors"][number]];
        break;
      case "done":
        s.done = data as ForgeState["done"];
        s.worldId = (d.worldId as string) ?? s.worldId;
        break;
    }
    set({ sessions: { ...get().sessions, [id]: s } });
  },
}));

export function markCompiled(id: string, beatId: string) {
  const s = useForgeStore.getState().sessions[id];
  if (!s || s.compiled.has(beatId)) return;
  const compiled = new Set(s.compiled);
  compiled.add(beatId);
  useForgeStore.getState().patch(id, { compiled });
}

/** Assemble the World object from what has arrived so far (early entry uses this too). */
export function assembleWorld(s: ForgeState, origin: World["origin"] = "forged"): World | null {
  const spec = s.world?.spec ?? (s.meta && s.beats.length ? ({ title: s.meta.title ?? "", subtitle: s.meta.subtitle ?? "", language: "es", level: "prepa", palette: s.meta.palette ?? "aurora", concepts: s.ledger?.concepts ?? [], beats: s.beats, closing: "", nextTopics: [] } as WorldSpec) : null);
  if (!spec || !s.worldId) return null;
  const beats = spec.beats.map((b) => (s.verified[b.id] ? { ...b, sentences: s.verified[b.id]!.sentences } : b));
  const verification: Record<string, SentenceVerdict[]> = {};
  for (const [k, v] of Object.entries(s.verified)) verification[k] = v.results;
  return {
    id: s.worldId,
    schemaVersion: 1,
    createdAt: new Date(s.startedAt).toISOString(),
    origin,
    source: s.source ?? { mode: "topic", title: spec.title },
    spec: { ...spec, beats },
    facts: s.facts,
    misconceptions: s.ledger?.misconceptions ?? [],
    verification,
    inserted: [],
    levelVariants: {},
    mastery: {},
    telemetry: s.runs.map((r) => ({ ...r, replay: s.replay || r.replay })),
    specReport: { corrections: (s.world?.specReport.corrections as World["specReport"]["corrections"]) ?? [] },
    lintReport: s.world?.lintReport ?? { score: 0, errors: [], warnings: [] },
    sessionToken: s.sessionToken ?? undefined,
  };
}

/* ——— transports ——— */

const requests = new Map<string, ForgeRequest>();

/** Retry from the Director using the ledger already received (no new ingest or Cartographer call). */
export async function retryFromLedger(id: string, signal?: AbortSignal) {
  const s = useForgeStore.getState().sessions[id];
  const req = requests.get(id);
  if (!s || !req || !s.ledger || s.facts.length < 4) return runLive(id, req!, signal);
  const keep = { facts: s.facts, ledger: s.ledger, sessionToken: s.sessionToken, source: s.source, imageData: s.imageData };
  useForgeStore.getState().start(id, false);
  useForgeStore.getState().patch(id, { ...keep, stages: { ...useForgeStore.getState().sessions[id]!.stages, ingest: { status: "done", thinking: "" }, cartographer: { status: "done", thinking: "" } } });
  const fd = formOf(req);
  fd.set("resume", JSON.stringify({ ledger: { facts: s.facts, concepts: s.ledger.concepts, misconceptions: s.ledger.misconceptions, profile: s.ledger.profile ?? { title: "", domain: "", difficulty: req.level, palette: "aurora", visualMotifs: [], numbers: [] } }, sessionToken: s.sessionToken, sourceTitle: s.source?.title ?? "" }));
  await postSSE("/api/forge", fd, (e, d) => useForgeStore.getState().apply(id, e, d), signal);
  await persist(id);
}

function formOf(req: ForgeRequest): FormData {
  const fd = new FormData();
  fd.set("mode", req.mode);
  fd.set("level", req.level);
  fd.set("lang", req.lang);
  fd.set("quality", req.quality);
  if (req.focus) fd.set("focus", req.focus);
  if (req.topic) fd.set("topic", req.topic);
  if (req.url) fd.set("url", req.url.trim());
  if (req.text) fd.set("text", req.text);
  if (req.file) fd.set("file", req.file);
  return fd;
}

export async function runLive(id: string, req: ForgeRequest, signal?: AbortSignal) {
  requests.set(id, req);
  useForgeStore.getState().start(id, false);
  useForgeStore.getState().patch(id, { imageData: req.imageData ?? null, source: { mode: req.mode, title: req.topic ?? req.url ?? req.file?.name ?? "", pages: req.pages } });
  const fd = formOf(req);
  await postSSE("/api/forge", fd, (e, d) => useForgeStore.getState().apply(id, e, d), signal);
  await persist(id);
}

export interface ReplayFile {
  kind: "forge";
  worldId: string;
  recordedAt: string;
  synthetic: boolean;
  events: { t: number; type: string; data: unknown }[];
}

/** Replays drive the same reducer with their original timing (scaled by `speed`). */
export async function runReplay(id: string, replay: ReplayFile, speed = 2, signal?: AbortSignal) {
  useForgeStore.getState().start(id, true);
  useForgeStore.getState().patch(id, { synthetic: replay.synthetic, speed, worldId: replay.worldId });
  const t0 = performance.now();
  for (const ev of replay.events) {
    if (signal?.aborted) return;
    const sp = useForgeStore.getState().sessions[id]?.speed ?? speed;
    const due = ev.t / sp;
    const wait = due - (performance.now() - t0);
    if (wait > 0) await new Promise((r) => setTimeout(r, Math.min(wait, 4000)));
    useForgeStore.getState().apply(id, ev.type, ev.data);
  }
}

async function persist(id: string) {
  const s = useForgeStore.getState().sessions[id];
  if (!s || s.replay) return;
  const w = assembleWorld(s, "forged");
  if (w) {
    await saveWorld(w);
    useForgeStore.getState().patch(id, { savedWorld: w });
  }
}

export function findSessionForWorld(worldId: string): ForgeState | null {
  const all = Object.values(useForgeStore.getState().sessions);
  return all.find((s) => s.worldId === worldId && !s.done && !s.replay) ?? null;
}
