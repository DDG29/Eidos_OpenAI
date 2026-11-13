"use client";

import { useEffect, useRef } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { IconQuestion, IconWhy, IconZoom } from "@/components/ui/icons";

/** Radial scene menu (spec 4.8.8): three options on a 120° arc above the click point. */
export function RadialMenu({ x, y, region, onWhat, onWhy, onCloser, onClose }: { x: number; y: number; region: string; onWhat: () => void; onWhy: () => void; onCloser: () => void; onClose: () => void }) {
  const { t } = useI18n();
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const onDown = (e: PointerEvent) => !(e.target as HTMLElement).closest(".radial") && onClose();
    const onWheel = () => onClose();
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("wheel", onWheel);
    };
  }, [onClose]);
  const opts = [
    { label: t("radial.what"), icon: <IconQuestion size={20} />, on: onWhat },
    { label: t("radial.why"), icon: <IconWhy size={20} />, on: onWhy },
    { label: t("radial.closer"), icon: <IconZoom size={20} />, on: onCloser },
  ];
  const cx = Math.min(window.innerWidth - 110, Math.max(110, x));
  const cy = Math.max(150, y);
  return (
    <div className="radial" role="menu" aria-label={`${t("radial.label")}: ${region}`} style={{ left: cx, top: cy }} data-ui>
      <span className="radial-dot" aria-hidden />
      <span className="radial-region caps">{region}</span>
      {opts.map((o, i) => {
        const a = ((-150 + i * 60) * Math.PI) / 180; // 120° arc above the point
        return (
          <button
            key={i}
            ref={i === 0 ? first : undefined}
            type="button"
            role="menuitem"
            className="radial-opt"
            style={{ transform: `translate(${(Math.cos(a) * 78).toFixed(1)}px, ${(Math.sin(a) * 78).toFixed(1)}px)`, ["--i" as string]: i }}
            onClick={() => {
              o.on();
              onClose();
            }}
          >
            <span className="radial-circle">{o.icon}</span>
            <span className="caps radial-label">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
