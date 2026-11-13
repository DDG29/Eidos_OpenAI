"use client";

import { useId, useState } from "react";
import type { Beat } from "@/lib/world/types";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { CheckResult } from "./playerStore";

/** Socratic check (spec 3.7): accessible radio group + free answer; results announced politely. */
export function CheckBlock({
  beat,
  result,
  busy,
  growing,
  onChoice,
  onFree,
  onSkip,
  onGrowMore,
  onContinue,
}: {
  beat: Beat;
  result: CheckResult | undefined;
  busy: boolean;
  growing: string | null;
  onChoice: (i: number) => void;
  onFree: (text: string) => void;
  onSkip: () => void;
  onGrowMore: () => void;
  onContinue: () => void;
}) {
  const { t } = useI18n();
  const id = useId();
  const [sel, setSel] = useState<number | null>(null);
  const [free, setFree] = useState("");
  const [mode, setMode] = useState<"choice" | "free">("choice");
  const c = beat.check;
  const done = result && result.status !== "pending";
  return (
    <div className="check" data-ui data-status={result?.status ?? "pending"}>
      <fieldset className="check-choices" disabled={!!done || busy}>
        <legend className="sr-only">{t("check.choicesLabel")}</legend>
        {mode === "choice" &&
          c.choices.map((ch, i) => (
            <label key={i} className="check-choice" data-picked={result?.choice === i || undefined} data-correct={done && i === c.correctIndex ? true : undefined}>
              <input type="radio" name={`${id}-c`} checked={sel === i} onChange={() => setSel(i)} />
              <span className="check-letter mono" aria-hidden>
                {String.fromCharCode(65 + i)}
              </span>
              <span>{ch.text}</span>
            </label>
          ))}
        {mode === "free" && (
          <label className="check-free">
            <span className="caps">{t("check.free")}</span>
            <textarea className="field" rows={3} maxLength={800} value={free} placeholder={t("check.freePlaceholder")} onChange={(e) => setFree(e.target.value)} />
          </label>
        )}
      </fieldset>
      {!done && (
        <div className="check-actions">
          <button
            type="button"
            className="btn-primary"
            disabled={busy || (mode === "choice" ? sel === null : free.trim().length < 3)}
            onClick={() => (mode === "choice" ? sel !== null && onChoice(sel) : onFree(free.trim()))}
          >
            {t("check.submit")}
          </button>
          {c.allowFreeText && (
            <button type="button" className="btn-secondary" onClick={() => setMode(mode === "choice" ? "free" : "choice")}>
              {mode === "choice" ? t("check.free") : t("check.choicesLabel")}
            </button>
          )}
          <button type="button" className="btn-secondary check-skip" onClick={onSkip}>
            {t("check.skip")}
          </button>
        </div>
      )}
      <div className="check-result" aria-live="polite">
        {result?.status === "correct" && (
          <>
            <p className="check-verdict" data-v="correct">
              {t("check.correct")}
            </p>
            {result.feedback && <p>{result.feedback}</p>}
            <p className="check-explanation">{c.explanation}</p>
          </>
        )}
        {result?.status === "partial" && (
          <>
            <p className="check-verdict" data-v="partial">
              {t("check.partial")}
            </p>
            {result.feedback && <p>{result.feedback}</p>}
            {result.missingIdea && <p>{t("check.missing", { idea: result.missingIdea })}</p>}
            <div className="check-actions">
              <button type="button" className="btn-primary" onClick={onGrowMore}>
                {t("check.growMore")}
              </button>
              <button type="button" className="btn-secondary" onClick={onContinue}>
                {t("check.continue")}
              </button>
            </div>
          </>
        )}
        {result?.status === "incorrect" && (
          <>
            <p className="check-verdict display" data-v="incorrect">
              {t("check.incorrect")}
            </p>
            {result.feedback && <p>{result.feedback}</p>}
            {growing ? <p className="check-growing">{growing}</p> : null}
          </>
        )}
        {result?.status === "skipped" && <p className="check-verdict" data-v="skipped">{t("check.skipped")}</p>}
        {result?.offline && <p className="caps check-offline">{t("check.offline")}</p>}
      </div>
    </div>
  );
}
