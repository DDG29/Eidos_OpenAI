import { beforeAll, describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { validSpec } from "@/test/worldFixture";
import { loadFontsFromDisk } from "@/test/fonts";
import type { AgentRequest, AgentResult, StreamAgent } from "@/server/ai/claude";
import type { AgentRun } from "@/lib/world/types";
import { runForge } from "./runForge";

beforeAll(() => loadFontsFromDisk());

const run = (agent: AgentRun["agent"]): AgentRun => ({
  id: agent,
  agent,
  model: "claude-opus-5-5",
  effort: "high",
  startedAt: new Date().toISOString(),
  durationMs: 10,
  inputTokens: 1000,
  outputTokens: 500,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  webSearches: 0,
  webFetches: 0,
  costUsd: 0.01,
  stopReason: "end_turn",
  thinkingSummary: "",
  replay: false,
});

const LEDGER_PARTS: { text: string; cite?: string }[] = [
  { text: "### FACTS\n[[F01]] (C01) " },
  { text: "El sol emite luz.", cite: "El Sol emite luz visible" },
  { text: "\n[[F02]] (C02) " },
  { text: "Las plantas usan la luz para fabricar azúcar.", cite: "las plantas usan esa luz" },
  { text: "\n[[F03]] (C02) " },
  { text: "La glucosa guarda energía.", cite: "la glucosa almacena energía" },
  { text: "\n[[F04]] (C01) " },
  { text: "La luz llega en 8 minutos.", cite: "tarda unos ocho minutos" },
  {
    text: "\n### CONCEPTS\nC01 | Luz | Energía del sol | depends: none\nC02 | Azúcar | Comida de la planta | depends: C01\n### MISCONCEPTIONS\nM01 | Las plantas comen tierra | Fijan CO2 | facts: F02\n### SOURCE PROFILE\ntitle: La fábrica de luz\ndomain: biología\ndifficulty: curioso\npalette: solar\nvisual_motifs: hoja, sol\nnumbers: none\n",
  },
];

function fakeStream(): { stream: StreamAgent; calls: AgentRequest[] } {
  const calls: AgentRequest[] = [];
  const stream: StreamAgent = async (req, h) => {
    calls.push(req);
    const content: unknown[] = [];
    if (req.agent === "cartographer") {
      LEDGER_PARTS.forEach((p, i) => {
        h.onThinking?.("Leyendo la fuente…");
        for (let k = 0; k < p.text.length; k += 5) h.onText?.(p.text.slice(k, k + 5), i);
        const citations = p.cite ? [{ type: "char_location", cited_text: p.cite, document_index: 0, document_title: "Tus apuntes", start_char_index: 0, end_char_index: p.cite.length }] : [];
        for (const c of citations) h.onCitation?.(c as never, i);
        content.push({ type: "text", text: p.text, citations });
      });
    } else if (req.agent === "director" || req.agent === "repair") {
      const text = JSON.stringify(validSpec());
      for (let k = 0; k < text.length; k += 37) h.onText?.(text.slice(k, k + 37), 0);
      content.push({ type: "text", text });
    } else if (req.agent === "skeptic") {
      const user = String(req.messages[0]!.content);
      const ids = [...user.matchAll(/\[(b\d\d) #(\d+)\]/g)].map((m) => ({ beatId: m[1]!, index: Number(m[2]) }));
      const results = ids.map((x) => ({ ...x, verdict: "supported", supportingFactIds: ["F01"], note: "", revision: "" }));
      content.push({ type: "text", text: JSON.stringify({ results }) });
    }
    return { message: { stop_reason: "end_turn", content, model: req.model } as unknown as AgentResult["message"], content: content as AgentResult["content"], run: run(req.agent) };
  };
  return { stream, calls };
}

describe("runForge (fixture-driven, no network)", () => {
  it("runs the full pipeline and emits the SSE protocol in order", async () => {
    const events: { e: string; d: unknown }[] = [];
    const { stream, calls } = fakeStream();
    const client = { files: { upload: async () => ({ id: "file_fake" }) } } as unknown as Anthropic;
    const text = "El Sol emite luz visible. ".repeat(20);
    const res = await runForge({ mode: "text", text, level: "curioso", lang: "es", quality: "fast" }, (e, d) => events.push({ e, d }), { stream, apiKey: "x", client, signal: new AbortController().signal });
    const names = events.map((x) => x.e);
    expect(names[0]).toBe("stage");
    expect(names).toContain("session");
    expect(names.indexOf("ledger")).toBeLessThan(names.indexOf("meta"));
    expect(names.filter((n) => n === "fact")).toHaveLength(4);
    expect(names.filter((n) => n === "beat").length).toBe(validSpec().beats.length);
    expect(names.indexOf("world")).toBeLessThan(names.indexOf("done"));
    expect(names.filter((n) => n === "verify").length).toBeGreaterThan(0);
    expect(names.filter((n) => n === "usage").length).toBe(calls.length);
    expect(res.ledger.facts[0]!.citations[0]!.citedText).toBe("El Sol emite luz visible");
    expect(res.spec.beats[0]!.kind).toBe("hook");
    expect(Object.keys(res.verification).length).toBeGreaterThan(0);
    expect(res.lintReport.errors).toEqual([]);
    // structured-output agents get a schema; the cited Cartographer must not (spec 9.1 #7)
    expect(calls.find((c) => c.agent === "cartographer")!.format).toBeUndefined();
    expect(calls.find((c) => c.agent === "director")!.format).toBeDefined();
  });
});
