import { formatSSE } from "./parse";

/** SSE response with a 15 s keep-alive comment (spec 10.3). `emit` is safe to call after the client left. */
export function sseResponse(run: (emit: (event: string, data: unknown) => void, signal: AbortSignal) => Promise<void>, request: Request): Response {
  const enc = new TextEncoder();
  const ctrl = new AbortController();
  let closed = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const emit = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(formatSSE(event, data)));
        } catch {
          closed = true;
        }
      };
      const ping = setInterval(() => {
        if (!closed) controller.enqueue(enc.encode(": ping\n\n"));
      }, 15_000);
      request.signal.addEventListener("abort", () => {
        // Give a disconnected client 30 s to come back before cancelling paid work (spec 10.4).
        setTimeout(() => ctrl.abort(), 30_000);
      });
      run(emit, ctrl.signal)
        .catch((e: unknown) => emit("error", e && typeof e === "object" && "code" in e ? e : { code: "EIDOS_E_UNKNOWN", message: "unexpected error", recoverable: true }))
        .finally(() => {
          clearInterval(ping);
          closed = true;
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        });
    },
    cancel() {
      closed = true;
    },
  });
  return new Response(stream, {
    headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache, no-transform", connection: "keep-alive", "x-accel-buffering": "no" },
  });
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}
