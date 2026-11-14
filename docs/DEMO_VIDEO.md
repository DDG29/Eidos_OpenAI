# Demo video (2:45)

The video follows the autopilot (`src/demo/autopilot.ts`), so every shot can be reproduced exactly with
`?autopilot=1`. Voice-over is recorded separately and laid over the screen recording.

## Shot list

| Time | What you see | What you hear | Produced by |
|---|---|---|---|
| 0:00–0:08 | Landing, "Toda idea tiene forma." in particles over a soft nebula | "Toda idea tiene forma." | Autopilot step 1 (landing, movement 0) |
| 0:08–0:28 | The six movements: the EIDOS wordmark, a book opening, a galaxy of anchored claims, a double helix, a network that grows into a tree, and the console's torus | "Dale a EIDOS un PDF, una foto o una pregunta…" | Step 1, Space × 6 |
| 0:28–0:36 | The console: "¿Cómo piensa un Transformer?" typed at a human pace, *Recorrer en Modo Demo* | "Le pregunto cómo piensa un Transformer." | Step 2 |
| 0:36–1:06 | Forge Theater replay at ×2: the log fills with each agent's thinking, facts fly in with their quotes, scene thumbnails orbit, verification turns green; "Repetición · sintetizada" visible | "El Cartógrafo extrae hechos con citas; el Director escribe el recorrido; el Escéptico lo verifica." | Steps 3–4 |
| 1:06–1:20 | Into the world: particle text "Hola, ¿qué…", then tokens on a line, then the embedding space | "Cada scroll transforma ciento sesenta mil partículas." | Step 5 |
| 1:20–1:30 | Beat 3: a filament dot opens its source passage | "Cada oración lleva a su pasaje exacto." | Step 5, filament |
| 1:30–1:48 | Beat 4: tap on the attention network → radial menu → "¿Qué es esto?" → recorded Tutor answer with a citation, labelled "Repetición" | "Le pregunto a la escena." | Step 6 |
| 1:48–2:12 | Beat 7 check: the misconception's distractor → the Crack (red split) → "Encontramos el nudo" → a remedial beat grows, the ruler and astrolabe gain marks → the simpler follow-up answered correctly | "Me equivoco a propósito: el mundo se agrieta y crece un capítulo para mi error." | Step 7 |
| 2:12–2:22 | The Lens: narration rewritten for *Curioso*, then back to *Prepa* | "La misma idea, a otro nivel." | Step 8 |
| 2:22–2:34 | The finale: the Constellation of concepts, brightness by mastery | "Al final ves lo que dominas." | Step 9 |
| 2:34–2:40 | The Engine Room: agents, models, tokens and cost | "Todo es transparente." | Step 10 |
| 2:40–2:45 | Back to the landing | "Toda idea tiene forma." | Step 11 |

The autopilot's own run takes about three minutes because it waits for real conditions; trim the theater and the
walk between beats in the edit to land on 2:45.

## Recording

1. Production build: `pnpm build && pnpm start`.
2. Browser window at **1920 × 1080**, quality **Alta** in Settings, generative sound **on**.
3. Open `http://localhost:3000/?autopilot=1` (or press `Shift + D` on the landing). `Esc` stops it at any time.
4. Record the screen at **60 fps** (macOS: `Cmd + Shift + 5`, or OBS with a 1920 × 1080 canvas).
5. Record the voice-over separately and mix it in the edit. Browser speech synthesis is not captured reliably, so
   do not rely on it for the video.
6. Record early — not on the last day — and keep the master in `docs/media/` or link it from the README.
