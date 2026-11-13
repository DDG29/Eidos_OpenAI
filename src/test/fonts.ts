import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FONT_FILES, hasFont, registerFont, type FontWeight } from "@/engine/shapes/raster/fonts";

/** Node-side font loading for tests and scripts (the browser worker fetches the same files). */
export function loadFontsFromDisk(root = process.cwd()) {
  for (const w of Object.keys(FONT_FILES) as FontWeight[]) {
    if (hasFont(w)) continue;
    const buf = readFileSync(join(root, "public", FONT_FILES[w]));
    registerFont(w, buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  }
}
