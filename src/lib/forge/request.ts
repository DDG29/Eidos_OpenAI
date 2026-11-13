import type { Lang, Level } from "@/lib/world/types";
import type { Quality, SourceMode } from "@/lib/pricing";

export interface ForgeRequest {
  mode: SourceMode;
  topic?: string;
  url?: string;
  text?: string;
  file?: File;
  level: Level;
  lang: Lang;
  quality: Quality;
  focus?: string;
  /** client-side copy of the photo for the `image` shape */
  imageData?: { width: number; height: number; data: Uint8ClampedArray } | null;
  pages?: number;
}

export const LIMITS = { textMin: 200, textMax: 60000, topicMin: 3, topicMax: 300, focusMax: 200, urlMax: 250, imageMb: 10 };

export function validateForgeRequest(r: ForgeRequest): string | null {
  switch (r.mode) {
    case "topic":
      return (r.topic ?? "").trim().length >= LIMITS.topicMin ? null : "console.invalid.topic";
    case "text":
      return (r.text ?? "").trim().length >= LIMITS.textMin ? null : "console.invalid.text";
    case "url":
      try {
        const u = new URL((r.url ?? "").trim());
        if (!/^https?:$/.test(u.protocol) || u.username || u.password || (r.url ?? "").length > LIMITS.urlMax) return "console.invalid.url";
        return null;
      } catch {
        return "console.invalid.url";
      }
    case "pdf":
    case "image":
      return r.file ? null : "console.invalid.file";
  }
}
