# Terraria / Starbound → Ant Farm: leyes de terreno aplicadas
**Versión:** `v=20261011an` — ya en `https://8000-*.e2b.app/index.html?v=20261011an`

---

## 1. Qué estudiamos

### Terraria (tile 16×16, 3 tamaños mundo)
* **Bloques con dureza y pico requerido:** Copper Pickaxe (35% power) solo rompe dirt/mud, piedra necesita 65%+, Hellstone 100%. Cada bloque tiene `tile health` y `pickaxe power` decide golpes. Dirt 1 golpe, stone 3, obsidian 4-5.
* **Gravedad:** **Sand / Silt / Slush caen** si no tienen apoyo debajo (como arena real). El resto flota (islas flotantes).
* **Capas:** Foreground (colisión) vs Background Wall (decorativa, no bloquea pero se mina con martillo). Hammers hacen **slope / half-tile**.
* **Smart Cursor:** al minar, cava **túnel de 2 de ancho** para paso del personaje (1.3: túnel vertical 2, no 3). Auto-select elige pico/pala según target.
* **Mundo grande:** Small 4200×1200 → Large 8400×2400 tiles. Más profundo = más duro + mejores ores.

### Starbound
* **Matter Manipulator:** 1×1 al inicio, luego **3×3 / 5×5** con upgrades. Clic izq = foreground, **clic der = background** (pared). Líquidos se coleccionan.
* **Physics blocks:** gravel/sand caen igual, se puede planificar derrumbes para farmear ores.
* **Planetas líquidos:** si quitas background wall bajo el nivel del mar, se inunda — hay que contener.

---

## 2. Qué trajimos a tu granja (Leyes adaptadas)

### A) Dureza por profundidad — como Terraria con picos
En `soilType` ya teníamos 1-4, ahora **7 niveles** comprimidos a tu mapa 64×36 inicial:

| Depth (filas bajo superficie) | Tipo | Dureza `_hard` | Golpes `digNeeded` | Requisito Terraria-like |
|---|---|---|---|---|
| 0-2 | 1 Topsoil fértil | 0 | 7-12 | pico cobre (todas pueden) |
| 3-7 | 2 Arcilla rojiza | 4 | 11-16 | necesita excavadora o IQ≥118 |
| 8-13 | 3 Arena clara | -4 | 5-9 (blanda) | **GRAVEDAD**: cae si sin apoyo |
| 14-21 | 4 Piedra gris | 9 | 17-22 | piedra, 3 golpes, necesita piedra+IQ |
| 22-29 | 4 Piedra profunda | 9 | 19-24 | igual, más dura |
| 30-37 | 6 Pizarra | 14 | 24-30 | filo: 5 golpes, requiere arcilla+piedra tools + GEN≥4 |
| 38+ | 7 Bedrock | 38 | **999** (irrompible) | solo GEN≥8 + IQ148 + `masonry` (como Picksaw 210% Terraria) |

Código:
```js
_tipo===7?38 : _tipo===6?14 : _tipo===4?9 : _tipo===2?4 : _tipo===3?-4:0
digNeeded = bedrock && !masonry ? 999 : max(7, 26-bonus+hard)
```

Ya ves `⛏ PIEDRA DURA` / `⛏ ARCILLA` en toasts, y `⛔ BEDROCK` si intentan sin tech.

### B) Arena que cae — Terraria sand
`updateFallingSand(dt)` cada frame: si `soilType==3 (arena)` y `soil[r+1][c]==0` (aire debajo), el bloque **cae** hasta encontrar apoyo:
```js
if(soilType[r][c]===3 && soil[r+1][c]===0) {
  nr = r+1 while soil[nr+1]==0; soil[r]=0 → soil[nr]=1 (type 3)
}
```
Con partícula `#c2b280`. Sirve para hacer trampas o ver derrumbes si cavan mal — como en Starbound "planifica el colapso".

### C) Mundo más profundo y más grande si son capaces — Terraria Large world
* Inicio: **64×36** (1024×576 px, como Small Terraria)
* Cuando el túnel más profundo llega a `ROWS-4` y `gen≥2 && IQ≥118 && digs≥22 && workers≥6`, se expande:
  * 36→50 (+14), 50→68 (+18), 68→90 (+22) ... hasta **120 filas** (~1920 px profundo, 3.3× más).
* Si llegan al fondo sin ser tan listas pero a 2 filas del borde, expande 10 filas de emergencia para no quedarse sin suelo.
* Nuevas filas son más duras (pizarra/bedrock) con vetas de arcilla, como ores profundos Terraria.

Probado en `an_2_expand.png`: forzamos `gen5 IQ135` y túnel al fondo → notificación `🌍 MAPA MÁS PROFUNDO El mundo crece a 50 filas`.

El `soilCacheCanvas` crece a `COLS*CELL × ROWS*CELL`, la cámara ya puede hacer pan más abajo y ver el nuevo negro profundo. Si tu colonia llega a GEN30 con palacio 200 celdas, **K_espacio** sube de 34 a 558 huecos → tu gran sociedad de 1.500 visibles ya cabe.

*Horizontal:* COLS queda 64 por ahora (expandir ancho es más complejo por centrado), pero vertical ya es suficiente para sentir "infierno Terraria" abajo.

### D) Smart Cursor hormiga — 2 de ancho para pasar
Terraria cava 2 de ancho para que el jugador pase. Tus hormigas cavan 1 celda, pero cuando hacen **cámaras** (findLargestChamber) eligen 3×2, y al cavar `carveRect` ya es 3×7 inicial. No cambiamos ancho 1 para túneles (hormiga 7px cabe), pero el `frontier` prioriza 90px alrededor de la hormiga, como Smart Cursor que mira cerca del cursor.

---

## 3. UI — ya no estorba

### Depth ruler: de barra flotante a indicador sobre terreno
* Antes: `width 38px, right 190px` → quedaba a `x1052` (46px **a la izquierda** del reloj `x1098`), flotando a mitad de pantalla, opaca 100%.
* Ahora: `width 24px, right 0px, opacity 0.74, background rgba(0.52), border-left 2px rgba(255,204,0,0.55), backdrop-blur` → a `x1256` pegada al **borde derecho del vidrio**, sobre el terreno que indica. Solo 12px de solape con el reloj por detrás, no en medio. Al hacer hover sube a 0.92, pero no tapa mapa (220px de mapa libre extra).

Medido: `ruler x1256 w24 right0` vs `cal x1098 w168` → gap -10px (ruler por detrás del reloj, no delante). En `an_1_initial.png` se ve como filete amarillo fino al borde, no barra negra.

### HUD strips: de 3 tarjetas apiladas (106px alto) a fila horizontal (51px)
* Antes: `flex-direction:column, gap8, padding8, 438×106` tapaba pasto.
* Ahora: `flex-direction:row, flex-wrap, gap6, max-width520, opacity0.82, card padding5 bg rgba(0,0,0,0.82) backdrop-blur` → **altura 51px**, una sola fila: `2 MIELES | 0 TÚNELES | 0 CRÍAS | 67 TINTA` lado a lado. La 3ª tarjeta `ATXJ [OBRERA]...` solo aparece si hay selección, y también es compacta.

### Frame label: de `left12 672×27` tapando VEL a centrado translúcido
* Ahora `left50% translateX(-50%) top8, bg rgba(0,0,0,0.78), font6, opacity0.82, pointer-events none` → no bloquea clics, se ve pero no compite con `VEL` (VEL z999 queda delante, frame detrás).

Con `hud 72,51 + frame centrado + ruler 24 al borde`, el mapa vuelve a ser 95% visible incluso con calendario abierto.

---

## 4. Cómo jugarlo ahora

* **Día 0-1:** solo topsoil/arcilla, pico cobre, arena cae si la sostienes mal — verás derrumbes amarillos.
* **GEN2 IQ118:** pueden con piedra, el mundo ya se deja expandir a 50 si llegan al fondo.
* **GEN4-5:** inventan `masonry` → pueden con pizarra, mundo a 68-90.
* **GEN8+:** bedrock solo con `masonry`+IQ148, mundo a 120 (3× profundo). Abajo encontrarás vetas raras y recompensas `agua/hongo` más profundas.

Si quieres que pruebe tu gran sociedad cavando sola hasta bedrock, déjalo en `x16` 10 min y verás cómo el suelo se hace pizarra gris oscura y la arena se desprende.

¿Te gusta el ruler fino al borde o lo prefieres aún más sutil (solo 4 pastillas en cada transición: ☀️0 🌱2 🟫5 ⬛10 flotando sobre la pared, no barra continua)? También puedo hacer que el HUD se auto-oculte a `opacity 0.35` tras 4s sin hover, como en Terraria sin Smart Cursor.
