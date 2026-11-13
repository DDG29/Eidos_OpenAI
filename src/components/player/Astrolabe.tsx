"use client";

import { useMemo, useRef, useState } from "react";
import type { EffectiveBeat } from "./playerStore";

const R = 52;
const C = 66;
const A0 = -135;
const A1 = 135;

function polar(angleDeg: number, r: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return [C + r * Math.cos(a), C + r * Math.sin(a)] as const;
}

function arcPath(a: number, b: number, r: number) {
  const [x0, y0] = polar(a, r);
  const [x1, y1] = polar(b, r);
  const large = Math.abs(b - a) > 180 ? 1 : 0;
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

/** The Astrolabe (spec 4.8.1): circular navigator of the journey with remedial inner arcs and what-if branches. */
export function Astrolabe({ beats, active, progress, onJump, label, abbr }: { beats: EffectiveBeat[]; active: number; progress: number; onJump: (i: number) => void; label: string; abbr: (b: EffectiveBeat) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const trunkIdx = useMemo(() => beats.map((b, i) => (b.origin === "trunk" ? i : -1)).filter((i) => i >= 0), [beats]);
  const nTrunk = trunkIdx.length;
  const angleOfTrunk = (k: number) => A0 + ((A1 - A0) * k) / Math.max(1, nTrunk - 1);
  // angle for every effective beat: inserted beats sit at their anchor's angle (offset slightly)
  const angles = useMemo(() => {
    const out: number[] = [];
    let k = -1;
    let sub = 0;
    beats.forEach((b) => {
      if (b.origin === "trunk") {
        k++;
        sub = 0;
        out.push(angleOfTrunk(k));
      } else {
        sub++;
        out.push(angleOfTrunk(k) + Math.min(14, (A1 - A0) / Math.max(1, nTrunk - 1) - 2) * (sub / 4));
      }
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beats, nTrunk]);
  const trunkPos = (() => {
    // continuous progress along the trunk for the progress arc
    let k = 0;
    for (let i = 0; i <= Math.min(active, beats.length - 1); i++) if (beats[i]?.origin === "trunk") k = trunkIdx.indexOf(i);
    const frac = beats[active]?.origin === "trunk" ? Math.min(1, progress) : 0;
    return Math.min(nTrunk - 1, k + frac * (k < nTrunk - 1 ? 0.999 : 0));
  })();
  const progAngle = A0 + ((A1 - A0) * trunkPos) / Math.max(1, nTrunk - 1);
  const cur = beats[active];
  const shown = hover !== null ? beats[hover] : null;

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const next = Math.max(0, Math.min(beats.length - 1, active + (e.deltaY > 0 ? 1 : -1)));
    if (next !== active) onJump(next);
  };

  return (
    <nav className="astrolabe" aria-label={label} onWheel={onWheel}>
      <svg ref={svgRef} viewBox="0 0 132 132" width="132" height="132" aria-hidden>
        <path d={arcPath(A0, A1, R)} className="astro-ring" />
        <path d={arcPath(A0, Math.max(A0 + 0.01, progAngle), R)} className="astro-progress" />
        {beats.map((b, i) => {
          const a = angles[i]!;
          const isActive = i === active;
          if (b.origin === "trunk") {
            const [x0, y0] = polar(a, R - (isActive ? 12 : 6));
            const [x1, y1] = polar(a, R);
            return <line key={b.beat.id} x1={x0} y1={y0} x2={x1} y2={y1} className="astro-mark" data-active={isActive || undefined} data-check={b.beat.kind === "check" || undefined} />;
          }
          const inner = b.origin === "remedial";
          const r0 = inner ? R - 10 : R + 4;
          const [x0, y0] = polar(a, r0);
          const [x1, y1] = polar(a, inner ? r0 - 5 : r0 + 6);
          return <line key={b.beat.id} x1={x0} y1={y0} x2={x1} y2={y1} className={inner ? "astro-remedial" : "astro-branch"} data-active={isActive || undefined} data-fresh={b.fresh || undefined} />;
        })}
        {/* inner arcs for remedial groups and outward lines for branches */}
        {beats.map((b, i) => {
          if (b.origin === "trunk" || beats[i - 1]?.origin === b.origin) return null;
          let j = i;
          while (beats[j + 1]?.origin === b.origin) j++;
          const a0 = angles[i]!;
          const a1 = angles[j]!;
          if (b.origin === "remedial") return <path key={`arc-${b.beat.id}`} d={arcPath(a0 - 2, a1 + 2, R - 10)} className="astro-remedial-arc" data-fresh={b.fresh || undefined} />;
          const [x0, y0] = polar(a0 - 3, R);
          const [x1, y1] = polar(a1, R + 12);
          return <path key={`br-${b.beat.id}`} d={`M${x0} ${y0} L${x1} ${y1}`} className="astro-branch-line" />;
        })}
      </svg>
      <div className="astro-center" aria-hidden>
        <span className="mono astro-count">
          {active + 1}/{beats.length}
        </span>
        <span className="caps astro-abbr">{shown ? abbr(shown) : cur ? abbr(cur) : ""}</span>
      </div>
      <ol className="sr-only">
        {beats.map((b, i) => (
          <li key={b.beat.id}>
            <a href={`#beat-${b.beat.id}`} aria-current={i === active ? "step" : undefined} onClick={(e) => (e.preventDefault(), onJump(i))}>
              {i + 1}. {b.beat.title}
            </a>
          </li>
        ))}
      </ol>
      {/* invisible hit targets over each mark */}
      {beats.map((b, i) => {
        const [x, y] = polar(angles[i]!, b.origin === "remedial" ? R - 14 : b.origin === "branch" ? R + 8 : R - 4);
        return (
          <button
            key={`hit-${b.beat.id}`}
            type="button"
            tabIndex={-1}
            aria-hidden
            className="astro-hit"
            style={{ left: x - 9, top: y - 9 }}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onClick={() => onJump(i)}
          />
        );
      })}
      {shown && <span className="astro-tip caps">{shown.beat.title}</span>}
    </nav>
  );
}
