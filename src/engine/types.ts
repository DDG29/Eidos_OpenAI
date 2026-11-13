import type { ColorRole } from "@/lib/world/types";

export const MOTION_TYPES = ["none", "rotate", "differential", "wave", "pulse", "thermal", "flow", "orbit"] as const;
export type MotionType = (typeof MOTION_TYPES)[number];
export const motionIndex = (m: MotionType): number => MOTION_TYPES.indexOf(m);

export const DUST_REGION = 65535;

export interface RegionInfo {
  /** global region index inside the ShapeBuffer */
  index: number;
  id: string;
  label?: string;
  layerIndex: number;
  centroid: [number, number, number];
  radius: number;
  count: number;
  motion: { type: MotionType; speed: number };
  colorRole: ColorRole;
  /** Aggregate region id this region belongs to */
  parent?: string;
  /** For aggregate regions: inclusive range of child region indices (contiguous). */
  range?: [number, number];
}

/** Composed particle set for one beat (spec 5.7). All arrays are length N or N*4. */
export interface ShapeBuffer {
  count: number;
  positions: Float32Array; // N*4 xyz + motionParam
  aux: Float32Array; // N*4 motionType, speed, regionNorm, size
  colors: Uint8Array; // N*4 rgba
  regionIds: Uint16Array; // N
  regions: RegionInfo[];
  bounds: { center: [number, number, number]; radius: number };
  warnings: string[];
}
