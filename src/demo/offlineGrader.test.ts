import { describe, expect, it } from "vitest";
import { gradeOffline } from "./offlineGrader";

describe("offline grader", () => {
  const ideal = "El ARN guía se aparea con la secuencia complementaria del ADN y lleva a Cas9 al sitio.";
  it("accepts an answer with the key ideas, ignoring accents", () => {
    expect(gradeOffline("la guia de ARN encuentra la secuencia complementaria del ADN", ideal).verdict).toBe("correct");
  });
  it("flags unrelated answers", () => {
    expect(gradeOffline("no sé", ideal).verdict).toBe("off_topic");
    expect(gradeOffline("las proteinas cortan al azar todo", ideal).verdict).not.toBe("correct");
  });
});
