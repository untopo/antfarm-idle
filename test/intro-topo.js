/**
 * intro-topo.js - la pantalla de TOPO STUDIOS, medida en CHROME real (no de memoria).
 *
 * El dueno pidio una animacion voxel chiquita, «un topo saliendo de su madriguera o algo asi». Lo que se
 * comprueba aqui es que existe, que se mueve, que pinta con los bloques de la casa y -lo mas importante-
 * que se PARA: un logo que sigue gastando cuadros despues de terminar es un impuesto sobre el resto del
 * juego. Y que con «menos movimiento» del sistema Operativo sale el cuadro final quieto.
 *
 *   node test/intro-topo.js
 */
const http = require('http');
const fs = require('fs');
fs.mkdirSync('/tmp/antfarm-capturas', { recursive: true });
const path = require('path');
const puppeteer = require('puppeteer');
const ROOT = path.resolve(__dirname, '..');
const PORT = 8181;
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

// lectura del lienzo: cuenta colores y firma un hash barato para comparar cuadros
const MUESTRA = `(()=>{
  const cv=document.getElementById('splashTopo'); if(!cv) return null;
  const d=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;
  let verde=0, cielo=0, topo=0, tierra=0, oscuro=0, suma=0, n=0;
  for(let i=0;i<d.length;i+=4){
    const r=d[i],gg=d[i+1],b=d[i+2],a=d[i+3];
    suma=(suma*31 + r+gg*3+b*7+a) % 2147483647; n++;
    if(a<12) continue;
    if(gg>100 && r<150 && b<95) verde++;
    else if(b>r+18 && b>60) cielo++;
    if(Math.abs(r-0x5a)<26 && Math.abs(gg-0x51)<26 && Math.abs(b-0x48)<30) topo++;
    if(r>110&&r<200&&gg>70&&gg<140&&b<90) tierra++;
    if(r<30&&gg<26&&b<22) oscuro++;
  }
  return {firma:suma, pix:n, verde, cielo, topo, tierra, oscuro, w:cv.width, h:cv.height, cw:cv.offsetWidth};
})()`;

async function cargar(browser, opts) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|autoplay|AudioContext/.test(m.text())) errs.push('console: ' + m.text().slice(0, 160)); });
  if (opts && opts.reduced) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.goto(`http://127.0.0.1:${PORT}/ant-farm-rpg/index.html`, { waitUntil: 'load', timeout: 30000 });
  return { page, errs };
}

(async () => {
  await new Promise(r => server.listen(PORT, '0.0.0.0', r));
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });

  console.log('\n· el topo sale de la madriguera');
  const { page, errs } = await cargar(browser);
  await sleep(120);
  const a = await page.evaluate(MUESTRA);
  ok(a && a.w === 176 && a.h === 88, 'el lienzo del logo existe y mide 176x88 logicos', a ? `${a.w}×${a.h} (en pantalla ${a.cw}px, pixelated)` : 'no hay canvas');
  await sleep(500);
  const b = await page.evaluate(MUESTRA);
  ok(b && a && b.firma !== a.firma, 'la secuencia avanza: dos cuadros separados 0,5 s no son el mismo', `${a && a.firma} -> ${b && b.firma}`);
  ok(b && b.verde > 60 && b.cielo > 500, 'hay pasto y hay cielo, en franjas de bloque', `verde ${b && b.verde} px · cielo ${b && b.cielo} px`);
  // la boca se ve ANTES de que el topo salga: despues el bicho la tapa con el lomo, que es justo lo que
  // quiere decir «saliendo de la madriguera» (medido: a los 0,12 s hay 120 px de hueco; al final, 3).
  ok(a && a.oscuro > 40, 'la boca de la madriguera esta abierta antes de que el topo asome', `oscuro ${a && a.oscuro} px al arranque`);
  ok(b && b.oscuro < a.oscuro, 'y el topo la va tapando al subir (no es un pegote encima del prado)', `${a && a.oscuro} -> ${b && b.oscuro} px de hueco`);

  // el cuadro final: el topo arriba del todo, y ya no se mueve
  await sleep(2300);
  const c1 = await page.evaluate(MUESTRA);
  await sleep(400);
  const c2 = await page.evaluate(MUESTRA);
  ok(c1 && c1.topo > 90, 'el topo asoma y se le ve el lomo de 0x5a5148', `${c1 && c1.topo} px de pelo`);
  ok(c1 && c2 && c1.firma === c2.firma, 'cuando acaba se congela: no sigue gastando cuadros despues del logo', `firma ${c1 && c1.firma} == ${c2 && c2.firma}`);
  ok(c1 && c1.tierra > 200, 'el terreno sigue siendo de bloques (tierra contable bajo el pasto)', `${c1 && c1.tierra} px de terron`);

  // y el juego no se rompio por meter un guion de adorno delante
  await page.waitForFunction("typeof window.topoShowMainMenu==='function' || window._topoFlowReady===true", { timeout: 20000 }).catch(() => {});
  await page.click('#btnMainCreate'); await sleep(300);
  await page.click('#createSizeScreen [data-size="small"]'); await sleep(300);
  await page.evaluate(() => { const h = document.querySelector('.topo-dialog-host'); if (!h) return; const bt = [...h.querySelectorAll('button')].find(x => x.textContent.trim() === 'SÍ'); if (bt) bt.click(); });
  for (let i = 0; i < 14; i++) {
    const abierto = await page.evaluate(() => {
      const m = document.getElementById('onboardingModal');
      if (!m || getComputedStyle(m).display === 'none') return false;
      const bt = document.getElementById('btnOnboardingStart') || [...m.querySelectorAll('button')].pop();
      if (bt) bt.click();
      return true;
    });
    if (abierto) break;
    await sleep(250);
  }
  await page.waitForFunction("document.body.classList.contains('game-started')", { timeout: 15000 }).catch(() => {});
  await sleep(700);
  const parado = await page.evaluate(MUESTRA);
  const oculta = await page.evaluate(`(()=>{ const sp=document.getElementById('splashScreen'); return !sp || getComputedStyle(sp).display==='none'; })()`);
  ok(oculta, 'al entrar al juego el logo se va de en medio', oculta ? 'splashScreen display:none' : 'sigue tapando');
  await sleep(400);
  const parado2 = await page.evaluate(MUESTRA);
  ok(parado && parado2 && parado.firma === parado2.firma, 'con el menu por delante el lienzo no se refresca ni una vez', `firma ${parado && parado.firma}`);
  ok(errs.length === 0, 'cero errores de JavaScript en toda la pantalla de inicio', errs.slice(0, 2).join(' | ') || 'nada en consola');
  await page.screenshot({ path: '/tmp/antfarm-capturas/intro-topo.png' });

  console.log('\n· con «menos movimiento» del sistema, cuadro final quieto');
  const { page: pr, errs: er2 } = await cargar(browser, { reduced: true });
  await sleep(300);
  const rv = await pr.evaluate(MUESTRA);
  await sleep(400);
  const rv2 = await pr.evaluate(MUESTRA);
  ok(rv && rv.topo > 90, 'se ve al topo ya salido (no se anima, se muestra el resultado)', `${rv && rv.topo} px de pelo`);
  ok(rv && rv2 && rv.firma === rv2.firma, 'y no hay animacion: dos cuadros iguales', `firma ${rv && rv.firma}`);
  ok(er2.length === 0, 'sin errores tampoco en ese modo', er2.slice(0, 2).join(' | ') || 'nada');

  await browser.close();
  server.close();
  console.log(`\n${pass} ok · ${failn} FALLOS\n`);
  process.exit(failn ? 1 : 0);
})().catch(e => { console.error('MUERE EL TEST:', e); process.exit(2); });
