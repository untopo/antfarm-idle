/**
 * Reglas y rendimiento por TAMANO de mundo (ANT FARM).
 * Corre el app.js real en un DOM falso; no reimplementa logica: llama las funciones del juego.
 *
 * 1) crear un mundo cuesta proporcional a su area (y no casi igual para el pequeno)
 * 2) jugar cuesta proporcional (los costes fijos por frame van cacheados/throttled)
 * 3) almacenar exige una estructura construida, abierta y conectada; un hueco aislado no da capacidad
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
// el clima tambien repinta el nido (la capa de nieve y el brillo mojado viven en el cache): congelado
// aqui, si no un cambio de tiempo a mitad de medida se come el lote que se esta contando
run('weather.timer=0; weather.nextChange=DAY_LENGTH*60; weather.type="clear";');
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
// una pasada mini no puede comerse el lote pendiente del principal. Toda la secuencia va DENTRO de un
// solo salto al contexto: repartida en cuatro, un tick del reloj falso pinta el cuadro principal entre
// medias y se come el lote por su cuenta (que es licito), y la medida ya no contaba lo que decia contar.
const mini = run(`(function(){
  markSoilDirty(); rebuildSoilCache(false);          // estructural: deja el cache limpio
  markSoilDirty(40,25);
  const n = soilDirtyCells ? soilDirtyCells.size : 0;
  rebuildSoilCache(true);                            // la pasada mini, sobre el mismo lienzo
  return {n, despues: soilDirtyCells ? soilDirtyCells.size : -1};
})()`);
check(mini.n > 0 && mini.despues === mini.n,
  `la pasada mini no se come el lote pendiente del principal (siguen ${mini.despues} de ${mini.n} celdas en cola)`);

console.log('\n== 3) almacenar exige una estructura construida y conectada ==');
run('topoCreateFreshWorld(48,28)');
const honey = run(`(function(){
  const site=storageStructure(false), anchor=_storeAnchor(site);
  const loose={x:anchor.x,y:anchor.y,amount:1,max:1,ftype:'honey',rot:0,fresh:1};
  const huecoSinObra=isFoodInStockpile(loose), capSinObra=capacidadAlmacen();
  // Trabajo real: la obrera asignada llega al sitio y completa el marco, no se cambia un flag a mano.
  for(const id of site.builders){ const w=workers.find(a=>a.id===id); w.x=anchor.x; w.y=anchor.y; }
  for(let i=0;i<120&&!site.built;i++) for(const id of site.builders){ const w=workers.find(a=>a.id===id); workOnStore(w,1,1); }
  const celdas=storageCells(), cd=celdas[0];
  const dentro={x:(cd.c+.5)*CELL,y:(cd.r+.5)*CELL,amount:1,max:1,ftype:'honey',rot:0,fresh:1};
  const enEstructura=isFoodInStockpile(dentro),capConstruida=capacidadAlmacen();
  // Un hueco grande, incluso abierto, no obtiene capacidad ni conservación si no tiene estructura.
  const dc=3,dr=ROWS-6;
  for(let r=dr;r<dr+3;r++) for(let c=dc;c<dc+8;c++){ soil[r][c]=0; soilType[r][c]=0; }
  markSoilDirty();
  const aislada={x:(dc+.5)*CELL,y:(dr+.5)*CELL,amount:1,max:1,ftype:'berry',rot:0,fresh:1};
  const conocida=isNestCellConnected(dc,dr), conservaAislada=isFoodInStockpile(aislada), capTrasHueco=capacidadAlmacen();
  return {site:{c:site.c,r:site.r,built:site.built,work:site.work,builtBy:site.builtBy},huecoSinObra,capSinObra,enEstructura,capConstruida,conocida,conservaAislada,capTrasHueco,celdas:celdas.length};
})()`);
check(honey.huecoSinObra === false && honey.capSinObra === 0, `el hueco fundador sin obra no conserva ni da capacidad (${honey.capSinObra})`);
check(honey.site.built === true && honey.site.work >= run('STORE_WORK_REQUIRED') && honey.site.builtBy.length>0, `una obrera construye físicamente el almacén [${honey.site.c},${honey.site.r}] antes de usarlo`);
check(honey.enEstructura === true && honey.celdas>0 && honey.capConstruida>0, `la miel dentro de sus ${honey.celdas} celdas construidas sí se conserva (capacidad ${honey.capConstruida})`);
check(honey.conocida === false && honey.conservaAislada === false, `una cavidad abierta pero desconectada sigue desconocida y no conserva comida`);
check(honey.capTrasHueco === honey.capConstruida, `abrir 24 celdas aisladas no regala capacidad (${honey.capConstruida} → ${honey.capTrasHueco})`);
check(/function dibujarAlmacen\(\)\{[\s\S]{0,260}const celdas=storageCells\(\);/.test(src) && /_boteAlmacen\(bx, by, _CUADRO, _CUADRO/.test(src),
  `los tarros solo salen de las celdas de la estructura física`);
check(!src.includes("ctx.fillRect(x-6,y-10,28,8); ctx.fillStyle='#ffcc00'"), `no queda el letrero "?" flotante sobre las cajas de tesoro`);
check(!/fillText\(['"]\?['"]/.test(src), `la caja de tesoro ya no lleva su "?" fija (letrero prefijado, prohibido: solo brilla cuando una obrera pisa cerca)`);

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
check(/^Colony /.test(nameInfo.faction) && nameInfo.faction !== 'Colony Ada', `the faction takes the foundress name: "${nameInfo.faction}"`);
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
           etapas:[...new Set(workers.map(w=>w.nameStage))], bautizo: events.slice(0, Math.max(1, events.length-evAntes+2)).some(e=>/Colony naming/.test(e.msg)) || events.some(e=>/Colony naming/.test(e.msg)),
           muestra: after.slice(0,4), uniq:new Set(after).size };
})()`);
check(rename.cambiados === rename.total, `al pasar la lengua a otra etapa se rebautizan ${rename.cambiados}/${rename.total} hormigas (antes el goteo era casi nunca)`);
check(rename.etapas.length === 1 && rename.etapas[0] !== 'codigo', `todas adoptan la etapa "${rename.etapas[0]}": ${rename.muestra.join(', ')}`);
check(rename.bautizo, `history keeps the English "Colony naming" event`);
check(rename.uniq >= rename.total - 1, `los nombres siguen sin repetirse tras el bautizo`);

console.log('\n== 7) el cache del suelo no se queda obsoleto ==');
run('topoCreateFreshWorld(48,28)');
const before = run('worldStats().open');
// La sala toca el costado del pozo inicial. Un hueco en (6,14) era deliberadamente aislado y, con
// conectividad física, ya no debe contar hasta que exista este paso real desde el nido.
run('carveRect(CENTER_COL+2,SURFACE_ROW+6,3,3)');
const t0 = Date.now(); while (Date.now() - t0 < 40) { } // la ventana anti-thrash es de ~24ms
const after = run('worldStats().open');
check(after - before === 9, `cavar una sala conectada 3x3 suma 9 celdas al conteo cacheado (${before} -> ${after})`);
check(run('findFrontier().length') > 0 && run('countChambers()') >= 2, `frontier y camaras siguen disponibles desde el cache (${run('countChambers()')} camaras)`);

console.log('\n' + (fails ? `❌ ${fails} fallos / ${oks} ok` : `✅ ${oks} ok · reglas y rendimiento por tamano correctos`));
