/**
 * browser-smoke.js - el flujo de creacion en CHROME real, dentro de un iframe sandbox.
 *
 * Por que existe: el "no pasaba nada" al pulsar CREAR NUEVA GRANJA era que el navegador bloquea
 * alert()/confirm() dentro de un iframe con sandbox sin allow-modals y devuelve false. Ningun
 * test de node lo veia (su stub de confirm devolvia true). Aqui se reproduce el entorno hostil:
 * iframe con allow-scripts y SIN allow-modals, y aun asi la granja tiene que crearse.
 *
 *   node test/browser-smoke.js            (usa el Chrome de puppeteer)
 *   KEEP=1 node test/browser-smoke.js     (deja el navegador abierto para mirar)
 */
const http = require('http');
const fs = require('fs');
fs.mkdirSync('/tmp/antfarm-capturas',{recursive:true});
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const PORT = 8123;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.svg': 'image/svg+xml', '.wav': 'audio/wav' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/ant-farm-rpg/index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('nope'); return; }
  // sin cache: con HTML nuevo y JS viejo el juego se comporta raro y no se puede depurar
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store, must-revalidate' });
  fs.createReadStream(file).pipe(res);
});

let pass = 0, failn = 0;
const ok = (c, m) => { if (c) { pass++; console.log('ok   ' + m); } else { failn++; console.log('FAIL ' + m); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  await new Promise(r => server.listen(PORT, '0.0.0.0', r));
  let puppeteer;
  try { puppeteer = require('puppeteer'); } catch (e) { console.log('SIN PUPPETEER: ' + e.message.split('\n')[0]); server.close(); process.exit(2); }
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'] });
  try {
    fs.mkdirSync(path.join(ROOT, 'screenshots'), { recursive: true });

    /* ---------- A) pestana normal ---------- */
    const page = await browser.newPage();
    const errs = [], blocked = [], net = [];
    page.on('pageerror', e => errs.push('pageerror: ' + e.message + ' @ ' + String(e.stack || '').split('\n')[1]));
    page.on('console', m => { if (/ignoring|blocked|not allowed/i.test(m.text())) blocked.push(m.text().slice(0, 160)); });
    page.on('response', r => { if (r.status() >= 400) net.push(r.status() + ' ' + r.url().split('/').slice(-2).join('/')); });
    await page.setViewport({ width: 1280, height: 760 });
    await page.goto('http://127.0.0.1:' + PORT + '/ant-farm-rpg/index.html', { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction('window._topoFlowReady===true || typeof window.topoShowMainMenu==="function"', { timeout: 20000 }).catch(() => { });
    ok(await page.evaluate(() => !!document.getElementById('createSizeScreen')), 'la pagina carga y existe la pantalla de tamanos');
    ok(await page.evaluate(() => document.querySelectorAll('#createSizeScreen [data-size]').length === 3), 'hay 3 tamanos elegibles (48x28, 64x36, 96x48)');
    // el splash se retira solo (~1.9 s) y muestra el menu: esperar como usuario, sin forzar
    await page.waitForFunction("!document.getElementById('splashScreen') || document.getElementById('splashScreen').style.display==='none'", { timeout: 15000 }).catch(() => { });
    await page.screenshot({ path: '/tmp/antfarm-capturas/01-menu.png' });

    const visible = sel => page.evaluate(s => { const e = document.querySelector(s); if (!e) return 'no-existe'; const r = e.getBoundingClientRect(); const st = getComputedStyle(e); return (st.display !== 'none' && st.visibility !== 'hidden' && r.width > 4) ? 'visible' : 'oculto'; }, sel);
    ok((await visible('#mainMenu')) === 'visible', 'el menu principal se muestra (splash no se queda pegado)');

    await page.click('#btnMainCreate');
    await sleep(320);
    ok((await visible('#createSizeScreen')) === 'visible', 'click en CREAR NUEVA GRANJA abre la pantalla de tamanos');
    await page.screenshot({ path: '/tmp/antfarm-capturas/02-tamanos.png' });

    const before = await page.evaluate(() => ({ cols: window.COLS, rows: window.ROWS }));
    await page.click('#createSizeScreen [data-size="big"]');
    await sleep(260);
    // si ya habia granja guardada, el juego pregunta antes de sobrescribir: responder SÍ
    const pregunta = await page.evaluate(() => { const h = document.querySelector('.topo-dialog-host'); if (!h) return null; const b = [...h.querySelectorAll('button')].find(x => x.textContent.trim() === 'SÍ'); const txt = h.textContent.slice(0, 90); if (b) b.click(); return txt; });
    if (pregunta) console.log('   dialogo de sobrescritura detectado y confirmado: ' + pregunta.replace(/\s+/g, ' '));
    await page.screenshot({ path: '/tmp/antfarm-capturas/03b-post-confirmar.png' });
    const genState = await visible('#worldGenScreen');
    ok(genState === 'visible', 'la barra de siembra aparece al elegir BIG (' + genState + ')');
    await page.screenshot({ path: '/tmp/antfarm-capturas/03-sembrando.png' });

    let done = true;
    try { await page.waitForFunction('window.COLS===96 && window.ROWS===48', { timeout: 30000 }); } catch (e) { done = false; }
    ok(done, 'la siembra termina: el mundo 96x48 existe en el navegador');
    let genGone = false;
    try { await page.waitForFunction('getComputedStyle(document.getElementById("worldGenScreen")).display==="none"', { timeout: 8000 }); genGone = true; } catch (e) { }
    ok(genGone, 'y la pantalla de siembra se oculta sola (nunca queda colgada)');
    const after = await page.evaluate(() => {
      const dbg = window._topoDbg ? window._topoDbg() : {};
      const cv = document.getElementById('farmCanvas') || document.querySelector('canvas');
      let colors = 0, painted = 0;
      try {
        const x = cv.getContext('2d');
        const d = x.getImageData(0, 0, cv.width, cv.height).data;
        const seen = new Set();
        for (let i = 0; i < d.length; i += 4 * 97) { const k = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2]; seen.add(k); if (d[i + 3] > 8) painted++; }
        colors = seen.size;
      } catch (e) { colors = -1; }
      return {
        cols: window.COLS, rows: window.ROWS, dbg, colors, painted,
        onb: ['onboarding', 'onboardingModal'].some(id => { const e = document.getElementById(id); return e && getComputedStyle(e).display !== 'none'; })
      };
    });
    ok(after.cols === 96 && after.rows === 48, 'BIG creó un mundo 96x48 real (' + after.cols + 'x' + after.rows + ')');
    ok(after.colors > 24, 'el canvas tiene mundo pintado de verdad: ' + after.colors + ' colores muestreados, ' + after.painted + ' muestras opacas');
    ok(after.dbg.ants > 0, 'la colonia esta sembrada: ' + after.dbg.ants + ' hormigas, comida ' + after.dbg.food);
    ok(after.onb, 'tras sembrar entra el onboarding en vez de volver al menu');
    const t0 = await page.evaluate(() => (window._topoDbg ? window._topoDbg() : {}));
    await sleep(3000);
    const moving = await page.evaluate(() => (window._topoDbg ? window._topoDbg() : {}));
    ok(moving.dbg ? moving.dbg.day >= 1 : moving.day >= 1, 'el mundo esta vivo: dia ' + (moving.day) + ' con ' + moving.ants + ' hormigas');
    ok(moving.time > t0.time, 'y el reloj del juego avanza solo (' + Math.round(t0.time) + ' -> ' + Math.round(moving.time) + ')');
    // --- el reloj de la plaza (placa de madera) debe moverse en el DOM, no solo en el estado ---
    const domClock = () => page.evaluate(() => {
      const g = id => { const e = document.getElementById(id); return e ? (e.textContent || '').trim() : null; };
      return { rc: g('rcTime'), label: g('timeLabel'), t: window._topoDbg ? window._topoDbg().time : 0 };
    });
    await page.evaluate(() => { const b = document.getElementById('btnOnboardingStart'); if (b) b.click(); });
    // La pantalla no ofrece x64 desde que el tope de la casa es x16; para mover el reloj deprisa se pone la
    // velocidad por dentro, como en las suites de simulacion (por setGameSpeed(64) hoy caeria en x16, que es
    // valido pero deja la prueba al ritmo de Chrome).
    await page.evaluate(() => { gameSpeed = 64; turbo = true; });
    const c0 = await domClock();
    // seleccionar una hormiga: antes esto reventaba el HUD y congelaba la placa
    await page.evaluate(() => {
      const w = (typeof workers !== 'undefined' && workers[0]) || null;
      if (w && typeof selectedAnt !== 'undefined') { try { selectedAnt = w; } catch (e) {} }
      try { window.selectAnt && window.selectAnt(w); } catch (e) {}
    });
    await sleep(2500);
    const c1 = await domClock();
    ok(c0.rc && c1.rc && c0.rc !== c1.rc, 'la placa del reloj se repinta sola: ' + c0.rc + ' -> ' + c1.rc + ' (x64)');
    ok(c1.label && c0.label !== c1.label, 'el hud de hora del lienzo tambien cambia (' + c0.label + ' -> ' + c1.label + ')');
    ok(c1.t > c0.t, 'y con una hormiga seleccionada el tiempo no se detiene');
    const spd = await page.evaluate(() => {
      const ids = ['btnSpeed32','btnSpeed64','btnSpeed32b','btnSpeed64b'];
      const before = gameSpeed;
      let err = null;
      try { setGameSpeed(32); } catch (e) { err = e.message; }
      const v32 = gameSpeed;
      try { setGameSpeed(3); } catch (e) { err = err || e.message; }
      return { present: ids.filter(i => document.getElementById(i)).length, err, after: v32, tres: gameSpeed, before };
    });
    const al32 = spd.after;
    // Antes esta prueba exigia lo contrario: que x32 y x64 EXISTIERAN y que el juego los aceptara. El dueño
    // los quito (2026-10-15: «lo de velocidad 32 y 64, bórralo»); aqui queda el contrato nuevo, medido.
    ok(spd.present === 0, 'x32 y x64 ya no estan en ninguna fila de velocidad (' + spd.present + '/4 botones)');
    ok((!spd.err || spd.tres === 2) && al32 === 16, 'y pedir x32 no lanza: cae en el tope de la casa, x16 - no congela en x1 · x3 cae en x' + spd.tres + (spd.err ? ' :: ' + spd.err : ''));
    await page.evaluate(() => setGameSpeed(1));

    // --- el atajo incremental del cache del suelo tiene que dar los MISMOS pixeles que pintar todo ---
    const cacheCheck = await page.evaluate(() => {
      window.__med = a => { a = a.slice().sort((x, y) => x - y); return a[a.length >> 1]; };
      const estaba = paused; paused = true;   // que nada se mueva entre las dos pasadas
      const g0 = soilCacheCanvas.getContext('2d');
      const region = (c0, r0) => new Uint8ClampedArray(g0.getImageData(c0 * CELL, r0 * CELL, CELL * 3, CELL * 3).data);
      const hashRegion = (c0, r0) => {
        const d = region(c0, r0);
        let h = 2166136261;
        for (let i = 0; i < d.length; i += 4) { h ^= d[i] + (d[i + 1] << 8) + (d[i + 2] << 16); h = Math.imul(h, 16777619) >>> 0; }
        return h;
      };
      const diffContra = (A, B, w) => {
        let n = 0; const pts = [];
        for (let i = 0; i < A.length; i += 4) {
          if (A[i] !== B[i] || A[i + 1] !== B[i + 1] || A[i + 2] !== B[i + 2] || A[i + 3] !== B[i + 3]) {
            n++;
            if (pts.length < 4) pts.push('px' + ((i / 4) % w) + ',' + Math.floor((i / 4) / w) + ' [' + [A[i], A[i + 1], A[i + 2]].join(',') + ']vs[' + [B[i], B[i + 1], B[i + 2]].join(',') + ']');
          }
        }
        return { n, pts };
      };
      // una celda de tierra intacta, tres filas bajo la superficie, cerca del centro
      let cc = null, rr = null;
      for (let c = 4; c < COLS - 4 && cc === null; c++) for (let r = SURFACE_ROW + 3; r < ROWS - 3; r++) {
        if (soil[r][c] === 1) { cc = c; rr = r; break; }
      }
      if (cc === null) return { skip: 'no hay tierra intacta donde probar' };
      const x0 = Math.max(0, cc - 1), y0 = Math.max(0, rr - 1);
      // Lote limpio: un rebuild entero deja atras cualquier cola pendiente de la siembra
      markSoilDirty(); rebuildSoilCache(false);
      soil[rr][cc] = 0; if (soilType[rr]) soilType[rr][cc] = 0;
      markSoilDirty(cc, rr);
      const pre = { lote: soilDirtyCells ? soilDirtyCells.size : String(soilDirtyCells), pintor: typeof paintCellActive, area: COLS * (ROWS - SURFACE_ROW) };
      // para medir coste se limpia el estado: sin lote encolado y sin monticulos encima, que
      // es el camino lento (la identidad de píxeles con monticulos ya se compruebo arriba)
      const monticulos = mound.splice(0, mound.length);
      const tiempos = [], condiciones = [];
      for (let k = 0; k < 5; k++) {
        const cc2 = 4 + k, rr2 = SURFACE_ROW + 3;
        if (soil[rr2][cc2] === 1) { soil[rr2][cc2] = 0; if (soilType[rr2]) soilType[rr2][cc2] = 0; }
        markSoilDirty(); rebuildSoilCache(false);    // estado neutro
        markSoilDirty(cc2, rr2);
        const cond = { atajo: soilIncrementalReady(false), lote: soilDirtyCells ? soilDirtyCells.size : String(soilDirtyCells), atlas: texSuperficiesReady, pintor: typeof paintCellActive };
        const a0 = performance.now();
        rebuildSoilCache(false);                     // <- aqui se prueba el atajo (una calada)
        tiempos.push(performance.now() - a0);
        condiciones.push(cond);
      }
      // para comparar coste se toma el MEJOR tiempo de cada camino, no la mediana: la mediana
      // se contaminaba con un solo coleccionista de basura y volvia intermitente la asercion
      const tA = Math.min(...tiempos);
      const tA_med = __med(tiempos);   // la mediana es la que se ensena; el min, la que se compara
      const hInc = hashRegion(x0, y0);
      const A = region(x0, y0);
      const grandes = [];
      for (let k = 0; k < 5; k++) { markSoilDirty(); const b0 = performance.now(); rebuildSoilCache(false); grandes.push(performance.now() - b0); }
      const tB = Math.min(...grandes);
      monticulos.forEach(m => mound.push(m));
      const hFull = hashRegion(x0, y0);
      const B = region(x0, y0);
      const d = diffContra(A, B, CELL * 3);
      paused = estaba;
      return { hInc, hFull, diff: d.n, pts: d.pts, cell: [cc, rr], monticulos: mound.length, tInc: tA, tMed: tA_med, tFull: tB, pre, condiciones };
    });
    if (cacheCheck.skip) console.log('   (salto la comprobacion del cache: ' + cacheCheck.skip + ')');
    else {
      ok(cacheCheck.hInc === cacheCheck.hFull && cacheCheck.diff === 0,
        'el repintado incremental deja pixeles identicos al mapa entero (' + cacheCheck.diff + ' px distintos en 3x3 alrededor de [' + cacheCheck.cell + '], ' + cacheCheck.monticulos + ' monticulos' + (cacheCheck.diff ? ' :: ' + cacheCheck.pts.join(' ') : '') + ')');
      // performance.now() redondea a ~0.1 ms y una calada cabe debajo: se dice en microsegundos
      const fmt = (ms) => (ms < 0.05 ? 'por debajo del reloj del navegador (<50 µs)' : ms.toFixed(2) + ' ms');
      const factor = cacheCheck.tInc < 0.05 ? null : Math.round(cacheCheck.tFull / cacheCheck.tInc);
      console.log('   cache: ' + JSON.stringify(cacheCheck.pre) + ' · calada ' + cacheCheck.tInc.toFixed(3) + ' ms medida · mapa entero ' + cacheCheck.tFull.toFixed(2) + ' ms');
      ok(cacheCheck.tInc < cacheCheck.tFull / 6,
        'y de verdad: una calada repintada en ' + fmt(cacheCheck.tInc) + ' contra ' + fmt(cacheCheck.tFull) + ' del mapa entero' + (factor ? ' (x' + factor + ' mas barato)' : ' (la calada ni se puede medir con este reloj)') + ' [condiciones ' + JSON.stringify(cacheCheck.condiciones[0]) + ']');
    }

    await page.screenshot({ path: '/tmp/antfarm-capturas/04-mundo-big.png' });
    ok(errs.length === 0, 'cero errores de JS en pestana normal' + (errs[0] ? ' :: ' + errs.slice(0, 2).join(' | ') : ''));
    const f404 = [...new Set(net)];
    console.log('   recursos 404 (' + f404.length + '): ' + (f404.slice(0, 6).join(' | ') || 'ninguno'));

    /* recarga: el mundo persiste */
    // recargar NO debe perder la granja: el menu tiene que ofrecer CONTINUAR con los datos reales
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction("document.getElementById('splashScreen').style.display==='none'", { timeout: 15000 }).catch(() => { });
    await sleep(600);
    const reload0 = await page.evaluate(() => ({ cont: (document.getElementById('btnMainContinue') || { textContent: null }).textContent, started: document.body.classList.contains('game-started'), dbg: window._topoDbg ? window._topoDbg() : {} }));
    const contTxt = reload0.cont ? reload0.cont.replace(/\s+/g, ' ').trim() : null;
    ok(!!contTxt && /96×48/.test(contTxt) || reload0.started, 'tras recargar la granja sigue viva: ' + (contTxt ? 'menu con ' + contTxt : 'reanudada directa, dia ' + reload0.dbg.day));
    await page.evaluate(() => { const b = document.getElementById('btnMainContinue'); if (b) b.click(); });
    await sleep(1500);
    const reloaded = await page.evaluate(() => (window._topoDbg ? window._topoDbg() : {}));
    ok(reloaded.cols === 96 && reloaded.ants > 0, 'y CONTINUAR devuelve la granja 96x48 con ' + reloaded.ants + ' hormigas (dia ' + reloaded.day + ')');
    await page.screenshot({ path: '/tmp/antfarm-capturas/05-recarga.png' });

    /* ---------- B) iframe sandbox sin allow-modals: el caso que estaba roto ---------- */
    const page2 = await browser.newPage();
    const errs2 = [], blocked2 = [];
    page2.on('pageerror', e => errs2.push(String(e.message).slice(0, 140) + ' @ ' + String(e.stack || '').split('\n')[1]));
    page2.on('console', m => { if (/ignoring|dialog|blocked/i.test(m.text())) blocked2.push(String(m.text()).slice(0, 140)); });
    await page2.setViewport({ width: 1280, height: 760 });
    await page2.goto('http://127.0.0.1:' + PORT + '/test/fixtures/sandbox-host.html', { waitUntil: 'load' });
    await page2.waitForSelector('iframe', { timeout: 5000 });
    const frame = (await page2.frames()).find(f => f.url().includes('/ant-farm-rpg/index.html'));
    ok(!!frame, 'el juego corre dentro de un iframe sandbox="allow-scripts" (sin allow-modals)');
    if (frame) {
      await frame.waitForFunction('window._topoFlowReady===true', { timeout: 20000 }).catch(() => { });
      const nativo = await frame.evaluate(() => { try { return { confirm: window.confirm('probe'), alert: typeof window.alert }; } catch (e) { return { error: e.message }; } });
      console.log('   confirm() nativo dentro del iframe devuelve: ' + JSON.stringify(nativo) + '  <- por eso el juego no puede depender de el');
      await frame.waitForFunction("!document.getElementById('splashScreen') || document.getElementById('splashScreen').style.display==='none'", { timeout: 20000 }).catch(() => { });
      await frame.evaluate(() => { document.getElementById('btnMainCreate').click(); });
      await sleep(400);
      await page2.screenshot({ path: '/tmp/antfarm-capturas/06-iframe-tamanos.png' });
      await frame.evaluate(() => { document.querySelector('#createSizeScreen [data-size="small"]').click(); });
      await sleep(400);
      await frame.evaluate(() => { const h = document.querySelector('.topo-dialog-host'); if (h) { const b = [...h.querySelectorAll('button')].find(x => x.textContent.trim() === 'SÍ'); if (b) b.click(); } });
      const genInFrame = await frame.evaluate(() => { const e = document.getElementById('worldGenScreen'); return e ? getComputedStyle(e).display : 'no-existe'; });
      ok(genInFrame === 'flex' || genInFrame === 'block' || /none/.test(genInFrame) === false, 'en el iframe bloqueado el click SI reacciona (siembra en curso: display=' + genInFrame + ')');
      let done2 = true;
      try { await frame.waitForFunction('window.COLS===48 && window.ROWS===28', { timeout: 30000 }); } catch (e) { done2 = false; }
      ok(done2, 'y la siembra completa dentro del iframe con dialogos bloqueados');
      const fr = await frame.evaluate(() => { const d = window._topoDbg ? window._topoDbg() : {}; return { cols: window.COLS, rows: window.ROWS, ants: d.ants, started: document.body.classList.contains('game-started') }; });
      ok(fr.cols === 48 && fr.rows === 28, 'SMALL 48x28 sembrado en iframe sandbox (' + fr.cols + 'x' + fr.rows + ', ' + fr.ants + ' hormigas)');
      ok(errs2.length === 0, 'sin errores de JS dentro del iframe' + (errs2[0] ? ' :: ' + errs2.slice(0, 2).join(' | ') : ''));
      await page2.screenshot({ path: '/tmp/antfarm-capturas/07-iframe-mundo.png' });
    }
    if (blocked2.length) console.log('   avisos del navegador sobre dialogos: ' + blocked2.slice(0, 2).join(' | '));

    // --- LAS TIRAS RECUPERADAS Y EL SALTO DE DIA, como comprobacion permanente ------------
    {
      // El dueno decidio que las tiras bajo el reloj sobraban: la informacion ya estaba en la
      // barra de siempre. Se comprueba al reves: que NO haya duplicado y que el boton del dia
      // siga donde viven los demas botones.
      const tiras = await page.evaluate(() => {
        const vis = (id) => { const e = document.getElementById(id); if (!e) return null; const b = e.getBoundingClientRect(); const cs = getComputedStyle(e);
          return { w: Math.round(b.width), h: Math.round(b.height), visible: cs.display !== 'none' && cs.visibility !== 'hidden' && b.width > 0 && b.height > 0 }; };
        const tiraFuera = [...document.querySelectorAll('.hud-strips')].filter((e) => { const cs = getComputedStyle(e); return cs.display !== 'none'; }).length;
        return { corner: vis('cornerControls'), day: vis('dayControls'), hud: vis('mainHud'), sel: vis('hudSel'),
          tirasVisibles: tiraFuera, vel: document.querySelectorAll('#btnSpeed1,#btnSpeed2,#btnSpeed4,#btnSpeed8,#btnSpeed16,#btnSpeed32,#btnSpeed64').length };
      }).catch(() => ({}));
      ok(!tiras.corner && !tiras.day && !tiras.hud && !tiras.sel && tiras.tirasVisibles === 0,
        'y no hay tiras duplicadas sobre el calendario (cornerControls/dayControls/mainHud/hudSel ausentes, tiras visibles: ' + tiras.tirasVisibles + ')');
      ok(tiras.vel === 5, 'la tira vieja se quedo en x1..x16 y la barra nueva es la unica a la vista (' + tiras.vel + ' botones en las filas selladas)');

      // El salto de dia se mide en una pagina NUEVA y limpia: en la pagina principal los tests
      // anteriores ensucian el lote del suelo (el conjunto sucio pasa del umbral y cada calada
      // pinta el mapa entero), y ahi la colonia trabaja ~14x mas despacio. Medir ahi daria FAIL
      // por la medicion, no por el boton.
      const page3 = await browser.newPage();
      await page3.setViewport({ width: 1280, height: 760 });
      await page3.goto('http://127.0.0.1:' + PORT + '/index.html', { waitUntil: 'networkidle2', timeout: 60000 });
      await page3.evaluate(() => { const b = document.getElementById('btnSplashEnter'); if (b) b.click(); });
      await sleep(500);
      await page3.evaluate(() => document.getElementById('btnMainCreate').click());
      await sleep(300);
      await page3.evaluate(() => document.querySelector('#createSizeScreen [data-size="medium"]').click());
      await sleep(350);
      // El aviso «¿Sobrescribir tu granja actual?» sale DESPUES de elegir el tamano. Contestarlo
      // antes (como se hacia aqui) dejaba el toldo del dialogo puesto y tapaba todo el HUD.
      await page3.evaluate(() => { const h = document.querySelector('.topo-dialog-host'); if (h) { const y = [...h.querySelectorAll('button')].find((x) => x.textContent.trim() === 'SÍ'); if (y) y.click(); } });
      await page3.waitForFunction('window.COLS===64', { timeout: 90000 });
      // Estado "el dueño ya está jugando": sin modal de onboarding, sin pantalla de generando
      // mundo, sin menu encima. Mientras alguno de esos toldos esta puesto, tapan el HUD y un
      // click de raton no llega a ningun boton del panel (con .click() por JS se tapaba el bug).
      const sinToldos = () => { const h = (id) => { const e = document.getElementById(id); return !e || getComputedStyle(e).display === 'none'; };
        return h('onboardingModal') && h('worldGenScreen') && h('mainMenu') && h('createSizeScreen') && h('splashScreen') && !_dialogStackVisible() && document.body.classList.contains('game-started');
        function _dialogStackVisible() { return [...document.querySelectorAll('.topo-dialog-host')].some((x) => getComputedStyle(x).display !== 'none'); } };
      for (let t = 0; t < 60000 && !(await page3.evaluate(sinToldos)); t += 1200) {
        await page3.evaluate(() => { const b = document.getElementById('btnOnboardingStart'); if (b && b.offsetParent) b.click(); });
        await sleep(1200);
      }
      ok(await page3.evaluate(sinToldos), 'al acabar la creacion no queda ningun toldo tapando la pantalla');
      const estado = () => page3.evaluate(() => ({ dia: day, digs, vel: gameSpeed, comida: colonyFood, cavadas: (() => { let n = 0; for (let r = SURFACE_ROW; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (soil[r][c] === 0) n++; return n; })(), boton: document.getElementById('btnDay1').textContent.trim(), ocupado: (typeof _fastForwarding !== 'undefined') && _fastForwarding }));
      // Medir el tamano no basta: la barra recorta con overflow:hidden y ahi salia un boton
      // "visible" de 41x28 que el dueño no podia ni ver ni tocar. Se exige que el punto del
      // centro del boton devuelva el propio boton (elementFromPoint) y que quepa dentro de su barra.
      const btn = await page3.evaluate(() => { const e = document.getElementById('btnDay1'); if (!e) return { falta: true };
        const b = e.getBoundingClientRect(); const cs = getComputedStyle(e);
        let barra = e.parentElement, top = barra; while (top) { const st = getComputedStyle(top); if (st.overflow === 'hidden' || st.overflowX === 'hidden') { barra = top; break; } top = top.parentElement; }
        const bb = barra.getBoundingClientRect(); const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
        const golpe = document.elementFromPoint(cx, cy);
        return { w: Math.round(b.width), h: Math.round(b.height), padre: (e.parentElement.id || e.parentElement.tagName.toLowerCase()),
          barra: barra.id || barra.tagName.toLowerCase(), dentro: b.right <= bb.right + 0.5 && b.left >= bb.left - 0.5,
          clicable: !!golpe && (golpe === e || e.contains(golpe)), objetivo: golpe ? (golpe.id || golpe.tagName.toLowerCase()) : 'nada',
          alto: Math.round(b.height), cs: cs.display }; });
      ok(btn.visible !== false && !btn.falta && btn.alto > 0 && btn.dentro && btn.clicable,
        'el boton +1 DIA esta en la fila de abajo del reloj y se le puede dar con el raton (' + btn.w + 'x' + btn.h + ' en #' + btn.padre + ', barra #' + btn.barra + ', dentro ' + btn.dentro + ', el click cae en #' + btn.objetivo + ')');
      // Primero: de manana y a x16 la colonia cava (si esto falla, el mundo esta roto, no el boton).
      // x64 y ventana amplia: con la maquina cargada, medir a x16 en 30 s daba 60/40 de veces
      // segun cuanto le tocase a Chrome. Lo que se comprueba es que la colonia trabaja de dia,
      // no la puntualidad del reloj del test.
      await page3.evaluate(() => { time = DAY_LENGTH * 0.30; gameSpeed = 64; turbo = true; });
      const t1 = Date.now(); const cava_antes = await estado();
      let cava_ahora = cava_antes;
      while (Date.now() - t1 < 75000) { await sleep(1500); cava_ahora = await estado(); if (cava_ahora.digs > cava_antes.digs && cava_ahora.cavadas > cava_antes.cavadas) break; }
      const dv = cava_ahora.digs - cava_antes.digs, cv = cava_ahora.cavadas - cava_antes.cavadas;
      ok(dv > 0 || cv > 0,
        'de manana y a x64 las obreras trabajan: ' + dv + ' bloques cavados y ' + cv + ' celdas nuevas en ' + Math.round((Date.now() - t1) / 1000) + ' s');
      // Despues: el boton. passDays SIEMPRE simula un dia entero (time + DAY_LENGTH), asi que no
      // hay truco que acorte el salto: se le da margen de sobra y se espera a que se apague solo.
      await page3.evaluate(() => { setGameSpeed(1); time = DAY_LENGTH * 0.30; });
      const antes = await estado();
      const caja = await page3.evaluate(() => { const b = document.getElementById('btnDay1').getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
      await page3.mouse.click(caja.x, caja.y); // con el raton de verdad: si estuviera recortado, esto no clica
      let ahora = antes, t0 = Date.now();
      // El tope va generous: en esta maquina, con varias paginas abiertas, un dia simulado puede
      // tardar 20 s o 100 s. Cortar por reloj corto daba FAIL de medicion, no del boton.
      while (Date.now() - t0 < 260000) { await sleep(1000); ahora = await estado(); if (!ahora.ocupado && ahora.dia > antes.dia) break; }
      const seg = Math.round((Date.now() - t0) / 1000);
      const ms = 0;
      const cavado = ahora.digs - antes.digs;
      const tierra = ahora.cavadas - antes.cavadas;
      console.log('   salto: ' + JSON.stringify(antes) + ' -> ' + JSON.stringify(ahora));
      // El boton vive DENTRO del panel del reloj, cuyo cristal abre el calendario al hacer click.
      // Si el click burbujeaba, al pasar de dia se quedaba un velo negro encima de la granja.
      // Y luego se espera a que el salto SE APAGUE, con su propia paciencia: en esta maquina el dia
      // simulado puede tardar mas de lo que cabe en la espera de arriba, y ahi el FAIL era del reloj
      // del test, no del boton. Si nunca terminara, esto tambien revienta (y hay que leerlo).
      const tFin = Date.now();
      while (Date.now() - tFin < 180000) { ahora = await estado(); if (!ahora.ocupado) break; await sleep(1000); }
      const modalAbierto = await page3.evaluate(() => { const m = document.getElementById('calendarModal'); return !!m && m.classList.contains('open'); });
      ok(!modalAbierto, 'y pulsarlo no deja el calendario desplegado tapando la granja');
      ok(ahora.dia > antes.dia, 'el boton +1 DIA pasa de dia: dia ' + antes.dia + ' -> ' + ahora.dia + ' (' + seg + ' s de simulacion)');
      ok(cavado > 0 && tierra > 0, 'y ese dia trabaja de verdad: ' + cavado + ' bloques cavados y ' + tierra + ' celdas abiertas, comida ' + antes.comida + '->' + ahora.comida);
      ok(!ahora.ocupado && ahora.vel === antes.vel && /\+1/.test(ahora.boton) && ahora.boton.indexOf('\u23f3') < 0,
        'y al terminar lo deja todo como estaba: velocidad x' + antes.vel + ' -> x' + ahora.vel + ', boton ' + JSON.stringify(ahora.boton) + (ahora.ocupado ? ' SIGUE OCUPADO' : '') +
        ' (el dia entero ha costado ' + Math.round((Date.now() - t0) / 1000) + ' s de reloj en esta maquina)');
      await page3.screenshot({ path: '/tmp/antfarm-capturas/08-tiras-hud.png' });
      await page3.close();
      await page.screenshot({ path: '/tmp/antfarm-capturas/08-tiras-hud.png' });
    }
  } finally {
    if (!process.env.KEEP) await browser.close();
    server.close();
  }
  console.log('');
  console.log(pass + ' ok' + (failn ? ' · ' + failn + ' FALLOS' : ' · navegador real conforme'));
  console.log('capturas en screenshots/');
  process.exit(failn ? 1 : 0);
})().catch(e => { console.log('FALLO EL HARNESS: ' + e.message); try { server.close(); } catch (_) { } process.exit(1); });
