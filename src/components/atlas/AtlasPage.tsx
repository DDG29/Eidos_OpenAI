"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n";
import { TopBar } from "@/components/ui/TopBar";
import { AtlasGrid } from "./AtlasGrid";
import { listLocalWorlds, loadDemoManifest, saveWorld, type DemoManifestEntry, type WorldSummary } from "@/lib/storage/worlds";
import { parseWorldFile } from "@/lib/share";
import { LEVELS, type Level } from "@/lib/world/types";
import { whenStage } from "@/engine/stage/stageRef";
import { makeLayer, kv } from "@/lib/world/layer";

/** /atlas (spec 3.4): demo + local worlds, filters by level and topic, import a .eidos.json file. */
export function AtlasPage({ initialDemos = [] }: { initialDemos?: DemoManifestEntry[] }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [demos, setDemos] = useState<DemoManifestEntry[]>(initialDemos);
  const hasInitial = initialDemos.length > 0;
  const [mine, setMine] = useState<WorldSummary[]>([]);
  const [level, setLevel] = useState<Level | "all">("all");
  const [topic, setTopic] = useState<string>("all");
  const [error, setError] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!hasInitial) void loadDemoManifest().then(setDemos);
    void listLocalWorlds().then(setMine);
    void whenStage().then((stage) =>
      stage.loadProgram(
        { id: "atlas", palette: "aurora", count: stage.N, beats: [{ id: "a", layers: [makeLayer("galaxy", { share: 0.7, params: kv({ arms: 3, spread: 0.4 }), rotation: { x: 70, y: 0, z: 0 }, scale: 1.6, colorMode: "radial" })], transition: "swirl", dustFraction: 0.25 }] },
        { cameras: ["orbit_wide"], frames: [0], enterMs: 900 },
      ),
    );
  }, [hasInitial]);

  const palettes = useMemo(() => Array.from(new Set(demos.map((d) => d.palette))), [demos]);
  const filter = (w: WorldSummary) => (level === "all" || w.level === level) && (topic === "all" || w.palette === topic);
  const shownDemos = demos.filter((d) => d.language === locale).filter(filter);

  return (
    <>
      <TopBar />
      <main id="main" className="page atlas-page">
        <header className="atlas-page-head">
          <h1 className="display">{t("landing.atlasTitle")}</h1>
          <p className="lead">{t("landing.atlasLead")}</p>
        </header>
        <div className="atlas-filters">
          <fieldset className="console-seg">
            <legend className="caps">{t("console.lens")}</legend>
            {(["all", ...LEVELS] as const).map((l) => (
              <label key={l} className="seg-opt">
                <input type="radio" name="lvl" checked={level === l} onChange={() => setLevel(l)} />
                <span>{l === "all" ? t("atlas.filterAll") : t(`lens.${l}` as MessageKey)}</span>
              </label>
            ))}
          </fieldset>
          {palettes.length > 1 && (
            <fieldset className="console-seg">
              <legend className="caps">{t("atlas.topic")}</legend>
              {["all", ...palettes].map((p) => (
                <label key={p} className="seg-opt">
                  <input type="radio" name="topic" checked={topic === p} onChange={() => setTopic(p)} />
                  <span>{p === "all" ? t("atlas.filterAll") : t(`atlas.palette.${p}` as MessageKey)}</span>
                </label>
              ))}
            </fieldset>
          )}
          <div className="atlas-import">
            <button type="button" className="btn-secondary" onClick={() => input.current?.click()}>
              {t("atlas.import")}
            </button>
            <input
              ref={input}
              type="file"
              accept=".json,application/json"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  const w = parseWorldFile(JSON.parse(await f.text()));
                  if (!w) throw new Error("invalid");
                  await saveWorld({ ...w, origin: "imported" });
                  router.push(`/m/${w.id}`);
                } catch {
                  setError(true);
                }
              }}
            />
            {error && (
              <p className="ui console-error" role="alert">
                {t("atlas.importError")}
              </p>
            )}
          </div>
        </div>
        <section aria-labelledby="mine-h">
          <h2 id="mine-h" className="caps atlas-section-h">
            {t("atlas.yours")}
          </h2>
          {mine.filter(filter).length ? <AtlasGrid worlds={mine.filter(filter)} /> : <p className="ui atlas-empty">{t("atlas.empty")}</p>}
        </section>
        <section aria-labelledby="demo-h">
          <h2 id="demo-h" className="caps atlas-section-h">
            {t("atlas.demos")}
          </h2>
          <AtlasGrid worlds={shownDemos} />
        </section>
      </main>
    </>
  );
}
