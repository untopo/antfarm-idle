# Reporte de jugabilidad — ANT FARM
Fecha: 2026-10-14 · revisado sobre el código en `js/app.js` (7 638 líneas) e `index.html` (758 líneas)
Verificación: suite node (`bash test/run-all.sh`) + Chrome real con puppeteer (`node test/browser-smoke.js`).
Todo lo de abajo está medido en el estado actual del repositorio, no en una versión anterior.

---

## 1. Qué se arregló en esta pasada (y cómo se comprobó)

| # | Fallo | Causa real | Arreglo | Prueba |
|---|-------|-----------|---------|--------|
| 1 | **Al pulsar un tamaño "no pasaba nada"** | `confirm()` nativo como puerta de entrada. En un iframe con `sandbox` sin `allow-modals` (previews embebidos) y en varios móviles el navegador **ignora** la llamada y devuelve `false` → `if(!ok){ return; }` abortaba la creación en silencio | Diálogo propio `gameDialog/gameConfirm/gameAlert` (foco en el SÍ, Enter/Esc, backdrop = NO) y cero `confirm/alert/prompt` en el juego | `test/browser-smoke.js`: dentro de un iframe hostil `window.confirm('probe')` devuelve `false` y aun así la granja se crea (21 ok) |
| 2 | **La pantalla de tamaños quedaba debajo del menú** | `hideAll()` no ocultaba `#mainMenu`: las dos pantallas son `position:fixed` y el clic en "BIG" caía sobre el botón CREAR de encima | `hideAll()` incluye ahora `splash` y `main` | Chrome: antes del arreglo el clic no producía nada; después, `worldGenScreen` pasa a `display:flex` y el mundo queda 96×48 |
| 3 | **El bucle moría cada frame** | `updateColonyUI` escribía en ids que el HTML ya no tenía → `TypeError: Cannot set properties of null` dentro del `loop` (y se saltaba el resto del frame) | Helpers tolerantes `hudText/hudHtml/hudStyle/hudValue` + red de seguridad alrededor de `updateColonyUI` | Chrome: "cero errores de JS en pestaña normal" y "dentro del iframe" |
| 4 | **Se perdía la granja si recargabas sin pulsar EMPEZAR** | El guardado no llegaba hasta terminar el onboarding | `serializeSave(true)` + archivado al terminar la siembra | Chrome: al recargar, CONTINUAR devuelve la granja 96×48 con sus 5 hormigas |
| 5 | **Dos flujos de creación peleados** | `index.html` tenía 4 bloques `<script>` propios (fallback de splash, cableado del HUD, chequeo del calendario, `topoInlineFallback` con sus propios `setInterval`) además de `js/bootstrap.js` | Borrados los 4 y el `bootstrap.js`; queda **un** bloque: el vigía de arranque que avisa si `app.js` no cargó (con botón RECARGAR) | `run-all.sh` falla si el HTML vuelve a tener más de un `<script>` inline |
| 6 | **HTML nuevo con JS viejo** | `?v=20261015c` en los assets mientras el footer decía `v20261015d` | Un solo `?v=20261015e` en HTML, CSS y assets; `dev-server.js` sirve con `Cache-Control: no-store` | Test estático: "un solo número de versión para todo el HTML" |
| 7 | Nombres de otros juegos en texto visible | `(Terraria)`, `Minecraft: nunca 0`, `Dwarf Fortress stockpile` en eventos del historial | Reescritos con voz propia de la granja | `grep` sobre cadenas visibles: 0 |

## 2. Rendimiento (medido en node con el `app.js` real, mediana de 5 muestras)

| Tamaño | Crear mundo | Render / frame | Simulación / tick | Celdas |
|--------|------------|----------------|-------------------|--------|
| SMALL 48×28 | **0.90 ms** | 0.40 ms | 0.52 ms | 1 344 |
| MEDIUM 64×36 | **1.03 ms** | 0.53 ms | 0.61 ms | 2 304 |
| BIG 96×48 | **1.33 ms** | 0.64 ms | 0.60 ms | 4 608 |

Coste por celda: 667 / 448 / 288 ns — el grande es más barato por celda, el ratio BIG/SMALL es 1.48× (nunca se invierte). Todo el conjunto (render + sim) de un mapa pequeño está en 0.92 ms: sobra presupuesto para 60 fps.

Tweaks de rendimiento aplicados en esta pasada:
- `getCalendarData()` y el estado del clima se leían **por celda** al reconstruir el caché del suelo (4 608 veces en BIG). Ahora se calculan una vez por reconstrucción.
- `decoSet` usaba claves de texto `'c,r'` (una cadena por celda pintada) → clave numérica `dkey(c,r)=(r<<12)|c` y `hasDeco()` con guarda por tamaño.
- `crossover()` clonaba el genoma con `JSON.parse(JSON.stringify(...))` → `cloneGenome()`.
- El registro de mutaciones construía ~17 cadenas por genoma que nadie leía (los lectores usan las 2 primeras) → se corta a 4.
- `fungusGardens.filter(...)` y `Object.keys(society.languages)[0]` por hormiga creada → contadores directos y `_firstLangFluency()`.
- Escrituras de HUD: se omite el `textContent` cuando el texto no cambió.
- Los 53 `console.log('[...]')` del arranque y del bucle pasan por `tlog()`, mudo salvo `?debug=1` o `localStorage.antfarm_debug='1'`.

## 3. Lo que **todo juego debe tener** y aquí falta

### P0 — sin esto no se puede jugar de verdad
1. **Audio: no existe.** 0 `new Audio`, 0 `WebAudio`. Un juego de construir y cavar sin feedback sonoro se siente roto: cada golpe de tierra, la miel entrando en el tarro, el "tick" de la colonia, la lluvia. Es el hueco más grande del proyecto.
2. **Táctil: no existe.** 0 `touchstart`, 0 `pointerdown`. El juego se ofrece como "SMALL = móvil o PC modesta" pero en el móvil no se puede cavar (todo está enganchado a `click` y a `shift+click`). Botones de 36 px y HUD de tiras tampoco están pensados para el dedo.
3. **Accesibilidad: nada.** 0 `aria-*`, 0 `role=`, `tabindex` ausente en el canvas, sin `prefers-reduced-motion` (la lluvia y el parpadeo no se frenan), sin contraste garantizado en los textos de 6–7 px del menú. Y los iconos son emojis: en un sistema sin fuente de emoji se ven como cajas vacías (pasa en el screenshot de prueba).
4. **Faltan 4 PNG de personajes** (el navegador responde 404): `assets/pixel-ants-cropped.png`, `ants-anthro-animated.png`, `ants-humanlike-1/-3-thumb.png`. Hoy las hormigas se dibujan a mano (fallback), así que el juego "funciona" pero va sin su arte de hormigas y sin antropomorfos.
5. **Ajustes no persisten.** No hay `antfarm_settings`: volumen, calidad, velocidad por defecto e idioma se pierden al recargar. El `<select>` de idioma está en el DOM pero no guarda elección.

### P1 — lo que convierte un simulador en juego
6. **No hay meta.** 0 logros, 0 misiones reales (la palabra `quest` aparece 5 veces en contexto de "cuestiones"). Cavar es infinito y la colonia no puede morir (hay parche anti-extinción), así que no hay riesgo ni recompensa: sin condición de victoria ni de derrota no hay motivo para volver mañana.
7. **Bucle de progreso sin premios tangibles**: el onboarding termina en "¡A JUGAR!" y no vuelve a hablarse contigo; no hay celebración al primer túnel, al primer tarro lleno, a la primera cámara.
8. **Menú de pausa vacío**: `⏸` congela el tiempo pero no da Opciones / Guardar / Volver al menú (el flujo está en la pantalla de ajustes, enterrado).
9. **Teclado mínimo**: 4 oyentes de `keydown` (ESC, SHIFT cavar, T barra, …). Sin atajos para cámara, velocidad, guardar, ni reasignación.

### P2 — acabado profesional
10. Reglas por tamaño que siguen a medias: sí escalan cofres (`worldAreaRatio()`), despensa, miel en superficie y capacidad; **no** hay reinas ni obreras por tamaño (5 obreras fijas en los tres tamaños).
11. El caché del suelo reconstruye todo el mapa cuando cambian 9 celdas (se puede pintar solo el rectángulo sucio, o volver al atlas de recortes que estaba en otra revisión).
12. Guardado: un único JSON de ~47 KB en BIG con 5 archivadas. Funciona, pero no hay formato versionado con migración, ni guardado en la nube/export, ni "última partida" legible.
13. Sin telemetría de errores: si revienta algo fuera del bucle solo se ve en consola (y con `?debug=1`).

## 4. Qué está mal y hay que decidir (no es cosmético)
- **El mundo "por defecto" 64×36 sigue existiendo como valor inicial de `COLS/ROWS` antes de elegir tamaño.** El suelo y las entidades sí están diferidos (`[TOPO] initSoil diferido`), pero `window.COLS` ya vale 64 y cualquier código que pregunte por el mapa obtiene un mundo fantasma. Quitar el default (o ponerlo en 0 hasta sembrar) es la única forma de que "el mundo no existe hasta elegir" sea verdad en el código, no solo en la pantalla.
- **`hudToggle` está en el HTML con `display:none`** y `wireChromeUI()` intenta plegar unas tiras (`.hud-strips`, `dayControls`, `cornerControls`) que **no existen** en este `index.html`: el HUD de tiras y las velocidades x32/x64 se perdieron en la reversión de ficheros descrita en `docs/INCIDENTE-20261014.md`. Hay que volver a ponerlos o borrar los controles huérfanos.
- **Las pruebas solo pueden ser honestas si el entorno emula al navegador.** El stub de node tenía `confirm: () => true`; por eso el bug vivió ahí sin verse. `test/browser-smoke.js` (iframe sin `allow-modals`) es el que lo cazó.

## 5. Plan corto para que califique como "jugable" (con criterio de aceptacion)
1. **Sonido** (1 sesión): 6–10 efectos sintetizados con WebAudio (cavar, miel, obra terminada, alarma, clima, nivel de colonia) + música loop, botón de volumen persistente en `antfarm_settings`. *Aceptación*: silencio total con el botón a 0; no hay `AudioContext` suspendido sin resume tras el primer gesto.
2. **Punteros unificados**: cambiar `click`/`mousedown`/`shift+click` a `pointerdown/move/up` con `touch-action:none` en el canvas, pala de 44 px en los botones del HUD y cavar con un toque largo en móvil. *Aceptación*: en un viewport táctil 390×844 se puede crear granja, cavar 3 túneles y abrir la ficha de una hormiga sin teclado.
3. **Objetivo y consecuencias**: 6 metas encadenadas (primer túnel → primer tarro → primera cámara → 20 hormigas → 3 cofres → idioma GEN≥2) con premio visible, y una condición de derrota suave (colonia sin comida 3 días → se reduce a la reina y hay que reconstruir). *Aceptación*: la lista se ve en el historial, se marca al cumplirla, y hay un estado "derrota" con reinicio desde el menú.
4. **Accesibilidad mínima**: `aria-label` en todos los botones de icono, foco visible, `tabindex="0"` en el canvas con flechas para mover cámara, `+/-` para zoom, y bloque de animaciones con `prefers-reduced-motion`. Sustituir emojis por iconos dibujados (ya hay atlas de señales). *Aceptación*: se puede jugar solo con teclado y no hay cajas vacías sin fuente de emoji.
5. **Re-land de lo perdido**: atlas de suelo + redraw parcial, HUD de tiras con x32/x64, reinas/obreras por tamaño, bloques de nombres por colonia. *Aceptación*: `node test/world-size-rules.js` sigue verde y `rebuildSoilCache` por debajo de 1 ms en BIG.
6. **Reglas de guardado**: versionar el save (`v:3`) con migración, y un botón "exportar/importar granja" en Ajustes. *Aceptación*: un save viejo abre sin romper; export→borrar→import devuelve el mismo día y las mismas obreras.

## 6. Nota del dueño
El juego hoy **se puede crear, sembrar, guardar y continuar en un navegador real, incluso dentro de un iframe con los diálogos bloqueados**; eso antes no pasaba y es lo que pediste. Lo que le falta para ser un juego redondo no es el motor: son sonido, táctil y una meta. Todo lo verificado en este informe tiene comando y archivo detrás (`test/create-farm-flow.js`, `test/browser-smoke.js`, `test/world-size-rules.js`).
