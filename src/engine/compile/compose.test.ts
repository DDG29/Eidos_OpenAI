import { beforeAll, describe, expect, it } from "vitest";
import type { Layer } from "@/lib/world/types";
import { loadFontsFromDisk } from "@/test/fonts";
import { DUST_REGION } from "../types";
import { composeScene } from "./compose";
import { pairOrder, permuteBuffer, slotRandoms, staggerDelays } from "./pairing";

beforeAll(() => loadFontsFromDisk());

const layer = (shape: Layer["shape"], extra: Partial<Layer> = {}): Layer => ({
  shape,
  params: [],
  expr: [],
  data: [],
  share: 1,
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  scale: 1,
  colorMode: "palette",
  tint: "primary",
  ...extra,
});

describe("composeScene", () => {
  it("fills exactly N with the requested dust and normalizes shares", () => {
    const N = 20000;
    const buf = composeScene({ layers: [layer("sphere", { share: 0.8 }), layer("helix", { share: 0.8, position: { x: 1, y: 0, z: 0 } })], palette: "aurora", count: N, dustFraction: 0.06, seed: "c" });
    expect(buf.count).toBe(N);
    let dust = 0;
    for (let i = 0; i < N; i++) if (buf.regionIds[i] === DUST_REGION) dust++;
    expect(dust).toBe(Math.round(N * 0.06));
    for (let i = 0; i < buf.positions.length; i++) expect(Number.isFinite(buf.positions[i]!)).toBe(true);
    const layers = new Set(buf.regions.map((r) => r.layerIndex));
    expect(layers).toEqual(new Set([0, 1]));
  });
  it("turns unused share into dust", () => {
    const N = 10000;
    const buf = composeScene({ layers: [layer("sphere", { share: 0.5 })], palette: "magma", count: N, dustFraction: 0.06, seed: "d" });
    let dust = 0;
    for (let i = 0; i < N; i++) if (buf.regionIds[i] === DUST_REGION) dust++;
    expect(dust).toBeGreaterThan(N * 0.4);
  });
  it("falls back to nebula for an unknown shape and reports it", () => {
    const buf = composeScene({ layers: [layer("doesNotExist" as Layer["shape"])], palette: "aurora", count: 5000, dustFraction: 0.06, seed: "e" });
    expect(buf.warnings.join(" ")).toMatch(/nebula/);
  });
  it("computes region centroids and aggregate parent ranges", () => {
    const buf = composeScene({ layers: [layer("text", { expr: [{ key: "content", value: "AB" }] })], palette: "tinta", count: 8000, dustFraction: 0.06, seed: "f" });
    const glyphs = buf.regions.find((r) => r.id === "glyphs")!;
    expect(glyphs.range).toBeDefined();
    const a = buf.regions.find((r) => r.id === "char_0")!;
    const b = buf.regions.find((r) => r.id === "char_1")!;
    expect(a.centroid[0]).toBeLessThan(b.centroid[0]);
  });
});

describe("pairing", () => {
  const N = 16384;
  const A = composeScene({ layers: [layer("sphere")], palette: "aurora", count: N, dustFraction: 0.06, seed: "A" });
  const B = composeScene({ layers: [layer("helix")], palette: "aurora", count: N, dustFraction: 0.06, seed: "B" });
  const travel = (perm: Uint32Array) => {
    let s = 0;
    for (let j = 0; j < N; j++) {
      const k = perm[j]!;
      s += Math.hypot(A.positions[j * 4]! - B.positions[k * 4]!, A.positions[j * 4 + 1]! - B.positions[k * 4 + 1]!, A.positions[j * 4 + 2]! - B.positions[k * 4 + 2]!);
    }
    return s / N;
  };
  it("returns a valid permutation", () => {
    const perm = pairOrder(A, B, "flow", "s");
    const seen = new Uint8Array(N);
    for (const k of perm) seen[k] = 1;
    expect(seen.every((v) => v === 1)).toBe(true);
  });
  it("coherent pairing travels < 60% of random pairing", () => {
    const coherent = travel(pairOrder(A, B, "flow", "s"));
    const random = travel(pairOrder(A, B, "explode", "s"));
    expect(coherent / random).toBeLessThan(0.6);
  });
  it("permutes buffers consistently and computes delays in [0,1]", () => {
    const perm = pairOrder(A, B, "rain", "s");
    const P = permuteBuffer(B, perm);
    expect(P.regionIds[0]).toBe(B.regionIds[perm[0]!]);
    for (const t of ["flow", "swirl", "explode", "fold", "rain", "dissolve"] as const) {
      const d = staggerDelays(P, t, slotRandoms(N));
      for (const v of d) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });
});
