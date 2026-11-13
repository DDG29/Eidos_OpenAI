"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { LensDial } from "@/components/ui/LensDial";
import { IconCamera, IconClose, IconUpload } from "@/components/ui/icons";
import { estimateForge, type Quality, type SourceMode } from "@/lib/pricing";
import { imageForParticles, pdfInfo } from "@/lib/forge/fileInfo";
import { LIMITS, validateForgeRequest, type ForgeRequest } from "@/lib/forge/request";
import { isDemoMode, useHealth } from "@/lib/useHealth";
import type { Lang, Level } from "@/lib/world/types";
import type { MessageKey } from "@/lib/i18n";
import { useConsole } from "./consoleStore";

const MODES: SourceMode[] = ["topic", "pdf", "image", "url", "text"];
const QUALITIES: Quality[] = ["fast", "deep", "master"];

export interface DemoExample {
  id: string;
  title: string;
}

/** Forge Console (spec 3.3): a precision instrument, not a form. */
export function ForgeConsole({ onForge, examples, onDemoExample }: { onForge: (r: ForgeRequest) => void; examples: DemoExample[]; onDemoExample: (id: string) => void }) {
  const { t, locale } = useI18n();
  const uid = useId();
  const mode = useConsole((s) => s.mode);
  const setMode = useConsole((s) => s.setMode);
  const file = useConsole((s) => s.file);
  const setFile = useConsole((s) => s.setFile);
  const health = useHealth();
  const demo = isDemoMode(health);
  const [topic, setTopic] = useState("");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [focus, setFocus] = useState("");
  const [level, setLevel] = useState<Level>("prepa");
  const [lang, setLang] = useState<Lang>(locale);
  const [quality, setQuality] = useState<Quality>("deep");
  const [error, setError] = useState<MessageKey | null>(null);
  const [ph, setPh] = useState(0);
  const [pdfMeta, setPdfMeta] = useState<{ pages: number; thumb: string | null } | null>(null);
  const [imgPreview, setImgPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const camInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void health.load();
  }, [health]);

  useEffect(() => setLang(locale), [locale]);

  useEffect(() => {
    if (mode !== "topic" || topic) return;
    const id = window.setInterval(() => setPh((p) => (p + 1) % 4), 3000);
    return () => window.clearInterval(id);
  }, [mode, topic]);

  useEffect(() => {
    setPdfMeta(null);
    setImgPreview(null);
    if (!file) return;
    let url: string | null = null;
    if (mode === "pdf") void pdfInfo(file).then(setPdfMeta);
    if (mode === "image") {
      url = URL.createObjectURL(file);
      setImgPreview(url);
    }
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [file, mode]);

  const est = useMemo(() => estimateForge({ mode, quality, pages: pdfMeta?.pages, chars: text.length || undefined }), [mode, quality, pdfMeta, text]);
  const looksLikeUrl = mode === "topic" && /^https?:\/\/\S+$/i.test(topic.trim());
  const maxMb = health.health?.limits.pdfMb ?? 32;
  const maxPages = health.health?.limits.pdfPages ?? 100;

  const acceptFile = (f: File | undefined | null) => {
    if (!f) return;
    setError(null);
    if (mode === "pdf" && f.size > maxMb * 1024 * 1024) return setError("error.EIDOS_E_PDF_TOO_BIG");
    if (mode === "image" && f.size > LIMITS.imageMb * 1024 * 1024) return setError("error.EIDOS_E_IMAGE");
    setFile(f);
  };

  const submit = async () => {
    if (demo) {
      const match = examples.find((e) => topic && e.title.toLowerCase().includes(topic.toLowerCase().slice(0, 12)));
      onDemoExample(match?.id ?? examples[0]?.id ?? "");
      return;
    }
    const req: ForgeRequest = { mode, topic, url, text, file: file ?? undefined, level, lang, quality, focus: focus.slice(0, LIMITS.focusMax), pages: pdfMeta?.pages };
    const err = validateForgeRequest(req);
    if (err) return setError(err as MessageKey);
    if (mode === "pdf" && pdfMeta && pdfMeta.pages > maxPages) return setError("error.EIDOS_E_PDF_TOO_LONG");
    if (mode === "image" && file) req.imageData = await imageForParticles(file);
    onForge(req);
  };

  return (
    <form
      className="console"
      data-drag={dragOver || undefined}
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      aria-describedby={demo ? `${uid}-demo` : undefined}
    >
      <div className="console-modes" role="tablist" aria-label={t("console.modes")}>
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            className="console-mode"
            onClick={() => {
              setMode(m);
              setError(null);
            }}
          >
            {t(`console.mode.${m}` as MessageKey)}
          </button>
        ))}
      </div>

      <div className="console-field">
        {mode === "topic" && (
          <>
            <label className="sr-only" htmlFor={`${uid}-topic`}>
              {t("console.topicLabel")}
            </label>
            <textarea
              id={`${uid}-topic`}
              className="console-input display"
              rows={2}
              maxLength={LIMITS.topicMax}
              value={topic}
              placeholder={t(`console.topic.${ph}` as MessageKey)}
              onChange={(e) => {
                setTopic(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void submit();
                }
              }}
            />
            {looksLikeUrl && (
              <button
                type="button"
                className="console-chip caps"
                onClick={() => {
                  setUrl(topic.trim());
                  setMode("url");
                }}
              >
                {t("console.readLink")}
              </button>
            )}
          </>
        )}
        {(mode === "pdf" || mode === "image") && (
          <div
            className="console-drop"
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              acceptFile(e.dataTransfer.files[0]);
            }}
          >
            {file ? (
              <div className="console-file">
                {mode === "pdf" && pdfMeta?.thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={pdfMeta.thumb} alt="" width={60} />
                ) : null}
                {mode === "image" && imgPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imgPreview} alt="" width={96} />
                ) : null}
                <div>
                  <p className="ui">{file.name}</p>
                  {mode === "pdf" && pdfMeta ? <p className="caps console-hint">{t("console.pages", { n: pdfMeta.pages })}</p> : null}
                </div>
                <button type="button" className="btn-icon" aria-label={t("console.remove")} onClick={() => setFile(null)}>
                  <IconClose size={18} />
                </button>
              </div>
            ) : (
              <>
                <p className="ui">{mode === "pdf" ? t("console.pdfDrop") : t("console.imageDrop")}</p>
                <div className="console-drop-actions">
                  <button type="button" className="btn-secondary" onClick={() => fileInput.current?.click()}>
                    <IconUpload size={16} /> {t("console.chooseFile")}
                  </button>
                  {mode === "image" && (
                    <button type="button" className="btn-secondary console-camera" onClick={() => camInput.current?.click()}>
                      <IconCamera size={16} /> {t("console.useCamera")}
                    </button>
                  )}
                </div>
                {mode === "pdf" && <p className="caps console-hint">{t("console.pdfHint", { mb: maxMb, pages: maxPages })}</p>}
              </>
            )}
            <input ref={fileInput} type="file" hidden accept={mode === "pdf" ? "application/pdf" : "image/jpeg,image/png,image/webp"} onChange={(e) => acceptFile(e.target.files?.[0])} />
            <input ref={camInput} type="file" hidden accept="image/*" capture="environment" onChange={(e) => acceptFile(e.target.files?.[0])} />
          </div>
        )}
        {mode === "url" && (
          <>
            <label className="caps" htmlFor={`${uid}-url`}>
              {t("console.urlLabel")}
            </label>
            <input id={`${uid}-url`} className="field" type="url" inputMode="url" placeholder="https://…" maxLength={LIMITS.urlMax} value={url} onChange={(e) => setUrl(e.target.value)} />
            <p className="console-hint ui">{t("console.urlHint")}</p>
          </>
        )}
        {mode === "text" && (
          <>
            <label className="caps" htmlFor={`${uid}-text`}>
              {t("console.textLabel")}
            </label>
            <textarea id={`${uid}-text`} className="field console-textarea" rows={7} maxLength={LIMITS.textMax} value={text} onChange={(e) => setText(e.target.value)} />
            <p className="console-hint ui">
              {t("console.textHint")} <span className="mono">{text.length.toLocaleString(locale)}</span>
            </p>
          </>
        )}
      </div>

      <div className="console-settings">
        <LensDial value={level} onChange={setLevel} />
        <fieldset className="console-seg">
          <legend className="caps">{t("console.worldLang")}</legend>
          {(["es", "en"] as Lang[]).map((l) => (
            <label key={l} className="seg-opt">
              <input type="radio" name={`${uid}-lang`} checked={lang === l} onChange={() => setLang(l)} />
              <span>{t(`lang.${l}` as MessageKey)}</span>
            </label>
          ))}
        </fieldset>
        <fieldset className="console-seg">
          <legend className="caps">{t("console.quality")}</legend>
          {QUALITIES.map((q) => (
            <label key={q} className="seg-opt">
              <input type="radio" name={`${uid}-q`} checked={quality === q} onChange={() => setQuality(q)} />
              <span>{t(`console.quality.${q}` as MessageKey)}</span>
            </label>
          ))}
          <p className="console-estimate mono">
            {t("console.estimate", { seconds: est.seconds, low: est.lowUsd.toFixed(2), high: est.highUsd.toFixed(2) })}
          </p>
        </fieldset>
        <label className="console-focus">
          <span className="caps">{t("console.focus")}</span>
          <input className="field" maxLength={LIMITS.focusMax} value={focus} placeholder={t("console.focusPlaceholder")} onChange={(e) => setFocus(e.target.value)} />
        </label>
      </div>

      {demo && (
        <p className="console-demo ui" id={`${uid}-demo`}>
          {t("console.demoNotice")}
        </p>
      )}
      {error && (
        <p className="console-error ui" role="alert">
          {t(error, { max: mode === "pdf" ? (error === "error.EIDOS_E_PDF_TOO_LONG" ? maxPages : maxMb) : maxMb, pages: pdfMeta?.pages ?? 0 })}
        </p>
      )}

      <div className="console-actions">
        <button type="submit" className="btn-primary console-submit">
          {demo ? t("console.demoForge") : t("console.forge")}
        </button>
        {examples.length > 0 && (
          <div className="console-examples">
            <span className="caps">{t("console.examples")}</span>
            {examples.slice(0, 4).map((e) => (
              <button key={e.id} type="button" className="console-chip ui" onClick={() => onDemoExample(e.id)}>
                {e.title}
              </button>
            ))}
          </div>
        )}
      </div>
    </form>
  );
}
