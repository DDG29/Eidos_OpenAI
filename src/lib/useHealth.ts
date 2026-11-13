"use client";

import { create } from "zustand";
import type { Health } from "@/server/health";
import { readByok } from "@/lib/settings/store";

interface HealthState {
  health: Health | null;
  online: boolean;
  loaded: boolean;
  load: () => Promise<void>;
}

/** Demo Mode is on when the server has no key (and no BYOK key is set), when offline, or with ?demo=1 (spec 12.2). */
export const useHealth = create<HealthState>((set, get) => ({
  health: null,
  online: true,
  loaded: false,
  load: async () => {
    if (get().loaded) return;
    try {
      const r = await fetch("/api/health", { cache: "no-store" });
      set({ health: (await r.json()) as Health, loaded: true, online: true });
    } catch {
      set({ loaded: true, online: false });
    }
  },
}));

export function isDemoMode(h: HealthState): boolean {
  if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("demo") === "1") return true;
  if (!h.online) return true;
  if (!h.health) return true;
  if (h.health.live) return false;
  return !(h.health.byok && !!readByok());
}
