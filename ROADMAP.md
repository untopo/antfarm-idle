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
| 0.2 | **Al crear una granja nueva quedan residuos del mundo anterior.** La limpieza del mundo fresco se olvidaba de lo que vive *fuera* del `soil`: `wastePiles` (montículos de residuo), `fungusGardens`, `structures` y el agua de las celdas. Ahora se vacían ahí mismo, y los montículos ya no pueden crecer sin tope (ver 0.9). | `node test/create-farm-flow.js` (28 ok) y `node test/save-roundtrip.js`; el creador de mundos deja `wastePiles/fungusGardens/structures` a 0 y `water` limpio. | ✅ |
| 0.3 | **Las obreras alcanzan materiales a través de las paredes.** Un objetivo se acepta por distancia euclídea, así que la miel o el hongo «al otro lado de la roca» se puede ir a buscar sin túnel. Hay que exigir camino real (conectividad de celdas) y que los escombros respeten la gravedad: nada de polvo apoyado en celdas que no han sido excavadas. | Test: miel tras un muro sin galería → `ruta: null` y nadie la carga; abrir la galería → pasa a `alcanzable`. Y en cada frame, todo residuo con celda de apoyo sólida por debajo debe caer. | ⏳ |
| 0.4 | **El área clickeable de una hormiga es demasiado grande**: se selecciona con el ratón a varios píxeles de distancia, lo que impide cliccar justo al lado de ellas. Debe ser el cuerpo del sprite (y en pantalla, el aura de selección tiene que coincidir con lo que se puede tocar). | Test de navegador: click a 9–12 px del centro (fuera del sprite) no selecciona; click sobre el abdomen sí. Y el oráculo `elementFromPoint` coincide con la selección. | ⏳ |
| 0.5 | **El perfil de la hormiga sale con un cuadro naranja en vez de su retrato**, y hay que revisar el orden/datos del perfil de obrera y del de la reina. | Test de navegador: abrir perfil de una obrera y de la reina y exigir que el lienzo del retrato tenga píxeles dibujados del atlas (no un rectángulo plano) y que las filas del perfil estén alineadas. | ⏳ |
| 0.6 | **Los primeros días no arrancaban**: la primera camada no podía nacer. En GEN0 nadie es NODRIZA (los roles llegan con la jerarquía, que pide gen≥2 e IQ≥112) y la regla vieja **solo** dejaba alimentar a nodrizas y mínims, así que toda larva moría de hambre; la colonia no podía nacerse a sí misma. Además la miel del mapa estaba arriba y las fundadoras se quedaban en el túnel sin entregar nada, la reina no pone con la despensa bajo 3, y el coste de criar se cobraba por intento aleatorio (decenas de veces por frame) en vez de por crecimiento: se comía el granero entero en un día. | `node test/foundacion-dias.js`: crea el mundo y deja correr el bucle real 2,5-3 días; exige entregas, despensa sobre el umbral, huevo→larva→pupa y **una obrera nueva sin ayuda**. Y `node test/brood-hatch.js`: 11 casos de la camada (reina criando sola, cualquier obrera con buche, coste proporcional, tope de cámara). | ✅ |
| 0.7 | **Ritmo de forrajeo: medido y encauzado, queda el tramo largo.** Con el enrutado por galerías y la cosecha del jardín (0.9) la página real entrega 11 porciones el día 1 y la despensa se mueve 9-35 en vez de clavarse en 1-2. Lo que queda: cuando el nido se muda hondo, cada ida a la miel son ~350 px de subida y las entregas caen a 0 durante media jornada (día 4: `entregas 13` congelado mientras cavan 137 bloques). Candidatos: despensa intermedia en la boca del túnel, miel que brota también en cámara alta, o relevo tipo tándem. | `node test/diag-pipeline.js 3` y `node test/diag-atasco.js 6` (por hormiga: estado, pasos bloqueados, si hay ruta por galería) antes y después de cada cambio. | ⏳ |
| 0.8 | **El contador de obreras titilaba 0/1**: con la colonia a cero y la reina viva, `_updateBothAntCounts` metía un «fallback» de 1, mientras el resto de la UI escribía 0 en su turno. El letrero dice OBRERAS ACTIVAS, así que ese 1 estaba mal. | Caso 10 de `test/brood-hatch.js`: leídos los tres sitios (`velAntCount`, `calAntCount`, `tbPop`) tienen que decir 0 con 0 obreras y el valor real al volver. | ✅ |

| 0.9 | **La colonia se paraba al día 4-5 y no nacía nadie** (la queja «de resto siguen sin nacer»). Tres causas medidas, no adivinadas: (1) una forrajera clavada contra una pared no tenía forma de salir — 830, 1888 y hasta **2536 pasos bloqueados** seguidos, seis a la vez paradas en la misma galeria, cero excavación y cero entregas; (2) el **jardín de hongo**, que en una cortahojas es la despensa real, nunca producía: exigía un rol NODRIZA/minim a 38 px (papel que no existe hasta GEN2 + IQ112) y gastar fibra, así que los jardines se apagaban y todo dependía de subir a la superficie; (3) la basura sin control: 24-27 montículos en un nido pequeño, que recortaban el tope de población (×0.72) y enfermaban la cría. | `routeStep()` (BFS por celdas abiertas, solo cuando hay atasco) + una obrera con 70 pasos bloqueados suelta el bocado y se pone a cavar; el jardín lo cuida cualquier obrera y echa una gota cosechable que viaja por la misma ruta que la miel; `addWaste()` une montículos cercanos y los topa por tamaño de mundo. | ✅ |
| 0.10 | **Abrían un cráter arriba y las plantas colgaban del aire** (captura del dueño). Cualquier calada en la fila del césped, y el desprendimiento aleatorio de vecinos, abrían boca nuevas: la exposición y las setos flotantes salían de ahí. Ahora la fila del césped solo cede en la **columna de la entrada y sus dos vecinas** (3 columnas, las que ya abre `initSoil`), el sitio elegido se **respeta al recargar** (`detectarEntrada()` en creación y en `topoResumeGame`), una planta sin suelo debajo se cae y un hongo de cueva exige techo de verdad. | `node test/entrada-guarda.js` (9 ok: boca `[23,24,25]` tras dos días de bucle real, 0 plantas colgando de 42, 0 hongos sin techo, y el predicado rechaza cavar a 9 columnas de la entrada). | ✅ |
| 0.11 | **Falta el selector de entrada y el blindaje pedido en su propuesta de mundo.** El dueño quiere empezar **sin ningún túnel**, que al crear el mundo se pregunte **dónde va la entrada**, y que esa fila sea **indestructible**. El blindaje ya está (0.10); la siembra sigue abriendo el pozo de 3 columnas y el paso por la pregunta no existe todavía. | ❓ Decisión de flujo: ¿se elige la columna sobre la hierba antes de confirmar (con la rejilla y la boca resaltada) o se deja en el centro y se cambia desde «Ajustes del mundo»? |

## P1 · Rendimiento y opciones en vivo

| # | Qué pasa | Cómo se verifica | Estado |
|---|---|---|---|
| 1.1 | **Empieza a ir a tirones muy pronto.** Falta medir de verdad cuánto cuesta cada subsistema (render del terreno, texturas, partículas, clima, hormigas, historial/UI) y por tamaño de mundo y población. | `node test/world-perf-driver.js small\|medium\|big` ampliado a ms/frame por subsistema, con el `app.js` real, más un umbral por tamaño. | ⏳ |
| 1.2 | **Menú de opciones de rendimiento aplicables sin recargar**, para equipos modestos: resolución interna (0.75×/1×/1.5×), texturas del terreno on/off, partículas y salpicaduras, clima (lluvia/nieve), brillo/sol, nubes, densidad de hormigas dibujadas (más allá del tope abstracto), sombra de la madera, animación de la hierba, y límite de frames (30/60). Todo en `localStorage`, todo en caliente, con un botón «una pasada de rendimiento» que elija solo. | Test: cambiar cada opción en vivo no lanza errores, el `fps` medido sube al bajar calidad, y al recargar la preferencia sigue. | ⏳ |
| 1.3 | **¿Se queda el botón +1 DÍA?** Simula un día entero de una sentada. **Medido en Chromium real en esta máquina: 52-261 s de reloj por día** según cuántas obreras y crías haya (el salto pone la simulación a x16 y corre el día completo; no pinta, pero sí mueve todo el enjambre). Con colonia grande va a ser peor. Opciones: (a) dejarlo por tramos con presupuesto de tiempo (p. ej. salta hasta 4 h de reloj por clic y se puede encadenar), (b) que salte solo el reloj, la comida y la cría sin simular el túnel, (c) quitarlo y dejar x64. Ninguna es gratis: (a) es la más honesta con lo que ya existe. | ❓ Decisión del dueño; mientras tanto sigue donde está (fila de obreras, bajo el reloj) y con su prueba de que el click real lo alcanza. |

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
node test/diag-cria.js 8        # economía de cría por media jornada (despensa, tope, excavación, basura)
node test/diag-atasco.js 6      # por hormiga: estado, pasos bloqueados, si hay ruta por galería
node test/diag-muertes.js 8     # de qué se mueren y cuánto viven (vejez vs hambre)
node test/live-colonia.js 6     # la queja en Chrome real: crea la granja, corre 6 días, exige nacimientos
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
| 2026-10-15 · tarde | Desatascado el ciclo completo: enrutado por galerías cuando hay atasco (`routeStep`), fuga del atasco (soltar el bocado y cavar), cosecha del jardín fúngico por cualquier obrera y montículos de residuo unidos y topados, y la boca del nido estrecha y respetada con plantas/hongos sin flotar. En el harness la colonia pasa de 4 a **13-17 obreras en 7-8 días** con partos continuos (21 puestas) y muertes sólo por vejez (las obreras viven 3,8-5,5 días por diseño); en Chrome real, por el camino del usuario: día 4 con **8 obreras**, cría en 3 etapas, 137 bloques cavados, boca de 3 columnas y 0 errores de JS. | `test/foundacion-dias.js` 7 ok · `test/entrada-guarda.js` 9 ok · `test/brood-hatch.js` 11 ok · `test/live-colonia.js` (Chromium) · `test/diag-cria.js`, `test/diag-atasco.js`, `test/diag-muertes.js` para repetir la medición |
