/**
 * Diagnostico de atasco tardio: por que dejan de llegar entregas a partir de un dia u otro.
 * Muestra por hormiga el estado, si tiene ruta por galeria y cuanto se mueve de verdad.
 *   node test/diag-atasco.js [diasHasta] [small|medium]
 */
const { sb, ctx, vm } = require('/home/user/test/world-perf-proflib.js');
const HASTA = Number(process.argv[2] || 6);
const [C, R] = process.argv[3] === 'medium' ? [64, 36] : [48, 28];

vm.runInContext(`topoCreateFreshWorld(${C}, ${R}); paused=false; gameSpeed=64;
window._paso = () => loop(performance.now());
// hay camino por galerias entre dos puntos? (lo que routeStep ve)
window._ruta = (ax, ay, bx, by) => {
  const s = { x: ax, y: ay, _routeGoal: '', _routeUntil: -1e9, _routeNext: null };
  const r = routeStep(s, bx, by);
  const cc = (v) => Math.floor(v / CELL);
  return JSON.stringify({
    desde: cc(ax) + ',' + cc(ay), hasta: cc(bx) + ',' + cc(by),
    celdaLibre: !!(soil[cc(ay)] && soil[cc(ay)][cc(ax)] === 0),
    paso: r ? (Math.floor(r.x / CELL) + ',' + Math.floor(r.y / CELL)) : null
  });
};
window._estado = () => JSON.stringify(workers.slice(0, 14).map(w => ({
  id: (w.id || '?').slice(-2), st: (w.state || '?').padEnd(14),
  bx: Math.round(w.blocked || 0), tx: w.targetFood ? Math.round(w.targetFood.x) : null,
  ty: w.targetFood ? Math.round(w.targetFood.y) : null,
  x: Math.round(w.x), y: Math.round(w.y), carga: w.food ? 1 : 0, crop: Math.round((w.crop || 0) * 100) / 100,
  v: Math.round(w.health || 0), dig: w.digTarget ? (Math.floor(w.digTarget.x / CELL) + ',' + Math.floor(w.digTarget.y / CELL)) : null
}))) + '|' + JSON.stringify({
  miel: foods.map(f => Math.round(f.x) + ',' + Math.round(f.y) + (f.claimedBy ? '*' : '')),
  abiertas: worldStats().open, cav: workers.filter(w => w.state === 'CAVANDO').length,
  desp: Math.round(colonyFood * 10) / 10, ent: deliveries, dia: Math.floor(time / DAY_LENGTH) + 1
}) + '|' + JSON.stringify(queens.map(q => ({ x: Math.round(q.x), y: Math.round(q.y), v: Math.round(q.health) })));`, ctx);

const paso = sb._paso, estado = sb._estado, ruta = sb._ruta;
let t = 1;
const MEDIO = 230;
const TOTAL = MEDIO * 2 * HASTA;
console.log(`mundo ${C}x${R} · salto al dia ${HASTA} y mido 2 medias jornadas`);
let prev = null;
for (let f = 0; f < TOTAL; f++) { sb.performance.now = () => t; t += 42; paso(); }
for (let k = 0; k < 3; k++) {
  const a = estado().split('|');
  for (let f = 0; f < MEDIO; f++) { sb.performance.now = () => t; t += 42; paso(); }
  const b = estado().split('|').map(x=>JSON.parse(x));
  console.log(`\n== dia ${b[1].dia} · entregas ${b[1].ent} · abiertas ${b[1].abiertas} · cav ${b[1].cav} · despensa ${b[1].desp} · reinas ${JSON.stringify(b[2])}`);
  console.log(`   miel: ${b[1].miel.join(' ')}`);
  b[0].forEach((h, i) => {
    const p = prev && prev[i];
    const mov = p ? Math.round(Math.hypot(h.x - p.x, h.y - p.y)) : 0;
    let rt = '';
    if (h.tx !== null) rt = ' · rutaA(' + h.tx + ',' + h.ty + ')=' + sb._ruta(h.x, h.y, h.tx, h.ty);
    else if (p) rt = ' · rutaA(entrada)=' + sb._ruta(h.x, h.y, (b[2][0] ? b[2][0].x : 0), 90);
    console.log(`   ${h.id} ${h.st} en (${h.x},${h.y}) mov ${String(mov).padStart(4)}px bloqueada ${String(h.bx).padStart(4)} carga ${h.carga} crop ${h.crop} vida ${h.v} dig ${h.dig}${rt}`);
  });
  prev = b[0];
}
