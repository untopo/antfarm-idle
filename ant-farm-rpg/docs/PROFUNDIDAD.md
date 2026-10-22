# PROFUNDIDAD COMPLETA — descenso vertical al estilo Terraria

**Estado:** implementado para SMALL, MEDIUM y BIG.

La profundidad no es una sucesión de losas ni puertas invisibles. Cada tamaño contiene una geología completa,
termina en un Underworld reconocible y tiene una frontera física final. La roca sí conserva una escala visible
de dureza: cuatro mejoras anatómicas sucesivas o una evolución más lenta permiten morder estratos cada vez más
duros. El tamaño modifica el ancho y la longitud del viaje, pero no elimina biomas ni corta la partida antes de
tiempo.

---

## 1 · Contrato de los tres mundos

| mundo | ancho | filas iniciales materializadas | profundidad final | tramo automático | inicio del Underworld | inicio del núcleo |
|---|---:|---:|---:|---:|---:|---:|
| SMALL | 48 | 28 | 84 | 14 | 65 | 81 |
| MEDIUM | 64 | 36 | 108 | 18 | 84 | 105 |
| BIG | 96 | 48 | 144 | 24 | 112 | 141 |

Las tres últimas filas forman el **WORLD CORE**. Por ello, los tres mundos ofrecen:

- las mismas zonas geológicas y familias de materiales;
- exploración lateral, vetas, cuevas, agua, reliquias y peligros;
- cuatro aperturas proporcionales hasta materializar el mapa completo;
- un Underworld de basalto, obsidiana y magma;
- una frontera final de tres filas que se ve y se toca, en lugar de un borde de memoria invisible.

`ROWS` significa «filas materializadas ahora». `worldDepthLimit` significa «fondo físico definitivo de
esta partida». La pantalla de selección, CONTINUE y el archivo muestran siempre las dimensiones finales
(48×84, 64×108 o 96×144), no sólo el trozo cargado al fundar.

La materialización gradual conserva el coste ligero del inicio: SMALL no necesita simular 84 filas el
primer día. No es un límite de progreso ni contenido ausente; es almacenamiento que aparece por delante
del túnel antes de que una hormiga pueda chocarse con su borde.

## 2 · Cómo se abre el terreno

`checkWorldExpansion()` mide el componente de huecos conectado al nido. Cuando ese componente alcanza
`ROWS - 7`, llama a `expandWorld()` y añade exactamente un tramo del perfil.

No consulta:

- generación;
- IQ;
- población mínima;
- invenciones;
- cantería;
- materiales almacenados;
- equipo de una hormiga;
- una barra de vida colectiva.

Esta lista describe únicamente el disparador de **materialización**: si un túnel conectado ya alcanza la
línea, incluso una partida GEN 0 / IQ 100 abre el siguiente bloque de filas. No confiere fuerza ficticia para
atravesar cualquier material. La dureza de cada celda se resuelve aparte mediante la cadena anatómica de abajo.
Una colonia que no compre ninguna mejora tarda más, pero la evolución garantiza que tampoco quede bloqueada.

La activación ocurre **antes** del borde asignado. Las hormigas nunca reciben como objetivo una fila que
todavía no existe y nunca deben amontonarse contra el fondo del `Array`.

Al abrir un tramo se amplían juntos:

- `soil`, `soilType` y la roca anfitriona;
- agua y agua visual;
- alto físico `H` y backing store del canvas;
- índices de magma, cuevas, reliquias y vestigios;
- regla de profundidad y límites de cámara.

La expansión no regala un túnel. Añade roca determinista y la colonia aún debe excavarla.

### 2.1 · Cuatro tiers de mandíbula, no picos humanos

`NEST STORES` conserva una sola tarjeta compacta de mandíbulas. En ella se ve la pista I → II → III → IV,
el coste del siguiente paso, su potencia y los materiales que abre. Cada clic exige aprobación del jugador,
elige de forma emergente a una obrera apta y sólo avanza **un** nivel; nunca consume stock durante la
simulación ni permite saltar un tier. Si ya existe una especialista, se continúa su cadena antes de iniciar
otra. `KEEP` y el material comprometido siguen fuera del stock disponible.

| tier | adaptación | coste aprobado | potencia | geología que añade |
|---:|---|---|---:|---|
| I | STONE-EDGED MANDIBLES | 2 stone | 18 | copper y quartzite |
| II | COPPER-SERRATED MANDIBLES | 2 copper + 1 stone | 23 | iron, black marble y gemstone |
| III | IRON-BRACED MANDIBLES | 2 iron + 1 copper | 29 | gold y obsidian |
| IV | GOLD-INLAID MANDIBLES | 2 gold + 1 iron | 38 | igneous basalt; bedrock si existe DEEP MASONRY |

La compra temprana se habilita en GEN1/IQ112, GEN2/IQ120, GEN2/IQ122 y GEN3/IQ124 respectivamente, además
de exigir los materiales del escalón anterior. La vía sin gasto llega después: tier I en GEN2/IQ114, tier II
en GEN3/IQ116, tier III en GEN3/IQ118 y tier IV en GEN4/IQ122. Estos umbrales están al borde viable de la
capa anterior para que la colonia gane el IQ cavando y no necesite experiencia atrapada al otro lado de una
veta de ancho completo.

Bedrock mantiene una segunda condición física: tier IV y `DEEP MASONRY`. Si muere la especialista o el
jugador nunca abre la tarjeta, GEN8/IQ148 más esa misma cantería ofrece la ruta universal tardía. Magma tipo
`15` y WORLD CORE tipo `19` permanecen incavables por diseño. El tier también cambia velocidad, selección de
la minera, color de mandíbula y lectura de potencia, de modo que la mejora existe en el cuerpo y en el trabajo,
no como una herramienta humana invisible.

Los guardados binarios antiguos (`mandibles: true`) y los antiguos `tool: 'pick'` migran a tier I. El save
nuevo persiste un entero de 0 a 4.

## 3 · Geología continua, exploración lateral y recompensas

`BANDAS` continúa definiendo la sucesión de dureza y aspecto: raíces, barro, arena, piedra, pizarra,
cuarcita, mármol negro, obsidiana y basalto. `core/mundo.js` transforma la semilla persistente en pliegues,
lentes e inclusiones continuas. Generar una fila al fundar o años después produce la misma celda: abrir un
tramo no vuelve a sortear el mundo ni crea una costura artificial.

El pozo profundo es una prioridad persistente, no la única tarea. En paralelo, las obreras libres mantienen
frentes laterales a ambos lados, descubren vetas y cuevas por conexión física y cargan el escombro de vuelta.
El algoritmo no conoce de antemano las coordenadas de un tesoro.

Las cuevas pueden contener reliquias y espacios útiles para agua, hongos o tránsito. Los vestigios cuentan
historia sólo con geometría, desgaste, hollín, raíces, canales y reparaciones. No añaden códices ni ventanas
que interpreten el hallazgo.

## 4 · Underworld y frontera final

El último tramo cambia de forma inequívoca:

- roca anfitriona de basalto;
- obsidiana mezclada;
- magma animado y luz cálida;
- rótulo **UNDERWORLD** en la regla;
- atmósfera y paleta distintas del subsuelo superior.

El magma (tipo `15`) no se excava. Produce fatiga y puede obligar a una obrera a retirarse. Sin embargo, un
corredor central de nueve columnas nunca genera magma al azar: sigue siendo roca dura que hay que cavar, pero
deja holgura para el radio de las hormigas, sus desvíos y la zona de calor de ocho vecinas. Una pared de lava
de ancho completo no puede hacer imposible la partida; los flancos conservan el peligro y la exploración
lateral permite buscar otras rutas y recursos.

Las últimas tres filas son tipo `19`, **WORLD CORE**:

- están sólidas;
- no son excavables;
- usan textura de bloques soldados, oscura y rojiza;
- ocupan celdas reales del mundo;
- aparecen en la regla como el final definitivo.

Esta frontera no se abre y no promete otra ampliación. Es el final finito y explícito, equivalente funcional
a una roca madre: cuando las hormigas llegan, el jugador ve por qué no pueden seguir.

El tipo `17` (la antigua losa de tramo) ya no se crea en una partida normal. Sólo se reconoce al migrar un
guardado antiguo.

## 5 · Cámara, niebla y controles

El canvas conserva coordenadas físicas completas aunque la ventana jugable permanezca en `960×576`. Así,
el navegador no comprime un mundo alto dentro del mismo recuadro.

La cámara se limita por `exploredBottomY()`, no por la altura inicial ni por una cifra fija. Puede seguir a
las hormigas hasta el terreno físicamente alcanzado y deja unas pocas celdas de respiración delante. No
revela cuevas sin conexión: la niebla conserva la exploración.

Controles verticales:

- **rueda normal sobre el mundo:** paneo vertical;
- **rueda sobre la regla izquierda:** paneo vertical;
- **arrastre de la regla:** salto proporcional dentro de lo alcanzado;
- **Home / End, Page Up / Page Down y flechas:** navegación accesible;
- **Ctrl/⌘ + rueda:** zoom opcional;
- seguimiento de una hormiga: la cámara usa los mismos límites físicos actualizados.

El zoom mínimo también respeta el ancho real. Alejar la vista no centra un mundo estrecho dentro de franjas
vacías fuera del frame.

## 6 · Guardado y migración

`antFarm_fullSave_v2` persiste `depthLimit` y `worldCoreFound`, además de la cuadrícula, exploración, agua,
reliquias y progreso existente.

Al cargar una partida anterior a este diseño:

1. se infiere el perfil final por el ancho;
2. se conservan todas las filas ya excavadas y todo el progreso válido;
3. cada celda de losa tipo `17` vuelve a ser geología determinista sólida;
4. se eliminan objetivos de excavación que apuntaban a esa losa retirada;
5. esas obreras regresan a `EXPLORAR`;
6. el Underworld se aplica a filas profundas ya existentes;
7. si el mapa ya estaba en el fondo, el núcleo se sella de forma idempotente.

`umbralesRotos` y el campo de linaje `slabs` conservan sus nombres internos para no romper recibos antiguos,
pero ahora cuentan **aperturas de profundidad**. En interfaz, el requisito del vuelo nupcial es
`REACH THE FIRST DEPTH OPENING`. La profundidad fundacional no otorga progreso parcial gratuito.

Un nuevo vuelo nupcial reinicia la cuadrícula al tamaño inicial ligero del perfil, conservando como fondo
real el límite completo correspondiente.

## 7 · Trabajo offline

El cálculo offline puede completar una excavación que ya estaba físicamente iniciada. Al volver, el juego
recalcula el componente conectado y abre un tramo si ese túnel alcanzó el frente.

No inventa una obra, no crea una excavación sin objetivo y no encadena secciones futuras que la colonia aún
no ha alcanzado. El recibo distingue excavaciones terminadas de progreso parcial y no contiene eventos de
«losa rota».

## 8 · Pruebas que sostienen el contrato

- `test/profundidad-continuable.js`: contrato exacto de SMALL/MEDIUM/BIG, cuatro aperturas, ausencia de
  losas, Underworld, núcleo, cámara y migración.
- `test/excavation-tiers.js`: matriz exacta de materiales I–IV, bedrock, evolución sin gasto, costes,
  auditoría, secuencia sin saltos, migración y continuidad de la especialista emergente.
- `test/adaptaciones-controladas.js`: Chromium real; una sola tarjeta muestra los cuatro tiers, paga cada
  escalón desde AVAILABLE, persiste tier IV, cambia los píxeles de mandíbula y no admite gasto autónomo.
- `test/natural-depth-long.js`: una semilla sin progreso, dureza ni tecnología inyectados lleva hormigas
  físicas hasta el WORLD CORE en SMALL, MEDIUM y BIG y exige exploración lateral en la misma corrida.
- `test/primera-losa.js`: pese al nombre histórico del fichero, ejecuta la simulación natural y exige que
  SMALL abra el primer tramo antes de terminar el día 5, sin intervención externa.
- `test/profundidad.js`: Chromium real; valida tarjetas, los tres perfiles, rueda/paneo, regla y píxeles
  visibles del Underworld/núcleo.
- `test/offline-work-integration.js`: una excavación ya activa puede terminar offline y abrir un solo tramo,
  sin aprobar ni encadenar trabajo nuevo.
- `test/lineage.js` y `test/lineage-integration.js`: requisito, precisión, reinicio y ausencia de progreso
  fundacional gratuito.
- `test/expansion-agua.js`: agua y dimensiones crecen en sincronía.
- `test/niebla-profundidad.js`: la cámara llega a lo explorado sin revelar el resto.
- `test/core-bandas.js`: materiales, durezas y núcleo tipo `19`.

Las pruebas de contrato pueden materializar secciones directamente para inspeccionar todos los perfiles. La
aceptación jugable no depende de eso: además se ejecuta simulación prolongada sin rebajar durezas, HP ni
requisitos y recorridos reales de Chromium.

## 9 · Compatibilidad interna

Permanecen algunos nombres históricos (`umbral`, `umbralesRotos`, `_escalera`, `_irABanda`) porque forman
parte de guardados, tests y herramientas de inspección. No describen una losa activa en una partida nueva.
`colocarUmbral()` sólo sirve para construir fixtures de migración; no pertenece al flujo normal.

El contrato público es simple: **cada mandíbula abre la siguiente dureza; cavar terreno conectado
materializa más terreno; cada tamaño contiene el viaje completo; el Underworld avisa que se acerca el final;
el WORLD CORE es el final físico.**
