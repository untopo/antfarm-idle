# CEREBRO ABIERTO — que aprendan de verdad, medido en el propio código

**Topo (2026-10-16):** «yo sí quiero que de verdad posean inteligencia artificial, sí quiero que aprendan
libremente, no hasta donde el código indique. quiero que de verdad posean una inteligencia artificial propia,
a parte de esas cosas por herencia y demás. ¿es posible?»

**Respuesta, en una frase:** «aprender libremente, no hasta donde indique el código» no se puede
especificar —ningún aprendiz aprende fuera de un espacio que alguien definió—; **sí** se puede llegar a
que **la conducta no esté escrita en ninguna parte**: que el código contenga el cuerpo, los sentidos y la
regla de aprender, y que lo que cada hormiga sabe lo haya adquirido ella, en su vida, dentro de tu
partida. Eso es alcanzable aquí, con lo que cuesta verlo, y abajo está medido.

---

## 1. Lo que hay hoy (leído del fichero, no de memoria)

| Hecho | Dónde | Qué significa |
|---|---|---|
| La red es `11 sensores → 8..16 neuronas → 5 salidas`, `tanh`, dos capas | `app.js:1545` (`INPUT_SIZE=11, HIDDEN_INIT=8, OUTPUT_SIZE=5`), `forwardNN` en `1550-1553` | Con `hiddenSize=8` son **141 números** por hormiga (8·11 + 8 + 5·8 + 5); con el tope de 16, **277** (16·11 + 16 + 5·16 + 5). Ese es el cerebro entero. |
| Las 5 salidas son **`steer`, `thrust`, `digIntent`, `comm1`, `comm2`** | `app.js:3679` | La red **no decide qué hacer**: modula un rumbo y una fuerza. El «qué» (CAVANDO, NODRIZA, RECOLECTANDO…) lo elige la máquina de estados de `updateAnt`, escrita a mano. |
| `ant.nnHidden = hidden` se guarda **pero no se reinyecta** | se asigna en `3676`, se lee solo para dibujar el panel en `7102` | No hay estado entre cuadros: la hormiga no recuerda nada. El sitio donde iría la memoria **ya existe** (ahí se gasta el hueco). |
| El aprendizaje es **entre generaciones**, no dentro de la vida | `mutateGenome` (`1566`, tasa 0,13, fuerza 0,6) y `crossover` | Lo que mejora es la estirpe, no la hermana que tienes seleccionada. Es herencia, exactamente lo que dices que ya no te basta. |
| A x16 la red corre **una vez cada ~5 cuadros** | `ant._nnCooldown = gameSpeed>8? 5.2 : 0` (`3677`) | Presupuesto: hoy ya vamos justos de CPU para 34 hormigas a x32 (mediana 16,4 ms/cuadro con el mapa de la Escalera). Cualquier cerebro nuevo tiene que caber ahí. |

Dicho sin rodeos: **hoy no hay una inteligencia que aprende; hay un repertorio de reflejos afinado por
selección, encima de un guion escrito a mano.** Con 141 números (8 neuronas), un disparo por cuadro y sin que la
hormiga aprenda nada en su vida, la promesa de «pensar» no se cumple ni en un millón de generaciones.

## 2. Por qué «no hasta donde el código indique» no es una especificación

Todo sistema que aprende vive dentro de cinco cosas que alguien escribió: **qué puede sentir**, **qué
puede hacer**, **qué cuenta como bueno** (la recompensa), **cómo actualiza** su cerebro y **cuánto
tiempo le dejan pensar**. Fuera de eso no hay «libertad»: hay ruido. Lo que sí cambia de forma continua
y no se puede enumerar de antemano es **lo que aprenden dentro de ese espacio**, y puede ser muchísimo
más de lo que nadie programó: estrategias de túneles, turnos, cuándo abandonar un filón, a quién seguir.

La meta honesta, y la única que se puede probar, es esta:

> **Quitar el guion.** Que no exista en el fichero una línea que diga «si tienes hambre, ve a la despensa»;
> que la hormiga lo descubra porque la dejó de tener hambre y le fue mejor. Entonces lo que ves en la
> pantalla no lo ha escrito nadie, y el código que queda sigue siendo legible: es el cuerpo y la regla.

## 3. La escalera del cerebro (P8) — cada peldaño, lo que toca y su prueba

| # | Peldaño | Mecanismo nuevo | Qué hay que tocar | Cuánto cuesta (taller) | Cómo se verifica (prueba que lo sostiene) |
|---|---|---|---|---|---|
| **8.0** | **Medir la dependencia del guion** (primero saber, luego prometer) | Un interruptor `POLITICA='maquina'\|'red'`: con `'red'` las 5 salidas mandan de verdad (rumbo, empuje, cavar, comunicar) y la máquina de estados solo pone *metas*, no movimientos. | ~40 líneas en `updateAnt` + el flag. Sin riesgos con el flag en `'maquina'`. | 1 jornada | `test/cerebro-red.js`: la colonia con `'red'` a los 5 días — cuántas obreras viven, cuántas raciones entregan, cuántos bloques cava, contra la partida con `'maquina'`. **El número esperado es malo** (probablemente muera). Ese número es el presupuesto real del resto de la escalera, y es lo que le voy a enseñar antes de tocar nada más. |
| **8.1** | **Memoria** (el peldaño que más cambia lo que se ve) | `h[t]` recurrente por hormiga: el vector oculto de la llamada anterior vuelve a entrar (`g.hPrev`); con eso puede mantener una intención y deja de ser un reflejo. | 2 filas en `forwardNN`, 8..16 floats por hormiga en el guardado. El hueco ya está (`nnHidden`). | 1 jornada | Que **dos hormigas con los mismos sensores en el mismo cuadro hagan cosas distintas según lo que venían haciendo**; y que el estado sobreviva a `save/load`. |
| **8.2** | **Aprender en vida — la pieza que responde a tu pregunta** | **Entrenamiento en línea dentro del navegador**: un `Worker` corre una copia headless de la propia simulación y entrena la política con **PPO** (o, más barato, estrategias evolutivas con CRN) contra la recompensa del juego (raciones entregadas, cría que eclosiona, túneles nuevos, horas sin atascos). Los pesos viajan al lienzo y **se guardan en la partida**. | El worker + un mini-motor de gradientes (autograd de ~200 líneas sobre arrays planos, o `ES` sin gradientes en ~60) + el canal de pesos + el guardado. El `updateAnt` debe poder correr aislado (ya se hace en `test/world-perf-proflib.js`, que usa el `app.js` real en un DOM de juguete: el camino está andado). | 4-6 jornadas | **Que la colonia del día 40 sea medible y visiblemente mejor que la del día 1 con la misma semilla**: menos días por ración, menos tiempo encajada, túneles más cortos hacia la comida. Y la prueba de que *no es el guion*: con `POLITICA='red'`, la curva de mejora sube **dentro de una vida** (no de una generación) y al resetear los pesos vuelve a caer. |
| **8.3** | **Curiosidad** (para que aparezcan cosas que no se me ocurrieron) | Término de novedad en la recompensa: mapa de casillas ya vistas / error de predicción. Sin esto, 8.2 solo optimiza el camino a la despensa. | Un término en la recompensa + un `Uint8Array` de «visto». | 1 jornada | Que **exploren suelo no necesario**: medido como casillas nuevas por día sin bajar las entregas; y que alguien baje a la losa sin que nadie se lo mande. |
| **8.4** | **Cultura / imitación** | Las crías copian la secuencia de acciones de una hermana buena durante sus primeros pasos (aprendizaje por imitación, sin gradientes), además de heredar los pesos. | Una cinta corta por obrera (`history` ya existe) + muestreo al nacer. | 2 jornadas | Comparar, con y sin imitación, el coste en días de llegar a la misma galería; y verlo en el árbol: «las hijas de esta nodriza cavan como ella». |
| **8.5** | **Que la tinta signifique algo aprendido** | El canal de comunicación (ink/feromona) pasa a ser un símbolo cuyo significado se ajusta con el uso: la que emite recibe premio si otra actúa en consecuencia. | Recompensa cruzada emisor/receptor; el símbolo ya existe (`symbolForComms`). | 2-3 jornadas | Prueba de transmisión: una hormiga descubre X, **no hace nada con ello**, y las demás actúan sobre X sin volver a pasar por el sitio. |
| **8.6** | **Lo que hay que decirte sin adornos** | Ni con 8.0-8.5 hay una mente: hay una criatura con memoria, plasticidad, curiosidad y tradición. Un cerebro que «piense como humano» (o mejor) necesita otra cosa: redes de millones de parámetros, lenguaje, y un entrenamiento que aquí no cabe ni en un móvil. | — | — | Si alguna vez prometo «pensarán como nosotros», dime que he caído en el teatro. |

**Presupuesto de cuadro (medido, no estimado):** con la Escalera puesta, el mundo de 70 filas y 34 obreras
va a **mediana 16,4 ms · p95 25,5 ms** con 2.600-3.200 `fillRect` por cuadro. Un worker de entrenamiento
trabaja en **otro hilo**, así que el lienzo no paga nada; lo que paga es batería y calor, y por eso el
entrenador tiene que venir con marchas (actividad / pausa / noche del juego) y con un tope de pasos por
segundo que se pueda cortar desde la barra.

## 4. Lo que es teatro, y por qué no lo voy a vender como otra cosa

- **Un LLM en el navegador** (WebGPU + WebLLM/transformers.js). Suena a la respuesta, y para lo que pides
  no lo es: el modelo abierto más pequeño que razona en voz alta pesa ~0,5-1 GB, cuesta ~100-200 ms por
  inferencia y da **una** respuesta por turno. Para 34 hormigas por cuadro es tres órdenes de magnitud
  fuera de presupuesto, y para un idle que se abre en el móvil, tres órdenes de magnitud fuera de
  descarga. Donde sí encaja es como **narrador** (el sueño de la colonia, el parte del día en lenguaje
  natural, fuera del bucle de decisión) y como **planificador lento** (una meta por día para la colonia,
  no una por cuadro por hormiga). Eso es opcional, necesita el modelo en un CDN y no es la inteligencia
  *de ellas*.
- **Un servidor que decida por ellas**: alquiler de inteligencia ajena, con coste mensual, dependiente de
  red y muerto el servidor muerta la colonia. Rompe lo que hace bueno a este juego (que es tuyo y funciona
  sin pedir permiso).
- **«Aprendizaje» de mentira**: subir contadores, pintar una curva y escribir en el registro «la colonia
  mejora con el uso». Si no se puede cortar por lo sano (reset de pesos → vuelve a caer), no es aprendizaje.

## 5. Lo que necesito que decidas (son tres, no una)

1. **¿Tiro de 8.0 primero?** Cuesta una jornada y no cambia nada para quien juegue (el flag queda en
   `'maquina'`). Entrega un número incómodo: cuántos días tarda en morir una colonia mandada solo por su
   red de 141 números. Si no lo medimos, todo lo demás es fe.
2. **¿Aceptas que aprendan despacio de verdad?** 8.2 no da una colonia lista mañana: en un portátil, del
   orden de decenas de minutos a un par de horas de ventana abierta por cada salto visible. La alternativa
   (entrenar más y enseñar una colonia ya lista en la primera partida) es **la inteligencia de otro**, no
   la suya: pesa un fichero de pesos que yo genero y que solo crece en mi taller.
3. **¿El andamio se quita?** Tres opciones: la red manda desde el día uno y la colonia sufre (juego
   honesto y duro); la máquina de estados es andamio y se retira por días (recomendado: se puede ver, se
   puede medir, no mata el arranque); o andamio para siempre (entonces no es 8.2, es 8.1 con ruido).

Mientras no contestes, no toco el cerebro. Lo que sí he hecho mientras tanto es **cerrar el flash de las
cuevas y ponerles pared de fondo** (ver `docs/PROFUNDIDAD.md` §10 y `test/fondo-cueva.js`): un juego que
aprende no se puede mirar con la textura parpadeando.
