import { NextResponse } from "next/server";
import { EidosError } from "@/lib/errors";
import { jsonError } from "@/server/route";
import { getShared, kvConfigured } from "@/server/share/store";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!/^[A-Za-z0-9_-]{10}$/.test(id) || !kvConfigured()) throw new EidosError("EIDOS_E_INPUT", "not found", false, { detail: "id" });
    const json = await getShared(id);
    if (!json) return NextResponse.json({ error: { code: "EIDOS_E_INPUT", message: "not found" } }, { status: 404 });
    return new NextResponse(`{"world":${json}}`, { headers: { "content-type": "application/json", "cache-control": "public, max-age=300" } });
  } catch (e) {
    return jsonError(e);
  }
}
