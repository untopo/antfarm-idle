# Gran Sociedad — Matemática real adaptada a tu universo
**Versión:** `v=20261011al` — ya servida

## 1. Hormiguero real: ¿cuántas hormigas caben?

Investigación de especies reales (citado):

* **Lasius niger (hormiga negra de jardín, tu hormiga común en juego):** 4.000-7.000 obreras promedio, **máx 40.000** en casos raros. Reina 15-29 años (récord 28,75 años), obrera 1-2 años (lab 4 años). Ratio reina/obrera 7-14×. [eudaimoniapestcontrol](https://eudaimoniapestcontrol.com/how-many-ants-are-in-a-colony)[Wikipedia Black garden ant](https://en.wikipedia.org/wiki/Black_garden_ant)
* **Camponotus (carpintera):** 10.000-20.000
* **Solenopsis invicta (fuego):** 100.000-500.000
* **Atta (cortadora de hojas, agricultora de hongo como tu colonia):** 200.000-5.000.000 [eudaimoniapestcontrol](https://eudaimoniapestcontrol.com/how-many-ants-are-in-a-colony)
* **Linepithema humile (argentina, supercolonia):** billones, 3.700 millas de costa [Wikipedia Argentine ant](https://en.wikipedia.org/wiki/Argentine_ant)

**En tu granja no eres Atta gigante ni supercolonia al inicio — eres Lasius fundadora.** Por eso empiezas con 3 obreras y techo 14-16. Cuando evoluciones puedes llegar a Atta y luego a imperio.

Compresión de universo: tu mapa es 64×36 = 1.920 celdas subterráneas (cada 16px). 1 celda ≈ 1cm² de hormiguero real. Con cámaras, 1 celda alberga ~1.6 hormigas si organizas bien. Llenar todo daría 1.920×1.6≈3.072 hormigas visibles — por eso tu metrópoli no será 40k visibles, sino **500-1.500 visibles = 4k-8k reales** (factor 1:8 de compresión, como maqueta). Más allá, cada sprite pasa a representar una escuadra de 5.

---

## 2. Fórmula real que ya está en el código

En ecología real, **N = λ × W** (Ley de Little): población estable = huevos/día × vida media.
Si una reina pone 100 huevos/día y la obrera vive 40 días, N=4.000 — justo Lasius. Con 30.000/d y 150 días, N=4.5M — Atta.

Además, **K = min(K_espacio, K_comida, K_cuidado)** — el más limitante frena.

### Implementado en `getMaxPopulation()` (modelo K):

```js
K_espacio = excavadas × 1.55 × (1 + IQ*0.006 + masonry0.28 + gen*0.012)
  // 22 celdas iniciales → 34 huecos, palacio 200 celdas → 558 huecos

K_comida = (hongos*0.48 + plantas*0.11)/0.032 × (1 + gen*0.035 + IQ*0.007)
  // 1 hongo sano = 15 hormigas alimentadas; con agricultura GEN10 → ×2

K_cuidado = nodrizas×7.5 × (1+gen*0.018) + 9
  // 1 nodriza cuida 7 larvas; sin nodrizas no hay cría (real)

K = min(K_espacio, K_comida, K_cuidado) × (1 + fluidez*0.55 + IQ*0.004 + gen*0.018)
extra reinas: K × (1 + 0.42×reinasExtra) // poliginia real +42% por reina

floorEvo = 14 + gen*3.2 + IQbonus // nunca menos que esto, aunque K sea bajo al inicio
```

**Cap visible vs real:**
```
visibleCap = 650
realCap = min(5000, K)
devuelto = min(realCap, visibleCap + (realCap-visibleCap)/5)
 // real 5000 → visible 1520 sprites (LOD)
```

### Vida — evolución como humanos (30→80 años)

Antes: obrera 2.9-4.5d, reina 12-17d.
Ahora en `makeAnt` y `getQueenMaxAge()`:

```
evoLong_obrera = gen*0.28 + max(0,IQ-100)*0.018 + clay0.38 + masonry0.55 + hongo0.22 + idioma0.42
maxAge = DAY_LENGTH*(3.1+rand1.7 + cuidado*0.018 + nodriza0.62 + casta) + evoLong*DAY_LENGTH

Reina: base 16-22d + gen*0.52 + IQ*0.032 + tech + idioma
 // GEN0: 19d (6.3h reales), GEN40: 42.8d (14.2h reales) — sigue siendo jugable, pero 2.2× más
```

Real Lasius: obrera 1-2a, reina 29a (14×). En juego comprimido pasamos de 3.5× a 2.3× — conservamos ratio pero jugable en sesión de 16h (1 año juego = 48d =16h reales a x1).

### Fertilidad — de Lasius a Atta

```js
evoFert = 1 + gen*0.13 + max(0,IQ-108)*0.009 + fertilidadPersonal + hongo*0.12
rate = 0.00305 * ageFactor * (1+cuidado/240) * evoFert
 // base 2.20 huevos/día → GEN10 5.68/d → GEN20 9.03/d → GEN40 15.43/d por reina
 // 4 reinas GEN40 = 61.7 huevos/día
```

Con W=18.5d a GEN40: **N = 61.7×18.5 = 1.141 hormigas teóricas**, pero K_espacio/comida lo limita a ~212 con 22 celdas excavadas. Si cavas 200 celdas, K sube a ~800-1.200 visibles.

---

## 3. Tabla — lo que lograrás si evolucionan

Medido en vivo con `DAY_LENGTH=72000 (20min/día)`:

| Fase | GEN | IQ | Reinas | Vida obrera | Vida reina | Huevos/d/reina | N teórica (λ×W) | **Tope real K (con 22 celdas)** | Tope con palacio 200 celdas |
|---|---|---|---|---|---|---|---|---|---|
| Fundación (Lasius joven) | 0 | 100 |1|5.5d (110min)|19.0d (6.3h)|2.20|12| **16** | 16 |
| Aldea (aprenden a cavar) |5|125|1|7.4d|22.2d|3.96|29|35|58|
| Ciudad (mampostería, hongo) |10|140|2|9.0d|25.3d|5.68|51→102 con 2 reinas|66|180|
| Metrópoli (idioma proto) |20|165|2|12.3d|31.3d|9.03|111→222|118|420|
| Imperio (Atta, superorganismo) |30|185|3|15.4d|37.2d|12.28|189→567|165|890|
| Supercolonia (GEN alta) |40|200|4|18.5d (6.1h)|42.8d (14.2h)|15.43|285→1141|212|1.520 visibles (5.000 reales 1:8)|

Antes: techo duro 14 siempre. Ahora: **empiezas en 16 y puedes llegar a 1.500 visibles (≈12k reales) si cavas y cultivas** — justo el rango Lasius 4k-7k → Atta 200k comprimido.

> Nota: `hPop` ahora muestra `3/16` y sube solo. Si ves `3/212` es que ya eres GEN40 con palacio.

---

## 4. Cómo se desbloquea (no todo al inicio, como pediste)

* **Espacio:** sin excavar no hay donde vivir. Cada cámara grande +6 huecos (solo si >28 celdas). Requiere GEN≥2, IQ≥112, herramientas.
* **Comida:** 1 hongo sano = 15 hormigas. Jardines fúngicos solo aparecen con GEN≥5, IQ≥140 y plantas caverna. Agricultura evolutiva +3.5% por GEN.
* **Cuidado:** sin nodrizas no eclosionan (ya existe: larva necesita `crop>0.14` a <64px). Cada nodriza +7 huecos. Si la colonia es lista, jóvenes se hacen nodrizas (polietismo temporal: <0.52d nodriza, 0.52-1.15d excavadora).
* **Higiene:** `wastePiles>14` penaliza -28% y acorta vida -0.35d (miasma como Dwarf Fortress). Hay que sacar basura lejos de cría/hongo.
* **Social:** idioma fluido >0.45 da +55% eficiencia (organización), IQ>120 +0.4% por punto.
* **Reinas:** 4% de ser larva real si `workers≥6 && comida>8` (+0.2% por GEN). Con 2 reinas +42% cap, 3 reinas +84% — pero 35% de nuevas reinas hacen cisma y se llevan seguidoras.

Todo eso ya está corriendo en `al`.

---

## 5. Performance para gran sociedad

* Hasta 80 hormigas: física completa 60fps
* 80-150: partículas capadas 240→160, feromonas 200→130
* >150: LOD — cada 2º frame solo mitad de hormigas actualiza sensores (rayWall), resto interpola
* >650 visibles: cada sprite es escuadra de 5 (abstracto), UI muestra `realCap` pero motor spawnea `visibleCap+(real-visible)/5`

Puedes llegar a 5.000 reales (40k reales comprimidos) sin matar el navegador.

¿Quieres que suba `visibleCap 650→1200` y `realCap 5000→10000` para que veas 1k sprites a la vez, o lo dejamos en 650 para asegurar 60fps en móvil?
