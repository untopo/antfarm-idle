# EQUILIBRIO · Objetivos provisionales y medidas del bot

**Estado:** PROVISIONAL. Los objetivos los aprueba o cambia el dueño. Hasta entonces, el bot los
muestra como AVISO y no cambia el código de salida de `test/bot-equilibrio.js`.

**Método:** `node test/bot-equilibrio.js [dias]` corre el juego real (app.js + core/) en Node, sin
jugador. Mide cada medio día. Los números de abajo son de corridas de 4 y 5 días en el mundo pequeño
(48×28). El azar del juego no tiene semilla, así que cada corrida difiere; por eso se dan rangos.

## 1 · Lo que se mide (rangos de tres corridas de 5 días)

| Día | Obreras | Comida (mín–máx) | Entregas | Excavadas | Generación | Losas rotas |
|---|---|---|---|---|---|---|
| 1 | 4 | 11–13 | 3–5 | 1–6 | 0 | 0 |
| 3 | 6–8 | 4–6 | 3–5 | 23–42 | 0–1 | 0 |
| 5 | 6–9 | 3–10 | 4–19 | 49–50 | 1–4 | 0 |

**Hallazgos (no corregidos, a investigar):**
1. **Parones tempranos.** En la corrida 3 se cavaron solo 1 bloque durante casi tres días; la comida llegó a 192 después, y las entregas a 136. En la corrida 2 las entregas se quedaron en 3 hasta el día 5. Es decir: la fundación no siempre arranca sola.
2. **La primera losa no cede sin jugador.** En ninguna corrida se rompió una losa en 5 días. El objetivo de hora 1 de `CONSTRUCCION_IDLE.md` § 5 no se cumple sin intervención.
3. **La generación llega tarde o no llega.** La primera generación aparece entre el día 3 y el día 4, o no aparece antes del 5.
4. **La comida baja a 1–4 en varias corridas** antes de recuperarse. Eso es poco margen si el jugador no interviene.

`foundacion-dias` (2,5 días) pasa en la mayoría de los casos y por eso no detecta los parones. Un parón
de 2 días sin excavar debería ser una prueba propia cuando se investigue.

## 2 · Objetivos provisionales (los mismos que muestra el bot)

| Id | Objetivo | Medida en el bot | Estado en las corridas |
|---|---|---|---|
| T1 | La comida nunca baja de 5 hasta el día 5 | mínimo de comida | Falla en 2 de 3 corridas |
| T2 | 6 obreras vivas al día 3 | obreras en el día 3 | Cumple en 2 de 3 |
| T3 | 10 obreras vivas al día 5 | obreras en el día 5 | Falla en las 3 (8–9) |
| T4 | La primera losa cede antes del día 5 | losas rotas | Falla en las 3 (0) |
| T5 | Primera generación antes del día 3 | generación en el día 3 | Falla en 2 de 3 |

Los valores de T1–T5 son propuestas mías, no decisiones: nacen de la curva medida y de la
«primera hora» de `CONSTRUCCION_IDLE.md`. Ninguno tiene todavía respaldo del dueño.

## 3 · Decisiones que hacen falta

1. ¿Aceptas T1–T5 como primera versión, o quieres otros valores?
2. ¿Investigamos los parones (hallazgo 1) antes de la traducción o después? Recomiendo antes: un juego que a veces se para no es «jugable» aunque esté traducido.
3. ¿La losa de hora 1 debe caer sin jugador (T4) o la rompe el jugador (la colonia la mordisquea, pero no la termina)?
