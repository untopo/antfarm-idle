# Estudio a profundidad — Física real de hormigas + Terraria/Starbound/Dwarf Fortress/Oxygen Not Included

Fecha: 2026-10-12 — pedido usuario: *hormigas no deben caminar en el aire, túneles/pasillos/puertas reales, nacen con más info, reconstruyen como Terraria*

## 1) Arquitectura real de hormigueros (papers)

**Elementos base (no invento):** todo nido subterráneo = **eje vertical (shaft) + cámaras horizontales + túneles inclinados 20-70°** (Encyclopedia.pub, MDPI 12/12/2225). Variar cantidad/tamaño/distancia genera la “firma” de la especie.

- **Pogonomyrmex badius** — hebras helicoidales 2-3.5 m, hasta 135 cámaras, 7 m en harvester.
- **Solenopsis invicta** — densa, multi-nivel, cámaras empaquetadas.
- **Odontomachus chelifer** — 24-77 cámaras, 4-8 shafts, **Hall** central distribuidor (sorpresa en Ponerinae), volumen 200-364 cm³, profundidad 134 cm, múltiples entradas 3-10. Cámaras ovaladas “en pasos” (fusión de pisos) o irregulares, siempre más anchas que altas, pavimentadas con material vegetal. Basureros siempre al fondo del shaft más profundo.
- **Atta (cortadoras)** — hasta 7.800 cámaras, 7 m, graneros arriba, cría al centro (25-30°C), basura aislada para no contaminar hongo.
- **Construcción:** mandíbulas + compactación + secreciones que cementan, arcos y bóvedas auto-portantes, modular y escalable (sin replanteo, se añade una unidad eje+cámara). Transporte de tierra al montículo exterior. Reestructuran ante patógeno taponando túneles (Lasius niger, Bristol).

**Consecuencias para el juego:**

- Cámara tipo real = disco aplanado `ancho>alto` (ej 3×2, 5×3) no cubo. 
- Hall distribuidor en 6-8 shafts si colonia madura.
- Basura y hongos separados físicamente (ya implementado con `fungusGardens`/`wastePiles`).
- Crecimiento modular, no ciudad prefijada.

## 2) Terraria (wiki.gg)

- **Gravedad:** solo arena/silt/slush (y variantes) caen; el resto flota. 51 mph terminal, 123 mph/s. Sand se vuelve **proyectil**: hace daño al caer, asfixia, se rompe en ítem si cae sobre antorcha/mesa. Necesita 110% pico para intercambiar desde abajo. Antorchas la sostienen desde 1.4.1.
- **Pico por capas:** cobre → profundo necesita más golpes y más “pickaxe power”. Smart cursor 2-3 tiles.
- **Comunidad pide física real:** “No more sky bridges floating” — modo experto con soporte. Arena haciendo pilas 45°.

**Aplicado al farm:** capas `topsoil 1 (1 golpe) → arcilla 2 (2) → arena 3 (1 pero cae) → piedra 4 (3-4) → pizarra 6 (5) → bedrock 7 (infinito hasta GEN8+masonry)` + arena cayendo en `updateFallingSand`.

## 3) Starbound (Starbounder)

- **Physics-affected blocks**: Gravel, Ash, Slush… caen si sin apoyo o si el jugador los toca. Plataformas semi-sólidas (se atraviesa hacia arriba). Liquids flood si quitas background. Mining con Matter Manipulator (omni-herramienta).

## 4) Oxygen Not Included

- Excavar → **50% de masa perdida** (salvo derretir y recongelar), vacío, debris decor negativo. Alcance dupes 4 arriba, 3 abajo, 2 lateral. Dureza 10 (arena) a 200 (abisalita). Habilidades gatean biomas. Construir necesita llevar material, tile a tile. Si cavas tu propio suelo, caes.

## 5) Dwarf Fortress

- Soporte minimalista: basta 1 tile adyacente cardinal para sostener un piso infinito — sin pilares. Colapso solo si quitas el último soporte (el enano sale disparado, objetos debajo mueren). Agua simula arena (7 niveles/tile). Soil = plantable. Collapso como arma.

## 6) Síntesis de diseño para la granja

| Ley | Real | Terraria | Implementado ahora |
|---|---|---|---|
| **Hormiga sin suelo → cae** | sí, escarba desde borde | no (flota) | `hasFloorBelow()` → `vy+=0.62`, no puede `CAVAR` en aire, polvo al aterrizar |
| **Suelo sin apoyo → cae** | compactación+arco lo evita | solo arena | `isSoilSupported()` arco: apoyo directo, diagonal o bóveda lateral+techo. Chance `arena 99%`, `topsoil 42%`, `arcilla 18%`, `piedra 8%`. Pizarra/bedrock nunca. Busca hueco abajo diagonal como pila |
| **Reconstruir (colocar bloque)** | llevan pellet, lo pegan | colocar bloque donde quieras si tienes bloque | `VOLVER_TIERRA` ahora busca hueco con `hasSupport` a ≤28px y rellena como Terraria, no solo en entrada; consume `worldMaterials`, gana fitness |
| **Heredar saber** | trofalaxia, aprendizaje | no | cría `digNeeded -= gen*0.42 + IQ/55`, `fitness+=gen*0.06`, hereda `affinity` del mejor parent, +2 cuidado si `decoSet>6` |
| **Cámaras reales** | discos 2.69 cm alto, Hall | recámaras de Terraria | `excavateChamber(c,r,w,h)` oval rugoso 3×2 a 5×3, con 8%+gen*1.2% chance tras cada picada, da `sand` material y evento `🏛` |
| **Puertas/pasillos** | túneles 20-70°, múltiples entradas, Hall | plataformas/aberturas | `findBuildSite` deja gaps, `structures` (workshop/granary/bridge/tower) usan piedra/arcilla/madera según gen+invento |

**Próximos pasos pendientes:** añadir tipo “puerta” perforable (tile 1 de ancho que sí deja pasar ant pero bloquea `isSolidPixel` si está cerrada), y que las nuevas GEN nazcan con el léxico del lenguaje ya a 0.12 fluency en vez de 0.

## 7) Qué ya cambió en código (20261011au)

- `updateAnt` → gravedad soterrada + `hasFloorBelow`.
- `updateFallingSand` → soporte + caída para todo tipo + daño asfixia + partículas.
- `carveOval` + `excavateChamber` → cámaras reales.
- `VOLVER_TIERRA` → relleno Terraria cercano con apoyo.
- `makeAnt`/eclosión → `digNeeded` heredado y `fitness` base.
- `serializeSave` intacto (no borra).

## 8) Fuentes

- Encyclopedia.pub 39146, MDPI Buildings 2225, PLoS One Odontomachus, ant-shack, Grokipedia ant architecture, SciNews meshedness, Dwarf Fortress wiki, Terraria wiki Gravity/Sand, Starbounder Blocks/Physics blocks, ONI wiki Dig.
