import { boundaryOf, fillPolylines, fitPolylines, maskIndices, strokePolylines, type Mask } from "./raster/rasterize";
import { samplePixels } from "./raster/sampleMask";
import { polylinesFromPath, type Polyline } from "./raster/svgPath";
import { allocate, PointBuilder } from "./helpers";
import type { ShapeDefinition } from "./types";

/** An original leaf: outline with a stem, plus midrib and side veins cut out as opposite-winding slits. */
export const DEFAULT_GLYPH_PATH =
  "M50 4 C66 14 84 34 82 58 C80 78 66 90 52 92 L52 99 L48 99 L48 92 C34 90 20 78 18 58 C16 34 34 14 50 4 Z " +
  "M49.3 14 L49.3 88 L50.7 88 L50.7 14 Z " +
  "M51.8 33.4 L51.8 34.6 L68 24.5 L68 23.5 Z M48.2 33.4 L32 23.5 L32 24.5 L48.2 34.6 Z " +
  "M51.8 49.4 L51.8 50.6 L74 38.5 L74 37.5 Z M48.2 49.4 L26 37.5 L26 38.5 L48.2 50.6 Z " +
  "M51.8 65.4 L51.8 66.6 L74 55.5 L74 54.5 Z M48.2 65.4 L26 54.5 L26 55.5 L48.2 66.6 Z " +
  "M51.8 79.4 L51.8 80.6 L66 72.5 L66 71.5 Z M48.2 79.4 L34 71.5 L34 72.5 L48.2 80.6 Z";

const W = 512;

/**
 * Chamfer (3-4) distance to the nearest outside pixel, in pixels — same result as rasterize.distanceInside,
 * but on a zero-padded grid without per-pixel closures (≈6× faster at 512², which matters at 160k points).
 */
function chamferInside(mask: Mask): Float32Array {
  const { width: w, height: h, data } = mask;
  const pw = w + 2;
  const d = new Float32Array(pw * (h + 2));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (data[y * w + x]) d[(y + 1) * pw + x + 1] = 1e9;
  for (let y = 1; y <= h; y++)
    for (let x = 1; x <= w; x++) {
      const i = y * pw + x;
      if (d[i] === 0) continue;
      d[i] = Math.min(d[i]!, d[i - 1]! + 3, d[i - pw]! + 3, d[i - pw - 1]! + 4, d[i - pw + 1]! + 4);
    }
  for (let y = h; y >= 1; y--)
    for (let x = w; x >= 1; x--) {
      const i = y * pw + x;
      if (d[i] === 0) continue;
      d[i] = Math.min(d[i]!, d[i + 1]! + 3, d[i + pw]! + 3, d[i + pw + 1]! + 4, d[i + pw - 1]! + 4);
    }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[y * w + x] = d[(y + 1) * pw + x + 1]! / 3;
  return out;
}

export const glyph: ShapeDefinition = {
  id: "glyph",
  title: "SVG silhouette",
  doc: "Any silhouette drawn as an SVG path in a 0–100 box, filled and/or outlined with particles and puffed into a soft 3D pillow. Draw your own simple original shapes (a leaf, a heart organ, a tool, a country outline); never logos, brands or copyrighted characters.",
  goodFor: ["a leaf or a flower", "an organ such as a stylized heart", "a country or region outline", "a tool or everyday object", "an animal silhouette (e.g. an axolotl)", "a book or a lightbulb"],
  params: [
    { key: "mode", default: 0, min: 0, max: 2, integer: true, doc: "0 fill, 1 outline only, 2 fill + outline" },
    { key: "depth", default: 0.12, min: 0, max: 0.6, doc: "flat extrusion thickness" },
    { key: "inflate", default: 0.5, min: 0, max: 1, doc: "pillow bulge from the edge inward (0 = flat slab)" },
  ],
  expr: [
    {
      key: "path",
      kind: "svgpath",
      default: DEFAULT_GLYPH_PATH,
      maxLength: 6000,
      doc: "SVG path 'd' in a 0–100 × 0–100 box (y down), commands M L H V C S Q T A Z only; holes use opposite winding; open strokes are drawn as lines",
    },
  ],
  regions: [
    { id: "fill", doc: "the filled silhouette (mode 0 or 2)", conditional: true },
    { id: "outline", doc: "the contour line (mode 1 or 2)", conditional: true },
  ],
  motionDoc: "slow pulse",
  generate({ count, rng, params, expr }) {
    const b = new PointBuilder();
    const mode = Math.round(params.mode!);
    const depth = params.depth!;
    const inflate = params.inflate!;
    let parsed = polylinesFromPath(expr.path ?? "", 16);
    if (!parsed.ok || parsed.polylines.length === 0) {
      b.warnings.push(`invalid glyph path (${parsed.error ?? "draws nothing"}); using the default leaf`);
      parsed = polylinesFromPath(DEFAULT_GLYPH_PATH, 16);
    }
    let polys: Polyline[] = fitPolylines(parsed.polylines, W, W, 16).polys;
    let fillMask = fillPolylines(polys, W, W);
    let fillIdx = maskIndices(fillMask.data);
    const strokeMask = () => strokePolylines(polys, W, W, 2.2);
    if (fillIdx.length < 400) {
      // A line drawing with no area: fill the thickened strokes instead.
      fillMask = strokePolylines(polys, W, W, 6);
      fillIdx = maskIndices(fillMask.data);
      if (fillIdx.length === 0) {
        b.warnings.push("glyph path covers no pixels; using the default leaf");
        polys = fitPolylines(polylinesFromPath(DEFAULT_GLYPH_PATH, 16).polylines, W, W, 16).polys;
        fillMask = fillPolylines(polys, W, W);
        fillIdx = maskIndices(fillMask.data);
      }
    }
    const pulse = { type: "pulse" as const, speed: 0.25 };
    const fillId = mode !== 1 ? b.region({ id: "fill", motion: pulse, colorRole: "primary" }) : -1;
    const outlineId = mode !== 0 ? b.region({ id: "outline", motion: pulse, colorRole: "glow" }) : -1;
    const [nFill, nOutline] = allocate(count, [fillId >= 0 ? (outlineId >= 0 ? 0.72 : 1) : 0, outlineId >= 0 ? (fillId >= 0 ? 0.28 : 1) : 0]) as [number, number];
    const px = 2 / W; // pixel → canonical units (samplePixels maps the raster to [-1, 1])

    if (fillId >= 0) {
      const dist = chamferInside(fillMask);
      const edge = boundaryOf(fillMask);
      let dMax = 0;
      for (const i of fillIdx) dMax = Math.max(dMax, dist[i]!);
      const dMaxW = Math.max(dMax * px, 1e-6);
      samplePixels(rng, fillIdx, W, W, nFill, (x, y, _px, _py, idx) => {
        // Pillow: a quarter-circle profile from the edge to the deepest interior point.
        const d = Math.min(dist[idx]! * px, dMaxW);
        const half = depth / 2 + inflate * 0.9 * Math.sqrt(Math.max(0, d * (2 * dMaxW - d)));
        const z = rng.next() < 0.75 ? (rng.next() < 0.5 ? -half : half) : (rng.next() * 2 - 1) * half;
        b.push(x, y, z + rng.normal() * 0.003, fillId, d / dMaxW, edge[idx] ? 1.1 : 1);
      });
    }
    if (outlineId >= 0) {
      const sMask = strokeMask();
      const sIdx = maskIndices(sMask.data);
      samplePixels(rng, sIdx, W, W, nOutline, (x, y) => {
        b.push(x, y, (rng.next() * 2 - 1) * (depth / 2) + rng.normal() * 0.004, outlineId, 0, 1.15);
      });
    }
    return b.build(count, rng);
  },
};
