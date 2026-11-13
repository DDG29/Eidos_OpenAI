import { ForkRequestSchema } from "@/lib/api/schemas";
import { asEidosError } from "@/lib/errors";
import { sseResponse } from "@/lib/sse/server";
import { fork } from "@/server/agents/live";
import { aiContext, jsonError, parseJson } from "@/server/route";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  let ctx;
  let body;
  try {
    ctx = aiContext(req, "grow");
    body = await parseJson(req, ForkRequestSchema);
  } catch (e) {
    return jsonError(e);
  }
  const c = ctx;
  const b = body;
  return sseResponse(async (emit, signal) => {
    try {
      await fork(b, emit, { apiKey: c.key, signal, stream: c.stream, onRun: (r) => (c.onRun(r), emit("usage", r)) });
      emit("done", {});
    } catch (e) {
      emit("error", { ...asEidosError(e).toJSON(), stage: "fork" });
    }
  }, req);
}
