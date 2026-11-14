// Authoring source for public/worlds/eidos-pitch(.en).json — the hackathon pitch built as an EIDOS world (spec 11.8).
// Numbers come only from the sources of spec §17.6, read on 2026-11-13 (press coverage of the OECD PISA 2025 report).
import { writeFileSync } from "node:fs";
import { makeLayer, kv } from "../src/lib/world/layer";
import type { Beat, Fact, Lang, World } from "../src/lib/world/types";

const NK = { enabled: false, label: "", layerIndex: 0, paramKey: "", min: 0, max: 0, initial: 0, step: 0, unit: "", readout: "" };
const NC = { enabled: false, question: "", choices: [], correctIndex: 0, allowFreeText: false, idealAnswer: "", explanation: "", conceptIds: [] };

const POR_ESTO = "https://www.poresto.com/mexico/2026/9/8/mexico-retrocede-en-pisa-2025-baja-en-matematicas-y-418-de-estudiantes-queda-debajo-del-nivel-basico.html";
const LA_RAZON = "https://www.razon.com.mx/mexico/2026/09/09/revela-pisa-deuda-en-aprendizaje-y-que-aun-impacta-brecha-economica/";

function build(lang: Lang): World {
  const es = lang === "es";
  const facts: Fact[] = [
    {
      id: "F01",
      text: es
        ? "En PISA 2025, el 41.8 % de los estudiantes de 15 años de México quedó por debajo del nivel básico en matemáticas, lectura y ciencias al mismo tiempo; el promedio de la OCDE fue 19.7 %."
        : "In PISA 2025, 41.8% of 15-year-old students in Mexico were below the baseline level in mathematics, reading and science at the same time; the OECD average was 19.7%.",
      conceptId: "C01",
      origin: "web",
      citations: [{ kind: "web", citedText: "41.8 por ciento quedó por debajo del nivel básico en matemáticas, lectura y ciencias al mismo tiempo; promedio de la OCDE, que fue de 19.7 por ciento", documentIndex: -1, documentTitle: "Por Esto (8 sep 2026)", url: POR_ESTO, title: "México retrocede en PISA 2025" }],
    },
    {
      id: "F02",
      text: es
        ? "México obtuvo 388 puntos en matemáticas (OCDE: 463), 408 en lectura (OCDE: 461) y 414 en ciencias (OCDE: 482)."
        : "Mexico scored 388 in mathematics (OECD: 463), 408 in reading (OECD: 461) and 414 in science (OECD: 482).",
      conceptId: "C01",
      origin: "web",
      citations: [{ kind: "web", citedText: "México alcanzó 388 puntos … 75 por debajo del promedio de la OCDE, que fue de 463 puntos; 408 puntos, frente a los 461; 414 puntos, mientras que la media de la OCDE fue de 482", documentIndex: -1, documentTitle: "Por Esto (8 sep 2026)", url: POR_ESTO, title: "México retrocede en PISA 2025" }],
    },
    {
      id: "F03",
      text: es
        ? "Ocho de cada diez estudiantes mexicanos dijeron sentir curiosidad por distintos temas, frente al 73 % del promedio internacional."
        : "Eight in ten Mexican students said they feel curious about different topics, compared with 73% on the international average.",
      conceptId: "C02",
      origin: "web",
      citations: [{ kind: "web", citedText: "Ocho de cada 10 dijeron sentir curiosidad por distintos temas, frente a 73 por ciento del promedio internacional", documentIndex: -1, documentTitle: "La Razón (9 sep 2026)", url: LA_RAZON, title: "Revela PISA deuda en aprendizaje" }],
    },
  ];
  const b = (id: string, kind: Beat["kind"], title: string, sentences: Beat["sentences"], layers: Beat["layers"], transition: Beat["transition"], camera: Beat["camera"], extra: Partial<Beat> = {}): Beat => ({
    id,
    kind,
    title,
    sentences,
    conceptIds: [],
    layers,
    transition,
    camera,
    annotations: [],
    knob: NK,
    check: NC,
    ambient: "wonder",
    weight: 1,
    ...extra,
  });
  const agents = es ? "Cartógrafo|Director|Escéptico|Tutor|Evaluador|Jardinero|Bifurcador|Lente" : "Cartographer|Director|Skeptic|Tutor|Evaluator|Gardener|Brancher|Lens";
  const beats: Beat[] = [
    b(
      "p01",
      "hook",
      es ? "4 de cada 10" : "4 in 10",
      [
        { text: es ? "En México, alrededor de 4 de cada 10 estudiantes de 15 años quedaron por debajo del nivel básico en PISA 2025." : "In Mexico, about 4 in 10 fifteen-year-olds were below the baseline level in PISA 2025.", factIds: ["F01"] },
        { text: es ? "Y no en una materia: en matemáticas, lectura y ciencias a la vez." : "Not in one subject: in mathematics, reading and science at once.", factIds: ["F01"] },
      ],
      [makeLayer("network", { share: 0.82, params: kv({ nodes: 10, topology: 0, node_size: 0.09, edge_density: 0.15, dimension: 2 }), scale: 1.2, colorMode: "region", tint: "glow" })],
      "flow",
      "orbit_close",
      { ambient: "tense" },
    ),
    b(
      "p02",
      "concept",
      es ? "La curiosidad existe" : "Curiosity is there",
      [
        { text: es ? "Ocho de cada diez dicen sentir curiosidad por distintos temas, más que el promedio internacional." : "Eight in ten say they are curious about different topics, more than the international average.", factIds: ["F03"] },
        { text: es ? "Las ganas están. Lo que falla son las herramientas." : "The will is there. The tools are what fail.", factIds: [] },
      ],
      [makeLayer("burst", { share: 0.9, params: kv({ rays: 140, length: 1, core: 0.14, randomness: 0.35 }), scale: 1.2, colorMode: "radial" })],
      "explode",
      "orbit_wide",
    ),
    b(
      "p03",
      "concept",
      es ? "Plano, pasivo, genérico, no verificable" : "Flat, passive, generic, unverifiable",
      [
        { text: es ? "Aprendemos ideas vivas y tridimensionales en materiales planos y pasivos." : "We learn living, three-dimensional ideas from flat, passive materials.", factIds: [] },
        { text: es ? "La misma explicación para todos, y un chatbot que no dice qué parte viene de tu fuente." : "The same explanation for everyone, and a chatbot that won't say which part comes from your source.", factIds: [] },
      ],
      [makeLayer("grid", { share: 0.9, params: kv({ resolution: 34, wells: 0 }), rotation: { x: 0, y: 30, z: 0 }, scale: 1.3, colorMode: "single", tint: "secondary" })],
      "rain",
      "top_down",
      { ambient: "calm" },
    ),
    b(
      "p04",
      "mechanism",
      es ? "Toda idea tiene forma" : "Every idea has a shape",
      [
        { text: es ? "Cuando una forma se transforma en otra, la transformación misma enseña la relación." : "When one form turns into another, the transformation itself teaches the relationship.", factIds: [] },
        { text: es ? "Por eso en EIDOS no hay cortes: solo morfosis." : "That's why EIDOS has no cuts: only morphs.", factIds: [] },
      ],
      [makeLayer("helix", { share: 0.9, params: kv({ strands: 2, turns: 3, unwind: 0.55 }), scale: 1.1, colorMode: "region" })],
      "swirl",
      "side",
    ),
    b(
      "p05",
      "application",
      "EIDOS",
      [
        { text: es ? "Le das a ChatGPT un PDF, una foto o una pregunta; te devuelve un mundo que puedes recorrer." : "Give ChatGPT a PDF, a photo or a question; get back a world you can walk through.", factIds: [] },
        { text: es ? "Vamos a verlo en vivo." : "Let's see it live.", factIds: [] },
      ],
      [makeLayer("torus", { share: 0.88, params: kv({ major: 0.92, minor: 0.035, fill: 0 }), rotation: { x: 90, y: 0, z: 0 }, scale: 1.5, colorMode: "single", tint: "accent" })],
      "flow",
      "orbit_close",
    ),
    b(
      "p06",
      "mechanism",
      es ? "Una orquesta de ChatGPT" : "An orchestra of ChatGPT",
      [
        { text: es ? "Opus 5.5 lee y dirige; Sonnet 5.5 verifica y responde; Haiku 5.5 evalúa." : "Opus 5.5 reads and directs; Sonnet 5.5 verifies and answers; Haiku 5.5 grades.", factIds: [] },
        { text: es ? "Citas nativas, salidas estructuradas, pensamiento visible, Files API, búsqueda web y caché." : "Native citations, structured outputs, visible thinking, Files API, web search and caching.", factIds: [] },
      ],
      [makeLayer("network", { share: 0.86, params: kv({ nodes: 8, topology: 1, node_size: 0.07, edge_density: 0.3, dimension: 3 }), expr: [{ key: "labels", value: agents }], scale: 1.25, colorMode: "region" })],
      "fold",
      "orbit_wide",
      {
        annotations: [
          { layerIndex: 0, regionId: "node_0", text: es ? "Cartógrafo" : "Cartographer" },
          { layerIndex: 0, regionId: "node_1", text: "Director" },
          { layerIndex: 0, regionId: "node_2", text: es ? "Escéptico" : "Skeptic" },
          { layerIndex: 0, regionId: "node_5", text: es ? "Jardinero" : "Gardener" },
        ],
      },
    ),
    b(
      "p07",
      "concept",
      es ? "Cada oración, verificada" : "Every sentence, verified",
      [
        { text: es ? "Cada oración termina en un filamento que lleva al pasaje exacto de tu fuente." : "Every sentence ends in a filament that leads to the exact passage of your source.", factIds: [] },
        { text: es ? "Lo que no viene de la fuente se marca como conocimiento general. Nunca se disfraza." : "Whatever isn't in the source is labelled as general knowledge. Never disguised.", factIds: [] },
      ],
      [makeLayer("text", { share: 0.9, expr: [{ key: "content", value: es ? "FUENTE" : "SOURCE" }], params: kv({ depth: 0.1, weight: 1 }), scale: 1.25, colorMode: "height" })],
      "dissolve",
      "orbit_close",
    ),
    b(
      "p08",
      "check",
      es ? "El mundo crece contigo" : "The world grows with you",
      [],
      [makeLayer("tree", { share: 0.9, params: kv({ depth: 6, branch_angle: 30, leaves: 1 }), scale: 1.15, colorMode: "height" })],
      "flow",
      "orbit_close",
      {
        check: {
          enabled: true,
          question: es ? "¿Qué hace EIDOS cuando te equivocas en una comprobación?" : "What does EIDOS do when you get a check wrong?",
          choices: [
            { text: es ? "Te marca un error y sigue" : "It marks an error and moves on", misconceptionId: "" },
            { text: es ? "Hace crecer un capítulo nuevo para tu error" : "It grows a new chapter for your mistake", misconceptionId: "" },
            { text: es ? "Te regresa al inicio" : "It sends you back to the start", misconceptionId: "" },
          ],
          correctIndex: 1,
          allowFreeText: false,
          idealAnswer: es ? "Diagnostica el malentendido y hace crecer un capítulo nuevo." : "It diagnoses the misconception and grows a new chapter.",
          explanation: es ? "El Jardinero diseña uno o dos beats nuevos para ese malentendido, los verifica y los inserta justo después." : "The Gardener designs one or two new beats for that misconception, verifies them and inserts them right after.",
          conceptIds: [],
        },
        weight: 1,
      },
    ),
    b(
      "p09",
      "finale",
      es ? "Toda idea tiene forma" : "Every idea has a shape",
      [],
      [makeLayer("text", { share: 0.9, expr: [{ key: "content", value: "EIDOS" }], params: kv({ depth: 0.14, weight: 1 }), scale: 1.25, colorMode: "height" })],
      "flow",
      "orbit_close",
      { ambient: "triumphant" },
    ),
  ];
  const remedial: Beat[] = [
    b(
      "r01a",
      "mechanism",
      es ? "Una grieta, un brote" : "A crack, a sprout",
      [
        { text: es ? "El Evaluador nombra la idea equivocada y el Jardinero diseña un ángulo nuevo, solo para ti." : "The Evaluator names the wrong idea and the Gardener designs a new angle, just for you.", factIds: [] },
        { text: es ? "El Escéptico lo verifica y el capítulo brota justo aquí, sin que pierdas tu lugar." : "The Skeptic checks it, and the chapter sprouts right here, without losing your place.", factIds: [] },
      ],
      [makeLayer("tree", { share: 0.6, params: kv({ depth: 7, branch_angle: 38, asymmetry: 0.5 }), position: { x: -0.4, y: 0, z: 0 }, scale: 1.05, colorMode: "height" }), makeLayer("burst", { share: 0.3, params: kv({ rays: 48, length: 0.5 }), position: { x: 0.9, y: 0.6, z: 0 }, scale: 0.5, colorMode: "single", tint: "glow" })],
      "explode",
      "orbit_wide",
      { ambient: "triumphant" },
    ),
  ];
  const world: World = {
    id: "eidos-pitch",
    schemaVersion: 1,
    createdAt: "2026-11-13T00:00:00.000Z",
    origin: "demo",
    source: { mode: "url", title: es ? "PISA 2025, cobertura de prensa del informe de la OCDE" : "PISA 2025, press coverage of the OECD report" },
    spec: {
      title: "EIDOS",
      subtitle: es ? "Toda idea tiene forma." : "Every idea has a shape.",
      language: lang,
      level: "universidad",
      palette: "aurora",
      concepts: [
        { id: "C01", name: es ? "Rezago" : "Learning gap", summary: es ? "Resultados de México en PISA 2025." : "Mexico's PISA 2025 results.", dependsOn: [] },
        { id: "C02", name: es ? "Curiosidad" : "Curiosity", summary: es ? "Disposición a aprender." : "Disposition to learn.", dependsOn: [] },
      ],
      beats,
      closing: es
        ? "EIDOS convierte cualquier PDF, foto o pregunta en un mundo que puedes recorrer, verificar y que crece contigo. Funciona en el celular de una estudiante y en el proyector de una maestra."
        : "EIDOS turns any PDF, photo or question into a world you can walk through, verify, and that grows with you. It works on a student's phone and on a teacher's projector.",
      nextTopics: [],
    },
    facts,
    misconceptions: [],
    verification: {
      p01: [
        { index: 0, verdict: "supported", supportingFactIds: ["F01"], note: es ? "Cifra tal como la reporta la fuente" : "Figure as reported by the source", revised: false },
        { index: 1, verdict: "supported", supportingFactIds: ["F01"], note: "", revised: false },
      ],
      p02: [{ index: 0, verdict: "supported", supportingFactIds: ["F03"], note: "", revised: false }],
    },
    inserted: [],
    levelVariants: {},
    mastery: {},
    telemetry: [],
    specReport: { corrections: [] },
    lintReport: { score: 100, errors: [], warnings: [] },
    posterBeat: "p06",
    demoAssets: { remedials: { p08: remedial } },
  };
  return world;
}

writeFileSync("public/worlds/eidos-pitch.json", JSON.stringify(build("es"), null, 1) + "\n");
writeFileSync("public/worlds/eidos-pitch.en.json", JSON.stringify(build("en"), null, 1) + "\n");
console.log("wrote public/worlds/eidos-pitch.json and eidos-pitch.en.json");
