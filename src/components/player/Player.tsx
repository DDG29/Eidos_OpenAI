"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useSettings, prefersReducedMotion } from "@/lib/settings/store";
import { Narrator } from "@/engine/audio/Narrator";
import { loadWorld } from "@/lib/storage/worlds";
import { whenStage, getStage } from "@/engine/stage/stageRef";
import { stageStore, useStage } from "@/engine/stage/stageStore";
import { programFromBeats } from "@/engine/stage/programFromBeats";
import { ScrollConductor } from "@/engine/scroll/ScrollConductor";
import { pick } from "@/engine/interaction/Picker";
import { PALETTES } from "@/engine/palettes";
import { hashString } from "@/engine/util/rng";
import type { Annotation, Beat, Level, World } from "@/lib/world/types";
import { constellationLayer, masteryBrightness } from "@/lib/world/constellation";
import { describeScene } from "@/lib/world/describe";
import { filamentStatus, passagesFor, verdictLabel } from "@/lib/world/verification";
import { gradeOffline } from "@/demo/offlineGrader";
import { isDemoMode, useHealth } from "@/lib/useHealth";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { assembleWorld, findSessionForWorld, useForgeStore } from "@/lib/forge/session";
import { TopBar, SoundToggle } from "@/components/ui/TopBar";
import { LensDial } from "@/components/ui/LensDial";
import { Ruler, type RulerMark } from "@/components/ui/Ruler";
import { RevealText } from "@/components/ui/RevealText";
import { IconMore, IconRead, IconShare } from "@/components/ui/icons";
import { Astrolabe } from "./Astrolabe";
import { Annotations } from "./Annotations";
import { RadialMenu } from "./RadialMenu";
import { Filament } from "./Filament";
import { KnobControl } from "./KnobControl";
import { CheckBlock } from "./CheckBlock";
import { effectiveBeats, usePlayer, type CheckResult, type EffectiveBeat } from "./playerStore";
import { growRemedial } from "./grow";
import { AskPanel, type AskContext } from "./AskPanel";
import { EngineRoom } from "./EngineRoom";
import { PlayerMenu } from "./PlayerMenu";
import { ShareDialog } from "./ShareDialog";
import { rewriteLens } from "./lens";
import { useSound } from "@/engine/audio/useSound";

const HEIGHT: Partial<Record<Beat["kind"], number>> = { check: 120, finale: 200 };

export function Player({ worldId, present = false, brightnessFor }: { worldId: string; present?: boolean; brightnessFor?: (beatId: string) => Record<string, number> | undefined }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const motion = useSettings((s) => s.motion);
  const health = useHealth();
  const world = usePlayer((s) => s.world);
  const level = usePlayer((s) => s.level);
  const checks = usePlayer((s) => s.checks);
  const growing = usePlayer((s) => s.growing);
  const freshIds = usePlayer((s) => s.freshIds);
  const [missing, setMissing] = useState(false);
  const [active, setActive] = useState(0);
  const [local, setLocal] = useState(0);
  const [radial, setRadial] = useState<{ x: number; y: number; region: string; regionIndex: number; layer: number; world: [number, number, number]; radius: number } | null>(null);
  const [ask, setAsk] = useState<AskContext | null>(null);
  const [engineRoom, setEngineRoom] = useState(false);
  const [menu, setMenu] = useState(false);
  const [share, setShare] = useState(false);
  // index of the gate whose "answer to continue" hint is showing (derived per gate, no reset needed)
  const [gateMsgFor, setGateMsgFor] = useState<number | null>(null);
  const [busyCheck, setBusyCheck] = useState<string | null>(null);
  const [lensNote, setLensNote] = useState<string | null>(null);
  const mobile = useMediaQuery("(max-width: 767px)");
  const conductor = useRef<ScrollConductor | null>(null);
  const programReady = useRef(false);
  const sound = useSound();

  useEffect(() => {
    void health.load();
  }, [health]);


  // Load the world
  useEffect(() => {
    let alive = true;
    void loadWorld(worldId, locale).then((w) => {
      if (!alive) return;
      if (!w) return setMissing(true);
      usePlayer.getState().setWorld(w);
    });
    return () => {
      alive = false;
    };
  }, [worldId, locale]);

  // Early entry (spec 3.5): while the forge keeps streaming, new beats and verdicts flow into the open world.
  useEffect(() => {
    if (!world?.id) return;
    const live = findSessionForWorld(world.id);
    if (!live) return;
    return useForgeStore.subscribe((st) => {
      const s = st.sessions[live.id];
      if (!s) return;
      const w = assembleWorld(s, "forged");
      if (w) usePlayer.getState().mergeLive(w);
    });
  }, [world?.id]);

  const beats: EffectiveBeat[] = useMemo(() => (world ? effectiveBeats(world, level, freshIds) : []), [world, level, freshIds]);
  const facts = useMemo(() => new Map((world?.facts ?? []).map((f) => [f.id, f])), [world]);
  const lang = world?.spec.language ?? locale;
  const palette = world ? PALETTES[world.spec.palette] : null;

  // The first unanswered check gates progress (spec 3.7 compuerta suave).
  const gateIndex = useMemo(() => {
    const i = beats.findIndex((b) => b.beat.kind === "check" && (!checks[b.beat.id] || checks[b.beat.id]!.status === "pending" || (checks[b.beat.id]!.status === "incorrect" && !!growing)));
    return i >= 0 ? i : null;
  }, [beats, checks, growing]);

  // Program (shapes) for the engine; the finale becomes the mastery constellation.
  const programBeats = useMemo(() => {
    if (!world) return [];
    return beats.map((e) => (e.beat.kind === "finale" ? { ...e.beat, layers: [constellationLayer(world.spec.concepts)] } : e.beat));
  }, [beats, world]);
  const brightness = useMemo(() => (world ? masteryBrightness(world.spec.concepts, world.mastery) : {}), [world]);
  const programKey = useMemo(() => hashString(JSON.stringify(programBeats.map((b) => [b.id, b.layers]))) + ":" + hashString(JSON.stringify(brightness)), [programBeats, brightness]);
  const prevKey = useRef<string | null>(null);
  const prevIds = useRef<string[]>([]);

  useEffect(() => {
    if (!world || !programBeats.length) return;
    let alive = true;
    void (async () => {
      const stage = await whenStage();
      if (!alive) return;
      const { input, opts } = programFromBeats(`world:${world.id}`, world.spec.palette, programBeats, stage.N);
      const finale = input.beats.findIndex((b) => b.id === programBeats.find((x) => x.kind === "finale")?.id);
      if (finale >= 0) input.beats[finale] = { ...input.beats[finale]!, brightness };
      if (brightnessFor) input.beats = input.beats.map((b) => (brightnessFor(b.id) ? { ...b, brightness: brightnessFor(b.id) } : b));
      if (!prevKey.current || stageStore.getState().programId !== input.id) {
        const fromOther = stageStore.getState().programId !== null;
        await stage.loadProgram(input, { ...opts, enterMs: fromOther ? 900 : 0 });
      } else {
        // Insertions / mastery: recompile from the first changed beat only (spec 5.8).
        const ids = programBeats.map((b) => b.id);
        let from = ids.findIndex((id, i) => prevIds.current[i] !== id);
        if (from < 0) from = finale >= 0 ? finale : ids.length - 1;
        await stage.updateProgram(input, Math.max(0, Math.min(from, finale >= 0 ? finale : from)), opts.cameras);
      }
      prevKey.current = programKey;
      prevIds.current = programBeats.map((b) => b.id);
      programReady.current = true;
      const c = conductor.current;
      if (c) stage.setScroll(c.state.index, c.state.local);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programKey, world?.id]);

  // Palette accent drives the UI accent while inside the world.
  useEffect(() => {
    if (!palette) return;
    document.documentElement.style.setProperty("--accent", palette.accent);
    return () => {
      document.documentElement.style.removeProperty("--accent");
    };
  }, [palette]);

  useEffect(() => {
    document.documentElement.dataset.present = present ? "1" : "";
    return () => void (document.documentElement.dataset.present = "");
  }, [present]);

  // Scroll conductor
  useEffect(() => {
    if (!world) return;
    const c = new ScrollConductor({ reducedMotion: prefersReducedMotion(motion), onGate: (g) => setGateMsgFor(g) });
    conductor.current = c;
    let last = -1;
    let lastL = -1;
    const unsub = c.subscribe((st) => {
      if (st.index !== last) {
        last = st.index;
        setActive(st.index);
        setRadial(null);
        getStage()?.rig.clearZoom();
      }
      const q = Math.round(st.local * 20) / 20;
      if (q !== lastL) {
        lastL = q;
        setLocal(q);
      }
      if (programReady.current) getStage()?.setScroll(st.index, st.local, c.isJumping ? 1 : 0);
    });
    // deep link (#beat-b05)
    const hash = window.location.hash.replace("#beat-", "");
    if (hash) {
      const i = effectiveBeats(world, usePlayer.getState().level, new Set()).findIndex((b) => b.beat.id === hash);
      if (i > 0) requestAnimationFrame(() => c.scrollToBeat(i, { immediate: true }));
    }
    return () => {
      unsub();
      c.destroy();
      conductor.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world?.id, motion]);

  useEffect(() => {
    conductor.current?.setGate(gateIndex);
  }, [gateIndex]);

  useEffect(() => {
    const b = beats[active]?.beat;
    if (b) sound.onBeat(b.ambient, world?.spec.palette ?? "aurora");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const jump = useCallback((i: number) => conductor.current?.scrollToBeat(i), []);

  // Voice narration (spec 12.7): read the beat the reading point settles on; leaving it stops the voice.
  const voiceOn = useSettings((s) => s.voice);
  const stageStatus = useStage((s) => s.status);
  const narrator = useRef<Narrator | null>(null);
  useEffect(() => {
    narrator.current ??= new Narrator();
    const n = narrator.current;
    if (!voiceOn) {
      n.stop();
      return;
    }
    const id = window.setTimeout(() => {
      const el = document.querySelector<HTMLElement>("[data-narration-active]");
      const { voiceName, voiceRate } = useSettings.getState();
      if (el) n.speak(el, { lang: lang === "es" ? "es-MX" : "en-US", voiceName, rate: voiceRate });
    }, 700);
    return () => {
      window.clearTimeout(id);
      n.stop();
    };
  }, [active, voiceOn, lang]);


  // Ask the scene: click on the form (not on UI) → nearest region → radial menu (spec 5.10)
  useEffect(() => {
    let down: { x: number; y: number; t: number } | null = null;
    let longPress: number | null = null;
    const isUi = (el: EventTarget | null) => !!(el as HTMLElement | null)?.closest?.("[data-ui], button, a, input, textarea, select, label, .topbar, .astrolabe, .ruler, .ask-panel, .engine-room");
    const doPick = (x: number, y: number) => {
      const stage = getStage();
      const buf = stage?.currentBuffer();
      if (!stage || !buf) return;
      const r = pick(buf, stage.rig.camera, window.innerWidth, window.innerHeight, x, y, stage.motionTime, stage.currentPivots());
      if (!r) return;
      setRadial({ x, y, region: r.region.label ?? r.region.id.replace(/_/g, " "), regionIndex: r.regionIndex, layer: r.region.layerIndex, world: [r.worldPoint.x, r.worldPoint.y, r.worldPoint.z], radius: Math.max(0.12, r.region.radius) });
      stage.setHighlight({ index: r.regionIndex, range: r.region.range });
      // Finale: tapping a star scrolls to the first beat of that concept.
      const cur = beats[conductor.current?.state.index ?? 0]?.beat;
      if (cur?.kind === "finale" && world && /^node_\d+$/.test(r.region.id)) {
        const concept = world.spec.concepts[Number(r.region.id.slice(5))];
        const target = concept ? beats.findIndex((b) => b.beat.conceptIds.includes(concept.id)) : -1;
        if (target >= 0) {
          setRadial(null);
          jump(target);
        }
      }
    };
    const onDown = (e: PointerEvent) => {
      if (isUi(e.target)) return;
      down = { x: e.clientX, y: e.clientY, t: performance.now() };
      if (e.pointerType === "touch") longPress = window.setTimeout(() => down && doPick(down.x, down.y), 520);
    };
    const onUp = (e: PointerEvent) => {
      if (longPress) window.clearTimeout(longPress);
      if (!down || isUi(e.target)) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      if (moved < 6 && e.pointerType !== "touch") doPick(e.clientX, e.clientY);
      down = null;
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
    };
  }, [beats, world, jump]);

  useEffect(() => {
    if (!radial) getStage()?.setHighlight(null);
  }, [radial]);

  const openAsk = useCallback(
    (preset: { question: string; region?: string } | null) => {
      const b = beats[conductor.current?.state.index ?? active]?.beat;
      if (!b || !world) return;
      setAsk({ beatId: b.id, beatTitle: b.title, beatIndex: (conductor.current?.state.index ?? active) + 1, region: preset?.region, question: preset?.question ?? "" });
    },
    [beats, active, world],
  );

  /* ——— Lens ——— */
  const changeLevel = useCallback(
    async (l: Level) => {
      const w = usePlayer.getState().world;
      if (!w) return;
      if (l === w.spec.level || w.levelVariants[l]) {
        usePlayer.getState().setLevel(l);
        setLensNote(null);
        return;
      }
      if (isDemoMode(useHealth.getState())) {
        setLensNote(t("lens.unavailable"));
        return;
      }
      setLensNote(t("lens.rewriting"));
      const ok = await rewriteLens(w, l);
      setLensNote(ok ? null : t("error.EIDOS_E_UNKNOWN"));
      if (ok) usePlayer.getState().setLevel(l);
    },
    [t],
  );

  // Keyboard shortcuts (spec 13.1)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.metaKey || e.ctrlKey || e.altKey) return;
      const c = conductor.current;
      if (!c) return;
      switch (e.key) {
        case "j":
        case "ArrowDown":
        case "ArrowRight":
          e.preventDefault();
          c.next();
          break;
        case "k":
        case "ArrowUp":
        case "ArrowLeft":
          e.preventDefault();
          c.prev();
          break;
        case "/":
          e.preventDefault();
          openAsk(null);
          break;
        case "r":
          router.push(`/m/${worldId}/leer`);
          break;
        case "s":
          useSettings.getState().set({ sound: !useSettings.getState().sound });
          break;
        case "p":
          router.replace(present ? `/m/${worldId}` : `/m/${worldId}?present=1`);
          break;
        case "f":
          void (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.());
          break;
        case "l": {
          const lv: Level[] = ["curioso", "prepa", "universidad", "experto"];
          void changeLevel(lv[(lv.indexOf(usePlayer.getState().level) + 1) % 4]!);
          break;
        }
        case "Escape":
          setRadial(null);
          setAsk(null);
          setEngineRoom(false);
          setMenu(false);
          getStage()?.rig.clearZoom();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worldId, present]);

  /* ——— Checks ——— */
  const onCheckResult = useCallback(
    async (b: Beat, r: CheckResult) => {
      const stage = getStage();
      usePlayer.getState().answer(b.id, r);
      if (r.status === "correct") {
        stage?.flash("#6CF5B0");
        sound.event("correct");
      } else if (r.status === "incorrect") {
        const w = usePlayer.getState().world!;
        const conceptId = b.check.conceptIds[0] ?? b.conceptIds[0] ?? "";
        const grown = usePlayer.getState().growthsByConcept[conceptId] ?? 0;
        if (grown >= 2) return; // never an endless loop: the explanation is shown instead
        stage?.setCrack(true);
        sound.event("crack");
        const idx = beats.findIndex((x) => x.beat.id === b.id);
        await growRemedial({ world: w, checkBeat: b, result: r, level: usePlayer.getState().level, demo: isDemoMode(useHealth.getState()), conceptId, lang });
        stage?.setCrack(false);
        sound.event("grow");
        // Move into the new chapter once its sections exist.
        window.setTimeout(() => conductor.current?.scrollToBeat(idx + 1), 760);
      }
    },
    [beats, lang, sound],
  );

  const answerChoice = useCallback(
    (b: Beat, i: number) => {
      const ch = b.check.choices[i];
      const correct = i === b.check.correctIndex;
      const mis = ch?.misconceptionId ? usePlayer.getState().world?.misconceptions.find((m) => m.id === ch.misconceptionId) : undefined;
      void onCheckResult(b, { status: correct ? "correct" : "incorrect", choice: i, misconceptionId: ch?.misconceptionId || undefined, feedback: correct ? undefined : mis?.correction });
    },
    [onCheckResult],
  );

  const answerFree = useCallback(
    async (b: Beat, text: string) => {
      setBusyCheck(b.id);
      try {
        if (isDemoMode(useHealth.getState())) {
          const g = gradeOffline(text, b.check.idealAnswer);
          if (g.verdict === "off_topic") {
            usePlayer.getState().answer(b.id, { status: "pending", choice: null, feedback: t("check.offTopic"), offline: true });
            return;
          }
          await onCheckResult(b, { status: g.verdict, choice: null, freeText: text, offline: true, missingIdea: g.verdict === "partial" ? b.check.idealAnswer : undefined });
        } else {
          const { gradeAnswer } = await import("./grade");
          const r = await gradeAnswer(usePlayer.getState().world!, b, text, usePlayer.getState().level);
          if (r.verdict === "off_topic") {
            usePlayer.getState().answer(b.id, { status: "pending", choice: null, feedback: r.feedback || t("check.offTopic") });
            return;
          }
          await onCheckResult(b, { status: r.verdict, choice: null, freeText: text, feedback: r.feedback, missingIdea: r.missingIdea, misconceptionId: r.matchedMisconceptionId || undefined });
        }
      } finally {
        setBusyCheck(null);
      }
    },
    [onCheckResult, t],
  );

  /* ——— Knobs ——— */
  const knobQueue = useRef<{ busy: boolean; next: { b: Beat; v: number } | null }>({ busy: false, next: null });
  const onKnob = useCallback(async (b: Beat, v: number) => {
    const q = knobQueue.current;
    q.next = { b, v };
    if (q.busy) return;
    while (q.next) {
      const job = q.next;
      q.next = null;
      q.busy = true;
      const stage = getStage();
      const client = stage?.client;
      if (!stage || !client) break;
      const layers = job.b.layers.map((l, li) =>
        li === job.b.knob.layerIndex ? { ...l, params: [...l.params.filter((p) => p.key !== job.b.knob.paramKey), { key: job.b.knob.paramKey, value: job.v }] } : l,
      );
      const idx = beats.findIndex((x) => x.beat.id === job.b.id);
      try {
        const built = await client.buildEvent(layers, idx, "flow", 0.06, `knob:${job.b.id}:${job.v}`);
        stage.eventTo(built, "flow", 300, { hold: true });
      } catch {
        /* keep the previous form */
      }
      q.busy = false;
    }
  }, [beats]);

  /* ——— Render ——— */
  if (missing)
    return (
      <>
        <TopBar />
        <main id="main" className="page player-missing">
          <h1 className="display">{t("player.notFound")}</h1>
          <Link className="btn-primary" href="/atlas">
            {t("player.goAtlas")}
          </Link>
        </main>
      </>
    );
  if (!world) return <TopBar />;

  const cur = beats[active];
  const marks: RulerMark[] = beats.map((b, i) => ({
    key: b.beat.id,
    label: `${i + 1}. ${b.beat.title}`,
    kind: b.beat.kind === "check" ? "check" : b.origin === "trunk" ? "normal" : b.origin,
    locked: gateIndex !== null && i > gateIndex,
    fresh: b.fresh,
  }));
  const annotationsVisible = local >= 0.45 && !radial && !ask;

  return (
    <>
      <TopBar
        autoHide={present}
        center={
          <div className="player-title">
            <span className="display">{world.spec.title}</span>
          </div>
        }
        right={
          <>
            {!mobile && <LensDial value={level} onChange={(l) => void changeLevel(l)} compact />}
            <SoundToggle />
            <Link className="btn-icon" href={`/m/${worldId}/leer`} aria-label={t("player.read")} title={t("player.read")}>
              <IconRead />
            </Link>
            <button type="button" className="btn-icon" aria-label={t("player.share")} onClick={() => setShare(true)}>
              <IconShare />
            </button>
            <button type="button" className="btn-icon" aria-label={t("player.more")} aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
              <IconMore />
            </button>
          </>
        }
      />
      {menu && (
        <PlayerMenu
          world={world}
          onClose={() => setMenu(false)}
          onEngineRoom={() => setEngineRoom(true)}
          onLevel={(l) => void changeLevel(l)}
          level={level}
          mobile={mobile}
          present={present}
          worldId={worldId}
        />
      )}
      <Ruler marks={marks} active={active} onJump={jump} label={t("player.journey")} />
      {!mobile && <Astrolabe beats={beats} active={active} progress={local} onJump={jump} label={t("player.journey")} abbr={(b) => b.beat.title.split(/\s+/).slice(0, 2).join(" ")} />}
      {lensNote && (
        <p className="lens-note ui" role="status">
          {lensNote}
        </p>
      )}
      <main id="main" className="page player" data-mobile={mobile || undefined}>
        <h1 className="sr-only">{world.spec.title}</h1>
        {beats.map((e, i) => {
          const b = e.beat;
          const h = (HEIGHT[b.kind] ?? 160) * (b.weight || 1);
          const verdicts = world.verification[b.id] ?? [];
          const isActive = i === active;
          const revealed = isActive && local >= 0.2;
          const result = checks[b.id];
          const knobValue = b.knob.enabled ? (b.layers[b.knob.layerIndex]?.params.find((p) => p.key === b.knob.paramKey)?.value ?? b.knob.initial) : 0;
          const firstOfBranch = e.origin === "branch" && beats[i - 1]?.origin !== "branch";
          const lastOfBranch = e.origin === "branch" && beats[i + 1]?.origin !== "branch";
          const firstOfRemedial = e.origin === "remedial" && beats[i - 1]?.origin !== "remedial";
          return (
            <section
              key={b.id}
              id={`beat-${b.id}`}
              className="beat"
              data-beat-index={i}
              data-kind={b.kind}
              data-origin={e.origin}
              data-fresh={e.fresh || undefined}
              style={{ minHeight: `${h}vh` }}
              aria-labelledby={`h-${b.id}`}
            >
              <div className="beat-sticky">
                <div className="beat-narration" data-ui data-narration-active={isActive || undefined} data-visible={revealed || undefined}>
                  {firstOfBranch && <p className="caps beat-banner" data-kind="hypo">{t("player.hypoBanner")}</p>}
                  {firstOfRemedial && <p className="caps beat-banner" data-kind="remedial">{t("player.remedialBanner")}</p>}
                  <span className="caps beat-count" aria-hidden>
                    {b.kind === "check" ? t("check.label") : t("player.scene", { n: i + 1 })}
                  </span>
                  <RevealText as="h2" className="display beat-title" id={`h-${b.id}`} visible={revealed}>
                    {b.kind === "finale" ? world.spec.title : b.title}
                  </RevealText>
                  {b.kind === "check" ? (
                    <>
                      <p className="beat-question display">{b.check.question}</p>
                      <CheckBlock
                        beat={b}
                        result={result}
                        busy={busyCheck === b.id}
                        growing={growing?.checkId === b.id ? growing.thinking || t("check.growing") : null}
                        onChoice={(ci) => answerChoice(b, ci)}
                        onFree={(txt) => void answerFree(b, txt)}
                        onSkip={() => usePlayer.getState().answer(b.id, { status: "skipped", choice: null })}
                        onGrowMore={() => void onCheckResult(b, { ...result!, status: "incorrect" })}
                        onContinue={() => usePlayer.getState().answer(b.id, { ...result!, status: "correct" })}
                      />
                      {gateMsgFor === i && gateIndex === i && (
                        <p className="gate-msg caps" role="status">
                          {t("check.gate")}
                        </p>
                      )}
                    </>
                  ) : (
                    <div className="beat-body">
                      {(b.kind === "finale" ? [{ text: world.spec.closing, factIds: [] }] : b.sentences).map((s, si) => {
                        const v = verdicts.find((x) => x.index === si);
                        const status = filamentStatus(s, v, e.origin, facts);
                        return (
                          <span key={si} className="sentence" data-status={status}>
                            {s.text}
                            {b.kind !== "finale" && (
                              <Filament
                                status={status}
                                label={`${t("player.sourceLabel")} ${si + 1}`}
                                verdict={verdictLabel(status, lang)}
                                note={v?.note}
                                passages={passagesFor(s, facts, lang)}
                                revisedLabel={v?.revised ? t("player.revised") : undefined}
                                askLabel={t("player.askShort")}
                                onAsk={() => openAsk({ question: lang === "es" ? `¿Puedes explicarme mejor esto: «${s.text}»?` : `Can you explain this better: “${s.text}”?` })}
                              />
                            )}{" "}
                          </span>
                        );
                      })}
                    </div>
                  )}
                  {b.knob.enabled && <KnobControl knob={b.knob} value={knobValue} lang={lang} onChange={(v) => void onKnob(b, v)} />}
                  {lastOfBranch && (
                    <div className="beat-actions">
                      <button type="button" className="btn-primary" onClick={() => jump(beats.findIndex((x) => x.beat.id === e.anchor))}>
                        {t("player.backToTrunk")}
                      </button>
                      <button type="button" className="btn-secondary" onClick={() => jump(i + 1)}>
                        {t("player.keepExploring")}
                      </button>
                    </div>
                  )}
                  {b.kind === "finale" && <Finale world={world} beats={beats} onJump={jump} onNext={(topic) => router.push(`/?topic=${encodeURIComponent(topic)}#forjar`)} worldId={worldId} />}
                  <p className="sr-only">
                    {t("scene.description")}: {describeScene(b, lang)}
                  </p>
                </div>
              </div>
            </section>
          );
        })}
      </main>
      {cur && <Annotations items={cur.beat.annotations} visible={annotationsVisible} mobile={mobile} onHover={(a) => highlightAnnotation(a)} onPick={(a) => openAsk({ question: lang === "es" ? `¿Qué es esto? (${a.text})` : `What is this? (${a.text})`, region: a.text })} />}
      {radial && (
        <RadialMenu
          x={radial.x}
          y={radial.y}
          region={radial.region}
          onClose={() => setRadial(null)}
          onWhat={() => openAsk({ question: lang === "es" ? `¿Qué es esto? (${radial.region})` : `What is this? (${radial.region})`, region: radial.region })}
          onWhy={() => openAsk({ question: lang === "es" ? `¿Por qué es así? (${radial.region})` : `Why is it like this? (${radial.region})`, region: radial.region })}
          onCloser={() => {
            const s = getStage();
            s?.rig.zoomTo(new (s.rig.camera.position.constructor as typeof import("three").Vector3)(...radial.world), radial.radius);
            s?.setHighlight({ index: radial.regionIndex });
            window.setTimeout(() => getStage()?.setHighlight({ index: radial.regionIndex }), 50);
          }}
        />
      )}
      {(stageStatus === "nowebgl" || stageStatus === "lost") && (
        <p className="nowebgl-note ui" role="status" data-ui>
          {t("player.noWebgl")}{" "}
          <Link href={`/m/${encodeURIComponent(worldId)}/leer`}>{t("player.openReading")}</Link>
        </p>
      )}
      {!present && (
        <button type="button" className="ask-bar ui" data-ui onClick={() => openAsk(null)} aria-keyshortcuts="/">
          {t("player.ask")}
          <kbd className="mono">/</kbd>
        </button>
      )}
      {ask && <AskPanel world={world} context={ask} level={level} beats={beats} onClose={() => setAsk(null)} onBranch={(seg) => usePlayer.getState().insert(seg)} />}
      {engineRoom && <EngineRoom world={world} onClose={() => setEngineRoom(false)} />}
      {share && <ShareDialog world={world} onClose={() => setShare(false)} />}
    </>
  );

  function highlightAnnotation(a: Annotation | null) {
    const stage = getStage();
    const buf = stage?.currentBuffer();
    if (!stage || !buf) return;
    if (!a) return stage.setHighlight(null);
    const r = buf.regions.find((x) => x.layerIndex === a.layerIndex && x.id === a.regionId);
    if (r) stage.setHighlight({ index: r.index, range: r.range });
  }
}

function Finale({ world, beats, onJump, onNext, worldId }: { world: World; beats: EffectiveBeat[]; onJump: (i: number) => void; onNext: (topic: string) => void; worldId: string }) {
  const { t } = useI18n();
  const weakest = useMemo(() => {
    let best: { i: number; score: number } | null = null;
    for (const c of world.spec.concepts) {
      const m = world.mastery[c.id];
      const score = m?.attempts ? m.score : 0.35;
      const i = beats.findIndex((b) => b.beat.conceptIds.includes(c.id));
      if (i >= 0 && (!best || score < best.score)) best = { i, score };
    }
    return best;
  }, [world, beats]);
  return (
    <div className="finale" data-ui>
      <div className="beat-actions">
        {weakest && (
          <button type="button" className="btn-primary" onClick={() => onJump(weakest.i)}>
            {t("finale.review")}
          </button>
        )}
        <Link className="btn-secondary" href={`/m/${worldId}/leer`}>
          {t("finale.takeaway")}
        </Link>
      </div>
      {world.spec.nextTopics.length > 0 && (
        <div className="finale-next">
          <span className="caps">{t("finale.next")}</span>
          <ul>
            {world.spec.nextTopics.map((n) => (
              <li key={n}>
                <button type="button" className="btn-secondary" onClick={() => onNext(n)}>
                  {n}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
