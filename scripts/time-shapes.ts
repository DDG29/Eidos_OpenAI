import { createRng } from "../src/engine/util/rng";
import { PALETTES } from "../src/engine/palettes";
import { createRasterHelper } from "../src/engine/shapes/raster/helper";
import { listShapes } from "../src/engine/shapes/registry";
import { loadFontsFromDisk } from "../src/test/fonts";

loadFontsFromDisk();
for (const def of listShapes()) {
  const params: Record<string, number> = {};
  for (const p of def.params) params[p.key] = p.default;
  const expr: Record<string, string> = {};
  for (const e of def.expr) expr[e.key] = e.default;
  const data = def.data ? Array.from({ length: Math.max(def.data.minLength, 6) }, (_, i) => i + 1) : [];
  const t0 = performance.now();
  def.generate({ count: 160000, rng: createRng(def.id), params, expr, data, raster: createRasterHelper(null), palette: PALETTES.aurora, seed: "x" });
  console.log(def.id.padEnd(12), (performance.now() - t0).toFixed(1), "ms");
}
