import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { compileOrRepair, compileParaMath, evaluateOnce, FUNCTIONS, MAX_LENGTH, repairParaMath } from "./index";

const ev = (src: string, vals: Record<string, number> = {}) => {
  const v = evaluateOnce(src, vals);
  if (v === null) throw new Error(`did not compile: ${src} → ${compileParaMath(src, Object.keys(vals)).error}`);
  return v;
};

describe("ParaMath precedence and associativity", () => {
  it("power is right-associative", () => expect(ev("2^3^2")).toBe(50)); // 512 clamped to the result limit
  it("power is right-associative (unclamped check)", () => expect(ev("2^3^2/16")).toBe(32));
  it("unary minus binds looser than power", () => expect(ev("-2^2")).toBe(-4));
  it("standard precedence", () => {
    expect(ev("1+2*3")).toBe(7);
    expect(ev("(1+2)*3")).toBe(9);
    expect(ev("10-4-3")).toBe(3);
    expect(ev("2*3%4")).toBe(2);
    expect(ev("2^-1")).toBe(0.5);
    expect(ev("--3")).toBe(3);
  });
  it("numbers with exponents and leading dots", () => {
    expect(ev("1.5e1")).toBe(15);
    expect(ev(".25*4")).toBe(1);
  });
});

describe("ParaMath functions and constants", () => {
  const cases: [string, number][] = [
    ["sin(pi/2)", 1],
    ["cos(0)", 1],
    ["tan(0)", 0],
    ["asin(1)", Math.PI / 2],
    ["acos(1)", 0],
    ["atan(1)", Math.PI / 4],
    ["atan2(1,1)", Math.PI / 4],
    ["sinh(0)", 0],
    ["cosh(0)", 1],
    ["tanh(0)", 0],
    ["exp(0)", 1],
    ["log(e)", 1],
    ["log10(100)", 2],
    ["log2(8)", 3],
    ["sqrt(16)", 4],
    ["cbrt(27)", 3],
    ["abs(-2)", 2],
    ["sign(-3)", -1],
    ["floor(1.7)", 1],
    ["ceil(1.2)", 2],
    ["round(1.5)", 2],
    ["fract(1.25)", 0.25],
    ["min(3,1,2)", 1],
    ["max(3,1,2)", 3],
    ["pow(2,5)", 32],
    ["mod(-1,3)", 2],
    ["clamp(5,0,1)", 1],
    ["mix(0,10,0.25)", 2.5],
    ["step(0.5,0.7)", 1],
    ["smoothstep(0,1,0.5)", 0.5],
    ["hypot(3,4)", 5],
    ["tau/pi", 2],
    ["phi", (1 + Math.sqrt(5)) / 2],
  ];
  it.each(cases)("%s", (src, expected) => expect(ev(src)).toBeCloseTo(expected, 9));
  it("covers every whitelisted function", () => {
    const tested = new Set(cases.map(([s]) => /^(\w+)\(/.exec(s)?.[1]).filter(Boolean));
    tested.add("noise");
    for (const f of Object.keys(FUNCTIONS)) expect(tested.has(f), f).toBe(true);
  });
  it("noise is deterministic per seed and bounded", () => {
    const a = compileParaMath("noise(x, y, 0.3)", ["x", "y"], "s1");
    const b = compileParaMath("noise(x, y, 0.3)", ["x", "y"], "s1");
    const c = compileParaMath("noise(x, y, 0.3)", ["x", "y"], "s2");
    const s = new Float64Array(a.scopeSize);
    s[a.slots.x!] = 0.37;
    s[a.slots.y!] = -1.2;
    expect(a.fn!(s)).toBe(b.fn!(s));
    expect(a.fn!(s)).not.toBe(c.fn!(s));
    expect(Math.abs(a.fn!(s))).toBeLessThanOrEqual(1.01);
    expect(Number.isFinite(ev("noise(1.3)"))).toBe(true);
  });
});

describe("ParaMath variables", () => {
  it("binds context variables and free coefficients", () => {
    expect(ev("x*y+a", { x: 2, y: 3, a: 1 })).toBe(7);
    expect(evaluateOnce("u+v", { u: 1, v: 2 })).toBe(3);
    const r = compileParaMath("t*i + n*0 + b + c", ["t"]);
    expect(r.ok).toBe(true);
  });
  it("rejects variables not available in the context", () => {
    expect(compileParaMath("u+1", ["x", "y"]).ok).toBe(false);
  });
});

describe("ParaMath safety", () => {
  it.each(["constructor", "__proto__", "process", "window", "this", "globalThis", "eval", "Function", "prototype", "toString"])(
    "rejects identifier %s",
    (id) => {
      expect(compileParaMath(id, ["x"]).ok).toBe(false);
      expect(compileParaMath(`${id}(1)`, ["x"]).ok).toBe(false);
    },
  );
  it("rejects property access, strings, assignment and brackets", () => {
    for (const src of ["a.b", "'x'", "x=1", "x[0]", "x;y", "`x`", "x=>1", "{}"]) expect(compileParaMath(src, ["x"]).ok, src).toBe(false);
  });
  it("rejects expressions that are too long or too deep", () => {
    expect(compileParaMath("1+".repeat(MAX_LENGTH) + "1", []).ok).toBe(false);
    expect(compileParaMath("(".repeat(60) + "1" + ")".repeat(60), []).ok).toBe(false);
    const many = Array.from({ length: 160 }, () => "1").join("+");
    expect(compileParaMath(many, []).ok).toBe(false);
  });
  it("reports helpful errors with positions", () => {
    expect(compileParaMath("foo(1)", []).error).toBe("Unknown function 'foo' at 0");
    expect(compileParaMath("1 + )", []).error).toContain("Unexpected token ')' at 4");
    expect(compileParaMath("sin(1,2)", []).error).toContain("expects 1 argument");
  });
  it("turns NaN/Infinity into 0 and clamps results", () => {
    expect(ev("1/0")).toBe(0);
    expect(ev("sqrt(-1)")).toBe(0);
    expect(ev("log(0)")).toBe(0);
    expect(ev("10^10")).toBe(50);
    expect(ev("-(10^10)")).toBe(-50);
  });
});

describe("ParaMath repair", () => {
  it("fixes common slips", () => {
    expect(repairParaMath("x**2")).toBe("x^2");
    expect(repairParaMath("Math.sin(x)")).toBe("sin(x)");
    expect(repairParaMath("sin(x*(2+1)")).toBe("sin(x*(2+1))");
    const r = compileOrRepair("Math.cos(x", ["x"], "0");
    expect(r.repaired).toBe(true);
    expect(r.fellBack).toBe(false);
  });
  it("falls back to the default expression when repair fails", () => {
    const r = compileOrRepair("window.alert(1)", ["x"], "x*2");
    expect(r.fellBack).toBe(true);
    expect(r.used).toBe("x*2");
  });
});

describe("ParaMath property: random valid expressions never throw", () => {
  const leaf = fc.oneof(fc.constantFrom("x", "y", "a", "pi", "e", "i"), fc.double({ min: -100, max: 100, noNaN: true }).map((v) => v.toFixed(3)));
  const { expr } = fc.letrec((tie) => ({
    expr: fc.oneof(
      { depthSize: "small", withCrossShrink: true },
      leaf,
      fc.tuple(tie("expr"), fc.constantFrom("+", "-", "*", "/", "%", "^"), tie("expr")).map(([a, op, b]) => `(${a})${op}(${b})`),
      fc.tuple(fc.constantFrom("sin", "cos", "sqrt", "log", "abs", "exp", "fract", "tanh"), tie("expr")).map(([f, a]) => `${f}(${a})`),
      fc.tuple(fc.constantFrom("min", "max", "pow", "atan2", "mod", "step", "hypot"), tie("expr"), tie("expr")).map(([f, a, b]) => `${f}(${a},${b})`),
      tie("expr").map((a) => `-(${a})`),
    ),
  }));
  it("compiles and evaluates to a finite clamped number", () => {
    fc.assert(
      fc.property(expr, fc.double({ min: -5, max: 5, noNaN: true }), fc.double({ min: -5, max: 5, noNaN: true }), (src, x, y) => {
        const r = compileParaMath(src, ["x", "y"]);
        if (!r.ok) return src.length > MAX_LENGTH || /too (large|deeply)/.test(r.error ?? "");
        const s = new Float64Array(r.scopeSize);
        s[r.slots.x!] = x;
        s[r.slots.y!] = y;
        const v = r.fn!(s);
        return Number.isFinite(v) && v <= 50 && v >= -50;
      }),
      { numRuns: 400 },
    );
  });
});

describe("ParaMath performance", () => {
  it("evaluates a typical expression over 160 000 points quickly", () => {
    const r = compileParaMath("0.3*sin(3*x)*cos(3*y) + 0.05*noise(x*2, y*2, 0)", ["x", "y"]);
    const s = new Float64Array(r.scopeSize);
    let best = Infinity;
    let acc = 0;
    for (let run = 0; run < 3; run++) {
      const t0 = performance.now();
      for (let k = 0; k < 160000; k++) {
        s[r.slots.x!] = (k % 400) / 200 - 1;
        s[r.slots.y!] = Math.floor(k / 400) / 200 - 1;
        acc += r.fn!(s);
      }
      best = Math.min(best, performance.now() - t0);
    }
    expect(Number.isFinite(acc)).toBe(true);
    // 40 ms budget in a browser worker; best-of-3 with headroom because tests run in parallel threads.
    expect(best).toBeLessThan(150);
  });
});
