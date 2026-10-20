# BACKLOG FUTURO · Eventos, actualizaciones y contenido preparado

**Estado:** solo notas. No se toca nada de esto hasta que el juego jugable (fases 0–4 de `CONSTRUCCION_IDLE.md`) esté listo.
**Encargo (Topo, 2026-10-16):** tener contenido preparado para el futuro: actualizaciones, eventos temporales, etc.

## Ideas anotadas

- **Eventos temporales** (una o dos semanas): banda o losa especial con reliquia exclusiva de evento. Sin pagar.
- **Temporadas**: cada temporada cambia un tipo de hormiga o una mezcla de cuadrillas; la vitrina guarda el récord.
- **Desafíos de losa**: una losa con condición (sin obreras nuevas, sólo hierro, etc.) para quien quiera más reto.
- **Mundos de migración**: nuevos mapas de la capa 2 que se publican como expansión gratuita (o de contenido, ver MONETIZACION.md).
- **Códigos de regalo** (como Obelisk Miner): recompensas de comunidad, sin caducidad o con caducidad larga.
- **Notas de versión dentro del juego**: un registro de cambios que el jugador puede leer al volver.
- **Ecología exterior y amenazas aleatorias** (encargo de Topo, 2026-10-20): animales y peligros físicos pueden aparecer en el prado o acercarse a la entrada. Ejemplos a diseñar, no implementar aún: escarabajos que compiten por alimento, arañas o aves que obligan a retirarse, lluvia que arrastra recursos, una colonia rival que tantea la boca y hallazgos beneficiosos poco comunes. No son sólo una animación: alteran temporalmente rutas, reservas o prioridades y dejan una consecuencia física legible.
- **Alarma y defensa emergente**: ante una amenaza real, una exploradora o centinela libera feromona de alarma; las soldadoras disponibles cambian a defensa, se concentran entre la amenaza y la entrada y vuelven a su trabajo al terminar. Sin botón para asignar oficios y sin teletransporte. Rasgos, edad, experiencia, salud, cansancio, distancia y gravedad del ataque deciden quién responde. Las obreras pueden evacuar cría o comida mientras las soldadoras contienen el frente.
- **Resultado de un ataque**: debe haber decisiones y costes —retirada, alimento expuesto, heridas, barreras o contraataque— pero nunca una pérdida total inevitable. Defender bien puede dejar materiales, alimento o experiencia; defender mal genera reparación y recuperación, no un bloqueo imposible.
- **Reglas idle para incidentes**: los eventos salen de una tabla versionada y de la semilla del mundo, con enfriamiento y límites de frecuencia. Al estar ausente se resuelven de forma agregada y aparecen en el resumen de regreso; no pueden matar la colonia ni destruir una reliquia porque el jugador no abrió el juego. Nada de eventos urgentes, rachas, FOMO o recompensas exclusivas por conectarse a una hora concreta.
- **Rejugabilidad de los incidentes**: semillas, profundidad, estación, ecosistema, linaje y defensas cambian qué puede aparecer y cómo responde la colonia. Cada amenaza debe admitir al menos dos respuestas válidas y hacer valiosa una preparación distinta; no será un dado que sólo quita recursos.
- **La colonia actual como estrato futuro**: conservar sólo marcas nacidas de hechos reales (línea de una inundación sellada, hollín de una sala perdida, pigmento donde hubo tráfico o duelo, reparación con el material disponible). Cuando una cámara quede abandonada durante suficiente tiempo, desgaste y derrumbes deben convertir esas huellas —sin texto explicativo— en las ruinas que verá una colonia futura. No inventar una historia retrospectiva: evento real → marca física → deterioro → inferencia del jugador.

## Prioridad acordada · 2026-10-20

Esto queda diseñado como contenido futuro, no como el siguiente cambio. Primero se cierra el corazón idle/incremental: progreso offline agregado, resumen de regreso, decisiones de recursos, capas de reinicio/linaje, semillas comparables y curva de desbloqueos. Después se construye un sistema de incidentes reutilizable y, sobre él, animales, ataques y defensas. Así cada criatura añade contenido y rejugabilidad sin convertirse en otra excepción dentro de `app.js`.

## Reglas para todo lo de aquí

1. Los eventos son gratis y se pueden jugar al volver: nada se pierde por estar ausente.
2. Ningún evento vende ventaja; lo que sí puede venderse es cosmética de evento (ver MONETIZACION.md).
3. Cada evento se diseña sobre el núcleo (fase 1), sin tocar la vista.
4. Se prueba con el bot antes de publicar.
