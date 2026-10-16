/**
 * fondo-cueva.js — la pared de fondo del hueco y el flash de las cuevas, medidos en CHROME real.
 *
 * El dueño lo pidió así (2026-10-16): «veo que los gráficos del fondo del mapa se "glitchean", de vez en
 * cuando hay como un flash solo en la textura de fondo de las cuevas. Te es posible crear también una
 * textura voxel acorde para el fondo de la cueva, que sirva para dar ese efecto de pared de fondo, como
 * hacen en Terraria».
 *
 * Las dos cosas se comprueban aquí por separado, y ninguna bajando un umbral:
 *   · EL FLASH se mide en CUADROS: se cuenta cuántos fotogramas pintan el mundo sin pasar por el cache
 *     de suelo (que era el camino que pintaba el hueco en crema '#fff1c8' y el agua, y solo cuando había
 *     repintado pendiente). Se exige CERO, y además que el mundo se esté cavando de verdad durante la
 *     medida, para que la prueba no salga verde por no pasar nada.
 *   · LA PARED se mide sobre el propio lienzo del cache: que el hueco no sea un charco de un solo color,
 *     que tenga sus hiladas con junta, que el tono siga a la banda, que dos casillas seguidas no salgan
 *     calcadas y que repintar no cambie un píxel (si el ruido dependiera del reloj, parpadearía).
 *
 *   node test/fondo-cueva.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const ROOT = path.resolve(__dirname, '..');
const PORT = 8189;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png' };

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
  page.on('console', m => { if (m.type() === 'error' && !/favicon|autoplay|AudioContext/.test(m.text())) errs.push('console: ' + m.text().slice(0, 140)); });

  await page.goto(`http://127.0.0.1:${PORT}/ant-farm-rpg/index.html`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction('typeof window.topoShowMainMenu==="function" || window._topoFlowReady===true', { timeout: 20000 }).catch(() => { });
  await page.waitForFunction("!document.getElementById('splashScreen') || document.getElementById('splashScreen').style.display==='none'", { timeout: 15000 }).catch(() => { });
  await page.click('#btnMainCreate');
  await sleep(400);
  await page.click('#createSizeScreen [data-size="small"]');
  await sleep(400);
  await page.evaluate(() => { const h = document.querySelector('.topo-dialog-host'); if (!h) return; const b = [...h.querySelectorAll('button')].find(x => x.textContent.trim() === 'SÍ'); if (b) b.click(); });
  for (let i = 0; i < 16; i++) {
    const abierto = await page.evaluate(() => {
      const m = document.getElementById('onboardingModal');
      if (!m || getComputedStyle(m).display === 'none') return false;
      const b = document.getElementById('btnOnboardingStart') || [...m.querySelectorAll('button')].pop();
      if (b) b.click();
      return true;
    });
    await sleep(320);
    if (!abierto && i > 2) break;
  }
  await page.waitForFunction("typeof workers!=='undefined' && workers.length>0 && document.getElementById('appRoot') && getComputedStyle(document.getElementById('appRoot')).display!=='none'", { timeout: 30000 }).catch(() => { console.log('  (el juego no acabo de arrancar)'); });
  await page.waitForFunction('typeof soilCacheCanvas!=="undefined" && soilCacheCanvas && soilCacheCanvas.width>0', { timeout: 25000 }).catch(() => { });
  await sleep(2000);

  // Una galeria de acceso tallada a mano y cuadrilla sembrada: se mide como se PINTA el hueco, no cuanto
  // tarda la colonia en llegar al fondo (eso ya lo mide test/profundidad.js).
  await page.evaluate(() => {
    try { window._fakes && window._fakes(26); } catch (e) { }
    try { setGameSpeed(32); } catch (e) { }
    const r0 = SURFACE_ROW + 9;
    for (let r = SURFACE_ROW + 2; r <= r0; r++) for (let c = CENTER_COL - 7; c <= CENTER_COL + 7; c++) {
      if (r < ROWS && c >= 0 && c < COLS) { soil[r][c] = 0; if (soilType[r]) soilType[r][c] = 0; }
    }
    try { markSoilDirty(); } catch (e) { }
  });
  await sleep(1200);

  // ── A) EL FLASH: cuadros que pintan el mundo sin su cache, mididos mientras se cava ──
  const flash = await page.evaluate(async () => {
    const cv = document.getElementById('farmCanvas'), ctx = cv.getContext('2d'), cc = soilCacheCanvas;
    let dib = 0, cuadros = 0, sinCache = 0, rellenos = 0, rellenosMax = 0, cuadroP95 = 0, marcas = 0;
    const dur = [];
    const realDraw = ctx.drawImage.bind(ctx), realFill = ctx.fillRect.bind(ctx);
    ctx.drawImage = function (img) { if (img === cc) dib++; return realDraw.apply(ctx, arguments); };
    ctx.fillRect = function () { rellenos++; return realFill.apply(ctx, arguments); };
    const raf = window.requestAnimationFrame.bind(window);
    const huecos0 = (() => { let n = 0; for (let r = SURFACE_ROW + 1; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (soil[r][c] === 0) n++; return n; })();
    // LA CONDICION, PUESTA A MANO. Si la colonia no abre nada en estos ocho segundos la medida no vale
    // nada (no habria repintado pendiente y el cuadro viejo no se activaria ni con el bug de antes). En el
    // intento de dejarla en la propia colonia salio +0 casillas: medido y descartado. Aqui, cada doce
    // cuadros, se marca el terreno como si recien hubieran mordido una roca: es EXACTAMENTE el estado que
    // hacia saltar el flash (cache pendiente -> cuadro pintado a mano -> flash crema), empujado muchas
    // veces. Con eso, `sinCache === 0` es una prueba, no una casualidad.
    let t0 = performance.now();
    const tick = () => {
      const ahora = performance.now(); dur.push(ahora - t0); t0 = ahora;
      if (cuadros % 12 === 0) { marcas++; try { markSoilDirty(); } catch (e) { } }
      cuadros++; if (dib === 0) sinCache++;
      rellenosMax = Math.max(rellenosMax, rellenos); rellenos = 0; dib = 0;
      raf(tick);
    };
    raf(tick);
    await new Promise(r => setTimeout(r, 8000));
    dur.sort((a, b) => a - b);
    let tuneles = 0;
    for (let r = SURFACE_ROW + 1; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (soil[r][c] === 0) tuneles++;
    return { cuadros, sinCache, marcas, rellenosMax, med: dur[Math.floor(dur.length * 0.5)] || 0, p95: dur[Math.floor(dur.length * 0.95)] || 0, digs: tuneles - huecos0, tuneles };
  });
  console.log(`  (medido en ${flash.cuadros} cuadros · ${flash.digs} bloques cavados · ${flash.tuneles} casillas de hueco · rellenos máx/cuadro ${flash.rellenosMax} · mediana ${flash.med.toFixed(1)} ms · p95 ${flash.p95.toFixed(1)} ms)`);
  ok(flash.marcas > 20 && flash.tuneles > 40, `la condicion del flash estuvo puesta ${flash.marcas} veces durante la medida (repintado pendiente con ${flash.tuneles} casillas de hueco abiertas)`);
  console.log(`  (nota: la colonia abrio ella sola +${flash.digs} casillas en estos 8 s; si sale 0 no invalida nada - lo de que caven sin que nadie las empuje lo mide test/profundidad.js bloque C)`);
  ok(flash.sinCache === 0, `ningún cuadro pinta el mundo por el camino viejo (el del hueco crema): ${flash.sinCache} de ${flash.cuadros}`);
  ok(flash.med < 34 && flash.p95 < 70, `y pintar la pared no cuesta el cuadro: mediana ${flash.med.toFixed(1)} ms · p95 ${flash.p95.toFixed(1)} ms`);

  // ── B) la textura vieja ya no existe en el código: no hay dos versiones del hueco ──
  const src = fs.readFileSync(path.join(ROOT, 'ant-farm-rpg/js/app.js'), 'utf8');
  const cremas = (src.replace(/\/\/[^\n]*/g, '').match(/#fff1c8|#ffedc0|tunnelBase/g) || []).length;   // fuera los comentarios, que cuentan lo que ya no esta
  ok(cremas === 0, `la base crema del hueco ya no esta en el fichero ('#fff1c8', '#ffedc0' o 'tunnelBase': ${cremas} usos; '#fff8dc' sigue, que son las estrellas del splash)`);
  const llamadas = (src.match(/pintarHuecoVoxel\(g|pintarHuecoVoxel\(soilCacheCtx|pintarHuecoVoxel\(ctx/g) || []).length;
  ok(llamadas >= 3, `el hueco lo pintan LOS MISMOS ayudantes en las tres rutas (cache, legacy y minimapa): ${llamadas} llamadas`);
  ok(/ctx\.drawImage\(soilCacheCanvas/.test(src) && /pintarAguaVoxel\(ctx,c,r\)/.test(src), `el agua va ENCIMA del cache en el mundo principal (antes solo salia en el cuadro del flash)`);

  // ── C) la pared: textura, hiladas, y no un charco de un color ──
  const pared = await page.evaluate(() => {
    const g = soilCacheCanvas.getContext('2d');
    const celda = (c, r) => g.getImageData(c * CELL, r * CELL, CELL, CELL).data;
    const lum = (d) => { let s = 0; for (let i = 0; i < d.length; i += 4) s += 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]; return s / (d.length / 4); };
    const rgb = (d) => { let R = 0, G = 0, B = 0, n = 0; for (let i = 0; i < d.length; i += 4) { R += d[i]; G += d[i + 1]; B += d[i + 2]; n++; } return [R / n, G / n, B / n]; };
    const r = { huecos: 0, multicolor: 0, oscuros: 0, recedidas: 0, conCara: 0, hiladas: 0, adyacentes: 0, calcados: 0, techos: 0, conTecho: 0 };
    const porTipo = {};
    const visto = [];
    for (let ry = SURFACE_ROW + 2; ry < ROWS - 1; ry++) for (let cx = 2; cx < COLS - 2; cx++) {
      if (soil[ry][cx] !== 0) continue;
      const d = celda(cx, ry);
      const cols = new Set(); for (let i = 0; i < d.length; i += 4) cols.add(d[i] + ',' + d[i + 1] + ',' + d[i + 2]);
      r.huecos++;
      if (cols.size >= 4) r.multicolor++;
      const L = lum(d);
      if (L > 6 && L < 110) r.oscuros++;                       // ni negro plano (6) ni el crema del flash (~240)
      // y la regla de fondo de verdad: la pared va DETRAS del tunel, o sea mas apagada que la cara del
      // material que la rodea. Si algn dia la pared sale mas clara que la roca tallada, el hueco se ve
      // pegado a la pantalla y no hundido: eso es lo que mide 'recedidas'.
      let cara = 0, nc = 0;
      for (const v of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const rr = ry + v[0], ccx = cx + v[1];
        if (rr < 0 || rr >= ROWS || ccx < 0 || ccx >= COLS || soil[rr][ccx] !== 1) continue;
        cara += lum(g.getImageData(ccx * CELL + 3, rr * CELL + 4, CELL - 6, 8).data); nc++;
      }
      if (nc >= 2 && L < (cara / nc) * 0.8) r.recedidas++;     // 20% por debajo de la cara tallada
      if (nc >= 2) r.conCara++;
      // EL APAREJO: tiene que haber junta en las DOS direcciones, y mas oscura que la media del cuadro.
      // El umbral es 8% (no 12%) porque la junta se bajo a proposito de -30% a -22% al retocar la pared:
      // a 12% una persiana de 4 px pasaba la prueba y asi es como se col6 el look de cortina. Lo que de
      // verdad sostiene «esto es una pared» es este cuadriculado + lo multi-color + lo de detras-arriba.
      // La metrica tiene que mirar la JUNTA, no el techo ni el suelo de la casilla (la primera version
      // comparaba la media de la fila contra la de la casilla: pasaba de casualidad en las casillas con
      // voladizo y fallaba en las del centro de una camara, que es donde la junta NO se veia amenazada).
      // Una junta de mortero es un HUNDIDO LOCAL de un pixel: la fila (o columna) i es por lo menos 6 de
      // luma mas oscura que sus dos vecinas. Eso es el Aparejo, en las dos direcciones.
      const lumFila = (i) => { let a = 0; for (let j = 0; j < CELL; j++) { const k = (i * CELL + j) * 4; a += 0.3 * d[k] + 0.59 * d[k + 1] + 0.11 * d[k + 2]; } return a / CELL; };
      const lumCol = (i) => { let a = 0; for (let j = 0; j < CELL; j++) { const k = (j * CELL + i) * 4; a += 0.3 * d[k] + 0.59 * d[k + 1] + 0.11 * d[k + 2]; } return a / CELL; };
      const fila = [], col = [];
      for (let i = 0; i < CELL; i++) { fila.push(lumFila(i)); col.push(lumCol(i)); }
      // (el minimo, no un hundido estricto: la junta horizontal del aparejo mide DOS pixels - la linea
      // pintada y la fila que deja libre el ladrillo de arriba - y un minimo local no existe en un par de
      // filas iguales. Medido: con el minimo local salia 0/114, que era el metrica, no el dibujo.)
      const med = (a) => { const x = [...a].sort((p, q) => p - q); return x[Math.floor(x.length / 2)]; };
      const mh = med(fila), mv = med(col);
      const juntaH = Math.min(...fila) < mh - 6, juntaV = Math.min(...col) < mv - 6;
      if (juntaH && juntaV) r.hiladas++;
      // el canto de arriba: si hay roca encima, 2 px de sombra de voladizo
      if (soil[ry - 1][cx] === 1) { r.conTecho++;
        let a = 0, m = 0;
        for (let j = 0; j < CELL; j++) { a += d[j * 4]; m += d[(6 * CELL + j) * 4]; }
        if (a / CELL < m / CELL) r.techos++;
      }
      // dos casillas contiguas de la misma roca no pueden salir calcadas
      if (soil[ry][cx + 1] === 0) {
        const d2 = celda(cx + 1, ry); let ig = true;
        for (let i = 0; i < d.length; i += 4) if (d[i] !== d2[i] || d[i + 1] !== d2[i + 1]) { ig = false; break; }
        r.adyacentes++; if (ig) r.calcados++;
      }
      // y el tono, por el material que lo rodea
      let t = 0;
      const vec = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (const v of vec) { const rr = ry + v[0], ccx = cx + v[1]; if (soil[rr] && soil[rr][ccx] === 1 && soilType[rr][ccx] > 0) { t = soilType[rr][ccx]; break; } }
      if (t) { (porTipo[t] = porTipo[t] || { n: 0, L: 0, R: 0, G: 0, B: 0 }); const q = rgb(d), p = porTipo[t]; p.n++; p.L += L; p.R += q[0]; p.G += q[1]; p.B += q[2]; }
      if (visto.length < 4) visto.push({ c: cx, r: ry, colores: cols.size, L: +L.toFixed(1) });
    }
    for (const k in porTipo) { const p = porTipo[k]; p.L /= p.n; p.R /= p.n; p.G /= p.n; p.B /= p.n; p.n|0; }
    return { r, porTipo, visto, celda: CELL, lienzo: soilCacheCanvas.width + '×' + soilCacheCanvas.height };
  });
  const R = pared.r, p = (a, b) => b ? Math.round(100 * a / b) : 0;
  console.log(`  (pared de fondo leida casilla a casilla sobre el lienzo ${pared.lienzo}: ${R.huecos} huecos · ejemplo ${pared.visto.map(v => v.colores + ' colores/' + v.L).join(', ')})`);
  ok(R.huecos > 40, `hay ${R.huecos} casillas de hueco que medir`);
  ok(p(R.multicolor, R.huecos) >= 85, `el hueco no es un charco de un color: ${R.multicolor}/${R.huecos} casillas con 4+ colores (${p(R.multicolor, R.huecos)}%)`);
  ok(p(R.oscuros, R.huecos) >= 90, `ni negro plano ni el crema del flash: ${R.oscuros}/${R.huecos} casillas en luma 6..110 (${p(R.oscuros, R.huecos)}%)`);
  ok(p(R.recedidas, R.conCara) >= 85, `y la pared va DETRAS del hueco (al menos un 20% mas apagada que la cara tallada de su alrededor): ${R.recedidas}/${R.conCara} (${p(R.recedidas, R.conCara)}%)`);
  ok(p(R.hiladas, R.huecos) >= 85, `el aparejo esta a la vista: junta de mortero en horizontal Y vertical en ${R.hiladas}/${R.huecos} casillas (${p(R.hiladas, R.huecos)}%)`);
  ok(R.calcados === 0, `dos casillas contiguas del mismo material nunca salen calcadas: ${R.calcados} de ${R.adyacentes} pares`);
  ok(p(R.techos, R.conTecho) >= 85, `donde arriba hay roca, la pared tiene su sombra de voladizo: ${R.techos}/${R.conTecho} (${p(R.techos, R.conTecho)}%)`);

  // ── D) el tono sigue a la banda: no es la misma pared en piedra que en obsidiana.
  // En el mapa pequeno todavia NO hay obsidiana (esta detras de cinco losas), y la prueba de que la pared
  // cambia con el material necesita ese material: se construye la condicion a mano, en un bolsillo aislado
  // que la colonia no puede alcanzar, y se restaura el terreno al medir. No se baja ningun umbral.
  const bandas = await page.evaluate(() => {
    const g = soilCacheCanvas.getContext('2d');
    const r0 = SURFACE_ROW + 13, c0 = 41;                     // cuatro columnas del borde, lejos del nido
    const guarda = [];
    for (let r = r0 - 1; r <= r0 + 1; r++) for (let c = c0 - 1; c <= c0 + 1; c++) guarda.push([r, c, soil[r][c], soilType[r][c]]);
    const mide = (t) => {
      for (let r = r0 - 1; r <= r0 + 1; r++) for (let c = c0 - 1; c <= c0 + 1; c++) {
        if (r === r0 && c === c0) { soil[r][c] = 0; if (soilType[r]) soilType[r][c] = 0; }
        else { soil[r][c] = 1; if (soilType[r]) soilType[r][c] = t; }
      }
      soilCacheDirty = true; rebuildSoilCache();
      const d = g.getImageData(c0 * CELL, r0 * CELL, CELL, CELL).data;
      let L = 0, R = 0, B = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) { L += 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]; R += d[i]; B += d[i + 2]; n++; }
      return { L: +(L / n).toFixed(1), R: +(R / n).toFixed(1), B: +(B / n).toFixed(1) };
    };
    const out = { piedra: mide(4), marmol: mide(12), obsidiana: mide(13) };
    for (const q of guarda) { soil[q[0]][q[1]] = q[2]; soilType[q[0]][q[1]] = q[3]; }
    soil[r0][c0] = 0;                                          // el bolsillo se queda hueco, como estaba
    soilCacheDirty = true; rebuildSoilCache();
    return out;
  });
  console.log(`  (pared segun el material que la rodea · piedra ${JSON.stringify(bandas.piedra)} · marmol ${JSON.stringify(bandas.marmol)} · obsidiana ${JSON.stringify(bandas.obsidiana)})`);
  ok(bandas.obsidiana.L < bandas.piedra.L - 6, `la pared de OBSIDIANA es mas oscura que la de PIEDRA: luma ${bandas.obsidiana.L} frente a ${bandas.piedra.L}`);
  ok(bandas.obsidiana.B > bandas.obsidiana.R, `y la de obsidiana tira a violeta (azul ${bandas.obsidiana.B} > rojo ${bandas.obsidiana.R}), no es solo negro`);
  ok(Math.abs(bandas.marmol.L - bandas.piedra.L) > 4, `la de MARMOL NEGRO no es un calcado de la de piedra: luma ${bandas.marmol.L} vs ${bandas.piedra.L}`);

  // (las muestras naturales del mapa, por si el lector quiere ver el reparto)
  const tipos = Object.keys(pared.porTipo).map(Number).sort((a, b) => a - b);
  const informe = tipos.map(t => `${t}:${pared.porTipo[t].L.toFixed(0)}`).join(' ');
  console.log(`  (pared leida en el mapa pequeño, por material del entorno: ${informe})`);
  const nat = tipos.filter(t => pared.porTipo[t].n >= 3);
  const Ls = nat.map(t => pared.porTipo[t].L);
  ok(nat.length >= 2 && Math.max(...Ls) - Math.min(...Ls) > 4, `en el mapa pequeno las paredes naturales ya se distinguen entre si (tierra, arcilla, arena): ${nat.map(t=>t+':'+pared.porTipo[t].L.toFixed(0)).join(' ')} · ${nat.reduce((a,t)=>a+pared.porTipo[t].n,0)} casillas`);

  // ── E) determinismo: repintar entero no mueve ni un pixel (si el ruido dependiera del reloj, parpadea) ──
  const det = await page.evaluate(() => {
    const g = soilCacheCanvas.getContext('2d');
    const firma = () => { const d = g.getImageData(0, 0, soilCacheCanvas.width, soilCacheCanvas.height).data; let h = 0; for (let i = 0; i < d.length; i += 4) h = (h * 31 + d[i] * 3 + d[i + 1] * 5 + d[i + 2] * 7) % 2147483647; return h; };
    const a = firma();
    soilCacheDirty = true; rebuildSoilCache(); const b = firma();
    soilCacheDirty = true; rebuildSoilCache(); const c = firma();
    return { a, b, c };
  });
  ok(det.a === det.b && det.b === det.c, `repintar el mapa entero dos veces deja el lienzo IDENTICO (firma ${det.a} = ${det.b} = ${det.c}): la pared no depende del reloj`);
  const quieta = await page.evaluate(async () => {
    const g = soilCacheCanvas.getContext('2d');
    // una galeria privada, lejos del nido y de la boca: si la cava la colonia, la medida no vale
    const cx = 3; let ry = -1;
    for (let r = SURFACE_ROW + 10; r < ROWS - 2; r++) { if (soil[r][cx] === 0 && soil[r][cx + 1] === 0 && soil[r][cx + 2] === 0) { ry = r; break; } }
    if (ry < 0) { for (let r = SURFACE_ROW + 10; r < ROWS - 2; r++) for (let c = 3; c <= 8; c++) { soil[r][c] = 0; if (soilType[r]) soilType[r][c] = 0; } soilCacheDirty = true; rebuildSoilCache(); ry = SURFACE_ROW + 10; }
    const lee = () => { const d = g.getImageData(cx * CELL, ry * CELL, CELL, CELL).data; let h = 0; for (let i = 0; i < d.length; i += 4) h = (h * 31 + d[i] + d[i + 1]) % 2147483647; return h; };
    const a = lee(); await new Promise(r => setTimeout(r, 2500)); const b = lee();
    return { ok: true, a, b, celda: cx + ',' + ry };
  });
  ok(quieta.ok && quieta.a === quieta.b, `una casilla de pared que nadie toca no cambia en 2,5 s de juego a x32: ${quieta.celda} firma ${quieta.a} = ${quieta.b}`);

  // ── F) el agua: overlay por cuadro, no invitado del cuadro del flash ──
  // Se mide con un BOLSILLO SELLADO (roca por los cuatro lados): el agua de verdad no se evapora abajo
  // (solo evapora en la fila del prado y con sol), asi que lo que se encharca a mano se queda encharcado
  // y la comparación entre los dos tratos es justa. En el intento anterior el agua se iba al fondo de la
  // galeria y los dos tratos llevaban agua: la resta salia ~0, que era un fallo del bote, no del juego.
  const agua = await page.evaluate(async () => {
    const ANCHO = 8, ALTO = 3;
    const c0 = Math.max(2, Math.min(COLS - ANCHO - 2, 38));
    const r0 = Math.max(SURFACE_ROW + 4, Math.min(ROWS - ALTO - 2, SURFACE_ROW + 13));
    const guarda = [];
    for (let r = r0 - 1; r <= r0 + ALTO; r++) for (let c = c0 - 1; c <= c0 + ANCHO; c++) { if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue; guarda.push([r, c, soil[r][c], soilType[r] && soilType[r][c]]); }
    // camara sellada por roca por los cuatro lados: el agua no puede irse y la medida es estable
    for (let r = r0; r < r0 + ALTO; r++) for (let c = c0; c < c0 + ANCHO; c++) {
      soil[r][c] = 0; if (soilType[r]) soilType[r][c] = 0; water[r][c] = 0.6;
    }
    soilCacheDirty = true; rebuildSoilCache();
    const cuentaAgua = () => { let n = 0; for (let r = SURFACE_ROW; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (water[r][c] > 0.08) n++; return n; };
    const cv = document.getElementById('farmCanvas'), ctx = cv.getContext('2d');
    const real = ctx.fillRect.bind(ctx);
    let n = 0, fase = 1, s1 = 0, c1 = 0, a1 = 0, s2 = 0, c2 = 0, a2 = 0;
    ctx.fillRect = function () { n++; return real.apply(ctx, arguments); };   // solo vale como contador
    const raf = window.requestAnimationFrame.bind(window);
    const tick = () => {
      if (fase === 1) { c1++; s1 += n; a1 += cuentaAgua(); } else { c2++; s2 += n; a2 += cuentaAgua(); }
      n = 0;
      if (c1 + c2 < 220) raf(tick);
    };
    raf(tick);
    await new Promise(r => setTimeout(r, 2600));
    fase = 2;
    for (let r = SURFACE_ROW; r < ROWS; r++) for (let c = 0; c < COLS; c++) water[r][c] = 0;   // TODO seco
    await new Promise(r => setTimeout(r, 2600));
    ctx.fillRect = real;
    for (const q of guarda) { soil[q[0]][q[1]] = q[2]; if (soilType[q[0]]) soilType[q[0]][q[1]] = q[3]; }
    soilCacheDirty = true; rebuildSoilCache();
    return { conAgua: +(s1 / (c1 || 1)).toFixed(1), sinAgua: +(s2 / (c2 || 1)).toFixed(1),
      casillas: +(a1 / (c1 || 1)).toFixed(1), casillas2: +(a2 / (c2 || 1)).toFixed(1), cuadros1: c1, cuadros2: c2 };
  });
  console.log(`  (rectangulos por cuadro: con agua ${agua.conAgua} en ${agua.cuadros1} cuadros · seco ${agua.sinAgua} en ${agua.cuadros2} · media de casillas inundadas ${agua.casillas} -> ${agua.casillas2})`);
  ok(agua.casillas >= 2 && agua.casillas2 === 0, `el charco estaba ahi durante el trato primero y no en el segundo: ${agua.casillas} casillas con agua -> ${agua.casillas2}`);
  ok(agua.conAgua - agua.sinAgua > agua.casillas * 1.5, `el agua se pinta TODOS los cuadros, no solo cuando habia repintado pendiente: +${(agua.conAgua - agua.sinAgua).toFixed(1)} rellenos por cuadro con ${agua.casillas} casillas inundadas`);
  ok(agua.sinAgua > 100, `y la resta compara dos cuadros PINTADOS los dos (seco se siguen dibujando ${agua.sinAgua} rellenos por cuadro)`);

  ok(errs.length === 0, `cero errores de JavaScript en toda la prueba · ${errs.length ? errs[0] : 'nada en consola'}`);

  console.log(`\n${pass} ok · ${failn} FALLOS\n`);
  await browser.close(); server.close();
  process.exit(failn ? 1 : 0);
})();
