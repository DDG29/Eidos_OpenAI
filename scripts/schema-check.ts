// pnpm schema:check — structured-output rules (always) + compile each schema against the API (with a key).
import Anthropic from "@anthropic-ai/sdk";
import { API_SCHEMAS, checkApiSchemaRules } from "../src/lib/world/schema";
import { HAIKU } from "../src/server/ai/models";

let failed = false;
for (const [name, make] of Object.entries(API_SCHEMAS)) {
  const schema = make();
  const problems = checkApiSchemaRules(schema);
  const size = JSON.stringify(schema).length;
  console.log(`${problems.length ? "✗" : "✓"} ${name.padEnd(12)} rules  (${(size / 1024).toFixed(1)} KB)`);
  for (const p of problems) console.log(`    ${p}`);
  if (problems.length) failed = true;
}
const key = process.env.ANTHROPIC_API_KEY?.trim();
if (!key) {
  console.log("\nNo ANTHROPIC_API_KEY: skipped compiling the schemas against the API (rules checked locally).");
} else {
  const client = new Anthropic({ apiKey: key });
  for (const [name, make] of Object.entries(API_SCHEMAS)) {
    if (name === "projectScene") continue; // used as a tool input schema, not an output format
    try {
      await client.messages.create({
        model: HAIKU,
        max_tokens: 16,
        output_config: { effort: "low", format: { type: "json_schema", schema: make() } },
        messages: [{ role: "user", content: "Return the smallest valid object." }],
      });
      console.log(`✓ ${name.padEnd(12)} compiles in the API`);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      // A max_tokens truncation is fine here: we only care that the grammar compiled.
      if (/max_tokens/i.test(m)) console.log(`✓ ${name.padEnd(12)} compiles in the API`);
      else {
        console.log(`✗ ${name.padEnd(12)} ${m.slice(0, 200)}`);
        failed = true;
      }
    }
  }
}
process.exit(failed ? 1 : 0);
