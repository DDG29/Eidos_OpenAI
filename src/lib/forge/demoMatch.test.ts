import { describe, expect, it } from "vitest";
import { bestDemoMatch } from "./demoMatch";

const demos = [
  { id: "agujeros-negros", title: "Donde el espacio se curva", subtitle: "Qué es un agujero negro y por qué ni la luz escapa." },
  { id: "transformer", title: "Cómo piensa un Transformer", subtitle: "Tokens, atención y probabilidad." },
  { id: "ajolote", title: "El ajolote, maestro de la regeneración", subtitle: "Cómo vuelve a crecer una pata." },
];

describe("bestDemoMatch", () => {
  it("ignores accents, case and Spanish question marks", () => {
    expect(bestDemoMatch("¿Cómo piensa un Transformer?", demos)).toBe("transformer");
    expect(bestDemoMatch("como PIENSA un transformer", demos)).toBe("transformer");
  });
  it("matches on the subtitle too", () => {
    expect(bestDemoMatch("¿Qué es un agujero negro?", demos)).toBe("agujeros-negros");
    expect(bestDemoMatch("¿Cómo se regenera un ajolote?", demos)).toBe("ajolote");
  });
  it("returns null when nothing is shared", () => {
    expect(bestDemoMatch("photosynthesis", demos)).toBeNull();
    expect(bestDemoMatch("", demos)).toBeNull();
  });
});
