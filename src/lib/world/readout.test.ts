import { describe, expect, it } from "vitest";
import { decimalsOfStep, renderReadout, validateReadout } from "./readout";

describe("knob readouts", () => {
  it("renders value and computed expressions", () => {
    expect(renderReadout("Con {value} % anual, tu dinero se duplica en unos {=72/value|1} años.", 12, 1, "es-MX")).toBe(
      "Con 12 % anual, tu dinero se duplica en unos 6.0 años.",
    );
    expect(renderReadout("T = {value}", 0.5, 0.1, "en")).toBe("T = 0.5");
  });
  it("replaces invalid expressions with an em dash", () => {
    expect(renderReadout("x {=foo(value)|1}", 2, 1)).toBe("x —");
    expect(validateReadout("x {=foo(value)|1}").ok).toBe(false);
    expect(validateReadout("{value} and {=value*2|0}").ok).toBe(true);
  });
  it("derives decimals from the step", () => {
    expect(decimalsOfStep(1)).toBe(0);
    expect(decimalsOfStep(0.1)).toBe(1);
    expect(decimalsOfStep(0.05)).toBe(2);
  });
});
