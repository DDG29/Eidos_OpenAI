import type { AgentName } from "@/lib/world/types";
import type { Quality } from "@/lib/pricing";

/** Model routing and quality modes (spec 9.2). Every agent can be overridden with EIDOS_MODEL_<AGENT>. */
export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export const OPUS = "claude-opus-5-5";
export const SONNET = "claude-sonnet-5-5";
export const HAIKU = "claude-haiku-5-5";

type Route = { model: string; effort: Effort };
type RoutedAgent = Exclude<AgentName, "compiler" | "repair">;

const TABLE: Record<RoutedAgent, Record<Quality, Route>> = {
  reader: { fast: { model: SONNET, effort: "low" }, deep: { model: SONNET, effort: "medium" }, master: { model: OPUS, effort: "high" } },
  cartographer: { fast: { model: OPUS, effort: "medium" }, deep: { model: OPUS, effort: "high" }, master: { model: OPUS, effort: "xhigh" } },
  director: { fast: { model: OPUS, effort: "medium" }, deep: { model: OPUS, effort: "high" }, master: { model: OPUS, effort: "xhigh" } },
  skeptic: { fast: { model: HAIKU, effort: "medium" }, deep: { model: SONNET, effort: "medium" }, master: { model: OPUS, effort: "high" } },
  tutor: { fast: { model: HAIKU, effort: "low" }, deep: { model: SONNET, effort: "low" }, master: { model: SONNET, effort: "medium" } },
  evaluator: { fast: { model: HAIKU, effort: "low" }, deep: { model: HAIKU, effort: "medium" }, master: { model: SONNET, effort: "medium" } },
  gardener: { fast: { model: OPUS, effort: "low" }, deep: { model: OPUS, effort: "medium" }, master: { model: OPUS, effort: "high" } },
  brancher: { fast: { model: OPUS, effort: "low" }, deep: { model: OPUS, effort: "medium" }, master: { model: OPUS, effort: "high" } },
  lens: { fast: { model: HAIKU, effort: "low" }, deep: { model: HAIKU, effort: "low" }, master: { model: SONNET, effort: "low" } },
};

const MAX_TOKENS: Record<RoutedAgent, number> = {
  reader: 8000,
  cartographer: 32000,
  director: 64000,
  skeptic: 16000,
  tutor: 4000,
  evaluator: 2000,
  gardener: 24000,
  brancher: 24000,
  lens: 12000,
};

export function routeFor(agent: AgentName, quality: Quality): Route & { maxTokens: number } {
  const a: RoutedAgent = agent === "repair" ? "director" : agent === "compiler" ? "director" : agent;
  const base = TABLE[a][quality];
  const override = process.env[`EIDOS_MODEL_${a.toUpperCase()}`]?.trim();
  let maxTokens = MAX_TOKENS[a];
  // Thinking counts against max_tokens: give xhigh/max room (spec 9.1 #3).
  if (base.effort === "xhigh" || base.effort === "max") maxTokens = a === "director" ? 128000 : a === "cartographer" ? 64000 : maxTokens * 2;
  return { model: override || base.model, effort: base.effort, maxTokens };
}

/** Models that accept the server-side refusal fallback beta (DECISIONS.md #7). */
export function supportsFallbacks(model: string): boolean {
  return process.env.EIDOS_DISABLE_FALLBACKS !== "1" && (model === OPUS || model === SONNET);
}
