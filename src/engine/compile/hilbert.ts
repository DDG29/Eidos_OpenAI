/**
 * 3D Hilbert curve index (Skilling, "Programming the Hilbert curve", 2004) with `bits` bits per axis.
 * Neighbouring indices are neighbouring cells, which is what makes coherent particle pairing work (spec 5.8).
 */
export function hilbert3(x: number, y: number, z: number, bits = 10): number {
  const X = [x >>> 0, y >>> 0, z >>> 0];
  const M = 1 << (bits - 1);
  // Inverse undo excess work
  for (let Q = M; Q > 1; Q >>>= 1) {
    const P = Q - 1;
    for (let i = 0; i < 3; i++) {
      if (X[i]! & Q) X[0] = X[0]! ^ P;
      else {
        const t = (X[0]! ^ X[i]!) & P;
        X[0] = X[0]! ^ t;
        X[i] = X[i]! ^ t;
      }
    }
  }
  // Gray encode
  for (let i = 1; i < 3; i++) X[i] = X[i]! ^ X[i - 1]!;
  let t = 0;
  for (let Q = M; Q > 1; Q >>>= 1) if (X[2]! & Q) t ^= Q - 1;
  for (let i = 0; i < 3; i++) X[i] = X[i]! ^ t;
  // Interleave transposed bits into one integer (x is most significant within each triple).
  let h = 0;
  for (let b = bits - 1; b >= 0; b--) {
    h = h * 8 + (((X[0]! >>> b) & 1) << 2) + (((X[1]! >>> b) & 1) << 1) + ((X[2]! >>> b) & 1);
  }
  return h;
}

/** Hilbert keys for `n` xyz points (stride `stride`), normalized to their own bounding box. */
export function hilbertKeys(pos: Float32Array, n: number, stride: number, bits = 10, mask?: (i: number) => boolean): Float64Array {
  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity,
    maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity;
  for (let i = 0; i < n; i++) {
    if (mask && !mask(i)) continue;
    const x = pos[i * stride]!,
      y = pos[i * stride + 1]!,
      z = pos[i * stride + 2]!;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  if (!Number.isFinite(minX)) {
    minX = minY = minZ = -1;
    maxX = maxY = maxZ = 1;
  }
  const side = (1 << bits) - 1;
  const sx = side / (maxX - minX || 1),
    sy = side / (maxY - minY || 1),
    sz = side / (maxZ - minZ || 1);
  const keys = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const qx = Math.max(0, Math.min(side, Math.round((pos[i * stride]! - minX) * sx)));
    const qy = Math.max(0, Math.min(side, Math.round((pos[i * stride + 1]! - minY) * sy)));
    const qz = Math.max(0, Math.min(side, Math.round((pos[i * stride + 2]! - minZ) * sz)));
    keys[i] = hilbert3(qx, qy, qz, bits);
  }
  return keys;
}

/** argsort of keys (stable, fast): packs key·2^18 + index into a Float64 and uses the native numeric sort. */
export function argsort(keys: Float64Array | number[], n = keys.length): Uint32Array {
  // 30-bit key + 1 group bit + 18-bit index = 49 bits < 2^53.
  if (n > 1 << 18) throw new Error("argsort supports up to 262144 items");
  const packed = new Float64Array(n);
  for (let i = 0; i < n; i++) packed[i] = keys[i]! * 262144 + i;
  packed.sort();
  const out = new Uint32Array(n);
  for (let i = 0; i < n; i++) out[i] = packed[i]! % 262144;
  return out;
}
