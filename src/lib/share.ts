"use client";

import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";
import type { World } from "@/lib/world/types";
import { WorldFileSchema } from "@/lib/world/worldFile";
import { migrateWorld } from "@/lib/world/migrate";

export const MAX_FRAGMENT = 60_000;

/** Strip what must never travel: session token, telemetry thinking, demo assets beyond what the player needs. */
export function shareable(w: World): World {
  const { sessionToken: _s, ...rest } = w;
  void _s;
  return { ...rest, origin: "shared", telemetry: w.telemetry.map((r) => ({ ...r, thinkingSummary: "" })), mastery: {} } as World;
}

export function encodeWorld(w: World): string {
  return compressToEncodedURIComponent(JSON.stringify(shareable(w)));
}

export function decodeWorld(z: string): World | null {
  try {
    const json = decompressFromEncodedURIComponent(z);
    if (!json) return null;
    return parseWorldFile(JSON.parse(json));
  } catch {
    return null;
  }
}

export function parseWorldFile(raw: unknown): World | null {
  const r = WorldFileSchema.safeParse(raw);
  if (!r.success) return null;
  return migrateWorld(r.data as unknown as World);
}
