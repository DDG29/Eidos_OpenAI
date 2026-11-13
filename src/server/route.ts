import { NextResponse } from "next/server";
import type { ZodType } from "zod";
import { EidosError, asEidosError } from "@/lib/errors";
import type { AgentRun } from "@/lib/world/types";
import { streamAgent } from "./ai/claude";
import { resolveKey } from "./apiKey";
import { addSpend, guard, type Bucket } from "./limits/limits";
import { clientIp } from "@/lib/sse/server";

/** Shared plumbing for AI routes: input validation, key + limits, error shape { error: { code, message } }. */

export function jsonError(e: unknown): NextResponse {
  const err = asEidosError(e);
  // Log operational metadata only (spec 10.11): never content, keys or questions.
  console.warn(`[eidos] ${err.code}${err.status >= 500 ? ` ${err.message.slice(0, 120)}` : ""}`);
  return NextResponse.json({ error: { code: err.code, message: err.message, vars: err.vars } }, { status: err.status });
}

export async function parseJson<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new EidosError("EIDOS_E_INPUT", "invalid JSON body", false, { detail: "JSON" });
  }
  const r = schema.safeParse(body);
  if (!r.success) throw new EidosError("EIDOS_E_INPUT", r.error.issues[0]?.message ?? "invalid input", false, { detail: r.error.issues[0]?.path.join(".") ?? "" });
  return r.data;
}

export interface AiContext {
  key: string;
  byok: boolean;
  onRun: (r: AgentRun) => void;
  stream: typeof streamAgent;
}

export function aiContext(req: Request, bucket: Bucket): AiContext {
  const { key, byok } = resolveKey(req);
  if (!key) throw new EidosError("EIDOS_E_NO_KEY", "no API key", false);
  guard(bucket, clientIp(req), byok);
  return { key, byok, onRun: (r) => addSpend(r.costUsd, byok), stream: streamAgent };
}
