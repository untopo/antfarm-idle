/**
 * Vida larga: la colonia tiene que AGUANTAR generaciones sin apagarse, en cualquier tamaño de mundo.
 *
 * El dueño lo pidió con estas palabras: «eventualmente se terminan muriendo todas y cuando llega a
 * ese punto no nacen más... tienes que simular vidas largas en todas las instancias y asegurarte de
 * que no suceda». La prueba entonces no mira un día suelto: corre 20-25 días de simulación real y
 * exige que al final queden obreras, una corona y partos recientes (no sólo hormigas vivas: si no
 * nace nadie desde hace media semana, la granja ya está muerta aunque camine).
 *
 *   node test/vida-larga.js [dias] [small|medium|big]
 */
const { sb, ctx, vm } = require('/home/user/test/world-perf-proflib.js');
// SEMILLA: el azar (donde cae la miel, quien nace con que) no estaba sembrado, y dos corridas del MISMO
// app.js daban veredictos contrarios - medido: 15, 12 y 13 raciones en tres corridas de un dia. Con
// semilla fija la corrida es repetible, y «antes/despues» quiere decir algo.
const SEMILLA = Number(process.env.SEED || process.argv[4] || 1);
const DIAS = Number(process.argv[2] || 20);
const TAM = process.argv[3] || 'small';
const [C, R] = TAM === 'big' ? [96, 48] : TAM === 'medium' ? [64, 36] : [48, 28];

vm.runInContext(`(function(s){ let a = s>>>0; Math.random = function(){ a = (a + 0x6D2B79F5)>>>0; let t = a; t = Math.imul(t ^ (t>>>15), t|1); t ^= t + Math.imul(t ^ (t>>>7), t|61); return ((t ^ (t>>>14))>>>0) / 4294967296; }; })(${SEMILLA});`, ctx);
vm.runInContext(`topoCreateFreshWorld(${C}, ${R}); paused=false; gameSpeed=64;
window._nac = 0; window._dcs = {};
const _pe = pushEvent;
window.pushEvent = function (t, m, s) { if (t === 'birth') window._nac++; return _pe(t, m, s); };
const _hd = handleDeath;
window.handleDeath = function (a, t) { const k = String(t); _dcs[k] = (_dcs[k] || 0) + 1; return _hd(a, t); };
window._paso = () => loop(performance.now());
window._foto = (marcador) => JSON.stringify({
  dia: Math.floor(time / DAY_LENGTH) + 1, ob: workers.length, reinas: queens.length,
  cria: brood.length, etapas: ['egg', 'larva', 'pupa'].map(t => t[0] + brood.filter(b => b.type === t).length).join(''),
  despensa: Math.round(colonyFood * 10) / 10, tope: getMaxPopulation(),
  mielMapa: foods.length, basura: wastePiles.length, jardines: fungusGardens.length,
  hongosSanos: fungusGardens.filter(f => f.health > 0.55).length,
  nac: window._nac, nacMarcador: window._nac - marcador, dcs: JSON.stringify(window._dcs),
  vidaReina: Math.round(queens[0] ? queens[0].health : -1),
  edadReina: queens[0] ? Math.round(queens[0].age / DAY_LENGTH * 10) / 10 : -1,
  puestas: queens[0] ? (queens[0].eggsLaid || 0) : 0,
  edadesObreras: workers.slice(0, 4).map(w => Math.round(w.age / DAY_LENGTH * 10) / 10 + 'v' + Math.round(w.health)),
  cavando: workers.filter(w => w.state === 'CAVANDO').length, forraj: workers.filter(w => w.targetFood).length
});`, ctx);

const paso = sb._paso, foto = sb._foto;
let t = 1;
const MEDIODIA = 230;
const TOTAL = 2 * MEDIODIA * DIAS;
console.log(`mundo ${C}x${R} (${process.argv[3] || 'small'}) · ${DIAS} dias a x64 · semilla ${SEMILLA}`);
const lineas = [];
let marcador = 0, minimo = 1e9, diaMinimo = 0;
for (let f = 0; f < TOTAL; f++) {
  sb.performance.now = () => t; t += 42; paso();
  if (f % MEDIODIA === MEDIODIA - 1) {
    const j = JSON.parse(foto(marcador));
    marcador = j.nac;
    lineas.push(j);
    if (j.ob < minimo) { minimo = j.ob; diaMinimo = j.dia; }
    if (j.dia % 2 === 1) console.log(`  d${String(j.dia).padStart(2)} ob${String(j.ob).padStart(3)} reinas${j.reinas} cria ${j.etapas} | desp ${String(j.despensa).padStart(5)} tope ${String(j.tope).padStart(2)} miel ${j.mielMapa} basura ${j.basura} jard ${j.hongosSanos}/${j.jardines} | cav ${j.cavando} forr ${j.forraj} | reina ${j.vidaReina}v ${j.edadReina}d puestas ${j.puestas} | +${j.nacMarcador} ${j.dcs}`);
  }
}
const ult = lineas[lineas.length - 1];
const ultimos5 = lineas.slice(-10);
const nacRecientes = ultimos5.reduce((a, b) => a + b.nacMarcador, 0);
let fail = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fail++; };
console.log('');
ok(ult.ob >= 4, `quedan ${ult.ob} obreras el dia ${ult.dia} (minimo de la corrida: ${minimo} el dia ${diaMinimo})`);
ok(ult.reinas >= 1, `la corona sigue viva: ${ult.reinas} reina(s) a ${ult.vidaReina} de vida, ${ult.edadReina} dias`);
ok(nacRecientes >= 1, `y hay partos recientes: ${nacRecientes} nacimientos en los ultimos 5 dias (${ult.puestas} puestas en total)`);
ok(ult.despensa > 0, `la despensa no esta a cero al final: ${ult.despensa} raciones`);
console.log('\n' + (fail ? fail + ' FALLOS · la colonia se apaga' : `✅ vida larga aguantada en ${process.argv[3] || 'small'}`));
process.exit(fail ? 1 : 0);
