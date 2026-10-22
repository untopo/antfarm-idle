/**
 * offline-return.js — one-time, read-only return receipt in a real browser.
 *
 * Verifies the report model, the CONTINUE and visibility-resume paths, idempotence, keyboard/focus,
 * exactly two non-automatic suggestions, and responsive/touch-safe geometry.
 */
const http=require('http');
const fs=require('fs');
const path=require('path');
const puppeteer=require('puppeteer');
const ROOT=path.resolve(__dirname,'..');
const PORT=8195;
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.json':'application/json','.svg':'image/svg+xml','.wav':'audio/wav'};
const html=fs.readFileSync(path.join(ROOT,'ant-farm-rpg/index.html'),'utf8');
const css=fs.readFileSync(path.join(ROOT,'ant-farm-rpg/css/style.css'),'utf8');
const app=fs.readFileSync(path.join(ROOT,'ant-farm-rpg/js/app.js'),'utf8');
let pass=0,fail=0;
const ok=(cond,msg,detail='')=>{if(cond){pass++;console.log('  ok   '+msg+(detail?' · '+detail:''));}else{fail++;console.log('  FAIL '+msg+(detail?' · '+detail:''));}};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const server=http.createServer((req,res)=>{
  let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/')p='/ant-farm-rpg/index.html';const file=path.join(ROOT,p);
  if(!file.startsWith(ROOT)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end('nope');return;}
  res.writeHead(200,{'Content-Type':TYPES[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store, must-revalidate'});fs.createReadStream(file).pipe(res);
});
async function waitMenu(page){
  await page.waitForFunction('typeof window.topoShowMainMenu==="function" || window._topoFlowReady===true',{timeout:20000}).catch(()=>{});
  await page.waitForFunction(()=>{const s=document.getElementById('splashScreen'),m=document.getElementById('mainMenu');return (!s||getComputedStyle(s).display==='none')&&m&&getComputedStyle(m).display!=='none';},{timeout:18000});
}
async function bootFarm(page){
  await page.goto(`http://127.0.0.1:${PORT}/ant-farm-rpg/index.html`,{waitUntil:'load',timeout:30000});await waitMenu(page);
  await page.click('#btnMainCreate');await sleep(380);await page.click('#createSizeScreen [data-size="small"]');await sleep(380);
  await page.evaluate(()=>{const h=document.querySelector('.topo-dialog-host');if(!h)return;const b=[...h.querySelectorAll('button')].find(x=>/^(SÍ|YES|CREATE WORLD|ARCHIVE & CREATE)$/i.test(x.textContent.trim()));if(b)b.click();});
  for(let i=0;i<24;i++){
    const seen=await page.evaluate(()=>{const m=document.getElementById('onboardingModal');if(!m||getComputedStyle(m).display==='none')return false;const b=document.getElementById('btnOnboardingStart')||[...m.querySelectorAll('button')].pop();if(b)b.click();return true;});
    if(seen)break;await sleep(250);
  }
  await page.waitForFunction(()=>document.body.classList.contains('game-started'),{timeout:20000});await sleep(650);
}
async function continueFarm(page){
  await waitMenu(page);await page.click('#btnMainContinue');await page.waitForFunction(()=>document.body.classList.contains('game-started')&&getComputedStyle(document.getElementById('mainMenu')).display==='none',{timeout:12000});
}
async function receiptMetrics(page){
  return page.evaluate(()=>{
    const layer=document.getElementById('offlineReturn'),card=layer.querySelector('.offline-return-card'),body=layer.querySelector('.offline-return-body'),actions=[...layer.querySelectorAll('.offline-return-action')];
    const lr=layer.getBoundingClientRect(),r=card.getBoundingClientRect(),br=body.getBoundingClientRect(),buttons=[document.getElementById('offlineReturnClose'),...actions].map(x=>{const q=x.getBoundingClientRect();return{w:+q.width.toFixed(1),h:+q.height.toFixed(1)};});
    const horizontal=[...card.querySelectorAll('*')].filter(n=>{const s=getComputedStyle(n);return !n.classList.contains('topo-sr-only')&&s.display!=='none'&&n.scrollWidth-n.clientWidth>2&&!/auto|scroll/.test(s.overflowX)&&s.textOverflow!=='ellipsis';}).map(n=>(n.id||n.className||n.tagName)+':'+(n.scrollWidth-n.clientWidth));
    return{hidden:layer.hidden,aria:layer.getAttribute('aria-hidden'),open:window.__antOffline.isOpen(),paused,focus:document.activeElement&&document.activeElement.id,backgroundInert:[...document.body.children].filter(x=>x!==layer&&x.tagName!=='SCRIPT').every(x=>x.inert),rect:{x:+r.x.toFixed(1),y:+r.y.toFixed(1),right:+r.right.toFixed(1),bottom:+r.bottom.toFixed(1),w:+r.width.toFixed(1),h:+r.height.toFixed(1)},viewport:{w:innerWidth,h:innerHeight,layerW:lr.width},bodyOverflow:getComputedStyle(body).overflowY,bodyScroll:body.scrollHeight-body.clientHeight,buttons,actions:actions.map(x=>({id:x.dataset.offlineAction,text:x.textContent.replace(/\s+/g,' ').trim()})),horizontal,text:card.textContent.replace(/\s+/g,' ').trim()};
  });
}
(async()=>{
  console.log('\n· contrato estático: una sola pantalla y dos salidas no automáticas');
  ok((html.match(/id="offlineReturn"/g)||[]).length===1,'hay un único diálogo de regreso');
  ok((html.match(/id="offlineReturnActions"/g)||[]).length===1&&(html.match(/id="offlineReturnTime"/g)||[]).length===1,'tiempo y acciones no se duplican');
  ok(/aria-modal="true"/.test(html)&&/aria-labelledby="offlineReturnTitle"/.test(html)&&/Suggestions only — nothing starts automatically/.test(html),'el diálogo declara modalidad, nombre y carácter consultivo');
  ok(/@media \(max-width:640px\)/.test(css)&&/@media \(max-height:590px\)/.test(css)&&/prefers-reduced-motion:reduce/.test(css),'hay contratos propios para retrato, landscape y movimiento reducido');
  const receiptCode=app.slice(app.indexOf('// === ONE-TIME RETURN RECEIPT'),app.indexOf('function _applyOfflineAfterLoad'));
  ok(!/toggleHistory|historyDrawer|assignProfession|startColonyProject/.test(receiptCode),'las sugerencias no abren HISTORIAL, asignan oficios ni inician obras');
  ok(/_offlinePresentedStamps/.test(app)&&/pending:_offlineReturnPending/.test(app),'presentación y recibo pendiente se conservan en el guardado');

  await new Promise(r=>server.listen(PORT,'0.0.0.0',r));
  const browser=await puppeteer.launch({headless:'new',args:['--no-sandbox','--disable-dev-shm-usage']});const page=await browser.newPage();await page.setViewport({width:1280,height:820});
  const errors=[];page.on('pageerror',e=>errors.push('pageerror: '+e.message));page.on('console',m=>{if(m.type()==='error'&&!/favicon|autoplay|AudioContext/.test(m.text()))errors.push('console: '+m.text().slice(0,180));});
  try{
    await bootFarm(page);
    console.log('\n· modelo de presentación: tiempo real, flujos, hitos, cuello y exactamente dos movimientos');
    const model=await page.evaluate(()=>window.__antOffline.summary({
      window:{creditedMs:4*3600000,rawMs:5*3600000,capHours:4},receipt:{sourceSavedAt:1700000000000,appliedAt:1700018000000,creditedMs:4*3600000,capHours:4},
      bottleneck:'storage',idleGameUnits:0,events:[{kind:'egg_laid'},{kind:'brood_stage'}],
      applied:{food:{harvested:12.5,consumed:4.25},brood:{workerHatches:2,queenHatches:0,advanced:3},project:{name:'FORWARD CACHE',completed:true,hauled:3,materialsConsumed:{clay:2,stone:1},work:8,workNeeded:8,finalWork:8,anchor:{x:80,y:96}},digs:{completed:2,advanced:1,progress:4.5,materials:{clay:2,stone:1},last:{x:112,y:160}},slab:{completed:false,damage:6,anchor:{x:128,y:192}},structuresCompleted:1}
    }));
    ok(model.time.label==='4H'&&/1H/.test(model.time.capText)&&/not counted/.test(model.time.capText),'separa tiempo liquidado y tiempo excluido por el tope',model.time.label+' · '+model.time.capText.trim());
    const flowLabels=model.flow.map(x=>x.label),changeLabels=model.changes.map(x=>x.label);
    ok(flowLabels.includes('FOOD GATHERED')&&flowLabels.includes('FOOD CONSUMED')&&flowLabels.includes('CLAY FOUND')&&flowLabels.includes('CLAY COMMITTED'),'muestra ganancias y consumos físicos',flowLabels.join(', '));
    ok(changeLabels.includes('WORKERS HATCHED')&&changeLabels.includes('BROOD CARE ADVANCED')&&changeLabels.includes('FORWARD CACHE')&&changeLabels.includes('EXCAVATIONS OPENED')&&changeLabels.includes('EXCAVATION FRONTS ADVANCED')&&changeLabels.includes('SLAB WORK'),'resume cría, obra, excavación y losa relevantes',changeLabels.join(', '));
    ok(model.bottleneck.title==='STORAGE FULL'&&model.suggestions.length===2&&new Set(model.suggestions.map(x=>x.id)).size===2,'traduce el cuello y propone exactamente dos acciones distintas',model.suggestions.map(x=>x.id).join(' / '));

    console.log('\n· CONTINUE: se liquida una vez y el mismo recibo abre una sola vez');
    const seeded=await page.evaluate(()=>{
      paused=true;brood=[];for(const q of queens){q.health=0;q.progress=0;}for(const w of workers){w.state='EXPLORAR';w.digTarget=null;w.targetFood=null;w.food=null;delete w.projectCargo;}
      const site=storageStructure(false);if(site){site.built=true;site.work=site.workNeeded||STORE_WORK_REQUIRED;site.buildProgress=1;}
      if(workers[0]){workers[0].food={amount:30,max:30,ftype:'honey',rot:0};workers[0].state='VOLVER_COMIDA';}
      const capacity=Math.max(8,storageDeliveryNodes().reduce((n,x)=>n+Math.max(0,Number(x.capacity)||0),0));economyLedger.setFood(capacity,'return receipt test');_syncProtectedLotsWithLedger();
      serializeSave(true);const save=JSON.parse(localStorage.getItem(window._topoSaveKey));save.savedAt=Date.now()-2*3600000;save.offline.receipt=null;save.offline.presented=[];save.offline.pending=null;localStorage.setItem(window._topoSaveKey,JSON.stringify(save));window._topoHasWorld=false;
      return{capacity,food:economyLedger.food,savedAt:save.savedAt};
    });
    await page.reload({waitUntil:'load'});await continueFarm(page);try{await page.waitForFunction(()=>window.__antOffline&&window.__antOffline.isOpen(),{timeout:8000});}catch(e){console.log('  DEBUG return state',await page.evaluate(()=>({report:window.__antOffline&&window.__antOffline.last(),pending:window.__antOffline&&window.__antOffline.pending(),open:window.__antOffline&&window.__antOffline.isOpen(),world:window._topoHasWorld,saved:JSON.parse(localStorage.getItem(window._topoSaveKey)||'null')&&JSON.parse(localStorage.getItem(window._topoSaveKey)||'null').offline,errors:document.getElementById('topoBootFail')&&document.getElementById('topoBootFail').textContent})));throw e;}await sleep(120);
    let m=await receiptMetrics(page);
    ok(!m.hidden&&m.aria==='false'&&m.open&&m.paused&&m.backgroundInert,'el recibo es modal, aísla el fondo y pausa temporalmente la simulación');
    ok(/^2H(?:\s|$)/.test((m.text.match(/TIME COUNTED\s+([^W]+)/)||[])[1]||'')||/TIME COUNTED 2H/.test(m.text),'enseña las dos horas realmente liquidadas',m.text.slice(0,130));
    ok(/STORAGE FULL/.test(m.text)&&/Food still at the surface was left there/.test(m.text),'explica el límite en lenguaje claro');
    ok(m.actions.length===2&&new Set(m.actions.map(x=>x.id)).size===2,'el DOM contiene exactamente dos sugerencias',m.actions.map(x=>x.id).join(' / '));
    ok(m.focus==='offlineReturnClose','el foco entra en un control seguro del diálogo',m.focus);
    await page.keyboard.down('Shift');await page.keyboard.press('Tab');await page.keyboard.up('Shift');
    ok(await page.evaluate(()=>document.activeElement&&document.activeElement.dataset.offlineAction==='center_food'),'Shift+Tab queda atrapado y alcanza la última sugerencia');
    await page.keyboard.press('Tab');ok(await page.evaluate(()=>document.activeElement.id==='offlineReturnClose'),'Tab cicla de nuevo al primer control');

    const once=await page.evaluate(()=>{const before={food:economyLedger.food,mats:JSON.stringify(economyLedger.materials),workers:workers.length,report:window.__antOffline.last()};const again=window.__antOffline.apply(Date.now());const shown=window.__antOffline.show(before.report);return{again,shown,before,after:{food:economyLedger.food,mats:JSON.stringify(economyLedger.materials),workers:workers.length},save:JSON.parse(localStorage.getItem(window._topoSaveKey)).offline};});
    ok(once.again===null&&once.shown===false,'reaplicar o volver a mostrar el mismo sello no hace nada');
    ok(once.before.food===once.after.food&&once.before.mats===once.after.mats&&once.before.workers===once.after.workers,'la prueba de idempotencia no duplica comida, materiales ni nacimientos');
    ok(Array.isArray(once.save.presented)&&once.save.presented.length===1&&Array.isArray(once.save.pending)&&once.save.pending.length===0,'el sello de presentación queda persistido y se consume el pendiente');

    console.log('\n· geometría desktop, portrait y landscape');
    ok(m.rect.x>=0&&m.rect.y>=0&&m.rect.right<=m.viewport.w&&m.rect.bottom<=m.viewport.h&&m.bodyOverflow==='auto','el marco desktop cabe y sólo su cuerpo puede desplazarse',JSON.stringify(m.rect));
    ok(m.buttons.every(x=>x.w>=44&&x.h>=44)&&m.horizontal.length===0,'desktop conserva blancos táctiles y cero desborde horizontal',JSON.stringify(m.buttons));
    await page.setViewport({width:390,height:844});await sleep(180);m=await receiptMetrics(page);
    ok(m.rect.x>=0&&m.rect.right<=390&&m.rect.bottom<=844&&m.horizontal.length===0,'390×844 cabe sin scroll lateral',JSON.stringify(m.rect));
    ok(m.actions.length===2&&m.buttons.every(x=>x.w>=44&&x.h>=44),'retrato mantiene dos acciones y blancos de 44 px',JSON.stringify(m.buttons));
    await page.evaluate(()=>{document.documentElement.dataset.topoUi='large';});await sleep(100);const large=await receiptMetrics(page);
    ok(large.rect.x>=0&&large.rect.right<=390&&large.rect.bottom<=844&&large.horizontal.length===0&&large.buttons.every(x=>x.h>=44),'el tamaño de UI grande también cabe completo en retrato',JSON.stringify(large.rect));
    await page.evaluate(()=>{delete document.documentElement.dataset.topoUi;});await page.setViewport({width:844,height:390});await sleep(180);m=await receiptMetrics(page);
    ok(m.rect.x>=0&&m.rect.right<=844&&m.rect.bottom<=390&&m.horizontal.length===0,'844×390 mantiene todo el marco dentro del viewport',JSON.stringify(m.rect));
    ok(m.bodyScroll>=0&&m.bodyOverflow==='auto'&&m.buttons.every(x=>x.h>=44),'landscape conserva cuerpo desplazable y controles táctiles',`scroll ${m.bodyScroll} · ${JSON.stringify(m.buttons)}`);
    const reduced=await page.evaluate(()=>{document.documentElement.dataset.topoMotion='reduced';const a=getComputedStyle(document.getElementById('offlineReturn')),b=getComputedStyle(document.querySelector('.offline-return-card'));return[a.animationName,b.animationName];});
    ok(reduced.every(x=>x==='none'),'la preferencia interna de movimiento elimina animaciones',reduced.join(' / '));

    console.log('\n· las sugerencias sólo observan o navegan');
    const action=await page.evaluate(async()=>{const before=colonyProjects.activeRef();const ids=before&&before.id||null;document.querySelector('[data-offline-action="open_store"]').click();await new Promise(r=>setTimeout(r,80));const after=colonyProjects.activeRef();return{before:ids,after:after&&after.id||null,inv:document.getElementById('invSheet').getAttribute('data-open'),modal:window.__antOffline.isOpen(),paused,rootInert:document.getElementById('appRoot').inert};});
    ok(action.inv==='1'&&!action.modal&&action.before===action.after,'CHECK NEST STORES abre la vista existente sin aprobar una obra');
    ok(action.paused===false&&!action.rootInert,'al salir del recibo se restauran pausa e interacción del fondo');
    await page.evaluate(()=>cerrarInventario(true));

    console.log('\n· teclado y restauración de foco');
    await page.setViewport({width:1280,height:820});
    const shownSynthetic=await page.evaluate(()=>{document.getElementById('btnInventory').focus();const now=Date.now();return window.__antOffline.show({window:{creditedMs:65000,rawMs:65000,capHours:4},receipt:{sourceSavedAt:now+77,appliedAt:now+65000,creditedMs:65000,capHours:4},bottleneck:'population',idleGameUnits:0,events:[],applied:{food:{harvested:0,consumed:0},brood:{workerHatches:0,queenHatches:0},project:{},digs:{completed:0,materials:{}},slab:{},structuresCompleted:0}});});
    ok(shownSynthetic&&await page.evaluate(()=>window.__antOffline.isOpen()),'un recibo distinto puede usar el mismo único diálogo');
    await page.keyboard.press('Escape');await sleep(80);
    const escaped=await page.evaluate(()=>({open:window.__antOffline.isOpen(),hidden:document.getElementById('offlineReturn').hidden,focus:document.activeElement&&document.activeElement.id,paused}));
    ok(!escaped.open&&escaped.hidden&&escaped.focus==='btnInventory'&&!escaped.paused,'ESC cierra, reanuda y devuelve el foco',JSON.stringify(escaped));
    const cameraOnly=await page.evaluate(async()=>{const now=Date.now(),beforeProject=colonyProjects.activeRef(),q=queens[0]||storagePos(),bounds=getPanBounds(),expected={x:clamp(q.x-VIEW_W/view.zoom/2,bounds.minX,bounds.maxX),y:clamp(q.y-VIEW_H/view.zoom/2,bounds.minY,bounds.maxY)};window.__antOffline.show({window:{creditedMs:60000,rawMs:60000,capHours:4},receipt:{sourceSavedAt:now+99,appliedAt:now+60000,creditedMs:60000,capHours:4},bottleneck:'population',idleGameUnits:0,events:[],applied:{food:{harvested:0,consumed:0},brood:{},project:{},digs:{completed:0,advanced:0,materials:{}},slab:{},structuresCompleted:0}});document.querySelector('[data-offline-action="center_queen"]').click();await new Promise(r=>setTimeout(r,80));return{open:window.__antOffline.isOpen(),x:view.x,y:view.y,expected,projectBefore:beforeProject&&beforeProject.id||null,projectAfter:(colonyProjects.activeRef()||{}).id||null};});
    ok(!cameraOnly.open&&Math.abs(cameraOnly.x-cameraOnly.expected.x)<.1&&Math.abs(cameraOnly.y-cameraOnly.expected.y)<.1&&cameraOnly.projectBefore===cameraOnly.projectAfter,'la otra clase de sugerencia sólo centra la cámara',JSON.stringify(cameraOnly));

    console.log('\n· recarga inmediata y regreso desde pestaña oculta');
    await page.reload({waitUntil:'load'});await continueFarm(page);await sleep(350);
    ok(!await page.evaluate(()=>window.__antOffline.isOpen()),'una recarga inmediata no repite un recibo ya presentado');
    await page.evaluate(async()=>{
      const realNow=Date.now,base=realNow();window.__fakeHidden=true;Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.__fakeHidden});Date.now=()=>base;document.dispatchEvent(new Event('visibilitychange'));
      window.__fakeHidden=false;Date.now=()=>base+61000;document.dispatchEvent(new Event('visibilitychange'));await new Promise(r=>setTimeout(r,220));Date.now=realNow;try{delete document.hidden;}catch(e){}
    });
    await page.waitForFunction(()=>window.__antOffline.isOpen(),{timeout:5000});m=await receiptMetrics(page);
    ok(/TIME COUNTED 1 MIN/.test(m.text)&&m.actions.length===2,'el regreso de una pestaña oculta usa el mismo resumen una vez',m.text.slice(0,110));
    const hiddenKey=await page.evaluate(()=>window.__antOffline.last().receipt.sourceSavedAt);await page.keyboard.press('Escape');await sleep(80);
    const hiddenAgain=await page.evaluate(()=>{const r=window.__antOffline.last();return{source:r.receipt.sourceSavedAt,shown:window.__antOffline.show(r),open:window.__antOffline.isOpen()};});
    ok(hiddenAgain.source===hiddenKey&&!hiddenAgain.shown&&!hiddenAgain.open,'el recibo de visibilidad tampoco puede repetirse');
    ok(errors.length===0,'cero errores JavaScript en carga, redimensionado, acciones y regreso',errors.slice(0,3).join(' | ')||'ninguno');
  }finally{await browser.close();server.close();}
  console.log(`\nOFFLINE RETURN: ${pass} ok · ${fail} fallos`);if(fail)process.exit(1);
})().catch(e=>{console.error(e);try{server.close();}catch(_){}process.exit(1);});
