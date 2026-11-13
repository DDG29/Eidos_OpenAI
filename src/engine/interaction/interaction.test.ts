import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { layoutLabels, overlaps } from "./AnnotationLayout";
import { pick } from "./Picker";
import { composeScene } from "../compile/compose";
import { makeLayer } from "@/lib/world/layer";

describe("annotation layout", () => {
  it("separates overlapping labels and keeps them on screen", () => {
    const labels = Array.from({ length: 4 }, (_, i) => ({ key: `l${i}`, ax: 700 + i * 2, ay: 400 + i * 2, w: 120, h: 20, visible: true }));
    const out = layoutLabels(labels, { x: 700, y: 450 }, { w: 1440, h: 900 }, [{ x: 0, y: 0, w: 560, h: 900 }], 72);
    for (let i = 0; i < out.length; i++)
      for (let j = i + 1; j < out.length; j++) expect(overlaps({ ...out[i]!, w: 120, h: 20 }, { ...out[j]!, w: 120, h: 20 })).toBe(false);
    for (const o of out) {
      expect(o.x).toBeGreaterThanOrEqual(560);
      expect(o.x + 120).toBeLessThanOrEqual(1440);
    }
  });
});

describe("picker", () => {
  const buf = composeScene({
    layers: [makeLayer("sphere", { share: 0.5, position: { x: -1, y: 0, z: 0 }, scale: 0.6 }), makeLayer("helix", { share: 0.5, position: { x: 1, y: 0, z: 0 }, scale: 0.6 })],
    palette: "aurora",
    count: 160000,
    dustFraction: 0.06,
    seed: "pick",
  });
  const cam = new THREE.PerspectiveCamera(40, 1440 / 900, 0.05, 100);
  cam.position.set(0, 0, 6);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld();
  const pivots: [number, number, number][] = [
    [-1, 0, 0],
    [1, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  it("finds the region under the cursor", () => {
    const p = new THREE.Vector3(1, 0, 0).project(cam);
    const sx = ((p.x + 1) / 2) * 1440,
      sy = ((1 - p.y) / 2) * 900;
    const r = pick(buf, cam, 1440, 900, sx, sy, 0, pivots);
    expect(r?.region.layerIndex).toBe(1);
    const q = new THREE.Vector3(-1, 0, 0).project(cam);
    expect(pick(buf, cam, 1440, 900, ((q.x + 1) / 2) * 1440, ((1 - q.y) / 2) * 900, 0, pivots)?.region.layerIndex).toBe(0);
    expect(pick(buf, cam, 1440, 900, 5, 5, 0, pivots)).toBeNull();
  });
  it("is fast enough (< 6 ms budget in browsers; generous in CI)", () => {
    let best = Infinity;
    for (let k = 0; k < 5; k++) {
      const t0 = performance.now();
      pick(buf, cam, 1440, 900, 720, 450, 3, pivots);
      best = Math.min(best, performance.now() - t0);
    }
    expect(best).toBeLessThan(12);
  });
});
