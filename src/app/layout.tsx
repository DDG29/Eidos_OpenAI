import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@/styles/globals.css";
import { atkinson, atkinsonMono, bodoni } from "./fonts";
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import { getRequestLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n";
import { AppShell } from "@/components/ui/AppShell";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return {
    metadataBase: new URL(site),
    title: { default: translate(locale, "meta.title"), template: "%s · EIDOS" },
    description: translate(locale, "meta.description"),
    openGraph: {
      title: translate(locale, "meta.title"),
      description: translate(locale, "meta.description"),
      images: ["/og/eidos.png"],
      type: "website",
    },
    icons: { icon: "/favicon.svg" },
  };
}

export const viewport: Viewport = {
  themeColor: "#04050A",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getRequestLocale();
  return (
    <html
      lang={locale === "es" ? "es-MX" : "en"}
      className={`${bodoni.variable} ${atkinson.variable} ${atkinsonMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        <I18nProvider initialLocale={locale}>
          <AppShell>{children}</AppShell>
        </I18nProvider>
      </body>
    </html>
  );
}
