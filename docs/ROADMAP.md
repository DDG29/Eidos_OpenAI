# Roadmap

What was left out of this version, in priority order, and why.

## Next

1. **Live runs end to end.** Run `pnpm smoke:live` and `EVAL_LIVE=1 pnpm eval` with an API key (both are written
   and capped at 2 and 6 USD), record real forge replays with `pnpm record-replay`, and replace the synthesized
   replays and the literal-quote verification of the demo worlds with Skeptic verdicts.
2. **English demo worlds** (`*.en.json`) translated with the same rigor as the Spanish ones. The interface is fully
   bilingual today; the five demo worlds are Spanish only.
3. **A CRISPR world** (spec 11.5), left out of this version (DECISIONS #13).
4. **Pilot with schools**: a before/after measurement in real classrooms. The product already records mastery per
   concept; what is missing is evidence that learners learn more.

## Later

5. **WebGPU renderer with a million particles** on desktop, keeping the WebGL2 path for phones.
6. **A `timeline` shape** for history and literature (events on a time axis with labelled spans), so the
   humanities get a native form instead of `network`, `tree` and `text`.
7. **Class mode in real time**: a teacher drives the world on the projector while students' phones follow, answer
   the checks and grow their own remedial chapters.
8. **Vertical 9:16 export** (`/m/[worldId]/short`, spec 12.5, P2): not built, so it is absent from the interface.
9. **More languages** beyond Spanish and English, with readability formulas per language.
10. **Creator plan**: publish worlds to a public Atlas with attribution and moderation.
