// Dev-only: writes public/worlds/zz-devtest.json from the test fixture to exercise the player (gitignored).
import { writeFileSync } from "node:fs";
import { validSpec, facts, misconceptions } from "../src/test/worldFixture";
import { makeLayer, kv } from "../src/lib/world/layer";

const spec = validSpec();
spec.beats[2]!.layers = [makeLayer("helix", { share: 0.9, colorMode: "region" })];
spec.beats[2]!.annotations = [
  { layerIndex: 0, regionId: "strand_a", text: "Hebra A" },
  { layerIndex: 0, regionId: "base_pairs", text: "Pares de bases" },
];
spec.beats[5]!.layers = [makeLayer("galaxy", { share: 0.9, params: kv({ arms: 3 }), colorMode: "radial" })];
spec.beats[5]!.kind = "interactive";
spec.beats[5]!.knob = { enabled: true, label: "Brazos", layerIndex: 0, paramKey: "arms", min: 1, max: 6, initial: 3, step: 1, unit: "", readout: "Con {value} brazos" };
spec.beats[7]!.layers = [makeLayer("cell", { share: 0.9, colorMode: "region" })];
const world = {
  id: "zz-devtest",
  schemaVersion: 1,
  createdAt: new Date().toISOString(),
  origin: "demo",
  source: { mode: "text", title: "Prueba" },
  spec,
  facts: facts.map((f) => ({ ...f, citations: [{ kind: "char", citedText: f.text, documentIndex: 0, documentTitle: "Prueba", startChar: 0, endChar: 10, paragraph: 2 }] })),
  misconceptions,
  verification: {},
  inserted: [],
  levelVariants: {},
  mastery: {},
  telemetry: [],
  specReport: { corrections: [] },
  lintReport: { score: 100, errors: [], warnings: [] },
  demoAssets: {
    remedials: { b04: [{ ...spec.beats[1]!, id: "r01a", kind: "concept", title: "Otra forma de verlo", layers: [makeLayer("tree", { share: 0.9 })] }, { ...spec.beats[3]!, id: "r01b", title: "Una más sencilla" }] },
    askReplays: [{ question: "¿Qué es la luz?", beatId: "b02", answer: [{ text: "La luz es energía que viene del Sol.", factIds: ["F01"] }], project: null }],
  },
};
writeFileSync("public/worlds/zz-devtest.json", JSON.stringify(world));
console.log("wrote public/worlds/zz-devtest.json");
