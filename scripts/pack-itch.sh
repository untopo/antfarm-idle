#!/usr/bin/env bash
# Prepara el paquete para publicar en itch.io (juego HTML5, descomprimido en la raiz del zip).
# Uso: bash scripts/pack-itch.sh [--out dist]
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="dist"; GAME="ant-farm-rpg"
while [ $# -gt 0 ]; do case "$1" in --out) OUT="$2"; shift 2;; *) echo "opcion rara: $1" >&2; shift;; esac; done
mkdir -p "$OUT"; rm -rf "$OUT/itch-stage"
STAGE="$OUT/itch-stage"; mkdir -p "$STAGE"

# itch.io espera index.html en la RAIZ del zip, y sirve todo tal cual.
cp "$GAME/index.html" "$STAGE/"
cp -r "$GAME/css" "$GAME/js" "$STAGE/"
[ -d "$GAME/assets" ] && { cp -r "$GAME/assets" "$STAGE/assets"; rm -rf "$STAGE/assets/_archivo"; } # el archivo de diseno no se sube
# doc minino dentro del zip para que el paquete se explique solo
{ echo "Topo - Granja de Hormigas (HTML5)"; echo
  echo "Abrir index.html. No necesita servidor, ni build, ni dependencias."; echo
  echo "Si se sirve desde itch.io, el juego corre en un iframe sandbox: los dialogos nativos"; echo "estan bloqueados, por eso el juego usa sus propios cuadros de confirmacion."; echo
  echo "Paquete generado: $(date -u +%Y-%m-%dT%H:%M:%SZ)"; echo "Contenido: index.html css/ js/ assets/"; } > "$STAGE/README-ITCH.txt"

# el index.html del juego apunta a la raiz del proyecto en el sandbox; aqui debe ser autocontenido
node -e '
const fs=require("fs");const p=process.argv[1];let s=fs.readFileSync(p,"utf8");
if(/(?:\.\.\/|\/ant-farm-rpg\/)/.test(s)) console.warn("aviso: hay rutas relativas al subcarpeta en index.html");
console.log("index.html listo para la raiz del zip");' "$STAGE/index.html"

TS=$(date -u +%Y%m%d-%H%M)
ZIP="$OUT/antfarm-itch-$TS.zip"
( cd "$STAGE" && zip -qr "$OLDPWD/$ZIP" . -x '*.DS_Store' )
rm -rf "$STAGE"
# verificacion: lo que va dentro del zip es byte a byte lo que esta en el repo
mkdir -p "$OUT/itch-check" && ( cd "$OUT/itch-check" && unzip -qo "../$(basename "$ZIP")" )
for f in index.html js/app.js css/style.css; do
  cmp -s "$GAME/$f" "$OUT/itch-check/$f" && echo "  ok  $f identico al repo" || { echo "  MAL $f"; exit 1; }
done
node --check "$OUT/itch-check/js/app.js" && echo "  ok  js/app.js parsea dentro del paquete"
n=$(cd "$OUT/itch-check" && find . -type f | wc -l | tr -d ' ')
echo "paquete: $ZIP ($(du -h "$ZIP" | cut -f1), $n ficheros)"
rm -rf "$OUT/itch-check"
echo "subir: itch.io > Developer Dashboard > Upload new project > kind: Html >"
echo "       'This file will be played in the browser' > sube este zip > publicado."
