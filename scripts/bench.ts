// pnpm bench — engine benchmarks on this machine's CPU (spec 17.3): shape generation, composition,
// Hilbert pairing and picking, at the desktop particle count. Writes qa/bench.json.
import { mkdirSync, writeFileSync } from "node:fs";
import * as THREE from "three";
import { createRng } from "../src/engine/util/rng";
import { PALETTES } from "../src/engine/palettes";
import { createRasterHelper } from "../src/engine/shapes/raster/helper";
import { listShapes } from "../src/engine/shapes/registry";
import { composeScene } from "../src/engine/compile/compose";
import { pairOrder } from "../src/engine/compile/pairing";
import { pick } from "../src/engine/interaction/Picker";
import { makeLayer } from "../src/lib/world/layer";
import { loadFontsFromDisk } from "../src/test/fonts";
import type { Transition } from "../src/lib/world/types";

loadFontsFromDisk();
const N = 160_000;
const best = (runs: number, fn: () => void) => {
  let min = Infinity;
  for (let r = 0; r < runs; r++) {
    const t0 = performance.now();
    fn();
    min = Math.min(min, performance.now() - t0);
  }
  return Math.round(min * 10) / 10;
};

const shapes: Record<string, number> = {};
for (const def of listShapes()) {
  const params = Object.fromEntries(def.params.map((p) => [p.key, p.default]));
  const expr = Object.fromEntries(def.expr.map((e) => [e.key, e.default]));
  const data = def.data ? Array.from({ length: Math.max(def.data.minLength, 6) }, (_, i) => i + 1) : [];
  shapes[def.id] = best(3, () => def.generate({ count: N, rng: createRng(def.id), params, expr, data, raster: createRasterHelper(null), palette: PALETTES.aurora, seed: "bench" }));
}

const a = composeScene({ layers: [makeLayer("helix", { share: 0.9 })], palette: "aurora", count: N, dustFraction: 0.06, seed: "a" });
const b = composeScene({ layers: [makeLayer("galaxy", { share: 0.9 })], palette: "aurora", count: N, dustFraction: 0.06, seed: "b" });
const compose = best(3, () => composeScene({ layers: [makeLayer("network", { share: 0.6 }), makeLayer("sphere", { share: 0.3, position: { x: 1, y: 0, z: 0 } })], palette: "aurora", count: N, dustFraction: 0.06, seed: "c" }));
const pairing: Record<string, number> = {};
for (const t of ["flow", "swirl", "explode", "fold", "rain", "dissolve"] as Transition[]) pairing[t] = best(3, () => pairOrder(a, b, t, "bench"));

const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.01, 100);
camera.position.set(0, 0.4, 4.2);
camera.lookAt(0, 0, 0);
camera.updateMatrixWorld();
const pivots: [number, number, number][] = Array.from({ length: 8 }, () => [0, 0, 0]);
const rng = createRng("pick");
let hits = 0;
const pickMs =
  best(1, () => {
    for (let i = 0; i < 200; i++) if (pick(b, camera, 1440, 900, 400 + rng.next() * 640, 200 + rng.next() * 500, 0, pivots)) hits++;
  }) / 200;

const shapeTimes = Object.values(shapes);
const report = {
  ranAt: new Date().toISOString(),
  machine: `${process.platform} ${process.arch}, node ${process.version}`,
  particles: N,
  shapesMs: shapes,
  shapesMedianMs: shapeTimes.sort((x, y) => x - y)[Math.floor(shapeTimes.length / 2)],
  shapesMaxMs: Math.max(...shapeTimes),
  composeTwoLayersMs: compose,
  pairingMs: pairing,
  pickMsPerClick: Math.round(pickMs * 100) / 100,
  pickHitRate: hits / 200,
};
mkdirSync("qa", { recursive: true });
writeFileSync("qa/bench.json", JSON.stringify(report, null, 2) + "\n");
console.log(`Engine benchmark · ${report.machine} · ${N.toLocaleString()} particles\n`);
for (const [id, ms] of Object.entries(shapes)) console.log(`  shape ${id.padEnd(11)} ${String(ms).padStart(7)} ms`);
console.log(`\n  shapes: median ${report.shapesMedianMs} ms, max ${report.shapesMaxMs} ms`);
console.log(`  compose (2 layers + dust): ${compose} ms`);
console.log(`  pairing: ${Object.entries(pairing).map(([t, ms]) => `${t} ${ms} ms`).join(" · ")}`);
console.log(`  picking: ${report.pickMsPerClick} ms per click (hit rate ${Math.round(report.pickHitRate * 100)} %)`);
