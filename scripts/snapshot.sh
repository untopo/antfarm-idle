#!/usr/bin/env bash
# snapshot.sh - fotografia recuperable del proyecto, en ficheros que se pueden SACAR del sandbox.
#
#   bash scripts/snapshot.sh "mensaje del commit"
#   bash scripts/snapshot.sh "mensaje" --full      # incluye ademas los 28 MB de assets
#
# Deja en snapshots/:
#   antfarm-<ts>-code.tgz      codigo (index.html, css, js, docs, tests, scripts) ~230 KB
#   antfarm-<ts>.bundle        historico de git, clonable tal cual (sin assets, para que pese MB no 100s de MB)
#   antfarm-<ts>-sha256.txt    huellas para comprobar que la copia no esta corrupta
#   antfarm-<ts>-full.tgz      solo con --full: codigo + assets (lo que no se puede regenerar)
#
# Por que existe: el espacio de trabajo puede volver solo a una revision anterior (paso el 2026-10-14,
# ver ant-farm-rpg/docs/INCIDENTE-20261014.md). git dentro del workspace protege de mis errores, no de
# eso. Lo unico que sobrevive de verdad es lo que TU descargas fuera.
set -euo pipefail
cd "$(dirname "$0")/.."
TS="$(date +%Y%m%d-%H%M)"
MSG="${1:-snapshot $TS}"
FULL="${2:-}"
mkdir -p snapshots

if [ ! -d .git ]; then
  git init -q
  git config user.email "topo@antfarm.local"
  git config user.name "Topo (workspace)"
fi
# los assets no entran en el historico: 28 MB por commit hinchan .git y el snapshot del workspace
if git ls-files --error-unmatch ant-farm-rpg/assets >/dev/null 2>&1; then
  git rm -r -q --cached ant-farm-rpg/assets >/dev/null 2>&1 || true
  echo "assets fuera del historial (quedan en el -full.tgz)"
fi

git add -A
if ! git diff --cached --quiet; then
  git -c commit.gpgsign=false commit -q -m "$MSG"
  echo "commit: $(git log --oneline -1)"
else
  echo "commit: nada nuevo que guardar ($(git log --oneline -1))"
fi

CODE="snapshots/antfarm-$TS-code.tgz"
BUNDLE="snapshots/antfarm-$TS.bundle"
SHA="snapshots/antfarm-$TS-sha256.txt"
FULLF="snapshots/antfarm-$TS-full.tgz"

tar czf "$CODE" --exclude='*/node_modules' \
    ant-farm-rpg/index.html ant-farm-rpg/css ant-farm-rpg/js ant-farm-rpg/docs ant-farm-rpg/README.md \
    test scripts dev-server.js package.json

git bundle create "$BUNDLE" --all >/dev/null

if [ "$FULL" = "--full" ]; then
  tar czf "$FULLF" ant-farm-rpg
  ( cd snapshots && sha256sum "$(basename "$CODE")" "$(basename "$BUNDLE")" "$(basename "$FULLF")" ) > "$SHA"
else
  ( cd snapshots && sha256sum "$(basename "$CODE")" "$(basename "$BUNDLE")" ) > "$SHA"
fi

# comprobacion: se restaura de verdad? (clonar el bundle y comparar el codigo contra el workspace)
TMPR="$(mktemp -d)"
if git clone -q "$BUNDLE" "$TMPR/repo" 2>/dev/null; then
  if cmp -s "$TMPR/repo/ant-farm-rpg/js/app.js" ant-farm-rpg/js/app.js \
  && cmp -s "$TMPR/repo/ant-farm-rpg/index.html" ant-farm-rpg/index.html; then
    echo "bundle:   restaura y coincide byte a byte"
  else
    echo "bundle:   !! clona pero el contenido DIFIERE - revisar"
  fi
else
  echo "bundle:   !! no se puede clonar - revisar"
fi
if tar xzf "$CODE" -C "$TMPR" 2>/dev/null && cmp -s "$TMPR/ant-farm-rpg/js/app.js" ant-farm-rpg/js/app.js; then
  echo "tgz:      restaura y coincide byte a byte ($(tar tzf "$CODE" | wc -l) ficheros)"
else
  echo "tgz:      !! no se pudo verificar"
fi
rm -rf "$TMPR"

echo ""
ls -l snapshots/antfarm-$TS-* | awk '{printf "  %10d B  %s\n", $5, $9}'
echo ""
echo "Descarga el -code.tgz siempre; el -full.tgz si quieres guardar tambien los 28 MB de arte."
echo "Restaurar en cualquier maquina con git:  git clone antfarm-$TS.bundle granja"
echo "Tamano de .git: $(du -sh .git 2>/dev/null | cut -f1)"
