/** Cronómetro de creación de mundo por tamaño, ejecutando el app.js real. */
const fs = require('fs');
const vm = require('vm');
const code = require('./core-carga.js').conCore(fs.readFileSync(process.env.APP_JS || '/home/user/ant-farm-rpg/js/app.js', 'utf8'));

function fakeCtx2D(canvas) {
  const t = { canvas, fillStyle: '', font: '', globalAlpha: 1, lineWidth: 1 };
  return new Proxy(t, { get: (target, p) => { if (p in target) return target[p]; if (typeof p === 'symbol') return undefined; if (p === 'measureText') return () => ({ width: 10 }); if (p === 'createLinearGradient' || p === 'createRadialGradient' || p === 'createPattern') return () => ({ addColorStop() { } }); if (p === 'getImageData' || p === 'createImageData') return (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(4, (w | 0) * (h | 0) * 4)), width: w, height: h }); return () => undefined; }, set: (t2, p, v) => { t2[p] = v; return true; } });
}
function fakeStyle() { const t = {}; return new Proxy(t, { get: (target, p) => p === 'setProperty' ? (k, v) => { t[k] = String(v); } : p === 'getPropertyValue' ? k => t[k] || '' : p === 'removeProperty' ? k => { delete t[k]; } : (typeof p === 'symbol' ? undefined : (t[p] === undefined ? '' : t[p])), set: (target, p, v) => { target[p] = v; return true; } }); }
function fakeClassList() { const s = new Set(); return { add: (...c) => c.forEach(x => s.add(x)), remove: (...c) => c.forEach(x => s.delete(x)), toggle: () => { }, contains: c => s.has(c) }; }
function makeEl(id, isCanvas) {
  const el = {
    id, style: fakeStyle(), classList: fakeClassList(), dataset: {}, children: [], innerHTML: '', textContent: '',
    width: 960, height: 576, offsetWidth: 960, offsetHeight: 576, clientWidth: 960, clientHeight: 576,
    // El DOM de juguete no guarda el árbol: el juego reconstruye listas cada frame (filas de
    // cria, perfil, taskbar) y sin tope aqui el lote se comia ~800 KB por frame y reventaba la
    // memoria del contenedor antes de terminar.
    appendChild(c) { if (this.children.length < 48) this.children.push(c); return c; }, insertBefore(c) { if (this.children.length < 48) this.children.unshift(c); return c; }, append(...c) { }, prepend() { }, removeChild() { }, remove() { }, insertAdjacentHTML() { },
    setAttribute(k, v) { this.dataset[k] = v; }, getAttribute(k) { return this.dataset[k] ?? null; }, hasAttribute: () => false, removeAttribute() { },
    querySelector: () => makeEl('s', false), querySelectorAll: () => [], getElementsByClassName: () => [],
    addEventListener() { }, removeEventListener() { }, dispatchEvent() { }, getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 576, right: 960, bottom: 576 }),
    getClientRects: () => [], focus() { }, blur() { }, click() { }, scrollIntoView() { }, scrollTo() { }, cloneNode() { return makeEl(id, isCanvas); }, contains: () => false,
    animate: () => ({ finished: Promise.resolve(), cancel() { } }), getContext: () => el._ctx, toDataURL: () => 'data:,', _ctx: null, disabled: false, value: '', checked: false, title: '',
  };
  if (isCanvas) el._ctx = fakeCtx2D(el);
  return new Proxy(el, { get: (t, p) => (p in t ? t[p] : (typeof p === 'symbol' ? undefined : () => undefined)), set: (t, p, v) => { t[p] = v; return true; } });
}
const CANVAS = new Set(['farmCanvas', 'taskbarCanvas', 'nnCanvas', 'chartCanvas', 'calCanvas']);
const store = new Map();
const localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k), clear: () => store.clear(), key: i => [...store.keys()][i] ?? null };
const cache = new Map();
const getEl = id => { if (!cache.has(id)) cache.set(id, makeEl(id, CANVAS.has(id) || String(id).toLowerCase().includes('canvas'))); return cache.get(id); };
const document = new Proxy({
  getElementById: getEl, createElement: t => makeEl('c_' + t, t === 'canvas'), createElementNS: (n, t) => makeEl('n_' + t, false),
  createTextNode: t => ({ textContent: t }), createDocumentFragment: () => makeEl('f', false), querySelector: () => makeEl('s', false),
  querySelectorAll: () => [], getElementsByClassName: () => [], addEventListener() { }, removeEventListener() { },
  body: makeEl('body', false), documentElement: makeEl('html', false), head: makeEl('head', false), hidden: false, visibilityState: 'visible', title: 'x',
  fonts: { ready: Promise.resolve(), load: () => Promise.resolve(), check: () => true },
}, { get: (t, p) => (p in t ? t[p] : (typeof p === 'symbol' ? undefined : () => undefined)) });

const sb = {
  console: { log() { }, warn() { }, error() { } },
  document, localStorage, performance: { now: () => Number(process.hrtime.bigint() / 1000n) / 1000 },
  Date, Math, JSON, Object, Array, Number, String, Boolean, Symbol, Promise, Set, Map, WeakMap, WeakSet, isNaN, isFinite, parseInt, parseFloat,
  Uint8Array, Uint8ClampedArray, Int8Array, Float32Array, Float64Array, ArrayBuffer, Error, TypeError, RangeError,
  setTimeout: () => 0, setInterval: () => 0, clearInterval() { }, clearTimeout() { }, queueMicrotask: f => f(),
  requestAnimationFrame: () => 0, cancelAnimationFrame() { }, fetch: () => Promise.reject(new Error('nf')),
  XMLHttpRequest: class { open() { } send() { } }, URL: { createObjectURL: () => '', revokeObjectURL() { } }, Blob: class { },
  navigator: { userAgent: 'node', hardwareConcurrency: 4 }, location: { href: 'http://x/', reload() { } }, alert() { }, confirm: () => true,
  Image: class { constructor() { this.width = 64; this.height = 64; } set src(v) { } get src() { return ''; } },
  Path2D: class { rect() { } moveTo() { } lineTo() { } arc() { } closePath() { } },
  OffscreenCanvas: class { constructor(w, h) { this.width = w; this.height = h; this._c = fakeCtx2D(this); } getContext() { return this._c; } },
  Worker: class { constructor(){ throw new Error("nw"); } }, Audio: class { play() { return Promise.resolve(); } },
};
sb.window = sb; sb.globalThis = sb; sb.self = sb; sb.addEventListener = () => { }; sb.removeEventListener = () => { };
sb.innerWidth = 1280; sb.innerHeight = 720; sb.devicePixelRatio = 1; sb.matchMedia = () => ({ matches: false, addEventListener() { }, addListener() { } });
const ctx = vm.createContext(sb);
try { vm.runInContext(code, ctx, { filename: 'app.js', timeout: 30000 }); } catch (e) { console.log('carga falló:', e.message); process.exit(1); }


module.exports = { sb, ctx, vm, getEl, store };
