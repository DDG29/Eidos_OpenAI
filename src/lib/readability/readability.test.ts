import { describe, expect, it } from "vitest";
import { fleschEn, inflesz, syllablesEn, syllablesEs } from "./index";

describe("Spanish syllables", () => {
  it.each([
    ["casa", 2],
    ["murciélago", 4],
    ["ciudad", 2],
    ["poeta", 3],
    ["país", 2],
    ["río", 2],
    ["guitarra", 3],
    ["queso", 2],
    ["aire", 2],
    ["fotosíntesis", 5],
    ["oxígeno", 4],
    ["tiene", 2],
    ["cuidado", 3],
    ["hoy", 1],
  ])("%s → %i", (w, n) => expect(syllablesEs(w)).toBe(n));
});

describe("English syllables", () => {
  it.each([
    ["cat", 1],
    ["water", 2],
    ["energy", 3],
    ["photosynthesis", 5],
  ])("%s → %i", (w, n) => expect(syllablesEn(w)).toBe(n));
});

describe("readability scores", () => {
  it("rates simple Spanish higher than dense Spanish", () => {
    const easy = "El sol da luz. La planta usa la luz. Así hace su comida.";
    const hard =
      "La fotofosforilación acíclica constituye un mecanismo bioenergético fundamental mediante el cual los organismos fotosintéticos sintetizan adenosín trifosfato utilizando gradientes electroquímicos transmembranales.";
    expect(inflesz(easy)).toBeGreaterThan(80);
    expect(inflesz(hard)).toBeLessThan(40);
  });
  it("rates simple English higher than dense English", () => {
    expect(fleschEn("The cat sat on the mat. It was warm.")).toBeGreaterThan(90);
    expect(fleschEn("Electrochemical transmembrane gradients facilitate adenosine triphosphate biosynthesis in photosynthetic organisms.")).toBeLessThan(10);
  });
});
