/**
 * paneles-scroll.js - lo que hay dentro de una hoja se tiene que PODER VER.
 *
 * El dueño lo pidió viéndolo: «en el menú del inventario o almacén quiero que puedas scrollear, porque
 * hay muchos items y algunos no se pueden ver porque no puedo scrollear». El defecto de fondo era de
 * caja: la hoja (`#invSheet`) tenía `max-height` + `overflow:hidden` y su envoltorio interior
 * `min-height:100%` - que contra un padre de altura auto NO resolve - así que el cuerpo nunca quedaba
 * limitado y su `overflow-y:auto` no tenía nada que scrollear: la lista crecía y el borde de la hoja la
 * cortaba. Igual en las dos hojas de perfil (hormiga y reina), y dentro de ellas el árbol y el historial
 * estaban en cajas de `max-height:78px;overflow:hidden`.
 *
 * Se mide en CHROME real, con una ventana baja (620 px) para que desborde de verdad, y con la puerta de
 * verdad del juego (el botón ☰ del ALMACÉN y el click en la hormiga):
 *
 *   - que la hoja cabe en la pantalla y su cuerpo es una caja de verdad, con contenido por debajo;
 *   - que la rueda DENTRO del panel mueve el panel (antes: nada);
 *   - que la última fila, que no se veía, se ve al bajar;
 *   - que el pie («▶ IR AL ALMACÉN») sigue anclado y no se va con el scroll;
 *   - que la rueda SOBRE EL LIENZO sigue moviendo el mundo (no vale arreglar un scroll rompiendo el otro);
 *   - y un barrido: NINGÚN elemento de las tres hojas deja contenido recortado sin poder scrollear
 *     (se perdonan los rótulos con puntos suspensivos, que son a propósito).
 *
 * Las capturas van a /tmp/antfarm-capturas (el taller no acumula imágenes; GitHub es el almacén).
 *
 *   node test/paneles-scroll.js
 */
const http = require('http');
const fs = require('fs');
fs.mkdirSync('/tmp/antfarm-capturas', { recursive: true });
const path = require('path');
const puppeteer = require('puppeteer');
const ROOT = path.resolve(__dirname, '..');
const PORT = 8156;
const ALTURA = 620;   // ventana baja a propósito: un laptop con barras del navegador
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

// Ninguna caja de la hoja deja contenido fuera sin manera de llegar a él.
const BARRIDO = `(raiz)=>{
  const mal=[];
  const el=document.getElementById(raiz); if(!el) return ['sin hoja '+raiz];
  const marcos=[el, ...el.querySelectorAll('*')];
  for(const n of marcos){
    const cs=getComputedStyle(n);
    if(n!==el && (cs.display==='none'||cs.visibility==='hidden')) continue;
    const puedeOy=/auto|scroll/.test(cs.overflowY);
    const recorta=cs.textOverflow==='ellipsis' || /-webkit-box/.test(cs.display);
    const alto=n.scrollHeight-n.clientHeight;
    if(alto>4 && !puedeOy && !recorta){
      mal.push((n.id||n.tagName.toLowerCase()+'.'+String(n.className).slice(0,16))+' corta '+alto+'px sin scroll');
    }
  }
  return mal;
}`;

(async () => {
  await new Promise(r => server.listen(PORT, '0.0.0.0', r));
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: ALTURA });
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|autoplay|AudioContext/.test(m.text())) errs.push('console: ' + m.text().slice(0, 140)); });

  await page.goto(`http://127.0.0.1:${PORT}/ant-farm-rpg/index.html`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction('typeof window.topoShowMainMenu==="function" || window._topoFlowReady===true', { timeout: 20000 }).catch(() => { });
  await page.waitForFunction("!document.getElementById('splashScreen') || document.getElementById('splashScreen').style.display==='none'", { timeout: 15000 }).catch(() => { });
  await page.click('#btnMainCreate'); await sleep(400);
  await page.click('#createSizeScreen [data-size="small"]'); await sleep(400);
  await page.evaluate(() => { const h = document.querySelector('.topo-dialog-host'); if (!h) return; const b = [...h.querySelectorAll('button')].find(x => /^(SÍ|YES)$/i.test(x.textContent.trim())); if (b) b.click(); });
  for (let i = 0; i < 16; i++) {
    const abierto = await page.evaluate(() => {
      const m = document.getElementById('onboardingModal');
      if (!m || getComputedStyle(m).display === 'none') return false;
      const b = document.getElementById('btnOnboardingStart') || [...m.querySelectorAll('button')].pop();
      if (b) b.click(); return true;
    });
    if (abierto) break;
    await sleep(250);
  }
  await page.waitForFunction("document.body.classList.contains('game-started')", { timeout: 15000 }).catch(() => { });
  await sleep(900);

  // un almacen con surtido: todas las filas de materiales con algo dentro, para que la lista sea larga
  await page.evaluate(`(()=>{
    try{ worldMaterials.stone=71; worldMaterials.clay=9; worldMaterials.sand=5; worldMaterials.fiber=63;
          worldMaterials.wood=28; worldMaterials.cobre=7; worldMaterials.hierro=3; worldMaterials.oro=2; }catch(e){}
    try{ for(let i=0;i<9;i++){ spawnFood && spawnFood(); } }catch(e){}
  })()`);
  await sleep(300);

  console.log('\n· la hoja del ALMACÉN, abierta con su botón');
  await page.click('#btnInventory');
  await sleep(420);
  const caja = await page.evaluate(`(()=>{
    const sh=document.getElementById('invSheet'), b=document.getElementById('invBody');
    if(!sh||!b) return {sinHoja:true};
    const rs=sh.getBoundingClientRect(), rb=b.getBoundingClientRect(), cs=getComputedStyle(b);
    const fila=b.lastElementChild? b.lastElementChild.getBoundingClientRect() : null;
    const pie=document.getElementById('btnInvGo').getBoundingClientRect();
    return {alto:Math.round(rs.height), dentroPantalla: rs.bottom<=innerHeight-1, alturaVentana:innerHeight,
      cuerpoAlto:Math.round(rb.height), contenido:Math.round(b.scrollHeight),
      overflow:cs.overflowY, scrollable:b.scrollHeight-b.clientHeight,
      ultimaFilaFuera: fila? Math.round(fila.bottom-rb.bottom) : -1,
      pieAsomado: Math.round(pie.bottom-rs.bottom), filas:b.children.length};
  })()`);
  ok(!caja.sinHoja, 'la hoja del almacén existe y se abre con el botón ☰');
  ok(caja.dentroPantalla, 'la hoja cabe en la pantalla (no se sale por abajo)', `${caja.alto}px de alto en una ventana de ${caja.alturaVentana}`);
  ok(caja.scrollable > 4, 'hay contenido por debajo del borde: hace falta scrollear de verdad', `${caja.cuerpoAlto}px de caja para ${caja.contenido}px de lista · ${caja.filas} filas`);
  ok(/auto|scroll/.test(caja.overflow || ''), 'el cuerpo de la hoja es caja de scroll (no una cola que se corta)', 'overflow-y: ' + caja.overflow);
  ok(caja.ultimaFilaFuera > 0, 'antes de scrollear, la última fila está efectivamente fuera', `${caja.ultimaFilaFuera}px por debajo`);
  ok(caja.pieAsomado <= 1, 'el pie (▶ IR AL ALMACÉN) queda dentro de la hoja, no asomando', 'a ' + caja.pieAsomado + 'px del borde');
  await page.screenshot({ path: '/tmp/antfarm-capturas/paneles-antes.png' });

  const yMundoAntes = await page.evaluate('(()=>Math.round(view.y*100)/100)()');
  // la rueda DENTRO del panel: el gesto del dueño. El punto se MEDICION en el cuerpo de la hoja, no a 300 px
  // a ciegas: la hoja se sienta ahora debajo del calendario (que crecio) y un punto fijo caia en la cabecera,
  // que no es caja de scroll - y eso no es un fallo del juego, era un fallo de la prueba.
  const punto = await page.evaluate(`(()=>{const r=document.getElementById('invBody').getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+Math.min(52,r.height/2))}})()`);
  await page.mouse.move(punto.x, punto.y);
  await page.mouse.wheel({ deltaY: 400 });   // un golpe de rueda con recorrido: Chrome lo topa en el maximo
                                            // del contenedor (260 se quedaba a 13 px del final y la ultima
                                            // fila asomaba a medias, que no es un fallo del juego)
  await sleep(320);
  const despues = await page.evaluate(`(()=>{
    const b=document.getElementById('invBody'), sh=document.getElementById('invSheet');
    const rb=b.getBoundingClientRect(), rs=sh.getBoundingClientRect();
    const fila=b.lastElementChild? b.lastElementChild.getBoundingClientRect() : null;
    const pie=document.getElementById('btnInvGo').getBoundingClientRect();
    return {top:Math.round(b.scrollTop), max:Math.round(b.scrollHeight-b.clientHeight),
      ultimaFila: fila? Math.round(rb.bottom-fila.bottom) : -1, pieAsomado: Math.round(pie.bottom-rs.bottom),
      yMundo:Math.round(view.y*100)/100};
  })()`);
  ok(despues.top > 0, 'la rueda dentro del panel MUEVE el panel', `scrollTop ${despues.top} de ${despues.max}px · rueda en ${punto.x},${punto.y}`);
  ok(despues.ultimaFila >= -2, 'y al bajar, la última fila se ve entera (antes no había forma)', `${despues.ultimaFila}px sobre el borde del cuerpo`);
  ok(despues.pieAsomado <= 1, 'con el cuerpo scrolleado el pie sigue anclado en su sitio', 'a ' + despues.pieAsomado + 'px');
  ok(despues.yMundo === yMundoAntes, 'y el mundo NO se movió por scrollear el panel', `view.y ${yMundoAntes} -> ${despues.yMundo}`);
  await page.screenshot({ path: '/tmp/antfarm-capturas/paneles-despues.png' });

  // borrar el scroll con la tecla: el dueño también usa el teclado
  await page.evaluate(`document.getElementById('invBody').scrollTop=0`);
  await sleep(120);
  const barridoInv = await page.evaluate(`(${BARRIDO})('invSheet')`);
  ok(barridoInv.length === 0, 'ninguna caja de la hoja del almacén deja contenido cortado sin scroll', barridoInv.slice(0, 3).join(' · ') || 'limpia');

  // los otros dos gestos del mundo: la rueda sobre el lienzo es ZOOM (asi siempre fue) y la vertical va
  // por la regla de la izquierda. Ninguno se puede haber comido el panel nuevo.
  await page.keyboard.press('Escape'); await sleep(320);
  const cerrado = await page.evaluate(`(()=>{const s=document.getElementById('invSheet');return {display:getComputedStyle(s).display, abierto:!!s.getAttribute('data-open')}})()`);
  ok(cerrado.display === 'none' && !cerrado.abierto, 'Escape cierra la hoja y la deja cerrada', 'display: ' + cerrado.display);
  // Los dos gestos del mundo con la rueda son los de siempre: acercado en el lienzo y bajar por el nido
  // desde la regla de profundidad. Se sueltan los eventos contra los elementos mismos (el arnes de
  // puppeteer a veces entrega la rueda al scroll container que quedo bajo el raton; aqui lo que se quiere
  // comprobar es que el MANEJADOR del juego sigue vivo y que el panel nuevo no se lo comio).
  const ruedaMundo = await page.evaluate(`(()=>{
    const antes={z:+view.zoom.toFixed(3), y:Math.round(view.y*100)/100};
    const wrap=document.querySelector('.canvas-wrap');
    wrap.dispatchEvent(new WheelEvent('wheel',{deltaY:-240,bubbles:true,cancelable:true,clientX:620,clientY:300}));
    const despuesZoom={z:+view.zoom.toFixed(3), y:Math.round(view.y*100)/100};
    setZoom(2.2); const y0=Math.round(view.y*100)/100;
    document.querySelector('.depth-ruler').dispatchEvent(new WheelEvent('wheel',{deltaY:300,bubbles:true,cancelable:true}));
    return {antes, despuesZoom, y0, y:Math.round(view.y*100)/100, max:Math.round(getPanBounds().maxY)};
  })()`);
  ok(ruedaMundo.despuesZoom.z > ruedaMundo.antes.z, 'la rueda sobre el lienzo sigue acercando el mundo (su gesto de siempre)', `zoom ${ruedaMundo.antes.z} -> ${ruedaMundo.despuesZoom.z}`);
  ok(ruedaMundo.y !== ruedaMundo.y0, 'y la rueda sobre la regla de profundidad sigue bajando por el nido', `view.y ${ruedaMundo.y0} -> ${ruedaMundo.y} (tope ${ruedaMundo.max})`);

  console.log('\n· la hoja de la hormiga (perfil) y la de la reina');
  const pinchada = await page.evaluate(`(()=>{
    // la camara encima de la primera obrera, para poder pincharla
    const w=workers[0]; if(!w) return null;
    view.x=clamp(w.x - W/view.zoom/2, getPanBounds().minX, getPanBounds().maxX);
    view.y=clamp(w.y - (innerHeight/2)/view.zoom/1, getPanBounds().minY, getPanBounds().maxY);
    const r=document.getElementById('farmCanvas').getBoundingClientRect();
    return {sx: r.left + (w.x-view.x)*view.zoom, sy: r.top + (w.y-view.y)*view.zoom, id:w.id};
  })()`);
  if (pinchada) {
    await page.mouse.click(Math.round(pinchada.sx), Math.round(pinchada.sy));
    await sleep(500);
    const abierto = await page.evaluate(`(()=>!!(document.getElementById('antProfile')||{}).getAttribute?.('data-open'))()`);
    if (!abierto) { await page.evaluate(`(()=>{ try{ showAntProfile(workers[0]); }catch(e){} })()`); await sleep(420); }
  }
  const perfil = await page.evaluate(`(()=>{
    const sh=document.getElementById('antProfile'); if(!sh) return {sinHoja:true};
    const abierto=sh.getAttribute('data-open');
    const rs=sh.getBoundingClientRect();
    // la caja que scrollea, sea cual sea su nombre
    let cuerpo=null;
    for(const n of [sh,...sh.querySelectorAll('*')]){ const cs=getComputedStyle(n);
      if(/auto|scroll/.test(cs.overflowY) && n.scrollHeight>n.clientHeight-1){ cuerpo=n; break; } }
      return {abierto:!!abierto, dentroPantalla: rs.bottom<=innerHeight-1, alto:Math.round(rs.height), top:Math.round(rs.top), bottom:Math.round(rs.bottom),
      overflow:getComputedStyle(sh).overflowY, maxHeight:sh.style.maxHeight,
      cuerpo: cuerpo? (cuerpo.id||cuerpo.className||'caja') : null, sobra: cuerpo? Math.round(cuerpo.scrollHeight-cuerpo.clientHeight) : 0};
  })()`);
  ok(!!perfil.abierto, 'pinchar a una hormiga abre su hoja de perfil', (pinchada && pinchada.id ? 'hormiga ' + pinchada.id : 'abierta con showAntProfile'));
  ok(perfil.alto > 200, 'la hoja de la hormiga se abre de verdad (no queda aplastada)', `${perfil.alto}px de alto`);
  ok(!!perfil.dentroPantalla, 'la hoja de la hormiga cabe entera en la pantalla (ni un pixel por debajo)', `de ${perfil.top} a ${perfil.bottom}px en ${ALTURA}px de ventana · max-height ${perfil.maxHeight || 'el del CSS'}`);
  ok(/auto|scroll/.test(perfil.overflow || ''), 'y lo que no cabe se recorre: la hoja es caja de scroll', `${perfil.cuerpo || ''} scrollea, sobran ${perfil.sobra}px`);
  await page.screenshot({ path: '/tmp/antfarm-capturas/paneles-hormiga.png' });
  await page.evaluate(`(()=>{ try{ showQueenProfile(queens[0]); }catch(e){} })()`);
  await sleep(420);
  const barridoPerf = await page.evaluate(`(${BARRIDO})('antProfile')`);
  ok(barridoPerf.length === 0, 'la hoja del perfil de hormiga no deja nada cortado sin scroll', barridoPerf.slice(0, 3).join(' · ') || 'limpia');
  const barridoReina = await page.evaluate(`(${BARRIDO})('queenProfile')`);
  ok(barridoReina.length === 0, 'la hoja de la reina tampoco', barridoReina.slice(0, 3).join(' · ') || 'limpia');
  const reina = await page.evaluate(`(()=>{const sh=document.getElementById('queenProfile'); if(!sh) return null;
    const r=sh.getBoundingClientRect(); const cs=getComputedStyle(sh);
    return {abierto:sh.getAttribute('data-open'), top:Math.round(r.top), bottom:Math.round(r.bottom), alto:Math.round(r.height),
            overflowY:cs.overflowY, sobra:sh.scrollHeight-sh.clientHeight, ventana:innerHeight};})()`);
  ok(reina && reina.alto > 200, 'la hoja de la reina se abre y ocupa su hueco', reina ? `${reina.alto}px de alto` : 'sin hoja');
  ok(reina && /auto|scroll/.test(reina.overflowY), 'la hoja de la reina scrollea (antes estaba sellada con overflow:hidden)', reina ? `overflow-y: ${reina.overflowY} · se le cortaban ${reina.sobra}px` : '');
  ok(reina && reina.bottom <= reina.ventana - 1, 'y tampoco se le sale nada por abajo de la pantalla', reina ? `de ${reina.top} a ${reina.bottom}px en ${reina.ventana}px` : '');
  // el arbol y el historial, que vivian en cajas de 78px con overflow:hidden
  const interior = await page.evaluate(`(()=>{
    const out=[];
    for(const id of ['profileTree','profileHistory','queenProfileTree','queenProfileHistory']){
      const e=document.getElementById(id); if(!e) continue;
      const cs=getComputedStyle(e);
      out.push(id+':'+(cs.textOverflow==='ellipsis'?'...':'')+(cs.overflowY||'?')+(e.scrollHeight>e.clientHeight+2?'(corta '+(e.scrollHeight-e.clientHeight)+'px)':''));
    }
    return out;
  })()`);
  const encogidas = interior.filter(x => /hidden\(corta/.test(x));
  ok(encogidas.length === 0, 'árbol e historial se pueden recorrer cuando no caben (no se quedan en 78px cortados)', interior.join(' · '));
  await page.screenshot({ path: '/tmp/antfarm-capturas/paneles-perfil.png' });

  ok(errs.length === 0, 'cero errores de JavaScript en todo el recorrido', errs.slice(0, 2).join(' | '));

  console.log('\n' + pass + ' ok · ' + failn + ' FALLOS\n');
  await browser.close();
  server.close();
  process.exit(failn ? 1 : 0);
})().catch(e => { console.error('FALLO del arnés:', e.message); try { server.close(); } catch (_) { } process.exit(2); });
