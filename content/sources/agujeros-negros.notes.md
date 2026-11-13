# Notas de autoría — agujeros-negros

Mundo escrito a mano (sin clave de API), siguiendo `docs/authoring/WORLD_AUTHORING.md` y el guion §11.6.

## Cifras y datos comprobados
- Velocidad de escape terrestre ≈ 11.2 km/s (≈ 40 300 km/h). Velocidad de la luz ≈ 300 000 km/s.
- Radio de Schwarzschild: ≈ 3 km para una masa solar (2.95 km) y ≈ 9 mm para la Tierra (8.9 mm).
- Relatividad general publicada en 1915; solución de Schwarzschild en 1916.
- Michell: lo dejé como "finales del siglo XVIII" en lugar de dar un año exacto.
- GPS: efecto relativista neto ≈ +38 µs/día (≈ +45 por gravedad, ≈ −7 por velocidad). La fuente atribuye el efecto "sobre todo" a la gravedad. Altura orbital ≈ 20 000 km. Sin corrección, el error de posición crece kilómetros por día (38 µs × c ≈ 11 km).
- EHT: imagen de M87* publicada en abril de 2019 y de Sgr A* en mayo de 2022 (ambas con datos de 2017); λ ≈ 1.3 mm. M87* ≈ 6.5 × 10⁹ M☉ a ≈ 55 millones de años luz. Sgr A* ≈ 4 × 10⁶ M☉ a ≈ 27 000 años luz. Campaña 2017: ocho telescopios en seis sitios, incluido el GTM/LMT (Puebla).
- Premio Nobel de Física 2020 por las órbitas estelares alrededor de Sgr A* (Genzel y Ghez).

## Simplificaciones
- Analogía de la tela elástica, señalada como analogía y con sus límites.
- El horizonte como "velocidad de escape mayor que c" es el argumento newtoniano de Michell; la narración lo presenta como intuición, y los niveles universidad y experto lo distinguen de la definición relativista.
- Disco "hasta millones de grados": vale para discos de agujeros de masa estelar; no di temperaturas para los supermasivos.
- No incluí detalles de la sombra (≈ 2.6 veces el radio del horizonte); solo "más grande que el horizonte".

## Decisiones visuales que se apartan del guion
- b05 usa `shell` (el horizonte) más un núcleo `sphere`, en lugar de `vortex`. Así `vortex` queda en 3 beats (b06, b08 y b10) y el horizonte se lee como una frontera, no como un objeto.
- b09 usa una `curve` cuya longitud de onda crece al alejarse de un pequeño `shell`. El corrimiento al rojo se ve en el espacio, cosa que `wave` no puede mostrar porque su longitud de onda es uniforme.
- b04: el cañón de Newton. Las trayectorias son cónicas reales con foco en el planeta: una hipérbola (e = 1.4) que escapa y una elipse (e = 0.5) que choca con la superficie.
- b11 usa un `torus` y b12 la combinación `grid` + `shell` + `torus`, para respetar el límite de 3 usos por forma.
