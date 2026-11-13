import type { ColorRole, PaletteId } from "@/lib/world/types";

export interface Palette {
  id: PaletteId;
  primary: string;
  secondary: string;
  accent: string;
  glow: string;
}

export const PALETTES: Record<PaletteId, Palette> = {
  aurora: { id: "aurora", primary: "#7CF7D4", secondary: "#5BC8FF", accent: "#A78BFA", glow: "#F0F6FF" },
  magma: { id: "magma", primary: "#FF6B3D", secondary: "#FFB547", accent: "#FF3D7F", glow: "#FFE8C2" },
  abismo: { id: "abismo", primary: "#1E6BFF", secondary: "#00D1FF", accent: "#7AF0FF", glow: "#E6FBFF" },
  bioluz: { id: "bioluz", primary: "#39FF88", secondary: "#00E0B8", accent: "#B6FF5C", glow: "#EFFFF4" },
  solar: { id: "solar", primary: "#FFD166", secondary: "#FF9F1C", accent: "#FF4D6D", glow: "#FFF3D6" },
  tinta: { id: "tinta", primary: "#E9ECF5", secondary: "#9AA3B8", accent: "#5BE7FF", glow: "#FFFFFF" },
  jade: { id: "jade", primary: "#00C2A8", secondary: "#7BE495", accent: "#2EE6D6", glow: "#E8FFF6" },
  nebulosa: { id: "nebulosa", primary: "#FF7AD9", secondary: "#8B5CF6", accent: "#38BDF8", glow: "#FDF4FF" },
};

export type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, "$1$1") : h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function paletteRgb(p: Palette, role: ColorRole): RGB {
  return hexToRgb(p[role]);
}

export function mixRgb(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** Four-stop gradient primary → secondary → accent → glow, t ∈ [0,1]. */
export function paletteGradient(p: Palette, t: number): RGB {
  const stops: RGB[] = [hexToRgb(p.primary), hexToRgb(p.secondary), hexToRgb(p.accent), hexToRgb(p.glow)];
  const x = Math.min(Math.max(t, 0), 1) * 3;
  const i = Math.min(Math.floor(x), 2);
  return mixRgb(stops[i]!, stops[i + 1]!, x - i);
}
