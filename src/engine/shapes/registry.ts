import type { ShapeId } from "@/lib/world/types";
import type { ShapeDefinition } from "./types";
import { helix } from "./helix";
import { nebula } from "./nebula";
import { sphere } from "./sphere";
import { text } from "./text";

/** The single source of truth for shapes: params, expressions, regions, catalog text and /lab controls. */
export const SHAPES: Partial<Record<ShapeId, ShapeDefinition>> = {
  sphere,
  helix,
  text,
  nebula,
};

export function getShape(id: ShapeId): ShapeDefinition | undefined {
  return SHAPES[id];
}

export function listShapes(): ShapeDefinition[] {
  return Object.values(SHAPES).filter((s): s is ShapeDefinition => !!s);
}

/** Clamp/round/fill params against the spec; unknown keys are reported, not used. */
export function resolveParams(def: ShapeDefinition, kv: { key: string; value: number }[]): { params: Record<string, number>; unknown: string[] } {
  const params: Record<string, number> = {};
  for (const p of def.params) params[p.key] = p.default;
  const unknown: string[] = [];
  for (const { key, value } of kv) {
    const spec = def.params.find((p) => p.key === key);
    if (!spec) {
      unknown.push(key);
      continue;
    }
    let v = Number.isFinite(value) ? value : spec.default;
    v = Math.min(spec.max, Math.max(spec.min, v));
    if (spec.integer) v = Math.round(v);
    params[key] = v;
  }
  return { params, unknown };
}

export function resolveExpr(def: ShapeDefinition, kv: { key: string; value: string }[]): { expr: Record<string, string>; unknown: string[] } {
  const expr: Record<string, string> = {};
  for (const e of def.expr) expr[e.key] = e.default;
  const unknown: string[] = [];
  for (const { key, value } of kv) {
    const spec = def.expr.find((e) => e.key === key);
    if (!spec) {
      unknown.push(key);
      continue;
    }
    if (typeof value === "string" && value.trim() !== "") expr[key] = value.slice(0, spec.maxLength);
  }
  return { expr, unknown };
}

/** Does `regionId` match a declared region spec (including patterns like bar_{i})? */
export function regionMatchesSpec(def: ShapeDefinition, regionId: string): boolean {
  return def.regions.some((r) => {
    if (!r.id.includes("{i}")) return r.id === regionId;
    const re = new RegExp("^" + r.id.replace("{i}", "\\d+") + "$");
    return re.test(regionId);
  });
}
