import type { Beat, Sentence, SentenceVerdict, Verdict } from "@/lib/world/types";

export interface SkepticResult {
  beatId: string;
  index: number;
  verdict: Verdict;
  supportingFactIds: string[];
  note: string;
  revision: string;
}

/**
 * Apply the Skeptic's verdicts to a beat (spec 9.6.9). Returns the new sentences and the verdict per kept
 * sentence (indices refer to the returned sentences). Contradicted sentences are never shown.
 */
export function applyVerdicts(beat: Beat, results: SkepticResult[], factIds: ReadonlySet<string>): { sentences: Sentence[]; verdicts: SentenceVerdict[] } {
  const byIndex = new Map(results.filter((r) => r.beatId === beat.id).map((r) => [r.index, r]));
  const kept: { s: Sentence; v: SentenceVerdict | null; score: number }[] = [];
  beat.sentences.forEach((s, i) => {
    const r = byIndex.get(i);
    const support = (r?.supportingFactIds ?? []).filter((id) => factIds.has(id));
    if (!r) {
      kept.push({ s, v: null, score: 1 });
      return;
    }
    const revised = r.revision.trim();
    const base = { supportingFactIds: support, note: r.note.slice(0, 120) };
    switch (r.verdict) {
      case "supported":
        kept.push({ s: { text: s.text, factIds: Array.from(new Set([...s.factIds, ...support])) }, v: { index: 0, verdict: "supported", revised: false, ...base }, score: 3 });
        break;
      case "general":
        kept.push({ s, v: { index: 0, verdict: "general", revised: false, ...base }, score: 2 });
        break;
      case "partial":
        if (revised && support.length) kept.push({ s: { text: revised, factIds: support }, v: { index: 0, verdict: "supported", revised: true, originalText: s.text, ...base }, score: 3 });
        else kept.push({ s, v: { index: 0, verdict: "partial", revised: false, ...base }, score: 1 });
        break;
      case "unsupported":
      case "contradicted":
        if (revised && support.length) kept.push({ s: { text: revised, factIds: support }, v: { index: 0, verdict: "supported", revised: true, originalText: s.text, ...base }, score: 3 });
        else if (r.verdict === "unsupported") kept.push({ s, v: { index: 0, verdict: "unsupported", revised: false, ...base }, score: 0 });
        // contradicted without a faithful revision is dropped entirely
        break;
    }
  });
  let out = kept.filter((k) => k.score > 0);
  // Never leave a beat with fewer than 2 sentences: keep the best unsupported one, marked partial (amber).
  if (out.length < 2) {
    const rescue = kept.filter((k) => k.score === 0).slice(0, 2 - out.length);
    out = [...out, ...rescue.map((k) => ({ ...k, v: k.v ? { ...k.v, verdict: "partial" as const } : null }))];
  }
  const sentences = out.map((k) => k.s);
  const verdicts = out.flatMap((k, i) => (k.v ? [{ ...k.v, index: i }] : []));
  return { sentences, verdicts };
}
