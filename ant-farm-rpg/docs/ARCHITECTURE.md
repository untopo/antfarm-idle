# Arquitectura — Ant Farm RPG
Actualizado: 2026-10-14 (mide sobre el `js/app.js` del repo, no sobre una versión anterior).

## Mapa del fichero único

`js/app.js` es un script global; estas son sus regiones (líneas aproximadas del estado actual):

```
    1-  60  sprites y banderas de carga · HUD helpers tolerantes (hudText/hudHtml/hudStyle/hudValue)
   19-  23  DEBUG_TOPO + tlog()          <- silencio por defecto, ?debug=1 lo enciende
  182- 610  MUNDO VIVO · estructuras · expansión por excavación · ruler de profundidad
  610-1030  agua con gravedad, pasto que se expande, caída de suelo suelto
 1033-1105  DIÁLOGOS PROPIOS (gameDialog) + CONTROLES DEL CHROME (wireChromeUI)
 1148-1220  genoma: clone/mutate/crossover · edad de la reina por lenguaje
 1490-1560  SISTEMA DE NOMBRES (genPersonalName, renombre evolutivo por colonia)
 1620-1740  makeAnt + topoCreateFreshWorld (siembra del mundo) + exponer en window
 1795-1900  historial de eventos (drawer) y pushEvent
 2000-3000  reina, cría, sociedad, facciones, guerra, economía de la despensa
 3000-3300  excavadora: findFrontier, caché del suelo, decoración de arquitectas
 3322-3620  TEXTURAS / ATLAS (superficies, vegetación, alimentos, estructuras, señales, clima, UI)
 3620-4400  drawFarm: suelo, cofres (con su '?' pintado, sin burbuja flotante), cría, partículas
 5100-5600  bucle principal, pausas, velocidades · updateColonyUI (ahora imposible de tumbar)
 6206-6280  ONBOARDING (4 pasos, '¡A JUGAR!')
 6527-6900  CALENDARIO DE LA COLONIA y reloj
 7050-7300  GUARDADO: SAVE_KEY, serializeSave/deserializeSave, archivado de granjas, _topoDbg
 7294-7640  FLOW TOPO: splash → menú → crear/cargar/ajustes/créditos → onboarding (dueño único)
```

## Contrato del flujo de creación (lo que no se puede romper)

```
[splash] --1.9 s--> [menú] --CREAR NUEVA GRANJA--> [elegir tamaño] --click + gameConfirm si hay save-->
   topoBeginCreate(size, {cols,rows})
     · guarda antfarm_worldSize(_cols/_rows/createdAt)
     · hideAll()  <- oculta splash y menú además de las pantallas
     · worldGenScreen: 5 pasos con stepMs = clamp(cells/9, 120, 430)
     · al terminar: topoCreateFreshWorld(cols,rows)  ->  serializeSave(true)  ->  archivar la anterior
       -> topoRefreshContinueBtn() -> onboarding
     · cualquier excepción: topoGenFail() oculta la pantalla de carga y muestra un aviso con reintento
     · watchdog: si los pasos se cortan (pestaña en segundo plano), a stepMs*5 + 12 s también avisa
   todo el bloque protegido por _topoCreating (3 clicks seguidos = 1 generación)
```

Reglas duras:
- El mundo **no existe** antes de elegir tamaño: `initSoil`, siembra de comida, obreras y tesoros están
  diferidos (ver logs `[TOPO] ... diferido` con `?debug=1`).
- Ningún `confirm()`/`alert()` del navegador: devuelven `false` en iframes `sandbox` sin `allow-modals`
  y en varios móviles → "no pasa nada" sin error. `test/browser-smoke.js` corre dentro de ese iframe.
- `document.addEventListener('click', …)` delegado solo actúa si `!e.defaultPrevented`, para no
  duplicar el despacho del listener directo de cada botón.

## Guardado

| Clave | Contenido |
|-------|-----------|
| `antFarm_fullSave_v2` (`SAVE_KEY`) | la granja activa: suelo, agua, colonia, economía, mundo (`COLS/ROWS`), día/tiempo |
| `antfarm_worldAlive` / `antfarm_inGame` | hay granja / entrar directamente al cargar |
| `antfarm_farms` | hasta 5 granjas archivadas (etiqueta + save completo) |
| `antfarm_time`, `antfarm_lastReal` | reloj y avance offline |
| `antfarm_worldSize(_cols/_rows)` | tamaño elegido, para reabrir el mismo mundo |
| `antfarm_debug` | `'1'` enciende `tlog` |

`serializeSave(force)` aborta si la firma `time|digs|colonyFood|workers|deliveries|_soilRev` no cambió
y no se forcejea; `force=true` se usa al terminar la siembra, antes del onboarding, para que recargar
no borre la granja. BIG ≈ 47 KB. `window._clearSave()` borra todo y recarga.

## HUD tolerante

`hudText/hudHtml/hudStyle/hudValue` ignoran ids que no existen. `updateColonyUI` envuelve su cuerpo en
un `try/catch` (log only con `DEBUG_TOPO`). Motivo: el bucle moría cada frame con
`Cannot set properties of null` porque la función escribía en ids que el HTML ya no tenía; un nodo de
HUD ausente no puede parar la simulación.

## Cache del suelo y `decoSet`

- `rebuildSoilCache()` recorre el mapa completo; las constantes de cuadro (estación, clima húmedo) se
  calculan **una vez por reconstrucción**, no por celda.
- Las celdas decoradas se guardan con clave numérica `dkey(c,r) = (r<<12)|c`; `hasDeco(c,r)` sale
  inmediatamente si `decoSet` está vacío. Antes se creaba una cadena `'c,r'` por celda pintada.
- Mejora pendiente (ver `docs/JUGABILIDAD.md` §5.5): repaint solo del rectángulo sucio o atlas de recortes.

## Deuda conocida

- `COLS/ROWS` tienen un default 64×36 en el código; el suelo está diferido pero los números existen.
- `index.html` conserva `#hudToggle` (`display:none`) y `wireChromeUI()` busca tiras (`.hud-strips`,
  `#dayControls`, `#cornerControls`) que no existen en esta revisión del HTML.
- 4 sprites referenciados no están en `assets/` (404) → las hormigas se dibujan a mano.
- Sin audio, sin punteros táctiles, sin persistencia de ajustes (ver el reporte de jugabilidad).
- Faltan `x32/x64` en la tira de velocidades y las reglas de reinas/obreras por tamaño.
