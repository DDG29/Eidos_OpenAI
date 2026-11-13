import { describe, expect, it } from "vitest";
import { LedgerStream, parseLedger, renderLedgerForDirector, type ApiCitation, type LedgerBlock } from "./parseLedger";

/** Fixtures shaped exactly like the API: text blocks split around cited spans. */
const charCite = (t: string, s: number, e: number): ApiCitation => ({ type: "char_location", cited_text: t, document_index: 0, document_title: "Tus apuntes", start_char_index: s, end_char_index: e });
const pageCite = (t: string, p: number): ApiCitation => ({ type: "page_location", cited_text: t, document_index: 0, document_title: "Paper.pdf", start_page_number: p, end_page_number: p + 1 });
const webCite = (t: string, url: string): ApiCitation => ({ type: "web_search_result_location", cited_text: t, title: "Enciclopedia", url });

function ledgerBlocks(cite: (i: number) => ApiCitation): LedgerBlock[] {
  return [
    { text: "### FACTS\n[[F01]] (C01) ", citations: [] },
    { text: "La proteína Cas9 corta las dos hebras del ADN.", citations: [cite(1)] },
    { text: "\n[[F02]] (C02) ", citations: [] },
    { text: "El ARN guía se aparea con una secuencia complementaria", citations: [cite(2)] },
    { text: " y dirige a Cas9 al sitio.", citations: [cite(3)] },
    { text: "\n[[F03]] (C00) La edición genómica es un debate abierto.\n", citations: [] },
    {
      text: "### CONCEPTS\nC01 | Cas9 | Proteína que corta ADN | depends: none\nC02 | ARN guía | Molécula que indica dónde cortar | depends: C01\nbasura sin pipes\n### MISCONCEPTIONS\nM01 | Cas9 sabe sola dónde cortar | El ARN guía decide el sitio | facts: F02, F09\n### SOURCE PROFILE\ntitle: Las tijeras de la vida\ndomain: biología\ndifficulty: prepa\npalette: bioluz\nvisual_motifs: doble hélice, tijeras, guía\nnumbers: none\n\ntexto basura al final",
      citations: [],
    },
  ];
}

describe("parseLedger", () => {
  it("text/pdf mode: assigns overlapping citations to each fact", () => {
    const l = parseLedger(ledgerBlocks((i) => charCite(`pasaje ${i}`, i * 10, i * 10 + 9)));
    expect(l.facts.map((f) => f.id)).toEqual(["F01", "F02", "F03"]);
    expect(l.facts[0]!.citations.map((c) => c.citedText)).toEqual(["pasaje 1"]);
    expect(l.facts[1]!.citations.map((c) => c.citedText)).toEqual(["pasaje 2", "pasaje 3"]);
    expect(l.facts[2]!.origin).toBe("general");
    expect(l.facts[2]!.conceptId).toBeNull();
    expect(l.concepts).toHaveLength(2);
    expect(l.concepts[1]!.dependsOn).toEqual(["C01"]);
    expect(l.misconceptions[0]!.factIds).toEqual(["F02"]);
    expect(l.profile).toMatchObject({ title: "Las tijeras de la vida", palette: "bioluz", difficulty: "prepa", numbers: [] });
    expect(l.warnings.join(" ")).toMatch(/malformed concept/);
  });

  it("pdf mode maps page locations (end page exclusive → inclusive)", () => {
    const l = parseLedger(ledgerBlocks((i) => pageCite(`p${i}`, i + 3)));
    expect(l.facts[0]!.citations[0]).toMatchObject({ kind: "page", startPage: 4, endPage: 4 });
  });

  it("topic mode maps web search citations", () => {
    const l = parseLedger(ledgerBlocks((i) => webCite(`w${i}`, `https://ejemplo.org/${i}`)));
    expect(l.facts[0]!.origin).toBe("web");
    expect(l.facts[0]!.citations[0]!.url).toBe("https://ejemplo.org/1");
  });

  it("url mode: web_fetch char citations keep the fetched url", () => {
    const urls = new Map([[0, { url: "https://site.org/a", title: "Artículo" }]]);
    const l = parseLedger(ledgerBlocks((i) => charCite(`f${i}`, i, i + 4)), { urls });
    expect(l.facts[0]!.citations[0]).toMatchObject({ kind: "web", url: "https://site.org/a" });
  });

  it("image mode computes paragraph numbers from the reading text", () => {
    const texts = new Map([[0, "## TRANSCRIPTION\n\nuno\n\ndos\n\ntres"]]); // "tres" is the 3rd paragraph (heading excluded)
    const l = parseLedger(ledgerBlocks(() => charCite("tres", 30, 34)), { texts });
    expect(l.facts[0]!.citations[0]!.paragraph).toBe(3);
  });

  it("general mode (no tools): every fact is general knowledge", () => {
    const l = parseLedger(ledgerBlocks(() => charCite("x", 0, 1)), {}, false);
    expect(l.facts.every((f) => f.origin === "general" && f.citations.length === 0)).toBe(true);
  });

  it("tolerates heading variations and duplicated ids", () => {
    const l = parseLedger([{ text: "## facts  \n[[F1]] (C1) Hecho uno.\n[[F1]] Hecho repetido.\n#### Concepts\nC1 | Uno | def | depends: none\n", citations: [] }]);
    expect(l.facts.map((f) => f.id)).toEqual(["F01"]);
    expect(l.concepts[0]!.id).toBe("C01");
  });

  it("streams completed facts only once, as soon as the next marker starts", () => {
    const s = new LedgerStream();
    const blocks = ledgerBlocks((i) => charCite(`c${i}`, i, i + 1));
    const seen: string[] = [];
    blocks.forEach((b, bi) => {
      for (let k = 0; k < b.text.length; k += 7) {
        s.text(b.text.slice(k, k + 7), bi);
        seen.push(...s.drain().map((f) => f.id));
      }
      for (const c of b.citations) s.citation(c, bi);
    });
    seen.push(...s.drain().map((f) => f.id));
    expect(seen).toEqual(["F01", "F02", "F03"]);
  });

  it("renders the ledger for the Director", () => {
    const txt = renderLedgerForDirector(parseLedger(ledgerBlocks((i) => charCite(`p${i}`, i, i + 2))));
    expect(txt).toContain("<fact_ledger>\nF01 [C01] La proteína Cas9");
    expect(txt).toContain("depends: C01");
  });
});
