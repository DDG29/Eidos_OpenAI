import { NextResponse } from "next/server";
import { z } from "zod";
import { estimateForge } from "@/lib/pricing";
import { jsonError, parseJson } from "@/server/route";
import { QualityEnum } from "@/lib/api/schemas";

export const runtime = "nodejs";

const Body = z.object({ mode: z.enum(["pdf", "image", "url", "text", "topic"]), quality: QualityEnum, pages: z.number().int().min(0).max(1000).optional(), chars: z.number().int().min(0).max(60000).optional() });

export async function POST(req: Request) {
  try {
    const b = await parseJson(req, Body);
    return NextResponse.json(estimateForge(b));
  } catch (e) {
    return jsonError(e);
  }
}
