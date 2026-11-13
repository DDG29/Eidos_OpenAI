Each layer uses one shape below. "params" are {key, value} pairs from the list (other keys are dropped; values are clamped to the range). Region IDs marked * only exist for some parameter values; "{i}" means an index (0-based), e.g. bar_2. Shapes with ParaMath expressions also take free coefficients a, b, c (params a, b, c in [-10, 10]) that a knob can control — e.g. a "curve" with y = "0.8*((1 + a/100)^(t*30) - 1)/((1 + 15/100)^30 - 1)" and a knob on param "a" (interest rate in %).

### sphere — Volumetric sphere
A glowing ball of particles, denser toward the center. Reads as a nucleus, atom, planet, droplet or 'one unit'.
Good for: atomic nuclei, planets and stars, a single cell or droplet, a blastema, 'one unit' of something.
Params: radius 1 [0.2..1] outer radius; noise 0.05 [0..0.5] surface roughness; core_density 1.5 [0.5..4] how strongly particles concentrate toward the center.
Expressions: none.
Data: none.
Regions: core, body.
Motion: slow pulse.

### shell — Spherical shell
A hollow sphere: particles only on a thin skin, optionally cut open at the top to reveal the inside (bright rim on the cut). Membranes, bubbles, horizons, atmospheres, the surface of a star.
Good for: a cell membrane, a soap bubble, an event horizon, a planet's atmosphere, the surface of a star, opening a container to look inside.
Params: radius 1 [0.2..1] shell radius; thickness 0.03 [0..0.3] skin thickness as a fraction of the radius (grows inward); noise 0.04 [0..0.4] surface roughness (simplex displacement); opening 0 [0..0.9] fraction of the sphere cut away from the top, to show the interior (0 = closed).
Expressions: none.
Data: none.
Regions: surface, rim*.
Motion: rotates slowly around the vertical axis.

### torus — Torus
A donut-shaped ring standing toward the viewer, as a hollow skin or a filled volume. Rings, magnetic field loops, cycles, closed processes, topological doughnuts.
Good for: a ring or loop, a magnetic confinement ring (tokamak), a cycle that repeats, a topological doughnut, a frame around something.
Params: major 0.75 [0.3..1] radius of the ring (center of the tube); minor 0.22 [0.02..0.5] radius of the tube; fill 0.2 [0..1] share of particles inside the tube (0 = only the skin, 1 = solid volume).
Expressions: none.
Data: none.
Regions: ring.
Motion: rotates slowly around the vertical axis.

### torusKnot — Torus knot
A tube that winds p times around a ring axis and q times through its hole, drawn facing the viewer. Topology, entanglement, complex cycles, 'everything is connected'. p=2, q=3 is the trefoil; coprime p, q give one knot, otherwise interlinked loops.
Good for: topology and knots, entanglement, a complex cycle, connection and interdependence, a trefoil logo-like emblem.
Params: p 2 [1..7 int] windings around the ring axis; q 3 [1..9 int] windings through the hole (lobes seen from the front); tube 0.12 [0.02..0.3] tube radius (canonical units).
Expressions: none.
Data: none.
Regions: knot.
Motion: rotates slowly around the vertical axis.

### helix — Helix (single or double)
One or two helical strands, optionally joined by base-pair rungs, that can unwind from one end. DNA, springs, solenoids, spiral timelines, alpha helices.
Good for: DNA, replication and transcription (unwind), springs and solenoids, alpha helices, spiral timelines.
Params: strands 2 [1..2 int] number of strands; turns 3 [1..10] full turns along the height; radius 0.35 [0.1..0.6] helix radius; height 2 [0.5..2] total height before normalization; base_pairs 1 [0..1 int] draw rungs between strands (1 = yes); unwind 0 [0..1] separates the strands from the top end (replication, transcription).
Expressions: none.
Data: none.
Regions: strand_a, strand_b*, base_pairs*, unwound*.
Motion: rotates slowly around its axis.

### galaxy — Spiral galaxy
A flat spiral disc in the horizontal (XZ) plane: a bright bulge, logarithmic arms with clumps and a faint halo; inner parts turn faster. Galaxies, hurricanes, whirlpools, 'many things organized', spread from a center. Use a top_down or high camera to see the arms.
Good for: a spiral galaxy, a hurricane seen from above, a whirlpool, many things self-organizing, diffusion from a center.
Params: arms 2 [1..6 int] number of spiral arms; twist 3 [0.5..8] how tightly the arms wind (about twist/4 full turns from the bulge to the rim); core 0.18 [0.05..0.5] radius of the bright central bulge; spread 0.3 [0.05..1] scatter of stars around each arm (1 = almost a plain disc); thickness 0.08 [0.01..0.3] vertical thickness of the disc.
Expressions: none.
Data: none.
Regions: core, arms, halo.
Motion: differential rotation: the inside turns faster than the rim.

### lattice — Crystal lattice
A block of a crystal: atoms as distinct glowing balls on a regular lattice, joined by nearest-neighbour bonds; optional vacancies shown as hollow ghosts. Kind 0 simple cubic, 1 body-centred cubic (iron), 2 face-centred cubic (copper, NaCl sublattice), 3 flat hexagonal sheet (graphene).
Good for: solids and crystals, table salt or metals, graphene, the structure of matter, defects and vacancies in a crystal, thermal vibration of atoms.
Params: kind 0 [0..3 int] 0 simple cubic, 1 BCC, 2 FCC, 3 hexagonal sheet (graphene, in the XY plane); cells 3 [1..6 int] unit cells per side (hexagonal: about 2·cells hexagons per side); atom_size 0.08 [0.02..0.2] atom ball radius in canonical units (capped so neighbours never merge); bonds 1 [0..1 int] draw nearest-neighbour bonds (1 = yes); defect 0 [0..0.3] fraction of empty sites (vacancies), to talk about defects.
Expressions: none.
Data: none.
Regions: atoms, bonds*, defects*.
Motion: atoms jitter thermally.

### grid — Spacetime grid with wells
A square mesh of lines in the horizontal (XZ) plane that sinks into smooth funnels around masses. Gravity and spacetime curvature, potential wells, energy landscapes, any 'surface that deforms'. Place and weigh wells with data.
Good for: gravity bending spacetime, a potential well, an energy landscape with minima, a black hole's funnel, how a mass deforms a surface.
Params: resolution 40 [10..80 int] grid lines per side; wells 1 [0..3 int] number of wells at preset positions (ignored when data is given); depth 0.6 [0..1.5] depth of a unit-mass well (deep stacks are softly limited); spread 0.25 [0.05..0.8] width of each well's funnel.
Expressions: none.
Data: optional wells as triples [x1, z1, m1, x2, z2, m2, …]: position in [-1, 1] and mass (negative = hill); overrides `wells`, up to 6 (0–18 numbers).
Regions: grid, well_{i}*.
Motion: still (pair with a wave layer for ripples).

### wave — Wave surface
A circular water-like surface (horizontal XZ disc drawn as a mesh) rippling out from 1–3 point sources; with 2–3 sources the ripples interfere into bright and calm bands. Mechanical waves, sound, light, interference, superposition, tides.
Good for: ripples on a pond, two-slit interference, sound spreading from a speaker, superposition of waves, tides and swells.
Params: sources 1 [1..3 int] number of point sources (2 = classic interference); wavelength 0.25 [0.05..1] distance between crests; amplitude 0.12 [0..0.4] crest height at the source; damping 0.8 [0..3] how fast the ripples fade with distance; resolution 120 [40..220 int] mesh lines per side (capped by particle count).
Expressions: none.
Data: none.
Regions: surface, source_{i}.
Motion: the surface swells, more where the waves are strong.

### surface — Surface z = f(x, y)
A 3D plot of a two-variable function drawn as a mesh: x and y run over [-1, 1] on the floor (XZ plane) and f is the height. Loss landscapes, probability densities, topography, any f(x, y). Heights are used as written (keep them within about ±1). Put a knob on a, b or c to reshape it live, e.g. f = "0.4*exp(-(x^2+y^2)/(0.1+a/10))" with a knob on a for the width.
Good for: a loss landscape with valleys, a 2D gaussian / probability density, a saddle point, an abstract topography, interference of two variables.
Params: resolution 140 [40..260 int] mesh lines per side (capped by particle count); height_scale 1 [0.1..2] multiplies f before drawing; a 0 [-10..10] free coefficient available to the expressions; b 0 [-10..10] free coefficient available to the expressions; c 0 [-10..10] free coefficient available to the expressions.
Expressions: f (paramath, variables x, y; max 400 chars; default "0.3*sin(3*x)*cos(3*y)") height as a function of x, y ∈ [-1, 1] (also i, n and the knobs a, b, c).
Data: none.
Regions: surface, peaks, valleys.
Motion: still.

### parametric — Parametric surface
Any surface given by x(u,v), y(u,v), z(u,v) (default: unit sphere, u ∈ [0, 2π] around, v ∈ [0, π] pole to pole), evenly filled by area, with its u and v boundary curves highlighted. Shells, Klein bottles, Möbius strips, leaves, wings. Coordinates are used as written (keep them within about ±1). Put a, b or c in the formulas and a knob on it, e.g. x = "(1+a/10)*sin(v)*cos(u)" to stretch it live.
Good for: a Möbius strip, a seashell spiral, a Klein bottle, a leaf or a wing, a saddle or minimal surface, morphing one surface into another with a knob.
Params: u_min 0 [-10..10] start of the u range; u_max 6.2832 [-10..10] end of the u range; v_min 0 [-10..10] start of the v range; v_max 3.1416 [-10..10] end of the v range; thickness 0.01 [0..0.2] scatter of particles off the surface (canonical units); a 0 [-10..10] free coefficient available to the expressions; b 0 [-10..10] free coefficient available to the expressions; c 0 [-10..10] free coefficient available to the expressions.
Expressions: x (paramath, variables u, v; max 400 chars; default "sin(v)*cos(u)") x coordinate as a function of u, v (also i, n and the knobs a, b, c); y (paramath, variables u, v; max 400 chars; default "cos(v)") y coordinate as a function of u, v (also i, n and the knobs a, b, c); z (paramath, variables u, v; max 400 chars; default "sin(v)*sin(u)") z coordinate as a function of u, v (also i, n and the knobs a, b, c).
Data: none.
Regions: surface, u_edge, v_edge.
Motion: rotates slowly around the vertical axis.

### curve — Parametric curve
A glowing tube along x(t), y(t), z(t) for t from t_min to t_max, with marked start and end; light pulses travel from start to end. Trajectories, orbits, graphs of one-variable functions (x = t, y = f(t), z = 0), paths, timelines. Coordinates are used as written (keep them within about ±1). Put a, b or c in the formulas with a knob, e.g. y = "0.8*((1+a/100)^(t*30)-1)/((1+15/100)^30-1)", x = "t*2-1", t ∈ [0, 1], with a knob on a as the interest rate in %.
Good for: a trajectory or orbit, the graph of a function, compound interest growth with a rate knob, a path or timeline, a comet with a bright head, a spiral or Lissajous figure.
Params: t_min 0 [-20..20] start of t; t_max 6.2832 [-20..20] end of t; thickness 0.03 [0.005..0.2] tube radius (canonical units); glow_head 0 [0..1] concentrates particles and brightness at the end, like a comet head; a 0 [-10..10] free coefficient available to the expressions; b 0 [-10..10] free coefficient available to the expressions; c 0 [-10..10] free coefficient available to the expressions.
Expressions: x (paramath, variables t; max 400 chars; default "(0.25+0.12*t)*cos(3*t)") x coordinate as a function of t (also i, n and the knobs a, b, c); y (paramath, variables t; max 400 chars; default "0.28*t-0.88") y coordinate as a function of t (also i, n and the knobs a, b, c); z (paramath, variables t; max 400 chars; default "(0.25+0.12*t)*sin(3*t)") z coordinate as a function of t (also i, n and the knobs a, b, c).
Data: none.
Regions: curve, start, end.
Motion: pulses of light travel from start to end.

### field — Vector field streamlines
Streamlines of a vector field (vx, vy, vz) of x, y, z in [-1.2, 1.2]³, traced from a grid of seeds; light pulses run along the flow, and sources and sinks glow. Electric and magnetic fields, wind, currents, gradients, dynamical systems (default: an electric dipole in the XY plane). Put a, b or c in the formulas with a knob, e.g. vx = "-y+a*x/10", vy = "x+a*y/10", vz = "0" turns a vortex into a spiral source (a > 0) or sink (a < 0).
Good for: an electric dipole, a magnetic field around a wire (vx = -y, vy = x), wind or ocean currents, a gradient flowing downhill, a dynamical system's phase portrait, sources and sinks.
Params: seeds 18 [4..40 int] seeds per axis on the seeding grid (planar: seeds² lines); steps 80 [20..200 int] integration steps in each direction from a seed (line length); step_size 0.02 [0.005..0.08] integration step length; planar 1 [0..1 int] 1 = lines stay in the XY plane (vz ignored), 0 = full 3D lines from a 3D seed lattice (≈0.4·seeds per axis); a 0 [-10..10] free coefficient available to the expressions; b 0 [-10..10] free coefficient available to the expressions; c 0 [-10..10] free coefficient available to the expressions.
Expressions: vx (paramath, variables x, y, z; max 400 chars; default "(x+0.4)/((x+0.4)^2+y^2+0.004)-(x-0.4)/((x-0.4)^2+y^2+0.004)") x component of the field at (x, y, z) (also i, n and the knobs a, b, c); vy (paramath, variables x, y, z; max 400 chars; default "y/((x+0.4)^2+y^2+0.004)-y/((x-0.4)^2+y^2+0.004)") y component of the field at (x, y, z) (also i, n and the knobs a, b, c); vz (paramath, variables x, y, z; max 400 chars; default "0") z component of the field at (x, y, z) (also i, n and the knobs a, b, c).
Data: none.
Regions: lines, sources*, sinks*.
Motion: pulses of light run along the streamlines; sources and sinks throb.

### molecule — Ball-and-stick molecule
A ball-and-stick molecule from element symbols and coordinates in ångströms (default: water). Atoms are coloured by element (CPK, tuned to the palette) and each atom is its own region atom_0, atom_1… in input order. Chemistry, water, CO₂, glucose, simplified ATP, drugs.
Good for: a water molecule, carbon dioxide, methane or glucose, a drug binding motif, bonds and molecular geometry.
Params: atom_scale 1 [0.3..2] atom ball size (1 = ball-and-stick, 2 ≈ space-filling); bond_density 0.15 [0..0.4] share of particles in the bonds.
Expressions: atoms (molecule; max 2000 chars; default "O 0 0 0; H 0.757 0.586 0; H -0.757 0.586 0") atoms as "Element x y z" in ångströms separated by ";", e.g. "C 0 0 0; O 1.16 0 0; O -1.16 0 0" (max 60); bonds (edges; max 600 chars; default "") optional bonds as atom index pairs "0-1;0-2" (max 90); if empty they are inferred from distances.
Data: none.
Regions: atom_{i}, bonds*.
Motion: atoms jitter thermally.

### orbits — Orbital system
A central body with concentric, optionally elliptical or mutually inclined orbits; each orbit carries one body that circles at a Kepler-like rate (inner orbits faster). Solar systems, moons and satellites, cycles; a Bohr-style atom only with the caveat that electrons do not really orbit.
Good for: the solar system, moons and artificial satellites, a Bohr-model atom (with a caveat), planetary periods and Kepler's laws, recurring cycles.
Params: rings 3 [1..8 int] number of orbits (ignored when data gives the radii); center_size 0.18 [0.05..0.4] radius of the central body; body_size 0.05 [0.01..0.15] radius of each orbiting body; tilt 0.15 [0..1] inclination spread between orbits (0 = coplanar, 1 = crossed, atom-like); eccentricity 0 [0..0.6] orbit ellipticity; the central body sits at a focus.
Expressions: none.
Data: optional orbit radii in [0.2, 1], one per orbit (up to 8); ring_i follows data order (0–8 numbers).
Regions: center, ring_{i}, body_{i}.
Motion: bodies circle the center, inner orbits faster (Kepler-like).

### network — Network graph
Nodes as glowing balls joined by particle edges, laid out by a force simulation; topologies: random, small-world, scale-free (hubs) or tree. Explicit edges 'a-b;…' and node labels 'A|B|…' turn it into a concrete diagram; light pulses travel along edges from a to b.
Good for: social networks, gene regulatory networks, the internet and routers, food webs and ecosystems, an agent architecture, a map of related concepts.
Params: nodes 24 [3..80 int] number of nodes (with explicit edges: taken from the highest index and the labels); topology 1 [0..3 int] 0 random, 1 small-world, 2 scale-free (few big hubs), 3 tree; node_size 0.05 [0.015..0.12] base node radius (hubs are drawn larger); edge_density 0.35 [0.1..0.6] share of particles drawn on the edges; dimension 3 [2..3 int] 2 = flat layout, 3 = volumetric layout.
Expressions: edges (edges; max 2400 chars; default "") optional explicit edges 'from-to;…' with 0-based node indices, e.g. '0-1;1-2;2-0' (overrides topology); labels (labels; max 2000 chars; default "") optional node names 'A|B|C' in node order.
Data: none.
Regions: node_{i}, edges, hubs.
Motion: nodes pulse; light pulses travel along the edges.

### layers — Layered neural network
Columns of neurons (one column per layer) joined by connections between consecutive layers; signals travel left to right as light pulses. Data gives neurons per layer, e.g. [4, 8, 8, 3]; labels name the layers.
Good for: a neural network / perceptron, a Transformer at a high level, a multi-stage pipeline, an information funnel or bottleneck, encoder–decoder ideas.
Params: spacing 0.55 [0.2..1] horizontal distance between layers (before fitting to the frame); connection_density 0.5 [0..1] fraction of possible connections drawn between consecutive layers (0 = none); neuron_size 0.045 [0.015..0.1] neuron radius (shrinks automatically in crowded layers).
Expressions: labels (labels; max 600 chars; default "") optional layer names 'Input|Hidden|Output' in layer order.
Data: neurons per layer, 2–8 layers of 1–24 neurons, e.g. [4, 8, 8, 3] (2–8 numbers).
Regions: layer_{i}, connections.
Motion: neurons pulse; signals flow left to right along the connections.

### tree — Branching tree
A 3D recursively branching tree: a trunk splitting into 2–4 branches per level, tapering with depth, optionally crowned with leaf clusters. Biological trees, phylogenies, decision trees, fractals, river tributaries (turn it upside down), dendrites, growth.
Good for: a tree and photosynthesis, a phylogenetic tree of life, a decision tree, fractal self-similarity, a river basin (rotated 180°), neuron dendrites.
Params: depth 6 [2..9 int] branching levels after the trunk (very deep, wide trees are thinned to ~6000 segments); branch_angle 28 [5..70] angle between a branch and its parent, in degrees; decay 0.72 [0.5..0.9] length ratio child / parent; branches 2 [2..4 int] children per branch; leaves 1 [0..1 int] 1 = leaf clusters at the branch tips; asymmetry 0.2 [0..1] 0 = perfectly regular, 1 = a dominant leader and irregular side branches.
Expressions: none.
Data: none.
Regions: trunk, branches, leaves*.
Motion: branches and leaves sway very gently.

### cell — Cell (cutaway)
A textbook cell with a cutaway opening: membrane, nucleus with nucleolus, mitochondria with cristae, folded ER around the nucleus and cytoplasm. kind 1 = boxy plant cell with wall, central vacuole and chloroplasts with stacked thylakoids; kind 2 = rod bacterium with wall, flagellum and a tangled nucleoid.
Good for: cell biology and organelles, photosynthesis in a plant cell, cellular respiration (mitochondria), transcription in the nucleus, prokaryote vs eukaryote, how a virus enters a cell.
Params: kind 0 [0..2 int] 0 animal, 1 plant, 2 bacterium; organelles 1 [0..1 int] 1 = draw mitochondria, ER and chloroplasts (bacteria: ribosomes); cutaway 0.35 [0..0.8] how much of the front is cut away to show the interior.
Expressions: none.
Data: none.
Regions: membrane, wall*, nucleus, nucleolus*, mitochondria*, chloroplasts*, er*, cytoplasm.
Motion: cytoplasm jitters thermally; the nucleus pulses.

### bars — 3D bar chart
A row of 3D bars for 1–24 values (normalized to the largest), with an optional baseline axis and labels. temperature > 0 treats the data as logits and shows softmax probabilities (a language-model temperature knob); reveal grows the bars left to right (a time knob). Values must come from cited facts.
Good for: comparing quantities, growth over the years, a probability distribution, LLM sampling temperature (softmax), survey or poll results, a histogram from the source.
Params: depth 0.15 [0.02..0.5] bar depth (z); gap 0.25 [0..0.8] gap between bars as a fraction of each slot; log_scale 0 [0..1 int] 1 = logarithmic heights (values spanning orders of magnitude); baseline 1 [0..1 int] 1 = draw the baseline axis with ticks; temperature 0 [0..3] 0 = off; > 0 = data are logits, bars show softmax(data / temperature) as probabilities on a 0–1 axis; reveal 1 [0..1] fraction of bars shown, growing left to right (hidden bars lie flat on the baseline).
Expressions: labels (labels; max 1200 chars; default "") optional bar names 'A|B|C' in data order.
Data: the values, 1–24 numbers (negatives hang below the baseline) (1–24 numbers).
Regions: bar_{i}, axis*.
Motion: still.

### scatter — Scatter plot / data line
Data points as glowing dots (or soft clusters) in a 2D or 3D frame with axes, optionally joined in data order as a line. Data are x,y pairs (or x,y,z triples with dims = 3), each axis rescaled to fill the frame.
Good for: a correlation, a time series, exponential vs linear growth, an embedding cloud (with cluster_spread), measurements from an experiment, labelled points such as 'king' and 'queen'.
Params: dims 2 [2..3 int] 2 = data are x,y pairs; 3 = x,y,z triples in a cube; connect 0 [0..1 int] 1 = join the points in data order with a line; point_size 0.03 [0.01..0.1] dot radius; cluster_spread 0.02 [0..0.2] extra gaussian spread of each dot (clouds for embeddings).
Expressions: labels (labels; max 2000 chars; default "") optional: one name = the series; several names 'A|B|…' = per-point labels in data order.
Data: flat list x1, y1, x2, y2, … (or x, y, z triples when dims = 3), up to 300 points (2–900 numbers).
Regions: points, point_{i}*, line*, axis.
Motion: still.

### text — Particle text
Short text written in particles with the display typeface, extruded in depth. Titles, key terms, short formulas, a single number.
Good for: a key term, the word EIDOS, a short formula like E = mc², a striking number, a three-word recap.
Params: depth 0.08 [0..0.4] extrusion depth; weight 1 [0..1 int] 0 = body typeface, 1 = display typeface.
Expressions: content (text; max 24 chars; default "EIDOS") the text, max 24 characters (letters, digits, basic punctuation, basic Greek, ² ³).
Data: none.
Regions: glyphs, char_{i}.
Motion: still.

### glyph — SVG silhouette
Any silhouette drawn as an SVG path in a 0–100 box, filled and/or outlined with particles and puffed into a soft 3D pillow. Draw your own simple original shapes (a leaf, a heart organ, a tool, a country outline); never logos, brands or copyrighted characters.
Good for: a leaf or a flower, an organ such as a stylized heart, a country or region outline, a tool or everyday object, an animal silhouette (e.g. an axolotl), a book or a lightbulb.
Params: mode 0 [0..2 int] 0 fill, 1 outline only, 2 fill + outline; depth 0.12 [0..0.6] flat extrusion thickness; inflate 0.5 [0..1] pillow bulge from the edge inward (0 = flat slab).
Expressions: path (svgpath; max 6000 chars; default "M50 4 C66 14 84 34 82 58 C80 78 66 90 52 92 L52 99 L48 99 L48 92 C34 90 20 78…") SVG path 'd' in a 0–100 × 0–100 box (y down), commands M L H V C S Q T A Z only; holes use opposite winding; open strokes are drawn as lines.
Data: none.
Regions: fill*, outline*.
Motion: slow pulse.

### image — Image to particles
The user's uploaded photo (Photo mode) turned into particles, keeping its colours (mixed 50% with the palette) and pushing brighter areas forward in depth. The spec only says shape 'image'; the session image is used, and without one the layer falls back to a nebula.
Good for: the user's photo dissolving into light, a photographed whiteboard (invert = 1), a hand-drawn diagram from a notebook, the opening scene of a photo-based world.
Params: threshold 0.15 [0..0.9] minimum luminance sampled (with invert: minimum darkness relative to the background); depth 0.25 [0..1] how far bright (or, inverted, dark) pixels come forward; invert 0 [0..1 int] 1 = sample dark ink on a light background (whiteboards, paper).
Expressions: none.
Data: none.
Regions: image.
Motion: still.

### nebula — Noise nebula
A soft cloud of particles with filaments, shaped by fractal noise. Ambience, chaos before understanding, gas, clouds, uncertainty.
Good for: the initial chaos, gas and dust clouds, uncertainty, a calm ambient background, molecules floating in air.
Params: scale 1.2 [0.3..3] noise frequency (higher = smaller clumps); density_contrast 0.6 [0..1] how clumpy the cloud is; filaments 0.5 [0..1] share of particles in thin filaments.
Expressions: none.
Data: none.
Regions: cloud, filaments.
Motion: gentle thermal drift.

### vortex — Accretion disk and funnel
A swirling disk with spiral streaks around a dark center (a sparse sphere outlining the shadow), a bright photon ring at its inner edge, a funnel plunging below and optional polar jets. Black holes, drains and whirlpools, tornadoes, cyclones, attractors.
Good for: a black hole and its accretion disk, a whirlpool or bathtub drain, a tornado or hurricane eye, a gravity well, an attractor in a dynamical system, quasar jets.
Params: disk_radius 1 [0.4..1] outer radius of the disk; inner_radius 0.18 [0.05..0.4] radius of the dark center (capped at 40% of the disk); funnel_depth 0.6 [0..1.2] depth of the funnel below the disk (0 = none); photon_ring 1 [0..1 int] 1 = bright thin ring hugging the dark center; jets 0 [0..1 int] 1 = two narrow polar jets.
Expressions: none.
Data: none.
Regions: disk, photon_ring*, funnel*, jets*, horizon.
Motion: the disk turns with differential rotation (inner faster); the photon ring spins; jets stream outward.

### flow — Flow tube
A glowing tube of particles along a path with pulses of light travelling from source to sink. Circulation, cycles, rivers, supply chains, energy flows. Use a preset or draw your own path with ParaMath x(t), y(t), z(t), t ∈ [0, 1].
Good for: blood circulation (preset 2), the water cycle (preset 0), a river or canal network (preset 1), energy flowing through a system, a supply chain, a rising spiral of growth (preset 3).
Params: preset 0 [0..3 int] 0 loop, 1 meandering river, 2 figure eight (double circulation), 3 rising spiral; ignored when x, y, z are given; radius 0.05 [0.01..0.2] tube radius; speed 1 [0.1..3] speed of the travelling pulses; a 0 [-10..10] free coefficient available to the expressions; b 0 [-10..10] free coefficient available to the expressions; c 0 [-10..10] free coefficient available to the expressions.
Expressions: x (paramath, variables t; max 400 chars; default "") optional custom path x(t), t ∈ [0, 1]; give x, y and z together; y (paramath, variables t; max 400 chars; default "") optional custom path y(t); z (paramath, variables t; max 400 chars; default "") optional custom path z(t).
Data: none.
Regions: stream, source, sink.
Motion: pulses of light travel along the tube.

### burst — Radial burst
A bright core with rays of light shooting outward in every direction. Emphasis, a sudden insight, an explosion, the Big Bang, an exothermic reaction, the arrival of light.
Good for: a hook moment of astonishment, the Big Bang, an explosion or exothermic reaction, sunlight arriving, an 'aha' moment, a cut in DNA (small, placed on the site).
Params: rays 64 [8..256 int] number of rays; length 1 [0.3..1] ray length (overall size); core 0.12 [0.02..0.4] core radius; randomness 0.3 [0..1] irregularity of ray directions and lengths.
Expressions: none.
Data: none.
Regions: core, rays.
Motion: pulses.
