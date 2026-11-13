import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildCatalog, buildShortCatalog } from "./catalog";

describe("generated shape catalog", () => {
  it("matches the registry (run `pnpm catalog` after changing shapes)", () => {
    expect(readFileSync("src/server/agents/catalog.generated.md", "utf8")).toBe(buildCatalog());
    expect(readFileSync("src/server/agents/catalog.short.generated.md", "utf8")).toBe(buildShortCatalog());
  });
});
