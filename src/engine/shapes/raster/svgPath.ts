/**
 * Minimal, strict SVG path "d" parser + flattener. Used to validate Claude-authored glyphs (spec 6.2 #23)
 * and to rasterize them deterministically without a canvas.
 */

export type Pt = [number, number];
export interface Polyline {
  points: Pt[];
  closed: boolean;
}

export interface ParsedPath {
  ok: boolean;
  error?: string;
  /** absolute commands with absolute coordinates */
  segments: Seg[];
}

type Seg =
  | { t: "M"; p: Pt }
  | { t: "L"; p: Pt }
  | { t: "C"; c1: Pt; c2: Pt; p: Pt }
  | { t: "Q"; c: Pt; p: Pt }
  | { t: "A"; rx: number; ry: number; rot: number; large: boolean; sweep: boolean; p: Pt }
  | { t: "Z" };

const CMD_RE = /^[MLHVCSQTAZmlhvcsqtaz]$/;
const ALLOWED = /^[MLHVCSQTAZmlhvcsqtaz0-9eE.,+\-\s]*$/;
const ARITY: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };

function tokenize(d: string): (string | number)[] | string {
  const tokens: (string | number)[] = [];
  const re = /([MLHVCSQTAZmlhvcsqtaz])|([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)|([\s,]+)|(.)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d))) {
    if (m[1]) tokens.push(m[1]);
    else if (m[2]) tokens.push(parseFloat(m[2]));
    else if (m[4]) return `Unexpected character '${m[4]}' at ${m.index}`;
  }
  return tokens;
}

/** Arc flags may be written without separators ("a1 1 0 011 1"); split them where needed. */
function readFlag(tokens: (string | number)[], i: number): [number, number] | null {
  const v = tokens[i];
  if (v === 0 || v === 1) return [v, i + 1];
  return null;
}

export function parseSvgPath(d: string, maxLength = 6000): ParsedPath {
  if (typeof d !== "string" || d.trim() === "") return { ok: false, error: "Empty path", segments: [] };
  if (d.length > maxLength) return { ok: false, error: `Path longer than ${maxLength} characters`, segments: [] };
  if (!ALLOWED.test(d)) return { ok: false, error: "Path contains characters outside M L H V C S Q T A Z, numbers and separators", segments: [] };
  const tk = tokenize(d);
  if (typeof tk === "string") return { ok: false, error: tk, segments: [] };
  const segs: Seg[] = [];
  let i = 0;
  let cmd = "";
  let cur: Pt = [0, 0];
  let start: Pt = [0, 0];
  let lastC: Pt | null = null; // last cubic control (for S)
  let lastQ: Pt | null = null; // last quadratic control (for T)
  if (typeof tk[0] !== "string" || tk[0].toUpperCase() !== "M") return { ok: false, error: "Path must start with M", segments: [] };
  while (i < tk.length) {
    const t = tk[i];
    if (typeof t === "string" && CMD_RE.test(t)) {
      cmd = t;
      i++;
      if (cmd === "Z" || cmd === "z") {
        segs.push({ t: "Z" });
        cur = [start[0], start[1]];
        lastC = lastQ = null;
        continue;
      }
    } else if (cmd === "") {
      return { ok: false, error: `Number before command at token ${i}`, segments: [] };
    }
    const up = cmd.toUpperCase();
    const rel = cmd !== up;
    const n = ARITY[up];
    if (n === undefined) return { ok: false, error: `Unknown command '${cmd}'`, segments: [] };
    if (n === 0) continue;
    const nums: number[] = [];
    if (up === "A") {
      for (let k = 0; k < 7; k++) {
        if (k === 3 || k === 4) {
          const f = readFlag(tk, i);
          if (!f) return { ok: false, error: `Invalid arc flag at token ${i}`, segments: [] };
          nums.push(f[0]);
          i = f[1];
        } else {
          const v = tk[i];
          if (typeof v !== "number") return { ok: false, error: `Expected number at token ${i}`, segments: [] };
          nums.push(v);
          i++;
        }
      }
    } else {
      for (let k = 0; k < n; k++) {
        const v = tk[i];
        if (typeof v !== "number" || !Number.isFinite(v)) return { ok: false, error: `Expected number for '${cmd}' at token ${i}`, segments: [] };
        nums.push(v);
        i++;
      }
    }
    const ox = rel ? cur[0] : 0;
    const oy = rel ? cur[1] : 0;
    switch (up) {
      case "M": {
        const p: Pt = [nums[0]! + ox, nums[1]! + oy];
        segs.push({ t: "M", p });
        cur = p;
        start = p;
        cmd = rel ? "l" : "L"; // subsequent pairs are implicit lineto
        lastC = lastQ = null;
        break;
      }
      case "L": {
        const p: Pt = [nums[0]! + ox, nums[1]! + oy];
        segs.push({ t: "L", p });
        cur = p;
        lastC = lastQ = null;
        break;
      }
      case "H": {
        const p: Pt = [nums[0]! + ox, cur[1]];
        segs.push({ t: "L", p });
        cur = p;
        lastC = lastQ = null;
        break;
      }
      case "V": {
        const p: Pt = [cur[0], nums[0]! + oy];
        segs.push({ t: "L", p });
        cur = p;
        lastC = lastQ = null;
        break;
      }
      case "C": {
        const c1: Pt = [nums[0]! + ox, nums[1]! + oy];
        const c2: Pt = [nums[2]! + ox, nums[3]! + oy];
        const p: Pt = [nums[4]! + ox, nums[5]! + oy];
        segs.push({ t: "C", c1, c2, p });
        lastC = c2;
        lastQ = null;
        cur = p;
        break;
      }
      case "S": {
        const c1: Pt = lastC ? [2 * cur[0] - lastC[0], 2 * cur[1] - lastC[1]] : [cur[0], cur[1]];
        const c2: Pt = [nums[0]! + ox, nums[1]! + oy];
        const p: Pt = [nums[2]! + ox, nums[3]! + oy];
        segs.push({ t: "C", c1, c2, p });
        lastC = c2;
        lastQ = null;
        cur = p;
        break;
      }
      case "Q": {
        const c: Pt = [nums[0]! + ox, nums[1]! + oy];
        const p: Pt = [nums[2]! + ox, nums[3]! + oy];
        segs.push({ t: "Q", c, p });
        lastQ = c;
        lastC = null;
        cur = p;
        break;
      }
      case "T": {
        const c: Pt = lastQ ? [2 * cur[0] - lastQ[0], 2 * cur[1] - lastQ[1]] : [cur[0], cur[1]];
        const p: Pt = [nums[0]! + ox, nums[1]! + oy];
        segs.push({ t: "Q", c, p });
        lastQ = c;
        lastC = null;
        cur = p;
        break;
      }
      case "A": {
        const p: Pt = [nums[5]! + ox, nums[6]! + oy];
        segs.push({ t: "A", rx: Math.abs(nums[0]!), ry: Math.abs(nums[1]!), rot: nums[2]!, large: nums[3] === 1, sweep: nums[4] === 1, p });
        lastC = lastQ = null;
        cur = p;
        break;
      }
    }
  }
  if (!segs.some((s) => s.t !== "M")) return { ok: false, error: "Path draws nothing", segments: [] };
  return { ok: true, segments: segs };
}

function arcToPoints(from: Pt, s: Extract<Seg, { t: "A" }>, steps: number): Pt[] {
  // Endpoint → center parameterization (SVG 1.1 implementation notes F.6.5).
  let { rx, ry } = s;
  const [x1, y1] = from;
  const [x2, y2] = s.p;
  if (rx === 0 || ry === 0) return [[x2, y2]];
  const phi = (s.rot * Math.PI) / 180;
  const cp = Math.cos(phi),
    sp = Math.sin(phi);
  const dx = (x1 - x2) / 2,
    dy = (y1 - y2) / 2;
  const x1p = cp * dx + sp * dy;
  const y1p = -sp * dx + cp * dy;
  const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lam > 1) {
    const r = Math.sqrt(lam);
    rx *= r;
    ry *= r;
  }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  let co = den === 0 ? 0 : Math.sqrt(Math.max(0, num / den));
  if (s.large === s.sweep) co = -co;
  const cxp = (co * rx * y1p) / ry;
  const cyp = (-co * ry * x1p) / rx;
  const cx = cp * cxp - sp * cyp + (x1 + x2) / 2;
  const cy = sp * cxp + cp * cyp + (y1 + y2) / 2;
  const ang = (ux: number, uy: number, vx: number, vy: number) => {
    const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    return a;
  };
  const t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!s.sweep && dt > 0) dt -= 2 * Math.PI;
  else if (s.sweep && dt < 0) dt += 2 * Math.PI;
  const pts: Pt[] = [];
  const n = Math.max(2, Math.ceil((steps * Math.abs(dt)) / (Math.PI / 2)));
  for (let k = 1; k <= n; k++) {
    const t = t1 + (dt * k) / n;
    const ex = rx * Math.cos(t),
      ey = ry * Math.sin(t);
    pts.push([cp * ex - sp * ey + cx, sp * ex + cp * ey + cy]);
  }
  return pts;
}

/** Flatten curves into polylines. `steps` = segments per curve. */
export function flattenSegments(segs: readonly Seg[], steps = 16): Polyline[] {
  const out: Polyline[] = [];
  let curPoly: Polyline | null = null;
  let cur: Pt = [0, 0];
  let start: Pt = [0, 0];
  const ensure = () => {
    if (!curPoly) {
      curPoly = { points: [[cur[0], cur[1]]], closed: false };
      out.push(curPoly);
    }
    return curPoly;
  };
  for (const s of segs) {
    if (s.t === "M") {
      curPoly = { points: [[s.p[0], s.p[1]]], closed: false };
      out.push(curPoly);
      cur = s.p;
      start = s.p;
    } else if (s.t === "L") {
      ensure().points.push([s.p[0], s.p[1]]);
      cur = s.p;
    } else if (s.t === "C") {
      const poly = ensure();
      for (let k = 1; k <= steps; k++) {
        const t = k / steps,
          u = 1 - t;
        poly.points.push([
          u * u * u * cur[0] + 3 * u * u * t * s.c1[0] + 3 * u * t * t * s.c2[0] + t * t * t * s.p[0],
          u * u * u * cur[1] + 3 * u * u * t * s.c1[1] + 3 * u * t * t * s.c2[1] + t * t * t * s.p[1],
        ]);
      }
      cur = s.p;
    } else if (s.t === "Q") {
      const poly = ensure();
      for (let k = 1; k <= steps; k++) {
        const t = k / steps,
          u = 1 - t;
        poly.points.push([u * u * cur[0] + 2 * u * t * s.c[0] + t * t * s.p[0], u * u * cur[1] + 2 * u * t * s.c[1] + t * t * s.p[1]]);
      }
      cur = s.p;
    } else if (s.t === "A") {
      ensure().points.push(...arcToPoints(cur, s, Math.max(4, steps / 2)));
      cur = s.p;
    } else if (s.t === "Z") {
      if (curPoly) (curPoly as Polyline).closed = true;
      cur = start;
      curPoly = null;
    }
  }
  return out.filter((p) => p.points.length >= 2);
}

export function polylinesFromPath(d: string, steps = 16): { ok: boolean; error?: string; polylines: Polyline[] } {
  const parsed = parseSvgPath(d);
  if (!parsed.ok) return { ok: false, error: parsed.error, polylines: [] };
  return { ok: true, polylines: flattenSegments(parsed.segments, steps) };
}

export interface FontCommand {
  type: "M" | "L" | "C" | "Q" | "Z";
  x?: number;
  y?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
}

/** opentype.js commands → polylines (same flattening as SVG paths). */
export function polylinesFromCommands(cmds: readonly FontCommand[], steps = 10): Polyline[] {
  const segs: Seg[] = [];
  for (const c of cmds) {
    if (c.type === "M") segs.push({ t: "M", p: [c.x ?? 0, c.y ?? 0] });
    else if (c.type === "L") segs.push({ t: "L", p: [c.x ?? 0, c.y ?? 0] });
    else if (c.type === "C") segs.push({ t: "C", c1: [c.x1 ?? 0, c.y1 ?? 0], c2: [c.x2 ?? 0, c.y2 ?? 0], p: [c.x ?? 0, c.y ?? 0] });
    else if (c.type === "Q") segs.push({ t: "Q", c: [c.x1 ?? 0, c.y1 ?? 0], p: [c.x ?? 0, c.y ?? 0] });
    else segs.push({ t: "Z" });
  }
  return flattenSegments(segs, steps);
}
