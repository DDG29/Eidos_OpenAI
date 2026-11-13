"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { Level, World } from "@/lib/world/types";
import { LensDial } from "@/components/ui/LensDial";
import { SettingsPanel, ShortcutsDialog } from "@/components/ui/SettingsPanel";
import { downloadJSON } from "@/lib/download";
import { shareable } from "@/lib/share";

/** The "…" menu of the player (spec 3.6): export, Engine Room, settings, fullscreen, presentation, shortcuts. */
export function PlayerMenu({ world, onClose, onEngineRoom, onLevel, level, mobile, present, worldId }: {
  world: World;
  onClose: () => void;
  onEngineRoom: () => void;
  onLevel: (l: Level) => void;
  level: Level;
  mobile: boolean;
  present: boolean;
  worldId: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [panel, setPanel] = useState<"settings" | "shortcuts" | null>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("button")?.focus();
    const onDown = (e: PointerEvent) => {
      if (!panel && !ref.current?.contains(e.target as Node) && !(e.target as HTMLElement).closest('[aria-label="' + t("player.more") + '"]')) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !panel && onClose();
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, panel, t]);

  if (panel === "settings") return <SettingsPanel onClose={onClose} />;
  if (panel === "shortcuts") return <ShortcutsDialog onClose={onClose} />;

  const item = (label: string, on: () => void) => (
    <button
      type="button"
      role="menuitem"
      className="menu-item ui"
      onClick={() => {
        on();
      }}
    >
      {label}
    </button>
  );
  return (
    <div ref={ref} className="player-menu panel" role="menu" data-ui>
      {mobile && <LensDial value={level} onChange={onLevel} />}
      {item(t("player.engineRoom"), () => {
        onEngineRoom();
        onClose();
      })}
      {item(t("player.export"), () => {
        downloadJSON(`${world.id}.eidos.json`, shareable(world));
        onClose();
      })}
      {item(t("player.present"), () => {
        router.replace(present ? `/m/${worldId}` : `/m/${worldId}?present=1`);
        onClose();
      })}
      {item(t("player.fullscreen"), () => {
        void (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.());
        onClose();
      })}
      {item(t("player.settings"), () => setPanel("settings"))}
      {item(t("player.shortcuts"), () => setPanel("shortcuts"))}
    </div>
  );
}
