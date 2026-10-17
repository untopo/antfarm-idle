# EQUILIBRIO · Objetivos v0 y bot reproducible

**Estado (2026-10-16):** T1–T5 aceptados como primera versión al pedir el dueño «sigue tus
recomendaciones y procede». Desde 5 días, `test/bot-equilibrio.js` aprueba o falla; ya no son avisos.
No se arregla un fallo moviendo su umbral.

**Decisión de la losa:** la colonia debe romperla sola. El jugador puede ayudar u orientar más adelante,
pero el progreso idle no puede depender de un clic. Por eso T4 sigue rojo y no se rebaja.

## 1 · Método reproducible

```bash
node test/bot-equilibrio.js [dias=2] [semilla=1]
node test/diag-parones.js [semilla=1] [dias=3]
node test/diag-parones.js barrido [dias=3] [numero-de-semillas=12]
```

El arnés fija `Math.random` **antes** de evaluar `app.js` y hace que `Date.now()` siga al reloj simulado.
Cada semilla corre en un proceso nuevo, porque reiniciar el mundo no reinicia todo el estado global.
Dos ejecuciones de `bot-equilibrio.js 5 1` producen exactamente las mismas métricas (solo cambia el
tiempo real de cálculo).

Las primeras tres corridas anotadas en la versión anterior de este documento no eran reproducibles:
`app.js` consumía azar antes de sembrarlo y el bucle mezclaba reloj real con reloj simulado. Sirvieron
para descubrir el síntoma, pero sus rangos no se usan como referencia.

## 2 · Parón fundacional: causa y corrección

La semilla 1 reproducía el caso catastrófico: todas las fundadoras heredaban una salida neuronal de
cavado cercana a −1; tras más de tres días había **0 bloques abiertos**, aunque la colonia seguía viva.
Había además un segundo atasco: las recolectoras perseguían miel en la superficie pero no coronaban el
pozo de tres celdas.

Se corrigieron dos mecanismos, sin regalar recursos ni asignar profesiones:

1. **Reflejo colectivo mínimo.** Con despensa suficiente y ningún frente activo, la obrera libre con
   mayor rasgo de construcción abre uno. La red sigue decidiendo todas las excavadoras adicionales.
2. **Boca transitable.** La recolectora cruza primero al pie del pozo por el lado de su objetivo y trepa
   pegada a ese labio. La ruta manda durante un objetivo ya elegido; el giro neuronal sigue decidiendo la
   exploración libre. El agarre vence la velocidad de caída al trepar y alcanza 21 px en el borde diagonal.

Pruebas de regresión:

- `test/paron-fundacion.js`: semilla 1 abre frente y sigue viva.
- `test/salida-superficie.js`: con el código anterior, 0 entregas; con el nuevo, corona el pozo y entrega.
- `test/diag-parones.js`: expone estados, comida, generación, losa y objetos para diagnóstico.

## 3 · Lote de referencia: 12 semillas × 5 días

Mundo pequeño 48×28, sin jugador, código real (`app.js + core/`). Las doce semillas son 1–12.

| Medida final | Rango |
|---|---:|
| Obreras vivas | 10–20 |
| Comida | 18,8–193,4 |
| Entregas | 35–163 |
| Bloques excavados | 12–120 |
| Parón final sin completar un bloque | 0–0,51 días |
| Excepciones | 0 |

No hay ya ninguna corrida con cero excavación ni una fundación inmóvil. La dispersión sigue siendo alta:
forma parte del equilibrio pendiente, no de la reproducibilidad.

## 4 · Objetivos v0

«Día 3» significa el día de calendario 3 completo (`3,00..3,99`), igual que en el bot.

| Id | Objetivo | Resultado en 12 semillas | Estado |
|---|---|---:|---|
| T1 | La comida nunca baja de 5 hasta el día 5 | 10/12 | Falla en 5 y 9 |
| T2 | Hay 6 obreras vivas al día 3 | 12/12 | Cumple |
| T3 | Hay 10 obreras vivas al día 5 | 11/12 | Falla en 9 |
| T4 | La primera losa cede antes del día 5, sin jugador | 0/12 | Falla en todas |
| T5 | Nace la primera generación antes de terminar el día 3 | 11/12 | Falla en 11 |

La semilla 1, usada por defecto en el bot, pasa T1, T2, T3 y T5. T4 hace que
`node test/bot-equilibrio.js 5 1` termine en fallo, como debe.

## 5 · Próximo equilibrio, sin cambiar umbrales

1. **T4 primero:** concentrar la excavación vertical y hacer que la cuadrilla alcance, muerda y rompa la
   primera losa antes del día 5. En la semilla 9 se abren 120 bloques y aun así la losa conserva sus 68 HP:
   el problema es dirección de trabajo, no velocidad bruta.
2. **T1/T3:** estudiar las semillas 5 y 9. Ya salen al prado; falta margen de despensa y población.
3. **T5:** estudiar por qué la semilla 11 retrasa la primera generación al día 4,11.
4. Cuando T1–T5 pasen en el lote, ampliar a más semillas y mapas; no suavizar T1–T5 para obtener verde.
