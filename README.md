# ANT FARM

Una hormiguera que se cava sola. Eres el topo que la cuida: eliges de qué tamaño es la tierra,
confirmas, y entonces —y no antes— empieza a existir el mundo: la reina, las obreras, la miel,
la lluvia que cae con su peso y la tierra que las hormigas sacan y amontonan a la boca del túnel.

**Jugarla en el navegador:** <https://untopo.github.io/antfarm-idle/>

No instala nada, no pide cuenta. Si el enlace de arriba todavía no responde, es que Pages no está
publicado aún; se construye solo con cada `push` a `master` (mira *Actions → publicar-demo*).

## Cómo se prueba en tu máquina

```
git clone https://github.com/untopo/antfarm-idle.git granja
cd granja
node dev-server.js        # http://127.0.0.1:8017 — sirve ant-farm-rpg/ sin caché
```

Sin Node vale cualquier servidor estático apuntando a `ant-farm-rpg/`. El juego no tiene build:
`js/app.js`, `css/style.css` y `assets/` se sirven tal cual. El fuente permanece en esa carpeta; al
publicar, `scripts/build-pages-root.sh` copia **su contenido** a la raíz del artefacto de Pages. Por eso
la URL pública termina en `/antfarm-idle/`; la antigua `/ant-farm-rpg/index.html` sólo redirige allí.

## Las pruebas

```
bash test/run-all.sh
```

Comprobará de verdad, no de palabra: sintaxis de `app.js`, que no queden llamadas a funciones que
ya no existen, las reglas por tamaño de mundo, que una calada repintada salga **idéntica** al mapa
entero (píxel a píxel, en Chrome real), que el almacén sólo exista tras trabajo físico en el nido
conectado, que los oficios emerjan de experiencia/edad/rasgos/necesidad, que ninguna simulación gaste
materiales sin aprobación y que las herramientas antiguas migren a adaptaciones corporales, que el guardado
sobreviva a recargar la página, y que el botón «+1 DÍA» simule el día entero y cave bloques. Necesita `npm install` (Puppeteer) y Chrome:
`bash scripts/setup-sandbox.sh` reinstala lo que falte y **no deja** correr la suite si el navegador
no arranca — una comprobación que se salta en silencio no es una comprobación.

## Cómo se publica

| qué | cómo |
| --- | --- |
| demo en vivo (este sitio) | `git push origin master` → `publicar-demo` ejecuta `scripts/build-pages-root.sh` y despliega la raíz |
| paquete para itch.io | `bash scripts/pack-itch.sh` → `dist/antfarm-itch-*.zip` (subir como *Playable*, oculto si quieres) |
| desplegar a Vercel | `bash scripts/deploy-live.sh vercel` (necesita sesión; `--tmp` caduca) |
| copias del proyecto | `bash scripts/snapshot.sh "mensaje" --full` → `snapshots/*.tgz` y un `.bundle` clonable |
| dónde está el remoto | anotado en `ant-farm-rpg/docs/PUBLICAR.md` (y en `.gitidentity`) |

Lo que hay dentro de `ant-farm-rpg/docs/` son las notas del taller: cómo funciona el mundo, los
incidentes con sus números medidos y qué quedó pendiente. Las notas siguen en español; la interfaz pública del juego está en inglés.

## Cosas que este proyecto no hace

No pide cuenta, no guarda datos fuera de tu navegador (el registro vive en `localStorage`), no tiene
analítica, y no te enseña nada que no puedas ver: si quieres saber por qué una hormiga hizo lo que
hizo, la consola del navegador lo cuenta.

*Arte y texto originales del proyecto. Las texturas están en `ant-farm-rpg/assets/`; las que ya no
se usan siguen ahí, archivadas en `assets/_archivo/`, por si algún día vuelven a servir.*
