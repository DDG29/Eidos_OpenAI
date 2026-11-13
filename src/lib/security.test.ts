import { describe, expect, it } from "vitest";
import { buildCsp } from "@/proxy";

describe("buildCsp", () => {
  const prod = buildCsp("abc123", false);
  it("pins scripts to the request nonce and never allows eval in production", () => {
    expect(prod).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic' 'wasm-unsafe-eval'");
    expect(prod).not.toContain("'unsafe-eval'");
  });
  it("allows eval only in development", () => expect(buildCsp("n", true)).toContain("'unsafe-eval'"));
  it("covers workers, frames and connections as the spec lists", () => {
    for (const d of ["worker-src 'self' blob:", "img-src 'self' data: blob:", "connect-src 'self'", "font-src 'self'", "frame-ancestors 'none'", "object-src 'none'"]) expect(prod).toContain(d);
  });
});
