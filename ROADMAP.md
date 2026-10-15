# Roadmap de trabajo

Registro público de todo lo que está pendiente en **Ant Farm RPG — Granja de Topo**. Cada línea es
un paso pequeño y verificable: se documenta, se arregla, se comprueba y se sube. Nada se queda en
el tintero y nada se da por hecho sin su prueba.

**Cómo se lee el estado**

| Marca | Significa |
|---|---|
| ✅ | hecho y con prueba que lo sostiene |
| 🔧 | en curso ahora mismo |
|  | apuntado, sin empezar |
| ❓ | necesita una decisión del dueño antes de programarse |

---

## P0 · El juego se rompe o engaña

| # | Qué pasa | Cómo se verifica | Estado |
|---|---|---|---|
| 0.1 | **La cría nunca nace si la colonia se queda sin reinas.** El nacimiento pedía la posición de `queens[0]`; sin reinas vivas el error reventaba el paso de simulación y los huevos seguían madurando en pantalla mientras el contador de hormigas se quedaba en 0 para siempre. Afectaba también a las larvas sin coordenadas, a la puesta de emergencia y a la higiene del basurero. | `node test/brood-hatch.js` (7 casos, DOM de juguete + el `app.js` real). Pasa con el arreglo y falla contra el archivo anterior con `TypeError: Cannot read properties of undefined`. | ✅ |
| 0.2 | **Al crear una granja nueva quedan residuos del mundo anterior** (túneles ya excavados, escombros, comida tirada) sobre el mapa recién archivado. El mundo nuevo debe nacer limpio, no solo con el save reemplazado. | Test: crear granja, excavar, archivar, crear otra y exigir `soil` intacto y `hiddenRewards/mound/particles/pheromones` vacíos en el mundo nuevo. | ⏳ |
| 0.3 | **Las obreras alcanzan materiales a través de las paredes.** Un objetivo se acepta por distancia euclídea, así que la miel o el hongo «al otro lado de la roca» se puede ir a buscar sin túnel. Hay que exigir camino real (conectividad de celdas) y que los escombros respeten la gravedad: nada de polvo apoyado en celdas que no han sido excavadas. | Test: miel tras un muro sin galería → `ruta: null` y nadie la carga; abrir la galería → pasa a `alcanzable`. Y en cada frame, todo residuo con celda de apoyo sólida por debajo debe caer. | ⏳ |
| 0.4 | **El área clickeable de una hormiga es demasiado grande**: se selecciona con el ratón a varios píxeles de distancia, lo que impide cliccar justo al lado de ellas. Debe ser el cuerpo del sprite (y en pantalla, el aura de selección tiene que coincidir con lo que se puede tocar). | Test de navegador: click a 9–12 px del centro (fuera del sprite) no selecciona; click sobre el abdomen sí. Y el oráculo `elementFromPoint` coincide con la selección. | ⏳ |
| 0.5 | **El perfil de la hormiga sale con un cuadro naranja en vez de su retrato**, y hay que revisar el orden/datos del perfil de obrera y del de la reina. | Test de navegador: abrir perfil de una obrera y de la reina y exigir que el lienzo del retrato tenga píxeles dibujados del atlas (no un rectángulo plano) y que las filas del perfil estén alineadas. | ⏳ |
| 0.6 | **Los primeros días no arrancaban**: la primera camada no podía nacer. En GEN0 nadie es NODRIZA (los roles llegan con la jerarquía, que pide gen≥2 e IQ≥112) y la regla vieja **solo** dejaba alimentar a nodrizas y mínims, así que toda larva moría de hambre; la colonia no podía nacerse a sí misma. Además la miel del mapa estaba arriba y las fundadoras se quedaban en el túnel sin entregar nada, la reina no pone con la despensa bajo 3, y el coste de criar se cobraba por intento aleatorio (decenas de veces por frame) en vez de por crecimiento: se comía el granero entero en un día. | `node test/foundacion-dias.js`: crea el mundo y deja correr el bucle real 2,5-3 días; exige entregas, despensa sobre el umbral, huevo→larva→pupa y **una obrera nueva sin ayuda**. Y `node test/brood-hatch.js`: 11 casos de la camada (reina criando sola, cualquier obrera con buche, coste proporcional, tope de cámara). | ✅ |
| 0.7 | **Ritmo de forrajeo todavía flojo**: 3-4 entregas en 3 días; la despensa oscila 2-17 y la puesta se raciona sola al bajar de 5. Con mundo grande y colonia de 10+ esto no da. Queda medido y acotado (el impulso de hambre ahora solo moviliza a **media** colonia, para que la otra media siga cavando), pero hay que medir la ruta (boca del túnel, radio de sensor 90 px, velocidad de paseo) y decidir si la miel aparece más cerca, si las obreras salen en grupo o si la puesta baja de ritmo. | `node test/diag-pipeline.js 3` (entregas/día, dónde están las obreras, estado del túnel) antes y después del cambio. | ⏳ |
| 0.8 | **El contador de obreras titilaba 0/1**: con la colonia a cero y la reina viva, `_updateBothAntCounts` metía un «fallback» de 1, mientras el resto de la UI escribía 0 en su turno. El letrero dice OBRERAS ACTIVAS, así que ese 1 estaba mal. | Caso 10 de `test/brood-hatch.js`: leídos los tres sitios (`velAntCount`, `calAntCount`, `tbPop`) tienen que decir 0 con 0 obreras y el valor real al volver. | ✅ |

## P1 · Rendimiento y opciones en vivo

| # | Qué pasa | Cómo se verifica | Estado |
|---|---|---|---|
| 1.1 | **Empieza a ir a tirones muy pronto.** Falta medir de verdad cuánto cuesta cada subsistema (render del terreno, texturas, partículas, clima, hormigas, historial/UI) y por tamaño de mundo y población. | `node test/world-perf-driver.js small\|medium\|big` ampliado a ms/frame por subsistema, con el `app.js` real, más un umbral por tamaño. | ⏳ |
| 1.2 | **Menú de opciones de rendimiento aplicables sin recargar**, para equipos modestos: resolución interna (0.75×/1×/1.5×), texturas del terreno on/off, partículas y salpicaduras, clima (lluvia/nieve), brillo/sol, nubes, densidad de hormigas dibujadas (más allá del tope abstracto), sombra de la madera, animación de la hierba, y límite de frames (30/60). Todo en `localStorage`, todo en caliente, con un botón «una pasada de rendimiento» que elija solo. | Test: cambiar cada opción en vivo no lanza errores, el `fps` medido sube al bajar calidad, y al recargar la preferencia sigue. | ⏳ |
| 1.3 | **¿Se queda el botón +1 DÍA?** Simula un día entero de una sentada; en el navegador de pruebas tardó entre 23 y 237 s según la carga. Opciones: dejarlo por tramos con presupuesto de tiempo, hacer que salte solo el reloj y la comida (sin simular el túnel), o quitarlo. | ❓ Decisión del dueño; mientras tanto sigue donde está (fila de obreras, bajo el reloj) y con su prueba de que el click real lo alcanza. |

## P2 · Flujo de menús, siembra y calendario

| # | Qué pasa | Cómo se verifica | Estado |
|---|---|---|---|
| 2.1 | **No hay forma de volver al menú principal desde dentro de la granja.** Debe existir una salida clara: `⌂ MENÚ`, que permita crear otra granja, borrar la actual o entrar a «Archivadas» para recuperar cualquiera. | Test: desde dentro del juego, abrir menú, ir a Archivadas, cargar otra y que el mundo cambie; y «borrar» deje el juego en la pantalla de inicio sin rastro. | ⏳ |
| 2.2 | **Colocar miel y feromonas obliga a recorrer la pantalla** y se va soltando por todos lados. Hace falta un modo intención: elegir la herramienta, ver una rejilla/anda over, clicar (o arrastrar en línea recta) y que se deposite solo en las celdas marcadas, con contador y deshacer. | Test: elegir «MIEL», arrastrar sobre 6 celdas de una galería → 6 gotas exactas y ninguna fuera de galería; con «FEROMONA» igual, y `⌫` revierte. | ⏳ |
| 2.3 | **El almanaque que se abre al clicar el reloj** es funcional pero está fuera del arte del panel. Se redibuja con la misma madera, panal y tipografía pixel del reloj (borde 4 px, sin degradados suaves, iconos del atlas). | Captura comparada del modal con la paleta y el grosor de trazo del reloj; y `node test/browser-smoke.js` sigue sin errores de JS al abrirlo/cerrarlo con Escape. | ⏳ |
| 2.4 | La Extinción debe decirlo: si no queda ninguna hormiga viva y la cría no sale, el juego tiene que avisar en vez de dejar el contador en 0 en silencio. | Notificación «COLONIA EN PELIGRO» + narración con lo que falta (nodrizas, espacio, comida). | ⏳ |

## P3 · Casa y vitrina

| # | Qué pasa | Cómo se verifica | Estado |
|---|---|---|---|
| 3.1 | **README profesional**: qué es el juego, todo lo que se puede hacer (mundos, clima, cría, genética, facciones, religión/inventos, comercio, economía, menú, opciones), cómo se juega y cómo se construye. Tono neutro, sin voz de personaje. | Que un lector nuevo sepa qué esperar sin abrir el código; un contribuidor único en «Autor». | ⏳ |
| 3.2 | **Limpiar el repositorio**: texturas duplicadas por iteración (`categoria_01_platformer_pisos_CORRECT/_FINAL/_FINAL2/_FIXED/_FIXED2/_NEON/_SB/_TEST`), `uploads/`, `mockups/` y `designs/` con capturas de trabajo, documentos de estudio que ya no guían nada y scripts de despliegue muertos. Dejar solo lo que carga el juego o lo que explica el proyecto. | Inventario antes/después con `git ls-files` y `du -sh`; el juego sirve igual y la suite sigue verde. | ⏳ |
| 3.3 | **Copia descargable en cada hito** (`antfarm-idle-*.zip` del juego completo) para probar fuera del navegador. | Abrir el zip en una carpeta vacía y que la granja arranque. | ✅ cada hito |
| 3.4 | Publicar en itch.io como vitrina opcional (el navegador sigue siendo la demo oficial). | `bash scripts/pack-itch.sh` + subida manual cuando haya cuenta. | ❓ |

---

## Pruebas del proyecto

```bash
bash test/run-all.sh            # todo: sintaxis, creación, tamaños, cría, fundación, save, navegador real
node test/brood-hatch.js        # camada: huevo → larva → pupa → nace (con reina, sin reina, costes)
node test/foundacion-dias.js    # los 3 primeros días: la colonia se alimenta, cría y nace sola
node test/no-orphans.js         # ninguna llamada a funciones que no existen
node test/world-size-rules.js   # reglas y coste por tamaño de mundo

# diagnostico (no forman parte del verde; sirven para mirar sin adivinar)
node test/diag-pipeline.js 3    # entregas, despensa, dónde están las obreras, estado del túnel
node test/diag-colonia.js 5     # la colonia día a día: cría por etapa, hambre, muertes
```

`test/world-perf-proflib.js` ejecuta el `app.js` real en un DOM de juguete y acepta `APP_JS=otro.js`
para poder contrastar una versión vieja contra una nueva con el mismo test.

El lote de navegador (`test/browser-smoke.js`) abre Chromium real y **tarda minutos**: simula días
enteros y espera a que el juego termine solo. Para un paso pequeño, correr solo el test que toca y
dejar el lote completo para el cierre del hito.

---

## Registro

| Cuándo | Qué se cerró | Prueba |
|---|---|---|
| 2026-10-14 | La demo queda jugable en el navegador y el `+1 DÍA` se mueve a la barra que ya existe (fuera de tiras duplicadas sobre el reloj). | `test/browser-smoke.js` (38 ok en Chromium real) |
| 2026-10-15 · madrugada | Nacer sin reina: `broodAnchor()` (reina → enjambre → centro del nido), huevos de emergencia con posición, jardín y basurero sin depender de `queens[0]`, pupa real que funda dinastía. | `test/brood-hatch.js` (7 ok; falla 4 contra el archivo anterior con el `TypeError` exacto) |
| 2026-10-15 · mañana | Fundación desbloqueada: la reina cría sola (fundación claustral) y cualquier obrera con buche regurgita; coste de criar proporcional al crecimiento; puesta racionada por despensa y por sitio en la cámara de cría (`broodSlots`); provisiones dentro del nido al crear el mundo; punto de paso por la boca del túnel al salir a por miel; despensa de inicio 12+ y superficie reabastecida según el tamaño de la colonia; contador de obreras sin el «1» fantasma. | `test/foundacion-dias.js` (6 ok: 4 → 6-7 obreras en 3 días, dos pasadas) + `test/brood-hatch.js` (11 ok) |
| 2026-10-15 · mediodía | Regulado para que comer y cavar no compitan: el impulso de hambre sólo moviliza a media colonia (paridad por id, sin recorrer el array por paso) y el umbral baja a 5. Añadido al test de fundación la exigencia de que sigan cavando, y arreglada la fuga de memoria del DOM de juguete (800 KB/frame: el árbol de hijos no tenía tope) que reventaba el lote. | `test/foundacion-dias.js` 7 ok en 3 pasadas · `test/brood-hatch.js` 11 ok · `test/browser-smoke.js` 38 ok en Chromium real |
