# MONETIZACIÓN · Modelo free-to-play sin pago por ganar

**Estado:** propuesta de diseño. No hay nada implementado. Pendiente de confirmación del dueño (§7).
**Versión 2 (2026-10-16).** Sustituye a la versión 1, que proponía una edición de pago. El dueño descartó
que haya que comprar el juego: será gratis, con compras dentro del juego.

---

## 0 · Resumen

- **Gratis para jugar, sin anuncios, sin compra previa.**
- **Dos monedas:** una que se gana jugando (blanda) y una premium que se gana jugando muy despacio o se compra.
- **Casi todo se consigue sin pagar.** Lo que se compra con dinero directo son sólo cosméticos o artículos de apoyo.
- **Ninguna compra da poder**: nada que cambie producción, suerte, tope offline, inteligencia ni acceso a bandas.
- **Apoyo voluntario** (Ko-fi o Patreon) con créditos y un distintivo cosmético. No da ventajas.

---

## 1 · Qué dicen los juegos que mejor lo hacen

| Juego | Lo que hace | Lección |
|---|---|---|
| **NGU Idle** | Moneda premium comprable, pero **todas las compras se pueden ganar jugando**; paquetes de 10 y 20 USD como apoyo ([Reddit, r/incremental_games](https://www.reddit.com/r/incremental_games/comments/1au1ec3/what_is_your_preferred_monetization_for_idler/)). Su autor da paquetes con extras de comunidad y consumibles dentro del juego ([Reddit](https://www.reddit.com/r/incremental_games/comments/11kahac/fair_monetization_features_in_idle_games/)). | **El modelo más parecido al que quieres**: moneda premium ganable, compra opcional, ninguna compra salta muros. |
| **Warframe** | Moneda premium (Platino) comprable, y también **canjeable entre jugadores** por objetos ganados jugando ([CBR](https://www.cbr.com/free-steam-rpgs-no-notes/), [r/gamedesign](https://www.reddit.com/r/gamedesign/comments/132dj5h/what_are_some_honest_freetoplay_monetization/)). | Una moneda premium puede existir sin vender poder si se puede ganar. Lo de comerciar entre jugadores lo dejo para más adelante. |
| **Path of Exile** | Sólo cosméticos y pestañas de almacén ([Gamer Empire](https://gamerempire.com/blog/best-free-steam-games)). | Cosmética pura es lo más aceptado. |
| **Counter-Strike 2** | Cosméticos con mercado de jugadores, sin efecto en el juego ([Gamer Empire](https://gamerempire.com/blog/best-free-steam-games)). | Un mercado de cosméticos funciona a gran escala sin tocar la jugabilidad. |
| **Unity (guía de economía)** | La moneda premium se gana **en cantidades pequeñas** jugando o viendo anuncios de recompensa, y se compra por IAP; el ajuste es fijar el ritmo de ganancia a una unidad de tiempo y probarlo con datos ([Unity](https://unity.com/resources/game-economy-design-guide)). Recomienda sumideros rotativos para que la moneda no se acumule sin uso. | Base técnica para el reparto de moneda. |
| **Melvor Idle** | Compra única y expansiones de contenido, sin microtransacciones ([Steam](https://store.steampowered.com/app/1267910/Melvor_Idle/)). | Sirve de referencia, pero no es el modelo que quieres. |
| **Idle Miner Tycoon** | Súper managers comprables y anuncios que bajan de 4 h a 1 h al quitarlos ([Reddit](https://www.reddit.com/r/IdleMinerTycoon/comments/1bxnyp9/noads_purchase_options/)). | **Contraejemplo**: la compra da poder y el anuncio se vende como atajo. |
| **Cajas aleatorias (idle y gacha)** | Idle Miner tiene objetos aleatorios; Mining Crew se describe como fabricación de paquetes premium con probabilidad ([r/gachagaming](https://www.reddit.com/r/gachagaming/comments/1rlkaqs/discussion_an_idle_game_where_f2p_can_craft/)). | Evitar cajas. Usar compra directa con precio visible. |

**Regla de la comunidad** (r/incremental_games, [heavenlocke](https://www.reddit.com/r/incremental_games/comments/11kahac/fair_monetization_features_in_idle_games/)): si una compra hace que gane mucho más rápido que quien no paga, es pay to win. La regla de NGU aplica igual: ninguna compra salta un muro.

**Advertencia de verificación:** las clasificaciones de «fair» de listas como Gamer Empire son opiniones de sus autores, no datos. Los precios y modelos hay que comprobarlos antes de publicar.

---

## 2 · Modelo propuesto

### 2.1 · Monedas

| Moneda | Cómo se gana | Cómo se usa |
|---|---|---|
| **Blanda** (provisional: *Pollen*) | Jugando: cavar, sobrevivir, romper losas, misiones. Se acumula sin tope. | Mejoras normales del juego: cámaras, herramientas, crías. Siempre gratis. |
| **Premium** (provisional: *Honeydrop*) | Jugando, muy despacio: un ritmo fijo al día, y premios de hitos (losa rota, reliquia, arco). | Cosméticos, distintivos, conveniencia (ver §2.3). Se puede comprar con dinero. |

**Ritmo de premium jugando** (a validar con el bot): unas 30 unidades al día con una visita, y unas 60 si hay tres visitas. Un cosmético de precio medio se consigue en 1 a 2 semanas jugando. La compra directa existe para quien quiere el cosmético ya.

### 2.2 · Compra directa (dinero)

- **Paquetes sin trampas:** 3 niveles, por ejemplo 2,99 / 4,99 / 9,99 USD, con bonificación de 10 % a 20 % en los grandes. **Nada por encima de 19,99 USD** y sin cajas: el precio y el contenido se ven antes de pagar.
- **Precio visible**: cada cosmético muestra su precio en premium y su equivalente en dinero.
- **Ninguna compra acelera el progreso del juego.** Sólo se compran cosméticos, distintivos y conveniencia.

### 2.3 · Qué se puede comprar (y qué no)

| Categoría | ¿Se puede comprar con premium? | ¿Se puede comprar con dinero? | ¿Se puede ganar gratis? |
|---|---|---|---|
| Cosméticos de hormiga, nido y vitrina | Sí | Sí | Sí, con el ritmo de §2.1 |
| Distintivos y temas visuales | Sí | Sí | Sí, con hitos |
| **Conveniencia** (cola de excavación extra, plantillas de cuadrilla, recordatorio de losa) | Sí, con tope diario | Sí | Sí, con el mismo tope |
| **Artículos solo de dinero** (lote de apoyo, distintivo de supporter, cosmético exclusivo de edición) | No | **Sí, sólo esto** | No |
| Producción, suerte, tope offline, inteligencia, acceso a bandas | **Nunca** | **Nunca** | Sí, por progreso |

**Nota importante sobre conveniencia:** lo que se compra debe ser algo que el jugador gratis también
consigue en un tiempo razonable. Si la conveniencia acorta mucho la espera de algo clave, pasa a ser
pay to win. Por eso lleva tope diario, y los artículos clave de progreso nunca se venden.

### 2.4 · Apoyo voluntario

- Donación en Ko-fi o Patreon sin cantidad mínima. Recibe un **distintivo de supporter** y créditos en el juego.
- Opcional: el lote de apoyo de §2.3, sólo cosmético.
- Sin beneficios de juego. Lo que se paga no se devuelve como moneda blanda.

---

## 3 · Reglas que se escriben en el juego

1. Ninguna compra cambia producción, suerte, tope offline, inteligencia ni acceso a bandas.
2. Todo lo que se vende tiene una forma gratis de conseguirlo, salvo los artículos marcados como «solo dinero» (cosméticos y distintivos).
3. Sin anuncios, en ninguna versión.
4. Sin cajas aleatorias.
5. Precio y contenido visibles antes de pagar; cifras de premium por hora publicadas.
6. Las versiones de terceros (si las hay) siguen las mismas reglas.

---

## 4 · Lo que cambia en el plan

- **Fase 0**: el GDD incluye las dos monedas, la tabla de §2.3 y las reglas de §3.
- **Pruebas**: una prueba que confirme que ningún artículo de premium o de dinero toca `producción`, `tope`, `suerte`, `inteligencia` ni `bandas`. Y otra que confirme que todo lo vendible se puede ganar jugando, salvo los artículos marcados como «solo dinero».
- **Interfaz**: la tienda sólo se abre desde el nido, con precio visible. Sin pop-ups.
- **Sin versión de pago obligatoria**. Se elimina la edición de 4,99 USD de la v1.

---

## 5 · Riesgos

| Riesgo | Control |
|---|---|
| Que la conveniencia se convierta en atajo | Tope diario y ningún artículo clave de progreso a la venta |
| Que el premium se gane tan lento que moleste | Ritmo medido con el bot y ajustado; hitos frecuentes |
| Que la compra no venda nada | Medir conversión; ofrecer cosméticos de temporada |
| Que la moneda se acumule sin uso | Sumideros rotativos (guía de Unity) |

---

## 6 · Fuentes

- NGU Idle: [Reddit, opciones de monetización](https://www.reddit.com/r/incremental_games/comments/1au1ec3/what_is_your_preferred_monetization_for_idler/), [Reddit, monetización justa](https://www.reddit.com/r/incremental_games/comments/11kahac/fair_monetization_features_in_idle_games/).
- Warframe: [CBR](https://www.cbr.com/free-steam-rpgs-no-notes/), [r/gamedesign](https://www.reddit.com/r/gamedesign/comments/132dj5h/what_are_some_honest_freetoplay_monetization/).
- Economía de juegos: [Unity](https://unity.com/resources/game-economy-design-guide).
- Lista de juegos gratis: [Gamer Empire](https://gamerempire.com/blog/best-free-steam-games) (opinión, no dato).
- Modelos de referencia de la v1: Melvor Idle, Idle Miner Tycoon, Cookie Clicker y Universal Paperclips (ver historial del documento).

---

## 7 · Decisiones que necesito del dueño

1. **Nombres de las monedas** (provisional: Pollen y Honeydrop). El ámbar del plan ya es la moneda del vuelo nupcial; no lo reutilizo.
2. **Precios de paquetes:** ¿2,99 / 4,99 / 9,99 USD con tope de 19,99? ¿O prefieres otros valores?
3. **Conveniencia:** ¿la incluimos (con tope diario) o la dejamos fuera en la primera versión?
4. **Apoyo:** ¿Ko-fi, Patreon o los dos?
5. **Comercio entre jugadores** (estilo Warframe): ¿sí, más adelante, o nunca?


---

## 8 · Versión 3: síntesis con Obelisk Miner y Pixel Tribe (2026-10-16)

Esta sección **corrige y amplía** §2.3 y §3. Donde se contradice, manda esta.

### 8.1 · Lo que se aprende de los dos juegos que citas

| | **Idle Obelisk Miner** (Checkbox Games) | **Pixel Tribe** (Kvannli AS) |
|---|---|---|
| **Moneda premium** | Gemas. Se ganan en gran cantidad jugando: el cofre «freebie» cada ~10 min, bombas de loot, recompensas por completar obeliscos y códigos regalo ([fandom](https://obeliskminer.fandom.com/wiki/Store), [wiki](https://shminer.miraheze.org/wiki/Store)). | Gemas. Se ganan jugando, con vídeo (4 al día, 10 gemas cada uno) e invitaciones (100 gemas por amigo) ([fandom](https://pixel-tribe.fandom.com/wiki/Shop)). |
| **Qué compra** | Casi todo: habilidades, drones, bombas, cofres. Se usan para lo mismo tanto gratis como de pago. | Vikingos extra, recursos y un bono temporal de XP y eficiencia del 15 % con la membresía (150 gemas por 7 días). |
| **Publicidad** | **Ninguna**, ni opcional. | Anuncios sólo opcionales, para ganar gemas. |
| **Paquete de apoyo** | «Founders» (~25 USD): cargo en el Discord, bonus de tiempo y una bomba que da 2x de velocidad. Los jugadores comentan que el 2x lo acaban logrando también los gratuitos. | No hay un paquete equivalente. Las compras son gemas y la membresía. |
| **Almacenamiento de regalos** | Se pueden acumular hasta 184 cofres gratis, y hasta 304 si pagas ([wiki](https://shminer.miraheze.org/wiki/Store)). | — |
| **Lo que se critica** | El founder da 2x. Cuidado con que el pago dé más capacidad que el gratis. Y el juego tiene topes en casi todo, así que no es estrictamente idle. | La membresía da eficiencia, que es poder temporal. Los desarrolladores dicen que «no se puede pagar para saltar temporizadores ni para ganar poder», pero la membresía contradice esa frase. |

**Conclusión honesta:** ninguno de los dos está libre de críticas. El que mejor funciona es el de **gemas
abundantes para el jugador gratis**. Obelisk Miner dice que «con 2-3 meses el jugador gratis genera más gemas al día que
una compra de 100 USD»; es una afirmación de jugadores, no verificada. Pixel Tribe funciona porque el pago es casi
sólo cosmética y comodidad, pero su membresía sí es poder temporal.

### 8.2 · La regla de diseño que se deduce

> **Todo lo que se compra también se consigue jugando. Comprar es más rápido, nunca exclusivo.**

Esto es lo que pediste. Para que no degenere en pay to win, se añaden tres condiciones:

1. **Lo gratis tiene un ritmo conocido.** Cada artículo comprable tiene un «coste en tiempo jugando» publicado (por ejemplo: «X horas de juego gratis»). El jugador que paga sólo se salta esa espera.
2. **El poder temporal tiene techo.** Un bono de producción puede existir, pero su efecto máximo sólo puede igualar lo que un jugador gratis alcanza en un plazo razonable, y nunca superarlo. Si el pago da 2x, el gratis también debe poder llegar a 2x (lo que hace Obelisk Miner según sus jugadores).
3. **La capacidad no se vende por encima del gratis.** El almacenamiento de regalos, las colas y los topes offline tienen el mismo máximo para todos. Pagar sólo acorta el tiempo para llegar a él.

Como el juego es **para un jugador, sin competencia**, la preocupación principal no es que alguien te gane, sino
que sientas que el juego te hace esperar a propósito. Por eso el criterio es la espera, no la ventaja absoluta.

### 8.3 · Tabla revisada (sustituye §2.3)

| Categoría | Se puede comprar con premium | Se puede comprar con dinero | Gratis, por juego |
|---|---|---|---|
| Cosméticos, distintivos, temas | Sí | Sí | Sí |
| **Comodidad** (cola extra, plantillas, recordatorios, automatización de cuadrillas) | Sí | Sí | Sí, con el mismo tope |
| **Aceleración temporal** (bono de 15-30 min, bono de producción temporal ≤ 2x) | Sí | Sí | Sí, con su coste en tiempo publicado |
| **Almacenamiento y colas** (regalos guardados, tope de colas) | Sí, hasta el máximo común | Sí, hasta el máximo común | Sí |
| **Mejoras permanentes** (cámaras, herramientas, linaje) | Sí | Sí | Sí, siempre, con su coste de tiempo |
| Solo dinero | No | Sí, sólo cosméticos, distintivos y el paquete de apoyo | No |

**Lo que sigue sin venderse nunca:** la progresión de bandas (acceso a losas y pisos), el contenido de la historia y
la inteligencia de las hormigas (sólo crece por progreso).

### 8.4 · Cambios en §3 (reglas)

1. Todo lo comprable es ganable jugando, con coste de tiempo publicado.
2. Los bonos temporales tienen techo, igual que el gratis puede llegar.
3. El almacenamiento, colas y topes offline tienen el mismo máximo para todos.
4. Solo dinero: cosméticos, distintivos y el paquete de apoyo.
5. Sin anuncios, sin cajas aleatorias, precio visible antes de pagar.
6. Ningún paquete por encima de 19,99 USD y ningún paquete que dé más capacidad que el gratis.

### 8.5 · Decisiones que tomo yo (y las que son tuyas)

- **Tomo yo:** que ningún paquete supere 19,99 USD, que las cifras se publiquen y que el paquete de apoyo sea cosmético.
- **Tuyas:** (a) ¿aceptas que la aceleración temporal y los bonos de hasta 2x se vendan, siempre con el mismo techo para gratis? (b) ¿quieres un paquete de apoyo como el «Founders», que sólo da distintivo y cosmética, o nada? (c) ¿quieres que el coste de tiempo de cada artículo se publique en el juego?

### 8.6 · Sobre las monedas internas

Los nombres de las monedas y recursos los dejamos para la fase de historia, como dices. Mientras tanto, en el documento usamos «blanda» y «premium» como funciones, no como nombres.
