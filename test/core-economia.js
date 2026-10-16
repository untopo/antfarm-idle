// test/core-economia.js — pruebas en Node de core/economia.js (sin navegador).
const E = require('../ant-farm-rpg/core/economia.js');
let ok = 0, fallos = 0;
function check(nombre, cond, extra) {
  if (cond) { ok++; console.log('  ok  ' + nombre); }
  else { fallos++; console.log('  FALLO ' + nombre + (extra !== undefined ? ' → ' + extra : '')); }
}
// Reservas: referencia (ratio 1) y los límites del tamaño de mapa
check('reserva inicial en el tamaño de referencia = 12', E.reservaInicialComida(1) === 12, E.reservaInicialComida(1));
check('reserva inicial nunca baja de 5 (mapa pequeño)', E.reservaInicialComida(0.35) === 5, E.reservaInicialComida(0.35));
check('reserva inicial nunca sube de 20 (mapa grande)', E.reservaInicialComida(2.6) === 20, E.reservaInicialComida(2.6));
check('reserva de superficie en referencia = 5', E.reservaSuperficie(1) === 5, E.reservaSuperficie(1));
check('reserva de superficie tiene suelo 2 y techo 10', E.reservaSuperficie(0.1) === 2 && E.reservaSuperficie(9) === 10);
check('tope de superficie en referencia = 8', E.topeSuperficie(1) === 8, E.topeSuperficie(1));
check('tope de superficie tiene suelo 3 y techo 14', E.topeSuperficie(0.1) === 3 && E.topeSuperficie(9) === 14);
// Pagar
const m = { stone: 5, clay: 2, wood: 3 };
check('puedePagar con inventario suficiente', E.puedePagar(m, { stone: 2, clay: 1 }) === true);
check('no puedePagar si falta un material', E.puedePagar(m, { stone: 2, fiber: 1 }) === false);
check('pagar resta exactamente el coste', E.pagar(m, { stone: 2, clay: 1 }) === true && m.stone === 3 && m.clay === 1 && m.wood === 3);
const antes = { stone: 1 };
check('pagar sin fondos no toca el inventario', E.pagar(antes, { stone: 2 }) === false && antes.stone === 1);
const vacio = {};
check('material ausente cuenta como 0', E.puedePagar(vacio, { wood: 1 }) === false);
console.log('\n' + ok + ' ok · ' + fallos + ' FALLOS');
process.exit(fallos ? 1 : 0);
