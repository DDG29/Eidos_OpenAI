# Notas de autoría — `transformer`

Mundo escrito a mano (sin clave de API) siguiendo `docs/authoring/WORLD_AUTHORING.md`, el guion §11.4 y los prompts del Cartógrafo y el Director.

## Qué se simplificó

- Se describe la arquitectura Transformer en general. No se dice nada del funcionamiento interno de ningún producto comercial.
- No aparecen fórmulas (producto punto escalado, normalización, conexiones residuales). La atención se explica como consulta, clave y valor, con pesos que suman 1.
- Los tokens de «Hola, ¿qué tal?» y la partición de «desoxirribonucleico» se presentan como ejemplos («podría»), porque cada tokenizador corta distinto.
- El mapa 3D de embeddings (b03, b07) es una ilustración: los embeddings reales tienen cientos de dimensiones (512 en el Transformer original). Las coordenadas del `scatter` solo reflejan cercanías cualitativas (perro–gato, rey–reina, pan aparte), como dice el hecho F12.
- Los logits de «El gato se subió al…» (4, 3, 2, 1, 0.5) son ilustrativos y la fuente los presenta así.
- Las cabezas del beat b05 son ilustrativas (una gramatical y otra de palabra anterior). Siguen lo que se ha descrito en modelos entrenados (Clark et al., 2019) sin afirmar que una cabeza concreta haga exactamente eso.

## Desviaciones del guion §11.4

- b07 usa `scatter` (los dos «banco» en lugares distintos del mapa) en vez de una `network` congelada. Así `network` no aparece en más de 3 beats y la escena muestra el resultado de la contextualización sin regalar la respuesta.
- b11 usa la cámara `orbit_close`, no `side`, para no repetir forma y cámara con b10.
- b13: el texto «token · atención · probabilidad» pasa de 24 caracteres, así que son tres capas `text`.
- Ejemplo del «banco»: el contexto que lo desambigua va **antes** de «banco» («En el parque, me senté en el banco»). En un modelo que genera texto, cada token solo atiende a los anteriores, y la frase original del guion habría puesto «parque» después.

## Números comprobados

- 2017, «Attention Is All You Need», equipo de Google: Vaswani et al., NeurIPS 2017.
- 512 dimensiones, 8 cabezas, 6 + 6 bloques: modelo base del artículo original (d_model = 512, h = 8, N = 6).
- «Decenas de miles» de tokens de vocabulario y «miles de millones» de parámetros: órdenes de magnitud robustos. Se evitaron cifras exactas de modelos concretos.
- ≈ 63 % para «techo»: softmax([4, 3, 2, 1, 0.5]) da 54.60 / 86.44 = 0.632. La lectura de la perilla de b10 calcula 100 / (1 + e^(−1/T) + e^(−2/T) + e^(−3/T) + e^(−3.5/T)), que da 63 % con T = 1, 99 % con T = 0.2 y 42 % con T = 2. Se apoya en F27 (softmax), F28 (puntuaciones) y F29 (división entre la temperatura).
- La curva del remedial r02a usa la misma expresión, de T = 0.2 a T = 2.

## Agentes de EIDOS (b12)

Describe el pipeline del propio EIDOS según la especificación del proyecto (Cartógrafo → libro de hechos con citas → Director → Escéptico). En los mundos de demostración, la verificación es una comprobación literal de citas hecha por `pnpm demo:cite`, no una llamada al Escéptico.
