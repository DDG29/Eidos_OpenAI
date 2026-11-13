"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type QualityPref = "auto" | "high" | "medium" | "low" | "minimal";
export type MotionPref = "system" | "reduce";

export interface SettingsState {
  sound: boolean;
  volume: number; // 0..1
  quality: QualityPref;
  motion: MotionPref;
  textSize: "normal" | "large";
  voice: boolean;
  voiceName: string;
  voiceRate: number;
  set: (patch: Partial<Omit<SettingsState, "set" | "reset">>) => void;
  reset: () => void;
}

const DEFAULTS = {
  sound: false,
  volume: 0.5,
  quality: "auto" as QualityPref,
  motion: "system" as MotionPref,
  textSize: "normal" as const,
  voice: false,
  voiceName: "",
  voiceRate: 1,
};

const safeStorage = createJSONStorage(() => {
  try {
    const k = "__eidos_probe__";
    localStorage.setItem(k, "1");
    localStorage.removeItem(k);
    return localStorage;
  } catch {
    const mem = new Map<string, string>();
    return {
      getItem: (key: string) => mem.get(key) ?? null,
      setItem: (key: string, value: string) => void mem.set(key, value),
      removeItem: (key: string) => void mem.delete(key),
    };
  }
});

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      set: (patch) => set(patch),
      reset: () => set(DEFAULTS),
    }),
    { name: "eidos:settings", storage: safeStorage, version: 1 },
  ),
);

/** BYOK key lives only in sessionStorage, never in the persisted store. */
export const BYOK_KEY = "eidos:byok";
export function readByok(): string | null {
  try {
    return sessionStorage.getItem(BYOK_KEY);
  } catch {
    return null;
  }
}
export function writeByok(v: string | null) {
  try {
    if (v) sessionStorage.setItem(BYOK_KEY, v);
    else sessionStorage.removeItem(BYOK_KEY);
  } catch {
    /* ignore */
  }
}

export function prefersReducedMotion(pref: MotionPref): boolean {
  if (pref === "reduce") return true;
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}
