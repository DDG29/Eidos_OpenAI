"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n";
import { TopBar } from "@/components/ui/TopBar";
import { EngineRoom } from "@/components/player/EngineRoom";
import { takeForgeRequest } from "@/lib/forge/client";
import { assembleWorld, markCompiled, retryFromLedger, runLive, runReplay, useForgeStore, type ForgeState, type ReplayFile, type StageName } from "@/lib/forge/session";
import { useStage } from "@/engine/stage/stageStore";
import { whenStage } from "@/engine/stage/stageRef";
import { PALETTES } from "@/engine/palettes";
import { makeLayer, kv } from "@/lib/world/layer";
import { isFlatBeat } from "@/engine/stage/programFromBeats";
import type { Beat, PaletteId } from "@/lib/world/types";
import { useHealth } from "@/lib/useHealth";
import { demoHasEnglish } from "@/lib/storage/worlds";

const STAGES: StageName[] = ["ingest", "reader", "cartographer", "director", "skeptic", "compiler"];
const MODEL_OF: Partial<Record<StageName, string>> = { reader: "Sonnet 5.5", cartographer: "Opus 5.5", director: "Opus 5.5", skeptic: "Sonnet 5.5", compiler: "local" };

/** Thumbnail of a beat's form (CPU render): also the honest "compiler" progress of the theater. */
async function thumb(beat: Beat, palette: PaletteId, seed: string): Promise<string> {
  const [{ renderFigurePixels }, fonts] = await Promise.all([import("@/engine/figure/renderFigure"), import("@/engine/shapes/raster/fonts")]);
  await fonts.ensureFonts((u) => fetch(u).then((r) => r.arrayBuffer()));
  const W = 160,
    H = 100;
  const px = renderFigurePixels({ layers: beat.layers, palette, camera: beat.camera, front: isFlatBeat(beat), width: W, height: H, count: 9000, seed });
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  c.getContext("2d")?.putImageData(new ImageData(new Uint8ClampedArray(px), W, H), 0, 0);
  return c.toDataURL("image/webp", 0.8);
}

export function ForgeTheater({ sessionId }: { sessionId: string }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const session = useForgeStore((s) => s.sessions[sessionId]) as ForgeState | undefined;
  const particles = useStage((s) => s.particles);
  const [gone, setGone] = useState(false);
  const [engine, setEngine] = useState(false);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [now, setNow] = useState(() => Date.now());
  const started = useRef(false);
  const entered = useRef(false);
  const demoId = sessionId.startsWith("demo-") ? sessionId.slice(5) : null;
  const health = useHealth();

  // Start the session once (live or replay); a remount (back navigation) reuses it.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (useForgeStore.getState().sessions[sessionId]) return;
    void (async () => {
      if (demoId) {
        const lang = locale === "en" && (await demoHasEnglish(demoId)) ? ".en" : "";
        const r = (await fetch(`/replays/${demoId}${lang}.forge.json`).then((x) => (x.ok ? x : fetch(`/replays/${demoId}.forge.json`))).then((x) => (x.ok ? x.json() : null))) as ReplayFile | null;
        if (!r) return setGone(true);
        const speed = Number(new URLSearchParams(window.location.search).get("speed") ?? 2) || 2;
        await runReplay(sessionId, r, speed);
        return;
      }
      const req = takeForgeRequest(sessionId);
      if (!req) return setGone(true);
      await runLive(sessionId, req);
    })();
  }, [sessionId, demoId, locale]);

  useEffect(() => {
    void health.load();
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [health]);

  // Particles: a dark diffuse nebula that condenses as facts arrive, then a spiral of scenes (spec 3.5).
  const palette: PaletteId = session?.meta?.palette ?? "aurora";
  const phase = !session ? 0 : session.beats.length > 0 ? 3 : session.facts.length > 24 ? 2 : session.facts.length > 8 ? 1 : 0;
  useEffect(() => {
    let alive = true;
    void (async () => {
      const stage = await whenStage();
      if (!alive) return;
      const layers =
        phase === 3
          ? [makeLayer("galaxy", { share: 0.55, params: kv({ arms: 2, twist: 2.4, core: 0.1, spread: 0.18, thickness: 0.05 }), rotation: { x: 62, y: 0, z: 0 }, scale: 1.25, colorMode: "radial" }), makeLayer("nebula", { share: 0.35, params: kv({ scale: 1, density_contrast: 0.85, filaments: 0.8 }), scale: 1.5, colorMode: "palette" })]
          : [makeLayer("nebula", { share: 0.9, params: kv({ scale: 0.8 + phase * 0.35, density_contrast: 0.25 + phase * 0.3, filaments: 0.2 + phase * 0.3 }), scale: 1.7 - phase * 0.22, colorMode: "palette" })];
      const input = { id: `theater:${sessionId}`, palette, count: stage.N, beats: [{ id: `p${phase}`, layers, transition: phase === 3 ? ("swirl" as const) : ("flow" as const), dustFraction: 0.1 }] };
      if (!stage.client || stage.client.id !== input.id) await stage.loadProgram(input, { cameras: ["orbit_wide"], frames: [0], enterMs: 900 });
      else {
        const built = await stage.client.buildEvent(layers, 0, input.beats[0]!.transition, 0.1, `theater:${phase}`);
        stage.eventTo(built, input.beats[0]!.transition, 1600, { hold: true });
      }
      stage.setScroll(0, 1);
    })();
    return () => {
      alive = false;
    };
  }, [phase, palette, sessionId]);

  // Compiler stage: render a thumbnail per arriving beat (real local work, real progress).
  useEffect(() => {
    if (!session) return;
    for (const b of session.beats) {
      if (thumbs[b.id] || session.compiled.has(b.id)) continue;
      void thumb(b, palette, `${sessionId}:${b.id}`).then((src) => {
        setThumbs((m) => ({ ...m, [b.id]: src }));
        markCompiled(sessionId, b.id);
      });
      break; // one at a time; the effect re-runs as state updates
    }
  }, [session, thumbs, palette, sessionId]);

  const readyBeats = session ? session.beats.filter((b) => session.compiled.has(b.id) && (session.verified[b.id] || b.kind === "check" || b.kind === "finale" || session.stages.skeptic.status === "error")).length : 0;
  const canEnter = !!session && (readyBeats >= 3 || !!session.done) && !!(session.worldId || demoId);

  const enter = useMemo(
    () => async () => {
      if (!session || entered.current) return;
      entered.current = true;
      if (demoId) return router.push(`/m/${demoId}`);
      const w = assembleWorld(session, "forged");
      if (!w) return;
      const { saveWorld } = await import("@/lib/storage/worlds");
      await saveWorld(w);
      router.push(`/m/${w.id}`);
    },
    [session, demoId, router],
  );

  // Enter on its own 2 s after the forge finishes (spec 3.5).
  useEffect(() => {
    if (!session?.done || entered.current) return;
    const id = window.setTimeout(() => void enter(), 2000);
    return () => window.clearTimeout(id);
  }, [session?.done, enter]);

  if (gone && !session)
    return (
      <>
        <TopBar />
        <main id="main" className="page player-missing">
          <h1 className="display">{t("theater.gone")}</h1>
          <Link className="btn-primary" href="/#forjar">
            {t("theater.backToConsole")}
          </Link>
        </main>
      </>
    );

  const s = session;
  const elapsed = s ? Math.max(0, ((s.done ? s.startedAt + s.done.durationMs / (s.replay ? s.speed : 1) : now) - s.startedAt) / 1000) : 0;
  const tokens = s ? s.runs.reduce((a, r) => a + r.inputTokens + r.outputTokens, 0) : 0;
  const cost = s ? s.runs.reduce((a, r) => a + (r.costUsd ?? 0), 0) : 0;
  const sentences = s ? s.beats.reduce((a, b) => a + b.sentences.length, 0) : 0;
  const mode = s?.source?.mode ?? "text";
  const doing = (st: StageName): string => {
    if (!s) return "";
    switch (st) {
      case "ingest":
        return t(`theater.do.ingest.${mode === "image" ? "image" : mode}` as MessageKey, { pages: s.source?.pages ?? (s.stages.ingest.detail?.pages as number) ?? "…" });
      case "cartographer":
        return t("theater.do.cartographer");
      case "director":
        return t("theater.do.director");
      case "skeptic":
        return t("theater.do.skeptic", { n: sentences });
      case "compiler":
        return t("theater.do.compiler", { n: particles.toLocaleString(locale) });
      default:
        return t(`theater.stage.${st}` as MessageKey);
    }
  };
  const compilerStatus = s ? (s.beats.length === 0 ? "waiting" : s.compiled.size >= s.beats.length && s.done ? "done" : "progress") : "waiting";
  const shownStages = STAGES.filter((st) => st !== "reader" || mode === "image");
  const accent = PALETTES[palette].accent;
  const n = s?.world?.spec.beats.length ?? Math.max(8, s?.beats.length ?? 0);

  return (
    <>
      <TopBar center={<span className="display player-title">{s?.meta?.title ?? t("theater.title")}</span>} />
      <main id="main" className="page theater" style={{ ["--accent" as string]: accent }}>
        <h1 className="sr-only">{t("theater.title")}</h1>
        <section className="theater-log" aria-label={t("theater.log")} aria-live="polite">
          <h2 className="caps">{t("theater.log")}</h2>
          {/* Focusable so keyboard users can scroll the log when it overflows (mobile). */}
          <ol tabIndex={0} aria-label={t("theater.log")}>
            {shownStages.map((st, i) => {
              const state = st === "compiler" ? { status: compilerStatus, thinking: "" } : (s?.stages[st] ?? { status: "waiting", thinking: "" });
              const status = state.status === "start" ? "progress" : state.status;
              // Batches of the same agent can repeat a summary line; show each line once.
              const lines = [...new Set(state.thinking.trim().split("\n").filter(Boolean))].slice(-4);
              return (
                <li key={st} className="log-item" data-status={status}>
                  <div className="log-head">
                    <span className="log-dot" aria-hidden />
                    <span className="caps">
                      {i + 1}. {t(`theater.stage.${st}` as MessageKey)}
                    </span>
                    {MODEL_OF[st] && <span className="mono log-model">{MODEL_OF[st]}</span>}
                  </div>
                  {status !== "waiting" && <p className="ui log-doing">{status === "error" ? t(`error.${(state as { error?: { code: string } }).error?.code ?? "EIDOS_E_UNKNOWN"}` as MessageKey) : doing(st)}</p>}
                  {st === "compiler" && s && s.beats.length > 0 && (
                    <div className="log-progress" role="progressbar" aria-valuemin={0} aria-valuemax={n} aria-valuenow={s.compiled.size}>
                      <span style={{ transform: `scaleX(${Math.min(1, s.compiled.size / n)})` }} />
                    </div>
                  )}
                  {st === "cartographer" && s?.searches.length ? <p className="ui log-search">{t("theater.searching", { q: s.searches[s.searches.length - 1]! })}</p> : null}
                  {lines.length > 0 && status !== "done" && (
                    <p className="log-thinking ui" aria-hidden>
                      {lines.join(" ")}
                    </p>
                  )}
                  {status === "error" && !s?.replay && (st === "director" || st === "skeptic" || st === "cartographer" || st === "ingest") && (
                    <button type="button" className="btn-secondary" onClick={() => void retryFromLedger(sessionId)}>
                      {t("theater.retry")}
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
          {s?.errors.some((e) => e.code === "EIDOS_E_WEB_DISABLED") && <p className="ui log-note">{t("theater.noWeb")}</p>}
          {s?.stages.skeptic.status === "error" && <p className="ui log-note">{t("theater.unverified")}</p>}
        </section>

        <section className="theater-scenes" aria-label={t("theater.scenes")}>
          <svg viewBox="0 0 600 600" className="scene-ring" aria-hidden>
            <circle cx="300" cy="300" r="230" className="scene-ring-path" />
            {Array.from({ length: n }, (_, i) => {
              const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
              const b = s?.beats[i];
              const state = !b ? "empty" : s?.verified[b.id] ? (s.verified[b.id]!.results.some((r) => r.verdict === "partial") ? "partial" : "verified") : "new";
              return <circle key={i} cx={300 + Math.cos(a) * 230} cy={300 + Math.sin(a) * 230} r={b ? 7 : 3} className="scene-node" data-state={state} />;
            })}
          </svg>
          <ol className="scene-thumbs">
            {s?.beats.map((b, i) => {
              const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
              return (
                <li key={b.id} style={{ left: `${50 + Math.cos(a) * 49}%`, top: `${50 + Math.sin(a) * 49}%` }} data-on={thumbs[b.id] ? "1" : undefined}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {thumbs[b.id] && <img src={thumbs[b.id]} alt="" width={80} height={50} />}
                  <span className="caps">{b.title}</span>
                </li>
              );
            })}
          </ol>
          {canEnter && (
            <button type="button" className="btn-primary theater-enter" onClick={() => void enter()}>
              {t("theater.enter")}
            </button>
          )}
        </section>

        <section className="theater-facts" aria-label={t("theater.facts")}>
          <h2 className="caps">{t("theater.facts")}</h2>
          <p className="mono theater-counts">{t("theater.counts", { facts: s?.facts.length ?? 0, concepts: s?.ledger?.concepts.length ?? 0, mis: s?.ledger?.misconceptions.length ?? 0 })}</p>
          <ol className="fact-list">
            {(s?.facts ?? []).slice(-5).map((f, i, arr) => (
              <li key={f.id} className="fact-card" data-cited={f.citations.length > 0 || undefined} style={{ opacity: 0.35 + (0.65 * (i + 1)) / arr.length }}>
                <p className="ui">{f.text}</p>
                {f.citations[0] && (
                  <p className="fact-cite ui">
                    “{f.citations[0].citedText.slice(0, 120)}
                    {f.citations[0].citedText.length > 120 ? "…" : ""}” — {f.citations[0].startPage ? `p. ${f.citations[0].startPage}` : f.citations[0].paragraph ? `${locale === "es" ? "párr." : "par."} ${f.citations[0].paragraph}` : (f.citations[0].title ?? f.citations[0].documentTitle)}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </section>

        <footer className="theater-status mono">
          <span>
            {t("theater.elapsed")} {Math.floor(elapsed / 60)}:{String(Math.floor(elapsed % 60)).padStart(2, "0")}
          </span>
          <span>
            {t("theater.tokens")} {tokens.toLocaleString(locale)}
          </span>
          <span>
            {t("theater.cost")} ${cost.toFixed(3)}
          </span>
          {s?.replay && (
            <span className="caps theater-replay">
              {t("theater.replay")}
              {s.synthetic ? ` · ${t("theater.synthetic")}` : ""}
            </span>
          )}
          {s?.replay && (
            <span className="theater-speed" role="group" aria-label={t("theater.speed")}>
              {[1, 2, 4].map((x) => (
                <button key={x} type="button" aria-pressed={s.speed === x} onClick={() => useForgeStore.getState().patch(sessionId, { speed: x })}>
                  ×{x}
                </button>
              ))}
            </span>
          )}
          <button type="button" className="btn-secondary" onClick={() => setEngine(true)} disabled={!s}>
            {t("theater.engineRoom")}
          </button>
        </footer>
      </main>
      {engine && s && (assembleWorld(s, demoId ? "demo" : "forged") ? <EngineRoom world={assembleWorld(s, demoId ? "demo" : "forged")!} onClose={() => setEngine(false)} /> : null)}
    </>
  );
}
