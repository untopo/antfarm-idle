/**
 * Simulación de recarga real:
 *  A) se ejecuta app.js, se crea una granja y se guarda
 *  B) con el MISMO localStorage se vuelve a ejecutar app.js desde cero (como F5),
 *     se comprueba que no salta el nuevo título y que CONTINUE revive explícitamente el mundo
 *     con sus túneles, hormigas y día.
 * Reutiliza el mismo DOM falso del otro test; no reimplementa la lógica del juego.
 */
const fs = require('fs');
const vm = require('vm');
const code = require('./core-carga.js').conCore(fs.readFileSync('/home/user/ant-farm-rpg/js/app.js', 'utf8'));

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
  return { add: (...c) => c.forEach(x => s.add(x)), remove: (...c) => c.forEach(x => s.delete(x)), toggle: () => {}, contains: c => s.has(c), _set: s };
}
function makeEl(id, isCanvas) {
  const classes = fakeClassList();
  const el = {
    id, style: fakeStyle(), classList: classes, dataset: {}, children: [], innerHTML: '', textContent: '',
    width: 960, height: 576, offsetWidth: 960, offsetHeight: 576, clientWidth: 960, clientHeight: 576,
    appendChild(c) { this.children.push(c); return c; }, insertBefore(c) { this.children.unshift(c); return c; },
    append(...c) { this.children.push(...c); }, prepend() {}, removeChild() {}, remove() {}, insertAdjacentHTML() {},
    setAttribute(k, v) { this.dataset[k] = v; }, getAttribute(k) { return this.dataset[k] ?? null; },
    hasAttribute: () => false, removeAttribute() {},
    querySelector: sel => makeEl('sel', false), querySelectorAll: () => [], getElementsByClassName: () => [],
    addEventListener(t, f) { if (t === 'click') el._click = f; }, removeEventListener() {}, dispatchEvent() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 576, right: 960, bottom: 576 }),
    getClientRects: () => [], focus() {}, blur() {}, click() { if (el._click) el._click({ preventDefault() {}, stopPropagation() {}, target: el }); },
    scrollIntoView() {}, scrollTo() {}, cloneNode() { return makeEl(id, isCanvas); }, contains: () => false,
    animate: () => ({ finished: Promise.resolve(), cancel() {} }), getContext: () => el._ctx, toDataURL: () => 'data:,',
    _ctx: null, _click: null, disabled: false, value: '', checked: false, title: '',
  };
  el.classList_add = classes.add;
  if (isCanvas) el._ctx = fakeCtx2D(el);
  return new Proxy(el, {
    get(target, prop) { if (prop in target) return target[prop]; if (typeof prop === 'symbol') return undefined; return () => undefined; },
    set(target, prop, v) { target[prop] = v; return true; },
  });
}
const CANVAS = new Set(['farmCanvas', 'taskbarCanvas', 'nnCanvas', 'chartCanvas', 'calCanvas', 'miniCanvas']);

function boot(store, eager) {
  const localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: k => { store.delete(k); },
    clear: () => store.clear(), key: i => [...store.keys()][i] ?? null,
  };
  const elCache = new Map();
  const getEl = id => { if (!elCache.has(id)) elCache.set(id, makeEl(id, CANVAS.has(id) || String(id).toLowerCase().includes('canvas'))); return elCache.get(id); };
  const document = new Proxy({
    getElementById: getEl,
    createElement: tag => makeEl('c_' + tag, tag === 'canvas'),
    createElementNS: (ns, tag) => makeEl('n_' + tag, false),
    createTextNode: t => ({ textContent: t }), createDocumentFragment: () => makeEl('frag', false),
    querySelector: sel => makeEl('sel', false), querySelectorAll: () => [], getElementsByClassName: () => [],
    addEventListener() {}, removeEventListener() {},
    body: makeEl('body', false), documentElement: makeEl('html', false), head: makeEl('head', false),
    hidden: false, visibilityState: 'visible', title: 'x', fonts: { ready: Promise.resolve(), load: () => Promise.resolve(), check: () => true },
  }, { get: (t, p) => (p in t ? t[p] : (typeof p === 'symbol' ? undefined : () => undefined)) });

  let budget = eager ? 400 : 0;
  const sandbox = {
    console: eager ? { log() {}, warn() {}, error() {} } : console,
    document, localStorage, performance: { now: () => Date.now() },
    Date, Math, JSON, Object, Array, Number, String, Boolean, Symbol, Promise, Set, Map, WeakMap, WeakSet, isNaN, isFinite, parseInt, parseFloat,
    Uint8Array, Uint8ClampedArray, Int8Array, Float32Array, Float64Array, ArrayBuffer, Error, TypeError, RangeError,
    setTimeout: (f, ms) => { if (eager && budget-- > 0) { try { f(); } catch (e) { } return 0; } return 0; },
    setInterval: () => 0, clearInterval: () => {}, clearTimeout: () => {}, queueMicrotask: f => { if (eager && budget-- > 0) { try { f(); } catch (e) { } } },
    requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
    getComputedStyle: el => ({ display: (el && el.style && el.style.display) || 'block', overflow: '', overflowX: '' }),
    fetch: () => Promise.reject(new Error('nf')), XMLHttpRequest: class { open() {} send() {} },
    URL: { createObjectURL: () => '', revokeObjectURL() {} }, Blob: class { },
    navigator: { userAgent: 'node', hardwareConcurrency: 4, maxTouchPoints: 0 },
    location: { href: 'http://x/', reload() { }, search: '', hash: '', origin: 'http://x' },
    alert: () => { }, confirm: () => false,
    Image: class { constructor() { this.width = 64; this.height = 64; } set src(v) { } get src() { return ''; } },
    Path2D: class { rect() { } moveTo() { } lineTo() { } arc() { } closePath() { } },
    OffscreenCanvas: class { constructor(w, h) { this.width = w; this.height = h; this._c = fakeCtx2D(this); } getContext() { return this._c; } },
    Worker: class { constructor() { throw new Error('nw'); } }, Audio: class { play() { return Promise.resolve(); } },
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox;
  sandbox.addEventListener = () => {}; sandbox.removeEventListener = () => {};
  sandbox.innerWidth = 1280; sandbox.innerHeight = 720; sandbox.devicePixelRatio = 1;
  sandbox.matchMedia = () => ({ matches: false, addEventListener() { }, addListener() { } });
  const ctx = vm.createContext(sandbox);
  let err = null;
  try { vm.runInContext(code, ctx, { filename: 'app.js', timeout: 30000 }); } catch (e) { err = e; }
  return { sandbox, ctx, err, getEl, store };
}

let fails = 0;
const ok = m => console.log('ok   ' + m);
const bad = m => { fails++; console.log('FAIL ' + m); };

const store = new Map();

// ---------- A) primera sesión: crear granja y jugar un poco ----------
const A = boot(store, false);
if (A.err) bad('sesión A: app.js reventó al cargar -> ' + A.err.message);
else ok('sesión A: app.js carga completo (el crash de queen=null ya no ocurre)');

try {
  A.sandbox.topoCreateFreshWorld(64, 36);
  vm.runInContext('for(let i=0;i<25;i++){ soil[10][8+i]=0; soilType[10][8+i]=1; } day=7; time=DAY_LENGTH*6.4; colonyFood=31; gen=1; digs=88;', A.ctx);
  const saved = A.sandbox.serializeSave(true);
  if (!saved) bad('A: serializeSave false'); else ok('A: granja 64x36 guardada (día 7, 25 celdas excavadas, 88 digs)');
  if (store.get('antfarm_inGame') !== '1') bad('A: no marcó antfarm_inGame=1 -> al recargar no sabría que reanudar');
  else ok('A: marcado antfarm_inGame=1 (estabas jugando al cerrar)');
  const sizeBefore = vm.runInContext('({c:COLS,r:ROWS,ants:workers.length,carved:soil.flat().filter(x=>x===0).length,day})', A.ctx);
  const beforeJson = JSON.stringify(sizeBefore);

  // ---------- B) recarga: mismo localStorage, script de cero ----------
  const B = boot(store, true);
  if (B.err) bad('B: app.js reventó al recargar -> ' + B.err.message);
  else ok('B: recarga limpia, app.js completo sin errores');

  // app.js no owns the visible splash anymore: splash-topo.js performs this handoff in the
  // browser. Call the same public handoff and verify that a stored `antfarm_inGame=1` still stops
  // at the title instead of silently deserializing the farm.
  B.sandbox.topoShowMainMenu({ initial: true });
  const gate = vm.runInContext('({hasWorld:typeof _topoHasWorld!=="undefined"?_topoHasWorld:null, menu:document.getElementById("mainMenu").style.display, splash:document.getElementById("splashScreen").style.display, started:document.body.classList.contains("game-started")})', B.ctx);
  const continueEl = B.getEl('btnMainContinue');
  if (gate.hasWorld !== false || gate.menu !== 'flex' || gate.started) bad('B: la recarga se saltó el título ' + JSON.stringify(gate));
  else ok('B: F5 termina en el título aunque antfarm_inGame=1');
  if (continueEl.hidden === true) bad('B: CONTINUE quedó oculto pese al guardado válido');
  else ok('B: CONTINUE aparece primero para la granja guardada');
  const saveAtGate = store.get('antFarm_fullSave_v2');
  if (typeof continueEl.onclick !== 'function') bad('B: CONTINUE no tiene acción');
  else continueEl.onclick({ preventDefault() {}, stopPropagation() {} });

  const after = vm.runInContext('(()=>{const p=storagePressureSnapshot();return {hasWorld:typeof _topoHasWorld!=="undefined"?_topoHasWorld:null, c:COLS,r:ROWS,ants:(typeof workers!=="undefined"?workers.length:-1),carved:(typeof soil!=="undefined"?soil.flat().filter(x=>x===0).length:-1),day:(typeof day!=="undefined"?day:-1),food:colonyFood,foodTotal:p.total,overflow:p.overflow,foodCap:p.capacity,digs,gen,queen:queen?queen.name:null,splash:document.getElementById("splashScreen").style.display,menu:document.getElementById("mainMenu").style.display,started:document.body.classList.contains("game-started")};})()', B.ctx);

  if (after.hasWorld !== true) bad('B: CONTINUE no activó el mundo (_topoHasWorld=' + after.hasWorld + ')');
  else ok('B: CONTINUE detectó la partida y activó el mundo');
  if (after.c !== 64 || after.r !== 36) bad('B: tamaño restaurado ' + after.c + 'x' + after.r);
  else ok('B: tamaño del mundo 64x36 recuperado');
  if (after.carved !== sizeBefore.carved) bad('B: túneles ' + after.carved + ' vs ' + sizeBefore.carved + ' (se perdieron excavaciones)');
  else ok('B: los ' + after.carved + ' túneles excavados siguen ahí');
  if (after.ants < 5) bad('B: solo ' + after.ants + ' hormigas'); else ok('B: ' + after.ants + ' hormigas vivas');
  if (!after.queen) bad('B: reina null -> renderLoop crashearía'); else ok('B: reina ' + after.queen + ' recuperada');
  if (after.day !== 7) bad('B: día ' + after.day + ' en vez de 7'); else ok('B: día 7 recuperado sin resetear el tiempo');
  if (after.digs !== 88 || after.gen !== 1 || after.foodTotal !== 31 || after.food > after.foodCap || after.overflow !== 31-after.food) bad('B: progreso perdido o abstracto (protected=' + after.food + ' overflow=' + after.overflow + ' total=' + after.foodTotal + ' digs=' + after.digs + ' gen=' + after.gen + ')');
  else ok('B: recursos/progreso intactos · '+after.food+' protegidas + '+after.overflow+' físicas = 🍯'+after.foodTotal+' · '+after.digs+' digs · GEN'+after.gen);
  if (after.menu !== 'none' || !after.started) bad('B: CONTINUE no retiró el título ' + JSON.stringify({ menu: after.menu, started: after.started }));
  else ok('B: CONTINUE retira el título y entra a la granja');
  if (!saveAtGate) bad('B: el guardado desapareció mientras esperaba en el título');
  else ok('B: esperar en el título no destruye el guardado');
  const same = JSON.stringify({ c: sizeBefore.c, r: sizeBefore.r, ants: sizeBefore.ants }) === JSON.stringify({ c: after.c, r: after.r, ants: after.ants });
  if (!same) bad('B: estado divergente vs sesión A'); else ok('B: estado idéntico al de la sesión A');

  // C) recarga SIN querer crear nada: el autosave no debe borrar la partida
  const keep = store.get('antFarm_fullSave_v2');
  const C = boot(store, true);
  if (store.get('antFarm_fullSave_v2') !== keep) bad('C: el autosave pisó la partida durante el arranque');
  else ok('C: arranque en reposo no toca el guardado');
  if (C.err) bad('C: app.js reventó -> ' + C.err.message);
} catch (e) {
  bad('excepción: ' + e.message + '\n     ' + (e.stack || '').split('\n')[1].trim());
}


// ---------- D) granjas múltiples: crear otra no destruye la primera ----------
try {
  const D = boot(store, false);
  if (D.err) bad('D: app.js reventó -> ' + D.err.message);
  else {
    // la UI real archiva ANTES de crear (mismo orden que handleSizeChoice)
    if (!D.sandbox.topoArchiveCurrent('Granja 64x36 del día 7')) bad('D: no se archivó la granja actual antes de crear');
    else ok('D: antes de crear, la granja actual quedó archivada');
    D.sandbox.topoCreateFreshWorld(96, 48);
    vm.runInContext('for(let i=0;i<40;i++){ soil[20][10+i]=0; } day=2; digs=5;', D.ctx);
    D.sandbox.serializeSave(true);
    const list = D.sandbox.topoListFarms();
    if (!list.length || list[0].cols !== 64 || list[0].rows !== 36) bad('D: archivo inesperado ' + JSON.stringify(list.map(f => f.cols + 'x' + f.rows + ' d' + f.day)));
    else ok(`D: archivo con ${list.length} granja · ${list[0].cols}x${list[0].rows} · día ${list[0].day} · ${list[0].pop} hormigas`);

    // la BIG ahora es la activa: sigue cargable
    const bigOK = D.sandbox.deserializeSave();
    const big = vm.runInContext('({c:COLS, r:ROWS, day})', D.ctx);
    if (!bigOK || big.c !== 96) bad('D: la granja activa (BIG) no carga: ' + JSON.stringify(big));
    else ok(`D: granja activa BIG 96x48 día ${big.day} carga normal`);

    // recuperar la archivada
    if (!D.sandbox.topoRestoreFarm(list[0].id)) bad('D: topoRestoreFarm falló');
    else {
      const loaded = D.sandbox.deserializeSave();
      const st = vm.runInContext('({c:COLS, r:ROWS, tunnels:soil.flat().filter(x=>x===0).length, day, digs})', D.ctx);
      if (!loaded) bad('D: no se pudo cargar la archivada');
      else if (st.c !== 64 || st.r !== 36) bad('D: la archivada volvió con tamaño ' + st.c + 'x' + st.r);
      else if (st.day !== 7) bad('D: la archivada volvió en día ' + st.day + ' (esperado 7)');
      else ok(`D: archivada recuperada → 64x36 · día ${st.day} · ${st.tunnels} celdas abiertas · ${st.digs} digs`);
      const now = D.sandbox.topoListFarms();
      if (now.length < 2) bad('D: la BIG se perdió al cambiar de granja (archivadas=' + now.length + ')');
      else ok(`D: intercambio sin pérdidas · ${now.length} granjas en el archivo`);
      const before2 = now.length;
      D.sandbox.topoDeleteFarm(now[0].id);
      if (D.sandbox.topoListFarms().length !== before2 - 1) bad('D: borrar archivo no surte efecto');
      else ok('D: borrar un archivo de la lista funciona');
    }
  }
} catch (e) { bad('D excepción: ' + e.message); }

// ---------- E) cuota: 5 granjas BIG no rompen el guardado ----------
try {
  const E = boot(store, false);
  if (E.err) bad('E: ' + E.err.message);
  else {
    for (let i = 0; i < 7; i++) {
      E.sandbox.topoCreateFreshWorld(96, 48);
      vm.runInContext('for(let r=10;r<44;r++) for(let c=2;c<94;c++) soil[r][c]=0;', E.ctx);
      E.sandbox.serializeSave(true);
      E.sandbox.topoArchiveCurrent('BIG ' + i);
    }
    const list = E.sandbox.topoListFarms();
    const bytes = (store.get('antfarm_farms') || '').length + (store.get('antFarm_fullSave_v2') || '').length;
    if (list.length !== 5) bad('E: el tope de 5 no se respetó (' + list.length + ')');
    else ok(`E: 7 creaciones seguidas → 5 archivos · ${Math.round(bytes / 1024)} KB usados de ~5120 KB`);
    if (!E.sandbox.deserializeSave()) bad('E: la granja activa no carga tras el stress de archivos');
    else ok('E: granja activa intacta tras llenar el archivo');
  }
} catch (e) { bad('E excepción: ' + e.message); }

console.log('\n' + (fails ? `❌ ${fails} fallos` : '✅ recarga simulada: la granja persiste'));
process.exitCode = fails ? 1 : 0;
