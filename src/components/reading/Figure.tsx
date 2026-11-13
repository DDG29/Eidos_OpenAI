"use client";

import { useEffect, useState } from "react";
import type { Beat, PaletteId } from "@/lib/world/types";
import { isFlatBeat } from "@/engine/stage/programFromBeats";

let fontsReady: Promise<void> | null = null;
async function ensureMainFonts() {
  fontsReady ??= import("@/engine/shapes/raster/fonts").then((m) => m.ensureFonts((url) => fetch(url).then((r) => r.arrayBuffer())));
  return fontsReady;
}

/** A still of the beat's form, rendered on the CPU (no WebGL needed), lazily and once. */
export function Figure({ beat, palette, worldId, alt }: { beat: Beat; palette: PaletteId; worldId: string; alt: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const run = async () => {
      await ensureMainFonts();
      const { renderFigurePixels } = await import("@/engine/figure/renderFigure");
      const W = 960,
        H = 600;
      const px = renderFigurePixels({ layers: beat.layers, palette, camera: beat.camera, front: isFlatBeat(beat), width: W, height: H, seed: `${worldId}:${beat.id}` });
      const c = document.createElement("canvas");
      c.width = W;
      c.height = H;
      c.getContext("2d")?.putImageData(new ImageData(new Uint8ClampedArray(px), W, H), 0, 0);
      if (alive) setSrc(c.toDataURL("image/webp", 0.86));
    };
    // Spread the CPU renders over idle time so scrolling stays smooth.
    const id = window.setTimeout(() => void run(), 40 + Math.random() * 400);
    return () => {
      alive = false;
      window.clearTimeout(id);
    };
  }, [beat, palette, worldId]);
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img className="reading-figure-img" src={src} alt={alt} width={960} height={600} /> : <div className="reading-figure-img reading-figure-wait" role="img" aria-label={alt} />;
}
