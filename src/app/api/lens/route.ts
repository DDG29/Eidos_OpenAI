import { NextResponse } from "next/server";
import { LensRequestSchema } from "@/lib/api/schemas";
import { lens } from "@/server/agents/live";
import { aiContext, jsonError, parseJson } from "@/server/route";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const ctx = aiContext(req, "ask");
    const body = await parseJson(req, LensRequestSchema);
    return NextResponse.json(await lens(body, { apiKey: ctx.key, signal: req.signal, stream: ctx.stream, onRun: ctx.onRun }));
  } catch (e) {
    return jsonError(e);
  }
}
