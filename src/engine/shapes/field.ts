import { compileOrRepair, type Compiled } from "../paramath";
import { PointBuilder } from "./helpers";
import type { ShapeDefinition } from "./types";

// Default: a softened 2D electric dipole (+ at x = −0.4, − at x = +0.4) in the XY plane.
const DEFAULTS = {
  vx: "(x+0.4)/((x+0.4)^2+y^2+0.004)-(x-0.4)/((x-0.4)^2+y^2+0.004)",
  vy: "y/((x+0.4)^2+y^2+0.004)-y/((x-0.4)^2+y^2+0.004)",
  vz: "0",
} as const;
const AXES = ["vx", "vy", "vz"] as const;
const VARS = ["x", "y", "z"];
const BOX = 1.2;
/** Upper bound on RK2 steps per generation (keeps extreme seeds × steps combinations interactive). */
const STEP_BUDGET = 260_000;

export const field: ShapeDefinition = {
  id: "field",
  title: "Vector field streamlines",
  doc: "Streamlines of a vector field (vx, vy, vz) of x, y, z in [-1.2, 1.2]³, traced from a grid of seeds; light pulses run along the flow, and sources and sinks glow. Electric and magnetic fields, wind, currents, gradients, dynamical systems (default: an electric dipole in the XY plane). Put a, b or c in the formulas with a knob, e.g. vx = \"-y+a*x/10\", vy = \"x+a*y/10\", vz = \"0\" turns a vortex into a spiral source (a > 0) or sink (a < 0).",
  goodFor: ["an electric dipole", "a magnetic field around a wire (vx = -y, vy = x)", "wind or ocean currents", "a gradient flowing downhill", "a dynamical system's phase portrait", "sources and sinks"],
  params: [
    { key: "seeds", default: 18, min: 4, max: 40, integer: true, doc: "seeds per axis on the seeding grid (planar: seeds² lines)" },
    { key: "steps", default: 80, min: 20, max: 200, integer: true, doc: "integration steps in each direction from a seed (line length)" },
    { key: "step_size", default: 0.02, min: 0.005, max: 0.08, doc: "integration step length" },
    { key: "planar", default: 1, min: 0, max: 1, integer: true, doc: "1 = lines stay in the XY plane (vz ignored), 0 = full 3D lines from a 3D seed lattice (≈0.4·seeds per axis)" },
    { key: "a", default: 0, min: -10, max: 10, doc: "free coefficient available to the expressions" },
    { key: "b", default: 0, min: -10, max: 10, doc: "free coefficient available to the expressions" },
    { key: "c", default: 0, min: -10, max: 10, doc: "free coefficient available to the expressions" },
  ],
  expr: AXES.map((k) => ({
    key: k,
    kind: "paramath" as const,
    default: DEFAULTS[k],
    maxLength: 400,
    vars: VARS,
    doc: `${k.slice(1)} component of the field at (x, y, z) (also i, n and the knobs a, b, c)`,
  })),
  regions: [
    { id: "lines", doc: "the streamlines" },
    { id: "sources", doc: "zones of strong positive divergence, where lines are born (e.g. a positive charge)", conditional: true },
    { id: "sinks", doc: "zones of strong negative divergence, where lines end (e.g. a negative charge)", conditional: true },
  ],
  motionDoc: "pulses of light run along the streamlines; sources and sinks throb",
  generate({ count, rng, params, expr, seed }) {
    const b = new PointBuilder();
    let slots: Record<string, number> = {};
    let scopeSize = 0;
    const fns: Compiled[] = AXES.map((k) => {
      const c = compileOrRepair(expr[k] ?? DEFAULTS[k], VARS, DEFAULTS[k], seed);
      if (c.repaired) b.warnings.push(`field: expression ${k} was repaired to "${c.used}" (${c.error})`);
      if (c.fellBack) b.warnings.push(`field: invalid expression ${k} (${c.error}); using the default`);
      slots = c.result.slots;
      scopeSize = c.result.scopeSize;
      return c.result.fn!;
    });
    const scope = new Float64Array(scopeSize);
    scope[slots.n!] = count;
    scope[slots.a!] = params.a!;
    scope[slots.b!] = params.b!;
    scope[slots.c!] = params.c!;
    const SX = slots.x!,
      SY = slots.y!,
      SZ = slots.z!,
      SI = slots.i!;
    const planar = params.planar! >= 0.5;
    const nSeedAxis = Math.round(params.seeds!);
    const steps = Math.round(params.steps!);
    const h = params.step_size!;
    const fx = fns[0]!,
      fy = fns[1]!,
      fz = fns[2]!;
    const vel = (x: number, y: number, z: number, out: Float64Array) => {
      scope[SX] = x;
      scope[SY] = y;
      scope[SZ] = z;
      out[0] = fx(scope);
      out[1] = fy(scope);
      out[2] = planar ? 0 : fz(scope);
    };

    // Seeds: a jittered grid on the XY plane, or a 3D lattice (subsampled to the step budget).
    let seeds: number[] = [];
    if (planar) {
      for (let j = 0; j < nSeedAxis; j++)
        for (let i = 0; i < nSeedAxis; i++) {
          const cell = 2 / nSeedAxis;
          seeds.push(-1 + (i + 0.5 + (rng.next() - 0.5) * 0.6) * cell, -1 + (j + 0.5 + (rng.next() - 0.5) * 0.6) * cell, 0);
        }
    } else {
      const m = Math.max(3, Math.round(nSeedAxis * 0.4));
      const cell = 2 / m;
      for (let k = 0; k < m; k++)
        for (let j = 0; j < m; j++)
          for (let i = 0; i < m; i++)
            seeds.push(-1 + (i + 0.5 + (rng.next() - 0.5) * 0.6) * cell, -1 + (j + 0.5 + (rng.next() - 0.5) * 0.6) * cell, -1 + (k + 0.5 + (rng.next() - 0.5) * 0.6) * cell);
    }
    // Also keep ≥ ~24 particles per line, or lines dissolve into dust at low counts.
    const maxLines = Math.max(16, Math.min(Math.floor(STEP_BUDGET / (2 * steps)), Math.floor(count / 24)));
    if (seeds.length / 3 > maxLines) {
      // Deterministic subset (partial Fisher–Yates on seed indices).
      const idx = Array.from({ length: seeds.length / 3 }, (_, i) => i);
      for (let i = 0; i < maxLines; i++) {
        const j = i + rng.int(idx.length - i);
        [idx[i], idx[j]] = [idx[j]!, idx[i]!];
      }
      const kept: number[] = [];
      for (let i = 0; i < maxLines; i++) kept.push(seeds[idx[i]! * 3]!, seeds[idx[i]! * 3 + 1]!, seeds[idx[i]! * 3 + 2]!);
      seeds = kept;
    }
    const nSeeds = seeds.length / 3;
    const v = new Float64Array(3),
      v2 = new Float64Array(3);
    // Stop threshold relative to the typical speed, so the field's overall scale does not matter.
    const speeds: number[] = [];
    for (let s = 0; s < nSeeds; s++) {
      vel(seeds[s * 3]!, seeds[s * 3 + 1]!, seeds[s * 3 + 2]!, v);
      speeds.push(Math.hypot(v[0]!, v[1]!, v[2]!));
    }
    speeds.sort((p, q) => p - q);
    const eps = Math.max(1e-9, 1e-3 * (speeds[speeds.length >> 1] ?? 0));

    // RK2 (midpoint) on the normalised direction: constant step length, so lines are evenly sampled.
    const half = new Float64Array(3 * (steps + 1));
    const lines: Float32Array[] = [];
    const trace = (x0: number, y0: number, z0: number, dir: 1 | -1, out: Float64Array): number => {
      let x = x0,
        y = y0,
        z = z0;
      let px = 0,
        py = 0,
        pz = 0;
      let n = 0;
      for (let k = 0; k < steps; k++) {
        vel(x, y, z, v);
        const s1 = Math.hypot(v[0]!, v[1]!, v[2]!);
        if (s1 < eps) break;
        const dx = (v[0]! / s1) * dir,
          dy = (v[1]! / s1) * dir,
          dz = (v[2]! / s1) * dir;
        vel(x + dx * h * 0.5, y + dy * h * 0.5, z + dz * h * 0.5, v2);
        const s2 = Math.hypot(v2[0]!, v2[1]!, v2[2]!);
        if (s2 < eps) break;
        const ex = (v2[0]! / s2) * dir,
          ey = (v2[1]! / s2) * dir,
          ez = (v2[2]! / s2) * dir;
        // A direction flip means we stepped across a sink/source core: stop instead of zig-zagging.
        if (k > 0 && ex * px + ey * py + ez * pz < -0.2) break;
        x += ex * h;
        y += ey * h;
        z += ez * h;
        if (Math.abs(x) > BOX || Math.abs(y) > BOX || Math.abs(z) > BOX) break;
        out[n * 3] = x;
        out[n * 3 + 1] = y;
        out[n * 3 + 2] = z;
        n++;
        px = ex;
        py = ey;
        pz = ez;
      }
      return n;
    };
    const back = new Float64Array(3 * (steps + 1));
    let totalLen = 0;
    const lineLens: number[] = [];
    for (let s = 0; s < nSeeds; s++) {
      scope[SI] = s / Math.max(nSeeds - 1, 1);
      const x0 = seeds[s * 3]!,
        y0 = seeds[s * 3 + 1]!,
        z0 = seeds[s * 3 + 2]!;
      const nb = trace(x0, y0, z0, -1, back);
      const nf = trace(x0, y0, z0, 1, half);
      const n = nb + 1 + nf;
      if (n < 3) continue;
      const line = new Float32Array(n * 3);
      for (let k = 0; k < nb; k++) line.set([back[(nb - 1 - k) * 3]!, back[(nb - 1 - k) * 3 + 1]!, back[(nb - 1 - k) * 3 + 2]!], k * 3);
      line.set([x0, y0, z0], nb * 3);
      for (let k = 0; k < nf; k++) line.set([half[k * 3]!, half[k * 3 + 1]!, half[k * 3 + 2]!], (nb + 1 + k) * 3);
      lines.push(line);
      const len = (n - 1) * h;
      lineLens.push(len);
      totalLen += len;
    }

    // Divergence on a coarse grid (central differences) flags source and sink zones. A zone must stand out
    // from the field's typical divergence (> 4× median) so uniformly expanding fields are not all "source".
    const G = planar ? 48 : 18;
    const cell = (2 * BOX) / G;
    const hd = cell * 0.5;
    const nCells = planar ? G * G : G * G * G;
    const div = new Float32Array(nCells);
    const a = new Float64Array(3),
      c2 = new Float64Array(3);
    for (let ci = 0; ci < nCells; ci++) {
      const ix = ci % G,
        iy = Math.floor(ci / G) % G,
        iz = planar ? 0 : Math.floor(ci / (G * G));
      const x = -BOX + (ix + 0.5) * cell,
        y = -BOX + (iy + 0.5) * cell,
        z = planar ? 0 : -BOX + (iz + 0.5) * cell;
      vel(x + hd, y, z, a);
      vel(x - hd, y, z, c2);
      let d = (a[0]! - c2[0]!) / (2 * hd);
      vel(x, y + hd, z, a);
      vel(x, y - hd, z, c2);
      d += (a[1]! - c2[1]!) / (2 * hd);
      if (!planar) {
        vel(x, y, z + hd, a);
        vel(x, y, z - hd, c2);
        d += (a[2]! - c2[2]!) / (2 * hd);
      }
      div[ci] = Number.isFinite(d) ? d : 0;
    }
    const absSorted = Array.from(div, Math.abs).sort((p, q) => p - q);
    const median = absSorted[absSorted.length >> 1] ?? 0;
    let maxPos = 0,
      maxNeg = 0;
    for (const d of div) {
      maxPos = Math.max(maxPos, d);
      maxNeg = Math.max(maxNeg, -d);
    }
    const thrPos = Math.max(0.15 * maxPos, 4 * median, 1e-6);
    const thrNeg = Math.max(0.15 * maxNeg, 4 * median, 1e-6);
    const zone = new Int8Array(nCells);
    let nSrcCells = 0,
      nSinkCells = 0;
    for (let ci = 0; ci < nCells; ci++) {
      if (div[ci]! > thrPos) {
        zone[ci] = 1;
        nSrcCells++;
      } else if (div[ci]! < -thrNeg) {
        zone[ci] = -1;
        nSinkCells++;
      }
    }
    const cellIndex = (x: number, y: number, z: number) => {
      const ix = Math.min(G - 1, Math.max(0, Math.floor((x + BOX) / cell))),
        iy = Math.min(G - 1, Math.max(0, Math.floor((y + BOX) / cell)));
      if (planar) return iy * G + ix;
      const iz = Math.min(G - 1, Math.max(0, Math.floor((z + BOX) / cell)));
      return (iz * G + iy) * G + ix;
    };

    const flow = { type: "flow" as const, speed: 0.6 };
    const linesReg = b.region({ id: "lines", motion: flow, colorRole: "primary" });
    const srcReg = nSrcCells ? b.region({ id: "sources", motion: { type: "pulse", speed: 0.6 }, colorRole: "glow" }) : -1;
    const sinkReg = nSinkCells ? b.region({ id: "sinks", motion: { type: "pulse", speed: 0.6 }, colorRole: "accent" }) : -1;

    if (totalLen <= 0) {
      // Zero field everywhere: show the seed grid as still dots so the layer is not empty.
      b.warnings.push("field: the field is zero (or invalid) at every seed; no streamlines");
      for (let k = 0; k < count; k++) {
        const s = k % nSeeds;
        b.push(seeds[s * 3]! + rng.normal() * 0.01, seeds[s * 3 + 1]! + rng.normal() * 0.01, seeds[s * 3 + 2]! + rng.normal() * 0.01, linesReg, 0);
      }
      return b.build(count, rng);
    }

    const markerShare = 0.035;
    const nSrcMarkers = nSrcCells ? Math.round(count * markerShare) : 0;
    const nSinkMarkers = nSinkCells ? Math.round(count * markerShare) : 0;
    const nLinePts = count - nSrcMarkers - nSinkMarkers;
    const j = 0.0035;
    let acc = 0,
      assigned = 0;
    lines.forEach((line, li) => {
      acc += lineLens[li]!;
      const target = Math.round((acc / totalLen) * nLinePts);
      const n = target - assigned;
      assigned = target;
      const segs = line.length / 3 - 1;
      for (let k = 0; k < n; k++) {
        let f = 0,
          x = 0,
          y = 0,
          z = 0;
        // Thin out the last stretch before the box walls so the field fades instead of ending on a hard square.
        for (let tries = 0; tries < 4; tries++) {
          f = tries === 0 ? (k + rng.next()) / n : rng.next();
          const t = f * segs;
          const s = Math.min(segs - 1, Math.floor(t));
          const w = t - s;
          x = line[s * 3]! + (line[s * 3 + 3]! - line[s * 3]!) * w;
          y = line[s * 3 + 1]! + (line[s * 3 + 4]! - line[s * 3 + 1]!) * w;
          z = line[s * 3 + 2]! + (line[s * 3 + 5]! - line[s * 3 + 2]!) * w;
          const m = Math.max(Math.abs(x), Math.abs(y), Math.abs(z));
          const edge = Math.min(1, Math.max(0, (m - 0.95) / (BOX - 0.95)));
          if (rng.next() >= edge * edge * 0.85) break;
        }
        const zn = zone[cellIndex(x, y, z)]!;
        const reg = zn > 0 && srcReg >= 0 ? srcReg : zn < 0 && sinkReg >= 0 ? sinkReg : linesReg;
        b.push(x + rng.normal() * j, y + rng.normal() * j, planar ? z + rng.normal() * j * 0.5 : z + rng.normal() * j, reg, f);
      }
    });
    // Glowing markers in the flagged cells, weighted by |div| (saturated so one cell cannot take them all).
    const markers = (n: number, sign: 1 | -1, reg: number, thr: number) => {
      if (n <= 0 || reg < 0) return;
      const cells: number[] = [],
        cw: number[] = [];
      let tw = 0;
      for (let ci = 0; ci < nCells; ci++)
        if (zone[ci] === sign) {
          const w = Math.min(Math.abs(div[ci]!), 4 * thr);
          tw += w;
          cells.push(ci);
          cw.push(tw);
        }
      for (let k = 0; k < n; k++) {
        const target = rng.next() * tw;
        let lo = 0,
          hi = cells.length - 1;
        while (lo < hi) {
          const mid = (lo + hi) >> 1;
          if (cw[mid]! < target) lo = mid + 1;
          else hi = mid;
        }
        const ci = cells[lo]!;
        const ix = ci % G,
          iy = Math.floor(ci / G) % G,
          iz = planar ? 0 : Math.floor(ci / (G * G));
        const x = -BOX + (ix + 0.5) * cell + rng.normal() * cell * 0.45,
          y = -BOX + (iy + 0.5) * cell + rng.normal() * cell * 0.45,
          z = planar ? rng.normal() * cell * 0.3 : -BOX + (iz + 0.5) * cell + rng.normal() * cell * 0.45;
        b.push(Math.max(-BOX, Math.min(BOX, x)), Math.max(-BOX, Math.min(BOX, y)), Math.max(-BOX, Math.min(BOX, z)), reg, sign > 0 ? 0 : 1, 1.3);
      }
    };
    markers(nSrcMarkers, 1, srcReg, thrPos);
    markers(nSinkMarkers, -1, sinkReg, thrNeg);
    return b.build(count, rng);
  },
};
