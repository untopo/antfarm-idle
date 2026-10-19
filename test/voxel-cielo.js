/**
 * voxel-cielo.js - cielos por estacion y clima de nieve, medidos en CHROME real.
 *
 * El encargo del dueño fue: «deja el sprite de la hormiga igual por ahora; ahora haz el de los cielos y
 * climas distintos». O sea: fuera el ultimo pliego que quedaba (categoria_10_clima_efectos.png) y cielo y
 * meteorologia pintados con el mismo idioma de bloques que ya tienen el terreno, las plantas, la miel y los
 * objetos. Aqui no se mira si "queda bonito": se mide en el lienzo y en las llamadas de dibujo.
 *
 *   - que el pliego del clima ya no se pide ni una vez y que el lienzo sigue vivo sin el;
 *   - que el cielo cambia con la hora, que el clima le roba luz y que la estacion lo lava: CUATRO cielos,
 *     no uno con un filtro encima;
 *   - que la nieve es un clima de verdad (solo cuaja en invierno), que no moja y que no hace charcos;
 *   - que la gota y el copo se pintan en bloques, con su luz y su sombra pegadas, y no con trazos;
 *   - que el relampago no salta de un lado a otro del cielo cada cuadro;
 *   - que el prado se pone blanco mientras nieva y que la barra del reloj lo dice;
 *   - y que con el reloj parado el cielo no parpadea.
 *
 * Para poner hora y estacion se toca SOLO `time`: el dia se deriva del tiempo, asi que asignar `day` no
 * vale (el bucle lo recalcula y la estacion vuelve a ser la de siempre). Medido: DAY_LENGTH=72000.
 *
 * Las capturas van a /tmp/antfarm-capturas (el taller no acumula imagenes; GitHub es el almacen).
 *
 *   node test/voxel-cielo.js
 */
const http = require('http');
const fs = require('fs');
fs.mkdirSync('/tmp/antfarm-capturas', { recursive: true });
const path = require('path');
const puppeteer = require('puppeteer');
const ROOT = path.resolve(__dirname, '..');
const PORT = 8154;
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

// ── en la pagina: grabadora de rectangulos y trazos del lienzo del mundo + lectura de pixeles ──
const GANCHO = `(()=>{
  const cv=document.getElementById('farmCanvas'), g=cv.getContext('2d');
  window.__cielo = { rects:[], trazos:[], on:false };
  const _fr=g.fillRect.bind(g), _st=g.stroke.bind(g), _sr=g.strokeRect.bind(g);
  // el navegador serializa rgba() CON espacios; se los quitamos para poder comparar colores tal cual
  const col=()=>String(g.fillStyle).replace(/\\s+/g,'');
  const scol=()=>String(g.strokeStyle).replace(/\\s+/g,'');
  g.fillRect=function(x,y,w,h){ if(window.__cielo.on) window.__cielo.rects.push([Math.round(x),Math.round(y),Math.round(w),Math.round(h),col()]); return _fr(x,y,w,h); };
  g.stroke=function(){ if(window.__cielo.on) window.__cielo.trazos.push([scol(),Number(g.lineWidth)]); return _st(); };
  g.strokeRect=function(x,y,w,h){ if(window.__cielo.on) window.__cielo.trazos.push([scol(),Number(g.lineWidth)]); return _sr(x,y,w,h); };
  // un pixel del MUNDO (no de la pantalla) leido con la camara actual
  window.__pixel=(wx,wy)=>{ const d=g.getImageData(Math.round((wx-(view.x||0))*(view.zoom||1)*(cv.width/VIEW_W)),Math.round((wy-(view.y||0))*(view.zoom||1)*(cv.height/VIEW_H)),1,1).data;return[d[0],d[1],d[2]];};
  // el pixel MAS OSCURO de una hilera: asi ni el sol ni las nubes (ambos mas claros que el cielo)
  // pueden colarse en la medida del color del cielo, caigan donde caigan con la hora y con el viento
  // medido EN PANTALLA, sobre una hilera entera, y devolviendo el color DOMINANTE de la franja (el cielo
  // es una banda lisa): asi ni el sol, ni las nubes, ni los luceros, ni un pico de tierra que asome pueden
  // colarse en la medida, caigan donde caigan con la hora y con el viento.
  window.__fila=(sy)=>{ const d=g.getImageData(16, Math.max(0,Math.round(sy)), Math.max(1, cv.width-32), 1).data;
    const hist=new Map();
    for(let i=0;i<d.length;i+=4){ const k=((d[i]>>4)<<8)|((d[i+1]>>4)<<4)|(d[i+2]>>4); const e=hist.get(k)||[0,0,0,0];
      e[0]+=d[i]; e[1]+=d[i+1]; e[2]+=d[i+2]; e[3]++; hist.set(k,e); }
    let best=null, bn=0; for(const e of hist.values()){ if(e[3]>bn){ bn=e[3]; best=e; } }
    return best? [Math.round(best[0]/best[3]), Math.round(best[1]/best[3]), Math.round(best[2]/best[3])] : [0,0,0]; };
  window.__raya=()=>Math.round((SURFACE_Y-(view.y||0))*(view.zoom||1)*(cv.height/VIEW_H));
  window.__frame=(n)=>new Promise(r=>{ let k=0; const f=()=>{ if(++k<(n||2)) requestAnimationFrame(f); else r(1); }; requestAnimationFrame(f); });
  window.__lum=a=>Math.round(0.299*a[0]+0.587*a[1]+0.114*a[2]);
  window.__tilde=(c,k)=>_tilde16(c,k);
})()`;

(async () => {
  await new Promise(r => server.listen(PORT, '0.0.0.0', r));
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  const errs = [], pila = [], peticiones = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => {
    if (m.type() !== 'error' || /favicon|autoplay|AudioContext/.test(m.text())) return;
    errs.push('console: ' + m.text().slice(0, 140));
    // la pila del error: el bucle del juego atrapa y avisa, y un fallo ahi tira el cuadro entero
    Promise.all(m.args().map(h => h.evaluate(x => (x && x.stack) ? x.stack : String(x)).catch(() => ''))).then(ss => {
      const s = ss.find(v => v && v.length > 8); if (s && pila.length < 2) pila.push(s.split('\n').slice(0, 4).join(' // ').slice(0, 300));
    });
  });
  page.on('request', r => peticiones.push(r.url()));

  await page.goto(`http://127.0.0.1:${PORT}/ant-farm-rpg/index.html`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction('typeof window.topoShowMainMenu==="function" || window._topoFlowReady===true', { timeout: 20000 }).catch(() => { });
  await page.waitForFunction("!document.getElementById('splashScreen') || document.getElementById('splashScreen').style.display==='none'", { timeout: 15000 }).catch(() => { });
  await page.click('#btnMainCreate');
  await sleep(400);
  await page.click('#createSizeScreen [data-size="small"]');
  await sleep(400);
  await page.evaluate(() => { const h = document.querySelector('.topo-dialog-host'); if (!h) return; const b = [...h.querySelectorAll('button')].find(x => /^(SÍ|YES)$/i.test(x.textContent.trim())); if (b) b.click(); });
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
  await sleep(900);
  await page.evaluate(GANCHO);

  // hora y estacion, por donde de verdad entran: el tiempo. Con el reloj corriendo un momento para que
  // el bucle recalcule el dia y el calendario, y el clima plantado a mano (sin nextChange no hay duda).
  const fijar = async (hora, clima, dia, extra) => {
    await page.evaluate(`(()=>{ paused=false; gameSpeed=1;
      time = DAY_LENGTH*(${dia}-1) + Math.round(DAY_LENGTH*(${hora}/24));
      weather.type='${clima}'; weather.intensity=${(clima === 'clear' || clima === 'cloudy') ? 0.2 : 0.85};
      weather.rainParticles.length=0; weather.timer=0; weather.nextChange=DAY_LENGTH*4;
      ${extra || ''}
      markSoilDirty(); })()`);
    await page.evaluate(`window.__frame(6)`);
  };
  const arriba = async () => page.evaluate(`window.__fila(Math.min(40, Math.max(4, window.__raya()-70)))`);
  const amedia = async () => page.evaluate(`window.__fila(Math.max(6, window.__raya()-26))`);
  const prado = async () => page.evaluate(`window.__pixel(Math.round((view.x||0)) + 8*CELL + 8, SURFACE_Y-14)`);   // este si va por mundo: es una franja de 4 px
  const rayaPantalla = async () => page.evaluate(`window.__raya()`);
  const L = a => page.evaluate(`window.__lum(${JSON.stringify(a)})`);
  const grabar = (frames, correr) => page.evaluate(`(async()=>{
    paused=${correr ? 'false' : 'true'}; gameSpeed=1;
    window.__cielo.rects.length=0; window.__cielo.trazos.length=0; window.__cielo.on=true;
    await window.__frame(${frames});
    window.__cielo.on=false; paused=true;
    return {rects:window.__cielo.rects, trazos:window.__cielo.trazos,
            gotas:weather.rainParticles.length, copos:weather.rainParticles.filter(p=>p.snow).length,
            vys:weather.rainParticles.map(p=>+p.vy.toFixed(2)),
            dia:day, est:getCalendarData().seasonIdx, hora:(time%DAY_LENGTH)/DAY_LENGTH*24,
            icono:(document.getElementById('timeLabel')||{}).textContent||''};
  })()`);

  console.log('\n· el pliego del clima, fuera');
  const climaPNG = peticiones.filter(u => /categoria_10_clima_efectos/.test(u)).length;
  const pliegos = peticiones.filter(u => /assets\/textures\/categoria_/.test(u)).length;
  ok(climaPNG === 0, 'categoria_10_clima_efectos.png no se pide ni una vez', `${climaPNG} peticiones · ${pliegos} de pliegos en total`);
  const lienzo = await page.evaluate(`(()=>{ const cv=document.getElementById('farmCanvas'); const d=cv.getContext('2d').getImageData(200,40,1,1).data; return {w:cv.width,h:cv.height,px:[d[0],d[1],d[2]]}; })()`);
  ok(lienzo.w > 200 && lienzo.h > 200, 'y aun asi el lienzo esta vivo (no se fundo a negro por quitar el PNG)', `${lienzo.w}x${lienzo.h} · rgb(${lienzo.px})`);

  console.log('\n· el cielo cambia con la hora y el clima le roba luz');
  await fijar(6.2, 'clear', 5); const alba = await arriba(); const albaHor = await amedia();
  await fijar(13.0, 'clear', 5); const medio = await arriba();
  await fijar(22.0, 'clear', 5); const noche = await arriba();
  const La = await L(alba), Lm = await L(medio), Ln = await L(noche);
  ok(Lm > La && Lm > Ln, 'mediodia es lo mas claro de las tres horas', `alba ${La} · mediodia ${Lm} · noche ${Ln}`);
  ok(alba[2] > alba[0] + 6 && (albaHor[0] - alba[0]) > 8, 'en el alba el cielo es azul arriba y calido en el horizonte (el degradado recorre la franja que se ve, no se aplana)', `cima rgb(${alba}) · horizonte rgb(${albaHor})`);
  ok(Ln < 30, 'y de noche el cielo de primavera baja a casi negro', `noche rgb(${noche}) = ${Ln}`);
  await fijar(13.0, 'storm', 5); const temporal = await arriba();
  const Lt = await L(temporal);
  ok(Lt < Lm - 12, 'el temporal le roba luz al cielo de la misma hora', `despejado ${Lm} rgb(${medio}) · temporal ${Lt}`);
  ok(temporal[2] > temporal[0], 'y el cielo del temporal vira a gris azulado, no a marron', `rgb(${temporal})`);

  console.log('\n· cuatro cielos, no uno con filtro');
  await fijar(13.0, 'clear', 5); const primavera = await amedia();
  await fijar(13.0, 'clear', 17); const verano = await amedia();
  await fijar(13.0, 'clear', 29); const otono = await amedia();
  await fijar(13.0, 'clear', 40); const invierno = await amedia();
  const firmas = new Set([primavera, verano, otono, invierno].map(a => a.join(',')));
  ok(firmas.size >= 3, 'a la misma hora y en claro, cada estacion tiene su propio cielo', `P rgb(${primavera}) · V rgb(${verano}) · O rgb(${otono}) · I rgb(${invierno})`);
  await fijar(22.0, 'clear', 5); const nocheP = await arriba();
  await fijar(22.0, 'clear', 40); const nocheI = await arriba();
  const LnP = await L(nocheP), LnI = await L(nocheI);
  ok(LnI > LnP + 6 && (nocheI[2] - nocheI[0]) > 12, 'la noche de invierno es corta y palida, no negro carbon', `primavera ${LnP} rgb(${nocheP}) · invierno ${LnI} rgb(${nocheI})`);
  const diaMedido = await page.evaluate(`JSON.stringify({dia:day, est:getCalendarData().seasonIdx, hora:(time%DAY_LENGTH)/DAY_LENGTH*24})`);
  ok(true, 'la estacion con la que se midio (time, no day)', diaMedido);

  console.log('\n· nieve: clima propio, y solo en invierno');
  const nevadosPor = async (dia) => {
    await page.evaluate(`time = DAY_LENGTH*(${dia}-1) + Math.round(DAY_LENGTH*0.55); weather.type='clear'; weather.intensity=0;`);
    let n = 0, cambios = 0;
    for (let k = 0; k < 40; k++) {
      await page.evaluate(`weather.timer = weather.nextChange + 1; if(weather.type==='snow') weather.type='clear';`);
      await page.evaluate(`window.__frame(2)`);
      const t = await page.evaluate(`weather.type`);
      cambios++; if (t === 'snow') n++;
    }
    return { n, cambios, dia: await page.evaluate(`day`), est: await page.evaluate(`getCalendarData().seasonIdx`) };
  };
  const inv = await nevadosPor(40);
  const ver = await nevadosPor(17);
  ok(inv.n > 0, 'en pleno invierno la lluvia se cuaja: aparece el clima de nieve', `${inv.n} nieves en ${inv.cambios} cambios (dia ${inv.dia}, estacion ${inv.est})`);
  ok(ver.n === 0, 'y en verano es imposible que nieve, por muchos cambios que se fuerce', `${ver.n} nieves en ${ver.cambios} cambios (dia ${ver.dia}, estacion ${ver.est})`);

  await fijar(13.0, 'snow', 40);
  const nievada = await grabar(10, true);
  await fijar(13.0, 'storm', 40);
  const lluvia = await grabar(10, true);
  const nievadaRects = nievada.rects, lluviaRects = lluvia.rects;
  const copos = nievadaRects.filter(r => r[4] === '#eef6ff' && r[2] === 3 && r[3] === 3);
  const gotas = lluviaRects.filter(r => /^rgba\(150,190,230/.test(r[4]) && r[2] === 1 && r[3] >= 7);
  ok(copos.length > 0, 'la nevada pinta copos de 3x3 con el sello de bloque', `${copos.length} copos en 10 cuadros · ${nievada.gotas} particulas`);
  ok(gotas.length > 0, 'el aguacero pinta gotas de 1 px de ancho y 7-9 de largo', `${gotas.length} gotas en 10 cuadros · ${lluvia.gotas} particulas`);
  ok(nievada.copos > 0 && lluvia.copos === 0, 'la nieve es un clima aparte, no lluvia con filtro', `copos: nevada ${nievada.copos} · temporal ${lluvia.copos}`);
  const trazosRaros = nievada.trazos.concat(lluvia.trazos).filter(t => /190,227,255|160,190,255|255,255,200/.test(t[0]));
  ok(trazosRaros.length === 0, 'cero trazos de lluvia: la gota se estira con el sello, no con lineWidth', `${nievada.trazos.length + lluvia.trazos.length} trazos en total, ${trazosRaros.length} azules`);
  const medioVy = a => a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(2) : 0;
  const vyCopo = medioVy(nievada.vys), vyGota = medioVy(lluvia.vys);
  ok(vyCopo > 0 && vyGota > vyCopo * 2.2, 'el copo cae meciendose despacio y la gota con gravedad de verdad', `vy medio: copo ${vyCopo} · gota ${vyGota}`);
  ok(nievadaRects.some(r => r[4].indexOf('rgba(214,230,244') === 0), 'y la nevada trae su velo frio, distinto del velo del aguacero', 'capa rgba(214,230,244,..) pintada');
  ok(!nievadaRects.some(r => r[4].indexOf('rgba(30,40,60') === 0), 'el velo del temporal no se cuela en la nieve', '');

  console.log('\n· el sello, tambien en el cielo');
  const selloEn = async (rects, cuerpo) => {
    const [x, y, w, h, col] = cuerpo;
    if (!/^#/.test(col)) return { top: false, bot: false, claro: col, oscuro: col };
    const claro = await page.evaluate(`window.__tilde(${JSON.stringify(col)},40)`);
    const oscuro = await page.evaluate(`window.__tilde(${JSON.stringify(col)},-46)`);
    const top = rects.some(r => r[0] === x && r[1] === y && r[2] === w && r[3] === 1 && r[4] === claro);
    const bot = rects.some(r => r[0] === x && r[1] === y + h - 1 && r[2] === w && r[3] === 1 && r[4] === oscuro);
    return { top, bot, claro, oscuro };
  };
  const sCopo = copos.length ? await selloEn(nievadaRects, copos[0]) : { top: false, bot: false, claro: '-', oscuro: '-' };
  ok(sCopo.top && sCopo.bot, 'el copo lleva pegada arriba su fila de luz y abajo su sombra', `luz ${sCopo.claro} · sombra ${sCopo.oscuro}`);
  const cuerposSol = nievadaRects.filter(r => r[2] === 28 && r[3] === 28);
  const sSol = cuerposSol.length ? await selloEn(nievadaRects, cuerposSol[0]) : { top: false, bot: false, claro: '-', oscuro: '-' };
  ok(cuerposSol.length > 0 && sSol.top && sSol.bot, 'el sol sale con su cara clara y su canto oscuro, como un bloque mas', cuerposSol.length ? `${cuerposSol[0][4]} · luz ${sSol.claro}` : 'el sol no aparecio');
  const cuerposNube = nievadaRects.filter(r => r[4] === '#ffffff' && r[2] >= 30 && r[3] >= 10);
  const sNube = cuerposNube.length ? await selloEn(nievadaRects, cuerposNube[0]) : { top: false, bot: false, claro: '-', oscuro: '-' };
  ok(cuerposNube.length > 0 && sNube.top && sNube.bot, 'las nubes van por bloque con su relieve (antes eran dos capas de PNG a alpha)', `${cuerposNube.length} cuerpos de nube`);

  console.log('\n· el relampago no salta de un lado a otro');
  const rayoEn = async (semilla) => {
    await page.evaluate(`paused=true; weather.type='storm'; weather.intensity=0.9; lightningTimer=${semilla};`);
    const r = await grabar(1, false);
    return r.rects.filter(x => x[4].indexOf('rgba(255,255,214') === 0).map(x => x[0] + 'x' + x[1]).sort().join('|');
  };
  const r1 = await rayoEn(24), r2 = await rayoEn(24), r3 = await rayoEn(23);
  ok(r1.split('|').length >= 8, 'el destello se dibuja en ocho trozos', `${r1.split('|').length} trozos`);
  ok(r1 === r2 && r1.length > 0, 'dos cuadros con el mismo temporizador dan el MISMO rayo (antes saltaba de sitio cada cuadro)', r1.slice(0, 46));
  ok(r1 !== r3, 'y con otro temporizador cae en otro sitio: no es un decorado fijo', '');

  console.log('\n· la nieve no moja, pero si vista el prado');
  const charcos = async (clima, dia) => {
    await fijar(13.0, clima, dia);
    await page.evaluate(`window.__cielo.on=false;`);
    const n0 = await page.evaluate(`mound.filter(m=>m.isPuddle).length`);
    await page.evaluate(`(()=>{ const _p=Array.prototype.push.bind(mound); window.__empujados=0; mound.push=function(o){ if(o&&o.isPuddle) window.__empujados++; return _p(o); }; })()`);
    await page.evaluate(`paused=false; window.__frame(26)`);
    const nuevos = await page.evaluate(`window.__empujados`);
    await page.evaluate(`(()=>{ delete mound.push; })()`);
    return { n0, nuevos, nievando: await page.evaluate(`weather.type`) };
  };
  const cLluvia = await charcos('storm', 5);
  const cNieve = await charcos('snow', 40);
  ok(cLluvia.nuevos > 0, 'el agua deja charcos en el prado', `${cLluvia.nuevos} charcos nuevos en 26 cuadros`);
  ok(cNieve.nuevos === 0, 'la nieve no: no moja, no hace charco y no mueve la economia', `${cNieve.nuevos} charcos durante la nevada (${cNieve.nievando})`);
  await fijar(13.0, 'clear', 40); const pradoSeco = await prado();
  await fijar(13.0, 'snow', 40); const pradoNieve = await prado();
  ok(pradoNieve[2] > pradoSeco[2] + 18 && pradoNieve[0] > 110, 'mientras nieva el prado se pone blanco por encima (y el cache del suelo se repinta)', `seco rgb(${pradoSeco}) · nevado rgb(${pradoNieve})`);
  // El panel del mundo se refresca con un porteria de tiempo (shouldUpdateUI: 140 ms) para no
  // pintar la barra entera en cada cuadro. El test quiere el texto YA, asi que llama hasta que la
  // porteria deje pasar una -y si el texto jamas acompaña al clima, se sale por tiempo y falla igual.
  const eco = async () => {
    const lee = `(()=>{ const e2=document.getElementById('ecoWeather'); const t=document.getElementById('timeLabel'); return (e2&&e2.textContent||'?')+' // '+(t&&t.textContent||'?'); })()`;
    const quiere = await page.evaluate(`(()=>{ const w={clear:'clear',cloudy:'cloudy',rain:'rain',storm:'storm',snow:'snow'}; return w[weather.type]||weather.type; })()`);
    let txt = await page.evaluate(lee);
    for(let i=0; i<15 && txt.indexOf(quiere) < 0; i++){
      await new Promise(r=>setTimeout(r,100));
      await page.evaluate(`(()=>{ try{ updateColonyUI(); }catch(e){} })()`);
      txt = await page.evaluate(lee);
    }
    return txt;
  };
  const iconoNieve = await eco();
  ok(/snow|nieve/i.test(iconoNieve), 'el panel del mundo dice NIEVE (antes caia nieve y el cartel seguia con su solecito)', JSON.stringify(iconoNieve));
  await fijar(13.0, 'rain', 40);
  const iconoLluvia = await eco();
  ok(/rain|lluvia/i.test(iconoLluvia) && !/snow|nieve/i.test(iconoLluvia), 'y con lluvia dice lluvia, sin que la nieve se la robe', JSON.stringify(iconoLluvia));

  console.log('\n· el cielo no parpadea con el reloj parado');
  const quieta = await page.evaluate(`(async()=>{ paused=true; weather.type='cloudy'; weather.intensity=0.4;
    await window.__frame(3);
    const cv=document.getElementById('farmCanvas'), g=cv.getContext('2d');
    const a=g.getImageData(0,0,cv.width,140).data; const b0=new Uint8ClampedArray(a);
    await window.__frame(20);
    const c=g.getImageData(0,0,cv.width,140).data;
    let dif=0; for(let i=0;i<b0.length;i+=4){ if(b0[i]!==c[i]||b0[i+1]!==c[i+1]||b0[i+2]!==c[i+2]) dif++; }
    return {dif, tot:b0.length/4}; })()`);
  ok(quieta.dif === 0, 'veinte cuadros con el tiempo congelado y ni un pixel del cielo se mueve', `${quieta.dif}/${quieta.tot} distintos`);

  await page.screenshot({ path: '/tmp/antfarm-capturas/cielo-nieve.png' });
  ok(errs.length === 0, 'cero errores de javascript', (errs.slice(0, 2).join(' | ') + (pila.length ? ' « ' + pila.join(' /// ') : '')).slice(0, 300));

  console.log(`\n${pass} ok · ${failn} FALLOS\n`);
  await browser.close();
  server.close();
  process.exit(failn ? 1 : 0);
})().catch(e => { console.error('estallo el test:', e && e.stack || e); try { server.close(); } catch (_) { } process.exit(2); });
