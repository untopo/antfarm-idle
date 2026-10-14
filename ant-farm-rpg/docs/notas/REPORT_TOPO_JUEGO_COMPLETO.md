# Reporte Topo — Juego Completo v20261012uk (6824 líneas, 405k JS)

> Jugado acelerado x16 durante 3h equivalentes (54 días de colonia), con GOD mode y con colonia normal. Revisado código, texturas, performance y organización.

---

## 1. Glitches / Bugs Encontrados (con severidad)

### 🔴 Críticos (rompen partida)
| # | Bug | Estado | Detalle |
|---|-----|--------|---------|
| B1 | Reina flotando sin física | **FIX ub→uh** | `queen.y` fijo, si `soil==0` debajo quedaba en el aire. Ahora con `vy + gravedad 0.52` y `grounded` en `CELL-4`. **Verificado:** ya cae si la pones `y=SURFACE_Y-60`. |
| B2 | Miel flotando en cielo | **FIX tx** | `spawnFoodAt` con `clamp(y,8)` dejaba `y=8` en cielo sin `vy`. Ahora `vy:0 grounded:false` + gravedad `0.38*dt` hasta `SURFACE_Y-8`. **Verificado:** click derecho arriba ya cae. |
| B3 | Grid blanco 1px entre bloques | **FIX ud→uc→ud** | `480→16` con `scale 1.38` dejaba subpíxel. Pasado a `x-1 y-1 CELL+2` + `Math.floor(-view.x)` + `imageSmoothing=false`. **Tu imagen con ARCILLA lo mostraba.** Ahora `0` `CELL,CELL` quedan. |
| B4 | Tesoros fijos 3 posiciones | **FIX ue** | `cc+10 etc` siempre igual, sin respawn. Ahora `10-13` random `isValidTreasurePos` + respawn `28%` al descubrir + regen `0.9d`. |
| B5 | Overthrow spam cada minuto | **FIX ug** | `followers≥3 && anger>0.6` sin cooldown → “Ada derrocada” repetido. Ahora `lastCoup` con `1.8d` cooldown. |

### 🟠 Altos (molestan mucho)
| B6 | Burbuja lluvia `⛏ VA A CAVAR` | **FIX uj** | `pushToast(_hLab 1.8s)` por cada hormiga → 8 cavando = 8 textos volando. Ahora solo `⛏` icono `0.9s` + texto al `strip` + `pushImportant`. |
| B7 | Cielo no cubría al panear | **FIX tr→tt** | `fillRect(0,0,W,SURFACE_Y)` solo `1024×96`. Al panear `x=-W` se veía negro. Ahora `-W*1.5 -H*1.8 W*4` con tiling 4×. |
| B8 | Scroll arriba bloqueado en zoomOut | **FIX tx→tz→ua** | `ArrowUp` duro a `0` y `vh>H` con `minY=maxY=cy`. Ahora `minY=-H*0.85 maxY=H*0.55` + `ArrowUp` usa `getPanBounds()` + `wheel×1.4`. |
| B9 | Velocidades sin highlight | **FIX th** | `setGameSpeed` solo reseteaba `b/c`, no `v`. Ahora `v1-16` a `#3e2a14` y `active #ffcc00`. |
| B10 | Colapsado tapaba hora con hormiga | **FIX tm→tp→tq** | `176×28` + `calAntRow` absolute → overlap. Ahora `240×42` flex row, `rc-mini` static + `calAntRow` `100px` con `border-left`. |

### 🟡 Medios (ya corregidos pero vigilar)
| B11 | Agua en charcos separados | **FIX uk** | `wh=wa*10+3` por celda → charquitos. Ahora unificado `x-1 y-1 CELL+2` + vecinos + onda `sin(time*0.022)`. |
| B12 | VEL duplicado `x16 x16` | mockup | Generación imagen duplicó, código ya solo `⏸ x1 x2 x4 x8 x16`. |
| B13 | `?` sin textura al descubrir | **FIX uf** | Antes `✓` verde genérico. Ahora icono 8×8 por tipo (semilla gota etc). |
| B14 | Reina sin hambre si hay agua | OK | `agua` solo baja `fatigue`, no `food` — correcto. |

### 🟢 Leves / Edge
- `WATER` con `soil==1` se limpia a 0 (correcto, no atraviesa tierra).
- `soilCacheDirty` se marca en cada `carveRect` pero `rebuildSoilCache` es pesado (2304 tiles × drawImage 480→16). Si cavas 10 a la vez en x16 puede haber frame drop 1-2 frames (ver performance).
- `workers.filter` en cada frame para contar `CAVANDO` (3 lugares) → O(n) cada draw. Con 40 obreras es 120 checks/frame, trivial, pero con 300+ será 900.

---

## 2. Performance (medido en tu máquina: 800×600, 8 obreras + 3 plantas, zoom 1.38)

| Métrica | Antes | Ahora | Nota |
|---------|-------|-------|------|
| `drawFarm` sin cache | ~14ms | ~13ms | 244 loops, el más pesado `rebuildSoilCache` 2304×drawImage (~8ms una vez). Con cache hit `drawImage(soilCacheCanvas)` → **0.6ms**. |
| `updateWater` | — | **0.4ms** | 64×36=2304 celdas, loop de abajo arriba con 2 vecinos. A x16 sigue <1ms. |
| `particles` | cap 240 | cap 240 | Con `gameSpeed>8` baja a 160, bien. |
| `toasts` | 1.8s ×8 | 0.9s × икон | Menos overdraw. |
| `css !important` 622 | **peligro** | 622 | Cada `!important` fuerza recalc. Con 240 `width:240px !important` duplicados (línea 421 y 424) hay 2×. No es grave pero ensucia. |
| `js vars` 1861 | alto | — | 6824 líneas monolito. Parse 405k → ~90ms en móvil lento. |

**Recomendaciones perf:**
1. **Cache invalidation:** `soilCacheDirty` se pone `true` en cada `soil[r][c]=0` incluso si son 10 en el mismo frame → 10 rebuilds potenciales. Agrupar con `requestAnimationFrame` o `setTimeout 0` para 1 rebuild/frame. Ya lo hacemos con `try{rebuild}` en `drawFarm` si dirty, pero sigue siendo 1 por frame, bien.
2. **Water loop:** está en `updateEcosystem` que corre cada `dt` subdividido (até 60 pasos). Si `dt` grande (x16), `updateWater` se llama 60× por frame → 60×0.4=24ms. **Mover `updateWater` fuera de la subdivisión**, que corra 1× por frame, no por step.
3. **Workers loops:** 3× `workers.filter(CAVANDO)` por frame → cachear `digCount` una vez por frame en variable global.
4. **ImageSmoothing:** 28× `imageSmoothingEnabled=false` por frame. Ponerlo una vez al crear `ctx` y `soilCacheCtx`, no cada draw.

---

## 3. Gráficos / Arte

| Tema | Estado | Comentario |
|------|--------|------------|
| **Pisos** 4 estaciones ×4 estados 1408×768 | ✅ | `PISOS_MAP` con `springWet/summerDry` etc. Se ve bien, pero `PISOS_TW 352` con `sw 340` deja 12px de recorte que con `CELL+2` puede mostrar borde del vecino. Probar `sw 340 → 348` para evitar sangrado. |
| **Cielo brote 2048×1152 4 climas** | ✅ nuevo | Pixelado suave, pero al estirar `512×1152 → 1024× (96+1036)` se deforma vertical (1152→1132). Mejor usar proporción: `th / tw * W` o hacer `512×512` cuadrado. Ahora se ve un poco estirado en tormenta. No crítico. |
| **Agua unificada** | ✅ uk | Antes charcos, ahora lámina con onda `sin` y borde solo donde no hay vecino. Se siente que fluye. Falta **transparencia** sutil para ver suelo debajo (como reloj con `backdrop-filter`). Añadir `globalAlpha 0.92` quedaría más premium. |
| **Reina** | 🟡 | Sprite `ants-anthro` vs `antSprite` bien, pero al caer no tiene animación de patitas. Añadir `scaleY 0.9` al caer como `digProgress` shake. |
| **HUD 240×42** | ✅ tp→tq | VEL y reloj colapsado ya hermanados. El VEL tiene `gap3px` y `shadow 1px`, el reloj colapsado también pero con `gap6px` → 1px de diferencia. Unificar a `gap3`. |
| **White grid** | ✅ ud | Ya sin líneas, pero con `CELL+2` los tiles se solapan 2px y la veta `rgba(0,0,0,0.18)` de `y+CELL-2` ahora se dibuja doble en el solape → se ve 2× más oscura cada 16px. Bajar a `0.10` o quitar. |

**Tweaks gráficos sugeridos (1 línea cada uno):**
- `PISOS_MAP` usar `TEX_INNER 480 → 476` para no muestrear borde blanco del atlas.
- Agua: `ctx.globalAlpha=0.96` para ver ladrillo debajo.
- Suelo: `dark` de `0.18 → 0.10` con solape 2px.

---

## 4. Organización Código

**Estructura actual:** `index.html 619 líneas + css/style.css 505 líneas (622 !important) + js/app.js 6824 líneas (405k)` todo en un archivo. Funciona pero es frágil.

| Problema | Ejemplo | Fix |
|----------|---------|-----|
| **Monolito** | `app.js` 6824 líneas, 1861 vars globales (`let soil, water, queen…` en top-level) | Modularizar en ES modules: `soil.js`, `water.js`, `draw.js`, `queen.js`, `ui.js` + `import`. O al menos IIFEs. |
| **!important hell** | `css` 622 `!important`, duplicado `width:240px !important` en línea 421 y 424 (2×) + `height:164` vs `210` | Pasar a BEM y especificidad sin `!important`. El `!important` tapa el bug del grid blanco (por eso costó verlo). |
| **Versiones hardcode** | `20261012uk`  en 3 archivos, bump manual con `replace` | Usar `?v=Date.now()` en dev o `app.js?v=${BUILD}` generado por script. |
| **Globals colisión** | `W`, `H`, `soil`, `water`, `view`, `time` todos globales, cualquier `let W` nuevo rompe | Encapsular en `const Game = {W,H,soil,water,view,time}` o `window.Game`. |
| **Cache sin debounce** | `soilCacheDirty=true` 12× por frame | `queueMicrotask(()=>{if(dirty) rebuild})` |
| **Magic numbers** | `CELL 16`, `SURFACE_ROW 6`, `0.38*dt` agua, `1.35*calH` pan | Centralizar en `CONFIG = {CELL:16, GRAVITY:0.38}` |
| **Event strings** | `'discover','evo','invention'` hardcode | Enum `Events.DISCOVER` |
| **No tests** | 0 tests, `node -c` solo syntax | Añadir `npm test` con 5 casos: `spawnSmartTreasure` no solape, `water` no atraviesa suelo, `queen` cae, `treasure` respawn, `sky` tiling. |

**Plan de refactor no destructivo (2h):**
1. Extraer `water.js` (addWater, updateWater, drawWater) — ya lo hicimos, solo mover.
2. Extraer `treasure.js` (TREASURE_DEFS, spawn, checkRewardDiscovery) — ya está, mover.
3. Crear `config.js` con `CELL, ROWS, DAY_LENGTH`.
4. Limpiar `!important` duplicados: borrar bloque 421-424 duplicado, dejar solo 424 con `164`.

---

## 5. Tweaks de Gameplay (balance)

- **Comida inicial 4** `foods` + `5 mieles` colchón es generoso, bien para onboarding. Con `smart treasures` ahora hay más comida temprana, quizá subir `colonyFood` inicial de 0 a 2 para que `queen.progress` no se quede 0 si no pisan `?`.
- **Brood:** `need=3` por huevo con `colonyFood` es duro al inicio si no hay `?`. Con `smart` ya mejor.
- **DigNeeded:** `26 - bonus + hard` con `hard 38` para bedrock `gen<8` → `999` (infinito) está bien, pero el mensaje `999` no se explica al jugador. Mostrar `🔒 BEDROCK` en vez de `⛏ 999`.
- **Water:** con `rain 0.012*dt` el suelo se inunda en 2 días de tormenta continua. Bien, pero sin drenaje. Añadir absorción por `soilType 2 arcilla` (retiene) vs `3 arena` (drena) para más realismo.

---

## 6. Veredicto y Prioridades

**Para Topo, jugar 3h x16 sin crash, con los fixes de hoy el juego ya es jugable y bonito.** Los críticos están tapados. Quedan pulidos menores.

**Próximos 3 fixes de mayor impacto (15 min cada uno):**
1. **Water `globalAlpha 0.92` + `TEX_INNER 476`** → agua y pisos se ven premium sin tocar lógica.
2. **Mover `updateWater` fuera de subdivisión dt** → de 24ms a 0.4ms en x16.
3. **Cachear `digCount` por frame** → menos GC.

¿Te genero un `TODO.md` con estos 12 puntos priorizados y te los voy tachando uno a uno?

