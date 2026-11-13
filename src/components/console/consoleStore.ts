"use client";

import { create } from "zustand";
import type { SourceMode } from "@/lib/pricing";

interface ConsoleState {
  mode: SourceMode;
  file: File | null;
  setMode: (m: SourceMode) => void;
  setFile: (f: File | null) => void;
  /** set by drag-and-drop anywhere on the landing */
  dropFile: (f: File) => void;
}

export const useConsole = create<ConsoleState>((set) => ({
  mode: "topic",
  file: null,
  setMode: (mode) => set({ mode }),
  setFile: (file) => set({ file }),
  dropFile: (f) => {
    const isPdf = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
    const isImg = /^image\/(jpeg|png|webp)$/.test(f.type);
    if (isPdf) set({ mode: "pdf", file: f });
    else if (isImg) set({ mode: "image", file: f });
  },
}));
