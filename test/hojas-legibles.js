/**
 * hojas-legibles.js — compact ant roster and single-view profiles.
 *
 * Current contract (2026-10-21): a new player sees only who an ant is, what she is doing,
 * how she is, and actions that can be taken now. Neural values, DNA, genealogy, personal
 * history, trait grids and profile tabs must not return to the normal play surface.
 *
 *   node test/hojas-legibles.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const ROOT = path.resolve(__dirname, '..');
const PORT = 8173;
const TYPES = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.png':'image/png', '.jpg':'image/jpeg', '.json':'application/json', '.svg':'image/svg+xml' };
const CAPTURES = '/tmp/antfarm-capturas';

const server = http.createServer((req,res) => {
  let url = decodeURIComponent(req.url.split('?')[0]);
  if(url === '/') url = '/ant-farm-rpg/index.html';
  const file = path.join(ROOT, url);
  if(!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()){ res.writeHead(404); res.end('nope'); return; }
  res.writeHead(200, {'Content-Type':TYPES[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-store'});
  fs.createReadStream(file).pipe(res);
});
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass=0, fail=0;
function ok(value,label,detail=''){
  if(value){ pass++; console.log('  ok   '+label+(detail?' · '+detail:'')); }
  else { fail++; console.log('  FAIL '+label+(detail?' · '+detail:'')); }
}

const html = fs.readFileSync(path.join(ROOT,'ant-farm-rpg/index.html'),'utf8');
const js = fs.readFileSync(path.join(ROOT,'ant-farm-rpg/js/app.js'),'utf8');
const sliceBetween = (source,a,b) => source.slice(source.indexOf(a), source.indexOf(b, source.indexOf(a)));
const workerMarkup = sliceBetween(html,'id="antProfile"','id="queenProfile"');
const queenMarkup = sliceBetween(html,'id="queenProfile"','<!-- CONTROLES ESQUINA FIJA');

(async () => {
  console.log('\n· markup: complexity was removed, not hidden behind another menu');
  ok(/id="btnRoster"/.test(html) && /id="rosterSheet"/.test(html), 'the toolbar count remains the single doorway to active ants');
  ok(!/profileTabs|profileTab_|queenProfileTabs|queenTab_/.test(workerMarkup+queenMarkup), 'worker and queen profiles contain no tabs');
  ok(!/profileNn|profileMind|queenDnaStr|queenGenomeId|profileTree|profileHistory|queenProfileTree|queenProfileHistory/.test(workerMarkup+queenMarkup), 'raw neural, DNA, genealogy and history widgets are absent');
  ok(!/profileTab_cerebro|pintarCerebroHoja|btnCerebroNumeros/.test(js), 'obsolete profile-brain wiring is gone from runtime code');
  ok(/id="profileTask"/.test(workerMarkup) && /id="profileCondition"/.test(workerMarkup), 'worker markup has one task and one condition');
  ok(/id="queenProfileTask"/.test(queenMarkup) && /id="queenProfileCondition"/.test(queenMarkup) && /id="queenProgressLbl"/.test(queenMarkup), 'queen markup has task, condition and one egg-progress figure');

  await new Promise(resolve => server.listen(PORT,'0.0.0.0',resolve));
  const browser = await puppeteer.launch({headless:'new',args:['--no-sandbox','--disable-dev-shm-usage']});
  const page = await browser.newPage();
  await page.setViewport({width:1280,height:820});
  const errors=[];
  page.on('pageerror',e=>errors.push('pageerror: '+e.message));
  page.on('console',m=>{ if(m.type()==='error'&&!/favicon|autoplay|AudioContext/.test(m.text()))errors.push('console: '+m.text().slice(0,180)); });

  await page.goto(`http://127.0.0.1:${PORT}/ant-farm-rpg/index.html`,{waitUntil:'load',timeout:30000});
  await page.waitForFunction('typeof window.topoShowMainMenu==="function" || window._topoFlowReady===true',{timeout:20000}).catch(()=>{});
  await page.waitForFunction("!document.getElementById('splashScreen') || document.getElementById('splashScreen').style.display==='none'",{timeout:15000}).catch(()=>{});
  await page.click('#btnMainCreate'); await sleep(300);
  await page.click('#createSizeScreen [data-size="small"]'); await sleep(420);
  await page.evaluate(()=>{ const h=document.querySelector('.topo-dialog-host'); if(!h)return; const b=[...h.querySelectorAll('button')].find(x=>/^(YES|SÍ)$/i.test(x.textContent.trim())); if(b)b.click(); });
  for(let i=0;i<20;i++){
    const entered=await page.evaluate(()=>{ const b=document.getElementById('btnOnboardingStart'); if(b&&b.offsetParent!==null){b.click();return true;} return document.body.classList.contains('game-started'); });
    if(entered)break; await sleep(220);
  }
  await page.waitForFunction("document.body.classList.contains('game-started')",{timeout:20000}).catch(()=>{});
  await sleep(900);
  await page.evaluate(()=>{ paused=true; });

  console.log('\n· roster: three useful views and no repeated technical metadata');
  await page.click('#btnRoster'); await sleep(300);
  const roster = await page.evaluate(() => {
    const sheet=document.getElementById('rosterSheet'),body=document.getElementById('rosterCuerpo');
    const rows=[...body.querySelectorAll('.ficha-hormiga')],r=sheet.getBoundingClientRect();
    return {
      open:sheet.getAttribute('data-open')==='1', hidden:sheet.getAttribute('aria-hidden'), filters:[...document.querySelectorAll('#rosterFiltros [data-f]')].map(x=>x.textContent.trim()),
      rows:rows.length,active:workers.length+queens.length,summary:document.getElementById('rosterSummary').textContent.trim(),
      texts:rows.map(x=>x.textContent.replace(/\s+/g,' ').trim()), ids:rows.map(x=>x.dataset.id),
      rowHeight:rows.length?Math.round(rows[0].getBoundingClientRect().height):0,
      overflow:rows.filter(x=>x.scrollWidth>x.clientWidth+1).length,
      bottom:+(r.bottom-innerHeight).toFixed(1), top:Math.round(r.top), calendarBottom:Math.round(document.getElementById('calendarWidget').getBoundingClientRect().bottom),
      width:Math.round(r.width), bodyOverflow:getComputedStyle(body).overflowY
    };
  });
  ok(roster.open && roster.hidden==='false', 'clicking WORKERS opens the active-ant roster');
  ok(roster.filters.join('|')==='ALL|QUEENS|WORKERS', 'five caste chips became three useful views', roster.filters.join(' · '));
  ok(roster.rows===roster.active, 'ALL contains every active queen and worker', `${roster.rows} rows`);
  ok(/^1 queen · \d+ workers?$/.test(roster.summary), 'population is summarized once in plain language', roster.summary);
  ok(roster.texts.every(t=>!/(?:GEN\s*\d|\d+\.\d+\s*d|❤|DNA|FIT)/i.test(t)), 'rows omit generation, age, raw health and fitness when no warning is needed', roster.texts.slice(0,2).join(' | '));
  ok(roster.texts.every(t=>/·/.test(t)), 'each row still answers who and what she is doing');
  ok(roster.rowHeight>=44 && roster.overflow===0, 'rows remain readable and physically tappable', `${roster.rowHeight}px tall`);
  ok(roster.bottom<=1 && roster.top>=roster.calendarBottom-1 && /auto|scroll/.test(roster.bodyOverflow), 'roster stays below the clock, inside the viewport, with one scrolling body', `${roster.width}px wide`);

  const filters = await page.evaluate(async () => {
    const click=async f=>{ document.querySelector('#rosterFiltros [data-f="'+f+'"]').click(); await new Promise(r=>setTimeout(r,80)); return [...document.querySelectorAll('#rosterCuerpo .ficha-hormiga')].map(x=>x.dataset.id); };
    const q=await click('REINA'),w=await click('OBRERA');await click('TODAS');
    return {q,w,queenIds:queens.map(x=>x.id),workerIds:workers.map(x=>x.id)};
  });
  ok(filters.q.length===filters.queenIds.length && filters.q.every(id=>filters.queenIds.includes(id)), 'QUEENS filters to queens only');
  ok(filters.w.length===filters.workerIds.length && filters.w.every(id=>filters.workerIds.includes(id)), 'WORKERS includes every non-queen caste without extra chips');

  console.log('\n· worker profile: one glance, two actions');
  const workerId = await page.evaluate(()=>workers[0].id);
  await page.evaluate(id=>document.querySelector('#rosterCuerpo [data-id="'+id+'"]').click(),workerId); await sleep(260);
  const worker = await page.evaluate(() => {
    const sheet=document.getElementById('antProfile'),r=sheet.getBoundingClientRect();
    const visibleButtons=[...sheet.querySelectorAll('button')].filter(b=>b.offsetParent!==null&&!/Close|Back/.test(b.getAttribute('aria-label')||''));
    const canvas=document.getElementById('profileCanvas'),data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
    let painted=0;for(let i=0;i<data.length;i+=4)if(data[i]>20||data[i+1]>20||data[i+2]>20)painted++;
    return {
      open:sheet.getAttribute('data-open')==='1',hidden:sheet.getAttribute('aria-hidden'),text:sheet.textContent.replace(/\s+/g,' ').trim(),
      title:document.getElementById('profileTitle').textContent.trim(),identity:document.getElementById('profileIdentity').textContent.trim(),
      task:document.getElementById('profileTask').textContent.trim(),condition:document.getElementById('profileCondition').textContent.trim(),
      tabs:sheet.querySelectorAll('[data-ptab],[role="tab"],#profileTabs').length,actions:visibleButtons.map(b=>b.textContent.trim()),
      height:Math.round(r.height),bottom:+(r.bottom-innerHeight).toFixed(1),top:Math.round(r.top),painted,
      rosterOpen:!!document.querySelector('#rosterSheet[data-open]'),back:getComputedStyle(document.getElementById('btnVolver')).display
    };
  });
  ok(worker.open && worker.hidden==='false' && !worker.rosterOpen, 'a roster row opens exactly one worker sheet');
  ok(worker.title && worker.identity && worker.task && worker.condition, 'the sheet answers name, role, current work and condition', `${worker.title} · ${worker.identity} · ${worker.task} · ${worker.condition}`);
  ok(worker.tabs===0, 'there is no second navigation layer inside the profile');
  ok(worker.actions.join('|')==='FIND ON MAP|EXILE', 'only the two actionable worker controls remain', worker.actions.join(' · '));
  ok(!/(DNA|GENOME|NEURON|SENSOR|TRAIT|TREE|HISTORY|FITNESS|GEN-?\d)/i.test(worker.text), 'technical and archival data are absent from the visible worker sheet');
  ok(worker.height<=370 && worker.bottom<=1, 'worker profile frees visible map space instead of filling the whole column', `${worker.height}px high`);
  ok(worker.painted>180, 'the compact identity keeps a real voxel portrait', `${worker.painted} painted pixels`);
  ok(worker.back!=='none', 'LIST returns to the only roster doorway');

  await page.click('#btnVolver'); await sleep(220);
  ok(await page.evaluate(()=>!!document.querySelector('#rosterSheet[data-open]')&&!document.querySelector('#antProfile[data-open]')), 'LIST returns in one click without stacked sheets');

  console.log('\n· queen profile: egg decision and explicit food cost');
  const queenId=await page.evaluate(()=>queens[0].id);
  await page.evaluate(id=>document.querySelector('#rosterCuerpo [data-id="'+id+'"]').click(),queenId); await sleep(260);
  const queen = await page.evaluate(() => {
    const sheet=document.getElementById('queenProfile'),r=sheet.getBoundingClientRect();
    const visibleButtons=[...sheet.querySelectorAll('button')].filter(b=>b.offsetParent!==null&&!/Close|Back/.test(b.getAttribute('aria-label')||''));
    return {open:sheet.getAttribute('data-open')==='1',text:sheet.textContent.replace(/\s+/g,' ').trim(),identity:document.getElementById('queenProfileIdentity').textContent.trim(),task:document.getElementById('queenProfileTask').textContent.trim(),condition:document.getElementById('queenProfileCondition').textContent.trim(),egg:document.getElementById('queenProgressLbl').textContent.trim(),hint:document.getElementById('queenFeedHint').textContent.trim(),tabs:sheet.querySelectorAll('[data-qtab],[role="tab"],#queenProfileTabs').length,actions:visibleButtons.map(b=>b.textContent.trim()),height:Math.round(r.height),bottom:+(r.bottom-innerHeight).toFixed(1),workerOpen:!!document.querySelector('#antProfile[data-open]')};
  });
  ok(queen.open && !queen.workerOpen, 'queen row opens the queen sheet alone');
  ok(/QUEEN/.test(queen.identity) && queen.task && queen.condition && /^\d+%$/.test(queen.egg), 'queen sheet shows identity, current work, condition and one egg figure', `${queen.identity} · ${queen.task} · ${queen.egg}`);
  ok(queen.tabs===0 && queen.actions.length>=2 && queen.actions.length<=3, 'queen profile has no tabs and at most three immediate actions', queen.actions.join(' · '));
  ok(/2 food/i.test(queen.hint) && /18%/.test(queen.hint), 'feed explains cost and result before spending', queen.hint);
  ok(!/(DNA|GENOME|NEURON|SENSOR|TRAIT|TREE|HISTORY|FITNESS|GEN-?\d|LINEAGE)/i.test(queen.text), 'technical, lineage and archive data are absent from the queen sheet');
  ok(queen.height<=455 && queen.bottom<=1, 'queen sheet remains compact and inside the viewport', `${queen.height}px high`);

  const feed = await page.evaluate(() => {
    const q=queens[0]; q.progress=20;q.health=70;economyLedger.setFood(Math.max(10,economyLedger.food),'profile action test');_refreshQueenProfileCompact(q);
    return {food:economyLedger.food,progress:q.progress,disabled:document.getElementById('btnFeedQueen').disabled};
  });
  if(!feed.disabled){ await page.click('#btnFeedQueen'); await sleep(100); }
  const fed = await page.evaluate(()=>({food:economyLedger.food,progress:queens[0].progress,health:queens[0].health}));
  ok(!feed.disabled && fed.food===feed.food-2 && fed.progress===38 && fed.health===88, 'FEED performs exactly the stated 2-food / +18% decision', `${feed.food}→${fed.food} food · ${feed.progress}→${fed.progress}% egg`);

  console.log('\n· short and narrow screens: actions remain physically reachable');
  await page.setViewport({width:1024,height:360}); await sleep(220);
  await page.evaluate(id => {closeQueenProfile(true);showAntProfile(workers.find(w=>w.id===id));},workerId);
  await sleep(280);
  const short = await page.evaluate(() => {
    const sheet=document.getElementById('antProfile');asentarHoja(sheet);sheet.scrollTop=sheet.scrollHeight;
    const r=sheet.getBoundingClientRect(),actions=sheet.querySelector('.compact-profile-actions').getBoundingClientRect(),cal=document.getElementById('calendarWidget').getBoundingClientRect();
    return {top:Math.round(r.top),bottom:Math.round(r.bottom),h:Math.round(r.height),viewport:innerHeight,calendarBottom:Math.round(cal.bottom),overflow:getComputedStyle(sheet).overflowY,actionsBottom:Math.round(actions.bottom),scrollTop:Math.round(sheet.scrollTop)};
  });
  ok(short.top>=short.calendarBottom-1 && short.bottom<=short.viewport, 'short-screen profile starts below the compact clock and never leaves the viewport', `y ${short.top}..${short.bottom} of ${short.viewport}`);
  ok(/auto|scroll/.test(short.overflow) && short.actionsBottom<=short.bottom+1 && short.scrollTop>0, 'when height is scarce, scrolling reaches both actions physically', `scrollTop ${short.scrollTop}`);

  await page.setViewport({width:390,height:844}); await sleep(220);
  const narrow = await page.evaluate(() => {
    const sheet=document.getElementById('antProfile');_asentarBajoCalendario(sheet);asentarHoja(sheet);
    const r=sheet.getBoundingClientRect(),actions=sheet.querySelector('.compact-profile-actions').getBoundingClientRect();
    return {left:Math.round(r.left),right:Math.round(r.right),bottom:Math.round(r.bottom),width:Math.round(r.width),viewportW:innerWidth,viewportH:innerHeight,actionsRight:Math.round(actions.right),overflowX:sheet.scrollWidth-sheet.clientWidth};
  });
  ok(narrow.left>=0 && narrow.right<=narrow.viewportW && narrow.bottom<=narrow.viewportH, 'narrow profile stays fully on screen', `${narrow.width}px in ${narrow.viewportW}px`);
  ok(narrow.actionsRight<=narrow.right+1 && narrow.overflowX<=1, 'profile actions do not clip or create horizontal scrolling');

  ok(errors.length===0, 'zero JavaScript errors through roster, both profiles and responsive checks', errors.slice(0,2).join(' | ')||'none');
  try{fs.mkdirSync(CAPTURES,{recursive:true});await page.screenshot({path:CAPTURES+'/perfiles-compactos.png'});}catch(e){}

  console.log(`\n${pass} ok · ${fail} FAILURES`);
  await browser.close();server.close();process.exit(fail?1:0);
})().catch(async err => {
  console.error('HARNESS FAILURE:',err.stack||err.message);
  try{if(typeof browser!=='undefined')await browser.close();}catch(e){}
  try{server.close();}catch(e){}
  process.exit(2);
});
