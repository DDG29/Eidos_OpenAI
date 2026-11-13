import type { ColorRole, ShapeId } from "@/lib/world/types";
import type { Palette } from "../palettes";
import type { MotionType } from "../types";
import type { Rng } from "../util/rng";
import type { FontWeight } from "./raster/fonts";
import type { Polyline } from "./raster/svgPath";

/** Shape generator contract (spec §6.1). The registry built from these is the single source of truth. */

export interface ParamSpec {
  key: string;
  default: number;
  min: number;
  max: number;
  integer?: boolean;
  doc: string;
  /** The parameter directly sets the overall size (e.g. sphere radius); tests scale the extent check by it. */
  scalesExtent?: boolean;
}

export type ExprKind = "paramath" | "svgpath" | "text" | "molecule" | "edges" | "labels";

export interface ExprSpec {
  key: string;
  kind: ExprKind;
  default: string;
  maxLength: number;
  doc: string;
  /** ParaMath variables available to this expression (besides i, n, a, b, c). */
  vars?: string[];
}

export interface RegionSpec {
  id: string; // may be a pattern: "bar_{i}"
  doc: string;
  /** Only produced under some parameter values (documented in `doc`). */
  conditional?: boolean;
}

export interface ImageLike {
  width: number;
  height: number;
  data: Uint8ClampedArray; // RGBA
}

export interface RasterHelper {
  text(content: string, weight: FontWeight): { chars: { char: string; polys: Polyline[] }[]; ok: boolean };
  image: ImageLike | null;
}

export interface ShapeContext {
  count: number;
  rng: Rng;
  params: Record<string, number>;
  expr: Record<string, string>;
  data: number[];
  raster: RasterHelper;
  palette: Palette;
  /** stable seed string for this layer (ParaMath noise, etc.) */
  seed: string;
}

export interface ShapeRegionOut {
  id: string;
  label?: string;
  motion: { type: MotionType; speed: number };
  colorRole?: ColorRole;
  /** Aggregate region this one belongs to (e.g. char_3 → glyphs). Children must be declared right after it. */
  parent?: string;
}

export interface ShapeOutput {
  positions: Float32Array; // count*3
  motionParam: Float32Array; // count
  regionLocal: Uint16Array; // count
  regions: ShapeRegionOut[];
  colors?: Float32Array; // count*3 optional (linear-ish sRGB 0..1)
  sizes?: Float32Array; // count optional (1 = normal)
  warnings?: string[];
}

export interface ShapeDefinition {
  id: ShapeId;
  title: string;
  doc: string;
  goodFor: string[];
  params: ParamSpec[];
  expr: ExprSpec[];
  data?: { doc: string; minLength: number; maxLength: number };
  regions: RegionSpec[];
  /** one-line human description of default motion, for the catalog */
  motionDoc: string;
  generate(ctx: ShapeContext): ShapeOutput;
}
