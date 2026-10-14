#!/usr/bin/env bash
# Test suite de Ant Farm RPG - node puro, sin dependencias instaladas.
# Uso: bash test/run-all.sh
cd "$(dirname "$0")/.." || exit 1
fail=0
for t in no-orphans create-farm-flow world-size-rules save-roundtrip reload-simulation; do
  printf '\n=== test/%s.js ===\n' "$t"
  if node "test/$t.js" > /tmp/_t.out 2>&1; then
    tail -n 3 /tmp/_t.out
    if grep -q "^FAIL" /tmp/_t.out; then echo ">> HAY FALLOS"; fail=1; fi
  else
    echo ">> EL TEST MURIO"; tail -n 20 /tmp/_t.out; fail=1
  fi
done
printf '\n=== navegador real (si hay puppeteer) ===\n'
if node -e "require('puppeteer')" >/dev/null 2>&1; then
  if node test/browser-smoke.js > /tmp/_br.out 2>&1; then tail -n 4 /tmp/_br.out; else echo ">> FALLOS EN NAVEGADOR"; grep -E "^FAIL|FALLO" /tmp/_br.out | head -n 12; tail -n 4 /tmp/_br.out; fail=1; fi
else
  echo "puppeteer no instalado - salteado (node test/browser-smoke.js lo pide solo: npm i puppeteer)"
fi

printf '\n=== sintaxis ===\n'
node --check ant-farm-rpg/js/app.js && echo "app.js OK"
node -e '
const fs=require("fs");
const h=fs.readFileSync("ant-farm-rpg/index.html","utf8");
const inline=[...h.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join("\n;\n");
fs.writeFileSync("/tmp/_inline.js",inline);
const n=(h.match(/<script(?![^>]*\bsrc=)/g)||[]).length;
console.log("bloques inline en index.html:", n, "(solo el vigia de arranque)");
if(n>1){ console.error("FALLO: hay mas logica inline de la cuenta"); process.exit(1); }
' && node --check /tmp/_inline.js && echo "inline OK"
printf '\n'
if [ "$fail" = 0 ]; then echo "TODO VERDE"; else echo "HAY FALLOS - mirar arriba"; exit 1; fi
