import type { Stage } from "./Stage";

/** Module-level handle on the single persistent Stage (it lives in the root layout and never unmounts). */
let stage: Stage | null = null;
const waiters = new Set<(s: Stage) => void>();

export function setStage(s: Stage | null) {
  stage = s;
  if (s) for (const w of waiters) w(s);
  if (s) waiters.clear();
}

export function getStage(): Stage | null {
  return stage;
}

export function whenStage(): Promise<Stage> {
  if (stage) return Promise.resolve(stage);
  return new Promise((res) => waiters.add(res));
}
