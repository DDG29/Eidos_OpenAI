"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n";
import { loadWorld } from "@/lib/storage/worlds";
import type { World } from "@/lib/world/types";
import { describeScene } from "@/lib/world/describe";
import { citationLocation } from "@/lib/world/verification";
import { stageStore } from "@/engine/stage/stageStore";
import { TopBar } from "@/components/ui/TopBar";
import { Figure } from "./Figure";

/**
 * Reading mode (spec 3.11): the same world as a linear editorial article — the complete accessible
 * alternative, printable, no WebGL required. The stage is dimmed and paused while it is open.
 */
export function ReadingView({ worldId }: { worldId: string }) {
  const { t, locale } = useI18n();
  const [world, setWorld] = useState<World | null | undefined>(undefined);

  useEffect(() => {
    void loadWorld(worldId, locale).then(setWorld);
  }, [worldId, locale]);

  useEffect(() => {
    document.documentElement.dataset.reading = "1";
    stageStore.setState({ stable: false });
    return () => {
      delete document.documentElement.dataset.reading;
    };
  }, []);

  const notes = useMemo(() => {
    if (!world) return { order: [] as string[], index: new Map<string, number>() };
    const order: string[] = [];
    for (const b of world.spec.beats) for (const s of b.sentences) for (const f of s.factIds) if (!order.includes(f)) order.push(f);
    return { order, index: new Map(order.map((f, i) => [f, i + 1])) };
  }, [world]);

  if (world === undefined) return <TopBar />;
  if (world === null)
    return (
      <>
        <TopBar />
        <main id="main" className="page player-missing">
          <h1 className="display">{t("player.notFound")}</h1>
          <Link className="btn-primary" href="/atlas">
            {t("player.goAtlas")}
          </Link>
        </main>
      </>
    );

  const lang = world.spec.language;
  const facts = new Map(world.facts.map((f) => [f.id, f]));
  const checks = world.spec.beats.filter((b) => b.kind === "check");
  const date = new Intl.DateTimeFormat(locale === "es" ? "es-MX" : "en-US", { dateStyle: "long" }).format(new Date(world.createdAt));
  let fig = 0;

  return (
    <>
      <TopBar
        right={
          <>
            <Link className="btn-secondary" href={`/m/${worldId}`}>
              {t("reading.back")}
            </Link>
            <button type="button" className="btn-primary reading-print" onClick={() => window.print()}>
              {t("reading.print")}
            </button>
          </>
        }
      />
      <main id="main" className="page reading" lang={lang === "es" ? "es-MX" : "en"}>
        <article>
          <header className="reading-head">
            <h1 className="display">{world.spec.title}</h1>
            <p className="lead">{world.spec.subtitle}</p>
            <p className="caps reading-meta">
              {t("reading.level")}: {t(`lens.${world.spec.level}` as MessageKey)} · {date} · {t("reading.source")}: {world.source.title}
            </p>
          </header>
          {world.spec.beats.map((b) => {
            if (b.kind === "finale")
              return (
                <section key={b.id} className="reading-section">
                  <h2 className="display">{t("reading.closing")}</h2>
                  <p>{world.spec.closing}</p>
                </section>
              );
            const isCheck = b.kind === "check";
            fig++;
            return (
              <section key={b.id} className="reading-section" id={`r-${b.id}`}>
                <h2 className="display">{b.title}</h2>
                <figure className="reading-figure">
                  <Figure beat={b} palette={world.spec.palette} worldId={world.id} alt={describeScene(b, lang)} />
                  <figcaption className="ui">
                    <span className="caps">{t("reading.figure", { n: fig })}.</span> {describeScene(b, lang)}
                  </figcaption>
                </figure>
                {isCheck ? (
                  <div className="reading-check">
                    <p className="reading-q">
                      <strong>{t("reading.question", { n: checks.indexOf(b) + 1 })}.</strong> {b.check.question}
                    </p>
                    <ol type="A">
                      {b.check.choices.map((c, i) => (
                        <li key={i}>{c.text}</li>
                      ))}
                    </ol>
                    <p className="reading-answer-space caps">{t("reading.answerSpace")}</p>
                  </div>
                ) : (
                  <p>
                    {b.sentences.map((s, i) => (
                      <span key={i}>
                        {s.text}
                        {s.factIds.length > 0 && (
                          <sup className="reading-ref">
                            {s.factIds.map((f, k) => (
                              <a key={f} href={`#note-${f}`}>
                                {k > 0 ? "," : ""}
                                {notes.index.get(f)}
                              </a>
                            ))}
                          </sup>
                        )}{" "}
                      </span>
                    ))}
                  </p>
                )}
              </section>
            );
          })}
          {checks.length > 0 && (
            <section className="reading-section reading-solutions">
              <h2 className="display">{t("reading.solutions")}</h2>
              <ol>
                {checks.map((b) => (
                  <li key={b.id}>
                    <strong>{String.fromCharCode(65 + b.check.correctIndex)}.</strong> {b.check.choices[b.check.correctIndex]?.text} — {b.check.explanation}
                  </li>
                ))}
              </ol>
            </section>
          )}
          <section className="reading-section reading-notes">
            <h2 className="display">{t("reading.notes")}</h2>
            <ol>
              {notes.order.map((f) => {
                const fact = facts.get(f);
                const c = fact?.citations[0];
                return (
                  <li key={f} id={`note-${f}`}>
                    {c ? (
                      <>
                        “{c.citedText.trim()}” — <em>{c.title ?? c.documentTitle}</em>
                        {citationLocation(c, lang) ? `, ${citationLocation(c, lang)}` : ""}
                        {c.url ? (
                          <>
                            {" "}
                            <a href={c.url}>{c.url}</a>
                          </>
                        ) : null}
                      </>
                    ) : (
                      <>
                        {fact?.text} ({t("reading.generalNote")})
                      </>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        </article>
      </main>
    </>
  );
}
