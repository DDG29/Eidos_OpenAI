import type { ImageLike, RasterHelper } from "../types";
import { textPolylines } from "./fonts";

export function createRasterHelper(image: ImageLike | null = null): RasterHelper {
  return { text: textPolylines, image };
}
