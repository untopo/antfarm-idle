# Incidente 2026-10-14: el workspace volvió a una revisión anterior a mitad de sesión

## Qué pasó
Mientras se limpiaba el código, `ant-farm-rpg/index.html` cambió de manos: de 167 294 B (05:46, medido
con `ls -l`) a 72 821 B sin que nadie lo escribiera. Al seguir trabajando, las comprobaciones del
navegador y del test de flow dieron resultados imposibles para el fichero que se había leído una hora
antes.

Pruebas de que el disco cambió (no de que yo lo cambiara):

| Comprobación | Antes (leído a las 05:4x-05:5x) | Ahora |
|---|---|---|
| `index.html` | 167 294 B · 929 líneas · `.hud-strips`, `#dayControls`, `#cornerControls`, `topBar` con `data-action` | 72 258 B · 758 líneas · 0 ocurrencias de esos ids |
| `js/app.js` | `togglePause()`, despacho por `data-action`, `x32/x64` | 0 ocurrencias de `togglePause` y de `data-action`; los handlers viven en `btnPause`, `btnSpeed1..16` |
| caché del suelo | `_soilAtlas`, `bakeTile`, `TILEMAP`, `MAX_DUG_PER_BATCH` | 0 ocurrencias |
| guardado | `window.confirm` en el flujo, `?v=20261015c` | igual (de ahí que los parches encajaran sin ruido) |

`js/app.js` **no** se sustituyó: su tamaño evoluciona de forma continua con mis parches
(455 812 → 460 142 B) y todos los cambios de esta sesión están ahí. Lo que se restauró fue el
`index.html` (y, con él, el HTML al que el JS nuevo apuntaba).

## Consecuencia práctica
Un HTML de una revisión con el JS de otra. Eso explica media docena de comportamientos "imposibles"
que aparecieron al probar: `updateColonyUI` escribía en ids que el HTML ya no tenía y **mataba el bucle
cada frame**; y `wireChromeUI` buscaba unas tiras de HUD inexistentes.

## Qué se perdió con la reversión (para re-landear)
- Atlas de suelo (`_soilAtlas`/`bakeTile`/`TILEMAP`) y el límite de excavación por lote (`MAX_DUG_PER_BATCH`).
- HUD de tiras: `.hud-strips`, `#dayControls` con `#btnPauseMain`, `#cornerControls` con `#btnCorner*`,
  sincronización `syncCorner()`, velocidades **x32/x64**.
- Reglas de densidad por tamaño: `queenCountFor`, `initialWorkersFor` (hoy 5 obreras en los tres tamaños;
  cofres, despensa, miel superficial y capacidad sí escalan con `worldAreaRatio()`).
- Re-textura del cofre según premio y `NAMES_FEMALE`/pools de nombres por colonia con rebautizo en bloque
  (el `genPersonalName` + `evolveLanguages` + renombre evolutivo sí siguen).
- `test/world-perf.js`, `test/world-phase-bench.js`, `screenshot.js` y los stubs `js/config.js`,
  `js/state.js`, `js/{world,entities,systems,render,ui,core}/*.js`. Algunos se iban a borrar de todos
  modos; esta vez se borraron a mano y quedaron documentados.

## Qué se conservó (verificado, no asumido)
Regla de miel en tierra sin cavar (test `world-size-rules.js` la comprueba y pasa), nombres evolutivos,
onboarding de 4 pasos, guardado completo + 5 archivadas, calendario/reloj, cofres proporcionales al área,
atlas de texturas 01-12, agua con gravedad, ruler de profundidad.

## Cómo se protegió el trabajo a partir de ahora
1. `git init` en la raíz del workspace y primer commit con el estado saneado
   (`c55bde0`, 1 042 ficheros). Cada bloque de cambios entra con su commit, así que una restauración
   futura se detecta con `git status` y se revierte con `git checkout`.
2. Copia de seguridad a mano en `backups/20261014-0615/` (`index.html`, `app.js`, `style.css`) tomada
   antes de la limpieza y después de los parches de diálogo.
3. Suite de pruebas que pisa el HTML y el JS juntos (`bash test/run-all.sh`, incluido `browser-smoke.js`):
   si el HTML y el JS vuelven a ir de versiones distintas, el test de navegador lo canta
   (pantallas que no aparecen, ids inexistentes, errores de consola).

## Lección para el proyecto
El patrón de "por si acaso" que provocó el bug original (un `<script>` inline de respaldo que duplicaba
el flujo de `app.js`, `bootstrap.js` re-enganchando lo ya enganchado, `?v=` distintos por asset) es
exactamente el que hace que una reversión pase desapercibida. Con **un** dueño del comportamiento y **un**
número de versión, cualquier desfase se ve en cuanto se abre el juego.


## 2ª parte: el día congelado (mismo día, tarde)

Síntoma del dueño: llovía, las hormigas cavaban, pero el reloj de la placa de madera no se movía.

Causa real: no estaba parado el tiempo, estaba parado el **repintado**. `updateColonyUIInner()` tenía
una línea que escribía en `hudSel.style` con la guarda puesta sobre la hormiga seleccionada (`if(sel)`)
y no sobre el nodo del HUD (`#hudSel`, inexistente en este `index.html`). Al seleccionar una hormiga,
aquel `null.style` lanzaba, y como la llamada al reloj vivía **al final** de esa misma función
(`updateCalendarWidget()`), nunca llegaba a ejecutarse: el envoltorio se tragaba el error y el HUD
quedaba a medias para siempre.

Se han tomado tres medidas, en este orden de importancia:

1. **El reloj ya no depende del HUD.** `updateColonyUI()` llama al calendario al final, *después* del
   `catch`, así que se repinta aunque cualquier otro nodo falle. Un adorno roto puede romper un adorno,
   no la hora.
2. **Nada de nodos huérfanos.** El bloque de `hudSel` se guarda con `if(sel && hudSel)` y el aviso del
   `catch` ahora imprime la línea exacta (`e.stack`) en modo `?debug=1`, para que el próximo id que
   falte se señale solo en vez de congelar una pantalla.
3. **x32 y x64 han vuelto, y `setGameSpeed` ya no se rompe.** Estaban referenciados (`k32`) desde la
   reconstrucción sin estar declarados: pulsarlos lanzaba y no cambiaba la velocidad. Ahora los
   botones se repintan por patrón de id (`btnSpeed*`, `btnVel*`, `btnCorner*`), así que añadir o quitar
   un botón del markup no puede dejar una referencia muerta, y `btnTurbo` cicla 1·2·4·8·16·32·64.

Cómo se comprueba: `test/browser-smoke.js` mide la placa de verdad — exige que `#rcTime` y `#timeLabel`
cambien de texto solos con una hormiga seleccionada, y que `setGameSpeed(32)` no lance (27 ok en el
navegador real). Un cambio que vuelva a colgar el reloj se detecta en el primer `bash test/run-all.sh`.

Paquete de publicación: `bash scripts/pack-itch.sh` deja `dist/antfarm-itch-<fecha>.zip` con
`index.html` en la raíz (lo que espera itch.io), verificado byte a byte contra el repo antes de entregar.


## 3ª parte: lo que se recuperó (y el guard que lo vigila)

Dos tardes de reconstrucción sobre lo que se perdió con la reversión del `index.html`:

- **x32 y x64** de vuelta en las dos filas de velocidad, y `setGameSpeed` repintando por patrón de
  id. `⚡ Turbo` cicla 1·2·4·8·16·32·64.
- **Obreras y reinas según el mapa** (`sizeProfile()`): nacen 4 / 5 / 7 obreras en 48×28, 64×36 y
  96×48, y el nido admite 1 / 2 / 3 reinas. Por encima del tope la reina de más **se va al enjambre**
  con aviso visible, no se queda invisible en una cola.
- **Repintado por lotes del caché de suelo**: una calada repinta el lote (más una celda de holgura y
  recorte al borde del lote) en vez de las 4608 celdas del BIG. Medido en el navegador real:
  **0,10 ms frente a 19,20 ms** (x192), y `test/browser-smoke.js` exige que los píxeles del lote
  sean **idénticos** a los de un reconstruido completo (0 px de diferencia, con los montículos de
  tierra por delante). El orden de pintado y la sangre de 1 px del atlas son lo que hace que cuadre.
- **Paquete y enlace**: `scripts/deploy-live.sh` (Vercel sin cuenta / túnel / `--prod`) y
  `scripts/pack-itch.sh`. Los 13,3 MB de texturas que el juego nunca pide se fueron a
  `assets/_archivo/` (movidos, no borrados, con su explicación) y quedan fuera de todo paquete.

### El hallazgo feo que paró el intento anterior

Al mover el atajo al pintor del atlas apareció un `ReferenceError` **dentro** del `try` del
`rebuildSoilCache` reasignado: una edición previa con script se había llevado por delante las
definiciones de `soilRepaintMoundsOver()` y `soilDrawMoundTile()`, dejando las llamadas. El `catch`
se comía el error y cada calada volvía al camino lento, con la suite entera en verde. Dos lecciones:

1. un `catch` que avisa *una sola vez* convierte un fallo permanente en silencio permanente; ahora
   avisa hasta tres y el contador se ve en `?debug=1`;
2. `test/no-orphans.js` recorre `app.js` y exige que **todo ayudante de la casa que se llame esté
   definido** en el propio fichero (ignora CSS dentro de plantillas y sondas `typeof X==='function'`).
   Escribiéndolo salieron tres casos más: `saveIfChanged()` llamado desde `setGameSpeed` (la
   velocidad nunca se guardaba → ahora `serializeSave(true)`) y el botón «+1 día», que llamaba a un
   `updateWorld()` inexistente: el salto de día **solo adelantaba el reloj** mientras el aviso decía
   que las hormigas habían trabajado. Hoy el salto corre `tickStep()` de verdad, guarda la partida al
   terminar y el aviso cuenta los bloques cavados.

Queda pendiente y anotado: `#btnDay1`, `#hudToggle` y `wireChromeUI()` apuntan al **HUD de tiras**
(`.hud-strips`, `#dayControls`, `#cornerControls`), cuyas reglas de estilo siguen vivas en
`css/style.css` con `display:none !important` a la espera del markup. Sin ese HUD el botón de +1 día
no tiene dónde estar: es el siguiente bloque de trabajo.


### 4ª parte (madrugada del 15): el «+1 día» ya excava, y por que no lo hacía

Causa real, leída en `js/app.js:2989`: el progreso de cada calada se multiplica por `gameSpeed`,
**no por `dt`**. El fast-forward aceleraba `dt` y dejaba `gameSpeed=1`, así que las obreras recibían
un golpe de progreso por *frame* durante un día simulado: el reloj corría, el estómago se vaciaba y
la tierra no se movía. Arreglado en dos puntos: `passDays` pone `gameSpeed=16` mientras salta (y lo
devuelve solo si el jugador no lo cambió durante el salto) y subdivide `dt` con el mismo `maxStep`
del bucle principal en vez de dar un bocanada. Medido en Chrome real, día saltado con granja mediana:
antes `celdas abiertas 27 -> 27` y `digs 0`; ahora `27 -> 28..33` y `digs 1..12` según la partida.
No se ha tocado el equilibrio: si un día saltado debe parecerse más a un día a x16, eso es balance y
va con las tiras del HUD.

### 5ª parte: el sandbox se rebobinó y mintio dos veces

A las 18:15 el entorno volvió a un estado anterior: se fueron dos `commit` de `ant-farm-rpg/.git`,
la carpeta `.deploy/` y `dist/live/`, y sobre todo `node_modules` + las librerías de sistema del
Chrome. Con eso `bash test/run-all.sh` dijo **TODO VERDE en 8 segundos** cuando el test de navegador
tarda ~30: sin puppeteer la suite se salta el bloque y no avisa. El código sobrevivió (el árbol
coincidía byte a byte con `snapshots/antfarm-20261014-0826-code.tgz`, de ahí que la copia descargable
haya valido ya para algo), y los commits se re-landearon. Contra el rebobinado queda
`scripts/setup-sandbox.sh`: reinstala dependencias y librerías y **exige que Chrome arranque de
verdad** antes de dejar que la suite diga nada. Lección: un test que se salta en silencio vale cero,
igual que la aserción de píxeles que comparaba full contra full.

El salto «+1 día» (`passDays`) ahora corre `tickStep()` de verdad: el día avanza, la comida baja y
la partida se guarda al terminar (verificado contra la URL pública: día 1→2, comida 12→6, guardado
de 57 KB). **Pero en ese día fast-forward no se abrió ni una celda nueva (27 → 27 celdas abiertas)**,
o sea las obreras no excavaron. Queda como tarea propia: la calada de un ant depende de que alguien le
asigne `digTarget`, y ese reparto parece mirar el número de *frames* y no el tiempo de juego, que es lo
que el salto acelera. No se tapa con un aviso: mientras no sepa por qué, el botón no vuelve al HUD.
