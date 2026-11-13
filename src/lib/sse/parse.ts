/** Incremental parser for `text/event-stream` (spec 10.3). Tolerates arbitrary chunk boundaries and CRLF. */
export interface SSEEvent {
  event: string;
  data: string;
}

export class SSEParser {
  private buf = "";
  push(chunk: string): SSEEvent[] {
    this.buf += chunk.replace(/\r\n?/g, "\n");
    const out: SSEEvent[] = [];
    let idx: number;
    while ((idx = this.buf.indexOf("\n\n")) >= 0) {
      const block = this.buf.slice(0, idx);
      this.buf = this.buf.slice(idx + 2);
      let event = "message";
      const data: string[] = [];
      for (const line of block.split("\n")) {
        if (!line || line.startsWith(":")) continue;
        const c = line.indexOf(":");
        const field = c < 0 ? line : line.slice(0, c);
        const value = c < 0 ? "" : line.slice(c + 1).replace(/^ /, "");
        if (field === "event") event = value;
        else if (field === "data") data.push(value);
      }
      if (data.length) out.push({ event, data: data.join("\n") });
    }
    return out;
  }
}

export function formatSSE(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}
