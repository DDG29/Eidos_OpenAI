import { allocate, clamp, parseLabels, PointBuilder } from "./helpers";
import type { ShapeDefinition } from "./types";

const DEFAULT_VALUES = [3, 5, 2, 6, 4];

/**
 * Bar heights in [-1, 1] as a fraction of the full bar height. `absolute` = softmax probabilities on a fixed
 * 0–1 axis (so the mass visibly concentrates or spreads as the temperature changes).
 */
export function barHeights(values: readonly number[], temperature: number, logScale: boolean): { heights: number[]; absolute: boolean; warnings: string[] } {
  const warnings: string[] = [];
  let v = values.slice();
  let absolute = false;
  if (temperature > 0) {
    // data are logits → softmax(data / T); heights are probabilities (1 = full height).
    const z = v.map((x) => x / temperature);
    const m = Math.max(...z);
    const e = z.map((x) => Math.exp(x - m));
    const sum = e.reduce((s, x) => s + x, 0) || 1;
    v = e.map((x) => x / sum);
    absolute = true;
  }
  if (logScale) {
    const pos = v.filter((x) => x > 0);
    if (pos.length < v.length) warnings.push("log scale: values ≤ 0 are drawn as empty bars");
    if (pos.length === 0) return { heights: v.map(() => 0), absolute: false, warnings };
    const vmax = Math.max(...pos);
    // Axis floor one decade below the smallest positive value, so the smallest bar is still visible.
    const floor = Math.max(Math.min(...pos) / 10, vmax * 1e-6);
    const span = Math.log10(vmax / floor);
    return { heights: v.map((x) => (x > 0 ? clamp(Math.log10(x / floor) / span, 0, 1) : 0)), absolute: false, warnings };
  }
  if (absolute) return { heights: v, absolute, warnings };
  const m = Math.max(...v.map(Math.abs));
  return { heights: v.map((x) => (m > 0 ? x / m : 0)), absolute, warnings };
}

export const bars: ShapeDefinition = {
  id: "bars",
  title: "3D bar chart",
  doc: "A row of 3D bars for 1–24 values (normalized to the largest), with an optional baseline axis and labels. temperature > 0 treats the data as logits and shows softmax probabilities (a language-model temperature knob); reveal grows the bars left to right (a time knob). Values must come from cited facts.",
  goodFor: ["comparing quantities", "growth over the years", "a probability distribution", "LLM sampling temperature (softmax)", "survey or poll results", "a histogram from the source"],
  params: [
    { key: "depth", default: 0.15, min: 0.02, max: 0.5, doc: "bar depth (z)" },
    { key: "gap", default: 0.25, min: 0, max: 0.8, doc: "gap between bars as a fraction of each slot" },
    { key: "log_scale", default: 0, min: 0, max: 1, integer: true, doc: "1 = logarithmic heights (values spanning orders of magnitude)" },
    { key: "baseline", default: 1, min: 0, max: 1, integer: true, doc: "1 = draw the baseline axis with ticks" },
    { key: "temperature", default: 0, min: 0, max: 3, doc: "0 = off; > 0 = data are logits, bars show softmax(data / temperature) as probabilities on a 0–1 axis" },
    { key: "reveal", default: 1, min: 0, max: 1, doc: "fraction of bars shown, growing left to right (hidden bars lie flat on the baseline)" },
  ],
  expr: [{ key: "labels", kind: "labels", default: "", maxLength: 1200, doc: "optional bar names 'A|B|C' in data order" }],
  data: { doc: "the values, 1–24 numbers (negatives hang below the baseline)", minLength: 1, maxLength: 24 },
  regions: [
    { id: "bar_{i}", doc: "bar i in data order, labelled when labels are given; the tallest bar uses the accent colour" },
    { id: "axis", doc: "baseline with one tick per bar (baseline = 1)", conditional: true },
  ],
  motionDoc: "still",
  generate({ count, rng, params, expr, data }) {
    const b = new PointBuilder();
    let values = data.filter((v) => Number.isFinite(v)).slice(0, 24);
    if (values.length === 0) {
      b.warnings.push("bars without data; showing placeholder values");
      values = DEFAULT_VALUES.slice();
    }
    const labels = parseLabels(expr.labels);
    const { heights, absolute, warnings } = barHeights(values, params.temperature!, params.log_scale! >= 0.5);
    b.warnings.push(...warnings);
    const n = heights.length;
    const depth = params.depth!;
    const gap = params.gap!;
    const withAxis = params.baseline! >= 0.5;
    const reveal = params.reveal!;

    const slot = Math.min(1.88 / n, 0.45);
    const width = slot * (1 - gap) + 0.004;
    const x0 = (-n * slot) / 2;
    const hMax = absolute ? 1 : Math.max(0, ...heights),
      hMin = Math.min(0, ...heights);
    // Map [hMin, hMax] (span 1..2) onto y ∈ [-0.8, 0.8].
    const k = 1.6 / Math.max(hMax - hMin, 1e-6);
    const y0 = -0.8 - hMin * k;
    let tallest = 0;
    heights.forEach((h, i) => {
      if (h > heights[tallest]!) tallest = i;
    });

    const regionIds = heights.map((_, i) =>
      b.region({ id: `bar_${i}`, label: labels[i], motion: { type: "none", speed: 0 }, colorRole: i === tallest && n > 1 ? "accent" : "primary" }),
    );
    const axis = withAxis ? b.region({ id: "axis", motion: { type: "none", speed: 0 }, colorRole: "glow" }) : -1;
    // Allocation ignores `reveal` so each bar keeps its particles while the knob turns (smooth morphs).
    const [nBars, nAxis] = allocate(count, [withAxis ? 0.93 : 1, withAxis ? 0.07 : 0]) as [number, number];
    const barCounts = allocate(nBars, heights.map((h) => 0.06 + Math.abs(h) * k * 0.6));

    const hz = depth / 2;
    heights.forEach((h, i) => {
      const vis = clamp(reveal * n - i, 0, 1);
      const xa = x0 + i * slot + (slot - width) / 2,
        xb = xa + width;
      const top = y0 + h * k * vis;
      const ya = Math.min(y0, top),
        yb = Math.max(y0, top);
      const H = yb - ya;
      const region = regionIds[i]!;
      const flat = H < 0.004;
      // Face areas: front/back (w·H), sides (d·H), top/bottom (w·d); front and top weighted up for legibility.
      const faces = flat ? [0, 0, 0, 1] : [1.3 * width * H, width * H, 2 * depth * H, 1.4 * width * depth + 0.6 * width * depth];
      const faceTotal = faces.reduce((s, f) => s + f, 0);
      for (let q = 0; q < barCounts[i]!; q++) {
        const mpY = rng.next();
        let x: number, y: number, z: number;
        if (rng.next() < (flat ? 0 : 0.22)) {
          // Wireframe edges: the 4 vertical edges and the top rim.
          const e = rng.int(8);
          if (e < 4) {
            x = e & 1 ? xb : xa;
            z = e & 2 ? hz : -hz;
            y = ya + H * mpY;
          } else {
            y = h >= 0 ? yb : ya;
            if (e < 6) {
              x = xa + width * rng.next();
              z = e === 4 ? hz : -hz;
            } else {
              x = e === 6 ? xa : xb;
              z = -hz + depth * rng.next();
            }
          }
        } else {
          let f = rng.next() * faceTotal;
          let face = 0;
          while (face < 3 && f > faces[face]!) f -= faces[face++]!;
          x = xa + width * rng.next();
          y = ya + H * mpY;
          z = -hz + depth * rng.next();
          if (face === 0) z = hz;
          else if (face === 1) z = -hz;
          else if (face === 2) x = rng.next() < 0.5 ? xa : xb;
          else y = flat ? y0 + 0.002 : rng.next() < 0.7 ? (h >= 0 ? yb : ya) : h >= 0 ? ya : yb;
        }
        b.push(x, y, z, region, flat ? 0 : (y - ya) / (H || 1), flat ? 0.4 : 1);
      }
    });
    if (axis >= 0) {
      const xa = x0 - 0.06,
        xb = -x0 + 0.06;
      const nTicks = Math.round(nAxis * 0.25);
      for (let q = 0; q < nAxis - nTicks; q++) b.push(xa + (xb - xa) * rng.next(), y0 - 0.012 + rng.normal() * 0.003, hz + 0.01 + rng.normal() * 0.003, axis, 0, 0.9);
      for (let q = 0; q < nTicks; q++) {
        const i = q % n;
        b.push(x0 + (i + 0.5) * slot + rng.normal() * 0.002, y0 - 0.012 - 0.04 * rng.next(), hz + 0.01, axis, 0, 0.9);
      }
    }
    return b.build(count, rng);
  },
};
