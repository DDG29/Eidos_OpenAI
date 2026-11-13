# Progress log

## 2026-11-12 — Phase 0 (preparation)

**Done**
- Toolchain: Node 24.21, pnpm 12.18 (installed), git 2.50, Playwright 1.65, ffmpeg available. No `ANTHROPIC_API_KEY`.
- Master prompt saved to `docs/PROMPT_MAESTRO.md`; `PLAN.md`, `DECISIONS.md`, `CLAUDE.md`, `.env.example` written.
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

## 2026-11-12 — Phases 1–4 in progress (session paused: usage limit)

**Done and verified**
- Engine core committed (c7f7c3c): particle field, GPGPU cursor layer, shaders, Stage, CameraRig, QualityManager,
  worker program compiler, Hilbert pairing; 160 000 particles at 60 fps in headless Chromium (`qa/lab1.png`).
- Landing renders with the real engine (`qa/landing0.png`, `landing1.png`, `landing4.png`); scroll conductor
  (Lenis + GSAP ticker), Ruler, sticky movement copy, Forge Console UI, Atlas grid, Lens dial, filaments.
- World Spec: send schemas (API-rule test), sanitizer, pedagogical linter (INFLESZ/Flesch), readouts,
  `pnpm catalog`, `pnpm demo:cite`, `pnpm worlds:check`, SSE parser, pricing/estimate, offline grader.

**Unfinished (resume here)**
- Shape subagents were stopped mid-work. Shape files present in `src/engine/shapes/` need review, tests run
  (`pnpm vitest run src/engine/shapes`) and registration in `registry.ts`; missing generators must be finished
  (24 total beyond sphere/helix/text/nebula). Then `pnpm catalog`.
- `src/components/player/Player.tsx` imports modules not yet written: `grow.ts`, `AskPanel.tsx`,
  `EngineRoom.tsx`, `PlayerMenu.tsx`, `ShareDialog.tsx`, `lens.ts`, `grade.ts`, `@/engine/audio/useSound`.
  Typecheck fails until they exist. Then add `/m/[worldId]` route, player CSS, reading mode.
- Linter test `flags PARAMATH` passes only once `surface` is registered.
- Phases 5–11 not started (demo worlds, AI pipeline, theater, replays, pitch, e2e, docs).
