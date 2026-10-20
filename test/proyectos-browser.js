/** proyectos-browser.js — contract for the single STORES → PROJECTS responsive UI and exclusive map tool. */
const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer');
const ROOT=path.resolve(__dirname,'..'),PORT=8197,SHOTS='/tmp/antfarm-capturas';fs.mkdirSync(SHOTS,{recursive:true});
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.json':'application/json'};
const server=http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/')p='/ant-farm-rpg/index.html';const f=path.join(ROOT,p);if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':TYPES[path.extname(f)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(f).pipe(res);});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let pass=0,fail=0;const ok=(c,m,d='')=>{if(c){pass++;console.log('  ok   '+m+(d?' · '+d:''));}else{fail++;console.log('  FAIL '+m+(d?' · '+d:''));}};
async function boot(page){
  await page.goto(`http://127.0.0.1:${PORT}/ant-farm-rpg/index.html`,{waitUntil:'load',timeout:30000});
  await page.waitForFunction('window._topoFlowReady===true',{timeout:20000});
  await page.waitForFunction("document.getElementById('splashScreen').style.display==='none'",{timeout:16000}).catch(()=>{});
  await page.click('#btnMainCreate');await sleep(300);await page.click('#createSizeScreen [data-size="small"]');await sleep(350);
  await page.evaluate(()=>{const h=document.querySelector('.topo-dialog-host');if(h){const b=[...h.querySelectorAll('button')].find(x=>/^(YES|SÍ)$/i.test(x.textContent.trim()));if(b)b.click();}});
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
  ok(/Choose one bottleneck/.test(m.text)&&/EFFECT/.test(m.text)&&/SACRIFICE/.test(m.text),'cards explain problem, effect and sacrifice in English');
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

  console.log('\n· exclusive placement tool cancels cleanly and cannot place honey');
  await page.evaluate(()=>{const a=colonyProjects.activeRef(),w=workers.find(x=>x.projectCargo);if(w){const p=colonyProjectAnchor(a);w.x=p.x;w.y=p.y;workOnColonyProject(w,2,1);}let guard=0;while(colonyProjects.activeRef()&&guard++<240){const q=colonyProjects.activeRef(),b=workers.find(x=>x.id===q.crew[0]);b.fatigue=0;const p=colonyProjects.allDelivered()?colonyProjectAnchor(q):storagePos();b.x=p.x;b.y=p.y;workOnColonyProject(b,20,1);if(b.projectCargo){const z=colonyProjectAnchor(q);b.x=z.x;b.y=z.y;workOnColonyProject(b,2,1);}}const s=storageStructure(true),rr=Math.min(ROWS-3,s.r+s.h+2),mid=s.c+1;for(let y=s.r+s.h;y<=rr;y++){soil[y][mid]=0;soilType[y][mid]=0;}for(let c=Math.max(2,s.c-7);c<=Math.min(COLS-3,s.c+9);c++){soil[rr][c]=0;soilType[rr][c]=0;}markSoilDirty();refreshExploration(true);});
  const tool=await page.evaluate(()=>{const food0=foods.length;const armed=colonyProjectsAPI.arm('forward_cache');return{armed,mapTool,placement:projectPlacementType,food0};});
  ok(tool.armed&&tool.mapTool==='project'&&tool.placement==='forward_cache','CHOOSE SITE arms its own temporary map mode');
  await page.keyboard.press('Escape');await sleep(80);
  const cancelled=await page.evaluate(()=>({mapTool,placement:projectPlacementType,foods:foods.length}));
  ok(cancelled.mapTool==='navigate'&&cancelled.placement===null&&cancelled.foods===tool.food0,'ESC cancels placement without creating food or spending stock');
  const siteClick=await page.evaluate(()=>{colonyProjectsAPI.arm('forward_cache');let site=null;for(let r=SURFACE_ROW+1;r<ROWS-2&&!site;r++)for(let c=1;c<COLS-2;c++){const q=projectSiteCheck('forward_cache',c,r);if(q.ok){site=q.site;break;}}if(!site)return null;const rect=canvas.getBoundingClientRect(),wx=(site.c+.5)*CELL,wy=(site.r+.5)*CELL;return{site,x:rect.left+(wx-view.x)*view.zoom/VIEW_W*rect.width,y:rect.top+(wy-view.y)*view.zoom/VIEW_H*rect.height,before:{clay:economyLedger.materials.clay,wood:economyLedger.materials.wood}};});
  if(siteClick){await page.mouse.click(siteClick.x,siteClick.y);await sleep(100);}
  const placed=await page.evaluate(()=>({active:colonyProjects.active(),mapTool,clay:economyLedger.materials.clay,wood:economyLedger.materials.wood,heldWood:economyLedger.materialHeld('wood')}));
  ok(siteClick&&placed.active&&placed.active.type==='forward_cache'&&placed.mapTool==='navigate','a real canvas click approves the chosen connected worksite');
  ok(placed.clay===siteClick.before.clay&&placed.wood===siteClick.before.wood&&placed.heldWood===2,'site approval commits cost without an early debit');
  await page.evaluate(()=>{colonyProjectsAPI.cancel();abrirInventario();});await sleep(120);

  console.log('\n· portrait and short landscape: size check after the menu grew');
  await page.setViewport({width:390,height:844});await page.evaluate(()=>{if(document.getElementById('invSheet').getAttribute('data-open')!=='1')abrirInventario();_asentarInventario(document.getElementById('invSheet'));asentarHoja(document.getElementById('invSheet'));});await sleep(180);m=await metrics(page);
  ok(m.rect.x>=7&&m.rect.right<=383&&m.rect.bottom<=844&&m.horizontal.length===0,'portrait drawer stays inside every edge',JSON.stringify(m.rect)+' · '+m.horizontal.slice(0,8).join(' | '));
  await page.screenshot({path:SHOTS+'/projects-portrait.png'});
  await page.setViewport({width:844,height:390});await page.evaluate(()=>{_asentarInventario(document.getElementById('invSheet'));asentarHoja(document.getElementById('invSheet'));});await sleep(180);m=await metrics(page);
  ok(m.rect.y===8&&m.rect.bottom<=390&&m.scrollable>100&&m.horizontal.length===0,'short landscape keeps fixed chrome and a scrollable body',JSON.stringify(m.rect)+' · '+m.horizontal.slice(0,8).join(' | '));
  await page.screenshot({path:SHOTS+'/projects-landscape.png'});
  ok(errors.length===0,'zero JavaScript errors across project UI, approval, tool mode and resize',errors.slice(0,3).join(' | '));
}finally{await browser.close();server.close();}
console.log(`\nPROJECTS BROWSER: ${pass} ok · ${fail} fallos`);if(fail)process.exit(1);
})().catch(e=>{console.error(e);try{server.close();}catch(_){}process.exit(1);});
