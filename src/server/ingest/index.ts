import Anthropic, { toFile } from "@anthropic-ai/sdk";
import { EidosError } from "@/lib/errors";
import type { Lang, Level } from "@/lib/world/types";
import type { Quality, SourceMode } from "@/lib/pricing";

/** Ingest by mode (spec 9.4). Produces the Cartographer's document blocks, tools and session file ids. */

type ContentParam = Anthropic.Beta.Messages.BetaContentBlockParam;
type ToolParam = NonNullable<Anthropic.Beta.Messages.MessageCreateParamsNonStreaming["tools"]>[number];

export interface IngestRequest {
  mode: SourceMode;
  file?: { name: string; type: string; bytes: Uint8Array };
  url?: string;
  topic?: string;
  text?: string;
  level: Level;
  lang: Lang;
  quality: Quality;
  focus?: string;
}

export interface Ingested {
  mode: SourceMode | "general";
  /** blocks placed before the instruction in the Cartographer's user message */
  blocks: ContentParam[];
  /** extra sentence for the user message (URL or question) */
  userText: string;
  tools: ToolParam[];
  fileIds: string[];
  docTitles: string[];
  /** document_index → plain text (paragraph numbers for char citations) */
  texts: Map<number, string>;
  sourceTitle: string;
  pages?: number;
  /** base64 JPEG for the Reader (photo mode) */
  image?: { data: string; mediaType: "image/jpeg" };
}

export const PDF_LIMITS = () => ({ mb: Number(process.env.MAX_PDF_MB || 32), pages: Number(process.env.MAX_PDF_PAGES || 100) });

export function cleanTitle(name: string): string {
  return (
    name
      .replace(/\.[a-z0-9]{2,5}$/i, "")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80) || "Documento"
  );
}

const CACHE_1H = { type: "ephemeral" as const, ttl: "1h" as const };

export function isPdf(bytes: Uint8Array): boolean {
  return bytes.length > 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d; // %PDF-
}

export function imageKind(bytes: Uint8Array): "jpeg" | "png" | "webp" | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "webp";
  return null;
}

export async function validatePdf(bytes: Uint8Array): Promise<number> {
  const lim = PDF_LIMITS();
  if (!isPdf(bytes)) throw new EidosError("EIDOS_E_PDF_UNREADABLE", "not a PDF", false);
  if (bytes.byteLength > lim.mb * 1024 * 1024) throw new EidosError("EIDOS_E_PDF_TOO_BIG", "too big", false, { max: lim.mb });
  let pages = 0;
  try {
    const { PDFDocument } = await import("pdf-lib");
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: false, updateMetadata: false });
    pages = doc.getPageCount();
  } catch {
    throw new EidosError("EIDOS_E_PDF_UNREADABLE", "pdf-lib could not open it", false);
  }
  if (pages > lim.pages) throw new EidosError("EIDOS_E_PDF_TOO_LONG", "too many pages", false, { pages, max: lim.pages });
  return pages;
}

async function upload(client: Anthropic, name: string, type: string, data: Uint8Array | string): Promise<string | null> {
  try {
    const f = await client.files.upload({ file: await toFile(typeof data === "string" ? Buffer.from(data, "utf8") : Buffer.from(data), name, { type }), expires_in_seconds: 86_400 });
    return f.id;
  } catch {
    return null; // fall back to inline content; the Tutor then cites the fact ledger instead of the file
  }
}

function textDocument(fileId: string | null, text: string, title: string): ContentParam {
  return (
    fileId
      ? { type: "document", source: { type: "file", file_id: fileId }, title, citations: { enabled: true }, cache_control: CACHE_1H }
      : { type: "document", source: { type: "text", media_type: "text/plain", data: text }, title, citations: { enabled: true }, cache_control: CACHE_1H }
  ) as ContentParam;
}

export function webTools(mode: "url" | "topic"): ToolParam[] {
  const fetchType = process.env.EIDOS_WEB_FETCH_VERSION || "web_fetch_20260209";
  const searchType = process.env.EIDOS_WEB_SEARCH_VERSION || "web_search_20260209";
  const fetchTool = { type: fetchType, name: "web_fetch", max_uses: 3, citations: { enabled: true }, max_content_tokens: 120_000 } as unknown as ToolParam;
  if (mode === "url") return [fetchTool];
  return [{ type: searchType, name: "web_search", max_uses: 6 } as unknown as ToolParam, fetchTool];
}

export async function ingest(client: Anthropic, req: IngestRequest, opts: { readImage?: (img: { data: string; mediaType: "image/jpeg" }) => Promise<string> } = {}): Promise<Ingested> {
  const texts = new Map<number, string>();
  switch (req.mode) {
    case "pdf": {
      if (!req.file) throw new EidosError("EIDOS_E_INPUT", "missing file");
      const pages = await validatePdf(req.file.bytes);
      const title = cleanTitle(req.file.name);
      const id = await upload(client, req.file.name, "application/pdf", req.file.bytes);
      const block = (
        id
          ? { type: "document", source: { type: "file", file_id: id }, title, citations: { enabled: true }, cache_control: CACHE_1H }
          : { type: "document", source: { type: "base64", media_type: "application/pdf", data: Buffer.from(req.file.bytes).toString("base64") }, title, citations: { enabled: true }, cache_control: CACHE_1H }
      ) as ContentParam;
      return { mode: "pdf", blocks: [block], userText: "", tools: [], fileIds: id ? [id] : [], docTitles: [title], texts, sourceTitle: title, pages };
    }
    case "text": {
      const text = (req.text ?? "").slice(0, 60_000);
      const first = text.split("\n").find((l) => l.trim())?.trim() ?? "";
      const title = first.length > 3 && first.length <= 80 && !/[.!?]$/.test(first) ? first.replace(/^#+\s*/, "") : req.lang === "es" ? "Tus apuntes" : "Your notes";
      const id = await upload(client, "apuntes.txt", "text/plain", text);
      texts.set(0, text);
      return { mode: "text", blocks: [textDocument(id, text, title)], userText: "", tools: [], fileIds: id ? [id] : [], docTitles: [title], texts, sourceTitle: title };
    }
    case "image": {
      if (!req.file) throw new EidosError("EIDOS_E_INPUT", "missing image");
      if (!imageKind(req.file.bytes) || req.file.bytes.byteLength > 10 * 1024 * 1024) throw new EidosError("EIDOS_E_IMAGE", "invalid image", false);
      const sharp = (await import("sharp")).default;
      const jpeg = await sharp(Buffer.from(req.file.bytes)).rotate().resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 86 }).toBuffer();
      const image = { data: jpeg.toString("base64"), mediaType: "image/jpeg" as const };
      if (!opts.readImage) throw new EidosError("EIDOS_E_UNKNOWN", "reader unavailable");
      const reading = await opts.readImage(image);
      const title = req.lang === "es" ? "Lectura de tu imagen hecha por Claude" : "Claude's reading of your image";
      const id = await upload(client, "lectura.txt", "text/plain", reading);
      texts.set(0, reading);
      const imageBlock = { type: "image", source: { type: "base64", media_type: "image/jpeg", data: image.data } } as ContentParam;
      return { mode: "image", blocks: [textDocument(id, reading, title), imageBlock], userText: "", tools: [], fileIds: id ? [id] : [], docTitles: [title], texts, sourceTitle: title, image };
    }
    case "url": {
      const url = (req.url ?? "").trim();
      return { mode: "url", blocks: [], userText: `Source URL: ${url}`, tools: webTools("url"), fileIds: [], docTitles: [url], texts, sourceTitle: url };
    }
    case "topic": {
      const topic = (req.topic ?? "").trim().slice(0, 300);
      return { mode: "topic", blocks: [], userText: `Topic or question from the learner: ${topic}`, tools: webTools("topic"), fileIds: [], docTitles: [], texts, sourceTitle: topic };
    }
  }
}

/** Topic mode without web tools (organization disabled them): general-knowledge ledger (spec 9.4.5). */
export function generalFallback(ing: Ingested): Ingested {
  return { ...ing, mode: "general", tools: [] };
}
