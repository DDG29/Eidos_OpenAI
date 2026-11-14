"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { PALETTES } from "@/engine/palettes";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n";
import type { WorldSummary } from "@/lib/storage/worlds";

/** Asymmetric atlas (spec 3.4): never three equal cards. Sizes cycle through a 12-column editorial rhythm. */
const SPANS = ["a", "b", "c", "c", "b", "a", "c", "b"];

export function AtlasGrid({ worlds }: { worlds: (WorldSummary & { poster?: boolean })[] }) {
  const { t } = useI18n();
  return (
    <ul className="atlas-grid">
      {worlds.map((w, i) => {
        const p = PALETTES[w.palette];
        const style = { "--p1": p.primary, "--p2": p.secondary, "--p3": p.accent, "--p4": p.glow } as CSSProperties;
        return (
          <li key={w.id} className="atlas-item" data-span={SPANS[i % SPANS.length]} style={style}>
            <Link href={`/m/${w.id}`} className="atlas-link">
              <div className="atlas-poster" aria-hidden>
                {w.poster ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/posters/${w.id}.webp`}
                    srcSet={`/posters/${w.id}-480.webp 480w, /posters/${w.id}.webp 960w`}
                    sizes="(max-width: 767px) 100vw, 50vw"
                    width={960}
                    height={600}
                    alt=""
                    // The first card is the largest thing above the fold: load it at once.
                    loading={i === 0 ? "eager" : "lazy"}
                    fetchPriority={i === 0 ? "high" : "auto"}
                  />
                ) : (
                  <span className="atlas-poster-glow" />
                )}
              </div>
              <div className="atlas-meta">
                <span className="caps atlas-origin">{t(`atlas.origin.${w.origin}` as MessageKey)}</span>
                <h3 className="display atlas-title">{w.title}</h3>
                <p className="ui atlas-sub">{w.subtitle}</p>
                <p className="caps atlas-facts">
                  {t(`lens.${w.level}` as MessageKey)} · {t("atlas.beats", { n: w.beats })} · {t("atlas.minutes", { n: w.minutes })}
                  {w.supportedPct !== null ? ` · ${t("atlas.supported", { n: w.supportedPct })}` : ""}
                </p>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
