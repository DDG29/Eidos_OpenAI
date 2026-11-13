"use client";

import { postJSON } from "@/lib/sse/client";
import type { LensRequest } from "@/lib/api/schemas";
import type { Level, Sentence, World } from "@/lib/world/types";
import { usePlayer } from "./playerStore";

/** Rewrite the narration for another level (spec 9.10) and cache it in the world. */
export async function rewriteLens(world: World, level: Level): Promise<boolean> {
  const req: LensRequest = {
    beats: world.spec.beats.filter((b) => b.kind !== "finale").map((b) => ({ id: b.id, sentences: b.sentences })),
    targetLevel: level,
    lang: world.spec.language,
  };
  try {
    const r = await postJSON<{ beats: { id: string; sentences: Sentence[] }[] }>("/api/lens", req);
    usePlayer.getState().setLevelVariant(level, Object.fromEntries(r.beats.map((b) => [b.id, b.sentences])));
    return true;
  } catch {
    return false;
  }
}
