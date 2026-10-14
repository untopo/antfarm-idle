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
    await page.screenshot({ path: 'screenshots/01-menu.png' });

    const visible = sel => page.evaluate(s => { const e = document.querySelector(s); if (!e) return 'no-existe'; const r = e.getBoundingClientRect(); const st = getComputedStyle(e); return (st.display !== 'none' && st.visibility !== 'hidden' && r.width > 4) ? 'visible' : 'oculto'; }, sel);
    ok((await visible('#mainMenu')) === 'visible', 'el menu principal se muestra (splash no se queda pegado)');

    await page.click('#btnMainCreate');
    await sleep(320);
    ok((await visible('#createSizeScreen')) === 'visible', 'click en CREAR NUEVA GRANJA abre la pantalla de tamanos');
    await page.screenshot({ path: 'screenshots/02-tamanos.png' });

    const before = await page.evaluate(() => ({ cols: window.COLS, rows: window.ROWS }));
    await page.click('#createSizeScreen [data-size="big"]');
    await sleep(260);
    // si ya habia granja guardada, el juego pregunta antes de sobrescribir: responder SÍ
    const pregunta = await page.evaluate(() => { const h = document.querySelector('.topo-dialog-host'); if (!h) return null; const b = [...h.querySelectorAll('button')].find(x => x.textContent.trim() === 'SÍ'); const txt = h.textContent.slice(0, 90); if (b) b.click(); return txt; });
    if (pregunta) console.log('   dialogo de sobrescritura detectado y confirmado: ' + pregunta.replace(/\s+/g, ' '));
    await page.screenshot({ path: 'screenshots/03b-post-confirmar.png' });
    const genState = await visible('#worldGenScreen');
    ok(genState === 'visible', 'la barra de siembra aparece al elegir BIG (' + genState + ')');
    await page.screenshot({ path: 'screenshots/03-sembrando.png' });

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
    await page.screenshot({ path: 'screenshots/04-mundo-big.png' });
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
    await page.screenshot({ path: 'screenshots/05-recarga.png' });

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
      await page2.screenshot({ path: 'screenshots/06-iframe-tamanos.png' });
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
      await page2.screenshot({ path: 'screenshots/07-iframe-mundo.png' });
    }
    if (blocked2.length) console.log('   avisos del navegador sobre dialogos: ' + blocked2.slice(0, 2).join(' | '));
  } finally {
    if (!process.env.KEEP) await browser.close();
    server.close();
  }
  console.log('');
  console.log(pass + ' ok' + (failn ? ' · ' + failn + ' FALLOS' : ' · navegador real conforme'));
  console.log('capturas en screenshots/');
  process.exit(failn ? 1 : 0);
})().catch(e => { console.log('FALLO EL HARNESS: ' + e.message); try { server.close(); } catch (_) { } process.exit(1); });
