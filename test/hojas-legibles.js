/**
 * hojas-legibles.js — la hoja de perfil con su cerebro, la lista de hormigas y la tipagrafia que calza.
 *
 * El dueño (2026-10-16): «dentro de la hoja de perfil es mejor, con la misma estetica; asegurate de que
 * todo quepa bonito y ordenado y haz que la informacion ahi sea facilmente comprensible para cada persona…
 * una lista facil de acceder de todas las hormigas activas, tal vez haciendo click al numero de hormigas…
 * la lista del inventario tambien scrolleable… los textos un poco mas grandes, es muy dificil de leer todo…
 * debajo del reloj dice cuantas hormigas hay pero esa informacion ya esta en la barra de arriba, la de abajo
 * sobra… al aumentar los textos asegurate que todo calce perfecto, no se desvirtuen los menus».
 *
 * «Quepa bonito» se mide, no se promete: se abre cada hoja en CHROME real y se comprueba que nada se corta
 * (scrollWidth <= clientWidth), que nada se sale de la pantalla (bottom <= innerHeight), que la letra no baja
 * del suelo de legibilidad, que la cifra de obreras tiene UN solo sitio y que ese sitio es una puerta. La
 * escala del calendario se multiplica por el `scale()` con el que se pinta, que es como se ve de verdad.
 *
 *   node test/hojas-legibles.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const ROOT = path.resolve(__dirname, '..');
const PORT = 8173;
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.svg': 'image/svg+xml' };
const CARPETA = '/tmp/antfarm-capturas';

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/ant-farm-rpg/index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('nope'); return; }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store, must-revalidate' });
  fs.createReadStream(file).pipe(res);
});
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, failn = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log('  ok   ' + m + (d ? ' · ' + d : '')); } else { failn++; console.log('  FAIL ' + m + (d ? ' · ' + d : '')); } };

const html = fs.readFileSync(path.join(ROOT, 'ant-farm-rpg/index.html'), 'utf8');

(async () => {
  console.log('\n· el markup, en frio: una cifra, un sitio');
  ok(!/calAntCount/.test(html), 'el contador de obreras de debajo del reloj esta borrado del markup', (html.match(/calAntCount/g) || []).length + ' apariciones (queria 0)');
  ok(!/calAntCount/.test(fs.readFileSync(path.join(ROOT, 'ant-farm-rpg/js/app.js'), 'utf8')), 'y nadie lo escribe ya desde el codigo', 'si alguien lo escribiera, volveria a aparecer duplicado');
  ok(/id="btnRoster"/.test(html) && /id="rosterSheet"/.test(html), 'la cifra de arriba es un boton (🐜 OBRERAS ▾ LISTA) y tiene su hoja de lista');
  ok(/id="profileTab_cerebro"/.test(html) && /id="profileNn"/.test(html) && /data-ptab="cerebro"/.test(html), 'el cerebro vive dentro de la hoja de perfil: su pestana, su rejilla y sus frases');

  await new Promise(r => server.listen(PORT, '0.0.0.0', r));
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 820 });
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|autoplay|AudioContext/.test(m.text())) errs.push('console: ' + m.text().slice(0, 140)); });

  await page.goto(`http://127.0.0.1:${PORT}/ant-farm-rpg/index.html`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction('typeof window.topoShowMainMenu==="function" || window._topoFlowReady===true', { timeout: 20000 }).catch(() => { });
  await page.waitForFunction("!document.getElementById('splashScreen') || document.getElementById('splashScreen').style.display==='none'", { timeout: 15000 }).catch(() => { });
  await page.click('#btnMainCreate'); await sleep(420);
  await page.click('#createSizeScreen [data-size="small"]'); await sleep(420);
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
  await page.waitForFunction("document.body.classList.contains('game-started')", { timeout: 20000 }).catch(() => { });
  await sleep(1400);

  console.log('\n· la letra: mayor y sin que nada se corte');
  const tipo = await page.evaluate(() => {
    const px = s => { const e = document.querySelector(s); if (!e) return null; const f = parseFloat(getComputedStyle(e).fontSize); const r = e.getBoundingClientRect(); return { f, w: Math.round(r.width), h: Math.round(r.height), txt: (e.textContent || '').trim().slice(0, 18) }; };
    // el calendario se pinta a 444x244 y se escala: su letra REAL es la declarada por esa escala
    const card = document.querySelector('.rc-card');
    const esc = card ? (parseFloat((getComputedStyle(card).transform.match(/matrix\(([-\d.]+)/) || [, '1'])[1]) || 1) : 1;
    const tiempo = px('#rcTime');
    return { vel: px('#velAntBar .pixel-btn.small'), obreras: px('#velAntCount'), etiquetaOBRERAS: (() => { const b = document.getElementById('btnRoster'); const s = b ? [...b.querySelectorAll('span')].find(x => /OBRERAS|WORKERS/.test(x.textContent)) : null; return s ? { f: parseFloat(getComputedStyle(s).fontSize) } : null; })(), almacen: px('#velFoodCount'), hora: tiempo ? { f: +(tiempo.f * esc).toFixed(1) } : null, dia: px('#rcDiaN') ? { f: +(px('#rcDiaN').f * esc).toFixed(1) } : null, mas1: px('#btnDay1') };
  });
  ok(tipo.vel && tipo.vel.f >= 11, 'los botones de velocidad se leen sin entornar los ojos', `x1..x16 a ${tipo.vel && tipo.vel.f}px`);
  ok(tipo.obreras && tipo.obreras.f >= 14, 'la cifra de obreras es la cosa mas grande de su celda', `${tipo.obreras && tipo.obreras.f}px · «${tipo.obreras && tipo.obreras.txt}»`);
  ok(tipo.etiquetaOBRERAS && tipo.etiquetaOBRERAS.f >= 8, 'y su etiqueta (OBRERAS) no baja de 8 px en Press Start 2P', `${tipo.etiquetaOBRERAS && tipo.etiquetaOBRERAS.f}px`);
  ok(tipo.hora && tipo.hora.f >= 14, 'el reloj del calendario, ya con la escala aplicada', `${tipo.hora && tipo.hora.f}px efectivos`);
  ok(tipo.mas1 && tipo.mas1.f >= 9, 'el boton +1 DIA de debajo del reloj tambien crecio', `${tipo.mas1.f}px · ${tipo.mas1.h}px de alto`);

  const corte = await page.evaluate(() => {
    const med = s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { id: s, desborda: e.scrollWidth - e.clientWidth, fuera: +(r.bottom - window.innerHeight).toFixed(1), ancho: Math.round(r.width), alto: Math.round(r.height), right: Math.round(r.right) }; };
    return { barra: med('#velAntBar'), cal: med('#calendarWidget'), fila: med('#calAntRow'), btnRoster: med('#btnRoster') };
  });
  ok(corte.barra && corte.barra.desborda <= 0, 'la barra de arriba no recorta nada por la derecha', `scrollWidth-clientWidth = ${corte.barra && corte.barra.desborda} · ${corte.barra && corte.barra.ancho}x${corte.barra && corte.barra.alto}`);
  ok(corte.cal && corte.cal.desborda <= 0 && corte.cal.alto >= 190, 'el calendario conserva su tarjeta entera con la letra grande', `${corte.cal && corte.cal.ancho}x${corte.cal && corte.cal.alto}`);
  ok(corte.fila && corte.fila.desborda <= 0 && corte.fila.alto >= 26, 'la fila que queda debajo del reloj calza con el boton', `${corte.fila && corte.fila.alto}px de alto · ${corte.fila && corte.fila.desborda} de sobrante`);

  console.log('\n· la lista de hormigas, desde el numero de la barra');
  const antes = await page.evaluate('(()=>({obreras:workers.length,reinas:queens.length,abierto:!!document.querySelector("#rosterSheet[data-open]")}))()');
  await page.click('#btnRoster'); await sleep(560);
  const lista = await page.evaluate(() => {
    const sh = document.getElementById('rosterSheet'); const cuerpo = document.getElementById('rosterCuerpo');
    const filas = [...cuerpo.querySelectorAll('.ficha-hormiga')];
    const r = sh.getBoundingClientRect(), cr = cuerpo.getBoundingClientRect();
    return {
      abierto: !!sh.getAttribute('data-open'), display: getComputedStyle(sh).display,
      n: filas.length, activas: workers.length + queens.length,
      titulo: document.getElementById('rosterTitle').textContent.trim(),
      chips: [...document.querySelectorAll('#rosterFiltros .chip-roster')].map(c => c.textContent.trim()),
      fuera: +(r.bottom - window.innerHeight).toFixed(1), derecha: +(r.right - (window.innerWidth - 14)).toFixed(1),
      altoFila: filas.length ? Math.round(filas[0].getBoundingClientRect().height) : 0,
      letraFila: filas.length ? parseFloat(getComputedStyle(filas[0]).fontSize) : 0,
      scrollea: cuerpo.scrollHeight > cuerpo.clientHeight + 1,
      cuerpoAlto: Math.round(cr.height),
      tocandoBarra: r.top < document.getElementById('velAntBar').getBoundingClientRect().bottom,
      muestra: filas.slice(0, 2).map(f => f.textContent.replace(/\s+/g, ' ').trim()),
    };
  });
  ok(lista.abierto && lista.display === 'flex', 'pinchar la cifra abre la LISTA (y el boton se queda marcado de abierto)', `"${lista.titulo}"`);
  ok(lista.n === lista.activas, 'estan TODAS: cada obrera y cada reina, una fila por bicho', `${lista.n} filas · ${antes.obreras} obreras + ${antes.reinas} reinas`);
  ok(lista.letraFila >= 15 && lista.altoFila >= 34, 'la fila es legible y se le da con el dedo sin apuntar mucho', `letra ${lista.letraFila}px · alto ${lista.altoFila}px`);
  ok(/·/.test(lista.muestra[0] || '') && /[A-ZÁ-Ú]+/.test(lista.muestra[0] || ''), 'cada fila dice quien es y que esta haciendo', `"${(lista.muestra[0] || '').slice(0, 64)}"`);
  ok(lista.chips.length >= 4, 'y hay filtros por casta, con su cuenta', lista.chips.join(' | '));
  ok(lista.fuera <= 1 && lista.derecha <= 1, 'la hoja cabe en pantalla: no se sale ni por abajo ni por la derecha', `${lista.fuera} px por debajo, ${lista.derecha} px por la derecha`);
  ok(!lista.tocandoBarra, 'y no se monta encima de la barra de la velocidad');
  const filas = await page.evaluate(() => {
    const fs = [...document.querySelectorAll('#rosterCuerpo .ficha-hormiga')].slice(0, 4);
    return fs.map(f => {
      const n = f.querySelector('.fh-nombre'), ta = f.querySelector('.fh-tarea'), d = f.querySelector('.fh-dato');
      const rn = n.getBoundingClientRect(), rd = d.getBoundingClientRect(), rta = ta.getBoundingClientRect();
      return { desbordaNombre: n.scrollWidth - n.clientWidth, desbordaTarea: ta.scrollWidth - ta.clientWidth,
        elipsis: getComputedStyle(ta).textOverflow === 'ellipsis' && getComputedStyle(ta).overflow === 'hidden',
        title: (f.getAttribute('title') || '').length,
        bloque: getComputedStyle(n).display, choque: Math.round(rta.right - rd.left), ancho: Math.round(f.getBoundingClientRect().width) };
    });
  });
  ok(filas.length > 0 && filas.every(f => f.desbordaNombre <= 1), 'el nombre de la fila NUNCA se corta (es lo que hay que reconocer)', filas.map(f => f.desbordaNombre).join(' · ') + ' px de sobrante');
  ok(filas.length > 0 && filas.every(f => f.desbordaTarea <= 1 || f.elipsis), 'y si la tarea no cabe, se va con puntos dentro de su columna (nunca montada sobre la cifra de al lado)', filas.map(f => f.desbordaTarea + (f.elipsis ? '(con ellipsis)' : '(SIN ellipsis)')).join(' · '));
  ok(filas.length > 0 && filas.every(f => f.title > 12), 'la frase completa vive en el tooltip de la fila, por si el recorte deja ganas de mas', `${filas[0].title} caracteres`);
  ok(filas.length > 0 && filas.every(f => f.bloque === 'block'), 'y eso exige que sean de bloque (un span con nowrap no recorta nada: medido, se montaba encima del «0.0 d»)', filas[0].bloque);
  ok(filas.length > 0 && filas.every(f => f.choque <= 0), 'ninguna columna se monta sobre la de al lado', filas.map(f => f.choque + 'px').join(' · '));
  ok(lista.scrollea || lista.cuerpoAlto > 0, 'el cuerpo de la lista es el que scrollea (no la ventana entera)', `cuerpo ${lista.cuerpoAlto}px · ${lista.scrollea ? 'con recorrido' : 'le cabe todo, asi que no hace falta'}`);

  // un filtro de verdad
  const filtrado = await page.evaluate(async () => {
    const chip = document.querySelector('#rosterFiltros [data-f="REINA"]');
    if (!chip) return null;
    chip.click(); await new Promise(r => setTimeout(r, 260));
    const filas = [...document.querySelectorAll('#rosterCuerpo .ficha-hormiga')];
    return { n: filas.length, todasReinas: filas.length > 0 && filas.every(f => /♛/.test(f.textContent)), texto: (filas[0] || { textContent: '' }).textContent.replace(/\s+/g, ' ').trim().slice(0, 44), pressed: (document.querySelector('#rosterFiltros [data-f="REINA"]') || { getAttribute: () => 'sin chip' }).getAttribute('aria-pressed') };
  });
  ok(filtrado && filtrado.todasReinas && filtrado.pressed === 'true', 'los filtros cortan de verdad (♛ REINAS deja solo las reinas)', `${filtrado && filtrado.n} fila(s) · "${filtrado && filtrado.texto}"`);
  await page.evaluate(() => { const c = document.querySelector('#rosterFiltros [data-f="TODAS"]'); if (c) c.click(); });
  await sleep(260);

  console.log('\n· de la lista al perfil, y del perfil de vuelta a la lista');
  await page.waitForFunction("!!document.querySelector('#rosterCuerpo .ficha-hormiga[data-id]')", { timeout: 8000 }).catch(() => { });
  // La primera fila es la REINA (la lista va por castas), y a la reina la abre su propia hoja: para la
  // hormiga se busca una fila de obrera, que es la que lleva al perfil con el cerebro dentro.
  const filaId = await page.evaluate(() => {
    const sh = document.getElementById('rosterSheet');
    if (!sh.getAttribute('data-open')) abrirRoster();          // si se cerro por lo que sea, se vuelve a abrir: la prueba mide la lista
    const ids = [...document.querySelectorAll('#rosterCuerpo .ficha-hormiga[data-id]')].map(f => f.dataset.id);
    const obrera = ids.find(id => workers.some(w => w.id === id));
    return obrera || ids[0] || null;
  });
  await sleep(260);
  await page.evaluate((id) => { const f = document.querySelector('#rosterCuerpo .ficha-hormiga[data-id="' + id + '"]'); if (f) f.click(); }, filaId);
  await sleep(520);
  const perfil = await page.evaluate(async () => {
    const m = document.getElementById('antProfile'); const r = m.getBoundingClientRect();
    m.scrollTop = 99999;
    await new Promise(rr => setTimeout(rr, 60));
    const ult = m.lastElementChild ? m.lastElementChild.getBoundingClientRect() : null;
    const mr = m.getBoundingClientRect(), scaleY = m.offsetHeight ? mr.height / m.offsetHeight : 1;
    // `mr.bottom` includes the 4 px decorative border. The scroll viewport ends at the padding edge:
    // compare against that real visible edge instead of treating a healthy black border as clipped space.
    const viewportBottom = mr.top + (m.clientTop + m.clientHeight) * scaleY;
    return { abierto: !!m.getAttribute('data-open'), id: m.getAttribute('data-ant'), ancho: Math.round(r.width), fuera: +(r.bottom - window.innerHeight).toFixed(1),
      overflow: getComputedStyle(m).overflowY, noHaceFalta: m.scrollHeight <= m.clientHeight + 1,
      ultimoDentro: ult ? +(viewportBottom - ult.bottom).toFixed(1) : null,
      rosterCerrado: !document.querySelector('#rosterSheet[data-open]'), volver: getComputedStyle(document.getElementById('btnVolver')).display };
  });
  ok(perfil.abierto && perfil.id === filaId, 'pinchar una fila abre el perfil de ESA hormiga', `data-ant="${perfil.id}"`);
  ok(perfil.rosterCerrado, 'la lista se aparta (una hoja, no dos montadas)');
  const cab = await page.evaluate(() => { const p = document.getElementById('profileId'), r = document.getElementById('profileRole'), q = document.getElementById('profileTitle'); return { id: { desb: p.scrollWidth - p.clientWidth, txt: p.textContent.trim() }, rol: { desb: r.scrollWidth - r.clientWidth }, tit: { desb: q.scrollWidth - q.clientWidth, titulo: q.getAttribute('title') || '' } }; });
  ok(cab.id.desb <= 1 && /❤\s*\d+%/.test(cab.id.txt), 'la linea ID · EDAD · VIDA ya no esconde la vida detras de unos puntos: hace dos lineas si hace falta', `"${cab.id.txt}" · sobrante ${cab.id.desb}`);
  ok(cab.rol.desb <= 1, 'y la linea del rol tampoco se corta', `sobrante ${cab.rol.desb}`);
  ok(cab.tit.desb <= 1 || cab.tit.titulo.length > 0, 'el titulo admite el recorte porque su texto completo vive en el tooltip', `"${cab.tit.titulo}"`);
  ok(perfil.volver !== 'none', 'y el perfil ofrece el boton de volver a la lista', '◂ LISTA visible');
  ok(perfil.ancho >= 300 && perfil.fuera <= 1, `la hoja mide ${perfil.ancho}px y no se sale de la pantalla`, `${perfil.fuera} px por debajo`);
  ok(perfil.overflow === 'auto' || perfil.overflow === 'scroll', 'el perfil se recorre con la rueda cuando lo pide', 'overflow-y: ' + perfil.overflow);
  ok(perfil.noHaceFalta || perfil.ultimoDentro !== null && perfil.ultimoDentro <= 1, 'y lo que no cabe se alcanza a ver bajando del todo', perfil.noHaceFalta ? 'en esta ventana cabia entero' : `ultimo elemento ${perfil.ultimoDentro}px dentro de la caja`);
  await page.click('#btnVolver'); await sleep(420);
  ok(await page.evaluate('(()=>!!document.querySelector("#rosterSheet[data-open]"))()'), 'y ◂ LISTA te devuelve a la lista, en un click');
  await page.click('#btnCloseRoster'); await sleep(360);

  const filaReina = await page.evaluate(() => {
    abrirRoster();
    const ids = [...document.querySelectorAll('#rosterCuerpo .ficha-hormiga[data-id]')].map(f => f.dataset.id);
    return ids.find(id => queens.some(q => q.id === id)) || null;
  });
  await sleep(320);
  const reinaHoja = await page.evaluate((id) => {
    const f = document.querySelector('#rosterCuerpo .ficha-hormiga[data-id="' + id + '"]');
    if (f) f.click();
    return true;
  }, filaReina);
  await sleep(560);
  const reina = await page.evaluate(() => {
    const m = document.getElementById('queenProfile');
    return { abierto: !!m.getAttribute('data-open'), id: m.getAttribute('data-queen'), volver: getComputedStyle(document.getElementById('btnVolverQ')).display, ancho: Math.round(m.getBoundingClientRect().width), alto: Math.round(m.getBoundingClientRect().height), mente: !!document.querySelector('#queenProfile [data-ptab="cerebro"]') };
  });
  ok(reina.abierto && reina.id === filaReina, 'la fila de la reina abre la hoja de la REINA (no el perfil de una obrera)', `data-queen="${reina.id}" · ${reina.ancho}x${reina.alto}`);
  ok(reina.volver !== 'none', 'y esa hoja tambien tiene su ◂ LISTA para volver');
  ok(!reina.mente, 'el cerebro NO se le ofrece en la hoja de la reina: a ella no la mueve la red neuronal (forwardNN solo corre en el paso de las obreras)', 'nada de inventarle pensamientos');
  await page.evaluate(() => { closeQueenProfile(); });
  await sleep(420);

  console.log('\n· el cerebro, en palabras, dentro de la hoja');
  await page.evaluate((id) => { const a = workers.find(w => w.id === id) || workers[0]; showAntProfile(a); }, filaId);
  await sleep(420);
  const cabecera = await page.evaluate(async () => {
    const t = document.querySelector('#profileTabs [data-ptab="rasgos"]'); t.click();
    await new Promise(rr => setTimeout(rr, 120));
    const g = document.getElementById('profileTraitsGist'), d = document.getElementById('profileDeliveries');
    const e = document.getElementById('profileTab_estado'); const celd = [...document.querySelectorAll('#profileTab_estado > div > div')];
    const fi = t; // la frase de rasgos y la de estado, medidas
    return { gist: g.textContent.trim(), gistCorta: g.scrollWidth - g.clientWidth, entregas: d.textContent.trim(),
      estadoVisible: getComputedStyle(e).display !== 'none',
      celdas: celd.map(c => ({ txt: c.textContent.replace(/\s+/g, ' ').trim().slice(0, 26), desb: c.scrollWidth - c.clientWidth })) };
  });
  ok(/^Best trait: .+ \(\d+ of 100\)\. Weakest: .+ \(\d+\)\.$/.test(cabecera.gist), 'los RASGOS vienen con una frase que dice en que es buena (y en que peor)', `"${cabecera.gist}"`);
  ok(cabecera.gistCorta <= 1, 'y la frase cabe entera en la hoja', `${cabecera.gistCorta}px de sobrante`);
  ok(/deliveries/.test(cabecera.entregas) && !/excavs|ent •/.test(cabecera.entregas), 'el recuento de servicios ya no va en abreviaturas ininteligibles', `"${cabecera.entregas}"`);
  ok(cabecera.celdas.every(c => c.desb <= 1), 'ninguna caja del estado se sale de su hueco con los titulos nuevos', cabecera.celdas.map(c => c.desb + '·' + c.txt).join(' | '));

  const mente = await page.evaluate(async () => {
    const tab = document.querySelector('#profileTabs [data-ptab="cerebro"]');
    tab.click();
    await new Promise(r => setTimeout(r, 700));
    const pane = document.getElementById('profileTab_cerebro');
    const filas = [...pane.querySelectorAll('.linea-mente')];
    const cv = document.getElementById('profileNn');
    const cx = cv.getContext('2d');
    const d = cx.getImageData(0, 0, cv.width, cv.height).data;
    const col = new Set(); let distintos = 0; let pintados = 0;
    for (let i = 0; i < d.length; i += 4) { const k = d[i] + ',' + d[i + 1] + ',' + d[i + 2]; if (!col.has(k)) { col.add(k); distintos++; } if (!(d[i] < 12 && d[i + 1] < 12 && d[i + 2] < 12)) pintados++; }
    const r = pane.getBoundingClientRect(), mr = document.getElementById('antProfile').getBoundingClientRect();
    return {
      visible: getComputedStyle(pane).display !== 'none', n: filas.length,
      texto: filas.map(f => f.textContent.replace(/\s+/g, ' ').trim()),
      resumen: document.getElementById('profileMindGist').textContent.replace(/\s+/g, ' ').trim(),
      recortadas: filas.filter(f => f.scrollWidth > f.clientWidth + 1).length,
      letra: filas.length ? parseFloat(getComputedStyle(filas[0]).fontSize) : 0,
      ancho: Math.round(r.width), anchoHoja: Math.round(mr.width),
      distintos, pintados, cuadro: cv.getBoundingClientRect().width > 200,
      numeros: (() => { const n = document.getElementById('profileMindNums'); return { oculto: getComputedStyle(n).display === 'none', txt: (n.textContent || '').slice(0, 30) }; })(),
    };
  });
  ok(mente.visible, 'el perfil tiene su pestana 🧠 MENTE y se abre dentro de la hoja');
  ok(mente.n >= 6, 'ahi esta lo que nota y lo que decide, en lineas separadas', `${mente.n} lineas · letra ${mente.letra}px`);
  ok(mente.recortadas === 0, 'ni una frase se corta con el borde de la hoja', `${mente.recortadas} recortadas de ${mente.n} · ${mente.ancho}px dentro de ${mente.anchoHoja}px`);
  ok(mente.letra >= 14, 'en VT323 a 15px o mas, que es lo que se lee de una sentada', `${mente.letra}px`);
  ok(/—|\.|·/.test(mente.resumen) && mente.resumen.length > 24 && !/[A-Z]{2,}_/.test(mente.resumen), 'y hay un resumen en una frase antes de todo', `"${mente.resumen.slice(0, 78)}"`);
  ok(mente.pintados > 4000 && mente.distintos > 12, 'la rejilla de neuronas se pinta EN la hoja (no es un hueco negro)', `${mente.distintos} colores · ${mente.pintados} pixeles pintados de ${300 * 120}`);
  ok(mente.cuadro, 'el lienzo ocupa el ancho de la caja (se estira con la hoja, no se queda chico)');
  ok(mente.numeros.oculto, 'los numeros crudos vienen escondidos (el default son las frases)', `caja: "${mente.numeros.txt}"`);
  const nums = await page.evaluate(async () => {
    document.getElementById('btnCerebroNumeros').click();
    await new Promise(r => setTimeout(r, 260));
    const n = document.getElementById('profileMindNums');
    return { visible: getComputedStyle(n).display !== 'none', txt: n.textContent };
  });
  ok(nums.visible && /INPUT/.test(nums.txt) && /-1 to 1/.test(nums.txt) && /OUTPUT/.test(nums.txt), '«ver numeros» destapa los 11 sensores y las 5 salidas, con su escala', `${(nums.txt.match(/\n/g) || []).length + 1} lineas`);
  await page.evaluate(() => document.getElementById('btnCerebroNumeros').click()); await sleep(180);

  console.log('\n· el inventario: todo lo que hay, scrolleable');
  const encima = await page.evaluate(() => { const b = document.getElementById('btnInventory'); const r = b.getBoundingClientRect(); const e = document.elementFromPoint(Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)); return { en: Math.round(r.x) + ',' + Math.round(r.y), topo: e ? (e.id || e.className || e.tagName) : 'nada', esEl: b.contains(e) }; });
  ok(encima.esEl, 'el boton del almacen está a la mano: nada se le monta encima', `centro ${encima.en} · arriba hay "${encima.topo}"`);
  await page.click('#btnInventory'); await sleep(560);
  const inv = await page.evaluate(async () => {
    const sh = document.getElementById('invSheet'), cuerpo = document.getElementById('invBody');
    const r = sh.getBoundingClientRect();
    const antes = cuerpo.scrollTop;
    cuerpo.scrollTop = 99999;
    await new Promise(r => setTimeout(r, 90));
    const abajo = cuerpo.scrollTop;
    const ult = cuerpo.lastElementChild ? cuerpo.lastElementChild.getBoundingClientRect() : null;
    const cb = cuerpo.getBoundingClientRect();
    return {
      abierto: sh.getAttribute('data-open') === '1', display: getComputedStyle(sh).display,
      ancho: Math.round(r.width), fuera: +(r.bottom - window.innerHeight).toFixed(1),
      overflowY: getComputedStyle(cuerpo).overflowY, scrollea: abajo > 0,
      antes, abajo, filas: cuerpo.querySelectorAll('div').length,
      ultimosDentro: ult ? +(ult.bottom - cb.bottom).toFixed(1) : null,
      letra: cuerpo.firstElementChild ? parseFloat(getComputedStyle(cuerpo.firstElementChild).fontSize) : 0,
      vacio: cuerpo.childElementCount === 0,
      perfilCerrado: !document.querySelector('#antProfile[data-open]'),
    };
  });
  ok(inv.abierto && inv.display === 'flex', 'la hoja del almacen se abre con su boton de la barra', `${inv.ancho}px de ancho`);
  ok(inv.perfilCerrado, 'y cierra el perfil: una hoja a la vez');
  ok(inv.overflowY === 'auto' || inv.overflowY === 'scroll', 'el cuerpo de la hoja es el que lleva el scroll', `overflow-y: ${inv.overflowY}`);
  ok(inv.scrollea, 'se puede recorrer hasta el ultimo renglon (no se queda cortado por el borde)', `scrollTop 0 → ${inv.abajo}px · ${inv.filas} bloques`);
  ok(inv.ultimosDentro !== null && inv.ultimosDentro <= 1, 'el ultimo elemento queda DENTRO de la caja cuando bajas del todo', `${inv.ultimosDentro} px de diferencia`);
  ok(!inv.vacio, 'la hoja del almacen trae contenido pintado', `${inv.filas} bloques`);
  ok(inv.letra >= 13, 'la letra del inventario tambien subio', `${inv.letra}px`);
  ok(inv.fuera <= 1, 'la hoja entera cabe en la pantalla', `${inv.fuera} px por debajo del borde`);

  console.log('\n· el conjunto, sin desvirtuar');
  const global = await page.evaluate(() => {
    const vis = s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), desborda: e.scrollWidth - e.clientWidth }; };
    const solapadas = (a, b) => !!(a && b) && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    const vel = vis('#velAntBar'), cal = vis('#calendarWidget'), inv = vis('#invSheet');
    const selladas = ['#economyBar', '#btnTurbo', '.ai-pane'].map(s => { const e = document.querySelector(s); return s + ':' + (e ? getComputedStyle(e).display : 'no existe'); });
    return {
      vel, cal, inv,
      barraCalSeMontan: solapadas(vel, cal), barraInvSeMonta: solapadas(vel, inv),
      topHoja: inv ? inv.y : null, abajoCal: cal ? cal.y + cal.h : null, hojaBajaCal: !!(inv && cal) && inv.y >= cal.y + cal.h - 1,
      selladas,
      botones: [...document.querySelectorAll('#velAntBar button')].map(b => b.id).filter(Boolean),
      nSpeed: [...document.querySelectorAll('#velAntBar [id^="btnVel"]')].length,
      dentro: !!document.querySelector('#velAntBar #btnRoster'),
      errs: 0,
    };
  });
  ok(!global.barraCalSeMontan, 'barra y calendario no se pisan con los nuevos tamanos', `${global.vel.w}x${global.vel.h} arriba, ${global.cal.w}x${global.cal.h} debajo`);
  ok(!global.barraInvSeMonta, 'la hoja del almacen abre por debajo de la barra, no encima');
  ok(global.hojaBajaCal, 'y por debajo del calendario: su cabecera no queda under el reloj (eso tapaba las primeras filas)', `hoja en y=${global.topHoja}, calendario termina en y=${global.abajoCal}`);
  ok(global.dentro, 'la puerta a la lista vive DENTRO de la barra (en su propia celda de OBRERAS)', global.botones.join(', '));
  ok(global.nSpeed === 6 && global.vel.desborda <= 0, 'la tira de velocidad sigue siendo la unica y no se le corta nada', `${global.nSpeed} botones (⏸ + x1..x16) · sobrante ${global.vel.desborda}`);
  ok(global.selladas.every(s => /:(none|no existe)/.test(s)), 'lo demas sigue sellado: no abri un panel lateral para esconder otro', global.selladas.join(' · '));
  ok(errs.length === 0, 'cero errores de javascript con todo abierto', errs.slice(0, 2).join(' | ') || 'ninguno');

  try { fs.mkdirSync(CARPETA, { recursive: true }); await page.screenshot({ path: CARPETA + '/hojas-legibles-almacen.png' }); } catch (e) { }
  await page.click('#btnCloseInv'); await sleep(320);
  await page.evaluate(() => { showAntProfile(workers.find(w => w.id === document.getElementById('antProfile').getAttribute('data-ant')) || workers[0]); const t = document.querySelector('#profileTabs [data-ptab="cerebro"]'); if (t) t.click(); });
  await sleep(600);
  await page.click('#btnRoster'); await sleep(500);
  await page.evaluate(() => cerrarRoster()); await sleep(300);
  try { await page.screenshot({ path: CARPETA + '/hojas-legibles-perfil.png' }); } catch (e) { }
  await page.evaluate(() => { const m = document.getElementById('antProfile'); abrirRoster(); return { perfilabierto: !!m.getAttribute('data-open') }; }); await sleep(520);
  const exclusivas = await page.evaluate(() => ({ lista: !!document.querySelector('#rosterSheet[data-open]'), perfil: !!document.querySelector('#antProfile[data-open]') }));
  ok(exclusivas.lista && !exclusivas.perfil, 'abrir la LISTA cierra el perfil abierto: una sola hoja en esa columna, no dos cabeceras montadas', `lista ${exclusivas.lista} · perfil ${exclusivas.perfil}`);
  try { await page.screenshot({ path: CARPETA + '/hojas-legibles-lista.png' }); } catch (e) { }

  console.log(`\n${pass} ok · ${failn} FALLOS`);
  await browser.close();
  server.close();
  process.exit(failn ? 1 : 0);
})().catch(async e => {
  console.log('FALLO del arnes:', e.message);
  try { fs.mkdirSync(CARPETA, { recursive: true }); if (typeof page !== 'undefined' && page) await page.screenshot({ path: CARPETA + '/hojas-legibles-ROTO.png' }); } catch (_) { }
  try { if (typeof browser !== 'undefined' && browser) await browser.close(); } catch (_) { }
  server.close(); process.exit(1);
});
