"use client";

import { useEffect, useId, useState } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n";
import { readByok, useSettings, writeByok, type MotionPref, type QualityPref } from "@/lib/settings/store";
import { useHealth } from "@/lib/useHealth";
import { clearAllWorlds } from "@/lib/storage/worlds";
import { IconClose } from "./icons";

const QUALITIES: QualityPref[] = ["auto", "high", "medium", "low", "minimal"];

/** Settings (spec 3.14). */
export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { t, locale, setLocale } = useI18n();
  const id = useId();
  const s = useSettings();
  const health = useHealth((h) => h.health);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => (typeof speechSynthesis !== "undefined" ? speechSynthesis.getVoices() : []));
  const [key, setKey] = useState("");
  const [hasKey, setHasKey] = useState(() => !!readByok());
  const [cleared, setCleared] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const load = () => setVoices(speechSynthesis.getVoices());
    const hasSpeech = typeof speechSynthesis !== "undefined";
    if (hasSpeech) speechSynthesis.addEventListener?.("voiceschanged", load);
    return () => {
      if (hasSpeech) speechSynthesis.removeEventListener?.("voiceschanged", load);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  useEffect(() => {
    document.documentElement.dataset.textSize = s.textSize;
  }, [s.textSize]);

  const seg = <T extends string>(name: string, value: T, opts: T[], label: (o: T) => string, set: (o: T) => void) => (
    <fieldset className="console-seg">
      <legend className="caps">{name}</legend>
      {opts.map((o) => (
        <label key={o} className="seg-opt">
          <input type="radio" name={`${id}-${name}`} checked={value === o} onChange={() => set(o)} />
          <span>{label(o)}</span>
        </label>
      ))}
    </fieldset>
  );

  return (
    <div className="dialog-scrim" onClick={onClose}>
      <div className="dialog panel settings" role="dialog" aria-modal="true" aria-labelledby={`${id}-h`} onClick={(e) => e.stopPropagation()} data-ui>
        <header className="dialog-head">
          <h2 id={`${id}-h`} className="display">
            {t("settings.title")}
          </h2>
          <button type="button" className="btn-icon" aria-label={t("ui.close")} onClick={onClose}>
            <IconClose />
          </button>
        </header>
        {seg(t("settings.language"), locale, ["es", "en"], (o) => t(`lang.${o}` as MessageKey), setLocale)}
        {seg(t("settings.sound"), s.sound ? "on" : "off", ["on", "off"], (o) => t(`settings.${o}` as MessageKey), (o) => s.set({ sound: o === "on" }))}
        <label className="settings-range">
          <span className="caps">{t("settings.volume")}</span>
          <input type="range" min={0} max={1} step={0.05} value={s.volume} onChange={(e) => s.set({ volume: Number(e.target.value) })} />
        </label>
        {seg(t("settings.quality"), s.quality, QUALITIES, (o) => t(`settings.quality.${o}` as MessageKey), (o) => s.set({ quality: o }))}
        {seg(t("settings.motion"), s.motion, ["system", "reduce"] as MotionPref[], (o) => t(`settings.motion.${o}` as MessageKey), (o) => s.set({ motion: o }))}
        {seg(t("settings.textSize"), s.textSize, ["normal", "large"], (o) => t(`settings.textSize.${o}` as MessageKey), (o) => s.set({ textSize: o }))}
        {voices.length > 0 && (
          <>
            {seg(t("settings.voice"), s.voice ? "on" : "off", ["on", "off"], (o) => t(`settings.${o}` as MessageKey), (o) => s.set({ voice: o === "on" }))}
            {s.voice && (
              <>
                <label className="settings-range">
                  <span className="caps">{t("settings.voiceName")}</span>
                  <select className="field" value={s.voiceName} onChange={(e) => s.set({ voiceName: e.target.value })}>
                    <option value="">—</option>
                    {voices
                      .filter((v) => /^(es|en)/i.test(v.lang))
                      .map((v) => (
                        <option key={v.name} value={v.name}>
                          {v.name} ({v.lang})
                        </option>
                      ))}
                  </select>
                </label>
                <label className="settings-range">
                  <span className="caps">{t("settings.voiceRate")}</span>
                  <input type="range" min={0.7} max={1.4} step={0.05} value={s.voiceRate} onChange={(e) => s.set({ voiceRate: Number(e.target.value) })} />
                </label>
              </>
            )}
          </>
        )}
        {health?.byok && (
          <form
            className="settings-byok"
            onSubmit={(e) => {
              e.preventDefault();
              if (/^sk-ant-[A-Za-z0-9_-]{20,}$/.test(key.trim())) {
                writeByok(key.trim());
                setKey("");
                setHasKey(true);
              }
            }}
          >
            <span className="caps">{t("settings.byok")}</span>
            <p className="ui console-hint">{t("settings.byokHelp")}</p>
            {hasKey ? (
              <p className="ui">
                {t("settings.byokActive")}{" "}
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    writeByok(null);
                    setHasKey(false);
                  }}
                >
                  {t("settings.byokClear")}
                </button>
              </p>
            ) : (
              <div className="settings-row">
                <input className="field mono" type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} aria-label={t("settings.byok")} />
                <button type="submit" className="btn-secondary">
                  {t("settings.byokSave")}
                </button>
              </div>
            )}
          </form>
        )}
        <div className="dialog-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              void clearAllWorlds().then(() => setCleared(true));
              try {
                Object.keys(sessionStorage)
                  .filter((k) => k.startsWith("eidos:"))
                  .forEach((k) => sessionStorage.removeItem(k));
              } catch {
                /* ignore */
              }
            }}
          >
            {t("settings.clear")}
          </button>
          {cleared && (
            <span className="ui" role="status">
              {t("settings.cleared")}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const id = useId();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const rows: [string, MessageKey][] = [
    ["J / K · ↑ ↓", "shortcuts.nav"],
    ["/", "shortcuts.ask"],
    ["L", "shortcuts.lens"],
    ["R", "shortcuts.read"],
    ["S", "shortcuts.sound"],
    ["P", "shortcuts.present"],
    ["F", "shortcuts.fullscreen"],
    ["?", "shortcuts.help"],
    ["Shift + D", "shortcuts.autopilot"],
    ["Esc", "shortcuts.close"],
  ];
  return (
    <div className="dialog-scrim" onClick={onClose}>
      <div className="dialog panel" role="dialog" aria-modal="true" aria-labelledby={`${id}-h`} onClick={(e) => e.stopPropagation()} data-ui>
        <header className="dialog-head">
          <h2 id={`${id}-h`} className="display">
            {t("shortcuts.title")}
          </h2>
          <button type="button" className="btn-icon" aria-label={t("ui.close")} onClick={onClose}>
            <IconClose />
          </button>
        </header>
        <dl className="shortcuts">
          {rows.map(([k, label]) => (
            <div key={k}>
              <dt>
                <kbd className="mono">{k}</kbd>
              </dt>
              <dd className="ui">{t(label)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
