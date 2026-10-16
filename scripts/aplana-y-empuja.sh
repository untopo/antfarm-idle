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

# El sandbox no conserva la config de git (`.git/config` esta fuera del snapshot a proposito), asi que el
# remoto y la clave se reponeen SIEMPRE, igual que en empuja.sh - si no, el fetch de abajo dice
# «'origin' does not appear to be a git repository» y el guion se cae antes de empezar.
LLAVE="$(pwd)/.secrets/deploy_key"
[ -f "$LLAVE" ] || LLAVE=".secrets/deploy_key"
# el snapshot del sandbox vuelve con los permisos en 0644 y ssh entonces IGNORA la clave («bad
# permissions»), que parece un problema de acceso y no lo es. Se arregla aqui mismo.
chmod 600 "$LLAVE" 2>/dev/null || true
git config user.name     "$(git log -1 --format=%an 2>/dev/null || echo untopo)"
git config user.email    "$(git log -1 --format=%ae 2>/dev/null || echo untopo@users.noreply.github.com)"
git remote remove origin 2>/dev/null || true
git remote add origin "$REM"
git config core.sshCommand "ssh -i $LLAVE -p 443 -o HostKeyAlias=github.com -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"

git add -A
git commit -q -m "$MSG" || echo "  (no habia nada que commitear aqui)"
git branch -f _contenido HEAD

timeout 120 git fetch -q origin
BASE="$(git rev-parse origin/$RAMA)"
echo "  remoto: $BASE"
git reset --hard -q "$BASE"
git checkout _contenido -- .
# Ojo con los borrados: `git checkout rama -- .` copia lo que hay en la rama, pero NO quita lo que
# existe en el base y ya no está en la rama. Sin estas dos lineas, un fichero jubilado (los PNG de
# hormiga, por ejemplo) se queda colgado en el remoto para siempre aunque aqui lo hayas borrado.
git diff --name-only --diff-filter=D "$BASE" _contenido | while IFS= read -r muere; do
  [ -e "$muere" ] && git rm -q --ignore-unmatch "$muere" || true
done
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
