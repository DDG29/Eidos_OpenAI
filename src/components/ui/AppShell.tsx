"use client";

import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  return (
    <>
      <a href="#main" className="skip-link caps">
        {t("nav.skip")}
      </a>
      {children}
    </>
  );
}
