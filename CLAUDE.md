# EIDOS — conventions for Claude Code sessions

EIDOS turns a source (PDF, photo, link, text, question) into an explorable "world": a scroll-driven
particle experience whose narration is grounded in a cited fact ledger. Spec: `docs/PROMPT_MAESTRO.md`.
Progress: `PLAN.md` (checklist), `PROGRESS.md` (log), `DECISIONS.md` (why things are the way they are).

## Commands

```bash
pnpm install
pnpm dev                 # http://localhost:3000 (Demo Mode without ANTHROPIC_API_KEY)
pnpm typecheck && pnpm lint && pnpm test
pnpm e2e                 # Playwright against `pnpm build && pnpm start`
pnpm catalog             # regenerate src/server/agents/catalog.generated.md from the shape registry
pnpm worlds:check        # strict schema + pedagogical linter + shape generation for public/worlds/*.json
pnpm demo:cite           # compute char_location citations for demo worlds from `quote` fields
```

## Layout

- `src/engine/` — Morfogénesis particle engine (no React inside, except `stage/StageCanvas.tsx`).
  - `shapes/` one file per generator + `registry.ts` (single source of truth for params/regions/catalog).
  - `paramath/` safe expression language (never `eval`).
  - `compile/` composition, Hilbert pairing, stagger delays, worker.
  - `field/`, `shaders/` GPU textures, `morphBase()` GLSL, GPGPU cursor layer.
- `src/lib/world/` World Spec types, Zod schemas (send + strict), sanitizer. `src/lib/lint/` pedagogy linter.
- `src/server/` Claude client, agents (one folder each, prompts as `.ts` constants), forge orchestration, SSE.
- `src/components/` UI by area (`landing/`, `console/`, `theater/`, `player/`, `reading/`, `ui/`).
- `public/worlds/*.json` demo worlds; `content/sources/*.md` their original sources.

## Code style

- TypeScript strict, `noUncheckedIndexedAccess`; no `any`. Validate every boundary with Zod.
- Engine logic in classes/pure functions; React only orchestrates. Never pass per-frame data through React state.
- Comments explain *why* (math, perf tricks, API constraints), not *what*.
- Errors are `EidosError` with `EIDOS_E_*` codes; user-facing text comes from `src/i18n/{es,en}.json` via `t()`.
- Never render model output as HTML. Never put a secret in client code.
- Design: follow §4 of the spec and the anti-pattern list in `docs/DESIGN.md` (no glass cards, no pills,
  no gradient text, radius ≤ 4 px, colour lives in the particles).

## Adding a shape

1. Create `src/engine/shapes/<id>.ts` exporting a `ShapeDefinition` (params with ranges, regions, `generate`).
2. Register it in `src/engine/shapes/registry.ts`; add the id to `ShapeId` in `src/lib/world/types.ts`.
3. `pnpm test src/engine/shapes` (exact count, no NaN, extent, regions, determinism at 16 384 and 160 000).
4. `pnpm catalog`, then check it in `/lab`.

## Adding a demo world

1. Write the original source in `content/sources/<id>.md` (1 200–2 000 words, real references only).
2. Write `public/worlds/<id>.json` with facts carrying literal `quote`s, beats following the Director rules.
3. `pnpm demo:cite && pnpm worlds:check` (zero linter errors, ≤ 3 warnings), then review every beat visually.

## Git

Commit at the end of each phase with a descriptive message. Commit identities alternate per the project
owner's instructions; do not add AI attribution trailers.
