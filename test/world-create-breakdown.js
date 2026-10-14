/** Desglose absoluto del coste de crear un mundo: (crear+fase) - (crear) por tamaño. */
const { sb, ctx, vm } = require('/home/user/test/world-perf-proflib.js');
const perf = require('perf_hooks').performance;
const now = () => perf.now();
function bench(fn, iters = 40) {
  fn(); fn();
  const t = [];
  for (let i = 0; i < iters; i++) { const a = now(); fn(); t.push(now() - a); }
  t.sort((x, y) => x - y);
  return t[t.length >> 1] * 1000; // µs mediana
}
const sizes = [['SMALL 48x28', 48, 28, 1344], ['MEDIUM 64x36', 64, 36, 2304], ['BIG 96x48', 96, 48, 4608]];
const phases = [
  ['crear mundo (todo)', ''],
  ['  + initSoil', 'initSoil()'],
  ['  + 5 makeAnt', 'for(let i=0;i<5;i++) workers.push(makeAnt(mutateGenome(queen.genome,0.18,0.6).genome,{x:200+i*20,y:80}))'],
  ['  + comida inicial', 'for(let i=0;i<5;i++) spawnFoodSurface(CENTER_COL*CELL+8+(i-2)*38,1.5,"honey")'],
  ['  + rebuildSoilCache', 'soilCacheDirty=true; markSoilDirty(); rebuildSoilCache();'],
  ['  + serializeSave', 'serializeSave(true)'],
  ['  + ruler+clampView', 'clampView(); updateDepthRuler();'],
  ['  + updateColonyUI', 'updateColonyUI(); _updateBothAntCounts();'],
  ['  + findFrontier (cacheado)', 'findFrontier()'],
  ['  + 20x getMaxPopulation', 'for(let i=0;i<20;i++) getMaxPopulation()'],
];
console.log('fase'.padEnd(28), 'SMALL'.padStart(8), 'MEDIUM'.padStart(8), 'BIG'.padStart(8), '   µs/celda', '  BIG/SMALL');
const base = [], rows = [];
for (const [label, c, r, cells] of sizes) base.push(bench(() => vm.runInContext(`topoCreateFreshWorld(${c},${r})`, ctx)));
for (const [pname, code] of phases) {
  const ms = [];
  for (const [label, c, r, cells] of sizes) ms.push(bench(() => vm.runInContext(`topoCreateFreshWorld(${c},${r}); ${code}`, ctx)));
  const d = ms.map((v, i) => (v - base[i]));
  const perCell = d.map((v, i) => (v / sizes[i][3]).toFixed(2));
  rows.push(pname.padEnd(28) + d[0].toFixed(0).padStart(8) + d[1].toFixed(0).padStart(8) + d[2].toFixed(0).padStart(8) + '   ' + perCell.join(' / ') + '   ' + (d[2] / Math.max(1e-6, d[0])).toFixed(2) + 'x');
}
console.log('crear mundo (base)'.padEnd(28) + base.map(v => v.toFixed(0).padStart(8)).join('') + '   µs absolutos');
console.log(rows.join('\n'));
const ratio = base.map((v, i) => (v / base[0]).toFixed(2));
console.log('\nratio base por tamaño: ' + ratio.join(' / ') + '  (ideal ~ ' + sizes.map(s => (s[3] / sizes[0][3]).toFixed(2)).join(' / ') + ')');
