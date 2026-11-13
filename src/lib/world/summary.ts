import type { Lang, Level, PaletteId, World } from "./types";

export interface WorldSummary {
  id: string;
  title: string;
  subtitle: string;
  level: Level;
  language: Lang;
  palette: PaletteId;
  beats: number;
  minutes: number;
  origin: World["origin"];
  supportedPct: number | null;
  createdAt: string;
  posterBeat?: string;
  domain?: string;
}

export function summarize(w: World): WorldSummary {
  const sentences = w.spec.beats.flatMap((b) => b.sentences);
  const verdicts = Object.values(w.verification).flat();
  const supported = verdicts.filter((v) => v.verdict === "supported" || (v.verdict === "partial" && v.revised)).length;
  const words = sentences.reduce((s, x) => s + x.text.split(/\s+/).length, 0);
  return {
    id: w.id,
    title: w.spec.title,
    subtitle: w.spec.subtitle,
    level: w.spec.level,
    language: w.spec.language,
    palette: w.spec.palette,
    beats: w.spec.beats.length,
    minutes: Math.max(2, Math.round(words / 160 + w.spec.beats.length * 0.35)),
    origin: w.origin,
    supportedPct: verdicts.length ? Math.round((100 * supported) / verdicts.length) : null,
    createdAt: w.createdAt,
    posterBeat: w.posterBeat,
  };
}

