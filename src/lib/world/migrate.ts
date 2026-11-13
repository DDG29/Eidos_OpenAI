import type { World } from "./types";

/** Schema migrations by `schemaVersion` (spec 8.7). Version 1 is current; unknown fields are tolerated. */
export function migrateWorld(w: World): World {
  const x = w as World & { schemaVersion?: number };
  if (!x.schemaVersion) x.schemaVersion = 1;
  x.inserted ??= [];
  x.levelVariants ??= {};
  x.mastery ??= {};
  x.telemetry ??= [];
  x.verification ??= {};
  x.specReport ??= { corrections: [] };
  x.lintReport ??= { score: 100, errors: [], warnings: [] };
  return x;
}
