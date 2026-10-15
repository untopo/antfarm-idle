/**
 * Diagnostico: que le pasa a una colonia nueva dia a dia (obreras, cras por etapa, comida, muertes).
 * Ejecuta el app.js REAL en el DOM de juguete y avanza el bucle de verdad.
 *   node test/diag-colonia.js [dias] [small|medium]
 */
const { sb, ctx, vm } = require('/home/user/test/world-perf-proflib.js');

const DIAS = Number(process.argv[2] || 5);
const [C, R] = process.argv[3] === 'medium' ? [64, 36] : [48, 28];
vm.runInContext('topoCreateFreshWorld(' + C + ', ' + R + '); paused=false; gameSpeed=64;', ctx);

// reloj falso: 42 ms por frame (el bucle recorta a 42 y asi x64 avanza ~161 dt por frame)
let t = 1;
const dia0 = vm.runInContext('Math.floor(time/DAY_LENGTH)+1', ctx);

function foto() {
  return vm.runInContext(`(()=>({
    dia: Math.floor(time/DAY_LENGTH)+1,
    horas: Math.round((time%DAY_LENGTH)/DAY_LENGTH*24*10)/10,
    obreras: workers.length,
    reinas: queens.length,
    huevos: brood.filter(b=>b.type==='egg').length,
    larvas: brood.filter(b=>b.type==='larva').length,
    pupas: brood.filter(b=>b.type==='pupa').length,
    progCria: brood.map(b=>b.type[0]+Math.round(b.progress)).join(','),
    hambreLarvas: Math.round(Math.max(0,...brood.filter(b=>b.type==='larva').map(b=>b.hunger||0),0)),
    comida: Math.round(colonyFood),
    progresoreina: Math.round(queens.length?queens[0].progress:-1),
    saludreina: Math.round(queens.length?queens[0].health:-1),
    nodrizasConBuche: workers.filter(w=>w.role==='NODRIZA'&&w.crop>0.14).length,
    cualquieraConBuche: workers.filter(w=>w.crop>0.14).length,
    mielEnMapa: foods.length,
    tope: getMaxPopulation(),
    muertas: events.filter(e=>e.type==='death').length
  }))()`, ctx);
}

const filas = [];
const porDia = new Map();
const framesPorDia = 460; // ~72000 dt / 161 por frame -> redondeado, se corta por dia real
for (let f = 0; f < framesPorDia * DIAS; f++) {
  sb.performance.now = () => t; t += 42;
  vm.runInContext('loop(performance.now());', ctx);
  const f2 = foto();
  if (!porDia.has(f2.dia) || f2.obreras + f2.huevos + f2.larvas + f2.pupas !== (porDia.get(f2.dia).obreras + porDia.get(f2.dia).huevos + porDia.get(f2.dia).larvas + porDia.get(f2.dia).pupas)) porDia.set(f2.dia, f2);
  if (f % 90 === 0) filas.push(f2);
}
const t0 = Date.now();
console.log(`mundo ${C}x${R} · ${DIAS} dias simulados · ${filas.length} muestras (${Math.round((Date.now() - t0) / 1000)} s de reloj)`);
console.log('dia | obre | huev/lar/pup | prog cria | hambre | comida | %reina | nodr+buche | miel | tope | muertas');
for (const r of filas) {
  console.log(`${String(r.dia).padStart(3)} | ${String(r.obreras).padStart(4)} | ${String(r.huevos + '/' + r.larvas + '/' + r.pupas).padStart(12)} | ${r.progCria.slice(0, 26).padEnd(26)} | ${String(r.hambreLarvas).padStart(6)} | ${String(r.comida).padStart(6)} | ${String(r.progresoreina).padStart(6)} | ${String(r.nodrizasConBuche).padStart(10)} | ${String(r.mielEnMapa).padStart(4)} | ${String(r.tope).padStart(4)} | ${String(r.muertas).padStart(7)}`);
}
console.log('\nultimos avisos de muerte:');
const ev = vm.runInContext(`events.slice(0,14).map(e=>e.type+' | '+e.msg)`, ctx);
ev.forEach(e => console.log('   ' + e));
