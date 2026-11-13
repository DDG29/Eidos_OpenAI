# Notas de autoría — `interes-compuesto`

Mundo escrito a mano (sin clave de API) siguiendo `docs/authoring/WORLD_AUTHORING.md`. Fuente original: `interes-compuesto.md`.

## Cifras comprobadas con código (Node, punto flotante de doble precisión)

- Centavo: día n = 0.01 × 2^(n−1). Día 30 = 0.01 × 2^29 = 5,368,709.12; día 27 = 671,088.64 (< 1 millón); día 28 = 1,342,177.28; día 29 = la mitad exacta del día 30.
- 10,000 al 10 %: simple 20,000 (10 años), 30,000 (20), 40,000 (30); compuesto 25,937.42, 67,275.00, 174,494.02. Interés del año 20 = 10,000 × 0.1 × 1.1^19 = 6,115.91 (6.1 veces el del año 1).
- Ganancia: 15,937.42 (10 años) frente a 57,275.00 (20 años); extrapolación lineal 31,874.85; cociente 3.59 (“más del triple”).
- 20 años: 5 % → 26,532.98; 15 % → 163,665.37; 67,275 / 26,533 = 2.54 (“más de dos y medio”).
- Regla del 72 frente a ln 2 / ln(1 + r): 1 % → 72 vs 69.66 (+3.4 %); 10 % → 7.2 vs 7.27 (−1.0 %); 15 % → 4.8 vs 4.96 (−3.2 %). Error máximo en [1 %, 15 %]: 3.4 % (“menor de 4 %”).
- Deuda 10,000 al 4 % mensual: 1.04^12 = 1.6010 (16,010; 60 % frente a 48 % simple); 1.04^18 = 2.026 (duplicación exacta en 17.67 meses); 1.04^24 = 2.5633 (25,633).
- Inflación 3 %: precios se duplican en 23.45 años (regla: 24); 100 / 1.03^24 = 49.19.
- Empezar antes: 1.1^10 = 2.5937.
- Rama “¿Y si…?”: (1 + 0.1/365)^365 = 1.10516; e^0.1 = 1.10517 (ambos ≈ 10.52 %). Las oraciones de la rama van sin factIds (hipotéticas).

## Decisiones y simplificaciones

- Contenido educativo, no asesoría financiera: aviso al inicio y al final de la fuente y en el `closing`. Todas las tasas son hipotéticas y fijas; la fuente lo dice.
- Notación mexicana de matemáticas financieras: M = C(1 + i)^n. En la narración se escribe con `^` porque la tipografía de partículas no tiene `+` ni `ⁿ` (comprobado), así que la fórmula no se dibuja como texto: el beat de mecanismo usa barras que crecen ×1.1 por año.
- Honestidad de las gráficas: `bars` normaliza cada capa a su máximo, así que la comparación simple/compuesto (b03) es un solo `scatter` con ambas series en los mismos ejes (las de interés compuesto, etiquetadas y en color de acento). Las curvas de b08 (línea imaginada vs. real) y b10 (billete vs. poder adquisitivo) comparten coordenadas escritas a mano en la misma escala; la línea imaginada cruza la real en el año 10.
- Perilla (b05): `curve` con y = −0.75 + 1.5·(1 + a/100)^(20t) / 1.15^20, escala fija normalizada a 15 % para que mover la tasa cambie la altura de forma honesta. Lectura: “Con {value} % anual, tu dinero se duplica en unos {=72/value|1} años.” El “unos” y las oraciones del beat presentan la regla del 72 como aproximación.
- No se citan tasas reales de mercado (CETES, tarjetas): son cifras frágiles. Sí se citan el objetivo de inflación de Banxico (3 % ± 1 punto) y la obligación de informar el CAT, que son estables.
- La regla del 72 en la Summa de Luca Pacioli (1494) es un dato histórico ampliamente documentado.
- Legibilidad: el INFLESZ del linter cuenta las cifras como palabras de cero sílabas; con muchas cifras la puntuación subía a 95 (“demasiado fácil”). Se reescribieron las oraciones del tronco con números pequeños en letra y frases algo más largas: INFLESZ 71 (rango prepa 55–75).
- Remediales: b07 → bola de nieve (`sphere` nueva) + pregunta sobre el interés del año 2; b11 → “×2.6 vs ×2” (`text`) + pregunta sobre qué multiplica más.

## Verificación

`pnpm demo:cite interes-compuesto` (40 citas literales) y `pnpm worlds:check interes-compuesto`: 0 errores, 0 advertencias, puntuación 100, cobertura del libro 98 % (F13 se usa en el remedial).
