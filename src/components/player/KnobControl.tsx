"use client";

import { useId, useState } from "react";
import type { Knob } from "@/lib/world/types";
import { renderReadout, decimalsOfStep, formatNumber } from "@/lib/world/readout";
import { useI18n } from "@/lib/i18n/I18nProvider";

/** Knob slider (spec 3.6, 4.8.7): 1 px track with 10% ticks, 14 px handle, tabular value above it. */
export function KnobControl({ knob, value, onChange, lang }: { knob: Knob; value: number; onChange: (v: number) => void; lang: "es" | "en" }) {
  const id = useId();
  const { locale } = useI18n();
  const [local, setLocal] = useState(value);
  const pct = ((local - knob.min) / (knob.max - knob.min || 1)) * 100;
  const fmtLocale = lang === "es" ? "es-MX" : "en-US";
  return (
    <div className="knob" data-ui>
      <label className="caps knob-label" htmlFor={id}>
        {knob.label}
      </label>
      <div className="knob-track" style={{ ["--p" as string]: `${pct}%` }}>
        <span className="knob-value mono" aria-hidden>
          {formatNumber(local, decimalsOfStep(knob.step), locale === "es" ? "es-MX" : "en-US")}
          {knob.unit ? ` ${knob.unit}` : ""}
        </span>
        <input
          id={id}
          type="range"
          min={knob.min}
          max={knob.max}
          step={knob.step || "any"}
          value={local}
          aria-valuetext={`${local} ${knob.unit}`}
          onChange={(e) => {
            const v = Number(e.target.value);
            setLocal(v);
            onChange(v);
          }}
        />
      </div>
      {knob.readout && (
        <p className="knob-readout" aria-live="polite">
          {renderReadout(knob.readout, local, knob.step, fmtLocale)}
        </p>
      )}
    </div>
  );
}
