"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type FilamentStatus = "truth" | "partial" | "general" | "hypo" | "unverified";

export interface Passage {
  text: string;
  location: string;
  docTitle: string;
  url?: string;
}

/**
 * Per-sentence verification dot (spec 4.8.3): 5 px dot with a 28×28 hit area. Opens a non-modal source panel
 * anchored next to the sentence with the cited passages, their location and the Skeptic's verdict.
 */
export function Filament({ status, label, verdict, note, passages, children, onAsk, askLabel, revisedLabel }: {
  status: FilamentStatus;
  label: string;
  verdict: string;
  note?: string;
  passages: Passage[];
  children?: ReactNode;
  onAsk?: () => void;
  askLabel?: string;
  revisedLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !btn.current) return;
    const r = btn.current.getBoundingClientRect();
    const w = Math.min(360, window.innerWidth - 32);
    const left = Math.min(window.innerWidth - w - 16, Math.max(16, r.left + 18));
    const top = Math.min(window.innerHeight - 40, r.bottom + 8);
    setPos({ left, top });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btn.current?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (!panel.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setOpen(false);
    };
    const onScroll = () => setOpen(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("wheel", onScroll, { passive: true });
    panel.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("wheel", onScroll);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btn}
        type="button"
        className="filament"
        data-status={status}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => window.matchMedia("(hover: hover)").matches && setOpen(true)}
      >
        <span className="filament-dot" aria-hidden />
      </button>
      {open &&
        pos &&
        createPortal(
          <div ref={panel} id={id} role="dialog" aria-modal="false" aria-label={label} tabIndex={-1} className="source-panel" style={{ left: pos.left, top: pos.top }} onMouseLeave={() => setOpen(false)}>
            {passages.length > 0 ? (
              passages.map((p, i) => (
                <figure key={i} className="source-passage">
                  <blockquote>“{p.text}”</blockquote>
                  <figcaption className="caps">
                    {p.url ? (
                      <a href={p.url} target="_blank" rel="noreferrer noopener">
                        {p.docTitle}
                      </a>
                    ) : (
                      p.docTitle
                    )}
                    {p.location ? ` · ${p.location}` : ""}
                  </figcaption>
                </figure>
              ))
            ) : null}
            <p className="source-verdict" data-status={status}>
              <span className="filament-dot" aria-hidden /> {verdict}
              {note ? <span className="source-note">: {note}</span> : null}
            </p>
            {revisedLabel ? <p className="source-revised caps">{revisedLabel}</p> : null}
            {children}
            {onAsk && askLabel ? (
              <button type="button" className="btn-secondary" onClick={onAsk}>
                {askLabel}
              </button>
            ) : null}
          </div>,
          document.body,
        )}
    </>
  );
}
