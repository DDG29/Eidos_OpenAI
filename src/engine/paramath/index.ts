import { createNoise3 } from "../util/noise";

/**
 * ParaMath — the closed expression language Claude uses to draw forms (spec §7).
 * Recursive-descent parser → AST → closure tree. No eval, no Function, no property access.
 */

export const MAX_LENGTH = 400;
export const MAX_NODES = 300;
export const MAX_DEPTH = 40;
export const RESULT_LIMIT = 50;

type Node =
  | { k: "num"; v: number; pos: number }
  | { k: "var"; name: string; pos: number }
  | { k: "un"; op: "-" | "+"; a: Node; pos: number }
  | { k: "bin"; op: "+" | "-" | "*" | "/" | "%" | "^"; a: Node; b: Node; pos: number }
  | { k: "call"; name: string; args: Node[]; pos: number };

type Tok = { t: "num"; v: number; pos: number } | { t: "id"; v: string; pos: number } | { t: "op"; v: string; pos: number } | { t: "end"; pos: number };

export class ParaMathError extends Error {
  constructor(
    message: string,
    public readonly pos: number,
  ) {
    super(message);
  }
}

export const CONSTANTS: Readonly<Record<string, number>> = Object.freeze({
  pi: Math.PI,
  tau: Math.PI * 2,
  e: Math.E,
  phi: (1 + Math.sqrt(5)) / 2,
});

/** name → [minArity, maxArity] */
export const FUNCTIONS: Readonly<Record<string, readonly [number, number]>> = Object.freeze({
  sin: [1, 1],
  cos: [1, 1],
  tan: [1, 1],
  asin: [1, 1],
  acos: [1, 1],
  atan: [1, 1],
  atan2: [2, 2],
  sinh: [1, 1],
  cosh: [1, 1],
  tanh: [1, 1],
  exp: [1, 1],
  log: [1, 1],
  log10: [1, 1],
  log2: [1, 1],
  sqrt: [1, 1],
  cbrt: [1, 1],
  abs: [1, 1],
  sign: [1, 1],
  floor: [1, 1],
  ceil: [1, 1],
  round: [1, 1],
  fract: [1, 1],
  min: [2, 16],
  max: [2, 16],
  pow: [2, 2],
  mod: [2, 2],
  clamp: [3, 3],
  mix: [3, 3],
  step: [2, 2],
  smoothstep: [3, 3],
  hypot: [2, 16],
  noise: [1, 3],
});

const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

function lex(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      i++;
      continue;
    }
    if ((c >= "0" && c <= "9") || (c === "." && /[0-9]/.test(src[i + 1] ?? ""))) {
      const m = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(src.slice(i));
      if (!m) throw new ParaMathError(`Invalid number at ${i}`, i);
      out.push({ t: "num", v: parseFloat(m[0]), pos: i });
      i += m[0].length;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i))!;
      out.push({ t: "id", v: m[0], pos: i });
      i += m[0].length;
      continue;
    }
    if ("+-*/%^(),".includes(c)) {
      out.push({ t: "op", v: c, pos: i });
      i++;
      continue;
    }
    throw new ParaMathError(`Unexpected character '${c}' at ${i}`, i);
  }
  out.push({ t: "end", pos: src.length });
  return out;
}

class Parser {
  private i = 0;
  nodes = 0;
  constructor(
    private toks: Tok[],
    private vars: ReadonlySet<string>,
  ) {}
  private peek(): Tok {
    return this.toks[this.i]!;
  }
  private next(): Tok {
    return this.toks[this.i++]!;
  }
  private isOp(v: string) {
    const t = this.peek();
    return t.t === "op" && t.v === v;
  }
  private count(depth: number) {
    if (++this.nodes > MAX_NODES) throw new ParaMathError(`Expression too large (more than ${MAX_NODES} nodes)`, this.peek().pos);
    if (depth > MAX_DEPTH) throw new ParaMathError(`Expression nested too deeply (more than ${MAX_DEPTH})`, this.peek().pos);
  }
  parse(): Node {
    const n = this.expr(0);
    const t = this.peek();
    if (t.t !== "end") throw new ParaMathError(`Unexpected token '${t.t === "num" ? t.v : t.v}' at ${t.pos}`, t.pos);
    return n;
  }
  private expr(d: number): Node {
    let a = this.term(d + 1);
    while (this.isOp("+") || this.isOp("-")) {
      const op = this.next() as Tok & { v: "+" | "-" };
      this.count(d);
      const b = this.term(d + 1);
      a = { k: "bin", op: op.v, a, b, pos: op.pos };
    }
    return a;
  }
  private term(d: number): Node {
    let a = this.unary(d + 1);
    while (this.isOp("*") || this.isOp("/") || this.isOp("%")) {
      const op = this.next() as Tok & { v: "*" | "/" | "%" };
      this.count(d);
      const b = this.unary(d + 1);
      a = { k: "bin", op: op.v, a, b, pos: op.pos };
    }
    return a;
  }
  private unary(d: number): Node {
    if (this.isOp("-") || this.isOp("+")) {
      const op = this.next() as Tok & { v: "-" | "+" };
      this.count(d);
      return { k: "un", op: op.v, a: this.unary(d + 1), pos: op.pos };
    }
    return this.power(d + 1);
  }
  private power(d: number): Node {
    const base = this.primary(d + 1);
    if (this.isOp("^")) {
      const op = this.next();
      this.count(d);
      return { k: "bin", op: "^", a: base, b: this.unary(d + 1), pos: op.pos };
    }
    return base;
  }
  private primary(d: number): Node {
    this.count(d);
    const t = this.next();
    if (t.t === "num") return { k: "num", v: t.v, pos: t.pos };
    if (t.t === "op" && t.v === "(") {
      const e = this.expr(d + 1);
      const c = this.next();
      if (!(c.t === "op" && c.v === ")")) throw new ParaMathError(`Expected ')' at ${c.pos}`, c.pos);
      return e;
    }
    if (t.t === "id") {
      if (this.isOp("(")) {
        if (!has(FUNCTIONS, t.v)) throw new ParaMathError(`Unknown function '${t.v}' at ${t.pos}`, t.pos);
        this.next();
        const args: Node[] = [];
        if (!this.isOp(")")) {
          args.push(this.expr(d + 1));
          while (this.isOp(",")) {
            this.next();
            args.push(this.expr(d + 1));
          }
        }
        const c = this.next();
        if (!(c.t === "op" && c.v === ")")) throw new ParaMathError(`Expected ')' at ${c.pos}`, c.pos);
        const [lo, hi] = FUNCTIONS[t.v]!;
        if (args.length < lo || args.length > hi)
          throw new ParaMathError(`Function '${t.v}' expects ${lo === hi ? lo : `${lo}–${hi}`} argument(s), got ${args.length} at ${t.pos}`, t.pos);
        return { k: "call", name: t.v, args, pos: t.pos };
      }
      if (has(CONSTANTS, t.v) || this.vars.has(t.v)) return { k: "var", name: t.v, pos: t.pos };
      throw new ParaMathError(`Unknown identifier '${t.v}' at ${t.pos}`, t.pos);
    }
    if (t.t === "end") throw new ParaMathError(`Unexpected end of expression at ${t.pos}`, t.pos);
    throw new ParaMathError(`Unexpected token '${t.v}' at ${t.pos}`, t.pos);
  }
}

export type Scope = Float64Array;
export type Compiled = (scope: Scope) => number;
type Fn = Compiled;

function fract(x: number) {
  return x - Math.floor(x);
}

function build(node: Node, slot: (name: string) => number, noiseSeed: string): Fn {
  switch (node.k) {
    case "num": {
      const v = node.v;
      return () => v;
    }
    case "var": {
      if (has(CONSTANTS, node.name) && !slotExists(slot, node.name)) {
        const v = CONSTANTS[node.name]!;
        return () => v;
      }
      const idx = slot(node.name);
      return (s) => s[idx]!;
    }
    case "un": {
      const a = build(node.a, slot, noiseSeed);
      return node.op === "-" ? (s) => -a(s) : a;
    }
    case "bin": {
      const a = build(node.a, slot, noiseSeed);
      const b = build(node.b, slot, noiseSeed);
      switch (node.op) {
        case "+":
          return (s) => a(s) + b(s);
        case "-":
          return (s) => a(s) - b(s);
        case "*":
          return (s) => a(s) * b(s);
        case "/":
          return (s) => a(s) / b(s);
        case "%":
          return (s) => a(s) % b(s);
        case "^":
          return (s) => Math.pow(a(s), b(s));
      }
      break;
    }
    case "call": {
      const args = node.args.map((n) => build(n, slot, noiseSeed));
      const [f0, f1, f2] = args as [Fn, Fn | undefined, Fn | undefined];
      const unary = (g: (x: number) => number): Fn => (s) => g(f0(s));
      switch (node.name) {
        case "sin":
          return unary(Math.sin);
        case "cos":
          return unary(Math.cos);
        case "tan":
          return unary(Math.tan);
        case "asin":
          return unary(Math.asin);
        case "acos":
          return unary(Math.acos);
        case "atan":
          return unary(Math.atan);
        case "atan2":
          return (s) => Math.atan2(f0(s), f1!(s));
        case "sinh":
          return unary(Math.sinh);
        case "cosh":
          return unary(Math.cosh);
        case "tanh":
          return unary(Math.tanh);
        case "exp":
          return unary(Math.exp);
        case "log":
          return unary(Math.log);
        case "log10":
          return unary(Math.log10);
        case "log2":
          return unary(Math.log2);
        case "sqrt":
          return unary(Math.sqrt);
        case "cbrt":
          return unary(Math.cbrt);
        case "abs":
          return unary(Math.abs);
        case "sign":
          return unary(Math.sign);
        case "floor":
          return unary(Math.floor);
        case "ceil":
          return unary(Math.ceil);
        case "round":
          return unary(Math.round);
        case "fract":
          return unary(fract);
        case "min":
          return (s) => {
            let m = Infinity;
            for (const f of args) m = Math.min(m, f(s));
            return m;
          };
        case "max":
          return (s) => {
            let m = -Infinity;
            for (const f of args) m = Math.max(m, f(s));
            return m;
          };
        case "hypot":
          return (s) => {
            let q = 0;
            for (const f of args) {
              const v = f(s);
              q += v * v;
            }
            return Math.sqrt(q);
          };
        case "pow":
          return (s) => Math.pow(f0(s), f1!(s));
        case "mod":
          return (s) => {
            const x = f0(s),
              y = f1!(s);
            return x - y * Math.floor(x / y);
          };
        case "clamp":
          return (s) => Math.min(Math.max(f0(s), f1!(s)), f2!(s));
        case "mix":
          return (s) => {
            const a = f0(s);
            return a + (f1!(s) - a) * f2!(s);
          };
        case "step":
          return (s) => (f1!(s) < f0(s) ? 0 : 1);
        case "smoothstep":
          return (s) => {
            const e0 = f0(s),
              e1 = f1!(s);
            const t = Math.min(Math.max((f2!(s) - e0) / (e1 - e0), 0), 1);
            return t * t * (3 - 2 * t);
          };
        case "noise": {
          const nz = createNoise3(`paramath:${noiseSeed}`);
          if (args.length === 1) return (s) => nz(f0(s), 0.5, 0.5);
          if (args.length === 2) return (s) => nz(f0(s), f1!(s), 0.5);
          return (s) => nz(f0(s), f1!(s), f2!(s));
        }
      }
    }
  }
  throw new ParaMathError("Unsupported node", 0);
}

// Variables shadow constants only if explicitly declared (e.g. a shape might declare "e"? none do).
function slotExists(slot: (name: string) => number, name: string): boolean {
  try {
    slot(name);
    return true;
  } catch {
    return false;
  }
}

export interface CompileResult {
  ok: boolean;
  error?: string;
  pos?: number;
  /** returns a finite number in [-50, 50] */
  fn?: Compiled;
  /** variable name → slot index in the scope array */
  slots: Record<string, number>;
  scopeSize: number;
}

export const COMMON_VARS = ["i", "n", "a", "b", "c"] as const;

export function compileParaMath(src: string, vars: readonly string[], noiseSeed = "0"): CompileResult {
  const allVars = Array.from(new Set([...vars, ...COMMON_VARS]));
  const slots: Record<string, number> = Object.create(null) as Record<string, number>;
  allVars.forEach((v, idx) => (slots[v] = idx));
  const fail = (e: unknown): CompileResult => ({
    ok: false,
    error: e instanceof ParaMathError ? e.message : "Invalid expression",
    pos: e instanceof ParaMathError ? e.pos : 0,
    slots,
    scopeSize: allVars.length,
  });
  if (typeof src !== "string" || src.trim() === "") return fail(new ParaMathError("Empty expression", 0));
  if (src.length > MAX_LENGTH) return fail(new ParaMathError(`Expression longer than ${MAX_LENGTH} characters`, MAX_LENGTH));
  try {
    const ast = new Parser(lex(src), new Set(allVars)).parse();
    const slot = (name: string) => {
      if (!has(slots, name)) throw new ParaMathError(`Unknown identifier '${name}'`, 0);
      return slots[name]!;
    };
    const raw = build(ast, slot, noiseSeed);
    const fn: Compiled = (scope) => {
      const v = raw(scope);
      if (!Number.isFinite(v)) return 0;
      return v > RESULT_LIMIT ? RESULT_LIMIT : v < -RESULT_LIMIT ? -RESULT_LIMIT : v;
    };
    return { ok: true, fn, slots, scopeSize: allVars.length };
  } catch (e) {
    return fail(e);
  }
}

/** Trivial local repairs (spec 7.4): `**`→`^`, `Math.x`→`x`, missing closing parentheses at the end. */
export function repairParaMath(src: string): string {
  let s = src.replace(/\*\*/g, "^").replace(/Math\.(\w+)/g, (_, f: string) => f.toLowerCase()).replace(/Math\.PI/gi, "pi");
  s = s.replace(/\bPI\b/g, "pi");
  let depth = 0;
  for (const ch of s) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
  }
  if (depth > 0 && depth < 10) s += ")".repeat(depth);
  return s;
}

/** Compile with repair; returns the expression actually used and whether it fell back. */
export function compileOrRepair(
  src: string,
  vars: readonly string[],
  fallback: string,
  noiseSeed = "0",
): { result: CompileResult; used: string; repaired: boolean; fellBack: boolean; error?: string } {
  const first = compileParaMath(src, vars, noiseSeed);
  if (first.ok) return { result: first, used: src, repaired: false, fellBack: false };
  const fixed = repairParaMath(src);
  if (fixed !== src) {
    const second = compileParaMath(fixed, vars, noiseSeed);
    if (second.ok) return { result: second, used: fixed, repaired: true, fellBack: false, error: first.error };
  }
  return { result: compileParaMath(fallback, vars, noiseSeed), used: fallback, repaired: false, fellBack: true, error: first.error };
}

/** Convenience: evaluate an expression once with named values (used by knob readouts). */
export function evaluateOnce(src: string, values: Record<string, number>): number | null {
  const r = compileParaMath(src, Object.keys(values));
  if (!r.ok || !r.fn) return null;
  const scope = new Float64Array(r.scopeSize);
  for (const [k, v] of Object.entries(values)) if (has(r.slots, k)) scope[r.slots[k]!] = v;
  return r.fn(scope);
}
