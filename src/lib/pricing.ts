/**
 * Model prices in USD per million tokens. Opus 5.5 from the master prompt (§9.1); Sonnet 5.5 and Haiku 5.5
 * from the Claude API model table consulted 2026-11-03 (see DECISIONS.md #6).
 */
export interface Price {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite5m: number;
  cacheWrite1h: number;
}

export const PRICES_CHECKED_AT = "2026-11-03";
export const WEB_SEARCH_USD_PER_1K = 10;

export const PRICES: Record<string, Price | null> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite5m: 5, cacheWrite1h: 8 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.1, cacheWrite5m: 2.5, cacheWrite1h: 4 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite5m: 0.125, cacheWrite1h: 0.2 },
};

export interface UsageLike {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation?: { ephemeral_5m_input_tokens?: number | null; ephemeral_1h_input_tokens?: number | null } | null;
  server_tool_use?: { web_search_requests?: number | null; web_fetch_requests?: number | null } | null;
}

/** Cost of one call. Cache writes default to the 1 h rate (EIDOS caches with ttl 1h). */
export function costOf(model: string, u: UsageLike): number | null {
  const p = PRICES[model];
  if (!p) return null;
  const inp = u.input_tokens ?? 0;
  const out = u.output_tokens ?? 0;
  const read = u.cache_read_input_tokens ?? 0;
  const w5 = u.cache_creation?.ephemeral_5m_input_tokens ?? 0;
  const w1 = u.cache_creation?.ephemeral_1h_input_tokens ?? Math.max(0, (u.cache_creation_input_tokens ?? 0) - w5);
  const searches = u.server_tool_use?.web_search_requests ?? 0;
  const usd = (inp * p.input + out * p.output + read * p.cacheRead + w5 * p.cacheWrite5m + w1 * p.cacheWrite1h) / 1e6 + (searches * WEB_SEARCH_USD_PER_1K) / 1000;
  return Math.round(usd * 1e6) / 1e6;
}

export type Quality = "fast" | "deep" | "master";
export type SourceMode = "pdf" | "image" | "url" | "text" | "topic";

/** Typical outputs per agent and mode (order of magnitude, from the token budgets in §9.2). */
const OUT: Record<Quality, { carto: number; director: number; skeptic: number; reader: number }> = {
  fast: { carto: 5000, director: 14000, skeptic: 4000, reader: 1500 },
  deep: { carto: 8000, director: 22000, skeptic: 6000, reader: 2500 },
  master: { carto: 14000, director: 38000, skeptic: 12000, reader: 4000 },
};
const MODELS: Record<Quality, { carto: string; director: string; skeptic: string; reader: string }> = {
  fast: { carto: "claude-opus-5-5", director: "claude-opus-5-5", skeptic: "claude-haiku-5-5", reader: "claude-sonnet-5-5" },
  deep: { carto: "claude-opus-5-5", director: "claude-opus-5-5", skeptic: "claude-sonnet-5-5", reader: "claude-sonnet-5-5" },
  master: { carto: "claude-opus-5-5", director: "claude-opus-5-5", skeptic: "claude-opus-5-5", reader: "claude-opus-5-5" },
};

export interface EstimateInput {
  mode: SourceMode;
  quality: Quality;
  pages?: number;
  chars?: number;
}

/** A range, never false precision (spec 9.11). */
export function estimateForge(e: EstimateInput): { lowUsd: number; highUsd: number; seconds: number } {
  const srcTokens =
    e.mode === "pdf" ? (e.pages ?? 10) * 1500 : e.mode === "text" ? Math.ceil((e.chars ?? 4000) / 3.5) : e.mode === "url" ? 9000 : e.mode === "image" ? 2500 : 14000;
  const o = OUT[e.quality];
  const m = MODELS[e.quality];
  const sys = 3500;
  const catalog = 9000;
  let usd = 0;
  const add = (model: string, input: number, output: number) => {
    const p = PRICES[model];
    if (p) usd += (input * p.input + output * p.output) / 1e6;
  };
  if (e.mode === "image") add(m.reader, srcTokens + 1500, o.reader);
  add(m.carto, srcTokens + sys, o.carto);
  add(m.director, catalog + sys + o.carto, o.director);
  add(m.skeptic, 4 * (2500 + o.carto / 2), o.skeptic);
  if (e.mode === "topic") usd += (6 * WEB_SEARCH_USD_PER_1K) / 1000;
  const seconds = Math.round({ fast: 70, deep: 110, master: 190 }[e.quality] + Math.min(60, srcTokens / 2500));
  return { lowUsd: Math.round(usd * 0.7 * 100) / 100, highUsd: Math.round(usd * 1.4 * 100) / 100, seconds };
}
