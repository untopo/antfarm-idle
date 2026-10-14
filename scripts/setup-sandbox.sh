#!/usr/bin/env bash
# Deja el sandbox listo para MEDIR de verdad. Tras un rebobinado del sandbox se pierden
# node_modules y las librerias de sistema del Chrome, y la suite del navegador se SALTA
# en silencio: dio "TODO VERDE" en 8 segundos cuando el test real tarda ~30.
set -euo pipefail
cd "$(dirname "$0")/.."
echo "== dependencias de node =="
[ -d node_modules/puppeteer ] || npm install --no-audit --no-fund >/dev/null 2>&1
echo "   puppeteer: $([ -d node_modules/puppeteer ] && echo instalada || echo FALTA)"
echo "== librerias del chrome =="
if ! ldd "$HOME/.cache/puppeteer/chrome/"*/chrome-linux64/chrome 2>/dev/null | grep -q "libnspr4.so => /"; then
  sudo apt-get install -y -qq libnspr4 libnss3 libatk1.0-0t64 libatk-bridge2.0-0t64 libcups2t64 \
    libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 \
    libpango-1.0-0 libcairo2 libasound2t64 >/dev/null 2>&1 || true
fi
ldd "$HOME/.cache/puppeteer/chrome/"*/chrome-linux64/chrome 2>/dev/null | grep -q "libnspr4.so => /" \
  && echo "   chrome: librerias OK" || { echo "   chrome: FALTAN librerias (los tests de navegador no van a medir nada)"; exit 1; }
echo "== comprobacion de que el navegador ARRANCA (no vale con que el test se salte) =="
NODE_PATH="$PWD/node_modules" node -e '
const pp=require("puppeteer");
(async()=>{ const b=await pp.launch({headless:"new",args:["--no-sandbox"]});
  const p=await b.newPage(); await p.goto("about:blank");
  console.log("   chrome real:", await p.evaluate(()=>navigator.userAgent.split(" ").pop()));
  await b.close(); })().catch(e=>{ console.log("   chrome NO arranca:", e.message.split("\n")[0]); process.exit(1); });'
echo "listo: a partir de aqui 'bash test/run-all.sh' puede decir TODO VERDE"
