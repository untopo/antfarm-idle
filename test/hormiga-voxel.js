/**
 * hormiga-voxel.js - la hormiga se pinta con el lenguaje de bloques del mundo, medido.
 *
 * El dueño lo pidio tal que asi: «tambien puedes poner el resto de graficos para que concuerden
 * con lo demas con el estilo voxel, los cielos, las hormigas, los climas, los efectos
 * climaticos». El cuerpo de la hormiga era lo ultimo que quedaba saliendo de un PNG: 30x14
 * pegados encima del barro, con su recorte visible al acercar la camara. Aqui se mide el pintor
 * nuevo (`_hormigaVoxel`) con las funciones de verdad del juego, en Chrome real:
 *
 *   - que una hormiga se pinta SOLO con rectangulos (cero trazos, cero circulos, cero imagenes);
 *   - que los cinco PNG de hormiga ya no se piden al arrancar;
 *   - que el caste se ve en el tamano (minim < media < major < reina), no en un numero;
 *   - que la cara de luz arriba y el canto oscuro abajo estan, como en el terreno;
 *   - que andar, cavar, dormir y cargar se distinguen sin leer ni una letra;
 *   - que el oficio lleva su franja de color y la reina su corona;
 *   - y que en el cuadro solo se pintan las hormigas que caben en la camara (recorte).
 *
 * La tira de muestra se guarda en /tmp/antfarm-capturas (el taller no acumula imagenes).
 *
 *   node test/hormiga-voxel.js
 */
const http = require('http');
const fs = require('fs');
fs.mkdirSync('/tmp/antfarm-capturas', { recursive: true });
const path = require('path');
const puppeteer = require('puppeteer');
const ROOT = path.resolve(__dirname, '..');
const PORT = 8169;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.wav': 'audio/wav' };

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

// La tira se pinta dentro de la pagina, con el pintor del juego (no una copia).
const TIRA = `(() => {
  const Cas = ['FORRAJEADORA','EXPLORADORA','EXCAVADORA','NODRIZA'];
  const modelo = (o) => Object.assign({
    id:'H1', role:'FORRAJEADORA', caste:'media', state:'CAMINAR', food:null, isQueen:false,
    _walkPhase:1.35, _bobPhase:0.7, angle:0, health:100, age:10, mood:{}, sensors:{}, commOut:[0,0], tool:null
  }, o||{});
  const filas = [
    ['media andando',        modelo({})],
    ['minim',                modelo({caste:'minim'})],
    ['major (soldado)',      modelo({caste:'major', role:'EXCAVADORA'})],
    ['cavando',              modelo({state:'CAVANDO', _bobPhase:2.2})],
    ['durmiendo',            modelo({state:'DESCANSAR', _walkPhase:0})],
    ['con carga',            modelo({food:{amount:3,isSoil:false}})],
    ['reina',                modelo({isQueen:true, caste:'queen', role:'REINA'})],
    ['antropomorfa',         modelo({})],
    ['mini (mapa)',          modelo({})]
  ];
  const CW = 96, CH = 62, cv = document.createElement('canvas');
  cv.width = CW*filas.length; cv.height = CH*2;
  const g = cv.getContext('2d');
  const ANTES_ANTHRO = (typeof useAnthro!=='undefined') ? useAnthro : false;
  const mide = (cx0, cy0, cbu) => {
    const d = g.getImageData(cx0+1, cy0+1, CW-2, CH-2).data;
    let x0=1e9,x1=-1,y0=1e9,y1=-1, lum=[];
    const esFondo = (r,gg,b) => (Math.abs(r-0x24)<4 && Math.abs(gg-0x1a)<4 && Math.abs(b-0x10)<4);
    for (let y=0;y<CH-2;y++) for (let x=0;x<CW-2;x++){
      const i=(y*(CW-2)+x)*4;
      if (esFondo(d[i],d[i+1],d[i+2])) continue;
      if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y;
      lum.push([y, x, 0.299*d[i]+0.587*d[i+1]+0.114*d[i+2], d[i], d[i+1], d[i+2]]);
    }
    const ancho = x1<x0?0:(x1-x0+1), alto = y1<y0?0:(y1-y0+1);
    // cuantos renglones tocan las patas (por debajo del cuerpo) y donde esta la fila mas clara
    let bajoCuerpo = 0, pxBajo = 0, arriba=null, abajo=null, luzAntesQueSombra=false;
    if (ancho){
      const porR = {};
      for (const [y,x,L] of lum) { (porR[y]=porR[y]||[]).push(L); }
      const conteo = Object.keys(porR).map(k=>[+k, porR[k].length]).sort((a,b)=>b[1]-a[1]);
      const cuerpoAncho = conteo.length? conteo[0][0] : 0;
      for (const [k,v] of Object.entries(porR)) if (+k > cuerpoAncho+2) { bajoCuerpo++; pxBajo += v.length; }
      // LA FIRMA DEL BLOQUE en el abdomen: al bajar por el cuerpo la luminancia primero sube (la
      // cara de luz) y luego baja (el canto de sombra). Se mide en la franja de columnas del bulto,
      // no en los extremos del bounding box: arriba caen las antenas, oscuras a proposito.
      const cA = x0 + Math.round(ancho*0.06), cB = x0 + Math.round(ancho*0.40);
      const banda = lum.filter(q => q[1]>=cA && q[1]<=cB);
      const porY = {};
      for (const q of banda) (porY[q[0]] = porY[q[0]]||[]).push(q[2]);
      const ys = Object.keys(porY).map(Number).sort((a,b)=>a-b);
      if (ys.length>3){
        const med = (n) => { const v=[]; for(let k=0;k<2;k++){ const a=porY[n(k)]; if(a) v.push(...a); } return v.reduce((p,c)=>p+c,0)/Math.max(1,v.length); };
        arriba = med(k=>ys[k]); abajo = med(k=>ys[ys.length-1-k]);
        let imax=ys[0], imin=ys[0];
        for (const y of ys){ const v=porY[y], m=v.reduce((a,b)=>a+b,0)/v.length; if(m>porY[imax].reduce((a,b)=>a+b,0)/porY[imax].length) imax=y; if(m<porY[imin].reduce((a,b)=>a+b,0)/porY[imin].length) imin=y; }
        luzAntesQueSombra = imax < imin;
      }
    }
    const busca = (hex) => {
      const r=parseInt(hex.slice(1,3),16), gg=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
      return lum.filter(p => Math.abs(p[3]-r)<10 && Math.abs(p[4]-gg)<10 && Math.abs(p[5]-b)<10).length;
    };
    return { ancho, alto, y0, bajoCuerpo, pxBajo, arriba, abajo, luzAntesQueSombra, px: lum.length,
      cian: busca('#00e5ff'), rojo: busca('#ff3b30'), oro: busca('#ffcc00'), violeta: busca('#b47aff'), amarillo: busca('#fff8dc') };
  };
  const res = [];
  const filaDe = {};
  for (let i=0;i<filas.length;i++){
    const [nombre, ant] = filas[i];
    const esAnthro = nombre.indexOf('antropomorfa')>=0;
    const esMini = nombre === 'mini (mapa)';                 // 'minim' tambien contiene 'mini': no vale el indexOf
    const escala = ant.isQueen? 1.75 : (ant.caste==='major'? 1.3 : ant.caste==='minim'? 0.82 : 1);
    const esAnthro2 = false;
    for (const [fila, extra] of [[0, false],[1, true]]) {
      if (esAnthro) { useAnthro = true; }
      // dos pasadas: con los contadores y sin ellos, para medir los trazos aparte
      g.fillStyle='#241a10'; g.fillRect(i*CW, fila*CH, CW, CH);
      g.save(); g.translate(i*CW+CW/2-2, fila*CH+CH/2+2);
      window.__trazos = window.__trazos || {stroke:0, arc:0, img:0, rect:0};
      let r = {trazos: window.__trazos};
      if (fila===0){
        _hormigaVoxel(g, ant, esMini? escala*0.6 : escala, esMini, i);
      } else {
          _hormigaVoxel(g, ant, esMini? escala*0.6 : escala, esMini, i);
      }
      g.restore();
      if (esAnthro) { useAnthro = ANTES_ANTHRO; }
      res.push({ nombre, mide: mide(i*CW, fila*CH), trazos: {stroke:window.__trazos.stroke, arc:window.__trazos.arc, img:window.__trazos.img, rect:window.__trazos.rect}, i, fila });
    }
  }
  const url = cv.toDataURL('image/png');
  return { res: res.filter(r=>r.i>=0), url, tienePintor: typeof _hormigaVoxel==='function', pngs: (typeof antWalk6!=='undefined') };
})()`;

(async () => {
  await new Promise(r => server.listen(PORT, '0.0.0.0', r));
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 780 });
  const errs = [];
  const pics = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|autoplay|AudioContext/.test(m.text())) errs.push('console: ' + m.text().slice(0, 150)); });
  page.on('request', r => { if (/\.png|\.jpg|\.svg/i.test(r.url())) pics.push(path.basename(r.url().split('?')[0])); });

  await page.goto(`http://127.0.0.1:${PORT}/ant-farm-rpg/index.html`, { waitUntil: 'load', timeout: 40000 });
  await page.waitForFunction('typeof window.topoShowMainMenu==="function" || window._topoFlowReady===true', { timeout: 20000 }).catch(() => { });
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) { } });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction('typeof window.topoShowMainMenu==="function" || window._topoFlowReady===true', { timeout: 20000 }).catch(() => { });
  const pngsHormiga = pics.filter(n => /ant-|queen-/.test(n));
  ok(pngsHormiga.length === 0, 'los cinco PNG de cuerpo ya no se piden al arrancar', 'pngs: ' + (pics.join(',') || 'ninguna imagen'));

  await page.evaluate(() => { const b = document.getElementById('btnMainCreate'); if (b) b.click(); }); await sleep(600);
  await page.evaluate(() => { const b = document.querySelector('#createSizeScreen [data-size="small"]'); if (b) b.click(); }); await sleep(600);
  await page.evaluate(() => { const h = document.querySelector('.topo-dialog-host'); if (!h) return; const b = [...h.querySelectorAll('button')].find(x => /ENTENDER|EMPEZAR|SALTO|DESTRABAR/.test(x.textContent)); if (b) b.click(); });
  try { await page.waitForFunction('window.COLS===48 && window.ROWS===28', { timeout: 40000 }); } catch (e) { }
  await page.evaluate(() => { const b = document.getElementById('btnOnboardingStart'); if (b) b.click(); });
  await sleep(900);

  // contadores de primitivas de trazo, para que nadie vuelva a meter un circulo en el pintor
  await page.evaluate(() => {
    const P = CanvasRenderingContext2D.prototype;
    window.__trazos = { stroke: 0, arc: 0, img: 0, rect: 0 };
    for (const [k, n] of [['stroke', 'stroke'], ['strokeRect', 'stroke'], ['arc', 'arc'], ['ellipse', 'arc'], ['drawImage', 'img'], ['fillRect', 'rect']]) {
      const f = P[k]; if (!f) continue;
      P[k] = function () { window.__trazos[n]++; return f.apply(this, arguments); };
    }
  });

  const R = await page.evaluate(TIRA);
  const por = {};
  // de cada fila nos quedamos con la pasada que toca (la 2a es la que prueba el modo antropo)
  for (const r of R.res) if (!(r.nombre in por) || r.fila===1) por[r.nombre] = r;
  ok(R.tienePintor === true, 'el juego expone _hormigaVoxel (la prueba pinta con el suyo, no con una copia)');
  ok(R.pngs === false, 'las variables de los PNG (antWalk6 y cia.) desaparecieron del codigo');

  const M = (n) => por[n].mide, T = (n) => por[n].trazos;
  const sinTrazos = Object.values(por).every(r => r.trazos.stroke === 0 && r.trazos.arc === 0 && r.trazos.img === 0);
  ok(sinTrazos, 'una hormiga se pinta SOLO con rectangulos: cero trazos, cero circulos, cero imagenes',
    'rellenos por hormiga: ' + (M('media andando').rect ?? T('media andando').rect));

  for (const n of Object.keys(por)) ok(M(n).ancho > 6 && M(n).alto > (n==='mini (mapa)'?3:5), '  · ' + n + ': hay bulto dibujado', M(n).ancho + 'x' + M(n).alto + ' px, ' + M(n).px + ' px pintados');

  // tamano por caste: se tiene que VER, no leer en una tabla
  ok(M('minim').ancho < M('media andando').ancho, 'la minim es mas chica que la media', M('minim').ancho + ' < ' + M('media andando').ancho + ' px de ancho');
  ok(M('major (soldado)').ancho > M('media andando').ancho, 'la soldadora es mas grande que la media', M('major (soldado)').ancho + ' > ' + M('media andando').ancho + ' px');
  ok(M('reina').ancho > M('major (soldado)').ancho, 'la reina es la mas grande del nido', M('reina').ancho + ' px de ancho');
  ok(M('mini (mapa)').ancho <= Math.ceil(M('media andando').ancho * 0.72), 'en el mapa de bolsillo la silueta se encoge (y no gasta patas)', M('mini (mapa)').ancho + ' vs ' + M('media andando').ancho + ' px');

  // la firma del mundo: fila de arriba mas clara que la de abajo
  const firma = ['media andando', 'reina', 'major (soldado)', 'durmiendo'].every(n => M(n).luzAntesQueSombra);
  ok(firma, 'cara de luz arriba y canto de sombra abajo, la firma del terreno',
    'arriba ' + (M('media andando').arriba||0).toFixed(0) + ' / abajo ' + (M('media andando').abajo||0).toFixed(0));

  // estados legibles sin letras
  ok(M('durmiendo').alto <= M('media andando').alto, 'durmiendo se encoge (menos alto, patas recogidas)', M('durmiendo').alto + ' vs ' + M('media andando').alto + ' px de alto');
  ok(M('durmiendo').px !== M('media andando').px, 'dormida y despierta son dibujos distintos, no el mismo con una letra', M('durmiendo').px + ' px vs ' + M('media andando').px + ' px');
  ok(M('con carga').px > M('media andando').px, 'la que carga algo tiene mas bulto (la carga es parte del cuerpo)', '+' + (M('con carga').px - M('media andando').px) + ' px');
  ok(M('cavando').y0 !== M('media andando').y0, 'cavando se agacha: el bulto entero esta en otra fila', 'y0 ' + M('cavando').y0 + ' vs ' + M('media andando').y0);
  ok(M('media andando').bajoCuerpo >= 2, 'las patas se pintan por debajo del cuerpo', M('media andando').bajoCuerpo + ' renglones de patas');
    ok(M('durmiendo').pxBajo < M('media andando').pxBajo, 'durmiendo recoge las patas (menos renglon por debajo del cuerpo)', M('durmiendo').pxBajo + ' px vs ' + M('media andando').pxBajo + ' px por debajo');

  // senales de oficio y de realeza
  ok(M('major (soldado)').rojo >= 3, 'la franja de EXCAVADORA esta pintada en rojo', M('major (soldado)').rojo + ' px');
  ok(M('media andando').cian === 0 && M('media andando').oro >= 3, 'la forrajera lleva su franja de miel y no la de exploradora', M('media andando').oro + ' px de oro');
  ok(M('reina').oro >= 6, 'la reina lleva la corona de oro', M('reina').oro + ' px');
  ok(M('antropomorfa').alto > M('media andando').alto + 4, 'el modo antropo se pone de pie (mas alto, dos piernas)', M('antropomorfa').alto + ' vs ' + M('media andando').alto + ' px de alto');

  // en el cuadro real: recorte por camara
  const recorte = await page.evaluate(async () => {
    try { window._fakes(26); } catch (e) { }
    await new Promise(r => requestAnimationFrame(r));
    let llamadas = 0, visibles = 0;
    const o = window._hormigaVoxel;
    window._hormigaVoxel = function () { llamadas++; return o.apply(this, arguments); };
    view.zoom = 4; view.x = workers[0].x - 160; view.y = workers[0].y - 100;
    for (let w of workers) { visibles += (w._renderX > view.x - 44 && w._renderX < view.x + 320 + 44 && w._renderY > view.y - 44 && w._renderY < view.y + 200 + 44) ? 1 : 0; }
    await new Promise(r => setTimeout(r, 620));
    window._hormigaVoxel = o;
    return { llamadas, cuadros: Math.max(1, Math.round(620 / 20)), visibles, colonia: workers.length };
  });
  const porCuadro = Math.round(recorte.llamadas / Math.max(1, recorte.cuadros));
  ok(recorte.colonia > recorte.visibles + 2, 'hay colonias enteras fuera del encuadre', recorte.visibles + ' de ' + recorte.colonia + ' caben en la camara');
  ok(porCuadro < recorte.colonia, 'y no se llama al pintor por todas: el recorte funciona', porCuadro + ' llamadas/cuadro para ' + recorte.colonia + ' hormigas');

  // el lienzo del juego sigue sin pedir imagens de bicho
  const pngsAhora = pics.filter(n => /ant-|queen-|walk6|idle4|dig4|rest2/.test(n));
  ok(pngsAhora.length === 0, 'ni una peticion de sprite de hormiga en toda la partida', pics.length + ' imagenes pedidas en total');

  const err = errs.filter(e => !/favicon|autoplay|AudioContext/.test(e));
  ok(err.length === 0, 'cero errores de JavaScript con el pintor nuevo', err.slice(0, 2).join(' | '));

  // la tira, para mirarla (la regla de la casa: despues de medir, mirar)
  const b64 = R.url.replace(/^data:image\/png;base64,/, '');
  fs.writeFileSync('/tmp/antfarm-capturas/hormiga-tira.png', Buffer.from(b64, 'base64'));
  console.log('\n  tira de muestras: /tmp/antfarm-capturas/hormiga-tira.png');
  console.log('  medidas: ' + Object.entries(por).map(([k, v]) => k + ' ' + v.mide.ancho + 'x' + v.mide.alto).join(' · '));

  console.log('\n' + pass + ' ok · ' + failn + ' FALLOS');
  await browser.close(); server.close();
  if (failn) process.exitCode = 1;
})().catch(e => { console.log('PRUEBA ROTA: ' + e.message); console.log(e.stack.split('\n').slice(1, 4).join('\n')); try { server.close(); } catch (x) { } process.exit(1); });
