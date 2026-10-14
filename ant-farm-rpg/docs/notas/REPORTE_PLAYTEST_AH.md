# Reporte Playtest Profundo — Ant Farm v20261011ah
**Fecha:** 2026-10-11 — Test en vivo con Puppeteer 1280×720, `?v=20261011ah`
**Tester:** Agente (headless + clicks reales + métricas de layout)
**No se modificó código** — solo observación.

---

## 1) Resumen ejecutivo

**Estado general:** jugable, sin errores JS (`logs 12, hasError false`), onboarding ya no molesta tras 1ª vez, reloj superior funciona, perfiles abren. Pero hay **3 choques visuales** que ocupan espacio y confunden, y el **calendario modal no se ve** (bug).

**Ocupación de pantalla (medida real):**
- Calendario `168×257` = **4.68%** en `1098,14` arriba-derecha — correcto, no excesivo.
- Perfil dropdown `220×500` = **11.9%** cuando está abierto en `1046,261` justo debajo del calendario. Bien para 168→220, pero tapa 10px del calendario (ver solape).
- Mapa `1280×720` = 100% (full). Con solo calendario, 95% libre. Con perfil, ~83% libre — aceptable, no "ocupa mucho" si se colapsa.

**Veredicto rápido:** no hay superposición grave, pero hay **solapes de 10-11px** entre HUD ↔ VEL y Ruler ↔ Calendario, y el modal está fuera de viewport.

---

## 2) Qué es cada cosa que ves (porque preguntas "barra lateral junto al reloj que no entiendo")

### Arriba-izquierda — `cornerControls` 340×55 en 14,14
`VEL | x1 x2 x4 x8 x16` — control de velocidad. **No es duplicado** en solo-colonia: el `header` y `farm-top` están ocultos (`display:none`), solo queda este. Bien.

### Arriba-centro — `frame-label` 672×27 en 12,12
`🔬 VIDRIO v4 REAL | PIXEL REAL · CAVADO ANIMADO | ARRASTRA · RUEDA ZOOM · DOBLE CLICK CENTRA`
Es la chuleta de controles. **Problema:** ocupa casi el mismo `y` que `cornerControls` (12 vs 14) y mide 672px de ancho, por eso en el screenshot se ve cortado/bajo el VEL. Debería estar más abajo o ser más corto. Hoy **solapa** con VEL en 11px vertical.

### Debajo del VEL — `hud-strips` 438×110 en 12,58 (3 tarjetas apiladas)
1. `🍯 2 MIELES  ⛏ 0 TÚNELES` — comida y túneles totales
2. `♛ 0 CRIAS  ⬡ 74 TINTA` — crías en nido y tinta de feromonas
3. `ATZH [OBRERA] — 3 OJOS 0.9/0.9/0.0 — TINTA 0.8,-0.2` — **selección actual**: qué hormiga sigues y sus 3 ojos + tinta. Si no hay selección, esta 3ª tarjeta aparece vacía con `—`.

**Significado:** es tu "strip" superior de estado rápido. No es un menú, es info. Hoy mide 438px de ancho y tapa un poco el pasto superior, pero es útil. Podría ser más angosto (300px) o colapsable.

### Derecha borde — `depth-ruler` 38×720 en 1060,0
Barra vertical con `☀ 0 🌱 2 🟫 5 ⬛ 10` — indica profundidad en tiles: sol/superficie, pasto 2, tierra 5, roca 10. Es la **"barra lateral junto al reloj"** que no entendías. Está pegada al calendario: su borde derecho es `1098` y el calendario empieza en `1098`, así que parecen una sola pieza marrón. No tapa el mapa, pero visualmente se funde con el calendario y confunde. Debería tener un gap de 6px o un borde distinto.

### Abajo — `narration` 1224×72 en 12,636
Barra negra con el log narrativo: `A02P entregó 1 🍯 — despensa 5.` y `Sigues a AMDN [OBRERA]...`. Ocupa todo el ancho inferior, 72px de alto (10% de pantalla). Correcto, pero tapa la parte baja del mapa (donde están los `?` de cuevas). Podría ser semi-transparente o auto-ocultarse tras 4s.

### Arriba-derecha — `calendarWidget` 168×257
- Cabecera `BROTE 06:49 DÍA` con `☀️` clima y botón `—`/`+`
- Reloj mitad superior 140×70 con interior por estación (verde brote con motitas, sol amarillo con rayitos, etc.) y aguja roja que va 6→12→18.
- Fila `1 OBRERA | 1/12 • Sem1 | DÍA 1·AÑO1 | Mundo 0.0`
- Panal dibujado abajo + barra verde de estación (hoy `width:0` porque es día 1/12).

**No ocupa mucho** (4.68%). Con `hover` baja a 0.88 de opacidad, y colapsado queda en 26px (solo cabecera) — muy bien para liberar borde.

### Centro — burbujas
Cada hormiga lleva burbuja pixel encima (`¡AQUI!`, `x1→CASA`, `+1`, `MIEL`, `TÚNEL`). Hoy todas tienen el mismo tamaño y si hay 4 hormigas en el túnel se amontonan. Ya metimos clustering `+6px` por solape, pero en el screenshot de `deep_1_initial` se ve `¡AQUI!` duplicado y `+1` encima de `SALIDA` — aún se tapan. Necesita agrupar o desvanecer las lejanas (ej. solo la más cercana 100% opaca, resto 40%).

---

## 3) Solapes medidos (intersección real de bounding boxes)

| Par | ¿Solapan? | Área | Comentario |
|---|---|---|---|
| `hud-strips` ↔ `cornerControls` | **SÍ** | ~11px vertical (hud y=58 vs corner y14 h55 → solapan 11px) | El HUD empieza demasiado arriba. Bajarlo a y=75 lo arregla. |
| `frame-label` ↔ `cornerControls` | **SÍ** (no medido pero 12,12 672×27 vs 14,14 340×55) | ~27px | El label tapa el VEL. Moverlo a y=75 o a la derecha del VEL. |
| `depth-ruler` ↔ `calendarWidget` | **SÍ (borde)** | 0px gap, tocan en x=1098 | Parecen una sola barra marrón. Añadir gap 6px o borde amarillo entre ambos. |
| `calendarWidget` ↔ `antProfile` | **SÍ leve** | 1680px² (168×10) | Perfil top=261, calendario bottom=271 → 10px de solape. Top debería ser `14+257+4=275`, no `257+4=261`. Fix de 1 línea. |
| `hud-strips` ↔ `calendarWidget` | NO | — | Bien, uno izq otro der. |
| `narration` ↔ `hud-strips` | NO | — | Bien, abajo vs arriba. |

**Conclusión:** ningún menú "choca mucho", pero los 3 solapes de arriba son antiestéticos y hacen que el top parezca una sola barra negra gigante.

---

## 4) Menús y su comportamiento (probado click a click)

### `calendarWidget` click
- Click en el cuerpo (no en `—`) abre `calendarModal`. Hoy el modal se crea en `x0 y720` (debajo del viewport) con `h937` — **queda fuera de pantalla**. En `deep_2_calendar_modal.png` no se ve el modal centrado, solo el mapa. Es un bug de `calendarModal` CSS: `top` no es `50%` o `inset:0` centrado. Debe ser `position:fixed; inset:0; display:grid; place-items:center` y `.cal-modal-box` centrado.

### `antProfile` dropdown (ahora `220×500` en 1046,261)
- Click preciso en hormiga (hitR `22-30` escalado) abre. Probado en `AMD N` (503,198) screen 549,321 → abre `AMDN [OBRERA] F0`. Segundo click en otra hormiga reemplaza sin apilar (no queda debajo). `X` cierra a `display:none`. Click vacío en pasto (100,400) también cierra — correcto para no estorbar.
- **Tabs nuevos:** `RASGOS | ESTADO | ÁRBOL | HIST` — probado: click `ESTADO` → `profileTab_estado display:block`, `ARBOl` → `profileTab_arbol block`. Bien, pero el contenido de `ARBOl` y `HIST` es largo y el dropdown de 500px de alto tapa la mitad del mapa vertical. Con 220px de ancho, el texto de `profileTree` se parte en 2 líneas y `HIST` queda con scroll de 90px — usable pero justo. Recomiendo `max-height: 60vh` y scroll interno ya está, bien.
- **Espacio:** 220px es buen compromiso (antes 168 era ilegible, 340 era excesivo). Sigue siendo "no ocupa mucho" (12%).

### `queenProfile`
- Igual que ant pero con fondo `#1a0f1a` y 6 rasgos. Click en reina `520,232` screen 579,379 → abre `Ada 👑 REINA F0`. Mismo solape 10px con calendario. Cierra con `X` o click vacío.

### `cornerControls` vs `hud`
- `cornerControls` no se solapa con calendario (izq vs der). Pero sí con `hud` y `frame-label` como arriba.

### `notify-stack` (centro arriba)
- `620×0` cuando no hay notis (altura 0) — invisible, bien. Cuando hay `pushToast` aparece centrado. No tapa nada relevante.

---

## 5) Bugs / glitches encontrados en playtest

1. **Calendario modal fuera de viewport** (`y720`). No se puede ver el calendario grande de 48 días. Bloquea el flujo si el jugador quiere ver la grilla.
2. **Solape 10px calendario-antProfile** por `top = calH+4` sin sumar `14` del offset del calendario.
3. **Solape HUD-VEL y Frame-VEL** en top. El `frame-label` de 672px tapa el `VEL`.
4. **Depth ruler pegado al calendario** sin gap — confunde.
5. **Burbujas amontonadas** en túnel central (4 hormigas en 30px). Nuestro clustering de `+6px` ayuda pero aún se leen dos `¡AQUI!` una encima de otra en `ah_1_after_onboard.png`.
6. **Hit radius grande** (22-30) hace que al clickear entre dos hormigas a 12px de distancia coja la última, no la más cercana. Ya lo cambiamos a closest, pero en el test `AUWQ` vs `A01Y` a 15px, el click en `AUWQ` abrió `A01Y` — el closest fix no se aplicó a tiempo en ese frame (código viejo). En `ag` ya está closest, pero verificar.
7. **Recurso 404** `Failed to load resource: 404` cada carga — un `fetch` o `img` roto (probablemente `bootstrap.js` o sprite). No rompe, pero ensucia consola.
8. **Narration tapa cuevas bajas** — los `?` en y 600 quedan bajo la barra negra de 72px. La barra podría ser `pointer-events:none` y auto-fade tras 3s.

---

## 6) Recomendaciones de equipo (sin implementar ahora, como pediste)

**Prioridad alta (arreglar antes de seguir metiendo features):**
- Fix modal centrado y top del perfil (`14+calH+4`).
- Mover `frame-label` a `y=75` o integrarlo dentro de `cornerControls` como tooltip, y bajar `hud-strips` a `y=75` también.
- Añadir gap 6px entre `depth-ruler` y `calendarWidget` (o hacer ruler de 2px).
- Hacer `hud-strips` colapsable: mostrar solo 1 línea `🍯 2 ⛏0 ♛0 ⬡74` y expandir al hover, para liberar 80px de pasto superior.
- Burbujas: en vez de offset vertical, usar **líder y seguidores**: solo la hormiga más cercana a cámara muestra burbuja completa, las otras solo un puntito `·` o `…`.

**Prioridad media (pulido):**
- Reloj: subir `06:49` a 11px bold y poner icono clima grande dentro del arco (ya tienes `☀️` en cabecera, duplícalo dentro como `🌱` pequeño).
- Perfil: ya con tabs, pero `ARBOl` y `HIST` podrían ser scroll con `max-height: 180px` y no 90px.
- Onboarding: ya con localStorage, bien. Añadir "No volver a mostrar" checkbox.
- Performance: `toasts` y `_bubbleOccupied` crecen sin límite en partidas largas — limitar a 8 y limpiar por frame (ya hecho).

**Nice to have:**
- Gutter fijo de 182px para que el mapa nunca quede bajo calendario — hoy es overlay con drag extra, funciona pero el gutter sería más limpio visualmente si el mapa es más pequeño.
- Minimapa 120×72 en la esquina del gutter.

---

## 7) Métricas finales

- **Sin perfil:** UI ocupa ~7% (cal 4.68% + hud 2.5% + ruler 2.7% pero ruler es lateral). Mapa 100% visible salvo 10px de solape.
- **Con perfil:** UI ~19% (cal 4.68 + perfil 11.9 + hud). Aún deja 81% de mapa — no "ocupa mucho" si el perfil es dropdown y no lateral push.
- **No hay `Uncaught` ni `ERROR` en consola** en 2 minutos de juego a x8.
- **FPS estable** a 60 con 3 hormigas, 0 derrumbes.

¿Quieres que aplique solo los 3 fixes de solape (modal, top 10px, frame/hud gap) y deje el resto como está para no tocar estética, o aplico todo el bloque de pulido?
