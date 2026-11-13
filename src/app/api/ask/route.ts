import { AskRequestSchema } from "@/lib/api/schemas";
import { asEidosError } from "@/lib/errors";
import { sseResponse } from "@/lib/sse/server";
import { makeClient } from "@/server/ai/claude";
import { ask } from "@/server/agents/live";
import { aiContext, jsonError, parseJson } from "@/server/route";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  let ctx;
  let body;
  try {
    ctx = aiContext(req, "ask");
    body = await parseJson(req, AskRequestSchema);
  } catch (e) {
    return jsonError(e);
  }
  const c = ctx;
  const b = body;
  return sseResponse(async (emit, signal) => {
    try {
      await ask(b, emit, { apiKey: c.key, signal, stream: c.stream, onRun: (r) => (c.onRun(r), emit("usage", r)) }, makeClient(c.key));
      emit("done", {});
    } catch (e) {
      emit("error", { ...asEidosError(e).toJSON(), stage: "tutor" });
    }
  }, req);
}
