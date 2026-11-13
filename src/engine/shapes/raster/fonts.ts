import * as opentype from "opentype.js";
import type { Font } from "opentype.js";

// opentype.js ships ESM with named exports and a UMD build for Node; support both module shapes.
const ns = opentype as unknown as { parse?: (b: ArrayBuffer) => Font; default?: { parse: (b: ArrayBuffer) => Font } };
const parse = (b: ArrayBuffer): Font => (ns.parse ?? ns.default!.parse)(b);
import { polylinesFromCommands, type Polyline } from "./svgPath";

/**
 * Particle text uses static TTF instances of the design system fonts (DECISIONS.md #3). They are loaded once
 * per worker (or per Node test process) before any generator that needs them runs.
 */
export type FontWeight = "display" | "body";
export const FONT_FILES: Record<FontWeight, string> = {
  display: "/fonts/BodoniModa-Display500.ttf",
  body: "/fonts/AtkinsonHyperlegibleNext-600.ttf",
};

const fonts: Partial<Record<FontWeight, Font>> = {};

export function registerFont(weight: FontWeight, buffer: ArrayBuffer) {
  fonts[weight] = parse(buffer);
}

export function hasFont(weight: FontWeight): boolean {
  return !!fonts[weight];
}

export async function ensureFonts(fetcher: (url: string) => Promise<ArrayBuffer>): Promise<void> {
  await Promise.all(
    (Object.keys(FONT_FILES) as FontWeight[]).map(async (w) => {
      if (!fonts[w]) registerFont(w, await fetcher(FONT_FILES[w]));
    }),
  );
}

/** Text → glyph outlines as polylines (y down), one entry per character for region assignment. */
export function textPolylines(content: string, weight: FontWeight): { chars: { char: string; polys: Polyline[] }[]; ok: boolean } {
  const font = fonts[weight] ?? fonts.display ?? fonts.body;
  if (!font) return { chars: [], ok: false };
  const size = 200;
  const chars: { char: string; polys: Polyline[] }[] = [];
  let x = 0;
  for (const ch of Array.from(content)) {
    const g = font.charToGlyph(ch);
    const fallback = g.index === 0 && ch.trim() !== "" ? (fonts.body ?? font) : font;
    const path = fallback.getPath(ch, x, 0, size);
    const adv = ((fallback.charToGlyph(ch).advanceWidth ?? font.unitsPerEm * 0.5) / fallback.unitsPerEm) * size;
    chars.push({ char: ch, polys: polylinesFromCommands(path.commands, 10) });
    x += adv;
  }
  return { chars, ok: true };
}
