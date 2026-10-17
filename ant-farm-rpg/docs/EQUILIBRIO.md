# EQUILIBRIO · Objetivos v0 y bot reproducible

**Estado (2026-10-17):** T1–T5 aceptados como primera versión al pedir el dueño «sigue tus
recomendaciones y procede». Desde 5 días, `test/bot-equilibrio.js` aprueba o falla; ya no son avisos.
Los cinco objetivos pasan en las 12 semillas de referencia. No se arregló ningún fallo moviendo su umbral.

**Decisión de la losa:** la colonia la rompe sola. El jugador podrá ayudar u orientar más adelante,
pero el progreso idle no depende de un clic.

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

## 2 · Parón fundacional y salida al prado

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

Pruebas: `test/paron-fundacion.js` y `test/salida-superficie.js`.

## 3 · Primera losa y mundo expandido

Medir T4 mostró que 120 excavaciones laterales podían dejar intactos los 68 HP de la primera losa. No
faltaba velocidad bruta: faltaba una dirección de trabajo.

La solución conserva la excavación emergente y añade una sola obra colectiva:

- **frente principal:** a partir de GEN1 o del día 3, una obrera mantiene el pozo dentro de las tres
  columnas de la boca; las demás siguen abriendo cámaras según su red;
- la cuadrilla sólo acepta un frente conectado a su galería. Si una bolsa de aire aislada parece más
  profunda, el BFS la descarta; si una ruta deja de existir, suelta ese frente y elige otro;
- si la despensa toca 5, conserva la calada pero espera. No acepta una excursión de comida desde el fondo
  salvo crisis real; las recolectoras reponen y la obra continúa al superar la reserva;
- en galerías de una celda, la ruta recentra a la obrera si su centro está en aire pero el radio físico
  quedó mordiendo una arista. No atraviesa suelo;
- en ese primer pozo el escombro queda en un montón profundo con coste higiénico, en vez de obligar a
  subir cada bloque por separado;
- la cadena rápida termina al romper la **primera** losa. La segunda vuelve al ritmo normal;
- tras expandir, el enrutado cacheado puede recorrer el mapa nuevo y su límite crece con `COLS×ROWS`;
- `expandWorld()` crece a la vez `ROWS`, `H`, el lienzo y las filas de `water`; física, cámara y despensa
  ya no siguen sujetas al alto anterior hasta recargar.

Durante esta medición apareció y se corrigió otro fallo: un tándem entregaba a la seguidora la carga
`{amount}` como si fuera un objetivo `{x,y}`. El ángulo pasaba a `NaN` y `loop()` ocultaba la excepción.
Ahora un tándem solo nace si queda una fuente real con coordenadas.

Pruebas: `test/primera-losa.js`, `test/expansion-agua.js` y `test/tandem-objetivo.js`.

## 4 · Lote de referencia: 12 semillas × 5 días

Mundo pequeño 48×28, sin jugador, código real (`app.js + core/`), semillas 1–12. Se capturan también
los errores internos que `loop()` normalmente registra en consola.

Corrida del 17 de octubre de 2026, después de cerrar T1–T5:

| Medida final | Rango |
|---|---:|
| Obreras vivas | 12–20 |
| Comida | 6,4–156,4 |
| Entregas | 22–137 |
| Bloques excavados | 21–80 |
| Parón final sin completar un bloque | 0–1,03 días |
| Primeras losas rotas | 1 en las 12 semillas |
| Segundas losas rotas | 0 |
| Excepciones internas | 0 |

No hay ninguna fundación inmóvil ni una colonia por debajo de la reserva al cierre. La dispersión de
comida sigue siendo amplia y queda como trabajo de equilibrio posterior, no de reproducibilidad.

## 5 · Objetivos v0

«Día 3» significa el día de calendario 3 completo (`3,00..3,99`), igual que en el bot.

| Id | Objetivo | Resultado en 12 semillas | Estado |
|---|---|---:|---|
| T1 | La comida nunca baja de 5 hasta el día 5 | 12/12 · mínimo 5 | Cumple |
| T2 | Hay 6 obreras vivas al día 3 | 12/12 · 8–9 obreras | Cumple |
| T3 | Hay 10 obreras vivas al día 5 | 12/12 · 13–20 obreras | Cumple |
| T4 | La primera losa cede antes del día 5, sin jugador | 12/12 | Cumple |
| T5 | Nace la primera generación antes de terminar el día 3 | 12/12 · GEN1–2 | Cumple |

La reserva de cinco raciones vive en `core/economia.js`: puesta y cría no la consumen. Antes de llegar a
diez obreras, la fundadora puede terminar una puesta pagando el faltante con salud; no aparece comida de
la nada. Cada bloque realmente excavado aporta 8 XP y cada obrera eclosionada 20 XP; ambos liquidan nivel
en el instante. Así excavar, criar y entregar cuentan como trabajo evolutivo, sin bajar el umbral de T5.

El lote multisemilla, no una sola corrida, sigue siendo la autoridad para equilibrar.

## 6 · Siguiente paso, sin cambiar umbrales

1. Mantener T1–T5 como puerta de regresión y ampliar más adelante a más semillas y tamaños de mapa.
2. Reducir la dispersión final de comida (6,4–156,4) sin aplanar personalidades ni resultados.
3. Migrar `colonyFood` y `worldMaterials` al libro de cuentas puro de `core/`; las reglas ya probadas no
   deben volver a repartirse entre la UI y la simulación.
4. Continuar la traducción a inglés de `app.js` e `index.html`, conservando una sola cifra y un solo control
   para cada dato.
