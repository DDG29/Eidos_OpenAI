"use client";

import { useEffect, useId, useMemo } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n";
import type { AgentRun, World } from "@/lib/world/types";
import { IconClose, IconDownload } from "@/components/ui/icons";
import { PRICES } from "@/lib/pricing";
import { downloadJSON } from "@/lib/download";

const PIPELINE = ["ingest", "cartographer", "director", "skeptic", "compiler"] as const;
const LIVE = ["tutor", "evaluator", "gardener", "brancher", "lens"] as const;

/** The Engine Room (spec 3.12): agent transparency — pipeline, per-call usage, thinking summaries, quality. */
export function EngineRoom({ world, onClose }: { world: World; onClose: () => void }) {
  const { t, locale } = useI18n();
  const id = useId();
  const runs = world.telemetry;
  const replay = runs.some((r) => r.replay) || world.origin === "demo";
  const fmt = (n: number) => new Intl.NumberFormat(locale === "es" ? "es-MX" : "en-US").format(n);
  const usd = (n: number | null) => (n === null ? "—" : `$${n.toFixed(n < 0.01 ? 4 : 3)}`);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const metrics = useMemo(() => {
    const verdicts = Object.values(world.verification).flat();
    const supported = verdicts.filter((v) => v.verdict === "supported" || v.revised).length;
    const used = new Set(world.spec.beats.flatMap((b) => b.sentences.flatMap((s) => s.factIds)));
    const shapes = new Set(world.spec.beats.flatMap((b) => b.layers.map((l) => l.shape)));
    const sentences = world.spec.beats.flatMap((b) => b.sentences).length;
    return {
      supportedPct: verdicts.length ? Math.round((100 * supported) / verdicts.length) : null,
      factsUsed: `${[...used].filter((f) => world.facts.some((x) => x.id === f)).length}/${world.facts.length}`,
      shapes: shapes.size,
      lint: world.lintReport.score,
      sentences,
    };
  }, [world]);

  const totals = useMemo(() => {
    const sum = (k: keyof AgentRun) => runs.reduce((s, r) => s + (typeof r[k] === "number" ? (r[k] as number) : 0), 0);
    const cost = runs.reduce((s, r) => s + (r.costUsd ?? 0), 0);
    // what cached input would have cost at full input price, minus what it did cost
    let saved = 0;
    let inputCost = 0;
    for (const r of runs) {
      const p = PRICES[r.model];
      if (!p) continue;
      saved += (r.cacheReadTokens * (p.input - p.cacheRead)) / 1e6;
      inputCost += ((r.inputTokens + r.cacheReadTokens) * p.input) / 1e6;
    }
    return { inTok: sum("inputTokens"), outTok: sum("outputTokens"), cost, savedPct: inputCost > 0 ? Math.round((100 * saved) / inputCost) : 0 };
  }, [runs]);

  const used = new Set(runs.map((r) => r.agent));
  const agentRun = (a: string) => runs.find((r) => r.agent === a);

  return (
    <aside className="engine-room" role="dialog" aria-modal="false" aria-labelledby={`${id}-h`} data-ui>
      <header className="engine-head">
        <div>
          <h2 id={`${id}-h`} className="display">
            {t("engine.title")}
          </h2>
          <p className="ui engine-lead">{t("engine.lead")}</p>
          {replay && (
            <p className="caps engine-replay">
              {t("engine.replay")}
              {runs.some((r) => r.replay) && world.origin === "demo" ? ` · ${t("engine.synthetic")}` : ""} — {world.origin === "demo" ? t("engine.demo") : ""}
            </p>
          )}
        </div>
        <button type="button" className="btn-icon" aria-label={t("ui.close")} onClick={onClose}>
          <IconClose />
        </button>
      </header>

      <section aria-label={t("engine.pipeline")} className="engine-pipeline">
        <svg viewBox="0 0 760 150" className="pipeline-svg" role="img" aria-label={t("engine.pipeline")}>
          {PIPELINE.map((a, i) => {
            const x = 20 + i * 150;
            const r = agentRun(a === "ingest" ? "reader" : a);
            return (
              <g key={a}>
                {i > 0 && <line x1={x - 32} y1={44} x2={x} y2={44} className="pipe-edge" />}
                <rect x={x} y={20} width={118} height={48} rx={2} className="pipe-node" data-on={a === "ingest" || a === "compiler" || used.has(a as AgentRun["agent"]) || undefined} />
                <text x={x + 59} y={40} className="pipe-label" textAnchor="middle">
                  {t(`agent.${a}` as MessageKey)}
                </text>
                <text x={x + 59} y={58} className="pipe-model" textAnchor="middle">
                  {a === "ingest" || a === "compiler" ? (a === "compiler" ? "local" : world.source.mode) : r ? `${r.model.replace("claude-", "")} · ${r.effort}` : "—"}
                </text>
              </g>
            );
          })}
          {LIVE.map((a, i) => (
            <g key={a}>
              <rect x={20 + i * 150} y={92} width={118} height={40} rx={2} className="pipe-node pipe-live" data-on={used.has(a) || undefined} />
              <text x={79 + i * 150} y={108} className="pipe-label" textAnchor="middle">
                {t(`agent.${a}` as MessageKey)}
              </text>
              <text x={79 + i * 150} y={124} className="pipe-model" textAnchor="middle">
                {agentRun(a) ? `${agentRun(a)!.model.replace("claude-", "")} · ${agentRun(a)!.effort}` : "—"}
              </text>
            </g>
          ))}
        </svg>
      </section>

      <section className="engine-metrics" aria-label={t("engine.quality")}>
        <h3 className="caps">{t("engine.quality")}</h3>
        <dl>
          <div>
            <dt className="caps">{t("engine.supported")}</dt>
            <dd className="mono">{metrics.supportedPct === null ? "—" : `${metrics.supportedPct} %`}</dd>
          </div>
          <div>
            <dt className="caps">{t("engine.factsUsed")}</dt>
            <dd className="mono">{metrics.factsUsed}</dd>
          </div>
          <div>
            <dt className="caps">{t("engine.shapes")}</dt>
            <dd className="mono">{metrics.shapes}</dd>
          </div>
          <div>
            <dt className="caps">{t("engine.lint")}</dt>
            <dd className="mono">{metrics.lint}/100</dd>
          </div>
        </dl>
        {totals.savedPct > 0 && <p className="ui">{t("engine.cacheSaved", { n: totals.savedPct })}</p>}
      </section>

      <section aria-label={t("engine.calls")}>
        <h3 className="caps">{t("engine.calls")}</h3>
        {runs.length === 0 ? (
          <p className="ui">{t("engine.noCalls")}</p>
        ) : (
          <div className="engine-table-wrap">
            <table className="engine-table mono">
              <thead>
                <tr>
                  <th>{t("engine.agent")}</th>
                  <th>{t("engine.model")}</th>
                  <th>{t("engine.effort")}</th>
                  <th>{t("engine.duration")}</th>
                  <th>{t("engine.tokensIn")}</th>
                  <th>{t("engine.tokensOut")}</th>
                  <th>{t("engine.cache")}</th>
                  <th>{t("engine.web")}</th>
                  <th>{t("engine.cost")}</th>
                  <th>{t("engine.stop")}</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id}>
                    <td>{t(`agent.${r.agent}` as MessageKey)}</td>
                    <td>{r.model.replace("claude-", "")}</td>
                    <td>{r.effort}</td>
                    <td>{(r.durationMs / 1000).toFixed(1)} s</td>
                    <td>{fmt(r.inputTokens)}</td>
                    <td>{fmt(r.outputTokens)}</td>
                    <td>
                      {fmt(r.cacheReadTokens)} / {fmt(r.cacheWriteTokens)}
                    </td>
                    <td>{r.webSearches + r.webFetches}</td>
                    <td>{usd(r.costUsd)}</td>
                    <td>{r.stopReason}</td>
                  </tr>
                ))}
                <tr className="engine-total">
                  <td colSpan={4}>{t("engine.total")}</td>
                  <td>{fmt(totals.inTok)}</td>
                  <td>{fmt(totals.outTok)}</td>
                  <td colSpan={2} />
                  <td>{usd(totals.cost)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      {runs.some((r) => r.thinkingSummary) && (
        <section aria-label={t("engine.thinking")}>
          <h3 className="caps">{t("engine.thinking")}</h3>
          {runs
            .filter((r) => r.thinkingSummary)
            .map((r) => (
              <details key={r.id} className="engine-thinking">
                <summary className="ui">
                  {t(`agent.${r.agent}` as MessageKey)} · {r.model.replace("claude-", "")}
                </summary>
                <p className="ui">{r.thinkingSummary}</p>
              </details>
            ))}
        </section>
      )}

      <button type="button" className="btn-secondary" onClick={() => downloadJSON(`${world.id}.spec.json`, world.spec)}>
        <IconDownload size={16} /> {t("engine.download")}
      </button>
    </aside>
  );
}
