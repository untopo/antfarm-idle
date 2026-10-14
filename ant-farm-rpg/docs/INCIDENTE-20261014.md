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
