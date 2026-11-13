import { Atkinson_Hyperlegible_Mono, Atkinson_Hyperlegible_Next, Bodoni_Moda } from "next/font/google";

export const bodoni = Bodoni_Moda({
  subsets: ["latin", "latin-ext"],
  weight: "variable",
  axes: ["opsz"],
  display: "swap",
  variable: "--font-bodoni",
  preload: true,
});

export const atkinson = Atkinson_Hyperlegible_Next({
  subsets: ["latin", "latin-ext"],
  weight: "variable",
  display: "swap",
  variable: "--font-atkinson",
  adjustFontFallback: false,
});

export const atkinsonMono = Atkinson_Hyperlegible_Mono({
  subsets: ["latin", "latin-ext"],
  weight: "variable",
  display: "swap",
  variable: "--font-atkinson-mono",
  preload: false,
  adjustFontFallback: false,
});
