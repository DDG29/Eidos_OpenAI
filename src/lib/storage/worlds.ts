"use client";

import { createStore, del, get, keys, set, clear } from "idb-keyval";
import type { Lang, World } from "@/lib/world/types";
import { summarize, type WorldSummary } from "@/lib/world/summary";

export { summarize, type WorldSummary };
import { migrateWorld } from "@/lib/world/migrate";

/** Local persistence of worlds (spec 8.7): IndexedDB via idb-keyval, keys `world:<id>`. */

const store = typeof indexedDB !== "undefined" ? createStore("eidos", "worlds") : undefined;

export async function saveWorld(w: World): Promise<void> {
  if (!store) return;
  try {
    await set(`world:${w.id}`, w, store);
  } catch {
    /* quota or private mode: worlds stay in memory for this session */
  }
}

export async function getLocalWorld(id: string): Promise<World | null> {
  if (!store) return null;
  try {
    const w = (await get(`world:${id}`, store)) as World | undefined;
    return w ? migrateWorld(w) : null;
  } catch {
    return null;
  }
}

export async function listLocalWorlds(): Promise<WorldSummary[]> {
  if (!store) return [];
  try {
    const ks = (await keys(store)).filter((k): k is string => typeof k === "string" && k.startsWith("world:"));
    const ws = await Promise.all(ks.map((k) => get(k, store) as Promise<World | undefined>));
    return ws
      .filter((w): w is World => !!w && w.origin !== "demo")
      .map(summarize)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

export async function deleteWorld(id: string) {
  if (store) await del(`world:${id}`, store);
}

export async function clearAllWorlds() {
  if (store) await clear(store);
}

/** Demo worlds live in /public/worlds; a locally modified copy (answers, insertions) takes precedence. */
export async function loadWorld(id: string, lang: Lang): Promise<World | null> {
  const local = await getLocalWorld(id);
  if (local) return local;
  const tryFetch = async (path: string) => {
    try {
      const r = await fetch(path);
      if (!r.ok) return null;
      return migrateWorld((await r.json()) as World);
    } catch {
      return null;
    }
  };
  if (!/^[a-z0-9_-]{1,64}$/i.test(id)) return null;
  return (lang === "en" ? await tryFetch(`/worlds/${id}.en.json`) : null) ?? (await tryFetch(`/worlds/${id}.json`));
}

export interface DemoManifestEntry extends WorldSummary {
  hasEnglish: boolean;
}

export async function loadDemoManifest(): Promise<DemoManifestEntry[]> {
  try {
    const r = await fetch("/worlds/index.json");
    if (!r.ok) return [];
    return ((await r.json()) as { worlds: DemoManifestEntry[] }).worlds;
  } catch {
    return [];
  }
}
