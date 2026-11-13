import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { SSEParser, formatSSE } from "./parse";

describe("SSE parser", () => {
  const events = [
    { e: "stage", d: { stage: "cartographer", status: "start" } },
    { e: "thinking", d: { agent: "director", delta: "Pienso en {llaves} y \"comillas\"\n" } },
    { e: "beat", d: { id: "b01", title: "¿Y si…? ñ" } },
  ];
  const wire = ": ping\n\n" + events.map((x) => formatSSE(x.e, x.d)).join("");
  it("parses a whole stream", () => {
    const p = new SSEParser();
    const out = p.push(wire);
    expect(out.map((o) => o.event)).toEqual(["stage", "thinking", "beat"]);
    expect(JSON.parse(out[1]!.data)).toEqual(events[1]!.d);
  });
  it("parses any fragmentation identically", () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 1, max: 40 }), { minLength: 1, maxLength: 60 }), (cuts) => {
        const p = new SSEParser();
        const out: string[] = [];
        let i = 0;
        let k = 0;
        while (i < wire.length) {
          const n = cuts[k++ % cuts.length]!;
          out.push(...p.push(wire.slice(i, i + n)).map((e) => e.event + e.data));
          i += n;
        }
        return out.join("|") === new SSEParser().push(wire).map((e) => e.event + e.data).join("|");
      }),
      { numRuns: 200 },
    );
  });
  it("handles CRLF line endings", () => {
    expect(new SSEParser().push("event: done\r\ndata: {}\r\n\r\n")).toEqual([{ event: "done", data: "{}" }]);
  });
});
