# PLAN · Antfarm como juego idle / incremental

**Estado:** plan completo, sin código. Nada de esto toca el juego actual hasta que el dueño apruebe la fase 0.
**Encargo (Topo, 2026-10-16):** «transformemos esto en un juego incremental/idle con nuestra idea de hormigas.
No tengas miedo en reformular cosas existentes, pero siguiendo nuestra idea bajo las limitaciones de un
navegador. Haz una investigación exhaustiva de muchos juegos del género y ve cómo convertir lo que hemos
desarrollado en algo así.»

---

## 0 · Resumen en cinco líneas

1. **La hormiga deja de ser el producto y pasa a ser el trabajador.** El juego se mide en *profundidad*
   del hormiguero, en materiales y en *linaje*, no en hormigas vivas que caminan.
2. **Cavar hacia abajo es la columna vertebral** (como Idle Miner, Mining Crew o Idle Deepcore), con
   bandas de roca que cambian el valor de todo lo que sale.
3. **Las losas son hitos de pelea colectiva:** una barra de puntos de vida que la colonia muerde entre
   todas, aunque cierres la pestaña. Es nuestro sello diferencial frente al género.
4. **Tres capas de reinicio con nombre de biología:** *vuelo nupcial*, *migración* y *linaje*. Cada una
   cambia reglas, no solo multiplica números.
5. **El cuerpo de la simulación se separa de la vista:** la economía corre con matemáticas (rápido, sin
   dibujar, también offline); las hormigas animadas son un modo *mirar* opcional. Así cabe en un navegador.

---

## 1 · Lo que enseña la investigación (con fuentes)

### 1.1 Mapa del género

| Juego | Qué hace bien | Qué nos sirve |
|---|---|---|
| **Cookie Clicker** | La escalera completa: clic → mejoras → automatización → reinicio. Es el manual del género. | La curva de aprendizaje sin tutorial. El reinicio que sube de forma cúbica: «los niveles de prestigio siguen un patrón cúbico», y cada reinicio cuesta más que el anterior ([Cookie Clicker wiki](https://cookieclicker.fandom.com/wiki/Ascension)). |
| **Universal Paperclips** | Tres actos con un cambio de interfaz por acto y una escala distinta en cada uno. Lantz lo dice así: «siempre hay cosas nuevas que se añaden y se quitan, un ritmo, un patrón y luego un giro» ([artículo académico](https://par.nsf.gov/servlets/purl/10174274)). | Nuestro arco narrativo por *bandas*: cada banda cambia la pantalla y la regla, no solo el número. |
| **Antimatter Dimensions** | Capas de reinicio que cada una desbloquea un nuevo lenguaje de juego (Dimensiones → Infinito → Eternidad → Realidad) ([wiki](https://antimatterdimensions.wiki.gg/wiki/Prestige)). La comunidad lo resume así: cada capa tiene desafíos y sistemas de mejora propios ([Reddit](https://www.reddit.com/r/incremental_games/comments/bka1a9/prestiging_yay_or_nay/)). | Las capas de reinicio con reglas nuevas, no solo más multiplicador. |
| **Trimps** | Confunde el nombre «prestigio» con cuatro reinicios distintos. El portal (el reinicio real) da una moneda que se gasta en mejoras permanentes que se vuelven a comprar en cada partida ([análisis](https://coolidlegames.com/games/trimps)). Su mayor fricción es la gestión de población y mapas. | Aprender de su confusión: los reinicios deben tener **nombres distintos** y uno solo debe ser «el importante». |
| **Idle Miner Tycoon 2D** | Escalera de minerales que cambia cada 10 pozos, y una segunda etapa a partir del pozo 100 con otra escala. Además, equilibrio entre tres cuellos de botella (pozos, ascensor, venta) ([itch.io](https://teutz.itch.io/idle-miner-tycoon-2d)). | Justo lo que queremos para las bandas. El cuello de botella bien hecho es el juego. |
| **Idle Miner (ClassicMania)** | Diez capas de mineral; el pico se mejora cinco veces; combo al golpear rápido; reinicio que da gemas permanentes ([itch.io](https://classicmania-games.itch.io/idle-miner)). | Un minijuego activo dentro del idle (golpear) con recompensa visible. |
| **Mining Crew** | Cada capa limpiada da un punto de prestigio; el terreno se endurece al bajar ([incrementaldb](https://www.incrementaldb.com/game/mining-crew)). | Puntos de linaje por bandas completadas, no por tiempo. |
| **Idle Deepcore** | Varias minas en paralelo, fundición y mapa de zonas reclamables ([Steam](https://store.steampowered.com/app/4527930/Idle_Deepcore/)). | Una segunda colonia o un mapa de bandas laterales en la capa 2. |
| **Swarm Simulator** | Cadena de unidades en la que cada tier produce el de abajo; mutaciones al ascender ([Steam](https://store.steampowered.com/app/914320/Swarm_Simulator_Evolution/)). | La cadena nodriza → obrera → excavadora ya existe en nuestro juego; se vuelve escalera de producción. |
| **Ant Colony Idle** | **El más parecido a nosotros.** Vuelo nupcial para reiniciar con «recuerdos de ámbar», mejoras de legado, Gran Migración para crecimiento ancestral, y progreso offline con tope ([Steam](https://store.steampowered.com/app/5305000/Ant_Colony_Idle/)). | Confirma nuestra tríada de capas. Hay que diferenciarse: su colonia no tiene losas ni reliquias ni linaje genético. |
| **Ant Colony (kronfeld)** | Exploradores que descubren lugares con bonos únicos, y evolución que cambia el ADN ([itch.io](https://kronfeld.itch.io/ant-colony)). | Expediciones por la superficie como segunda vía de recursos. |
| **Idle Ants (scorzy88)** | El reinicio se desbloquea con una investigación y cada mundo nuevo se genera aleatorio con sus propias unidades y mecánicas ([Kongregate](https://www.kongregate.com/en/games/scorzy88/idle-ants)). | Mundos de banda generados por semilla: rejugabilidad sin contenido a mano. |
| **Idle Ants (Madbox)** | Tres mejoras que deciden todo (velocidad, obreras, fuerza) y un medidor de aventura que desbloquea zonas ([zGames](https://www.zgames.io/game/idle-ants)). Consejo de la comunidad: no acumular efectivo sin gastarlo ([LevelWinner](https://www.levelwinner.com/idle-ants-guide-tips-cheats-strategies-to-progress-fast-and-unlock-all-worlds/)). | La fuerza como cuello de botella es la fuerza de nuestra losa (puntos de vida por banda). |
| **Ants-Incremental (Teiton)** | Caso de estudio negativo: el pago del reinicio estaba **redondeado hacia abajo**, así que empujar más no compensaba, y el árbol costaba 35 vuelos idénticos. Lo rehízo para pagar lo que la colonia valía ([devlog](https://theteiton.itch.io/ants-incremental/devlog/1637029/public-beta)). | Regla de oro: la recompensa del reinicio debe crecer con el esfuerzo, sin redondeos que la castiguen. |

**Patrones que se repiten en casi todos** (de las fuentes anteriores y de una guía de diseño):
- Cuatro pilares: progresión exponencial, prestigio, automatización y progreso offline ([Wikipedia](https://en.wikipedia.org/wiki/Incremental_game); [Design The Game](https://www.designthegame.com/learning/courses/course/designing-mobile-idle-genre/a-deep-dive-idle-genre-game-design)).
- La mejor mejora **cambia lo que puedes hacer**, no solo el decimal: una nueva construcción crea otra ruta de recursos ([Lkowalski](https://lkowalskil.github.io/offline-idle-dungeon-game-android.html)).
- Los reinicios se perciben como «plan», no como castigo, cuando la siguiente vuelta se siente distinta ([Prefetial](https://prefetial.online/what-idle-and-incremental-games-teach-about-automating-habits)).

### 1.2 Progreso offline: el punto técnico que decide la viabilidad

- Hay dos formas: **delta-time** (multiplicar el tiempo ausente por el ingreso por segundo al volver) o
  **simular** el tiempo ausente. La primera es la más común y la más barata ([GeekExtreme](https://www.geekextreme.com/idle-games-offline-progression-math/)).
- Simular rápido tiene un coste que crece linealmente con el tiempo ausente: por eso muchos juegos recortan
  el tope o pagan menos ([discusión en Reddit](https://www.reddit.com/r/incremental_games/comments/1izlgu1/why_are_you_devs_so_horny_about_not_allowing/)).
- Referencia de diseño: Melvor Idle simula hasta 24 horas al 100 % del ritmo, en el dispositivo y sin conexión,
  y el tope de 24 horas empuja a una rutina de una visita al día ([análisis Tideward](https://tideward.app/offline-progression/)).
- Los juegos más satisfactorios optimizan sesiones de 30 minutos a 2 horas ([GeekExtreme](https://www.geekextreme.com/idle-games-offline-progression-math/)).

**Consecuencia para nosotros:** la física de las hormigas (caminar, cavar, colisiones) **no** puede correr
offline ni a x32 con 34 obreras, como ya medimos (mediana 16,4 ms por cuadro). La economía sí puede, porque
es aritmética. Por eso el juego separa **simulación económica** (siempre) de **vista animada** (cuando miras).

### 1.3 Psicología y retención

- Las recompensas diferidas y variables generan la frecuencia de sesiones, no su duración ([Dinogame](https://dinogame.gg/blog/psychology-of-idle-games/)).
- El reinicio con ventaja permanente es el gancho más fuerte del género, y cada capa debe dejar una
  razón nueva para volver.
- Una regla de diseño que nos vincula: **que el jugador entienda por qué se ralentizó y vea al menos dos
  caminos para arreglarlo** ([Lkowalski](https://lkowalskil.github.io/offline-idle-dungeon-game-android.html)).

---

## 2 · El juego, reformulado

### 2.1 Nombre y premisa (propuesta, a decidir)
**«Antfarm: Cava hondo»** o **«Hormiguero profundo»**. Premisa: una reina y unas pocas obreras empiezan
a cavar bajo un prado. Cada metro cuenta: la tierra da materiales, la roca da minerales raros, y en cada
losa la colonia se encuentra con un límite que debe romper entre todas. Las reliquias de las profundidades
son el premio de la vitrina.

### 2.2 El bucle, en la escala de un minuto, una hora y un día

| Escala | Qué haces | Qué pasa mientras no miras |
|---|---|---|
| **Minuto** | Tocas la tierra para cavar a mano; compras una mejora; asignas obreras a cavar, recolectar o criar. | La colonia excava y acumula material. |
| **Hora** | Desbloqueas una banda nueva; rompes una losa; decides a qué banda enviar la cuadrilla. | Con la losa a medias, la colonia sigue mordiendo hasta el tope de offline. |
| **Día** | Haces un vuelo nupcial o una migración cuando la curva se aplana; eliges qué linaje potenciar. | Lo de siempre: ingreso lento, y el regreso muestra un resumen. |

### 2.3 Recursos (cuatro, no más)

| Recurso | Cómo se gana | Para qué sirve |
|---|---|---|
| **Tierra** | Cavar capas de tierra y barro | Construir cámaras y comprar obreras |
| **Mineral de banda** | Cavar la roca de cada banda (cobre, hierro, oro, gemas, sal) | Mejoras de excavación y desbloqueos |
| **Comida** | Recolectar del prado y de la superficie | Alimentar a la colonia; si falta, la colonia pasa hambre (ralentiza, no mata) |
| **Ámbar** | Vuelo nupcial (capa 1) | Mejoras permanentes del nido |

### 2.4 Escalera de mejoras (de las que se compran)

- **Obreras por tipo:** excavadora, recolectora, nodriza. Cada tipo multiplica su parte del trabajo.
- **Herramientas por banda:** la pala de hierro abre la pizarra; el pico de cuarzo, el mármol. La herramienta
  también se mejora dentro de cada banda (como el pico de Idle Miner).
- **Obra:** cámaras de cría, almacén, cámara de la reina, puertas. Cada cámara abre un tipo de trabajo nuevo
  (cría = más obreras; almacén = más tope de material offline).
- **Cuellos de botella explícitos:** ascensor de tierra (cuánto se puede sacar por tiempo) y almacén (cuánto se
  puede guardar). Sin ellos no hay decisiones, y es la lección de Idle Miner Tycoon.

### 2.5 Bandas y losas (nuestro sello)

- **Nueve bandas**, de raíces a basalto, como ya están en el juego. Cada banda cambia la tabla de precios
  (sube el valor del mineral), la dureza (sube el tiempo por golpe) y el color de la pantalla.
- **Losa:** un bloque con HP (`16 + 13·banda`, como hoy). Se muerde entre todas: cada obrera que cava allí
  aporta golpes por segundo, y la barra sigue avanzando **offline** hasta el tope. Al romperla se abre la banda
  siguiente y sale un botín de cueva.
- **La losa es el hito que cualquier jugador de Idle Miner reconocería:** un objetivo visible con progreso
  constante y una recompensa que cambia la regla de juego.

### 2.6 Las tres capas de reinicio (con nombre propio)

Ninguna se llama «prestigio» (la lección de Trimps). Cada una tiene una moneda, una pregunta y una regla nueva.

| Capa | Nombre | Qué reinicia | Qué gana el jugador | Qué cambia para siempre |
|---|---|---|---|---|
| **1** | **Vuelo nupcial** | Profundidad y material. Se conservan las reliquias y las mejoras de linaje. | **Ámbar**, en función de la profundidad alcanzada (raíz cuadrada, sin redondeo que castigue; lección de Teiton) | Mejoras permanentes del nido: obreras más rápidas, mejor almacén offline. |
| **2** | **Migración** | Todo lo de la capa 1, y el nido se muda a un mundo nuevo. | **Semillas** (una por migración) | Las bandas se reordenan según la semilla del mundo: otro orden de minerales, otra escala de dureza. Rejugabilidad real, como Idle Ants. |
| **3** | **Linaje** | Todo, excepto el linaje. | **Reliquias de linaje** y puntos de genética (cuántas bandas completas tiene tu estirpe) | Rasgos heredados (velocidad, golpe, resistencia al magma), que es el puente con lo que ya tenemos: las hormigas mutan y heredan. |

**Cerebro:** lo que ya existe (red de 141 números, herencia por mutación) entra en la capa 3 como rasgo
heredado. Lo que proponías en el plan de inteligencia (aprendizaje en vida) se queda para más adelante y no
forma parte de la versión idle: el idle necesita que el juego se entienda en 30 segundos, y eso no lo da una
red entrenada.

### 2.7 Reliquias, vitrina y arco

- Las nueve reliquias de hoy (fósil, ámbar con hormiga, geoda, lente, hongo, lágrima de obsidiana, corazón
  de colina, meteorito, nido de la colonia vieja) pasan a ser **trofeos de la vitrina**: cada una da un bono
  permanente pequeño y su texto de descubrimiento.
- **Arco narrativo** en tres actos, como Universal Paperclips: (1) el prado y la reina, (2) las profundidades
  y lo que la tierra esconde, (3) el linaje y la colonia que sale a la superficie a otra escala. El arco
  debe cerrarse en 15-25 horas de juego, con final opcional y sin fin de contenido forzado.

### 2.8 Lo que se conserva, se transforma o se retira

| Hoy | Mañana |
|---|---|
| Atlas de texturas de suelo y voxel | Se conserva como vista. La economía no los necesita |
| Física de hormigas (caminar, cavar, colisiones) | Vista opcional «mirar» a 60 fps. La economía va aparte |
| Escalera de profundidad y bandas | Columna vertebral del juego |
| Losa con HP | Hito principal. Se conserva tal cual, con progreso offline |
| Reliquias (nueve) | Trofeos de la vitrina con bono permanente |
| Cerebro de 141 números | Rasgo heredado en la capa 3 |
| Vuelo nupcial (ya existe la idea en el juego) | Capa 1, con su moneda y su fórmula |
| Mundo pequeño/mediano/grande | Tamaño del nido (se conserva) |
| Ataque/depredadores | Se retira por ahora; se puede reintroducir como evento |

---

## 3 · Arquitectura técnica (en un navegador)

### 3.1 Separación de capas
- **Núcleo económico** (JavaScript puro, sin DOM, sin canvas): estado, producción, costes, prestigio, tope
  offline. Corre igual en el navegador que en las pruebas de Node.
- **Vista:** pinta el estado. Dos modos: *resumen* (números, barras, mapa de bandas) y *mirar* (las hormigas
  animadas del juego actual, solo cuando está abierta la pestaña y solo con el nido visible).
- **Persistencia:** guardado cada 15 segundos (patrón del género) en `localStorage`, con versión y migración.

### 3.2 Números
- Valores que pueden pasar de `1e308`: se guardan como mantisa y exponente, o con una librería del
  estilo de break_infinity.js (la base de muchos juegos incrementales). Notación científica en la vista.
- Costes polinómicos al principio y exponenciales al final (regla de Lkowalski).

### 3.3 Tiempo y offline
- **Tick lógico a 10 Hz** en el núcleo; la vista pinta a 60 fps.
- **Offline en tres pasos al volver:**
  1. Tiempo ausente = ahora − último guardado, con tope configurable (propuesta: 12 h; decidir, ver §6).
  2. Producción por delta: `material += tasa × tiempo` (cerrado, coste constante).
  3. Eventos discretos (la losa cae, se abre una banda) se resuelven en orden, uno por uno, con un límite
     de iteraciones. El resumen de regreso lista qué pasó, en orden.
- Si se pierde la pestaña, no pasa nada: el delta se calcula al volver.

### 3.4 Anti-trampas (medio alcance)
- Como en Idle Deepcore o Idle Miner, el juego es de un solo jugador en un navegador. La tabla de tiempo
  se puede alterar cambiando el reloj del equipo (la objeción de GeekExtreme). Se acepta el riesgo, con un
  límite de tope y sin servidor. Si más adelante hay tabla de clasificación, sí hace falta servidor.

### 3.5 Pruebas (lo que ya sabemos hacer)
- **Bot de equilibrio en Node:** juega N días simulados con una política simple (compra lo más barato que
  mejora la tasa). Imprime la curva de producción, de losas y de reinicios. Es el equivalente a `test/profundidad.js` pero para la economía.
- **Pruebas de regresión del tope offline:** que «ausente 2 h» dé lo mismo que «ausente 2 h en pasos de 1 min»
  dentro de una tolerancia.
- **Pruebas de la vista:** la de siempre (`test/*.js` con Chrome): tamaños, texto que cabe, nada duplicado.

---

## 4 · Interfaz (con las reglas del dueño)

- **Pantalla principal:** el nido en corte transversal (como hoy) con la tabla de bandas a la izquierda y el
  panel de mejoras a la derecha. Ninguna cifra repetida (regla: «prohibido duplicar controles/cifras»).
- **UI una por una:** cada pantalla nueva (vitrina, árbol de linaje, mapa de migración) se aprueba antes de
  pasar a la siguiente. Las puertas `COLONIA` / `HISTORIAL` siguen selladas hasta que las pida.
- **Tamaño:** comprobación obligatoria en cada agrandado de texto o panel («que todo quepa bonito»).
- **Primeros 30 segundos:** la reina cava y la primera mejora sale sola. Sin texto de tutorial salvo una frase.
- **Regreso:** un resumen tipo «mientras no estabas», con dos caminos sugeridos para la siguiente decisión
  (lección de Lkowalski).

---

## 5 · Fases, con criterio de salida

Cada fase deja algo jugable o medible. Ninguna se empieza sin que la anterior pase su criterio.

### Fase 0 · Documento de diseño (GDD)
- Pilares, recursos, curvas objetivo (qué se espera a las 1 h, 1 día, 1 semana), tabla de bandas, losas,
  capas de reinicio y arco.
- **Criterio:** el dueño aprueba los pilares y las decisiones de la §6.

### Fase 1 · Núcleo económico y bot de equilibrio (sin interfaz)
- Estado, producción, costes, tope offline, guardado y migración. Bot en Node.
- **Criterio:** la curva de 24 h simulada cae en la franja del GDD; offline ≈ online dentro de tolerancia.

### Fase 2 · Primer lazo jugable (ciclo de 30–60 min)
- Cavar a mano, tres tipos de obrera, banda 1 a 3, primera losa, primer vuelo nupcial.
- Vista de resumen (sin hormigas animadas todavía).
- **Criterio:** una persona que no conoce el juego llega al primer vuelo nupcial en 1–2 horas sin guía escrita.

### Fase 3 · Capas de reinicio, migración y bandas por semilla
- Ámbar, semillas, mundos generados, rasgos heredados.
- **Criterio:** dos mundos con la misma semilla dan la misma curva; dos semillas distintas dan curvas distintas
  pero comparables.

### Fase 4 · Offline completo y regreso
- Resumen de regreso con eventos en orden y dos caminos sugeridos.
- **Criterio:** volver tras 12 h muestra un resumen legible y el estado es coherente (sin números absurdos).

### Fase 5 · Contenido y arco
- Nueve trofeos con bono, arco de tres actos, eventos ocasionales (una tormenta que inunda una banda, un
  topo que cava un túnel nuevo).
- **Criterio:** arco jugable completo en 15–25 horas medidas con bot y con dos personas.

### Fase 6 · Vista «mirar» y pulido
- Reincorporar las hormigas animadas como modo opcional, medido a 60 fps con el nido completo.
- **Criterio:** el modo mirar no baja de 40 fps con 34 obreras en un portátil común.

### Fase 7 · Equilibrio final y lanzamiento
- Ajuste fino con datos del bot y de pruebas humanas. Página de publicación (GitHub Pages, como ya está
  en el taller).

---

## 6 · Decisiones que necesito del dueño

1. **Ritmo objetivo:** ¿sesiones de 5–10 minutos varias veces al día (tipo Cookie Clicker), o de 30–60 minutos
   una o dos veces al día (tipo Idle Miner Tycoon)? Cambia todo el ritmo de las curvas.
2. **Tope offline:** 8 h, 12 h o 24 h. Recomiendo 12 h (ver la comparación de §1.2).
3. **Monetización:** ninguna, publicidad o compra única. Mi recomendación: compra única o gratuito, sin
   anuncios que rompan el ritmo.
4. **¿Qué pasa con la física animada?** Propongo mantenerla como modo «mirar». ¿Estás de acuerdo o la
   retiras para ganar espacio?
5. **Nombre del juego:** «Antfarm: Cava hondo», «Hormiguero profundo» u otro.
6. **Arco narrativo:** ¿quieres un final? Universal Paperclips tiene uno; Trimps no. Si sí, ¿qué tono
   (oscuro como Paperclips, cálido, o científico)?
7. **Cerebro:** ¿confirmas que la inteligencia de las hormigas entra como rasgo heredado en la capa 3 y no
   como sistema de aprendizaje en la versión idle?

---

## 7 · Riesgos y cómo se controlan

| Riesgo | Control |
|---|---|
| Que el juego sea «un clicker con hormigas» sin nada que decidir | Cuellos de botella explícitos (ascensor, almacén), losas y dos caminos sugeridos al volver |
| Que la física cueste más que el resto junta | Separar núcleo y vista desde la fase 1; la vista no se carga offline |
| Que el reinicio se perciba como castigo | Capas con moneda y regla nuevas; ámbar sin redondeos que castiguen (lección Teiton) |
| Que el offline sea injusto o absurdo | Tope configurable, pruebas de regresión, resumen legible |
| Que el arco alargue el juego sin contenido | Arco de 15–25 horas, contenido sin fin opcional |
| Que se pierda la identidad (hormigas + losas) | Los tres sellos: la losa colectiva, las bandas con mineral, el linaje heredado |

---

## 8 · Lo que ya tenemos y ahorra trabajo

- **Escalera de profundidad, bandas, minerales y losas:** ya construidas y medidas (`test/profundidad.js`,
  34 pruebas en verde).
- **Reliquias y vitrina:** ya existen; solo cambian de rol.
- **Guardado con migración:** ya existe (`serializeSave`).
- **Bancos de prueba en Chrome:** ya existen (`test/*.js`).
- **Vuelo nupcial:** ya está nombrado en el código como idea; falta hacerlo capa 1.

Lo que **no** existe y hay que construir: el núcleo económico separado de la vista, el tope offline con
resumen de regreso, las capas 1–3, la separación de números grandes y el bot de equilibrio.

---

## 9 · Siguiente paso

Cuando contestes las siete decisiones de §6, escribo el GDD (fase 0) como documento, con curvas numéricas
objetivo y el primer borrador de la tabla de bandas para el juego idle. Solo después se empieza la fase 1.


---

## 10 · Actualización de decisiones (Topo, 2026-10-16)

Estas respuestas reemplazan a las preguntas de §6:

| Tema | Decisión del dueño | Cómo queda en el plan |
|---|---|---|
| **Visuales** | Estilo voxel actual, con más detalle donde haga falta. | La vista sigue siendo voxel. Se permite más detalle (bordes, sombras, texturas de banda) sin cambiar el lenguaje visual. Nada de sprites planos. |
| **Tope offline** | Crece con el progreso; una mejora visible, tipo crecimiento del nido. | Propuesta de escalones: 4 h al inicio, 8 h con la primera cámara, 12 h con el linaje, 24 h en la última etapa. Cada salto se ve en el nido. Nunca se compra con dinero (ver MONETIZACION.md). Valor inicial: 4 h, a validar con el bot de equilibrio. |
| **Idioma** | El juego entero pasa a inglés. | Inglés como único idioma del juego. La documentación interna puede seguir en español. Hay que traducir interfaz, diario, nombres de reliquias y bandas, y el splash. Conteo aproximado en español: unas 680 líneas con acentos en `app.js`, 96 en `index.html` y 8 en `splash-topo.js`. Es una subestimación y merece fase propia. |
| **Lore y final** | Se trabaja poco a poco. | La fase 5 mantiene el arco de tres actos como esqueleto. El texto narrativo se escribe por bloques y se revisa contigo antes de integrarlo. |
| **Inteligencia** | Crece conforme avanza el juego; la forma aún no está definida. | Propuesta: el cerebro crece por etapas (8 neuronas al inicio, 12 con la primera migración, 16 con el linaje). Cada etapa añade capacidades concretas. Sin aprendizaje en vida (eso va en CEREBRO-ABIERTO.md, 8.2). Pendiente de tu confirmación. |
| **Ritmo** | Lo decido yo; ver §11. | Recomendación en §11. |
| **Nombre** | Abierto. | Se decide con el GDD (fase 0). |
| **Monetización** | Estudio exhaustivo, sin pay to win. | Ver `ant-farm-rpg/docs/MONETIZACION.md`. Propuesta v2: juego gratis, sin anuncios; dos monedas (una ganable jugando, una premium ganable despacio o comprable); compras sólo cosméticas, distintivos y conveniencia con tope; nunca producción, suerte, tope offline, inteligencia ni bandas. |

### 11 · Recomendación de ritmo

Dos capas:

1. **Partida activa de 10 a 20 minutos**: qué banda abrir, dónde mandar la cuadrilla, cuándo romper una losa.
2. **Visitas de 2 o 3 veces al día**: el juego ya avanzó solo, y el resumen de regreso propone dos caminos. Las sesiones de juegos idle suelen durar entre 30 minutos y 2 horas ([GeekExtreme](https://www.geekextreme.com/idle-games-offline-progression-math/)).

No propongo un ritmo de 5 minutos tipo Cookie Clicker: el juego tiene mapa, bandas y losas, y necesita más tiempo para que cada banda se sienta. Tampoco un ritmo de horas diarias tipo Idle Miner Tycoon: ese modelo depende de anuncios y atajos que queremos evitar. El jugador debe poder dejar el juego sin sentir que pierde.

### 12 · Cambios en las fases

- **Fase 0 (GDD)**: tope offline por etapas, cerebro por etapas, inglés como único idioma, regla de monetización como requisito.
- **Fase 2**: primera pasada de textos en inglés.
- **Fase 2.5 · Idioma** (nueva): traducción completa y comprobación de que no queda texto en español en la vista de jugador.
- **Fase 5**: lore por bloques con revisión.
