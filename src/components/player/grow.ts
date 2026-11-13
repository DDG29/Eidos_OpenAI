"use client";

import type { Beat, Level, World } from "@/lib/world/types";
import type { CheckResult } from "./playerStore";
import { usePlayer } from "./playerStore";
import { postSSE } from "@/lib/sse/client";
import type { GrowRequest } from "@/lib/api/schemas";

export function beatSummary(b: Beat) {
  return { id: b.id, kind: b.kind, title: b.title, shapes: b.layers.map((l) => l.shape), sentences: b.sentences.map((s) => s.text) };
}

/** Rename inserted beat ids so repeated insertions never collide (r01a, r01b → r02a, r02b …). */
export function uniquify(beats: Beat[], prefix: string): Beat[] {
  return beats.map((b, i) => ({ ...b, id: `${prefix}${String.fromCharCode(97 + i)}` }));
}

const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

/**
 * The Gardener (spec 3.7, 9.9.1): grows 1–2 remedial beats + a simpler follow-up check after a wrong answer.
 * Demo Mode inserts the precomposed remedial chapter with the same animation, labelled as a replay.
 */
export async function growRemedial(opts: { world: World; checkBeat: Beat; result: CheckResult; level: Level; demo: boolean; conceptId: string; lang: "es" | "en" }): Promise<boolean> {
  const { world, checkBeat, result, demo, conceptId, lang } = opts;
  const store = usePlayer.getState();
  const n = world.inserted.filter((s) => s.reason === "remedial").length + 1;
  const prefix = `r${String(n).padStart(2, "0")}`;
  const mis = world.misconceptions.find((m) => m.id === result.misconceptionId);
  const focus = mis?.wrongIdea ?? result.missingIdea ?? checkBeat.check.question;
  store.setGrowing({ checkId: checkBeat.id, thinking: "" });
  try {
    if (demo) {
      const beats = world.demoAssets?.remedials?.[checkBeat.id];
      if (!beats?.length) return false;
      const lines =
        lang === "es"
          ? [`Repetición · El Jardinero detecta la idea: «${focus}».`, "Busca un ángulo nuevo y una forma distinta…", "Prepara una comprobación más sencilla."]
          : [`Replay · The Gardener spots the idea: “${focus}”.`, "Looking for a new angle and a different form…", "Preparing a simpler check."];
      for (const l of lines) {
        usePlayer.getState().setGrowing({ checkId: checkBeat.id, thinking: l });
        await wait(1100);
      }
      usePlayer.getState().insert({ afterBeatId: checkBeat.id, beats: uniquify(beats, prefix), reason: "remedial", createdAt: new Date().toISOString(), meta: { conceptId, replay: "1", misconceptionId: result.misconceptionId ?? "" } });
      return true;
    }
    const req: GrowRequest = {
      worldSummary: world.spec.beats.map(beatSummary),
      checkBeat,
      answer: result.freeText ?? (result.choice !== null ? (checkBeat.check.choices[result.choice]?.text ?? "") : ""),
      grade: { verdict: result.status, missingIdea: result.missingIdea ?? "", matchedMisconceptionId: result.misconceptionId ?? "" },
      facts: world.facts.map((f) => ({ id: f.id, text: f.text, conceptId: f.conceptId, origin: f.origin, citations: f.citations.slice(0, 2) })),
      misconceptions: world.misconceptions,
      concepts: world.spec.concepts,
      palette: world.spec.palette,
      idPrefix: prefix,
      level: opts.level,
      lang,
      quality: "deep",
    };
    const beats: Beat[] = [];
    let thinking = "";
    await postSSE("/api/grow", req, (ev, data) => {
      if (ev === "thinking") {
        thinking = (thinking + (data as { delta: string }).delta).slice(-240);
        usePlayer.getState().setGrowing({ checkId: checkBeat.id, thinking });
      } else if (ev === "beat") beats.push(data as Beat);
      else if (ev === "usage") usePlayer.getState().addTelemetry(data as World["telemetry"][number]);
    });
    if (!beats.length) return false;
    usePlayer.getState().insert({ afterBeatId: checkBeat.id, beats, reason: "remedial", createdAt: new Date().toISOString(), meta: { conceptId, misconceptionId: result.misconceptionId ?? "" } });
    return true;
  } catch {
    return false;
  } finally {
    usePlayer.getState().setGrowing(null);
  }
}
