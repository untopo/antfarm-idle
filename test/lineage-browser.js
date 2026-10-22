/** lineage-browser.js — one responsive curtain, one amber figure, explicit irreversible flight. */
const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer');
const ROOT=path.resolve(__dirname,'..'),PORT=8194;
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.json':'application/json','.svg':'image/svg+xml','.wav':'audio/wav'};
let pass=0,fail=0;const ok=(c,m,d='')=>{if(c){pass++;console.log('  ok   '+m+(d?' · '+d:''));}else{fail++;console.log('  FAIL '+m+(d?' · '+d:''));}};const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const html=fs.readFileSync(path.join(ROOT,'ant-farm-rpg/index.html'),'utf8'),css=fs.readFileSync(path.join(ROOT,'ant-farm-rpg/css/style.css'),'utf8'),app=fs.readFileSync(path.join(ROOT,'ant-farm-rpg/js/app.js'),'utf8');
const server=http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/')p='/ant-farm-rpg/index.html';const f=path.join(ROOT,p);if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);return res.end('nope');}res.writeHead(200,{'Content-Type':TYPES[path.extname(f)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(f).pipe(res);});
async function boot(page){
  await page.goto(`http://127.0.0.1:${PORT}/ant-farm-rpg/index.html`,{waitUntil:'load',timeout:30000});
  await page.waitForFunction("!document.getElementById('splashScreen')||document.getElementById('splashScreen').style.display==='none'",{timeout:16000}).catch(()=>{});
  await page.click('#btnMainCreate');await sleep(350);await page.click('#createSizeScreen [data-size="small"]');await sleep(350);
  await page.evaluate(()=>{const h=document.querySelector('.topo-dialog-host');const b=h&&[...h.querySelectorAll('button')].find(x=>/^(SÍ|YES)$/i.test(x.textContent.trim()));if(b)b.click();});
  for(let i=0;i<20;i++){const seen=await page.evaluate(()=>{const m=document.getElementById('onboardingModal');if(!m||getComputedStyle(m).display==='none')return false;const b=document.getElementById('btnOnboardingStart')||[...m.querySelectorAll('button')].pop();if(b)b.click();return true;});if(seen)break;await sleep(220);}
  await page.waitForFunction("document.body.classList.contains('game-started')",{timeout:20000});await sleep(650);
}
async function openLineage(page){const open=await page.evaluate(()=>document.getElementById('lineageSheet').getAttribute('data-open')==='1');if(!open){await page.click('#btnLineage');await sleep(300);}}
async function measure(page){return page.evaluate(()=>{
  const sh=document.getElementById('lineageSheet'),body=document.getElementById('lineageBody'),cal=document.getElementById('calendarWidget');
  const r=sh.getBoundingClientRect(),rc=cal.getBoundingClientRect(),close=document.getElementById('btnCloseLineage').getBoundingClientRect(),go=document.getElementById('btnNuptialFlight').getBoundingClientRect();
  const overflow=[...sh.querySelectorAll('*')].filter(n=>{const s=getComputedStyle(n);return s.display!=='none'&&!n.closest('[aria-hidden="true"]')&&n.scrollWidth-n.clientWidth>2&&!/auto|scroll/.test(s.overflowX)&&s.textOverflow!=='ellipsis';}).map(n=>(n.id||n.className||n.tagName)+':'+(n.scrollWidth-n.clientWidth));
  return {r:{x:Math.round(r.x),y:Math.round(r.y),right:Math.round(r.right),bottom:Math.round(r.bottom),w:Math.round(r.width),h:Math.round(r.height)},cal:{right:Math.round(rc.right),bottom:Math.round(rc.bottom),w:Math.round(rc.width)},
    close:[Math.round(close.width),Math.round(close.height)],go:[Math.round(go.width),Math.round(go.height)],overflow,scroll:body.scrollHeight-body.clientHeight,
    bodyOverflow:getComputedStyle(body).overflowY,focus:document.activeElement&&document.activeElement.id,hidden:sh.getAttribute('aria-hidden'),expanded:document.getElementById('btnLineage').getAttribute('aria-expanded'),text:sh.textContent.replace(/\s+/g,' ').trim(),
    reward:(sh.querySelector('.lineage-run-top b')||{}).textContent||'',action:document.getElementById('btnNuptialFlight').textContent.trim(),disabled:document.getElementById('btnNuptialFlight').disabled};
});}
(async()=>{
  console.log('\n· cold contract');
  ok((html.match(/id="lineageSheet"/g)||[]).length===1&&(html.match(/id="btnLineage"/g)||[]).length===1,'one curtain and one calendar door, with no cloned lineage control');
  ok((html.match(/id="lineageAmberHud"/g)||[]).length===1&&(html.match(/id="btnNuptialFlight"/g)||[]).length===1,'one amber balance figure and one flight action');
  ok(html.indexOf('core/lineage.js')<html.indexOf('js/app.js'),'the pure lineage core loads before its browser adapter');
  ok(/\.lineage-sheet/.test(css)&&/\.lineage-upgrade-card/.test(css)&&/max-width:520px/.test(css),'the curtain has voxel, upgrade, and compact responsive rules');
  ok(/completeNuptialFlight/.test(app)&&/topoCreateFreshWorld\(cols,rows,\{lineage:lineageState,relics:keptRelics,nuptial:true\}\)/.test(app),'the UI commits through the pure book and a real seeded world reset');
  await new Promise(r=>server.listen(PORT,'0.0.0.0',r));
  const browser=await puppeteer.launch({headless:'new',args:['--no-sandbox','--disable-dev-shm-usage']});const page=await browser.newPage();await page.setViewport({width:1280,height:820});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/favicon|autoplay|AudioContext/.test(m.text()))errors.push(m.text().slice(0,180));});
  try{
    await boot(page);await openLineage(page);let m=await measure(page);
    console.log('\n· locked state and desktop geometry');
    ok(m.disabled&&/REACH THE FIRST DEPTH OPENING/.test(m.text),'the flight is visibly locked before the connected tunnel opens real depth');
    ok(m.r.w===m.cal.w&&m.r.right===m.cal.right&&m.r.y===m.cal.bottom,'the only curtain begins immediately below the clock on its exact axis',JSON.stringify({r:m.r,cal:m.cal}));
    ok(m.r.x>=0&&m.r.right<=1280&&m.r.bottom<=820,'desktop frame remains completely on screen');
    ok(m.close[0]>=44&&m.close[1]>=44&&m.go[1]>=42,'close and primary action have touch-sized targets',`close ${m.close.join('×')} · action ${m.go.join('×')}`);
    ok(m.bodyOverflow==='auto'&&m.scroll>30,'only the body scrolls through all finite upgrades',String(m.scroll));
    ok(m.focus==='btnCloseLineage'&&m.hidden==='false'&&m.expanded==='true','opening moves focus and updates both ARIA states');
    ok(m.overflow.length===0,'desktop content has no horizontal spill',m.overflow.join(' | '));

    await page.evaluate(()=>{const c=entradaCol>=0?entradaCol:CENTER_COL;for(let r=SURFACE_ROW;r<=ROWS-7;r++){soil[r][c]=0;soilType[r][c]=0;}markSoilDirty();checkWorldExpansion();lineageRun.relicsFound=2;_setLineageState({...lineageSnapshot(lineageState),amber:20,earned:20});renderLineageSheet(true);updateLineageHud();});await sleep(180);m=await measure(page);
    const occurrences=(m.text.match(new RegExp(m.reward.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g'))||[]).length;
    ok(!m.disabled&&m.action==='BEGIN NUPTIAL FLIGHT','one physical depth opening plus a living queen unlocks one explicit action');
    ok(occurrences===1,'the quoted amber yield is printed once in the curtain',m.reward+' × '+occurrences);
    ok((await page.$$('[data-buy-lineage]')).length===4,'exactly four finite earned-play upgrades are offered');
    await page.click('[data-buy-lineage="trail_memory"]');await sleep(180);
    const bought=await page.evaluate(()=>({hud:document.getElementById('lineageAmberHud').textContent,pips:document.querySelectorAll('[data-lineage-upgrade="trail_memory"] .lineage-ranks i.on').length,rank:getLineageState().upgrades.trail_memory,spent:getLineageState().spent}));
    ok(bought.hud==='18.00'&&bought.pips===1&&bought.rank===1&&bought.spent===2,'buying spends the sole HUD wallet and lights one persistent rank',JSON.stringify(bought));

    console.log('\n· one right curtain at a time and explicit confirmation');
    await page.click('#btnInventory');await sleep(260);
    let one=await page.evaluate(()=>({lineage:getComputedStyle(document.getElementById('lineageSheet')).display,inventory:document.getElementById('invSheet').getAttribute('data-open')}));
    ok(one.lineage==='none'&&one.inventory==='1','opening NEST STORES closes lineage instead of stacking a second curtain');
    await page.click('#btnLineage');await sleep(260);
    one=await page.evaluate(()=>({lineage:document.getElementById('lineageSheet').getAttribute('data-open'),inventory:getComputedStyle(document.getElementById('invSheet')).display}));
    ok(one.lineage==='1'&&one.inventory==='none','opening lineage closes NEST STORES in return');
    const oldSeed=await page.evaluate(()=>worldSeed);await page.click('#btnNuptialFlight');await sleep(160);
    const confirmText=await page.evaluate(()=>{const h=document.querySelector('.topo-dialog-host');return h?h.textContent.replace(/\s+/g,' ').trim():'';});
    ok(/RESET/.test(confirmText)&&/KEEP/.test(confirmText)&&/cannot be resumed/i.test(confirmText),'confirmation names both sides and states irreversibility');
    await page.evaluate(()=>{const h=document.querySelector('.topo-dialog-host');const b=h&&[...h.querySelectorAll('button')].find(x=>/^(NO|CANCEL)$/i.test(x.textContent.trim()));if(b)b.click();});await sleep(120);
    ok((await page.evaluate(()=>worldSeed))===oldSeed,'cancel leaves the physical farm untouched');
    await page.click('#btnNuptialFlight');await sleep(120);
    await page.evaluate(()=>{const h=document.querySelector('.topo-dialog-host');const b=h&&[...h.querySelectorAll('button')].find(x=>/^(YES|SÍ)$/i.test(x.textContent.trim()));if(b)b.click();});await sleep(550);
    const flown=await page.evaluate(()=>({seed:worldSeed,day,slabs:umbralesRotos,flights:getLineageState().flights,amber:getLineageState().amber,unlock:_offlineUnlocks.lineage,panel:getComputedStyle(document.getElementById('lineageSheet')).display}));
    ok(flown.seed!==oldSeed&&flown.day===1&&flown.slabs===0,'confirm replaces the old farm with a Day 1 seeded nest',JSON.stringify(flown));
    ok(flown.flights===1&&flown.amber>18&&flown.unlock&&flown.panel==='none','amber, rank wallet, receipt, and 12 h milestone cross the reset');

    console.log('\n· portrait and landscape');
    await page.setViewport({width:390,height:844});await openLineage(page);m=await measure(page);
    ok(m.r.x>=0&&m.r.right<=390&&m.r.bottom<=844&&m.r.w===m.cal.w&&m.r.y===m.cal.bottom,'portrait keeps the whole curtain under the clock',JSON.stringify({r:m.r,cal:m.cal}));
    ok(m.close[0]>=44&&m.close[1]>=44&&m.go[1]>=42&&m.overflow.length===0,'portrait remains touchable with no horizontal spill',m.overflow.join(' | '));
    await page.setViewport({width:844,height:390});await sleep(350);m=await measure(page);
    ok(m.r.x>=0&&m.r.right<=844&&m.r.bottom<=390&&m.r.w===m.cal.w&&m.r.y===m.cal.bottom,'landscape keeps header, scroll body, and footer inside the frame',JSON.stringify(m.r));
    ok(m.scroll>100&&m.overflow.length===0,'landscape reaches all upgrades by vertical scroll only',m.scroll+' · '+m.overflow.join(' | '));
    ok(errors.length===0,'zero browser errors through open, buy, cancel, reset, and rotations',errors.slice(0,3).join(' | ')||'none');
  }finally{await browser.close();server.close();}
  console.log(`\nLINEAGE BROWSER: ${pass} ok · ${fail} fallos`);if(fail)process.exit(1);
})().catch(e=>{console.error(e);server.close();process.exit(1);});
