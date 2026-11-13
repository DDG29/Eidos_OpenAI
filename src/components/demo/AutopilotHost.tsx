"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n";
import { ShortcutsDialog } from "@/components/ui/SettingsPanel";
import { AutopilotAborted, VirtualCursor, runMainScript, runPitchScript, type PilotLine } from "@/demo/autopilot";

/**
 * Mounted once in the app shell so a run survives route changes (landing → forge → world → landing).
 * Shift+D or `?autopilot=1` starts it; Esc stops it. Also owns the global `?` shortcuts dialog.
 */
export function AutopilotHost() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [line, setLine] = useState<PilotLine | null>(null);
  const [help, setHelp] = useState(false);
  const cursorEl = useRef<HTMLDivElement>(null);
  const trailEl = useRef<HTMLDivElement>(null);
  const ctrl = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    ctrl.current?.abort();
    ctrl.current = null;
  }, []);

  const [runId, setRunId] = useState(0);
  const start = useCallback(() => {
    if (ctrl.current) return;
    ctrl.current = new AbortController();
    setRunning(true);
    setRunId((n) => n + 1);
  }, []);

  // The script starts after the commit that mounts the cursor, so its element always exists by then.
  useEffect(() => {
    const ac = ctrl.current;
    if (!runId || !ac || ac.signal.aborted || !cursorEl.current) return;
    const env = {
      navigate: (url: string) => router.push(url),
      signal: ac.signal,
      cursor: new VirtualCursor(cursorEl.current, trailEl.current),
      say: (l: PilotLine) => setLine(l),
      speed: 2,
    };
    const run = window.location.pathname.startsWith("/pitch") ? runPitchScript(env) : runMainScript(env, locale);
    void run
      .catch((e: unknown) => {
        if (!(e instanceof AutopilotAborted)) console.warn("[autopilot]", e instanceof Error ? e.message : e);
      })
      .finally(() => {
        if (ctrl.current === ac) ctrl.current = null;
        setRunning(false);
        setLine(null);
      });
    // Runs once per start; router and locale changes during a run must not restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("autopilot");
    if (q !== "1" && q !== "live") return;
    const id = window.setTimeout(start, 1200);
    return () => window.clearTimeout(id);
  }, [start]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.isTrusted) return; // the autopilot's own key presses must never toggle it
      const el = e.target as HTMLElement | null;
      const typing = el?.tagName === "INPUT" || el?.tagName === "TEXTAREA" || el?.tagName === "SELECT" || !!el?.isContentEditable;
      if (e.key === "Escape" && ctrl.current) {
        stop();
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.shiftKey && (e.key === "D" || e.key === "d")) {
        e.preventDefault();
        if (ctrl.current) stop();
        else start();
      } else if (e.key === "?") {
        e.preventDefault();
        setHelp((h) => !h);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [start, stop]);

  useEffect(() => () => stop(), [stop]);

  return (
    <>
      {running && (
        <>
          <div ref={trailEl} className="pilot-trail" aria-hidden />
          <div ref={cursorEl} className="pilot-cursor" aria-hidden />
          <p className="pilot-caption caps" role="status">
            <span>{t("autopilot.running")}</span>
            {line && <span className="pilot-line">{t(`autopilot.${line}` as MessageKey)}</span>}
          </p>
        </>
      )}
      {help && <ShortcutsDialog onClose={() => setHelp(false)} />}
    </>
  );
}
