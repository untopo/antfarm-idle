/** proyectos-browser.js — contract for the single STORES → PROJECTS responsive UI and exclusive map tool. */
const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer');
const ROOT=path.resolve(__dirname,'..'),PORT=8197,SHOTS='/tmp/antfarm-capturas';fs.mkdirSync(SHOTS,{recursive:true});
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.json':'application/json'};
const server=http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/')p='/ant-farm-rpg/index.html';const f=path.join(ROOT,p);if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':TYPES[path.extname(f)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(f).pipe(res);});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let pass=0,fail=0;const ok=(c,m,d='')=>{if(c){pass++;console.log('  ok   '+m+(d?' · '+d:''));}else{fail++;console.log('  FAIL '+m+(d?' · '+d:''));}};
async function boot(page){
  await page.goto(`http://127.0.0.1:${PORT}/ant-farm-rpg/index.html`,{waitUntil:'load',timeout:30000});
  await page.waitForFunction('window._topoFlowReady===true',{timeout:20000});
  await page.waitForFunction("window.colonyTexturePack&&colonyTexturePack.ready()&&colonyTexturePack.stats().sprites===80",{timeout:12000});
  await page.waitForFunction("document.getElementById('splashScreen').style.display==='none'",{timeout:16000}).catch(()=>{});
  await page.click('#btnMainCreate');await sleep(300);await page.click('#createSizeScreen [data-size="small"]');await sleep(350);
  await page.evaluate(()=>{const h=document.querySelector('.topo-dialog-host');if(h){const b=[...h.querySelectorAll('button')].find(x=>/^(YES|SÍ|CREATE WORLD|ARCHIVE & CREATE)$/i.test(x.textContent.trim()));if(b)b.click();}});
  for(let i=0;i<20;i++){const done=await page.evaluate(()=>{const m=document.getElementById('onboardingModal');if(!m||getComputedStyle(m).display==='none')return false;const b=document.getElementById('btnOnboardingStart')||[...m.querySelectorAll('button')].pop();if(b)b.click();return true;});if(done)break;await sleep(200);}
  await page.waitForFunction("document.body.classList.contains('game-started')",{timeout:20000});await sleep(500);
  await page.evaluate(()=>{
    const s=storageStructure(false),a=_storeAnchor(s);for(const id of s.builders){const w=workers.find(x=>x.id===id);w.x=a.x;w.y=a.y;w.fatigue=0;}
    for(let i=0;i<220&&!s.built;i++)for(const id of s.builders){const w=workers.find(x=>x.id===id);w.fatigue=0;workOnStore(w,1,1);}
    economyLedger.replaceMaterials({stone:20,clay:20,sand:12,fiber:20,wood:20,cobre:3,hierro:2,oro:1},'project browser');economyLedger.setFood(16,'project browser');paused=true;updateEcoHud();
  });
}
async function metrics(page){return page.evaluate(()=>{pintarInventario();const sh=document.getElementById('invSheet'),body=document.getElementById('invBody'),r=sh.getBoundingClientRect();const horizontal=[...sh.querySelectorAll('*')].filter(n=>{const s=getComputedStyle(n);return s.display!=='none'&&s.visibility!=='hidden'&&!n.closest('[aria-hidden="true"]')&&n.scrollWidth-n.clientWidth>2&&!/auto|scroll/.test(s.overflowX)&&s.textOverflow!=='ellipsis';}).map(n=>(n.id||n.className||n.tagName)+':'+(n.scrollWidth-n.clientWidth)+'@'+((n.parentElement&&(n.parentElement.className||n.parentElement.tagName))||'')+'['+(n.textContent||'').trim().slice(0,18)+']');const buttons=[...sh.querySelectorAll('.inv-reserve-control button')].map(x=>x.getBoundingClientRect());return{rect:{x:Math.round(r.x),y:Math.round(r.y),right:Math.round(r.right),bottom:Math.round(r.bottom),w:Math.round(r.width),h:Math.round(r.height)},projects:sh.querySelectorAll('#invProjectsTitle').length,cards:sh.querySelectorAll('.inv-project-card').length,active:sh.querySelectorAll('.inv-active-project').length,reserveButtons:buttons.length,minReserve:buttons.length?Math.min(...buttons.map(x=>Math.min(x.width,x.height))):0,horizontal,scrollable:body.scrollHeight-body.clientHeight,text:sh.textContent.replace(/\s+/g,' ').trim()};});}
(async()=>{await new Promise(r=>server.listen(PORT,'0.0.0.0',r));const browser=await puppeteer.launch({headless:'new',args:['--no-sandbox','--disable-dev-shm-usage']});const page=await browser.newPage();await page.setViewport({width:1280,height:820});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/favicon|autoplay|AudioContext/.test(m.text()))errors.push(m.text());});
try{
  await boot(page);await page.click('#btnInventory');await sleep(300);let m=await metrics(page);
  console.log('\n· desktop: one entry, three contextual proposals, integrated reserve controls');
  ok(m.projects===1&&m.cards>=1&&m.cards<=3,'PROJECTS appears once inside the sole NEST STORES body',m.cards+' proposals');
  ok(m.reserveButtons===16&&m.minReserve>=28,'all eight resources have one compact −/+ reserve pair',m.reserveButtons+' buttons · '+m.minReserve+'px');
  ok(/Review the result and cost/.test(m.text)&&/only after you choose a valid cell/.test(m.text)&&/RESULT/.test(m.text)&&/HOW IT WORKS/.test(m.text)&&/PLACEMENT/.test(m.text)&&/RISK/.test(m.text),'cards explain commitment timing, result, operation, placement and risk in English');
  ok(/Starts with 4 harvest charges/.test(m.text)&&/1 physical mushroom ration/.test(m.text)&&/workers must carry every mushroom/.test(m.text),'FUNGUS BED states its finite yield and physical delivery before approval');
  ok(/WHAT CHANGES/.test(m.text)&&/one additional food ration/.test(m.text)&&/flood-control work/.test(m.text),'adaptations state exactly what changes before material approval');
  ok(m.horizontal.length===0&&m.rect.right<=1280&&m.rect.bottom<=820,'enlarged menu still fits desktop without horizontal spill',JSON.stringify(m.rect)+' · '+m.horizontal.slice(0,8).join(' | '));
  ok(m.scrollable>80,'the longer STORES body remains genuinely scrollable',m.scrollable+'px');
  const reserveBefore=await page.evaluate(()=>({total:economyLedger.materials.clay,keep:colonyProjects.reserve('clay'),available:economyLedger.materialAvailable('clay')}));
  await page.click('[data-reserve-kind="clay"][data-reserve-delta="1"]');await sleep(180);
  const reserveAfter=await page.evaluate(()=>({total:economyLedger.materials.clay,keep:colonyProjects.reserve('clay'),available:economyLedger.materialAvailable('clay')}));
  ok(reserveAfter.total===reserveBefore.total&&reserveAfter.keep===reserveBefore.keep+1&&reserveAfter.available===reserveBefore.available-1,'KEEP changes policy only; the displayed stock is not spent');
  await page.evaluate(()=>{document.getElementById('invBody').scrollTop=0;});await sleep(80);
  await page.screenshot({path:SHOTS+'/projects-desktop.png'});

  console.log('\n· approval: committed now, spent only in a worker pickup');
  const before=await page.evaluate(()=>({clay:economyLedger.materials.clay,fiber:economyLedger.materials.fiber}));
  const approved=await page.evaluate(()=>colonyProjectsAPI.approve('clay_jars'));
  await sleep(160);m=await metrics(page);
  const held=await page.evaluate(()=>({active:colonyProjects.active(),clay:economyLedger.materials.clay,fiber:economyLedger.materials.fiber,heldClay:economyLedger.materialHeld('clay')}));
  ok(approved.ok&&m.active===1&&m.cards===0,'approval replaces proposals with one active project, never a queue');
  ok(held.clay===before.clay&&held.fiber===before.fiber&&held.heldClay===3,'approval leaves balances unchanged and creates a separate commitment');
  const pickup=await page.evaluate(()=>{const a=colonyProjects.activeRef(),w=workers.find(x=>x.id===a.crew[0]),p=storagePos();w.x=p.x;w.y=p.y;w.fatigue=0;workOnColonyProject(w,2,1);pintarInventario();return{cargo:w.projectCargo&&{...w.projectCargo},state:w.state,clay:economyLedger.materials.clay,transit:colonyProjects.active().inTransit.clay};});
  ok(pickup.cargo&&pickup.state==='HAUL_PROJECT'&&pickup.clay===before.clay-1&&pickup.transit===1,'the first debit coincides with a visible ant cargo in transit');

  console.log('\n· FUNGUS BED enters an explicit, cancellable map state before spending anything');
  await page.evaluate(()=>{const a=colonyProjects.activeRef(),w=workers.find(x=>x.projectCargo);if(w){const p=colonyProjectAnchor(a);w.x=p.x;w.y=p.y;workOnColonyProject(w,2,1);}let guard=0;while(colonyProjects.activeRef()&&guard++<240){const q=colonyProjects.activeRef(),b=workers.find(x=>x.id===q.crew[0]);b.fatigue=0;const p=colonyProjects.allDelivered()?colonyProjectAnchor(q):storagePos();b.x=p.x;b.y=p.y;workOnColonyProject(b,20,1);if(b.projectCargo){const z=colonyProjectAnchor(q);b.x=z.x;b.y=z.y;workOnColonyProject(b,2,1);}}const s=storageStructure(true),rr=Math.min(ROWS-3,s.r+s.h+2),mid=s.c+1;for(let y=s.r+s.h;y<=rr;y++){soil[y][mid]=0;soilType[y][mid]=0;}for(let c=Math.max(2,s.c-7);c<=Math.min(COLS-3,s.c+9);c++){soil[rr][c]=0;soilType[rr][c]=0;}markSoilDirty();refreshExploration(true);});
  const tool=await page.evaluate(()=>{const food0=foods.length,before={clay:economyLedger.materials.clay,fiber:economyLedger.materials.fiber},armed=colonyProjectsAPI.arm('fungus_bed');return{armed,food0,before};});await sleep(260);
  const armedState=await page.evaluate(()=>{const h=document.getElementById('projectPlacementHud'),r=h.getBoundingClientRect();return{mapTool,placement:projectPlacementType,hidden:h.hidden,aria:h.getAttribute('aria-hidden'),text:h.textContent.replace(/\s+/g,' ').trim(),rect:{x:r.x,y:r.y,right:r.right,bottom:r.bottom},invOpen:document.getElementById('invSheet').getAttribute('data-open'),focus:document.activeElement&&document.activeElement.id,heldFiber:economyLedger.materialHeld('fiber')};});
  ok(tool.armed&&armedState.mapTool==='project'&&armedState.placement==='fungus_bed'&&!armedState.hidden&&armedState.aria==='false','CHOOSE SITE closes STORES into a visible FUNGUS BED placement state');
  ok(/NOTHING SPENT YET/.test(armedState.text)&&/4 harvest charges/.test(armedState.text)&&/solid floor/.test(armedState.text)&&/COMMIT 4 FIBER \+ 2 CLAY/.test(armedState.text)&&/WORKERS HAUL AND BUILD/.test(armedState.text)&&/CANCEL/.test(armedState.text),'persistent placement HUD explains purpose, cost, next work, valid ground and cancellation');
  ok(!armedState.invOpen&&armedState.focus==='farmCanvas'&&armedState.heldFiber===0,'closing the curtain moves keyboard focus to the map without committing material');
  const invalid=await page.evaluate(()=>{const before={clay:economyLedger.materials.clay,fiber:economyLedger.materials.fiber},placed=tryPlaceColonyProjectAt(CELL*.5,CELL*.5),h=document.getElementById('projectPlacementHud');return{placed,mapTool,invalid:h.hasAttribute('data-invalid'),text:document.getElementById('projectPlacementInstruction').textContent,after:{clay:economyLedger.materials.clay,fiber:economyLedger.materials.fiber},held:economyLedger.materialHeld('fiber')};});
  ok(!invalid.placed&&invalid.mapTool==='project'&&invalid.invalid&&/NOT PLACED/.test(invalid.text),'an invalid tap explains the rejection and keeps placement armed');
  ok(invalid.after.clay===tool.before.clay&&invalid.after.fiber===tool.before.fiber&&invalid.held===0,'invalid placement neither spends nor commits any resource');
  await page.click('#btnCancelProjectPlacement');await sleep(80);
  let cancelled=await page.evaluate(()=>({mapTool,placement:projectPlacementType,hidden:document.getElementById('projectPlacementHud').hidden,foods:foods.length}));
  ok(cancelled.mapTool==='navigate'&&cancelled.placement===null&&cancelled.hidden&&cancelled.foods===tool.food0,'the tactile CANCEL action exits without creating food or spending stock');
  await page.evaluate(()=>colonyProjectsAPI.arm('fungus_bed'));await sleep(260);await page.keyboard.press('Escape');await sleep(80);
  cancelled=await page.evaluate(()=>({mapTool,placement:projectPlacementType,hidden:document.getElementById('projectPlacementHud').hidden}));
  ok(cancelled.mapTool==='navigate'&&cancelled.placement===null&&cancelled.hidden,'ESC provides the same clean cancellation path');
  await page.evaluate(()=>colonyProjectsAPI.arm('fungus_bed'));await sleep(260);await page.keyboard.press('Enter');await sleep(80);
  const keyboardPlacement=await page.evaluate(()=>({active:colonyProjects.active(),mapTool,invalid:document.getElementById('projectPlacementHud').hasAttribute('data-invalid'),invOpen:document.getElementById('invSheet').getAttribute('data-open'),focus:document.activeElement&&document.activeElement.id}));
  ok(!keyboardPlacement.invOpen&&(keyboardPlacement.active&&keyboardPlacement.active.type==='fungus_bed'||keyboardPlacement.mapTool==='project'&&keyboardPlacement.invalid),'ENTER acts on the focused map centre instead of reopening the closed inventory');
  await page.evaluate(()=>{if(colonyProjects.activeRef())cancelColonyProject();else setMapTool('navigate');});
  const siteClick=await page.evaluate(()=>{colonyProjectsAPI.arm('fungus_bed');let site=null;for(let r=SURFACE_ROW+1;r<ROWS-2&&!site;r++)for(let c=1;c<COLS-2;c++){const q=projectSiteCheck('fungus_bed',c,r);if(q.ok){site=q.site;break;}}if(!site)return null;const wx=(site.c+.5)*CELL,wy=(site.r+.5)*CELL,b=getPanBounds();view.x=clamp(wx-VIEW_W/view.zoom/2,b.minX,b.maxX);view.y=clamp(wy-VIEW_H/view.zoom/2,b.minY,b.maxY);clampView();const rect=canvas.getBoundingClientRect();return{site,x:rect.left+(wx-view.x)*view.zoom/VIEW_W*rect.width,y:rect.top+(wy-view.y)*view.zoom/VIEW_H*rect.height,before:{clay:economyLedger.materials.clay,fiber:economyLedger.materials.fiber}};});
  if(siteClick){await page.mouse.click(siteClick.x,siteClick.y);await sleep(100);}
  const placed=await page.evaluate(()=>({active:colonyProjects.active(),mapTool,hudHidden:document.getElementById('projectPlacementHud').hidden,clay:economyLedger.materials.clay,fiber:economyLedger.materials.fiber,heldClay:economyLedger.materialHeld('clay'),heldFiber:economyLedger.materialHeld('fiber')}));
  ok(siteClick&&placed.active&&placed.active.type==='fungus_bed'&&placed.mapTool==='navigate'&&placed.hudHidden,'a real canvas tap approves the chosen connected FUNGUS BED worksite');
  ok(placed.clay===siteClick.before.clay&&placed.fiber===siteClick.before.fiber&&placed.heldClay===2&&placed.heldFiber===4,'valid placement commits the stated 2 clay + 4 fibre without an early debit');
  await page.evaluate(()=>abrirInventario());await sleep(120);m=await metrics(page);
  ok(m.active===1&&/WHEN COMPLETE/.test(m.text)&&/4 harvest charges/.test(m.text)&&/Workers are collecting committed units/.test(m.text),'active progress keeps the promised result beside hauling and build status');
  await page.evaluate(()=>{colonyProjectsAPI.cancel();pintarInventario();});await sleep(80);

  console.log('\n· texture atlas and STORAGE PRESSURE use the existing STORES card');
  const pressure=await page.evaluate(()=>{
    foods=foods.filter(f=>!f.storedOverflow);protectedFoodLots=[];
    const node=storageDeliveryNodes().find(n=>n.id==='main'),cap=capacidadAlmacen();economyLedger.setFood(cap,'browser pressure fixture');
    _loadProtectedFoodLots(null,cap);reconcileStoragePressure({silent:true});const delivered=storeFoodDelivery({amount:3,ftype:'berry',rot:.1},node);
    pintarInventario();const card=document.querySelector('.inv-ration-card'),meter=document.querySelector('.inv-meter'),before=colonyTexturePack.stats().draws;
    drawColonyProjectSites(ctx,false);const stats=colonyTexturePack.stats(),pile=foods.find(f=>f.storedOverflow&&f.ftype==='berry');
    return{cap,delivered:{accepted:delivered.accepted,overflow:delivered.overflow},snapshot:storagePressureSnapshot(),pile:pile&&{node:pile.overflowNodeId,preserved:isFoodInStockpile(pile)},
      cardClass:card&&card.className,text:card&&card.textContent.replace(/\s+/g,' ').trim(),meterLabel:meter&&meter.getAttribute('aria-label'),overflowChips:document.querySelectorAll('.inv-overflow-readout').length,
      atlas:{status:stats.status,sprites:stats.sprites,width:colonyTexturePack.state.image&&colonyTexturePack.state.image.naturalWidth,height:colonyTexturePack.state.image&&colonyTexturePack.state.image.naturalHeight,drawn:stats.draws>before}};
  });await sleep(120);
  ok(pressure.delivered.accepted===0&&pressure.delivered.overflow===3&&pressure.snapshot.protected===pressure.cap&&pressure.snapshot.overflow===3,'full protected capacity keeps the complete typed delivery physical');
  ok(pressure.pile&&pressure.pile.node==='main'&&!pressure.pile.preserved,'the browser world places an unprotected pile at the unloading node');
  ok(pressure.overflowChips===1&&/STORAGE PRESSURE/.test(pressure.text)&&/PROTECTED RATIONS/.test(pressure.text.toUpperCase())&&/3 OVERFLOW/.test(pressure.text),'the original ration card and meter expose protected versus overflow once');
  ok(/physical overflow/.test(pressure.meterLabel)&&/has-overflow/.test(pressure.cardClass),'the existing meter carries the pressure state without another screen');
  ok(pressure.atlas.status==='ready'&&pressure.atlas.sprites===80&&pressure.atlas.width===256&&pressure.atlas.height===320&&pressure.atlas.drawn,'the expanded named atlas loaded and rendered a completed colony object');
  await page.screenshot({path:SHOTS+'/storage-pressure-desktop.png'});

  console.log('\n· portrait and short landscape: size check after the menu grew');
  await page.setViewport({width:390,height:844});await page.evaluate(()=>{if(document.getElementById('invSheet').getAttribute('data-open')!=='1')abrirInventario();_asentarInventario(document.getElementById('invSheet'));asentarHoja(document.getElementById('invSheet'));});await sleep(180);m=await metrics(page);
  ok(m.rect.x>=7&&m.rect.right<=383&&m.rect.bottom<=844&&m.horizontal.length===0,'portrait drawer stays inside every edge',JSON.stringify(m.rect)+' · '+m.horizontal.slice(0,8).join(' | '));
  await page.screenshot({path:SHOTS+'/projects-portrait.png'});
  await page.evaluate(()=>colonyProjectsAPI.arm('fungus_bed'));await sleep(260);
  const mobilePlacement=await page.evaluate(()=>{const h=document.getElementById('projectPlacementHud'),r=h.getBoundingClientRect(),c=document.getElementById('btnCancelProjectPlacement').getBoundingClientRect();return{hidden:h.hidden,rect:{x:Math.round(r.x),y:Math.round(r.y),right:Math.round(r.right),bottom:Math.round(r.bottom)},cancel:{w:Math.round(c.width),h:Math.round(c.height)},overflow:h.scrollWidth-h.clientWidth};});
  ok(!mobilePlacement.hidden&&mobilePlacement.rect.x>=7&&mobilePlacement.rect.right<=383&&mobilePlacement.rect.bottom<=844&&mobilePlacement.cancel.w>=44&&mobilePlacement.cancel.h>=40&&mobilePlacement.overflow<=1,'portrait placement instructions and tactile cancel stay wholly on-screen',JSON.stringify(mobilePlacement));
  await page.screenshot({path:SHOTS+'/fungus-placement-portrait.png'});await page.click('#btnCancelProjectPlacement');
  await page.setViewport({width:844,height:390});await page.evaluate(()=>{abrirInventario();_asentarInventario(document.getElementById('invSheet'));asentarHoja(document.getElementById('invSheet'));});await sleep(180);m=await metrics(page);
  const shortCalBottom=await page.evaluate(()=>Math.round(document.getElementById('calendarWidget').getBoundingClientRect().bottom));
  ok(m.rect.y===shortCalBottom&&m.rect.bottom<=390&&m.scrollable>100&&m.horizontal.length===0,'short landscape keeps the curtain below the mini clock with a scrollable body',JSON.stringify(m.rect)+' · '+m.horizontal.slice(0,8).join(' | '));
  await page.screenshot({path:SHOTS+'/projects-landscape.png'});
  ok(errors.length===0,'zero JavaScript errors across project UI, approval, tool mode and resize',errors.slice(0,3).join(' | '));
}finally{await browser.close();server.close();}
console.log(`\nPROJECTS BROWSER: ${pass} ok · ${fail} fallos`);if(fail)process.exit(1);
})().catch(e=>{console.error(e);try{server.close();}catch(_){}process.exit(1);});
