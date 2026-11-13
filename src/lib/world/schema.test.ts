import { describe, expect, it } from "vitest";
import { API_SCHEMAS, checkApiSchemaRules, WorldPlanSchema } from "./schema";
import { validSpec } from "@/test/worldFixture";

describe("API send schemas (spec 8.2)", () => {
  it.each(Object.entries(API_SCHEMAS))("%s follows structured-output rules", (_name, make) => {
    const s = make();
    expect(checkApiSchemaRules(s)).toEqual([]);
    const text = JSON.stringify(s);
    expect(text).not.toMatch(/"(reasoning|thoughts|chain_of_thought)"/);
  });
  it("counts no optional parameters and no unions", () => {
    const text = JSON.stringify(API_SCHEMAS.world());
    expect(text).not.toContain("anyOf");
    expect(text).not.toContain('"minimum"');
  });
  it("accepts a valid world", () => {
    expect(WorldPlanSchema.safeParse(validSpec()).success).toBe(true);
  });
});
