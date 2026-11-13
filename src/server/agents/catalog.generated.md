Each layer uses one shape below. "params" are {key, value} pairs from the list (other keys are dropped; values are clamped to the range). Region IDs marked * only exist for some parameter values; "{i}" means an index (0-based), e.g. bar_2. Shapes with ParaMath expressions also take free coefficients a, b, c (params a, b, c in [-10, 10]) that a knob can control — e.g. a "curve" with y = "0.8*((1 + a/100)^(t*30) - 1)/((1 + 15/100)^30 - 1)" and a knob on param "a" (interest rate in %).

### sphere — Volumetric sphere
A glowing ball of particles, denser toward the center. Reads as a nucleus, atom, planet, droplet or 'one unit'.
Good for: atomic nuclei, planets and stars, a single cell or droplet, a blastema, 'one unit' of something.
Params: radius 1 [0.2..1] outer radius; noise 0.05 [0..0.5] surface roughness; core_density 1.5 [0.5..4] how strongly particles concentrate toward the center.
Expressions: none.
Data: none.
Regions: core, body.
Motion: slow pulse.

### helix — Helix (single or double)
One or two helical strands, optionally joined by base-pair rungs, that can unwind from one end. DNA, springs, solenoids, spiral timelines, alpha helices.
Good for: DNA, replication and transcription (unwind), springs and solenoids, alpha helices, spiral timelines.
Params: strands 2 [1..2 int] number of strands; turns 3 [1..10] full turns along the height; radius 0.35 [0.1..0.6] helix radius; height 2 [0.5..2] total height before normalization; base_pairs 1 [0..1 int] draw rungs between strands (1 = yes); unwind 0 [0..1] separates the strands from the top end (replication, transcription).
Expressions: none.
Data: none.
Regions: strand_a, strand_b*, base_pairs*, unwound*.
Motion: rotates slowly around its axis.

### text — Particle text
Short text written in particles with the display typeface, extruded in depth. Titles, key terms, short formulas, a single number.
Good for: a key term, the word EIDOS, a short formula like E = mc², a striking number, a three-word recap.
Params: depth 0.08 [0..0.4] extrusion depth; weight 1 [0..1 int] 0 = body typeface, 1 = display typeface.
Expressions: content (text; max 24 chars; default "EIDOS") the text, max 24 characters (letters, digits, basic punctuation, basic Greek, ² ³).
Data: none.
Regions: glyphs, char_{i}.
Motion: still.

### nebula — Noise nebula
A soft cloud of particles with filaments, shaped by fractal noise. Ambience, chaos before understanding, gas, clouds, uncertainty.
Good for: the initial chaos, gas and dust clouds, uncertainty, a calm ambient background, molecules floating in air.
Params: scale 1.2 [0.3..3] noise frequency (higher = smaller clumps); density_contrast 0.6 [0..1] how clumpy the cloud is; filaments 0.5 [0..1] share of particles in thin filaments.
Expressions: none.
Data: none.
Regions: cloud, filaments.
Motion: gentle thermal drift.
