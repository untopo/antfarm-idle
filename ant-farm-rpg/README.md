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
llevan **un solo** `?v=` (`20261015e`); al tocar CSS o JS se sube en todos los sitios a la vez.

Depuración: `?debug=1` en la URL (o `localStorage.antfarm_debug='1'`) enciende el registro del juego
(`tlog`) que está callado por defecto. En la consola: `_topoDbg()` devuelve día, obreras, comida,
dimensiones y si está pausado.

## Estructura real (lo que hay en el disco)

```
ant-farm-rpg/
├── index.html          758 líneas · pantallas (splash, menú, tamaños, cargar, ajustes, créditos,
│                       onboarding, siembra), HUD, un único <script> inline: el vigía de arranque
├── css/style.css       510 líneas · tema pixel, tiras del HUD, calendario, diálogos
├── js/app.js           ~7 600 líneas · TODO el motor (sin dependencias, sin build)
├── assets/             sprites de hormigas/reina, hojas de texturas, fondo del menú
└── docs/
    ├── ARCHITECTURE.md    contrato del flujo de creación, guardado, helpers de HUD
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
| `test/world-size-rules.js` | Reglas por tamaño (cofres, despensa, miel en tierra sin cavar no cuenta) + proporción de coste de creación y frame |
| `test/save-roundtrip.js` | Guardar → recargar → mismo mundo, obreras y tesoros |
| `test/reload-simulation.js` | La granja activa sobrevive a llenar el archivo de 5 granjas |
| `test/browser-smoke.js` | Chrome real: menú → tamaños → siembra → mundo 96×48 pintado, colonia viva, recarga, y el mismo flujo dentro de un `iframe sandbox` sin `allow-modals` |

`test/world-perf-proflib.js` es el DOM de juguete que usan los tests de node; `world-create-breakdown.js`
y `world-frame-driver.js` son para mirar de dónde viene el coste (la fila "crear mundo (todo)" imprime
negativos por cómo mide: ignórala, usa "crear mundo (base)").

## Ver el juego publicado en vivo

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
