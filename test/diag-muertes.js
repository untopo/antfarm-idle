/**
 * Diagnostico de mortalidad: de que se mueren las hormigas y cuanto viven.
 *   node test/diag-muertes.js [dias] [small|medium]
 */
const { sb, ctx, vm } = require('/home/user/test/world-perf-proflib.js');
const DIAS = Number(process.argv[2] || 8);
const [C, R] = process.argv[3] === 'medium' ? [64, 36] : [48, 28];

vm.runInContext(`topoCreateFreshWorld(${C}, ${R}); paused=false; gameSpeed=64;
window._dc = {}; window._vidas = [];
const _hd = handleDeath;
window.handleDeath = function (a, tipo) { const t = String(tipo); _dc[t] = (_dc[t] || 0) + 1; if (a && a.maxAge) _vidas.push(Math.round(a.age / DAY_LENGTH * 10) / 10); return _hd(a, tipo); };
window._paso = () => loop(performance.now());
window._resumen = () => JSON.stringify({
  dia: Math.floor(time / DAY_LENGTH) + 1, ob: workers.length, reinas: queens.length,
  despensa: Math.round(colonyFood * 10) / 10, cria: brood.length,
  vidaObreras: workers.slice(0, 6).map(w => Math.round(w.age / DAY_LENGTH * 10) / 10 + '/' + Math.round(w.maxAge / DAY_LENGTH * 10) / 10 + 'v' + Math.round(w.health)),
  vidaReina: Math.round(queens[0] ? queens[0].health : -1),
  maxAgeReina: queens[0] ? Math.round(queens[0].maxAge / DAY_LENGTH * 10) / 10 : -1,
  edadReina: queens[0] ? Math.round(queens[0].age / DAY_LENGTH * 10) / 10 : -1,
  muertes: _dc, edadesEnMuertes: _vidas.slice(-8)
});`, ctx);

const paso = sb._paso, resumen = sb._resumen;
let t = 1;
console.log(`mundo ${C}x${R} · ${DIAS} dias`);
for (let f = 0; f < 230 * 2 * DIAS; f++) {
  sb.performance.now = () => t; t += 42; paso();
  if (f % 230 === 229) console.log('  ' + resumen());
}
