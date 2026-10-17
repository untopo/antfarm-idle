/**
 * Regresión del parón fundacional: la semilla 1 heredaba intención de cavado casi -1 en todas sus
 * obreras y abría 0 bloques durante más de tres días. El reflejo colectivo debe poner al menos una
 * obrera libre a abrir frente, sin regalar comida ni forzar una profesión.
 */
process.env.TEST_SEED = '1';
process.env.TEST_CLOCK = 'simulated';
const { sb, ctx, vm } = require('./world-perf-proflib.js');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ok   ' + msg); } else { fail++; console.log('  FAIL ' + msg); } };
let t = 1;
sb.performance.now = () => t;
vm.runInContext(`topoCreateFreshWorld(48,28); paused=false; gameSpeed=64;
  last=performance.now(); lastRealWall=Date.now();
  window._step=()=>loop(performance.now());
  window._estadoParon=()=>({digs, vivas:workers.filter(w=>w.health>0).length, comida:colonyFood});`, ctx);
const inicial = sb._estadoParon();
let errores = 0;
for (let f = 0; f < 460 * 3; f++) {
  t += 42;
  try { sb._step(); } catch (e) { errores++; if (errores < 2) console.log('  ' + e.stack); }
}
const final = sb._estadoParon();
ok(errores === 0, 'la corrida no lanza excepciones');
ok(final.digs > inicial.digs, 'la colonia abre frente aunque todas hereden poco impulso de cavado (' + (final.digs-inicial.digs) + ' bloques)');
ok(final.vivas > 0, 'la colonia sigue viva al final (' + final.vivas + ' obreras, comida ' + Math.round(final.comida*10)/10 + ')');
console.log('\n' + pass + ' ok' + (fail ? ' · ' + fail + ' FALLOS' : ' · semilla 1 sin parón total'));
process.exit(fail ? 1 : 0);
