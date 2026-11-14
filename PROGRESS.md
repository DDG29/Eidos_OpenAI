# Progress log

## 2026-11-12 — Phase 0 (preparation)

**Done**
- Toolchain: Node 24.21, pnpm 12.18 (installed), git 2.50, Playwright 1.65, ffmpeg available. No `ANTHROPIC_API_KEY`.
- Master prompt saved to `docs/PROMPT_MAESTRO.md`; `PLAN.md`, `DECISIONS.md`, `.env.example` written.
- Next.js 16.4.6 / React 19.3.1 / TypeScript 6.0.3 strict (+ `noUncheckedIndexedAccess`), ESLint 9 flat config
  (`eslint-config-next`), Tailwind v4, Prettier, Vitest 5, Playwright configs; dependencies pinned exactly.
- Design tokens (§4.3–4.6) in `src/styles/tokens.css`, control primitives in `globals.css`, chrome styles.
- Fonts via `next/font/google`: Bodoni Moda (opsz axis), Atkinson Hyperlegible Next and Mono; static TTFs for
  particle text in `public/fonts/`.
- Typed i18n (`es`/`en`, cookie + Accept-Language), settings store, top bar, hand-drawn icon set.
- `package.json` scripts of §17.3; not-yet-implemented ones exit 1 with a message naming their phase.

**Verified**
- `pnpm typecheck`, `pnpm lint`, `pnpm test` (4 tests) green.
- `pnpm dev` renders the base page; screenshot shows Bodoni Moda headline and the top bar.

**Next**: Phase 1 — engine core.

## 2026-11-12 — Phases 1–4 in progress (paused)

**Done and verified**
- Engine core committed (c7f7c3c): particle field, GPGPU cursor layer, shaders, Stage, CameraRig, QualityManager,
  worker program compiler, Hilbert pairing; 160 000 particles at 60 fps in headless Chromium (`qa/lab1.png`).
- Landing renders with the real engine (`qa/landing0.png`, `landing1.png`, `landing4.png`); scroll conductor
  (Lenis + GSAP ticker), Ruler, sticky movement copy, Forge Console UI, Atlas grid, Lens dial, filaments.
- World Spec: send schemas (API-rule test), sanitizer, pedagogical linter (INFLESZ/Flesch), readouts,
  `pnpm catalog`, `pnpm demo:cite`, `pnpm worlds:check`, SSE parser, pricing/estimate, offline grader.

**Unfinished (resume here)**
- Shape work was paused midway. Shape files present in `src/engine/shapes/` need review, tests run
  (`pnpm vitest run src/engine/shapes`) and registration in `registry.ts`; missing generators must be finished
  (24 total beyond sphere/helix/text/nebula). Then `pnpm catalog`.
- `src/components/player/Player.tsx` imports modules not yet written: `grow.ts`, `AskPanel.tsx`,
  `EngineRoom.tsx`, `PlayerMenu.tsx`, `ShareDialog.tsx`, `lens.ts`, `grade.ts`, `@/engine/audio/useSound`.
  Typecheck fails until they exist. Then add `/m/[worldId]` route, player CSS, reading mode.
- Linter test `flags PARAMATH` passes only once `surface` is registered.
- Phases 5–11 not started (demo worlds, AI pipeline, theater, replays, pitch, e2e, docs).

## 2026-11-13 — Phases 4–11: worlds, pipeline, Demo Mode, polish, QA and delivery

**Done**
- Player complete: narration, Ruler, Astrolabe, annotations, filaments with source panel, picking with the radial
  menu, knobs, checks with the soft gate, the Crack and remedial growth, the Lens, "¿Y si…?" branches, the
  Constellation finale, reading mode with print styles, the Engine Room.
- Claude pipeline (Reader, Cartographer, Director, Skeptic, Tutor, Evaluator, Gardener, Brancher, Lens), SSE
  forge, session tokens, limits and budget, Forge Theater, replays (synthesized and recordable), Demo Mode.
- Five demo worlds (black holes, photosynthesis, Transformer, compound interest, axolotl) with sources, notes,
  literal citations, remedials, four level variants, recorded Tutor answers, a branch each, replays, posters and
  Open Graph cards. No CRISPR world (DECISIONS #13).
- Landing, Atlas, About, `/lab`, `/pitch`, sharing (URL fragment or KV), import/export, autopilot (`Shift + D`,
  `?autopilot=1`), the `?` shortcuts dialog, voice narration, generative sound, `?perf=1` panel, CSP with a
  per-request nonce, full Spanish/English interface.
- Scripts: `eval`, `posters`, `shots`, `bench`, `lighthouse`, `audit:placeholders`, `record-replay`.
- Docs of §15: README (EN/ES), ARCHITECTURE, CLAUDE_USAGE, PEDAGOGY, DESIGN, PITCH, DEMO_VIDEO, JUDGES_FAQ,
  SUBMISSION, QA_VISUAL, CREDITS, ROADMAP, PRIVACY; MIT license.

**Verified**
- `pnpm typecheck`, `pnpm lint` green; `pnpm test`: 552 tests in 54 files pass.
- `pnpm e2e` on the production build: 81 passed, 15 skipped by design (phones walk one world; the no-WebGL and
  autopilot runs are Chromium-desktop only), across Chromium and WebKit, desktop 1440 × 900 and mobile 390 × 844 —
  including axe on every route, the CSP check and a full autopilot run.
- `pnpm audit:placeholders`: no leftover markers, dead buttons or broken internal links (31 URLs crawled).
- `pnpm worlds:check`: 8 world files pass (lint score 100 for every demo world, no warnings).
- `pnpm eval` (static): sentences cited 91.3 % on average, ledger used 94 %, readability in range 5/5.
- Lighthouse (production, `pnpm lighthouse`): landing LCP 0.25 s desktop / 0.9 s mobile 4G, CLS ≤ 0.005,
  accessibility · best practices · SEO 100 on every page (DECISIONS #15).
- `pnpm bench`: 24 ms median per shape at 160 000 particles, 68 ms worst; picking 0.4 ms per click.
- Two visual review rounds documented in `docs/QA_VISUAL.md` (177 captures in round 2).
- Autopilot runs landing → forge → world → Crack → finale → landing in ~3 minutes with no console errors.

**Known limitations**
- No API key in this environment: live forging, the live smoke test, live evaluation and recorded replays are
  implemented but not run; demo verification is a literal-quote check, not Skeptic verdicts.
- Demo worlds are Spanish only (the interface is bilingual). No vertical video (P2).
- World pages on simulated mobile 4G reach LCP at ~5 s (DECISIONS #15, roadmap).
