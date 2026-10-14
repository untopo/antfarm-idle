# TEXTURAS DEFINITIVAS — ESTILO RELOJ DE LA COLONIA
**Todas las texturas originales, listas para usar — 12 categorías, 73 objetos**

Paleta maestra: madera `#7b4a22 #6f4220 #84532a`, suelos `#6b4423 #8b5a2b #c2b280`, cielo `#7ec8e3`, acentos `amber #ffcc00 cyan #00e5ff purple #b47aff` — mismo trazo pixel 16-bit, borde negro 2px, luz arriba-izquierda, como el Reloj.

Cada PNG es un **atlas utilizable** (ya seleccionado por ti entre 2 variantes). Ruta: `assets/textures/`

| # | Categoría | Archivo | Contenido | Tamaño |
|---|-----------|---------|-----------|--------|
| 01 | **Superficies / Terreno** | `categoria_01_superficies.png` | 14 tiles: cielo, pasto, topsoil, arcilla, arena, piedra, pizarra, bedrock, aire túnel, rim, cámara decorada, veta, charco, montículo | 3.2M |
| 02 | **Vegetación** | `categoria_02_vegetacion.png` | 9 plantas maduras: trébol, pasto, flor amarilla/blanca, arbusto bayas, hongo, sapling, manzano con manzanas, hongo cueva | 1.1M |
| 03 | **Alimentos** | `categoria_03_alimentos.png` | 6 foods: miel gota, baya, hongo, manzana, semilla, grana | 5.0M |
| 04 | **Materiales** | `categoria_04_materiales.png` | 5 bloques: piedra, arcilla, arena, fibra, madera | 1.7M |
| 05 | **Estructuras** | `categoria_05_estructuras.png` | 4 edificios isométricos ¾: taller 2×2, granero 3×2, puente 3×1, torre 2×3 | 1.7M |
| 06 | **Herramientas** | `categoria_06_herramientas.png` | 3 tools: pico piedra, cesta fibra, paleta | 1.3M |
| 07 | **Personajes** | `categoria_07_personajes.png` | 10 sprites: minim/media/major, 4 roles, reina, anthro, durmiendo | 857K |
| 08 | **Brood / Hongos** | `categoria_08_brood_fungus.png` | 6: huevo, larva, pupa, larva real, jardín fúngico, basurero | 857K |
| 09 | **Señales** | `categoria_09_senales.png` | 6: feromonas recruit/explore, tintas ⬢ ⬣ ◆ ⬡ | 943K |
| 10 | **Clima / Efectos** | `categoria_10_clima_efectos.png` | 6: lluvia, relámpago, noche, polvo, toast, sombra | 1.3M |
| 11 | **Ocultos** | `categoria_11_ocultos.png` | 3 tesoros: semillas enterradas, agua, hongo | 4.7M |
| 12 | **UI** | `categoria_12_ui.png` | Kit: botones madera/ambar/cyan, HUD strip, ruler, notificación, progress bar, tabs, iconos 16px | 1.7M |

**Total: 12 atlas, 73 objetos, 100% estilo Reloj.**

## Cómo se usan
- Cada atlas es **tileable**: recorta por coordenadas (ej. `superficies` 4×4 grid de 64px) y úsalo como `drawImage` en `soilCache`, `drawStructures`, `drawFarm`, etc.
- Ya están en `assets/textures/` — el juego puede cargarlos como `new Image().src = 'assets/textures/categoria_01_superficies.png'`.
- Siguiente paso: integrar categoría por categoría en `js/app.js` (reemplazar rects planos por `drawImage` del atlas).

Dime por cuál empezamos a codear primero (recomiendo 01 Superficies — es el 70% de pantalla).
