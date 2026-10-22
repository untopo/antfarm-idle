/**
 * Harness: ejecuta el app.js REAL con un DOM mínimo y prueba el round-trip
 * crear mundo -> serializeSave -> limpiar memoria -> deserializeSave -> verificar estado.
 * No reimplementa lógica: llama las funciones del propio archivo.
 */
const fs = require('fs');
const vm = require('vm');

const code = require('./core-carga.js').conCore(fs.readFileSync('/home/user/ant-farm-rpg/js/app.js', 'utf8'));

// ---- localStorage en memoria ----
const store = new Map();
const localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: k => { store.delete(k); },
  clear: () => store.clear(),
  key: i => [...store.keys()][i] ?? null,
};

function fakeCtx2D(canvas) {
  const t = { canvas, fillStyle: '', font: '', globalAlpha: 1, lineWidth: 1 };
  return new Proxy(t, {
    get(target, p) {
      if (p in target) return target[p];
      if (typeof p === 'symbol') return undefined;
      if (p === 'measureText') return () => ({ width: 10 });
      if (p === 'createLinearGradient' || p === 'createRadialGradient' || p === 'createPattern') return () => ({ addColorStop() {} });
      if (p === 'getImageData' || p === 'createImageData') return (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(4, (w | 0) * (h | 0) * 4)), width: w, height: h });
      return () => undefined;
    },
    set(target, p, v) { target[p] = v; return true; },
  });
}

function fakeStyle() {
  const t = {};
  return new Proxy(t, {
    get(target, p) {
      if (p === 'setProperty') return (k, v) => { t[k] = String(v); };
      if (p === 'getPropertyValue') return k => (t[k] === undefined ? '' : t[k]);
      if (p === 'removeProperty') return k => { delete t[k]; };
      if (typeof p === 'symbol') return undefined;
      return t[p] === undefined ? '' : t[p];
    },
    set(target, p, v) { target[p] = v; return true; },
  });
}
function fakeClassList() {
  const s = new Set();
  return { add: (...c) => c.forEach(x => s.add(x)), remove: (...c) => c.forEach(x => s.delete(x)), toggle: () => {}, contains: c => s.has(c) };
}

function makeEl(id, isCanvas) {
  const el = {
    id, tagName: isCanvas ? 'CANVAS' : 'DIV', style: fakeStyle(), classList: fakeClassList(), dataset: {},
    children: [], _handlers: {}, innerHTML: '', textContent: '', value: '', disabled: false, title: '', checked: false,
    width: 960, height: 576, offsetWidth: 960, offsetHeight: 576, clientWidth: 960, clientHeight: 576,
    scrollTop: 0, scrollHeight: 576, offsetTop: 0, offsetLeft: 0, parentNode: null, firstChild: null, closestEl: null,
    appendChild(c) { this.children.push(c); if (c) c.parentNode = this; return c; },
    insertBefore(c) { this.children.unshift(c); return c; },
    append(...c) { this.children.push(...c); }, prepend() {}, removeChild() {}, remove() {},
    insertAdjacentHTML() {}, setAttribute(k, v) { this.dataset[k] = v; }, getAttribute(k) { return this.dataset[k] ?? null; },
    hasAttribute: () => false, removeAttribute() {},
    querySelector: sel => makeEl('sel:' + sel, false), querySelectorAll: () => [], getElementsByClassName: () => [],
    addEventListener(t, f) { (this._handlers[t] ||= []).push(f); }, removeEventListener() {}, dispatchEvent() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 576, right: 960, bottom: 576 }),
    getClientRects: () => [], focus() {}, blur() {}, click() {}, scrollIntoView() {}, scrollTo() {},
    cloneNode() { return makeEl(id + '_c', isCanvas); }, contains: () => false,
    animate: () => ({ finished: Promise.resolve(), cancel() {}, onfinish: null }),
    getContext: () => el._ctx, toDataURL: () => 'data:,',
  };
  if (isCanvas) el._ctx = fakeCtx2D(el);
  return new Proxy(el, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (typeof prop === 'symbol') return undefined;
      return () => undefined;
    },
    set(target, prop, v) { target[prop] = v; return true; },
  });
}

const CANVAS_IDS = new Set(['farmCanvas', 'taskbarCanvas', 'nnCanvas', 'chartCanvas', 'calCanvas', 'miniCanvas', 'topoCanvas', 'soilCanvas']);
const elCache = new Map();
function getEl(id) {
  if (!elCache.has(id)) elCache.set(id, makeEl(id, CANVAS_IDS.has(id) || String(id).toLowerCase().includes('canvas')));
  return elCache.get(id);
}

const document = new Proxy({
  getElementById: getEl,
  createElement: tag => makeEl('created_' + tag, tag === 'canvas'),
  createElementNS: (ns, tag) => makeEl('ns_' + tag, tag === 'canvas'),
  createTextNode: t => ({ textContent: t }),
  createDocumentFragment: () => makeEl('frag', false),
  querySelector: sel => makeEl('sel:' + sel, false),
  querySelectorAll: () => [],
  getElementsByClassName: () => [],
  addEventListener() {}, removeEventListener() {},
  body: makeEl('body', false), documentElement: makeEl('html', false), head: makeEl('head', false),
  hidden: false, visibilityState: 'visible', title: 'ANT FARM',
  fonts: { ready: Promise.resolve(), load: () => Promise.resolve(), check: () => true },
}, { get: (t, p) => (p in t ? t[p] : (typeof p === 'symbol' ? undefined : () => undefined)) });

const sandbox = {
  console, document, localStorage, performance: { now: () => Date.now() },
  Date, Math, JSON, Object, Array, Number, String, Boolean, Symbol, Promise, Set, Map, WeakMap, WeakSet, isNaN, isFinite, parseInt, parseFloat,
  Uint8Array, Uint8ClampedArray, Int8Array, Float32Array, Float64Array, ArrayBuffer, Error, TypeError, RangeError,
  setTimeout: () => 0, setInterval: () => 0, clearInterval: () => {}, clearTimeout: () => {}, queueMicrotask: f => f(),
  requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
  fetch: () => Promise.reject(new Error('no fetch')), XMLHttpRequest: class { open() {} send() {} setRequestHeader() {} },
  URL: { createObjectURL: () => '', revokeObjectURL() {} },
  Blob: class { constructor() {} },
  navigator: { userAgent: 'node', hardwareConcurrency: 4, maxTouchPoints: 0, clipboard: { writeText: () => Promise.resolve() } },
  location: { href: 'http://x/', reload: () => { sandbox.__reloaded = true; }, search: '', hash: '', origin: 'http://x' },
  alert: () => {}, confirm: () => true,
  Image: class { constructor() { this.width = 64; this.height = 64; } set src(v) { this._s = v; } get src() { return this._s; } },
  Path2D: class { rect() {} moveTo() {} lineTo() {} arc() {} closePath() {} },
  OffscreenCanvas: class { constructor(w, h) { this.width = w; this.height = h; this._c = fakeCtx2D(this); } getContext() { return this._c; } },
  Worker: class { constructor() { throw new Error('no worker'); } },
  Audio: class { play() { return Promise.resolve(); } },
  __reloaded: false,
};
sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox;
sandbox.addEventListener = () => {}; sandbox.removeEventListener = () => {};
sandbox.innerWidth = 1280; sandbox.innerHeight = 720; sandbox.devicePixelRatio = 1;
sandbox.matchMedia = () => ({ matches: false, addEventListener() {}, addListener() {} });

const ctxvm = vm.createContext(sandbox);
let loadErr = null;
try { vm.runInContext(code, ctxvm, { filename: 'app.js', timeout: 30000 }); }
catch (e) { loadErr = e; }

const out = [];
const fail = m => { out.push('FAIL ' + m); process.exitCode = 1; };
const ok = m => out.push('ok   ' + m);
const run = src => vm.runInContext(src, ctxvm);

if (loadErr) fail('app.js lanzó al cargar: ' + loadErr.message + '\n     ' + (loadErr.stack || '').split('\n')[1].trim());
else ok('app.js cargado completo en el DOM falso, sin errores');

const w = sandbox;
const getVars = () => run('({soil,soilType,geologyHost,water,waterVisual,floodBarriers:[...floodBarriers],fertility,plants,hiddenRewards,foods,workers,queens,queen,brood,structures,worldSeed,ancientSites,ancientMasonry,COLS,ROWS,W,H,SURFACE_ROW,SURFACE_Y,day,time,digs,colonyFood,worldMaterials,reliquias,gen,_hasWorld:_topoHasWorld})');

try {
  w.topoCreateFreshWorld(48,28,{worldName:'Roundtrip Nest',sizeKey:'small'});
  let v = getVars();
  const esperado = run('sizeProfile().founderWorkers');
  if (v.workers.length !== esperado) fail(`mundo fresco: esperadas ${esperado} obreras (perfil 48x28), hay ` + v.workers.length); else ok(`mundo fresco 48x28 · ${esperado} obreras (lo que manda el tamano) · reina ` + (v.queen ? v.queen.name : 'null'));

  run("for(let i=0;i<7;i++){ soil[8][10+i]=0; soilType[8][10+i]=1; } [10,11,12,13,14,15,16,17,18,19].forEach((t,i)=>soilType[20][2+i]=t); water[8][10]=1.75; floodBarriers.add('12,8'); ancientSites=[{id:'test-site',c:7,r:25,depth:17,w:8,h:5,style:0,kind:'old_gallery',biome:'stone_fault',damage:0.4,muralSeed:123}]; ancientMasonry=[{c:7,r:20,siteId:'test-site',style:0,joint:'resin'}]; rebuildAncientIndexes(); digs=42; colonyFood=9; gen=2;");
  v = getVars();
  const carved = v.soil[8].filter(x => x === 0).length;
  const seedBefore = v.worldSeed;

  const saved = w.serializeSave(true);
  if (!saved) fail('serializeSave devolvió false'); else ok('serializeSave OK');
  const raw = store.get('antFarm_fullSave_v2');
  if (!raw) fail('no existe antFarm_fullSave_v2 en localStorage');
  else {
    ok('save persistido: ' + raw.length + ' bytes');
    const d = JSON.parse(raw);
    for(const f of ['soil','soilType','workers','day','savedAt','COLS','ROWS','depthLimit','worldCoreFound','worldName','digs','colonyFood','gen','foods','water','floodBarriers','hiddenRewards','worldSeed','ancientSites','ancientMasonry'])if(d[f]===undefined)fail('save sin campo '+f);
    if(d.worldName!=='Roundtrip Nest')fail('save perdió el nombre: '+d.worldName);else ok('save conserva el nombre opcional del mundo');
    if (d.COLS !== 48 || d.ROWS !== 28) fail('save con tamaño incorrecto ' + d.COLS + 'x' + d.ROWS); else ok('save guarda tamaño 48x28 · día ' + d.day + ' · digs ' + d.digs);
    if (typeof d.soil[0] !== 'string') fail('soil no codificado como string compacto');
    if (store.get('antfarm_worldAlive') !== '1') fail('no se marcó antfarm_worldAlive');
  }

  run('soil=[]; soilType=[]; water=[]; floodBarriers.clear(); fertility=[]; plants=[]; hiddenRewards=[]; foods=[]; workers=[]; queens=[]; queen=null; brood=[]; structures=[]; digs=0; colonyFood=0; gen=0; day=1; _topoHasWorld=false;');
  v = getVars();
  if (v.soil.length !== 0) fail('no se pudo limpiar la memoria'); else ok('memoria limpiada (estado post-recarga en menú)');

  const before = store.get('antFarm_fullSave_v2');
  if (w.serializeSave() !== false) fail('serializeSave guardó sin mundo activo (debería negarse)'); else ok('serializeSave se niega a pisar el save sin mundo');
  if (store.get('antFarm_fullSave_v2') !== before) fail('el save cambió mientras no había mundo');

  if (typeof w.topoHasSave === 'function' && !w.topoHasSave()) fail('topoHasSave no detecta el guardado existente');
  else if (typeof w.topoHasSave === 'function') ok('topoHasSave detecta: día ' + w.topoHasSave().day + ' · ' + w.topoHasSave().pop + ' hormigas · ' + w.topoHasSave().cols + 'x' + w.topoHasSave().rows);

  const loaded = w.deserializeSave();
  if(!loaded)fail('deserializeSave devolvió false');else ok('deserializeSave OK');
  if(w.getWorldName()!=='Roundtrip Nest')fail('deserializeSave perdió el nombre: '+w.getWorldName());else ok('deserializeSave restaura el nombre del mundo');
  v=getVars();
  if (v.COLS !== 48 || v.ROWS !== 28) fail('dimensiones tras cargar: ' + v.COLS + 'x' + v.ROWS);
  if (v.W !== 48 * 16 || v.H !== 28 * 16) fail('W/H no recalculados: ' + v.W + 'x' + v.H); else ok('lienzo redimensionado a ' + v.W + 'x' + v.H);
  if (v.soil.length !== 28 || v.soil[0].length !== 48) fail('soil restaurado con forma ' + v.soil.length + 'x' + (v.soil[0] ? v.soil[0].length : '?'));
  if (v.soil[8].filter(x => x === 0).length !== carved) fail('túneles perdidos: ' + v.soil[8].filter(x => x === 0).length + ' vs ' + carved); else ok('túneles restaurados (' + carved + ' celdas abiertas en la fila 8)');
  const deepTypes=v.soilType[20].slice(2,12);
  if (deepTypes.slice(0,7).join(',') !== '10,11,12,13,14,15,16' || deepTypes[8]!==18 || deepTypes[9]!==19)
    fail('soilType profundo truncado al guardar: '+deepTypes.join(','));
  else ok('codificación base 20 conserva materiales 10–16, sal 18 y WORLD CORE 19');
  if(deepTypes[7]===17||v.soil[20][9]!==1)fail('la losa heredada tipo 17 sobrevivió a la migración: '+deepTypes.join(','));
  else ok('la losa heredada tipo 17 migra a geología sólida sin truncar sus vecinas');
  if (v.worldSeed !== seedBefore) fail('semilla mundial cambió al recargar: '+seedBefore+' → '+v.worldSeed); else ok('semilla mundial restaurada sin rerrollear geología');
  if (v.ancientSites.length !== 1 || v.ancientSites[0].id !== 'test-site' || v.ancientMasonry.length !== 1) fail('vestigios antiguos no restaurados'); else ok('sitios y mampostería antigua restaurados');
  const evidenceIndex=run('({art:_ancientArtCells.size,stone:_ancientMasonryCells.has("7,20"),generated:_generatedSiteIds.has("test-site")})');
  if (!evidenceIndex.art || !evidenceIndex.stone || !evidenceIndex.generated) fail('índices visuales de vestigios no reconstruidos'); else ok('murales, fragmentos e IDs antiguos reindexados al cargar');
  if (v.geologyHost.length !== 28 || v.geologyHost[20].length !== 48) fail('roca anfitriona no reconstruida desde la semilla'); else ok('roca anfitriona reconstruida para inclusiones minerales');
  if (Math.abs(v.waterVisual[8][10]-1)>1e-9) fail('capa visual de agua no reconstruida: '+v.waterVisual[8][10]); else ok('agua visual reconstruida desde la presión física');
  if (v.workers.length !== run('sizeProfile().founderWorkers')) fail('obreras tras cargar: ' + v.workers.length); else ok(v.workers.length + ' obreras restauradas (el perfil del mapa)');
  if (!v.queen) fail('queen sigue null tras cargar (crash clásico de renderLoop)'); else ok('reina restaurada: ' + (v.queen.name || v.queen.id));
  if (v.digs !== 42) fail('digs no restaurado: ' + v.digs);
  if (v.colonyFood !== 9) fail('colonyFood no restaurado: ' + v.colonyFood);
  if (v.gen !== 2) fail('gen no restaurado: ' + v.gen);
  if (Math.abs((v.water[8] ? v.water[8][10] : 0) - 1.75) > 0.08) fail('presión de agua no restaurada: ' + (v.water[8] && v.water[8][10])); else ok('presión de agua restaurada sin clamp (' + v.water[8][10].toFixed(2) + ')');
  if (!v.floodBarriers.includes('12,8')) fail('cubierta antiinundación no restaurada'); else ok('cubierta antiinundación restaurada y transitable');
  if (v.foods.length === 0) fail('foods (miel) no se guardó'); else ok('comida del pasto restaurada: ' + v.foods.length);
  if (v.hiddenRewards.length === 0) fail('tesoros ocultos no restaurados'); else ok('tesoros restaurados: ' + v.hiddenRewards.length);
  if (v._hasWorld !== true) fail('_topoHasWorld sigue false tras cargar (el juego no arranca)'); else ok('_topoHasWorld=true tras cargar');

  const rl = run("(function(){ try{ renderLoop(); return 'clean'; }catch(e){ return 'THREW '+e.message; } })()");
  if (rl !== 'clean') fail('renderLoop tras cargar: ' + rl); else ok('renderLoop() corre limpio tras cargar');

  const tk = run("(function(){ try{ loop(performance.now()); return 'clean'; }catch(e){ return 'THREW '+e.message; } })()");
  if (tk !== 'clean') fail('loop() tras cargar: ' + tk); else ok('loop() corre limpio tras cargar');

  // Compatibilidad real: una partida anterior puede traer comida cero, materiales y nombres de
  // reliquia en español. El libro nuevo debe cargarlos sin convertir 0 en el saldo que hubiera antes.
  const legacy = JSON.parse(store.get('antFarm_fullSave_v2'));
  delete legacy.worldSeed;delete legacy.ancientSites;delete legacy.ancientMasonry;delete legacy.worldName;
  legacy.colonyFood = 0;
  legacy.worldMaterials = {stone:7, clay:2, fiber:1};
  legacy.reliquias = [{tipo:'Fósil de hormiga león',piso:3,dia:2,gen:1,lore:'legado',bonus:0.02}];
  store.set('antFarm_fullSave_v2', JSON.stringify(legacy));
  run("colonyFood=99; worldMaterials={stone:99,wood:8}; reliquias=[];");
  if(!w.deserializeSave())fail('la partida española anterior no carga');
  else{
    const old=getVars();
    if(w.getWorldName()!=='SMALL BURROW')fail('guardado sin nombre no migró al default: '+w.getWorldName());else ok('guardado anterior sin nombre migra a SMALL BURROW');
    if (old.colonyFood !== 0) fail('el saldo 0 del guardado se sustituyó por el saldo en memoria: '+old.colonyFood);
    else ok('el libro restaura también una despensa a cero');
    if (old.worldMaterials.stone !== 7 || old.worldMaterials.clay !== 2 || old.worldMaterials.wood !== 0) fail('materiales anteriores mal restaurados');
    else ok('materiales anteriores restaurados por el libro (7 piedra, 2 arcilla)');
    if (!old.reliquias[0] || old.reliquias[0].tipo !== 'Antlion Fossil') fail('LEGADO_RELIQUIA no tradujo el nombre español');
    else ok('guardado español traduce «Fósil de hormiga león» → «Antlion Fossil»');
    if (!Number.isInteger(old.worldSeed) || old.ancientSites.length || old.ancientMasonry.length) fail('migración sin campos de mundo dejó estado inválido');
    else ok('guardado anterior sin semilla ni vestigios migra a un mundo válido');
  }

  // guardado BIG para comprobar cuota
  w.topoCreateFreshWorld(96, 48);
  run('for(let r=10;r<40;r++) for(let c=5;c<90;c++) soil[r][c]=0;');
  const big = w.serializeSave(true);
  const bigRaw = store.get('antFarm_fullSave_v2');
  if (!big || !bigRaw) fail('no se pudo guardar el mundo BIG'); else ok('BIG 96x48 guardado en ' + Math.round(bigRaw.length / 1024) + ' KB (límite ~5120 KB)');
  const bl = w.deserializeSave();
  let v2 = getVars();
  if (!bl || v2.COLS !== 96 || v2.soil[20][50] !== 0) fail('BIG no round-trippea: loaded=' + bl + ' celda(50,20)=' + (v2.soil[20] && v2.soil[20][50])); else ok('BIG 96x48 round-trip OK · ' + v2.soil.flat().filter(x => x === 0).length + ' celdas abiertas recuperadas');
} catch (e) {
  fail('excepción en el round-trip: ' + e.message + '\n     ' + (e.stack || '').split('\n').slice(1, 3).join('\n     '));
}

console.log(out.join('\n'));
console.log('\n' + (process.exitCode ? '❌ HAY FALLOS' : '✅ TODO OK'));

// 7) tesoros: densidad constante por area (10-13 en 64x36 de referencia) y tipo valido
try {
  let prevN = 0;
  for (const [c0, r0] of [[48, 28], [64, 36], [96, 48]]) {
    w.topoCreateFreshWorld(c0, r0);
    const info = run("({n:hiddenRewards.length, cells:COLS*ROWS, bad:hiddenRewards.filter(t=>!t.type || typeof t.type!=='string').length})");
    const dens = (info.n / info.cells) * 1000;
    if (info.bad) { console.log(`FAIL tesoros ${c0}x${r0}: ${info.bad} sin premio asignado`); process.exitCode = 1; }
    else if (info.n < 4 || dens < 2.6 || dens > 7.5) { console.log(`FAIL tesoros ${c0}x${r0}: ${info.n} (densidad ${dens.toFixed(2)} por 1000 celdas: debe seguir el tamano)`); process.exitCode = 1; }
    else if (info.n < prevN) { console.log(`FAIL tesoros ${c0}x${r0}: ${info.n} < ${prevN} del mundo anterior (no escala con el area)`); process.exitCode = 1; }
    else console.log(`ok   tesoros ${c0}x${r0}: ${info.n} - densidad ${dens.toFixed(2)}/1000 celdas - premios validos`);
    prevN = info.n;
  }
  // 8) rebuild del cache de suelo (antes: ReferenceError isMini -> nunca se cacheaba)
  const rb = run("(function(){ try{ soilCacheDirty=true; rebuildSoilCache(); return 'clean'; }catch(e){ return 'THREW '+e.message; } })()");
  if (rb !== 'clean') { console.log('FAIL rebuildSoilCache: ' + rb); process.exitCode = 1; }
  else console.log('ok   rebuildSoilCache() corre limpio (texturas del suelo cacheadas)');
  // 9) cargar partida BIG y volver a guardar: doble round-trip sin degradación
  w.serializeSave(true);
  run("soil=[]; workers=[]; queens=[]; queen=null; _topoHasWorld=false; hiddenRewards=[]; foods=[];");
  if (!w.deserializeSave()) { console.log('FAIL segunda carga (BIG) no arrancó'); process.exitCode = 1; }
  else {
    const v = run("({w:workers.length, q:!!queen, t:soil.length, cols:COLS, tr:hiddenRewards.length, sp:sizeProfile().founderWorkers, cap:sizeProfile().maxQueens})");
    const good = v.w === v.sp && v.q && v.t === 48 && v.cols === 96 && v.tr >= 10;
    console.log((good ? 'ok   ' : 'FAIL ') + `re-carga BIG 96x48: ${v.w} obreras (perfil ${v.sp}) · reina ${v.q ? 'sí' : 'NO'} · ${v.t} filas · ${v.tr} tesoros`);
    if (!good) process.exitCode = 1;
  }
} catch (e) { console.log('FAIL test extra: ' + e.message); process.exitCode = 1; }

console.log('\n' + (process.exitCode ? '❌ HAY FALLOS' : '✅ TODO OK'));
