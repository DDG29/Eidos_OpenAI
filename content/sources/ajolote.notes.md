# Notas de autoría — `ajolote`

Mundo escrito a mano (sin clave de API) siguiendo `docs/authoring/WORLD_AUTHORING.md`. Fuente original: `ajolote.md` (nivel curioso).

## Datos y cómo se eligieron

- Solo afirmaciones robustas y estándar: anfibio endémico del sistema lacustre Xochimilco-Chalco; neotenia; tres pares de branquias externas; regeneración de patas, cola con médula espinal y partes de corazón y cerebro; cicatrización sin cicatriz; epidermis de herida, blastema, dependencia de nervios; memoria posicional (corte en hombro → brazo completo; en muñeca → mano).
- Memoria del tejido de origen: Kragl et al. (2009, *Nature* 460: 60–65), que rastrearon células marcadas con una proteína fluorescente. Se dice “en gran medida” y se menciona la excepción del tejido conectivo (puede formar cartílago).
- Genoma: unos 32 mil millones de pares de bases (Nowoshilow et al., 2018, *Nature* 554: 50–55), unas diez veces el humano (unos 3 mil millones). Comparación en barras con escala logarítmica: *E. coli* 4.6 millones y levadura del pan 12 millones (cifras de referencia estándar). Se aclara que un genoma grande no implica mayor complejidad (secuencias repetidas).
- Conservación sin alarmismo: “en peligro crítico” (Lista Roja de la UICN) y las tres amenazas (pérdida de hábitat, contaminación, especies invasoras: carpa y tilapia), con la parte positiva (canales refugio en chinampas con barreras y filtros). No se usan cifras de densidad de población, porque varían entre muestreos y son frágiles.
- El nombre en náhuatl se presenta como “suele relacionarse con atl y con Xólotl”, porque las traducciones varían.

## Decisiones visuales

- Silueta ORIGINAL del ajolote (vista dorsal): cabeza ancha con ojos (huecos), tres branquias con plumitas por lado, cuatro patas y cola. Se generó por código como unión de polígonos con el mismo sentido de giro (relleno de “winding” distinto de cero). La ruta completa mide 5,562 caracteres (el máximo es 6,000).
- b02 separa las branquias en dos capas `glyph` alineadas con el cuerpo, calculando escala y posición a partir del encuadre canónico del glifo ((p − centro) · 1.875 / lado mayor). Así la anotación “Branquias externas” apunta a las branquias y estas brillan más.
- b01 pone un `burst` pequeño sobre la pata delantera (misma geometría) para anticipar la regeneración.
- La pata es un `tree` de profundidad 2 con 2 ramas: brazo → dos huesos → cuatro dedos, como en la pata delantera del ajolote.
- La memoria posicional se representa con un `field` que irradia desde el hombro (x = −1): las señales cambian con la distancia. El texto dice “en parte”, porque el mecanismo no está del todo resuelto.
- b07 (malentendido) compara una red cristalina de unidades idénticas (“¿comodines?”) con una `network` de tres linajes separados (piel → piel nueva, músculo → músculo nuevo, tejido conectivo → cartílago nuevo).
- Se omitió el tamaño corporal (las cifras publicadas varían) y el dato de la metamorfosis inducida con hormona tiroidea quedó solo en la fuente, no en el libro de hechos.

## Verificación

`pnpm demo:cite ajolote` (40 citas literales) y `pnpm worlds:check ajolote`: 0 errores, 0 advertencias, puntuación 100, cobertura del libro 95 % (los hechos sobre el color y “no copia al otro brazo” se usan en una respuesta grabada y en un remedial). INFLESZ de la narración: 75 (curioso ≥ 65).
