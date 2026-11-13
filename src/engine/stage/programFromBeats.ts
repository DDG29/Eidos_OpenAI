import type { Beat, PaletteId } from "@/lib/world/types";
import type { ProgramInput } from "../compile/program";
import type { ProgramOptions } from "./Stage";

const FLAT = new Set(["text", "glyph", "image", "bars", "scatter"]);

export function isFlatBeat(b: Pick<Beat, "layers">): boolean {
  const main = b.layers[0];
  if (!main) return false;
  if (main.shape === "scatter") return (main.params.find((p) => p.key === "dims")?.value ?? 2) < 3;
  return FLAT.has(main.shape);
}

/** World beats → engine program + per-beat camera options. */
export function programFromBeats(id: string, palette: PaletteId, beats: Pick<Beat, "id" | "kind" | "layers" | "transition" | "camera">[], count: number, frames?: number[]): { input: ProgramInput; opts: ProgramOptions } {
  return {
    input: {
      id,
      palette,
      count,
      beats: beats.map((b) => ({ id: b.id, layers: b.layers, transition: b.transition, dustFraction: b.kind === "hook" || b.kind === "finale" ? 0.12 : 0.06 })),
    },
    opts: { cameras: beats.map((b) => b.camera), frames, faces: beats.map(isFlatBeat) },
  };
}
