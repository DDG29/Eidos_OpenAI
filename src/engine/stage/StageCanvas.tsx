"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { useSettings, prefersReducedMotion, type QualityPref } from "@/lib/settings/store";
import { detectTier, supportsWebGL2, type Tier } from "../quality/QualityManager";
import { stageStore, useStage } from "./stageStore";
import { setStage, getStage } from "./stageRef";

const PREF_TIER: Record<Exclude<QualityPref, "auto" | "minimal">, Tier> = { high: 3, medium: 2, low: 1 };

/**
 * The persistent WebGL layer (spec 5.12). Mounted once in the root layout, fixed behind all content,
 * aria-hidden. Pages talk to the engine through `whenStage()` — never through React state.
 */
export default function StageCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  const status = useStage((s) => s.status);
  const quality = useSettings((s) => s.quality);
  const motion = useSettings((s) => s.motion);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (!supportsWebGL2() || useSettings.getState().quality === "minimal") {
      stageStore.setState({ status: "nowebgl" });
      return;
    }
    let disposed = false;
    let cleanup: (() => void) | null = null;
    stageStore.setState({ status: "loading" });
    const params = new URLSearchParams(window.location.search);
    const frozen = params.get("shots") === "1";
    void (async () => {
      const pref = useSettings.getState().quality;
      const forced = params.get("tier");
      const tier: Tier = forced !== null ? (Math.max(0, Math.min(3, Number(forced))) as Tier) : pref !== "auto" && pref !== "minimal" ? PREF_TIER[pref] : await detectTier();
      if (disposed) return;
      const { Stage } = await import("./Stage");
      if (disposed) return;
      let stage: Awaited<ReturnType<typeof Stage.create>>;
      try {
        stage = await Stage.create(canvas, tier);
      } catch {
        stageStore.setState({ status: "nowebgl" });
        return;
      }
      stage.frozen = frozen;
      stage.reducedMotion = prefersReducedMotion(useSettings.getState().motion);
      if (forced !== null || pref !== "auto") stage.quality.locked = true;
      stageStore.setState({ frozen });
      setStage(stage);
      // Read-only hooks for e2e tests and the ?perf=1 HUD.
      (window as unknown as { __EIDOS__: unknown }).__EIDOS__ = { state: () => stageStore.getState(), stage };
      gsap.ticker.add(stage.tick);
      const onResize = () => stage.resize();
      const onMove = (e: PointerEvent) => stage.pointerMove(e.clientX, e.clientY, e.pointerType === "touch");
      const onLeave = () => stage.pointerLeave();
      const onVis = () => stage.setHidden(document.visibilityState === "hidden");
      const onLost = (e: Event) => {
        e.preventDefault();
        stageStore.setState({ status: "lost" });
      };
      const onRestored = () => {
        stage.setTier(stage.tier);
        stageStore.setState({ status: "ready" });
      };
      window.addEventListener("resize", onResize);
      window.addEventListener("pointermove", onMove, { passive: true });
      window.addEventListener("pointerdown", onMove, { passive: true });
      document.addEventListener("pointerleave", onLeave);
      document.addEventListener("visibilitychange", onVis);
      canvas.addEventListener("webglcontextlost", onLost);
      canvas.addEventListener("webglcontextrestored", onRestored);
      stageStore.setState({ status: "ready" });
      requestAnimationFrame(() => canvas.classList.add("is-live"));
      cleanup = () => {
        gsap.ticker.remove(stage.tick);
        window.removeEventListener("resize", onResize);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerdown", onMove);
        document.removeEventListener("pointerleave", onLeave);
        document.removeEventListener("visibilitychange", onVis);
        canvas.removeEventListener("webglcontextlost", onLost);
        canvas.removeEventListener("webglcontextrestored", onRestored);
        stage.dispose();
        setStage(null);
      };
    })();
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);

  useEffect(() => {
    const s = getStage();
    if (!s) return;
    s.reducedMotion = prefersReducedMotion(motion);
  }, [motion]);

  useEffect(() => {
    const s = getStage();
    if (!s || quality === "auto" || quality === "minimal") return;
    s.setTier(PREF_TIER[quality]);
  }, [quality]);

  return (
    <div className="stage-layer" aria-hidden="true" data-status={status}>
      <canvas ref={ref} className="stage-canvas" />
      {(status === "nowebgl" || status === "lost") && <div className="stage-poster" />}
    </div>
  );
}
