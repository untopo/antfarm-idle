/**
 * Bot de equilibrio v0: corre el juego real (app.js + core/) en Node durante N dias simulados y
 * mide la economia cada medio dia. No juega: deja que la colonia viva sola, como un jugador que
 * no toca nada. Sirve para ver si la curva de comida, poblacion, materiales y profundidad es
 * razonable, y cuanto tarda el calculo por dia simulado.
 *
 *   node test/bot-equilibrio.js [dias=2]
 *
 * Falla solo si el juego se rompe (excepcion) o si no pasa nada en absoluto. Los numeros son para
 * leer, no para aprobar: los umbrales de equilibrio se fijan cuando haya un objetivo por fase.
 */
const { sb, ctx, vm } = require('./world-perf-proflib.js');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ok   ' + msg); } else { fail++; console.log('  FAIL ' + msg); } };

const DIAS = Number(process.argv[2] || 2);
const FRAMES_POR_MEDIO_DIA = 230;
const FOTO = `JSON.stringify({
  dia: Math.floor(time/DAY_LENGTH)+1,
  obreras: workers.filter(w=>w.health>0).length,
  comida: Math.round(colonyFood*10)/10,
  entregas: deliveries, cavadas: digs,
  generacion: gen, iq: Math.round(colonyIQ),
  banda: bandaMax, losasRotas: umbralesRotos, reliquias: reliquias.length,
  materiales: Object.values(worldMaterials).reduce((a,b)=>a+(b||0),0)
})`;
vm.runInContext(`topoCreateFreshWorld(48, 28); paused=false; gameSpeed=64;
  window._step = () => loop(performance.now());
  window._foto = () => ${FOTO};`, ctx);

const paso = sb._step, foto = sb._foto;
let t = 1;
const historial = [];
const t0 = Date.now();
let errores = 0;
const total = Math.ceil(FRAMES_POR_MEDIO_DIA * DIAS * 2);
for (let f = 0; f < total; f++) {
  sb.performance.now = () => t; t += 42;
  try { paso(); } catch (e) { errores++; if (errores < 3) console.log('  error en cuadro ' + f + ': ' + e.message); }
  if (f % FRAMES_POR_MEDIO_DIA === FRAMES_POR_MEDIO_DIA - 1) historial.push(JSON.parse(foto()));
}
const seg = (Date.now() - t0) / 1000;

console.log(`\nbot de equilibrio v0 · ${DIAS} dias simulados · ${seg.toFixed(1)} s reales (${(seg / DIAS).toFixed(1)} s por dia)`);
console.log('  dia  obreras  comida  entregas  cavadas  gen  IQ   banda  losas  reliq  materiales');
for (const h of historial)
  console.log(`  ${String(h.dia).padStart(3)}  ${String(h.obreras).padStart(7)}  ${String(h.comida).padStart(6)}  ${String(h.entregas).padStart(8)}  ${String(h.cavadas).padStart(7)}  ${String(h.generacion).padStart(3)}  ${String(h.iq).padStart(4)}  ${String(h.banda).padStart(5)}  ${String(h.losasRotas).padStart(5)}  ${String(h.reliquias).padStart(5)}  ${String(h.materiales).padStart(10)}`);

const ult = historial[historial.length - 1] || {};
ok(errores === 0, 'ningun cuadro lanza excepcion (' + errores + ' errores)');
ok(historial.length > 0 && ult.obreras >= 1, 'la colonia sigue viva al final (' + (ult.obreras || 0) + ' obreras)');
ok(ult.cavadas > 0, 'se cava algo (' + (ult.cavadas || 0) + ' bloques)');
console.log('\n' + pass + ' ok' + (fail ? ' · ' + fail + ' FALLOS' : ''));
process.exit(fail || errores ? 1 : 0);
