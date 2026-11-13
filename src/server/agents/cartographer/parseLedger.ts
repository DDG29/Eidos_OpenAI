import type { Citation, Concept, Fact, Level, Misconception, PaletteId, SourceProfile } from "@/lib/world/types";
import { LEVELS, PALETTE_IDS } from "@/lib/world/types";
import { paragraphAt } from "@/lib/world/paragraph";

/**
 * Fact-ledger parser (spec 9.5.4). The Cartographer's cited answer arrives as a sequence of text blocks, some
 * carrying `citations`. We concatenate the text, remember the [start, end) span of every cited block, and give
 * each fact every citation whose span overlaps the fact's text span.
 */

export type ApiCitation =
  | { type: "char_location"; cited_text: string; document_index: number; document_title: string | null; start_char_index: number; end_char_index: number }
  | { type: "page_location"; cited_text: string; document_index: number; document_title: string | null; start_page_number: number; end_page_number: number }
  | { type: "content_block_location"; cited_text: string; document_index: number; document_title: string | null; start_block_index: number; end_block_index: number }
  | { type: "web_search_result_location"; cited_text: string; title: string | null; url: string }
  | { type: string; cited_text?: string; document_index?: number; document_title?: string | null };

export interface LedgerBlock {
  text: string;
  citations: ApiCitation[];
}

export interface DocMeta {
  /** for web_fetch documents: document_index → url/title */
  urls?: Map<number, { url: string; title?: string }>;
  /** source text per document index (to compute paragraph numbers for char citations) */
  texts?: Map<number, string>;
}

export interface Ledger {
  facts: Fact[];
  concepts: Concept[];
  misconceptions: Misconception[];
  profile: SourceProfile;
  warnings: string[];
}

const HEAD = /^[ \t]*#{2,4}[ \t]*(FACTS|CONCEPTS|MISCONCEPTIONS|SOURCE PROFILE)[ \t]*$/gim;
const MARK = /\[\[\s*(F\d{1,3})\s*\]\]\s*(?:\(\s*(C\d{1,3})\s*\))?/g;

export function convertCitation(c: ApiCitation, meta: DocMeta = {}): Citation | null {
  const cited = (c.cited_text ?? "").trim();
  if (!cited) return null;
  switch (c.type) {
    case "page_location": {
      const x = c as Extract<ApiCitation, { type: "page_location" }>;
      return { kind: "page", citedText: cited, documentIndex: x.document_index, documentTitle: x.document_title ?? "", startPage: x.start_page_number, endPage: Math.max(x.start_page_number, x.end_page_number - 1) };
    }
    case "char_location": {
      const x = c as Extract<ApiCitation, { type: "char_location" }>;
      const web = meta.urls?.get(x.document_index);
      const src = meta.texts?.get(x.document_index);
      const paragraph = src ? paragraphAt(src, x.start_char_index) : undefined;
      return {
        kind: web ? "web" : "char",
        citedText: cited,
        documentIndex: x.document_index,
        documentTitle: x.document_title ?? web?.title ?? "",
        startChar: x.start_char_index,
        endChar: x.end_char_index,
        ...(paragraph ? { paragraph } : {}),
        ...(web ? { url: web.url, title: web.title ?? x.document_title ?? undefined } : {}),
      };
    }
    case "content_block_location": {
      const x = c as Extract<ApiCitation, { type: "content_block_location" }>;
      return { kind: "block", citedText: cited, documentIndex: x.document_index, documentTitle: x.document_title ?? "", startBlock: x.start_block_index, endBlock: Math.max(x.start_block_index, x.end_block_index - 1) };
    }
    case "web_search_result_location": {
      const x = c as Extract<ApiCitation, { type: "web_search_result_location" }>;
      return { kind: "web", citedText: cited, documentIndex: -1, documentTitle: x.title ?? "", url: x.url, title: x.title ?? undefined };
    }
    default:
      return null;
  }
}

interface Span {
  start: number;
  end: number;
  citations: ApiCitation[];
}

function flatten(blocks: LedgerBlock[]): { full: string; spans: Span[] } {
  let full = "";
  const spans: Span[] = [];
  for (const b of blocks) {
    const start = full.length;
    full += b.text;
    if (b.citations.length) spans.push({ start, end: full.length, citations: b.citations });
  }
  return { full, spans };
}

function sections(full: string): Record<string, { start: number; end: number }> {
  const heads: { name: string; start: number; bodyStart: number }[] = [];
  for (const m of full.matchAll(HEAD)) heads.push({ name: m[1]!.toUpperCase(), start: m.index!, bodyStart: m.index! + m[0].length });
  const out: Record<string, { start: number; end: number }> = {};
  heads.forEach((h, i) => {
    out[h.name] = { start: h.bodyStart, end: heads[i + 1]?.start ?? full.length };
  });
  return out;
}

interface RawFact {
  id: string;
  concept: string | null;
  text: string;
  start: number;
  end: number;
  complete: boolean;
}

function rawFacts(full: string, sec: { start: number; end: number } | undefined, sectionClosed: boolean): RawFact[] {
  if (!sec) return [];
  const body = full.slice(sec.start, sec.end);
  const marks = [...body.matchAll(MARK)];
  return marks.map((m, i) => {
    const s = sec.start + m.index! + m[0].length;
    const e = i + 1 < marks.length ? sec.start + marks[i + 1]!.index! : sec.end;
    const text = full
      .slice(s, e)
      .replace(/\s+/g, " ")
      .trim();
    return { id: m[1]!.replace(/^F(\d)$/, "F0$1"), concept: m[2] ? m[2] : null, text, start: s, end: e, complete: i + 1 < marks.length || sectionClosed };
  });
}

function citationsFor(spans: Span[], start: number, end: number, meta: DocMeta): Citation[] {
  const out: Citation[] = [];
  const seen = new Set<string>();
  for (const sp of spans) {
    if (sp.end <= start || sp.start >= end) continue;
    for (const c of sp.citations) {
      const cc = convertCitation(c, meta);
      if (!cc) continue;
      const key = `${cc.kind}|${cc.documentIndex}|${cc.citedText}|${cc.url ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(cc);
    }
  }
  return out.slice(0, 4);
}

function toFact(r: RawFact, spans: Span[], meta: DocMeta, sourceBacked: boolean): Fact {
  const citations = sourceBacked ? citationsFor(spans, r.start, r.end, meta) : [];
  return {
    id: r.id,
    text: r.text.slice(0, 400),
    conceptId: r.concept && r.concept !== "C00" ? r.concept.replace(/^C(\d)$/, "C0$1") : null,
    citations,
    origin: citations.length === 0 ? "general" : citations.every((c) => c.kind === "web") ? "web" : "source",
  };
}

/** Incremental view for the Forge Theater: completed facts so far (complete = the next marker has started). */
export class LedgerStream {
  private blocks: LedgerBlock[] = [];
  private emitted = new Set<string>();
  constructor(
    private meta: DocMeta = {},
    private sourceBacked = true,
  ) {}

  text(delta: string, blockIndex: number) {
    while (this.blocks.length <= blockIndex) this.blocks.push({ text: "", citations: [] });
    this.blocks[blockIndex]!.text += delta;
  }

  citation(c: ApiCitation, blockIndex: number) {
    while (this.blocks.length <= blockIndex) this.blocks.push({ text: "", citations: [] });
    this.blocks[blockIndex]!.citations.push(c);
  }

  /** Facts that became complete since the last call. */
  drain(): Fact[] {
    const { full, spans } = flatten(this.blocks);
    const sec = sections(full);
    const closed = !!(sec.CONCEPTS || sec.MISCONCEPTIONS || sec["SOURCE PROFILE"]);
    const out: Fact[] = [];
    for (const r of rawFacts(full, sec.FACTS, closed)) {
      if (!r.complete || this.emitted.has(r.id) || !r.text) continue;
      this.emitted.add(r.id);
      out.push(toFact(r, spans, this.meta, this.sourceBacked));
    }
    return out;
  }
}

function splitPipes(line: string): string[] {
  return line.split("|").map((x) => x.trim());
}

export function parseLedger(blocks: LedgerBlock[], meta: DocMeta = {}, sourceBacked = true): Ledger {
  const warnings: string[] = [];
  const { full, spans } = flatten(blocks);
  const sec = sections(full);
  if (!sec.FACTS) warnings.push("no FACTS section");
  const seenFacts = new Set<string>();
  const facts: Fact[] = [];
  for (const r of rawFacts(full, sec.FACTS, true)) {
    if (!r.text) continue;
    if (seenFacts.has(r.id)) {
      warnings.push(`duplicate fact ${r.id} dropped`);
      continue;
    }
    seenFacts.add(r.id);
    facts.push(toFact(r, spans, meta, sourceBacked));
  }

  const concepts: Concept[] = [];
  if (sec.CONCEPTS)
    for (const line of full.slice(sec.CONCEPTS.start, sec.CONCEPTS.end).split("\n")) {
      if (!line.trim()) continue;
      const p = splitPipes(line);
      const id = /^C\d{1,3}$/.exec(p[0] ?? "")?.[0];
      if (!id || p.length < 3) {
        warnings.push(`malformed concept line: ${line.slice(0, 60)}`);
        continue;
      }
      const deps = (p[3] ?? "").replace(/^depends:\s*/i, "");
      concepts.push({
        id: id.replace(/^C(\d)$/, "C0$1"),
        name: p[1]!.slice(0, 60),
        summary: p[2]!.slice(0, 260),
        dependsOn: /none|ninguno/i.test(deps) ? [] : (deps.match(/C\d{1,3}/g) ?? []).map((d) => d.replace(/^C(\d)$/, "C0$1")),
      });
    }

  const misconceptions: Misconception[] = [];
  if (sec.MISCONCEPTIONS)
    for (const line of full.slice(sec.MISCONCEPTIONS.start, sec.MISCONCEPTIONS.end).split("\n")) {
      if (!line.trim()) continue;
      const p = splitPipes(line);
      const id = /^M\d{1,3}$/.exec(p[0] ?? "")?.[0];
      if (!id || p.length < 3) {
        warnings.push(`malformed misconception line: ${line.slice(0, 60)}`);
        continue;
      }
      misconceptions.push({
        id: id.replace(/^M(\d)$/, "M0$1"),
        wrongIdea: p[1]!.slice(0, 300),
        correction: p[2]!.slice(0, 400),
        factIds: ((p[3] ?? "").match(/F\d{1,3}/g) ?? []).map((f) => f.replace(/^F(\d)$/, "F0$1")),
      });
    }

  const kv: Record<string, string> = {};
  if (sec["SOURCE PROFILE"])
    for (const line of full.slice(sec["SOURCE PROFILE"].start, sec["SOURCE PROFILE"].end).split("\n")) {
      const m = /^\s*([a-z_]+)\s*:\s*(.+)$/i.exec(line);
      if (m) kv[m[1]!.toLowerCase()] = m[2]!.trim();
    }
  const difficulty = (LEVELS as readonly string[]).includes((kv.difficulty ?? "").toLowerCase()) ? (kv.difficulty!.toLowerCase() as Level) : "prepa";
  const palette = (PALETTE_IDS as readonly string[]).includes((kv.palette ?? "").toLowerCase()) ? (kv.palette!.toLowerCase() as PaletteId) : "aurora";
  const profile: SourceProfile = {
    title: (kv.title ?? "").slice(0, 60),
    domain: (kv.domain ?? "").slice(0, 40),
    difficulty,
    palette,
    visualMotifs: (kv.visual_motifs ?? "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 8),
    numbers: /^none$/i.test(kv.numbers ?? "none")
      ? []
      : (kv.numbers ?? "")
          .split(";")
          .map((x) => x.trim())
          .filter(Boolean)
          .slice(0, 8),
  };

  // Referential integrity (spec 9.5.4 step 8)
  const conceptIds = new Set(concepts.map((c) => c.id));
  for (const f of facts)
    if (f.conceptId && !conceptIds.has(f.conceptId)) {
      warnings.push(`fact ${f.id} points to unknown concept ${f.conceptId}`);
      f.conceptId = null;
    }
  for (const c of concepts) c.dependsOn = c.dependsOn.filter((d) => conceptIds.has(d) && d !== c.id);
  const factIds = new Set(facts.map((f) => f.id));
  for (const m of misconceptions) m.factIds = m.factIds.filter((id) => factIds.has(id));
  const uncited = facts.filter((f) => f.origin === "general").length;
  if (sourceBacked && uncited) warnings.push(`${uncited} fact(s) without citations are shown as general knowledge`);
  return { facts, concepts, misconceptions, profile, warnings };
}

/** Ledger rendered for the Director's user message (spec 9.6.2). */
export function renderLedgerForDirector(l: Ledger): string {
  const facts = l.facts.map((f) => `${f.id} [${f.conceptId ?? "C00"}] ${f.text}`).join("\n");
  const concepts = l.concepts.map((c) => `${c.id} | ${c.name} | ${c.summary} | depends: ${c.dependsOn.length ? c.dependsOn.join(", ") : "none"}`).join("\n");
  const mis = l.misconceptions.map((m) => `${m.id} | ${m.wrongIdea} | ${m.correction} | facts: ${m.factIds.join(", ")}`).join("\n");
  const p = l.profile;
  return `<fact_ledger>\n${facts}\n</fact_ledger>\n<concepts>\n${concepts}\n</concepts>\n<misconceptions>\n${mis}\n</misconceptions>\n<source_profile>\ntitle: ${p.title} / domain: ${p.domain} / palette: ${p.palette} / visual_motifs: ${p.visualMotifs.join(", ")} / numbers: ${p.numbers.join("; ") || "none"}\n</source_profile>`;
}
