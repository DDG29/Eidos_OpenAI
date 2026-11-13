import { describe, expect, it } from "vitest";
import { costOf, estimateForge } from "./pricing";

describe("pricing", () => {
  it("computes cost with cache reads, writes and web searches", () => {
    const c = costOf("claude-opus-5-5", {
      input_tokens: 1_000_000,
      output_tokens: 100_000,
      cache_read_input_tokens: 1_000_000,
      cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 1_000_000 },
      server_tool_use: { web_search_requests: 10 },
    });
    expect(c).toBeCloseTo(4 + 2 + 0.2 + 8 + 0.1, 6);
  });
  it("returns null for unknown models", () => {
    expect(costOf("claude-unknown", { input_tokens: 10 })).toBeNull();
  });
  it("estimates a range that grows with quality and size", () => {
    const a = estimateForge({ mode: "pdf", quality: "fast", pages: 5 });
    const b = estimateForge({ mode: "pdf", quality: "master", pages: 80 });
    expect(a.lowUsd).toBeLessThan(a.highUsd);
    expect(b.highUsd).toBeGreaterThan(a.highUsd);
    expect(b.seconds).toBeGreaterThan(a.seconds);
  });
});
