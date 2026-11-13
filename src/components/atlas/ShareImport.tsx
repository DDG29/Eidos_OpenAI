"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { TopBar } from "@/components/ui/TopBar";
import { decodeWorld, parseWorldFile } from "@/lib/share";
import { saveWorld } from "@/lib/storage/worlds";

/** /s/#z=… (fragment never reaches the server) and /s/<id> (KV) import a shared world (spec 10.7). */
export function ShareImport({ shareId }: { shareId?: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    void (async () => {
      let w = null;
      if (shareId) {
        const r = await fetch(`/api/share/${encodeURIComponent(shareId)}`);
        if (r.ok) w = parseWorldFile(((await r.json()) as { world: unknown }).world);
      } else {
        const z = new URLSearchParams(window.location.hash.slice(1)).get("z");
        if (z) w = decodeWorld(z);
      }
      if (!w) return setFailed(true);
      await saveWorld({ ...w, origin: "shared" });
      router.replace(`/m/${w.id}`);
    })();
  }, [shareId, router]);
  return (
    <>
      <TopBar />
      <main id="main" className="page player-missing">
        <h1 className="display">{failed ? t("share.invalid") : t("share.import")}</h1>
        {failed && (
          <Link className="btn-primary" href="/atlas">
            {t("player.goAtlas")}
          </Link>
        )}
      </main>
    </>
  );
}
