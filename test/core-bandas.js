// test/core-bandas.js — pruebas en Node de core/bandas.js (sin navegador).
const B = require('../ant-farm-rpg/core/bandas.js');
let ok = 0, fallos = 0;
function check(nombre, cond, extra) {
  if (cond) { ok++; console.log('  ok  ' + nombre); }
  else { fallos++; console.log('  FALLO ' + nombre + (extra !== undefined ? ' → ' + extra : '')); }
}
// Fronteras de banda: desde = primer piso de la banda
check('piso 0 es ROOTS (banda 0)', B.bandaDe(0) === 0);
check('piso 2 sigue en ROOTS', B.bandaDe(2) === 0);
check('piso 3 pasa a CLAY', B.bandaDe(3) === 1, B.bandaDe(3));
check('piso 54 es OBSIDIAN (banda 7)', B.bandaDe(54) === 7, B.bandaDe(54));
check('piso 55 es IGNEOUS BASALT (banda 8)', B.bandaDe(55) === 8, B.bandaDe(55));
check('piso 999 se queda en la última banda', B.bandaDe(999) === 8);
// Tipos y durezas de banda
check('tipo de piso 60 = 14 (basalto)', B.tipoDePiso(60) === 14, B.tipoDePiso(60));
check('dureza de tipo 13 (obsidiana) = 29', B.durezaDe(13) === 29, B.durezaDe(13));
check('arena movediza tiene dureza negativa (-4)', B.durezaDe(3) === -4, B.durezaDe(3));
check('losa (17) tiene dureza fija 999 por DUREZA_EXTRA', B.durezaDe(17) === 999, B.durezaDe(17));
check('magma (15) no se cava: 999', B.durezaDe(15) === 999, B.durezaDe(15));
// Nombres y colores con límites seguros
check('NOMBRE_BANDA(-5) stays inside the array', B.NOMBRE_BANDA(-5) === B.BANDAS[0].n);
check('NOMBRE_BANDA(99) no se sale del array', B.NOMBRE_BANDA(99) === B.BANDAS[8].n);
check('COLOR_BANDA(1) es el color de CLAY', B.COLOR_BANDA(1) === '#b0673f');
// Estructura de los datos
check('hay 9 bandas', B.BANDAS.length === 9, B.BANDAS.length);
check('bandas en orden creciente de profundidad', B.BANDAS.every((b, i, a) => i === 0 || b.desde > a[i - 1].desde));
check('PISOS_BANDA = 8', B.PISOS_BANDA === 8);
check('vetaDeBanda(0) es null (roots: no vein)', B.vetaDeBanda(0) === null);
console.log('\n' + ok + ' ok · ' + fallos + ' FALLOS');
process.exit(fallos ? 1 : 0);
