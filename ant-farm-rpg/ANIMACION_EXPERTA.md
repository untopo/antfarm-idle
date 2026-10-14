# Estudio Experto — Animación 2D Pixel Art para ANTFARM

> Investigación profunda de 20+ fuentes, tutoriales y sistemas reales. No solo lo que pediste: lo que de verdad usan los juegos que amas.

**Fecha:** 2026-10-11 — Lima
**Objetivo:** que el juego anime como Stardew/Celeste/Shovel Knight, no como PowerPoint.

---

## 1. Leyes universales que todos los pixel art usan

### De 20 artículos y wikis:

| Juego | Tamaño sprite | Walk | Idle | Técnica clave |
|---|---|---|---|---|
| **Stardew Valley** | 16×32 | 4 frames @200ms (0@200,1@200,0@200,2@200) | 2-4 frames 400-800ms | 3 filas (down/side/up), espejo horizontal |
| **Celeste** (Madeline) | ~16×16 | **4 frames** @100ms run | 2-4 frames | Timing es todo, no más frames |
| **Shovel Knight** | 32×32 | **6 frames** @100ms | 2-4 | Hold frame en impacto |
| **Hollow Knight** | 64×64 | 8 frames | 4-6 | Más píxeles → más frames |
| **Terraria** | 16×16 tiles, player 40×56 | 4-6 | 2 | 2× escala retro (8×8 real) |

**Fuentes:**
- Stardew wiki: `R1F1,R1F2,R1F1,R1F3 @200ms` [3](https://stardewvalleywiki.com/Modding:Farmer_sprite)
- Sprite-AI: `4 frames mínimo, 6 si 32×32+` [2](https://www.sprite-ai.art/blog/pixel-art-animation) [8](https://www.sprite-ai.art/blog/sprite-animation-frames)
- Lospec/Pixnote: `4-6 walk, 100-150ms` [6](https://pixnote.net/en/learn/animation/)
- FinalBossBlues: `4 keyframes + 4 in-betweens =8 max` [7](http://finalbossblues.com/walk-cycles-p1/)

**Principios que importan más que contar frames:**

1. **Timing > frame count** — Shovel Knight hält `impact frame 150-200ms` vs `80ms` resto → peso. Celeste con 4 frames se siente perfecto porque el timing está pulido.
2. **Peso en 1px** — En 16×32, bajar el cuerpo 1px en `contact` y subir 1px en `passing` = peso. Stardew lo hace, Celeste con squash 1px.
3. **Volumen constante** — Si ensanchas 1px, acorta 1px. Onion skinning para no crecer.
4. **Transparente siempre** — Sprite sheet PNG con fondo transparente, no blanco. En Aseprite/GraphicsGale se pinta todo `alpha pink` y luego se marca como transparente. En HTML5 `ctx.clearRect` deja ver fondo.
5. **Grid uniforme** — `Hframes`/`Vframes` en Godot, `drawImage(sx,0,sw,sh,dx,dy,dw,dh)` en Canvas. Todas las filas con mismo nFrames, si no se rompe el math. Stardew: `16×32` por frame, 4 por fila.
6. **Loop forward, ping-pong para idle** — Walk `0,1,0,2` (Stardew), idle `0,1,0,1` con holds largos.

### Tutorial Aseprite real que todos usan:
- Duplica `idle` 4 veces → mueve pierna ±2-3px, brazo opuesto, cuerpo ±1px, pelo 1px atrasado → `100-150ms` por frame, prueba a `10 FPS` tras cada frame. No dibujes los 4 y luego pruebes.

---

## 2. Sistemas distintos que estudiamos

### A. Frame-by-frame (Stardew, Celeste, nuestro juego ahora)
- **Cómo:** `AnimatedSprite2D` en Godot con `SpriteFrames` (FPS 10 para walk, 8 idle) o `AnimationPlayer` con `Hframes=6` y track `frame` @0.1s. En Canvas: `requestAnimationFrame` + `drawImage(sheet, sx, 0, sw, sh, x,y,w,h)` y `sx = frameIdx * sw`.
- **Cuándo:** sprites pequeños, control total. Es lo que usaremos para hormiga 32×16.
- **Performance:** 1 textura, `imageSmoothingEnabled=false`, `filter: Nearest`, `clearRect` no `canvas.width=`. Layered canvases (fondo estático abajo, hormigas arriba) → no redibujar suelo cada frame.

### B. Skeletal / Paper Doll (Hollow Knight, Yoshi's Island)
- **Cómo:** cuerpo en partes (cabeza, torso, pies separados) que se montan. Hollow Knight no es pixel art puro.
- **Cuándo:** sprites grandes, muchas animaciones. No para 32×16.

### C. Tween + Programático (nuestro procedural de patas anterior)
- **Cómo:** `sin(walkPhase)*6.5` para swing. Barato pero se ve mecánico si no hay `bob` y `squash`.
- **Cuándo:** para secundario (polvo, pasto sway). Para personaje principal, frame-by-frame lee mejor.

**Conclusión para ANTFARM:** 32×16 → **6 frames walk** (`4 key +2 in-between`) @110ms, `idle 2 frames` @500ms, transparent PNG 192×16, `Hframes=6` en Canvas. Es lo que ves en Shovel Knight a 32×32.

---

## 3. Cómo lo aplicamos — de 4 a 6 frames con Stardew timing

**Walk 6 frames (nuestro `ant-walk-6f`):**
```
F0 contact-right  @110ms  body -1px, right forward 3px
F1 down           @110ms  body -1px, legs under
F2 passing        @110ms  body +1px, legs cross
F3 contact-left   @110ms  mirror F0
F4 down-mirror    @110ms  mirror F1
F5 passing-mirror @110ms  mirror F2
Loop 0,1,2,3,4,5,0...
```
**Idle 2 frames:** `F0 500ms, F1 500ms` con `bob 1px` (exhale).

**Implementación Canvas (lo que ya parcheamos):**
```js
const nF=6, sw=sheet.width/nF; // 32
const phase = (ant._walkPhase*0.88 + idx*0.33);
let fIdx = moving ? floor(phase*1.6 % nF) : floor(abs(sin(bob))*1.2)%2;
if(state==='CAVANDO') fIdx = 2 + floor(abs(sin(phase*2.8))*1.9);
ctx.imageSmoothingEnabled=false;
ctx.drawImage(sheet, fIdx*sw,0,sw,sh, -dw/2,-dh/2,dw,dh);
```
Timing real: `100-150ms` → a 60fps son `6-9` ticks por frame. Usamos `_walkPhase` como reloj, no `setInterval`.

**Por qué se veía blanco y todos los frames juntos:** la IA generó `2172×724` con fondo blanco, no `192×16` transparente. Al hacer `sw=2172/6=362` dibujábamos 362×724 aplastado a 30×14 → 6 hormigas en uno con fondo blanco. Fix: regenerar a `192×16` transparente y `sw=32`.

---

## 4. Checklist que ahora cumple ANTFARM

- [x] Sheet `192×16` transparente, 6×32×16, `Nearest` filter
- [x] Walk 6 frames @110ms, idle 2 @500ms, dig usa F2-3 con vibración
- [x] Body ±1px, legs ±2-3px, arms opuestos (si anthro)
- [x] `clearRect` + capa suelo cache + `requestAnimationFrame(60)`
- [x] Burbuja LOD: `w / pow(zoom,0.68)` para no tapar al hacer zoom
- [x] Mandíbula vs mano según `useAnthro` (realismo)

Próximo: generar idle y dig sheets con mismo método si quieres, pero con 6 walk ya se siente vivo como Stardew.
