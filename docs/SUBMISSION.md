# Submission

## English

### Inspiration
In PISA 2025, about four in ten Mexican fifteen-year-olds scored below the basic level in maths, reading and
science at once — yet eight in ten say they are curious, more than the international average. The curiosity is
there; the tools are flat, passive, the same for everyone, and when students turn to a chatbot they can't tell
which part is true. We wanted a tool where ideas have a shape you can walk through and where every sentence shows
where it came from.

### What it does
- **Forge**: give EIDOS a PDF, a photo, a link, a text or a question. A team of Claude agents turns it into a
  *world*: a scroll-driven film of up to 160 000 particles, 8–14 scenes long, narrated in your language and level.
- **Explore**: each scene's form morphs out of the previous one, so the transformation itself shows how ideas
  relate. Annotations point at the parts they name; knobs let you change a parameter and watch the form respond.
- **Verify**: every sentence ends in a filament. Green opens the exact passage of your source; grey marks general
  knowledge; violet marks a hypothetical scenario.
- **Ask & Branch**: tap any part of the form and ask "what is this?" or "why?"; the Tutor answers with citations
  and can project a shape. Start a question with "¿Y si…?" and a hypothetical branch grows.
- **Grow**: checks hold the way softly. A wrong answer cracks the world, and a new chapter grows, aimed at your
  specific misconception, followed by a simpler check. The finale is a Constellation of what you have mastered.

It also has reading mode (printable), four reading levels (the Lens), sharing by link, an Atlas of worlds, voice
narration, generative sound, a full Spanish/English interface, Demo Mode with replays when there is no API key,
and an autopilot that presents the whole product hands-free.

### How we built it
Next.js 16 and React 19 in strict TypeScript; a persistent vanilla three.js stage with `postprocessing` (bloom,
chromatic aberration, grain, vignette, AgX); a deterministic morph shader driven by scroll (Lenis on the GSAP
ticker); 28 procedural shape generators compiled in a Web Worker and paired particle-to-particle along a Hilbert
curve; ParaMath, a closed expression language, so formulas from the model are never executed as code; Zod at every
boundary; a pedagogical linter; Server-Sent Events for the forge; Vitest, Playwright and axe for quality.

We worked from a single long specification, phase by phase, kept a decision log (`DECISIONS.md`) and let tools be
the referees: a strict world checker, a literal-citation tool for the demo worlds, an evaluation harness, unit and
end-to-end tests, and rounds of screenshot review against a checklist of visual anti-patterns.

### How we used Claude
- **Cartographer (Opus 5.5)** reads the source with **native citations** — PDFs through the **Files API** with a
  24-hour expiry, links through **web fetch**, questions through **web search** — and writes a fact ledger in which
  every fact carries an API-produced citation. Prompts use a **1-hour cache**.
- **Director (Opus 5.5)** sees only the ledger and returns the World Spec as **structured output** (JSON schema):
  the pedagogy and the visual score in one document, streamed and parsed beat by beat so scenes appear as they are
  written.
- **Skeptic (Sonnet 5.5)** verifies every sentence against the source in an **isolated context**, in parallel
  batches while the Director is still writing.
- **Tutor (Sonnet 5.5)** answers questions about any part of a scene with **citations** and can project a shape
  through **tool use**; **Evaluator (Haiku 5.5)** grades free-text answers; **Gardener** and **Brancher (Opus 5.5)**
  grow remedial chapters and hypothetical branches; **Lens (Haiku 5.5)** rewrites narration for another level using
  only the facts already cited.
- **Adaptive thinking** is streamed as summaries into the Forge Theater, so you watch each agent reason. Refusals
  on Opus and Sonnet go through **server-side fallbacks**; `pause_turn` is continued for server tools; every run's
  tokens and cost appear in the Engine Room.

### Challenges we ran into
- **No API key in our build environment.** We wrote the five demo worlds by hand from original sources, computed
  their citations from literal quotes, synthesized the forge replays (labelled as such in the interface) and tested
  every live path with fixtures shaped exactly like API events.
- **Determinism.** Replays, QA screenshots and tests needed identical particles everywhere, so text and glyphs are
  rasterized in pure TypeScript instead of with `OffscreenCanvas`.
- **Legibility in 3D.** Flat forms turned edge-on under an orbiting camera and annotations all pointed at the same
  centroid; we added frontal cameras for flat forms, a bounded drift and per-region anchors.
- **Pedagogy versus layout.** A gated check could scroll its own question off screen; the gate now stops at half
  of the section.
- **Robustness.** A quality-tier drop could race with a program still compiling for the old particle count; a fast
  route change could leave requests for a dropped program; both now resolve quietly.
- **A strict CSP in Next.js** required a per-request nonce, dynamic rendering for every page and a check that the
  worker, fonts and canvas all run under it.

### Accomplishments that we're proud of
A full pipeline from source to verified world; 28 shapes with tests at 16 384 and 160 000 particles; a morph
engine that runs backwards perfectly when you scroll back; five demo worlds that pass the linter with a score of
100; 91 % of their sentences cite the source; and an autopilot that runs the whole demo with no hands and no
Wi-Fi.

### What we learned
Grounding is a design problem as much as a model problem: when the Director can only see cited facts and every
sentence must name them, honesty becomes the default instead of an afterthought. And motion teaches when it is
continuous: a cut loses the relation that a morph shows.

### What's next
Live runs end to end with real Skeptic verdicts, English versions of the demo worlds, a pilot with schools to
measure learning, a WebGPU renderer, a `timeline` shape for the humanities and a real-time class mode. See
[ROADMAP.md](ROADMAP.md).

### Stack
Claude API (Opus 5.5, Sonnet 5.5, Haiku 5.5; citations, Files API, structured outputs, web search and fetch,
prompt caching, adaptive thinking) · Next.js · React · TypeScript · three.js · postprocessing · GSAP · Lenis ·
Comlink · Zod · zustand · opentype.js · pdf.js · sharp · Vitest · Playwright · axe-core.

---

## Español

### Inspiración
En PISA 2025, alrededor de cuatro de cada diez estudiantes mexicanos de quince años quedaron por debajo del nivel
básico en matemáticas, lectura y ciencias a la vez; y aun así, ocho de cada diez dicen sentir curiosidad, más que
el promedio internacional. Las ganas están; las herramientas son planas, pasivas, iguales para todos, y cuando se
recurre a un chatbot no se sabe qué parte es verdad. Queríamos una herramienta donde las ideas tengan una forma que
se pueda recorrer y donde cada oración muestre de dónde viene.

### Qué hace
- **Forja**: dale a EIDOS un PDF, una foto, un enlace, un texto o una pregunta. Un equipo de agentes de Claude lo
  convierte en un *mundo*: una película de hasta 160 000 partículas que se recorre con el scroll, de 8 a 14 escenas,
  narrada en tu idioma y a tu nivel.
- **Explora**: la forma de cada escena se transforma desde la anterior, así que la transformación misma muestra la
  relación entre ideas. Las anotaciones señalan las partes que nombran; las perillas cambian un parámetro y la forma
  responde.
- **Verifica**: cada oración termina en un filamento. Verde abre el pasaje exacto de tu fuente; gris marca
  conocimiento general; violeta, un escenario hipotético.
- **Pregunta y bifurca**: toca cualquier parte de la forma y pregunta "¿qué es esto?" o "¿por qué?"; el Tutor
  responde con citas y puede proyectar una forma. Empieza con "¿Y si…?" y crece una rama hipotética.
- **Crece**: las comprobaciones detienen el paso con suavidad. Si te equivocas, el mundo se agrieta y crece un
  capítulo nuevo, dirigido a tu malentendido, seguido de una comprobación más sencilla. El final es una
  Constelación de lo que dominas.

Además: modo lectura imprimible, cuatro niveles de lectura (la Lente), compartir por enlace, un Atlas de mundos,
narración por voz, sonido generativo, interfaz completa en español e inglés, Modo Demo con repeticiones cuando no
hay clave de API y un piloto automático que presenta todo el producto sin manos.

### Cómo lo construimos
Next.js 16 y React 19 con TypeScript estricto; un escenario persistente de three.js con `postprocessing`; un shader
de morfosis determinista impulsado por el scroll; 28 generadores de formas compilados en un Web Worker y emparejados
partícula a partícula sobre una curva de Hilbert; ParaMath, un lenguaje de expresiones cerrado, para que ninguna
fórmula del modelo se ejecute como código; Zod en cada frontera; un linter pedagógico; Server-Sent Events para la
forja; Vitest, Playwright y axe para la calidad. Trabajamos fase por fase a partir de una especificación, con un
registro de decisiones y con herramientas como árbitros: verificador estricto de mundos, citas literales, arnés de
evaluación, pruebas y rondas de revisión con capturas.

### Cómo usamos Claude
Cartógrafo (Opus 5.5) con citas nativas, Files API, web fetch y web search y caché de 1 hora; Director (Opus 5.5)
con salidas estructuradas, que solo ve el libro de hechos; Escéptico (Sonnet 5.5) que verifica cada oración en un
contexto aislado; Tutor (Sonnet 5.5) con citas y uso de herramientas; Evaluador y Lente (Haiku 5.5); Jardinero y
Bifurcador (Opus 5.5). Pensamiento adaptativo visible en el Teatro de Forja, fallbacks del lado del servidor ante
rechazos y costo por corrida en la Sala de Máquinas.

### Retos
Sin clave de API en nuestro entorno (mundos escritos a mano, citas por cita literal, repeticiones sintetizadas y
etiquetadas); determinismo de las formas de texto; legibilidad en 3D (cámara frontal para formas planas, anclas por
región); una compuerta que escondía la pregunta; carreras entre cambios de calidad y compilación; una CSP estricta
con nonce por petición en Next.js.

### Logros
Una tubería completa de la fuente al mundo verificado; 28 formas con pruebas; un motor que se recorre hacia atrás a
la perfección; cinco mundos de demostración con puntuación 100 en el linter y 91 % de oraciones citadas; y un piloto
automático que hace toda la demo sin manos y sin Wi-Fi.

### Lo que aprendimos
Anclar en la fuente es un problema de diseño tanto como de modelo; y el movimiento enseña cuando es continuo.

### Lo que sigue
Corridas en vivo con veredictos reales del Escéptico, mundos en inglés, un piloto con escuelas, WebGPU, una forma
`timeline` para humanidades y un modo clase en tiempo real.

### Tecnologías
API de Claude (Opus 5.5, Sonnet 5.5, Haiku 5.5) · Next.js · React · TypeScript · three.js · postprocessing · GSAP ·
Lenis · Comlink · Zod · zustand · opentype.js · pdf.js · sharp · Vitest · Playwright · axe-core.
