# EIDOS evaluation report

Mode: **static** (no API key; deterministic metrics over the demo worlds). Generated 2026-11-13 by `pnpm eval`.

Demo worlds were written by hand from the sources in `content/sources/` (DECISIONS #5). Their verification is a
literal-quote check computed by `pnpm demo:cite`, not a Skeptic run, so the *supported* column measures that every
cited sentence points at a passage that exists verbatim in the source. Latency, cost and the independent judge
need live runs and are not reported here.

| World | Level | Schema | Sanitizer fixes | Lint | Sentences cited | Supported | Ledger used | Shapes · transitions · cameras | Checks with misconception distractor | Readability (range) |
|---|---|---|---|---|---|---|---|---|---|---|
| Donde el espacio se curva | prepa | valid | 0 | 100 (0 warn.) | 90.5 % | 90.5 % (literal-quote check) | 97.4 % | 8 · 6 · 5 | 2/2 | 72 ✓ (55–75) |
| El ajolote, maestro de la regeneración | curioso | valid | 0 | 100 (0 warn.) | 90.7 % | 90.7 % (literal-quote check) | 95 % | 12 · 6 · 5 | 2/2 | 75 ✓ (65–∞) |
| La fábrica de luz | curioso | valid | 0 | 100 (0 warn.) | 88.9 % | 88.9 % (literal-quote check) | 87.5 % | 9 · 6 · 5 | 2/2 | 76 ✓ (65–∞) |
| El interés que gana interés | prepa | valid | 0 | 100 (0 warn.) | 92.9 % | 92.9 % (literal-quote check) | 97.5 % | 7 · 6 · 4 | 2/2 | 71 ✓ (55–75) |
| Cómo piensa un Transformer | prepa | valid | 0 | 100 (0 warn.) | 93.5 % | 93.5 % (literal-quote check) | 92.5 % | 7 · 6 · 3 | 2/2 | 72 ✓ (55–75) |

**Averages over 5 worlds:** lint 100 · sentences cited 91.3 % · supported 91.3 % · ledger used 94 % · 8.6 distinct shapes per world · readability in range for 5/5.

Readability: INFLESZ for Spanish, Flesch reading ease for English, computed over the trunk narration.
