# Credits and licenses

EIDOS's own code is released under the MIT license. Everything below belongs to its authors under its own license.

## Typefaces (SIL Open Font License 1.1)

- **Bodoni Moda** — Owen Earl (indestructible type*). Display face; static TTF instance (opsz 96, wght 500) in
  `public/fonts/` for particle text.
- **Atkinson Hyperlegible Next** and **Atkinson Hyperlegible Mono** — Braille Institute of America. Interface and
  reading text.

## Algorithms

- **Simplex noise** (3D) in the shaders and generators — after Stefan Gustavson and Ian McEwan's public-domain /
  MIT GLSL implementation (`webgl-noise`), adapted.
- **Hilbert curve** keys for particle pairing — the classic Skilling transpose construction, written from the
  description in the literature.
- **INFLESZ** readability (Barrio-Cantalejo et al., 2008) for Spanish and **Flesch reading ease** for English.
- **Farthest-point sampling** for annotation anchors; **chamfer distance** for the glyph "pillow" profile.

## Libraries

| Library | License | Used for |
|---|---|---|
| Next.js, React, React DOM | MIT | App framework |
| three.js | MIT | WebGL rendering |
| postprocessing | Zlib | Bloom, chromatic aberration, noise, vignette, tone mapping |
| GSAP (with SplitText) | GreenSock standard license (free) | Ticker, text reveals |
| Lenis | MIT | Smooth scroll |
| Comlink | Apache-2.0 | Worker RPC |
| opentype.js | MIT | Glyph outlines for particle text |
| pdf.js (`pdfjs-dist`), pdf-lib | Apache-2.0, MIT | PDF page counts and trimming |
| sharp | Apache-2.0 | Posters and image preprocessing |
| Zod | MIT | Validation at every boundary |
| zustand | MIT | UI state |
| idb-keyval | Apache-2.0 | Local world storage |
| lz-string | MIT (WTFPL-compatible) | Share links in the URL fragment |
| nanoid | MIT | Ids |
| detect-gpu | MIT | Initial quality tier (with its benchmark data in `public/benchmarks/`) |
| lucide-react | ISC | A few interface icons |
| @upstash/redis | MIT | Optional short share links |
| @anthropic-ai/sdk | MIT | Claude API |
| Vitest, Playwright, axe-core, fast-check, ESLint, TypeScript | MIT / Apache-2.0 / MPL-2.0 | Quality |

## Content

- Demo-world sources in `content/sources/` are original texts written for EIDOS; their reference lists name the
  works they draw on.
- Figures in the pitch about PISA 2025 come from the press coverage listed in the pitch world, which cites the
  OECD country note.
- All particle silhouettes (axolotl, leaf, scissors, red blood cells, …) are original drawings made for EIDOS.
