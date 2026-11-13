"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TopBar } from "@/components/ui/TopBar";
import { Ruler, type RulerMark } from "@/components/ui/Ruler";
import { RevealText } from "@/components/ui/RevealText";
import { ForgeConsole } from "@/components/console/ForgeConsole";
import { useConsole } from "@/components/console/consoleStore";
import { AtlasGrid } from "@/components/atlas/AtlasGrid";
import { Filament } from "@/components/player/Filament";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useSettings, prefersReducedMotion } from "@/lib/settings/store";
import {
  loadDemoManifest,
  listLocalWorlds,
  type DemoManifestEntry,
  type WorldSummary,
} from "@/lib/storage/worlds";
import { whenStage } from "@/engine/stage/stageRef";
import { stageStore } from "@/engine/stage/stageStore";
import { ScrollConductor } from "@/engine/scroll/ScrollConductor";
import { programFromBeats } from "@/engine/stage/programFromBeats";
import type { World } from "@/lib/world/types";
import type { ForgeRequest } from "@/lib/forge/request";
import { startForge } from "@/lib/forge/client";

const N_MOVEMENTS = 7;

function Headline({ text }: { text: string }) {
  const words = text.split(" ");
  let k = 0;
  return (
    <h1 className="display landing-hero" aria-label={text}>
      {words.map((w, wi) => (
        <span key={wi} aria-hidden>
          <span className="hero-word">
            {Array.from(w).map((ch) => (
              <span key={k} className="hero-char" style={{ animationDelay: `${120 + k++ * 38}ms` }}>
                {ch}
              </span>
            ))}
          </span>
          {wi < words.length - 1 ? " " : null}
        </span>
      ))}
    </h1>
  );
}

export function Landing() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const motion = useSettings((s) => s.motion);
  const [active, setActive] = useState(0);
  const [demos, setDemos] = useState<DemoManifestEntry[]>([]);
  const [mine, setMine] = useState<WorldSummary[]>([]);
  const conductor = useRef<ScrollConductor | null>(null);
  const sections = useRef<(HTMLElement | null)[]>([]);
  const dropFile = useConsole((s) => s.dropFile);

  useEffect(() => {
    void loadDemoManifest().then(setDemos);
    void listLocalWorlds().then(setMine);
  }, []);

  // Engine program + scroll conductor
  useEffect(() => {
    let alive = true;
    const reduced = prefersReducedMotion(motion);
    const c = new ScrollConductor({ reducedMotion: reduced });
    conductor.current = c;
    let lastActive = -1;
    const unsub = c.subscribe((st) => {
      if (st.index !== lastActive) {
        lastActive = st.index;
        setActive(st.index);
      }
      // Fade each movement's copy in and out around its hold phase (DOM only, no React state per frame).
      sections.current.forEach((el, i) => {
        if (!el) return;
        const body = el.querySelector<HTMLElement>(".mv-body");
        if (!body || i === 0 || i === N_MOVEMENTS - 1) return;
        const s = i === st.index ? st.local : i < st.index ? 1 : 0;
        const o =
          Math.min(1, Math.max(0, (s - 0.12) / 0.18)) * (1 - Math.min(1, Math.max(0, (s - 0.82) / 0.16)));
        body.style.opacity = String(o);
        body.style.transform = `translate3d(0, ${(1 - o) * 14}px, 0)`;
      });
      void whenStage().then((stage) => stage.setScroll(st.index, st.local));
    });
    void (async () => {
      const res = await fetch("/worlds/_landing.json");
      const w = (await res.json()) as World & { frames?: number[] };
      const stage = await whenStage();
      if (!alive) return;
      const { input, opts } = programFromBeats("_landing", w.spec.palette, w.spec.beats, stage.N, w.frames);
      const fromOther =
        stageStore.getState().programId !== null && stageStore.getState().programId !== "_landing";
      await stage.loadProgram(input, { ...opts, enterMs: fromOther ? 900 : 0 });
      if (!alive) return;
      stage.setScroll(c.state.index, c.state.local);
    })();
    return () => {
      alive = false;
      unsub();
      c.destroy();
      conductor.current = null;
    };
  }, [motion]);

  // Keyboard: arrows / space advance by movement (spec 3.2)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        (e.target as HTMLElement)?.isContentEditable
      )
        return;
      if (e.key === "ArrowDown" || e.key === "PageDown" || (e.key === " " && !e.shiftKey)) {
        e.preventDefault();
        conductor.current?.scrollToBeat(Math.min(N_MOVEMENTS - 1, (conductor.current?.state.index ?? 0) + 1));
      } else if (e.key === "ArrowUp" || e.key === "PageUp" || (e.key === " " && e.shiftKey)) {
        e.preventDefault();
        conductor.current?.scrollToBeat(Math.max(0, (conductor.current?.state.index ?? 0) - 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Drop a file anywhere: switch the console mode and scroll to it (spec 3.3)
  useEffect(() => {
    const over = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) e.preventDefault();
    };
    const drop = (e: DragEvent) => {
      const f = e.dataTransfer?.files?.[0];
      if (!f) return;
      e.preventDefault();
      dropFile(f);
      conductor.current?.scrollToBeat(N_MOVEMENTS - 1, { s: 0.6 });
    };
    window.addEventListener("dragover", over);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragover", over);
      window.removeEventListener("drop", drop);
    };
  }, [dropFile]);

  const marks: RulerMark[] = useMemo(
    () =>
      Array.from({ length: N_MOVEMENTS }, (_, i) => ({
        key: `m${i}`,
        label: t("landing.movement", { n: i }),
      })),
    [t],
  );

  const onForge = useCallback(
    (req: ForgeRequest) => {
      const id = startForge(req);
      router.push(`/forja/${id}`);
    },
    [router],
  );
  const onDemoExample = useCallback(
    (id: string) => {
      if (!id) return router.push("/atlas");
      router.push(`/forja/demo-${id}`);
    },
    [router],
  );

  const examples = demos
    .filter((d) => d.language === locale || !demos.some((x) => x.id === d.id && x.language === locale))
    .map((d) => ({ id: d.id, title: d.title }));

  return (
    <>
      <TopBar />
      <Ruler
        marks={marks}
        active={active}
        label={t("nav.home")}
        onJump={(i) => conductor.current?.scrollToBeat(i)}
      />
      <main id="main" className="page landing">
        <section className="mv mv0" data-beat-index={0} ref={(el) => void (sections.current[0] = el)}>
          <Headline text={t("tagline")} />
          <div className="scroll-cue caps" aria-hidden>
            <span className="scroll-cue-ruler">
              <span />
            </span>
            {t("ui.scroll")}
          </div>
        </section>
        <section className="mv mv1" data-beat-index={1} ref={(el) => void (sections.current[1] = el)}>
          <div className="mv-sticky">
            <div className="mv-body">
              <RevealText className="lead mv-lead" visible={active === 1}>
                {t("landing.m1")}
              </RevealText>
            </div>
          </div>
        </section>
        <section className="mv mv-side" data-beat-index={2} ref={(el) => void (sections.current[2] = el)}>
          <div className="mv-sticky">
            <div className="mv-body">
              <RevealText as="h2" className="display mv-title" visible={active === 2}>
                {t("landing.m2")}
              </RevealText>
            </div>
          </div>
        </section>
        <section className="mv mv-side" data-beat-index={3} ref={(el) => void (sections.current[3] = el)}>
          <div className="mv-sticky">
            <div className="mv-body">
              <p className="display mv-title">
                {t("landing.m2b")}
                <Filament
                  status="truth"
                  label={t("landing.sampleLocation")}
                  verdict={locale === "es" ? "Respaldada" : "Supported"}
                  passages={[
                    {
                      text: t("landing.samplePassage"),
                      location: t("landing.sampleLocation"),
                      docTitle: t("landing.sampleDoc"),
                    },
                  ]}
                />
              </p>
            </div>
          </div>
        </section>
        <section className="mv mv-side" data-beat-index={4} ref={(el) => void (sections.current[4] = el)}>
          <div className="mv-sticky">
            <div className="mv-body">
              <RevealText className="lead mv-lead" visible={active === 4}>
                {t("landing.m3")}
              </RevealText>
            </div>
          </div>
        </section>
        <section className="mv mv-side" data-beat-index={5} ref={(el) => void (sections.current[5] = el)}>
          <div className="mv-sticky">
            <div className="mv-body">
              <RevealText as="h2" className="display mv-title" visible={active === 5}>
                {t("landing.m4")}
              </RevealText>
            </div>
          </div>
        </section>
        <section
          className="mv mv-console"
          data-beat-index={6}
          ref={(el) => void (sections.current[6] = el)}
          id="forjar"
        >
          <h2 className="display landing-ask">{t("landing.m5")}</h2>
          <ForgeConsole onForge={onForge} examples={examples} onDemoExample={onDemoExample} />
        </section>
        <section className="landing-atlas" aria-labelledby="atlas-h">
          <header className="landing-atlas-head">
            <h2 id="atlas-h" className="display">
              {t("landing.atlasTitle")}
            </h2>
            <p className="lead">{t("landing.atlasLead")}</p>
          </header>
          {mine.length > 0 && <AtlasGrid worlds={mine} />}
          <AtlasGrid worlds={demos.filter((d) => d.language === locale)} />
          <p className="ui landing-more">
            <Link className="btn-secondary" href="/atlas">
              {t("nav.atlas")} →
            </Link>
          </p>
        </section>
        <footer className="landing-footer caps">
          <span>{t("landing.footer")}</span>
          <nav aria-label="EIDOS">
            <Link href="/acerca">{t("nav.about")}</Link>
            <Link href="/pitch">{t("nav.pitch")}</Link>
            <Link href="/lab">{t("nav.lab")}</Link>
          </nav>
        </footer>
      </main>
    </>
  );
}
