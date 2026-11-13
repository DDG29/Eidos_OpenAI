"use client";

import { useId, useRef } from "react";
import { LEVELS, type Level } from "@/lib/world/types";
import { useI18n } from "@/lib/i18n/I18nProvider";

/** The Lens (spec 4.8.5): a horizontal dial with four positions on a fine ruler; keyboard = radio group. */
export function LensDial({ value, onChange, compact = false, label }: { value: Level; onChange: (l: Level) => void; compact?: boolean; label?: string }) {
  const { t } = useI18n();
  const id = useId();
  const idx = LEVELS.indexOf(value);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (d: number) => {
    const n = (idx + d + LEVELS.length) % LEVELS.length;
    onChange(LEVELS[n]!);
    refs.current[n]?.focus();
  };
  return (
    <div className="lens" data-compact={compact || undefined}>
      <span className="caps lens-label" id={`${id}-l`}>
        {label ?? t("console.lens")}
      </span>
      <div
        className="lens-track"
        role="radiogroup"
        aria-labelledby={`${id}-l`}
        style={{ ["--lens-i" as string]: idx }}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowDown") {
            e.preventDefault();
            move(1);
          } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
            e.preventDefault();
            move(-1);
          }
        }}
      >
        <svg className="lens-ruler" viewBox="0 0 400 12" preserveAspectRatio="none" aria-hidden>
          <line x1="0" y1="11.5" x2="400" y2="11.5" />
          {Array.from({ length: 31 }, (_, i) => (
            <line key={i} x1={(i * 400) / 30} x2={(i * 400) / 30} y1={i % 10 === 0 ? 2 : 7} y2="11.5" />
          ))}
        </svg>
        <span className="lens-indicator" aria-hidden />
        {LEVELS.map((l, i) => (
          <button
            key={l}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={l === value}
            tabIndex={l === value ? 0 : -1}
            className="lens-stop caps"
            onClick={() => onChange(l)}
          >
            {t(`lens.${l}` as const)}
          </button>
        ))}
      </div>
    </div>
  );
}
