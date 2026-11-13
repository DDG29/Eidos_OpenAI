import { createRng } from "../util/rng";
import { allocate, clamp, parseLabels, PointBuilder } from "./helpers";
import type { ShapeDefinition } from "./types";

const DEFAULT_LAYERS = [4, 8, 8, 3];

export const layers: ShapeDefinition = {
  id: "layers",
  title: "Layered neural network",
  doc: "Columns of neurons (one column per layer) joined by connections between consecutive layers; signals travel left to right as light pulses. Data gives neurons per layer, e.g. [4, 8, 8, 3]; labels name the layers.",
  goodFor: ["a neural network / perceptron", "a Transformer at a high level", "a multi-stage pipeline", "an information funnel or bottleneck", "encoder–decoder ideas"],
  params: [
    { key: "spacing", default: 0.55, min: 0.2, max: 1, doc: "horizontal distance between layers (before fitting to the frame)" },
    { key: "connection_density", default: 0.5, min: 0, max: 1, doc: "fraction of possible connections drawn between consecutive layers (0 = none)" },
    { key: "neuron_size", default: 0.045, min: 0.015, max: 0.1, doc: "neuron radius (shrinks automatically in crowded layers)" },
  ],
  expr: [{ key: "labels", kind: "labels", default: "", maxLength: 600, doc: "optional layer names 'Input|Hidden|Output' in layer order" }],
  data: { doc: "neurons per layer, 2–8 layers of 1–24 neurons, e.g. [4, 8, 8, 3]", minLength: 2, maxLength: 8 },
  regions: [
    { id: "layer_{i}", doc: "the neurons of layer i (0 = input), labelled when labels are given" },
    { id: "connections", doc: "all connections between layers (absent when connection_density = 0)" },
  ],
  motionDoc: "neurons pulse; signals flow left to right along the connections",
  generate({ count, rng, params, expr, data }) {
    const b = new PointBuilder();
    let sizes = data
      .slice(0, 8)
      .filter((v) => Number.isFinite(v))
      .map((v) => clamp(Math.round(v), 1, 24));
    if (sizes.length < 2) {
      if (data.length > 0) b.warnings.push("layers needs 2–8 layer sizes; using [4, 8, 8, 3]");
      sizes = DEFAULT_LAYERS.slice();
    }
    const labels = parseLabels(expr.labels);
    const L = sizes.length;
    const spacing = params.spacing!;
    const density = params.connection_density!;

    // Neuron centers: one vertical column per layer.
    const neurons: { x: number; y: number; r: number; layer: number }[][] = sizes.map((m, l) => {
      const dy = m > 1 ? Math.min(0.16, 1.7 / (m - 1)) : 0;
      const r = Math.min(params.neuron_size!, m > 1 ? dy * 0.42 : Infinity);
      const x = (l - (L - 1) / 2) * spacing;
      return Array.from({ length: m }, (_, j) => ({ x, y: (j - (m - 1) / 2) * dy, r, layer: l }));
    });

    // Connections: a fixed-seed subset so knobs and beats keep the same wiring; every neuron keeps ≥1 link.
    const wire = createRng(`layers:wiring:${sizes.join(",")}`);
    const conns: [(typeof neurons)[number][number], (typeof neurons)[number][number]][] = [];
    if (density > 0) {
      for (let l = 0; l < L - 1; l++) {
        const A = neurons[l]!,
          B = neurons[l + 1]!;
        const hasOut = new Array<boolean>(A.length).fill(false);
        const hasIn = new Array<boolean>(B.length).fill(false);
        for (let i = 0; i < A.length; i++)
          for (let j = 0; j < B.length; j++)
            if (wire.next() < density) {
              conns.push([A[i]!, B[j]!]);
              hasOut[i] = hasIn[j] = true;
            }
        for (let i = 0; i < A.length; i++) if (!hasOut[i]) conns.push([A[i]!, B[Math.min(B.length - 1, Math.round((i / Math.max(1, A.length - 1)) * (B.length - 1)))]!]);
        for (let j = 0; j < B.length; j++) if (!hasIn[j]) conns.push([A[Math.min(A.length - 1, Math.round((j / Math.max(1, B.length - 1)) * (A.length - 1)))]!, B[j]!]);
      }
    }

    const layerIds = sizes.map((_, l) =>
      b.region({ id: `layer_${l}`, label: labels[l], motion: { type: "pulse", speed: 0.5 }, colorRole: l === 0 ? "accent" : l === L - 1 ? "glow" : "primary" }),
    );
    const connId = conns.length ? b.region({ id: "connections", motion: { type: "flow", speed: 0.8 }, colorRole: "secondary" }) : -1;
    const connShare = conns.length ? 0.2 + 0.25 * density : 0;
    const [nNeurons, nConns] = allocate(count, [1 - connShare, connShare]) as [number, number];
    const all = neurons.flat();
    const neuronCounts = allocate(nNeurons, all.map((nn) => nn.r * nn.r));
    const xMin = neurons[0]![0]!.x,
      xMax = neurons[L - 1]![0]!.x;
    const xSpan = xMax - xMin || 1;

    const d = [0, 0, 0];
    all.forEach((nn, k) => {
      for (let q = 0; q < neuronCounts[k]!; q++) {
        rng.dir(d);
        // Mostly a soft solid ball, with a thin brighter rim so each neuron reads as a circle.
        const rim = rng.next() < 0.3;
        const rr = rim ? nn.r * (0.92 + 0.08 * rng.next()) : nn.r * Math.pow(rng.next(), 0.6);
        b.push(nn.x + d[0]! * rr, nn.y + d[1]! * rr, d[2]! * rr, layerIds[nn.layer]!, nn.layer / Math.max(1, L - 1), rim ? 1.1 : 1);
      }
    });
    if (conns.length) {
      const lens = conns.map(([p, q]) => Math.max(1e-3, Math.hypot(q.x - p.x, q.y - p.y) - p.r - q.r));
      const connCounts = allocate(nConns, lens);
      const jit = 0.0025;
      conns.forEach(([p, q], c) => {
        const len = Math.hypot(q.x - p.x, q.y - p.y) || 1;
        const s0 = Math.min(0.45, p.r / len),
          s1 = Math.max(0.55, 1 - q.r / len);
        for (let k = 0; k < connCounts[c]!; k++) {
          const s = s0 + (s1 - s0) * rng.next();
          const x = p.x + (q.x - p.x) * s;
          // motionParam = global x so pulses sweep the whole network as one wavefront.
          b.push(x + rng.normal() * jit, p.y + (q.y - p.y) * s + rng.normal() * jit, rng.normal() * jit, connId, (x - xMin) / xSpan, 0.65);
        }
      });
    }
    const out = b.build(count, rng);
    // Fit into [0.6, 1]: big networks shrink to the frame, tiny ones grow without ballooning the neurons.
    let ext = 0;
    for (let i = 0; i < out.positions.length; i++) ext = Math.max(ext, Math.abs(out.positions[i]!));
    const s = ext > 1 ? 1 / ext : ext > 1e-6 && ext < 0.6 ? 0.6 / ext : 1;
    if (s !== 1) for (let i = 0; i < out.positions.length; i++) out.positions[i] = out.positions[i]! * s;
    return out;
  },
};
