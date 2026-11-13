"use client";

/** Client-side PDF metadata + first-page thumbnail (pdfjs-dist, loaded on demand). */
export async function pdfInfo(file: File): Promise<{ pages: number; thumb: string | null }> {
  try {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
    const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
    const doc = await task.promise;
    const page = await doc.getPage(1);
    const vp = page.getViewport({ scale: 1 });
    const v2 = page.getViewport({ scale: 120 / vp.width });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(v2.width);
    canvas.height = Math.ceil(v2.height);
    await page.render({ canvas, viewport: v2 }).promise;
    const thumb = canvas.toDataURL("image/png");
    const pages = doc.numPages;
    void task.destroy();
    return { pages, thumb };
  } catch {
    return { pages: 0, thumb: null };
  }
}

/** Downscale an image to ≤ 256 px for the `image` particle shape. */
export async function imageForParticles(file: File): Promise<{ width: number; height: number; data: Uint8ClampedArray } | null> {
  try {
    const bmp = await createImageBitmap(file);
    const s = Math.min(1, 256 / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * s));
    const h = Math.max(1, Math.round(bmp.height * s));
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bmp, 0, 0, w, h);
    const d = ctx.getImageData(0, 0, w, h);
    return { width: w, height: h, data: d.data };
  } catch {
    return null;
  }
}
