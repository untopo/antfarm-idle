# ANT FARM — granja de hormigas pixel

Simulador de colonia en 16-bits: túneles que se cavan, miel que se almacena, reinas con nombre propio
y una colonia que evoluciona (genoma, IQ, idioma) mientras la miras.

## Arrancar

```bash
node dev-server.js 8017      # raiz: ant-farm-rpg/, sin cache (Cache-Control: no-store)
# abrir http://localhost:8017/
```

Servir con `no-store` importa: con HTML nuevo y `app.js` de la cache vieja el juego se comporta de
forma distinta a como está escrito y no se puede depurar. `index.html`, `css/style.css` y los assets
llevan **un solo** `?v=` (`20261021n`); al tocar CSS o JS se sube en todos los sitios a la vez.

Depuración: `?debug=1` en la URL (o `localStorage.antfarm_debug='1'`) enciende el registro del juego
(`tlog`) que está callado por defecto. En la consola: `_topoDbg()` devuelve día, obreras, comida,
dimensiones y si está pausado.

## Build N: perfiles legibles de un vistazo

La lista de la colonia ya responde sólo a tres preguntas: quién es, qué hace y cómo está. Conserva un único
filtro útil (`ALL / QUEENS / WORKERS`) y retira edad, generación, barras repetidas y accesos que duplicaban la
ficha. Los perfiles de obreras y reina dejan de ser pequeños paneles de depuración: no hay pestañas, árbol,
«cerebro» visual, ADN ni historial individual. La simulación de rasgos, experiencia y linaje sigue intacta,
pero se expresa en lenguaje normal mediante tarea y condición actuales.

Cada ficha ofrece únicamente decisiones inmediatas: localizar o exiliar una obrera; localizar, alimentar o
reubicar a la reina cuando corresponde. El progreso del huevo permanece porque cambia la decisión de alimentar,
y esa acción declara antes del clic su coste y efecto. La hoja usa un solo desplazamiento vertical, mantiene sus
acciones alcanzables en una ventana baja y cabe completa en móvil sin crear menús nuevos ni abrir `COLONIA` o
`HISTORIAL`.

## Build M: vuelo nupcial y salida física

Las fundadoras ya salen por la boca visible, recogen en el prado y vuelven alineándose con un labio abierto
antes de descender; no hay teletransporte ni asignación manual de oficio. Cada salida lleva un marcador verde
que sigue al cuerpo real, y la entrega sólo entra al ledger después del regreso físico. Una pionera profundiza
en cada banda mientras exploradoras emergentes abren ambos lados y suben físicamente el escombro. La cantería
profunda se aprende de verdad en GEN6 + IQ145 + piedra/arcilla, y ocho losas consecutivas expanden los tres
tamaños sin un fondo fijo. `DROP HONEY` es una herramienta de un solo uso y `FOLLOW TRAIL` se dibuja por arrastre.

Los materiales ya no desaparecen por iniciativa de la simulación. `NEST STORES` separa **TOTAL / COMMITTED /
AVAILABLE**, mantiene `KEEP` como reserva y ofrece tres adaptaciones corporales: mandíbulas con filo de piedra,
ataduras de carga de fibra y garras delanteras con agarre de arcilla. Cada clic muestra coste, efecto y
`ADAPTED / ELIGIBLE`, paga sólo stock disponible y deja que rasgos, experiencia y necesidad elijan a la obrera;
nunca se asigna un individuo a mano. Los `pick/basket/trowel` de guardados anteriores migran a esas adaptaciones
sin perder su bonus y dejan de dibujarse. Puentes, talleres y torres automáticos están retirados: los únicos
sumideros de material son esta aprobación y los proyectos funcionales que el jugador inicia con efecto explícito.

El primer reinicio incremental vive en `core/lineage.js`: una losa rota más una reina viva habilitan el
**NUPTIAL FLIGHT**. Su fórmula de ámbar conserva precisión completa, una confirmación enumera lo que se
reinicia y una nueva semilla crea otro nido físico. Sólo persisten ámbar ganado jugando, cuatro mejoras
finitas, vuelos, mejores marcas y reliquias. Una única cortina voxel bajo el calendario sirve de puerta,
tienda y explicación, sin abrir `COLONIA` ni `HISTORIAL`.

## Build L: recibo de regreso

Al volver mediante `CONTINUE` o desde una pestaña oculta, un único diálogo consume el informe offline ya
liquidado. Enseña tiempo contado y descartado por el tope, flujos físicos, cría/trabajos, el cuello que
paró el avance y exactamente dos sugerencias de observación. Esas sugerencias sólo abren `NEST STORES` o
centran la cámara; no inician proyectos ni asignan decisiones. Los sellos presentados y una cola breve de
recibos pendientes se guardan con la granja para que ni la simulación ni la pantalla se repitan.

## Build H: presión de almacén

La cifra de comida es la reserva **protegida** y nunca puede superar la capacidad física operativa
(del alijo finito de fundación mientras se levanta el primer almacén, y de sus estantes después).
Lo que no cabe queda como una pila tipada junto al nodo de descarga: bayas/hongos/manzanas se pudren,
mientras miel y semillas mantienen sus reglas. Al liberarse un hueco, el excedente adyacente vuelve a
los estantes; un `FORWARD CACHE` inundado o desconectado pierde sus seis plazas y materializa allí mismo
lo que protegía. La hoja `NEST STORES → COLONY PROJECTS` reutiliza su medidor para mostrar protegido,
capacidad y overflow, sin crear otra moneda o panel. Si el almacén se pierde físicamente, la colonia
sólo puede mantener las cinco raciones vitales en sus buches sociales mientras reconstruye; el resto
vuelve al mundo como excedente en el punto del fallo.

## Estructura real (lo que hay en el disco)

```
ant-farm-rpg/
├── index.html          ~940 líneas · pantallas (splash, menú, tamaños, cargar, ajustes, créditos,
│                       onboarding, siembra), HUD, un único <script> inline: el vigía de arranque
├── css/style.css       tema del juego; css/startup.css contiene la familia voxel responsive de entrada
├── js/app.js           ~11 000 líneas · motor de mundo, colonia, almacén y UI
├── js/texture-pack.js  runtime del atlas: nombres estables, pivotes, nearest-neighbour y fallback
├── core/lineage.js     núcleo puro: fórmula, recibos, saldo y cuatro mejoras finitas de ámbar
├── assets/textures/colony-atlas.{png,json,manifest.js} · hoja única de 80 objetos voxel reutilizables
├── scripts/generate-colony-atlas.py · fuente determinista de la hoja y ambos manifiestos
└── docs/
    ├── ARCHITECTURE.md    contrato del flujo de creación, guardado, helpers de HUD
    ├── TEXTURE_PACK.md    catálogo completo y procedimiento para añadir sprites sin coordenadas
    ├── JUGABILIDAD.md     reporte: qué falta, qué está mal, plan para calificar de jugable
    ├── INVENTARIO_GRAFICO.md · TEXTURAS_DEFINITIVAS.md
    ├── INCIDENTE-20261014.md   reversión de ficheros y qué se perdió
    └── notas/             investigaciones sueltas (física, matemática de colonia, playtests)
test/                   pruebas de node + smoke en Chrome (ver abajo)
screenshots/            capturas que deja el test de navegador (evidencia)
backups/20261014-0615/  instantánea de index.html/app.js/style.css antes de la limpieza
```

`js/app.js` es un único script global a propósito: no hay bundler ni `import`, el save vive en
`localStorage` y cualquier cambio se ve al recargar. Cuando crezca de verdad se parte en módulos
(ESM con `type="module"`), no antes: hoy partirlo sería mover líneas sin ganar nada.

## Pruebas

```bash
bash test/run-all.sh          # node puro + Chrome si hay puppeteer
node test/browser-smoke.js    # solo el navegador real (creación, iframe sandbox, canvas pintado)
```

| Test | Qué garantiza |
|------|---------------|
| `test/create-farm-flow.js` | Flujo CREAR NUEVA GRANJA end-to-end con eventos reales y reloj falso: siembra, anti-reentrancia, diálogo propio, archivado, fallo a mitad → aviso y sin barra colgada. `confirm/alert/prompt` nativos lanzan si alguien los llama |
| `test/world-size-rules.js` | Reglas por tamaño + proporción de coste; un hueco no da capacidad ni conservación sin estructura conectada y terminada |
| `test/almacen-fisico.js` | Plano conectado, trabajo real, footprint transitable/protegido, posición estable, mejora in situ y reconstrucción sólo tras daño físico |
| `test/storage-pressure.js` | Límite protegido real, excedente físico tipado, deterioro, consumo, cache inundado/desconectado y migración/round-trip H |
| `test/texture-pack.js` | PNG RGBA 256², 64 rectángulos/pivotes válidos, paridad JSON/JS, sprites obligatorios, carga e integración sin coordenadas manuales |
| `test/oficios-emergentes.js` | Constructoras, mineras profundas, exploradoras, recolectoras exteriores y nodrizas surgen por experiencia, edad, rasgos y necesidad; sin asignación manual |
| `test/pages-root.js` | El artefacto contiene el juego en `/` y la ruta histórica sólo redirige, sin duplicar el código |
| `test/save-roundtrip.js` | Guardar → recargar → mismo mundo, obreras y tesoros |
| `test/reload-simulation.js` | La granja activa sobrevive a llenar el archivo de 5 granjas |
| `test/browser-smoke.js` | Chrome real: menú → tamaños → siembra → mundo 96×48 pintado, colonia viva, recarga, y el mismo flujo dentro de un `iframe sandbox` sin `allow-modals` |
| `test/offline-return.js` | Chrome real: contenido del recibo, una presentación por sello en `CONTINUE` y visibilidad, idempotencia, dos sugerencias no automáticas, foco/ESC, movimiento reducido y tamaños desktop/retrato/landscape |
| `test/lineage.js` + `lineage-integration.js` | Fórmula sin redondeo, elegibilidad, wallet sólo ganada, costes finitos, reinicio físico, persistencia exacta, migración y escalón offline |
| `test/lineage-browser.js` | Una cortina de ámbar bajo el reloj; compra, confirmación/cancelación, foco, no solapamiento y tamaños desktop/retrato/landscape |
| `test/salida-emergente-real.js` | La misma fundadora se elige por conducta, cruza la hierba, recoge y vuelve físicamente por un labio abierto antes de entregar |
| `test/exploracion-tridireccional.js` | Un mundo intacto abre izquierda y derecha mientras una excavadora lateral y una forrajera vuelven físicamente por la boca |
| `test/profundidad-continuable.js` | Cantería alcanzable, bedrock tardío y ocho losas consecutivas que agrandan SMALL, MEDIUM y BIG sin fondo fijo |
| `test/intro-topo.js` | La transición usa la geometría responsive definitiva desde el primer píxel visible, sin título grande que luego se encoja |
| `test/startup-menu.js` | Orden, teclado y tamaños táctiles del menú en escritorio, móvil y landscape |
| `test/front-menu-settings.js` | Familia voxel completa: paneles sin recorte, ajustes persistentes, fondo inmóvil al desactivarlo, exportación/importación y borrado seguro |
| `test/inventario-voxel.js` | Inventario voxel sin cifras ni controles duplicados: datos del ledger, scroll anclado y adaptación medida en desktop, portrait y landscape |
| `test/adaptaciones-controladas.js` | Migra herramientas antiguas, compra una adaptación desde la tarjeta, protege `KEEP`/compromisos y demuestra que 32× de simulación no produce ningún débito material no aprobado |

`test/world-perf-proflib.js` es el DOM de juguete que usan los tests de node; `world-create-breakdown.js`
y `world-frame-driver.js` son para mirar de dónde viene el coste (la fila "crear mundo (todo)" imprime
negativos por cómo mide: ignórala, usa "crear mundo (base)").

## Ver el juego publicado en vivo

GitHub Pages publica <https://untopo.github.io/antfarm-idle/>. El fuente sigue aquí, en
`ant-farm-rpg/`; `scripts/build-pages-root.sh` aplana sólo el artefacto de publicación y conserva un
redirect mínimo desde la ruta antigua.

`bash scripts/deploy-live.sh vercel` sube una copia idéntica al repo y devuelve un enlace público en 5 segundos;
`bash scripts/deploy-live.sh tunnel` abre un enlace sin ninguna cuenta. Las comparativas, los límites de 2026
y qué hace cada plan están en [docs/PUBLICAR.md](docs/PUBLICAR.md).

## Kit de recuperación (por qué existe esto)

El 2026-10-14 el espacio de trabajo volvió solo a una revisión anterior a mitad de sesión y se perdió
trabajo que no estaba en ningún snapshot (ver `docs/INCIDENTE-20261014.md`). `git` dentro del workspace
protege de mis errores, no de eso: **lo único que sobrevive es lo que sale del sandbox**.

```bash
bash scripts/snapshot.sh "lo que sea que acabe de terminar" --full   # commit + bundle + tgz de código + tgz completo
bash scripts/restore.sh snapshots/antfarm-<ts>-full.tgz --into /tmp/prueba   # comprueba que el kit restaura
```

`snapshot.sh` deja en `snapshots/`:

| Fichero | Qué es | Tamaño |
|---|---|---|
| `antfarm-<ts>-code.tgz` | código (HTML, CSS, JS, docs, tests, scripts) | ~236 KB |
| `antfarm-<ts>.bundle` | histórico de git clonable (`git clone` y listo) | ~280 KB |
| `antfarm-<ts>-full.tgz` | **todo** el proyecto, con los ~28 MB de assets | ~44 MB |
| `antfarm-<ts>-sha256.txt` | huellas para detectar corrupción | 289 B |

Los assets están fuera del historial de `git` a propósito (28 MB por commit hinchan `.git` y el snapshot
del propio workspace, que es justo lo que queremos evitar); viajan en el `-full.tgz`. Al restaurar, el
script comprueba sintaxis y lanza `test/create-farm-flow.js` contra la copia restaurada: si el test no
da 28 ok, la restauración no vale.

Rutina: **cada bloque terminado = tests verdes + `snapshot.sh` + descargar el `-code.tgz`** (y el
`-full.tgz` cuando haya cambiado arte). Si además quieres remoto, desde TU máquina:

```bash
git init && git remote add origin <url-de-tu-repo-privado> && git push -u origin HEAD
```

## Reglas del proyecto

- **Nada de diálogos del navegador** (`alert/confirm/prompt`): en iframes `sandbox` y en varios móviles
  devuelven `false` sin avisar y cortan el flujo. Todo diálogo pasa por `gameDialog/gameConfirm/gameAlert`.
- **El HTML no tiene lógica.** Ni `<script>` de "por si acaso", ni `onclick` inline: un solo dueño del
  comportamiento (`js/app.js`). El único bloque inline es el vigía de arranque, que no toca el estado.
- **Un solo `?v=`** para HTML, CSS y assets; subirlo en todas las etiquetas a la vez.
- **El mundo no existe hasta elegir tamaño**: ni arrays de suelo, ni tick. Nada de crear un 64×36 de
  relleno que luego se pinta encima del onboarding.
- **En el texto del juego no aparecen otros títulos**: las referencias externas (juegos de referencia para
  entender cómo cavar o cómo escalar un mapa) viven en los comentarios y en `docs/notas/`, nunca en la UI.
- **Nada debe quedar colgado**: toda barra de progreso con temporizador lleva vigilante y toda ruta de
  error avisa en pantalla con reintento.
- Hay `git` en la raiz y un `scripts/snapshot.sh` que ademas escribe un kit descargable. Ningun bloque se
  cierra sin: tests verdes + snapshot + descarga del `-code.tgz` (ver "Kit de recuperación" arriba).
  si el entorno restaurara una revisión vieja (ya pasó: ver `docs/INCIDENTE-20261014.md`).
