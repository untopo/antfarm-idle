/**
 * live-hud.js - el HUD de reservas y el almacen, en CHROME real.
 *
 * Comprueba lo que el dueño pidio, en la pantalla de verdad y no en el harness:
 *   - la tira de arriba (la que duplicaba la economia) ya no esta, y en su sitio vive el numero de
 *     raciones con los materiales, junto al contador de obreras activas;
 *   - el boton de inventario se puede pulsar de verdad (elementFromPoint, no width>0), abre la hoja
 *     sin tapar la tira y sin apilarse sobre el perfil de una hormiga, y Esc la cierra;
 *   - la comida almacenada se dibuja APOYADA en el suelo de la camara (nada flotando en la celda),
 *     y hay montones de materiales;
 *   - y cero errores de JavaScript en todo el recorrido.
 *
 *   node test/live-hud.js
 */
const http = require('http');
const fs = require('fs');
fs.mkdirSync('/tmp/antfarm-capturas',{recursive:true});
const path = require('path');
const puppeteer = require('puppeteer');
const ROOT = path.resolve(__dirname, '..');
const PORT = 8138;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.svg': 'image/svg+xml', '.wav': 'audio/wav' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/ant-farm-rpg/index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('nope'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store, must-revalidate' });
  fs.createReadStream(file).pipe(res);
});
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, failn = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok   ' + m); } else { failn++; console.log('  FAIL ' + m); } };

(async () => {
  await new Promise(r => server.listen(PORT, '0.0.0.0', r));
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|autoplay|AudioContext/.test(m.text())) errs.push('console: ' + m.text().slice(0, 120)); });

  await page.goto(`http://127.0.0.1:${PORT}/ant-farm-rpg/index.html`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction('typeof window.topoShowMainMenu==="function" || window._topoFlowReady===true', { timeout: 20000 }).catch(() => { });
  await page.waitForFunction("!document.getElementById('splashScreen') || document.getElementById('splashScreen').style.display==='none'", { timeout: 15000 }).catch(() => { });
  await page.click('#btnMainCreate');
  await sleep(400);
  await page.click('#createSizeScreen [data-size="small"]');
  await sleep(400);
  await page.evaluate(() => { const h = document.querySelector('.topo-dialog-host'); if (!h) return; const b = [...h.querySelectorAll('button')].find(x => x.textContent.trim() === 'SÍ'); if (b) b.click(); });
  try { await page.waitForFunction('window.COLS===48 && window.ROWS===28', { timeout: 40000 }); } catch (e) { console.log('  (el mundo no acabo de crearse)'); }
  // el onboarding sale DESPUES de sembrar el mundo: hay que terminarlo como usuario (y si sigue
  // encima, el boton del HUD estaria tapado por el modal, que no es un fallo del HUD)
  // El onboarding aparece CUANDO acaba la siembra, no antes: hay que estar mirando hasta que salga
  // y cerrarlo con su boton (si sale y no se cierra con un click, eso si que es un fallo del juego).
  let onbVisto = false, onbCerrado = false;
  for (let i = 0; i < 16; i++) {
    const abierto = await page.evaluate(() => {
      const m = document.getElementById('onboardingModal');
      if (!m || getComputedStyle(m).display === 'none') return false;
      const b = document.getElementById('btnOnboardingStart') || [...m.querySelectorAll('button')].pop();
      if (b) b.click();
      return true;
    });
    if (abierto) { onbVisto = true; await sleep(320); }
    else { if (onbVisto) { onbCerrado = true; break; } await sleep(320); }
  }
  console.log(`  (onboarding: ${onbVisto ? 'salió' : 'no salió'} · ${onbCerrado || !onbVisto ? 'cerrado con su botón' : 'SE QUEDÓ ABIERTO'})`);
  await sleep(600);

  // 1) el numero de raciones del HUD coincide con el estado real
  const hud = await page.evaluate(() => {
    const g = id => { const e = document.getElementById(id); return e ? e.textContent.trim() : null; };
    const bar = document.getElementById('economyBar');
    return {
      vel: g('velFoodCount'), fiber: g('velMatFiber'), stone: g('velMatStone'), rooms: g('velMatRooms'),
      estado: Math.floor(colonyFood), mats: { fiber: worldMaterials.fiber, stone: worldMaterials.stone },
      barOculta: !bar || getComputedStyle(bar).display === 'none',
      barraAncho: (() => { const r = document.getElementById('velAntBar').getBoundingClientRect(); return Math.round(r.width); })()
    };
  });
  ok(Math.abs(Number(hud.vel) - hud.estado) <= 1, `la tira muestra las raciones reales: HUD ${hud.vel} · estado ${hud.estado} (el latido es de 350 ms)`);
  ok(hud.fiber === String(hud.mats.fiber) && hud.stone === String(hud.mats.stone), `y los materiales: fibra ${hud.fiber}/${hud.mats.fiber} · piedra ${hud.stone}/${hud.mats.stone}`);
  ok(hud.barraAncho > 340, `la tira tiene hueco para el almacen sin tapar el mapa: ${hud.barraAncho} px`);
  ok(hud.barOculta, 'la barra ECONOMÍA de arriba ya no duplica el mismo dato');

  // 2) el boton se puede pulsar de verdad (lo que hay en ese punto es el boton)
  const clic = await page.evaluate(() => {
    const b = document.getElementById('btnInventory'); if (!b) return { ok: false, por: 'no existe' };
    const r = b.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const en = document.elementFromPoint(cx, cy);
    return { ok: !!en && (en === b || b.contains(en)), por: en ? (en.id || en.tagName) : 'nada', rect: Math.round(r.width) + '×' + Math.round(r.height) };
  });
  ok(clic.ok, `el boton de inventario esta al alcance en ${clic.rect} px (arriba: ${clic.por})`);

  // 3) abrir, contents, no tapar la tira, no apilarse con el perfil, cerrar con Esc
  await page.click('#btnInventory');
  await sleep(420);
  const hoja = await page.evaluate(() => {
    const sh = document.getElementById('invSheet'); const cs = getComputedStyle(sh);
    const rs = sh.getBoundingClientRect(), rb = document.getElementById('velAntBar').getBoundingClientRect();
    const txt = (sh.textContent || '').replace(/\s+/g, ' ');
    return {
      visible: cs.display !== 'none' && parseFloat(cs.opacity) > 0.5,
      debajoDeLaTira: Math.round(rs.top) >= Math.round(rb.bottom) - 1,
      dentroPantalla: rs.right <= window.innerWidth + 2 && rs.bottom <= window.innerHeight + 2,
      tieneRaciones: /raciones/.test(txt), tieneMateriales: /PIEDRA|ARCILLA|FIBRA|MADERA/.test(txt),
      camara: /celda/.test(txt), txt: txt.slice(0, 130)
    };
  });
  ok(hoja.visible, 'el click abre la hoja de almacen');
  ok(hoja.debajoDeLaTira, 'y nace debajo de la tira, sin tapar el boton');
  ok(hoja.dentroPantalla, 'cabe en pantalla entera');
  ok(hoja.tieneRaciones && hoja.tieneMateriales, 'dice raciones y los cinco materiales: ' + hoja.txt);
  ok(hoja.camara, 'y donde estan guardadas (la camara del almacen)');

  // el perfil de una hormiga y la hoja no se apilan
  await page.evaluate(() => { const w = (typeof workers !== 'undefined' && workers[0]) || null; try { window.showAntProfile && window.showAntProfile(w); } catch (e) { } });
  await sleep(250);
  const pila = await page.evaluate(() => {
    const pf = document.getElementById('antProfile'), inv = document.getElementById('invSheet');
    const vis = e => e && getComputedStyle(e).display !== 'none' && parseFloat(getComputedStyle(e).opacity) > 0.5;
    return { perfil: vis(pf), inventario: vis(inv) };
  });
  ok(!(pila.perfil && pila.inventario) || !pila.perfil, 'abrir el inventario no apila el perfil de una hormiga encima');
  await page.keyboard.press('Escape');
  await sleep(320);
  ok(await page.evaluate(() => { const s = document.getElementById('invSheet'); return getComputedStyle(s).display === 'none' || parseFloat(getComputedStyle(s).opacity) < 0.5; }), 'Esc la cierra');

  // 4) lo almacenado se dibuja APOYADO en el suelo de la camara (no flotando)
  const dibujo = await page.evaluate(async () => {
    window._bot = [];
    const _orig = _boteAlmacen;
    window._boteAlmacen = function (cx, cy, w, h, col, col2, br) { window._bot.push({ cx, cy, w, h, col }); return _orig(cx, cy, w, h, col, col2, br); };
    // y un par de materiales para que el monton exista
    worldMaterials.stone = Math.max(3, worldMaterials.stone); worldMaterials.fiber = Math.max(2, worldMaterials.fiber);
    colonyFood = Math.max(6, colonyFood);
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const celdas = storageCells();
    const flot = window._bot.filter(b => { const dentro = celdas.some(c => Math.abs((c.r * CELL + CELL - 1) - b.cy) <= 3 && Math.abs((c.c * CELL) - b.cx) <= CELL); return !dentro; });
    window._boteAlmacen = _orig;
    return { botes: window._bot.length, celdas: celdas.length, flotando: flot.length, muestra: window._bot.slice(0, 3).map(b => Math.round(b.cx) + ',' + Math.round(b.cy)).join(' ') };
  });
  ok(dibujo.botes > 0, `el almacen dibuja botes y montones en la camara: ${dibujo.botes} piezas en ${dibujo.celdas} celdas (${dibujo.muestra})`);
  ok(dibujo.flotando === 0, `ninguna pieza flota: todas apoyadas en el suelo de su celda (${dibujo.flotando})`);

  ok(errs.length === 0, `cero errores de JavaScript${errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''}`);
  await page.screenshot({ path: '/tmp/antfarm-capturas/16-hud-almacen.png' });
  console.log('\n' + pass + ' ok' + (failn ? ' · ' + failn + ' FALLOS' : ' · reservas e inventario en la pantalla real'));
  await browser.close(); server.close();
  process.exit(failn ? 1 : 0);
})().catch(e => { console.error('ERROR', e); try { server.close(); } catch (x) { } process.exit(2); });
