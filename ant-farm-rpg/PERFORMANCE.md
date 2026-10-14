# Rendimiento

## Antes
- Suelo: 2304 celdas × ~5 fillRect = 11k ops/frame → 60fps = 660k ops/s → lag en móvil a ×8
- UI: innerHTML antList 60×/s → GC spikes
- Partículas sin cap → 400+ → overdraw
- dtMs sin clamp → 200ms spike a ×16 → túneles fantasma

## Ahora
- Suelo: 1 drawImage/frame, rebuild solo si dirty → -96% paint
- UI: 7fps + antList 2.6fps → -85% DOM
- Partículas cap 240, dt clamp 42ms
- maxStep adaptativo 6-28 según gameSpeed

## Medición
Chrome DevTools Performance: antes 38ms/frame a ×8 con 12 hormigas, ahora 11ms. Memoria estable.

