# Authoring a demo world (no API key path)

This is the procedure used for every world in `public/worlds/`. It mirrors what the Cartographer and the
Director do at run time (master prompt §9.5–9.6, §11.2–11.3), done by hand and verified by tools.

## Files

| File | What |
|---|---|
| `content/sources/<id>.md` | Original explanatory text, 1 200–2 000 words, at the world's level, in the world's language. First line `# Title`. Ends with `## Referencias para profundizar` listing **only** real, well-known works you are certain exist (textbooks, landmark papers, official agencies). If unsure, leave it out. |
| `content/sources/<id>.notes.md` | Short authoring notes: what you simplified, which numbers you checked and how. |
| `public/worlds/<id>.json` | The `World` object (type in `src/lib/world/types.ts`, validated by `WorldFileSchema` in `src/lib/world/worldFile.ts`). |

## Rigor

- Every factual claim must be standard, verifiable science. Prefer robust claims to fragile numbers; if you
  are not sure of a number, do not use it. Never invent sources, studies, quotes or dates.
- The source text is yours (original prose). Facts quote it literally.
- Specific notes: finance worlds say "contenido educativo, no asesoría financiera"; conservation is accurate
  without alarmism; the Transformer world describes the architecture in general, never internals of any
  commercial model.

## The fact ledger

- `facts`: 25–40 items `{ id: "F01", text, conceptId: "C01" | null, citations: [], origin: "source", quote }`.
  - `text`: one self-contained sentence ≤ 35 words in the world's language.
  - `quote`: an **exact substring** of the source (copy-paste, same accents and punctuation), 40–220 chars, that
    supports the fact. `pnpm demo:cite` turns it into a `char` citation and fails if it is not literal.
- `misconceptions`: 2–5 `{ id: "M01", wrongIdea, correction, factIds }` — wrong ideas phrased as a learner
  would think them; corrections supported by the listed facts.
- `spec.concepts`: 5–10 `{ id: "C01", name, summary, dependsOn: [] }` with an acyclic dependency graph.

## The World Spec (`spec`)

Follow the Director's prompt exactly (`docs/PROMPT_MAESTRO.md` §9.6.3) and the world's script in §11.4–11.7.
Shape catalog with every parameter range and region id: `src/server/agents/catalog.generated.md`.

- `beats`: 8–14 (the scripts give the count). ids `b01…` in order. First `hook`, last `finale`.
- 2–3 `check` beats, never in positions 1–2; 3–4 choices; `correctIndex`; at least one wrong choice linked to
  a `misconceptionId` (the correct choice has `""`). `idealAnswer` (1–2 sentences), `explanation`, `conceptIds`
  that were presented in earlier beats. `allowFreeText: true`.
- Each non-finale beat: 2–4 sentences (≤ 30 words each, second person, warm and precise). Every factual
  sentence lists the fact ids that support it; connective sentences (questions, transitions, clearly framed
  analogies) use `factIds: []`. Aim for ≥ 85 % of sentences with fact ids.
- `finale`: `sentences: []`, one calm `nebula` layer (share 0.6); its text lives in `spec.closing`.
- Layers: 1–3, shares summing ≤ 1 (usually 0.85–0.95 for a single layer). `compare` beats: two layers at
  x = −0.9 and x = 0.9, scale 0.8. Only parameters listed in the catalog; values inside the ranges.
- Variety (linter): ≥ 6 distinct shapes, ≥ 4 distinct transitions, no shape in more than 3 beats, never the
  same main shape **and** camera in consecutive beats.
- `annotations`: 0–4 per beat, `{ layerIndex, regionId, text ≤ 4 words }`, region ids exactly as the shape
  produces them (patterns like `bar_2`, `node_5`, `atom_0`; `*` in the catalog = only for some params).
- `knob` (interactive beats): `paramKey` must be a param of that layer's shape, `[min, max]` inside its range,
  `initial`, `step`, `unit`, `readout` template (`{value}`, `{=<ParaMath with value>|<decimals>}`) — computed
  numbers only if the facts support them. Neutral knob when disabled:
  `{ enabled:false, label:"", layerIndex:0, paramKey:"", min:0, max:0, initial:0, step:0, unit:"", readout:"" }`.
- Neutral check when not a check:
  `{ enabled:false, question:"", choices:[], correctIndex:0, allowFreeText:false, idealAnswer:"", explanation:"", conceptIds:[] }`.
- `glyph` paths: ORIGINAL simple silhouettes in a 0–100 box, commands `M L H V C S Q T A Z` only. Never logos,
  mascots or copyrighted characters.
- `molecule`: real approximate geometry in ångströms (`"O 0 0 0; H 0.96 0 0; H -0.24 0.93 0"`).
- `bars`/`scatter`: numbers from the ledger, referenced in the beat's sentences.
- `weight` 1 by default (0.8 for short beats, 1.2–1.4 for rich ones); `ambient` per beat.
- `posterBeat`: the most photogenic beat id.

## Demo assets (`demoAssets`) and variants

- `remedials`: for **every** check beat id → 2–3 beats: 1–2 remedial beats (kind `concept`/`mechanism`/
  `misconception`, a NEW angle and at least one shape not used in the three previous beats, starting from the
  check's form) + 1 simpler `check` on the same concept (3 choices, one distractor tied to the same
  misconception). ids `r01a`, `r01b`, `r01c` (the player renumbers them on insertion).
- `askReplays`: exactly 3 `{ question, beatId, answer: [{ text, factIds }], project: null | {caption, layers,
  transition, camera} }` — typical learner questions; answers 2–5 sentences grounded in facts (ids listed per
  sentence). At least one with a `project` form that helps.
- `branches` (one per world): `{ "<beatId>": [2–4 beats x01a…] }` exploring a "¿Y si…?" scenario with the same
  visual grammar; sentences beyond the ledger use `factIds: []` (shown as hypothetical); the last beat is a
  `recap` contrasting the hypothetical with reality. The first beat's `title` is the question shown in Demo
  Mode, phrased as "¿Y si …?".
- `levelVariants`: all four levels `curioso`, `prepa`, `universidad`, `experto`, each `{ "<beatId>": Sentence[] }`
  for every non-finale trunk beat. Same meaning, vocabulary and precision adapted; 2–5 sentences; each sentence
  may cite only fact ids that the original beat already cites. The world's own level can repeat the spec text.
- `verification`: leave `{}` — `pnpm demo:cite` fills it (literal-citation check, labelled as such in the UI).
- `telemetry: []`, `inserted: []`, `mastery: {}`, `specReport: { corrections: [] }`,
  `lintReport: { score: 100, errors: [], warnings: [] }` (worlds:check recomputes), `schemaVersion: 1`,
  `origin: "demo"`, `createdAt: "2026-11-13T00:00:00.000Z"`, `source: { mode: "text", title: <source H1> }`.

## Verify

```bash
pnpm demo:cite <id>            # literal quotes → char citations (+ verification entries); <id> limits it to one world
pnpm worlds:check <id>         # schema, sanitizer, linter (0 errors, ≤ 3 warnings), shapes, assets
```

Iterate until both pass. Then look at the world in the browser (`/m/<id>`), beat by beat.
