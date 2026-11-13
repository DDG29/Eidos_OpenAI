"use client";

import { IconLock } from "./icons";

export interface RulerMark {
  key: string;
  label: string;
  kind?: "check" | "remedial" | "branch" | "normal";
  locked?: boolean;
  fresh?: boolean;
}

/** The Ruler (spec 4.8.2): a 1 px vertical line with one mark per beat, current mark extended and glowing. */
export function Ruler({ marks, active, onJump, label }: { marks: RulerMark[]; active: number; onJump?: (i: number) => void; label: string }) {
  const n = Math.max(1, marks.length - 1);
  return (
    <nav className="ruler" aria-label={label}>
      <span className="ruler-line" aria-hidden />
      <ol>
        {marks.map((m, i) => (
          <li key={m.key} style={{ top: `${(i / n) * 100}%` }} data-kind={m.kind ?? "normal"} data-active={i === active || undefined} data-fresh={m.fresh || undefined}>
            <button type="button" className="ruler-mark" onClick={() => onJump?.(i)} aria-current={i === active ? "step" : undefined} title={m.label}>
              <span className="sr-only">{m.label}</span>
              <span className="tick" aria-hidden />
              {m.kind === "check" && <span className="tick tick2" aria-hidden />}
              {m.locked && <IconLock className="ruler-lock" />}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
