import { describe, expect, it } from "vitest";
import { pickVoice } from "../Narrator";

const v = (name: string, lang: string, localService = true) => ({ name, lang, localService, default: false, voiceURI: name }) as SpeechSynthesisVoice;
const voices = [v("Samantha", "en-US"), v("Mónica", "es-ES"), v("Paulina", "es-MX"), v("Google español", "es-ES", false)];

describe("pickVoice", () => {
  it("honours the voice chosen in Settings", () => expect(pickVoice(voices, "es-MX", "Samantha")?.name).toBe("Samantha"));
  it("prefers es-MX for Spanish worlds", () => expect(pickVoice(voices, "es-MX", "")?.name).toBe("Paulina"));
  it("falls back to a local voice of the language", () => expect(pickVoice(voices.filter((x) => x.lang !== "es-MX"), "es", "")?.name).toBe("Mónica"));
  it("returns null when the language has no voice", () => expect(pickVoice(voices, "fr-FR", "")).toBeNull());
});
