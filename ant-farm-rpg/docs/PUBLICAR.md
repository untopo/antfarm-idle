# Publicar y probar en vivo

Medido desde este sandbox el 14 de octubre de 2026, no copiado de ninguna página.

## Lo que se comprobó

| Prueba | Resultado |
| --- | --- |
| Salida de red del sandbox | `surge.sh`, `api.github.com`, `vercel.com`, `itch.io`, `pages.cloudflare.com`: HTTP 200 → se puede desplegar desde aquí |
| `vercel deploy dist/live --yes --temporary` | listo en **5 s**, **HTTP 200 público**, sin cuenta y sin clave |
| Navegador real contra esa URL pública | carga 1,7 s · granja 64×36 creada con los cuadros propios · placa del reloj `06:46 → 07:22` · único ruido: los 4 PNG que faltan y `favicon.ico` |
| Descarga real de una partida | **14,3 MB en 23 recursos** (la carpeta `assets/` pesa 28,7 MB: **13,9 MB nunca se piden**) |
| `cloudflared` sin cuenta | túnel público HTTP 200, **sobrevive** a que termine el script (`setsid nohup`), muere con el sandbox |
| La preview de Arena (`8017-<id>.e2b.app`) | responde **403** desde dentro del sandbox: no es un enlace para compartir con nadie |
| Glitch | apagó el hosting de aplicaciones el **8 de julio de 2025**: ya no es una opción |

## Veredicto, en orden de utilidad para esta granja

1. **Vercel — el uso de cada día.** Subo yo, ves el enlace en el móvil, se repite en 5 s por hito.
   Límites de 2026 del plan gratuito Hobby: 100 GB de transferencia al mes, 100 despliegues al día,
   ficheros de hasta 100 MB, **rollback de un clic a cualquier despliegue anterior** y una URL única
   por despliegue (o sea: cada hito deja su copia jugable para siempre). Solo para uso personal,
   no comercial. Login por *device flow*: el CLI imprime una URL y un código, se aprueba en tu
   navegador y **nadie te pide una contraseña por el chat**.
2. **GitHub Pages — el respaldo que faltaba.** Un `git push` por hito y el sitio vive en
   `https://<tu-usuario>.github.io/ant-farm-rpg/`. Repo y sitio publicados: 1 GB cada uno,
   100 GB/mes de banda (límite blando), HTTPS y dominio propio gratis; el despliegue tarda ~1 min y
   Pages es gratuito con repo **público**. Esto es lo que de verdad resuelve el "me quedé sin espacio":
   el trabajo deja de vivir solo en el sandbox.
3. **Cloudflare Pages — si algún día hay tráfico.** Banda ancha ilimitada y 500 builds/mes gratis.
   Desde el sandbox exige un token de API de tu cuenta; mientras no haga falta, no lo movemos.
4. **itch.io — audiencia, no flujo de trabajo.** Sirve para que lo juegue gente y para tener una
   ficha pública versionada; no libera espacio ni añade fps. Publicar necesita tu cuenta: `butler` en
   CI pide API key (no se pega aquí), así que o arrastras tú `dist/antfarm-itch-*.zip` en el dashboard
   o te lo dejo preparado. Corre en un iframe `sandbox` igual que la preview de Arena: los diálogos
   nativos están bloqueados ahí también, y por eso el juego tiene sus propios cuadros.
5. **Netlify Drop — descartado para "que otro lo pruebe con un enlace".** Deja subir sin cuenta, pero
   tras la oleada de fraude de 2024 los sitios anónimos quedan **protegidos con contraseña hasta que
   los reclamas**, y el margen de reclamación bajó a **1 hora** (además: hasta 3 sitios anónimos por IP
   y los ficheros grandes atascan el drop). Para probarlo tú vale; para pasarle un enlace a alguien, no.
6. **El túnel de Cloudflare — lo que ya está puesto hoy.** Cero cuentas, enlace inmediato, y es
   efímero por diseño. Sirve para "míralo ahora mismo", no para guardar nada.

## Comandos

```bash
bash scripts/deploy-live.sh tunnel        # enlace público ya, sin ninguna cuenta (muere con el sandbox)
bash scripts/deploy-live.sh vercel        # sube y da URL + enlace de reclamación (60 min si es anónimo)
bash scripts/deploy-live.sh vercel --prod # con sesión iniciada: URL fija, permanente
bash scripts/deploy-live.sh claim         # cómo iniciar sesión en TU navegador, sin darme claves
bash scripts/deploy-live.sh stage         # solo monta dist/live y comprueba que es idéntico al repo
bash scripts/pack-itch.sh                 # el zip para itch.io (index.html en la raíz)
```

`deploy-live.sh` **nunca** sube nada que no sea byte a byte lo del repo: monta `dist/live`, compara
`index.html`, `js/app.js` y `css/style.css` con `cmp`, y no pasa de ahí si algo difiere. El enlace de
reclamación se guarda en `.deploy/ultimo-claim.txt`, fuera del repo a propósito: eso es propiedad, no
publicidad. Lo que se comparte es la URL del juego.

## Lo que el hosting NO arregla

Los fotogramas. El coste del frame se decide en el bucle y está medido: 0,4–0,6 ms de render y 0,5–0,6 ms
de simulación según tamaño; el cuello real es `rebuildSoilCache` (2,06 ms en BIG), y eso se baja con el
**atlas de tiles**, no con un CDN. Lo único que el hosting mueve aquí es la primera carga: hoy 14,3 MB,
y ahí sí hay margen — quitar los 13,9 MB de texturas que nunca se piden y cuantizar colores deja el
paquete en 5–8 MB sin tocar una sola forma del juego.


## Copia de seguridad: el remoto manda, el sandbox no

**Donde vive ahora mismo el proyecto:** `git@github.com:untopo/antfarm-idle.git`
(rama `master`, privado, y la `deploy key` de este sandbox tiene permiso de escritura). Empujar un hito es
una orden: `bash scripts/push-ssh.sh`. Si algun dia esto se rebobina y no recuerda la URL, esta linea
la recuerda; si se perdio la clave privada, `bash scripts/deploy-key.sh` y se vuelve a pegar la publica.

Aprendido dos veces en un dia: el workspace se rebobina y se lleva `node_modules`, las librerias
del Chrome, `.deploy/` y hasta dos `commit`. Un repo git **local** no es backup; solo lo es lo que
esta empujado. Por eso:

1. `git add -A && git commit -m "..."` en cada hito (el repo ya lleva identidad local, `snapshot.sh`
   puede commitear solo).
2. `git push` al remoto (GitHub privado, con el arte dentro: sin texturas la copia es media granja).
3. `bash scripts/snapshot.sh "..." --full` y **descargar** el `code.tgz`/`full.tgz`/`bundle`: el kit
   1832 pesa 41 MB con arte y se restaura byte a byte.

Autenticarse sin pegar token en el chat: `python3 scripts/gh-login.py` abre un seudoterminal, responde
los avisos de `gh auth login` y deja el codigo de 8 caracteres en `.deploy/gh.log`; se escribe en
`https://github.com/login/device`. Ojo: `~/.config/gh` esta fuera de lo que persiste, asi que tras un
rebobinado hay que volver a pasar por ahi (el codigo caduca a los 15 minutos).

`bash test/run-all.sh` solo es creible si Chrome arranca: `bash scripts/setup-sandbox.sh` lo comprueba
y reinstala lo que falte.
