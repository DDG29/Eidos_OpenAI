"use client";

import { useEffect, useState } from "react";
import { useStage } from "@/engine/stage/stageStore";

/** Hidden performance panel (spec 13.3): `?perf=1` shows fps, frame time, particles, tier and DPR. */
export function PerfHud() {
  const [on, setOn] = useState(false);
  const s = useStage((x) => x);
  useEffect(() => {
    // Read once on mount: the flag lives in the URL and the shell never remounts.
    const id = window.setTimeout(() => setOn(new URLSearchParams(window.location.search).get("perf") === "1"), 0);
    return () => window.clearTimeout(id);
  }, []);
  if (!on) return null;
  return (
    <p className="perf-hud mono" aria-hidden>
      {s.fps} fps · {s.fps ? (1000 / s.fps).toFixed(1) : "–"} ms · {s.particles.toLocaleString()} p · tier {s.tier} · dpr {s.dpr} · gen {s.genMs} ms · {s.status}
    </p>
  );
}
