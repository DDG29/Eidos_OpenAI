import es from "@/i18n/es.json";
import en from "@/i18n/en.json";

export type Locale = "es" | "en";
export const LOCALES: readonly Locale[] = ["es", "en"] as const;
export type MessageKey = keyof typeof es;
type Dict = Record<MessageKey, string>;

// `en` must provide every key of `es`: a missing key fails `pnpm typecheck` here.
const enDict: Dict = en;
const esDict: Dict = es;
export const DICTS: Record<Locale, Dict> = { es: esDict, en: enDict };

export type Vars = Record<string, string | number>;

export function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

export function translate(locale: Locale, key: MessageKey, vars?: Vars): string {
  return interpolate(DICTS[locale][key] ?? DICTS.es[key], vars);
}

export function isLocale(v: unknown): v is Locale {
  return v === "es" || v === "en";
}

export function pickLocale(acceptLanguage: string | null | undefined, fallback: Locale = "es"): Locale {
  if (!acceptLanguage) return fallback;
  const first = acceptLanguage.split(",")[0]?.trim().toLowerCase() ?? "";
  if (first.startsWith("en")) return "en";
  if (first.startsWith("es")) return "es";
  return fallback;
}

export const LOCALE_COOKIE = "eidos_locale";
