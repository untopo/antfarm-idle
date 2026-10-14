/**
 * create-farm-flow.js - prueba funcional del flujo "CREAR NUEVA GRANJA".
 *
 * Carga el app.js real en un DOM de juguete que SI despacha eventos y mueve el reloj, con
 * window.confirm/alert/prompt convertidos en explosion. El bug original: el navegador ignora el
 * confirm nativo dentro de un iframe sandbox (y en varios moviles) y devuelve false -> el click en
 * el tamano no hacia nada. Aqui eso se comprueba de frente.
 *
 *   node test/create-farm-flow.js
 */
const fs = require('fs');
const vm = require('vm');
const appPath = __dirname + '/../ant-farm-rpg/js/app.js';
const htmlPath = __dirname + '/../ant-farm-rpg/index.html';
const code = fs.readFileSync(appPath, 'utf8');
const html = fs.readFileSync(htmlPath, 'utf8');

/* ================= 1) revision estatica: nada de dialogos nativos ================= */
let pass = 0, failn = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('ok   ' + msg); } else { failn++; console.log('FAIL ' + msg); } };

const sinComentarios = code.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const nativos = sinComentarios.match(/(^|[^.\w])(confirm|alert|prompt)\s*\(/g) || [];
ok(nativos.length === 0, 'app.js no usa confirm/alert/prompt del navegador (' + nativos.length + ' usos)');
ok(/function gameConfirm/.test(code) && /function gameDialog/.test(code), 'el juego tiene dialogo propio (gameDialog/gameConfirm/gameAlert)');
const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)];
ok(inline.length <= 1, 'index.html conserva como maximo 1 bloque <script> propio: el vigia de arranque (' + inline.length + ')');
ok(!/bootstrap\.js/.test(html), 'index.html ya no carga js/bootstrap.js (flujo duplicado fuera del juego)');
const vers = new Set([...html.matchAll(/\?v=([\w-]+)/g)].map(m => m[1]));
ok(vers.size === 1, 'un solo numero de version para todo el HTML (' + [...vers].join(',') + ')');
ok(!/id="createSizeScreen"[^>]*onclick|onclick="[^"]*createSizeScreen/.test(html), 'ningun onclick inline en la pantalla de tamanos');

/* ================= 2) DOM de juguete con eventos y reloj ================= */
function fakeStyle() { const t = {}; return new Proxy(t, { get: (o, p) => p === 'setProperty' ? (k, v) => { o[k] = String(v); } : p === 'getPropertyValue' ? k => o[k] || '' : (typeof p === 'symbol' ? undefined : (o[p] === undefined ? '' : o[p])), set: (o, p, v) => { o[p] = v; return true; } }); }
function fakeClassList() { const s = new Set(); return { add: (...c) => c.forEach(x => s.add(x)), remove: (...c) => c.forEach(x => s.delete(x)), toggle: (c, f) => { const want = f === undefined ? !s.has(c) : !!f; want ? s.add(c) : s.delete(c); return want; }, contains: c => s.has(c) }; }
function ctx2D(canvas) {
  const t = { canvas, fillStyle: '', font: '', globalAlpha: 1, lineWidth: 1 };
  return new Proxy(t, { get: (o, p) => { if (p in o) return o[p]; if (typeof p === 'symbol') return undefined; if (p === 'measureText') return () => ({ width: 10 }); if (p === 'createLinearGradient' || p === 'createRadialGradient' || p === 'createPattern') return () => ({ addColorStop() { } }); if (p === 'getImageData' || p === 'createImageData') return (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(4, (w | 0) * (h | 0) * 4)), width: w, height: h }); return () => undefined; }, set: (o, p, v) => { o[p] = v; return true; } });
}
function makeEl(id, isCanvas) {
  const el = {
    id, style: fakeStyle(), classList: fakeClassList(), dataset: {}, children: [], parentNode: null,
    innerHTML: '', textContent: '', value: '', checked: false, disabled: false, title: '', className: '',
    width: 960, height: 576, offsetWidth: 960, offsetHeight: 576, clientWidth: 960, clientHeight: 576,
    _l: Object.create(null),
    appendChild(c) { this.children.push(c); c.parentNode = this; return c; },
    insertBefore(c) { this.children.unshift(c); c.parentNode = this; return c; },
    append() { }, prepend() { }, removeChild() { },
    remove() { if (this.parentNode) { const i = this.parentNode.children.indexOf(this); if (i >= 0) this.parentNode.children.splice(i, 1); this.parentNode = null; } },
    insertAdjacentHTML() { }, setAttribute(k, v) { this.dataset[k] = v; }, getAttribute(k) { return this.dataset[k] ?? null; },
    hasAttribute(k) { return this.dataset[k] !== undefined; }, removeAttribute(k) { delete this.dataset[k]; },
    querySelector() { return makeEl(this.id + '>q', false); }, querySelectorAll() { return []; }, getElementsByClassName() { return []; },
    addEventListener(t, f) { (this._l[t] = this._l[t] || []).push(f); },
    removeEventListener(t, f) { const a = this._l[t]; if (a) { const i = a.indexOf(f); if (i >= 0) a.splice(i, 1); } },
    dispatch(t, ev) { ev = ev || {}; ev.target = ev.target || this; ev.type = t; (this._l[t] || []).slice().forEach(f => f.call(this, ev)); if (typeof this['on' + t] === 'function') this['on' + t].call(this, ev); return ev; },
    closest(sel) { return this._match === sel ? this : null; },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 576, right: 960, bottom: 576 }),
    getClientRects: () => [], focus() { this._focused = true; }, blur() { }, scrollIntoView() { }, scrollTo() { },
    cloneNode() { return makeEl(id, isCanvas); }, contains: () => false, click() { return this.dispatch('click', {}); },
    animate: () => ({ finished: Promise.resolve(), cancel() { } }), getContext: () => el._ctx, toDataURL: () => 'data:,', _ctx: null,
  };
  if (isCanvas) el._ctx = ctx2D(el);
  return new Proxy(el, { get: (o, p) => (p in o ? o[p] : (typeof p === 'symbol' ? undefined : () => undefined)), set: (o, p, v) => { o[p] = v; return true; } });
}
const CANVAS = new Set(['farmCanvas', 'taskbarCanvas', 'nnCanvas', 'chartCanvas', 'calCanvas']);
const cache = new Map();
const getEl = id => { if (!cache.has(id)) cache.set(id, makeEl(id, CANVAS.has(id) || /canvas$/i.test(id))); return cache.get(id); };
const SEL = '#createSizeScreen [data-size]';
const sizeBtns = ['small', 'medium', 'big'].map(k => { const e = makeEl('size-' + k, false); e.dataset.size = k; e._match = SEL; return e; });
const body = makeEl('body', false);
const docL = Object.create(null);
const document = new Proxy({
  getElementById: getEl, createElement: t => makeEl('c_' + t, t === 'canvas'), createElementNS: (n, t) => makeEl('n_' + t, false),
  createTextNode: t => ({ textContent: t }), createDocumentFragment: () => makeEl('f', false),
  querySelector: sel => String(sel).includes('hud-strips') ? getEl('hud-strips') : makeEl('s', false),
  querySelectorAll: sel => String(sel).includes('[data-size]') ? sizeBtns : [],
  getElementsByClassName: () => [], body, documentElement: makeEl('html', false), head: makeEl('head', false),
  addEventListener(t, f) { (docL[t] = docL[t] || []).push(f); },
  removeEventListener(t, f) { const a = docL[t]; if (a) { const i = a.indexOf(f); if (i >= 0) a.splice(i, 1); } },
  hidden: false, visibilityState: 'visible', title: 'ant farm',
  fonts: { ready: Promise.resolve(), load: () => Promise.resolve(), check: () => true },
}, { get: (o, p) => (p in o ? o[p] : (typeof p === 'symbol' ? undefined : () => undefined)), set: (o, p, v) => { o[p] = v; return true; } });

const store = new Map();
let clock = 0, nextTid = 1, fired = { to: 0, iv: 0 };
const timers = new Map();
function mkTimer(fn, ms, repeat) { const id = nextTid++; timers.set(id, { id, fn, ms: Math.max(1, ms | 0), at: clock + Math.max(1, ms | 0), repeat }); return id; }
/* Bomba de tiempo determinista: los pasos de la barra van por setInterval y el cierre de la
   pantalla por setTimeout, asi que ejecutamos N pasadas de intervalos y luego vaciamos los
   timeouts pendientes. Sin reloj global: el juego tiene cascadas de setTimeout(f,0) y emular
   60 s de wall-clock aqui solo aportaria ruido. */
function pump(passes) {
  passes = passes || 8;
  const BUDGET = 60000; let n = 0;
  // solo los timers nacidos con el ultimo click: el juego ya tiene miles de intervalos abiertos
  const ivs = [...timers.values()].filter(t => t.repeat && t.id >= flowFrom);
  for (let i = 0; i < passes && n < BUDGET; i++) {
    for (const t of ivs) {
      if (n++ > BUDGET) break;
      if (!timers.has(t.id)) continue;
      fired.iv++;
      try { t.fn(); } catch (e) { sb.__errors.push('intervalo: ' + e.message); }
    }
  }
  for (let k = 0; k < 6 && n < BUDGET; k++) {
    const ones = [...timers.values()].filter(t => !t.repeat && t.id >= flowFrom);
    if (!ones.length) break;
    for (const t of ones) {
      if (n++ > BUDGET) break;
      timers.delete(t.id); fired.to++;
      try { t.fn(); } catch (e) { sb.__errors.push('timeout: ' + e.message); }
    }
  }
  pump.calls = n;
}
const tick = pump;
const sb = {
  console: { log() { }, warn() { }, error(...a) { sb.__errors.push(a.map(String).join(' ')); } },
  __errors: [], __nativo: 0,
  document,
  localStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k), clear: () => store.clear(), key: i => [...store.keys()][i] ?? null },
  performance: { now: () => clock },
  Date, Math, JSON, Object, Array, Number, String, Boolean, Symbol, Promise, Set, Map, WeakMap, WeakSet, isNaN, isFinite, parseInt, parseFloat, RegExp, Function, Error, TypeError, RangeError, Reflect, Proxy,
  Uint8Array, Uint8ClampedArray, Int8Array, Int16Array, Uint16Array, Float32Array, Float64Array, ArrayBuffer, DataView,
  setTimeout: (f, ms) => mkTimer(f, ms, false), setInterval: (f, ms) => mkTimer(f, ms, true),
  clearInterval: id => timers.delete(id), clearTimeout: id => timers.delete(id), queueMicrotask: f => f(),
  requestAnimationFrame: f => mkTimer(() => f(clock), 16, false), cancelAnimationFrame: id => timers.delete(id),
  fetch: () => Promise.reject(new Error('nf')), XMLHttpRequest: class { open() { } send() { } },
  URL: { createObjectURL: () => '', revokeObjectURL() { } }, Blob: class { },
  navigator: { userAgent: 'node', hardwareConcurrency: 4, maxTouchPoints: 0 },
  location: { href: 'http://localhost/ant-farm-rpg/index.html', search: '', reload() { } },
  getComputedStyle: () => ({ display: 'flex', visibility: 'visible', getPropertyValue: () => '' }),
  matchMedia: () => ({ matches: false, addEventListener() { }, addListener() { } }),
  addEventListener(t, f) { (docL['win:' + t] = docL['win:' + t] || []).push(f); }, removeEventListener() { }, dispatchEvent() { },
  Image: class { constructor() { this.width = 64; this.height = 64; } set src(v) { this._s = v; } get src() { return this._s || ''; } },
  Path2D: class { rect() { } moveTo() { } lineTo() { } arc() { } closePath() { } },
  OffscreenCanvas: class { constructor(w, h) { this.width = w; this.height = h; this._c = ctx2D(this); } getContext() { return this._c; } },
  Worker: class { constructor() { throw new Error('nw'); } }, Audio: class { play() { return Promise.resolve(); } },
  innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1,
};
sb.alert = sb.confirm = sb.prompt = function () { sb.__nativo++; throw new Error('DIALOGO NATIVO PROHIBIDO: usa gameDialog()'); };
sb.window = sb; sb.globalThis = sb; sb.self = sb; sb.top = sb; sb.parent = sb;
sb.self.addEventListener = sb.addEventListener;
const ctx = vm.createContext(sb);
try { vm.runInContext(code, ctx, { filename: 'app.js', timeout: 30000 }); }
catch (e) { console.log('FAIL app.js no cargo: ' + e.message); process.exit(1); }
ok(sb.__nativo === 0, 'cargar el motor no dispara ningun dialogo nativo');

/* ---------- utilidades del test ---------- */
let flowFrom = 1;
function beginBurst() { flowFrom = nextTid; }         // marca por donde nacen los timers de esta rafaga
function clickSize(k, keepFlow) { // orden real: listener del boton, luego el delegado de document
  if (!keepFlow) flowFrom = nextTid;   // de aqui en adelante nacen los timers de la siembra
  const btn = sizeBtns.find(b => b.dataset.size === k);
  const ev = { type: 'click', target: btn, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() { } };
  btn.dispatch('click', ev);
  (docL.click || []).slice().forEach(f => f(ev));
  return ev;
}
const hosts = () => body.children.filter(c => c.className === 'topo-dialog-host');
function findBtn(node, label) { let out = null; (function walk(n) { if (!n || out) return; if (n.textContent === label) { out = n; return; } (n.children || []).forEach(walk); })(node); return out; }
const world = () => sb.COLS + 'x' + sb.ROWS;
const gen = getEl('worldGenScreen');

/* ---------- 3) sin guardado: elegir tamano siembra ---------- */
clickSize('big');
ok(gen.style.display === 'flex', 'al pulsar el tamano aparece la pantalla de siembra (no se queda sorda)');
pump(8);
ok(world() === '96x48', 'BIG: el mundo es 96x48 tras confirmar el tamano (' + world() + ')');
ok(store.get('antfarm_worldSize') === 'big', 'el tamano elegido queda registrado en localStorage');
ok(gen.style.display === 'none', 'la pantalla de siembra se cierra sola (barra colgada = 0)');
ok(sb.__errors.length === 0, 'cero errores en la siembra' + (sb.__errors[0] ? ' | ' + sb.__errors[0] : ''));

/* ---------- 4) reentrancia: spam de clicks = una generacion ---------- */
store.delete('antFarm_fullSave_v2'); store.delete('antfarm_worldAlive');
let gens = 0;
const realCreate = sb.topoCreateFreshWorld;
sb.topoCreateFreshWorld = function (c, r) { gens++; return realCreate(c, r); };
beginBurst(); clickSize('small', 1); clickSize('small', 1); clickSize('small', 1);
pump(8);
ok(gens === 1, 'tres clicks seguidos generan UNA sola vez el mundo (guarda anti-reentrancia)');
ok(world() === '48x28', 'SMALL 48x28 sembrado (' + world() + ')');

/* ---------- 5) con granja guardada: dialogo propio, y la anterior se archiva ---------- */
const saveObj = { v: 2, day: 7, time: 4000, COLS: 48, ROWS: 28, savedAt: 1, soil: [[1, 1], [1, 1]], workers: [{ id: 1 }, { id: 2 }], queens: [{ id: 3 }] };
store.set('antFarm_fullSave_v2', JSON.stringify(saveObj));
gens = 0;
clickSize('medium');
ok(hosts().length === 1, 'con granja existente sale el dialogo propio pidiendo confirmacion');
const yes = findBtn(hosts()[0], 'SÍ');
ok(!!yes, 'el dialogo tiene boton SÍ');
yes && yes.dispatch('click', {});
pump(8);
ok(world() === '64x36', 'al confirmar se siembra MEDIUM 64x36 (' + world() + ')');
ok(gens === 1, 'la confirmacion genera exactamente un mundo');
const farms = JSON.parse(store.get('antfarm_farms') || '[]');
ok(Array.isArray(farms) && farms.length >= 1, 'la granja anterior paso a Archivadas (' + (farms.length) + ') en vez de destruirse');

/* ---------- 6) negarse no toca nada ---------- */
const before = world();
clickSize('small');
const no = findBtn(hosts()[0], 'NO');
ok(!!no, 'el dialogo tiene boton NO');
no && no.dispatch('click', {});
pump(8);
ok(world() === before, 'pulsar NO deja el mundo intacto (' + world() + ')');
ok(hosts().length === 0, 'el dialogo se retira del DOM al responder');

/* ---------- 7) si el motor revienta a mitad, se avisa en vez de colgar la barra ---------- */
sb.topoCreateFreshWorld = function () { throw new Error('roca dura'); };
store.delete('antFarm_fullSave_v2'); store.delete('antfarm_worldAlive');
const worldBefore = world();
clickSize('big');
pump(8);
ok(hosts().length === 1, 'un fallo sembrando muestra un aviso en pantalla');
const txt = hosts().map(h => JSON.stringify(h)).join(' ') + ' ' + hosts().map(h => (h.children || []).map(c => c.textContent + ' ' + (c.children || []).map(x => x.textContent).join(' ')).join(' ')).join(' ');
ok(/SIEMBRA|ATASC/i.test(txt), 'el aviso dice que la siembra se atasco y ofrece reintento');
ok(gen.style.display === 'none', 'tras el fallo la pantalla de carga se oculta (nunca queda colgada)');
ok(world() === worldBefore, 'el mundo anterior sigue vivo tras el fallo (' + world() + ')');
sb.topoCreateFreshWorld = realCreate;

/* ---------- 8) borrar granja: el mismo canal de confirmacion ---------- */
ok(/getElementById\('btnWipeFarm'\)[\s\S]{0,80}gameConfirm/.test(code) || /w\.onclick=\(\)=>\{ gameConfirm/.test(code), 'el boton de borrar pasa por gameConfirm (sin confirm nativo)');
ok(sb.__nativo === 0, 'en TODO el flujo de creacion nunca se llamo a confirm/alert/prompt del navegador');

console.log('');
console.log(pass + ' ok' + (failn ? ' · ' + failn + ' FALLOS' : ' · crear nueva granja blindado'));
console.log('reloj falso: ' + fired.to + ' timeouts, ' + fired.iv + ' ticks de intervalo');
process.exit(failn ? 1 : 0);
