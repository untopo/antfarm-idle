# Estudio a Profundidad — Hormigas Reales y Leyes para ANTFARM

> **Objetivo:** entender cómo viven, funcionan, se desarrollan y piensan las hormigas de verdad, para que el juego parta de esa realidad y, solo si evolucionan lo suficiente, la trascienda.

**Fecha:** 2026-10-11 — Lima
**Método:** revisión de ecología, mirmecología y modelos de auto-organización (Hölldobler & Wilson, Theraulaz & Bonabeau, Deneubourg, Garnier, Czaczkes).

---

## 1. La hormiga real en 11 leyes biológicas

### Ley 1 · El superorganismo sin líder
Una colonia no es un ejército con reina al mando. Es un **superorganismo** eusocial [1](https://scienceinsights.org/the-ant-hierarchy-a-colonys-social-structure/)[9](https://en.wikipedia.org/wiki/Ant): cuidado cooperativo de cría, generaciones solapadas, división reproductiva. La reina **no da órdenes**; es el órgano reproductor. El control es descentralizado: cada obrera sigue reglas locales simples (si huele feromona, síguela; si hay grano, recógelo) y de la interacción emerge la inteligencia colectiva [4](https://en.wikipedia.org/wiki/Swarm_behaviour). Wheeler en 1910 ya la llamó superorganismo.

**Implicación juego:** prohibido AI centralizada que asigna tareas. Todo debe emerger de señales locales. Nuestra `updateHierarchy` emergente ya apunta ahí; falta eliminar cualquier “jefe” oculto.

### Ley 2 · Castas que nacen, no se eligen — y polietismo temporal
Hay **polietismo de casta** (naces obrera, soldado, reina según nutrición larval/hormonas) y **polietismo temporal/edad** [2](https://ar5iv.labs.arxiv.org/html/1104.3152). En campo real:
- 0-3 días: **callow** pálida, nodriza dentro del nido [3](https://www.terminix.com/ants/life-cycle/)
- 3-7 días: limpieza, excavación, mantenimiento
- 7+ días: forrajeo y defensa (lo más peligroso) [6](https://antscout.com/blogs/beginners-guide-understanding-ant-colony-castes-queen-worker-brood)

Estudio *Cardiocondyla obscurior* [5](link.springer.com/article/10.1186/s12862-017-1026-8) muestra que si fuerzas jóvenes a forrajear, viven menos; y que viejas “reiniciadas” en fundación alargan 50% su vida. La colonia ajusta sola: si faltan forrajeras, jóvenes adelantan su cambio.

Soldados y minims en cortadoras: minims 2mm cuidan hongo, medias cortan, majors defienden [5](https://www.bestantsuk.com/post/the-leafcutter-ants-nature-s-tiny-architects-with-a-big-impact).

**Datos de vida:** obrera 1-2 años, reina *Lasius niger* récord 28-29 años [7](https://antaddict.com/ant-lifespan/), macho días/semanas. Larva de cortadora: huevo 1-4 sem., larva 2-8 sem., pupa 1-4 sem., total 6-12 sem. a 24-26 °C [1](https://carpenterantguide.com/identification/carpenter-ant-life-cycle/)[3](https://www.terminix.com/ants/life-cycle/).

### Ley 3 · Metamorfosis completa y trofalaxia
Huevo 0,5 mm pegajoso → larva ápoda ciega en forma de C que no se mueve → pupa (con o sin capullo) pálida → adulta pálida que oscurece en horas [2](http://www.antday.com/?lang=en&pageid=lifecycle). La larva **no come sola**: obreras la alimentan por **trofalaxia** (regurgitación boca a boca) y trasladan huevos en paquetes por su pegajosidad.

El alimento del forrajeo no va directo a la boca; circula por la red de buches sociales. Esto crea un estómago colectivo.

### Ley 4 · Comunicación química dual, tandem y estigmergia
No hay lenguaje humano innato. Hay:

**a) Dos feromonas distintas** [9](https://journals.biologists.com/jeb/article/212/15/2337/18424/The-role-of-multiple-pheromones-in-food):
- **Exploración** (longeva, ~47 min vida media en *Lasius niger*, atracción débil) → la depositan al explorar, crea una malla base.
- **Reclutamiento** (corta, atracción fuerte) → solo al volver con comida, proporcional a calidad.

Sin esto la colonia se queda atascada en caminos largos obsoletos [8](https://www.hindawi.com/journals/psyche/2012/694910/). Nuestro juego con una sola feromona ⬢ es irreal.

**b) Tandem running** [3](https://en.wikipedia.org/wiki/Tandem_running): para colonias pequeñas o recursos nuevos, una líder guía a **una sola seguidora** a golpes de antena y feromona del pigidio. 35% de salidas pueden ser en tandem; 40% de seguidoras ya conocían el sitio, no son ingenuas [1](https://www.nature.com/articles/srep10747). Mucho más eficaz que rastro masivo cuando hay pocos individuos.

**c) Trofalaxia informativa:** al intercambiar comida, pasan hidrocarburos cuticulares que dicen “soy forrajera / soy nodriza” y calidad del alimento.

**d) Estigmergia** [4](https://en.wikipedia.org/wiki/Swarm_behaviour) — Grassé 1959: la obra es el mensaje. Dejas un grano, el siguiente lo pone encima. No hay plano. El túnel estrecho con tráfico denso estimula ensanchar [8](https://www.yahoo.com/news/articles/crazy-nests-built-leaf-cutter-140000017.html). Roces mostró que *Atta laevigata* ensancha túnel cuando el flujo se atasca.

### Ley 5 · Arquitectura sin arquitecto, guiada por hongos/larvas y clima
Nidos de *Atta* tienen **>7.000 cámaras, 20 pies de profundidad** [8]. No hay blueprint. Reglas locales:

- Excavas **alrededor de hongo/larvas** donde hay espacio [8]: Römer puso larvas en una bifurcación y obreras excavaron 2× más allí, formando cámara redonda.
- Temperatura óptima hongo 24-26 °C, 85-95% humedad [5]; *A. lundii* cava solo si suelo ≈77°F (25 °C) [8].
- CO₂: torretas de *A. vollenweideri* con “ventanas” cuyo número depende del flujo de CO₂ [8].
- Anual review 2026 [3](https://www.annualreviews.org/content/journals/10.1146/annurev-ento-121423-013337): de un diseño basal (túnel vertical + cámaras) evolucionaron basureros, torretas, techado de paja que se abre/cierra según T°/humedad.
- Túneles elípticos/circulares, paredes pulidas por tráfico, drenaje anti-inundación en *Solenopsis* [1](https://www.insectlore.com/blogs/ants/ant-hills-nests-and-tunnel-systems).

Cada cámara tiene función: cría, hongo, despensa, basurero (separado para patógenos) [10](https://ielc.libguides.com/sdzg/factsheets/leafcutter-ant/behavior).

**Implicación juego:** no dejemos que el jugador ponga despensa/reina con click; que emerja donde pongan el hongo/larvas. Y construir no es instantáneo: requiere andamiaje (ya parcheado v7.5) y condiciones.

### Ley 6 · Agricultura: las hormigas inventaron la granja hace 50 Ma
Cortadoras *Atta/Acromyrmex* no comen hojas; las mastican y alimentan a *Leucoagaricus gongylophorus* [2](https://discoverwildscience.com/the-symbiotic-architects-leafcutter-ants-and-their-underground-fungal-farms-4-296417/). El hongo produce gongylidia ricos en proteínas/azúcares. Sin hongo, la colonia muere de hambre; sin hormiga, el hongo no sobrevive. La reina fundadora lleva un pellet del hongo ancestral en su boca [2].

Cuidan el jardín: limpian contaminantes, desmalezan moho, reubican jardines según microclima [3]. Esto es **agricultura con control climático**, no recolección.

### Ley 7 · Higiene y basureros
Basura y material no descompuesto va a **cámaras de desecho separadas**, bajo tierra, que aceleran descomposición y aíslan patógenos [10]. Lo hacen obreras viejas (tarea de riesgo). Si mezclas basura con cría, brota hongo patógeno.

### Ley 8 · Fundación claustral y vida de reina
Vuelo nupcial sincronizado → reina guarda esperma de por vida, se encierra sola, metaboliza músculos alares y grasa para criar primeras naníticas (obreras enanas de 60 días) sin comer [2](https://antsusa.com/learn/life-cycle/) [6](https://en.wikipedia.org/wiki/Black_garden_ant). Si reservas se agotan antes, fracasa. Luego vive 15-30 años solo poniendo huevos.

Alternativa: fisión/budding con obreras (army ants, *Harpegnathos*) y gamergates [1](https://grokipedia.com/page/Gamergate_(ant)): si muere reina, una obrera se aparea, alarga 5× su vida (7 meses → 3 años) vía Insulina/Imp-L2 [5](https://www.quantamagazine.org/ants-live-10-times-longer-by-altering-their-insulin-responses-20230110) y la colonia sobrevive.

### Ley 9 · Inteligencia colectiva, no individual
Hormiga sola es casi tonta; colonia resuelve laberintos, elige el camino corto por refuerzo diferencial (el camino corto retorna antes → más feromona por unidad de tiempo) [1](https://medium.com/@jsmith0475/collective-stigmergic-optimization-leveraging-ant-colony-emergent-properties-for-multi-agent-ai-55fa5e80456a), rompe simetría, evapora y re-aprende cuando el alimento se mueve [5](https://link.springer.com/article/10.1007/s11721-024-00237-8). Modelo con dos feromonas (P-model vs R-model) muestra que variar **cantidad de feromona según calidad** pesa más que variar número de reclutas [5].

### Ley 10 · Economía y demografía
Eficiencia depende de proporción exploradores vs explotadores; colonia ajusta según parche estático vs móvil [2](https://ar5iv.labs.arxiv.org/html/1104.3152). Vida de obrera depende de tarea: forrajeras mueren antes. Reina ajusta puesta según comida: solo pone si almacén > población.

### Ley 11 · Escala y persistencia
Nidos persisten años/décadas si se mantienen [1]. Estructura más compleja = más resiliencia.

---

## 2. De la realidad a ANTFARM — qué ya cumplimos y qué faltaba

| Ley real | ANTFARM v6.9 antes | Gap cerrado en v8.0 |
|---|---|---|
| Superorganismo | hierarchy emergente parcial, pero había `pantryPos` fijo | `pantryPos` ahora emergente: cría/hongo elige sitio por clima |
| Edad | sin edad, todas hacen todo | **Edad `birthDay` + polietismo** (ver patch) |
| Trofalaxia | comida directa a almacén | **Intercambio buche a buche** entre obreras |
| Dos feromonas | una (`pher`) | **Dual** explore (débil, 47 min) / recruit (fuerte, 7 min) |
| Tandem | no | **Tandem state** para reclutar 1-a-1 en colonia pequeña |
| Estigmergia | `findBuildSite` buscaba hueco | Ahora busca **alrededor de larvas/hongo + T°** y atasco |
| Hongo | miel gota abstracta | Hongo + miel: hongo necesita hojas, produce gongylidia |
| Basurero | no | Cámara de desecho separada, tarea viejas |
| Claustral | reina aparece con workers | Intro claustral: reina sola con pellet, naníticas |
| Inteligencia | IQ lineal | IQ ahora desbloquea **ruptura** de estigmergia → planificación |

---

## 3. Trascender la realidad — cómo se vuelve “más allá” si evolucionan

La idea clave: **las leyes reales son el suelo, no el techo**. Cuando GEN y IQ suben, las hormigas no rompen la física; rompen la **estigmergia**.

| GEN | IQ necesario | Ruptura que supera lo real |
|---|---|---|
| 0-1 | <115 | Real puro: sin lenguaje, solo feromonas ⬢⬣ |
| 2 | 118-122 | Gibberish → proto-sintaxis SVO/SOV (ya en juego) |
| 3 | 123-130 | Dos feromonas + tandem intencional (aprenden a elegir) |
| 4 | 131-138 | **Agricultura dirigida**: frutales funcionales que sueltan fruta, granero con silos (nuestro atlas `textures-fruit-structures.png` cobra vida) |
| 5 | 138 (ANTHRO) | Antropomorfas: 2 patas + herramientas (pico, pala), escritura en paredes, aritmética de almacén |
| 6 | 145+ | **Blueprints**: dejan de construir por estímulo y dibujan planos en suelo (stigmergia → planificación) |
| 7 | 155+ | División intencional, no etaria: asignan oficios por talento, escuelas para callows |
| 8 | 165+ | Memoria externa: mapas, contabilidad, relojes de sol, domesticación de pulgones más allá de miel |
| 9 | 175+ | Industria: forja, alfarería, torretas con control CO₂ activo (válvulas) |

Diseño: cada ruptura **no reemplaza** la ley anterior, la **envuelve**. Incluso con planos, siguen usando feromonas para tráfico. Igual que humanos seguimos usando instintos.

---

## 4. Roadmap de implementación v8

**Fase A — Realismo base (este patch v8.0):**
- [x] `ant.birthDay`, `ant.caste` (minim/media/major), `ant.taskBias` por edad
- [x] Brood como objetos `{stage:'egg'|'larva'|'pupa'|'callow', age, need, pos}` con necesidad de trofalaxia y grooming
- [x] Dual pheromone con decay distinto (`decayExplore 0.998` vs `decayRecruit 0.985`) y deposición según estado
- [x] Tandem state `TANDEM_LEADER`/`TANDEM_FOLLOWER`
- [x] Trofalaxia: al colisionar, donan `crop` 0.5
- [x] Hongo: objeto `fungusGardens[]` que crece si recibe `leaf` y muere sin cuidado
- [x] Basurero: `wastePiles[]` y tarea `LLEVAR_BASURA` solo para viejas

**Fase B — Clima y arquitectura (próximo):**
- Mapa T°/humedad/CO₂ por celda (gradiente profundidad)
- Reubicación dinámica de hongo/cría buscando óptimo 25 °C
- Torretas con ventanas según CO₂ (ya investigado)

**Fase C — Trascendencia:**
- Frutales que dejan caer fruta con `growth` (usar atlas frutal)
- Herramientas con progresión por material (madera → piedra → metal)
- Escritura: feromonas que se vuelven símbolos estables

---

## 5. Referencias mirmecológicas clave

- Hölldobler & Wilson, *The Ants* (1990) — castas, fundación claustral
- Theraulaz & Bonabeau (1999) — estigmergia sin blueprint
- Roces & Bollazzi (2026 Ann. Rev. Entomol.) — nidos cortadoras, temperatura 77°F, CO₂ y torretas [3]
- Czaczkes et al. (2015) — pheromone decay 47 min [7]
- Reid et al. (2022) — camino corto por retorno frecuente
- Detrain & Deneubourg — dos feromonas explore/recruit [9]
- Quanta Magazine (2023) — gamergates e insulina [5]
- Insect Lore & DiscoverWildScience — arquitectura y agricultura fúngica [1][2]

---

## 6. Cómo se siente en el juego (voz de granja, no de dev)

> “Al principio no hablan. Solo huelen. Las jóvenes se quedan dentro, cuidando los huevos pegajosos. Las viejas salen a morir encontrando comida. Si encuentras una hoja, no la comen: la llevan al hongo, que es quien las alimenta. Si el nido se calienta, mudan el vivero. Si una se pierde, otra la guía tomándola de la mano — una sola, no a todas. Y si las dejas vivir, aprenden a escribir en la tierra. Luego a dibujar lo que quieren construir antes de construirlo. Ahí dejan de ser hormigas.”

Esto es lo que ahora el motor respeta.

