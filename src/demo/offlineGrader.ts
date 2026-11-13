/**
 * Offline free-text grading for Demo Mode (spec 12.2): keyword overlap with the ideal answer after accent
 * and stop-word normalization. Labelled "evaluación sin conexión" in the UI.
 */
const STOP = new Set(
  "el la los las un una unos unas de del al a y o que en con por para se su sus es son lo como mas más pero no si ya muy the a an of and or to in on for is are it that this with as by be from at".split(" "),
);

export function normalize(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w))
    .map((w) => w.replace(/(es|s)$/, ""));
}

export function gradeOffline(answer: string, ideal: string): { verdict: "correct" | "partial" | "incorrect" | "off_topic"; score: number } {
  const a = new Set(normalize(answer));
  const keys = Array.from(new Set(normalize(ideal)));
  if (a.size === 0) return { verdict: "off_topic", score: 0 };
  if (keys.length === 0) return { verdict: "partial", score: 0.5 };
  const hit = keys.filter((k) => a.has(k) || [...a].some((w) => w.length > 4 && (w.startsWith(k.slice(0, 5)) || k.startsWith(w.slice(0, 5))))).length;
  const score = hit / keys.length;
  return { verdict: score >= 0.5 ? "correct" : score >= 0.25 ? "partial" : "incorrect", score };
}
