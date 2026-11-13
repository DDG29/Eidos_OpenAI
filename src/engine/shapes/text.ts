import { boundaryOf, distanceInside, fillPolylines, fitPolylines, maskIndices } from "./raster/rasterize";
import { samplePixels } from "./raster/sampleMask";
import { PointBuilder } from "./helpers";
import type { ShapeDefinition } from "./types";

export const TEXT_ALLOWED = /^[\p{L}\p{N}\s.,;:!?¿¡'"()+\-=×÷*/^%<>·•…°_ⁿ²³¹⁰⁴⁵⁶⁷⁸⁹αβγδεζηθικλμνξοπρστυφχψωΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ]*$/u;

export const text: ShapeDefinition = {
  id: "text",
  title: "Particle text",
  doc: "Short text written in particles with the display typeface, extruded in depth. Titles, key terms, short formulas, a single number.",
  goodFor: ["a key term", "the word EIDOS", "a short formula like E = mc²", "a striking number", "a three-word recap"],
  params: [
    { key: "depth", default: 0.08, min: 0, max: 0.4, doc: "extrusion depth" },
    { key: "weight", default: 1, min: 0, max: 1, integer: true, doc: "0 = body typeface, 1 = display typeface" },
  ],
  expr: [{ key: "content", kind: "text", default: "EIDOS", maxLength: 24, doc: "the text, max 24 characters (letters, digits, basic punctuation, basic Greek, ² ³)" }],
  regions: [
    { id: "glyphs", doc: "all letters" },
    { id: "char_{i}", doc: "each character by position (0-based, spaces count)" },
  ],
  motionDoc: "still",
  generate({ count, rng, params, expr, raster }) {
    const content = (expr.content ?? "EIDOS").slice(0, 24) || "EIDOS";
    const weight = params.weight! >= 0.5 ? "display" : "body";
    const depth = params.depth!;
    const b = new PointBuilder();
    const res = raster.text(content, weight);
    if (!res.ok || res.chars.length === 0) {
      b.warnings.push("fonts not loaded for text shape");
      return b.build(count, rng);
    }
    const W = 1024;
    // Fit all glyph outlines together, then rasterize each character into the same frame.
    const all = res.chars.flatMap((c) => c.polys);
    let minY = Infinity,
      maxY = -Infinity,
      minX = Infinity,
      maxX = -Infinity;
    for (const p of all)
      for (const [x, y] of p.points) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    const aspect = (maxY - minY || 1) / (maxX - minX || 1);
    const H = Math.max(64, Math.min(1024, Math.round(W * aspect) + 24));
    b.region({ id: "glyphs", motion: { type: "none", speed: 0 }, colorRole: "primary" });
    const masks: { id: number; indices: Uint32Array; dist: Float32Array; edge: Uint8Array }[] = [];
    let total = 0;
    const fitted = fitPolylines(all, W, H, 12);
    let offset = 0;
    res.chars.forEach((c, ci) => {
      const polys = fitted.polys.slice(offset, offset + c.polys.length);
      offset += c.polys.length;
      if (polys.length === 0) return;
      const mask = fillPolylines(polys, W, H);
      const indices = maskIndices(mask.data);
      if (indices.length === 0) return;
      const id = b.region({ id: `char_${ci}`, label: c.char, motion: { type: "none", speed: 0 }, colorRole: "primary", parent: "glyphs" });
      masks.push({ id, indices, dist: distanceInside(mask), edge: boundaryOf(mask) });
      total += indices.length;
    });
    if (total === 0) return b.build(count, rng);
    for (const m of masks) {
      const n = Math.round((count * m.indices.length) / total);
      samplePixels(rng, m.indices, W, H, n, (x, y, _px, _py, idx) => {
        const edgeBoost = m.edge[idx] ? 1 : 0;
        const z = (rng.next() - 0.5) * depth * (edgeBoost ? 1 : 0.85);
        b.push(x, y, z, m.id, Math.min(1, m.dist[idx]! / 12), edgeBoost ? 1.1 : 1);
      });
    }
    return b.build(count, rng);
  },
};
