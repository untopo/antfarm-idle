# CONSTRUCCIÓN · Cómo levantar el juego idle sobre la base actual

**Estado:** propuesta de construcción. Nada de esto está implementado. Complementa a `PLAN_IDLE_HORMIGAS.md` (qué es el juego), `MONETIZACION.md` (economía) e `INVESTIGACION_IDLE.md` (referencias).

---

## 0 · La idea en una frase

**Volver para seguir lo que dejaste, no para evitar perder algo.** El jugador vuelve porque hay un
trabajo a medias (una cuadrilla cavando, una losa a medio romper, un cerebro que aún aprende), no porque
una cuenta atrás le amenace.

## 1 · Principios de diseño (la vara de medir)

1. **Trabajo abierto, no castigo.** Todo proceso guarda su progreso. Al volver se ve qué avanzó y qué queda.
2. **Dos caminos al volver.** El resumen propone una acción corta (5 min) y una larga (30 min).
3. **Sin energía, sin rachas, sin cuentas atrás que castiguen.** Ningún recurso se pierde por no entrar.
4. **Ritmo por capas.** Una partida activa de 10–20 min; visitas de 2–3 veces al día; y sesiones largas para quien quiera.
5. **Desbloqueos frecuentes al principio, espaciados después.** Un sistema nuevo cada 1–2 h al inicio; cada
   varias horas más adelante. Así el jugador aprende sin agobio y siempre tiene algo nuevo que ver.
6. **Notificaciones opt-in.** Por defecto, ninguna. Si el jugador las activa: máximo una al día, y nunca
   para «no pierdas tu racha».
7. **Profundidad, no sólo cantidad.** Cada banda, losa y reliquia debe cambiar una decisión. Si sólo añade un número, no cuenta.

## 2 · Qué ya existe (la base)

Según el estado del repo (`ant-farm-rpg`):
- **Mundo voxel** con cavado real, 8 bandas de tierra (escalera de 22 pisos en mundo pequeño), losas que
  bloquean la bajada, reliquias que se exponen en vitrina y roca de magma.
- **Hormigas con máquina de estados** y cerebro de 8 neuronas (141 pesos), obreras, reinas y cuadrillas.
- **Clima, cielo, partículas, cuevas con pared voxel y flash corregido**, medidos en `test/`.
- **Guardado** con `serializeSave`, progreso por ciclos y sistema de reliquias.
- **Batería de pruebas** (`test/run-all.sh`): perfil de bandas, pintado, pared de cueva, splash, no-orphans y navegador.
- **Idioma:** todo en español, unas 680 líneas con acentos en `app.js`. Hay que traducirlo.

## 3 · Arquitectura: separar el juego de la pantalla

El archivo `app.js` tiene unas 9.400 líneas. Mezcla economía, IA, dibujo y entrada. Para un juego con mucho contenido, eso ya no escala.

**Propuesta:** tres capas.

| Capa | Contiene | Reglas |
|---|---|---|
| **Núcleo** (`core/`) | Economía, progreso, bandas, losas, reliquias, cuadrillas, cerebro, tiempo, guardado | JS puro, sin DOM ni canvas. Se puede probar en Node. Recibe `dt` y devuelve estado. |
| **Contenido** (`content/`) | Tablas: bandas, mejoras, losas, reliquias, textos, arco | Datos, no código. Editables sin tocar lógica. |
| **Vista** (`view/` o `app.js` actual) | Dibujo voxel, interfaz, sonido, entrada | Lee el núcleo, no lo modifica directamente. |

**Migración sin romper nada (estrangulamiento):**
1. Extraer primero lo que ya es casi puro: `tipoDePiso`, `bandaDe`, `durezaDe`, `umbral`, `reliquias`. Mover a `core/`.
2. Crear `content/bandas.js` con la ficha de bandas ya existente (la tabla de §2 del documento de escalera).
3. Después: economía (`core/economia.js`) y progreso offline (`core/offline.js`).
4. La vista sigue funcionando. Cada extracción pasa la batería de pruebas antes de seguir.

Regla: **nunca dos cambios grandes a la vez**; una extracción por commit, con la batería verde.

## 4 · Progreso offline

- **Delta-time:** al volver, el núcleo avanza el estado con `dt` (no simula cada cuadro).
- **Tope que crece:** inicio 4 h; 8 h con la primera cámara; 12 h con el linaje; 24 h al final (decidido).
- **Resumen de regreso:** lista qué terminó, qué sigue, y los dos caminos (§1.2).
- **Prueba obligatoria:** un bot simula 1 h, 8 h y 24 h, y compara el resultado con el de jugar esas horas
  en el núcleo sin pausas. La diferencia máxima aceptada se fija antes de empezar.

## 5 · Contenido: cuánto y cuándo

Calibrado con los juegos de referencia y con lo que ya existe. Son **objetivos de diseño**, no datos medidos.

| Hito de tiempo jugado | Qué debe tener el jugador | Referencia |
|---|---|---|
| **0–1 h** | Primeras cuadrillas, primera losa, primera reliquia en vitrina | Ya existe casi todo |
| **1–5 h** | Cámaras, primera migración (reinicio de capa 2), 3 mecánicas nuevas | Obelisk, Pixel Tribe |
| **5–20 h** | Linaje (capa 3), cerebro con etapa 2, actos 1 y 2 del arco | Paperclips (3 actos) |
| **20–60 h** | Todas las bandas, todas las losas, acto 3, cerebro etapa 3 | Melvor (expansiones) |
| **60 h+** | Contenido de temporada o expansión, nuevos mundos | Antimatter, Melvor |

**Cifra honesta:** para llegar a 20 h con calidad hacen falta, como mínimo, unas 8–10 losas con mecánica
propia, 30 reliquias, 40 mejoras y 3 actos de texto. Es mucho para un solo autor; por eso el plan tiene fases
(§6) y el contenido se entrega por actos, no todo a la vez.

## 6 · Fases de construcción (sobre el plan existente)

| Fase | Entregable | Medida de salida |
|---|---|---|
| **0 · GDD** | Documento de diseño: monedas, bandas, actos, ritmo, reglas de §1 | Aprobado por el dueño |
| **1 · Núcleo** | `core/` con economía y bandas; bot de equilibrio | Bot corre 24 h simuladas en < 5 s |
| **2 · Primer lazo** | 0–1 h completa, con textos en inglés | Un jugador nuevo llega a la primera migración sin ayuda |
| **2.5 · Idioma** | Todo el texto en inglés; cero acentos en la vista | Búsqueda de acentos en vista = 0 |
| **3 · Capas y migración** | Capas 1–3 y reinicios; cerebro etapa 2 | Bot completa 3 reinicios sin errores |
| **4 · Offline completo** | Tope creciente, resumen, dos caminos | Prueba de §4 pasa |
| **5 · Contenido y arco** | Actos 1–3 por bloques, revisados contigo | Texto aprobado por bloque |
| **6 · Vista «mirar»** | Modo de contemplación; ≥ 40 fps con 34 obreras | Medición en el navegador |
| **7 · Equilibrio y lanzamiento** | Bot + jugadores de prueba; monetización de MONETIZACION.md | Sin quejas de espera injusta en las pruebas |

## 7 · Pruebas que definen «buen juego»

Además de la batería de tests actual, el juego necesita medidas de experiencia:
- **Tiempo hasta el próximo desbloqueo** (mediana y p90) en 0–1 h, 1–5 h y 5–20 h. Debe bajar en las primeras horas y estabilizarse después.
- **Dos caminos al volver:** el bot elige corto o largo; ambos deben producir progreso visible.
- **Ausencia sin castigo:** tras 48 h sin entrar, el estado debe seguir siendo jugable (nada se pierde).
- **Sesión sin prisa:** en una sesión de 30 min, el jugador tiene al menos 3 decisiones con efecto.

## 8 · Lo que se hace y lo que no

**Sí:**
- Trabajo abierto, resumen claro, dos caminos al volver.
- Desbloqueos frecuentes al inicio.
- Cosméticos y comodidad compradas o ganadas (MONETIZACION.md).
- Opt-in para notificaciones.

**No:**
- Energía, rachas, cuentas atrás que castigan.
- Anuncios.
- Cajas aleatorias.
- Compras que den poder sin techo.
- Contenido que sólo sea cantidad (más menús sin decisión).

## 9 · Riesgos

| Riesgo | Control |
|---|---|
| Alcance demasiado grande para un autor | Entregas por actos; cada fase con su medida de salida |
| `app.js` inmanejable durante la migración | Extracción por piezas, batería verde en cada paso |
| El contenido se hace repetitivo | Cada banda y losa cambia una decisión; test de variedad |
| El tope offline rompe el equilibrio | Prueba de §4 antes de cualquier cambio de tope |
| La traducción retrasa todo | Traducción por fases; el inglés se escribe ya en los textos nuevos |
| El lore se atasca | Bloques pequeños; el juego funciona sin lore completo |

## 10 · Decisiones que hacen falta del dueño

1. **Orden:** ¿empezamos por el núcleo (fase 1) o por el primer lazo jugable (fase 2)?
2. **Idioma nuevo:** ¿escribimos ya en inglés lo que se haga a partir de ahora?
3. **Ritmo de desbloqueos:** ¿aceptas el objetivo de §5 (un sistema nuevo cada 1–2 h al inicio)?
4. **Profundidad del arco:** ¿tres actos o más?
5. **Alcance de la primera entrega:** ¿hasta la hora 5 (fases 0–4) o hasta el acto 2?
