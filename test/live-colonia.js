/**
 * live-colonia.js - la queja del dueño, en CHROME real y por el camino del usuario.
 *
 * "En mi partida no nace nadie, y eventualmente se muere la reina y no queda nadie vivo." Ninguna
 * prueba de node valia si el sintoma seguia ahi: este script crea la granja haciendo click en el
 * menu, deja correr el bucle del navegador hasta el dia 6 y comprueba cuatro cosas del mundo real
 * (nacimientos, boca estrecha, plantas sin flotar, cero errores de JavaScript).
 *
 *   node test/live-colonia.js [dias]
 */
const http = require('http');
const fs = require('fs');
fs.mkdirSync('/tmp/antfarm-capturas',{recursive:true});
const path = require('path');
const puppeteer = require('puppeteer');
const ROOT = path.resolve(__dirname, '..');
const PORT = 8137;
const DIAS = Number(process.argv[2] || 6);
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
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage', '--window-size=1280,800'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 780 });
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|autoplay|AudioContext/.test(m.text())) errs.push('console: ' + m.text().slice(0, 140)); });

  const DEST = process.env.URL || `http://127.0.0.1:${PORT}/ant-farm-rpg/index.html`;
  console.log('  destino: ' + DEST);
  await page.goto(DEST, { waitUntil: 'load', timeout: 40000 });
  await page.waitForFunction('typeof window.topoShowMainMenu==="function" || window._topoFlowReady===true', { timeout: 20000 }).catch(() => { });
  await page.waitForFunction("!document.getElementById('splashScreen') || document.getElementById('splashScreen').style.display==='none'", { timeout: 15000 }).catch(() => { });
  await page.click('#btnMainCreate');
  await sleep(400);
  await page.click('#createSizeScreen [data-size="small"]');
  await sleep(400);
  await page.evaluate(() => { const h = document.querySelector('.topo-dialog-host'); if (!h) return; const b = [...h.querySelectorAll('button')].find(x => /^(SÍ|YES)$/i.test(x.textContent.trim())); if (b) b.click(); });
  try { await page.waitForFunction('window.COLS===48 && window.ROWS===28', { timeout: 40000 }); } catch (e) { console.log('  (no confirmo el mundo)'); }
  await page.evaluate(() => { const b = document.getElementById('btnOnboardingStart'); if (b) b.click(); });
  await page.evaluate(() => { try { setGameSpeed(64); } catch (e) { window.gameSpeed = 64; } });
  console.log(`mundo pequeno 48x28 creado en Chrome · esperando ${DIAS} dias a x64`);

  const foto = () => page.evaluate(() => JSON.stringify((() => {
    const boca = []; for (let c = 0; c < COLS; c++) if (soil[SURFACE_ROW][c] === 0) boca.push(c);
    return {
      dia: Math.floor(time / DAY_LENGTH) + 1, ob: workers.length, reinas: queens.length,
      etapas: ['egg', 'larva', 'pupa'].map(t => t[0] + brood.filter(b => b.type === t).length).join(''),
      entregas: deliveries, despensa: Math.round(colonyFood * 10) / 10,
      boca, entrada: entradaCol, digs,
      plantasAire: plants.filter(p => !p.cave && soil[SURFACE_ROW][p.c] !== 1).length,
      hongosAire: plants.filter(p => p.cave && p.rr !== undefined && (!soil[p.rr - 1] || soil[p.rr - 1][p.cr] === 0)).length,
      vidaReina: Math.round(queens[0] ? queens[0].health : -1),
      puestas: queens[0] ? (queens[0].eggsLaid || 0) : 0,
      nac: events.filter(e => e.type === 'birth').length,
      mue: events.filter(e => e.type === 'death').length
    };
  })()));

  let ultimo = null, diaMax = 0, t0 = Date.now();
  const fotos = [];
  while (Date.now() - t0 < 480000) {
    await sleep(3500);
    let j; try { j = JSON.parse(await foto()); } catch (e) { console.log('  (sin lectura: ' + e.message.slice(0, 50) + ')'); continue; }
    if (!ultimo || j.dia > ultimo.dia) { fotos.push(j); console.log(`  d${j.dia} ob${String(j.ob).padStart(2)} reinas${j.reinas} cria ${j.etapas} | entregas ${j.entregas} despensa ${String(j.despensa).padStart(4)} cav ${j.digs} boca[${j.boca.join(',')}] reina ${j.vidaReina}v ${j.puestas}p | +${j.nac} -${j.mue} plantasAire ${j.plantasAire} hongosAire ${j.hongosAire}`); }
    ultimo = j; diaMax = Math.max(diaMax, j.dia);
    if (diaMax >= DIAS) break;
  }
  await page.screenshot({ path: '/tmp/antfarm-capturas/15-colonia-dia' + diaMax + '.png' });

  const f = ultimo;
  ok(diaMax >= 3, `el reloj de Chrome llego al dia ${diaMax} (harness: mismo ritmo)`);
  ok(f.ob > 4, `nacen obreras en la pagina real: 4 -> ${f.ob} (puestas ${f.puestas}, nacimientos ${f.nac})`);
  ok(f.ob >= 4 && f.reinas >= 1, `y siguen vivas: ${f.ob} obreras y ${f.reinas} reina(s) a ${f.vidaReina} de vida`);
  ok(f.boca.length <= 3, `la boca mide ${f.boca.length} columnas, no un crater (entrada en ${f.entrada})`);
  ok(f.plantasAire === 0, `0 plantas colgando sobre huecos (${f.plantasAire})`);
  ok(f.hongosAire === 0, `0 hongos sin techo (${f.hongosAire})`);
  ok(errs.length === 0, `cero errores de JavaScript${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);

  console.log('\n' + pass + ' ok' + (failn ? ' · ' + failn + ' FALLOS' : ' · colonia viva en el navegador real') + ` · ${Math.round((Date.now() - t0) / 1000)} s`);
  await browser.close(); server.close();
  process.exit(failn ? 1 : 0);
})().catch(e => { console.error('ERROR', e); try { server.close(); } catch (x) { } process.exit(2); });
