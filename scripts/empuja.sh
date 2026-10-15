#!/usr/bin/env bash
# scripts/empuja.sh — empujar sin redescubrir las credenciales cada turno.
#
# El taller (sandbox) no conserva `.git/config` entre turnos: el remoto y la orden SSH se pierden, y
# la clave SI sobrevive porque vive en `.secrets/deploy_key` (fuera del repo, a proposito). Este guion
# reusa la clave, mete el tunel por el puerto 443 (el 22 esta cortado en el sandbox) y comprueba el
# resultado contra el propio remoto, porque «creo que subi» no es una comprobacion.
#
#   bash scripts/empuja.sh              # empuja la rama actual a lo que diga .secrets/remote.txt
#   bash scripts/empuja.sh -n           # solo dice como quedaria (dry-run)
set -eu
cd "$(dirname "$0")/.."
LLAVE="$HOME/.secrets/deploy_key"
[ -f "$LLAVE" ] || LLAVE=".secrets/deploy_key"
# ruta absoluta SIEMPRE: si se pasa relativa y se le pega $PWD por delante, ssh no encuentra la clave
# y el fallo parece «sin permisos», que es mil veces peor que un error claro.
case "$LLAVE" in /*) ;; *) LLAVE="$PWD/$LLAVE" ;; esac
[ -f "$LLAVE" ] || { echo "MAL: no hay clave en .secrets/deploy_key"; exit 1; }
chmod 600 "$LLAVE" 2>/dev/null || true

REM="$(cat .secrets/remote.txt 2>/dev/null || true)"
[ -n "$REM" ] || { echo "MAL: falta .secrets/remote.txt con la URL (git@ssh.github.com:usuario/repo.git)"; exit 1; }

git config user.name     "$(git log -1 --format=%an)"
git config user.email    "$(git log -1 --format=%ae)"
git remote remove origin 2>/dev/null || true
git remote add origin "$REM"
# -p 443 + HostKeyAlias: fuera del sandbox el 22 va, dentro no; asi funciona en los dos sitios.
# Ojo: la ruta de la clave va SIN comillas y ya absoluta - git tokeniza el comando el solo y las
# comillas acaban formando parte del nombre del fichero (ssh diria «sin permisos» por nada).
SSH="$LLAVE"; git config core.sshCommand "ssh -i $SSH -p 443 -o HostKeyAlias=github.com -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"

RAMA="$(git branch --show-current)"
echo "  remoto: $REM · rama: $RAMA · clave: $LLAVE"
if [ "${1:-}" = "-n" ]; then
  GIT_SSH_COMMAND="$(git config core.sshCommand)" git push --dry-run origin "$RAMA" 2>&1 | tail -3
  exit 0
fi
git push origin "$RAMA" 2>&1 | tail -3
sleep 2
REPO="$(printf '%s' "$REM" | sed -E 's#.*[:/]([^/]+)\.git$#\1#')"
LOGIN="$(printf '%s' "$REM" | sed -E 's#.*[:/]([^/]+)/[^/]+(\.git)?$#\1#')"
LH="$(git rev-parse HEAD)"
RH="$(GIT_SSH_COMMAND="$(git config core.sshCommand)" git ls-remote "$REM" "refs/heads/$RAMA" | cut -f1)"
API="$(timeout 40 curl -s "https://api.github.com/repos/$LOGIN/$REPO/commits/$RAMA" | grep -m1 '"sha"' | tr -d ' ",' | cut -d: -f2)"
echo "== comprobado contra el remoto y contra la API =="
echo "  local  $LH"
echo "  ls-remote $RH"
echo "  api       $API"
if [ "$LH" = "$RH" ] && [ "$LH" = "$API" ]; then
  echo "  OK: GitHub tiene exactamente este commit"
else
  echo "  MAL: no coincide, no fiarse"; exit 1
fi
