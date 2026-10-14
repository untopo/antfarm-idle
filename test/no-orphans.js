// Guarda contra "funciones llamadas que ya no existen".
// Motivo real: una edicion con script de Python se llevo por delante dos ayudantes del cache de
// suelo (soilRepaintMoundsOver y soilDrawMoundTile). Las llamadas siguieron ahi, el ReferenceError
// lo tapaba un try/catch, y cada calada volvia al camino lento (20 ms) con la suite en verde.
// Uso: node test/no-orphans.js
const fs = require('fs');
const APP = 'ant-farm-rpg/js/app.js';
let fails = 0, oks = 0;
const ok = m => { oks++; console.log('ok   ' + m); };
const bad = m => { fails++; console.log('FAIL ' + m); process.exitCode = 1; };

// Prefijos de la casa: todo lo que empieza asi tiene que estar definido en el propio fichero
const CASAS = /^(soil|hud|rc|size|enforce|topo|game|mark|is|has|should|update|render|draw|paint|build|init|wire|make|spawn|save|load|serialize|deserialize|rebuild|crown|notify|push|start|find|gen|genPersonal|sync|set|toggle|apply|install|ensure|carve|deco|tex|cal|evolve|ant)/;
// Cosas del navegador o del JS que no viven en app.js
const PRESTADO = new Set(['isFinite', 'isNaN', 'parseInt', 'parseFloat', 'requestAnimationFrame', 'cancelAnimationFrame',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'isArray', 'keys', 'values', 'entries', 'from', 'of',
  'max', 'min', 'floor', 'ceil', 'round', 'abs', 'sqrt', 'pow', 'imul', 'random', 'sin', 'cos', 'atan2', 'hypot', 'sign', 'log',
  'getElementById', 'querySelector', 'querySelectorAll', 'createElement', 'getContext', 'appendChild', 'append', 'remove',
  'addEventListener', 'removeEventListener', 'dispatchEvent', 'preventDefault', 'stopPropagation', 'contains', 'closest',
  'push', 'pop', 'shift', 'unshift', 'slice', 'splice', 'indexOf', 'includes', 'join', 'map', 'filter', 'forEach', 'sort',
  'find', 'some', 'every', 'reduce', 'fill', 'keys', 'replace', 'replaceAll', 'split', 'trim', 'padStart', 'match',
  'matchAll', 'test', 'toFixed', 'toString', 'toUpperCase', 'toLowerCase', 'charAt', 'set', 'get', 'has', 'delete', 'clear',
  'clamp', 'assign', 'stringify', 'parse', 'then', 'catch', 'finally', 'all', 'resolve', 'reject', 'click', 'focus', 'blur']);

function definitions(src) {
  const defs = new Set();
  for (const m of src.matchAll(/function\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/g)) defs.add(m[1]);
  for (const m of src.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?(?:function\b|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/g)) defs.add(m[1]);
  for (const m of src.matchAll(/^\s*(?:window\.)?([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?function\b/gm)) defs.add(m[1]);
  for (const m of src.matchAll(/(?:const|let|var)\s*\{([^}]*)\}\s*=/g)) for (const n of m[1].split(',')) defs.add(n.split(':').pop().trim().replace(/\s*=.*/, ''));
  for (const m of src.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:document|window|Math|Object|Array)\b/g)) defs.add(m[1]);
  return defs;
}

function orphanCalls(src, defs) {
  const lines = src.split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i];
    if (/^\s*(\/\/|\*|\/\*)/.test(L)) continue;
    for (const m of L.matchAll(/(^|[^.\w$])([a-z$][\w$]*)\s*\(/gi)) {
      const name = m[2];
      if (!CASAS.test(name) || PRESTADO.has(name) || defs.has(name)) continue;
      // CSS dentro de una plantilla o sonda de existencia: no es una llamada a la casa
      if (/^(calc|var|url|rgb|rgba|hsl|translate[XY]?|scale|rotate|min|max|clamp|linearGradient|paintWorklet)$/.test(name)) continue;
      const contexto = lines.slice(Math.max(0, i - 2), i + 1).join(' ');
      if (contexto.includes("typeof " + name) || contexto.includes('typeof ' + name)) continue;
      out.push({ name, linea: i + 1, texto: L.trim().slice(0, 110) });
    }
  }
  return out;
}

const src = fs.readFileSync(APP, 'utf8');
const defs = definitions(src);
const huerfanos = orphanCalls(src, defs);
if (huerfanos.length === 0) ok('todo ayudante de la casa que se llama esta definido (' + defs.size + ' funciones en pie)');
else {
  const vistos = new Set();
  for (const h of huerfanos) { if (vistos.has(h.name)) continue; vistos.add(h.name); bad('llamada sin definicion: ' + h.name + '() · linea ' + h.linea + ' · ' + h.texto); }
}

// y el propio guard tiene que funcionar: muestra sintetica con un ayudante que falta
const muestra = `
function exists(){ soilHelperMissing(1,2); }
function other(){ return paintNothing(3); }
`;
const probe = orphanCalls(muestra, definitions(muestra));
ok('el guard detecta llamadas huérfanas en una muestra (encontró ' + probe.length + '/2: ' + probe.map(p => p.name).join(', ') + ')');
if (probe.length < 1) bad('el guard no ve huérfanas ni en un ejemplo trivial: no vale para nada');

// los dos ayudantes que se perdieron siguen aqui, con nombre y pila
for (const f of ['soilRepaintMoundsOver', 'soilDrawMoundTile', 'soilRepaintDirtyCells', 'soilIncrementalReady', 'paintCacheCellTextured', 'sizeProfile', 'enforceQueenCap']) {
  if (new RegExp('function\\s+' + f + '\\s*\\(').test(src)) ok('definida ' + f + '()');
  else bad('FALTA la definicion de ' + f + '() (esto es exactamente lo que se perdio el 2026-10-14)');
}
console.log('\n' + (fails ? '❌ ' + fails + ' fallos' : '✅ ' + oks + ' ok · sin llamadas huérfanas'));
