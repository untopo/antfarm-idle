/**
 * plantas-piso.js - nada crece donde no hay superficie apropiada, medido en CHROME real.
 *
 * El dueño lo dijo viendo la pantalla: «veo que las plantitas estan creciendo en el aire; si no hay pasto
 * o tierra o una superficie apropiada para que algo crezca, no deberia crecer nada». El caso exacto es la
 * casilla de tierra de la superficie intacta pero la de debajo calada (una galeria que pasa rozando el
 * cesped, o la boca del nido): la franja de hierba de Terraria no se pinta ahi - y la mata si se plantaba,
 * porque el unico requisito era `soil[SURFACE_ROW][c]===1`.
 *
 * Aqui se mide el reglon completo, con las funciones de verdad del juego (no una copia):
 *
 *   - la regla del pie, en un solo sitio para la siembra, la expansion, el crecimiento y el dibujo;
 *   - que donde no hay tierra debajo NO prende ni una semilla, y donde si, si;
 *   - que la que ya estaba puesta no desaparece de golpe: se seca (crecimiento que cae y color de paja,
 *     medido en los rectangulos que el lienzo recibe), y luego se va;
 *   - que a la que si tiene tierra no la toca nadie (que esto no se ha convertido en segadora);
 *   - la seta de tunele, que necesita suelo debajo, y el jardin de hongo, que necesita lecho;
 *   - y que un mundo de cuatro dias jugado a x16 no tiene NI UNA planta colgando sin secarse.
 *
 * Las capturas van a /tmp/antfarm-capturas (el taller no acumula imagenes; GitHub es el almacen).
 *
 *   node test/plantas-piso.js
 */
const http = require('http');
const fs = require('fs');
fs.mkdirSync('/tmp/antfarm-capturas', { recursive: true });
const path = require('path');
const puppeteer = require('puppeteer');
const ROOT = path.resolve(__dirname, '..');
const PORT = 8155;
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

// la foto de las plantas, desde dentro del modulo (los nombres de arriba son del propio juego)
const FOTO = `(()=>plants.map(p=>({c:p.c, x:Math.round(p.x), r:p.rr, cr:p.cr, cave:!!p.cave, g:+p.growth.toFixed(4), seca:!!p.seca,
  pie: p.cave? _pieCueva(p.cr!==undefined?p.cr:p.c, p.rr) : _pieSuperficie(p.c),
  arriba: p.cave? null : (soil[SURFACE_ROW][p.c]!==0), debajo: p.cave? null : (soil[SURFACE_ROW+1][p.c]!==0)})))`;

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
    if (abierto) break;
    await sleep(250);
  }
  await page.waitForFunction("document.body.classList.contains('game-started')", { timeout: 15000 }).catch(() => { });
  await sleep(900);

  // el gancho: grabadora de rectangulos del lienzo (para ver de que color se pinta la mata que se seca)
  await page.evaluate(`(()=>{
    const cv=document.getElementById('farmCanvas'), g=cv.getContext('2d');
    window.__g = { rects:[], on:false };
    const _fr=g.fillRect.bind(g);
    g.fillRect=function(x,y,w,h){ if(window.__g.on) window.__g.rects.push([Math.round(x),Math.round(y),Math.round(w),Math.round(h),String(g.fillStyle).replace(/\\s+/g,'')]); return _fr(x,y,w,h); };
    window.__frame=(n,vel)=>new Promise(r=>{ paused=false; gameSpeed=vel||1; let k=0;
      const f=()=>{ if(++k<(n||2)) requestAnimationFrame(f); else r(1); }; requestAnimationFrame(f); });
    window.__foto=${FOTO};
    window.__abrir=(c)=>{ soil[SURFACE_ROW+1][c]=0; soilType[SURFACE_ROW+1][c]=0; markSoilDirty(c,SURFACE_ROW+1); };
    window.__llenar=(c)=>{ soil[SURFACE_ROW+1][c]=1; soilType[SURFACE_ROW+1][c]=1; markSoilDirty(c,SURFACE_ROW+1); };
  })()`);

  console.log('\n· el caso que se veia: cesped intacto, tierra calada debajo');
  const siembra = await page.evaluate(`(()=>{
    // tres columnas con la superficie en su sitio y el hueco abierto debajo (la boca de una galeria), y
    // tres de control al lado, con tierra debajo de verdad
    const malas=[], buenas=[];
    for(let c=6;c<COLS-6;c++){
      if(soil[SURFACE_ROW][c]!==1 || soil[SURFACE_ROW+1][c]!==1 || fertility[c]<0.55) continue;
      if(getPlantAt(c)) continue;
      if(buenas.length<3) buenas.push(c);
      else if(malas.length<3){ malas.push(c); }
      if(malas.length>=3 && buenas.length>=3) break;
    }
    for(const c of malas){ soil[SURFACE_ROW+1][c]=0; soilType[SURFACE_ROW+1][c]=0; }
    for(const c of [...malas,...buenas]) for(const p of plants.filter(p=>p.c===c)) plants.splice(plants.indexOf(p),1);
    return {malas, buenas};
  })()`);
  ok(siembra.malas.length >= 2 && siembra.buenas.length >= 2, 'hay columnas preparadas de los dos tipos', `sin tierra debajo: ${siembra.malas.join(',')} · con tierra: ${siembra.buenas.join(',')}`);

  const plantadas = await page.evaluate(`(()=>{
    const MAL=${JSON.stringify(siembra.malas)}, BUEN=${JSON.stringify(siembra.buenas)};
    const antes = plants.length;
    for(let i=0;i<600;i++){ try{ spawnNaturalPlant(); }catch(e){ return {err:e.message, antes, despues:plants.length, enMalas:-1, enBuenas:-1}; } }
    return {antes, despues:plants.length, err:null,
            enMalas: plants.filter(p=>MAL.indexOf(p.c)>=0).length,
            enBuenas: plants.filter(p=>BUEN.indexOf(p.c)>=0).length};
  })()`);
  ok(plantadas.enMalas === 0, '600 intentos de siembra y NO prende ni una en la columna sin tierra debajo', `${plantadas.enMalas} plantas en ${siembra.malas.length} columnas caladas`);
  ok(plantadas.enBuenas > 0, 'y en la columna con tierra si prende (que no es un apagon general)', `${plantadas.enBuenas} plantas en ${siembra.buenas.length} columnas sanas`);
  const despuesDeSembrar = await page.evaluate(`window.__foto().map(p=>p.c+':'+(p.pie?'pie':'AIRE')).join(' ')`);
  ok(!/AIRE/.test(despuesDeSembrar), 'ninguna de las plantas del mapa esta ahora mismo sin pie', `${despuesDeSembrar.split(' ').length} plantas en el mapa, todas con tierra debajo`);

  console.log('\n· la que ya estaba puesta se seca delante de la camara');
  // elegimos una planta con pie y le calamos el suelo debajo, con el juego corriendo
  const objetivo = await page.evaluate(`(()=>{ const p = plants.find(p=>p.pie!==false && _pieSuperficie(p.c) && p.growth>0.45) || plants.find(p=>_pieSuperficie(p.c));
    if(!p) return null; return {c:p.c, x:p.x, g:p.growth, tipo:p.type}; })()`);
  ok(!!objetivo, 'hay una mata madura con la tierra debajo intacta para medir con ella', objetivo ? `columna ${objetivo.c} · ${objetivo.tipo} · crecimiento ${objetivo.g.toFixed(2)}` : 'ninguna');
  const testigo = await page.evaluate(`(()=>{ const p=plants.find(q=>q.c!==${objetivo.c} && _pieSuperficie(q.c) && q.growth>0.4); return p? {c:p.c, g:p.growth}:null; })()`);
  // color que pinta la mata ANTES de calarle el suelo (verde de la estacion)
  const pintaAntes = await page.evaluate(`(async()=>{
    window.__g.rects.length=0; window.__g.on=true; await window.__frame(3); window.__g.on=false;
    const rs=window.__g.rects.filter(r=> r[0]>=${objetivo.x}-10 && r[0]<=${objetivo.x}+12 && r[1]>=SURFACE_Y-46 && r[1]<=SURFACE_Y-8);
    const cuenta={}; for(const r of rs){ const n=parseInt(r[4].slice(1),16); if(isNaN(n)) continue; const rr=(n>>16)&255, gg=(n>>8)&255, bb=n&255; if(gg<40||gg<rr) continue; cuenta.verde=(cuenta.verde||0)+1; }
    return {n:rs.length, verde:(cuenta.verde||0)};
  })()`);
  await page.evaluate(`soil[SURFACE_ROW+1][${objetivo.c}]=0; soilType[SURFACE_ROW+1][${objetivo.c}]=0; markSoilDirty(${objetivo.c},SURFACE_ROW+1);`);
  const tras = await page.evaluate(`(async()=>{ await window.__frame(40,16);
    const p = plants.find(p=>p.c===${objetivo.c}); return {seca: p? !!p.seca : null, g: p? +p.growth.toFixed(4): null, sigue: !!p}; })()`);
  ok(tras.seca === true, 'en cuanto le calan la casilla de debajo la mata se marca como seca', `sigue en el mapa: ${tras.sigue} · crecimiento ${tras.g} (antes ${objetivo.g.toFixed(4)})`);
  ok(tras.g !== null && tras.g < objetivo.g, 'y su crecimiento BAJA (antes subia: eso era lo de "crecen en el aire")', `${objetivo.g.toFixed(4)} -> ${tras.g}`);
  const pintaDespues = await page.evaluate(`(async()=>{
    window.__g.rects.length=0; window.__g.on=true; await window.__frame(3); window.__g.on=false;
    const rs=window.__g.rects.filter(r=> r[0]>=${objetivo.x}-10 && r[0]<=${objetivo.x}+12 && r[1]>=SURFACE_Y-46 && r[1]<=SURFACE_Y-8);
    let seco=0; for(const r of rs){ const h=r[4]; if(h[0]!=='#') continue; const n=parseInt(h.slice(1),16); const rr=(n>>16)&255, gg=(n>>8)&255; if(rr>gg) seco++; }
    return {n:rs.length, seco};
  })()`);
  ok(pintaDespues.seco > 0, 'y se la ve ponerse de color paja en el lienzo (rojo por encima del verde: se seca, no crece)', `${pintaDespues.seco} rectangulos secos de ${pintaDespues.n} pintados · antes: ${pintaAntes.verde} verdes de ${pintaAntes.n}`);
  const desaparece = await page.evaluate(`(async()=>{ for(let i=0;i<150;i++){ await window.__frame(10,16); if(!plants.some(p=>p.c===${objetivo.c})) return {i:i*10, fuera:true}; } return {fuera:false}; })()`);
  ok(desaparece.fuera === true, 'y al final se cae: deja de estar en el mapa', `despues de ${desaparece.i} cuadros a x16`);
  if (testigo) {
    const trasTestigo = await page.evaluate(`(()=>{ const p=plants.find(q=>q.c===${testigo.c}); return p? {seca:!!p.seca, g:+p.growth.toFixed(4)} : null; })()`);
    ok(trasTestigo && trasTestigo.seca === false && trasTestigo.g >= testigo.g - 0.001, 'a la vecina que si tiene tierra no la toca: sigue viva y creciendo', `${testigo.g.toFixed(3)} -> ${trasTestigo ? trasTestigo.g : 'perdida'} · seca ${trasTestigo ? trasTestigo.seca : '-'}`);
  }

  console.log('\n· la seta de tunele y el jardin de hongo, con la misma vara de medir');
  const seta = await page.evaluate(`(async()=>{
    // La camara se CAVA para la prueba, no se busca a ver si el nido la tiene hecha: medir si la seta
    // necesita suelo debajo no depende de la forma que el azar le dio al nido de turno (en el lote completo
    // toco un mundo sin ningun hueco con techo y suelo y las tres lineas de abajo salian undefined).
    let puesto=null;
    for(let r=SURFACE_ROW+5;r<ROWS-2 && !puesto;r++) for(let c=2;c<COLS-2 && !puesto;c++){
      const duro=(r,c2)=>soil[r] && soil[r][c2]!==0 && (!soilType[r] || soilType[r][c2]!==7);
      if(!duro(r-1,c) || !duro(r+1,c)) continue;                     // techo y suelo tienen que ser macizos, y la roca madre no vale
      soil[r][c]=0; if(soilType[r]) soilType[r][c]=0;
      plants.push({c, x:c*CELL+8, y:r*CELL+14, type:'caveMush', growth:0.8, maxGrowth:1, age:0, fruitCooldown:DAY_LENGTH*0.5, variant:0, cave:true, cr:c, rr:r});
      puesto={c,r};
    }
    if(!puesto) return {puesto:null};
    markSoilDirty(puesto.c,puesto.r); markSoilDirty(puesto.c,puesto.r-1); markSoilDirty(puesto.c,puesto.r+1);
    await window.__frame(20,16);
    const conSuelo = plants.find(p=>p.cave && p.cr===puesto.c && p.rr===puesto.r);
    const antes = conSuelo? conSuelo.growth : null;
    // y ahora le cavamos el suelo
    soil[puesto.r+1][puesto.c]=0; soilType[puesto.r+1][puesto.c]=0; markSoilDirty(puesto.c,puesto.r+1);
    await window.__frame(20,16);
    const despues = plants.find(p=>p.cave && p.cr===puesto.c && p.rr===puesto.r);
    const fuera = !despues;
    let cuadros=0;
    for(let i=0;i<150 && !fuera;i++){ await window.__frame(10,16); cuadros+=10; if(!plants.some(p=>p.cave && p.cr===puesto.c && p.rr===puesto.r)) break; }
    return {puesto, antes, seca: despues? !!despues.seca : null, g: despues? +despues.growth.toFixed(4): null, cuadros};
  })()`);
  ok(seta.puesto !== null, 'la camara de prueba se cava con techo y suelo macizos', seta.puesto ? `[${seta.puesto.c},${seta.puesto.r}]` : 'el mundo no da para cavarla');
  ok(seta.antes !== null && seta.antes >= 0.79 - 0.001, 'con suelo debajo la seta se queda y no se marca como seca', `crecimiento ${seta.antes} tras 20 cuadros`);
  ok(seta.seca === true || seta.g === null, 'y en cuanto le cavan el suelo deja de valer: se seca o se cae', `seca ${seta.seca} · crecimiento ${seta.g} · fuera a los ${seta.cuadros} cuadros`);
  const jardin = await page.evaluate(`(async()=>{
    const f = fungusGardens.find(f=>soil[f.r+1] && soil[f.r+1][f.c]!==0) || fungusGardens[0];
    if(!f) return {nada:true};
    const antes = +f.health.toFixed(4);
    soil[f.r+1][f.c]=0; soilType[f.r+1][f.c]=0; markSoilDirty(f.c,f.r+1);
    await window.__frame(40,16);
    const despues = fungusGardens.find(g=>g.x===f.x && g.y===f.y);
    return {antes, despues: despues? +despues.health.toFixed(4): null, fuera:!despues};
  })()`);
  ok(jardin.nada === true || jardin.fuera === true || (jardin.despues !== null && jardin.despues < jardin.antes),
    'el jardin de hongo tambien necesita su lecho: sin suelo de debajo se apaga', jardin.nada ? 'no hay jardin en estas condiciones' : `salud ${jardin.antes} -> ${jardin.despues} · fuera ${jardin.fuera}`);

  console.log('\n· un mundo jugado, y el invariante');
  const corrida = await page.evaluate(`(async()=>{
    await window.__frame(260,16);
    const foto = window.__foto();
    const malas = foto.filter(p=>!p.pie && !p.seca);
    const pintadasAire = foto.filter(p=>!p.cave && !p.arriba).length;
    return {n:foto.length, malas:malas.length, ejemplo:malas.slice(0,3).map(p=>p.c+':'+p.g.toFixed(2)).join(' '),
            flotandoSinSecar: foto.filter(p=>p.cave && !p.pie && !p.seca).length, jardines:fungusGardens.length, dia:day, sinSuperficie:pintadasAire};
  })()`);
  ok(corrida.malas === 0, 'y en un mundo jugado 260 cuadros a x16 no queda NI UNA planta colgando sin secarse', `${corrida.n} plantas · las que perdieron el pie estan en seco · dia ${corrida.dia}`);
  ok(corrida.flotandoSinSecar === 0, 'y ninguna seta de tunele tampoco (sin suelo debajo, se seca)', `${corrida.flotandoSinSecar} setas colgando`);
  ok(corrida.sinSuperficie === 0, 'ni una mata plantada sobre una casilla de la superficie que ya no existe', `${corrida.sinSuperficie} sobre superficie inexistente`);
  ok(errs.length === 0, 'cero errores de javascript', errs.slice(0, 3).join(' | '));

  await page.screenshot({ path: '/tmp/antfarm-capturas/plantas-piso.png' });
  console.log(`\n${pass} ok · ${failn} FALLOS\n`);
  await browser.close();
  server.close();
  process.exit(failn ? 1 : 0);
})().catch(e => { console.error('estallo el test:', e && e.stack || e); try { server.close(); } catch (_) { } process.exit(2); });
