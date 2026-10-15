#!/usr/bin/env bash
# scripts/aplana-y-empuja.sh — el contenido del taller manda, la historia del remoto manda.
#
# Por que hace falta: el sandbox no conserva `.git/` entre turnos (el snapshot se queda con los ficheros
# y el historio local vuelve a un punto anterior), mientras que GitHub sigue teniendo lo ya empujado.
# El resultado es un «non-fast-forward» que no es un conflicto de verdad: lo que hay que llevar es el
# ARBOL de trabajo, no mis commits viejos. Este guion hace exactamente eso y nada destructivo:
# guarda el contenido en una rama, se pone sobre el remoto, copia el contenido encima y empuja.
#
#   bash scripts/aplana-y-empuja.sh "mensaje del commit"
set -eu
cd "$(dirname "$0")/.."
MSG="${1:-estado del taller $(date -u +%Y-%m-%dT%H:%M)}"
RAMA="$(git branch --show-current)"
REM="$(cat .secrets/remote.txt 2>/dev/null || true)"
[ -n "$REM" ] || { echo "MAL: falta .secrets/remote.txt (git@ssh.github.com:usuario/repo.git)"; exit 1; }

git add -A
git commit -q -m "$MSG" || echo "  (no habia nada que commitear aqui)"
git branch -f _contenido HEAD

timeout 120 git fetch -q origin
BASE="$(git rev-parse origin/$RAMA)"
echo "  remoto: $BASE"
git reset --hard -q "$BASE"
git checkout _contenido -- .
git add -A
if git diff --cached --quiet; then
  echo "  el remoto ya tiene este contenido: no hay nada que empujar"
  git branch -D _contenido >/dev/null
  exit 0
fi
git commit -q -m "$MSG"
git branch -D _contenido >/dev/null
echo "  ficheros que cambian:"
git diff --stat "$BASE" HEAD | tail -4
bash scripts/empuja.sh
