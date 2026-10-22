/**
 * adaptaciones-controladas.js — Build O contract for player-owned material spending.
 *
 * Verifies in a real browser that legacy tools migrate into anatomical tiers, one compact card advances
 * I–IV through four explicit approvals, AVAILABLE protects KEEP/COMMITTED stock, tier IV survives a real
 * reload, and simulation time cannot spend raw materials on its own.
 */
const http=require('http');
const fs=require('fs');
const path=require('path');
const puppeteer=require('puppeteer');
const ROOT=path.resolve(__dirname,'..');
const PORT=8194;
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.json':'application/json','.svg':'image/svg+xml','.wav':'audio/wav'};
let pass=0,fail=0;
const ok=(cond,msg,detail='')=>{if(cond){pass++;console.log('  ok   '+msg+(detail?' · '+detail:''));}else{fail++;console.log('  FAIL '+msg+(detail?' · '+detail:''));}};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const app=fs.readFileSync(path.join(ROOT,'ant-farm-rpg/js/app.js'),'utf8');
const server=http.createServer((req,res)=>{
  let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/')p='/ant-farm-rpg/index.html';
  const file=path.join(ROOT,p);
  if(!file.startsWith(ROOT)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end('nope');return;}
  res.writeHead(200,{'Content-Type':TYPES[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store, must-revalidate'});fs.createReadStream(file).pipe(res);
});
async function boot(page){
  await page.goto(`http://127.0.0.1:${PORT}/ant-farm-rpg/index.html`,{waitUntil:'load',timeout:30000});
  await page.waitForFunction('window._topoFlowReady===true',{timeout:20000});
  await page.waitForFunction("!document.getElementById('splashScreen') || document.getElementById('splashScreen').style.display==='none'",{timeout:16000}).catch(()=>{});
  await page.click('#btnMainCreate');await sleep(350);await page.click('#createSizeScreen [data-size="small"]');await sleep(350);
  await page.evaluate(()=>{const h=document.querySelector('.topo-dialog-host');const b=h&&[...h.querySelectorAll('button')].find(x=>/^(SÍ|YES)$/i.test(x.textContent.trim()));if(b)b.click();});
  for(let i=0;i<20;i++){const seen=await page.evaluate(()=>{const m=document.getElementById('onboardingModal');if(!m||getComputedStyle(m).display==='none')return false;const b=document.getElementById('btnOnboardingStart')||[...m.querySelectorAll('button')].pop();if(b)b.click();return true;});if(seen)break;await sleep(220);}
  await page.waitForFunction("document.body.classList.contains('game-started')",{timeout:20000});await sleep(650);
}
(async()=>{
  console.log('\n· static policy: no autonomous material sink and no human tool renderer');
  const sinks=[...app.matchAll(/economyLedger\.(payMaterials|debitMaterial|consumeHeldMaterial)\s*\([^\n]*/g)].map(m=>m[0]);
  ok(sinks.length===3&&sinks.some(x=>/player-approved/.test(x))&&sinks.filter(x=>/consumeHeldMaterial/.test(x)).length===2,'the only material debits are one approved adaptation and approved-project hauling',sinks.length+' call sites');
  ok(!/colonyTexturePack\.draw\(ctx,'tool\.'/.test(app)&&!/if\(ant\.tool && !isMini\)/.test(app),'human pick, basket and trowel art is gone');
  ok(/function tryCraftTool\(\)[\s\S]{0,220}return false/.test(app)&&/function tryBuildComplexStructure\(\)[\s\S]{0,520}return false/.test(app),'old automatic crafting and decorative structures are hard-disabled');

  await new Promise(r=>server.listen(PORT,'0.0.0.0',r));
  const browser=await puppeteer.launch({headless:'new',args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage();await page.setViewport({width:1280,height:820});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
    await boot(page);
    console.log('\n· migration and explicit approval');
    const setup=await page.evaluate(()=>{
      paused=true;workers=workers.slice(0,1);const w=workers[0];w.health=100;w.tool='pick';w.toolBonus={legacy:true};w.adaptations={};
      const migrated=!!_adaptationBook(w).mandibles&&!('tool' in w)&&!('toolBonus' in w);
      w.adaptations={};
      resetColonyProjects();gen=6;colonyIQ=150;inventions.stone=true;inventions.clay=true;inventions.fiber=true;inventions.masonry=true;
      for(const k of Object.keys(economyLedger.materials))economyLedger.setMaterial(k,0,'test setup');
      economyLedger.setMaterial('stone',10,'test setup');economyLedger.setMaterial('clay',8,'test setup');economyLedger.setMaterial('fiber',8,'test setup');
      setProjectReserve('stone',2);economyLedger.holdMaterials('TEST-COMMIT',{stone:3},{force:true,reason:'test commitment'});economyLedger.clearJournal();
      pintarInventario();return {migrated,id:w.id,total:economyLedger.materials.stone,held:economyLedger.materialHeld('stone'),available:economyLedger.materialAvailable('stone')};
    });
    ok(setup.migrated,'legacy pick migrates to stone-edged mandibles and legacy fields are removed',setup.id);
    ok(setup.total===10&&setup.held===3&&setup.available===5,'KEEP and COMMITTED stock are excluded from AVAILABLE','10 total · 3 committed · 5 available');
    const bodyPixels=await page.evaluate(()=>{
      const c=document.createElement('canvas');c.width=90;c.height=70;const g=c.getContext('2d');g.translate(42,35);
      const w={...workers[0],adaptations:{mandibles:true,carry:true,foreclaws:true},state:'EXPLORAR',role:'OBRERA',caste:'media',food:null,projectCargo:null,isQueen:false};
      _hormigaVoxel(g,w,1,false,0);const d=g.getImageData(0,0,90,70).data,need={'185,192,199':0,'159,189,88':0,'213,138,87':0};
      for(let i=0;i<d.length;i+=4){const k=d[i]+','+d[i+1]+','+d[i+2];if(k in need&&d[i+3])need[k]++;}return need;
    });
    ok(Object.values(bodyPixels).every(n=>n>0),'mandible edge, fibre brace and clay claw pixels are attached to the ant body',JSON.stringify(bodyPixels));
    await page.click('#btnInventory');await sleep(280);
    const before=await page.evaluate(()=>{
      const c=document.querySelector('[data-adaptation="mandibles"]'),b=c&&c.querySelector('[data-adaptation-approve]'),stone=document.querySelector('[data-material="stone"]');
      return {cards:document.querySelectorAll('.inv-adaptation-card').length,tiers:c&&c.querySelectorAll('.inv-jaw-tier-track span').length,button:b&&b.textContent.trim(),disabled:!!(b&&b.disabled),counts:c&&c.querySelector('.inv-adaptation-counts').textContent.replace(/\s+/g,' ').trim(),
        ladder:c&&c.querySelector('.inv-jaw-tier-track').textContent.replace(/\s+/g,' ').trim(),ledger:stone&&stone.querySelector('.inv-resource-ledger').textContent.replace(/\s+/g,' ').trim(),rule:document.querySelector('.inv-adaptation-rule').textContent.replace(/\s+/g,' ').trim()};
    });
    ok(before.cards===3&&before.tiers===4&&before.button==='APPROVE TIER I FOR ONE'&&!before.disabled,'one compact jaw card exposes four sequential tiers without multiplying menus',before.ladder);
    ok(/STONE-EDGED/.test(before.ladder)&&/COPPER-SERRATED/.test(before.ladder)&&/IRON-BRACED/.test(before.ladder)&&/GOLD-INLAID/.test(before.ladder),'the visible ladder names every material tier before spending');
    ok(/COMMITTED 3/.test(before.ledger)&&/AVAILABLE 5/.test(before.ledger),'inventory separates TOTAL, COMMITTED and AVAILABLE',before.ledger);
    ok(/No worker can take these materials automatically/.test(before.rule),'the spending rule is explicit in the same inventory');
    await page.click('[data-adaptation-approve="mandibles"]');await sleep(320);
    const after=await page.evaluate(()=>{
      const w=workers[0],b=document.querySelector('[data-adaptation-approve="mandibles"]');serializeSave(true);const saved=JSON.parse(localStorage.getItem(SAVE_KEY));
      return {stone:economyLedger.materials.stone,held:economyLedger.materialHeld('stone'),available:economyLedger.materialAvailable('stone'),adapted:antHasAdaptation(w,'mandibles'),tier:antMandibleTier(w),legacy:'tool' in w,
        disabled:!!(b&&b.disabled),button:b&&b.textContent.trim(),negative:economyLedger.history().filter(x=>x.account==='material'&&x.delta<0),savedTier:saved.workers[0].adaptations&&saved.workers[0].adaptations.mandibles,savedLegacy:'tool' in saved.workers[0]};
    });
    ok(after.adapted&&after.tier===1&&after.stone===8&&after.held===3&&after.available===3,'one click spends exactly the displayed 2 stone and advances one emergent recipient to tier I',`stone ${after.stone} · available ${after.available}`);
    ok(after.negative.length===1&&/player-approved mandibles tier 1 adaptation/.test(after.negative[0].reason),'the ledger records one auditable player-approved tier debit',after.negative[0]&&after.negative[0].reason);
    ok(after.disabled&&after.button==='NEEDS AVAILABLE STOCK','the same compact card now asks for copper instead of pretending the chain is complete');
    ok(after.savedTier===1&&!after.legacy&&!after.savedLegacy,'tier I persists numerically without restoring a human tool field');

    console.log('\n· the same card advances through copper, iron and gold');
    await page.evaluate(()=>{economyLedger.setMaterial('cobre',10,'tier fixture');economyLedger.setMaterial('hierro',10,'tier fixture');economyLedger.setMaterial('oro',10,'tier fixture');economyLedger.clearJournal();pintarInventario();});
    for(let i=0;i<3;i++){await page.click('[data-adaptation-approve="mandibles"]');await sleep(220);}
    const maxed=await page.evaluate(()=>{
      const w=workers[0],card=document.querySelector('[data-adaptation="mandibles"]'),button=card.querySelector('[data-adaptation-approve]');serializeSave(true);const saved=JSON.parse(localStorage.getItem(SAVE_KEY));
      const c=document.createElement('canvas');c.width=90;c.height=70;const g=c.getContext('2d');g.translate(42,35);_hormigaVoxel(g,{...w,state:'EXPLORAR',food:null,projectCargo:null},1,false,0);const px=g.getImageData(0,0,90,70).data;let gold=0;for(let i=0;i<px.length;i+=4)if(px[i]===242&&px[i+1]===200&&px[i+2]===75&&px[i+3])gold++;
      return{tier:antMandibleTier(w),button:button.textContent.trim(),disabled:button.disabled,earned:card.querySelectorAll('.inv-jaw-tier-track .is-earned').length,copper:economyLedger.materials.cobre,iron:economyLedger.materials.hierro,goldStock:economyLedger.materials.oro,goldPixels:gold,savedTier:saved.workers[0].adaptations.mandibles,debits:economyLedger.history().filter(x=>x.account==='material'&&x.delta<0)};
    });
    ok(maxed.tier===4&&maxed.earned===4&&maxed.button==='ALL AT TIER IV'&&maxed.disabled,'three more approvals finish the visible I → II → III → IV chain',JSON.stringify({tier:maxed.tier,earned:maxed.earned,button:maxed.button}));
    ok(maxed.copper===7&&maxed.iron===7&&maxed.goldStock===8&&maxed.debits.length===6,'copper, iron and gold costs are paid exactly once from AVAILABLE stock',JSON.stringify({copper:maxed.copper,iron:maxed.iron,gold:maxed.goldStock}));
    ok(maxed.goldPixels>0&&maxed.savedTier===4,'tier IV has distinct gold jaw pixels and survives serialization',`pixels ${maxed.goldPixels} · saved tier ${maxed.savedTier}`);
    await page.reload({waitUntil:'load'});await page.waitForFunction(()=>typeof topoResumeGame==='function');
    const reloaded=await page.evaluate(()=>{const resumed=topoResumeGame({silent:true});paused=true;return{resumed,tier:workers[0]&&antMandibleTier(workers[0]),legacy:workers[0]&&('tool' in workers[0])};});
    ok(reloaded.resumed&&reloaded.tier===4&&!reloaded.legacy,'a real page reload restores tier IV on the same anatomical specialist',JSON.stringify(reloaded));

    console.log('\n· elapsed simulation cannot spend discretionary stock');
    const autonomous=await page.evaluate(async()=>{
      resetColonyProjects();for(const k of ['stone','clay','sand','fiber','wood','cobre','hierro','oro'])economyLedger.setMaterial(k,30,'autonomy baseline');economyLedger.clearJournal();paused=false;setGameSpeed(32);
      await new Promise(r=>setTimeout(r,2600));paused=true;
      const debits=economyLedger.history().filter(x=>x.account==='material'&&x.delta<0);return {debits,stock:Object.fromEntries(['stone','clay','sand','fiber','wood','cobre','hierro','oro'].map(k=>[k,economyLedger.materials[k]]))};
    });
    ok(autonomous.debits.length===0,'simulation time produces no unapproved material debit',autonomous.debits.map(x=>x.reason).join(' | ')||'none');
    ok(Object.values(autonomous.stock).every(v=>v>=30),'stock can be gathered but never silently consumed',JSON.stringify(autonomous.stock));
    ok(errors.length===0,'zero JavaScript errors during migration, purchase and simulation',errors.slice(0,3).join(' | ')||'none');
  }finally{await browser.close();server.close();}
  console.log(`\nCONTROLLED ADAPTATIONS: ${pass} ok · ${fail} failures`);if(fail)process.exit(1);
})().catch(e=>{console.error(e);try{server.close();}catch(_){}process.exit(1);});
