import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { IncrementalArrayScanner } from "./incrementalArray";

const world = {
  title: 'El "núcleo" {de} todo',
  subtitle: "Llaves } y corchetes ] dentro de cadenas \\ y ✨ unicode",
  palette: "bioluz",
  concepts: [{ id: "C01", name: "A", summary: "x", dependsOn: [] }],
  beats: [
    { id: "b01", title: "Uno {", sentences: [{ text: 'dice "hola"', factIds: ["F01"] }], layers: [{ shape: "helix", data: [1, 2, [3]] }] },
    { id: "b02", title: "Dos ]", sentences: [], layers: [] },
    { id: "b03", title: "Tres \\\" fin", sentences: [], layers: [{ expr: [{ key: "f", value: "sin(x)*{" }] }] },
  ],
  closing: "Gracias",
  nextTopics: ["a", "b"],
};
const text = JSON.stringify(world, null, 1);

function run(chunks: string[]) {
  const got: unknown[] = [];
  let prefix: Record<string, unknown> | null = null;
  const sc = new IncrementalArrayScanner("beats", (v) => got.push(v), (p) => (prefix = p));
  for (const c of chunks) sc.push(c);
  return { got, prefix: prefix as Record<string, unknown> | null, sc };
}

describe("IncrementalArrayScanner", () => {
  it("emits every beat and the prefix", () => {
    const { got, prefix, sc } = run([text]);
    expect(got).toEqual(world.beats);
    expect(prefix).toMatchObject({ title: world.title, palette: "bioluz", concepts: world.concepts });
    expect(sc.done).toBe(true);
  });

  it("is invariant to random fragmentation (1–50 chars)", () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 1, max: 50 }), { minLength: 1, maxLength: 200 }), (sizes) => {
        const chunks: string[] = [];
        let i = 0,
          k = 0;
        while (i < text.length) {
          const n = sizes[k++ % sizes.length]!;
          chunks.push(text.slice(i, i + n));
          i += n;
        }
        const { got, prefix } = run(chunks);
        return JSON.stringify(got) === JSON.stringify(world.beats) && prefix?.title === world.title;
      }),
      { numRuns: 300 },
    );
  });

  it("emits complete beats from a truncated stream and ignores the partial one", () => {
    const cut = text.slice(0, text.indexOf('"b03"') + 10);
    const { got, sc } = run([cut]);
    expect(got.map((b) => (b as { id: string }).id)).toEqual(["b01", "b02"]);
    expect(sc.done).toBe(false);
  });

  it("does not confuse a nested 'beats' key", () => {
    const t = JSON.stringify({ meta: { beats: [{ id: "no" }] }, beats: [{ id: "yes" }] });
    expect(run([t]).got).toEqual([{ id: "yes" }]);
  });
});
