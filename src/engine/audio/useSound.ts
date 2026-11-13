"use client";

import { useEffect, useMemo } from "react";
import type { Ambient, PaletteId } from "@/lib/world/types";
import { useSettings, prefersReducedMotion } from "@/lib/settings/store";
import { getStage } from "../stage/stageRef";
import { getSoundEngine, type SoundEvent } from "./SoundEngine";

/** React bridge: follows the sound setting (toggled by a click = user gesture) and the engine's morphs. */
export function useSound() {
  const on = useSettings((s) => s.sound);
  const volume = useSettings((s) => s.volume);
  const motion = useSettings((s) => s.motion);
  useEffect(() => {
    const e = getSoundEngine();
    e.reducedMotion = prefersReducedMotion(motion);
    if (on) void e.start();
    else e.stop();
  }, [on, motion]);
  useEffect(() => getSoundEngine().setVolume(volume), [volume]);
  useEffect(() => {
    if (!on) return;
    const stage = getStage();
    if (!stage) return;
    const l = () => getSoundEngine().setMorph(Math.sin(Math.PI * stage.field.morph));
    stage.frameListeners.add(l);
    return () => void stage.frameListeners.delete(l);
  }, [on]);
  return useMemo(
    () => ({
      onBeat: (ambient: Ambient, palette: PaletteId) => {
        const e = getSoundEngine();
        e.setScene(palette, ambient);
        e.event("beat");
      },
      event: (k: SoundEvent) => getSoundEngine().event(k),
    }),
    [],
  );
}
