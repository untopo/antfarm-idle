/**
 * The approved startup in real Chrome: 640x360 Topo Studios animation, snug hard hat,
 * block-tunnel handoff, explicit title menu, skip/replay, and reduced motion.
 */
const http=require('http');
const fs=require('fs');
const path=require('path');
const puppeteer=require('puppeteer');
fs.mkdirSync('/tmp/antfarm-capturas',{recursive:true});
const ROOT=path.resolve(__dirname,'..'),PORT=8181;
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.json':'application/json'};
const server=http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/')p='/ant-farm-rpg/index.html';const f=path.join(ROOT,p);if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end('nope');return}res.writeHead(200,{'Content-Type':TYPES[path.extname(f)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(f).pipe(res)});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let pass=0,fail=0;
const ok=(c,m,d)=>{if(c){pass++;console.log('  ok   '+m+(d?' · '+d:''))}else{fail++;console.log('  FAIL '+m+(d?' · '+d:''))}};
const SAMPLE=`(()=>{const cv=document.getElementById('splashTopo');if(!cv)return null;const d=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;let yellow=0,fur=0,earth=0,black=0,opaque=0,h=2166136261;for(let i=0;i<d.length;i+=4){const r=d[i],q=d[i+1],b=d[i+2],a=d[i+3];h=Math.imul(h^(r+(q<<8)+(b<<16)+a),16777619)>>>0;if(a<12)continue;opaque++;if(r>175&&q>115&&b<95)yellow++;if(r>65&&r<155&&q>55&&q<145&&b>45&&b<135&&Math.max(r,q,b)-Math.min(r,q,b)<48)fur++;if(r>95&&r<210&&q>55&&q<145&&b<100&&r>q+18)earth++;if(r<18&&q<18&&b<18)black++}return{hash:h,yellow,fur,earth,black,opaque,w:cv.width,h:cv.height,css:Math.round(cv.getBoundingClientRect().width)}})()`;
async function open(browser,reduced){const page=await browser.newPage();await page.setViewport({width:1280,height:760});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/font|favicon/i.test(m.text()))errors.push(m.text())});if(reduced)await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);await page.goto(`http://127.0.0.1:${PORT}/ant-farm-rpg/index.html`,{waitUntil:'load',timeout:30000});await page.waitForFunction('window._topoFlowReady===true',{timeout:20000});return{page,errors}}
(async()=>{await new Promise(r=>server.listen(PORT,'0.0.0.0',r));const browser=await puppeteer.launch({headless:'new',args:['--no-sandbox','--disable-dev-shm-usage']});
  console.log('\n· approved Topo Studios sequence');
  const {page,errors}=await open(browser,false);
  await sleep(120);const a=await page.evaluate(SAMPLE);
  ok(a&&a.w===640&&a.h===360,'the intro canvas is the approved 640x360 frame',a?`${a.w}x${a.h}, ${a.css}px on screen`:'missing');
  const first=await page.evaluate(()=>({splash:getComputedStyle(splashScreen).display,main:getComputedStyle(mainMenu).display,started:document.body.classList.contains('game-started')}));
  ok(first.splash!=='none'&&first.main==='none'&&!first.started,'the first screen is the studio intro only','farm and title menu remain hidden');
  await sleep(720);const b=await page.evaluate(SAMPLE);
  ok(a&&b&&a.hash!==b.hash,'the block reveal and burrow sequence advance',`${a&&a.hash} -> ${b&&b.hash}`);
  await sleep(1050);const c=await page.evaluate(SAMPLE);
  ok(c&&c.yellow>650,'the yellow hard hat is visibly present',`${c&&c.yellow} yellow pixels`);
  ok(c&&c.fur>600,'the mole is visibly out of the burrow',`${c&&c.fur} fur pixels`);
  ok(c&&c.earth>9000,'the ground remains a countable voxel cutaway',`${c&&c.earth} earth pixels`);
  await sleep(3150);const beforeMenu=await page.evaluate(()=>({main:getComputedStyle(mainMenu).display,splash:getComputedStyle(splashScreen).display}));
  ok(beforeMenu.main==='none'&&beforeMenu.splash!=='none','ANT FARM controls do not appear on the studio screen');
  await page.waitForFunction("getComputedStyle(splashScreen).display==='none' && getComputedStyle(mainMenu).display!=='none'",{timeout:5000});
  const menu=await page.evaluate(()=>({labels:[...document.querySelectorAll('.topo-menu-option')].filter(b=>getComputedStyle(b).display!=='none').map(b=>b.querySelector('.topo-menu-label').textContent),selected:[...document.querySelectorAll('.topo-menu-option.is-selected')].map(b=>b.id),started:document.body.classList.contains('game-started')}));
  ok(menu.labels.join('|')==='NEW FARM|LOAD FARM|SETTINGS|CREDITS','the title menu arrives in the approved order with no save',menu.labels.join(' · '));
  ok(menu.selected[0]==='btnMainCreate','the ant selector starts on the first available action',menu.selected.join(','));
  ok(!menu.started,'the startup never enters a farm automatically');
  const frozen1=await page.evaluate(SAMPLE);await sleep(350);const frozen2=await page.evaluate(SAMPLE);
  ok(frozen1&&frozen2&&frozen1.hash===frozen2.hash,'the hidden intro canvas stops spending frames after handoff');
  await page.screenshot({path:'/tmp/antfarm-capturas/intro-topo-aprobada.png'});

  console.log('\n· replay and skip');
  await page.click('#btnMainReplayIntro');await sleep(100);
  ok(await page.evaluate(()=>getComputedStyle(splashScreen).display!=='none'),'REPLAY INTRO returns to Topo Studios');
  const t=Date.now();await page.click('#topoIntroSkip');await page.waitForFunction("getComputedStyle(mainMenu).display!=='none'",{timeout:2500});
  ok(Date.now()-t<2200,'SKIP reaches the title menu immediately',`${Date.now()-t} ms`);
  await page.keyboard.press('r');await sleep(80);ok(await page.evaluate(()=>getComputedStyle(splashScreen).display!=='none'),'the advertised R shortcut also replays the intro');await page.click('#topoIntroSkip');

  console.log('\n· reduced motion');
  const {page:pr,errors:er2}=await open(browser,true);await sleep(120);const r1=await pr.evaluate(SAMPLE);await sleep(420);const r2=await pr.evaluate(SAMPLE);
  ok(r1&&r1.yellow>650&&r1.fur>600,'reduced motion shows the completed studio card, not a blank screen',`hat ${r1&&r1.yellow} · mole ${r1&&r1.fur}`);
  ok(r1&&r2&&r1.hash===r2.hash,'the reduced-motion studio card is completely still');
  await pr.waitForFunction("getComputedStyle(mainMenu).display!=='none'",{timeout:3000});
  ok(await pr.evaluate(()=>!document.body.classList.contains('game-started')),'reduced motion also stops at the title menu');
  ok(errors.length===0&&er2.length===0,'zero JavaScript errors in normal and reduced startup',(errors[0]||er2[0]||'none'));
  await browser.close();server.close();console.log(`\n${pass} ok · ${fail} FALLOS\n`);process.exit(fail?1:0)
})().catch(e=>{console.error('MUERE EL TEST:',e);try{server.close()}catch(_){}process.exit(2)});
