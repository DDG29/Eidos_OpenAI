import { makeLayer } from "@/lib/world/layer";
import type { Beat, BeatKind, Fact, Misconception, ShapeId, WorldSpec } from "@/lib/world/types";

const NK = { enabled: false, label: "", layerIndex: 0, paramKey: "", min: 0, max: 0, initial: 0, step: 0, unit: "", readout: "" };
const NC = { enabled: false, question: "", choices: [], correctIndex: 0, allowFreeText: false, idealAnswer: "", explanation: "", conceptIds: [] };

export function beat(id: string, kind: BeatKind, shape: ShapeId, extra: Partial<Beat> = {}): Beat {
  return {
    id,
    kind,
    title: `Beat ${id}`,
    sentences: [
      { text: "El sol da luz a la planta.", factIds: ["F01"] },
      { text: "La planta usa esa luz para crecer.", factIds: ["F02"] },
    ],
    conceptIds: ["C01"],
    layers: [makeLayer(shape, { share: 0.9 })],
    transition: "flow",
    camera: "orbit_close",
    annotations: [],
    knob: { ...NK },
    check: { ...NC },
    ambient: "calm",
    weight: 1,
    ...extra,
  };
}

export const facts: Fact[] = [
  { id: "F01", text: "El sol emite luz.", conceptId: "C01", citations: [], origin: "source" },
  { id: "F02", text: "Las plantas usan luz.", conceptId: "C01", citations: [], origin: "source" },
];
export const misconceptions: Misconception[] = [{ id: "M01", wrongIdea: "Las plantas comen tierra.", correction: "Fijan CO2.", factIds: ["F01"] }];

export function checkBeat(id: string, shape: ShapeId): Beat {
  return beat(id, "check", shape, {
    check: {
      enabled: true,
      question: "¿De dónde viene la masa de un árbol?",
      choices: [
        { text: "Del aire", misconceptionId: "" },
        { text: "Del suelo", misconceptionId: "M01" },
        { text: "Del agua", misconceptionId: "" },
      ],
      correctIndex: 0,
      allowFreeText: true,
      idealAnswer: "Del CO2 del aire.",
      explanation: "El carbono viene del aire.",
      conceptIds: ["C01"],
    },
  });
}

/** A world that passes every linter rule. */
export function validSpec(): WorldSpec {
  return {
    title: "La fábrica de luz",
    subtitle: "Fotosíntesis",
    language: "es",
    level: "curioso",
    palette: "solar",
    concepts: [
      { id: "C01", name: "Luz", summary: "Energía del sol.", dependsOn: [] },
      { id: "C02", name: "Azúcar", summary: "Comida de la planta.", dependsOn: ["C01"] },
    ],
    beats: [
      beat("b01", "hook", "text", { transition: "flow" }),
      beat("b02", "concept", "sphere", { transition: "swirl" }),
      beat("b03", "mechanism", "helix", { transition: "explode" }),
      checkBeat("b04", "nebula"),
      beat("b05", "misconception", "torus", { transition: "dissolve" }),
      beat("b06", "mechanism", "galaxy", { transition: "fold" }),
      checkBeat("b07", "wave"),
      beat("b08", "application", "network", { transition: "rain" }),
      beat("b09", "recap", "text", { camera: "side" }),
      beat("b10", "finale", "nebula", { sentences: [] }),
    ],
    closing: "Gracias.",
    nextTopics: ["Respiración", "Clorofila", "Cadenas alimentarias"],
  };
}
