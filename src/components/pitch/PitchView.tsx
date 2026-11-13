"use client";

import { useEffect, useState } from "react";
import { Player } from "@/components/player/Player";
import { usePlayer, effectiveBeats } from "@/components/player/playerStore";
import { useStage } from "@/engine/stage/stageStore";
import { useI18n } from "@/lib/i18n/I18nProvider";

/** /pitch (spec 3.16, 12.4): the pitch is an EIDOS world, presented with the keyboard. */
export function PitchView() {
  const { t } = useI18n();
  const [black, setBlack] = useState(false);
  const beatIndex = useStage((s) => s.beat);
  const world = usePlayer((s) => s.world);
  const level = usePlayer((s) => s.level);
  const beatId = world ? effectiveBeats(world, level, new Set())[beatIndex]?.beat.id : undefined;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        window.dispatchEvent(new KeyboardEvent("keydown", { key: e.shiftKey ? "k" : "j" }));
      } else if (e.key === "PageUp") {
        e.preventDefault();
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "k" }));
      } else if (e.key === "b" || e.key === "B") setBlack((v) => !v);
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, []);

  return (
    <>
      <Player worldId="eidos-pitch" present brightnessFor={(id) => (id === "p01" ? { node_0: 0.2, node_1: 0.2, node_2: 0.2, node_3: 0.2 } : undefined)} />
      {beatId === "p05" && (
        <a className="btn-primary pitch-live" href="/#forjar" target="_blank" rel="noopener">
          {t("pitch.live")}
        </a>
      )}
      {black && <div className="pitch-black" onClick={() => setBlack(false)} aria-hidden />}
    </>
  );
}
