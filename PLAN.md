# EIDOS — Build plan

Source of truth: `docs/PROMPT_MAESTRO.md`. One box per verifiable deliverable. A phase closes only with
typecheck + lint + test green, a phase-specific verification, a `PROGRESS.md` entry and a commit.

## Phase 0 — Preparation
- [x] Toolchain verified (Node 24, pnpm 12, git), prompt saved to `docs/PROMPT_MAESTRO.md`
- [x] Next.js 16 + React 19 + strict TS (`noUncheckedIndexedAccess`) + ESLint + Tailwind v4 + `@/` alias
- [x] Vitest, Playwright, Prettier configs
- [x] `package.json` scripts of §17.3 (unimplemented ones fail with a clear message)
- [x] Design tokens (`src/styles/tokens.css`), fonts (Bodoni Moda, Atkinson Hyperlegible Next/Mono), base layout + top bar
- [x] i18n skeleton (`es`, `en`, typed `t()`), `.env.example`, `PROGRESS.md`, `DECISIONS.md`

## Phase 1 — Engine core
- [x] `util/rng.ts` (sfc32 + string hash)
- [x] `ParticleField`: textures (from/to/aux/col/trans), `morphBase()` GLSL, GPGPU offset/velocity, points shaders
- [x] Persistent `StageCanvas` in root layout, `stageStore`, post-processing (bloom, CA, grain, vignette, tone mapping)
- [x] `QualityManager` (detect-gpu with local benchmarks, tiers 0–3, live degradation, visibility pause)
- [x] Context loss handling and NaN sanitation
- [x] Shapes: `sphere`, `helix`, `text`, `nebula`; minimal `/lab` with morph slider and transition selector

## Phase 2 — Scroll, camera, landing
- [x] `ScrollConductor` (Lenis + GSAP ticker, active index, local progress, gates, insertion anchoring)
- [x] `CameraRig` (8 presets, asymmetric `setViewOffset`, spherical interpolation, drift, parallax, long-jump arc)
- [x] Shapes `glyph`, `galaxy`, `layers`, `torus`
- [x] Landing: six movements, headline mask reveal, Ruler, keyboard nav, reduced-motion crossfades, WebGL2 fallback poster
- [x] Forge Console UI (modes, Lens dial, quality + estimate line, focus, Demo Mode notice, drag-anywhere)
- [x] Atlas grid (asymmetric) on landing and `/atlas`

## Phase 3 — Full catalog
- [x] ParaMath lexer/parser/evaluator + tests (§7.5 incl. fast-check)
- [x] 28 shape generators with `ShapeDefinition` contract and tests (§14.1)
- [x] Worker (Comlink, transferables), composition with dust, Hilbert pairing + window swaps, stagger delays, regions
- [x] `pnpm catalog` → `src/server/agents/catalog.generated.md` (+ drift test), short catalog
- [x] `/lab` complete (params, expressions, palette, color mode, tier, random morph, copy layer JSON, fps, gen time)
- [x] `pnpm bench` (shapes, pairing, picking)

## Phase 4 — World Spec and player
- [x] Types, send schemas (Zod → JSON Schema, API-rule test), `WorldSpecStrict`, sanitizer, `SpecReport`
- [x] Pedagogical linter incl. INFLESZ / Flesch
- [x] `compileWorld` (effective beat list, sequential pairing, section heights, prefetch)
- [x] Player: sections, line reveal narration, Ruler, Astrolabe, annotations layout, filaments + source panel
- [x] Picking + radial menu, knobs with readout templates, checks with soft gate, Crack, mastery, Constellation finale
- [x] Reading mode `/m/[id]/leer` with print stylesheet
- [x] Engine Room drawer

## Phase 5 — Demo worlds
- [x] Sources (`content/sources/*.md`) for the 5 worlds + smoke source
- [x] `pnpm demo:cite`, `pnpm worlds:check`
- [x] Worlds: transformer, agujeros-negros, fotosintesis, interes-compuesto, ajolote (+ remedials, lens variants, ask replays). crispr not produced (DECISIONS #13)
- [x] `_landing.json`, `eidos-pitch.json`
- [ ] English versions `*.en.json` (interface is bilingual; demo worlds are Spanish only — roadmap)
- [x] Posters

## Phase 6 — AI pipeline
- [x] Claude client wrapper (streaming, pause_turn, retries, cost, errors), model routing, pricing
- [x] Ingest: PDF (pdf-lib + Files API), text, URL (web_fetch), photo (sharp + Reader), topic (web_search, general fallback)
- [x] Cartographer + `parseLedger` (+ fixtures for 5 modes)
- [x] Director + incremental array scanner + sanitize + lint + repair pass
- [x] Skeptic batches + verdict application
- [x] `runForge` orchestration, SSE server/client, session tokens (AES-256-GCM), limits + daily budget, estimate, `schema:check`
- [x] Forge Theater wired to the stream; Engine Room telemetry

## Phase 7 — Live interactions and Demo Mode
- [x] Tutor (`/api/ask`) with citations + `project_scene`
- [x] Evaluator (`/api/grade`) + offline grader
- [x] Gardener (`/api/grow`) with animated insertion; Brancher (`/api/fork`) with Astrolabe branches
- [x] Lens (`/api/lens`) with cache
- [x] Replay transport, `synth-replay`, `record-replay`; Demo Mode end-to-end

## Phase 8 — Extras
- [x] Share (KV or URL fragment), import/export `.eidos.json`, `/s/[id]`
- [x] `/pitch` (presentation mode, B, F, live crack)
- [x] Autopilot (`Shift+D`, `?autopilot=1`, virtual cursor)
- [x] Generative sound; browser voice narration
- [ ] Vertical video (P2, not built; absent from the interface, listed in the roadmap)

## Phase 9 — Polish
- [x] Accessibility (scene descriptions, keyboard, `?` dialog, axe clean)
- [x] English interface; empty/error states; responsive; CSP
- [x] Lighthouse report (`pnpm lighthouse`; results in PROGRESS.md)

## Phase 10 — QA
- [x] e2e suite (Chromium + WebKit, desktop + mobile): 81 passed, 15 skipped by design
- [ ] `pnpm shots` + two visual review rounds (second with an isolated critic)
- [x] `pnpm eval` static report
- [x] Media for the docs (posters, Open Graph cards, theater before/after)

## Phase 11 — Delivery
- [ ] README (EN) + README.es, docs of §15, `audit:placeholders`, Definition of Done evidence, final commit, server running
