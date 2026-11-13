import type { Layer, ShapeId } from "./types";

export function makeLayer(shape: ShapeId, over: Partial<Layer> = {}): Layer {
  return {
    shape,
    params: [],
    expr: [],
    data: [],
    share: 1,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: 1,
    colorMode: "palette",
    tint: "primary",
    ...over,
  };
}

export function kv<T>(o: Record<string, T>): { key: string; value: T }[] {
  return Object.entries(o).map(([key, value]) => ({ key, value }));
}
