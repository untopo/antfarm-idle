#!/usr/bin/env bash
# restore.sh - saca el proyecto desde un kit de recuperacion y comprueba que arranca.
#
#   bash scripts/restore.sh snapshots/antfarm-20261014-0701.bundle
#   bash scripts/restore.sh snapshots/antfarm-20261014-0701-full.tgz --into /ruta/destino
#
# Sin --into se restaura en ./restaurado-<nombre>.
set -euo pipefail

SRC=""
INTO=""
while [ $# -gt 0 ]; do
  case "$1" in
    --into) shift; INTO="${1:-}" ;;
    *) [ -z "$SRC" ] && SRC="$1" ;;
  esac
  shift
done

if [ -z "$SRC" ] || [ ! -f "$SRC" ]; then
  echo "uso: bash scripts/restore.sh <.bundle|.tgz> [--into dir]"
  exit 1
fi
[ -z "$INTO" ] && INTO="restaurado-$(basename "$SRC" | sed 's/\.[^.]*$//')"
if [ -e "$INTO" ]; then echo "ya existe $INTO - borralo o pasa otro --into"; exit 1; fi

mkdir -p "$(dirname "$INTO")" "$INTO"
case "$SRC" in
  *.bundle)            git clone -q "$SRC" "$INTO" ;;
  *.tgz|*.tar.gz)      tar xzf "$SRC" -C "$INTO" ;;
  *) echo "formato no reconocido (esperaba .bundle o .tgz)"; exit 1 ;;
esac

echo "restaurado en: $INTO"
GAME="$INTO"
[ -d "$INTO/ant-farm-rpg" ] && GAME="$INTO"
if [ ! -f "$GAME/ant-farm-rpg/index.html" ] && [ ! -f "$GAME/index.html" ]; then
  echo "ojo: no veo ant-farm-rpg/index.html ahi dentro"; exit 1
fi
[ -f "$GAME/index.html" ] && ROOT="$GAME" || ROOT="$GAME/ant-farm-rpg"

echo "-- comprobaciones --"
node --check "$ROOT/js/app.js" && echo "  sintaxis de app.js: OK"
if [ -f "$GAME/test/run-all.sh" ]; then
  ( cd "$GAME" && node test/create-farm-flow.js 2>&1 | tail -n 2 )
else
  echo "  (no hay test/ aqui dentro: bash test/run-all.sh solo funciona desde el -full.tgz o el .bundle)"
fi
echo ""
echo "Arrancar:  cd $GAME && node dev-server.js 8017   ->  http://localhost:8017/"
echo "Si el tgz era solo de codigo, coloca encima la carpeta ant-farm-rpg/assets/ del -full.tgz."
