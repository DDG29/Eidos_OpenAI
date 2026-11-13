import { NextResponse } from "next/server";
import { GradeRequestSchema } from "@/lib/api/schemas";
import { grade } from "@/server/agents/live";
import { aiContext, jsonError, parseJson } from "@/server/route";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const ctx = aiContext(req, "grade");
    const body = await parseJson(req, GradeRequestSchema);
    const r = await grade(body, { apiKey: ctx.key, signal: req.signal, stream: ctx.stream, onRun: ctx.onRun });
    return NextResponse.json(r);
  } catch (e) {
    return jsonError(e);
  }
}
