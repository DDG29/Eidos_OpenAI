"use client";

import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { StageMount } from "./StageMount";
import { AutopilotHost } from "@/components/demo/AutopilotHost";

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  return (
    <>
      <a href="#main" className="skip-link caps">
        {t("nav.skip")}
      </a>
      <StageMount />
      {children}
      <AutopilotHost />
    </>
  );
}
