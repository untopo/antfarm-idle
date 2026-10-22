/**
 * vel-barra-unica.js - la unica velocidad que se ofrece es la de la barra viva, y su tope es x16.
 *
 * El dueño: «lo de velocidad 32 y 64, bórralo». Los cuatro botones (x32 y x64 en la tira vieja del
 * `header` y x32b/x64b en la `.farm-top`) NO estaban muertos: el bucle de `app.js` los cablagea por
 * patron de id (`/^(btnSpeed|btnVel|btnCorner)(\d+)(b?)$/`), asi que respondian... a nadie, porque las
 * dos tiras enteras estan selladas por la regla `header, .ai-pane, .taskbar, .farm-top{display:none
 * !important}` («MODO SOLO COLONIA»). Se borran del markup y de `SPEED_STEPS`, y con eso el boton turbo
 * tampoco puede ciclar a ellos. La barra de arriba a la derecha (`#velAntBar`, x1..x16) es la puerta.
 *
 * Se comprueba en CHROME real, y en los dos sentidos:
 *   - que x32 y x64 no existen ni en el markup ni en los pasos de velocidad;
 *   - que la barra viva sigue mandando de verdad (clic x1..x16 -> gameSpeed, y el pausa);
 *   - que el boton del ciclo viejo se queda en x16 (no asoma un 32 por la puerta de atras);
 *   - que solo hay UNA tira de velocidad a la vista, que es lo que el dueño veto desde el principio;
 *   - y que el simulador puede seguir corriendo a 64 cuando una prueba lo pide (eso no es un boton).
 *
 *   node test/vel-barra-unica.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const ROOT = path.resolve(__dirname, '..');
const PORT = 8157;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.svg': 'image/svg+xml' };

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
const ok = (c, m, d) => { if (c) { pass++; console.log('  ok   ' + m + (d ? ' · ' + d : '')); } else { failn++; console.log('  FAIL ' + m + (d ? ' · ' + d : '')); } };

const html = fs.readFileSync(path.join(ROOT, 'ant-farm-rpg/index.html'), 'utf8');
const js = fs.readFileSync(path.join(ROOT, 'ant-farm-rpg/js/app.js'), 'utf8');

(async () => {
  console.log('\n· el markup y los pasos, mirados en frio');
  const prohibidos = ['btnSpeed32', 'btnSpeed64', 'btnSpeed32b', 'btnSpeed64b', 'btnVel32', 'btnVel64', 'btnCorner32', 'btnCorner64'];
  const enHtml = prohibidos.filter(id => html.includes('id="' + id + '"'));
  ok(enHtml.length === 0, 'x32 y x64 fuera del markup de las dos tiras viejas', enHtml.join(', ') || 'ni uno: ' + (html.match(/id="btnSpeed\d+b?"/g) || []).length + ' botones btnSpeed quedan (x1..x16 en dos tiras selladas)');
  const pasos=/const SPEED_STEPS=TOPO_DEBUG_TOOLS\?\[1,2,4,8,16\]:\[1,2,4\]/.test(js);
  ok(pasos,'SPEED_STEPS offers x1/x2/x4 publicly and reserves x8/x16 for ?debug=1');
  const tinte = (js.match(/const SPEED_TINT=\{([^}]*)\}/) || [, ''])[1];
  ok(!/32:|64:/.test(tinte), 'y el repintado de botones no tiene tinte para 32 ni 64', tinte.slice(0, 70) + '…');
  ok(/gameSpeed>8|gameSpeed>7/.test(js), 'el simulador sigue con sus umbrales (gameSpeed>8), no con igualdades a 32 o 64', 'por eso las pruebas pueden seguir corriendo a x64 por dentro');

  await new Promise(r => server.listen(PORT, '0.0.0.0', r));
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 760 });
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|autoplay|AudioContext/.test(m.text())) errs.push('console: ' + m.text().slice(0, 140)); });

  await page.goto(`http://127.0.0.1:${PORT}/ant-farm-rpg/index.html`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction('typeof window.topoShowMainMenu==="function" || window._topoFlowReady===true', { timeout: 20000 }).catch(() => { });
  await page.waitForFunction("!document.getElementById('splashScreen') || document.getElementById('splashScreen').style.display==='none'", { timeout: 15000 }).catch(() => { });
  await page.click('#btnMainCreate'); await sleep(400);
  await page.click('#createSizeScreen [data-size="small"]'); await sleep(400);
  await page.evaluate(() => { const h = document.querySelector('.topo-dialog-host'); if (!h) return; const b = [...h.querySelectorAll('button')].find(x => /^(SÍ|YES|CREATE WORLD|ARCHIVE & CREATE)$/i.test(x.textContent.trim())); if (b) b.click(); });
  for (let i = 0; i < 16; i++) {
    const abierto = await page.evaluate(() => {
      const m = document.getElementById('onboardingModal');
      if (!m || getComputedStyle(m).display === 'none') return false;
      const b = document.getElementById('btnOnboardingStart') || [...m.querySelectorAll('button')].pop();
      if (b) b.click();
      return true;
    });
    if (abierto) break;
    await sleep(250);
  }
  await page.waitForFunction("document.body.classList.contains('game-started')", { timeout: 15000 }).catch(() => { });
  await sleep(1100);

  console.log('\n· la barra viva, pinchada con el raton');
  const leidos = [];
  for (const v of [1, 2, 4]) {
    await page.click('#btnVel' + v);
    await sleep(220);
    const e = await page.evaluate(`(()=>({g:gameSpeed, turbo:!!turbo, pintado:(document.getElementById('btnVel${v}')||{}).style?.background||''}))()`);
    leidos.push(`${v}:${e.g}`);
    ok(e.g === v, `click en x${v} de la barra pone el juego a x${v}`, `gameSpeed ${e.g} · turbo ${e.turbo}`);
  }
  const pausaAntes = await page.evaluate('(()=>paused)()');
  await page.click('#btnVelPause'); await sleep(220);
  const pausaDesp = await page.evaluate('(()=>paused)()');
  ok(pausaDesp !== pausaAntes, 'y el boton de pausa de esa misma barra sigue pausando', `paused ${pausaAntes} -> ${pausaDesp}`);
  await page.click('#btnVelPause'); await sleep(180);

  console.log('\n· por la puerta de atras: el ciclo viejo y las tiras selladas');
  const ciclo = await page.evaluate(`(()=>{
    const b=document.getElementById('btnTurbo'); const vistos=[];
    if(!b) return {sinBoton:true, vistos};
    for(let i=0;i<12;i++){ b.click(); vistos.push(gameSpeed); }
    return {vistos, max:Math.max(...vistos)};
  })()`);
  ok(!ciclo.sinBoton && ciclo.max <= 4, 'the legacy cycle cannot escape the public x4 cap', 'sequence ' + ciclo.vistos.join(' → '));
  const visible = await page.evaluate(`(()=>{
    const ver=[]; for(const e of document.querySelectorAll('[id^="btnSpeed"],[id^="btnVel"],[id^="btnCorner"]')){
      const cs=getComputedStyle(e), r=e.getBoundingClientRect();
      if(cs.display!=='none' && cs.visibility!=='hidden' && r.width>2 && r.height>2){
        let tapa=document.elementFromPoint(Math.round(r.left+r.width/2), Math.round(r.top+r.height/2));
        if(tapa===e||e.contains(tapa)) ver.push(e.id);
      }
    }
    return ver;
  })()`);
  const deLaBarra = visible.filter(id => /^btnVel/.test(id));
  ok(visible.length === deLaBarra.length && deLaBarra.length >= 3&&!visible.some(id=>/8|16/.test(id)), 'only the public x1/x2/x4 bar is visible (no duplicate or debug speed)', visible.join(', ') || 'no speed button visible');
  const topes = await page.evaluate(`(()=>{
    const sale={}; setGameSpeed(1);
    for (const n of [32,64,3,0,-5,100]) { setGameSpeed(n); sale[n]=gameSpeed; }
    setGameSpeed(1); return sale;
  })()`);
  ok(topes[32]===4&&topes[64]===4&&topes[100]===4,'public calls above x4 clamp safely to x4','x32->x'+topes[32]+' · x64->x'+topes[64]+' · x100->x'+topes[100]);
  ok(topes[3] === 2 && topes[0] === 1 && topes[-5] === 1, 'un paso suelto baja al de abajo y un valor raro vuelve a x1', 'x3->x' + topes[3] + ' · 0->x' + topes[0] + ' · -5->x' + topes[-5]);
  const enVivo = await page.evaluate(`(()=>({pasos:SPEED_STEPS.slice(), botones:[...document.querySelectorAll('[id^="btnSpeed32"],[id^="btnSpeed64"]')].length}))()`);
  ok(enVivo.botones===0&&enVivo.pasos.join()==='1,2,4','the served public page exposes only public speed steps',`SPEED_STEPS [${enVivo.pasos}] · ${enVivo.botones} x32/x64 buttons`);
  const publicTools=await page.evaluate(()=>({day:btnDay1.hidden,high:[btnVel8.hidden,btnVel16.hidden],debug:document.documentElement.dataset.topoDebug}));
  ok(publicTools.day&&publicTools.high.every(Boolean)&&publicTools.debug==='false','+1 DAY, x8 and x16 stay hidden on the public URL');
  const debugPage=await browser.newPage();await debugPage.goto(`http://127.0.0.1:${PORT}/ant-farm-rpg/index.html?debug=1`,{waitUntil:'load'});await debugPage.waitForFunction('window._topoFlowReady===true');
  const debugTools=await debugPage.evaluate(()=>({steps:SPEED_STEPS.slice(),day:btnDay1.hidden,high:[btnVel8.hidden,btnVel16.hidden],set:(setGameSpeed(16),gameSpeed),debug:document.documentElement.dataset.topoDebug}));
  ok(debugTools.steps.join()==='1,2,4,8,16'&&!debugTools.day&&debugTools.high.every(v=>!v)&&debugTools.set===16&&debugTools.debug==='true','?debug=1 restores x8, x16 and +1 DAY',JSON.stringify(debugTools));await debugPage.close();
  fs.mkdirSync('/tmp/antfarm-capturas',{recursive:true});await page.screenshot({path:'/tmp/antfarm-capturas/vel-barra-unica.png'});

  ok(errs.length === 0, 'cero errores de JavaScript en todo el recorrido', errs.slice(0, 2).join(' | '));

  console.log('\n' + pass + ' ok · ' + failn + ' FALLOS\n');
  await browser.close();
  server.close();
  process.exit(failn ? 1 : 0);
})().catch(e => { console.error('FALLO del arnés:', e.message); try { server.close(); } catch (_) { } process.exit(2); });
