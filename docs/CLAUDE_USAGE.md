# How EIDOS uses Claude

## 1. At run time: an orchestra of agents

Every agent has one job, its own context and its own model. Routing lives in
[`src/server/ai/models.ts`](../src/server/ai/models.ts); each agent can be overridden with `EIDOS_MODEL_<AGENT>`.
The table shows the default ("Profunda") quality; "Rápida" and "Obra maestra" move each agent one step down or up.

| Agent | Model · effort | Claude API capabilities | File | Why this choice |
|---|---|---|---|---|
| Reader | Sonnet 5.5 · medium | vision, adaptive thinking | `src/server/forge/runForge.ts` | Photo mode only: turns a photographed page or diagram into clean text the Cartographer can cite. |
| Cartographer | Opus 5.5 · high | **native citations** on documents, **Files API** (PDFs, 24 h expiry), `web_search` / `web_fetch` (topic and link modes), 1 h prompt cache, adaptive thinking | `runForge.ts`, `src/server/ingest/index.ts`, `src/server/agents/cartographer/parseLedger.ts` | The ledger is the ground truth of the world: every fact must carry a citation the API itself produced. |
| Director | Opus 5.5 · high | **structured outputs** (`output_config.format` with the World Spec JSON schema), adaptive thinking, streamed text parsed incrementally | `runForge.ts`, `src/lib/world/schema.ts` | Designs the pedagogy and the visual score at once; sees only the ledger, never the source. |
| Skeptic | Sonnet 5.5 · medium | structured outputs, documents in an isolated context | `runForge.ts`, `src/server/agents/verdicts.ts` | Verifies every sentence against the source without the Director's reasoning; runs in batches while beats stream. |
| Tutor | Sonnet 5.5 · low | native citations on the source documents (via the encrypted session token), tool use for projected shapes | `src/server/agents/live.ts` | "Ask the scene": short answers with citations, optionally a shape to project. |
| Evaluator | Haiku 5.5 · medium | structured outputs | `live.ts` | Grades a check answer (free text included) fast and cheaply. |
| Gardener | Opus 5.5 · medium | structured outputs | `live.ts` | Grows 1–2 remedial beats and a simpler check aimed at the learner's specific error. |
| Brancher | Opus 5.5 · medium | structured outputs | `live.ts` | "¿Y si…?" branches, marked as hypothetical when they leave the ledger. |
| Lens | Haiku 5.5 · low | structured outputs | `live.ts` | Rewrites narration for another level using only facts the beat already cites. |

All calls go through the beta Messages endpoint in [`src/server/ai/claude.ts`](../src/server/ai/claude.ts):
streaming with adaptive thinking shown as summaries in the Forge Theater, `pause_turn` continuation for server
tools, cost accounting from a pricing table, server-side refusal fallbacks for Opus and Sonnet
(`server-side-fallback-2026-07-01`, DECISIONS #7), and errors normalized to `EidosError`. Prompts are constants
with a 1-hour cache breakpoint; learner text is wrapped in tags and never interpolated into system prompts.

### What the contract looks like

A fact from the ledger (from the demo world *Donde el espacio se curva*; in demo worlds the `char` citation is
computed from a literal quote by `pnpm demo:cite`, with the same shape the API returns):

```json
{
  "id": "F05",
  "text": "La velocidad de escape es la rapidez mínima con la que algo debe salir de un planeta para alejarse sin volver a caer.",
  "conceptId": "C02",
  "citations": [{ "kind": "char", "citedText": "Para alejarte de un planeta sin volver a caer, necesitas salir con una rapidez mínima llamada velocidad de escape.", "documentIndex": 0, "startChar": 1414, "endChar": 1528, "paragraph": 4 }],
  "origin": "source"
}
```

A beat of the World Spec (trimmed): every factual sentence names the facts behind it, and the visual score uses
only catalog shapes with in-range parameters.

```json
{
  "id": "b02", "kind": "concept", "title": "La gravedad curva el espacio-tiempo",
  "sentences": [
    { "text": "En 1915, Einstein propuso que la gravedad es la curvatura del espacio-tiempo causada por la masa y la energía.", "factIds": ["F02"] },
    { "text": "Los planetas y hasta la luz siguen el camino más recto posible en ese tejido curvo, y por eso se desvían.", "factIds": ["F03"] }
  ],
  "layers": [
    { "shape": "grid", "params": [{ "key": "resolution", "value": 44 }, { "key": "wells", "value": 1 }, { "key": "depth", "value": 0.8 }], "share": 0.8 },
    { "shape": "sphere", "params": [{ "key": "radius", "value": 0.2 }, { "key": "core_density", "value": 2.5 }], "share": 0.12 }
  ],
  "transition": "rain", "camera": "orbit_close",
  "annotations": [{ "layerIndex": 0, "regionId": "well_0", "text": "Espacio-tiempo curvo" }]
}
```

A verdict per sentence (`supported`, `partial`, `general`, `unsupported`); in the player it becomes the colour of the
filament dot next to the sentence:

```json
{ "index": 0, "verdict": "supported", "supportingFactIds": ["F02"], "note": "…", "revised": false }
```

## 2. At build time: how Claude Code built EIDOS

- **The master prompt.** The whole product was specified in one long prompt (`docs/PROMPT_MAESTRO.md`): vision,
  design system, engine, agents, API usage, QA and deliverables, in phases 0–11. Claude Code worked through it
  autonomously, recording every non-obvious choice in [`DECISIONS.md`](../DECISIONS.md) and progress in
  `PLAN.md` / `PROGRESS.md`, so each new session could resume from the files instead of from memory.
- **Subagents.** Two *shape smith* subagents wrote 24 of the 28 shape generators in parallel against one contract
  (`ShapeDefinition`) and a shared test harness; three *world author* subagents wrote demo worlds from
  `docs/authoring/WORLD_AUTHORING.md`. The main session integrated, validated and reviewed everything they wrote.
- **Verification with screenshots.** Headless Playwright captures (`scripts/snap.ts`, `pnpm shots`, `pnpm posters`)
  were read back as images after each visual change; defects found that way (overlapping copy, a camera turning
  flat shapes edge-on, check beats overflowing, posters cropped too tight) were fixed and re-captured. See
  [`QA_VISUAL.md`](QA_VISUAL.md).
- **Tools as referees.** `pnpm worlds:check` (strict schema, sanitizer, pedagogical linter, shape generation),
  `pnpm demo:cite` (literal citations), `pnpm eval` (metrics per world), Vitest and Playwright decided when work was
  done, not the model's own judgement.
- **Honest numbers at the time of writing:** 28 shapes, 5 demo worlds plus the landing and pitch worlds, 54 unit
  test files with 552 tests, an end-to-end suite in `e2e/`, and about 30 commits over two days of sessions.
- **What did not work.** Writing a CRISPR world was stopped by a safety classifier twice, even at a high-level
  educational depth; it was left out rather than worked around (DECISIONS #13). There is no API key in the build
  environment, so the demo worlds were written by hand and every live path is tested with fixtures shaped like API
  events (DECISIONS #5); the live smoke test and live evaluation are ready but have not been run.

## 3. What Claude makes possible

A source becomes something you can walk through, check and question because Claude can do three different jobs
well enough to chain them: read like a subject expert and leave a citation for every claim, plan like a teacher
who knows where learners go wrong and write that plan as a score a renderer can execute, and then audit its own
work from a clean context. None of those steps is new on its own; what is new is that one model family does all
three with structured, citable output, so a 160 000-particle film can be grounded sentence by sentence in the
learner's own PDF.
