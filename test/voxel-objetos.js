/**
 * voxel-objetos.js - plantas, miel, comida y almacén pintados en bloques, medidos en CHROME real.
 *
 * No se mira si "queda bonito": se mira COMO se pinta. Se apunta cada rectángulo que el lienzo del prado
 * recibe durante unos cuantos cuadros y se comprueba, bloque a bloque y con las coordenadas exactas, si
 * lleva pegada arriba su fila de luz y abajo su fila de sombra (el sello que el dueño pidió para todo el
 * mundo de bloques). Se mide además el tamaño de la gota sobre un lienzo suelto - la función de pintar de
 * verdad, no una copia -, si vuelve el número de cantidad, si queda algún contorno negro y si el prado
 * parpadea (que parpadeaba: el Math.random del forraje elegía cada cuadro qué brizna se cortaba).
 *
 *   node test/voxel-objetos.js
 */
const http = require('http');
const fs = require('fs');
fs.mkdirSync('/tmp/antfarm-capturas', { recursive: true });
const path = require('path');
const puppeteer = require('puppeteer');
const ROOT = path.resolve(__dirname, '..');
const PORT = 8153;
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
    if (abierto) { onbVisto = true; await sleep(320); } else { if (onbVisto) break; await sleep(320); }
  }
  await page.waitForFunction("typeof plants!=='undefined' && document.getElementById('farmCanvas')", { timeout: 30000 }).catch(() => { console.log('  (el juego no acabo de arrancar)'); });
  await sleep(3000);

  const atlas = peticiones.filter(u => /categoria_02_vegetacion|categoria_03_alimentos|honey_tight_transparent/.test(u));
  ok(atlas.length === 0, `ningún atlas de plantas, comida o miel se descarga (${atlas.length} de ${peticiones.length} peticiones)${atlas.length ? ' · ' + atlas.map(u => u.split('/').pop()).join(', ') : ''}`);

  const pinta = await page.evaluate(async () => {
    const VISTOS = new Set(), R = [], T = [];
    const P = CanvasRenderingContext2D.prototype, _fr = P.fillRect, _ft = P.fillText;
    P.fillRect = function (x, y, w, h) {
      if (this.canvas && this.canvas.id === 'farmCanvas') {
        const st = this.fillStyle;
        if (typeof st === 'string' && st[0] === '#') {
          const k = Math.floor(x) + ',' + Math.floor(y) + ',' + Math.floor(w) + ',' + Math.floor(h) + ',' + st;
          if (!VISTOS.has(k)) { VISTOS.add(k); R.push([Math.floor(x), Math.floor(y), Math.max(1, Math.floor(w)), Math.max(1, Math.floor(h)), st]); }
        }
      }
      return _fr.apply(this, arguments);
    };
    P.fillText = function (txt, x, y) { if (this.canvas && this.canvas.id === 'farmCanvas') T.push([String(txt), Math.floor(x || 0), Math.floor(y || 0)]); return _ft.apply(this, arguments); };
    await new Promise(res => { let k = 0; const paso = () => { if (++k >= 6) return res(); requestAnimationFrame(paso); }; requestAnimationFrame(paso); });
    P.fillRect = _fr; P.fillText = _ft;

    const lum = h => { const n = parseInt(h.slice(1), 16); return 0.3 * ((n >> 16) & 255) + 0.59 * ((n >> 8) & 255) + 0.11 * (n & 255); };
    const verde = h => { const n = parseInt(h.slice(1), 16); const r = (n >> 16) & 255, g = (n >> 8) & 255; return g > 60 && g > r + 14; };   // verde de hoja, no el fondo de una burbuja
    const ambar = h => { const n = parseInt(h.slice(1), 16); const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255; return r > 190 && g > 110 && b < 140 && g > b; };
    const PALETA_BOTE = new Set(['#ffcc33', '#ffda66', '#ff8c00']);   // el #ffcc00 suelto es el destello de un bloque a punto de caerse, no un bote
    try { for (const d of _MAT_DEFS) { PALETA_BOTE.add(d.col); PALETA_BOTE.add(d.col2); } } catch (e) { }
    const MAPA = new Map();
    for (const r of R) if (/^#[0-9a-f]{6}$/i.test(r[4])) MAPA.set(r[0] + ',' + r[1] + ',' + r[2] + ',' + r[3], r[4]);

    const familia = (x, y, dx, dy, pesa) => {
      const rs = R.filter(r => Math.abs(r[0] + r[2] / 2 - x) <= dx && Math.abs(r[1] + r[3] / 2 - y) <= dy);
      if (!rs.length) return null;
      // lo de 16 px de lado es el terreno (o su montículo), no el objeto: los bultos nunca pasan de 12
      const propios = rs.filter(r => r[2] <= 12 && r[3] <= 14 && (!pesa || pesa(r[4])));
      let cuerpos = 0, sellados = 0; const sinSello = [];
      for (const b of propios) {
        if (b[2] < 4 || b[3] < 3 || !/^#[0-9a-f]{6}$/i.test(b[4])) continue;
        cuerpos++;
        const lu = MAPA.get(b[0] + ',' + b[1] + ',' + b[2] + ',1');
        const so = MAPA.get(b[0] + ',' + (b[1] + b[3] - 1) + ',' + b[2] + ',1');
        if (lu && so && lum(lu) > lum(b[4]) && lum(so) < lum(b[4])) sellados++;
        else if (sinSello.length < 3) sinSello.push(`${b[2]}x${b[3]}@${b[0]},${b[1]} ${b[4]} luz=${lu || '-'} sombra=${so || '-'}`);
      }
      return {
        n: rs.length, colores: new Set(rs.map(r => r[4])).size, cuerpos, sellados, sinSello,
        negro: rs.filter(r => r[4] === '#000' && r[2] >= 8 && r[3] >= 8).length,
        verdes: rs.filter(r => verde(r[4])).length
      };
    };
    const out = { rectangulos: R.length, mieles: [], alimentos: [], plantas: [], botes: [], textos: T.length, textosCerca: 0, signos: T.filter(t => t[0] === '?').length };
    for (const f of foods) {
      const esMiel = f.ftype === 'honey';
      const r1 = familia(f.x, f.y, 12, 14, esMiel ? ambar : (h => !verde(h)));
      if (!r1) continue;
      (esMiel ? out.mieles : out.alimentos).push(Object.assign({ tipo: f.ftype, amt: f.amount }, r1));
      out.textosCerca += T.filter(t => Math.abs(t[1] - f.x) <= 14 && Math.abs(t[2] - f.y) <= 16 && (/^\d+$/.test(t[0]) || /^x\d+$/.test(t[0]) || t[0] === '?')).length;
    }
    for (const pl of plants) {
      if (pl.cave) continue;
      const r1 = familia(pl.x, pl.y - 6, 14, 22, verde);
      if (r1) out.plantas.push(Object.assign({ tipo: pl.type }, r1));
      out.textosCerca += T.filter(t => Math.abs(t[1] - pl.x) <= 12 && Math.abs(t[2] - (pl.y - 10)) <= 14 && (/^\d+$/.test(t[0]) || t[0] === '?')).length;
    }
    try {
      const cs = storageCells();
      for (const cd of cs.slice(0, 10)) {
        const b = familia(cd.c * CELL + CELL / 2, cd.r * CELL + CELL - 5, 10, 10, h => PALETA_BOTE.has(h));
        if (b) out.botes.push(b);
      }
      out.celdasAlmacen = cs.length;
    } catch (e) { out.errorAlmacen = e.message; }
    out.totales = { foods: foods.length, plants: plants.length };
    return out;
  });

  const resumen = (arr, nombre) => {
    const cuerpos = arr.reduce((s, o) => s + (o.cuerpos || 0), 0), sellados = arr.reduce((s, o) => s + (o.sellados || 0), 0);
    const sueltos = [].concat(...arr.map(o => o.sinSello || [])).slice(0, 2);
    console.log(`  (${nombre}: ${arr.length} piezas · ${sellados}/${cuerpos} bloques con el sello · colores ${arr.length ? Math.max(...arr.map(o => o.colores)) : 0}${sueltos.length ? ' · sin sello: ' + sueltos.join(' | ') : ''})`);
    return { cuerpos, sellados };
  };
  const alMiel = resumen(pinta.mieles, 'miel'), alCom = resumen(pinta.alimentos, 'otros alimentos'), alPl = resumen(pinta.plantas, 'plantas'), alBo = resumen(pinta.botes, 'bote del almacen');
  const sellao = f => f.cuerpos > 0 && f.sellados === f.cuerpos;
  ok(pinta.rectangulos > 400, `el cuadro pinta por rectángulos sueltos (bloque a bloque): ${pinta.rectangulos} distintos en seis cuadros`);
  ok(sellao(alCom), `cada racimo, seta y semilla lleva el sello puesto: ${alCom.sellados}/${alCom.cuerpos}`);
  ok(alPl.cuerpos > 0 && alPl.sellados >= Math.ceil(alPl.cuerpos * 0.95), `las matas del prado leen como bloques con su relieve: ${alPl.sellados}/${alPl.cuerpos}`);
  ok(sellao(alBo), `la cámara del almacén se pinta con el mismo sello: ${alBo.sellados}/${alBo.cuerpos} bloques`);
  ok(pinta.mieles.concat(pinta.alimentos, pinta.plantas, pinta.botes).reduce((s, o) => s + o.negro, 0) === 0, 'ningún bulto lleva ya contorno negro: lo que separa es la sombra');
  ok(pinta.plantas.length >= 3, `el prado tiene plantas dibujadas a mano: ${pinta.plantas.length} de ${pinta.totales.plants}`);
  ok(pinta.plantas.length > 0 && pinta.plantas.every(p => p.verdes > 0), `todas salen en el verde de la estación, el mismo del terreno: ${pinta.plantas.filter(p => p.verdes > 0).length}/${pinta.plantas.length}`);
  ok(pinta.plantas.reduce((s, p) => s + p.colores, 0) / Math.max(1, pinta.plantas.length) >= 1.8, `cada mata lleva más de un tono: media ${(pinta.plantas.reduce((s, p) => s + p.colores, 0) / Math.max(1, pinta.plantas.length)).toFixed(2)} colores`);

  const gota = await page.evaluate(() => ({ uno: window._muestraMiel ? window._muestraMiel(1) : { error: 'sin gancho' }, dos: window._muestraMiel(2), tres: window._muestraMiel(3), diez: window._muestraMiel(10) }));
  const enBanda = o => o && !o.error && o.w >= 8 && o.w <= 14 && o.h >= 8 && o.h <= 14;
  ok(enBanda(gota.uno) && enBanda(gota.dos) && enBanda(gota.tres) && enBanda(gota.diez), `la gota, medida sobre un lienzo suelto, no se sale de la banda de 8-14 px: 1 ración ${gota.uno.w}×${gota.uno.h} · 2 ${gota.dos.w}×${gota.dos.h} · 3 ${gota.tres.w}×${gota.tres.h} · 10 ${gota.diez.w}×${gota.diez.h}`);
  ok(gota.uno.arriba > gota.uno.medio && gota.uno.abajo < gota.uno.medio, `la gota, entera, tiene la fila de arriba mas clara que la del medio y la de abajo mas oscura: ${Math.round(gota.uno.arriba)} > ${Math.round(gota.uno.medio)} > ${Math.round(gota.uno.abajo)}`);
  ok(pinta.mieles.length === 0 || sellao(alMiel), `los bloques de miel sueltos por el mapa salen con el sello puesto: ${alMiel.sellados}/${alMiel.cuerpos}${pinta.mieles.length ? '' : ' (esta vez no habia gotas sueltas: la medida va por el lienzo aparte)'}`);
  ok(gota.diez.w >= gota.uno.w && gota.diez.h >= gota.uno.h, `y la cantidad se lee en el bulto: más raciones, gota más gorda (${gota.uno.w}×${gota.uno.h} → ${gota.diez.w}×${gota.diez.h})`);

  ok(pinta.textosCerca === 0 && pinta.signos === 0, `ni un número de cantidad encima de la comida ni de las plantas (${pinta.textosCerca}) y ni un '?' por el mapa (${pinta.signos})`);

  const estable = await page.evaluate(async () => {
    const cv = document.getElementById('farmCanvas'), g = cv.getContext('2d');
    const y0 = Math.max(0, SURFACE_Y - 26), alt = 26, w = Math.min(cv.width, 900);
    const saca = () => g.getImageData(0, y0, w, alt).data.slice();
    paused = true;
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const a = saca();
    for (let k = 0; k < 20; k++) await new Promise(r => requestAnimationFrame(r));
    const b = saca();
    paused = false;
    let dif = 0, tot = a.length / 4;
    for (let i = 0; i < a.length; i += 4) { if (Math.abs(a[i] - b[i]) > 6 || Math.abs(a[i + 1] - b[i + 1]) > 6 || Math.abs(a[i + 2] - b[i + 2]) > 6) dif++; }
    return { dif, tot, pct: Math.round(1000 * dif / tot) / 10, ancho: w };
  });
  ok(estable.pct < 0.5, `con el reloj parado el prado no parpadea: ${estable.dif} de ${estable.tot} píxeles cambian (${estable.pct} %) en 20 cuadros`);

  await page.screenshot({ path: '/tmp/antfarm-capturas/voxel-objetos.png' });
  ok(errs.length === 0, `cero errores de JavaScript en todo el recorrido${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
  await browser.close(); server.close();
  console.log(`\n${pass} ok · ${failn} FALLOS`);
  process.exit(failn ? 1 : 0);
})().catch(e => { console.error('ARRENDAMIENTO:', e); process.exit(2); });
