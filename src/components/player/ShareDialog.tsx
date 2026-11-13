"use client";

import { useEffect, useId, useState } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useHealth } from "@/lib/useHealth";
import { encodeWorld, MAX_FRAGMENT, shareable } from "@/lib/share";
import { downloadJSON } from "@/lib/download";
import { postJSON } from "@/lib/sse/client";
import type { World } from "@/lib/world/types";
import { IconClose, IconDownload } from "@/components/ui/icons";

/** Share (spec 3.13, 10.7): KV short link when configured, otherwise a compressed URL fragment, else a file. */
export function ShareDialog({ world, onClose }: { world: World; onClose: () => void }) {
  const { t } = useI18n();
  const id = useId();
  const health = useHealth((s) => s.health);
  const [link, setLink] = useState<string | null>(null);
  const [tooBig, setTooBig] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const origin = window.location.origin;
      if (health?.features.share === "kv") {
        try {
          const r = await postJSON<{ id: string }>("/api/share", { world: shareable(world) });
          if (alive) setLink(`${origin}/s/${r.id}`);
          return;
        } catch {
          /* fall back to the fragment */
        }
      }
      const z = encodeWorld(world);
      if (!alive) return;
      if (z.length > MAX_FRAGMENT) setTooBig(true);
      else setLink(`${origin}/s/#z=${z}`);
    })();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      alive = false;
      window.removeEventListener("keydown", onKey);
    };
  }, [world, health, onClose]);

  return (
    <div className="dialog-scrim" onClick={onClose}>
      <div className="dialog panel" role="dialog" aria-modal="true" aria-labelledby={`${id}-h`} onClick={(e) => e.stopPropagation()} data-ui>
        <header className="dialog-head">
          <h2 id={`${id}-h`} className="display">
            {t("share.title")}
          </h2>
          <button type="button" className="btn-icon" aria-label={t("ui.close")} onClick={onClose}>
            <IconClose />
          </button>
        </header>
        <p className="ui dialog-note">{t("share.note")}</p>
        {link && (
          <label className="share-link">
            <span className="caps">{t("share.link")}</span>
            <input className="field mono" readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
          </label>
        )}
        {!link && !tooBig && <p className="ui">{t("share.making")}</p>}
        {tooBig && <p className="ui">{t("share.tooBig")}</p>}
        <div className="dialog-actions">
          {link && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                void navigator.clipboard?.writeText(link).then(() => setCopied(true));
              }}
            >
              {copied ? t("share.copied") : t("share.copy")}
            </button>
          )}
          <button type="button" className="btn-secondary" onClick={() => downloadJSON(`${world.id}.eidos.json`, shareable(world))}>
            <IconDownload size={16} /> {t("player.export")}
          </button>
        </div>
      </div>
    </div>
  );
}
