const words = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 3);

/** Demo Mode has no live forge: send a typed question to the demo world whose title and subtitle share most words with it. */
export function bestDemoMatch(topic: string, examples: readonly { id: string; title: string; subtitle?: string }[]): string | null {
  const q = new Set(words(topic));
  let best: { id: string; score: number } | null = null;
  for (const e of examples) {
    const score = words(`${e.title} ${e.subtitle ?? ""}`).filter((w) => q.has(w)).length;
    if (score > 0 && (!best || score > best.score)) best = { id: e.id, score };
  }
  return best?.id ?? null;
}
