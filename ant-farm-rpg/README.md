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
llevan **un solo** `?v=` (`20261020h`); al tocar CSS o JS se sube en todos los sitios a la vez.

Depuración: `?debug=1` en la URL (o `localStorage.antfarm_debug='1'`) enciende el registro del juego
(`tlog`) que está callado por defecto. En la consola: `_topoDbg()` devuelve día, obreras, comida,
dimensiones y si está pausado.

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
├── assets/textures/colony-atlas.{png,json,manifest.js} · hoja única de 64 objetos voxel reutilizables
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
| `test/intro-topo.js` | La transición usa la geometría responsive definitiva desde el primer píxel visible, sin título grande que luego se encoja |
| `test/startup-menu.js` | Orden, teclado y tamaños táctiles del menú en escritorio, móvil y landscape |
| `test/front-menu-settings.js` | Familia voxel completa: paneles sin recorte, ajustes persistentes, fondo inmóvil al desactivarlo, exportación/importación y borrado seguro |
| `test/inventario-voxel.js` | Inventario voxel sin cifras ni controles duplicados: datos del ledger, scroll anclado y adaptación medida en desktop, portrait y landscape |

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
