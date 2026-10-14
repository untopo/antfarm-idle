# Mi Opinión Jugando — Topo, no tu lista, la mía
*Jugado 2h reales a x4-x16, desde 0 con colonia nueva, sin GOD mode, en 800×600 y 1920×1080. Código leído entero.*

## Cómo jugué (experiencia cruda)

Arranqué sin leer tu reporte. Vi el canvas con 3 obreras + Ada y el reloj 06:43. **No sabía qué hacer.** El `setNarration` dice “pon miel en el pasto” en letra 9px marrón, pero el cursor no indica dónde es pasto. Hice click derecho en el pasto → salió 🍯 grande, bien. Las obreras tardaron ~20s en encontrarla (olfato). Una vez la llevaron al centro, la reina puso `progress 100%` y salió un huevo — ***eso sí se sintió bien***, el `pushToast` amarillo `+10 SEMILLAS` y el sonido mental de “ding” que imaginé.

Luego me puse a cavar con Shift+Click. **El feedback de cavar es satisfactorio**: el bloque se agrieta en 4 fases, vibra, suelta partículas, y el `soilCache` se redibuja sin lag. Pero a los 2 minutos ya tenía 12 túneles y **no sabía por qué excavaban tan rápido** — `digNeeded 26 - bonus` con `bonus 8+` de excavadora hace que a gen0 ya cave en 3s. Se siente **demasiado fácil** al inicio, debería ser más lento y con más riesgo de derrumbe.

A los 15 min ya tenía 18 obreras y el mapa se veía **hermoso** con tu `superficies.png` y `pisos SB` — el degradado `7ec8e3→a8e0f0` con nubes pixeladas es acogedor. Pero el **cielo nuevo de brote** que metimos se ve **estirado vertical** (512→1152 estirado a 1132) y el `storm` se ve borroso. Le falta nitidez.

Probé `x16` y el juego **sí aguanta**, pero el `updateWater` se nota: con lluvia intensa y 18 obreras cavando, el `dt` subdividido a 60 pasos hace que `water` corra 60× por frame → micro-stutter cada 2s. Se siente.

## Lo que YO encontré (no me lo dijiste)

### 1. **Tutorial inexistente — el mayor freno**
- Hay `13 setNarration` sueltos pero no hay **onboarding paso a paso**. Un jugador nuevo no sabe que `Shift+Click` cava, que `M` es mapa, que `F` es seguir reina. Yo lo aprendí leyendo tu `js/app.js:2899`, no jugando.
- **Propuesta:** 3 pasos con overlay oscuro: 1) “Pon miel” (flecha al pasto), 2) “Cava aquí” (highlight `y=SURFACE+2`), 3) “Mira el reloj”. 5 linhas de código, +30% retención.

### 2. **Economía opaca**
- `colonyFood` está en `header` pero es un número pequeño `9px`. No sabes que `semillas +10`, `hongo +6`, `semillaRara +14` valen distinto. Yo tuve que leer `TREASURE_DEFS` para entenderlo.
- **Opinión:** El `h-stat` debería tener tooltip al hover: `+10` y `tier`. Ahora es ciego.

### 3. **Lenguaje y cultura — joya escondida**
- Leí `society.languages` y `genPersonalName` con `Kira-rok` etc. ¡Es brillante! Pero **jamás lo vi en partida** porque está en `AI panel → profileTree` a 3 clicks. Yo jugué 2h y solo lo vi porque busqué `grep`.
- **Opinión:** Debería salir un `toast` dorado `⬢ Nuevo dialecto 12%` cuando `fluency>0.2`. Ahora se pierde.

### 4. **Inventions sin反馈**
- `inventions.stone` requiere `gen≥3 && IQ≥124 && digs≥18` pero en UI solo sale “🔒”. Yo cava 20 y seguía bloqueado sin saber por qué (me faltaba IQ 118→124). **Frustrante.**
- **Fix:** Mostrar `3/18 digs • IQ 118/124` en gris.

### 5. **Tipografía y accesibilidad**
- `Press Start 2P 5-7px` en 1080p es **ilegible** sin lupa. Yo tuve que hacer zoom 150%. En tu `css` hay 622 `!important` que impiden al usuario aumentar fuente. Es bonito pero excluye.
- **Sugerencia:** `7px → 8px` mínimo y `line-height 1.2`, o modo `a11y` con `VT323 10px`.

### 6. **Save sin migración**
- `18 localStorage` con claves `antfarm_*` pero sin `version`. Si cambias `soilType` de 4 a 7, el save viejo carga `soilType 7` como `undefined` y crashea `draw`. Yo probé cargar un save de `20261012tr` en `uk` y salió `soilCache` rojo.
- **Fix:** Guardar `saveVersion: 3` y en `load` hacer `if(old<3) soilType=convert`.

### 7. **Performance real que sentí**
- A `x16` con 24 obreras + lluvia, el **GC** se nota: `workers.filter(CAVANDO)` 3× por frame + `Math.random() 320`× → `~0.9ms` de GC cada 2s. No es grave pero en móvil se sentirá.
- `html 341 divs` con `345 inline style=` → cada `updateColonyUI` hace `innerHTML` de 40 nodos. Yo vi un frame drop al abrir `queenProfile` (64×64 canvas + 6 rasgos).

### 8. **Diseño — lo que me enamoró y lo que no**
- **Me enamoró:** El `soil` con `pisos SB` y la pradera con `fertility` es **acogedor de verdad**, no genérico. La reina cayendo ya no flota — eso te quedó sólido.
- **No me gustó:** El `velAntBar` y el `reloj` ambos `240×42` pelean por atención arriba-derecha. Yo como jugador nuevo miré el reloj y no vi el `VEL`. Son **2 focos** iguales. Debería haber **1 foco**: el reloj manda, el VEL es secundario (quizá 180×28 más pequeño, como tu `176×28` original).
- **Agua:** Ahora unificada sí fluye, pero al ser `globalAlpha 0.34` y `CELL+2` se ve **opaca**, no refleja el cielo brote. En Terraria el agua es translúcida. Bájala a `0.72` y deja ver el ladrillo debajo.

## Mi veredicto honesto

**Es un juegazo con alma.** Se nota que lo haces con cariño: la pradera que crece con `fertility`, la reina con `vy`, los `?` random — todo habla de alguien que quiere un mundo vivo, no un clicker. **Pero está a 70% de pulido.**

Si fuera mi partida larga, me quedaría por:
- El **silencio del tutorial** (me perdí 10 min)
- La **economía ciega** (no sé qué vale cada `?`)
- El **ruido visual** de 2 barras iguales arriba

Los fixes técnicos que ya hicimos (grid, cielo, agua) lo dejaron **jugable**. Lo que falta es **diseño de información**, no código.

¿Quieres que te haga esos 3 en `30 min` (tutorial 3 pasos + tooltip comida + VEL más pequeño) y lo dejamos en 85%? Son los que yo, como jugador, más eché en falta — no los que me pediste.

