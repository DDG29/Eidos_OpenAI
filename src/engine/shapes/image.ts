import { paletteGradient } from "../palettes";
import { allocate, clamp, PointBuilder } from "./helpers";
import type { ImageLike, ShapeDefinition } from "./types";
import type { Rng } from "../util/rng";

/** Images are scanned on a grid of at most ~512² cells, whatever their resolution. */
const MAX_CELLS = 262144;

/** Rounded-rectangle signed distance (negative inside). */
function sdRoundRect(x: number, y: number, hx: number, hy: number, r: number) {
  const qx = Math.abs(x) - hx + r,
    qy = Math.abs(y) - hy + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

/** Deterministic stand-in when the session has no image: the universal "photo" icon (frame, hills, sun). */
function placeholder(b: PointBuilder, region: number, count: number, rng: Rng) {
  const HX = 1,
    HY = 0.75;
  const [nFrame, nHills, nSun, nWash] = allocate(count, [0.45, 0.33, 0.12, 0.1]) as [number, number, number, number];
  const hill = (x: number) => Math.max(-0.45 + 0.75 * Math.exp(-(((x + 0.25) / 0.38) ** 2)), -0.3 + 0.45 * Math.exp(-(((x - 0.45) / 0.3) ** 2)));
  let made = 0;
  for (let g = 0; made < nFrame && g < nFrame * 40; g++) {
    const x = rng.range(-HX, HX),
      y = rng.range(-HY, HY);
    const d = sdRoundRect(x, y, HX, HY, 0.12);
    if (d > 0 || d < -0.05) continue;
    b.push(x, y, (rng.next() - 0.5) * 0.04, region, 1, 1.1);
    made++;
  }
  made = 0;
  for (let g = 0; made < nHills && g < nHills * 40; g++) {
    const x = rng.range(-0.86, 0.86),
      y = rng.range(-0.62, 0.4);
    if (y > hill(x)) continue;
    b.push(x, y, (rng.next() - 0.5) * 0.06, region, 0.6, 0.9);
    made++;
  }
  for (let k = 0; k < nSun; k++) {
    const a = rng.next() * Math.PI * 2,
      r = 0.13 * Math.sqrt(rng.next());
    b.push(0.52 + Math.cos(a) * r, 0.38 + Math.sin(a) * r, (rng.next() - 0.5) * 0.05, region, 0.9, 1);
  }
  for (let k = 0; k < nWash; k++) b.push(rng.range(-0.86, 0.86), rng.range(-0.62, 0.62), (rng.next() - 0.5) * 0.06, region, 0.2, 0.5);
}

export const image: ShapeDefinition = {
  id: "image",
  title: "Image to particles",
  doc: "The user's uploaded photo (Photo mode) turned into particles, keeping its colours (mixed 50% with the palette) and pushing brighter areas forward in depth. The spec only says shape 'image'; the session image is used, and without one the layer falls back to a nebula.",
  goodFor: ["the user's photo dissolving into light", "a photographed whiteboard (invert = 1)", "a hand-drawn diagram from a notebook", "the opening scene of a photo-based world"],
  params: [
    { key: "threshold", default: 0.15, min: 0, max: 0.9, doc: "minimum luminance sampled (with invert: minimum darkness relative to the background)" },
    { key: "depth", default: 0.25, min: 0, max: 1, doc: "how far bright (or, inverted, dark) pixels come forward" },
    { key: "invert", default: 0, min: 0, max: 1, integer: true, doc: "1 = sample dark ink on a light background (whiteboards, paper)" },
  ],
  expr: [],
  regions: [{ id: "image", doc: "the whole picture" }],
  motionDoc: "still",
  generate({ count, rng, params, raster, palette }) {
    const b = new PointBuilder();
    const region = b.region({ id: "image", motion: { type: "none", speed: 0 }, colorRole: "primary" });
    const img: ImageLike | null = raster.image;
    if (!img || img.width < 2 || img.height < 2 || img.data.length < img.width * img.height * 4) {
      b.warnings.push("no session image; drew a placeholder photo frame");
      placeholder(b, region, count, rng);
      return b.build(count, rng);
    }
    const threshold = params.threshold!;
    const depth = params.depth!;
    const invert = params.invert! >= 0.5;
    const stride = Math.max(1, Math.ceil(Math.sqrt((img.width * img.height) / MAX_CELLS)));
    const gw = Math.floor(img.width / stride),
      gh = Math.floor(img.height / stride);
    const lum = new Float32Array(gw * gh);
    const alpha = new Uint8Array(gw * gh);
    const hist = new Uint32Array(256);
    for (let gy = 0; gy < gh; gy++)
      for (let gx = 0; gx < gw; gx++) {
        const p = ((gy * stride + (stride >> 1)) * img.width + gx * stride + (stride >> 1)) * 4;
        const l = (0.2126 * img.data[p]! + 0.7152 * img.data[p + 1]! + 0.0722 * img.data[p + 2]!) / 255;
        const c = gy * gw + gx;
        lum[c] = l;
        alpha[c] = img.data[p + 3]! >= 128 ? 1 : 0;
        if (alpha[c]) hist[Math.min(255, Math.round(l * 255))]!++;
      }
    // Inverted mode measures darkness against the paper/board white (90th percentile), so lighting does not matter.
    let bg = 1;
    if (invert) {
      let total = 0;
      for (const h of hist) total += h;
      let acc = 0;
      for (let i = 0; i < 256; i++) {
        acc += hist[i]!;
        if (acc >= total * 0.9) {
          bg = Math.max(0.05, i / 255);
          break;
        }
      }
    }
    const value = (c: number) => (invert ? clamp((bg - lum[c]!) / bg, 0, 1) : lum[c]!);
    const pickCells = (thr: number) => {
      const cells: number[] = [];
      for (let c = 0; c < gw * gh; c++) if (alpha[c] && value(c) >= thr) cells.push(c);
      return cells;
    };
    let cells = pickCells(threshold);
    if (cells.length === 0) {
      b.warnings.push("no pixels pass the image threshold; sampling the whole image");
      cells = pickCells(0);
    }
    if (cells.length === 0) {
      b.warnings.push("image is fully transparent; drew a placeholder photo frame");
      placeholder(b, region, count, rng);
      return b.build(count, rng);
    }
    // Brighter (or inkier) cells get more particles: cumulative weights + binary search.
    const cum = new Float64Array(cells.length);
    let acc = 0;
    for (let k = 0; k < cells.length; k++) {
      acc += 0.25 + value(cells[k]!);
      cum[k] = acc;
    }
    const s = 2 / Math.max(gw, gh);
    for (let i = 0; i < count; i++) {
      const target = rng.next() * acc;
      let lo = 0,
        hi = cells.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (cum[mid]! < target) lo = mid + 1;
        else hi = mid;
      }
      const c = cells[lo]!;
      const gx = c % gw,
        gy = (c / gw) | 0;
      const v = value(c);
      const p = ((gy * stride + (stride >> 1)) * img.width + gx * stride + (stride >> 1)) * 4;
      const pal = paletteGradient(palette, 0.1 + 0.8 * v);
      const col: [number, number, number] = [
        0.5 * (img.data[p]! / 255) + 0.5 * pal[0],
        0.5 * (img.data[p + 1]! / 255) + 0.5 * pal[1],
        0.5 * (img.data[p + 2]! / 255) + 0.5 * pal[2],
      ];
      b.push((gx + rng.next() - gw / 2) * s, -(gy + rng.next() - gh / 2) * s, (v - 0.5) * depth * 0.8 + (rng.next() - 0.5) * 0.01, region, v, 0.8 + 0.4 * v, col);
    }
    return b.build(count, rng);
  },
};
