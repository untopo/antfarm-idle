# LA ESCALERA — cavar hacia abajo como en Terraria

*Añadido el 2026-10-16 por petición del dueño: «quiero que puedan seguir cavando hacia abajo si quieren,
que mientras más profundo se consigan materiales más raros, que cada vez que lleguen al límite se
desbloquee más área, que consigan más tesoros, cosas asombrosas».*

Este documento explica **lo que está implementado, con sus números**, y lo que se dejó fuera a propósito.
No hay nada aquí «por decidir»: cada regla sale del código (`ant-farm-rpg/js/app.js`) y cada afirmación la
sostiene `test/profundidad.js` (34 comprobaciones en Chrome real).

---

## 1 · Las nueve bandas

`BANDAS` es la tabla maestra. El tipo de roca de cada fila sale de ahí (`tipoDePiso(piso)`), y también su
dureza, su veta y su color de paleta. Antes existía una cadena de `if (depth<3) … if (depth<38) …` a mano.

| banda | pisos | roca | dureza | veta (metal/gema) | prob. por casilla | qué hay enterrado |
|---|---|---|---|---|---|---|
| 0 RAÍCES | 0–2 | tierra | 0 | — | — | semillas, agua, hongo |
| 1 BARRO | 3–7 | arcilla | 4 | — | — | ánfora de miel, fibras |
| 2 ARENA MOVEDIZA | 8–13 | arena | −4 | — | — | fósil de hormiga león |
| 3 PIEDRA | 14–21 | piedra | 9 | cobre | 5,2 % | geoda de cuarzo |
| 4 PIZARRA | 22–29 | pizarra | 14 | hierro | 4,0 % | ámbar con hormiga |
| 5 CUARCITA | 30–37 | cuarzo (11) | 18 | oro | 3,2 % | lente de cristal |
| 6 MÁRMOL NEGRO | 38–45 | mármol (12) | 23 | gemas (16) | 2,6 % | hongo linterna, sal de roca |
| 7 OBSIDIANA | 46–54 | obsidiana (13) | 29 | gemas (16) | 2,2 % | lágrima de obsidiana |
| 8 BASALTO ÍGNEO | 55+ | basalto (14) | 34 | oro | 1,8 % | corazón de colina, meteorito, nido antiguo |

Tres cosas de esa tabla son el corazón del asunto:

* **la dureza sube** (0 → 34) y con ella los golpes que cuesta un bloque: `_hard = durezaDe(tipo)`;
* **la veta escasea** (5,2 % → 1,8 %) y cada metal vive *solo* en su banda: el test cuenta casillas
  fuera de banda y exige **cero**;
* **lo bueno no está en el mapa inicial**: en un mundo SMALL (22 pisos) hay cobre y *nada* de hierro, oro,
  cuarzo ni gemas. Lo raro está detrás de la losa.

Tipos de casilla nuevos: `11` cuarzo, `12` mármol, `13` obsidiana, `14` basalto, `15` **magma**,
`16` **veta de gemas**, `17` **losa del umbral**, `18` sal de roca. Todos se pintan con `_VOX` +
`_bloque`, igual que el resto del mundo: sin trazos, sin degradados, cara clara arriba y canto a sombra.

## 2 · El límite es una LOSA, no el borde del mapa

`umbral = {r, c0, c1, hp, hpMax, banda, guarda}`. La última fila del mundo se rellena de tipo `17` al
crear el mapa (`colocarUmbral()`), y eso es lo que ven las hormigas: una franja de roca oscura con
mordeduras que se ven (`pinta:'cincel'`: las grietas crecen con el progreso, y a más del 80 % asoma una
línea ámbar).

**Cómo cede.** La losa no se cava bloque a bloque; tiene puntos de vida *de la colonia*:

```
hpMax            = 16 + 13 · banda_que_guarda
golpe por obrera = 1 + 0,55 si es EXCAVADORA + 0,6 con cantería + 0,07·GEN (tope 1,4)
                 + (IQ−100)/200 + bonusCava
```

Cada vez que una excavadora remata un golpe sobre una casilla `17`, la casilla **no desaparece**: baja el
`hp`, saltan cuatro astillas grises y vuelve a por otra (`digNeeded` para la losa es 5–11, corto a
propósito, para que el baile sea repetir en el mismo sitio). Con `umbral.hp <= 0` llama a `abrirUmbral()`.

**Quién puede morderla.** `puedeGolpearUmbral()`: mínimo 3 obreras vivas, y a partir de MÁRMOL (banda 5)
hace falta la invención `masonry` (cantería: GEN≥6, IQ≥145, piedra+arcilla). Si falta algo, el panel lo
dice en vez de dejar a la colonia picando en seco.

**A quién se le encarga.** En la elección de frente de excavación hay tres reglas:

1. **sesgo de pozo**: `distancia = |Δ| − 1,35 · piso`, o sea que entre dos frentes iguales gana el bajo;
2. **frente principal de fundación**: desde GEN1 (o al entrar en el día 3 si el aprendizaje tarda), una
   sola obrera libre mantiene el pozo dentro de las tres columnas de la boca hasta la primera losa. Si la
   despensa toca 5, vuelve a mandar la comida. El escombro queda abajo como residuo con coste higiénico,
   para no obligarla a subir cada bloque por separado. Después de la primera losa esta cadena se retira;
3. **la obra de la losa**: si la losa está a tiro y la colonia puede morderla, hasta la mitad de las
   excavadoras (rol EXCAVADORA o `construccion > 52`) reciben como objetivo la casilla `17` con hueco
   libre encima **más cercana a su columna** — y solo si están a una fila de la losa. Darles un objetivo
   lejano las ponía a rebotar contra la pared (`blocked` subiendo y cero picoteos: medido, 30 rebotes y
   `hp` intacto).

**Qué pasa al romperse** (`abrirUmbral`): la fila de la losa se convierte en el primer piso de la banda
que se abre, `expandWorld(add, silencioso=true)` rellena la banda nueva (roca + vetas + una o dos cuevas
con botín), `colocarUmbral()` pone la siguiente losa, `bandaMax` sube, `umbralesRotos++`, y sale *una*
tarjeta: `🕳️ ¡NUEVA PROFUNDIDAD! · CUARCITA`. El aviso genérico de «mundo expandido» va callado en este
camino para no decir dos veces lo mismo.

El expansor antiguo (`checkWorldExpansion`, que crecía solo cuando un túnel llegaba al fondo) ahora
**no hace nada si hay losa**: `if(umbral) return;`. Sigue ahí como red de emergencia por si un guardado
viejo se queda sin techo.

## 3 · Caveras, botín y cosas asombrosas

Al abrir una banda se tallan **una o dos cuevas** (óvalo de 7–13 × 5–7 casillas) con un tesoro de la banda
dentro. Es prestado de Core Keeper y Dwarf Fortress: el hueco vacío, en sí, ya es un premio — sitio donde
la colonia cabe, y donde el agua y el hongo tienen dónde agarrar.

El botín (`TREASURE_DEFS`, subido a nivel de módulo) se sortea por **banda**, no por «tier 0/1/2» como
antes, y lleva un filtro de progreso suave (`prog<2` corta lo de tier ≥4; `prog<1` lo de tier ≥3) para
que una colonia novata no se encuentre el meteorito en el primer día. Nueve **reliquias**:

| reliquia | banda | da |
|---|---|---|
| Fósil de hormiga león | 2 | +120 XP, +2 % cava |
| Ámbar con una hormiga dentro | 3 | +80 XP, +2 % cava |
| Geoda de cuarzo | 4 | +3 cuarzo, +90 XP, +2 % |
| Lente de cristal de roca | 5 | +150 XP, +3 % |
| Hongo linterna | 6 | +10 comida, +130 XP, +3 % |
| Lágrima de obsidiana | 7 | +2 obsidiana, +180 XP, +4 % |
| Corazón de colina | 8 | +20 comida, +300 XP, +5 % |
| Meteorito hundido | 9 | +1 meteorito, +220 XP, +5 % |
| Nido de la colonia vieja | 9 | +1 obsidiana, +260 XP, +3 % |

Cada maravilla **una sola vez por partida** (`anotarReliquia`); se queda en la **VITRINA** del panel del
mundo con su nombre, el piso donde salió y el día, y su bonus de excavación se acumula con tope de
**+30 %** (`bonusCava`, usado al calcular `digNeeded`). El marcador en el mundo de una reliquia ya
descubierta es un rombo de cuatro bloques, para que se lea «esto es una maravilla» sin leer el cartel.

Materiales nuevos en la bolsa de la colonia: `cuarzo`, `gema`, `obsidiana`, `meteorito` (además de los
`cobre/hierro/oro` que ya saltaban de las vetas).

## 4 · El fuego cobra peaje

En la banda 8 el basalto se interrumpe con **magma** (`15`, 5,5 % de las casillas, en parches de 2–3). No
se cava (`digNeeded 999`, y si una obrera lo intenta: `🔥 QUEMA` y sube). Lo que sí hace:

* si hay magma en las 8 vecinas de una hormiga, su fatiga sube **+2,3 por paso** — no es decorativo;
* al pasar de 84 suelta la carga, deja de cavar y se va a la superficie (`VOLVER_TIERRA`), con aviso en
  el historial;
* el resplandor se pinta en `drawFarm` (dos rectángulos con parpadeo), no en el caché del suelo, porque
  congelado en el caché dejaría de ser lumbre. Se itera `magmaCells`, una lista mantenida al generar,
  expandir y cargar — no se escanea el mapa por cuadro.

## 5 · Lo que se guardó, y lo que no

Persisten en `antFarm_fullSave_v2`: `bandaMax`, `umbralesRotos`, `bonusCava`, `reliquias[]` y el estado de
la losa (`umbral {r, hp, hpMax, banda}`). Al cargar, si el mapa no termina en losa (guardado de ayer) se
le pone una encima con `colocarUmbral()`, y `reindexMagma()` rehace el índice del fuego.
`ROWS/SURFACE_ROW/soil/soilType` ya se guardaban.

Fuera, a propósito, por ahora:

* **nivel freático y anegamiento** — hay un `water[][]` en el motor pero no lo he tocado: sin reglas de
  flujo no aporta y sí riesgo de llenar el nido de charcos falsos;
* **reliquias construyendo cámaras** — hoy la vitrina es el panel; poner los objetos físicamente en una
  cámara es un trabajo de dibujo aparte y lo dejo apuntado en el roadmap;
* **nada del cerebro**: las 5 salidas de la red siguen siendo `steer/thrust/cava/tinta×2`; la losa y las
  bandas cambian el *mundo*, no la red neuronal. La respuesta honesta sobre la inteligencia está en
  `ROADMAP.md` § P6.

## 6 · Pantalla de TOPO STUDIOS

`js/splash-topo.js` (143 líneas, sin dependencias) pinta en un lienzo de **176×88** duplicado a
352 con `image-rendering:pixelated`, sobre una retícula de 8 px, usando `_bloque`/`_tilde16` si app.js ya
las definió y una copia local si no. Cielo en cinco fajas cuantizadas, once columnas de tierra con su
tilde por bloque, montículo, boca de madriguera, y el topo: dos empujones (580 ms y 950 ms), zarpazos con
polvo que cae con gravedad, respiración y dos parpadeos. **34 rellenos por cuadro** y se congela solo al
terminar (2,2 s): el menú entra a los 2,32 s y el `visible()` del lienzo corta el bucle en cuanto el logo
desaparece, así que no drena ni un cuadro durante la partida. Con
`prefers-reduced-motion: reduce` sale directamente el cuadro final.

Lo sostiene `test/intro-topo.js` (14 comprobaciones, incluyendo «dos cuadros a 0,5 s no son el mismo»,
«cuando acaba, dos cuadros seguidos sí son el mismo» y el modo de movimiento reducido).

## 7 · Coste

Medido en el mismo arnés que las otras pruebas de pintura, con la colonia sembrada a 34 obreras, mapa de
70 filas y las nueve bandas abiertas:

| | rellenos por cuadro | mediana | p95 |
|---|---|---|---|
| antes de la escalera (48 obreras, 28 filas) | 4 110 | 20,8 ms | 28,8 ms |
| con la escalera (70 filas, magma y losa) | 2 793 – 4 300 | 16,2 – 16,8 ms | 21,9 – 40 ms |

El coste nuevo es O(casillas de magma visibles) + 2 rectángulos de barra de losa + 34 rellenos de logo
solo en el arranque. El suelo sigue pasando por el repintado incremental: la losa marca *una* celda
(`markSoilDirty(c, r)`) por mordisco, nunca el mapa entero.

Un detalle que salió caro y vale la pena anotado: pintar el rombo de la reliquia con `cx`/`cy` **antes** de
`const cx = x+8` metía un `ReferenceError` en cada cuadro (TDZ, el mismo error de familia que el `_tw` de
los luceros) y reventaba `renderLoop` entero. El test lo cazó; de ahí la regla de no usar una variable
declarada más abajo.

## 8 · Huecos de prueba

`window._escalera()` devuelve el estado completo (losa, banda, losas rotas, filas, vetas, reliquias,
`magma`); `window._morderUmbral(n)` pega `n` mordiscos de verdad por la función del juego;
`window._irABanda(b)` abre bandas hasta `b` reventando losas (para inspección, no para jugar). Los tres
están en `ant-farm-rpg/js/app.js`, al final de `initSoil`, junto a los `_spawnTreasure`/`_treasures` que
ya estaban.

## 9 · De dónde viene cada idea

| juego | qué se tomó | qué se dejó |
|---|---|---|
| **Terraria** | los minerales por piso y el «el fondo no es el borde, es una pared que se rompe» (esferas de sombra / altares: rompes algo del fondo y el mundo te da más) | no hay dificultad por capa con enemigos; aquí el riesgo es el fuego y la fatiga |
| **SteamWorld Dig 1–2** | bajar tiene coste (tiempo y fatiga), cada capa con su color propio, y el «un poco más abajo» como motor | no hay tienda ni mejora de pico con dinero: la mejora es la colonia (GEN, IQ, cantería, reliquias) |
| **Motherload** | la profundidad como progresión continua y el botín que justifica el viaje | sin mapa de cuadrícula aparte ni combustible: la fatiga hace ese papel |
| **Deep Rock Galactic** | el bioma hostil abajo del todo (magma que te quema si te pones) y el «algo no debería estar ahí abajo» | sin enjambre hostil ni clases |
| **Core Keeper** | cuevas abiertas al entrar en una banda nueva, luz como recurso | sin agua/anegamiento todavía |
| **Aground / Dwarf Fortress** | reliquias que cuentan una historia (el nido viejo, el ámbar con la hormiga dentro) sin cutscenes | sin biblioteca ni museo de objetos múltiples: la vitrina es una lista y un bonus |
| **Minecraft** | la roca madre irrompible como marco del mundo (aquí `17` la hereda y la convierte en puerta) | sin bioma de infierno ni portales |

Y una idea que no es de ningún juego de la lista, sino de la colonia: **la losa se rompe entre todas, o no
se rompe**. La barra de progreso está encima de la roca, en el mundo, y solo avanza si hay cuadrilla
abajo. Ninguna hormiga sola abre banda, y eso es exactamente lo que la IA actual (una red de 59 pesos de
media) no puede fingir: el avance es de la colonia, no del individuo.

## 10 · El fondo de las cuevas: pared de ladrillo detrás del hueco (2026-10-16)

**Lo que vio el dueño:** un flash de textura de un cuadro en el fondo de las cuevas, y el pedido de una
pared de fondo voxel como en Terraria.

**Causa del flash, medida:** el mundo principal se pintaba desde el cache solo cuando no había repintado
pendiente; en cualquier otro cuadro salía por un camino a mano que pintaba el hueco en crema `#fff1c8` y
el agua encima. Con la colonia cavando, eso ocurría cuadro sí, cuadro no. Ahora el mundo principal se
pinta siempre desde el cache (reconstruido en el mismo cuadro si hace falta) y el agua va encima en cada
cuadro. El color crema ya no existe en el código; el hueco lo pintan los mismos ayudantes en las tres
rutas (cache, emergencia y minimapa).

**La pared:** detrás del hueco hay roca que queda, con aparejo de piezas de 8×8 desplazadas medio ladrillo,
junta de mortero en las dos direcciones, tono por material (la del obsidiana es casi negra y tira a
violeta; la de mármol, gris frío), sombra de voladizo donde arriba hay roca, y raíces colgando solo en
las bandas de tierra. Va siempre por detrás del corte tallado: al menos un 20 % más apagada.

**Lo que se descartó:** una primera versión con hiladas de 4 px salió como persiana y el musgo verde se
leía como polvo. Se cambió a piezas de 8 px con mortero más suave.

**Prueba:** `test/fondo-cueva.js` (23 ok · 0 fallos). Mide cuadros que pintan el mundo por el camino viejo
(0), el color crema fuera del código, el aparejo en dos direcciones, la pared por detrás, la
determinación (repintar dos veces da la misma firma), el agua en cada cuadro y cero errores de consola.
Dos condiciones se fabrican a mano y se dicen en el propio test: el repintado pendiente constante (sin él
el flash no aparece) y la cámara de obsidiana (en el mapa pequeño todavía no existe).
