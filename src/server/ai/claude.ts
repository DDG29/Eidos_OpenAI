import Anthropic from "@anthropic-ai/sdk";
import { nanoid } from "nanoid";
import { EidosError } from "@/lib/errors";
import { costOf, type UsageLike } from "@/lib/pricing";
import type { AgentName, AgentRun } from "@/lib/world/types";
import { supportsFallbacks, type Effort } from "./models";

/**
 * Thin wrapper over @anthropic-ai/sdk (spec 9.3): one streaming call per agent, translated into internal
 * events; pause_turn continuation; cost accounting; errors normalized to EidosError. All calls go through the
 * beta Messages endpoint so Opus 5.5 / Sonnet 5.5 can carry server-side refusal fallbacks (DECISIONS #7).
 */

type CreateParams = Anthropic.Beta.Messages.MessageCreateParamsNonStreaming;
export type AgentMessage = Anthropic.Beta.Messages.BetaMessage;
export type AgentContentBlock = Anthropic.Beta.Messages.BetaContentBlock;
export type AgentTextCitation = Anthropic.Beta.Messages.BetaTextCitation;

export interface AgentRequest {
  agent: AgentName;
  model: string;
  effort: Effort;
  maxTokens: number;
  system: CreateParams["system"];
  messages: CreateParams["messages"];
  tools?: CreateParams["tools"];
  /** JSON schema for structured outputs (incompatible with citations — spec 9.1 #7) */
  format?: Record<string, unknown>;
  /** show summarized thinking (Forge Theater) */
  showThinking?: boolean;
  timeoutMs?: number;
}

export interface AgentHandlers {
  onThinking?: (delta: string) => void;
  onText?: (delta: string, blockIndex: number) => void;
  onCitation?: (citation: AgentTextCitation, blockIndex: number) => void;
  onBlockStart?: (block: AgentContentBlock, blockIndex: number) => void;
}

export interface AgentResult {
  message: AgentMessage;
  /** all content blocks across pause_turn continuations, in order */
  content: AgentContentBlock[];
  run: AgentRun;
}

export type StreamAgent = (req: AgentRequest, handlers: AgentHandlers, opts: { apiKey: string; signal?: AbortSignal }) => Promise<AgentResult>;

export function makeClient(apiKey: string, timeoutMs = 280_000): Anthropic {
  return new Anthropic({ apiKey, maxRetries: 3, timeout: timeoutMs });
}

function mapError(e: unknown): EidosError {
  if (e instanceof EidosError) return e;
  if (e instanceof Anthropic.APIUserAbortError) return new EidosError("EIDOS_E_TIMEOUT", "aborted");
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return new EidosError("EIDOS_E_NO_KEY", "authentication failed", false);
  if (e instanceof Anthropic.RateLimitError) return new EidosError("EIDOS_E_OVERLOADED", "rate limited");
  if (e instanceof Anthropic.BadRequestError) {
    const m = e.message ?? "";
    if (/schema is too complex/i.test(m)) return new EidosError("EIDOS_E_SCHEMA", m);
    if (/web[_ ](search|fetch)/i.test(m) && /(not (enabled|allowed|available)|disabled)/i.test(m)) return new EidosError("EIDOS_E_WEB_DISABLED", m);
    return new EidosError("EIDOS_E_UNKNOWN", m);
  }
  if (e instanceof Anthropic.APIError) {
    if (e.status === 529 || (e.status ?? 0) >= 500) return new EidosError("EIDOS_E_OVERLOADED", e.message);
    return new EidosError("EIDOS_E_UNKNOWN", e.message);
  }
  if (e instanceof Anthropic.APIConnectionTimeoutError || e instanceof Anthropic.APIConnectionError) return new EidosError("EIDOS_E_OVERLOADED", "connection error");
  return new EidosError("EIDOS_E_UNKNOWN", e instanceof Error ? e.message : "unknown");
}

export const streamAgent: StreamAgent = async (req, handlers, { apiKey, signal }) => {
  const client = makeClient(apiKey, req.timeoutMs);
  const started = Date.now();
  const content: AgentContentBlock[] = [];
  let thinking = "";
  const usage = { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, web_search_requests: 0, web_fetch_requests: 0 };
  let messages = [...req.messages];
  let final: AgentMessage | null = null;
  const fallbacks = supportsFallbacks(req.model);
  try {
    // pause_turn: resend with the assistant turn appended unchanged, at most 4 continuations (spec 9.3).
    for (let turn = 0; turn < 5; turn++) {
      const params = {
        model: req.model,
        max_tokens: req.maxTokens,
        system: req.system,
        messages,
        ...(req.tools ? { tools: req.tools } : {}),
        thinking: { type: "adaptive" as const, display: req.showThinking === false ? ("omitted" as const) : ("summarized" as const) },
        output_config: { effort: req.effort, ...(req.format ? { format: { type: "json_schema" as const, schema: req.format } } : {}) },
        ...(fallbacks ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
      } as unknown as CreateParams;
      const offset = content.length;
      const stream = client.beta.messages.stream(params, { signal });
      for await (const ev of stream) {
        if (ev.type === "content_block_start") handlers.onBlockStart?.(ev.content_block as AgentContentBlock, offset + ev.index);
        else if (ev.type === "content_block_delta") {
          const d = ev.delta as { type: string; thinking?: string; text?: string; citation?: AgentTextCitation };
          if (d.type === "thinking_delta" && d.thinking) {
            thinking += d.thinking;
            handlers.onThinking?.(d.thinking);
          } else if (d.type === "text_delta" && d.text) handlers.onText?.(d.text, offset + ev.index);
          else if (d.type === "citations_delta" && d.citation) handlers.onCitation?.(d.citation, offset + ev.index);
        }
      }
      const msg = await stream.finalMessage();
      final = msg;
      content.push(...msg.content);
      const u = msg.usage as unknown as UsageLike & { server_tool_use?: { web_search_requests?: number; web_fetch_requests?: number } };
      usage.input_tokens += u.input_tokens ?? 0;
      usage.output_tokens += u.output_tokens ?? 0;
      usage.cache_creation_input_tokens += u.cache_creation_input_tokens ?? 0;
      usage.cache_read_input_tokens += u.cache_read_input_tokens ?? 0;
      usage.web_search_requests += u.server_tool_use?.web_search_requests ?? 0;
      usage.web_fetch_requests += u.server_tool_use?.web_fetch_requests ?? 0;
      if (msg.stop_reason !== "pause_turn") break;
      messages = [...messages, { role: "assistant", content: msg.content as unknown as Anthropic.Beta.Messages.BetaMessageParam["content"] } as Anthropic.Beta.Messages.BetaMessageParam];
    }
  } catch (e) {
    throw mapError(e);
  }
  if (!final) throw new EidosError("EIDOS_E_UNKNOWN", "no response");
  const servedBy = final.model || req.model;
  const run: AgentRun = {
    id: nanoid(8),
    agent: req.agent,
    model: servedBy,
    effort: req.effort,
    startedAt: new Date(started).toISOString(),
    durationMs: Date.now() - started,
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cacheReadTokens: usage.cache_read_input_tokens,
    cacheWriteTokens: usage.cache_creation_input_tokens,
    webSearches: usage.web_search_requests,
    webFetches: usage.web_fetch_requests,
    costUsd: costOf(servedBy, { ...usage, server_tool_use: { web_search_requests: usage.web_search_requests } }),
    stopReason: final.stop_reason ?? "unknown",
    thinkingSummary: thinking.slice(0, 4000),
    replay: false,
  };
  if (final.stop_reason === "refusal") {
    const details = (final as unknown as { stop_details?: { category?: string | null } }).stop_details;
    throw Object.assign(new EidosError("EIDOS_E_REFUSAL", details?.category ?? "refusal", false), { run });
  }
  return { message: final, content, run };
};

/** Concatenated text of all text blocks (structured output JSON arrives here). */
export function textOf(content: AgentContentBlock[]): string {
  return content
    .filter((b): b is Extract<AgentContentBlock, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("");
}
