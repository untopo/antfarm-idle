/**
 * Diagnostico: por que la camada se atasca (larvas lejos del nido, hambre, Slots de camara llenos).
 *   node test/diag-cria.js [dias] [small|medium]
 */
const { sb, ctx, vm } = require('/home/user/test/world-perf-proflib.js');
const DIAS = Number(process.argv[2] || 6);
const [C, R] = process.argv[3] === 'medium' ? [64, 36] : [48, 28];
vm.runInContext(`topoCreateFreshWorld(${C}, ${R}); paused=false; gameSpeed=64;
  window._paso = () => loop(performance.now());
  window._pintar = () => {
    const q = queens[0] || null;
    const d = (o) => q ? Math.round(Math.hypot((o.x ?? q.x) - q.x, (o.y ?? q.y) - q.y)) : -1;
    return JSON.stringify({
      dia: Math.floor(time / DAY_LENGTH) + 1,
      ob: workers.length, reinas: queens.length, cria: brood.length,
      porEtapa: ['egg', 'larva', 'pupa'].map(t => t[0] + brood.filter(b => b.type === t).length).join(''),
      criaLejosDeNido: brood.filter(b => d(b) > 96).length,
      hambreMax: Math.round(Math.max(0, ...brood.map(b => b.hunger || 0))),
      nodrizas: workers.filter(w => w.role === 'NODRIZA' && w.crop > 0.14).length,
      buches: workers.filter(w => w.crop > 0.12).length,
      cavando: workers.filter(w => w.state === 'CAVANDO').length,
      comiendo: workers.filter(w => w.targetFood).length,
      despensa: Math.round(colonyFood * 10) / 10,
      sostiene: Math.round((3 + 0.6 * brood.length) * 10) / 10,
      slots: sizeProfile().broodSlots, tope: getMaxPopulation(),
      miel: foods.length, basuras: wastePiles.length,
      vidaReina: Math.round(q ? q.health : -1), progReina: Math.round(q ? q.progress : -1),
      puestas: q ? (q.eggsLaid || 0) : 0,
      nacimientos: events.filter(e => e.type === 'birth').length,
      muertes: events.filter(e => e.type === 'death').length,
      ultimo: events.slice(0, 2).map(e => e.type + ':' + e.msg.slice(0, 34)).join(' | ')
    });
  };`, ctx);
const paso = sb._paso, pintar = sb._pintar;
let t = 1;
const MEDIO = 230;
console.log(`mundo ${C}x${R} · ${DIAS} dias a x64`);
for (let f = 0; f < MEDIO * 2 * DIAS; f++) {
  sb.performance.now = () => t; t += 42;
  paso();
  if (f % MEDIO === MEDIO - 1) {
    const j = JSON.parse(pintar());
    console.log(`  d${j.dia} ob${String(j.ob).padStart(2)} reinas${j.reinas} cria ${j.porEtapa} (lejos ${j.criaLejosDeNido}) hambre ${String(j.hambreMax).padStart(3)} | nodrizas ${j.nodrizas} buches ${j.buches} cav ${j.cavando} miel-ruta ${j.comiendo} | despensa ${String(j.despensa).padStart(4)} necesita ${j.sostiene}/${j.slots}slots tope ${j.tope} | reina ${j.vidaReina}v ${j.progReina}% puestas ${j.puestas} | +${j.nacimientos} -${j.muertes} basura ${j.basuras}`);
  }
}
console.log('\nultimos avisos:');
vm.runInContext(`events.slice(0,10).forEach(e=>console.log('   ',e.type+': '+e.msg.slice(0,88)))`, ctx);
