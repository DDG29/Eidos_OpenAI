import { createRng, type Rng } from "../util/rng";
import { allocate, clamp, parseEdges, parseLabels, PointBuilder } from "./helpers";
import type { ShapeDefinition } from "./types";

type Edge = [number, number];

function dedupe(edges: Edge[]): Edge[] {
  const seen = new Set<number>();
  const out: Edge[] = [];
  for (const [a, b] of edges) {
    if (a === b) continue;
    const key = Math.min(a, b) * 1000 + Math.max(a, b);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push([a, b]);
  }
  return out;
}

/** Join every connected component to the largest one so the force layout never flings islands away. */
function connect(n: number, edges: Edge[], rng: Rng): Edge[] {
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x]!)));
  for (const [a, b] of edges) parent[find(a)] = find(b);
  const comps = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    const list = comps.get(r) ?? [];
    list.push(i);
    comps.set(r, list);
  }
  const groups = [...comps.values()].sort((p, q) => q.length - p.length || p[0]! - q[0]!);
  const main = groups[0]!.slice();
  for (const g of groups.slice(1)) {
    edges.push([main[rng.int(main.length)]!, g[rng.int(g.length)]!]);
    main.push(...g);
  }
  return edges;
}

function generateTopology(n: number, topology: number, rng: Rng): Edge[] {
  const edges: Edge[] = [];
  if (topology === 1) {
    // Watts–Strogatz: ring lattice (k = 4) with 12% rewiring.
    const half = n >= 5 ? 2 : 1;
    for (let i = 0; i < n; i++)
      for (let j = 1; j <= half; j++) {
        let t = (i + j) % n;
        if (rng.next() < 0.12) t = rng.int(n);
        edges.push([i, t]);
      }
  } else if (topology === 2) {
    // Barabási–Albert preferential attachment (m = 2).
    const m = n > 5 ? 2 : 1;
    const pool: number[] = [];
    for (let i = 0; i <= m; i++)
      for (let j = 0; j < i; j++) {
        edges.push([j, i]);
        pool.push(i, j);
      }
    for (let i = m + 1; i < n; i++) {
      const targets = new Set<number>();
      let guard = 0;
      while (targets.size < m && guard++ < 50) targets.add(pool[rng.int(pool.length)]!);
      for (const t of targets) {
        edges.push([t, i]);
        pool.push(t, i);
      }
    }
  } else if (topology === 3) {
    // Random tree, at most 3 children per node.
    const kids = new Array<number>(n).fill(0);
    for (let i = 1; i < n; i++) {
      let p = rng.int(i);
      for (let g = 0; g < 20 && kids[p]! >= 3; g++) p = rng.int(i);
      kids[p]!++;
      edges.push([p, i]);
    }
  } else {
    // Erdős–Rényi with mean degree ≈ 3.
    const p = Math.min(1, 3 / Math.max(1, n - 1));
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (rng.next() < p) edges.push([i, j]);
  }
  return connect(n, dedupe(edges), rng);
}

/** Fruchterman–Reingold, 120 iterations, linear cooling, weak gravity. Returns centers with max |coordinate| 0.88. */
function layout(n: number, edges: Edge[], dim: number, rng: Rng): Float64Array {
  const pos = new Float64Array(n * 3);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = rng.next() - 0.5;
    pos[i * 3 + 1] = rng.next() - 0.5;
    pos[i * 3 + 2] = dim === 3 ? rng.next() - 0.5 : 0;
  }
  const k = dim === 3 ? Math.cbrt(1 / n) : Math.sqrt(1 / n);
  const k2 = k * k;
  const disp = new Float64Array(n * 3);
  const iters = 120;
  for (let it = 0; it < iters; it++) {
    disp.fill(0);
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        const dx = pos[i * 3]! - pos[j * 3]!,
          dy = pos[i * 3 + 1]! - pos[j * 3 + 1]!,
          dz = pos[i * 3 + 2]! - pos[j * 3 + 2]!;
        const d2 = Math.max(dx * dx + dy * dy + dz * dz, 1e-4);
        const f = k2 / d2; // (k²/d) along the unit vector = k²/d² · Δ
        disp[i * 3] = disp[i * 3]! + dx * f;
        disp[i * 3 + 1] = disp[i * 3 + 1]! + dy * f;
        disp[i * 3 + 2] = disp[i * 3 + 2]! + dz * f;
        disp[j * 3] = disp[j * 3]! - dx * f;
        disp[j * 3 + 1] = disp[j * 3 + 1]! - dy * f;
        disp[j * 3 + 2] = disp[j * 3 + 2]! - dz * f;
      }
    for (const [a, b] of edges) {
      const dx = pos[a * 3]! - pos[b * 3]!,
        dy = pos[a * 3 + 1]! - pos[b * 3 + 1]!,
        dz = pos[a * 3 + 2]! - pos[b * 3 + 2]!;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-9;
      const f = d / k; // (d²/k) along the unit vector
      disp[a * 3] = disp[a * 3]! - dx * f;
      disp[a * 3 + 1] = disp[a * 3 + 1]! - dy * f;
      disp[a * 3 + 2] = disp[a * 3 + 2]! - dz * f;
      disp[b * 3] = disp[b * 3]! + dx * f;
      disp[b * 3 + 1] = disp[b * 3 + 1]! + dy * f;
      disp[b * 3 + 2] = disp[b * 3 + 2]! + dz * f;
    }
    const temp = 0.12 * (1 - it / iters) + 0.002;
    for (let i = 0; i < n; i++) {
      for (let c = 0; c < 3; c++) disp[i * 3 + c] = disp[i * 3 + c]! - pos[i * 3 + c]! * 0.3;
      const len = Math.hypot(disp[i * 3]!, disp[i * 3 + 1]!, disp[i * 3 + 2]!) + 1e-9;
      const step = Math.min(len, temp) / len;
      pos[i * 3] = pos[i * 3]! + disp[i * 3]! * step;
      pos[i * 3 + 1] = pos[i * 3 + 1]! + disp[i * 3 + 1]! * step;
      pos[i * 3 + 2] = dim === 3 ? pos[i * 3 + 2]! + disp[i * 3 + 2]! * step : 0;
    }
  }
  let cx = 0,
    cy = 0,
    cz = 0;
  for (let i = 0; i < n; i++) {
    cx += pos[i * 3]!;
    cy += pos[i * 3 + 1]!;
    cz += pos[i * 3 + 2]!;
  }
  cx /= n;
  cy /= n;
  cz /= n;
  let maxN = 0;
  for (let i = 0; i < n; i++) {
    pos[i * 3] = pos[i * 3]! - cx;
    pos[i * 3 + 1] = pos[i * 3 + 1]! - cy;
    pos[i * 3 + 2] = pos[i * 3 + 2]! - cz;
    maxN = Math.max(maxN, Math.abs(pos[i * 3]!), Math.abs(pos[i * 3 + 1]!), Math.abs(pos[i * 3 + 2]!));
  }
  const s = maxN > 1e-6 ? 0.88 / maxN : 1;
  for (let i = 0; i < pos.length; i++) pos[i] = pos[i]! * s;
  return pos;
}

export const network: ShapeDefinition = {
  id: "network",
  title: "Network graph",
  doc: "Nodes as glowing balls joined by particle edges, laid out by a force simulation; topologies: random, small-world, scale-free (hubs) or tree. Explicit edges 'a-b;…' and node labels 'A|B|…' turn it into a concrete diagram; light pulses travel along edges from a to b.",
  goodFor: ["social networks", "gene regulatory networks", "the internet and routers", "food webs and ecosystems", "an agent architecture", "a map of related concepts"],
  params: [
    { key: "nodes", default: 24, min: 3, max: 80, integer: true, doc: "number of nodes (with explicit edges: taken from the highest index and the labels)" },
    { key: "topology", default: 1, min: 0, max: 3, integer: true, doc: "0 random, 1 small-world, 2 scale-free (few big hubs), 3 tree" },
    { key: "node_size", default: 0.05, min: 0.015, max: 0.12, doc: "base node radius (hubs are drawn larger)" },
    { key: "edge_density", default: 0.35, min: 0.1, max: 0.6, doc: "share of particles drawn on the edges" },
    { key: "dimension", default: 3, min: 2, max: 3, integer: true, doc: "2 = flat layout, 3 = volumetric layout" },
  ],
  expr: [
    { key: "edges", kind: "edges", default: "", maxLength: 2400, doc: "optional explicit edges 'from-to;…' with 0-based node indices, e.g. '0-1;1-2;2-0' (overrides topology)" },
    { key: "labels", kind: "labels", default: "", maxLength: 2000, doc: "optional node names 'A|B|C' in node order" },
  ],
  regions: [
    { id: "node_{i}", doc: "node i (0-based), labelled when labels are given" },
    { id: "edges", doc: "all edges" },
    { id: "hubs", doc: "aggregate of the highest-degree nodes (~10%, at least one); its children are those node_i regions" },
  ],
  motionDoc: "nodes pulse; light pulses travel along the edges",
  generate({ count, rng, params, expr }) {
    const labels = parseLabels(expr.labels);
    const dim = params.dimension! >= 2.5 ? 3 : 2;
    const nodeSize = params.node_size!;
    let edges = dedupe(parseEdges(expr.edges, 80));
    let n: number;
    const b = new PointBuilder();
    if (edges.length > 0) {
      let maxIdx = 0;
      for (const [a, c] of edges) maxIdx = Math.max(maxIdx, a, c);
      n = clamp(Math.max(maxIdx + 1, labels.length), 2, 80);
    } else {
      if (expr.edges && expr.edges.trim() !== "") b.warnings.push("no valid edges in 'edges'; generated the topology instead");
      n = clamp(Math.round(params.nodes!), 3, 80);
      edges = generateTopology(n, clamp(Math.round(params.topology!), 0, 3), createRng(`network:graph:${n}:${Math.round(params.topology!)}`));
    }
    // Fixed layout seed: the same graph keeps the same layout across beats and knob changes.
    const pos = layout(n, edges, dim, createRng(`network:layout:${n}:${dim}`));
    const deg = new Array<number>(n).fill(0);
    for (const [a, c] of edges) {
      deg[a]!++;
      deg[c]!++;
    }
    const maxDeg = Math.max(1, ...deg);
    const radius = deg.map((d) => nodeSize * (0.75 + 0.75 * Math.sqrt(d / maxDeg)));
    const hubCount = Math.max(1, Math.round(n * 0.1));
    const order = deg.map((d, i) => [d, i] as const).sort((p, q) => q[0] - p[0] || p[1] - q[1]);
    const isHub = new Array<boolean>(n).fill(false);
    for (let k = 0; k < hubCount; k++) isHub[order[k]![1]] = true;

    // `hubs` is an aggregate: its children (the hub nodes) must follow it contiguously.
    const pulse = { type: "pulse" as const, speed: 0.5 };
    b.region({ id: "hubs", motion: pulse, colorRole: "accent" });
    const nodeRegion = new Array<number>(n);
    for (let i = 0; i < n; i++) if (isHub[i]) nodeRegion[i] = b.region({ id: `node_${i}`, label: labels[i], motion: pulse, colorRole: "accent", parent: "hubs" });
    for (let i = 0; i < n; i++) if (!isHub[i]) nodeRegion[i] = b.region({ id: `node_${i}`, label: labels[i], motion: pulse, colorRole: "primary" });
    const edgeRegion = b.region({ id: "edges", motion: { type: "flow", speed: 0.6 }, colorRole: "secondary" });

    const edgeShare = edges.length > 0 ? params.edge_density! : 0;
    const [nNodes, nEdges] = allocate(count, [1 - edgeShare, edgeShare]) as [number, number];
    const nodeCounts = allocate(nNodes, radius.map((r) => r * r));
    const spans = edges.map(([a, c]) => {
      const len = Math.hypot(pos[a * 3]! - pos[c * 3]!, pos[a * 3 + 1]! - pos[c * 3 + 1]!, pos[a * 3 + 2]! - pos[c * 3 + 2]!);
      return { len, s0: Math.min(0.45, radius[a]! / Math.max(len, 1e-6)), s1: Math.max(0.55, 1 - radius[c]! / Math.max(len, 1e-6)) };
    });
    const edgeCounts = allocate(nEdges, spans.map((s) => Math.max(1e-3, s.len * (s.s1 - s.s0))));

    const d = [0, 0, 0];
    for (let i = 0; i < n; i++) {
      const r = radius[i]!;
      const x0 = pos[i * 3]!,
        y0 = pos[i * 3 + 1]!,
        z0 = pos[i * 3 + 2]!;
      for (let k = 0; k < nodeCounts[i]!; k++) {
        rng.dir(d);
        const rr = r * Math.pow(rng.next(), 0.5);
        b.push(x0 + d[0]! * rr, y0 + d[1]! * rr, z0 + d[2]! * rr, nodeRegion[i]!, deg[i]! / maxDeg, isHub[i] ? 1.2 : 1);
      }
    }
    const jit = 0.0035;
    edges.forEach(([a, c], e) => {
      const { s0, s1 } = spans[e]!;
      for (let k = 0; k < edgeCounts[e]!; k++) {
        const s = s0 + (s1 - s0) * rng.next();
        b.push(
          pos[a * 3]! + (pos[c * 3]! - pos[a * 3]!) * s + rng.normal() * jit,
          pos[a * 3 + 1]! + (pos[c * 3 + 1]! - pos[a * 3 + 1]!) * s + rng.normal() * jit,
          pos[a * 3 + 2]! + (pos[c * 3 + 2]! - pos[a * 3 + 2]!) * s + rng.normal() * jit,
          edgeRegion,
          s,
          0.7,
        );
      }
    });
    return b.build(count, rng);
  },
};
