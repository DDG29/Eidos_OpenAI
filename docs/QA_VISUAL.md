# Visual QA

Every screenshot is checked against the checklist of the design system (spec 4.12): the form reads without the
text; it sits optically centred and fills 45–75 % of its zone; text is legible over the particles; no anti-pattern
from [DESIGN.md](DESIGN.md); annotations point at the right region and stay on screen; the palette stays in the
system; type hierarchy is clear; spacing follows the scale; bloom does not burn a region white; the form survives
on a phone; nothing looks like a template.

Captures live in `qa/` (git-ignored). `pnpm shots` takes them deterministically: `?shots=1` freezes time, twinkle
and the cursor, and each capture waits for the stage to report "stable".

## Round 1 — during the build

Captures taken with `scripts/snap.ts` and `scripts/autopilot-run.ts` after each visual change, read back, fixed and
re-captured.

| # | Where | Defect | Fix | Capture |
|---|---|---|---|---|
| 1 | Landing hero | Words of the headline ran together (spaces inside inline-block spans) | Spaces moved outside the animated spans | `qa/landing0.png` |
| 2 | Landing, text and glyph movements | Flat forms turned edge-on as the camera drifted | Frontal camera for flat forms; drift is a bounded sway | `qa/landing1.png` |
| 3 | Landing | Copy of two movements on screen at once | Each movement's copy in its own sticky slot; camera fit 1.75 | `qa/landing4.png` |
| 4 | Player annotations | Every label pointed at the same centroid | Region anchors by farthest-point sampling, nearest to the camera | `qa/player3.png` |
| 5 | Check beats | Question and first choice scrolled above the top bar | Compact check layout; the soft gate stops at half of the section (DECISIONS #9) | `qa/tf-gate.png` |
| 6 | Forge Theater | Facts column ran past the screen; centre was an undifferentiated cloud | One-screen grid, citations clamped to two lines, last five facts, orbiting scene thumbnails | [before](media/theater-before.jpg) / [after](media/theater-after.jpg) |
| 7 | Axolotl, beat 1 | Gills read as a blur at hook scale | Fill + outline silhouette, thinner pillow | `qa/ax-0b.png` |
| 8 | Compound interest, beat 1 | The burst's bright core sat on top of "1 centavo" | Burst moved above the headline | `qa/ic-0.png` |
| 9 | Atlas | Gradient placeholders instead of the worlds | `pnpm posters`: real posters from each world's best beat | `qa/atlas.png` |
| 10 | Posters | Photosynthesis poster cropped into a blur of chloroplasts; black-hole poster on a weak beat | Poster beats changed to the leaf cell (b03) and the accretion disk (b06) | `qa/posters-sheet.png` |
| 11 | Open Graph cards | Title overlay hidden by the hide-UI rule | Overlay selector made more specific | `qa/posters-sheet.png` |
| 12 | Black-hole poster | Captured before the stage was ready (black frame) | Poster script retakes dark frames | `public/posters/agujeros-negros.webp` |

Accessibility issues found by axe in the end-to-end suite were fixed in the same round: the wordmark and the
language toggle had accessible names that did not contain their visible text, GSAP's line splitter added an
`aria-label` to paragraphs, and the theater log scrolled without being focusable.

## Round 2 — full `pnpm shots` set (production build)

177 captures: the seven landing movements, five moments of the Forge Theater replay, every beat of the five demo
worlds, reading mode, `/lab` and the nine pitch beats, at 1440 × 900 and 390 × 844. Paths are
`qa/shots/<date>/<desktop|mobile>/<name>.png`.

| # | Capture | Checklist item | Defect | Fix |
|---|---|---|---|---|
| 1 | `mobile/landing-2…5` | 3, 8 | On phones the movement copy was squeezed into one twelfth of the width (one word per line) | The sticky copy container uses a single column on phones |
| 2 | `mobile/agujeros-negros-07`, `mobile/interes-compuesto-07`, `-11` | 5, 10 | On phones a check was pinned to the top in a 46 vh scroll box: choices and the answer button were cut off and half the screen was empty | On phones a check sits at the bottom like any beat, may take most of the height, and drops the title the question repeats |
| 3 | `desktop/agujeros-negros-10`, `-11` | 5 | A source panel opened by a filament stayed on screen into the next beat | Panels close on any real page scroll (wheel, keys or the conductor), not only on the wheel |
| 4 | `desktop/fotosintesis-04` | 3 | Narration hard to read over the chloroplast close-up (inside camera fills the screen with bright particles) | Denser veil behind the narration on inside-camera beats |
| 5 | `desktop/fotosintesis-12` | 1, 5 | "+" is not in the particle font, so "LUZ + AGUA + CO2" read as "LUZ AGUA CO2", and two labels crowded the first word | Three stacked words, one label each, like the Transformer recap |
| 6 | `desktop/transformer-06` | 1 | "Capas sobre capas" seen from the side read as a single line of points | Orbit camera instead of side |
| 7 | `desktop/landing-6` | 4 | The torus ring showed through the console panel | Console panel at 95 % opacity |
| 8 | `mobile/landing-1`, `-2` (re-check) | 2, 10 | In portrait, wide forms (the wordmark, the book) overflowed the screen sideways: the camera fit used the vertical field of view only | The phone fit scales with 1 / aspect ratio, and poses are recomputed after a resize or rotation |
| 9 | `desktop/agujeros-negros-10` (re-check) | 5 | A resting cursor opened a source panel when a filament dot scrolled under it | Hover opens a panel only after real pointer movement |

Checked and fine: optical centring and fill of the forms, palettes, type hierarchy, annotation placement on the
other beats, bloom (no burned regions), the theater at five moments and the pitch beats.
