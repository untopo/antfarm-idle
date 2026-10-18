// test/core-carga.js — antepone a app.js los módulos de core/ para cargarlos juntos en un contexto vm.
// El juego en el navegador los carga como <script> antes de app.js; en Node hay que hacer lo mismo.
const fs = require('fs');
const path = require('path');
const CORE = path.join(__dirname, '..', 'ant-farm-rpg', 'core');
const MODULOS = ['bandas.js', 'mundo.js', 'tesoros.js', 'economia.js', 'agua.js'];
function coreCode() {
  return MODULOS.map(f => fs.readFileSync(path.join(CORE, f), 'utf8').replace(/^'use strict';\s*$/m, '')).join('\n;\n');
}
// Devuelve el código de app.js precedido por el núcleo, listo para vm.runInContext.
function conCore(appSrc) { return coreCode() + '\n;\n' + appSrc; }
module.exports = { coreCode, conCore, MODULOS };
