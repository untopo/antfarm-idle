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
check('la reserva vital protege exactamente 5 raciones', E.reservaVitalComida() === 5, E.reservaVitalComida());
// Pagar
const m = { stone: 5, clay: 2, wood: 3 };
check('puedePagar con inventario suficiente', E.puedePagar(m, { stone: 2, clay: 1 }) === true);
check('no puedePagar si falta un material', E.puedePagar(m, { stone: 2, fiber: 1 }) === false);
check('pagar resta exactamente el coste', E.pagar(m, { stone: 2, clay: 1 }) === true && m.stone === 3 && m.clay === 1 && m.wood === 3);
const antes = { stone: 1 };
check('pagar sin fondos no toca el inventario', E.pagar(antes, { stone: 2 }) === false && antes.stone === 1);
const vacio = {};
check('material ausente cuenta como 0', E.puedePagar(vacio, { wood: 1 }) === false);

// Libro de cuentas: un único dueño para comida, materiales, pagos y guardado.
const libro = E.createEconomyLedger({food:12,materials:{stone:5,clay:2}});
check('el libro carga comida y completa materiales ausentes', libro.food === 12 && libro.materials.stone === 5 && libro.materials.wood === 0);
libro.creditFood(3,'entrega de prueba');
check('acreditar comida actualiza el saldo', libro.food === 15, libro.food);
const parcial=libro.debitFood(20,{floor:5,partial:true,reason:'cría de prueba'});
check('un débito parcial respeta la reserva vital', parcial === 10 && libro.food === 5, parcial+' / '+libro.food);
const rechazado=libro.debitFood(1,{floor:5,reason:'gasto bloqueado'});
check('un débito entero sin fondos no toca el saldo', rechazado === 0 && libro.food === 5, libro.food);
libro.creditMaterial('fiber',4,'cosecha');
check('el libro acredita materiales', libro.materials.fiber === 4, libro.materials.fiber);
check('el pago de materiales es atómico', libro.payMaterials({stone:2,fiber:3},'herramienta') && libro.materials.stone===3 && libro.materials.fiber===1);
const antesFallido={...libro.materials};
check('un pago imposible no resta ninguna pieza', !libro.payMaterials({stone:99,fiber:1},'imposible') && JSON.stringify(libro.materials)===JSON.stringify(antesFallido));
const identidad=libro.materials;
libro.replaceMaterials({wood:7},'cargar partida');
check('cargar materiales conserva la identidad que usa la UI', libro.materials===identidad && libro.materials.wood===7 && libro.materials.stone===0);
const foto=libro.snapshot(); foto.materials.wood=99;
check('la instantánea no permite mutar el libro', libro.materials.wood===7 && foto.food===5);
const historia=libro.history();
check('el diario conserva importe, saldo y motivo', historia.some(e=>e.account==='food'&&e.reason==='entrega de prueba'&&e.delta===3) && historia.some(e=>e.account==='material'&&e.reason==='cargar partida'));
libro.clearJournal(); libro.creditFood(1,'entrega repetida'); libro.creditFood(1,'entrega repetida');
const agrupada=libro.history();
check('el diario agrupa movimientos consecutivos para no cargar cada frame', agrupada.length===1 && agrupada[0].delta===2 && agrupada[0].count===2);
console.log('\n' + ok + ' ok · ' + fallos + ' FALLOS');
process.exit(fallos ? 1 : 0);
