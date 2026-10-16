// test/core-tesoros.js — pruebas en Node de core/tesoros.js (sin navegador).
const T = require('../ant-farm-rpg/core/tesoros.js');
const B = require('../ant-farm-rpg/core/bandas.js');
let ok = 0, fallos = 0;
function check(nombre, cond, extra) {
  if (cond) { ok++; console.log('  ok  ' + nombre); }
  else { fallos++; console.log('  FALLO ' + nombre + (extra !== undefined ? ' → ' + extra : '')); }
}
// Semilla determinista (mulberry32) para que el sorteo sea repetible
function rngDe(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const D = T.TREASURE_DEFS;
const tipos = Object.keys(D);
// Datos
check('hay 19 tesoros', tipos.length === 19, tipos.length);
check('todo tesoro tiene color y tier', tipos.every(k => D[k].color && D[k].tier >= 1));
check('todo tesoro tiene mensaje en inglés (sin signos ¡ ni ¿)', tipos.every(k => D[k].msg && !/[¡¿]/.test(D[k].msg)));
const reliq = tipos.filter(k => D[k].reliquia);
check('nueve reliquias', reliq.length === 9, reliq.length);
check('reliquias sin acentos en el nombre', reliq.every(k => /^[\x20-\x7E]+$/.test(D[k].reliquia)));
check('cada reliquia tiene lore y bonus', reliq.every(k => D[k].lore && D[k].bonus > 0));
// Compatibilidad con partidas antiguas
const viejos = Object.keys(T.LEGADO_RELIQUIA);
check('la tabla de compatibilidad cubre las nueve reliquias viejas', viejos.length === 9, viejos.length);
check('cada nombre viejo apunta a una reliquia que existe', viejos.every(v => reliq.some(k => D[k].reliquia === T.LEGADO_RELIQUIA[v])));
// Sorteo: solo sale lo que toca a esa banda (o un escalón por encima con poco peso)
const r = rngDe(7);
let fueraDePool = 0, undef = 0;
for (let i = 0; i < 4000; i++) {
  const t = 1 + (i % 9);
  const x = T.pickTreasure(t, 5, r);
  if (!x || !D[x]) undef++;
  if (D[x] && (D[x].tier || 1) > t + 1) fueraDePool++;
}
check('el sorteo nunca devuelve un tipo inexistente', undef === 0, undef);
check('el sorteo no se sale más de un escalón de la banda', fueraDePool === 0, fueraDePool);
// Progreso bajo: no salen tesoros de tier alto
const r2 = rngDe(11);
let altoConProgresoCero = 0;
for (let i = 0; i < 2000; i++) { const x = T.pickTreasure(9, 0, r2); if ((D[x].tier || 1) >= 4) altoConProgresoCero++; }
check('con progreso 0 no salen tesoros de tier 4 o más', altoConProgresoCero === 0, altoConProgresoCero);
// Determinismo
const a1 = T.pickTreasure(5, 3, rngDe(99)), a2 = T.pickTreasure(5, 3, rngDe(99));
check('misma semilla, mismo tesoro', a1 === a2, a1 + ' vs ' + a2);
console.log('\n' + ok + ' ok · ' + fallos + ' FALLOS');
process.exit(fallos ? 1 : 0);
