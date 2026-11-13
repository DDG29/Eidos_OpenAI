// pnpm catalog — writes the shape catalogs injected into Claude's prompts from the registry.
import { writeFileSync } from "node:fs";
import { buildCatalog, buildShortCatalog } from "../src/server/agents/catalog";

writeFileSync("src/server/agents/catalog.generated.md", buildCatalog());
writeFileSync("src/server/agents/catalog.short.generated.md", buildShortCatalog());
console.log("[eidos] wrote src/server/agents/catalog.generated.md and catalog.short.generated.md");
