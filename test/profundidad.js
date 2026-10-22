/** Browser contract for the finite Terraria-style descent and visible Underworld/core. */
const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer');
fs.mkdirSync('/tmp/antfarm-capturas',{recursive:true});
const ROOT=path.resolve(__dirname,'..'),PORT=8182;
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.json':'application/json','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/')p='/ant-farm-rpg/index.html';const f=path.join(ROOT,p);if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end('nope');return;}res.writeHead(200,{'Content-Type':TYPES[path.extname(f)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(f).pipe(res);});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let pass=0,fail=0;
const ok=(c,m,d='')=>{if(c){pass++;console.log('  ok   '+m+(d?' · '+d:''));}else{fail++;console.log('  FAIL '+m+(d?' · '+d:''));}};
(async()=>{
  await new Promise(r=>server.listen(PORT,'127.0.0.1',r));
  const browser=await puppeteer.launch({headless:true,executablePath:process.env.PUPPETEER_EXECUTABLE_PATH||undefined,args:['--no-sandbox','--disable-setuid-sandbox']});
  const page=await browser.newPage();await page.setViewport({width:1280,height:720,deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.goto(`http://127.0.0.1:${PORT}/ant-farm-rpg/index.html`,{waitUntil:'networkidle0',timeout:60000});
    const appReady=await page.evaluate(()=>typeof topoCreateFreshWorld==='function'&&typeof worldDepthProfile==='function');
    if(!appReady)throw new Error('app.js depth API did not load: '+errors.join(' | '));

    console.log('\n· world choice promises complete proportional maps');
    const cards=await page.evaluate(()=>[...document.querySelectorAll('.topo-world-card')].map(x=>({size:x.dataset.size,text:x.innerText.replace(/\s+/g,' ').trim()})));
    ok(cards[0].text.includes('48×84')&&cards[0].text.includes('FULL DEPTH'),'SMALL advertises its real final extent',cards[0].text);
    ok(cards[1].text.includes('64×108')&&cards[2].text.includes('96×144'),'MEDIUM and BIG advertise their real final extents',cards.map(x=>x.text.match(/\d+×\d+/)?.[0]).join(' · '));
    ok(cards.every(x=>/complete descent|full world/i.test(x.text)),'every size explains that geology is complete, not cut short');

    console.log('\n· the real browser world has no intermediate digging wall');
    const sizes=await page.evaluate(()=>[['SMALL',48,28],['MEDIUM',64,36],['BIG',96,48]].map(([name,c,r])=>{
      topoCreateFreshWorld(c,r);paused=true;const p=worldDepthProfile(COLS),initial={rows:ROWS,limit:worldDepthLimit,ratio:worldAreaRatio(),slabs:soilType.flat().filter(t=>t===17).length,umbral:!!umbral};
      while(ROWS<worldDepthLimit)expandWorld(p.chunk,true);
      const core=worldCoreStart(),hell=worldUnderworldStart(),types={magma:0,basalt:0,obsidian:0,core:0};
      for(let rr=hell;rr<ROWS;rr++)for(let cc=0;cc<COLS;cc++){const t=soilType[rr][cc];if(t===15)types.magma++;if(t===14)types.basalt++;if(t===13)types.obsidian++;if(t===19)types.core++;}
      const coreRows=soilType.slice(core).every(row=>row.every(t=>t===19)),mineable=_canExcavateMaterial(19),ec=entradaCol>=0?entradaCol:CENTER_COL;
      for(let rr=SURFACE_ROW;rr<core;rr++){soil[rr][ec]=0;soilType[rr][ec]=0;}markSoilDirty();refreshExploration(true);
      view.zoom=2;view.x=ec*CELL-VIEW_W/view.zoom/2;view.y=1e9;clampView();const bounds=getPanBounds(),atBottom=Math.abs(view.y-bounds.maxY)<.01;renderLoop();
      const cv=document.getElementById('farmCanvas'),img=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;let hot=0,dark=0;
      for(let i=0;i<img.length;i+=64){const red=img[i],green=img[i+1],blue=img[i+2];if(red>150&&green>35&&green<150&&blue<80)hot++;if(red>15&&red<80&&green<35&&blue<45)dark++;}
      return{name,initial,rows:ROWS,openings:umbralesRotos,hell,core,types,coreRows,mineable,atBottom,known:_exploredDeepest,viewY:view.y,maxY:bounds.maxY,hot,dark};
    }));
    for(const s of sizes){
      ok(!s.initial.umbral&&s.initial.slabs===0,s.name+' starts without an intermediate slab');
      ok(s.rows===s.initial.limit&&s.openings===4,s.name+' reaches the final depth in four equal-rule openings',`${s.initial.rows}→${s.rows}`);
      ok(s.types.magma>0&&s.types.basalt>0&&s.types.obsidian>0,s.name+' contains a real Underworld',JSON.stringify(s.types));
      ok(s.coreRows&&!s.mineable,s.name+' ends in a three-row unmineable world core');
      ok(s.atBottom&&s.known>=s.core-1,s.name+' camera scrolls to the physically reached final rows',`${s.viewY.toFixed(0)}/${s.maxY.toFixed(0)}`);
      ok(s.hot>20&&s.dark>20,s.name+' paints visible Underworld heat and dark-red core pixels',`hot ${s.hot} · core ${s.dark}`);
    }

    console.log('\n· reached ants and the final boundary are scrollable and visibly different');
    const visual=await page.evaluate(()=>{
      topoCreateFreshWorld(48,28);paused=true;while(ROWS<worldDepthLimit)expandWorld(worldDepthProfile(COLS).chunk,true);
      const ec=entradaCol>=0?entradaCol:CENTER_COL,core=worldCoreStart();
      for(let r=SURFACE_ROW;r<core;r++){soil[r][ec]=0;soilType[r][ec]=0;}
      markSoilDirty();refreshExploration(true);view.zoom=2;view.x=ec*CELL-VIEW_W/view.zoom/2;view.y=1e9;clampView();
      const before={y:view.y,z:view.zoom,b:getPanBounds()};renderLoop();
      const cv=document.getElementById('farmCanvas'),g=cv.getContext('2d'),img=g.getImageData(0,0,cv.width,cv.height).data;let hot=0,darkRed=0;
      for(let i=0;i<img.length;i+=4){const r=img[i],gg=img[i+1],b=img[i+2];if(r>150&&gg>35&&gg<150&&b<80)hot++;if(r>15&&r<80&&gg<35&&b<45)darkRed++;}
      const wrap=document.getElementById('canvasWrap');wrap.dispatchEvent(new WheelEvent('wheel',{deltaY:-280,bubbles:true,cancelable:true}));const up={y:view.y,z:view.zoom};
      wrap.dispatchEvent(new WheelEvent('wheel',{deltaY:280,bubbles:true,cancelable:true}));const down={y:view.y,z:view.zoom};
      const coreKnown=_exploredDeepest>=core-1,atBottom=Math.abs(before.y-before.b.maxY)<.01;
      return{before,up,down,hot,darkRed,coreKnown,atBottom,core,rows:ROWS,hell:worldUnderworldStart(),coreTypes:[...new Set(soilType[core])],rulerMax:document.querySelector('.depth-ruler').getAttribute('aria-valuemax')};
    });
    ok(visual.coreKnown&&visual.atBottom,'camera reaches the ants and core instead of stopping at an old array edge',`y ${visual.before.y.toFixed(1)} / ${visual.before.b.maxY.toFixed(1)}`);
    ok(visual.up.y<visual.before.y&&visual.down.y>visual.up.y&&visual.up.z===visual.before.z&&visual.down.z===visual.before.z,'ordinary wheel pans vertically without changing zoom',`${visual.before.y.toFixed(0)}→${visual.up.y.toFixed(0)}→${visual.down.y.toFixed(0)}`);
    ok(visual.hot>100&&visual.darkRed>100,'Underworld/core paint produces visible fire and welded dark-red blocks',`hot ${visual.hot} · core ${visual.darkRed}`);
    ok(visual.coreTypes.length===1&&visual.coreTypes[0]===19,'the visible bottom is physical type 19, not canvas background');
    ok(Number(visual.rulerMax)===visual.rows-6-1,'depth ruler grows to the final physical row',visual.rulerMax);
    await page.evaluate(()=>{document.body.classList.add('game-started');for(const el of document.querySelectorAll('.topo-startup-screen,.topo-panel-screen,#onboardingModal,#worldGenScreen'))el.style.display='none';document.getElementById('appRoot').style.display='flex';renderLoop();});
    await page.screenshot({path:'/tmp/antfarm-capturas/underworld-core.png'});

    console.log('\n· browser health');
    ok(errors.length===0,'zero JavaScript errors through all sizes and final-depth rendering',errors.join(' | '));
  }finally{await browser.close();server.close();}
  console.log(`\n${pass} ok · ${fail} FAILURES`);if(fail)process.exit(1);
})().catch(e=>{console.error(e);server.close();process.exit(1);});
