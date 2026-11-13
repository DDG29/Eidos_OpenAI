import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { EidosError, asEidosError } from "@/lib/errors";
import { sseResponse } from "@/lib/sse/server";
import { makeClient } from "@/server/ai/claude";
import { runForge } from "@/server/forge/runForge";
import { aiContext, jsonError } from "@/server/route";
import { LangEnum, LevelEnum, QualityEnum } from "@/lib/api/schemas";
import { FactSchema, MisconceptionSchema } from "@/lib/world/worldFile";
import { ConceptSchema } from "@/lib/world/schema";
import type { Ledger } from "@/server/agents/cartographer/parseLedger";

export const runtime = "nodejs";
export const maxDuration = 300;

const Form = z.object({
  mode: z.enum(["pdf", "image", "url", "text", "topic"]),
  level: LevelEnum,
  lang: LangEnum,
  quality: QualityEnum,
  focus: z.string().max(200).optional(),
  url: z
    .string()
    .max(250)
    .optional()
    .refine((u) => !u || (/^https?:\/\//i.test(u) && !/^https?:\/\/[^/]*@/i.test(u)), "url must be http(s) without credentials"),
  topic: z.string().min(3).max(300).optional(),
  text: z.string().min(200).max(60000).optional(),
});

const Resume = z.object({
  ledger: z.object({
    facts: z.array(FactSchema).min(4).max(80),
    concepts: z.array(ConceptSchema).max(24),
    misconceptions: z.array(MisconceptionSchema).max(12),
    profile: z.object({ title: z.string().max(80), domain: z.string().max(60), difficulty: LevelEnum, palette: z.string().max(12), visualMotifs: z.array(z.string().max(80)).max(8), numbers: z.array(z.string().max(120)).max(8) }),
  }),
  sessionToken: z.string().max(4000).nullable(),
  sourceTitle: z.string().max(300),
});

export async function POST(req: Request) {
  let ctx;
  let input: z.infer<typeof Form>;
  let resume: z.infer<typeof Resume> | undefined;
  let file: { name: string; type: string; bytes: Uint8Array } | undefined;
  try {
    ctx = aiContext(req, "forge");
    const fd = await req.formData();
    const get = (k: string) => {
      const v = fd.get(k);
      return typeof v === "string" && v.length ? v : undefined;
    };
    const parsed = Form.safeParse({ mode: get("mode"), level: get("level"), lang: get("lang"), quality: get("quality"), focus: get("focus"), url: get("url"), topic: get("topic"), text: get("text") });
    if (!parsed.success) throw new EidosError("EIDOS_E_INPUT", parsed.error.issues[0]?.message ?? "invalid input", false, { detail: parsed.error.issues[0]?.path.join(".") ?? "" });
    input = parsed.data;
    const f = fd.get("file");
    if (f && typeof f !== "string") file = { name: f.name || "documento", type: f.type, bytes: new Uint8Array(await f.arrayBuffer()) };
    const rs = get("resume");
    if (rs) {
      const r = Resume.safeParse(JSON.parse(rs));
      if (!r.success) throw new EidosError("EIDOS_E_INPUT", "invalid resume payload", false, { detail: "resume" });
      resume = r.data;
    }
    if ((input.mode === "pdf" || input.mode === "image") && !file && !resume) throw new EidosError("EIDOS_E_INPUT", "missing file", false, { detail: "file" });
    if (input.mode === "url" && !input.url && !resume) throw new EidosError("EIDOS_E_INPUT", "missing url", false, { detail: "url" });
    if (input.mode === "topic" && !input.topic && !resume) throw new EidosError("EIDOS_E_INPUT", "missing topic", false, { detail: "topic" });
    if (input.mode === "text" && !input.text && !resume) throw new EidosError("EIDOS_E_INPUT", "missing text", false, { detail: "text" });
  } catch (e) {
    return jsonError(e);
  }
  const c = ctx;
  const rsm = resume ? { ledger: { ...resume.ledger, warnings: [] } as unknown as Ledger, sessionToken: resume.sessionToken, sourceTitle: resume.sourceTitle } : undefined;
  const started = Date.now();
  const debug = process.env.EIDOS_DEBUG === "1" && process.env.NODE_ENV === "development";
  const recorded: { t: number; type: string; data: unknown }[] = [];
  return sseResponse(async (emit, signal) => {
    const timeout = AbortSignal.timeout(280_000);
    const both = AbortSignal.any([signal, timeout]);
    const rec = (type: string, data: unknown) => {
      if (debug) recorded.push({ t: Date.now() - started, type, data });
      emit(type, data);
    };
    try {
      const res = await runForge({ ...input, file }, rec, { stream: c.stream, apiKey: c.key, client: makeClient(c.key), signal: both, onSpend: c.onRun, resume: rsm });
      if (debug) {
        mkdirSync(join(process.cwd(), ".debug"), { recursive: true });
        writeFileSync(join(process.cwd(), ".debug", `${res.worldId}.forge.json`), JSON.stringify({ kind: "forge", worldId: res.worldId, recordedAt: new Date().toISOString(), synthetic: false, events: recorded }));
      }
    } catch (e) {
      const err = timeout.aborted ? new EidosError("EIDOS_E_TIMEOUT", "timeout") : asEidosError(e);
      rec("error", { ...err.toJSON(), stage: "forge" });
    }
  }, req);
}
