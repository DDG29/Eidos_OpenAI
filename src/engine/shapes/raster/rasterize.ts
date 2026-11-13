import type { Polyline } from "./svgPath";

export interface Mask {
  width: number;
  height: number;
  data: Uint8Array; // 1 = inside
}

/** Non-zero winding scanline fill of closed polylines into a width×height mask (pixel centers). */
export function fillPolylines(polys: readonly Polyline[], width: number, height: number): Mask {
  const data = new Uint8Array(width * height);
  type Edge = { x0: number; y0: number; x1: number; y1: number; dir: number };
  const edges: Edge[] = [];
  for (const pl of polys) {
    const pts = pl.points;
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const a = pts[i]!;
      const b = pts[(i + 1) % n]!; // implicitly close every subpath for filling
      if (a[1] === b[1]) continue;
      if (a[1] < b[1]) edges.push({ x0: a[0], y0: a[1], x1: b[0], y1: b[1], dir: 1 });
      else edges.push({ x0: b[0], y0: b[1], x1: a[0], y1: a[1], dir: -1 });
    }
  }
  const xs: { x: number; d: number }[] = [];
  for (let y = 0; y < height; y++) {
    const sy = y + 0.5;
    xs.length = 0;
    for (const e of edges) {
      if (sy >= e.y0 && sy < e.y1) {
        const t = (sy - e.y0) / (e.y1 - e.y0);
        xs.push({ x: e.x0 + t * (e.x1 - e.x0), d: e.dir });
      }
    }
    if (xs.length < 2) continue;
    xs.sort((p, q) => p.x - q.x);
    let wind = 0;
    for (let k = 0; k < xs.length - 1; k++) {
      wind += xs[k]!.d;
      if (wind !== 0) {
        const xa = Math.max(0, Math.ceil(xs[k]!.x - 0.5));
        const xb = Math.min(width - 1, Math.floor(xs[k + 1]!.x - 0.5));
        const row = y * width;
        for (let x = xa; x <= xb; x++) data[row + x] = 1;
      }
    }
  }
  return { width, height, data };
}

/** Stroke polylines with a disc brush (outline mode). */
export function strokePolylines(polys: readonly Polyline[], width: number, height: number, radius: number): Mask {
  const data = new Uint8Array(width * height);
  const r = Math.max(0.5, radius);
  const r2 = r * r;
  for (const pl of polys) {
    const pts = pl.points;
    const segs = pl.closed ? pts.length : pts.length - 1;
    for (let i = 0; i < segs; i++) {
      const a = pts[i]!;
      const b = pts[(i + 1) % pts.length]!;
      const minX = Math.max(0, Math.floor(Math.min(a[0], b[0]) - r));
      const maxX = Math.min(width - 1, Math.ceil(Math.max(a[0], b[0]) + r));
      const minY = Math.max(0, Math.floor(Math.min(a[1], b[1]) - r));
      const maxY = Math.min(height - 1, Math.ceil(Math.max(a[1], b[1]) + r));
      const dx = b[0] - a[0],
        dy = b[1] - a[1];
      const len2 = dx * dx + dy * dy || 1;
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const px = x + 0.5 - a[0],
            py = y + 0.5 - a[1];
          const t = Math.max(0, Math.min(1, (px * dx + py * dy) / len2));
          const ex = px - t * dx,
            ey = py - t * dy;
          if (ex * ex + ey * ey <= r2) data[y * width + x] = 1;
        }
      }
    }
  }
  return { width, height, data };
}

/** Two-pass chamfer (3-4) distance to the nearest outside pixel, in pixels. */
export function distanceInside(mask: Mask): Float32Array {
  const { width: w, height: h, data } = mask;
  const INF = 1e9;
  const d = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) d[i] = data[i] ? INF : 0;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[y * w + x]!);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!d[i]) continue;
      d[i] = Math.min(d[i]!, at(x - 1, y) + 3, at(x, y - 1) + 3, at(x - 1, y - 1) + 4, at(x + 1, y - 1) + 4);
    }
  for (let y = h - 1; y >= 0; y--)
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (!d[i]) continue;
      d[i] = Math.min(d[i]!, at(x + 1, y) + 3, at(x, y + 1) + 3, at(x + 1, y + 1) + 4, at(x - 1, y + 1) + 4);
    }
  for (let i = 0; i < w * h; i++) d[i] = d[i]! / 3;
  return d;
}

/** Pixels on the mask boundary (inside pixels with an outside 4-neighbour). */
export function boundaryOf(mask: Mask): Uint8Array {
  const { width: w, height: h, data } = mask;
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!data[i]) continue;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1 || !data[i - 1] || !data[i + 1] || !data[i - w] || !data[i + w]) out[i] = 1;
    }
  return out;
}

export function maskIndices(data: Uint8Array): Uint32Array {
  let n = 0;
  for (let i = 0; i < data.length; i++) if (data[i]) n++;
  const out = new Uint32Array(n);
  let k = 0;
  for (let i = 0; i < data.length; i++) if (data[i]) out[k++] = i;
  return out;
}

/** Fit polylines (any coordinate space) into a size×size raster with padding; returns transformed copies. */
export function fitPolylines(polys: readonly Polyline[], width: number, height: number, pad = 8): { polys: Polyline[]; scale: number } {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of polys)
    for (const [x, y] of p.points) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  const bw = maxX - minX || 1,
    bh = maxY - minY || 1;
  const s = Math.min((width - 2 * pad) / bw, (height - 2 * pad) / bh);
  const ox = (width - bw * s) / 2 - minX * s;
  const oy = (height - bh * s) / 2 - minY * s;
  return {
    scale: s,
    polys: polys.map((p) => ({ closed: p.closed, points: p.points.map(([x, y]) => [x * s + ox, y * s + oy] as [number, number]) })),
  };
}
