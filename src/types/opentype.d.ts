declare module "opentype.js" {
  export interface PathCommand {
    type: "M" | "L" | "C" | "Q" | "Z";
    x?: number;
    y?: number;
    x1?: number;
    y1?: number;
    x2?: number;
    y2?: number;
  }
  export interface Path {
    commands: PathCommand[];
    getBoundingBox(): { x1: number; y1: number; x2: number; y2: number };
  }
  export interface Glyph {
    index: number;
    advanceWidth?: number;
  }
  export interface Font {
    unitsPerEm: number;
    ascender: number;
    descender: number;
    getPath(text: string, x: number, y: number, fontSize: number, options?: Record<string, unknown>): Path;
    charToGlyph(char: string): Glyph;
  }
  export function parse(buffer: ArrayBuffer): Font;
}
