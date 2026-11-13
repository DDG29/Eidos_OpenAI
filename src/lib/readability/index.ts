/**
 * Readability: INFLESZ (Barrio-Cantalejo et al., 2008; Szigriszt-Pazos formula) for Spanish and Flesch
 * Reading Ease for English. Higher = easier.
 */

const ES_STRONG = "aeoáéíóú";
const ES_WEAK = "iuü";

/** Spanish syllables by vowel nuclei: strong+strong = hiatus, weak+strong/strong+weak/weak+weak = diphthong (unless accented weak). */
export function syllablesEs(word: string): number {
  const w = word.toLowerCase().replace(/[^a-záéíóúüñ]/g, "");
  if (!w) return 0;
  // "qu" and "gu" before e/i: the u is silent.
  const s = w.replace(/qu([eéií])/g, "q$1").replace(/gu([eéií])/g, "g$1");
  let count = 0;
  let prev: "s" | "w" | "W" | null = null; // s strong, w weak, W accented weak (í ú)
  for (const ch of s) {
    let t: "s" | "w" | "W" | null = null;
    if (ch === "í" || ch === "ú") t = "W";
    else if (ES_STRONG.includes(ch)) t = "s";
    else if (ES_WEAK.includes(ch) || ch === "y") t = ch === "y" ? null : "w";
    if (t === null) {
      prev = null;
      continue;
    }
    if (prev === null) count++;
    else {
      const hiatus = (prev === "s" && t === "s") || prev === "W" || t === "W";
      if (hiatus) count++;
    }
    prev = t;
  }
  // final "y" after a vowel is part of a diphthong (hoy, muy); alone it is a vowel ("y")
  if (w === "y") return 1;
  return Math.max(1, count);
}

export function syllablesEn(word: string): number {
  let w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "");
  const m = w.match(/[aeiouy]{1,2}/g);
  return Math.max(1, m ? m.length : 1);
}

export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?¿¡…])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => /[\p{L}\p{N}]/u.test(s));
}

export function words(text: string): string[] {
  return text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) ?? [];
}

export function inflesz(text: string): number {
  const ws = words(text);
  const ss = Math.max(1, splitSentences(text).length);
  if (!ws.length) return 100;
  const syl = ws.reduce((s, w) => s + syllablesEs(w), 0);
  return 206.835 - (62.3 * syl) / ws.length - ws.length / ss;
}

export function fleschEn(text: string): number {
  const ws = words(text);
  const ss = Math.max(1, splitSentences(text).length);
  if (!ws.length) return 100;
  const syl = ws.reduce((s, w) => s + syllablesEn(w), 0);
  return 206.835 - (1.015 * ws.length) / ss - (84.6 * syl) / ws.length;
}

export type LevelKey = "curioso" | "prepa" | "universidad" | "experto";

/** Suggested ranges (spec 8.8 for INFLESZ; Flesch ranges chosen to match the same audiences). */
export const READABILITY_RANGES: Record<"es" | "en", Record<LevelKey, [number, number]>> = {
  es: { curioso: [65, 200], prepa: [55, 75], universidad: [40, 65], experto: [-200, 200] },
  en: { curioso: [65, 200], prepa: [45, 80], universidad: [25, 65], experto: [-200, 200] },
};

export function readability(text: string, lang: "es" | "en"): number {
  return lang === "es" ? inflesz(text) : fleschEn(text);
}
