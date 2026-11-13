# Pedagogy

EIDOS is a learning tool before it is a visual effect. The Director and the Gardener follow principles with broad
support in learning research (they are written into their system prompts in `src/server/agents/prompts.ts`), and
a deterministic linter (`src/lib/lint/pedagogy.ts`) checks the parts that can be checked.

| Principle | What it means here | Where it is enforced |
|---|---|---|
| **Dual coding** | Words and images together and in sync: a beat's narration appears while its form is on screen; annotations sit next to the part they name. | Scroll conductor; annotations anchored to region ids, validated by the sanitizer. |
| **Coherence** | Nothing decorative competes for attention; ambient dust is faint. | Director prompt; dust fraction 6 % (12 % only on hook and finale). |
| **Signalling** | Camera, brightness and annotations point at what matters. | Per-beat camera presets and frames; region highlight on hover and pick. |
| **Segmentation** | One idea per scene; the learner sets the pace with the scroll. | Linter: 2–4 sentences per beat, ≤ 30 words each. |
| **Pre-training** | Key terms are introduced before the mechanism that uses them. | Concept dependency graph (acyclic) and the linter's arc check. |
| **Concreteness fading** | From a concrete visual metaphor to the abstract model. | Director prompt; beat order. |
| **Conceptual change** | The common misconception is named, shown and transformed into the right model. | `misconception` beats; every check has a distractor tied to a misconception. |
| **Retrieval practice** | Questions that make you recall and explain, not just recognise. | 2–3 checks per world, never in the first two beats; free-text answers graded by the Evaluator. |
| **Elaborative interrogation** | "Why?" and "What if…?" questions. | "Ask the scene" radial menu (*¿Qué es esto?* / *¿Por qué es así?*); "¿Y si…?" branches. |
| **Personalisation** | Second person, warm, never childish; vocabulary adapted to the level. | Readability ranges per level (INFLESZ / Flesch); the Lens rewrites for four levels. |
| **Truth before fluency** | If the source does not support it, say so; never fill gaps with invention. | Ledger-only Director, isolated Skeptic, per-sentence filaments, "general knowledge" label. |

## The learning loop

1. **Explore**: scroll through the world; each form morphs from the previous one, so the transformation itself
   shows the relation between ideas.
2. **Check**: a question blocks the way softly (the gate) until it is answered or skipped.
3. **The Crack**: a wrong answer splits the form along the misconception, visibly.
4. **Grow**: the Gardener writes one or two new beats from a different angle, aimed at that specific error, plus a
   simpler follow-up check; they are inserted right after the question without moving the reader.
5. **Constellation**: the finale shows every concept as a star whose brightness is the learner's mastery, and
   tapping the dimmest one jumps back to it.

## Levels

| Level | Who | Spanish (INFLESZ) | English (Flesch) |
|---|---|---|---|
| Curioso | Anyone, no background | ≥ 65 | ≥ 65 |
| Prepa | High school | 55–75 | 45–80 |
| Universidad | Undergraduate | 40–65 | 25–65 |
| Experto | Specialist | any | any |

Each demo world carries all four level variants; a Lens change keeps the same facts and citations.

## Limits we are honest about

EIDOS is a prototype. The principles above are well supported in the research literature, but we have not yet
measured learning gains with EIDOS itself; that is the first item after this release ([ROADMAP](ROADMAP.md)).
