// Authoring source for public/worlds/_landing.json (the landing is a team-authored world, spec 3.2).
import { writeFileSync } from "node:fs";
import { makeLayer, kv } from "../src/lib/world/layer";
import type { Beat } from "../src/lib/world/types";

const NK = { enabled: false, label: "", layerIndex: 0, paramKey: "", min: 0, max: 0, initial: 0, step: 0, unit: "", readout: "" };
const NC = { enabled: false, question: "", choices: [], correctIndex: 0, allowFreeText: false, idealAnswer: "", explanation: "", conceptIds: [] };
const BOOK = "M50 30 C40 23 24 21 7 25 L7 75 C24 71 40 73 50 80 Z M50 30 C60 23 76 21 93 25 L93 75 C76 71 60 73 50 80 Z M50 30 L50 80";

const b = (id: string, kind: Beat["kind"], title: string, layers: Beat["layers"], transition: Beat["transition"], camera: Beat["camera"], ambient: Beat["ambient"] = "wonder", annotations: Beat["annotations"] = []): Beat => ({
  id,
  kind,
  title,
  sentences: [],
  conceptIds: [],
  layers,
  transition,
  camera,
  annotations,
  knob: NK,
  check: NC,
  ambient,
  weight: 1,
});

const beats: Beat[] = [
  b("m0", "hook", "Toda idea tiene forma.", [makeLayer("nebula", { share: 0.94, params: kv({ scale: 1.3, density_contrast: 0.85, filaments: 0.75 }), scale: 1.6, colorMode: "palette" })], "dissolve", "orbit_close", "calm"),
  b("m1", "concept", "EIDOS", [makeLayer("text", { share: 0.94, expr: [{ key: "content", value: "EIDOS" }], params: kv({ depth: 0.14, weight: 1 }), scale: 1.25, colorMode: "height" })], "flow", "orbit_close"),
  b("m2", "concept", "El libro que se abre", [makeLayer("glyph", { share: 0.94, expr: [{ key: "path", value: BOOK }], params: kv({ mode: 2, depth: 0.1, inflate: 0.45 }), rotation: { x: -18, y: 0, z: 0 }, scale: 1.2, colorMode: "palette" })], "flow", "orbit_close"),
  b("m3", "concept", "Cada afirmación, anclada", [makeLayer("galaxy", { share: 0.94, params: kv({ arms: 2, twist: 3.4, core: 0.16, spread: 0.32, thickness: 0.07 }), rotation: { x: 22, y: 0, z: 0 }, scale: 1.25, colorMode: "radial" })], "swirl", "orbit_wide", "wonder", [{ layerIndex: 0, regionId: "core", text: "p. 4" }]),
  b("m4", "mechanism", "La doble hélice", [makeLayer("helix", { share: 0.94, params: kv({ strands: 2, turns: 3.2, radius: 0.36, base_pairs: 1 }), scale: 1.1, colorMode: "region" })], "fold", "side"),
  b(
    "m5",
    "mechanism",
    "La red que crece",
    [
      makeLayer("layers", { share: 0.8, data: [4, 7, 7, 5, 3], params: kv({ spacing: 0.55, connection_density: 0.45 }), scale: 1.15, colorMode: "region" }),
      makeLayer("tree", { share: 0.14, params: kv({ depth: 5, branch_angle: 32, branches: 2, leaves: 1 }), position: { x: 1.15, y: 0.55, z: 0.1 }, rotation: { x: 0, y: 0, z: -62 }, scale: 0.45, colorMode: "single", tint: "accent" }),
    ],
    "explode",
    "orbit_close",
    "playful",
  ),
  b("m6", "finale", "¿Qué quieres entender hoy?", [makeLayer("torus", { share: 0.9, params: kv({ major: 0.92, minor: 0.03, fill: 0 }), rotation: { x: 90, y: 0, z: 0 }, scale: 1.6, colorMode: "single", tint: "accent" })], "swirl", "orbit_close", "calm"),
];

const world = {
  id: "_landing",
  schemaVersion: 1,
  createdAt: "2026-11-12T00:00:00.000Z",
  origin: "demo",
  source: { mode: "text", title: "EIDOS" },
  spec: { title: "EIDOS", subtitle: "Toda idea tiene forma.", language: "es", level: "curioso", palette: "aurora", concepts: [], beats, closing: "", nextTopics: [] },
  facts: [],
  misconceptions: [],
  verification: {},
  inserted: [],
  levelVariants: {},
  mastery: {},
  telemetry: [],
  specReport: { corrections: [] },
  lintReport: { score: 100, errors: [], warnings: [] },
  /** stage framing per beat: 0 centered (word, ring), 1 asymmetric */
  frames: [0, 0, 1, 1, 1, 1, 0],
};
writeFileSync("public/worlds/_landing.json", JSON.stringify(world, null, 1) + "\n");
console.log("wrote public/worlds/_landing.json");
