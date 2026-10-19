# INVENTARIO GRÁFICO — ANT FARM
**Todo objeto, superficie tangible, recurso y personaje que necesita representación gráfica**
*Generado 2026-10-12 — auditoría completa del código (`index.html` + `js/app.js` + `css/style.css` + sprites)*

> Objetivo: trabajar textura por textura, sin olvidar nada. Cada fila es una textura/sprite único que el juego ya usa (o debería usar) y su estado actual.

---

## 1) SUPERFICIES / TERRENO FÍSICO — 14 tipos
| # | Objeto | Código | Descripción tangible | Estado actual |
|---|--------|--------|----------------------|---------------|
| 1 | **Cielo** | `SURFACE_Y` arriba | Fondo degradado día/noche, horizonte | `drawFarm` rect `#7ec8e3` plano, sin nubes |
| 2 | **Pasto superficie** | `soil[SURFACE_ROW][c]` borde | Franja de pasto verde 10-13px sobre topsoil | Rect verde plano `#3a9d23` + pasto procedural muy simple |
| 3 | **Topsoil fértil** | `soilType 1` (0-3 profundidad) | Tierra marrón clara, blanda, con raíces | Rect procedural `soilCache` color `#6b4423/#7d5230` + 2px speckles |
| 4 | **Arcilla** | `soilType 2` (3-8) | Tierra rojiza compacta, 2 golpes | Color `#a08060` plano, sin textura arcillosa |
| 5 | **Arena** | `soilType 3` (8-14) | Arena clara que **cae con gravedad** (Terraria sand) | Color `#c2b280` plano, sin grano |
| 6 | **Piedra** | `soilType 4` (14-30) | Roca marrón-gris, 3-4 golpes, veta | Color `#8a8a8a/#5a2a0a` plano, 2px piedra genérica |
| 7 | **Pizarra** | `soilType 6` (30-50) | Roca oscura dura, 5 golpes, pizarra | Color idem piedra, sin distinción visual |
| 8 | **Bedrock** | `soilType 7` (>50) | Roca negra casi irrompible, solo GEN8+ | Color `#2a0a0a` plano con borde, sin textura bedrock |
| 9 | **Aire / Vacío túnel** | `soil 0` | Interior túnel/cámara excavada | `#fff8dc` sólido (túnel claro) — ok, pero sin sombreado pared |
| 10 | **Pared de túnel (rim)** | `T.rim` en `drawBackground` | Borde oscuro 1px alrededor del túnel | Línea ` #4d2f18` simple |
| 11 | **Suelo cámara decorada** | `decoSet` | Celdas que arquitectas (cuidado>50) decoran, más bonitas | Solo flag lógico, sin textura distinta aún |
| 12 | **Veta piedra / arcilla** | `seed` aleatoria | Manchas 2×2 de piedra o arcilla dentro del suelo | 2px speckles genéricos |
| 13 | **Charco / Puddle** | `mound.isPuddle` | Agua de lluvia en superficie que ablanda excavación | Círculo `#7ec8e3` 1px, sin reflejo |
| 14 | **Montículo tierra** | `mound[]` | Tierra excavada apilada | Rect `#6b3a1f` 3×2 plano |

## 2) VEGETACIÓN / MUNDO VIVO EXTERIOR — 9 tipos (+estadios)
Cada uno tiene **3 estadios de crecimiento** (brota 0.08 → joven 0.35 → maduro 0.92) + variante `variant 0-2`.
| # | Objeto | `type` | Dónde | Estado actual |
|---|--------|--------|-------|---------------|
| 15 | **Trébol** | `clover` | Superficie fértil | Rect 4px verde + 2px hoja, muy simple |
| 16 | **Mata pasto** | `grassTuft` | Superficie, se expande como Terraria | Mismo que trébol, indistinguible |
| 17 | **Flor amarilla** | `flowerY` | Superficie | 3px amarillo `#ffdd57` sin pétalos pixel |
| 18 | **Flor blanca** | `flowerW` | Superficie | 3px blanco, idem |
| 19 | **Arbusto bayas** | `berryBush` | Superficie fértil >0.70, da 2× BAYA | Arbusto 10px marrón + 2px rojo, sin ramas |
| 20 | **Hongo superficie** | `mushroom` | Superficie, luego produce HONGO | Sombrero 6px `#d68a4a` plano |
| 21 | **Retoño / Sapling** | `sapling` | Superficie, crece a árbol | Palo 2px + copa 6px, sin tronco pixel |
| 22 | **Manzano frutal** | `fruitTree` | Superficie madura, da 3× MANZANA | Tronco 4px + copa 18px + 3 manzanas 3px — el más detallado, aún sin follaje tiling |
| 23 | **Hongo cueva** | `caveMush` | Subterráneo húmedo, `cave:true` | Mismo que mushroom pero `y` dentro túnel, sin bioluminiscencia |

## 3) RECURSOS ALIMENTICIOS — 6 tipos (+cantidad)
Todos usan `FOOD_DEFS`, con `rotDays` (pudrición), `color`, `cap` y se dibujan con `spawnFoodAt`.
| # | Objeto | `ftype` | Pudre | Estado actual |
|---|--------|---------|-------|---------------|
| 24 | **Miel — gota** | `honey` | Nunca (99d) | Emoji `🍯` + rect `#ffb700` 6×8 con brillo blanco 1px |
| 25 | **Baya** | `berry` | 1.4d | Círculo `#6a1a7a` 5px + cap `#a83ac2` , sin jugo |
| 26 | **Hongo comestible** | `mushroom` | 1.7d | Rect `#d68a4a` 6px |
| 27 | **Manzana** | `apple` | 2.1d | Rect rojo `#d91e1e` 6px + brillo |
| 28 | **Semilla** | `seed` | Nunca | Punto `#c2a080` 3px |
| 29 | **Grana (semilla pasto)** | `grassSeed` | Nunca | Punto `#7ad35f` 3px indistinguible de seed |
| — | *Cantidad visual* | `amount 1-3` | — | Número encima `1/2/3` con fondo negro 6px |

## 4) MATERIALES DE CONSTRUCCIÓN — 5 tipos
Aparecen excavando (`worldMaterials`), se ven en HUD `ecoMats` y en estructuras.
| # | Objeto | Inventario | Desbloqueo | Estado actual |
|---|--------|------------|------------|---------------|
| 30 | **Piedra** | `stone` | GEN3 IQ124 | Emoji `🪨` + contador, sin textura bloque piedra |
| 31 | **Arcilla** | `clay` | GEN4 IQ128 | `🏺` |
| 32 | **Arena** | `sand` | Siempre | `⏳` |
| 33 | **Fibra** | `fiber` | GEN4 IQ132 | `🧵` |
| 34 | **Madera** | `wood` | GEN5 IQ138 + sapling maduro | `🪵` |

## 5) ESTRUCTURAS CONSTRUIBLES — 4 tipos
Ocupan `w×h` celdas, con `buildProgress 0→1` (andamio). Dibujo en `drawStructures`.
| # | Objeto | `type` | Tamaño | Estado actual |
|---|--------|--------|--------|---------------|
| 35 | **Taller** | `workshop` | 2×2 | Cobertizo 32×32 con techo, mesa, yunque — rects planos `#6b3a1f` |
| 36 | **Granero** | `granary` | 3×2 | Silo 48×32 con sacos 10×8, puerta — rects `#c2a080` |
| 37 | **Puente** | `bridge` | 3×1 | Tabla 48×16 con barandilla — rect `#8b5a2b` |
| 38 | **Torre vigía** | `tower` | 2×3 | Torre 32×48 con almena, antorcha — rect `#7a7a7a` |

## 6) HERRAMIENTAS EQUIPABLES — 3 tipos
Una por hormiga `ant.tool`, bonus excavación/carga.
| # | Objeto | `tool` | Bonus | Estado actual |
|---|--------|--------|-------|---------------|
| 39 | **Pico piedra** | `pick` | +34% dig | Icono `⛏` 14×3 + piedra 8×6, en mandíbula si no anthro |
| 40 | **Cesta fibra** | `basket` | +1 carry | Rect `#c2a080` 8×5 en mandíbula |
| 41 | **Paleta arcilla** | `trowel` | +28% build | Rect `#7a7a7a` 4×2 |

## 7) PERSONAJES / CASTAS — 12+ variantes
**Desde 2026-10-16 no hay spritesheets de bicho**: todos se pintan a mano con `_hormigaVoxel` (misma regla que el terreno: cara de luz arriba, canto de sombra abajo, junta de 1 px entre segmentos). Los cinco PNG que había (`ant-body-walk-6f`, `ant-idle-4f`, `ant-dig-4f`, `ant-rest-2f`, `queen-2f`) se borraron del proyecto: medido en el navegador, cero peticiones de imagen de bicho al arrancar. Medidas de ancho de bulto, sacadas de los píxeles pintados (`test/hormiga-voxel.js`).
| # | Objeto | Código | Gráfico actual | Notas |
|---|--------|--------|----------------|-------|
| 42 | **Obrera minim** | `caste minim` 24% | `_hormigaVoxel` a escala 0,82 → 26×12 px | Vida -0,14d, crop 1,2 |
| 43 | **Obrera media** | `caste media` 60% | escala 1 → 33×15 px | Base |
| 44 | **Obrera major** | `caste major` 16% | escala 1,3 → 45×18 px, mandíbulas de 5 px | Vida +0,38d, crop 2,0 |
| 45 | **Excavadora** | `role EXCAVADORA` | franja roja de 1 px en el tórax | Pico en las mandíbulas (bloque, sin contorno) |
| 46 | **Recolectora** | `role RECOLECTORA` | franja de miel | Lleva la gota prendida, dentro del propio pintor |
| 47 | **Exploradora** | `role EXPLORADORA` | franja cian | Antenas que bailan un bloque entero |
| 48 | **Nodriza** | `role NODRIZA` | franja violeta | Distinta ya por color y por postura al criar |
| 49 | **Obrera genérica** | `role OBRERA` | franja de miel | Sin oficio aún (GEN<2) |
| 50 | **Reina Ada** | `queen` | escala 1,75 → 57×27 px, corona de tres puntas apoyada en la cabeza | Única clase; la barra de puesta y la de vida son bloques duros |
| 51 | **Reinas hijas** | `queens[]` | mismo pintor, tinte de facción en la barra | Facción color dot |
| 52 | **Antropo chibi** | `anthroStyle 0/1` | bípedo dibujado a mano (18×24 px), testa más grande en el 1 | Lo que changea el botón es la POSTURA, no un fichero |
| 53 | **Antropo hoodie** | `anthroStyle 2` | ídem, con capucha de 4 px | Alternativo |
| — | **Estados anim** | — | `walk 6f @110ms`, `idle 4f @520ms`, `dig 4f hold 200ms`, `rest 2f @600ms` | Ya existe, necesita pulir transiciones |

## 8) CRÍA / BROOD — 4 tipos
Dibujadas en `broodRow` y como `brood[]` con `x,y`.
| # | Objeto | `type` | Estado actual |
|---|--------|--------|---------------|
| 54 | **Huevo** | `egg` | `●` blanco 20×20 `brood-dot` |
| 55 | **Larva** | `larva` | `~` beige `#f5e6c8`, hambre real necesita trofalaxia |
| 56 | **Pupa** | `pupa` | `◆` marrón `#8b5a2b`, capullo |
| 57 | **Larva real** | `isQueen true` | Mismo que larva pero `👑` y borde dorado — poco distinguible |

## 9) JARDÍN FÚNGICO / BASURA — 2 tipos
| # | Objeto | Código | Estado actual |
|---|--------|--------|---------------|
| 58 | **Jardín fúngico** | `fungusGardens[]` | Nube `#e8d5a3` 8px + partícula, salud 0-1 |
| 59 | **Basurero** | `wastePiles[]` | Montón `#6b4a2a` 6px, radia miasma |

## 10) SEÑALES / FEROMONAS / TINTA — 5 tipos
| # | Objeto | `type`/`sym` | Color | Estado actual |
|---|--------|--------------|-------|---------------|
| 60 | **Feromona recluta** | `recruit` | `#ffcc00` | Punto 4px + halo, vida 1→0 |
| 61 | **Feromona explora** | `explore` | `#7ac8a0` | Punto 3px |
| 62 | **Tinta CIAN** | `⬢` | `#00e5ff` | Símbolo `⬢` 11px en tinta, fondo `#0a1a22` |
| 63 | **Tinta AMARILLO** | `⬣` | `#ffdd57` | `⬣` |
| 64 | **Tinta MAGENTA** | `◆` | `#ff6b9d` | `◆` (cuando ambas >0.4) |

## 11) CLIMA / EFECTOS — 6 tipos
| # | Objeto | Código | Estado actual |
|---|--------|--------|---------------|
| 65 | **Lluvia** | `rainParticles` | Línea 1px `#a0d8ff` + gota 1px, gravedad 0.52, colisiona con suelo/túnel |
| 66 | **Tormenta relámpago** | `lightningTimer` | Flash `rgba(255,255,220,0.45)` + rayo zigzag 2px |
| 67 | **Noche overlay** | `isNight` | Rect `rgba(30,40,60,0.22)` multiply |
| 68 | **Partícula polvo** | `particles[]` | Cuadrado 4×4 `#8b5a2b` con borde negro, 240 cap |
| 69 | **Toast / Notificación** | `toasts[]` | Caja `#ffcc00` 7px `Press Start 2P` |
| 70 | **Sombra hormiga** | — | Elipse `rgba(0,0,0,0.18)` bajo hormiga, pulso |

## 12) OBJETOS OCULTOS / RECOMPENSAS — 3 tipos
| # | Objeto | `hiddenRewards type` | Estado actual |
|---|--------|--------|---------------|
| 71 | **Semillas enterradas** | `semillas` | `🌾` + partículas `#ffcc00` al descubrir |
| 72 | **Agua subterránea** | `agua` | `💧` + `#00e5ff` |
| 73 | **Hongo enterrado** | `hongo` | `🍄` + `#2de67a` |

## 13) ELEMENTOS DE MUNDO QUE FALTAN POR TEXTURIZAR — Resumen para roadmap
- **Superficies:** Topsoil/arcilla/arena/piedra/pizarra/bedrock necesitan tiles 16×16 únicos con tiling y borde `rim` pixelado, no color plano.
- **Vegetación:** 9 plantas × 3 estadios = 27 sprites + 3 variantes cada una = ~35 texturas. Hoy son rects de 3-4px.
- **Recursos:** 6 foods necesitan sprite 12×12 con rotación y pudrición (mancha oscura), no emoji.
- **Materiales:** 5 iconos HUD son emoji; necesitan bloque pixel (piedra cúbica, lingote arcilla, grano arena, madeja fibra, tronco).
- **Estructuras:** 4 edificios necesitan tiles con construcción progresiva (andamio → terminado) con interior.
- **Herramientas:** 3 herramientas solo icono mandíbula; necesitan sprite mano/mandíbula + animación picar.
- **Personajes:** Nodriza indistinguible de recolectora; falta sprite nodriza con larva; reina solo 2 frames; antropo 3 estilos sin walk fino.
- **Brood:** Huevo/larva/pupa son `●/~ /◆` CSS; necesitan sprite 16×16 con animación temblor.
- **Fungus/Waste:** Nubes genéricas; necesitan micelio y basura con moscas.

---

**TOTAL conteo tangible único: 73 objetos** (14 superficies + 9 plantas + 6 foods + 5 materiales + 4 estructuras + 3 herramientas + 12 personajes + 4 brood + 2 hongos/basura + 5 señales + 6 clima + 3 ocultos)

## 14) LA ESCALERA (2026-10-16) — lo que hay que dibujar al cavar hondo

Cerrado en código y pintado por bloques de 16 (el mismo `soilType` que pinta el terreno), sin PNG nuevos.
Diseño completo en **`ant-farm-rpg/docs/PROFUNDIDAD.md`**.

| # | Objeto | Cómo se ve hoy | Estado |
|---|--------|----------------|--------|
| 1 | **Nueve bandas de roca** (raíces · barro · arena · piedra · pizarra · cuarcita · mármol · obsidiana · basalto) | color propio por `soilType` 15, 11, 12, 13, 14 en las bandas nuevas, con su luz arriba y su sombra abajo | ✅ |
| 2 | **Vetas por banda** (cobre 19 en piedra, hierro 20 en pizarra, oro 6 en cuarcita, gema 7 en mármol y obsidiana, sal 18) | dos o tres puntos del tono del metal dentro del bloque, contados por cantidad | ✅ |
| 3 | **La losa de umbral** (tipo 17) | roca más oscura que su banda, grietas según los puntos de vida y barra de progreso colgada sobre ella; al romperse se convierte en el primer piso nuevo | ✅ |
| 4 | **Magma** (tipo 15, última banda) | bloque de fuego que parpadea en `drawFarm` sobre el índice `magmaCells`, con su halo cálido en las casillas vecinas | ✅ |
| 5 | **Reliquias** (9, una por partida) | rombo de cuatro bloques en la casilla donde salieron + tarjeta con grito en el eco del umbral + **VITRINA** en el panel del mundo (con su pedestal) | ✅ en el panel · ⏳ **falta la vitrina física dentro del mundo** |
| 6 | **Cuevas de banda** | hueco ya abierto al romper la losa, con su botín dentro | ✅ |
| 7 | **Pantalla de inicio** | lienzo de 176×88 duplicado a 352: madriguera, montículo que tiembla, topo que asoma en dos empujones, polvo con gravedad, parpadeo y respiración | ✅ |

Pendiente de dibujo (lo asume el próximo paso del taller): la **vitrina física** en una cámara de la reina,
el **nivel freático** con su anegamiento, la **humedad** que oscurece la roca y la **reliquia que cambia
el genoma** (una marca visible en la cría: dos hijos con patas más largas en el árbol).

Siguiente paso: elige 1 categoría para atacar primero. Recomendación: **Superficies 1-8** (suelo) porque todo lo demás se apoya encima y es lo que más se ve (70% de pantalla es tierra).
