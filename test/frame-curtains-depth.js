/**
 * frame-curtains-depth.js — Chrome contract for the reported 1568×744 deep-zoom leak,
 * the existing voxel depth navigator and the single right-hand curtain.
 *
 * This does not lower camera/test thresholds: it reproduces a 48-column, 125-row connected world,
 * requests the real minimum zoom and measures the projected world/frame edges. It also opens each
 * existing sheet at desktop, portrait and short-landscape sizes; no surrogate controls are created.
 */
const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer');
const ROOT=path.resolve(__dirname,'..'),PORT=8178;
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2'};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let pass=0,fail=0;
const ok=(c,m,d='')=>{if(c){pass++;console.log('  ok   '+m+(d?' · '+d:''));}else{fail++;console.log('  FAIL '+m+(d?' · '+d:''));}};
const server=http.createServer((req,res)=>{
  let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/')p='/ant-farm-rpg/index.html';
  const file=path.join(ROOT,p);if(!file.startsWith(ROOT)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end('nope');return;}
  res.writeHead(200,{'Content-Type':TYPES[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(file).pipe(res);
});
async function boot(page,size,deep=false){
  await page.setViewport(size);await page.goto(`http://127.0.0.1:${PORT}/ant-farm-rpg/index.html`,{waitUntil:'load',timeout:30000});await sleep(450);
  await page.evaluate(deep=>{
    for(const id of ['splashScreen','mainMenu','createSizeScreen','loadScreen','settingsScreen','creditsScreen','onboardingModal','onboardingLegacy','worldGenScreen']){
      const e=document.getElementById(id);if(e){e.style.setProperty('display','none','important');e.style.pointerEvents='none';}
    }
    document.body.classList.add('game-started');topoCreateFreshWorld(48,45);
    if(deep){
      expandWorld(80,true);const ec=entradaCol>=0?entradaCol:CENTER_COL;
      for(let r=SURFACE_ROW;r<ROWS;r++){soil[r][ec]=0;soilType[r][ec]=0;}
      markSoilDirty();refreshExploration(true);view.zoom=getMinZoom();view.y=getPanBounds().maxY;clampView();
    }
    _rulerSig='';updateDepthRuler();renderLoop();
  },deep);await sleep(180);
}
function curtainMeasure(id){
  const c=calendarWidget.getBoundingClientRect(),e=document.getElementById(id).getBoundingClientRect();
  return {cal:{left:c.left,right:c.right,top:c.top,bottom:c.bottom,width:c.width,height:c.height},sheet:{left:e.left,right:e.right,top:e.top,bottom:e.bottom,width:e.width,height:e.height,display:getComputedStyle(document.getElementById(id)).display},
    open:[...document.querySelectorAll('#invSheet,#rosterSheet,#antProfile,#queenProfile')].filter(x=>getComputedStyle(x).display!=='none').map(x=>x.id)};
}
(async()=>{
  await new Promise(r=>server.listen(PORT,'127.0.0.1',r));const browser=await puppeteer.launch({headless:'new',args:['--no-sandbox','--disable-dev-shm-usage']});
  const errors=[];
  try{
    console.log('\n· deep narrow world stays inside the exact reported 1568×744 frame');
    const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
    await boot(page,{width:1568,height:744},true);
    const frame=await page.evaluate(()=>{
      const wr=canvasWrap.getBoundingClientRect(),cv=farmCanvas.getBoundingClientRect(),rr=depthRuler.getBoundingClientRect(),vp=depthViewport.getBoundingClientRect();
      const lines=[...document.querySelectorAll('.depth-line')].map(e=>e.getBoundingClientRect());
      return {W,H,zoom:view.zoom,x:view.x,bounds:getPanBounds(),min:getMinZoom(),wrap:{left:wr.left,right:wr.right,top:wr.top,bottom:wr.bottom,width:wr.width,height:wr.height},canvas:{left:cv.left,right:cv.right,top:cv.top,bottom:cv.bottom,width:cv.width,height:cv.height},
        worldLeft:cv.left+(0-view.x)*view.zoom/VIEW_W*cv.width,worldRight:cv.left+(W-view.x)*view.zoom/VIEW_W*cv.width,
        ruler:{left:rr.left,right:rr.right,width:rr.width,role:depthRuler.getAttribute('role'),max:+depthRuler.getAttribute('aria-valuemax'),now:+depthRuler.getAttribute('aria-valuenow')},
        viewport:{display:getComputedStyle(depthViewport).display,left:vp.left,right:vp.right,height:vp.height},
        lineMin:Math.min(...lines.map(r=>r.left)),lineMax:Math.max(...lines.map(r=>r.right)),overflow:getComputedStyle(canvasWrap).overflowX};
    });
    ok(Math.abs(frame.canvas.left-frame.wrap.left)<.1&&Math.abs(frame.canvas.right-frame.wrap.right)<.1&&Math.abs(frame.canvas.top-frame.wrap.top)<.1&&Math.abs(frame.canvas.bottom-frame.wrap.bottom)<.1,'canvas and game aperture have identical edges',`${frame.canvas.width}×${frame.canvas.height}`);
    ok(frame.zoom+1e-9>=960/frame.W&&frame.worldLeft<=frame.wrap.left+.5&&frame.worldRight>=frame.wrap.right-.5,'minimum zoom covers the frame horizontally; no background gutters',`z ${frame.zoom.toFixed(2)} · projected ${frame.worldLeft.toFixed(1)}…${frame.worldRight.toFixed(1)}`);
    ok(frame.x>=-1e-9&&frame.bounds.minX>=-1e-9,'deep camera crops real world pixels instead of centring a narrow strip',`x ${frame.x} · minX ${frame.bounds.minX}`);
    ok(frame.overflow==='clip'||frame.overflow==='hidden','DOM aperture clips every overlay at the frame edge',frame.overflow);
    ok(frame.ruler.width>=40&&frame.ruler.role==='scrollbar'&&frame.viewport.display==='block'&&frame.viewport.height>=18,'voxel depth rail exposes a visible viewport handle and scrollbar semantics',`${frame.ruler.width}px rail · ${frame.viewport.height.toFixed(1)}px handle`);
    ok(frame.lineMin>=frame.wrap.left-1&&frame.lineMax<=frame.wrap.right+1,'depth guides end at the measured game edge, not an arbitrary off-frame length',`${frame.lineMin.toFixed(1)}…${frame.lineMax.toFixed(1)}`);
    const keys=await page.evaluate(async()=>{depthRuler.focus();const before=view.y;depthRuler.dispatchEvent(new KeyboardEvent('keydown',{key:'Home',bubbles:true,cancelable:true}));const home=view.y;depthRuler.dispatchEvent(new KeyboardEvent('keydown',{key:'End',bubbles:true,cancelable:true}));return{before,home,end:view.y,b:getPanBounds()};});
    ok(keys.home<=keys.before&&Math.abs(keys.home-keys.b.minY)<.01&&Math.abs(keys.end-keys.b.maxY)<.01,'rail keeps Home/End keyboard depth navigation',`${keys.home.toFixed(1)}…${keys.end.toFixed(1)}`);
    await page.close();

    console.log('\n· every existing right sheet is the same curtain under the clock');
    for(const size of [{width:1568,height:744,label:'desktop'},{width:390,height:844,label:'portrait'},{width:844,height:390,label:'short landscape'}]){
      const p=await browser.newPage();p.on('pageerror',e=>errors.push(size.label+': '+e.message));await boot(p,size,false);
      const cases=[['inventory','abrirInventario()','invSheet'],['roster','abrirRoster()','rosterSheet'],['worker profile','showAntProfile(workers[0])','antProfile'],['queen profile','showQueenProfile(queens[0])','queenProfile']];
      for(const [name,open,id] of cases){
        await p.evaluate(open);await sleep(250);const m=await p.evaluate(curtainMeasure,id);
        const same=Math.abs(m.sheet.width-m.cal.width)<.1&&Math.abs(m.sheet.right-m.cal.right)<.1&&Math.abs(m.sheet.top-m.cal.bottom)<.1;
        ok(same,`${size.label}: ${name} shares clock width, right edge and immediate lower edge`,`${m.sheet.width.toFixed(0)}px · top ${m.sheet.top.toFixed(0)}`);
        ok(m.sheet.bottom<=size.height-7.5&&m.sheet.left>=-0.5,`${size.label}: ${name} remains on screen`,`${m.sheet.left.toFixed(0)},${m.sheet.bottom.toFixed(0)}`);
        ok(m.open.length===1&&m.open[0]===id,`${size.label}: ${name} is the only open right sheet`,m.open.join(','));
      }
      if(size.height<=480){const cal=await p.evaluate(()=>calendarWidget.getBoundingClientRect().height);ok(cal===42,'short landscape: clock uses its existing mini presentation before the curtain',cal+'px');}
      await p.close();
    }
    ok(errors.length===0,'browser reports no page errors',errors.join(' | '));
  }finally{await browser.close();server.close();}
  console.log(`\nFRAME · DEPTH · CURTAINS: ${pass} ok · ${fail} fallos`);process.exit(fail?1:0);
})().catch(async e=>{console.error(e);try{server.close();}catch(_){}process.exit(1);});
