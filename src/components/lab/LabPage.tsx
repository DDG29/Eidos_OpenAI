"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { TopBar } from "@/components/ui/TopBar";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { listShapes } from "@/engine/shapes/registry";
import type { ShapeDefinition } from "@/engine/shapes/types";
import { whenStage, getStage } from "@/engine/stage/stageRef";
import { useStage } from "@/engine/stage/stageStore";
import type { Tier } from "@/engine/quality/QualityManager";
import { makeLayer } from "@/lib/world/layer";
import { CAMERA_PRESETS, COLOR_MODES, PALETTE_IDS, TRANSITIONS, type CameraPreset, type ColorMode, type Layer, type PaletteId, type ShapeId, type Transition } from "@/lib/world/types";
import { isFlatBeat } from "@/engine/stage/programFromBeats";

/**
 * /lab (spec 6.3): every shape of the registry, live on the main canvas, with controls generated from its
 * ParamSpec/ExprSpec; also the base of the visual shape tests (`?shape=<id>`).
 */

function defaults(def: ShapeDefinition) {
  const data =
    def.id === "layers" ? [4, 7, 7, 5, 3] : def.id === "bars" ? [3, 5, 8, 6, 9, 4] : def.id === "scatter" ? [0, 0.1, 1, 0.4, 2, 1.1, 3, 2.3, 4, 4.4, 5, 8.6] : def.id === "orbits" ? [0.3, 0.55, 0.8] : [];
  return {
    params: Object.fromEntries(def.params.map((p) => [p.key, p.default])) as Record<string, number>,
    expr: Object.fromEntries(def.expr.map((e) => [e.key, e.default])) as Record<string, string>,
    data: def.data ? data : [],
  };
}

async function thumbOf(def: ShapeDefinition, palette: PaletteId): Promise<string> {
  const [{ renderFigurePixels }, fonts] = await Promise.all([import("@/engine/figure/renderFigure"), import("@/engine/shapes/raster/fonts")]);
  await fonts.ensureFonts((u) => fetch(u).then((r) => r.arrayBuffer()));
  const d = defaults(def);
  const layer = makeLayer(def.id, { params: Object.entries(d.params).map(([key, value]) => ({ key, value })), data: d.data });
  const px = renderFigurePixels({ layers: [layer], palette, camera: "orbit_close", front: isFlatBeat({ layers: [layer] }), width: 180, height: 120, count: 9000, seed: `lab:${def.id}` });
  const c = document.createElement("canvas");
  c.width = 180;
  c.height = 120;
  c.getContext("2d")?.putImageData(new ImageData(new Uint8ClampedArray(px), 180, 120), 0, 0);
  return c.toDataURL("image/webp", 0.8);
}

export function LabPage() {
  const { t } = useI18n();
  const shapes = useMemo(() => listShapes(), []);
  const [id, setId] = useState<ShapeId>(() => {
    const q = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("shape") : null;
    return q && shapes.some((s) => s.id === q) ? (q as ShapeId) : "helix";
  });
  const def = shapes.find((s) => s.id === id)!;
  const [params, setParams] = useState<Record<string, number>>(() => defaults(def).params);
  const [expr, setExpr] = useState<Record<string, string>>(() => defaults(def).expr);
  const [data, setData] = useState<string>(() => defaults(def).data.join(", "));
  const [palette, setPalette] = useState<PaletteId>("aurora");
  const [colorMode, setColorMode] = useState<ColorMode>("region");
  const [camera, setCamera] = useState<CameraPreset>("orbit_close");
  const [transition, setTransition] = useState<Transition>("flow");
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const fps = useStage((s) => s.fps);
  const particles = useStage((s) => s.particles);
  const tier = useStage((s) => s.tier);
  const [genMs, setGenMs] = useState(0);
  const loaded = useRef(false);

  const selectShape = (sid: ShapeId) => {
    const d = defaults(shapes.find((s) => s.id === sid)!);
    setId(sid);
    setParams(d.params);
    setExpr(d.expr);
    setData(d.data.join(", "));
  };

  const layer: Layer = useMemo(
    () =>
      makeLayer(id, {
        share: 0.92,
        params: Object.entries(params).map(([key, value]) => ({ key, value })),
        expr: Object.entries(expr)
          .filter(([, v]) => v.trim())
          .map(([key, value]) => ({ key, value })),
        data: data
          .split(/[,\s]+/)
          .map(Number)
          .filter((v) => Number.isFinite(v)),
        colorMode,
      }),
    [id, params, expr, data, colorMode],
  );

  // Live preview: the first load builds a program; later edits morph with an event (like knobs).
  useEffect(() => {
    let alive = true;
    const h = window.setTimeout(async () => {
      const stage = await whenStage();
      if (!alive) return;
      const t0 = performance.now();
      if (!loaded.current || stage.client?.id !== `lab:${palette}`) {
        loaded.current = true;
        await stage.loadProgram(
          { id: `lab:${palette}`, palette, count: stage.N, beats: [{ id: "x", layers: [layer], transition, dustFraction: 0.06 }] },
          { cameras: [camera], faces: [isFlatBeat({ layers: [layer] })], enterMs: 700 },
        );
        stage.setScroll(0, 1);
      } else {
        const built = await stage.client.buildEvent([layer], 0, transition, 0.06, `lab:${JSON.stringify(layer)}`);
        stage.eventTo(built, transition, 900, { hold: true, camera });
      }
      setGenMs(Math.round(performance.now() - t0));
    }, 120);
    return () => {
      alive = false;
      window.clearTimeout(h);
    };
  }, [layer, palette, camera, transition]);

  // Thumbnails rendered on the CPU, one at a time.
  useEffect(() => {
    const next = shapes.find((s) => !thumbs[s.id]);
    if (!next) return;
    const h = window.setTimeout(() => void thumbOf(next, "aurora").then((src) => setThumbs((m) => ({ ...m, [next.id]: src }))), 30);
    return () => window.clearTimeout(h);
  }, [thumbs, shapes]);

  const randomMorph = () => {
    const pick = shapes[Math.floor(Math.random() * shapes.length)]!;
    setTransition(TRANSITIONS[Math.floor(Math.random() * TRANSITIONS.length)]!);
    selectShape(pick.id === "image" ? "nebula" : pick.id);
  };

  const select = <T extends string>(label: string, value: T, options: readonly T[], on: (v: T) => void) => (
    <label className="caps">
      {label}
      <select className="field" value={value} onChange={(e) => on(e.target.value as T)}>
        {options.map((p) => (
          <option key={p}>{p}</option>
        ))}
      </select>
    </label>
  );

  return (
    <>
      <TopBar />
      <main id="main" className="page lab">
        <aside className="lab-panel panel" data-ui>
          <h1 className="display lab-title">{def.title}</h1>
          <p className="ui lab-doc">{def.doc}</p>
          <p className="mono lab-stats">
            {particles.toLocaleString()} · {fps} fps · tier {tier} · {genMs} ms
          </p>
          <div className="lab-row">
            {select("Palette", palette, PALETTE_IDS, setPalette)}
            {select("Color", colorMode, COLOR_MODES, setColorMode)}
          </div>
          <div className="lab-row">
            {select("Camera", camera, CAMERA_PRESETS, setCamera)}
            {select("Transition", transition, TRANSITIONS, setTransition)}
            <label className="caps">
              Tier
              <select className="field" value={tier} onChange={(e) => getStage()?.setTier(Number(e.target.value) as Tier)}>
                {[3, 2, 1, 0].map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {def.params.map((p) => (
            <label key={p.key} className="lab-param" title={p.doc}>
              <span className="caps">
                {p.key} <span className="mono">{(params[p.key] ?? p.default).toFixed(p.integer ? 0 : 2)}</span>
              </span>
              <input type="range" min={p.min} max={p.max} step={p.integer ? 1 : (p.max - p.min) / 200} value={params[p.key] ?? p.default} onChange={(e) => setParams({ ...params, [p.key]: Number(e.target.value) })} />
            </label>
          ))}
          {def.expr.map((e) => (
            <label key={e.key} className="lab-param">
              <span className="caps">
                {e.key} ({e.kind})
              </span>
              <textarea className="field mono" rows={e.kind === "svgpath" || e.kind === "molecule" ? 3 : 1} maxLength={e.maxLength} value={expr[e.key] ?? ""} onChange={(ev) => setExpr({ ...expr, [e.key]: ev.target.value })} />
            </label>
          ))}
          {def.data && (
            <label className="lab-param">
              <span className="caps">data</span>
              <input className="field mono" value={data} onChange={(e) => setData(e.target.value)} />
            </label>
          )}
          <div className="lab-actions">
            <button type="button" className="btn-secondary" onClick={randomMorph}>
              {t("lab.random")}
            </button>
            <button type="button" className="btn-secondary" onClick={() => void navigator.clipboard?.writeText(JSON.stringify(layer, null, 1)).then(() => setCopied(true))}>
              {copied ? t("share.copied") : t("lab.copy")}
            </button>
          </div>
        </aside>
        <ul className="lab-grid" aria-label="Shapes">
          {shapes.map((s) => (
            <li key={s.id}>
              <button type="button" className="lab-tile" aria-pressed={s.id === id} onClick={() => selectShape(s.id)} title={s.doc}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {thumbs[s.id] ? <img src={thumbs[s.id]} alt="" width={180} height={120} /> : <span className="lab-tile-wait" />}
                <span className="mono">{s.id}</span>
              </button>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
