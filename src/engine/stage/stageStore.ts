import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";
import type { Tier } from "../quality/QualityManager";

export type StageStatus = "idle" | "loading" | "ready" | "nowebgl" | "lost";

export interface StageStoreState {
  status: StageStatus;
  tier: Tier;
  particles: number;
  dpr: number;
  fps: number;
  programId: string | null;
  /** index of the beat the stage currently shows as destination */
  beat: number;
  /** true once the active shapes are uploaded and no morph/event is running (QA shots wait for this) */
  stable: boolean;
  genMs: number;
  /** shots mode: frozen time, no twinkle, no cursor */
  frozen: boolean;
}

export const stageStore = createStore<StageStoreState>(() => ({
  status: "idle",
  tier: 2,
  particles: 0,
  dpr: 1,
  fps: 0,
  programId: null,
  beat: 0,
  stable: false,
  genMs: 0,
  frozen: false,
}));

export function useStage<T>(selector: (s: StageStoreState) => T): T {
  return useStore(stageStore, selector);
}
