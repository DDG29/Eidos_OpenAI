import { compileParaMath } from "@/engine/paramath";

/** Knob readout templates (spec 8.4.6): "{value}" and "{=<ParaMath using value>|<decimals>}". */

const TOKEN = /\{(value|=([^|}]{1,200})\|(\d))\}/g;

export function decimalsOfStep(step: number): number {
  if (!Number.isFinite(step) || step <= 0 || step >= 1) return 0;
  return Math.min(4, Math.max(0, Math.ceil(-Math.log10(step) - 1e-9)));
}

export function formatNumber(v: number, decimals: number, locale: string): string {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(v);
}

export function renderReadout(template: string, value: number, step: number, locale = "es-MX"): string {
  return template.replace(TOKEN, (_m, whole: string, expr?: string, dec?: string) => {
    if (whole === "value") return formatNumber(value, decimalsOfStep(step), locale);
    const r = compileParaMath(expr ?? "", ["value"]);
    if (!r.ok || !r.fn) return "—";
    const scope = new Float64Array(r.scopeSize);
    scope[r.slots.value!] = value;
    return formatNumber(r.fn(scope), Number(dec ?? 0), locale);
  });
}

export function validateReadout(template: string): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  for (const m of template.matchAll(TOKEN)) {
    if (m[1] === "value") continue;
    const r = compileParaMath(m[2] ?? "", ["value"]);
    if (!r.ok) errors.push(`${m[2]}: ${r.error}`);
  }
  return { ok: errors.length === 0, errors };
}
