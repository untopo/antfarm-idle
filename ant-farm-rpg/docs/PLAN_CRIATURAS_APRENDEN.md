# PLAN · Criaturas que aprenden de verdad

**Estado:** plan, sin código. Nada de esto toca el juego hasta que el dueño apruebe la fase 0.
**Pregunta de origen (Topo, 2026-10-16):** «quiero que llegue a ser como lo que yo digo: seres con IA
super inteligentes, una colonia super desarrollada. No importa el tiempo que tome.»

---

## 0 · Qué significa «super inteligente», medido

Sin definición medible, el proyecto no tiene final. Estas son las pruebas que contarán como progreso:

| Capacidad | Prueba concreta (sin guion) | Señal de éxito |
|---|---|---|
| Resolver por descarte | Un reto nuevo (hueco, losa, comida fuera de alcance) que nunca vio | Lo resuelve en menos intentos cada vez |
| Transferir | Mismo reto en un mapa distinto | Resuelve el mapa nuevo con menos intentos que el primero |
| Combinar | Un reto que exige dos habilidades ya aprendidas en orden | Encadena sin haber visto la secuencia |
| Inventar | Un reto que no se resuelve con ninguna habilidad conocida | Aparece una acción nueva que la colonia repite |
| Enseñar | Una criatura aprende de otra sin recompensa directa | La aprendiz resuelve antes que la que empezó de cero |
| Recordar | Vuelve a un sitio o reto tras días sin verlo | Recuerda la solución sin reaprender |

**Criterio de «super»:** resolver en pocos minutos de juego retos que hoy no resuelve nadie, y hacerlo
mejor que una persona que empieza de cero con las mismas herramientas. Eso lo medimos contra una
línea base humana (tú u otra persona jugando el mismo banco de pruebas), no contra una idea.

## 1 · Verdad incómoda: dónde está el límite

- **Un cerebro de miles de parámetros** aprende tareas simples bien. Tareas abiertas (construir algo
  complicado, inventar) necesitan millones de intentos y modelos mucho más grandes.
- **El navegador es el cuello de botella para entrenar**, no para ejecutar. Un modelo pequeño se puede
  ejecutar en el navegador con decenas de criaturas; entrenarlo ahí es lento y se pierde en cada recarga.
- **Por eso el plan separa entrenar de jugar:**
  - *Entrenar* en tu máquina o en la nube, en un simulador sin gráficos que corre mucho más rápido que el juego.
  - *Jugar* con pesos ya entrenados, que ocupan kilobytes, en el navegador.
- **Consecuencia:** «aprender libremente en tu partida» significa aprender *dentro de la vida de cada criatura* a partir de lo que trae de fábrica. El aprendizaje grande ocurre antes, fuera.

## 2 · Fases, con criterio de salida

Cada fase es un **punto de decisión**. Si no pasa su criterio, se corrige antes de avanzar.

### Fase 0 · Diseño del mundo y del banco de pruebas (sin IA todavía)
- Física mínima: materiales (tierra, piedra, comida, agua), gravedad, dos o tres acciones primitivas
  (mover, cavar, depositar), cinco o seis retos escritos a mano.
- Línea base humana: que tú y una persona resuelvan los retos y se mida cuántos intentos les cuesta.
- **Criterio de salida:** los retos son resolubles por una persona en menos de 15 minutos cada uno y la
  línea base queda anotada.
- **Decides tú:** qué retos y en qué orden.

### Fase 1 · Aprender a resolver (una criatura, un reto)
- Red pequeña, aprendizaje por refuerzo (recompensa solo por resolver), en un simulador sin dibujos.
- **Criterio de salida:** la criatura resuelve el reto 1 en el 90 % de los intentos y lo hace en menos
  pasos que al principio.
- **Riesgo que vigilo:** recompensas mal diseñadas (la criatura «se engaña» y encuentra un atajo que no
  era el reto). Cada recompensa se revisa mirando lo que hace, no solo el número.

### Fase 2 · Transferir y recordar
- Mismo reto en mapas nuevos. Memoria recurrente por criatura.
- **Criterio de salida:** resuelve mapas nunca vistos sin volver a empezar de cero; recuerda una solución
  tras días simulados sin verla.

### Fase 3 · Curiosidad e invención
- Premio por explorar lo que aún no conoce. Retos sin solución conocida, para ver si aparece una acción nueva.
- **Criterio de salida:** aparece al menos una estrategia que no estaba en el diseño y que se repite.
  Esta fase es la más incierta; puede no dar nada útil, y eso se dirá.

### Fase 4 · Combinar y planificar
- Dos niveles: un planificador elige una secuencia de habilidades ya aprendidas; cada habilidad es una
  red pequeña.
- **Criterio de salida:** resuelve retos que exigen encadenar dos o tres habilidades, sin verlas en ese orden.

### Fase 5 · Cultura: enseñar y heredar
- Las crías aprenden de las que ya saben (imitación y, si hace falta, un canal de señales que se aprende).
- **Criterio de salida:** una criatura nueva resuelve antes gracias a una enseñada que sin ella.

### Fase 6 · Integrarlo en el juego
- Los pesos entrenados se cargan en el navegador. Se decide mortalidad, legado y cómo se ve el aprendizaje
  (panel, diario de la colonia, retos que propone la propia colonia).
- **Criterio de salida:** el juego corre a velocidad aceptable con la colonia completa, y lo que ves en
  pantalla no está escrito en el código (se comprueba con las pruebas de las fases 1-5).

## 3 · Presupuesto y tiempo (estimaciones, a validar en la fase 0)

- **Tiempo:** cada fase son semanas o meses de trabajo a ritmo de sesiones. El total es de **años**, no de
  meses. Lo acordado: no importa el tiempo, pero conviene que cada fase deje algo útil por sí misma.
- **Cómputo:** las fases 1-5 corren en una máquina con GPU de consumo o en alquiler por horas. El coste
  se decide cuando la fase 1 dé su primer número real, no antes.
- **Lo que no cambia:** el juego sigue funcionando sin nube; la nube solo entrena.

## 4 · Riesgos principales y cómo se controlan

| Riesgo | Control |
|---|---|
| La criatura hace trampa con la recompensa | Revisión visual de lo que hace; recompensas escritas con cuidado; pruebas con retos nuevos |
| Se confunde el progreso medido con el visible | Cada fase se mide con su prueba, no con la impresión |
| El proyecto se alarga sin salida | Criterios de salida por fase; si una falla dos veces, se replantea antes de seguir |
| Expectativas irreales de «super inteligencia» | La meta se mide con la tabla de la sección 0 y se revisa al cierre de cada fase |

## 5 · Decisiones que necesito de ti

1. **Retos de la fase 0:** ¿qué quieres que aprendan primero? Propongo: cavar hasta una losa, cruzar un
   hueco apilando tierra, proteger una entrada, llevar comida lejos.
2. **Número de criaturas:** 6 a 12, como se habló.
3. **Mortalidad:** ¿mueren? Lo recomendable es que mueran lentamente y transmitan lo aprendido (fase 5).
4. **Cómputo:** ¿entrenamos en tu equipo, o autorizas alquilar GPU por horas cuando la fase 1 lo justifique?
5. **Qué miras tú:** ¿un juego de retos con objetivos, o una mascota que observas y guías?

## 6 · Siguiente paso

Cuando respondas las decisiones 1 a 5, cerramos la fase 0 en documento: retos escritos, línea base y
criterios. Solo después se escribe la primera línea de código del simulador.
