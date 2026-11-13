"use client";

import { SSEParser } from "./parse";
import { readByok } from "@/lib/settings/store";

export type SSEHandler = (event: string, data: unknown) => void;

/** POST + streamed SSE over fetch (EventSource cannot POST). Returns when the stream ends. */
export async function postSSE(url: string, body: BodyInit | object, onEvent: SSEHandler, signal?: AbortSignal): Promise<void> {
  const headers: Record<string, string> = { accept: "text/event-stream" };
  const key = readByok();
  if (key) headers["x-eidos-user-key"] = key;
  let payload: BodyInit;
  if (body instanceof FormData || typeof body === "string" || body instanceof Blob) payload = body as BodyInit;
  else {
    headers["content-type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(url, { method: "POST", body: payload, headers, signal });
  if (!res.ok || !res.body) {
    let err: unknown = { code: "EIDOS_E_UNKNOWN", message: res.statusText };
    try {
      err = ((await res.json()) as { error: unknown }).error;
    } catch {
      /* not json */
    }
    onEvent("error", err);
    return;
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  const parser = new SSEParser();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    for (const e of parser.push(value)) {
      let data: unknown = e.data;
      try {
        data = JSON.parse(e.data);
      } catch {
        /* raw */
      }
      onEvent(e.event, data);
    }
  }
}

export async function postJSON<T>(url: string, body: object): Promise<T> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  const key = readByok();
  if (key) headers["x-eidos-user-key"] = key;
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  const json = (await res.json()) as T & { error?: { code: string; message: string } };
  if (!res.ok || json.error) throw Object.assign(new Error(json.error?.message ?? res.statusText), { code: json.error?.code ?? "EIDOS_E_UNKNOWN" });
  return json;
}
