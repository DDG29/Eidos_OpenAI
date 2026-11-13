import { NextResponse } from "next/server";
import { healthReport } from "@/server/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(healthReport(), { headers: { "cache-control": "no-store" } });
}
