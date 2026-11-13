import { describe, expect, it } from "vitest";
import es from "@/i18n/es.json";
import en from "@/i18n/en.json";
import { interpolate, pickLocale, translate } from "./index";

describe("i18n", () => {
  it("has the same keys in every language", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(es).sort());
  });
  it("has no empty strings", () => {
    for (const dict of [es, en]) for (const [k, v] of Object.entries(dict)) expect(v, k).not.toBe("");
  });
  it("interpolates variables and keeps unknown placeholders", () => {
    expect(interpolate("{a} y {b}", { a: 1 })).toBe("1 y {b}");
    expect(translate("es", "error.EIDOS_E_PDF_TOO_BIG", { max: 32 })).toContain("32 MB");
  });
  it("picks a locale from Accept-Language", () => {
    expect(pickLocale("en-US,en;q=0.9")).toBe("en");
    expect(pickLocale("es-MX")).toBe("es");
    expect(pickLocale("fr-FR")).toBe("es");
    expect(pickLocale(null, "en")).toBe("en");
  });
});
