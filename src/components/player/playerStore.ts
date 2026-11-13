"use client";

import { create } from "zustand";
import type { Beat, InsertedSegment, Level, Mastery, Sentence, World } from "@/lib/world/types";
import { saveWorld } from "@/lib/storage/worlds";

/** Player state: the world (mutable copy), Lens level, check results, mastery and insertions. */

export type CheckStatus = "pending" | "correct" | "partial" | "incorrect" | "skipped";

export interface CheckResult {
  status: CheckStatus;
  choice: number | null;
  freeText?: string;
  feedback?: string;
  missingIdea?: string;
  misconceptionId?: string;
  offline?: boolean;
}

export interface EffectiveBeat {
  beat: Beat;
  /** "trunk" | "remedial" | "branch" */
  origin: "trunk" | "remedial" | "branch";
  /** for inserted beats: the beat they hang from */
  anchor?: string;
  /** created during this session (sprout animation) */
  fresh?: boolean;
}

interface PlayerState {
  world: World | null;
  level: Level;
  checks: Record<string, CheckResult>;
  growing: { checkId: string; thinking: string } | null;
  growthsByConcept: Record<string, number>;
  freshIds: Set<string>;
  lensBusy: boolean;
  setWorld: (w: World) => void;
  setLevel: (l: Level) => void;
  setLevelVariant: (l: Level, byBeat: Record<string, Sentence[]>) => void;
  answer: (beatId: string, r: CheckResult) => void;
  insert: (seg: InsertedSegment) => void;
  setGrowing: (g: PlayerState["growing"]) => void;
  completeRemedial: (conceptIds: string[]) => void;
  addTelemetry: (run: World["telemetry"][number]) => void;
  persist: () => void;
}

const DELTA = { correct: 0.5, partial: 0.25, incorrect: -0.1 } as const;

export function bumpMastery(m: Mastery | undefined, result: "correct" | "partial" | "incorrect" | "skipped" | "remedial"): Mastery {
  const x: Mastery = m ? { ...m } : { attempts: 0, correct: 0, partial: 0, score: 0, lastResult: null };
  if (result === "remedial") {
    x.score = Math.min(1, x.score + 0.15);
    return x;
  }
  if (result === "skipped") {
    x.lastResult = "skipped";
    return x;
  }
  x.attempts++;
  if (result === "correct") x.correct++;
  if (result === "partial") x.partial++;
  x.score = Math.min(1, Math.max(0, x.score + DELTA[result]));
  x.lastResult = result;
  return x;
}

/** Trunk + inserted segments in reading order (remedials and branches right after their anchor beat). */
export function effectiveBeats(w: World, level: Level, fresh: Set<string>): EffectiveBeat[] {
  const variant = w.levelVariants[level];
  const withLevel = (b: Beat): Beat => (variant?.[b.id] ? { ...b, sentences: variant[b.id]! } : b);
  const out: EffectiveBeat[] = [];
  const byAnchor = new Map<string, InsertedSegment[]>();
  for (const seg of w.inserted) byAnchor.set(seg.afterBeatId, [...(byAnchor.get(seg.afterBeatId) ?? []), seg]);
  const pushWithInserts = (b: Beat, origin: EffectiveBeat["origin"], anchor?: string) => {
    out.push({ beat: origin === "trunk" ? withLevel(b) : b, origin, anchor, fresh: fresh.has(b.id) });
    for (const seg of byAnchor.get(b.id) ?? [])
      for (const ib of seg.beats) pushWithInserts(ib, seg.reason === "remedial" ? "remedial" : "branch", b.id);
  };
  for (const b of w.spec.beats) pushWithInserts(b, "trunk");
  return out;
}

export const usePlayer = create<PlayerState>((set, get) => ({
  world: null,
  level: "prepa",
  checks: {},
  growing: null,
  growthsByConcept: {},
  freshIds: new Set(),
  lensBusy: false,
  setWorld: (w) => {
    const checks: Record<string, CheckResult> = {};
    for (const [id, m] of Object.entries((w as World & { checkResults?: Record<string, CheckResult> }).checkResults ?? {})) checks[id] = m;
    set({ world: w, level: w.spec.level, checks, freshIds: new Set(), growing: null, growthsByConcept: {} });
  },
  setLevel: (level) => set({ level }),
  setLevelVariant: (l, byBeat) => {
    const w = get().world;
    if (!w) return;
    set({ world: { ...w, levelVariants: { ...w.levelVariants, [l]: byBeat } } });
    get().persist();
  },
  answer: (beatId, r) => {
    const w = get().world;
    if (!w) return;
    const beat = effectiveBeats(w, get().level, new Set()).find((e) => e.beat.id === beatId)?.beat;
    const mastery = { ...w.mastery };
    if (beat && r.status !== "pending") for (const c of beat.check.conceptIds.length ? beat.check.conceptIds : beat.conceptIds) mastery[c] = bumpMastery(mastery[c], r.status);
    set({ checks: { ...get().checks, [beatId]: r }, world: { ...w, mastery } });
    get().persist();
  },
  insert: (seg) => {
    const w = get().world;
    if (!w) return;
    const fresh = new Set(get().freshIds);
    for (const b of seg.beats) fresh.add(b.id);
    const concept = seg.meta.conceptId;
    set({
      world: { ...w, inserted: [...w.inserted, seg] },
      freshIds: fresh,
      growthsByConcept: concept ? { ...get().growthsByConcept, [concept]: (get().growthsByConcept[concept] ?? 0) + 1 } : get().growthsByConcept,
    });
    get().persist();
  },
  setGrowing: (growing) => set({ growing }),
  completeRemedial: (conceptIds) => {
    const w = get().world;
    if (!w) return;
    const mastery = { ...w.mastery };
    for (const c of conceptIds) mastery[c] = bumpMastery(mastery[c], "remedial");
    set({ world: { ...w, mastery } });
    get().persist();
  },
  addTelemetry: (run) => {
    const w = get().world;
    if (!w) return;
    set({ world: { ...w, telemetry: [...w.telemetry, run] } });
  },
  persist: () => {
    const w = get().world;
    if (!w) return;
    void saveWorld({ ...w, ...({ checkResults: get().checks } as object) } as World);
  },
}));
