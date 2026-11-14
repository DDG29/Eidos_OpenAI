import type { Citation, Fact, SentenceVerdict, Sentence } from "./types";
import type { FilamentStatus, Passage } from "@/components/player/Filament";

export function filamentStatus(s: Sentence, verdict: SentenceVerdict | undefined, origin: "trunk" | "remedial" | "branch", facts: Map<string, Fact>): FilamentStatus {
  if (origin === "branch" && s.factIds.length === 0) return "hypo";
  if (verdict) {
    if (verdict.verdict === "supported" || verdict.revised) return "truth";
    if (verdict.verdict === "partial") return "partial";
    if (verdict.verdict === "general") return "general";
    return "partial";
  }
  if (s.factIds.length === 0) return "general";
  // Demo worlds with literal citations but no Skeptic pass yet: grounded, but say "unverified".
  const allGeneral = s.factIds.every((id) => facts.get(id)?.origin === "general");
  if (allGeneral) return "general";
  return "unverified";
}

export function citationLocation(c: Citation, lang: "es" | "en"): string {
  if (c.kind === "page" && c.startPage) return c.endPage && c.endPage > c.startPage ? `pp. ${c.startPage}–${c.endPage}` : `p. ${c.startPage}`;
  if (c.kind === "char" && c.paragraph) return `${lang === "es" ? "párrafo" : "paragraph"} ${c.paragraph}`;
  if (c.kind === "block" && c.startBlock !== undefined) return `${lang === "es" ? "hecho" : "fact"} ${c.startBlock + 1}`;
  if (c.kind === "web" && c.url) {
    try {
      return new URL(c.url).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  }
  return "";
}

export function passagesFor(s: Sentence, facts: Map<string, Fact>, lang: "es" | "en"): Passage[] {
  const out: Passage[] = [];
  const seen = new Set<string>();
  for (const id of s.factIds) {
    const f = facts.get(id);
    if (!f) continue;
    for (const c of f.citations.slice(0, 2)) {
      const key = `${c.documentIndex}:${c.citedText}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ text: c.citedText.trim(), location: citationLocation(c, lang), docTitle: c.title ?? c.documentTitle, url: c.url });
    }
  }
  return out.slice(0, 4);
}

export function verdictLabel(status: FilamentStatus, lang: "es" | "en"): string {
  const es: Record<FilamentStatus, string> = {
    truth: "Respaldada",
    partial: "Parcialmente respaldada",
    general: "Conocimiento general",
    hypo: "Hipotético: razonado por ChatGPT, no viene de tu fuente",
    unverified: "Citada, sin verificación del Escéptico",
  };
  const en: Record<FilamentStatus, string> = {
    truth: "Supported",
    partial: "Partially supported",
    general: "General knowledge",
    hypo: "Hypothetical: reasoned by ChatGPT, not from your source",
    unverified: "Cited, not checked by the Skeptic",
  };
  return (lang === "es" ? es : en)[status];
}
