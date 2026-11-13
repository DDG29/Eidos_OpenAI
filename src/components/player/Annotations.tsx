"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { Annotation } from "@/lib/world/types";
import { getStage } from "@/engine/stage/stageRef";
import type { Stage } from "@/engine/stage/Stage";
import { layoutLabels, type LabelOut } from "@/engine/interaction/AnnotationLayout";
import { motionAngle } from "@/engine/interaction/Picker";
import { MOTION_TYPES } from "@/engine/types";

/**
 * Scene annotations (spec 4.8.4, 5.10.3): small caps labels joined by a 1 px guide to the projected centroid
 * of their region. Positioned every frame from the engine loop via direct DOM writes (no React re-renders).
 */
export function Annotations({ items, visible, onHover, mobile }: { items: Annotation[]; visible: boolean; onHover: (a: Annotation | null) => void; mobile: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const labels = useRef<(HTMLButtonElement | null)[]>([]);
  const lines = useRef<(SVGLineElement | null)[]>([]);
  const dots = useRef<(SVGCircleElement | null)[]>([]);
  const prev = useRef(new Map<string, LabelOut>());
  const chosen = useRef(new Map<number, number>());
  const shown = mobile ? items.slice(0, 2) : items.slice(0, 4);

  useEffect(() => {
    prev.current.clear();
    chosen.current.clear();
    const stage = getStage();
    if (!stage) return;
    const tmp = new THREE.Vector3();
    const proj = new THREE.Vector3();
    let frame = 0;
    const onFrame = (s: Stage) => {
      frame++;
      if (s.tier <= 1 && frame % 2) return;
      const el = root.current;
      const buf = s.currentBuffer();
      if (!el || !buf) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const t = s.motionTime;
      const centerP = s.project(new THREE.Vector3(...buf.bounds.center), proj);
      const input = shown.map((a, i) => {
        const region = buf.regions.find((r) => r.layerIndex === a.layerIndex && r.id === a.regionId);
        if (!region || region.count === 0) return { key: `${i}`, ax: 0, ay: 0, w: 0, h: 0, visible: false };
        // approximate the shader's rigid motion around the layer pivot, then attach to the anchor nearest
        // the camera (with hysteresis so the label does not hop between anchors)
        const pv = s.pivotOf(region.layerIndex);
        const type = MOTION_TYPES.indexOf(region.motion.type);
        const pts = region.anchors?.length ? region.anchors : [region.centroid];
        let bestK = 0;
        let bestD = Infinity;
        const camPos = s.rig.camera.position;
        const moved: [number, number, number][] = pts.map(([x, y, z]) => {
          const qx = x - pv[0],
            qz = z - pv[2];
          const ang = motionAngle(type, region.motion.speed, 1, t, Math.hypot(qx, qz));
          const c = Math.cos(ang),
            sn = Math.sin(ang);
          return [c * qx + sn * qz + pv[0], y, -sn * qx + c * qz + pv[2]];
        });
        moved.forEach((m, k) => {
          const d = Math.hypot(m[0] - camPos.x, m[1] - camPos.y, m[2] - camPos.z);
          if (d < bestD) {
            bestD = d;
            bestK = k;
          }
        });
        const keep = chosen.current.get(i);
        if (keep !== undefined && keep < moved.length) {
          const dk = Math.hypot(moved[keep]![0] - camPos.x, moved[keep]![1] - camPos.y, moved[keep]![2] - camPos.z);
          if (dk < bestD * 1.08) bestK = keep;
        }
        chosen.current.set(i, bestK);
        tmp.set(...moved[bestK]!);
        const p = s.project(tmp, proj);
        const lb = labels.current[i];
        const bw = lb?.offsetWidth ?? 80;
        const bh = lb?.offsetHeight ?? 18;
        return { key: `${i}`, ax: p.x, ay: p.y, w: bw, h: bh, visible: !p.behind && p.x > 0 && p.x < w && p.y > 0 && p.y < h };
      });
      const narr = document.querySelector<HTMLElement>("[data-narration-active]");
      const avoid = narr && !mobile ? [narr.getBoundingClientRect()].map((r) => ({ x: r.left - 12, y: r.top - 12, w: r.width + 24, h: r.height + 24 })) : [];
      const out = layoutLabels(input, centerP, { w, h }, avoid, mobile ? 48 : 72, prev.current);
      prev.current = new Map(out.map((o) => [o.key, o]));
      out.forEach((o, i) => {
        const lb = labels.current[i];
        const ln = lines.current[i];
        const dt = dots.current[i];
        if (!lb || !ln || !dt) return;
        const on = visible && o.visible;
        lb.style.transform = `translate3d(${o.x.toFixed(1)}px, ${o.y.toFixed(1)}px, 0)`;
        lb.dataset.on = on ? "1" : "0";
        const bw = lb.offsetWidth;
        const bh = lb.offsetHeight;
        const ex = o.x + (o.x + bw / 2 < o.ax ? bw : 0);
        const ey = o.y + bh / 2;
        ln.setAttribute("x1", o.ax.toFixed(1));
        ln.setAttribute("y1", o.ay.toFixed(1));
        ln.setAttribute("x2", ex.toFixed(1));
        ln.setAttribute("y2", ey.toFixed(1));
        ln.dataset.on = on ? "1" : "0";
        dt.setAttribute("cx", o.ax.toFixed(1));
        dt.setAttribute("cy", o.ay.toFixed(1));
        dt.dataset.on = on ? "1" : "0";
      });
    };
    stage.frameListeners.add(onFrame);
    return () => {
      stage.frameListeners.delete(onFrame);
    };
  }, [shown, visible, mobile]);

  return (
    <div ref={root} className="annotations" aria-hidden={!visible}>
      <svg className="annotations-svg" width="100%" height="100%" aria-hidden>
        {shown.map((a, i) => (
          <g key={`${a.layerIndex}:${a.regionId}:${i}`} style={{ ["--i" as string]: i }}>
            <line ref={(el) => void (lines.current[i] = el)} className="anno-line" />
            <circle ref={(el) => void (dots.current[i] = el)} r="1.5" className="anno-dot" />
          </g>
        ))}
      </svg>
      {shown.map((a, i) => (
        <button
          key={`${a.layerIndex}:${a.regionId}:${i}`}
          ref={(el) => void (labels.current[i] = el)}
          type="button"
          className="anno-label caps"
          style={{ ["--i" as string]: i }}
          onMouseEnter={() => onHover(a)}
          onMouseLeave={() => onHover(null)}
          onFocus={() => onHover(a)}
          onBlur={() => onHover(null)}
          tabIndex={visible ? 0 : -1}
        >
          {a.text}
        </button>
      ))}
    </div>
  );
}
