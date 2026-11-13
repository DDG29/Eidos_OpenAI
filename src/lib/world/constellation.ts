import type { Concept, Layer, Mastery } from "./types";
import { makeLayer } from "./layer";

/** Finale constellation (spec 3.10): one star per concept, edges = dependencies, brightness = mastery. */
export function constellationLayer(concepts: Concept[]): Layer {
  const idx = new Map(concepts.map((c, i) => [c.id, i]));
  const edges = concepts.flatMap((c) => c.dependsOn.map((d) => idx.get(d)).filter((i): i is number => i !== undefined).map((i) => `${i}-${idx.get(c.id)}`));
  return makeLayer("network", {
    share: 0.86,
    params: [
      { key: "nodes", value: Math.max(3, concepts.length) },
      { key: "node_size", value: 0.075 },
      { key: "edge_density", value: 0.22 },
      { key: "dimension", value: 3 },
      { key: "topology", value: 1 },
    ],
    expr: [
      ...(edges.length ? [{ key: "edges", value: edges.join(";") }] : []),
      { key: "labels", value: concepts.map((c) => c.name.replace(/\|/g, "/")).join("|") },
    ],
    scale: 1.2,
    colorMode: "region",
    tint: "glow",
  });
}

export function masteryBrightness(concepts: Concept[], mastery: Record<string, Mastery>): Record<string, number> {
  const out: Record<string, number> = {};
  concepts.forEach((c, i) => {
    const m = mastery[c.id];
    out[`node_${i}`] = m && m.attempts > 0 ? 0.25 + 0.75 * m.score : 0.35;
  });
  return out;
}
