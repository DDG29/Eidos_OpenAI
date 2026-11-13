import { generateLayer } from "@/engine/compile/compose";
import type { Layer, PaletteId } from "@/lib/world/types";

/** Region ids a layer really produces (small deterministic generation). Fonts must be loaded first. */
export function probeRegions(layer: Layer, palette: PaletteId = "aurora"): string[] {
  const { out } = generateLayer(layer, 3000, palette, "probe", null);
  return out.regions.map((r) => r.id);
}

const cache = new Map<string, string[]>();
export function probeRegionsCached(layer: Layer, palette: PaletteId = "aurora"): string[] {
  const key = JSON.stringify([layer.shape, layer.params, layer.expr, layer.data]);
  let hit = cache.get(key);
  if (!hit) {
    hit = probeRegions(layer, palette);
    cache.set(key, hit);
    if (cache.size > 500) cache.delete(cache.keys().next().value as string);
  }
  return hit;
}
