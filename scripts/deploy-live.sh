#!/usr/bin/env bash
# Publicar la granja y verla en vivo. Tres caminos, de menos a más compromiso:
#   bash scripts/deploy-live.sh tunnel    -> enlace público temporal desde este mismo sandbox (sin cuenta)
#   bash scripts/deploy-live.sh vercel    -> sube a Vercel. Sin login = despliegue temporal reclamable.
#   bash scripts/deploy-live.sh vercel --prod -> con sesión ya iniciada: producción permanente + URL fija
#   bash scripts/deploy-live.sh claim     -> dice que URL abrir para iniciar sesión y quedarse con lo publicado
# Todo lo que se sube es una copia montada en dist/live: el repo no se toca.
set -uo pipefail
cd "$(dirname "$0")/.."
ROOT="$PWD"; GAME="ant-farm-rpg"; STAGE="dist/live"; LIVE_DOCS="ant-farm-rpg/docs/ENLACES.md"
TOOLBIN="$ROOT/tools/vercel-cli/node_modules/.bin/vercel"
CF="$ROOT/.local/bin/cloudflared"
MODE="${1:-tunnel}"; shift || true
PROD=0; for a in "$@"; do [ "$a" = "--prod" ] && PROD=1; done

log(){ printf '%s\n' "$*"; }
say(){ printf '  %s\n' "$*"; }

# ---------- 1) montar la copia que se sube (idéntica al juego, sin basura) ----------
stage(){
  rm -rf "$STAGE"; mkdir -p "$STAGE"
  cp "$GAME/index.html" "$STAGE/"
  cp -r "$GAME/css" "$GAME/js" "$STAGE/"
  # el archivo de diseno no viaja: son 13,3 MB que el juego nunca pide
  if [ -d "$GAME/assets" ]; then cp -r "$GAME/assets" "$STAGE/assets"; rm -rf "$STAGE/assets/_archivo"; fi
  cat > "$STAGE/vercel.json" <<'JSON'
{
  "cleanUrls": false,
  "trailingSlash": false,
  "headers": [
    { "source": "/(.*)",
      "headers": [ { "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" } ] }
  ]
}
JSON
  # comprobaciones antes de mover nada por la red
  node --check "$STAGE/js/app.js" || { log "MAL: js/app.js no parsea en la copia montada"; exit 1; }
  for f in index.html js/app.js css/style.css; do
    cmp -s "$GAME/$f" "$STAGE/$f" || { log "MAL: $f no coincide con el repo"; exit 1; }
  done
  local n sz nx; n=$(find "$STAGE" -type f | wc -l | tr -d ' '); sz=$(du -sh "$STAGE" | cut -f1)
  nx=$(find "$GAME/assets/_archivo" -type f 2>/dev/null | wc -l | tr -d ' ')
  log "copia montada: $STAGE ($n ficheros, $sz) · index.html en la raiz · idéntica al repo"
  say "fuera del paquete: ${nx:-0} ficheros de diseno en assets/_archivo"
}

# ---------- 2) registrar la URL para que el enlace no se pierda ----------
record(){ # $1 modo  $2 url  $3 notas
  local ts; ts=$(date -u +%Y-%m-%dT%H:%MZ)
  mkdir -p "$(dirname "$LIVE_DOCS")"
  if [ ! -f "$LIVE_DOCS" ]; then
    { echo "# Enlaces vivos de la granja"; echo
      echo "Los escribe \`scripts/deploy-live.sh\` en cada publicacion. Un enlace caducado no se borra:"; echo "es el historial de versiones probadas, con su fecha y su \`?v=\`."; echo; } >> "$LIVE_DOCS"
  fi
  echo "- $ts · \`$1\` · <$2> · $3" >> "$LIVE_DOCS"
}

probe(){ # $1 url -> "HTTP 200 · app.js?v=..."
  local u="$1" code v
  code=$(curl -s -o /dev/null -m 30 -w '%{http_code}' "$u/index.html")
  v=$(curl -s -m 30 "$u/index.html" | grep -o 'app\.js?v=[0-9a-z]*' | head -1)
  printf '%s · %s' "$code" "${v:-sin marca de version}"
}

# ---------- 3) tunel público desde aquí mismo (para probar hoy, sin cuentas) ----------
tunnel(){
  local STATE="$ROOT/.deploy"; mkdir -p "$STATE"
  if curl -s -o /dev/null -m 3 http://127.0.0.1:8017/index.html; then SRV=ok; else
    log "MAL: el servidor del juego no responde en 8017 (arranca: node dev-server.js)"; exit 1; fi
  if [ -f "$STATE/tunnel.url" ] && [ "$(probe "$(cat "$STATE/tunnel.url")" | cut -d' ' -f2)" = "200" ]; then
    url=$(cat "$STATE/tunnel.url")
    log "ya habia un túnel abierto: $url"; say "reutilizado ($(probe "$url"))"
    record "tunnel" "$url" "reutilizado · $(probe "$url") · efímero (vive con el sandbox)"; return 0
  fi
  [ -x "$CF" ] || { log "bajando cloudflared..."; mkdir -p "$(dirname "$CF")"
    curl -sSL -m 180 -o "$CF" https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 \
      && chmod +x "$CF"; }
  [ -x "$CF" ] || { log "MAL: no baje cloudflared"; exit 1; }
  log "abriendo túnel público (apunta al servidor 8017 de este sandbox)..."
  # setsid+nohup: el túnel tiene que seguir vivo cuando este comando termina
  setsid nohup "$CF" tunnel --no-autoupdate --url http://127.0.0.1:8017 > "$STATE/tunnel.log" 2>&1 < /dev/null &
  local pid=$! url="" i
  for i in $(seq 1 40); do
    url=$(grep -Eo 'https://[a-z0-9-]+\.trycloudflare\.com' "$STATE/tunnel.log" | head -1)
    [ -n "$url" ] && break; sleep 1
  done
  [ -n "$url" ] || { log "MAL: el túnel no levanto (mira $STATE/tunnel.log)"; kill $pid 2>/dev/null; exit 1; }
  echo "$url" > "$STATE/tunnel.url"; echo "$pid" > "$STATE/tunnel.pid"
  sleep 3
  local p; p=$(probe "$url")
  log "ENLACE VIVO: $url"
  say "$p · pid túnel $pid · servidor local $SRV"
  case "$p" in 200*) : ;; *) log "MAL: el enlace no responde 200 ($p)"; exit 1 ;; esac
  say "una textura de 4 MB: $(curl -s -o /dev/null -m 40 -w '%{http_code} %{size_download}B' "$url/assets/textures/categoria_03_alimentos.png")"
  say "dura mientras este sandbox este despierto; es un enlace público, quien lo tenga lo abre"
  record "tunnel" "$url" "$p · efímero (vive con el sandbox)"
}

# ---------- 4) Vercel ----------
vercel(){
  [ -x "$TOOLBIN" ] || { log "instalando el CLI de Vercel en tools/..."; mkdir -p "$(dirname "$TOOLBIN")/.."
    printf '{"name":"herramientas-topo","private":true,"version":"1.0.0"}' > "$ROOT/tools/vercel-cli/package.json"
    ( cd "$ROOT/tools/vercel-cli" && npm i vercel --no-audit --no-fund --loglevel=error >/dev/null 2>&1 ); }
  [ -x "$TOOLBIN" ] || { log "MAL: no hay CLI de Vercel en $TOOLBIN"; exit 1; }
  local logged=0
  "$TOOLBIN" whoami 2>/dev/null | grep -qvE '^\s*$|Logged out' && logged=1
  if [ "$logged" = "1" ]; then
    local who; who=$("$TOOLBIN" whoami 2>/dev/null | tail -1)
    log "sesión iniciada como $who · subiendo a producción"
    out=$("$TOOLBIN" deploy "$STAGE" --yes --prod 2>&1)
  else
    log "sin sesión: despliegue TEMPORAL (Vercel lo deja reclamable; nadie necesita darme una clave)"
    out=$("$TOOLBIN" deploy "$STAGE" --yes --temporary 2>&1)
  fi
  url=$(printf '%s\n' "$out" | grep -Eo 'https://[a-zA-Z0-9._-]+\.vercel\.app' | tail -1)
  if [ -z "$url" ]; then log "salida del CLI:"; printf '%s\n' "$out" | tail -14; log "MAL: no salio URL"; exit 1; fi
  # un despliegue anonimo caduca y trae un enlace de reclamacion: eso es PROPIEDAD, no va al repo
  claim=$(printf '%s\n' "$out" | grep -Eo 'https://vercel.com/claim-deployment\?code=[a-zA-Z0-9-]+' | tail -1)
  exp=$(printf '%s\n' "$out" | grep -Eo 'expires in [0-9]+ [a-z]+' | tail -1)
  sleep 3
  code=$(curl -s -o /dev/null -m 30 -w '%{http_code}' "$url/index.html")
  v=$(curl -s -m 30 "$url/index.html" | grep -o 'app\.js?v=[0-9a-z]*' | head -1)
  big=$(curl -s -o /dev/null -m 40 -w '%{http_code} %{size_download}B' "$url/assets/textures/categoria_03_alimentos.png")
  log "ENLACE VIVO: $url"
  say "index.html HTTP $code · $v · textura pesada $big"
  [ "$code" = "200" ] || { log "MAL: la URL no responde 200"; printf '%s\n' "$out" | tail -8; exit 1; }
  if [ -n "${claim:-}" ]; then
    mkdir -p "$ROOT/.deploy"; { echo "url=$url"; echo "claim=$claim"; echo "$exp"; echo "fecha=$(date -u +%FT%TZ)"; } > "$ROOT/.deploy/ultimo-claim.txt"
    log "ES TEMPORAL (${exp:-caduca en una hora}) · quedártelo cuesta 30 s, en TU navegador:"
    say "abre   $claim"
    say "ese es el enlace de propiedad: no lo publiques. Lo que se comparte es la URL del juego"
    say "anotado en .deploy/ultimo-claim.txt (a proposito fuera del repo)"
    say "cuando lo reclames avisa y subo con --prod: URL fija + una copia por hito con rollback"
  elif [ "$logged" = "0" ]; then
    say "sin sesión: 'bash scripts/deploy-live.sh claim' te dice cómo iniciarla en tu dispositivo"
  fi
  record "vercel$([ "$logged" = 1 ] && echo '-prod')" "$url" "HTTP $code, $v"
}

claim(){
  log "para quedarte con la granja publicada, en TU navegador (no en este sandbox):"
  say "1. abre https://vercel.com/signup  (puedes entrar con GitHub/Google/correo)"
  say "2. en una terminal tuya:  npx vercel login      -> te da una URL y un código, lo apruebas, ya esta"
  say "   (o desde aqui: ejecuta 'bash scripts/deploy-live.sh login' y dime cuando hayas aprobado)"
  say "3. avisa y yo vuelvo a subir con --prod: la URL pasa a tu cuenta y cada hito deja su copia con rollback"
}

login(){
  log "esperando autorizacion (Vercel muestra URL y código; se abre en TU dispositivo)"
  "$TOOLBIN" login 2>&1 | sed 's/^/  /'
  say "quien soy: $("$TOOLBIN" whoami 2>&1 | tail -1)"
}

case "$MODE" in
  tunnel) stage; tunnel ;;
  vercel) stage; vercel ;;
  both)   stage; tunnel; echo; vercel ;;
  claim)  claim ;;
  login)  login ;;
  stage)  stage; say "solo se monto la copia en $STAGE" ;;
  *) log "uso: bash scripts/deploy-live.sh [tunnel|vercel|both|claim|login|stage] [--prod]"; exit 2 ;;
esac
