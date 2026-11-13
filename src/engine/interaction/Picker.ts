import * as THREE from "three";
import { DUST_REGION, MOTION_TYPES, type RegionInfo, type ShapeBuffer } from "../types";

/**
 * Click → region (spec 5.10.1): project every k-th non-dust particle (with the rigid part of its motion
 * replicated in JS) and pick the nearest within 28 px.
 */
export interface PickResult {
  regionIndex: number;
  region: RegionInfo;
  worldPoint: THREE.Vector3;
  screen: { x: number; y: number };
}

export function motionAngle(type: number, speed: number, param: number, t: number, r: number): number {
  // rotate (1), differential (2), orbit (7) are the motions that move particles far enough to matter.
  if (type === 1) return t * speed;
  if (type === 2) return t * speed * 0.6 + (0.35 * Math.sin(t * speed * 0.3)) / Math.sqrt(Math.max(r, 0.05));
  if (type === 7) return (t * speed) / Math.max(param, 0.2);
  return 0;
}

const v = new THREE.Vector3();

/** Apply the shader's rigid motion approximately (rotY around the layer pivot; orbit tilt ignored). */
export function movedPosition(buf: ShapeBuffer, i: number, t: number, pivots: [number, number, number][], out: THREE.Vector3): THREE.Vector3 {
  const px = buf.positions[i * 4]!,
    py = buf.positions[i * 4 + 1]!,
    pz = buf.positions[i * 4 + 2]!,
    param = buf.positions[i * 4 + 3]!;
  const packed = buf.aux[i * 4]! + 0.5;
  const type = Math.floor(packed % 8);
  const layer = Math.floor(packed / 8);
  const speed = buf.aux[i * 4 + 1]!;
  const pv = pivots[layer] ?? [0, 0, 0];
  const qx = px - pv[0],
    qz = pz - pv[2];
  const a = motionAngle(type, speed, param, t, Math.hypot(qx, qz));
  if (a === 0) return out.set(px, py, pz);
  // three.js-style rotY used by the shader's mat3 (column-major): x' = c·x + s·z, z' = −s·x + c·z
  const c = Math.cos(a),
    s = Math.sin(a);
  return out.set(c * qx + s * qz + pv[0], py, -s * qx + c * qz + pv[2]);
}

export function pick(
  buf: ShapeBuffer,
  camera: THREE.Camera,
  width: number,
  height: number,
  sx: number,
  sy: number,
  time: number,
  pivots: [number, number, number][],
  maxDist = 28,
): PickResult | null {
  const k = Math.max(1, Math.floor(buf.count / 12000));
  let best = -1;
  let bestD = maxDist * maxDist;
  const tmp = new THREE.Vector3();
  for (let i = 0; i < buf.count; i += k) {
    const r = buf.regionIds[i]!;
    if (r === DUST_REGION) continue;
    movedPosition(buf, i, time, pivots, tmp);
    v.copy(tmp).project(camera);
    if (v.z > 1 || v.z < -1) continue;
    const x = ((v.x + 1) / 2) * width;
    const y = ((1 - v.y) / 2) * height;
    const d = (x - sx) ** 2 + (y - sy) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  if (best < 0) return null;
  const regionIndex = buf.regionIds[best]!;
  const region = buf.regions[regionIndex];
  if (!region) return null;
  const wp = movedPosition(buf, best, time, pivots, new THREE.Vector3());
  v.copy(wp).project(camera);
  return { regionIndex, region, worldPoint: wp, screen: { x: ((v.x + 1) / 2) * width, y: ((1 - v.y) / 2) * height } };
}

export { MOTION_TYPES };
