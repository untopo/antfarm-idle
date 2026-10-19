#!/usr/bin/env node
/** Niebla de guerra y viewport lógico medidos en Chrome real. */
const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer');
const ROOT=path.resolve(__dirname,'..'),PORT=Number(process.env.PORT_FOG||8203);
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
    topoCreateFreshWorld(64,45);paused=true;weather.type='clear';weather.intensity=0;time=DAY_LENGTH*.5;
    document.body.classList.add('game-started');const app=document.getElementById('appRoot');if(app)app.style.display='flex';
    ['splashScreen','mainMenu','createSizeScreen','loadScreen','settingsScreen','creditsScreen','onboardingModal','onboardingLegacy','worldGenScreen'].forEach(id=>{const e=document.getElementById(id);if(e)e.style.display='none';});
    const c0=11,r0=24,cc=12,rr=25,ec=entradaCol>=0?entradaCol:detectarEntrada();
    // Anillo 5×5 y bolsa 3×3: el generador no puede darle otra salida por detrás.
    for(let r=r0-1;r<=r0+3;r++)for(let c=c0-1;c<=c0+3;c++){soil[r][c]=1;soilType[r][c]=4;}
    for(let r=r0;r<r0+3;r++)for(let c=c0;c<c0+3;c++){soil[r][c]=0;soilType[r][c]=0;}
    markSoilDirty();refreshExploration(true);view.zoom=1.6;clampView();const initial=getPanBounds();
    // Un pozo conocido llega a la misma cota, pero aún no toca la bolsa.
    for(let r=SURFACE_ROW;r<=rr;r++){soil[r][ec]=0;soilType[r][ec]=0;}
    markSoilDirty();refreshExploration(true);view.zoom=1.6;view.x=0;view.y=rr*CELL-VIEW_H/view.zoom*.60;clampView();
    const shaft=getPanBounds();foods=[{x:(cc+.5)*CELL,y:(rr+.5)*CELL,amount:2,max:2,r:9,ftype:'honey',rot:0,fresh:1,grounded:true}];
    _miniAt=-1e9;renderLoop();updateDepthRuler();
    window.__fogCase={c0,r0,cc,rr,ec};
    const marks=[...document.querySelectorAll('.depth-mark')].map(e=>({depth:+e.dataset.depth,locked:e.dataset.locked,badge:e.querySelector('i')?.textContent,title:e.title}));
    return{initial:initial.maxY,shaft:shaft.maxY,seen:isExploredCell(cc,rr),interactive:canInteractAt((cc+.5)*CELL,(rr+.5)*CELL),marks,
      canvas:[farmCanvas.width,farmCanvas.height],rect:[farmCanvas.getBoundingClientRect().width,farmCanvas.getBoundingClientRect().height]};
  });
  await sleep(250);

  const pixels=()=>page.evaluate(()=>{
    _miniAt=-1e9;renderLoop();const f=__fogCase,g=farmCanvas.getContext('2d');
    const patch=(wx,wy)=>{const bx=(wx-view.x)*view.zoom*(W/VIEW_W),by=(wy-view.y)*view.zoom*(H/VIEW_H),rad=5;
      const d=g.getImageData(Math.max(0,Math.round(bx)-rad),Math.max(0,Math.round(by)-rad),rad*2+1,rad*2+1).data;let sum=0,max=0,alpha=0,n=0;
      for(let i=0;i<d.length;i+=4){const L=d[i]+d[i+1]+d[i+2];sum+=L;max=Math.max(max,L);alpha+=d[i+3];n++;}return{mean:sum/n,max,alpha:alpha/n,bx,by};};
    const mg=document.getElementById('taskbarCanvas').getContext('2d').getImageData(42,34,7,7).data;let mini=0;for(let i=0;i<mg.length;i+=4)mini+=mg[i]+mg[i+1]+mg[i+2];
    return{fog:patch((f.cc+.5)*CELL,(f.rr+.5)*CELL),shaft:patch((f.ec+.5)*CELL,(f.rr+.5)*CELL),mini:mini/(mg.length/4)};
  });
  const hidden=await pixels();
  console.log('\n· antes de abrir la pared');
  ok(setup.canvas[1]===720&&setup.rect[1]>500,'el backing crece a 720 px sin comprimir el viewport lógico',`${setup.canvas.join('×')} → panel ${setup.rect.map(Math.round).join('×')}`);
  ok(setup.shaft>setup.initial,'el pozo conectado amplía el límite de cámara',`${setup.initial.toFixed(1)} → ${setup.shaft.toFixed(1)}`);
  ok(!setup.seen&&!setup.interactive,'la bolsa aislada sigue oculta y no interactiva');
  ok(hidden.fog.max<45&&hidden.shaft.mean>hidden.fog.mean*1.8,'la máscara es opaca sobre comida y cueva, pero no sobre el pozo conocido',`niebla max ${hidden.fog.max.toFixed(0)} · pozo media ${hidden.shaft.mean.toFixed(0)}`);
  ok(setup.marks.some(m=>m.locked==='1')&&setup.marks.filter(m=>m.locked==='1').every(m=>m.badge==='?'&&/unexplored/i.test(m.title)),'la regla sustituye profundidades desconocidas por ?');

  // El click se manda en coordenadas CSS reales, no mediante una llamada interna.
  const point=await page.evaluate(()=>{const f=__fogCase,r=farmCanvas.getBoundingClientRect(),sx=((f.cc+.5)*CELL-view.x)*view.zoom,sy=((f.rr+.5)*CELL-view.y)*view.zoom;return{x:r.left+sx/VIEW_W*r.width,y:r.top+sy/VIEW_H*r.height,before:foods.reduce((a,x)=>a+x.amount,0)};});
  await page.mouse.click(point.x,point.y);await sleep(120);
  const blockedAmount=await page.evaluate(()=>foods.reduce((a,x)=>a+x.amount,0));
  ok(blockedAmount===point.before,'un click real sobre niebla no crea ni selecciona objetos',`${point.before} → ${blockedAmount}`);

  const reveal=await page.evaluate(()=>{
    const f=__fogCase;
    for(let c=Math.min(f.cc,f.ec);c<=Math.max(f.cc,f.ec);c++){soil[f.rr][c]=0;soilType[f.rr][c]=0;}
    markSoilDirty();refreshExploration(true);clampView();_miniAt=-1e9;renderLoop();updateDepthRuler();
    return{seen:isExploredCell(f.cc,f.rr),interactive:canInteractAt((f.cc+.5)*CELL,(f.rr+.5)*CELL),maxY:getPanBounds().maxY};
  });
  await sleep(120);const visible=await pixels();
  console.log('\n· después de abrir una ruta física');
  ok(reveal.seen&&reveal.interactive,'la misma bolsa pasa a conocida sin permiso mágico');
  ok(visible.fog.max>hidden.fog.max*3&&visible.fog.mean>hidden.fog.mean*2,'cueva y comida aparecen al retirar la niebla',`media ${hidden.fog.mean.toFixed(0)} → ${visible.fog.mean.toFixed(0)} · max ${hidden.fog.max} → ${visible.fog.max}`);
  ok(visible.mini>hidden.mini*1.8,'el minimapa también deja de pintar negro al descubrir la celda',`${hidden.mini.toFixed(0)} → ${visible.mini.toFixed(0)}`);
  await page.mouse.click(point.x,point.y);await sleep(80);
  const navigateAmount=await page.evaluate(()=>foods.reduce((a,x)=>a+x.amount,0));
  ok(navigateAmount===blockedAmount,'un click de navegación explorado no crea comida',`${blockedAmount} → ${navigateAmount}`);
  await page.evaluate(()=>document.getElementById('btnFood').click());await page.mouse.click(point.x,point.y);await sleep(120);
  const openAmount=await page.evaluate(()=>foods.reduce((a,x)=>a+x.amount,0));
  ok(openAmount>navigateAmount,'la herramienta explícita sí coloca miel después de explorar',`${navigateAmount} → ${openAmount}`);
  ok(errors.length===0,'cero errores de JavaScript',errors.slice(0,3).join(' | '));

  await page.screenshot({path:'/tmp/antfarm-capturas/niebla-profundidad.png'}).catch(()=>{});
  await browser.close();server.close();console.log(`\nNIEBLA EN CHROME: ${pass} ok · ${fail} fallos`);process.exit(fail?1:0);
})().catch(async e=>{console.error('ERROR',e.stack||e);try{await browser?.close();}catch(_){}server.close();process.exit(1);});
