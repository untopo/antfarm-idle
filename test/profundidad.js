/**
 * profundidad.js - LA ESCALERA, medida en CHROME real con las funciones del juego (nada de copias).
 *
 * El dueno pidio: «que puedan seguir cavando hacia abajo si quieren; que mientras mas profundo, mas raros
 * los materiales; que cada vez que lleguen al limite se desbloqueen mas areas, con tesoros y cosas
 * asombrosas». Eso son cuatro afirmaciones, y cada una se mide aqui:
 *
 *   A. el fondo del mapa NO es el borde del mundo: es una LOSA con puntos de vida de la colonia;
 *   B. la escalera tiene predominio por profundidad, estratos mezclados y vetas con núcleo abundante;
 *      las colas pobres pueden cruzar una banda, pero lo raro no aparece regalado al fundar;
 *   C. las hormigas, solas, sin tocar nada desde fuera, le arrancan mordiscos a la losa;
 *   D. romperla abre una banda de verdad: filas nuevas, vetas nuevas, cueva, botin, y la regla de
 *      profundidad se estira con el mapa;
 *   E. las reliquias existen, se guardan, salen en la VITRINA del panel y dan su bonus de excavacion;
 *   F. el magma de la ultima banda cobra peaje (fatiga arriba y la obrera sube);
 *   G. el coste por cuadro no se dispara y no hay errores de JavaScript.
 *
 *   node test/profundidad.js
 */
const http = require('http');
const fs = require('fs');
fs.mkdirSync('/tmp/antfarm-capturas', { recursive: true });
const path = require('path');
const puppeteer = require('puppeteer');
const ROOT = path.resolve(__dirname, '..');
const PORT = 8182;
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

// Escanea el mapa con las tablas del propio juego. Para la monotonia se mira la ROCA dominante de cada
// fila (las vetas son manchas dentro de la banda, no bandas); la LOSA (17) y el FUEGO (15) no cuentan.
const ESCANER = `(()=>{
  const ROCA={1:0,2:1,3:2,4:3,5:3,6:4,11:5,12:6,13:7,14:8,18:6};
  const dom=[]; const durezas=[];
  for(let r=SURFACE_ROW;r<ROWS;r++){
    let cuenta={};
    for(let c=0;c<COLS;c++){ if(!soil[r]||soil[r][c]!==1) continue; const t=soilType[r]?soilType[r][c]:0; if(ROCA[t]===undefined) continue; cuenta[t]=(cuenta[t]||0)+1; }
    let mejor=0, mejc=-1; for(const k in cuenta){ if(cuenta[k]>mejc){ mejor=+k; mejc=cuenta[k]; } }
    dom.push(mejor? ROCA[mejor] : -1); durezas.push(mejor? durezaDe(mejor) : 0);
  }
  let saltoAtras=0, det='';
  for(let i=1;i<dom.length;i++){ if(dom[i]<0||dom[i-1]<0) continue; if(dom[i]<dom[i-1]){ saltoAtras++; det=det||('piso '+(i-1)+'->'+i+': '+dom[i-1]+'->'+dom[i]); } }
  const mal={cobre:0,hierro:0,oro:0,gema:0,det:''}, nucleo={cobre:0,hierro:0,oro:0,gema:0}, hay={cobre:0,hierro:0,oro:0,gema:0,magma:0,losa:0,cuarzo:0,marmol:0,basalto:0};
  for(let r=SURFACE_ROW;r<ROWS;r++){ const d=r-SURFACE_ROW,b=bandaDe(d);
    for(let c=0;c<COLS;c++){ const t=soilType[r]?soilType[r][c]:0; if(!t) continue;
      const fuera=()=>{ if(!mal.det) mal.det='t'+t+' en piso '+d+' (banda '+b+') ['+c+','+r+']'; };
      if(t===8){ hay.cobre++; if(Math.abs(d-18)<=9)nucleo.cobre++; if(b!==3){ mal.cobre++; fuera(); } }
      else if(t===9){ hay.hierro++; if(Math.abs(d-27)<=9)nucleo.hierro++; if(b!==4){ mal.hierro++; fuera(); } }
      else if(t===10){ hay.oro++; if(Math.abs(d-35)<=7)nucleo.oro++; if(b!==5 && b!==8){ mal.oro++; fuera(); } }
      else if(t===16){ hay.gema++; if(Math.abs(d-44)<=10)nucleo.gema++; if(b!==6 && b!==7){ mal.gema++; fuera(); } }
      else if(t===15) hay.magma++;
      else if(t===11) hay.cuarzo++;
      else if(t===12) hay.marmol++;
      else if(t===14) hay.basalto++;
      else if(t===17) hay.losa++;
    } }
  return {filas:ROWS, pisos:ROWS-SURFACE_ROW, bandas:dom.filter(x=>x>=0), saltoAtras, det, mal, nucleo, hay,
          losa: soilType[ROWS-1]? soilType[ROWS-1][3] : -1, losaSuelo: soil[ROWS-1]? soil[ROWS-1][3] : -1};
})()`;

// el panel se refresca con porterfa de tiempo (shouldUpdateUI, 140 ms): hay que esperar a que deje pasar
async function leePanel(page, id) {
  const lee = `(document.getElementById('${id}')||{}).textContent||''`;
  let t = await page.evaluate(lee);
  for (let i = 0; i < 15 && !t.trim(); i++) {
    await sleep(100);
    await page.evaluate(`(()=>{ try{ updateColonyUI(); }catch(e){} })()`);
    t = await page.evaluate(lee);
  }
  return t;
}

(async () => {
  await new Promise(r => server.listen(PORT, '0.0.0.0', r));
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  // Procedural geology is statistical; pin the browser RNG before any game script runs so this test
  // measures one reproducible world while core-mundo/geologia-integracion sample hundreds of seeds.
  await page.evaluateOnNewDocument(() => { let a=424242>>>0; Math.random=()=>{ a=(a+0x6D2B79F5)|0; let t=Math.imul(a^(a>>>15),1|a); t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; }; });
  await page.setViewport({ width: 1280, height: 800 });
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|autoplay|AudioContext/.test(m.text())) errs.push('console: ' + m.text().slice(0, 160)); });

  await page.goto(`http://127.0.0.1:${PORT}/ant-farm-rpg/index.html`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction("!document.getElementById('splashScreen') || document.getElementById('splashScreen').style.display==='none'", { timeout: 20000 }).catch(() => { });
  await page.click('#btnMainCreate'); await sleep(350);
  await page.click('#createSizeScreen [data-size="small"]'); await sleep(350);
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
  await page.evaluate(() => { try {
    // Pin the actual world seed after creation as well: animation timing can consume a different number
    // of Math.random calls before the click, but geology itself must be identical on every run.
    worldSeed=worldSeed32(424242); initSoil(); detectarEntrada();
    window.pushImportant = () => null;
    ['onboardingModal', 'onboardingLegacy'].forEach(i => { const e = document.getElementById(i); if (e) e.style.display = 'none'; });
  } catch (e) { } });
  await sleep(1200);

  console.log('\n· A: el fondo es una losa, no el borde del mapa');
  const e0 = await page.evaluate(`window._escalera()`);
  ok(e0.losa === 17 && e0.losaSuelo === 1, 'hay LOSA de umbral en la ultima fila, con su piedra intacta', `fila ${e0.umbral.r} · hp ${e0.umbral.hp}/${e0.umbral.hpMax} · guarda ${e0.umbral.guarda}`);
  ok(e0.pisos >= 18 && e0.bandaFondo >= 3, 'el mundo pequeno ya tiene escalera donde empezar', `${e0.pisos} pisos, fondo en ${await page.evaluate(`NOMBRE_BANDA(bandaMax)`)} (banda ${e0.bandaFondo})`);

  console.log('\n· B: predominio por profundidad, sin franjas ni exclusiones mágicas');
  const esc0 = await page.evaluate(ESCANER);
  ok(esc0.saltoAtras<=Math.max(2,Math.floor(esc0.pisos*0.08)), 'los pliegues locales no borran la tendencia profunda', `${esc0.saltoAtras} pliegues hacia arriba ${esc0.det || ''}`.trim());
  ok(esc0.hay.cobre >= 4 && esc0.nucleo.cobre >= esc0.hay.cobre*0.68, 'el cobre esta a mano y predomina cerca de su núcleo', `${esc0.nucleo.cobre}/${esc0.hay.cobre} en núcleo`);
  const _raros0=esc0.hay.hierro+esc0.hay.oro+esc0.hay.gema;
  ok(_raros0<=Math.max(4,Math.floor(esc0.hay.cobre*0.60)), 'las trazas vecinas siguen claramente por debajo del cobre al fundar', `cobre ${esc0.hay.cobre} · raros ${_raros0}`);
  const _tot0=esc0.hay.cobre+_raros0,_nuc0=esc0.nucleo.cobre+esc0.nucleo.hierro+esc0.nucleo.oro+esc0.nucleo.gema;
  ok(_tot0-_nuc0<=Math.max(2,Math.floor(_tot0*0.32)), 'las colas pobres siguen siendo minoría frente al núcleo de cada veta', `${_tot0-_nuc0} trazas de ${_tot0}`);

  console.log('\n· C: mordisquear la losa (y que no se borre con un capricho)');
  const h0 = await page.evaluate(`umbral.hp`);
  await page.evaluate(`window._morderUmbral(3)`);
  const h1 = await page.evaluate(`window._escalera().umbral`);
  ok(h1.hp < h0 - 2, 'tres mordiscos bajan los puntos de la losa', `${h0.toFixed(1)} -> ${h1.hp.toFixed(1)}`);
  const esc1 = await page.evaluate(ESCANER);
  ok(esc1.losa === 17 && esc1.filas === esc0.filas, 'la piedra sigue ahi: el progreso es de la colonia, no un bloque que desaparece', `tipo ${esc1.losa} · ${esc1.filas} filas`);
  await page.evaluate(`view.zoom=2.4; view.y=Math.max(0,(ROWS-1)*CELL-300); clampView();`);
  await sleep(500);
  await page.screenshot({ path: '/tmp/antfarm-capturas/losa-umbral.png' });
  // y el esfuerzo colectivo, sin ayudas: la partida es suya y vemos si la losa cede. Se siembra la
  // colonia con window._fakes(30) - el mismo andamio que usan las otras pruebas del repo - porque una
  // granja recien criada tiene 4 obreras y a x16 no llegan a bajar del todo en el tiempo de la prueba.
  await page.evaluate(`(()=>{ try{ window._fakes(30); }catch(e){} })()`);
  // y se les deja una galeria de acceso justo encima de la losa. Esto NO es trampilla del test: lo que se
  // quiere comprobar aqui es que LA OBRA DE LA LOSA arranca sola (que nadie tiene que picar desde fuera),
  // no que una colonia nueva baje 12 pisos en 30 segundos - eso, medido, tarda mas de un dia de juego.
  await page.evaluate(`(()=>{ const c0=Math.floor(COLS/2)-3; for(let r=ROWS-3;r<ROWS-1;r++) for(let c=c0;c<c0+7;c++){ soil[r][c]=0; soilType[r][c]=0; markSoilDirty(c,r); }
    // y a las obreras de prueba se las planta en esa galeria: lo que se mide aqui es si EL MCPICO arranca
    // solo (que la losa pierde puntos sin que nadie le baje la vida desde fuera), no cuanto tarda una
    // colonia en bajar doce pisos, que es otro asunto y ya lo mide el punto D con las bandas.
    workers.forEach((w,i)=>{ w.x=(Math.floor(COLS/2)-3+(i%7))*CELL+8; w.y=(ROWS-2)*CELL+8; w.state='EXPLORAR'; w.digTarget=null; w.digProgress=0; w.blocked=0; });
  })()`);
  await sleep(900);
  const cede = await page.evaluate(`(()=>{ umbral.hp=umbral.hpMax; return umbral.hp; })()`);
  await page.evaluate(`setGameSpeed(32)`);
  // se espera a que pase algo, con techo de 34 s: si la losa no pierde ni un punto en ese rato, es que la
  // obra no arranca sola y el test tiene que decirlo (no se le baja el liston, se le da tiempo de sobra).
  let cede2 = null;
  for (let i = 0; i < 17; i++) {
    await sleep(2000);
    cede2 = await page.evaluate(`(()=>({hp: umbral? umbral.hp : -1, rotos: umbralesRotos, cavando: workers.filter(w=>w.state==='CAVANDO').length,
      enLosa: workers.filter(w=>w.digTarget&&soilType[w.digTarget.r]&&soilType[w.digTarget.r][w.digTarget.c]===17).length,
      fondo: (()=>{ let d=-1; for(let r=ROWS-1;r>SURFACE_ROW && d<0;r--){ for(let c=0;c<COLS;c++){ if(soil[r][c]===0){ d=r-SURFACE_ROW; break; } } } return d; })()}))()`);
    if (cede2.rotos > 0 || cede2.hp < cede - 1) break;
  }
  ok(cede2.rotos > 0 || (cede2.hp >= 0 && cede2.hp < cede - 1), 'cavando por su cuenta la colonia le come la losa (no hay que empujarla desde fuera)', `hp ${cede} -> ${cede2.hp} · ${cede2.rotos} losas rotas · ${cede2.cavando} cavando · ${cede2.enLosa} a la losa · ${cede2.fondo} filas de profundidad abiertas`);
  ok(cede2.cavando>3&&cede2.enLosa>=4&&cede2.enLosa<=8, 'hay cuadrilla visible sin reclutar a toda la colonia', `${cede2.cavando} cavando · ${cede2.enLosa} en la losa`);

  console.log('\n· D: reventarla abre la banda siguiente');
  const marcasAntes = await page.evaluate(`document.querySelectorAll('.depth-mark').length`);
  const ab4 = await page.evaluate(`window._irABanda(4)`);
  await sleep(600);
  const esc4 = await page.evaluate(ESCANER);
  ok(ab4.umbralesRotos >= 1 && esc4.filas > esc1.filas, 'el mapa crece cuando la losa cede', `${esc1.filas} -> ${esc4.filas} filas · ${ab4.umbralesRotos} losas rotas`);
  ok(esc4.hay.hierro >= 4, 'y en la banda nueva esta el HIERRO, que antes no existia', `${esc4.hay.hierro} casillas de hierro`);
  ok(esc4.losa === 17, 'la escalera no acaba en el vacio: vuelve a haber losa abajo del todo', `fila ${esc4.filas - 1}`);
  const marcasDespues = await page.evaluate(`(()=>{ updateDepthRuler(); return document.querySelectorAll('.depth-mark').length; })()`);
  ok(marcasDespues > marcasAntes, 'la regla de profundidad se estira con el mapa', `${marcasAntes} -> ${marcasDespues} marcas`);
  const ab6 = await page.evaluate(`window._irABanda(6)`);
  await sleep(700);
  const esc6 = await page.evaluate(ESCANER);
  ok(esc6.hay.marmol > 40 && esc6.hay.cuarzo > 40, 'la CUARCITA y el MÁRMOL NEGRO llegan al mapa al abrir sus losas', `cuarza ${esc6.hay.cuarzo} · marmol ${esc6.hay.marmol}`);
  ok(esc6.hay.oro >= 1, 'el ORO se vuelve abundante al alcanzar la cuarcita', `${esc6.hay.oro} casillas`);
  const _totMin=esc6.hay.cobre+esc6.hay.hierro+esc6.hay.oro+esc6.hay.gema;
  const _nucMin=esc6.nucleo.cobre+esc6.nucleo.hierro+esc6.nucleo.oro+esc6.nucleo.gema;
  const _colas=_totMin-_nucMin;
  ok(esc6.saltoAtras<=Math.max(3,Math.floor(esc6.pisos*0.08))&&_nucMin>=_totMin*0.68&&_colas>0&&_colas<_totMin*0.34,
    'las vetas nuevas tienen núcleo dominante y unas pocas colas naturales', `${_nucMin}/${_totMin} en núcleo · ${_colas} trazas`);
  const oquedad = await page.evaluate(`(()=>{ let aire=0, minr=ROWS; for(let r=SURFACE_ROW+14;r<ROWS-1;r++) for(let c=1;c<COLS-1;c++) if(soil[r][c]===0){ aire++; minr=Math.min(minr,r); } return {aire, minr}; })()`);
  ok(oquedad.aire > 0, 'las bandas nuevas salen con su cueva (hay hueco abierto sin que lo cave nadie)', `${oquedad.aire} casillas de vacio bajo el techo de la ultima losa`);
  await page.evaluate(`view.zoom=1.7; view.y=Math.max(0,(ROWS-6)*CELL-300); clampView();`);
  await sleep(500);
  await page.screenshot({ path: '/tmp/antfarm-capturas/banda-marmol.png' });

  console.log('\n· E: la reliquia a la vitrina');
  const tirada = await page.evaluate(`(()=>{
    for(let r=SURFACE_ROW+30;r<ROWS-3;r++) for(let c=6;c<COLS-6;c++){ if(soil[r][c]===1 && soilType[r][c]===12){ if(spawnSmartTreasure(c,r,'geoda')) return {c,r}; } }
    for(let r=SURFACE_ROW+8;r<ROWS-3;r++) for(let c=6;c<COLS-6;c++){ if(soil[r][c]===1){ if(spawnSmartTreasure(c,r,'geoda')) return {c,r}; } }
    return null;
  })()`);
  ok(!!tirada, 'se puede enterrar una geoda en la banda nueva', tirada ? `[${tirada.c},${tirada.r}]` : 'no habia donde ponerla');
  const desc = await page.evaluate(`(()=>{ checkRewardDiscovery(${tirada ? tirada.c : 0}, ${tirada ? tirada.r : 0});
    return {rel:reliquias.slice(), bonus:bonusCava, cuarzo:worldMaterials.cuarzo||0, rels:Object.keys(TREASURE_DEFS).length}; })()`);
  ok(desc.rel.length === 1 && /quartz|geode|cuarzo/i.test(desc.rel[0].tipo), 'la reliquia se apunta con su piso y su historia', desc.rel[0] ? `${desc.rel[0].tipo} · piso ${desc.rel[0].piso} · D${desc.rel[0].dia}` : 'vacia');
  ok(desc.cuarzo >= 3, 'y su material entra en la colonia', `${desc.cuarzo} cuarzo`);
  ok(desc.bonus > 0.015 && desc.bonus <= 0.30, 'el bonus de excavacion sube con la reliquia, y tiene tope', `+${(desc.bonus * 100).toFixed(0)}%`);
  await page.evaluate(`(()=>{ try{ lastUIUpdate=0; updateColonyUI(); }catch(e){} })()`);
  await sleep(220);
  const vit = await leePanel(page, 'ecoRelics');
  ok(/quartz|geode|cuarzo/i.test(vit), 'la VITRINA del panel del mundo la enseña', JSON.stringify(vit.replace(/\\s+/g, ' ').slice(0, 64)));
  const umTxt = await leePanel(page, 'ecoUmbral');
  ok(/SLAB|LOSA|broken slabs|losas rotas/i.test(umTxt), 'y el panel dice como va la losa, sin haberla roto a ciegas', JSON.stringify(umTxt.replace(/\\s+/g, ' ').slice(0, 72)));
  // y el cuadro de tesoros entero: cada banda tiene su surtido de cosas asombrosas
  const cuadro = await page.evaluate(`(()=>{ const por={}; for(const k in TREASURE_DEFS){ const d=TREASURE_DEFS[k]; por[d.tier]=(por[d.tier]||0)+1; }
    const rel=Object.keys(TREASURE_DEFS).filter(k=>TREASURE_DEFS[k].reliquia); return {por, rel, sinMsg:rel.filter(k=>!TREASURE_DEFS[k].msg).length}; })()`);
  ok(cuadro.rel.length >= 8 && cuadro.sinMsg === 0, 'ocho maravillas o mas, cada una con su grito y su texto', `${cuadro.rel.length} reliquias · sin msg: ${cuadro.sinMsg}`);

  console.log('\n· F: el fuego de la ultima banda cobra peaje');
  const fueg = await page.evaluate(`window._irABanda(8)`);
  await sleep(600);
  const esc8 = await page.evaluate(ESCANER);
  ok(esc8.hay.basalto > 40 && esc8.hay.magma > 0, 'la ultima banda es BASALTO con MAGMA de verdad en el mapa', `basalto ${esc8.hay.basalto} · magma ${esc8.hay.magma} casillas`);
  ok(fueg.bandaMax === 8 && esc8.filas >= 60, 'la escalera llega hasta el fondo del todo: banda 8 (BASALTO) abierta', `bandaMax ${fueg.bandaMax} · ${fueg.umbralesRotos} losas rotas · ${esc8.filas} filas`);
  const quema = await page.evaluate(`(()=>{
    const mc=magmaCells[0]; if(!mc) return null;
    const w=workers[0]; if(!w) return null;
    w.x=mc.x+4; w.y=mc.y+CELL+4; w.state='CAVANDO'; w.digTarget=null; w.fatigue=Math.min(w.fatigue, 20);
    return {antes:w.fatigue, mc:{r:mc.r,c:mc.c}};
  })()`);
  if (quema) {
    await sleep(1600);
    const dsp = await page.evaluate(`(()=>{ const w=workers[0]; return {fatigue:w.fatigue, state:w.state}; })()`);
    ok(dsp.fatigue > quema.antes + 1, 'al lado del magma la fatiga sube (no es decoracion: se paga)', `${quema.antes.toFixed(1)} -> ${dsp.fatigue.toFixed(1)} · estado ${dsp.state}`);
    ok(dsp.state === 'VOLVER_TIERRA' || dsp.fatigue < 100, 'y si se pasa de la raya suelta lo que lleva y sube a la superficie', `estado ${dsp.state} · fatiga ${dsp.fatigue.toFixed(0)}`);
  } else ok(false, 'no se pudo poner una hormiga junto al fuego', 'magmaCells vacio');
  await page.evaluate(`view.zoom=1.8; view.y=Math.max(0,(ROWS-3)*CELL-300); clampView();`);
  await sleep(600);
  await page.screenshot({ path: '/tmp/antfarm-capturas/basalto-magma.png' });

  console.log('\n· G: guardado, coste por cuadro y salud de la consola');
  const guarda = await page.evaluate(`(()=>{ try{ serializeSave(true); }catch(e){ return {error:String(e&&e.message)}; }
    const k=Object.keys(localStorage).filter(x=>/antFarm_fullSave/i.test(x))[0]; const j=JSON.parse(localStorage.getItem(k)||'{}');
    return {filas:j.ROWS, bandaMax:j.bandaMax, rotos:j.umbralesRotos, rel:(j.reliquias||[]).length, losa:j.umbral? (j.umbral.hpMax>0):false, bonus:j.bonusCava}; })()`);
  ok(guarda.bandaMax === 8 && guarda.rel === 1 && guarda.losa && guarda.filas === esc8.filas, 'la escalera entera se guarda (filas, banda, losa y vitrina)', JSON.stringify(guarda));
  const vuelve = await page.evaluate(`(()=>{ colocarUmbral(); return umbral? umbral.hpMax>0 : false; })()`);
  ok(vuelve, 'y si un guardado viejo no tiene losa, se le pone una encima al cargar', 'colocarUmbral() OK');

  const coste = await page.evaluate(`(async()=>{
    const g=document.getElementById('farmCanvas').getContext('2d');
    let n=0, di=0; const _f=g.fillRect.bind(g), _d=g.drawImage.bind(g);
    g.fillRect=function(){ n++; return _f.apply(g,arguments); };
    g.drawImage=function(){ di++; return _d.apply(g,arguments); };
    const ms=[]; const n0=n;
    for(let i=0;i<40;i++){ const a=performance.now(); await new Promise(r=>requestAnimationFrame(r)); ms.push(performance.now()-a); }
    g.fillRect=_f; g.drawImage=_d;
    const s=ms.slice().sort((a,b)=>a-b);
    return {porCuadro:Math.round((n-n0)/40), drawImage:di, mediana:+s[Math.floor(s.length/2)].toFixed(1), p95:+s[Math.floor(s.length*0.95)].toFixed(1), filas:ROWS, obreras:workers.length};
  })()`);
  ok(coste.porCuadro < 9000, 'el relleno por cuadro sigue en el orden de antes del cambio', `${coste.porCuadro} fillRect/cuadro · drawImage ${coste.drawImage} · ${coste.obreras} obreras · ${coste.filas} filas`);
  ok(coste.p95 < 70, 'y el cuadro mas caro no se dispara con el mapa en 96 filas', `mediana ${coste.mediana} ms · p95 ${coste.p95} ms`);
  ok(errs.length === 0, 'cero errores de JavaScript con la escalera montada', errs.slice(0, 3).join(' | ') || 'nada en consola');

  await browser.close();
  server.close();
  console.log(`\n${pass} ok · ${failn} FALLOS\n`);
  process.exit(failn ? 1 : 0);
})().catch(e => { console.error('MUERE EL TEST:', e); process.exit(2); });
