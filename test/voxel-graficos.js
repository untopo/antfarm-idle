/**
 * voxel-graficos.js - el suelo como bloque y la hormiga como hormiga, medidos en CHROME real.
 *
 * Lo que se comprueba aqui es lo que el dueño de la granja pidio con las manos, no con numeros de
 * rendimiento: que el terreno se lea por cuadros de material (con su luz y su sombra, y sin reja de
 * marcos), que una hormiga sea una hormiga y solo la pinchada enseñe los letreros, y que para nada de
 * eso haga falta bajar un atlas de texturas del servidor.
 *
 *   node test/voxel-graficos.js
 */
const http = require('http');
const fs = require('fs');
fs.mkdirSync('/tmp/antfarm-capturas', { recursive: true });
const path = require('path');
const puppeteer = require('puppeteer');
const ROOT = path.resolve(__dirname, '..');
const PORT = 8151;
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
  const errs = [], peticiones = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|autoplay|AudioContext/.test(m.text())) errs.push('console: ' + m.text().slice(0, 140)); });
  page.on('request', r => peticiones.push(r.url()));

  await page.goto(`http://127.0.0.1:${PORT}/ant-farm-rpg/index.html`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction('typeof window.topoShowMainMenu==="function" || window._topoFlowReady===true', { timeout: 20000 }).catch(() => { });
  await page.waitForFunction("!document.getElementById('splashScreen') || document.getElementById('splashScreen').style.display==='none'", { timeout: 15000 }).catch(() => { });
  await page.click('#btnMainCreate');
  await sleep(400);
  await page.click('#createSizeScreen [data-size="small"]');
  await sleep(400);
  await page.evaluate(() => { const h = document.querySelector('.topo-dialog-host'); if (!h) return; const b = [...h.querySelectorAll('button')].find(x => x.textContent.trim() === 'SÍ'); if (b) b.click(); });
  let onbVisto = false;
  for (let i = 0; i < 16; i++) {
    const abierto = await page.evaluate(() => {
      const m = document.getElementById('onboardingModal');
      if (!m || getComputedStyle(m).display === 'none') return false;
      const b = document.getElementById('btnOnboardingStart') || [...m.querySelectorAll('button')].pop();
      if (b) b.click();
      return true;
    });
    if (abierto) { onbVisto = true; await sleep(320); }
    else { if (onbVisto) break; await sleep(320); }
  }
  await page.waitForFunction("typeof workers!=='undefined' && workers.length>0 && document.getElementById('appRoot') && getComputedStyle(document.getElementById('appRoot')).display!=='none'", { timeout: 30000 }).catch(() => { console.log('  (el juego no acabo de arrancar)'); });
  await page.waitForFunction('typeof soilCacheCanvas!=="undefined" && soilCacheCanvas && soilCacheCanvas.width>0', { timeout: 25000 }).catch(() => { });
  await sleep(2500);

  // ── 1) los atlas de terreno ya no se piden
  const atlas = peticiones.filter(u => /categoria_01_superficies|texturas_surface_full|texturas_pisos_/.test(u));
  ok(atlas.length === 0, `ningún atlas de terreno se descarga del servidor (0 de ${peticiones.length} peticiones del arranque)${atlas.length ? ' · pedidos: ' + atlas.map(u => u.split('/').pop()).join(', ') : ''}`);

  // ── 2) el cuadro de material: luz arriba, sombra abajo, junta de un pixel y nada de rejas
  const suelo = await page.evaluate(() => {
    const g = soilCacheCanvas.getContext('2d');
    const lum = (x, y, w, h) => { const d = g.getImageData(x, y, w, h).data; let s = 0, n = 0; for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 40) continue; s += 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]; n++; } return n ? s / n : -1; };
    const hash = (x, y) => { const d = g.getImageData(x, y, CELL, CELL).data; let h = 0; for (let i = 0; i < d.length; i += 4) h = (h * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7) % 2147483647; return h; };
    const r = { solidas: 0, luzArriba: 0, sombraAbajo: 0, juntaUnPixel: 0, juntaAncha: 0, tuneles: 0, tunelesLimpios: 0, adyacentesIguales: 0, adyacentes: 0, hierba: 0, pastos: 0 };
    for (let ry = SURFACE_ROW; ry < ROWS - 1; ry += 1) {
      for (let cx = 2; cx < COLS - 2; cx += 1) {
        const x = cx * CELL, y = ry * CELL;
        if (soil[ry][cx] === 1) {
          r.solidas++;
          const arriba = lum(x, y + 1, CELL - 2, 1), medio = lum(x + 3, y + 5, CELL - 6, 7), abajo = lum(x, y + CELL - 1, CELL - 2, 1);
          if (arriba > medio) r.luzArriba++;
          if (abajo < medio) r.sombraAbajo++;
          let oscuras = 0;
          for (let k = 0; k < 3; k++) { const v = lum(x + k, y + 4, 1, CELL - 6); if (v > 0 && v < medio * 0.86) oscuras++; }
          if (oscuras <= 1) r.juntaUnPixel++; else r.juntaAncha++;
          if (cx + 1 < COLS && soil[ry][cx + 1] === 1) { r.adyacentes++; if (hash(x, y) === hash(x + CELL, y)) r.adyacentesIguales++; }
        } else if (ry > SURFACE_ROW + 1) {
          // tunel: tiene que ser hueco limpio, sin el aro de marco que lo rodeaba
          const interior = lum(x + 5, y + 5, CELL - 10, CELL - 10), aro = lum(x + 1, y + 1, CELL - 2, CELL - 2);
          if (interior > 0 && aro > 0) { r.tuneles++; if (Math.abs(aro - interior) / Math.max(1, interior) < 0.34) r.tunelesLimpios++; }
        }
        if (ry === SURFACE_ROW && soil[ry][cx] === 1) {
          r.pastos++;
          const d = g.getImageData(x + 4, y + 1, 8, 3).data; let verde = 0, total = 0;
          for (let i = 0; i < d.length; i += 4) { total++; if (d[i + 1] > d[i]) verde++; }
          if (total && verde / total > 0.6) r.hierba++;
        }
      }
    }
    r.celda = CELL; r.lienzo = soilCacheCanvas.width + '×' + soilCacheCanvas.height;
    return r;
  });
  const p = (a, b) => b ? Math.round(100 * a / b) : 0;
  console.log(`  (muestreadas ${suelo.solidas} casillas de material sobre lienzo de ${suelo.lienzo}, celda ${suelo.celda} px)`);
  ok(suelo.solidas > 200, `el cache de suelo esta pintado: ${suelo.solidas} casillas de material`);
  ok(p(suelo.luzArriba, suelo.solidas) >= 88, `el bloque recibe luz por arriba: ${suelo.luzArriba}/${suelo.solidas} (${p(suelo.luzArriba, suelo.solidas)}%)`);
  ok(p(suelo.sombraAbajo, suelo.solidas) >= 88, `y hace sombra en su canto de abajo: ${suelo.sombraAbajo}/${suelo.solidas} (${p(suelo.sombraAbajo, suelo.solidas)}%)`);
  ok(suelo.juntaAncha === 0 && p(suelo.juntaUnPixel, suelo.solidas) >= 90, `la junta entre bloques mide un pixel y no tres: ${suelo.juntaUnPixel}/${suelo.solidas} sin marco ancho`);
  ok(suelo.adyacentesIguales === 0, `dos casillas contiguas del mismo terreno nunca salen calcadas: ${suelo.adyacentesIguales} repetidas de ${suelo.adyacentes} pares`);
  ok(p(suelo.tunelesLimpios, suelo.tuneles) >= 92, `el tunel es hueco limpio, sin aro: ${suelo.tunelesLimpios}/${suelo.tuneles} (${p(suelo.tunelesLimpios, suelo.tuneles)}%)`);
  ok(suelo.pastos > 0 && p(suelo.hierba, suelo.pastos) >= 80, `la franja de hierba sigue encima del primer cuadro: ${suelo.hierba}/${suelo.pastos}`);

  // ── 3) una hormiga es una hormiga: los letreros no crecen con la colonia
  await page.evaluate(() => {
    // para medir SOLO lo que llevan las hormigas encima: la tinta de feromonas y los avisos flotantes se
    // callan durante la medida (no es trucar el juego: es apagar dos canales ajenos a la etiqueta)
    try { showInk = false; } catch (e) { }
    window.__txt = 0;
    const P = CanvasRenderingContext2D.prototype, _ft = P.fillText;
    P.fillText = function () { window.__txt++; return _ft.apply(this, arguments); };
  });
  const mideTexto = (muestras) => page.evaluate((n) => new Promise(res => {
    let k = 0, tot = 0; const antes = workers.length;
    const paso = () => { try { toasts.length = 0; } catch (e) { } window.__txt = 0; requestAnimationFrame(() => { tot += window.__txt; if (++k >= n) return res({ txt: tot, k, ants: antes }); paso(); }); };
    requestAnimationFrame(paso);
  }), muestras);
  const soledad = await mideTexto(14);
  await sleep(200);
  const total = await page.evaluate(() => window._fakes(22));
  await sleep(400);
  const multitud = await mideTexto(14);
  const hormigasAntes = soledad.ants, hormigasAhora = multitud.ants;
  const recorte = await page.evaluate(() => { const e2 = document.getElementById('farmCanvas') || document.querySelector('#farmCanvas, canvas'); const r = e2 ? e2.getBoundingClientRect() : { x: 0, y: 0, width: 0, height: 0 }; return { x: Math.max(0, r.x), y: Math.max(0, r.y), width: Math.max(0, Math.min(r.width, 900)), height: Math.max(0, Math.min(r.height, 560)) }; });
  ok(recorte.width > 400 && recorte.height > 240, `el lienzo esta en pantalla y se ve: ${Math.round(recorte.width)}×${Math.round(recorte.height)} px`);
  if (recorte.width > 10) await page.screenshot({ path: '/tmp/antfarm-capturas/voxel-colonia.png', clip: recorte });
  await page.evaluate(() => { for (let i = workers.length - 1; i >= 0; i--) if (workers[i]._debugFake) workers.splice(i, 1); });
  console.log(`  (texto dibujado por cuadro: ${Math.round(soledad.txt / soledad.k * 10) / 10} glifos con ${hormigasAntes} hormigas · ${Math.round(multitud.txt / multitud.k * 10) / 10} con ${hormigasAhora})`);
  ok(hormigasAhora >= hormigasAntes + 20, `la colonia postiza entro de verdad: ${hormigasAntes} -> ${hormigasAhora} hormigas`);
  const _crece = multitud.txt / multitud.k - soledad.txt / soledad.k;
  ok(_crece <= 6, `veintidos hormigas mas no anaden ni seis letreros: ${Math.round(soledad.txt / soledad.k * 10) / 10} -> ${Math.round(multitud.txt / multitud.k * 10) / 10} glifos por cuadro (crece ${Math.round(_crece * 10) / 10})`);
  ok(multitud.txt / multitud.k < soledad.txt / soledad.k, `con ${hormigasAhora} hormigas el mapa pinta MENOS letreros que con ${hormigasAntes}: ${Math.round(multitud.txt / multitud.k)} frente a ${Math.round(soledad.txt / soledad.k)} (la fundacion es la unica que se explica sola)`);

  // ── 4) y al pincharla, si enseña lo que hace
  const ficha = await page.evaluate(() => {
    const a = workers[0]; if (!a) return null;
    a.selected = true; selectedAntIndex = 0;
    return { id: a.id || null, estado: a.state };
  });
  await sleep(300);
  const conFicha = await mideTexto(14);
  ok(!!ficha && conFicha.txt / conFicha.k > 0, `la seleccionada si muestra su detalle (${ficha && ficha.estado}): ${Math.round(conFicha.txt / conFicha.k * 10) / 10} glifos en el cuadro`);

  ok(errs.length === 0, `cero errores de JavaScript en todo el recorrido${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
  await browser.close(); server.close();
  console.log(`\n${pass} ok · ${failn} FALLOS`);
  process.exit(failn ? 1 : 0);
})().catch(e => { console.error('ARRENDAMIENTO:', e); process.exit(2); });
