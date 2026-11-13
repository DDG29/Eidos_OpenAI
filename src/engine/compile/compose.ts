import type { ColorMode, ColorRole, Layer, PaletteId } from "@/lib/world/types";
import { hexToRgb, PALETTES, paletteGradient, type Palette, type RGB } from "../palettes";
import { createRasterHelper } from "../shapes/raster/helper";
import { getShape, resolveExpr, resolveParams } from "../shapes/registry";
import { nebula } from "../shapes/nebula";
import { sanitize } from "../shapes/helpers";
import type { ImageLike, ShapeDefinition, ShapeOutput } from "../shapes/types";
import { DUST_REGION, motionIndex, type RegionInfo, type ShapeBuffer } from "../types";
import { createRng } from "../util/rng";

export interface ComposeInput {
  layers: Layer[];
  palette: PaletteId;
  count: number;
  dustFraction: number;
  seed: string;
  image?: ImageLike | null;
}

export const MAX_LAYERS = 3;

/** Per-particle aux.r packs motion type (0–7) and layer index (0–3): type + 8·layer. Layer 3 = dust. */
export const DUST_LAYER = 3;

function roleRgb(p: Palette, role: ColorRole): RGB {
  return hexToRgb(p[role]);
}

function luminanceJitter(c: RGB, f: number): RGB {
  return [Math.min(1, c[0] * f), Math.min(1, c[1] * f), Math.min(1, c[2] * f)];
}

export function rotationMatrix(deg: { x: number; y: number; z: number }): number[] {
  const [a, b, c] = [deg.x, deg.y, deg.z].map((d) => (d * Math.PI) / 180) as [number, number, number];
  const ca = Math.cos(a),
    sa = Math.sin(a),
    cb = Math.cos(b),
    sb = Math.sin(b),
    cc = Math.cos(c),
    sc = Math.sin(c);
  // R = Rz · Ry · Rx (Euler XYZ, intrinsic)
  return [cb * cc, sa * sb * cc - ca * sc, ca * sb * cc + sa * sc, cb * sc, sa * sb * sc + ca * cc, ca * sb * sc - sa * cc, -sb, sa * cb, ca * cb];
}

export interface LayerResult {
  out: ShapeOutput;
  def: ShapeDefinition;
  warnings: string[];
}

/** Generate one layer, falling back to `nebula` on errors or non-finite output (spec 5.15). */
export function generateLayer(layer: Layer, count: number, paletteId: PaletteId, seed: string, image: ImageLike | null): LayerResult {
  const warnings: string[] = [];
  let def = getShape(layer.shape);
  if (!def) {
    warnings.push(`unknown shape '${layer.shape}', replaced by nebula`);
    def = nebula;
  }
  if (def.id === "image" && !image) {
    warnings.push("image shape without a session image, replaced by nebula");
    def = nebula;
  }
  const palette = PALETTES[paletteId] ?? PALETTES.aurora;
  const { params, unknown } = resolveParams(def, layer.params ?? []);
  if (unknown.length) warnings.push(`${def.id}: unknown params ${unknown.join(", ")}`);
  const { expr } = resolveExpr(def, layer.expr ?? []);
  let data = Array.isArray(layer.data) ? layer.data.filter((v) => Number.isFinite(v)) : [];
  if (def.data) data = data.slice(0, def.data.maxLength);
  const rng = createRng(`${seed}:${def.id}`);
  const ctx = { count, rng, params, expr, data, raster: createRasterHelper(image), palette, seed };
  try {
    const out = def.generate(ctx);
    let bad = out.positions.length !== count * 3;
    if (!bad)
      for (let i = 0; i < out.positions.length; i += 97)
        if (!Number.isFinite(out.positions[i]!)) {
          bad = true;
          break;
        }
    if (bad) throw new Error("non-finite or wrong-size output");
    if (out.warnings?.length) warnings.push(...out.warnings.map((w) => `${def.id}: ${w}`));
    return { out, def, warnings };
  } catch (e) {
    warnings.push(`${def.id} failed (${e instanceof Error ? e.message : "error"}); replaced by nebula`);
    const fb = nebula.generate({ ...ctx, params: { scale: 1.2, density_contrast: 0.6, filaments: 0.5 }, rng: createRng(`${seed}:fallback`) });
    return { out: fb, def: nebula, warnings };
  }
}

function colorFor(mode: ColorMode, palette: Palette, tint: ColorRole, role: ColorRole | undefined, ny: number, nr: number, rnd: number): RGB {
  switch (mode) {
    case "region":
      return roleRgb(palette, role ?? "primary");
    case "radial":
      return paletteGradientBetween(roleRgb(palette, "glow"), roleRgb(palette, "secondary"), nr);
    case "height":
      return paletteGradientBetween(roleRgb(palette, "primary"), roleRgb(palette, "accent"), ny);
    case "single":
      return luminanceJitter(roleRgb(palette, tint), 0.9 + 0.2 * rnd);
    case "palette":
    default:
      return paletteGradient(palette, ny * 0.85 + rnd * 0.15);
  }
}

function paletteGradientBetween(a: RGB, b: RGB, t: number): RGB {
  const u = Math.min(1, Math.max(0, t));
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
}

/** Compose a beat's layers + ambient dust into a ShapeBuffer (spec 5.7). */
export function composeScene(input: ComposeInput): ShapeBuffer {
  const N = input.count;
  const palette = PALETTES[input.palette] ?? PALETTES.aurora;
  const layers = input.layers.slice(0, MAX_LAYERS);
  const warnings: string[] = [];
  if (input.layers.length > MAX_LAYERS) warnings.push(`only the first ${MAX_LAYERS} layers are used`);
  const dustBase = Math.round(N * input.dustFraction);
  const avail = N - dustBase;
  let shares = layers.map((l) => (Number.isFinite(l.share) ? Math.max(0, l.share) : 0));
  let sum = shares.reduce((s, v) => s + v, 0);
  if (sum <= 0 && layers.length) {
    shares = layers.map(() => 1 / layers.length);
    sum = 1;
  }
  if (sum > 1) shares = shares.map((s) => s / sum);
  const counts = shares.map((s) => Math.round(avail * s));
  // keep at least 8% of particles per layer so nothing disappears
  for (let i = 0; i < counts.length; i++) counts[i] = Math.max(counts[i]!, Math.round(avail * 0.08));
  let used = counts.reduce((s, v) => s + v, 0);
  if (used > avail && counts.length) {
    counts[counts.length - 1] = Math.max(0, counts[counts.length - 1]! - (used - avail));
    used = counts.reduce((s, v) => s + v, 0);
  }
  const dust = N - used;

  const positions = new Float32Array(N * 4);
  const aux = new Float32Array(N * 4);
  const colors = new Uint8Array(N * 4);
  const regionIds = new Uint16Array(N);
  const regions: RegionInfo[] = [];
  const rnd = createRng(`${input.seed}:compose`);

  let o = 0;
  layers.forEach((layer, li) => {
    const n = counts[li]!;
    if (n <= 0) return;
    const { out, warnings: w } = generateLayer(layer, n, input.palette, `${input.seed}:L${li}`, input.image ?? null);
    warnings.push(...w);
    sanitize(out.positions, 50);
    const R = rotationMatrix(layer.rotation ?? { x: 0, y: 0, z: 0 });
    const sc = Math.min(2, Math.max(0.2, Number.isFinite(layer.scale) ? layer.scale : 1));
    const pos = layer.position ?? { x: 0, y: 0, z: 0 };
    const px = clampPos(pos.x),
      py = clampPos(pos.y),
      pz = clampPos(pos.z);
    // Region table for this layer (global indices). Parents get child ranges.
    const base = regions.length;
    out.regions.forEach((r, ri) => {
      regions.push({
        index: base + ri,
        id: r.id,
        label: r.label,
        layerIndex: li,
        centroid: [0, 0, 0],
        radius: 0,
        count: 0,
        motion: r.motion,
        colorRole: r.colorRole ?? "primary",
        parent: r.parent,
      } as RegionInfo);
    });
    // canonical y-extent for palette/height colouring
    let minY = Infinity,
      maxY = -Infinity,
      maxR = 0;
    for (let i = 0; i < n; i++) {
      const y = out.positions[i * 3 + 1]!;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      maxR = Math.max(maxR, Math.hypot(out.positions[i * 3]!, y, out.positions[i * 3 + 2]!));
    }
    const hy = maxY - minY || 1;
    for (let i = 0; i < n; i++) {
      const x = out.positions[i * 3]!,
        y = out.positions[i * 3 + 1]!,
        z = out.positions[i * 3 + 2]!;
      const j = o + i;
      positions[j * 4] = (R[0]! * x + R[1]! * y + R[2]! * z) * sc + px;
      positions[j * 4 + 1] = (R[3]! * x + R[4]! * y + R[5]! * z) * sc + py;
      positions[j * 4 + 2] = (R[6]! * x + R[7]! * y + R[8]! * z) * sc + pz;
      positions[j * 4 + 3] = out.motionParam[i]!;
      const rl = out.regionLocal[i]!;
      const reg = out.regions[rl] ?? out.regions[0]!;
      const gid = base + Math.min(rl, out.regions.length - 1);
      regionIds[j] = gid;
      aux[j * 4] = motionIndex(reg.motion.type) + 8 * li;
      aux[j * 4 + 1] = reg.motion.speed;
      aux[j * 4 + 2] = gid / 65535;
      const r = rnd.next();
      aux[j * 4 + 3] = (out.sizes ? out.sizes[i]! : 1) * (0.8 + 0.4 * r);
      let c: RGB;
      if (out.colors && out.colors[i * 3]! >= 0) c = [out.colors[i * 3]!, out.colors[i * 3 + 1]!, out.colors[i * 3 + 2]!];
      else c = colorFor(layer.colorMode, palette, layer.tint ?? "primary", reg.colorRole, (y - minY) / hy, Math.hypot(x, y, z) / (maxR || 1), r);
      colors[j * 4] = Math.round(c[0] * 255);
      colors[j * 4 + 1] = Math.round(c[1] * 255);
      colors[j * 4 + 2] = Math.round(c[2] * 255);
      colors[j * 4 + 3] = 255;
    }
    o += n;
  });

  // Scene bounds (without dust): center = mean, radius = 96th percentile distance.
  let cx = 0,
    cy = 0,
    cz = 0;
  for (let i = 0; i < o; i++) {
    cx += positions[i * 4]!;
    cy += positions[i * 4 + 1]!;
    cz += positions[i * 4 + 2]!;
  }
  if (o > 0) {
    cx /= o;
    cy /= o;
    cz /= o;
  }
  // bbox center is visually better than the mean for asymmetric layouts
  let bx0 = Infinity,
    by0 = Infinity,
    bz0 = Infinity,
    bx1 = -Infinity,
    by1 = -Infinity,
    bz1 = -Infinity;
  for (let i = 0; i < o; i++) {
    const x = positions[i * 4]!,
      y = positions[i * 4 + 1]!,
      z = positions[i * 4 + 2]!;
    if (x < bx0) bx0 = x;
    if (x > bx1) bx1 = x;
    if (y < by0) by0 = y;
    if (y > by1) by1 = y;
    if (z < bz0) bz0 = z;
    if (z > bz1) bz1 = z;
  }
  if (o > 0) {
    cx = (bx0 + bx1) / 2;
    cy = (by0 + by1) / 2;
    cz = (bz0 + bz1) / 2;
  }
  const sampleStep = Math.max(1, Math.floor(o / 6000));
  const dists: number[] = [];
  for (let i = 0; i < o; i += sampleStep) dists.push(Math.hypot(positions[i * 4]! - cx, positions[i * 4 + 1]! - cy, positions[i * 4 + 2]! - cz));
  dists.sort((a, b) => a - b);
  const radius = Math.max(0.25, dists[Math.floor(dists.length * 0.96)] ?? 1);

  // Ambient dust (spec 5.7 step 5)
  const dustColor = hexToRgb(palette.secondary);
  const dirv = [0, 0, 0];
  for (let k = 0; k < dust; k++) {
    const j = o + k;
    rnd.dir(dirv);
    const rr = radius * 2.6 * Math.pow(rnd.next(), 0.75) + radius * 0.4;
    positions[j * 4] = cx + dirv[0]! * rr;
    positions[j * 4 + 1] = cy + dirv[1]! * rr * 0.7;
    positions[j * 4 + 2] = cz + dirv[2]! * rr;
    positions[j * 4 + 3] = 0;
    regionIds[j] = DUST_REGION;
    aux[j * 4] = motionIndex("thermal") + 8 * DUST_LAYER;
    aux[j * 4 + 1] = 0.05;
    aux[j * 4 + 2] = 1;
    aux[j * 4 + 3] = 0.55 + 0.5 * rnd.next();
    colors[j * 4] = Math.round(dustColor[0] * 255);
    colors[j * 4 + 1] = Math.round(dustColor[1] * 255);
    colors[j * 4 + 2] = Math.round(dustColor[2] * 255);
    colors[j * 4 + 3] = Math.round(0.35 * 255);
  }

  computeRegionStats(positions, regionIds, regions, o);
  return { count: N, positions, aux, colors, regionIds, regions, bounds: { center: [cx, cy, cz], radius }, warnings };
}

function clampPos(v: number | undefined) {
  return Math.min(2.5, Math.max(-2.5, Number.isFinite(v) ? (v as number) : 0));
}

export function computeRegionStats(positions: Float32Array, regionIds: Uint16Array, regions: RegionInfo[], n: number) {
  const sums = new Float64Array(regions.length * 3);
  const counts = new Uint32Array(regions.length);
  for (let i = 0; i < n; i++) {
    const r = regionIds[i]!;
    if (r === DUST_REGION || r >= regions.length) continue;
    sums[r * 3] = sums[r * 3]! + positions[i * 4]!;
    sums[r * 3 + 1] = sums[r * 3 + 1]! + positions[i * 4 + 1]!;
    sums[r * 3 + 2] = sums[r * 3 + 2]! + positions[i * 4 + 2]!;
    counts[r] = counts[r]! + 1;
  }
  regions.forEach((reg, r) => {
    const c = counts[r]!;
    reg.count = c;
    if (c > 0) reg.centroid = [sums[r * 3]! / c, sums[r * 3 + 1]! / c, sums[r * 3 + 2]! / c];
  });
  // Parent (aggregate) regions: centroid of children, contiguous index range.
  regions.forEach((reg) => {
    const kids = regions.filter((k) => k.parent === reg.id && k.layerIndex === reg.layerIndex);
    if (!kids.length) return;
    let total = 0;
    const cen: [number, number, number] = [0, 0, 0];
    for (const k of kids) {
      cen[0] += k.centroid[0] * k.count;
      cen[1] += k.centroid[1] * k.count;
      cen[2] += k.centroid[2] * k.count;
      total += k.count;
    }
    if (total > 0) reg.centroid = [cen[0] / total, cen[1] / total, cen[2] / total];
    reg.count = total;
    reg.range = [reg.index, Math.max(...kids.map((k) => k.index))];
  });
  // radius: 90th percentile distance to centroid (sampled)
  const rad = regions.map(() => [] as number[]);
  const step = Math.max(1, Math.floor(n / 20000));
  for (let i = 0; i < n; i += step) {
    const r = regionIds[i]!;
    if (r === DUST_REGION || r >= regions.length) continue;
    const c = regions[r]!.centroid;
    rad[r]!.push(Math.hypot(positions[i * 4]! - c[0], positions[i * 4 + 1]! - c[1], positions[i * 4 + 2]! - c[2]));
  }
  regions.forEach((reg, r) => {
    const d = rad[r]!.sort((a, b) => a - b);
    reg.radius = d.length ? d[Math.floor(d.length * 0.9)]! : 0.05;
  });
}
