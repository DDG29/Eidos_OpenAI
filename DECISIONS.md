# Decision log

Every non-obvious choice made while building EIDOS, with the alternative that was rejected and why.
Format: date · decision · rejected alternative · reason.

## 2026-11-12

1. **Vanilla three.js + `postprocessing` instead of `@react-three/fiber`.**
   Rejected: R3F `<Canvas>` + drei + `@react-three/postprocessing`.
   Reason: the master prompt already requires the engine to live outside React (1.10, 5.2) and to never push per-frame data through React. A plain `Stage` class owning the `WebGLRenderer`, mounted once by a tiny `StageCanvas` client component in the root layout, gives the same persistence across routes with fewer peer-dependency constraints (React 19.3 / Next 16.4), a smaller 3D bundle, and full control of the GPGPU passes and context-loss handling. `postprocessing@6.39.6` supports `three@0.187`.

2. **TypeScript 6.0.3, ESLint 9.39.** Rejected: TypeScript 7.0 (latest) and ESLint 10.
   Reason: `typescript-eslint` (pulled by `eslint-config-next@16.4.6`) supports `typescript <6.1`; several React lint plugins are not yet validated on ESLint 10.

3. **Text and glyph shapes are rasterized in pure TypeScript** (opentype.js glyph outlines → SVG path → our own scanline rasterizer), not with `OffscreenCanvas`.
   Rejected: `OffscreenCanvas` + `FontFace` inside the worker (spec 5.16 default).
   Reason: identical output in Node (Vitest), every browser worker and Safari versions without worker fonts; this is required by the determinism rule (5.1 #8) used by replays, QA shots and tests. The SVG path parser doubles as the `glyph` validator. Fonts: static TTF instances of Bodoni Moda (opsz 96, wght 500) and Atkinson Hyperlegible Next (600) in `public/fonts/` (OFL).

4. **Web server tools default to `web_search_20260209` / `web_fetch_20260209`.**
   Rejected: `web_search_20250305` / `web_fetch_20250910` (spec 9.4).
   Reason: current Claude API docs list the `_20260209` variants (dynamic filtering) as the ones to prefer on Opus 5.5 / Sonnet 5.5. Both remain overridable with `EIDOS_WEB_SEARCH_VERSION` / `EIDOS_WEB_FETCH_VERSION`.

5. **No `ANTHROPIC_API_KEY` exists in the build environment.**
   Consequence (spec 11.2 "sin clave"): demo worlds are written by hand from original sources in `content/sources/`, citations are computed by `pnpm demo:cite` from literal `quote` substrings, forge replays are synthesized (`synthetic: true`), and every live path is tested with fixtures shaped exactly like API events. The UI labels all of this as "Repetición"/"sintetizada".

6. **Pricing for Sonnet 5.5 and Haiku 5.5** is taken from the Claude API reference bundled with Claude Code (cached 2026-11-03): Sonnet 5.5 $2 / $10 per MTok (cache read $0.10), Haiku 5.5 $0.10 / $0.50 (prompts ≤ 100K). Opus 5.5 $4 / $20 (cache read $0.20, writes $5 for 5 min and $8 for 1 h, per spec 9.1).

7. **Refusal fallbacks.** Requests to `claude-opus-5-5` and `claude-sonnet-5-5` go through the beta Messages endpoint with `betas: ["server-side-fallback-2026-07-01"]` and `fallbacks: "default"`, so a safety-classifier refusal is retried server-side on a fallback model by category. Disable with `EIDOS_DISABLE_FALLBACKS=1`.

8. **Git identities.** Commits alternate between two author identities as instructed by the project owner; no AI attribution lines are added to commit messages.
