import type { Beat, Lang, ShapeId } from "./types";

/** Text description of a beat's scene for screen readers (spec 13.1), composed from layers and annotations. */
const NAMES: Record<Lang, Partial<Record<ShapeId, string>>> = {
  es: {
    sphere: "una esfera de luz",
    shell: "un cascarón esférico",
    torus: "un anillo",
    torusKnot: "un nudo toroidal",
    helix: "una hélice",
    galaxy: "una galaxia espiral",
    lattice: "una red cristalina",
    grid: "una malla que se curva",
    wave: "una superficie de ondas",
    surface: "una superficie matemática",
    parametric: "una superficie paramétrica",
    curve: "una curva",
    field: "líneas de un campo",
    molecule: "una molécula",
    orbits: "un sistema de órbitas",
    network: "una red de nodos",
    layers: "una red por capas",
    tree: "un árbol que se ramifica",
    cell: "una célula en corte",
    bars: "una gráfica de barras",
    scatter: "una nube de puntos de datos",
    text: "texto en partículas",
    glyph: "una silueta",
    image: "tu imagen hecha de luz",
    nebula: "una nebulosa",
    vortex: "un disco que gira hacia un centro oscuro",
    flow: "un tubo de flujo",
    burst: "un estallido de luz",
  },
  en: {
    sphere: "a sphere of light",
    shell: "a spherical shell",
    torus: "a ring",
    torusKnot: "a torus knot",
    helix: "a helix",
    galaxy: "a spiral galaxy",
    lattice: "a crystal lattice",
    grid: "a bending grid",
    wave: "a wave surface",
    surface: "a mathematical surface",
    parametric: "a parametric surface",
    curve: "a curve",
    field: "field lines",
    molecule: "a molecule",
    orbits: "an orbital system",
    network: "a network of nodes",
    layers: "a layered network",
    tree: "a branching tree",
    cell: "a cutaway cell",
    bars: "a bar chart",
    scatter: "a cloud of data points",
    text: "particle text",
    glyph: "a silhouette",
    image: "your image made of light",
    nebula: "a nebula",
    vortex: "a disk spiralling into a dark center",
    flow: "a flowing tube",
    burst: "a burst of light",
  },
};

export function describeScene(beat: Beat, lang: Lang): string {
  const names = beat.layers.map((l) => {
    const base = NAMES[lang][l.shape] ?? l.shape;
    const content = l.shape === "text" ? l.expr.find((e) => e.key === "content")?.value : undefined;
    return content ? `${base} «${content}»` : base;
  });
  const parts = beat.annotations.map((a) => a.text);
  if (lang === "es") return `${names.length > 1 ? "Se ven " : "Se ve "}${names.join(" y ")}.${parts.length ? ` Partes señaladas: ${parts.join(", ")}.` : ""}`;
  return `The scene shows ${names.join(" and ")}.${parts.length ? ` Labelled parts: ${parts.join(", ")}.` : ""}`;
}
