"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useSettings } from "@/lib/settings/store";
import { IconSound } from "./icons";
import { Wordmark } from "./Wordmark";

export function LanguageToggle() {
  const { locale, setLocale, t } = useI18n();
  return (
    <button
      type="button"
      className="lang-toggle caps"
      onClick={() => setLocale(locale === "es" ? "en" : "es")}
      aria-label={t("ui.languageSwitch")}
    >
      <span aria-current={locale === "es" ? "true" : undefined} data-on={locale === "es"}>
        ES
      </span>
      <span className="lang-sep" aria-hidden>
        /
      </span>
      <span aria-current={locale === "en" ? "true" : undefined} data-on={locale === "en"}>
        EN
      </span>
    </button>
  );
}

export function SoundToggle() {
  const { t } = useI18n();
  const sound = useSettings((s) => s.sound);
  const set = useSettings((s) => s.set);
  return (
    <button
      type="button"
      className="btn-icon"
      aria-pressed={sound}
      aria-label={sound ? t("ui.soundOff") : t("ui.soundOn")}
      title={t("ui.sound")}
      onClick={() => set({ sound: !sound })}
    >
      <IconSound on={sound} />
    </button>
  );
}

export function TopBar({ center, right, autoHide = false }: { center?: ReactNode; right?: ReactNode; autoHide?: boolean }) {
  const { t } = useI18n();
  return (
    <header className="topbar" data-autohide={autoHide || undefined}>
      <div className="topbar-left">
        <Wordmark label={t("nav.home")} />
      </div>
      <div className="topbar-center">{center}</div>
      <nav className="topbar-right" aria-label="EIDOS">
        {right ?? (
          <>
            <LanguageToggle />
            <SoundToggle />
            <Link className="btn-secondary" href="/atlas">
              {t("nav.atlas")}
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
