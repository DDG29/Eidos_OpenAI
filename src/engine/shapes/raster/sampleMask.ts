import type { Rng } from "../../util/rng";

/**
 * Sample `n` points uniformly from the set pixels of a mask (indices into a w×h raster). Points are jittered
 * inside their pixel and mapped so the raster's longer side spans [-1, 1] (y up).
 */
export function samplePixels(
  rng: Rng,
  indices: Uint32Array,
  w: number,
  h: number,
  n: number,
  each: (x: number, y: number, px: number, py: number, pixelIndex: number) => void,
) {
  if (indices.length === 0) return;
  const s = 2 / Math.max(w, h);
  for (let k = 0; k < n; k++) {
    const idx = indices[rng.int(indices.length)]!;
    const px = idx % w;
    const py = (idx / w) | 0;
    const x = (px + rng.next() - w / 2) * s;
    const y = -(py + rng.next() - h / 2) * s;
    each(x, y, px, py, idx);
  }
}
