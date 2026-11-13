import { readFileSync } from "node:fs";
import { join } from "node:path";

let version = "0.0.0";
try {
  version = (JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as { version: string }).version;
} catch {
  /* ignore */
}

export interface Health {
  live: boolean;
  byok: boolean;
  features: { share: "kv" | "url"; sessionDocs: boolean; webSearch: boolean };
  models: Record<string, string>;
  limits: { pdfMb: number; pdfPages: number };
  version: string;
}

export function serverHasKey(): boolean {
  return !!process.env.ANTHROPIC_API_KEY?.trim();
}

/** Never exposes the key; only whether one exists (spec 10.2). */
export function healthReport(): Health {
  return {
    live: serverHasKey(),
    byok: process.env.ALLOW_BYOK === "true",
    features: {
      share: process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN ? "kv" : "url",
      sessionDocs: !!process.env.SESSION_SECRET || process.env.NODE_ENV === "development",
      webSearch: true,
    },
    models: {
      director: process.env.EIDOS_MODEL_DIRECTOR || "claude-opus-5-5",
      skeptic: process.env.EIDOS_MODEL_SKEPTIC || "claude-sonnet-5-5",
      tutor: process.env.EIDOS_MODEL_TUTOR || "claude-sonnet-5-5",
    },
    limits: { pdfMb: Number(process.env.MAX_PDF_MB || 32), pdfPages: Number(process.env.MAX_PDF_PAGES || 100) },
    version,
  };
}
