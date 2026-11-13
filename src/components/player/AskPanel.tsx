"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { isDemoMode, useHealth } from "@/lib/useHealth";
import { postSSE } from "@/lib/sse/client";
import { getStage } from "@/engine/stage/stageRef";
import type { AskReplay, Beat, CameraPreset, InsertedSegment, Layer, Level, Transition, World } from "@/lib/world/types";
import { normalize } from "@/demo/offlineGrader";
import { IconClose } from "@/components/ui/icons";
import { beatSummary, uniquify } from "./grow";
import { usePlayer, type EffectiveBeat } from "./playerStore";
import { citationLocation } from "@/lib/world/verification";

export interface AskContext {
  beatId: string;
  beatTitle: string;
  beatIndex: number;
  region?: string;
  question: string;
}

interface Answer {
  q: string;
  parts: { text: string; factIds: string[] }[];
  project?: { caption: string; layers: Layer[]; transition: Transition; camera: CameraPreset } | null;
  replay?: boolean;
  error?: boolean;
}

const WHAT_IF = /^\s*(¿\s*)?(y\s+si|what\s+if)\b/i;

function similarity(a: string, b: string): number {
  const A = new Set(normalize(a));
  const B = new Set(normalize(b));
  if (!A.size || !B.size) return 0;
  let hit = 0;
  for (const w of A) if (B.has(w)) hit++;
  return hit / Math.max(A.size, B.size);
}

const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

/** Dialogue panel (spec 3.8, 3.9): single-turn Tutor answers with citations; "What if…?" grows a branch. */
export function AskPanel({ world, context, level, beats, onClose, onBranch }: { world: World; context: AskContext; level: Level; beats: EffectiveBeat[]; onClose: () => void; onBranch: (seg: InsertedSegment) => void }) {
  const { t } = useI18n();
  const id = useId();
  const demo = isDemoMode(useHealth());
  const lang = world.spec.language;
  const storeKey = `eidos:ask:${world.id}`;
  const [q, setQ] = useState(context.question);
  const [busy, setBusy] = useState<string | null>(null);
  const [history, setHistory] = useState<Answer[]>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(storeKey) ?? "[]") as Answer[];
    } catch {
      return [];
    }
  });
  const [streaming, setStreaming] = useState<Answer | null>(null);
  const [suggest, setSuggest] = useState<{ kind: "ask" | "branch"; items: string[] } | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const facts = useMemo(() => new Map(world.facts.map((f) => [f.id, f])), [world]);
  const beat = beats.find((b) => b.beat.id === context.beatId)?.beat;

  useEffect(() => {
    input.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    try {
      sessionStorage.setItem(storeKey, JSON.stringify(history.slice(-20)));
    } catch {
      /* ignore */
    }
  }, [history, storeKey]);

  const push = (a: Answer) => setHistory((h) => [...h, a]);

  const typeOut = async (a: Answer) => {
    // Replays stream at a human-readable pace, like the live Tutor would.
    const full = a.parts;
    const cur: Answer = { ...a, parts: [] };
    for (const p of full) {
      cur.parts = [...cur.parts, { text: "", factIds: p.factIds }];
      for (let i = 0; i <= p.text.length; i += 3) {
        cur.parts[cur.parts.length - 1] = { text: p.text.slice(0, i), factIds: p.factIds };
        setStreaming({ ...cur, parts: [...cur.parts] });
        await wait(12);
      }
      cur.parts[cur.parts.length - 1] = p;
    }
    setStreaming(null);
    push(a);
  };

  const branch = async (question: string) => {
    if (!beat) return;
    if (demo) {
      const all = world.demoAssets?.branches ?? {};
      const entry = Object.entries(all).find(([k, bs]) => k === beat.id && similarity(question, bs[0]?.title ?? "") > 0) ?? Object.entries(all).find(([, bs]) => similarity(question, (bs[0]?.title ?? "") + " " + (bs[0]?.sentences.map((s) => s.text).join(" ") ?? "")) >= 0.25);
      if (!entry) {
        setSuggest({ kind: "branch", items: Object.values(all).map((bs) => bs[0]?.title ?? "").filter(Boolean) });
        return;
      }
      setBusy(t("ask.branching"));
      await wait(1600);
      const n = world.inserted.filter((s) => s.reason === "branch").length + 1;
      onBranch({ afterBeatId: entry[0], beats: uniquify(entry[1], `x${String(n).padStart(2, "0")}`), reason: "branch", createdAt: new Date().toISOString(), meta: { question, replay: "1" } });
      setBusy(null);
      push({ q: question, parts: [{ text: t("ask.branchReady"), factIds: [] }], replay: true });
      return;
    }
    setBusy(t("ask.branching"));
    const n = world.inserted.filter((s) => s.reason === "branch").length + 1;
    const got: Beat[] = [];
    try {
      await postSSE(
        "/api/fork",
        {
          worldSummary: world.spec.beats.map(beatSummary),
          fromBeatId: beat.id,
          question,
          facts: world.facts.map((f) => ({ id: f.id, text: f.text, conceptId: f.conceptId, origin: f.origin, citations: f.citations.slice(0, 1) })),
          misconceptions: world.misconceptions,
          concepts: world.spec.concepts,
          palette: world.spec.palette,
          idPrefix: `x${String(n).padStart(2, "0")}`,
          level,
          lang,
          quality: "deep",
        },
        (ev, data) => {
          if (ev === "beat") got.push(data as Beat);
          if (ev === "usage") usePlayer.getState().addTelemetry(data as World["telemetry"][number]);
        },
      );
      if (got.length) {
        onBranch({ afterBeatId: beat.id, beats: got, reason: "branch", createdAt: new Date().toISOString(), meta: { question } });
        push({ q: question, parts: [{ text: t("ask.branchReady"), factIds: [] }] });
      } else push({ q: question, parts: [{ text: t("ask.error"), factIds: [] }], error: true });
    } finally {
      setBusy(null);
    }
  };

  const ask = async (question: string) => {
    setSuggest(null);
    if (!question.trim()) return;
    setQ("");
    if (WHAT_IF.test(question)) return branch(question);
    if (demo) {
      const replays = world.demoAssets?.askReplays ?? [];
      const scored = replays.map((r) => ({ r, s: similarity(question, r.question) + (r.beatId === context.beatId ? 0.1 : 0) })).sort((a, b) => b.s - a.s);
      const best = scored[0];
      if (!best || best.s < 0.3) {
        setSuggest({ kind: "ask", items: replays.map((r) => r.question) });
        return;
      }
      setBusy(t("ask.thinking"));
      await wait(700);
      setBusy(null);
      await typeOut({ q: question, parts: best.r.answer, project: best.r.project ?? null, replay: true });
      return;
    }
    setBusy(t("ask.thinking"));
    const cur: Answer = { q: question, parts: [{ text: "", factIds: [] }] };
    try {
      await postSSE(
        "/api/ask",
        {
          sessionToken: world.sessionToken,
          worldId: world.id,
          beat: beat ? beatSummary(beat) : { id: context.beatId, kind: "concept", title: context.beatTitle, shapes: [], sentences: [] },
          regionId: context.region,
          question,
          history: history.slice(-3).map((h) => ({ q: h.q, a: h.parts.map((p) => p.text).join(" ").slice(0, 1800) })),
          level,
          lang,
          facts: world.facts.map((f) => ({ id: f.id, text: f.text })),
        },
        (ev, data) => {
          if (ev === "text") {
            setBusy(null);
            const d = data as { delta: string };
            cur.parts[cur.parts.length - 1]!.text += d.delta;
          } else if (ev === "citation") {
            const c = data as { factIds: string[] };
            cur.parts[cur.parts.length - 1]!.factIds.push(...c.factIds);
            cur.parts.push({ text: "", factIds: [] });
          } else if (ev === "project") cur.project = data as Answer["project"];
          else if (ev === "usage") usePlayer.getState().addTelemetry(data as World["telemetry"][number]);
          else if (ev === "error") cur.error = true;
          setStreaming({ ...cur, parts: cur.parts.map((p) => ({ ...p })) });
        },
      );
    } catch {
      cur.error = true;
    }
    setBusy(null);
    setStreaming(null);
    push(cur.error && !cur.parts.some((p) => p.text) ? { ...cur, parts: [{ text: t("ask.error"), factIds: [] }] } : { ...cur, parts: cur.parts.filter((p) => p.text.trim()) });
  };

  const project = async (p: NonNullable<Answer["project"]>) => {
    const stage = getStage();
    const client = stage?.client;
    if (!stage || !client) return;
    const built = await client.buildEvent(p.layers, stage.activeIndex, p.transition, 0.06, `project:${p.caption}`);
    stage.eventTo(built, p.transition, 900, { hold: true, camera: p.camera });
  };

  const renderAnswer = (a: Answer, key: string) => {
    const cited: string[] = [];
    for (const p of a.parts) for (const f of p.factIds) if (!cited.includes(f)) cited.push(f);
    return (
      <article key={key} className="ask-answer">
        <p className="ask-q caps">{a.q}</p>
        <p className="ask-a">
          {a.parts.map((p, i) => (
            <span key={i}>
              {p.text}
              {p.factIds.map((f) => (
                <sup key={f} className="ask-ref mono">
                  {cited.indexOf(f) + 1}
                </sup>
              ))}{" "}
            </span>
          ))}
        </p>
        {a.replay && <p className="caps ask-replay">{t("ask.replay")}</p>}
        {cited.length > 0 && (
          <ol className="ask-sources">
            {cited.map((f) => {
              const fact = facts.get(f);
              const c = fact?.citations[0];
              return (
                <li key={f}>
                  <span className="mono">{cited.indexOf(f) + 1}</span> {c ? `“${c.citedText.trim().slice(0, 180)}” — ${c.title ?? c.documentTitle}${citationLocation(c, lang) ? `, ${citationLocation(c, lang)}` : ""}` : `${fact?.text ?? f} (${t("ask.general")})`}
                </li>
              );
            })}
          </ol>
        )}
        {a.project && (
          <button type="button" className="btn-secondary" onClick={() => void project(a.project!)}>
            {t("ask.project")} — {a.project.caption}
          </button>
        )}
      </article>
    );
  };

  return (
    <aside className="ask-panel" role="dialog" aria-modal="false" aria-labelledby={`${id}-h`} data-ui>
      <header className="ask-head">
        <div>
          <h2 id={`${id}-h`} className="caps">
            {t("ask.title")}
          </h2>
          <p className="ui ask-ctx">{t("ask.context", { n: context.beatIndex, title: context.beatTitle })}</p>
          {context.region && <p className="caps ask-ctx">{t("ask.region", { region: context.region })}</p>}
        </div>
        <button type="button" className="btn-icon" aria-label={t("ui.close")} onClick={onClose}>
          <IconClose />
        </button>
      </header>
      <div className="ask-log" aria-live="polite">
        {history.map((a, i) => renderAnswer(a, `h${i}`))}
        {streaming && renderAnswer(streaming, "s")}
        {busy && <p className="ask-busy ui">{busy}</p>}
        {suggest && (
          <div className="ask-suggest">
            <p className="caps">{suggest.kind === "ask" ? t("ask.demoOnly") : t("ask.demoBranches")}</p>
            {suggest.items.map((s) => (
              <button key={s} type="button" className="btn-secondary" onClick={() => void (suggest.kind === "ask" ? ask(s) : branch(lang === "es" ? `¿Y si ${s.replace(/^¿?y si\s*/i, "")}` : s))}>
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
      <form
        className="ask-form"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(q);
        }}
      >
        <label className="sr-only" htmlFor={`${id}-q`}>
          {t("ask.title")}
        </label>
        <textarea
          id={`${id}-q`}
          ref={input}
          className="field"
          rows={2}
          maxLength={600}
          value={q}
          placeholder={t("ask.placeholder")}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void ask(q);
            }
          }}
        />
        <div className="ask-actions">
          <button type="button" className="btn-secondary" onClick={() => setQ(lang === "es" ? "¿Y si " : "What if ")}>
            {t("ask.whatIf")}
          </button>
          <button type="submit" className="btn-primary" disabled={!!busy || !q.trim()}>
            {t("ask.send")}
          </button>
        </div>
      </form>
    </aside>
  );
}

export type { AskReplay };
