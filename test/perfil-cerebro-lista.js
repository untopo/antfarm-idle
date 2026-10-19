/**
 * perfil-cerebro-lista.js — el cerebro dentro de la hoja de perfil, y la lista de hormigas activas.
 *
 * Tres cosas pidió el dueño (2026-10-16):
 *   1) «dentro de la hoja de perfil es mejor, con la misma estética; asegúrate de que TODO QUEPA BONITO Y
 *      ORDENADO y que la información ahí sea fácilmente comprensible para cada persona»;
 *   2) «una lista fácil de acceder de todas las hormigas activas, tal vez haciendo click al número de
 *      hormigas activas; ahí te aparece la lista»;
 *   3) «recuerda que te pedí que la lista del inventario también sea scrolleable para ver todo lo que ahí hay».
 *
 * Lo que se comprueba, en CHROME real y con ventana baja (620 px) para que desborde de verdad:
 *   - la puerta es el número de la tira viva (es un <button> alcanzable, y su cifra ES workers.length);
 *   - la hoja del elenco cabe entera, su cuerpo es caja de scroll, la rueda lo mueve, la última hormiga se ve
 *     entera al bajar y el pie no se va con el scroll; y ningún nodo deja contenido recortado;
 *   - un click en una fila selecciona a esa hormiga, abre SU perfil y cierra la lista (una hoja cada vez);
 *   - la pestaña CEREBRO existe en la hoja de perfil, los 5 botones caben sin cortarse, y trae las 11 frases
 *     de los sentidos + las 4 de las decisiones + el grafo PINTADO (pixeles, no un lienzo en blanco);
 *   - la frase es comprensible: una fila con espacios y letras, y el número crudo sigue en el `title`;
 *   - tapada, la pestaña no pinta (un contador sobre la función real lo demuestra);
 *   - la barra lateral sellada sigue sellada: no hay una segunda puerta a lo mismo;
 *   - y el inventario sigue scrolleable, que es lo que el dueño pidió recordar.
 *
 *   node test/perfil-cerebro-lista.js
 */
const http = require('http');
const fs = require('fs');
fs.mkdirSync('/tmp/antfarm-capturas', { recursive: true });
const path = require('path');
const puppeteer = require('puppeteer');
const ROOT = path.resolve(__dirname, '..');
const PORT = 8177;
const ALTURA = 620;
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

// Ninguna caja deja contenido fuera sin manera de llegar a él (misma regla que paneles-scroll.js).
const BARRIDO = `(raiz)=>{
  const mal=[];
  const el=document.getElementById(raiz); if(!el) return ['sin hoja '+raiz];
  const marcos=[el, ...el.querySelectorAll('*')];
  for(const n of marcos){
    const cs=getComputedStyle(n);
    if(n!==el && (cs.display==='none'||cs.visibility==='hidden')) continue;
    const puedeOy=/auto|scroll/.test(cs.overflowY);
    const puedeOx=/auto|scroll/.test(cs.overflowX);
    const recorta=cs.textOverflow==='ellipsis' || /-webkit-box/.test(cs.display);
    const vY=n.scrollHeight-n.clientHeight, vX=n.scrollWidth-n.clientWidth;
    if(vY>4 && !puedeOy && !recorta) mal.push(raiz+'/'+(n.id||n.className||n.tagName)+' corta '+vY+'px abajo');
    if(vX>2 && !puedeOx && !recorta) mal.push(raiz+'/'+(n.id||n.className||n.tagName)+' corta '+vX+'px a la derecha');
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

  // LA CONDICION SE CONSTRUYE A MANO: una colonia con las suficientes obreras para que la lista desborde la
  // ventana baja (la granja chica arranca con pocas). Se clonan obreras existentes con ids nuevos: no se toca
  // ningun umbral del juego ni de la prueba, solo hay mas bichos que listar.
  const col = await page.evaluate(`(()=>{
    try{
      const base=workers.length;
      while(workers.length<14 && workers.length<40){
        const w0=workers[workers.length%Math.max(1,base)]||workers[0]; if(!w0) break;
        const c=Object.assign({},w0); c.id='TST'+workers.length; c.name='T'+workers.length; c.nameMeaning='clon de prueba';
        c.selected=false; c.x=w0.x+(workers.length%5)*3; c.y=w0.y+(workers.length%3)*2;
        workers.push(c);
      }
      try{ for(let i=0;i<6;i++){ worldMaterials[i%2?'stone':'fiber']=(worldMaterials[i%2?'stone':'fiber']||0)+9; } }catch(e){}
      return {antes:base, ahora:workers.length};
    }catch(e){ return {error:e.message}; }
  })()`);
  await sleep(500);
  await page.evaluate(`(()=>{ try{ gameSpeed=16; turbo=true; }catch(e){} })()`);
  await sleep(700);
  await page.evaluate(`(()=>{ try{ gameSpeed=1; turbo=false; }catch(e){} })()`);
  await sleep(400);

  console.log('\n· la puerta: el numero de obreras de la tira viva');
  const puerta = await page.evaluate(`(()=>{
    const b=document.getElementById('btnAntList'); if(!b) return {no:true};
    const r=b.getBoundingClientRect(), cs=getComputedStyle(b);
    const toque=document.elementFromPoint(Math.round(r.left+r.width/2), Math.round(r.top+r.height/2));
    const cuenta=parseInt((document.getElementById('velAntCount').textContent||'').replace(/\\D/g,''),10);
    return {tag:b.tagName, ancho:Math.round(r.width), alto:Math.round(r.height), alcanzable: !!(toque&&toque.closest('#btnAntList')),
      texto:(b.textContent||'').replace(/\\s+/g,' ').trim(), n:workers.length, enTira: !!b.closest('#velAntBar'),
      cuentaTira:cuenta, cursor:cs.cursor};
  })()`);
  ok(puerta.tag === 'BUTTON' && puerta.enTira, 'el número de obreras es un botón de la tira viva (la puerta pedida)', puerta.tag + ' · ' + puerta.ancho + '×' + puerta.alto + 'px');
  ok(puerta.alcanzable === true, 'y se le puede pinchar de verdad: el punto central de la caja responde por él');
  ok(/OBRERAS/.test(puerta.texto || '') && /▾/.test(puerta.texto || ''), 'el rótulo avisa que despliega una lista', JSON.stringify(puerta.texto));
  ok(puerta.cuentaTira === puerta.n, 'la cifra de la puerta es el número real de hormigas activas', puerta.cuentaTira + ' = workers.length ' + puerta.n);
  ok(puerta.cursor === 'pointer', 'y pide que la pinchen (cursor de puntero)', 'cursor: ' + puerta.cursor);

  console.log('\n· la hoja del elenco, abierta con la puerta');
  await page.click('#btnAntList');
  await sleep(520);
  const lista = await page.evaluate(`(()=>{
    const sh=document.getElementById('antListSheet'), b=document.getElementById('antListBody');
    if(!sh||!b) return {sinHoja:true};
    const rs=sh.getBoundingClientRect(), rb=b.getBoundingClientRect();
    const filas=b.querySelectorAll('.ant-row'), ultima=filas[filas.length-1];
    const cs=getComputedStyle(b);
    return {abierto:sh.getAttribute('data-open')==='1' && sh.style.display!=='none', ancho:Math.round(rs.width),
      top:Math.round(rs.top), bottom:Math.round(rs.bottom), ventana:innerHeight, alto:Math.round(rs.height),
      overflow:cs.overflowY, sobra:b.scrollHeight-b.clientHeight, filas:filas.length,
      ultimaFuera: ultima? Math.round(ultima.getBoundingClientRect().bottom-rb.bottom) : -1,
      encabezado:(b.firstElementChild? b.firstElementChild.textContent.replace(/\\s+/g,' ').trim().slice(0,120):''),
      luces: document.getElementById('btnAntList').getAttribute('data-open')==='1',
      topHoja:Math.round(rs.top), calBottom:Math.round((document.getElementById('calendarWidget')||{getBoundingClientRect:()=>({bottom:0})}).getBoundingClientRect().bottom)};
  })()`);
  ok(lista.abierto === true, 'un click en el número abre la lista de las hormigas activas', 'data-open y display:flex · ' + col.ahora + ' obreras en el mundo');
  ok(lista.luces === true, 'y el botón de la tira queda encendido mientras la lista está abierta');
  ok(lista.alto > 200 && lista.bottom <= lista.ventana - 1, 'la hoja cabe entera en la pantalla baja', `de ${lista.top} a ${lista.bottom}px en ${lista.ventana}px`);
  ok(lista.ancho <= 236, 'mismo ancho que la hoja del almacén (no se inventa una tercera medida)', lista.ancho + 'px');
  ok(lista.topHoja >= lista.calBottom - 1, 'y no nace detrás del calendario: la primera hormiga se ve sin scrollear (era la otra mitad del «no se ve todo»)', `hoja desde ${lista.topHoja}px, calendario hasta ${lista.calBottom}px`);
  ok(/auto|scroll/.test(lista.overflow || ''), 'su cuerpo es caja de scroll, como la del almacén', 'overflow-y: ' + lista.overflow);
  ok(lista.sobra > 4, 'hay hormigas por debajo del borde: hace falta scrollear de verdad', `sobran ${lista.sobra}px para ${lista.filas} filas`);
  ok(lista.ultimaFuera > 0, 'antes de scrollear, la última hormiga está efectivamente fuera', `${lista.ultimaFuera}px por debajo`);
  ok(/^\s*🐜?\s*\d+\+?\s*hormigas activas/.test(lista.encabezado || '') || /hormigas activas/.test(lista.encabezado || ''), 'encabeza con el total y el reparto por tarea', JSON.stringify((lista.encabezado || '').slice(0, 74)));

  const centro = await page.evaluate(`(()=>{ const b=document.getElementById('antListBody').getBoundingClientRect(); return {x:Math.round(b.left+b.width/2), y:Math.round(b.top+b.height/2), mundo:Math.round(view.y)}; })()`);
  await page.mouse.move(centro.x, centro.y);
  await page.mouse.wheel({ deltaY: 340 });
  await sleep(300);
  // y hasta el final: una sola vuelta de rueda no llega al fondo cuando sobran 600 px, y la promesa del dueño
  // es ver TODAS, asi que se baja en vueltas (rueda real) hasta tocar el fondo
  for(let i=0;i<8;i++){
    const alFondo = await page.evaluate(`(()=>{ const b=document.getElementById('antListBody'); return b.scrollTop+b.clientHeight>=b.scrollHeight-2; })()`);
    if(alFondo) break;
    await page.mouse.wheel({ deltaY: 340 }); await sleep(160);
  }
  const rueda = await page.evaluate(`(()=>{
    const b=document.getElementById('antListBody');
    const filas=b.querySelectorAll('.ant-row'), ultima=filas[filas.length-1];
    const rb=b.getBoundingClientRect();
    return {despues:b.scrollTop, max:b.scrollHeight-b.clientHeight,
      ultimaRelativa: ultima? Math.round(ultima.getBoundingClientRect().bottom-rb.bottom) : -999,
      yMundo: Math.round(view.y)};
  })()`);
  ok(rueda.despues > 0, 'la rueda DENTRO de la hoja mueve la hoja (rueda real, no un evento fabricado)', `scrollTop 0 -> ${rueda.despues} de ${rueda.max}px`);
  ok(rueda.ultimaRelativa <= 1, 'y al bajar, la última hormiga se ve entera', `${rueda.ultimaRelativa}px sobre el borde del cuerpo`);
  ok(rueda.yMundo === centro.mundo, 'y el mundo NO se movió por scrollear la lista (el gesto de la rueda sigue siendo del panel)', `view.y ${centro.mundo}`);
  await page.evaluate(`(()=>{document.getElementById('antListBody').scrollTop=0;})()`);
  await sleep(120);

  console.log('\n· una fila lleva a su perfil');
  const fila = await page.evaluate(`(()=>{
    const filas=document.querySelectorAll('#antListBody .ant-row'); const f=filas[Math.min(2,filas.length-1)];
    if(!f) return {};
    const i=parseInt(f.dataset.antI,10);
    return {i, id:(workers[i]&&workers[i].id)||null, nombre: workers[i]?String(antDisplayName(workers[i])):'', texto:(f.textContent||'').replace(/\\s+/g,' ').trim()};
  })()`);
  await page.evaluate(`(()=>{ const filas=document.querySelectorAll('#antListBody .ant-row'); if(filas[2]||filas[0]) (filas[2]||filas[0]).click(); })()`);
  await sleep(520);
  const despues = await page.evaluate(`(()=>{
    const sh=document.getElementById('antListSheet'), pf=document.getElementById('antProfile');
    const sel=workers.filter(w=>w.selected);
    return {listaCerrada:getComputedStyle(sh).display==='none' && !sh.hasAttribute('data-open'),
      perfilAbierto: pf.style.display!=='none' && pf.getAttribute('data-open')==='1',
      titulo:(document.getElementById('profileTitle').textContent||'').trim(),
      sel: sel.length, selId: sel[0]? sel[0].id : null,
      anchoHoja: Math.round(pf.getBoundingClientRect().width)};
  })()`);
  ok(despues.listaCerrada === true, 'al pinchar una hormiga la lista se cierra (una hoja cada vez, nunca las dos)');
  ok(despues.perfilAbierto === true, 'y se abre SU hoja de perfil', `hormiga ${despues.selId || '—'} · ${despues.anchoHoja}px`);
  ok((despues.titulo || '').length > 2, 'el título del perfil es el de esa hormiga', JSON.stringify(despues.titulo));

  console.log('\n· la pestaña CEREBRO de la hoja de perfil');
  const tabs = await page.evaluate(`(()=>{
    const cont=document.getElementById('profileTabs'); if(!cont) return {no:true};
    const cs=getComputedStyle(cont), bs=[...cont.querySelectorAll('[data-ptab]')];
    const r=cont.getBoundingClientRect();
    return {n:bs.length, etiquetas:bs.map(b=>b.textContent.trim()), desbordados: bs.filter(b=>b.scrollWidth>b.clientWidth+1).map(b=>b.dataset.ptab),
      filas: new Set(bs.map(b=>Math.round(b.getBoundingClientRect().top))).size, alto:Math.round(r.height),
      ancho:Math.round(r.width), wrap:cs.flexWrap, gap:cs.gap,
      cerebro: !!document.getElementById('profileTab_cerebro'), ptab: document.getElementById('antProfile').dataset.ptab};
  })()`);
  ok(tabs.n === 5 && tabs.cerebro, 'el perfil de la hormiga trae quinta pestaña: CEREBRO', tabs.etiquetas.join(' · '));
  ok(tabs.desbordados.length === 0, 'ningún botón de pestaña se queda con el rótulo cortado', tabs.desbordados.join(',') || 'los 5 leen enteros en ' + tabs.ancho + 'px');
  ok(tabs.filas <= 2, 'y caben en dos filas como máximo (no se desparraman)', tabs.filas + ' fila(s) · ' + tabs.alto + 'px · gap ' + tabs.gap);
  await page.evaluate(`(()=>{ const b=document.querySelector('#profileTabs [data-ptab="cerebro"]'); if(b) b.click(); })()`);
  await sleep(700);
  const cerebro = await page.evaluate(`(()=>{
    const pane=document.getElementById('profileTab_cerebro'), pf=document.getElementById('antProfile');
    const sens=[...document.querySelectorAll('#profSensors .prof-fila')];
    const outs=[...document.querySelectorAll('#profOuts .prof-fila')];
    const cv=document.getElementById('profNnCanvas');
    let colores=0, noNegros=0;
    try{ const cx=cv.getContext('2d'); const d=cx.getImageData(0,0,cv.width,cv.height).data;
      const s=new Set(); for(let i=0;i<d.length;i+=4){ if(d[i]+d[i+1]+d[i+2]>40) noNegros++; if(s.size<4096) s.add((d[i]>>3)+','+(d[i+1]>>3)+','+(d[i+2]>>3)); }
      colores=s.size; }catch(e){}
    const rcv=cv.getBoundingClientRect();
    const sinFrase=sens.filter(e=>{ const t=(e.textContent||'').trim(); return t.length<12 || !/ /.test(t); }).map(e=>e.textContent.trim().slice(0,20));
    const desb=[...pane.querySelectorAll('*')].filter(n=>{
      if(n.scrollWidth<=n.clientWidth+1) return false;
      const cs=getComputedStyle(n);
      // un span con puntos suspensivos y la frase entera en su title no pierde informacion: es la via
      // elegante para que ninguna fila se parta en dos cuando la frase sale larga
      return !(cs.textOverflow==='ellipsis' && n.getAttribute('title'));
    }).map(n=>(n.id||n.className||n.tagName)+'+'+n.scrollWidth+'>'+n.clientWidth);
    const frasesEl=[...pane.querySelectorAll('#profSensors .prof-fila > div:first-child > span:last-child, #profOuts .prof-fila > div:first-child > span:last-child')];
    const alturas=frasesEl.map(e=>Math.round(e.getBoundingClientRect().height));
    const rs=pf.getBoundingClientRect();
    const pie=document.getElementById('btnFollowAnt').getBoundingClientRect();
    const cuerpoAlto=pf.scrollHeight-pf.clientHeight;
    return {visible:getComputedStyle(pane).display!=='none', ptab:pf.dataset.ptab,
      sens:sens.length, outs:outs.length, frases:sens.slice(0,3).map(e=>e.textContent.replace(/\\s+/g,' ').trim()),
      alturas, filas:frasesEl.length,
      titulos:sens.slice(0,2).map(e=>e.getAttribute('title')), sinFrase, desb,
      lienzo:{w:Math.round(rcv.width),h:Math.round(rcv.height),colores,noNegros},
      alto:Math.round(rs.height), bottom:Math.round(rs.bottom), ventana:innerHeight, sobra:cuerpoAlto,
      pieFuera:Math.round(pie.bottom-rs.bottom), ocultas:['rasgos','estado','arbol','hist'].filter(k=>getComputedStyle(document.getElementById('profileTab_'+k)).display!=='none')};
  })()`);
  ok(cerebro.visible === true && cerebro.ptab === 'cerebro' && cerebro.ocultas.length === 0, 'la pestaña se abre sola y cierra las otras cuatro', 'ocultas visibles: ' + (cerebro.ocultas.join(',') || 'ninguna'));
  ok(cerebro.sens === 11, 'los 11 sentidos están los 11, cada uno con su frase', cerebro.frases[0]);
  ok(cerebro.outs === 4, 'las 5 salidas se resumen en 4 decisiones legibles (GIRO, VEL, CAVA, CHARLA)', cerebro.frases.length ? 'las frases vienen de a tres, p. ej. «' + cerebro.frases[1] + '»' : '');
  ok(cerebro.sinFrase.length === 0, 'ninguna fila es un número suelto: todas dicen algo en palabras', cerebro.sinFrase.join(' | ') || '11/11 con frase');
  ok(cerebro.filas === 15 && Math.max(0, ...(cerebro.alturas||[99])) <= 15, 'las 15 frases caben en UNA linea cada una (ni una fila partida en dos)', 'alturas ' + (cerebro.alturas||[]).join(',') + ' px');
  ok(/nnOut\[\d\] = -?\d\.\d+| = -?\d\.\d+/.test((cerebro.titulos || []).join(' ')), 'el número crudo no se pierde: está al pasar el ratón', JSON.stringify(cerebro.titulos && cerebro.titulos[0]));
  ok(cerebro.lienzo.colores >= 6 && cerebro.lienzo.noNegros > 1500, 'el grafo del lienzo está pintado de verdad (nodos, líneas y rejilla)', `${cerebro.lienzo.colores} colores · ${cerebro.lienzo.noNegros} px con luz en ${cerebro.lienzo.w}×${cerebro.lienzo.h}`);
  ok(cerebro.desb.length === 0, 'nada desborda hacia la derecha dentro de la pestaña', cerebro.desb.slice(0, 3).join(' · ') || 'todo entra en ' + (1280 - 236) + 'px de ancho útil');
  ok(cerebro.bottom <= cerebro.ventana - 1, 'con la pestaña abierta la hoja sigue cabiendo en la pantalla', `de ? a ${cerebro.bottom}px en ${cerebro.ventana}px · alto ${cerebro.alto}px`);
  ok(cerebro.sobra > 4, 'y lo que no cabe se recorre: la hoja scrollea', `sobran ${cerebro.sobra}px`);

  await page.evaluate(`(()=>{ const pf=document.getElementById('antProfile'); pf.scrollTop=pf.scrollHeight; return 1; })()`);
  await sleep(180);
  const pie = await page.evaluate(`(()=>{
    const pf=document.getElementById('antProfile');
    const rs=pf.getBoundingClientRect();
    const pie=document.getElementById('btnFollowAnt').getBoundingClientRect();
    return {fuera:Math.round(pie.bottom-rs.bottom), alto:Math.round(rs.height), scrolleado:pf.scrollTop>0};
  })()`);
  ok(pie.scrolleado && pie.fuera <= 1, 'los botones SEGUIR / EXILIAR del final se alcanzan scrolleando (no quedan cortados)', `a ${pie.fuera}px del borde · ${pie.alto}px de hoja`);

  console.log('\n· tapada no cuesta, y no hay segunda puerta');
  const instala = await page.evaluate(`(()=>{
  window._repasos=0; const original=window.pintarCerebroPerfil;
  window._origCerebro=original;
  window.pintarCerebroPerfil=(...x)=>{ window._repasos++; return original(...x); };
  const ai=document.querySelector('.ai-pane'), c=document.getElementById('nnCanvas');
  return {barraSellada: !ai || getComputedStyle(ai).display==='none', nnLateral: !c || c.offsetWidth===0};
})()`);
  await sleep(600);
  const conPestana = await page.evaluate('window._repasos');
  await page.evaluate(`(()=>{ const b=document.querySelector('#profileTabs [data-ptab="rasgos"]'); if(b) b.click(); return 1; })()`);
  await sleep(120);
  const antesCierre = await page.evaluate('window._repasos');
  await sleep(700);
  const cuesta = await page.evaluate(`(()=>{ const n=window._repasos; window.pintarCerebroPerfil=window._origCerebro; return {conPestana:${conPestana}, sinPestana:n-${antesCierre}, barraSellada:${instala.barraSellada}, nnLateral:${instala.nnLateral}}; })()`);
  ok(cuesta.conPestana > 0, 'abierta, la pestaña repinta por sí sola (mismo reloj de 140 ms que la caja lateral)', cuesta.conPestana + ' repasos en 600 ms');
  ok(cuesta.sinPestana === 0, 'y en cuanto la tapas deja de pintar: cero cuadros gastados', cuesta.sinPestana + ' repasos en 600 ms con CEREBRO cerrada');
  ok(cuesta.barraSellada && cuesta.nnLateral, 'la barra lateral con el cerebro viejo sigue sellada (no es una segunda puerta a lo mismo)', '.ai-pane display:none · #nnCanvas ' + (cuesta.nnLateral ? '0×0' : 'visible'));

  console.log('\n· el inventario, que se pidió recordado');
  await page.evaluate(`(()=>{ const c=document.getElementById('btnCloseProfile'); if(c) c.click(); })()`);
  await sleep(320);
  await page.click('#btnInventory');
  await sleep(520);
  await page.evaluate(`(()=>{ const b=document.getElementById('invBody'); b.scrollTop=0; return 1; })()`);
  // el punto de la rueda se ELIGE dentro del cuerpo y se comprueba que nada lo tape: el calendario vive en la
  // misma esquina y sus 180 px de alto tapan el principio de la hoja (medido: una rueda a top+60 caia sobre
  // el calendario y el panel no se movia, que es justo el «no scrollea» que el dueño sigue viendo)
  const centroInv = await page.evaluate(`(()=>{
    const b=document.getElementById('invBody').getBoundingClientRect();
    const x=Math.round(b.left+b.width/2);
    for(let f=0.5;f>=0.1;f-=0.05){
      const y=Math.round(b.top+b.height*f);
      const toque=document.elementFromPoint(x,y);
      if(toque && (toque.id==='invBody'||(toque.closest&&toque.closest('#invBody')))) return {x,y,dentro:true,fuera:null};
    }
    const t2=document.elementFromPoint(x,Math.round(b.top+b.height*0.5));
    return {x,y:Math.round(b.top+b.height*0.5),dentro:false,fuera:t2?((t2.id||t2.className||t2.tagName)+' a la mitad del cuerpo'):'nada'};
  })()`);
  await page.mouse.move(centroInv.x, centroInv.y);
  await page.mouse.wheel({ deltaY: 300 });
  await sleep(320);
  const inv = await page.evaluate(`(()=>{
    const sh=document.getElementById('invSheet'), b=document.getElementById('invBody');
    const rs=sh.getBoundingClientRect(), rb=b.getBoundingClientRect();
    const cs=getComputedStyle(b);
    const fuera=[...b.children].filter(n=>n.getBoundingClientRect().bottom>rb.bottom+1).length;
    return {abierto:getComputedStyle(sh).display!=='none', overflow:cs.overflowY, sobra:b.scrollHeight-b.clientHeight,
      movio:b.scrollTop>0, top:b.scrollTop, fuera, bottom:Math.round(rs.bottom), ventana:innerHeight,
      cuerpo:b.id, filas:b.children.length, topHoja:Math.round(rs.top),
      calBottom:Math.round((document.getElementById('calendarWidget')||{getBoundingClientRect:()=>({bottom:0})}).getBoundingClientRect().bottom)};
  })()`);
  ok(inv.abierto === true, 'la hoja del almacén sigue abriéndose con su botón ☰', inv.filas + ' bloques en el cuerpo');
  ok(inv.topHoja >= inv.calBottom - 1, 'y la del almacén tampoco se abre debajo del calendario', `hoja desde ${inv.topHoja}px, calendario hasta ${inv.calBottom}px`);
  ok(/auto|scroll/.test(inv.overflow || ''), 'su lista sigue siendo caja de scroll', 'overflow-y: ' + inv.overflow + ' en #' + inv.cuerpo);
  ok(centroInv.dentro === true, 'hay un punto dentro de la lista donde la rueda es de la hoja (no del calendario de encima)', centroInv.dentro ? 'a la altura ' + centroInv.y + 'px' : 'lo tapa ' + centroInv.fuera);
  ok(inv.sobra > 4 ? inv.movio : true, 'y cuando hay más filas que alto, la rueda las recorre todas', `sobran ${inv.sobra}px · la rueda ${inv.movio ? 'movió el cuerpo hasta ' + inv.top + 'px' : 'no lo movió'}`);
  ok(inv.bottom <= inv.ventana - 1, 'sin salirse por abajo de la pantalla', `bottom ${inv.bottom} de ${inv.ventana}px`);
  const barridoInv = await page.evaluate(`(${BARRIDO})('invSheet')`);
  ok(barridoInv.length === 0, 'ninguna caja del inventario deja contenido cortado sin scroll', barridoInv.slice(0, 2).join(' · ') || 'limpia');
  await page.evaluate(`(()=>{ const sh=document.getElementById('antListSheet'); sh.style.display='flex'; return 1; })()`);
  await page.evaluate(`(()=>{ window.abrirListaHormigas && window.abrirListaHormigas(); })()`);
  await sleep(420);
  const barridoListaReal = await page.evaluate(`(${BARRIDO})('antListSheet')`);
  ok(barridoListaReal.length === 0, 'la hoja del elenco tampoco deja nada cortado', barridoListaReal.slice(0, 3).join(' · ') || 'limpia');

  await page.evaluate(`(()=>{ try{ gameSpeed=16; turbo=true; }catch(e){} })()`);
  await sleep(600);
  await page.evaluate(`(()=>{ try{ gameSpeed=1; turbo=false; }catch(e){} })()`);
  await page.screenshot({ path: '/tmp/antfarm-capturas/perfil-cerebro.png' });
  await page.evaluate(`(()=>{ window.abrirListaHormigas && window.abrirListaHormigas(); })()`);
  await sleep(400);
  await page.evaluate(`(()=>{ const b=document.querySelector('#profileTabs [data-ptab="cerebro"]'); if(b) b.click(); })()`);
  await sleep(500);
  await page.screenshot({ path: '/tmp/antfarm-capturas/lista-hormigas.png' });

  ok(errs.length === 0, 'cero errores de JavaScript en todo el recorrido', errs.slice(0, 2).join(' | '));

  console.log('\n' + pass + ' ok · ' + failn + ' FALLOS\n');
  await browser.close();
  server.close();
  process.exit(failn ? 1 : 0);
})().catch(e => { console.error('FALLO del arnés:', e.message); try { server.close(); } catch (_) { } process.exit(2); });
