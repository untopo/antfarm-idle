/**
 * inventario-voxel.js — contrato visual y responsive de NEST STORES.
 *
 * Renueva solo la hoja del inventario. Este recorrido verifica en Chrome real que los datos de
 * simulación siguen presentes una sola vez, que el cuerpo (no el pie) scrollea, que el cajón pertenece
 * a la familia voxel de TOPO y que desktop, portrait y landscape conservan lectura y tacto.
 *
 *   node test/inventario-voxel.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const ROOT = path.resolve(__dirname, '..');
const PORT = 8191;
const SHOTS = '/tmp/antfarm-capturas';
const TYPES = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.png':'image/png', '.jpg':'image/jpeg', '.json':'application/json', '.svg':'image/svg+xml', '.wav':'audio/wav' };
fs.mkdirSync(SHOTS, { recursive:true });

const html = fs.readFileSync(path.join(ROOT, 'ant-farm-rpg/index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'ant-farm-rpg/css/style.css'), 'utf8');
const app = fs.readFileSync(path.join(ROOT, 'ant-farm-rpg/js/app.js'), 'utf8');
let pass=0, fail=0;
const ok=(cond,msg,detail='')=>{ if(cond){ pass++; console.log('  ok   '+msg+(detail?' · '+detail:'')); }else{ fail++; console.log('  FAIL '+msg+(detail?' · '+detail:'')); } };
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

const server=http.createServer((req,res)=>{
  let p=decodeURIComponent(req.url.split('?')[0]);
  if(p==='/') p='/ant-farm-rpg/index.html';
  const file=path.join(ROOT,p);
  if(!file.startsWith(ROOT)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){ res.writeHead(404); res.end('nope'); return; }
  res.writeHead(200,{'Content-Type':TYPES[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store, must-revalidate'});
  fs.createReadStream(file).pipe(res);
});

async function boot(page){
  await page.goto(`http://127.0.0.1:${PORT}/ant-farm-rpg/index.html`,{waitUntil:'load',timeout:30000});
  await page.waitForFunction('typeof window.topoShowMainMenu==="function" || window._topoFlowReady===true',{timeout:20000}).catch(()=>{});
  await page.waitForFunction("!document.getElementById('splashScreen') || document.getElementById('splashScreen').style.display==='none'",{timeout:16000}).catch(()=>{});
  await page.click('#btnMainCreate'); await sleep(420);
  await page.click('#createSizeScreen [data-size="small"]'); await sleep(420);
  await page.evaluate(()=>{ const h=document.querySelector('.topo-dialog-host'); if(!h)return; const b=[...h.querySelectorAll('button')].find(x=>/^(SÍ|YES)$/i.test(x.textContent.trim())); if(b)b.click(); });
  for(let i=0;i<18;i++){
    const seen=await page.evaluate(()=>{ const m=document.getElementById('onboardingModal'); if(!m||getComputedStyle(m).display==='none')return false; const b=document.getElementById('btnOnboardingStart')||[...m.querySelectorAll('button')].pop(); if(b)b.click(); return true; });
    if(seen) break;
    await sleep(250);
  }
  await page.waitForFunction("document.body.classList.contains('game-started')",{timeout:20000}).catch(()=>{});
  await sleep(1100);
}

async function restoreFarmAndInventory(page){
  await page.waitForFunction("!document.getElementById('splashScreen') || document.getElementById('splashScreen').style.display==='none'",{timeout:12000}).catch(()=>{});
  await sleep(260);
  const menu=await page.evaluate(()=>{ const m=document.getElementById('mainMenu'); return !!m&&getComputedStyle(m).display!=='none'&&m.getAttribute('aria-hidden')!=='true'; });
  if(menu){
    await page.click('#btnMainContinue');
    await page.waitForFunction("getComputedStyle(document.getElementById('mainMenu')).display==='none'",{timeout:12000}).catch(()=>{});
    await sleep(520);
  }
  const open=await page.evaluate(()=>document.getElementById('invSheet').getAttribute('data-open')==='1');
  if(!open){ await page.click('#btnInventory'); await sleep(340); }
}

async function metrics(page){
  return page.evaluate(()=>{
    try{ pintarInventario(); }catch(e){}
    const sh=document.getElementById('invSheet'), body=document.getElementById('invBody');
    const head=sh.querySelector('.inv-header'), foot=sh.querySelector('.inv-footer');
    const r=sh.getBoundingClientRect(), rb=body.getBoundingClientRect(), rh=head.getBoundingClientRect(), rf=foot.getBoundingClientRect();
    const rc=document.getElementById('calendarWidget').getBoundingClientRect();
    const cards=[...sh.querySelectorAll('.inv-resource-card')];
    const cr=cards.map(c=>c.getBoundingClientRect());
    const over=[...sh.querySelectorAll('*')].filter(n=>{
      const cs=getComputedStyle(n); if(cs.display==='none'||cs.visibility==='hidden'||n.closest('[aria-hidden="true"]'))return false;
      return n.scrollWidth-n.clientWidth>2 && !/auto|scroll/.test(cs.overflowX) && cs.textOverflow!=='ellipsis';
    }).map(n=>(n.id||n.className||n.tagName)+':'+(n.scrollWidth-n.clientWidth));
    return {
      rect:{x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height),right:Math.round(r.right),bottom:Math.round(r.bottom)},
      calendar:{x:Math.round(rc.x),y:Math.round(rc.y),w:Math.round(rc.width),h:Math.round(rc.height),right:Math.round(rc.right),bottom:Math.round(rc.bottom)},
      head:Math.round(rh.height),body:Math.round(rb.height),footer:Math.round(rf.height),footerY:Math.round(rf.y),
      bodyOverflow:getComputedStyle(body).overflowY,scrollable:body.scrollHeight-body.clientHeight,
      horizontal:over,resources:cards.length,keys:cards.map(c=>c.dataset.material),
      firstTwoY:cr.slice(0,2).map(x=>Math.round(x.y)),close:[...(()=>{const x=document.getElementById('btnCloseInv').getBoundingClientRect();return [x.width,x.height]})()],
      locate:[...(()=>{const x=document.getElementById('btnInvGo').getBoundingClientRect();return [x.width,x.height]})()],
      title:document.getElementById('invTitle').textContent.trim(),subtitle:document.getElementById('invSubtitle').textContent.trim(),
      focus:document.activeElement&&document.activeElement.id,expanded:document.getElementById('btnInventory').getAttribute('aria-expanded'),
      ariaHidden:sh.getAttribute('aria-hidden'),compact:sh.getAttribute('data-compact-layout'),
      rationCount:sh.querySelectorAll('.inv-ration-value').length,locateCount:document.querySelectorAll('#btnInvGo').length,
      materialCountNodes:sh.querySelectorAll('.inv-resource-count').length,
      renderedFood:Number((sh.querySelector('.inv-ration-value')||{}).textContent||0),
      ledgerFood:Math.max(0,Math.floor(economyLedger.food)),
      renderedMaterials:Object.fromEntries(cards.map(c=>[c.dataset.material,Number((c.querySelector('.inv-resource-count')||{}).textContent||0)])),
      ledgerMaterials:Object.fromEntries(cards.map(c=>[c.dataset.material,Math.max(0,Math.floor(economyLedger.materials[c.dataset.material]||0))])),
      text:sh.textContent.replace(/\s+/g,' ').trim()
    };
  });
}

(async()=>{
  console.log('\n· contrato en frío: una hoja, un control y la misma fuente de datos');
  ok((html.match(/id="invSheet"/g)||[]).length===1,'hay una sola hoja de inventario');
  ok((html.match(/id="btnInvGo"/g)||[]).length===1 && (html.match(/id="btnInventory"/g)||[]).length===1,'no se duplican ni la puerta ni CENTER ON CACHE');
  ok(/class="inv-sheet"/.test(html)&&/NEST STORES/.test(html)&&/COLONY LOGISTICS/.test(html),'el markup usa la familia nueva y está íntegramente en inglés');
  ok(/\.inv-resource-grid/.test(css)&&/data-compact-layout/.test(css)&&/@media \(max-width:520px\)/.test(css),'hay reglas propias para escritorio, retrato y cajón compacto');
  ok(/economyLedger\.food/.test(app)&&/for\(const d of _MAT_DEFS\)/.test(app)&&/storageCells\(\)/.test(app),'raciones, materiales y celdas siguen leyendo la simulación existente');
  ok(!/id="invSheet" style=/.test(html),'la hoja ya no depende de una piel inline antigua');

  await new Promise(r=>server.listen(PORT,'0.0.0.0',r));
  const browser=await puppeteer.launch({headless:'new',args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage();
  await page.setViewport({width:1280,height:820});
  const errors=[];
  page.on('pageerror',e=>errors.push('pageerror: '+e.message));
  page.on('console',m=>{if(m.type()==='error'&&!/favicon|autoplay|AudioContext/.test(m.text()))errors.push('console: '+m.text().slice(0,180));});

  try{
    await boot(page);
    await page.evaluate(()=>{
      try{
        const vals={stone:71,clay:19,sand:12,fiber:63,wood:28,cobre:7,hierro:3,oro:2};
        for(const k in vals) economyLedger.materials[k]=vals[k];
        economyLedger.setFood(37,'inventory visual test');
        if(workers[0])workers[0].tool='pick'; if(workers[1])workers[1].tool='basket';
        updateEcoHud();
      }catch(e){}
    });

    console.log('\n· desktop: cajón voxel detallado, sin cifras ni controles repetidos');
    await page.click('#btnInventory'); await sleep(420);
    let m=await metrics(page);
    const calBottom=await page.evaluate(()=>Math.round(document.getElementById('calendarWidget').getBoundingClientRect().bottom));
    ok(m.title==='NEST STORES'&&/Rations, raw materials/.test(m.subtitle),'jerarquía clara: kicker, título y descripción',m.title);
    ok(m.rect.w===m.calendar.w&&m.rect.right===m.calendar.right,'usa exactamente el ancho y eje derecho del reloj',`${m.rect.w}px · right ${m.rect.right}`);
    ok(m.rect.y===calBottom,'en desktop nace inmediatamente debajo del calendario',`drawer y=${m.rect.y} · calendario=${calBottom}`);
    ok(m.rect.right<=1280&&m.rect.bottom<=820,'el marco entero cabe en desktop',JSON.stringify(m.rect));
    ok(m.resources===8&&new Set(m.keys).size===8&&m.materialCountNodes===8,'los ocho materiales aparecen exactamente una vez',m.keys.join(', '));
    ok(m.rationCount===1&&m.locateCount===1,'una sola cifra principal de raciones y un solo control de localización');
    const datosSinDeriva=m.renderedFood===m.ledgerFood&&m.keys.every(k=>m.renderedMaterials[k]===m.ledgerMaterials[k]);
    ok(datosSinDeriva&&/STONE/.test(m.text)&&/BROOD/.test(m.text),'cada tarjeta refleja el ledger actual sin inventar ni duplicar cifras',`food ${m.renderedFood}/${m.ledgerFood} · stone ${m.renderedMaterials.stone}/${m.ledgerMaterials.stone}`);
    ok(m.focus==='btnCloseInv'&&m.expanded==='true'&&m.ariaHidden==='false','al abrir, foco y ARIA describen el estado',`focus=${m.focus}`);
    ok(m.bodyOverflow==='auto'&&m.scrollable>20,'solo el cuerpo tiene recorrido vertical',`${m.scrollable}px`);
    ok(m.horizontal.length===0,'ninguna tarjeta desborda por la derecha',m.horizontal.join(' | '));
    await page.screenshot({path:SHOTS+'/inventario-voxel-desktop.png'});

    const footBefore=m.footerY;
    await page.evaluate(()=>{const b=document.getElementById('invBody');b.scrollTop=b.scrollHeight;}); await sleep(120);
    const scroll=await page.evaluate(()=>{const b=document.getElementById('invBody'),f=document.querySelector('.inv-footer').getBoundingClientRect(),last=b.lastElementChild.getBoundingClientRect(),rb=b.getBoundingClientRect();return{top:Math.round(b.scrollTop),footerY:Math.round(f.y),lastBottom:+(last.bottom-rb.bottom).toFixed(1)}});
    ok(scroll.top>0&&scroll.lastBottom<=1,'el último bloque se alcanza de verdad',`scrollTop ${scroll.top} · borde ${scroll.lastBottom}`);
    ok(scroll.footerY===footBefore,'CENTER ON CACHE permanece anclado mientras el contenido scrollea',`y=${scroll.footerY}`);

    await page.keyboard.press('Escape'); await sleep(280);
    const closed=await page.evaluate(()=>({display:getComputedStyle(document.getElementById('invSheet')).display,focus:document.activeElement.id,expanded:document.getElementById('btnInventory').getAttribute('aria-expanded')}));
    ok(closed.display==='none'&&closed.focus==='btnInventory'&&closed.expanded==='false','ESC cierra y devuelve el foco a su única puerta');
    await page.keyboard.press('i'); await sleep(320);
    ok(await page.evaluate(()=>document.getElementById('invSheet').getAttribute('data-open')==='1'),'la tecla I abre una sola vez (sin listeners duplicados)');

    console.log('\n· portrait 390×844: la misma cortina compacta y controles táctiles');
    await page.setViewport({width:390,height:844});
    await restoreFarmAndInventory(page);
    m=await metrics(page);
    ok(m.rect.x>=0&&m.rect.right<=390&&m.rect.bottom<=844,'el cajón usa el ancho disponible sin salirse',JSON.stringify(m.rect));
    ok(m.compact==='1'&&m.rect.w===m.calendar.w&&m.rect.right===m.calendar.right&&m.rect.y===m.calendar.bottom,'en móvil conserva ancho/eje del reloj y empieza debajo',`drawer ${m.rect.w}px @${m.rect.y} · reloj ${m.calendar.w}px @${m.calendar.bottom}`);
    ok(m.firstTwoY.length===2&&Math.abs(m.firstTwoY[1]-m.firstTwoY[0])<=2,'la cuadrícula compacta mantiene dos materiales legibles por fila',m.firstTwoY.join(' / '));
    ok(m.close[0]>=44&&m.close[1]>=44&&m.locate[1]>=44,'cerrar y localizar alcanzan el suelo táctil de 44 px',`close ${m.close.join('×')} · locate h=${m.locate[1]}`);
    ok(m.horizontal.length===0,'retrato sin scroll lateral ni texto reventado',m.horizontal.join(' | '));
    await page.screenshot({path:SHOTS+'/inventario-voxel-portrait.png'});

    console.log('\n· landscape 844×390: reloj mini y cortina scrolleable debajo');
    await page.setViewport({width:844,height:390}); await sleep(420);
    m=await metrics(page);
    ok(m.rect.y===m.calendar.bottom&&m.rect.w===m.calendar.w&&m.rect.right===m.calendar.right&&m.rect.bottom<=390,'la cortina sigue debajo del reloj mini sin esconder el pie',JSON.stringify(m.rect));
    ok(m.compact==='1'&&m.body>=120&&m.scrollable>100,'cabecera y pie fijos dejan un cuerpo útil',`body ${m.body}px · scroll ${m.scrollable}px`);
    ok(m.firstTwoY.length===2&&Math.abs(m.firstTwoY[1]-m.firstTwoY[0])<=2,'landscape recupera dos columnas',m.firstTwoY.join(' / '));
    ok(m.horizontal.length===0,'landscape tampoco desborda horizontalmente',m.horizontal.join(' | '));
    await page.screenshot({path:SHOTS+'/inventario-voxel-landscape.png'});

    ok(errors.length===0,'cero errores JavaScript durante aperturas, scroll y rotaciones',errors.slice(0,3).join(' | ')||'ninguno');
  } finally {
    await browser.close(); server.close();
  }
  console.log(`\nINVENTARIO VOXEL: ${pass} ok · ${fail} fallos`);
  if(fail) process.exit(1);
})().catch(e=>{ console.error(e); try{server.close();}catch(_){} process.exit(1); });
