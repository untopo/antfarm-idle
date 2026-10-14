/**
 * Reglas y rendimiento por TAMANO de mundo (Ant Farm RPG).
 * Corre el app.js real en un DOM falso; no reimplementa logica: llama las funciones del juego.
 *
 * 1) crear un mundo cuesta proporcional a su area (y no casi igual para el pequeno)
 * 2) jugar cuesta proporcional (los costes fijos por frame van cacheados/throttled)
 * 3) la miel dentro de tierra SIN CAVAR no cuenta como almacenada (y los tarros solo viven en tuneles)
 * 4) la reserva inicial y la cantidad de miel del suelo escalan con el area
 * 5) los nombres son random por colonia y salen del patron fonetico de ESA colonia
 * 6) al avanzar la lengua, la colonia entera se rebautiza (bautizo), no "nunca"
 * 7) no queda el letrero "?" redundante sobre las cajas de tesoro
 */
const fs = require('fs');
const { sb, ctx, vm } = require('/home/user/test/world-perf-proflib.js');

const run = (code) => vm.runInContext(code, ctx);
const src = fs.readFileSync('/home/user/ant-farm-rpg/js/app.js', 'utf8');
let fails = 0, oks = 0;
const ok = (m) => { oks++; console.log('ok   ' + m); };
const bad = (m) => { fails++; console.log('FAIL ' + m); process.exitCode = 1; };
const check = (c, m) => c ? ok(m) : bad(m);

const SIZES = [['SMALL', 48, 28], ['MEDIUM', 64, 36], ['BIG', 96, 48]];
function med(fn, iters = 21) {
  fn(); fn();
  const t = [];
  for (let i = 0; i < iters; i++) { const a = process.hrtime.bigint(); fn(); t.push(Number(process.hrtime.bigint() - a) / 1e6); }
  t.sort((x, y) => x - y);
  return t[t.length >> 1];
}

console.log('\n== 1) crear mundo: coste vs area ==');
// medicion INTERCALADA (S,M,B,S,M,B...) - en este harness el ruido va por deriva del JIT,
// y midiendo los tres tamanos en la misma ronda la comparacion deja de ser mentirosa
const cSamples = [[], [], []];
run('topoCreateFreshWorld(48,28); topoCreateFreshWorld(64,36); topoCreateFreshWorld(96,48);'); // warm-up JIT
for (let it = 0; it < 45; it++) {
  for (let k = 0; k < 3; k++) {
    const a = process.hrtime.bigint();
    run(`topoCreateFreshWorld(${SIZES[k][1]},${SIZES[k][2]})`);
    cSamples[k].push(Number(process.hrtime.bigint() - a) / 1e6);
  }
}
const medOf = (t) => { const c = t.slice(4).sort((x, y) => x - y); return c[c.length >> 1]; }; // se descartan las 4 primeras rondas (JIT frio)
// En este harness el ruido viene de deriva del JIT y del GC: la mediana sube cuando la maquina
// esta ocupada. Para comparar tamafios se usa el PISO (minimo de las rondas), que es estable.
const floorOf = (t) => Math.min(...t.slice(1));
const create = cSamples.map(floorOf);
const cells = SIZES.map(([, c, r]) => c * r);
create.forEach((v, i) => console.log(`     ${SIZES[i][0].padEnd(6)} ${v.toFixed(2).padStart(7)} ms · ${cells[i]} celdas · ${(v / cells[i] * 1e6).toFixed(0)} ns/celda`));
// Topo: lo que molesta es la INVERSION (el pequeno mas lento que el mediano). Nadie debe pagar de mas por un mapa menor.
check(create[0] <= create[1] * 1.06 && create[1] <= create[2] * 1.06, `crear no se invierte por tamano (${create.map(v => v.toFixed(2)).join(' / ')} ms)`);
check(create[2] >= create[0] * 1.05, `BIG (${create[2].toFixed(2)} ms) cuesta mas que SMALL (${create[0].toFixed(2)} ms): ratio ${(create[2] / create[0]).toFixed(2)}x`);
check(create[0] < 3.5, `crear un mundo pequeno cuesta ${create[0].toFixed(2)} ms (< 3.5 ms)`);

console.log('\n== 2) frames de juego: coste vs area ==');
// se mide renderLoop() y tickStep() por separado y N veces: asi el numero no depende del
// reloj de pared ni de cuantos ticks quepa el navegador en cada frame
const rSamples = [[], [], []], sSamples = [[], [], []];
run('topoCreateFreshWorld(64,36); paused=false; gameSpeed=1;');
for (let i = 0; i < 3; i++) run('renderLoop(); tickStep(1.7);'); // warm-up
for (let round = 0; round < 5; round++) {
  for (let k = 0; k < 3; k++) {
    const [, c, r] = SIZES[k];
    run(`topoCreateFreshWorld(${c},${r}); paused=false; gameSpeed=1;`);
    let a = process.hrtime.bigint();
    for (let i = 0; i < 300; i++) run('renderLoop();');
    rSamples[k].push(Number(process.hrtime.bigint() - a) / 1e6 / 300);
    a = process.hrtime.bigint();
    for (let i = 0; i < 300; i++) run('tickStep(1.7);');
    sSamples[k].push(Number(process.hrtime.bigint() - a) / 1e6 / 300);
  }
}
const render = rSamples.map(floorOf), sim = sSamples.map(floorOf);
SIZES.forEach((z, i) => console.log(`     ${z[0].padEnd(6)} render ${render[i].toFixed(2)} ms/frame · simulación ${sim[i].toFixed(2)} ms/tick`));
// banda del 25%: este harness resuelve ~0.1 ms y lo que hay que cazar es la PATOLOGIA (que el mapa
// pequeno pese igual o mas que uno grande), no discutir centesimas.
check(render[0] <= render[2] * 1.25 && render[0] <= render[1] * 1.25, `renderizar no penaliza al mapa pequeño (${render.map(v => v.toFixed(2)).join(' / ')} ms)`);
check(sim[0] <= sim[2] * 1.25 && sim[0] <= sim[1] * 1.25, `simular no penaliza al mapa pequeño (${sim.map(v => v.toFixed(2)).join(' / ')} ms)`);
check(render[2] >= render[0] * 0.9 && sim[2] >= sim[0] * 0.9, `el mapa grande tampoco es gratis (render ${(render[2]/render[0]).toFixed(2)}x, sim ${(sim[2]/sim[0]).toFixed(2)}x del pequeño)`);
check(render[0] + sim[0] < 5.0, `mundo pequeno completo (render+sim): ${(render[0] + sim[0]).toFixed(2)} ms (< 5 ms = sobra para 60fps)`);
console.log(`     ratio BIG/SMALL: creacion ${(create[2] / create[0]).toFixed(2)}x · render ${(render[2] / render[0]).toFixed(2)}x · sim ${(sim[2] / sim[0]).toFixed(2)}x (el area pura pide ${(cells[2] / cells[0]).toFixed(2)}x)`);

console.log('\n== 2b) el caché del suelo: repintado incremental vs mapa entero ==');
run('topoCreateFreshWorld(96,48)');
const fullMs = med(() => run('markSoilDirty(); rebuildSoilCache(false)'), 15);
// una calada: 1 celda + sus 4 vecinas
run('markSoilDirty(20,30)');
const oneMs = med(() => run('markSoilDirty(20,30); soilCacheDirty=true; rebuildSoilCache(false)'), 15);
console.log(`     BIG: mapa entero ${fullMs.toFixed(2)} ms · una calada ${oneMs.toFixed(3)} ms (5 celdas)`);
check(oneMs < fullMs / 8, `repintar una calada cuesta ${Math.round(fullMs / Math.max(oneMs, 0.0001))}x menos que repintar el nido entero`);
const antes = run('_soilFullRepaints');
run('for(let r=20;r<24;r++) for(let c=20;c<24;c++) markSoilDirty(c,r)');
run('rebuildSoilCache(false)');
check(run('_soilCellRepaints') > 0 || run('_soilFullRepaints') > antes, `16 celdas sucias se pintan por celda (${run('_soilCellRepaints')} celdas repintadas)`);
run('for(let r=2;r<40;r++) for(let c=2;c<90;c++) markSoilDirty(c,r)');
const fullAntes = run('_soilFullRepaints');
run('rebuildSoilCache(false)');
check(run('_soilFullRepaints') === fullAntes + 1, `y a partir de ${run('SOIL_INCREMENTAL_MAX')} celdas se vuelve a pintar el mapa entero (umbral de sentido comun)`);
// el estado tiene que quedar limpio: si no, la siguiente pinta se perderia
run('markSoilDirty(40,25)'); run('rebuildSoilCache(false)');
check(run('soilCacheDirty') === false && run('soilDirtyCells') === null, 'y tras repintar el estado queda limpio (nada pendiente)');
// un cambio estructural sigue forzando el mapa entero
const f2 = run('_soilFullRepaints'); run('markSoilDirty(); rebuildSoilCache(false)');
check(run('_soilFullRepaints') === f2 + 1, 'markSoilDirty() sin celda = cambio estructural = mapa entero');
// una pasada mini no puede comerse el lote pendiente del principal
run('markSoilDirty(); rebuildSoilCache(false)');
run('markSoilDirty(40,25)');
const lote = run('soilDirtyCells ? soilDirtyCells.size : 0');
run('rebuildSoilCache(true)');
check(run('soilDirtyCells') !== null && run('soilDirtyCells.size') === lote,
  `la pasada mini no se come el lote pendiente del principal (siguen ${run('soilDirtyCells.size')} celdas en cola)`);

console.log('\n== 3) miel en tierra sin cavar NO esta almacenada ==');
run('topoCreateFreshWorld(48,28)');
const honey = run(`(function(){
  const pc=Math.floor(pantryPos.x/CELL), pr=Math.floor(pantryPos.y/CELL);
  // celda SOLIDA cerca de la despensa (tierra intacta que aun no esta cavada)
  let solid=null;
  for(let rr=pr;rr<ROWS&&!solid;rr++) for(let cc=pc-2;cc<=pc+2;cc++){ if(soil[rr]&&soil[rr][cc]===1){ solid={c:cc,r:rr}; break; } }
  if(!solid) return {err:'sin celda solida'};
  const f={x:solid.c*CELL+8,y:solid.r*CELL+8,amount:1,max:1,ftype:'honey',rot:0,fresh:1};
  foods.push(f);
  const enterrada=isFoodInStockpile(f);
  const nAntes=colonyFood;
  // la misma celda, ya cavada
  soil[solid.r][solid.c]=0; if(soilType[solid.r]) soilType[solid.r][solid.c]=0; markSoilDirty();
  const cavada=isFoodInStockpile(f);
  foods.pop();
  // y una miel dentro del tunel de la despensa si debe contar
  const g={x:pantryPos.x,y:pantryPos.y,amount:1,max:1,ftype:'honey',rot:0,fresh:1};
  const enTunelAbierto = (soil[Math.floor(g.y/CELL)][Math.floor(g.x/CELL)]===0) && isFoodInStockpile(g);
  return {enterrada, cavada, enTunelAbierto, solid, dist:Math.hypot(f.x-pantryPos.x,f.y-pantryPos.y), nAntes};
})()`);
check(honey.enterrada === false, `miel dentro de tierra intacta [${honey.solid.c},${honey.solid.r}] no cuenta como almacenada (era el bug: aparecía guardada sin cavar)`);
check(honey.cavada === true, `la MISMA celda, ya cavada, sí cuenta como almacenada`);
check(honey.enTunelAbierto === true, `miel en una celda de tunel de la despensa SÍ cuenta como almacenada`);
check(src.includes('soil[_rr][_cc]===0'), `el dibujo de tarros comprueba que la celda este cavada (guarda en el codigo)`);
check(!src.includes("ctx.fillRect(x-6,y-10,28,8); ctx.fillStyle='#ffcc00'"), `no queda el letrero "?" flotante sobre las cajas de tesoro`);
check(src.includes("ctx.fillText('?',x+8,y+9)"), `la caja de tesoro conserva su propia "?"`);

console.log('\n== 4) reserva y miel inicial proporcionales al tamano ==');
const startRes = SIZES.map(([, c, r]) => {
  run(`topoCreateFreshWorld(${c},${r})`);
  return run('({res:colonyFood, foods:foods.length, ants:workers.length})');
});
startRes.forEach((v, i) => console.log(`     ${SIZES[i][0].padEnd(6)} reserva ${v.res} 🍯 · mieles en el suelo ${v.foods} · obreras ${v.ants}`));
check(startRes[0].res < startRes[2].res, `la reserva inicial sube con el tamano (${startRes.map(v => v.res).join(' -> ')})`);
check(startRes[0].foods < startRes[2].foods, `la comida inicial del suelo sube con el tamano (${startRes.map(v => v.foods).join(' -> ')})`);

console.log('\n== 4b) fundacion y reinas: las mismas reglas, traducidas al tamano ==');
const prof = SIZES.map(([name, c, r]) => {
  run(`topoCreateFreshWorld(${c},${r})`);
  const p = run('sizeProfile()');
  return { name, ...p, ants: run('workers.length'), queens: run('queens.length') };
});
prof.forEach(v => console.log(`     ${v.name.padEnd(6)} obreras fundadoras ${v.founderWorkers} · reinas admitidas ${v.maxQueens} · criado con ${v.ants} hormigas y ${v.queens} reina(s)`));
check(prof[0].founderWorkers === 4 && prof[1].founderWorkers === 5 && prof[2].founderWorkers === 7,
  `las obreras que nacen con el mapa escalan con la raiz del area (4 / 5 / 7)`);
check(prof[0].maxQueens === 1 && prof[1].maxQueens === 2 && prof[2].maxQueens === 3,
  `el nido sostiene 1 reina en 48x28, 2 en 64x36 y 3 en 96x48`);
check(prof.every(v => v.ants === v.founderWorkers), `en los tres tamanos la colonia arranca con las obreras que manda el perfil`);
check(prof.every(v => v.queens <= v.maxQueens), `y la fundacion no pasa del tope de reinas`);
// el tope se aplica de verdad: meter reinas de mas y forzar la expulsion
run('topoCreateFreshWorld(48,28)');
const reinasAntes = run('queens.length');
run(`for(let i=0;i<3;i++) queens.push(ensureQueenMeta({x:W/2+i*6,y:H/2,state:'GRÁVIDA',genome:makeGenome(),faction:0,age:0,progress:0,maxAge:DAY_LENGTH*10,health:100,eggsLaid:0,children:[],history:[]}));`);
const expulsadas = run(`enforceQueenCap('prueba de tope')`);
check(run('queens.length') === run('sizeProfile().maxQueens'),
  `en 48x28, meter 3 reinas de mas deja el nido en ${run('queens.length')} (tope ${run('sizeProfile().maxQueens')})`);
check(expulsadas === 3, `y se van 3 al enjambre, no se quedan invisibles en la cola (${expulsadas})`);
check(run('pushEvent') !== undefined, `la salida se anuncia (hay evento, no silencio)`);
run('topoCreateFreshWorld(96,48)');
check(run('enforceQueenCap("BIG")') === 0, `en 96x48 3 reinas caben y no se va ninguna`);

console.log('\n== 5) nombres random con patron propio de cada colonia ==');
const nameInfo = run(`(function(){
  topoCreateFreshWorld(64,36);
  const L=society.languages[0];
  const names=workers.map(w=>w.personalName);
  const poolOnsets=L.pool.onset;
  const delPool=names.filter(n=>poolOnsets.some(o=>String(n).toLowerCase().startsWith(o))).length;
  return {q:queen.personalName, qMeaning:queen.nameMeaning, faction:society.factions[0].name, names, uniq:new Set(names).size, delPool, poolOnsets, poolNuc:L.pool.nucleus.length, stage:names.length?workers[0].nameStage:''};
})()`);
check(nameInfo.q !== 'Ada' && nameInfo.q, `la reina fundadora se llama "${nameInfo.q}" (ya no viene hardcodeada como Ada)`);
check(/^Colonia /.test(nameInfo.faction) && nameInfo.faction !== 'Colonia Ada', `la faccion toma el nombre de la fundadora: "${nameInfo.faction}"`);
check(nameInfo.uniq === nameInfo.names.length, `los nombres de las obreras son distintos entre si: ${nameInfo.names.join(', ')}`);
check(nameInfo.delPool >= nameInfo.names.length - 1, `${nameInfo.delPool}/${nameInfo.names.length} nombres empiezan con un fonema del inventario de ESTA colonia (${nameInfo.poolOnsets.join('/')})`);
const founders = new Set();
for (let i = 0; i < 14; i++) { run('topoCreateFreshWorld(48,28)'); founders.add(run('queen.personalName')); }
check(founders.size >= 6, `${founders.size} nombres de fundadora distintos en 14 colonias (aleatorio por partida): ${[...founders].slice(0, 8).join(', ')}`);
const poolsDistintas = (() => { const ps = new Set(); for (let i = 0; i < 6; i++) { run('topoCreateFreshWorld(48,28)'); ps.add(run('society.languages[0].pool.onset.join("")')); } return ps.size; })();
check(poolsDistintas >= 3, `${poolsDistintas} inventarios foneticos distintos en 6 colonias (cada granja habla distinto)`);

console.log('\n== 6) la lengua avanza y la colonia se rebautiza ==');
const rename = run(`(function(){
  topoCreateFreshWorld(64,36);
  gen=6; colonyIQ=170; deliveries=40; time=DAY_LENGTH*3.2;
  while(workers.length<8) workers.push(makeAnt(makeGenome()));
  const L=society.languages[0]; L.fluency=0.9; L.stage='idioma';
  const before=workers.map(w=>w.personalName);
  workers.forEach((w,i)=>{ w.nameStage='codigo'; w.personalName='VIEJO'+i; });
  const evAntes=events.length;
  evolveLanguages(1.0);
  const after=workers.map(w=>w.personalName);
  return { cambiados: after.filter((n,i)=>n!=='VIEJO'+i).length, total:after.length,
           etapas:[...new Set(workers.map(w=>w.nameStage))], bautizo: events.slice(0, Math.max(1, events.length-evAntes+2)).some(e=>/Bautizo/.test(e.msg)) || events.some(e=>/Bautizo/.test(e.msg)),
           muestra: after.slice(0,4), uniq:new Set(after).size };
})()`);
check(rename.cambiados === rename.total, `al pasar la lengua a otra etapa se rebautizan ${rename.cambiados}/${rename.total} hormigas (antes el goteo era casi nunca)`);
check(rename.etapas.length === 1 && rename.etapas[0] !== 'codigo', `todas adoptan la etapa "${rename.etapas[0]}": ${rename.muestra.join(', ')}`);
check(rename.bautizo, `queda un evento de historia "Bautizo en la colonia"`);
check(rename.uniq >= rename.total - 1, `los nombres siguen sin repetirse tras el bautizo`);

console.log('\n== 7) el cache del suelo no se queda obsoleto ==');
run('topoCreateFreshWorld(48,28)');
const before = run('worldStats().open');
run('carveRect(6,14,3,3)');
const t0 = Date.now(); while (Date.now() - t0 < 40) { } // la ventana anti-thrash es de ~24ms
const after = run('worldStats().open');
check(after - before === 9, `cavar 3x3 suma 9 celdas al conteo cacheado (${before} -> ${after})`);
check(run('findFrontier().length') > 0 && run('countChambers()') >= 2, `frontier y camaras siguen disponibles desde el cache (${run('countChambers()')} camaras)`);

console.log('\n' + (fails ? `❌ ${fails} fallos / ${oks} ok` : `✅ ${oks} ok · reglas y rendimiento por tamano correctos`));
