"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ProgramInput } from "@/engine/compile/program";
import { whenStage } from "@/engine/stage/stageRef";
import { useStage } from "@/engine/stage/stageStore";
import { listShapes } from "@/engine/shapes/registry";
import { makeLayer } from "@/lib/world/layer";
import { TRANSITIONS, type Transition } from "@/lib/world/types";

export function LabMinimal() {
  const shapes = useMemo(() => listShapes(), []);
  const [a, setA] = useState(0);
  const [b, setB] = useState(1);
  const [transition, setTransition] = useState<Transition>("flow");
  const [morph, setMorph] = useState(1);
  const fps = useStage((s) => s.fps);
  const particles = useStage((s) => s.particles);
  const ready = useRef(false);

  useEffect(() => {
    let alive = true;
    ready.current = false;
    void (async () => {
      const stage = await whenStage();
      const input: ProgramInput = {
        id: `lab:${a}:${b}:${transition}`,
        palette: "aurora",
        count: stage.N,
        beats: [
          { id: "a", layers: [makeLayer(shapes[a]!.id)], transition: "flow", dustFraction: 0.06 },
          { id: "b", layers: [makeLayer(shapes[b]!.id)], transition, dustFraction: 0.06 },
        ],
      };
      await stage.loadProgram(input, { cameras: ["orbit_close", "orbit_close"], enterMs: 0 });
      if (!alive) return;
      ready.current = true;
      stage.setScroll(1, morph * 0.35);
    })();
    return () => {
      alive = false;
    };
    // morph is applied separately
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a, b, transition, shapes]);

  useEffect(() => {
    void whenStage().then((s) => {
      if (ready.current) s.setScroll(1, morph * 0.35);
    });
  }, [morph]);

  return (
    <div className="lab-min panel">
      <label className="caps">
        A
        <select className="field" value={a} onChange={(e) => setA(Number(e.target.value))}>
          {shapes.map((s, i) => (
            <option key={s.id} value={i}>
              {s.id}
            </option>
          ))}
        </select>
      </label>
      <label className="caps">
        B
        <select className="field" value={b} onChange={(e) => setB(Number(e.target.value))}>
          {shapes.map((s, i) => (
            <option key={s.id} value={i}>
              {s.id}
            </option>
          ))}
        </select>
      </label>
      <label className="caps">
        Transition
        <select className="field" value={transition} onChange={(e) => setTransition(e.target.value as Transition)}>
          {TRANSITIONS.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      <label className="caps">
        uMorph {morph.toFixed(2)}
        <input type="range" min={0} max={1} step={0.01} value={morph} onChange={(e) => setMorph(Number(e.target.value))} />
      </label>
      <p className="mono ui">
        {particles.toLocaleString()} particles · {fps} fps
      </p>
    </div>
  );
}
