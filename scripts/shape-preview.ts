// Render a shape generator to a PNG with three orthographic views (front XY, side ZY, top XZ).
// Usage: tsx scripts/shape-preview.ts <shapeId> ['{"param":value}'] ['{"expr":"..."}'] ['[data]'] [count]
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { createRng } from "../src/engine/util/rng";
import { PALETTES, paletteGradient } from "../src/engine/palettes";
import { createRasterHelper } from "../src/engine/shapes/raster/helper";
import type { ShapeDefinition } from "../src/engine/shapes/types";
import { loadFontsFromDisk } from "../src/test/fonts";

const [id, paramsJson = "{}", exprJson = "{}", dataJson = "", countArg = "60000"] = process.argv.slice(2);
if (!id) {
  console.error("usage: tsx scripts/shape-preview.ts <shapeId> [params] [expr] [data] [count]");
  process.exit(1);
}
loadFontsFromDisk();
const mod = (await import(`../src/engine/shapes/${id}.ts`)) as Record<string, ShapeDefinition>;
const def = Object.values(mod).find((v) => v && typeof v === "object" && "generate" in v);
if (!def) throw new Error(`no ShapeDefinition exported from shapes/${id}.ts`);
const params: Record<string, number> = Object.fromEntries(def.params.map((p) => [p.key, p.default]));
Object.assign(params, JSON.parse(paramsJson));
const expr: Record<string, string> = Object.fromEntries(def.expr.map((e) => [e.key, e.default]));
Object.assign(expr, JSON.parse(exprJson));
const data: number[] = dataJson ? JSON.parse(dataJson) : def.data ? Array.from({ length: Math.max(def.data.minLength, 6) }, (_, i) => ((i * 37) % 11) / 10 + 0.1) : [];
const count = Number(countArg);
const t0 = performance.now();
const out = def.generate({ count, rng: createRng(`${id}:preview`), params, expr, data, raster: createRasterHelper(null), palette: PALETTES.aurora, seed: "preview" });
const ms = performance.now() - t0;

const S = 420;
const W = S * 3;
const img = new Float32Array(W * S * 3);
const views: [number, number][] = [
  [0, 1],
  [2, 1],
  [0, 2],
];
const regionColors = out.regions.map((_, i) => paletteGradient(PALETTES.aurora, out.regions.length > 1 ? i / (out.regions.length - 1) : 0.5));
for (let i = 0; i < count; i++) {
  const c = regionColors[out.regionLocal[i]!] ?? [1, 1, 1];
  for (let v = 0; v < 3; v++) {
    const [ax, ay] = views[v]!;
    const x = out.positions[i * 3 + ax]!;
    const y = out.positions[i * 3 + ay]!;
    const px = Math.round(v * S + S / 2 + x * S * 0.42);
    const py = Math.round(S / 2 - y * S * 0.42);
    if (px < v * S || px >= (v + 1) * S || py < 0 || py >= S) continue;
    const k = (py * W + px) * 3;
    img[k] = img[k]! + c[0] * 0.12;
    img[k + 1] = img[k + 1]! + c[1] * 0.12;
    img[k + 2] = img[k + 2]! + c[2] * 0.12;
  }
}
const bytes = Buffer.alloc(W * S * 3);
for (let i = 0; i < img.length; i++) bytes[i] = Math.min(255, Math.round(255 * (1 - Math.exp(-img[i]! * 1.6))));
mkdirSync("qa/shapes", { recursive: true });
const file = `qa/shapes/${id}.png`;
await sharp(bytes, { raw: { width: W, height: S, channels: 3 } }).png().toFile(file);
let ext = 0;
for (const v of out.positions) ext = Math.max(ext, Math.abs(v));
console.log(JSON.stringify({ file, ms: Math.round(ms), count, extent: +ext.toFixed(3), regions: out.regions.map((r) => r.id), warnings: out.warnings ?? [] }));
