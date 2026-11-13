import { afterEach, describe, expect, it } from "vitest";
import { _resetLimits, addSpend, budgetExhausted, guard, takeToken } from "./limits";

afterEach(() => _resetLimits());

describe("limits", () => {
  it("token bucket allows the hourly quota then refills", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 6; i++) expect(takeToken("forge", "1.1.1.1", t0)).toBe(true);
    expect(takeToken("forge", "1.1.1.1", t0)).toBe(false);
    expect(takeToken("forge", "2.2.2.2", t0)).toBe(true);
    expect(takeToken("forge", "1.1.1.1", t0 + 11 * 60_000)).toBe(true);
  });
  it("daily budget blocks non-BYOK requests once exhausted", () => {
    addSpend(30, false);
    expect(budgetExhausted()).toBe(true);
    expect(() => guard("ask", "3.3.3.3", false)).toThrow(/budget/);
    expect(() => guard("ask", "3.3.3.3", true)).not.toThrow();
  });
  it("BYOK spend does not count", () => {
    addSpend(100, true);
    expect(budgetExhausted()).toBe(false);
  });
});
