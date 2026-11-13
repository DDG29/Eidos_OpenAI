import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { EidosError } from "@/lib/errors";
import { WorldFileSchema } from "@/lib/world/worldFile";
import { jsonError } from "@/server/route";
import { kvConfigured, putShared } from "@/server/share/store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    if (!kvConfigured()) throw new EidosError("EIDOS_E_INPUT", "short links are not configured; use the URL fragment", false, { detail: "kv" });
    const text = await req.text();
    if (text.length > 1_500_000) throw new EidosError("EIDOS_E_INPUT", "world too large", false, { detail: "size" });
    const body = JSON.parse(text) as { world?: unknown };
    const parsed = WorldFileSchema.safeParse(body.world);
    if (!parsed.success) throw new EidosError("EIDOS_E_INPUT", "invalid world", false, { detail: parsed.error.issues[0]?.path.join(".") ?? "" });
    const { sessionToken: _t, ...world } = parsed.data;
    void _t;
    const id = nanoid(10);
    await putShared(id, JSON.stringify({ ...world, origin: "shared" }));
    return NextResponse.json({ id });
  } catch (e) {
    return jsonError(e);
  }
}
