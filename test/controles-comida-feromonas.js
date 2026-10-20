#!/usr/bin/env node
/** Explicit map tools, source-labelled food, and finite fungus substrate in a real browser. */
const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer');
const ROOT=path.resolve(__dirname,'..'),PORT=Number(process.env.PORT_TOOLS||8207);
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.json':'application/json'};
const server=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/ant-farm-rpg/index.html';const f=path.join(ROOT,p);if(!f.startsWith(ROOT)||!fs.existsSync(f)){r.writeHead(404);return r.end('nope');}r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(f).pipe(r);});
let pass=0,fail=0;const ok=(c,m,d='')=>{console.log((c?'  ok   ':'  FAIL ')+m+(d?' · '+d:''));c?pass++:fail++;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  await new Promise(r=>server.listen(PORT,'0.0.0.0',r));
  const browser=await puppeteer.launch({headless:'new',args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage();await page.setViewport({width:1440,height:900});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/favicon|AudioContext|autoplay/.test(m.text()))errors.push(m.text());});
  await page.goto(`http://127.0.0.1:${PORT}/ant-farm-rpg/index.html`,{waitUntil:'load',timeout:30000});
  await page.waitForFunction('typeof topoCreateFreshWorld==="function"',{timeout:30000});
  const setup=await page.evaluate(()=>{
    topoCreateFreshWorld(64,45);paused=true;weather.type='clear';weather.intensity=0;
    document.body.classList.add('game-started');const app=document.getElementById('appRoot');if(app)app.style.display='flex';
    ['splashScreen','mainMenu','createSizeScreen','loadScreen','settingsScreen','creditsScreen','onboardingModal','onboardingLegacy','worldGenScreen'].forEach(id=>{const e=document.getElementById(id);if(e)e.style.display='none';});
    const ec=entradaCol>=0?entradaCol:detectarEntrada(),r=SURFACE_ROW+5,c0=Math.max(3,ec-6),c1=Math.min(COLS-4,ec+6);
    for(let rr=SURFACE_ROW;rr<=r;rr++){soil[rr][ec]=0;soilType[rr][ec]=0;}
    for(let c=c0;c<=c1;c++){soil[r][c]=0;soilType[r][c]=0;if(soil[r+1]){soil[r+1][c]=1;if(soilType[r+1])soilType[r+1][c]=1;}}
    markSoilDirty();refreshExploration(true);
    const mid={x:(ec+.5)*CELL,y:(r+.5)*CELL},start={x:(c0+.5)*CELL,y:(r+.5)*CELL},end={x:(c1+.5)*CELL,y:(r+.5)*CELL};
    workers.forEach((w,i)=>{w.x=mid.x+(i%2)*3;w.y=mid.y+(i%2)*2;w.food=null;w.targetFood=null;w.digTarget=null;w.wasteTarget=null;w.state='EXPLORAR';w.fatigue=0;});
    queen.x=mid.x;queen.y=mid.y+CELL*2.5;
    view.zoom=1.45;view.x=mid.x-VIEW_W/view.zoom/2;view.y=mid.y-VIEW_H/view.zoom/2;clampView();renderLoop();
    window.__toolsCase={ec,r,c0,c1,mid,start,end};
    return{workerCount:workers.length,rect:[farmCanvas.getBoundingClientRect().width,farmCanvas.getBoundingClientRect().height],tool:farmCanvas.dataset.mapTool,
      controls:[!!document.getElementById('btnFood'),!!document.getElementById('btnPhero'),!!document.getElementById('btnTbFood')]};
  });
  const point=async key=>page.evaluate(key=>{const p=__toolsCase[key],r=farmCanvas.getBoundingClientRect();return{x:r.left+((p.x-view.x)*view.zoom/VIEW_W)*r.width,y:r.top+((p.y-view.y)*view.zoom/VIEW_H)*r.height};},key);
  const snap=()=>page.evaluate(()=>({amount:foods.reduce((n,f)=>n+(f.amount||0),0),count:foods.length,guides:pheromones.filter(p=>p.type==='guide').length,tool:farmCanvas.dataset.mapTool,hint:document.getElementById('mapHint').textContent}));
  const recenter=()=>page.evaluate(()=>{['splashScreen','mainMenu','createSizeScreen','loadScreen','settingsScreen','creditsScreen','onboardingModal','onboardingLegacy','worldGenScreen'].forEach(id=>{const e=document.getElementById(id);if(e){e.style.setProperty('display','none','important');e.style.pointerEvents='none';}});const p=__toolsCase.mid;view.x=p.x-VIEW_W/view.zoom/2;view.y=p.y-VIEW_H/view.zoom/2;clampView();});

  console.log('\n· herramientas separadas');
  ok(setup.controls[0]&&setup.controls[1]&&!setup.controls[2],'hay un control de miel y otro de feromona, sin duplicado oculto');
  ok(setup.tool==='navigate'&&setup.rect[0]>0&&setup.rect[1]>0,'el mapa arranca en navegación');
  let before=await snap(),pStart=await point('start');
  await page.mouse.click(pStart.x,pStart.y);await sleep(60);let after=await snap();
  ok(after.amount===before.amount&&after.count===before.count,'un click vacío sólo navega/cierra paneles; no crea miel');

  const pAnt=await point('mid');
  await page.evaluate(()=>document.getElementById('btnFood').click());
  await page.mouse.click(pAnt.x,pAnt.y);await sleep(120);after=await snap();
  ok(after.amount===before.amount&&after.tool==='navigate','seleccionar una hormiga cancela miel sin colocarla');
  const profileOpen=await page.evaluate(()=>{const e=document.getElementById('antProfile');return !!e&&getComputedStyle(e).display!=='none';});
  ok(profileOpen,'el mismo click sigue abriendo/seleccionando su perfil');
  await page.mouse.click(pStart.x,pStart.y);await sleep(70);after=await snap();
  ok(after.amount===before.amount,'cerrar un perfil con el mapa tampoco coloca comida');

  await page.evaluate(()=>document.getElementById('btnFood').click());await page.mouse.click(pStart.x,pStart.y);await sleep(70);after=await snap();
  ok(after.amount>before.amount&&after.tool==='navigate','DROP HONEY coloca una vez y vuelve a navegación',`${before.amount} → ${after.amount}`);
  const once=after.amount;await page.mouse.click(pStart.x,pStart.y);await sleep(50);after=await snap();
  ok(after.amount===once,'el siguiente click normal no repite la colocación');

  await page.evaluate(()=>document.getElementById('btnFood').click());before=await snap();
  await page.mouse.click(pStart.x,pStart.y,{button:'right'});await sleep(50);after=await snap();
  ok(after.amount===before.amount&&after.tool==='navigate','click derecho cancela la herramienta sin miel');
  await page.evaluate(()=>document.getElementById('btnFood').click());before=await snap();
  const uiPoint=await page.evaluate(()=>{const r=document.getElementById('btnRoster').getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2};});
  await page.mouse.click(uiPoint.x,uiPoint.y);await sleep(50);after=await snap();
  ok(after.amount===before.amount&&after.tool==='navigate','un click de UI cancela la herramienta y no se propaga al mapa');
  await page.evaluate(()=>{try{cerrarRoster();}catch(e){}document.getElementById('btnFood').click();});
  await page.keyboard.press('Escape');after=await snap();ok(after.tool==='navigate','Escape cancela el estado armado');
  await sleep(320);

  await recenter();pStart=await point('start');let pEnd=await point('end');
  const dragHit=await page.evaluate(({x,y})=>{const e=document.elementFromPoint(x,y);return e&&{tag:e.tagName,id:e.id,cls:e.className};},pStart);
  await page.evaluate(()=>document.getElementById('btnFood').click());before=await snap();
  await page.mouse.move(pStart.x,pStart.y);await page.mouse.down();await page.mouse.move(pEnd.x,pEnd.y,{steps:10});await page.mouse.up();await sleep(70);after=await snap();
  ok(after.amount===before.amount&&after.tool==='honey','arrastrar para mover la cámara no suelta miel',`hit ${JSON.stringify(dragHit)} · ${before.amount}/${before.tool} → ${after.amount}/${after.tool}`);
  await page.keyboard.press('Escape');await recenter();pStart=await point('start');pEnd=await point('end');

  await page.evaluate(()=>document.getElementById('btnPhero').click());before=await snap();
  await page.mouse.move(pStart.x,pStart.y);await page.mouse.down();await page.mouse.move(pEnd.x,pEnd.y,{steps:18});await page.mouse.up();await sleep(80);after=await snap();
  ok(after.amount===before.amount,'dibujar feromona no crea comida');
  ok(after.guides>=5&&after.tool==='navigate','el arrastre deja una senda FOLLOW y termina en navegación',`${after.guides} puntos`);
  const direction=await page.evaluate(()=>{const from={x:__toolsCase.start.x,y:__toolsCase.start.y},p=nearestPhero(from);return p&&{type:p.type,order:p.guideOrder,x:p.x,start:from.x};});
  ok(direction&&direction.type==='guide'&&direction.order>0&&direction.x>direction.start,'la senda llama hacia delante, no deja a la hormiga orbitando el inicio',direction&&`orden ${direction.order}`);
  const guides=after.guides;
  await page.evaluate(()=>document.getElementById('btnPhero').click());const pAnt2=await point('mid');before=await snap();
  await page.mouse.click(pAnt2.x,pAnt2.y);await sleep(100);after=await snap();
  ok(after.guides===guides&&after.amount===before.amount&&after.tool==='navigate','seguir una hormiga cancela feromona sin pintar encima');

  console.log('\n· procedencia real de la comida');
  const pickup=await page.evaluate(()=>{
    const p=__toolsCase.start,a=workers[0];foods.length=0;toasts.length=0;
    // This case is about food provenance, not the founding build. The emergent builder can randomly be
    // workers[0]; finish that fixture first so BUILD_STORE cannot legitimately pre-empt this one tick.
    const s=storageStructure(false);if(s){s.built=true;s.buildProgress=1;s.work=s.workNeeded||STORE_WORK_REQUIRED;}
    a.x=p.x;a.y=p.y;a.food=null;a.targetFood=null;a.digTarget=null;a.wasteTarget=null;a.floodTarget=null;a.state='EXPLORAR';a.fatigue=0;a.health=100;a.blocked=0;delete a.projectCargo;delete a._magmaRetreat;
    const f={x:p.x,y:p.y,amount:2,max:2,r:8,ftype:'mushroom',rot:0,fresh:1,grounded:true};foods.push(f);a.targetFood=f;updateAnt(a,.1);
    return{food:a.food&&{amount:a.food.amount,ftype:a.food.ftype},toast:toasts.map(t=>t.txt).join(' | ')};
  });
  ok(pickup.food&&pickup.food.ftype==='mushroom','la recogida conserva ftype=mushroom');
  ok(/FUNGUS/.test(pickup.toast)&&!/HONEY/.test(pickup.toast),'el bubble de recogida dice FUNGUS, no HONEY',pickup.toast);

  const delivery=await page.evaluate(()=>{
    let s=storageStructure(false);
    // Finish a genuinely connected footprint. A forced `built=true` on closed geometry must not create
    // capacity — that is the STORAGE PRESSURE contract this provenance check now respects.
    if(s){
      const ec=entradaCol>=0?entradaCol:detectarEntrada(),sc=s.c+Math.floor((s.w||3)/2),sr=s.r;
      for(const q of _storeFootprint(s)){soil[q.r][q.c]=0;soilType[q.r][q.c]=0;}
      for(let r=SURFACE_ROW;r<=sr;r++){soil[r][ec]=0;soilType[r][ec]=0;}
      for(let c=Math.min(ec,sc);c<=Math.max(ec,sc);c++){soil[sr][c]=0;soilType[sr][c]=0;}
      s.built=true;s.buildProgress=1;s.work=s.workNeeded||STORE_WORK_REQUIRED;markSoilDirty();refreshExploration(true);
    }
    s=storageStructure(true);reconcileStoragePressure({silent:true});
    economyLedger.setFood(Math.max(0,capacidadAlmacen()-2),'delivery provenance fixture');_syncProtectedLotsWithLedger();
    const p=storagePos(),a=workers[0];toasts.length=0;
    a.x=p.x;a.y=p.y;a.food={amount:1,ftype:'mushroom'};a.targetFood=null;a.digTarget=null;a.wasteTarget=null;a.state='EXPLORAR';a.fatigue=0;a.health=100;a.blocked=0;a._cargaDesde=time-DAY_LENGTH;
    const before=economyLedger.food;updateAnt(a,.1);const hist=economyLedger.history(8),last=hist.filter(x=>x.account==='food'&&x.delta>0).slice(-1)[0];
    return{store:!!s,physical:s&&_storeSiteIsPhysical(s),nodes:storageDeliveryNodes().length,target:storageTargetFor(a),state:a.state,stillFood:!!a.food,delta:economyLedger.food-before,reason:last&&last.reason,toast:toasts.map(t=>t.txt).join(' | '),event:events.filter(e=>e.type==='food').slice(0,2).map(e=>e.title||e.text||'').join(' | ')};
  });
  ok(delivery.store&&delivery.delta===1,'la entrega física acredita exactamente una ración',JSON.stringify(delivery));
  ok(delivery.reason==='worker delivery: mushroom','el ledger conserva la fuente mushroom',delivery.reason||'sin asiento');
  ok(/FUNGUS/.test(delivery.toast)&&!/HONEY/.test(delivery.toast),'el bubble de entrega muestra +1 FUNGUS, no +1 HONEY',delivery.toast);

  console.log('\n· el hongo no fabrica comida de la nada');
  const garden=await page.evaluate(()=>{
    const p=__toolsCase.start,a=workers[0],oldRandom=Math.random;foods.length=0;fungusGardens.length=0;_huertoVotos={};_huertoVotosN=0;
    workers.forEach(w=>{w.food=null;w.state='EXPLORAR';});a.x=p.x;a.y=p.y;economyLedger.setMaterial('fiber',0,'test empty substrate');
    fungusGardens.push({x:p.x,y:p.y,c:Math.floor(p.x/CELL),r:Math.floor(p.y/CELL),health:1,size:2,age:0,fed:0});
    Math.random=()=>0;updateFungus(1000);const empty={fed:fungusGardens[0]&&fungusGardens[0].fed,mushrooms:foods.filter(f=>f.ftype==='mushroom').length};
    fungusGardens[0].fed=1;updateFungus(1000);const fed={fed:fungusGardens[0]&&fungusGardens[0].fed,mushrooms:foods.filter(f=>f.ftype==='mushroom').length,amount:foods.filter(f=>f.ftype==='mushroom').reduce((n,f)=>n+f.amount,0)};
    Math.random=oldRandom;return{empty,fed};
  });
  ok(garden.empty.fed===0&&garden.empty.mushrooms===0,'cuidado sin sustrato: 0 cosecha y fed sigue en 0',JSON.stringify(garden.empty));
  ok(garden.fed.fed===0&&garden.fed.mushrooms===1&&garden.fed.amount>=1,'una unidad de sustrato produce una cosecha física y se consume',JSON.stringify(garden.fed));
  ok(errors.length===0,'cero errores de JavaScript',errors.slice(0,4).join(' | '));

  await page.screenshot({path:'/tmp/antfarm-capturas/controles-comida-feromonas.png'}).catch(()=>{});
  await browser.close();server.close();console.log(`\nCONTROLES/COMIDA: ${pass} ok · ${fail} fallos`);process.exit(fail?1:0);
})().catch(async e=>{console.error('ERROR',e.stack||e);try{await browser?.close();}catch(_){}server.close();process.exit(1);});
