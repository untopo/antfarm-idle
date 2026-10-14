#!/usr/bin/env bash
# scripts/push-remoto.sh — el unico paso que de verdad evita perder trabajo: empujar.
#
# Reusa la sesion de gh (flux de dispositivo: quien autoriza es el dueno de la cuenta, asi que
# NO hace falta anadir a nadie como collaborator ni crear un usuario robot). Si el repo todavia
# no existe, lo crea privado y lo empuja todo, arte incluido. Al final verifica CONTRA LA API,
# porque "creo que subi" no es una comprobacion.
#
#   bash scripts/push-remoto.sh              # empuja a lo que diga .gitidentity
#   REMOTO=otro bash scripts/push-remoto.sh  # fuerza otro nombre de repo
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
GIT_ID="$ROOT/.gitidentity"
REPO="${REPO:-antfarm-rpg}"

say(){ printf '  %s\n' "$*"; }
[ -x "$(command -v gh)" ] || { echo "MAL: falta gh (sudo apt-get install -y gh)"; exit 1; }
if ! gh auth status >/dev/null 2>&1; then
  echo "SIN SESION: lanzo el flujo de dispositivo; escribe el codigo en https://github.com/login/device"
  [ -x "$(command -v python3)" ] || { echo "MAL: necesito python3 para el pseudo-terminal"; exit 1; }
  mkdir -p .deploy; ( setsid nohup python3 scripts/gh-login.py > .deploy/gh.out 2>&1 < /dev/null & )
  for i in $(seq 1 20); do
    c=$(tr -d '\r' < .deploy/gh.log 2>/dev/null | grep -oE 'one-time code: [0-9A-F]{4}-[0-9A-F]{4}' | tail -1)
    [ -n "$c" ] && { echo ""; echo "  >>> $c  (vale 15 minutos) <<<"; break; }
    sleep 1
  done
  echo "  cuando lo hayas puesto, vuelve a lanzar este script."
  exit 2
fi

# 1) identidad: la del dueno, no la del taller
if [ -f "$GIT_ID" ]; then
  . "$GIT_ID"
else
  login=$(gh api user -q .login); name=$(gh api user -q '.name // .login')
  id=$(gh api user -q .id); email="$id+$login@users.noreply.github.com"
  { printf 'name=%s\nemail=%s\nlogin=%s\nremote=https://github.com/%s/%s.git\n' "$name" "$email" "$login" "$login" "$REPO"; } > "$GIT_ID"
  . "$GIT_ID"
fi
git config user.name "$name"; git config user.email "$email"
say "identidad: $name <$email>"

# 2) todo commiteado (si hay cambios, se registran como suyo)
if [ -n "$(git status --porcelain)" ]; then
  git add -A && git commit -q -m "estado del taller $(date -u +%Y-%m-%dT%H:%M) · $(git status --porcelain | wc -l) ficheros" && say "commiteados los cambios pendientes"
fi

# 3) remoto: se crea si no esta (el .git/config no sobrevive a los rebobinados, por eso se anota aqui)
if ! git remote get-url origin >/dev/null 2>&1; then
  gh repo create "$REPO" --private --source="$ROOT" --remote=origin --push 2>&1 | tail -1
  say "repo creado y empujado: $remote"
else
  git push -q origin HEAD:master && say "empujado a $(git remote get-url origin)"
fi

# 4) verificacion: el remoto tiene que tener EXACTAMENTE este commit y los mismos ficheros
sleep 4
login=$(gh api user -q .login)
lh=$(git rev-parse HEAD)
rh=$(gh api "repos/$login/$REPO/commits" -q '.[0].sha' 2>/dev/null || echo SIN_DATOS)
lb=$(git ls-files | wc -l); rb=$(gh api "repos/$login/$REPO/git/trees/$lh?recursive=1" -q '[.tree[]|select(.type=="blob")]|length' 2>/dev/null || echo SIN_DATOS)
vis=$(gh api "repos/$login/$REPO" -q '.visibility' 2>/dev/null || echo SIN_DATOS)
ok=1
[ "$lh" = "$rh" ] || { ok=0; }
[ "$lb" = "$rb" ] || [ "$rb" = "SIN_DATOS" ] || ok=0
say "HEAD local  $lh"
say "HEAD remoto $rh"
say "ficheros    local $lb · remoto $rb"
say "visibilidad $vis"
if [ "$ok" = 1 ]; then echo "OK: el remoto es copia del HEAD local"; else echo "MAL: remoto y local no coinciden, no fiarse"; exit 1; fi
echo "  https://github.com/$login/$REPO"
