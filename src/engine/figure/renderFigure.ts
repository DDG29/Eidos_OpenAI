import type { CameraPreset, Layer, PaletteId } from "@/lib/world/types";
import { composeScene } from "../compile/compose";
import { PRESETS } from "../camera/CameraRig";
import { DUST_REGION } from "../types";

/**
 * Static figure of a beat without WebGL (reading mode, posters, no-WebGL fallback): compose the layers at a
 * modest particle count, project with the beat's camera angles and splat additively into an RGB buffer.
 */
export interface FigureOptions {
  layers: Layer[];
  palette: PaletteId;
  camera: CameraPreset;
  front: boolean;
  width: number;
  height: number;
  count?: number;
  seed: string;
  background?: [number, number, number];
}

export function renderFigurePixels(o: FigureOptions): Uint8ClampedArray {
  const { width: W, height: H } = o;
  const buf = composeScene({ layers: o.layers, palette: o.palette, count: o.count ?? 26000, dustFraction: 0.04, seed: o.seed });
  const p = PRESETS[o.camera] ?? PRESETS.orbit_close;
  const az = ((o.front ? 0 : p.azim) * Math.PI) / 180;
  const el = ((o.front ? 3 : Math.max(-30, Math.min(60, p.elev))) * Math.PI) / 180;
  const [cx, cy, cz] = buf.bounds.center;
  const R = Math.max(0.3, buf.bounds.radius);
  const ca = Math.cos(az),
    sa = Math.sin(az),
    ce = Math.cos(el),
    se = Math.sin(el);
  const scale = (Math.min(W, H) * 0.42) / R;
  const acc = new Float32Array(W * H * 3);
  const dist = 3.2 * R;
  for (let i = 0; i < buf.count; i++) {
    const dust = buf.regionIds[i] === DUST_REGION;
    let x = buf.positions[i * 4]! - cx,
      y = buf.positions[i * 4 + 1]! - cy,
      z = buf.positions[i * 4 + 2]! - cz;
    // yaw then pitch (camera orbiting the target)
    const x1 = ca * x - sa * z;
    const z1 = sa * x + ca * z;
    const y2 = ce * y - se * z1;
    const z2 = se * y + ce * z1;
    x = x1;
    y = y2;
    z = z2;
    const persp = dist / Math.max(0.2, dist - z);
    const px = W / 2 + x * scale * persp;
    const py = H / 2 - y * scale * persp;
    if (px < 1 || py < 1 || px >= W - 1 || py >= H - 1) continue;
    const a = (buf.colors[i * 4 + 3]! / 255) * (dust ? 0.5 : 1) * 0.16 * buf.aux[i * 4 + 3]!;
    const r = (buf.colors[i * 4]! / 255) ** 2.2 * a,
      g = (buf.colors[i * 4 + 1]! / 255) ** 2.2 * a,
      b = (buf.colors[i * 4 + 2]! / 255) ** 2.2 * a;
    const ix = px | 0,
      iy = py | 0;
    // 2×2 splat with bilinear weights keeps thin forms continuous at low counts
    const fx = px - ix,
      fy = py - iy;
    const ws = [(1 - fx) * (1 - fy), fx * (1 - fy), (1 - fx) * fy, fx * fy];
    const idx = [iy * W + ix, iy * W + ix + 1, (iy + 1) * W + ix, (iy + 1) * W + ix + 1];
    for (let k = 0; k < 4; k++) {
      const j = idx[k]! * 3;
      acc[j] = acc[j]! + r * ws[k]!;
      acc[j + 1] = acc[j + 1]! + g * ws[k]!;
      acc[j + 2] = acc[j + 2]! + b * ws[k]!;
    }
  }
  const out = new Uint8ClampedArray(W * H * 4);
  const bg = o.background ?? [4, 5, 10];
  for (let i = 0; i < W * H; i++) {
    for (let c = 0; c < 3; c++) {
      const v = 1 - Math.exp(-acc[i * 3 + c]! * 6); // soft exposure curve
      out[i * 4 + c] = Math.min(255, bg[c]! + 255 * Math.pow(v, 1 / 2.2));
    }
    out[i * 4 + 3] = 255;
  }
  return out;
}
