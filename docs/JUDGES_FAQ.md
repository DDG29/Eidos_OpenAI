# Judges' FAQ

Short, honest answers about the product as it is.

**1. Isn't this just a pretty visual effect?**
The motion carries meaning: each form morphs out of the previous one, so the transition shows how two ideas relate
(dual coding, signalling, segmentation — see [PEDAGOGY.md](PEDAGOGY.md)). Around it there are checks with a soft
gate, a remedial chapter grown for your specific error, per-sentence verification and a Constellation of mastery.
Reading mode (`/m/<world>/leer`) shows the same content with still figures and no effects, and it holds up on its
own; it is also what prints.

**2. How do you avoid hallucinations?**
The Cartographer builds a fact ledger where every fact carries a citation produced by the API's native citations.
The Director sees only that ledger, never the source, and must list the facts behind each sentence. The Skeptic
re-checks every sentence against the source in an isolated context. In the player every sentence ends in a
filament: green leads to the exact passage; grey is labelled general knowledge; violet is a hypothetical branch.
In the five demo worlds, 91 % of narration sentences cite the source (`pnpm eval`, static mode).

**3. How much does a world cost?**
The cost model in `src/lib/pricing.ts` estimates 0.41–0.82 USD for *Rápida*, 0.65–1.29 USD for *Profunda* and
1.17–2.34 USD for *Obra maestra* (a 20-page PDF or a question), before prompt-cache savings on repeated system
prompts. We have not yet run live forges at scale, so these are estimates; the Engine Room shows the real tokens
and cost of each run, and the console shows the estimate before you forge.

**4. How long does it take?**
The estimate is about 1.5 minutes for *Rápida* and 2 for *Profunda*. You can enter the world as soon as three
scenes are verified, while the rest keep arriving. The demo replays are synthesized and last about 75 seconds.

**5. Does it work on a cheap phone?**
Four quality tiers (160 000 down to 16 000 particles) are picked from a GPU benchmark and degrade live when the
frame rate drops. Without WebGL the player shows a poster and points to reading mode.

**6. What happens to my PDFs?**
They go to the Claude Files API with a 24-hour expiry. EIDOS stores no documents; the session token that lets you
keep asking about your PDF is encrypted and expires in 24 hours; logs carry no content. See [PRIVACY.md](PRIVACY.md).

**7. Why not generate a video with AI?**
A video can't be checked sentence by sentence, can't answer "what is this part?", can't adapt when you get a
question wrong, costs more per minute and isn't accessible to a screen reader. EIDOS narration is real text in the
page, and every form has a scene description.

**8. Is it safe to let a model write shapes?**
Nothing the model writes is executed. Shapes come from a fixed catalog of 28 generators; parameters are clamped to
their ranges; formulas are written in ParaMath, a closed expression language parsed by our own compiler (no
`eval`); SVG paths are parsed and validated. A strict Content Security Policy pins scripts to a per-request nonce.

**9. Does it work for history or literature?**
Partly. `network`, `tree`, `text`, `glyph` and `scatter` cover relations, lineages, key terms and timelines of
data, and the `tinta` palette suits the humanities. A native `timeline` shape is the next one on the
[roadmap](ROADMAP.md).

**10. How do you know students learn more?**
We don't yet. EIDOS is a prototype built on principles with broad research support; it already records mastery
per concept, and the next step is a pilot with before/after measurement.

**11. What if Claude refuses a source?**
Requests to Opus and Sonnet use server-side refusal fallbacks; if a stage still fails, the error has a clear code
and message, and the forge can resume from the ledger instead of starting over.

**12. What if a PDF contains malicious instructions?**
Learner and document text is always passed as data inside tags, never interpolated into system prompts; the
Director only sees the extracted ledger; outputs are validated against strict schemas and sanitized; and nothing
the model writes is rendered as HTML or executed.

**13. Business model?**
Free for students with limits; licences for schools; a creator plan to publish worlds. No numbers yet.

**14. Accessibility?**
Narration lives in the DOM, every scene has a text description, everything works with the keyboard (`?` lists the
shortcuts), reduced motion replaces morphs with fades, there is optional voice narration, and reading mode is
printable. Every route is checked with axe in the end-to-end suite.
