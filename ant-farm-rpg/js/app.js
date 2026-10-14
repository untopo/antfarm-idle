/**
 * ANT FARM - Pixel Real v6.9 · Mundo Vivo
 * Núcleo en migración a arquitectura profesional
 * Estructura target: js/config.js, js/state.js, js/world/*, js/entities/*, js/systems/*, js/render/*, js/ui/*, js/core/*
 * Estado actual: monolítico externalizado (index 33k + css 16k + app 203k) con secciones y caches
 * Performance: soil cache 1 drawImage, UI 7fps, particles cap 240, dt clamp 42ms
 * Ver docs/ARCHITECTURE.md y README.md
 */

/* ===== CORE + VIEW PIXEL ===== */
const canvas=document.getElementById('farmCanvas'), ctx=canvas.getContext('2d');
const wrap=document.getElementById('canvasWrap');
const tbCanvas=document.getElementById('taskbarCanvas'), tbCtx=tbCanvas.getContext('2d');
const nnCanvas=document.getElementById('nnCanvas'), nctx=nnCanvas.getContext('2d');
const chartCanvas=document.getElementById('chartCanvas'), cctx=chartCanvas.getContext('2d');
let W=canvas.width, H=canvas.height;
// ===== PERFORMANCE - capas cacheadas =====
let soilCacheCanvas=null, soilCacheCtx=null, soilCacheDirty=true;
let _soilRev=0; // Topo: version del suelo para cachear escaneos O(celdas)
// === DEBUG: el registro del juego solo habla si se le pide (?debug=1 o localStorage antfarm_debug=1) ===
const DEBUG_TOPO = (()=>{ try{ return /[?&]debug=1/.test(location.search) || localStorage.getItem('antfarm_debug')==='1'; }catch(e){ return false; } })();
function tlog(){ if(!DEBUG_TOPO) return; try{ console.log.apply(console, arguments); }catch(e){} }
window.tlog=tlog; window.DEBUG_TOPO=DEBUG_TOPO;
// _topoDbg(): foto del estado, para consola y para las pruebas de navegador
window._topoDbg=()=>{ try{ return { day:(typeof day!=='undefined'?day:0), time:(typeof time!=='undefined'?time:0),
  ants:(typeof workers!=='undefined'?workers.length:0), cols:(typeof COLS!=='undefined'?COLS:0), rows:(typeof ROWS!=='undefined'?ROWS:0),
  food:(typeof colonyFood!=='undefined'?colonyFood:0), digs:(typeof digs!=='undefined'?digs:0),
  paused:(typeof paused!=='undefined'?paused:null), started: document.body.classList.contains('game-started'),
  queen: (typeof queen!=='undefined'&&queen)? (queen.personalName||queen.name||'reina'):null }; }catch(e){ return {error:e.message}; } };
function initSoilCache(){ const worldW=1024, worldH=576; // 64*16, 36*16 - no usar COLS antes de que exista
 soilCacheCanvas=document.createElement('canvas'); soilCacheCanvas.width=worldW; soilCacheCanvas.height=worldH; const c=soilCacheCanvas.getContext('2d'); if(c) c.imageSmoothingEnabled=false; soilCacheCtx=c; soilCacheDirty=true; }
initSoilCache();
function markSoilDirty(){ soilCacheDirty=true; _soilRev++; }
function bumpSoilRev(){ _soilRev++; }
let lastUIUpdate=0, lastAntListUpdate=0, cachedAntCount=-1;
// Topo 2026-10-14: el bucle moria cada frame con "Cannot set properties of null" porque
// updateColonyUI escribia en ids que el HTML ya no tenia. Un hud ausente no puede matar la
// simulacion: los textos y estilos del HUD pasan por estos helpers tolerantes.
function hudText(id, v){ const el=document.getElementById(id); if(el){ const t=String(v); if(el.textContent!==t) el.textContent=t; } return el; }
function hudStyle(id, prop, v){ const el=document.getElementById(id); if(el && el.style) el.style[prop]=v; return el; }
function hudHtml(id, v){ const el=document.getElementById(id); if(el) el.innerHTML=v; return el; }
function hudValue(id, v){ const el=document.getElementById(id); if(el && el.value!==String(v)) el.value=v; return el; }

function shouldUpdateUI(){ const now=performance.now(); if(now - lastUIUpdate < 140) return false; lastUIUpdate=now; return true; }

// sprites reales pixel - hormigas auténticas
const antSprite = new Image();
antSprite.src = 'assets/pixel-ants-cropped.png?v=20261015f'; // si falta el PNG la hormiga se dibuja a mano (fallback)
let antSpriteReady=false;
antSprite.onload=()=>{ antSpriteReady=true; tlog('ants sprite ready', antSprite.width, antSprite.height); };
antSprite.onerror=()=>{ console.warn('sprite failed'); };
const anthroSprite = new Image();
anthroSprite.src = 'assets/ants-anthro-animated.png?v=20261015f';
let anthroReady=false;
anthroSprite.onload=()=>{ anthroReady=true; tlog('anthro ready', anthroSprite.width, anthroSprite.height); };
anthroSprite.onerror=()=>{ console.warn('anthro failed'); };
const antWalk6 = new Image();
antWalk6.src = 'assets/ant-body-walk-6f.png?v=20261015f';
let antWalk6Ready=false;
antWalk6.onload=()=>{ antWalk6Ready=true; tlog('walk6 ready', antWalk6.width, antWalk6.height); };
antWalk6.onerror=()=>{ console.warn('walk6 failed'); };
const antIdle4 = new Image(); antIdle4.src='assets/ant-idle-4f.png?v=20261015f';
let antIdleReady=false; antIdle4.onload=()=>{ antIdleReady=true; tlog('idle4 ready',antIdle4.width,antIdle4.height); };
const antDig4 = new Image(); antDig4.src='assets/ant-dig-4f.png?v=20261015f';
let antDigReady=false; antDig4.onload=()=>{ antDigReady=true; tlog('dig4 ready',antDig4.width,antDig4.height); };
const antRest2 = new Image(); antRest2.src='assets/ant-rest-2f.png?v=20261015f';
let antRestReady=false; antRest2.onload=()=>{ antRestReady=true; tlog('rest2 ready',antRest2.width,antRest2.height); };
const queenSprite = new Image(); queenSprite.src='assets/queen-2f.png?v=20261015f';
let queenSpriteReady=false; queenSprite.onload=()=>{ queenSpriteReady=true; tlog('queen ready',queenSprite.width,queenSprite.height); };
const FOOD_DEFS={
  honey:{rotDays:99, color:'#ffb700', cap:'#ffcc33', name:'MIEL'},
  berry:{rotDays:1.4, color:'#6a1a7a', cap:'#a83ac2', name:'BAYA'},
  mushroom:{rotDays:1.7, color:'#d68a4a', cap:'#c27a3a', name:'HONGO'},
  apple:{rotDays:2.1, color:'#d91e1e', cap:'#ff6b6b', name:'MANZANA'},
  seed:{rotDays:99, color:'#c2a080', cap:'#8b5a2b', name:'SEMILLA'},
  grassSeed:{rotDays:99, color:'#7ad35f', cap:'#3a9d23', name:'GRANA'}
};
function isFoodInStockpile(f){
  // DF: solo lo que está en despensa/granero no se pudre (conserva)
  // Topo (regla que debe valer en CADA tamaño): contar como "almacenada" exige que la celda esté cavada.
  // Miel dentro de tierra intacta está ENTERRADA, no guardada: no alimenta la reserva y sigue pudriéndose.
  const _fc=Math.floor(f.x/CELL), _fr=Math.floor(f.y/CELL);
  if(Array.isArray(soil) && soil.length && _fr>=SURFACE_ROW && soil[_fr] && soil[_fr][_fc]===1) return false;
  const inPantry = Math.hypot(f.x - pantryPos.x, f.y - pantryPos.y) < 42;
  if(inPantry) return true;
  for(let s of structures){ if(s.type==='granary'){
    const x=s.c*CELL, y=s.r*CELL, w=s.w*CELL, h=s.h*CELL;
    if(f.x>=x-8 && f.x<=x+w+8 && f.y>=y-6 && f.y<=y+h+6) return true;
  }}
  return false;
}
function foodRotProgressPerDt(food, dt){
  const def=FOOD_DEFS[food.ftype||'honey']||FOOD_DEFS.honey;
  if(def.rotDays>=90) return 0;
  const preserved=isFoodInStockpile(food);
  const mult = preserved ? 0.12 : 1.0; // en almacén 8x más lento (DF stockpile)
  return dt / (def.rotDays * DAY_LENGTH) * mult; // 86400 = DAY_LENGTH Terraria 24min? usamos 72000 por compat, ajustado abajo
}

let useAnthro=false; // al inicio hormigas comunes, con evolución se vuelven antropomorfas
const anthroAlt1 = new Image(); anthroAlt1.src='assets/ants-humanlike-1-thumb.png?v=20261015f';
const anthroAlt2 = new Image(); anthroAlt2.src='assets/ants-humanlike-3-thumb.png?v=20261015f';
let anthroStyle=0; // 0=4-roles sheet, 1=chibi blue, 2=human hoodie
function cycleAnthroStyle(){
  anthroStyle=(anthroStyle+1)%3;
  if(anthroStyle===0) anthroSprite.src='assets/ants-anthro-animated.png?v=20261015f';
  else if(anthroStyle===1) anthroSprite.src='assets/ants-humanlike-1.png?v=20261015f';
  else anthroSprite.src='assets/ants-humanlike-3.png?v=20261015f';
  console.log('anthro style', anthroStyle);
  pushToast(W/2, H/2, '👤 ESTILO '+(anthroStyle+1), '#b47aff');
}
function checkAnthroEvo(){
  // realista: humanoide no sale en GEN2 instantáneo - requiere generaciones, tiempo y trabajo acumulado
  const shouldAnthro = gen>=5 && colonyIQ>138 && workers.length>=9 && time > DAY_LENGTH*3.1 && deliveries>=48 && digs>=22;
  if(shouldAnthro && !useAnthro){
    useAnthro=true;
    const btn=document.getElementById('btnAnthro');
    if(btn){ btn.textContent='👤 ANTHRO'; btn.style.background='#b47aff'; }
    pushToast(W/2, H/2-20, '👤 ¡Evolución humanoide!', '#b47aff');
  }
}
setTimeout(()=>{
  const btn=document.getElementById('btnAnthro');
  if(btn) btn.onclick=()=>{
    // toggle antropomorfo / original, y si ya es antropomorfo, cicla estilos
    if(!useAnthro){ useAnthro=true; btn.textContent='👤 ANTHRO'; btn.style.background='#b47aff'; }
    else {
      // si ya está en anthro, ciclar estilo en vez de desactivar - requiere doble click para desactivar
      if(btn.dataset.cycle==='1'){ useAnthro=false; btn.textContent='🐜 CLASSIC'; btn.style.background='#2a2012'; btn.dataset.cycle='0'; }
      else { cycleAnthroStyle(); btn.dataset.cycle='1'; setTimeout(()=>btn.dataset.cycle='0', 1200); }
    }
  };
}, 600);


let COLS=64, ROWS=36, CELL=16, SURFACE_ROW=6, SURFACE_Y=SURFACE_ROW*CELL, CENTER_COL=Math.floor(COLS/2);

let view={x:205,y:12,zoom:1.38}; // offset para no quedar bajo calendario 168x257 (centro visible)
let showEyes=true, showTrail=true, showInk=true, showFront=true;
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function getMinZoom(){
  const el=document.getElementById('canvasWrap');
  if(!el || !el.clientWidth || !el.clientHeight) return 1.0;
  const fitW = el.clientWidth / W;
  const fitH = el.clientHeight / H;
  const contain = Math.min(fitW, fitH);
  const min = contain < 1 ? contain : 1;
  let base = Math.max(0.5, Math.min(1, min));
  return base;
}
function clampView(){
  if(!isFinite(view.x)) view.x=0; if(!isFinite(view.y)) view.y=0; if(!isFinite(view.zoom)) view.zoom=1.45;
  const vw = W/view.zoom, vh = H/view.zoom;
  let minX, maxX, minY, maxY;
  if(vw > W){ const cx=(W - vw)/2; minX=maxX=cx; } else { minX=0; maxX=W - vw; }
  // Topo fix bordes: horizontal estrictamente dentro del mundo (sin margen azul/negro), vertical con cielo extra pero sin vacío bajo piedras
  if(vh > H){ minY=-H*0.62; maxY=0; } else { minY=-H*0.42; maxY=H - vh; }
  // Sin expansión por calendario en X para no mostrar vacío sin textura; Y ya cubre cielo con sky -H*1.8
  view.x=clamp(view.x, minX, maxX);
  view.y=clamp(view.y, minY, maxY);
}
function getPanBounds(){
  const vw=W/view.zoom, vh=H/view.zoom;
  let minX,maxX,minY,maxY;
  if(vw>W){ const cx=(W-vw)/2; minX=maxX=cx; } else { minX=0; maxX=W-vw; }
  if(vh>H){ minY=-H*0.62; maxY=0; } else { minY=-H*0.42; maxY=H - vh; }
  return {minX,maxX,minY,maxY};
}
window.addEventListener('resize', ()=>{ clampView(); updateZoomLabel(); });
function screenToWorld(sx,sy){return {x:view.x+sx/view.zoom, y:view.y+sy/view.zoom};}
function setZoom(nz,sx,sy){
  const minZ=getMinZoom();
  nz=clamp(nz, minZ, 3.2);
  if(sx===undefined){sx=W/2; sy=H/2;}
  const before=screenToWorld(sx,sy);
  view.zoom=nz;
  const after=screenToWorld(sx,sy);
  view.x+=before.x-after.x; view.y+=before.y-after.y;
  clampView(); updateZoomLabel();
}
function updateZoomLabel(){hudText('zoomLabel', Math.round(view.zoom*100)+'%');}
const DAY_LENGTH = 72000; // 20 min reales (Minecraft: 24000 ticks -> 20min) a 60 time/s
let gameSpeed=1, turbo=false, time=DAY_LENGTH*0.28, paused=false, taskbarMode=false, mouse={x:W/2,y:SURFACE_Y-10};
let deliveries=0, digs=0, accidents=0, rewardsFound=0, gen=0, mutations=0, commsCount=0;
let colonyFood=0, colonyFitness=0, colonyIQ=100; let lastCoup=0;
let selectedAntIndex=0;
let selectedQueenIndex=0;
let stats={nivel:1,xp:0,xpToNext:360}; // realista: GEN cuesta trabajo, no 2 entregas
let foods=[], pheromones=[], particles=[], mound=[], hiddenRewards=[], events=[];
let commInks=[], toasts=[];
let soil=[];
let water=[]; // agua por celda 0-1 (Topo pidió física realista)
let decoSet=new Set(); // celdas decoradas por arquitectas (clave numerica dkey(c,r), nada de cadenas por celda)
function dkey(c,r){ return (r<<12)|c; }
function hasDeco(c,r){ return decoSet.size>0 && decoSet.has(dkey(c,r)); }
// === MUNDO VIVO EXTERIOR ===
let soilType=[]; // 0 vacío, 1 topsoil, 2 arcilla, 3 arena, 4 piedra
let fertility=[]; // por columna 0-1
let plants=[]; // vegetación exterior
let worldMaterials={stone:0, clay:0, sand:0, fiber:0, wood:0};
// inventos desbloqueables cuando son inteligentes
let inventions={stone:false, clay:false, fiber:false, wood:false, fungus:false, masonry:false};

function getInventionReq(name){
  const reqs={stone:'GEN≥3 IQ≥124 digs≥18', clay:'GEN≥4 IQ≥128 digs≥28', fiber:'GEN≥4 IQ≥132 plantas≥8', wood:'GEN≥5 IQ≥138 mundo>2.0', fungus:'GEN≥5 IQ≥140 hongo', masonry:'GEN≥6 IQ≥145 stone+clay'};
  return reqs[name]||'-';
}

let worldAge=0;
// === ESTRUCTURAS COMPLEJAS Y HERRAMIENTAS ===
let structures=[]; // {c,r,type,w,h,builtBy,age}
const STRUCTURE_DEFS={
  workshop:{w:2,h:2, need:{wood:3, stone:2}, iq:135, gen:4, name:'TALLER', color:'#8a6a3a', bonus:'fabrica herramientas'},
  granary:{w:3,h:2, need:{clay:2, fiber:2}, iq:132, gen:4, name:'GRANERO', color:'#c2a080', bonus:'+12 almacén'},
  bridge:{w:3,h:1, need:{wood:2, fiber:1}, iq:130, gen:4, name:'PUENTE', color:'#6b4a1f', bonus:'cruza huecos'},
  tower:{w:2,h:3, need:{stone:4, wood:2}, iq:142, gen:5, name:'TORRE', color:'#7a7a7a', bonus:'vigía'},
};
const TOOL_DEFS={
  pick:{need:{stone:2}, iq:126, gen:3, name:'PICO', bonusDig:0.34, icon:'⛏'},
  basket:{need:{fiber:2}, iq:128, gen:3, name:'CESTA', bonusCarry:1, icon:'🧺'},
  trowel:{need:{clay:1, stone:1}, iq:132, gen:4, name:'PALETA', bonusBuild:0.28, icon:'🪝'},
};

function initSoil(){
  soil=Array.from({length:ROWS},(_,r)=>Array.from({length:COLS},(_,c)=> r<SURFACE_ROW?0:1));
  water=Array.from({length:ROWS},()=>Array(COLS).fill(0));
  soilType=Array.from({length:ROWS},(_,r)=>Array.from({length:COLS},(_,c)=>{
    if(r<SURFACE_ROW) return 0;
    const depth=r-SURFACE_ROW;
    // progresivo strata: cuanto más profundo, más duro (pickaxe power)
    if(depth<3) return 1; // 1 topsoil fértil - pico cobre, 1 hit
    if(depth<8) return 2; // 2 arcilla - 2 hits, necesita excavadora
    if(depth<14) return 3; // 3 arena clara - 1 hit pero GRAVEDAD: cae si sin apoyo (arena inestable)
    if(depth<22) return 4; // 4 piedra - 3 hits, necesita IQ/tools
    if(depth<30) return 4; // 4 piedra profunda - 4 hits
    if(depth<38) return 6; // 6 pizarra - 5 hits, requiere piedra+arcilla tools
    return 7; // 7 bedrock - casi irrompible (solo GEN10+IQ150+masonry)
  }));
  const cc=CENTER_COL;
  // pozo inicial
  carveRect(cc-1,SURFACE_ROW,3,7);
  carveRect(cc-1,SURFACE_ROW+7,3,2);
  // fertilidad por columna
  fertility=Array.from({length:COLS},()=>0.48+Math.random()*0.36);
  plants=[];
  // pradera inicial: treboles y flores dispersas
  for(let c=4;c<COLS-4;c++){
    if(soil[SURFACE_ROW][c]===1 && soil[SURFACE_ROW+1][c]===1 && Math.random()<0.20){
       const r=Math.random();
       let type='clover';
       if(r<0.42) type='clover';
       else if(r<0.72) type='flowerY';
       else if(r<0.88) type='flowerW';
       else type='grassTuft';
       plants.push({c, x:c*CELL+4+Math.random()*8, y:SURFACE_Y-6, type, growth:0.35+Math.random()*0.45, maxGrowth:1, age:Math.random()*DAY_LENGTH*0.25, fruitCooldown: Math.random()*0.3*DAY_LENGTH, variant: Math.floor(Math.random()*3)});
    }
  }
  hiddenRewards=[];
  // === TESOROS INTELIGENTES - Topo pidió más y random ===
  const TREASURE_DEFS = {
    semillas: {food:10, mat:null, w:22, color:'#ffcc00', msg:'¡SEMILLAS! +10 comida', tier:1},
    agua: {food:0, mat:null, fatigue:30, w:20, color:'#00e5ff', msg:'¡AGUA! fatiga restaurada', tier:1},
    hongo: {food:6, mat:null, w:18, color:'#2de67a', msg:'¡HONGO! +6 comida', tier:1},
    fibra: {food:2, mat:'fiber', matAmt:2, w:14, color:'#c9b896', msg:'¡FIBRA! +2 fibra', tier:2},
    piedra: {food:0, mat:'stone', matAmt:2, w:12, color:'#8a8a8a', msg:'¡PIEDRA! +2 piedra', tier:2},
    arcilla: {food:0, mat:'clay', matAmt:1, w:10, color:'#a08060', msg:'¡ARCILLA! +1 arcilla', tier:2},
    ambar: {food:0, mat:null, xp:80, w:6, color:'#ffb700', msg:'¡ÁMBAR! +80 XP', tier:3},
    semillaRara: {food:14, mat:'fiber', matAmt:1, w:7, color:'#b47aff', msg:'¡SEMILLA RARA! +14 comida', tier:3},
    hongoCueva: {food:8, mat:null, w:8, color:'#6b3a1f', msg:'¡HONGO CUEVA! +8 comida', tier:2},
  };
  function pickTreasureType(depthTier){
    // depthTier 0-2 (0 shallow <10, 1 mid 10-20, 2 deep >20)
    // pesos por gen/IQ
    const prog = (typeof gen!=='undefined'?gen:0) + (typeof colonyIQ!=='undefined'? colonyIQ-100:0)/40;
    let pool=[];
    if(depthTier===0) pool=['semillas','agua','hongo','fibra'];
    else if(depthTier===1) pool=['semillas','hongo','fibra','piedra','arcilla','hongoCueva'];
    else pool=['piedra','arcilla','ambar','semillaRara','hongoCueva','fibra'];
    // tier 3 solo si prog >=3
    if(prog<2) pool=pool.filter(t=> TREASURE_DEFS[t].tier<3);
    if(prog<1) pool=pool.filter(t=> TREASURE_DEFS[t].tier<2);
    // FIX 2026-10-15: con colonia novata el pool profundo quedaba VACIO -> type undefined ->
    // spawnSmartTreasure no contaba el acierto y sembraba hasta 200 cofres vacíos.
    if(!pool.length) pool=['semillas','agua','hongo','fibra'];
    // pesos
    const weights = pool.map(t=>{
      let w=TREASURE_DEFS[t].w;
      if(t==='ambar' && depthTier===2) w*=1.6;
      if(t==='semillaRara' && depthTier===2) w*=1.4;
      return w;
    });
    const tot=weights.reduce((a,b)=>a+b,0);
    let r=Math.random()*tot; for(let i=0;i<pool.length;i++){ r-=weights[i]; if(r<=0) return pool[i]; }
    return pool[0];
  }
  function isValidTreasurePos(c,r){
    if(c<4||c>=COLS-4||r<SURFACE_ROW+4||r>=ROWS-3) return false;
    if(!soil[r]||soil[r][c]!==1) return false;
    // no muy cerca de otro tesoro - Topo: la separación mínima sigue la escala del mapa
    const _minD=Math.max(3, Math.min(7, Math.round(5*Math.sqrt(worldAreaRatio()))));
    for(let tr of hiddenRewards){ if(Math.hypot(tr.c-c,tr.r-r)<_minD) return false; }
    // no en cámara inicial (centro)
    if(Math.hypot(c-CENTER_COL, r-(SURFACE_ROW+3))<6) return false;
    return true;
  }
  function spawnSmartTreasure(c,r,forcedType){
    if(!isValidTreasurePos(c,r)) return null;
    const depth=r-SURFACE_ROW;
    const tier = depth<10?0 : depth<20?1 : 2;
    const type=forcedType||pickTreasureType(tier);
    hiddenRewards.push({c,r,type,found:false,x:c*CELL+8,y:r*CELL+8, depthTier:tier});
    return true; // siempre truthy: el contador de colocados debe subir aunque el tipo caiga raro
  }
  function spawnInitialTreasures(){
    hiddenRewards=[];
    let attempts=0, placed=0;
    // Topo: 10-13 en el terreno de referencia (64x36); en 48x28 caben menos y en 96x48 más
    const target = Math.max(4, Math.min(28, Math.round((10 + Math.floor(Math.random()*4)) * worldAreaRatio())));
    const _maxAttempts = Math.max(60, Math.min(200, target*14));
    while(placed<target && attempts<_maxAttempts){
      const c=4+Math.floor(Math.random()*(COLS-8));
      const r=SURFACE_ROW+5+Math.floor(Math.random()*(ROWS-SURFACE_ROW-9));
      if(spawnSmartTreasure(c,r)) placed++;
      attempts++;
    }
    // garantizar al menos 1 fácil cerca del inicio para onboarding
    if(!hiddenRewards.some(t=> Math.hypot(t.c-CENTER_COL,t.r-(SURFACE_ROW+6))<10)){
      const c=CENTER_COL+ (Math.random()<0.5? 7: -7);
      const r=SURFACE_ROW+7;
      if(isValidTreasurePos(c,r)) spawnSmartTreasure(c,r,'semillas');
    }
    tlog('[TESORO] inicial', hiddenRewards.length, hiddenRewards.map(t=>t.type+':'+t.c+','+t.r).join(' | '));
  }
  spawnInitialTreasures();
  // exponer para debug
  window._spawnTreasure=(c,r,t)=>spawnSmartTreasure(c,r,t);
  window._treasures=()=>hiddenRewards.map(t=>({c:t.c,r:t.r,type:t.type,found:t.found}));
  markSoilDirty();
}
function carveRect(c,r,w,h){for(let y=r;y<r+h;y++)for(let x=c;x<c+w;x++)if(y>=0&&y<ROWS&&x>=0&&x<COLS){soil[y][x]=0; if(soilType[y]) soilType[y][x]=0; markSoilDirty();}}

// === ARQUITECTURA REAL DE HORMIGAS - cámaras modulares como Pogonomyrmex/Solenopsis/Odontomachus ===
function excavateChamber(centerC, centerR, w, h, ant){
  // planta ovalada (como cámaras reales: discos aplanados 2.69cm alto, más ancho que alto)
  const rx=Math.floor(w/2), ry=Math.floor(h/2);
  let carved=0;
  for(let dy=-ry; dy<=ry; dy++) for(let dx=-rx; dx<=rx; dx++){
    const nc=centerC+dx, nr=centerR+dy;
    if(nc<0||nc>=COLS||nr<SURFACE_ROW||nr>=ROWS) continue;
    // forma ovalada con bordes rugosos (no rectángulo perfecto)
    const nx=dx/(rx+0.6), ny=dy/(ry+0.6);
    if(nx*nx+ny*ny > 1+ (Math.random()*0.18-0.09)) continue;
    if(soil[nr][nc]===1){
      // dureza según tipo, si es muy duro y no tienen pico, no puede
      const t=soilType[nr][nc];
      if(t===7 && gen<7) continue;
      soil[nr][nc]=0; soilType[nr][nc]=0; carved++;
    }
  }
  if(carved>0){
    markSoilDirty();
    // deja un túnel de acceso vertical de 1 de ancho si no existe
    for(let r=centerR-ry-2; r<centerR; r++){
      if(r>=SURFACE_ROW&&r<ROWS&&centerC>=0&&soil[r][centerC]===1 && Math.random()<0.55){
        // no carvar todo, solo conectar
        if(soil[r-1][centerC]===0 || soil[r][centerC-1]===0 || soil[r][centerC+1]===0) break;
      }
    }
    // acumula material suelto
    if(ant && ant.traits.construccion>50) worldMaterials.sand+=Math.floor(carved*0.12);
    return carved;
  }
  return 0;
}

function carveOval(cx,cy,rx,ry){for(let y=cy-ry;y<=cy+ry;y++)for(let x=cx-rx;x<=cx+rx;x++){if(y<0||y>=ROWS||x<0||x>=COLS)continue;const dx=(x-cx)/rx,dy=(y-cy)/ry;if(dx*dx+dy*dy<=1){soil[y][x]=0; if(soilType[y]) soilType[y][x]=0; markSoilDirty();}}}
// === EXPANSIÓN DE MUNDO TERRARIA/STARBOUND - mapa más profundo si la colonia puede ===
// Como Terraria Small 4200x1200 → Large 8400x2400, tu granja empieza 64x36 y puede crecer 96x120 si cavan profundo
function expandWorld(addRows){
  const oldRows=ROWS;
  const newRows=ROWS+addRows;
  // expandir soil y soilType
  for(let r=oldRows;r<newRows;r++){
    const depth=r-SURFACE_ROW;
    let type=4;
    if(depth<30) type=4;
    else if(depth<38) type=6;
    else if(depth<50) type=6;
    else type=7; // bedrock muy profundo
    soil.push(Array(COLS).fill(1));
    soilType.push(Array.from({length:COLS},()=>type));
    // vetas aleatorias de arcilla/piedra dura
    for(let c=0;c<COLS;c++) if(Math.random()<0.04) soilType[r][c]= (Math.random()<0.5?2:6);
  }
  ROWS=newRows;
  // expandir canvas cache
  try{
    soilCacheCanvas.height=ROWS*CELL; soilCacheCanvas.width=COLS*CELL;
    markSoilDirty(); markSoilDirty();
  }catch(e){}
  // worldH es ROWS*CELL implícito, no tocar H (canvas) - la cámara usa ROWS*CELL directamente
  pushEvent('evo',`🌍 Mundo expandido +`+addRows+` filas → `+ROWS+` profundidad`, `progresivo: más profundo = más duro y más recompensas`);
  notifyCanon('🌍 MAPA MÁS PROFUNDO', `El mundo crece a `+ROWS+` filas - las excavadoras llegaron al fondo`, 5200);
  // revelar recompensas más profundas si hay
}

function isSoilSupported(r,c){
  if(r>=ROWS-1) return true;
  if(soil[r+1][c]===1) return true; // apoyo directo
  // apoyo diagonal (arco)
  if(c>0 && soil[r+1][c-1]===1) return true;
  if(c<COLS-1 && soil[r+1][c+1]===1) return true;
  // arco horizontal: ambos lados sólidos y tiene techo arriba -> bóveda
  if(c>0 && c<COLS-1 && soil[r][c-1]===1 && soil[r][c+1]===1 && r>SURFACE_ROW && soil[r-1][c]===1) return true;
  // estructuras cuentan como apoyo
  for(let s of structures){ if(c>=s.c&&c<s.c+s.w && r+1>=s.r&&r+1<s.r+s.h) return true; }
  // dejar que el suelo superficial aguante aunque no haya nada debajo si es el borde de cámara pequeña (evita derrumbe total)
  // pero si está aislado en aire sin nada, cae
  return false;
}
function updateFallingSand(dt){
  // Terraria/Starbound + Dwarf Fortress: todo suelo suelto cae si no tiene apoyo (no solo arena)
  // - tipo 3 (arena) 100% cae
  // - tipo 1 (topsoil) 42% cae si sin apoyo (más cohesivo)
  // - tipo 2 (arcilla) 18% cae (se apisona con fibra)
  // - tipo 4 (piedra) solo cae si es bloque aislado sin arco (derrumbes)
  // - pizarra/bedrock nunca caen
  const grav = Math.max(0.22, Math.min(1, dt*0.18));
  for(let r=ROWS-2;r>=SURFACE_ROW;r--){
    for(let c=0;c<COLS;c++){
      if(soil[r][c]!==1) continue;
      const t=soilType[r][c];
      if(t===6 || t===7) continue; // pizarra/bedrock nunca
      if(soil[r+1][c]===0 && !isSoilSupported(r,c)){
        let chance=0;
        if(t===3) chance=0.99; // arena siempre cae (arena inestable)
        else if(t===1) chance=0.42;
        else if(t===2) chance=0.18;
        else if(t===4) chance=0.08; // piedra solo bloques sueltos
        else chance=0.35;
        if(Math.random() < chance*grav){
          let nr=r+1; while(nr<ROWS-1 && soil[nr+1][c]===0) nr++;
          if(nr!==r){
            soil[r][c]=0; const oldT=soilType[r][c]; soilType[r][c]=0;
            if(soil[nr][c]===0){ soil[nr][c]=1; soilType[nr][c]=oldT; }
            else {
              // si destino ocupado por algo, intentar diagonal (deslizamiento de pila)
              let placed=false;
              for(let dc of [-1,1]){ const nc=c+dc; if(nc>=0&&nc<COLS&&soil[nr][nc]===0){ soil[nr][nc]=1; soilType[nr][nc]=oldT; placed=true; break; } }
              if(!placed){ soil[r][c]=1; soilType[r][c]=oldT; continue; }
            }
            markSoilDirty();
            if(Math.random()<0.18) particles.push({x:c*CELL+8,y:r*CELL+8,vx:(Math.random()-0.5)*0.7,vy:0.9,life:0.7,decay:0.04,color: t===3?'#c2b280': t===2?'#a08060':'#8b5a3c'});
            // daño a hormigas debajo (Terraria sufocación)
            for(let w of workers){ if(Math.abs(w.x - c*CELL-8)<12 && Math.abs(w.y - nr*CELL)<14){ w.health-=2; w.mood.fear=Math.min(1,w.mood.fear+0.22); }}
          }
        }
      }
    }
  }
}
function updateSoilPhysics(dt){ updateFallingSand(dt); }

// === RULER ADAPTATIVO A CÁMARA - Terraria Depth Meter ===

    // Click/drag en la regla como scrollbar de página
    (function(){
      const ruler=document.querySelector('.depth-ruler');
      if(!ruler || ruler._hasDrag) return;
      ruler._hasDrag=true;
      let dragging=false;
      function yToWorld(clientY){
        const rect=ruler.getBoundingClientRect();
        const pct=(clientY-rect.top)/rect.height;
        const worldY=pct*ROWS*CELL;
        return worldY - (typeof H!=='undefined'?H:576)/(view.zoom||1)/2;
      }
      ruler.addEventListener('mousedown',e=>{ dragging=true; view.y=yToWorld(e.clientY); clampView(); updateDepthRuler(); e.preventDefault(); });
      window.addEventListener('mousemove',e=>{ if(dragging){ view.y=yToWorld(e.clientY); clampView(); updateDepthRuler(); }});
      window.addEventListener('mouseup',()=>{ dragging=false; });
      ruler.addEventListener('click',e=>{
        if(e.target.classList.contains('depth-mark')) return; // ya manejado
        view.y=yToWorld(e.clientY); clampView(); updateDepthRuler();
      });
      ruler.addEventListener('wheel',e=>{
        view.y += e.deltaY*1.4/(view.zoom||1); clampView(); updateDepthRuler(); e.preventDefault();
      }, {passive:false});
    })();

let _rulerEl=null, _rulerSig='';
function updateDepthRuler(){
  try{
    if(!_rulerEl || !_rulerEl.isConnected) _rulerEl=document.querySelector('.depth-ruler');
    const ruler=_rulerEl;
    if(!ruler) return;
    // Topo: leer/limpiar estilos cada frame provocaba relayout 60 veces por segundo.
    // Las marcas solo se mueven si se mueve la camara, el zoom o el tamano del mundo.
    const _sig=(view.y|0)+'|'+((view.zoom||1)*100|0)+'|'+ROWS+'|'+(typeof window!=='undefined'?window.innerWidth:0);
    if(_rulerSig===_sig) return;
    _rulerSig=_sig;
    // limpiar y crear marcas discretas a ras de suelo, no barra flotante cielo-infierno
    // niveles: 0 superficie, -5, -10, -15, -25, -35 (como pediste: 0____ -5 -10)
    const levels=[0,5,10,15,25,35];
    const names=['0 SUPERFICIE','-5 ARCILLA','-10 ARENA','-15 PIEDRA','-25 PIZARRA','-35 BEDROCK'];
    const cols=['#7ec8e3','#ffcc00','#c2b280','#8a8a8a','#6b4a2b','#2a0a0a'];
    // asegurar marcas existen
    levels.forEach((d,i)=>{
      let el=ruler.querySelector('.depth-mark-'+i);
      if(!el){
        el=document.createElement('div'); el.className='depth-mark depth-mark-'+i;
        el.innerHTML='<i>'+(d===0?'0': '-'+d)+'</i>';
        el.title='Ir a profundidad '+d+' ('+names[i]+')';
        el.onclick=()=>{ // click como scrollbar
          const targetY = SURFACE_Y + d*CELL - (typeof H!=='undefined'?H:576)/(view.zoom||1)/2;
          view.y = Math.max(0, Math.min(ROWS*CELL - (typeof H!=='undefined'?H:576)/(view.zoom||1), targetY));
          clampView(); updateDepthRuler();
        };
        ruler.appendChild(el);
        const line=document.createElement('div'); line.className='depth-line depth-line-'+i;
        ruler.appendChild(line);
      }
      // posición según profundidad real en el mundo, adaptada a cámara (como Terraria)
      const worldY = SURFACE_Y + d*CELL;
      // convertir a posición en ruler: ruler representa todo el mundo (0..ROWS*CELL), no solo viewport
      const totalH = ROWS*CELL;
      const pct = worldY/totalH;
      const rulerH = ruler.clientHeight||720;
      const y = pct*rulerH - 11;
      const lineEl=ruler.querySelector('.depth-line-'+i);
      el.style.top = y+'px';
      el.style.background = cols[i]==='#7ec8e3'? 'rgba(126,200,227,0.85)' : i===0?'rgba(0,0,0,0.72)': 'rgba(0,0,0,0.72)';
      el.style.borderColor = i===0?'#7ec8e3':'#000';
      if(lineEl){ lineEl.style.top = (y+11)+'px'; }
      // resaltar el nivel donde está el centro de la cámara
      const viewCenter = (view.y||0) + (typeof H!=='undefined'?H:576)/(view.zoom||1)/2;
      const active = Math.abs(worldY - viewCenter) < 28;
      el.style.opacity = active? '1' : '0.82';
      el.style.transform = active? 'scale(1.04)' : 'scale(1)';
      el.style.boxShadow = active? '2px 2px 0 #000, 0 0 6px '+cols[i] : '1px 1px 0 #000';
    });
    // viewport indicator (amarillo) sigue existiendo para referencia de zoom
    let vp=ruler.querySelector('.depth-viewport');
    if(!vp){ vp=document.createElement('div'); vp.className='depth-viewport'; ruler.appendChild(vp); }
    const totalH2 = ROWS*CELL;
    const viewH = (typeof H!=='undefined'? H: 576)/ (view.zoom||1);
    const viewTop = view.y||0;
    const tPct = Math.max(0, Math.min(1, viewTop/totalH2));
    const bPct = Math.max(0, Math.min(1, (viewTop+viewH)/totalH2));
    const rulerH2 = ruler.clientHeight||720;
    vp.style.top = (tPct*rulerH2)+'px';
    vp.style.height = Math.max(14, (bPct-tPct)*rulerH2)+'px';
    vp.style.opacity='0.55';
  }catch(e){}
}

let _lastExpand=0;
function checkWorldExpansion(){
  if(Date.now()-_lastExpand < 5200) return; // debounce 5.2s
  // si algún túnel está a 4 filas del fondo y la colonia es capaz, expande
  let deepest=0; outer: for(let r=ROWS-1;r>=SURFACE_ROW;r--) for(let c=0;c<COLS;c++) if(soil[r][c]===0){ deepest=r; break outer; }
  if(deepest>=ROWS-4){
    const canExpand = (typeof gen!=='undefined'?gen:0)>=2 && (typeof colonyIQ!=='undefined'?colonyIQ:100)>=118 && digs>=22 && workers.length>=6;
    if(canExpand && ROWS<88){
      const add = ROWS<48? 14 : ROWS<80? 18 : 22;
      _lastExpand=Date.now(); expandWorld(add);
    } else if(deepest>=ROWS-2 && ROWS<96){
      // emergencia: aunque no tão inteligente, no dejar que se queden sin suelo (empujan)
      if(ROWS<72){ _lastExpand=Date.now(); expandWorld(10); }
    }
  }
}

// === ECOSISTEMA EXTERIOR VIVO ===
function getPlantAt(c){ return plants.find(p=>p.c===c); }
function spawnNaturalPlant(forceType=null){
  // busca columna fértil vacía sin hueco ni planta
  let cands=[];
  for(let c=1;c<COLS-1;c++){
    if(soil[SURFACE_ROW][c]===0) continue; // hueco túnel
    if(getPlantAt(c)) continue;
    if(fertility[c] < 0.52) continue;
    cands.push(c);
  }
  if(!cands.length) return;
  const c=cands[Math.floor(Math.random()*cands.length)];
  const f=fertility[c];
  const age = worldAge;
  let type='clover';
  const r=Math.random();
  // evolución gráfica con el tiempo y fertilidad
  if(forceType) type=forceType;
  else if(age < 0.4){ // día 0-0.4: solo trébol y pasto
    type = r<0.65?'clover': r<0.85?'grassTuft':'flowerY';
  } else if(age < 1.2){
    if(r<0.38) type='clover';
    else if(r<0.62) type='flowerY';
    else if(r<0.80) type='flowerW';
    else if(r<0.92) type='berryBush';
    else type='grassTuft';
  } else if(age < 2.5){
    if(r<0.30) type='clover';
    else if(r<0.50) type='flowerY';
    else if(r<0.66) type='berryBush';
    else if(r<0.78) type='mushroom';
    else if(r<0.88) type='sapling';
    else type='flowerW';
  } else {
    if(r<0.22) type='berryBush';
    else if(r<0.40) type='flowerY';
    else if(r<0.58) type='clover';
    else if(r<0.72) type='mushroom';
    else if(r<0.84) type='sapling';
    else if(r<0.92) type='flowerW';
    else type='grassTuft';
  }
  // fertilidad alta favorece arbustos
  // árbol frutal eventual - requiere mundo maduro y fértil
  if(age>1.8 && f>0.70 && Math.random()<0.16) type='fruitTree';
  if(f>0.82 && Math.random()<0.35) type='berryBush';
  if(f<0.55 && type==='berryBush') type='clover';
  plants.push({c, x:c*CELL+4+Math.random()*8, y:SURFACE_Y-6, type, growth:0.08+Math.random()*0.12, maxGrowth:1, age:0, fruitCooldown: DAY_LENGTH*0.35+Math.random()*DAY_LENGTH*0.2, variant:Math.floor(Math.random()*3)});
}

// === AGUA FÍSICA SIMPLE - Topo pidió comportamiento realista pixelado ===
function addWater(c,r,amt=0.7){
  if(c<0||c>=COLS||r<0||r>=ROWS) return;
  if(soil[r][c]===1) return; // no en tierra sólida
  water[r][c]=Math.min(1, (water[r][c]||0)+amt);
}
function updateWater(dt){
  // lluvia añade agua en superficie
  if(weather && (weather.type==='rain'||weather.type==='storm')){
    const rainAmt = weather.type==='storm'? 0.018*dt*0.04 : 0.012*dt*0.04;
    for(let c=0;c<COLS;c++){
      if(Math.random()<0.18) addWater(c, SURFACE_ROW, rainAmt);
      if(soil[SURFACE_ROW][c]===0 && Math.random()<0.08) addWater(c, SURFACE_ROW+1, rainAmt*0.6);
    }
  }
  // tesoro agua añade pulso
  // física: gravedad + flujo lateral (celular simple)
  for(let r=ROWS-2; r>=SURFACE_ROW; r--){
    for(let c=0;c<COLS;c++){
      let amt=water[r][c];
      if(!amt || amt<0.01) continue;
      if(soil[r][c]===1){ water[r][c]=0; continue; }
      // si abajo es aire, cae
      if(r+1<ROWS && soil[r+1][c]===0){
        const below=water[r+1][c]||0;
        if(below<1){
          const flow=Math.min(amt, (1-below)*0.62, 0.22*dt*0.1+amt*0.18);
          water[r][c]-=flow; water[r+1][c]+=flow;
          amt-=flow;
        }
      }
      // si no puede caer, fluye lateral (busca hueco más bajo)
      if(amt>0.12){
        const dirs = Math.random()<0.5 ? [-1,1] : [1,-1];
        for(let dc of dirs){
          const nc=c+dc;
          if(nc<0||nc>=COLS) continue;
          if(soil[r][nc]===1) continue;
          // si lateral está más bajo (abajo del lateral es aire) fluye más
          const canFlow = soil[r+1] && soil[r+1][nc]===0 ? 0.14 : 0.08;
          const sideAmt=water[r][nc]||0;
          if(sideAmt < amt-0.04){
            const flow=Math.min(amt*canFlow, (amt-sideAmt)*0.5, 0.12);
            water[r][c]-=flow; water[r][nc]+=flow;
            break;
          }
        }
      }
      // evaporación lenta si sol y poca agua
      if(weather && weather.type==='clear' && amt<0.18 && r===SURFACE_ROW && Math.random()<0.004*dt){
        water[r][c]*=0.92;
      }
      // si queda muy poco, limpiar
      if(water[r][c]<0.02) water[r][c]=0;
    }
  }
  // agua en superficie expuesta se ve como charco - no hacer nada más
}

function updateEcosystem(dt){
  try{ updateWater(dt); }catch(e){}
  worldAge = time/DAY_LENGTH;
  const season = Math.floor((day/12)%4); // 0 primavera,1 verano,2 otoño,3 invierno
  const rainBoost = (weather.type==='rain'||weather.type==='storm')? 1.9 : 1;
  const sunBoost = (weather.type==='clear')? 1.15 : 0.92;
  const seasonBoost = season===0?1.22 : season===1?1.35 : season===2?0.95 : 0.62; // invierno lento
  // fertilidad evoluciona
  for(let c=0;c<COLS;c++){
    let f=fertility[c];
    // lluvia nutre, sol moderate, pisoteo de hormigas consume poco
    if(weather.type==='rain'||weather.type==='storm') f+=0.000020*dt*rainBoost;
    else if(season===3) f-=0.000004*dt;
    else f+=0.000006*dt*sunBoost*seasonBoost;
    // plantas consumen fertilidad muy leve
    const pl=getPlantAt(c);
    if(pl && pl.growth>0.6) f-=0.000003*dt;
    // regeneración natural hacia 0.58
    f += (0.58 - f)*0.000008*dt;
    fertility[c]=Math.max(0.12, Math.min(1, f));
  }
  // crecimiento de plantas
  for(let i=plants.length-1;i>=0;i--){
    const pl=plants[i];
    const f=fertility[pl.c];
    const growthRate = (0.00055 + f*0.00062)*dt*rainBoost*seasonBoost*sunBoost;
    // trébol crece rápido, árbol lento
    let mult=1;
    if(pl.type==='sapling') mult=0.22;
    else if(pl.type==='fruitTree') mult=0.26;
    else if(pl.type==='berryBush') mult=0.55;
    else if(pl.type==='mushroom') mult=0.72;
    else if(pl.type==='grassTuft') mult=1.15;
    pl.growth=Math.min(1, pl.growth + growthRate*mult);
    pl.age+=dt;
    // muerte si hueco se abre (túnel debajo)
    if(soil[SURFACE_ROW][pl.c]===0){ plants.splice(i,1); continue; }
    // fruto / comida
    if(pl.growth>=0.92){
      pl.fruitCooldown-=dt;
      if(pl.fruitCooldown<=0){
        // producir alimento según tipo
        if(pl.type==='clover' || pl.type==='grassTuft'){
          if(Math.random()<0.55 && foods.length<8){
            spawnFoodAt(pl.x + (Math.random()-0.5)*10, SURFACE_Y-8, 1, 'seed');
            pl.fruitCooldown=DAY_LENGTH*(0.45+Math.random()*0.25);
          } else pl.fruitCooldown=DAY_LENGTH*0.12;
        } else if(pl.type==='flowerY' || pl.type==='flowerW'){
          if(Math.random()<0.42 && foods.length<8){
            spawnFoodAt(pl.x, SURFACE_Y-8, 1, 'honey');
            // también fibra para inventos
            if(inventions.fiber && Math.random()<0.3) worldMaterials.fiber+=1;
            pl.fruitCooldown=DAY_LENGTH*(0.62+Math.random()*0.3);
          } else pl.fruitCooldown=DAY_LENGTH*0.15;
        } else if(pl.type==='berryBush'){
          if(foods.length<9){
            spawnFoodAt(pl.x-6, SURFACE_Y-8, 1, 'berry');
            spawnFoodAt(pl.x+6, SURFACE_Y-8, 1, 'berry');
            pushEvent('food','🫐 Arbusto da bayas','Maduros a '+pl.growth.toFixed(2));
            if(inventions.clay) pl.fruitCooldown=DAY_LENGTH*0.55;
            else pl.fruitCooldown=DAY_LENGTH*(0.72+Math.random()*0.2);
          }
        } else if(pl.type==='mushroom'){
          if(foods.length<9){
            spawnFoodAt(pl.x, SURFACE_Y-8, 1, 'mushroom');
            if(inventions.fungus) worldMaterials.fiber+=1;
            pl.fruitCooldown=DAY_LENGTH*0.58;
          }
        } else if(pl.type==='fruitTree'){
          // manzano frutal: 3 manzanas cada 0.75d cuando maduro
          if(foods.length<10){
            for(let k=0;k<3;k++) spawnFoodAt(pl.x + (Math.random()-0.5)*18, SURFACE_Y-8, 1, 'apple');
            // textura de fruto también da fibra y ocasional madera
            if(inventions.wood && Math.random()<0.12) worldMaterials.wood+=1;
            if(Math.random()<0.22) worldMaterials.fiber+=1;
            pushEvent('food','🍎 Manzanas caen del árbol','Frutal maduro '+pl.growth.toFixed(2));
            pl.fruitCooldown=DAY_LENGTH*(0.78+Math.random()*0.32);
          } else pl.fruitCooldown=DAY_LENGTH*0.18;
        } else if(pl.type==='sapling'){
          // árbol crece por fases: 0-0.35 brote, 0.35-0.75 joven, 0.75-1 árbol
          if(pl.growth>=0.98 && Math.random()<0.08 && foods.length<7){
            spawnFoodAt(pl.x, SURFACE_Y-8, 1, 'seed'); // hojas / frutos
            pl.fruitCooldown=DAY_LENGTH*1.1;
            if(inventions.wood) worldMaterials.wood+=1;
          } else if(pl.fruitCooldown<=0) pl.fruitCooldown=DAY_LENGTH*0.35;
        }
      }
    }
    // envejecimiento manchas
    if(season===3 && pl.type==='clover' && Math.random()<0.00015*dt) pl.growth=Math.max(0.45, pl.growth-0.02);
  }
  // spawn natural de nuevas plantas - más rápido si mundo fértil y viejo
  // PASTO TERRARIA - césped se expande a tierra desnuda expuesta a superficie con luz/sol (no bajo tierra)
  // cada tile con pasto maduro intenta infectar adyacente como Terraria: horizontal/vertical/diagonal a suelo desnudo
  if(dt>0 && worldAge>0.12){
    for(let c=0;c<COLS;c++){
      if(soil[SURFACE_ROW][c]!==1) continue; // solo superficie de tierra
      const hasPlant = plants.some(pl=> pl.c===c && !pl.cave);
      if(hasPlant) continue; // ya ocupado
      // buscar vecino con pasto maduro (clover/grassTuft >0.62) en 8 direcciones Terraria
      let neighborMature=false;
      for(let dc=-1; dc<=1; dc++) for(let dr=-1; dr<=1; dr++){
        if(dc===0 && dr===0) continue;
        const nc=c+dc; if(nc<0||nc>=COLS) continue;
        const np = plants.find(pl=> pl.c===nc && (pl.type==='clover' || pl.type==='grassTuft') && pl.growth>0.62);
        if(np && soil[SURFACE_ROW][nc]===1) { neighborMature=true; break; }
      }
      if(!neighborMature) continue;
      // luz: debe estar expuesto a cielo (no soil arriba, día con sol o al menos no cueva)
      const isExposed = soil[SURFACE_ROW][c]===1 && (SURFACE_ROW===6); // superficie siempre expuesta si no hay hueco
      if(!isExposed) continue;
      // fertilidad y clima progresivo: no crece en suelo árido, lluvia y fertilidad ayudan
      const f=fertility[c]||0.5;
      const spreadChance = (0.00042 + f*0.00055 + (rainBoost-1)*0.00022) * dt * (worldAge*0.08+0.6);
      if(Math.random()<spreadChance){
        // coloniza con nuevo pasto pequeño
        const nx=c*CELL+4+Math.random()*8;
        plants.push({c, x:nx, y:SURFACE_Y-6, type: Math.random()<0.68?'grassTuft':'clover', growth:0.08+Math.random()*0.14, maxGrowth:1, age:0, fruitCooldown: DAY_LENGTH*0.45+Math.random()*DAY_LENGTH*0.3, variant:Math.floor(Math.random()*3)});
        // partícula sutil de expansión
        if(Math.random()<0.4) particles.push({x:nx, y:SURFACE_Y-8, vx:(Math.random()-0.5)*0.6, vy:-0.4, life:0.6, decay:0.03, color:'#7ad35f'});
      }
    }
  }
  const spawnProb = 0.00018*dt + worldAge*0.00006*dt + (rainBoost-1)*0.00010*dt;
  if(Math.random()< spawnProb && plants.length < COLS*0.72){
    spawnNaturalPlant();
  }
  // hongos en túneles húmedos: si hay puddle y sombra temporal
  if(Math.random()<0.00022*dt && worldAge>0.7){
    for(let c=2;c<COLS-2;c++){
      for(let r=SURFACE_ROW+6;r<ROWS-6;r++){
        if(soil[r][c]===0 && soilType[r+1] && soilType[r+1][c]!==0 && Math.random()<0.0006){
          // hay techo y suelo, posibilidad de hongo de cueva
          if(Math.random()<0.12 && mound.some(m=>Math.abs(m.x - c*CELL)<28 && m.isPuddle)){
            plants.push({c, x:c*CELL+8, y:r*CELL+14, type:'caveMush', growth:0.12, maxGrowth:1, age:0, fruitCooldown:DAY_LENGTH*0.5, variant:0, cave:true, cr:c, rr:r});
            break;
          }
        }
      }
    }
  }
  for(let st of structures) st.age+=dt;
  checkInventions();
}
function checkInventions(){
  // desbloqueos reales por inteligencia + materiales + trabajo
  if(!inventions.stone && gen>=3 && colonyIQ>=124 && digs>=18){
    inventions.stone=true; pushImportant('invention','🔨 Invento: cantería','Ya usan PIEDRA para reforzar túneles'); notifyCanon('🔨 CANTERÍA', '¡Inventaron mampostería de piedra!', 6000); pushToast(W/2,H/2-18,'🔨 PIEDRA','#8a8a8a',2.5);
  }
  if(!inventions.clay && gen>=4 && colonyIQ>=128 && digs>=28 && worldAge>1.0){
    inventions.clay=true; pushImportant('invention','🏺 Invento: cerámica de arcilla','Tapial + arcilla apisonada'); notifyCanon('🏺 ARCILLA', '¡Dominan la arcilla!', 6000); pushToast(W/2,H/2-18,'🏺 ARCILLA','#c2a080',2.5);
  }
  if(!inventions.fiber && gen>=4 && colonyIQ>=132 && plants.length>=8 && deliveries>=35){
    inventions.fiber=true; pushImportant('invention','🧵 Invento: tejido de fibras','Trenzan briznas y hojas para techar'); notifyCanon('🧵 FIBRA', '¡Tejen fibra vegetal!', 6000); pushToast(W/2,H/2-18,'🧵 FIBRA','#7ad35f',2.5);
  }
  if(!inventions.wood && gen>=5 && colonyIQ>=138 && worldAge>2.0 && plants.some(p=>p.type==='sapling' && p.growth>0.85)){
    inventions.wood=true; pushImportant('invention','🪵 Invento: carpintería','Usan RAMAS del arbolito para apuntalar'); notifyCanon('🪵 MADERA', '¡Carpintería básica!', 6000); pushToast(W/2,H/2-18,'🪵 MADERA','#8b5a2b',2.5);
  }
  if(!inventions.fungus && gen>=5 && colonyIQ>=140 && worldAge>2.4 && plants.some(p=>p.type==='mushroom'||p.type==='caveMush')){
    inventions.fungus=true; pushImportant('invention','🍄 Invento: cultivo de hongos','Granja subterránea de hongos'); notifyCanon('🍄 CULTIVO', '¡Granja de hongos subterránea!', 6000); pushToast(W/2,H/2-18,'🍄 CULTIVO','#6a9a7a',2.5);
  }
}
function canBuildStructure(type){
  const def=STRUCTURE_DEFS[type]; if(!def) return false;
  if(gen<def.gen || colonyIQ<def.iq) return false;
  for(let k in def.need) if((worldMaterials[k]||0) < def.need[k]) return false;
  // al menos 1 invento base
  if(type==='workshop' && !inventions.wood) return false;
  if(type==='granary' && !inventions.clay) return false;
  if(type==='bridge' && !inventions.fiber) return false;
  if(type==='tower' && !inventions.stone) return false;
  return true;
}
function tryBuildComplexStructure(ant, site){
  // prioriza estructuras útiles según necesidad de colonia
  let candidates=[];
  if(canBuildStructure('granary') && colonyFood>8 && structures.filter(s=>s.type==='granary').length < 2) candidates.push('granary');
  if(canBuildStructure('workshop') && structures.filter(s=>s.type==='workshop').length < 1) candidates.push('workshop');
  if(canBuildStructure('bridge') && Math.random()<0.12) candidates.push('bridge');
  if(canBuildStructure('tower') && workers.length>=9 && structures.filter(s=>s.type==='tower').length < 1) candidates.push('tower');
  if(!candidates.length) return false;
  const type = candidates[Math.floor(Math.random()*candidates.length)];
  const def=STRUCTURE_DEFS[type];
  // verifica espacio libre  (site es celda única, expandimos)
  for(let dy=0; dy<def.h; dy++) for(let dx=0; dx<def.w; dx++){
    const cc=site.c+dx, rr=site.r+dy;
    if(rr<0||rr>=ROWS||cc<0||cc>=COLS||soil[rr][cc]===1) return false;
  }
  // consume materiales
  for(let k in def.need) worldMaterials[k]-=def.need[k];
  // ocupa celdas como suelo especial pero marca estructura
  for(let dy=0; dy<def.h; dy++) for(let dx=0; dx<def.w; dx++){
    const cc=site.c+dx, rr=site.r+dy;
    soil[rr][cc]=1; if(soilType[rr]) soilType[rr][cc]= (type==='granary'?2: type==='workshop'?4: type==='tower'?4:3);
    decoSet.add(dkey(cc,rr));
  }
  structures.push({c:site.c, r:site.r, w:def.w, h:def.h, type, builtBy:ant.id, age:0, buildProgress:0});
  markSoilDirty();
  pushEvent('build',`🏗 ${ant.id} construye ${def.name} [${site.c},${site.r}]`,`${def.bonus} - GEN${gen} IQ${colonyIQ}`);
  notifyCanon('🏗 ESTRUCTURA', `${def.name} construido por ${ant.id}`, 6000);
  pushToast(site.c*CELL+8, site.r*CELL+8, '🏗 '+def.name, def.color, 2.2);
  for(let i=0;i<12;i++) particles.push({x:site.c*CELL+8,y:site.r*CELL+8,vx:(Math.random()-0.5)*2,vy:-Math.random()*1.6,life:1,decay:0.03,color:def.color});
  ant.fitness+=1.2; colonyFitness+=0.9;
  if(type==='granary') colonyFood+=4; // bonus almacén
  return true;
}
function tryCraftTool(ant){
  if(ant.tool) return false; // ya tiene
  const opts=[];
  if(inventions.stone && gen>=TOOL_DEFS.pick.gen && colonyIQ>=TOOL_DEFS.pick.iq && worldMaterials.stone>=2) opts.push('pick');
  if(inventions.fiber && gen>=TOOL_DEFS.basket.gen && colonyIQ>=TOOL_DEFS.basket.iq && worldMaterials.fiber>=2) opts.push('basket');
  if(inventions.clay && gen>=TOOL_DEFS.trowel.gen && colonyIQ>=TOOL_DEFS.trowel.iq && worldMaterials.clay>=1 && worldMaterials.stone>=1) opts.push('trowel');
  if(!opts.length) return false;
  const t=opts[Math.floor(Math.random()*opts.length)];
  const def=TOOL_DEFS[t];
  for(let k in def.need) worldMaterials[k]-=def.need[k];
  ant.tool=t; ant.toolBonus=def;
  pushEvent('evo',`🔧 ${ant.id} forja ${def.name} ${def.icon}`,`Herramienta - ${t}`);
  pushToast(ant.x, ant.y-14, def.icon+' '+def.name, '#ffcc00', 1.8);
  ant.fitness+=0.7;
  return true;
}
function drawStructures(ctx,W,H,isMini){
  if(isMini) return;
  for(let s of structures){
    const x=s.c*CELL, y=s.r*CELL, w=s.w*CELL, h=s.h*CELL;
    const def=STRUCTURE_DEFS[s.type];
    let prog = s.buildProgress;
    if(prog===undefined) prog = s.age!==undefined? Math.min(1, s.age/(DAY_LENGTH*0.007)) : 1;
    // atlas definitivo 05

    if(prog<1){
      ctx.save();
      ctx.beginPath(); ctx.rect(x, y + h*(1-prog), w, h*prog); ctx.clip();
    }
    if(s.type==='workshop'){
      ctx.fillStyle='#4a2510'; ctx.fillRect(x,y,w,h);
      ctx.fillStyle='#6b3a1f'; ctx.fillRect(x+2,y+2,w-4,h-4);
      ctx.fillStyle='#8a6a3a'; ctx.fillRect(x,y, w,6);
      ctx.fillStyle='#2e0f00'; ctx.fillRect(x,y+6,w,2);
      ctx.fillStyle='#d9b48a'; ctx.fillRect(x+6,y+10,8,4);
      ctx.fillStyle='#ffcc00'; ctx.fillRect(x+8,y+12,2,2);
      ctx.fillStyle='#1a0a00'; ctx.fillRect(x+2,y+h-4,w-4,2);
      ctx.fillStyle='#5a5a5a'; ctx.fillRect(x+w-10,y+12,6,6); ctx.fillStyle='#8a8a8a'; ctx.fillRect(x+w-9,y+13,2,2);
    } else if(s.type==='granary'){
      ctx.fillStyle='#7a4a1f'; ctx.fillRect(x,y,w,h);
      ctx.fillStyle='#c2a080'; ctx.fillRect(x+2,y+2,w-4,h-4);
      ctx.fillStyle='#8b5a2b'; ctx.fillRect(x+2,y+ h-8,w-4,3);
      ctx.fillStyle='#5a3a1a'; ctx.fillRect(x+4,y+8,10,8); ctx.fillRect(x+ w-16,y+8,10,8);
      ctx.fillStyle='#fff8dc'; ctx.fillRect(x+6,y+10,2,2); ctx.fillRect(x+ w-14,y+10,2,2);
      ctx.fillStyle='#3a2a0a'; ctx.fillRect(x+ w/2 -6,y+2,12,6);
      ctx.fillStyle='#2e0f00'; ctx.fillRect(x,y+h-3,w,3);
    } else if(s.type==='bridge'){
      ctx.fillStyle='#6b4a1f'; ctx.fillRect(x,y,w, h);
      ctx.fillStyle='#8b5a2b'; ctx.fillRect(x+2,y+2,w-4,h-4);
      ctx.fillStyle='#4a2510'; ctx.fillRect(x,y+h-2,w,2);
      ctx.fillStyle='#3a1a05'; ctx.fillRect(x,y-2,w,2); ctx.fillRect(x,y+h,w,2);
    } else if(s.type==='tower'){
      ctx.fillStyle='#5a5a5a'; ctx.fillRect(x,y,w,h);
      ctx.fillStyle='#7a7a7a'; ctx.fillRect(x+2,y+2,w-4,h-10);
      ctx.fillStyle='#3a3a3a'; ctx.fillRect(x,y,w,4);
      ctx.fillRect(x+2,y+2,4,4); ctx.fillRect(x+w-6,y+2,4,4);
      ctx.fillStyle='#1a1a1a'; ctx.fillRect(x+w/2 -2,y+10,4,6);
      if(s.age> DAY_LENGTH*0.2){
        ctx.fillStyle='#ffcc00'; ctx.fillRect(x+w/2-1,y+4,2,2);
      }
    }
    ctx.strokeStyle='#000'; ctx.lineWidth=1; ctx.strokeRect(x+0.5,y+0.5,w-1,h-1);
    if(prog<1){ ctx.restore();
      let topY = y + h*(1-prog);
      ctx.fillStyle='rgba(107,58,31,0.90)'; ctx.fillRect(x+2, topY-2, w-4, 2);
      ctx.fillStyle='#c2a080'; for(let sx=x+4; sx<x+w-6; sx+=8){ ctx.fillRect(sx, topY-6, 2, 6); ctx.fillRect(sx, topY, 2, 2); }
      if(Math.random()<0.05){ ctx.fillStyle='rgba(200,180,150,0.38)'; ctx.fillRect(x+2+Math.floor(Math.random()*(w-4)), topY+1, 2,2); }
      ctx.fillStyle='#000'; ctx.fillRect(x, y-6, w, 4); ctx.fillStyle='#ffcc00'; ctx.fillRect(x+1, y-5, Math.floor((w-2)*prog), 2);
    }
  }
}
function isSolidPixel(x,y){
  const c=Math.floor(x/CELL),r=Math.floor(y/CELL);
  if(c<0||c>=COLS||r<0||r>=ROWS) return true;
  // cielo muy arriba fuera del shaft es muro - pero la superficie (y ~ SURFACE_Y-6) es libre para caminar
  if(y < SURFACE_Y - 12 && Math.abs(x - (CENTER_COL*CELL+8)) > 28) return true;
  return soil[r][c]===1;
}
function canMove(x,y){const r=7;return !isSolidPixel(x,y)&&!isSolidPixel(x+r,y)&&!isSolidPixel(x-r,y)&&!isSolidPixel(x,y+r*0.7)&&!isSolidPixel(x,y-r*0.7);}
function canMoveIgnoreTarget(x,y,target){const r=7;function ok(px,py){const c=Math.floor(px/CELL), rr=Math.floor(py/CELL); if(target && c===target.c && rr===target.r) return true; return !isSolidPixel(px,py);} return ok(x,y)&&ok(x+r,y)&&ok(x-r,y)&&ok(x,y+r*0.7)&&ok(x,y-r*0.7);}
// Topo: un solo escaneo O(celdas) por version de suelo, compartido por IA, UI y render.
// Antes cada hormiga y cada frame volvia a recorrer todo el mapa (eso hacia que un mundo pequeno
// costara casi lo mismo que uno grande: el trabajo fijo ganaba).
const _wsCache={rev:-1,at:-1e9,open:0,chambers:0,frontier:[]};
function worldStats(){
  const now=performance.now();
  if(_wsCache.rev===_soilRev && now-_wsCache.at<4000) return _wsCache;
  if(now-_wsCache.at<24) return _wsCache; // anti-thrash: max ~40 reconstrucciones/segundo
  let open=0; const f=[];
  for(let r=SURFACE_ROW;r<ROWS;r++){
    const row=soil[r]; if(!row) continue;
    const up=r>0?soil[r-1]:null, dn=r<ROWS-1?soil[r+1]:null;
    for(let c=0;c<COLS;c++){
      if(row[c]===1){
        if((c>0&&row[c-1]===0)||(c<COLS-1&&row[c+1]===0)||(up&&up[c]===0)||(dn&&dn[c]===0)) f.push({c,r});
      } else open++;
    }
  }
  _wsCache.rev=_soilRev; _wsCache.at=now; _wsCache.open=open; _wsCache.frontier=f;
  _wsCache.chambers=Math.max(2,Math.floor(open/18));
  return _wsCache;
}
function findFrontier(){ return worldStats().frontier; }
function findBuildSite(ant){
  const cands=[];
  for(let r=SURFACE_ROW+1;r<ROWS-1;r++) for(let c=1;c<COLS-1;c++) if(soil[r][c]===0){
    const dist=Math.hypot((c+0.5)*16-ant.x,(r+0.5)*16-ant.y);
    if(dist>65) continue;
    if(r===SURFACE_ROW+1 && Math.abs(c-CENTER_COL)<2) continue;
    let emptyN=0, solidN=0;
    for(let [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nc=c+dx,nr=r+dy;
      if(nc<0||nc>=COLS||nr<0||nr>=ROWS) continue;
      if(soil[nr][nc]===0) emptyN++; else solidN++;
    }
    if(solidN>=1 && solidN<=2 && emptyN>=2 && emptyN<=3){
      if(emptyN===1) continue;
      const queenD=Math.hypot((c+0.5)*16-queen.x,(r+0.5)*16-queen.y);
      const score = dist*0.6 + queenD*0.2 + Math.random()*8;
      cands.push({c,r,score});
    }
  }
  if(!cands.length) return null;
  cands.sort((a,b)=>a.score-b.score);
  return cands[0];
}
function countChambers(){ return worldStats().chambers; }
// TOPO deferred: no mundo hasta elegir tamaño (no solo ocultar)
let _topoHasWorld = false; // Topo: nada existe hasta elegir tamaño, no autocrear al recargar (solo al crear/cargar)
if(_topoHasWorld){ try{ initSoil(); }catch(e){ console.warn('initSoil deferred fail',e); } } else { soil=[]; water=[]; soilType=[]; fertility=[]; plants=[]; hiddenRewards=[]; tlog('[TOPO] initSoil diferido - mundo no existe hasta elegir tamaño'); }
function spawnFoodAt(x,y,amt=1, ftype='honey'){let sy=clamp(y, 8, H-8); const sx=clamp(x,16,W-16); const def=FOOD_DEFS[ftype]||FOOD_DEFS.honey; foods.push({x:sx,y:sy,amount:amt,max:amt,r:5+amt*2,pulse:Math.random()*Math.PI*2, ftype, rot:0, fresh:1, spawnDay:1, vy:0, grounded:false});}
function spawnFoodSurface(x,amt=1, ftype='honey'){const sx=clamp(x+(Math.random()*20-10),20,W-20), sy=SURFACE_Y-8; const def=FOOD_DEFS[ftype]||FOOD_DEFS.honey; foods.push({x:sx,y:sy,amount:amt,max:amt,r:5+amt*2,pulse:Math.random()*Math.PI*2, ftype, rot:0, fresh:1, spawnDay:1, vy:0, grounded:true});}
if(_topoHasWorld){ for(let i=0;i<4;i++){ const typ=['honey','berry','seed','mushroom'][i%4]; spawnFoodSurface(Math.random()*(W-160)+80,1+Math.floor(Math.random()*2), typ); } } else { tlog('[TOPO] foods diferidos'); }
function pushToast(x,y,txt,color='#ffcc00',dur=2.2){toasts.push({x,y,txt,color,life:1,decay:1/dur/60,vy:-0.5}); if(toasts.length>10) toasts.shift();}
// === DIÁLOGOS DEL JUEGO ===
// Topo: nada de confirm()/alert() del navegador. En un iframe con sandbox (previews, embebidos)
// y en varios móviles el navegador IGNORA esas llamadas y devuelven false: el click de "crear
// granja" se caía por el confirm y no pasaba nada. El diálogo es propio, con teclado (Enter/Esc).
let _dialogStack=[];
function gameDialog(opts){
  const o=opts||{};
  if(!document || !document.body){ if(o.onYes) try{ o.onYes(); }catch(e){} return ()=>{}; }
  const host=document.createElement('div');
  host.className='topo-dialog-host';
  host.style.cssText='position:fixed;inset:0;z-index:10050;background:rgba(0,0,0,0.74);display:flex;align-items:center;justify-content:center;padding:18px;box-sizing:border-box';
  const box=document.createElement('div');
  box.style.cssText='width:430px;max-width:100%;background:#1a140f;border:4px solid #000;box-shadow:8px 8px 0 #000;padding:18px;display:flex;flex-direction:column;gap:12px;text-align:center';
  const ttl=document.createElement('div'); ttl.style.cssText="font-family:'Press Start 2P',monospace;font-size:10px;color:#ffcc00;line-height:1.6"; ttl.textContent=o.title||'¿Seguro?';
  const bod=document.createElement('div'); bod.style.cssText="font-family:'VT323',monospace;font-size:15px;color:#c9b896;line-height:1.35;white-space:pre-line;text-align:left"; bod.textContent=o.body||'';
  const row=document.createElement('div'); row.style.cssText='display:flex;gap:8px;justify-content:center;flex-wrap:wrap';
  let closed=false;
  function close(){ if(closed) return; closed=true; document.removeEventListener('keydown', onKey, true); if(host.parentNode) host.remove(); const i=_dialogStack.indexOf(host); if(i>=0) _dialogStack.splice(i,1); }
  function no(){ close(); if(o.onNo) try{ o.onNo(); }catch(e){ console.error(e); } }
  function mk(txt, primary, fn){ const el=document.createElement('button'); el.className='pixel-btn'+(primary?' primary':''); el.textContent=txt; el.style.cssText='flex:1;min-width:118px;justify-content:center'; el.onclick=()=>{ close(); if(fn) try{ fn(); }catch(e){ console.error(e); } }; row.appendChild(el); return el; }
  const yes=mk(o.yes||'SÍ', true, o.onYes);
  if(o.no!==false) mk(o.no||'NO', false, o.onNo? no : null);
  box.appendChild(ttl); if(o.body) box.appendChild(bod); box.appendChild(row); host.appendChild(box);
  document.body.appendChild(host); _dialogStack.push(host);
  function onKey(e){ if(e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); no(); } else if(e.key==='Enter'){ e.preventDefault(); e.stopPropagation(); close(); if(o.onYes) try{ o.onYes(); }catch(_){} } }
  document.addEventListener('keydown', onKey, true);
  host.addEventListener('click', (e)=>{ if(e.target===host) no(); });
  try{ yes.focus(); }catch(e){}
  return close;
}
function gameAlert(title, body, onClose){ return gameDialog({title, body, no:false, yes:'ENTENDIDO', onYes:onClose||null}); }
function gameConfirm(title, body, onYes, onNo){ return gameDialog({title, body, onYes, onNo}); }
window.gameDialog=gameDialog; window.gameAlert=gameAlert; window.gameConfirm=gameConfirm;
function setNarration(html){ const n=document.getElementById('narrationTxt'); if(n) n.innerHTML=html; }

// === CONTROLES DE LA CONSOLA (historial, tiras plegables, narracion) ===
// Topo: antes esto vivia en un <script> suelto dentro de index.html; ahora el unico dueno de la
// logica es app.js y el HTML solo manda marcas. Los _wired evitan dobles listeners.
function wireChromeUI(){
  try{
    const fab=document.getElementById('historyFab');
    if(fab && !fab._wired){ fab._wired=1; fab.onclick=(e)=>{ e&&e.preventDefault(); toggleHistory(); }; }
    const hf=document.getElementById('historyFilter');
    if(hf && !hf._wired){ hf._wired=1; hf.onchange=()=>{ try{ renderHistoryDrawer(); }catch(e){} }; }
    const ht=document.getElementById('hudToggle');
    if(ht && !ht._wired){
      ht._wired=1; ht.textContent='←'; ht.title='Plegar a la izquierda (mini) / Expandir';
      ht.onclick=()=>{
        const hud=document.querySelector('.hud-strips'); if(!hud) return;
        const vel=document.getElementById('cornerControls'), day=document.getElementById('dayControls'), main=document.getElementById('mainHud');
        const collapsed=hud.classList.contains('collapsed');
        hud.classList.toggle('collapsed', !collapsed);
        if(vel) vel.classList.toggle('collapsed', !collapsed);
        if(day) day.classList.toggle('collapsed', !collapsed);
        if(main) main.classList.toggle('collapsed', !collapsed);
        ht.classList.toggle('collapsed', !collapsed);
        ht.textContent=!collapsed?'→':'←';
      };
    }
    const nt=document.getElementById('narrationToggle');
    if(nt && !nt._wired){
      nt._wired=1;
      nt.onclick=()=>{ const n=document.getElementById('narration'); if(!n) return; n.classList.toggle('collapsed'); nt.textContent=n.classList.contains('collapsed')?'+':'—'; };
    }
  }catch(e){ console.warn('[TOPO] chrome UI', e.message); }
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', ()=>{ try{ wireChromeUI(); }catch(e){} }, {once:true});
else { try{ wireChromeUI(); }catch(e){} }
function showNotify(type,title,detail,ms=3400){
  const stack=document.getElementById('notifyStack');
  if(!stack) return;
  const div=document.createElement('div');
  div.className='notify '+type;
  const ico = type==='error' ? '✕' : type==='warn' ? '!' : type==='canon' ? '★' : '✓';
  div.innerHTML=`<div class="n-ico">${ico}</div><div style="flex:1;min-width:0"><div class="n-title">${title}</div>${detail?`<div class="n-detail">${detail}</div>`:''}</div><button class="n-close">x</button>`;
  div.querySelector('.n-close').onclick=()=>{div.style.opacity='0'; setTimeout(()=>div.remove(),180);};
  stack.appendChild(div);
  setTimeout(()=>{div.style.transition='opacity 0.25s'; div.style.opacity='0'; setTimeout(()=>div.remove(),260);}, ms);
  if(type==='error'){wrap.classList.remove('shake'); void wrap.offsetWidth; wrap.classList.add('shake'); setTimeout(()=>wrap.classList.remove('shake'),400);}
  if(type==='error') pushEvent('death', title, detail.replace(/<[^>]*>/g,''));
}
function notifyCanon(title, detail, ms=5200){
  showNotify('canon', title, detail, ms);
  // also central bubble toast
  pushToast(W/2, H/2-26, title, '#b47aff', 2.8);
  // subtle shake for canon if is major
}
function updateActionButtons(){
  const canBreed = colonyFood>=3;
  const btnBreed=document.getElementById('btnBreed');
  const btnLay=document.getElementById('btnLay');
  const btnHatch=document.getElementById('btnHatch');
  if(btnBreed){btnBreed.disabled=!canBreed; btnBreed.title= canBreed ? 'Gastar 3 🍯' : `FALTA ${3-colonyFood} 🍯 (tienes ${colonyFood})`;}
  if(btnLay){btnLay.disabled=!canBreed; btnLay.title= canBreed ? 'Gastar 3 🍯' : `FALTA ${3-colonyFood} 🍯`;}
  if(btnHatch){btnHatch.disabled=brood.length===0; btnHatch.style.opacity= brood.length? '1':'0.35';}
}

/* ===== NEURAL ===== */
const INPUT_SIZE=11, HIDDEN_INIT=8, OUTPUT_SIZE=5;
function randW(){return (Math.random()*2-1)*1.25;}
function makeGenome(hidden=HIDDEN_INIT){
  return {w1:Array.from({length:hidden},()=>Array.from({length:INPUT_SIZE},()=>randW())), b1:Array.from({length:hidden},()=>randW()*0.5), w2:Array.from({length:OUTPUT_SIZE},()=>Array.from({length:hidden},()=>randW())), b2:Array.from({length:OUTPUT_SIZE},()=>randW()*0.5), hiddenSize:hidden, gen:0, id: Math.random().toString(36).slice(2,6).toUpperCase()};
}
function forwardNN(inputs,g){
  const hidden=[]; for(let h=0;h<g.hiddenSize;h++){let s=g.b1[h];for(let i=0;i<INPUT_SIZE;i++) s+=g.w1[h][i]*inputs[i]; hidden[h]=Math.tanh(s);}
  const out=[]; for(let o=0;o<OUTPUT_SIZE;o++){let s=g.b2[o];for(let h=0;h<g.hiddenSize;h++) s+=g.w2[o][h]*hidden[h]; out[o]=Math.tanh(s);}
  return {hidden,out};
}
function cloneGenome(g){
  // Topo: copiar a mano - JSON.parse(JSON.stringify(g)) era de lo más caro al nacer cada hormiga
  const hs=g.hiddenSize|0, oc=Array.isArray(g.w2)?g.w2.length:OUTPUT_SIZE, ic=Array.isArray(g.w1)&&g.w1[0]?g.w1[0].length:INPUT_SIZE;
  const ng={hiddenSize:hs, gen:g.gen||0, id:(g.id||'')+''};
  ng.w1=new Array(hs); ng.b1=new Array(hs);
  for(let h=0;h<hs;h++){ const src=(g.w1&&g.w1[h])||[]; const row=new Array(ic); for(let i=0;i<ic;i++) row[i]= typeof src[i]==='number'?src[i]:randW(); ng.w1[h]=row; ng.b1[h]=(g.b1&&typeof g.b1[h]==='number')?g.b1[h]:0; }
  ng.w2=new Array(oc); ng.b2=new Array(oc);
  for(let o=0;o<oc;o++){ const src=(g.w2&&g.w2[o])||[]; const row=new Array(hs); for(let h=0;h<hs;h++) row[h]= typeof src[h]==='number'?src[h]:randW(); ng.w2[o]=row; ng.b2[o]=(g.b2&&typeof g.b2[o]==='number')?g.b2[o]:0; }
  for(let k in g){ if(k==='w1'||k==='w2'||k==='b1'||k==='b2'||k==='hiddenSize'||k==='gen'||k==='id') continue; const v=g[k]; if(typeof v==='number'||typeof v==='string'||typeof v==='boolean') ng[k]=v; }
  return ng;
}
function mutateGenome(g,rate=0.13,strength=0.6){
  const ng=cloneGenome(g);
  let changes=[]; // Topo: bastan los primeros - nadie leia mas de 2 y se armaban ~17 cadenas por genoma
  for(let h=0;h<ng.hiddenSize;h++){
    for(let i=0;i<INPUT_SIZE;i++) if(Math.random()<rate){ng.w1[h][i]+=(Math.random()*2-1)*strength; (changes.length<4&&changes.push('w1['+h+','+i+']'));}
    if(Math.random()<rate*0.7){ng.b1[h]+=(Math.random()*2-1)*strength*0.6; (changes.length<4&&changes.push('b1['+h+']'));}
  }
  for(let o=0;o<OUTPUT_SIZE;o++){
    for(let h=0;h<ng.hiddenSize;h++) if(Math.random()<rate){ng.w2[o][h]+=(Math.random()*2-1)*strength; (changes.length<4&&changes.push('w2['+o+','+h+']'));}
    if(Math.random()<rate*0.7){ng.b2[o]+=(Math.random()*2-1)*strength*0.6; (changes.length<4&&changes.push('b2['+o+']'));}
  }
  if(Math.random()<0.07 && ng.hiddenSize<16){ng.hiddenSize++; ng.w1.push(Array.from({length:INPUT_SIZE},()=>randW()*0.6)); ng.b1.push(randW()*0.5); ng.w2.forEach(row=>row.push(randW()*0.6)); (changes.length<4&&changes.push('+nodo'));}
  if(changes.length===0){const rh=Math.floor(Math.random()*ng.hiddenSize), ri=Math.floor(Math.random()*INPUT_SIZE); ng.w1[rh][ri]+=(Math.random()*2-1)*0.4; (changes.length<4&&changes.push('drift'));}
  ng.gen++; ng.id=Math.random().toString(36).slice(2,6).toUpperCase();
  return {genome:ng, changes};
}
function crossover(a,b){
  const child=cloneGenome(a);
  const hs=Math.max(a.hiddenSize,b.hiddenSize);
  while(child.hiddenSize < hs){ child.hiddenSize++; child.w1.push(Array.from({length:INPUT_SIZE},()=>randW()*0.6)); child.b1.push(randW()*0.5); child.w2.forEach(row=>row.push(randW()*0.6));}
  for(let h=0;h<hs;h++){ for(let i=0;i<INPUT_SIZE;i++){ const av= (h<a.hiddenSize? a.w1[h][i]: randW()); const bv= (h<b.hiddenSize? b.w1[h][i]: randW()); child.w1[h][i]= Math.random()<0.5? av: bv; } const ab= h<a.hiddenSize? a.b1[h]: randW()*0.5; const bb= h<b.hiddenSize? b.b1[h]: randW()*0.5; child.b1[h]= Math.random()<0.5? ab: bb; }
  for(let o=0;o<OUTPUT_SIZE;o++){ for(let h=0;h<hs;h++){ const av= h<a.hiddenSize? a.w2[o][h]: randW(); const bv= h<b.hiddenSize? b.w2[o][h]: randW(); child.w2[o][h]= Math.random()<0.5? av: bv; } child.b2[o]= Math.random()<0.5? a.b2[o]: b.b2[o]; }
  child.id=Math.random().toString(36).slice(2,6).toUpperCase(); child.gen=Math.max(a.gen,b.gen)+1;
  return child;
}
function genomeToDNA(g){const flat=[...g.w1.flat(),...g.b1,...g.w2.flat(),...g.b2];return flat.slice(0,32).map(v=>{const q=Math.max(0,Math.min(15,Math.floor((v+1.5)/3*16)));return q.toString(16).toUpperCase();}).join('').replace(/(.{8})/g,'$1 ').trim();}
function traitsFromGenome(g){
  let exp=0,cav=0,rec=0,cui=0,com=0;
  for(let h=0;h<g.hiddenSize;h++){exp+=Math.abs(g.w1[h][0])+Math.abs(g.w1[h][1]); cav+=Math.abs(g.w1[h][4])+Math.abs(g.w1[h][5])+Math.abs(g.w1[h][6]); rec+=Math.abs(g.w1[h][1]); cui+= (1-Math.abs(g.w1[h][7]))*0.5; com+=Math.abs(g.w2[3][h])+Math.abs(g.w2[4][h]);}
  exp/=g.hiddenSize*2; cav/=g.hiddenSize*3; rec/=g.hiddenSize; cui/=g.hiddenSize; com/=g.hiddenSize*2;
  return {exploracion:Math.max(0,Math.min(100,Math.floor(exp*52+18))), construccion:Math.max(0,Math.min(100,Math.floor(cav*58+12))), recoleccion:Math.max(0,Math.min(100,Math.floor(rec*60+18))), cuidado:Math.max(0,Math.min(100,Math.floor(cui*78+15))), comunica:Math.max(0,Math.min(100,Math.floor(com*85+5)))};
}
// === REINA: personalidad única derivada del genoma (6 rasgos 0-100) ===
function queenPersonalityFromGenome(g){
  let fert=0, pher=0, mat=0, dom=0, res=0, lon=0;
  for(let h=0;h<g.hiddenSize;h++){
    fert+= Math.abs(g.w1[h][2])*0.7 + Math.abs(g.b1[h])*0.3 + (1-Math.abs(g.w1[h][7]))*0.2;
    pher+= Math.abs(g.w2[3][h])+Math.abs(g.w2[4][h]);
    mat+= (1-Math.abs(g.w1[h][3]))*0.55 + Math.abs(g.w1[h][1])*0.25 + Math.abs(g.w1[h][7])*0.2;
    dom+= Math.abs(g.w1[h][0])*0.5 + Math.abs(g.w2[0][h])*0.35 + Math.abs(g.b2[0])*0.15;
    res+= (1-Math.abs(g.w1[h][5]))*0.4 + Math.abs(g.b1[h])*0.3 + Math.abs(g.w1[h][4])*0.3;
    lon+= Math.abs(g.b1[h])*0.6 + (1-Math.abs(g.w1[h][6]))*0.4;
  }
  fert/=g.hiddenSize; pher/=g.hiddenSize*2; mat/=g.hiddenSize; dom/=g.hiddenSize; res/=g.hiddenSize; lon/=g.hiddenSize;
  return {
    fertilidad: Math.max(5,Math.min(100,Math.floor(fert*62+28))),
    feromona: Math.max(5,Math.min(100,Math.floor(pher*70+22))),
    maternal: Math.max(5,Math.min(100,Math.floor(mat*68+20))),
    dominancia: Math.max(5,Math.min(100,Math.floor(dom*60+18))),
    resiliencia: Math.max(5,Math.min(100,Math.floor(res*66+22))),
    longevidad: Math.max(5,Math.min(100,Math.floor(lon*64+24)))
  };
}
function getQueenMaxAge(){
  // reina Lasius real 15-29 años (record 28.75a), obrera 1-2a => 7-14x. En juego comprimido: base 16-22d, evoluciona a 42-58d en imperio
  const base = 16 + Math.random()*6; // 16-22 base (realista Lasius, subido de 14)
  const genBonus = (typeof gen!=='undefined'? gen:0)*0.52; // GEN20=+10.4d, GEN40=+20.8d
  const iqBonus = Math.max(0, (typeof colonyIQ!=='undefined'? colonyIQ:100)-105)*0.032; // IQ160=+1.76d, IQ190=+2.72d
  const techBonus = (typeof inventions!=='undefined' && inventions.clay?0.65:0) + (typeof inventions!=='undefined' && inventions.fiber?0.48:0) + (typeof inventions!=='undefined' && inventions.masonry?0.85:0) + (typeof inventions!=='undefined' && inventions.fungus?0.55:0);
  const _lf0=_firstLangFluency();
  const langBonus = (_lf0>0.55?0.72:0) + (_lf0>0.78?0.55:0);
  const wastePenalty = (typeof wastePiles!=='undefined' && wastePiles.length>16? -1.2:0);
  return DAY_LENGTH*(base + genBonus + iqBonus + techBonus + langBonus + wastePenalty);
}
function getMaxPopulation(){
  // MODELO REALISTA K = min(K_espacio, K_comida, K_cuidado) * evoSocial - basado en hormigueros reales
  // Real: Lasius 4-7k (max 40k), Atta 200k-5M, Camponotus 10-20k, Solenopsis 100-500k, Linepithema supercolonia billones
  // En juego comprimido (mapa 64x36=1920 celdas subterráneas): fase aldea 14-60, ciudad 60-300, metrópoli 300-1500, imperio 1500-5000 (abstracto)
  const g = typeof gen!=='undefined'? gen:0;
  const iq = typeof colonyIQ!=='undefined'? colonyIQ:100;
  // K_espacio: cada celda excavada alberga ~1.6 hormigas (con cámaras) - 200 celdas = 320 hormigas; eficiencia mejora con IQ/masonry
  let excavated = 15; try{ excavated = worldStats().open; }catch(e){ excavated = 22 + g*6; }
  const spaceEff = 1.0 + Math.max(0,iq-110)*0.006 + (typeof inventions!=='undefined' && inventions.masonry?0.28:0) + g*0.012;
  const K_space = Math.floor(excavated * 1.55 * spaceEff); // 1.55 ants/cell con eficiencia
  // K_comida: cada hongo sano produce ~0.52 comida/d, cada planta ~0.20/d; cada hormiga consume 0.024/d, reina 0.07/d
  let dailyFood = 0; try{ dailyFood = fungusGardens.filter(f=>f.health>0.5).length*0.52 + plants.length*0.13 + (worldAge>2? 0.7:0); }catch(e){ dailyFood = 1.4 + g*0.16; }
  const foodEff = 1.0 + g*0.035 + Math.max(0,iq-115)*0.007; // agricultura evolutiva
  const K_food = Math.floor((dailyFood * foodEff)/0.024) // 0.032→0.024/d (25% menos hambre);
  // K_cuidado: cada nodriza cuida 7 larvas, cada minim 5; sin nodrizas no hay cría
  let nurses = 1; try{ nurses = workers.filter(w=>w.role==='NODRIZA').length + workers.filter(w=>w.caste==='minim').length*0.6; nurses=Math.max(1,nurses); }catch(e){ nurses=Math.max(1, Math.floor((typeof workers!=='undefined'?workers.length:3)*0.28)); }
  const careEff = 1.0 + g*0.018 + (typeof inventions!=='undefined' && inventions.fungus?0.22:0);
  const K_care = Math.floor(nurses * 7.5 * careEff + 9);
  // K_social: organización (lenguaje, jerarquía) permite densificar sin caos
  const flu = (()=>{ try{ return society.languages[Object.keys(society.languages)[0]]?.fluency||0; }catch(e){return 0}})();
  const socialBonus = 1 + flu*0.55 + Math.max(0,iq-120)*0.004 + g*0.018;
  // K base es el mínimo limitante (como en naturaleza: falta de espacio O comida O nodrizas frena)
  let cap = Math.min(K_space, K_food, K_care);
  // pero la evolución y reinas extra levantan el mínimo (superorganismo)
  cap = Math.floor(cap * socialBonus);
  // bono reinas extra (poliginia real: cada reina +35-50% población, no lineal)
  const extraQueens = Math.max(0, (typeof queens!=='undefined'? queens.length:1)-1);
  if(extraQueens>0) cap = Math.floor(cap * (1 + extraQueens*0.42)); // 2 reinas=1.42x, 3=1.84x
  // fase mínima garantizada aunque K sea bajo al inicio (evita bloqueo GEN0)
  const floorByEvo = 14 + Math.floor(g*3.2) + (iq>115? Math.floor((iq-115)/6)*5:0);
  if(cap < floorByEvo) cap = floorByEvo;
  // higiene penaliza (waste)
  try{ if(typeof wastePiles!=='undefined' && wastePiles.length>14) cap = Math.floor(cap*0.72); }catch(e){}
  // performance / abstracción: visible hasta 650, más allá cada sprite = escuadra de 5 (abstracto)
  // para no lagear, el cap visible es 650, pero el cap real (abstracto) sigue subiendo hasta 5000
  const visibleCap = 650;
  const realCap = Math.min(5000, cap);
  // si queremos mostrar número real en UI, devolvemos realCap pero el motor solo spawnea visible hasta visibleCap
  // para hormiguero real de 40k Lasius, en juego 5000 es "40k comprimido" (1:8)
  // devolvemos el real para cálculos, pero limitamos workers.length a visibleCap en updateBrood (ver abajo)
  if(typeof window!=='undefined') window._realCap = realCap;
  if(typeof window!=='undefined') window._visibleCap = visibleCap;
  return Math.min(realCap, visibleCap + Math.floor(Math.max(0,realCap-visibleCap)/5)); // visible crece lento tras 650 (ej. real 5000 -> visible 650+870=1520)
}

function queenGrowthFromGenome(g, age, maxAge){
  // nivel = gen + edad relativa, talla 48->58 px según longevidad
  const pers=queenPersonalityFromGenome(g);
  const lvl = g.gen*2 + Math.floor(age/DAY_LENGTH*0.35) + Math.floor(pers.longevidad/22);
  const talla = Math.min(58, 48 + pers.longevidad*0.085 + g.hiddenSize*0.45);
  const prog = Math.floor((age/maxAge)*100);
  return {nivel:lvl, talla: talla.toFixed(1), progreso:prog};
}
function ensureQueenMeta(q){
  if(!q.id) q.id='Q'+Math.random().toString(36).slice(2,5).toUpperCase();
  if(!q.personalName) {
    try{
      const nm=genPersonalName({faction:q.faction||0, role:'REINA', affinity:'REINA', caste:'queen', parents:q.parents||[], genome:q.genome, isQueen:true, rank:'REINA', ageDays:q.age? q.age/DAY_LENGTH:0, idCode:q.id});
      q.personalName=nm.name; q.nameMeaning=nm.meaning; q.nameStage=nm.stage;
    }catch(e){ q.personalName=q.name||q.id; q.nameMeaning='reina - feromonas'; q.nameStage='codigo'; }
  }
  if(!q.name) q.name=q.personalName||q.id;
  if(!q.traits) q.traits=traitsFromGenome(q.genome);
  if(!q.personality) q.personality=queenPersonalityFromGenome(q.genome);
  if(!q.mood) q.mood={joy:0.58+Math.random()*0.15, anger:0.04, fear:0.05, sadness:0.06, loyalty:0.88, stress:0.09+Math.random()*0.07};
  if(q.health==null) q.health=100;
  if(q.eggsLaid==null) q.eggsLaid=0;
  if(q.broodTended==null) q.broodTended=0;
  if(!q.children) q.children=[];
  if(!q.history) q.history=[];
  if(!q.parents) q.parents=[];
  if(q.generation==null) q.generation=0;
  if(!q.role) q.role='REINA';
  q.isQueen=true;
  q.caste='queen';
  return q;
}

let queen=ensureQueenMeta({x:CENTER_COL*CELL+8, y:(SURFACE_ROW+8)*CELL+8, genome:makeGenome(), progress:0, state:'GRÁVIDA', age:0, maxAge: DAY_LENGTH*(14+Math.random()*5), generation:0, faction:0, health:100, name:'', personalName:'', nameMeaning:'', nameStage:'', id:'Q'+Math.random().toString(36).slice(2,6).toUpperCase(), eggsLaid:0, broodTended:0, children:[], history:[], parents:[]}); // Topo: placeholders sin nombre - el nombre real lo da freshFounder() al crear la colonia
function freshFounder(opts){
  // Topo: la reina fundadora recibe un nombre ALEATORIO con el patrón fonético de su propia colonia.
  // Antes venía escrita a mano ('Ada') en tres sitios y por eso todas las granjas eran idénticas.
  let q=null;
  try{
    const _fid='Q'+Math.random().toString(36).slice(2,6).toUpperCase();
    let _fn={name:_fid, stage:'codigo', meaning:'reina fundadora'};
    try{
      const _t=genPersonalName({faction:0, role:'REINA', affinity:'NODRIZA', caste:'queen', parents:[], genome:opts.genome, isQueen:true, rank:'LÍDER', ageDays:0, idCode:_fid});
      if(_t && _t.name) _fn=_t;
    }catch(e){ console.warn('nombre fundadora', e.message); }
    q=Object.assign({}, opts, { id:_fid, name:_fn.name, personalName:_fn.name, nameMeaning:'reina fundadora - '+_fn.meaning, nameStage:_fn.stage });
    try{ if(q.history && q.history[0]) q.history[0].msg=`👑 ${_fn.name} eclosiona - Día 0`; }catch(e){}
    try{ society.factions[0].name='Colonia '+_fn.name; society.factions[0].leader=_fid; }catch(e){}
  }catch(e){ console.error('freshFounder', e); q=opts; }
  return ensureQueenMeta(q);
}
let pantryPos={x:CENTER_COL*CELL+8, y:(SURFACE_ROW+6)*CELL+8}; // despensa emergente: donde las ingenieras decidan, no prefijada
function getPantryPos(){ return pantryPos; }
// Topo: las reglas de inicio se traducen al tamaño elegido (64x36 = referencia 1.0)
function worldAreaRatio(){ try{ return Math.max(0.35, Math.min(2.6, (COLS*ROWS)/2304)); }catch(e){ return 1; } }
function startReserveFood(){ return Math.max(5, Math.min(20, Math.round(12*worldAreaRatio()))); }
function startSurfaceFood(){ return Math.max(2, Math.min(10, Math.round(5*worldAreaRatio()))); }
function surfaceFoodCap(){ return Math.max(3, Math.min(14, Math.round(5*worldAreaRatio()*1.6))); }
function findLargestChamber(){
  const visited=Array.from({length:ROWS},()=>Array(COLS).fill(false));
  let best=null, bestSize=0, bestCx=0, bestCy=0;
  for(let r=SURFACE_ROW;r<ROWS;r++) for(let c=0;c<COLS;c++) if(soil[r][c]===0 && !visited[r][c]){
    // BFS
    let q=[[c,r]], idx=0, cells=[];
    visited[r][c]=true;
    while(idx<q.length){
      const [cx,cy]=q[idx++];
      cells.push([cx,cy]);
      for(let [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const nc=cx+dx, nr=cy+dy;
        if(nc<0||nc>=COLS||nr<SURFACE_ROW||nr>=ROWS) continue;
        if(visited[nr][nc]||soil[nr][nc]===1) continue;
        visited[nr][nc]=true; q.push([nc,nr]);
      }
    }
    if(cells.length>bestSize){
      bestSize=cells.length;
      let sx=0,sy=0; for(let [cx,cy] of cells){ sx+=cx; sy+=cy; }
      bestCx=Math.floor(sx/cells.length); bestCy=Math.floor(sy/cells.length);
      best=cells;
    }
  }
  if(best) return {x:bestCx*CELL+8, y:bestCy*CELL+8, size:bestSize};
  return null;
}
let _pantryTimer=0, _queenMoveTimer=0;
let queens=[queen];
queens.forEach(ensureQueenMeta);
if(!_topoHasWorld){
  // Topo: nada existe hasta elegir tamaño
  try{ queens.length=0; queen=null; tlog('[TOPO] queens limpiadas'); }catch(e){}
}
let society={ factions: [{id:0,name:'Colonia fundadora',color:'#ffcc00',members:3,belief:'-',leader:null}], nextFaction:1, wars:0, cults:0, crimes:0, mood:{joy:0.55,anger:0.08,fear:0.05,sadness:0.06,loyalty:0.72,stress:0.12}, languages:{}, langEvo:0 };
 // === SISTEMA DE IDIOMA EMERGENTE ===
 const LANG_CONCEPTS = ['COMIDA','CASA','PELIGRO','REINA','CAVAR','AYUDA','SÍ','NO','AGUA','ENEMIGO','CONSTRUIR','SEGUIR'];
 const LANG_PHONEMES = {
   onset: ['p','t','k','m','n','s','l','r','b','d','g','ch','kr','pl','tr','br'],
   nucleus: ['a','e','i','o','u','ai','ei','au'],
   coda: ['','n','s','r','l','k','m']
 };
 function randChoice(a){ return a[Math.floor(Math.random()*a.length)]; }
// Topo: cada colonia nace con su propio inventario de sonidos. Mientras el lenguaje evoluciona,
// los nombres salen de ESE inventario -> cada granja suena a su granja (no a un listado fijo).
let _curPool=null; const _callUsed=new Set();
function resetNameRegistry(){ try{ _callUsed.clear(); }catch(e){} }
function _pickN(arr,n){ const a=arr.slice(), out=[]; while(out.length<n && a.length) out.push(a.splice(Math.floor(Math.random()*a.length),1)[0]); return out; }
function genSyllable(pool){ const P=pool||_curPool||LANG_PHONEMES; const co=(P.coda&&P.coda.length)?P.coda:['']; return randChoice(P.onset) + randChoice(P.nucleus) + (Math.random()<(P.codaRate!==undefined?P.codaRate:0.35)? randChoice(co): ''); }
function genWord(pool){ const P=pool||_curPool||LANG_PHONEMES; const syls = 1 + Math.floor(Math.random()*2.6); let w=''; for(let i=0;i<syls;i++) w+=genSyllable(P); return w.slice(0,7); }
function _pheromoneCall(){
  // grito de feromona aleatorio, pero con los fonemas de esta colonia; sin repetir entre vecinas
  const P=_curPool||LANG_PHONEMES;
  for(let k=0;k<12;k++){
    let s=randChoice(P.onset)+randChoice(P.nucleus);
    if(Math.random()<(P.codaRate!==undefined?P.codaRate:0.35)) s+=randChoice((P.coda&&P.coda.length)?P.coda:['n']);
    if(s.length<3) s+=randChoice(P.nucleus);
    s=s[0].toUpperCase()+s.slice(1);
    if(!_callUsed.has(s)){ if(_callUsed.size>600) _callUsed.clear(); _callUsed.add(s); return s.slice(0,6); }
  }
  const f=(randChoice(P.onset)+randChoice(P.nucleus)+((1+Math.floor(Math.random()*9))+''));
  return f.slice(0,6);
}
 function initLanguage(factionId){
   if(society.languages[factionId]) return society.languages[factionId];
   // al inicio no tienen idioma humano, solo sistema real de hormigas (feromonas)
   const pool={ onset:_pickN(LANG_PHONEMES.onset, 5+Math.floor(Math.random()*5)), nucleus:_pickN(LANG_PHONEMES.nucleus, 3+Math.floor(Math.random()*3)), coda:_pickN(LANG_PHONEMES.coda, 3+Math.floor(Math.random()*3)), codaRate:+(0.18+Math.random()*0.34).toFixed(3) };
   const lex={}; LANG_CONCEPTS.forEach(c=> lex[c]=genWord(pool));
   const grammar={ order: Math.random()<0.5? 'SVO':'SOV', plural: randChoice(['-a','-i','-en','-ka']), past: randChoice(['-ta','-na','-ra','-te']) };
   const lang={ faction:factionId, lex, grammar, pool, fluency:0.0, age:0, utterances:0, dict: {}, stage:'feromonas' };
   society.languages[factionId]=lang;
   return lang;
 }
 function getLanguage(factionId){ return society.languages[factionId] || initLanguage(factionId); }
 function evolveLanguages(dt){
   // realista: lenguaje humano no aparece en GEN2 en 0.6d - lleva generaciones y días
   const canEvolve = gen>=4 && colonyIQ>132 && workers.length>=7 && time > DAY_LENGTH*2.4 && deliveries>=30;
   const targetFluency = canEvolve ? Math.min(1, ((gen-4)*0.085 + (colonyIQ-132)/320 + society.langEvo*0.08)) : 0;
   for(let fid in society.languages){
     const lang=society.languages[fid];
     lang.age+=dt;
     if(!canEvolve){
       lang.stage='feromonas';
       lang.fluency = Math.max(0, lang.fluency - 0.00002*dt);
       continue;
     }
     // etapas: feromonas -> señales simples -> balbuceo -> proto-idioma -> idioma
     if(lang.fluency<0.18) lang.stage='señales';
     else if(lang.fluency<0.32) lang.stage='balbuceo';
     else if(lang.fluency<0.58) lang.stage='proto';
     else lang.stage='idioma';
     const interactions = workers.filter(w=>w.faction==fid).reduce((s,w)=>s+w.commsSent,0)/Math.max(1, workers.length);
     const inc = (0.000012 + targetFluency*0.000074 + interactions*0.0000032)*dt; // ~8x más lento: fluido en días no segundos
     lang.fluency = Math.min(1, Math.max(0, lang.fluency + inc));
     // estabilizar léxico: con fluidez media, palabras dejan de ser aleatorias y se fijan
     if(lang.fluency>0.38 && lang.fluency<0.62 && Math.random()<0.008){
       const c=randChoice(LANG_CONCEPTS);
       lang.lex[c]=genWord();
     }
     // a alta fluidez, refinar gramática para que sea más regular (sufijos consistentes)
     if(lang.fluency>0.75 && Math.random()<0.004){
       lang.grammar.plural = lang.grammar.plural; // ya estable
     }
     society.langEvo += 0.000004*dt; // lento
     // RENOMBRE EVOLUTIVO - hormigas vivas adoptan nombre más personal cuando su lengua avanza (realidad: nombre con sentido solo con habilidad lingüística)
     if(canEvolve && lang.fluency>0.18){
       // Topo: cuando la lengua de la colonia da un paso, la colonia ENTERA se rebautiza (bautizo visible);
       // aparte, cada día alguna adopta un nombre nuevo por su cuenta. Antes el goteo era 0.00009/tick: nunca.
       let _bautizos=0, _curStageName='';
       for(let w of workers){
         if(String(w.faction)!==String(fid)) continue;
         let curStage=getNameStageForLang(getLanguage(w.faction));
         _curStageName=curStage;
         const _burst = !!w.nameStage && w.nameStage!==curStage;
         if(_burst || Math.random()<0.0022*dt){
           const nn=_applyName(w, {faction:w.faction, role:w.role, affinity:w.affinity, caste:w.caste, parents:w.parents, genome:w.genome, isQueen:w.isQueen, rank:w.rank, ageDays:w.age/DAY_LENGTH, idCode:w.id}, !_burst);
           w.nameStage=nn.stage||curStage;
           if(_burst) _bautizos++;
         }
       }
       if(_bautizos>0) pushEvent('evo', `🗣 Bautizo en la colonia: ${_bautizos} nombres nuevos`, `La lengua pasó a "${_curStageName}" y todas adoptan el nuevo patrón`);
       for(let q of queens){
         let curStage=getNameStageForLang(getLanguage(q.faction));
         let qStage=q.nameStage||'codigo';
         if(qStage!==curStage || Math.random()<0.0004*dt){
           let old=q.personalName||q.name;
           let nn=genPersonalName({faction:q.faction, role:'REINA', affinity:'NODRIZA', caste:'media', parents:[], genome:q.genome, isQueen:true, rank:'LÍDER', ageDays:q.age/DAY_LENGTH, idCode:q.name||'Q'});
           q.personalName=nn.name; q.name=nn.name; q.nameMeaning=nn.meaning; q.nameStage=nn.stage;
           if(Math.random()<0.2) pushEvent('evo', `👑 Reina ${old} ahora es ${nn.name} - ${nn.meaning}`, `Título evolutivo - ${nn.stage}`);
         }
       }
     }
   }
   // si no hay lenguaje, crearlo al llegar a GEN1
   if(gen>=2 && Object.keys(society.languages).length===0) initLanguage(0);
 }
 function antUtterance(ant, concept){
   const lang=getLanguage(ant.faction);
   lang.utterances++;
   const base = lang.lex[concept] || genWord();
   // etapa real de hormigas: sin idioma humano, solo sonidos cortos o feromona
   if(lang.stage==='feromonas' || lang.fluency<0.12){
     return ''; // no hay frase humana aún, usan feromonas que ya se ven como ⬢
   }
   if(lang.stage==='señales' || lang.fluency<0.22){
     return base.slice(0,3);
   }
   if(lang.fluency<0.32){
     return genSyllable() + ' ' + genSyllable();
   }
   if(lang.fluency<0.55){
     return base;
   }
   // fluidez media-alta: frase simple con orden y partícula
   const subj = lang.lex['REINA'] || 'na';
   const verb = base;
   const obj = concept==='COMIDA'? lang.lex['COMIDA'] : '';
   let phrase='';
   if(lang.grammar.order==='SVO') phrase = `${subj} ${verb} ${obj}`.trim();
   else phrase = `${obj} ${subj} ${verb}`.trim();
   // plural/pasado si concepto lo requiere y fluidez alta
   if(lang.fluency>0.72 && concept==='COMIDA' && ant.food) phrase += lang.grammar.plural;
   return phrase;
 }
 function translateUtterance(factionId, phrase){
   const lang=getLanguage(factionId);
   // traducción inversa: buscar concepto por palabra
   for(let c in lang.lex){ if(phrase.includes(lang.lex[c])) return c + (lang.fluency>0.6? ` (${lang.grammar.order})` : ''); }
   return '(gibberish)';
 }

// === SISTEMA DE NOMBRES EVOLUTIVO - de código hormiga real a nombre personal con sentido ===
function roleToConcept(role, affinity){
  const r = role || affinity || 'GENERALISTA';
  if(r==='EXCAVADORA') return 'CAVAR';
  if(r==='NODRIZA') return 'REINA';
  if(r==='EXPLORADORA') return 'CASA'; // las que encuentran camino a casa
  if(r==='RECOLECTORA') return 'COMIDA';
  if(r==='OBRERA' && affinity==='EXCAVADORA') return 'CAVAR';
  if(r==='OBRERA' && affinity==='NODRIZA') return 'REINA';
  return 'AYUDA';
}
function _applyName(ant, opts, quiet){
  // Topo: renombrar con guarda de unicidad - dos hormigas de la misma colonia no acaban llamandose igual
  const old=ant.personalName||ant.id;
  let nn=genPersonalName(opts)||{name:old};
  for(let k=0;k<3;k++){ if(!nn.name || !_nameClashes(nn.name, ant)) break; const t=genPersonalName(opts); if(!t || !t.name || !_nameClashes(t.name, ant)) break; nn=t; }
  if(nn.name && _nameClashes(nn.name, ant)){ nn.name=String(nn.name).slice(0,6)+'·'+String(ant.id||'').slice(-2); nn.meaning=(nn.meaning||'')+' · variante del linaje'; }
  ant.personalName=nn.name; ant.nameMeaning=nn.meaning; ant.nameStage=nn.stage;
  if(ant===queen || ant.isQueen) ant.name=nn.name;
  if(!quiet && nn.name!==old && Math.random()<0.5) pushEvent('evo', `🗣 ${old} → ${nn.name} - ${nn.meaning}`, `Renombre lingüístico - ${nn.stage} - F${ant.faction}`);
  return nn;
}
function _nameClashes(n, self){
  try{
    for(let a of workers){ if(a!==self && a.personalName===n) return true; }
    for(let a of queens){ if(a!==self && (a.personalName===n||a.name===n)) return true; }
    return false;
  }catch(e){ return false; }
}
function getNameStageForLang(lang){
  if(!lang || lang.fluency<0.12 || lang.stage==='feromonas') return 'codigo';
  if(lang.stage==='señales' || lang.fluency<0.22) return 'senales';
  if(lang.stage==='balbuceo' || lang.fluency<0.33) return 'balbuceo';
  if(lang.stage==='proto' || lang.fluency<0.60) return 'proto';
  return 'idioma';
}
function genPersonalName(opts){
  // opts: faction, role, affinity, caste, parents(array), genome, isQueen
  const faction = opts.faction!=null? opts.faction : 0;
  const lang = getLanguage(faction);
  const stage = getNameStageForLang(lang);
  _curPool = (lang && lang.pool) ? lang.pool : null; // Topo: la lengua de la facción manda sobre el nombre
  // gen/colIQ globales no necesarios aquí - el nombre depende del idioma de la facción
  const idCode = opts.idCode || ((opts.isQueen?'Q':'A')+Math.random().toString(36).slice(2,5).toUpperCase());
  // feromonas: código puro hormiga real
  if(stage==='codigo'){
    // Topo: antes de tener idioma no hay "Ada" para todas: cada una nace con su llamada de feromona
    // (aleatoria, pero construida con los sonidos de ESTA colonia). El id interno queda en el significado.
    const _call=_pheromoneCall();
    return {name:_call, stage:'codigo', meaning:'llamada de feromona - sin idioma aún · '+idCode};
  }
  if(stage==='senales'){
    // señal corta 2-3 letras, como graznido
    let sig = genSyllable().replace(/[aeiou]/g,'').slice(0,2).toUpperCase() || 'Tk';
    if(Math.random()<0.5) sig = genSyllable().slice(0,2).toUpperCase();
    return {name:sig, stage:'senales', meaning:`señal corta - sin palabra aún`};
  }
  if(stage==='balbuceo'){
    // gibberish 2 sílabas, simlish pero con fonética consistente de su facción
    let w = genWord(); // 4-7 letras
    w = w[0].toUpperCase()+w.slice(1);
    return {name:w, stage:'balbuceo', meaning:`balbuceo - aún sin raíz fija`};
  }
  // proto y idioma: raíz + sufijo con sentido según rol/afinidad
  let concept = roleToConcept(opts.role, opts.affinity);
  let lexWord = (lang.lex[concept]||genWord()).toLowerCase();
  let suffix = lexWord.slice(0,3); // 3 letras del concepto
  // raíz: tomar sílaba de padre o generar nueva
  let root='';
  if(opts.parents && opts.parents.length>0){
    // buscar nombre personal del padre si existe
    let parentAnt = [...workers, ...queens].find(a=> opts.parents.includes(a.id) || opts.parents.includes(a.personalName));
    if(parentAnt && parentAnt.personalName && parentAnt.personalName.length>2 && Math.random()<0.55){
      // hereda 2 letras del padre (linaje)
      root = parentAnt.personalName.slice(0,2);
    } else if(opts.parents[0]){
      root = opts.parents[0].slice(0,2);
    }
  }
  if(!root || root.length<2) root = genSyllable();
  root = root[0].toUpperCase()+root.slice(1).toLowerCase();
  // caste marca: minim añade -i, major añade -ar
  let casteMark='';
  if(opts.caste==='minim') casteMark='i';
  else if(opts.caste==='major') casteMark='ar';
  let name='';
  let meaning='';
  if(stage==='proto'){
    // proto: Root-suffix  Ej: Kira-rok (kira individuo + rok=cavar)
    name = `${root}-${suffix}${casteMark}`;
    meaning = `${root.toLowerCase()} 'indiv.' + ${suffix} '${concept.toLowerCase()}' (${lexWord})`;
  } else {
    // idioma: nombre completo con linaje y marca social
    // Topo: linaje real = prefijo del nombre de la fundadora; líderes/jefes llevan prefijo de título
    let title='';
    if(opts.isQueen) title='♛ ';
    else if(opts.rank==='LÍDER') title='Zha ';
    else if(opts.rank==='JEFE') title='Dar ';
    // orden según gramática de su lengua
    if(lang.grammar.order==='SOV'){
      name = `${title}${suffix}${casteMark} ${root}`.trim();
      meaning = `${suffix} '${concept.toLowerCase()}' + ${root.toLowerCase()} linaje - ${lang.grammar.order}`;
    } else {
      name = `${title}${root} ${suffix}${casteMark}`.trim();
      meaning = `${root.toLowerCase()} + ${suffix} '${concept.toLowerCase()}' - ${lang.grammar.order}`;
    }
    // a alta fluidez >0.75, añade sufijo plural/pasado si es veterana
    if(lang.fluency>0.75 && opts.ageDays>1.2 && Math.random()<0.25){
      name += lang.grammar.plural.replace('-','');
      meaning += ` ${lang.grammar.plural} plural`;
    }
  }
  // facción dialecto: facciones distintas tienen léxico distinto, ya se nota en suffix diferente
  return {name, stage, meaning};
}
function antDisplayName(ant){
  return ant.personalName || ant.id;
}
function antFullLabel(ant){
  if(ant.personalName && ant.personalName!==ant.id) return `${ant.personalName} · ${ant.id}`;
  return ant.id;
}
function queenDisplayName(q){
  return q.personalName || q.name || q.id;
}


let nextAntFaction=0;
// tiempo y clima - día de 20 min reales (72000 time units) EXACTO Minecraft: 20 min = 1 día, 10 min día + 7 noche + 1.5 amanecer/atard
let day = 1;
let weather={type:'clear', intensity:0, timer:0, nextChange: 800+Math.random()*1200, rainParticles:[]};
let lightningTimer=0, isNight=false;
let brood=[];
let workers=[];
let fungusGardens=[], wastePiles=[]; // v8 realismo: jardines fúngicos y basureros separados
function _firstLangFluency(){ try{ for(let k in society.languages){ const l=society.languages[k]; if(l && typeof l.fluency==='number') return l.fluency; } }catch(e){} return 0; }
function makeAnt(genome, pos=null, opts={}){
  const g=genome? JSON.parse(JSON.stringify(genome)) : makeGenome();
  const traits=traitsFromGenome(g);
  // v8 realismo: casta morfológica antes de calcular vida
  const _cRoll=Math.random(); let _caste='media'; if(_cRoll<0.24) _caste='minim'; else if(_cRoll<0.84) _caste='media'; else _caste='major'; if(opts.caste) _caste=opts.caste;
  const _cropMax = _caste==='minim'? 1.2 : _caste==='major'? 2.0 : 1.6;
  // sin trabajo preestablecido: todas nacen OBRERA común, la jerarquía y oficio emergen con inteligencia
  let role='OBRERA';
  // inclinación oculta por genoma, pero no se asigna hasta que la colonia aprenda
  const vals=[traits.exploracion,traits.construccion,traits.recoleccion,traits.cuidado];
  const maxV=Math.max(...vals);
  let affinity='GENERALISTA';
  if(traits.construccion===maxV) affinity='EXCAVADORA';
  else if(traits.exploracion===maxV) affinity='EXPLORADORA';
  else if(traits.cuidado===maxV) affinity='NODRIZA';
  else affinity='RECOLECTORA';
  const startPos= pos || {x:CENTER_COL*CELL+8 + (Math.random()-0.5)*48 + (Math.random()<0.5?-60:60)*(Math.random()*0.4), y:SURFACE_Y-6};
  // vida y ánimo
  // EVOLUCIÓN LONGEVIDAD REALISTA - Lasius niger real: obrera 1-2años (lab 4a), reina 15-29años (7-14x)
  // En nuestro universo comprimido (1 año real = 48d juego), evolucionan como humanos 30→80 años: higiene + medicina + lenguaje + hongo antibiótico
  // Base 2.9-4.5d + evolución puede llevar a 14-18d en metrópoli (x3.5), reina 3x - permite N=λ*W de 15 → 800
  let _fgOk=0; if(typeof fungusGardens!=='undefined' && fungusGardens){ for(let _i=0;_i<fungusGardens.length;_i++) if(fungusGardens[_i].health>0.58) _fgOk++; }
  const _langFl=_firstLangFluency();
  const _evoLongDays = gen*0.28 + Math.max(0, colonyIQ-100)*0.018 + (typeof inventions!=='undefined' && inventions.clay?0.38:0) + (typeof inventions!=='undefined' && inventions.fiber?0.24:0) + (typeof inventions!=='undefined' && inventions.masonry?0.55:0) + _fgOk*0.22 + (_langFl>0.55?0.42:0) + (wastePiles && wastePiles.length>14?-0.35:0);
  const maxAge = DAY_LENGTH*(3.1 + Math.random()*1.7) + traits.cuidado*DAY_LENGTH*0.018 + (role==='NODRIZA'? DAY_LENGTH*0.62 : 0) + (_caste==='major'? DAY_LENGTH*0.38: _caste==='minim'? -DAY_LENGTH*0.14:0) + _evoLongDays*DAY_LENGTH; // casta + evolución realista comprimida
  const isQueenLarva = opts.isQueen || false;
  // jerarquía emergente: todas empiezan sin rango, con el tiempo aparecen líderes
  const rank = opts.rank || 'OBRERA';
  const hierarchy = { level: 0, boss: null, subordinates: [] }; // 0 obrera, 1 capataz, 2 jefe, 3 líder
  const _idCode=(isQueenLarva?'Q':'A')+Math.random().toString(36).slice(2,5).toUpperCase();
  let _naming={name:_idCode, stage:'codigo', meaning:'código'};
  try{ const _factionForName = opts.faction!==undefined? opts.faction : (queens[0]? queens[0].faction : 0); _naming = genPersonalName({faction:_factionForName, role:role, affinity:affinity, caste:_caste, parents:opts.parents||[], genome:g, isQueen:isQueenLarva, rank:rank, ageDays:0, idCode:_idCode}); if(_naming && _naming.name && _nameClashes(_naming.name)){ _naming={name:String(_naming.name).slice(0,6)+'·'+_idCode.slice(-2), stage:_naming.stage, meaning:_naming.meaning}; } }catch(e){}
  return {id:_idCode, personalName:_naming.name, nameMeaning:_naming.meaning, nameStage:_naming.stage, x:startPos.x, y:startPos.y, _renderX:startPos.x, _renderY:startPos.y, _walkPhase:Math.random()*6.28, _bobPhase:Math.random()*6.28, angle:Math.random()*Math.PI*2, speed:1.7+Math.random()*0.5, state:'EXPLORAR', food:null, targetFood:null, fatigue:Math.random()*12, fitness:0,
    caste:_caste, crop:0, cropMax:_cropMax, tandemPartner:null, tandemCooldown:0,
    age:0, maxAge, health:100, isQueen:isQueenLarva,
    mood:{joy:0.5+Math.random()*0.2, anger:Math.random()*0.08, fear:Math.random()*0.06, sadness:Math.random()*0.07, loyalty:0.62+Math.random()*0.18, stress:0.08+Math.random()*0.08},
    faction: opts.faction!==undefined? opts.faction : (queens[0]?.faction||0),
    belief: null, aggression: 0.12 + Math.random()*0.18 + traits.comunica*0.0015, crimes:0, followers:0,
    genome:g, traits, role, affinity, rank, hierarchy, jobAge:0, lastJob:'NADA',
    deliveries:0, digsDone:0, commsSent:0, lastInk:0, lastPhero:0, blocked:0, selected:false, digTarget:null, digProgress:0, digNeeded:14, commOut:[0,0], sensors:{}, nnHidden:[], nnOut:[],
    parents: opts.parents||[], children:[], history:[], birthDay: day, deathDay:null }
}
if(_topoHasWorld){
  for(let i=0;i<5;i++){
    const off = (i-2)*26;
    workers.push(makeAnt(mutateGenome(queen.genome,0.18,0.6).genome, {x: CENTER_COL*CELL+8 + off + (Math.random()-0.5)*10, y: SURFACE_Y-6}));
  }
  workers.forEach((w,i)=> w.angle = (i*2.1) + Math.random()*0.6);
  if(workers[0]) workers[0].selected=true;
} else { tlog('[TOPO] workers diferidos'); }

// TOPO: crea mundo solo cuando eliges tamaño — nada existe antes
function topoCreateFreshWorld(cols, rows){
  tlog('[TOPO] topoCreateFreshWorld', cols, rows);
  COLS=cols; ROWS=rows; if(typeof CENTER_COL!=='undefined') CENTER_COL=Math.floor(COLS/2);
  if(typeof W!=='undefined'){ W=COLS*CELL; H=ROWS*CELL; const cv=document.getElementById('farmCanvas'); if(cv){ cv.width=W; cv.height=H; } }
  if(typeof soilCacheCanvas!=='undefined'){ try{ soilCacheCanvas.width=W; soilCacheCanvas.height=H; }catch(e){} }
  _topoHasWorld=true;
  // limpiar previos por si había restos
  try{ workers.length=0; queens.length=0; foods.length=0; brood.length=0; mound.length=0; hiddenRewards.length=0; particles.length=0; pheromones.length=0; commInks.length=0; }catch(e){}
  day=1; time=DAY_LENGTH*0.28; deliveries=0; digs=0; gen=0; worldAge=0; colonyFood=Math.max(2,Math.round(startReserveFood()/2)); colonyFitness=0;
  try{ initSoil(); }catch(e){ console.error('initSoil fresh',e); }
  // Topo: la despensa y la lengua son de ESTE mundo. Antes la despensa se quedaba en las coordenadas
  // del mapa de referencia (64x36) y en un 48x28 caia dentro de tierra intacta -> miel "almacenada"
  // sin haber cavado nada. Ahora se siembra dentro del tunel del nido ya abierto.
  try{
    pantryPos={x:CENTER_COL*CELL+8, y:(SURFACE_ROW+8)*CELL+8};
    const _ppc=Math.floor(pantryPos.x/CELL), _ppr=Math.floor(pantryPos.y/CELL);
    if(!soil[_ppr] || soil[_ppr][_ppc]!==0){
      const _big=findLargestChamber();
      if(_big){ pantryPos.x=_big.x; pantryPos.y=_big.y; }
    }
  }catch(e){ console.warn('pantry fresh', e.message); }
  try{ society=Object.assign({}, society, { factions:[{id:0,name:'Colonia fundadora',color:'#ffcc00',members:1,belief:'-',leader:null}], nextFaction:1, wars:0, cults:0, crimes:0, languages:{}, langEvo:0 }); }catch(e){}
  // 4 comidas iniciales variadas
  try{ const _sf=startSurfaceFood(); for(let i=0;i<_sf;i++){ const typ=['honey','berry','seed','mushroom'][i%4]; spawnFoodSurface(Math.random()*(W-160)+80,1+Math.floor(Math.random()*2), typ); } }catch(e){}
  // reina + 5 obreras
  try{
    resetNameRegistry();
    initLanguage(0); // Topo: la colonia elige sus sonidos al fundarse -> de ahí salen TODOS los nombres
    queen=freshFounder({x:CENTER_COL*CELL+8, y:(SURFACE_ROW+8)*CELL+8, genome:makeGenome(), progress:0, state:'GRÁVIDA', age:0, maxAge: DAY_LENGTH*(14+Math.random()*5), generation:0, faction:0, health:100, eggsLaid:0, broodTended:0, children:[], history:[{day:0,time:0,msg:'👑 fundadora eclosiona - Día 0'}], parents:[]});
    queens=[queen]; queens.forEach(ensureQueenMeta);
    try{ if(society.factions[0]) society.factions[0].members=workers.length+1; }catch(e){}
    for(let i=0;i<5;i++){
      const off=(i-2)*26;
      workers.push(makeAnt(mutateGenome(queen.genome,0.18,0.6).genome, {x: CENTER_COL*CELL+8 + off + (Math.random()-0.5)*10, y: SURFACE_Y-6}));
    }
    workers.forEach((w,i)=> w.angle=(i*2.1)+Math.random()*0.6);
    if(workers[0]) workers[0].selected=true;
  }catch(e){ console.error('queen/workers fresh',e); }
  markSoilDirty(); try{ markSoilDirty(); }catch(e){}
  // ajuste anti-extinción aplicado al nacer el mundo (antes corría en load y crasheaba)
  try{
    colonyFood=startReserveFood(); if(queen) queen.progress=0; digs=0;
    const _sf2=startSurfaceFood(); const _spread=Math.max(24, Math.round(38*worldAreaRatio()*0.9));
    for(let i=0;i<_sf2;i++) spawnFoodSurface(CENTER_COL*CELL+8 + (Math.random()-0.5)*(_spread*3) + (i-Math.floor(_sf2/2))*_spread, 1+Math.floor(Math.random()*1.6));
    lastSpawn=time;
  }catch(e){}
  try{ view.x=(W - W/(view.zoom||1.38))/2; view.y=12; clampView(); }catch(e){}
  tlog('[TOPO] mundo fresco creado', COLS, ROWS, workers.length);
  try{ localStorage.setItem('antfarm_worldAlive','1'); localStorage.setItem('antfarm_inGame','1'); localStorage.setItem('antfarm_createdAt', new Date().toISOString()); }catch(e){}
  // Topo: el primer guardado se hace AL SIGUIENTE frame - escribir localStorage en el click
  // hacia que crear un mundo pequeno costara lo mismo que uno grande (era coste fijo).
  try{ setTimeout(()=>{ try{ serializeSave(true); }catch(e){} }, 0); }catch(e){}
  try{ setTimeout(()=>{ if(typeof _updateBothAntCounts==='function') _updateBothAntCounts(); if(typeof updateColonyUI==='function') updateColonyUI(); }, 120); }catch(e){}
}
window.topoCreateFreshWorld=topoCreateFreshWorld;
// === JERARQUÍA LABORAL EMERGENTE ===
function updateHierarchy(dt){
  if(workers.length<4 || gen<2 || colonyIQ<112) return;
  // realista: jerarquía no aparece al instante - reevalúa cada ~0.62d (~12 min a x1)
  if(!window._hierTimer) window._hierTimer=0;
  window._hierTimer+=dt;
  if(window._hierTimer < DAY_LENGTH*0.62) return;
  window._hierTimer=0;
  // puntuar a cada obrera por lo que más ha hecho + fitness + IQ
  workers.forEach(w=>{
    w.jobAge+=dt;
    const ageDays = w.age/DAY_LENGTH;
    // polietismo temporal real: jóvenes nodrizas, medianas constructoras, viejas forrajeras
    if(w.role==='OBRERA' && w.jobAge > DAY_LENGTH*0.42){
      const need = {EXCAVADORA: workers.filter(x=>x.role==='EXCAVADORA').length, EXPLORADORA: workers.filter(x=>x.role==='EXPLORADORA').length, NODRIZA: workers.filter(x=>x.role==='NODRIZA').length, RECOLECTORA: workers.filter(x=>x.role==='RECOLECTORA').length};
      const scarcest = Object.entries(need).sort((a,b)=>a[1]-b[1])[0][0];
      let agePreferred=null;
      if(ageDays < 0.52) agePreferred='NODRIZA';
      else if(ageDays < 1.15) agePreferred='EXCAVADORA';
      else agePreferred = Math.random()<0.62?'RECOLECTORA':'EXPLORADORA';
      // caste modula: minim tiende a nodriza, major a defensa/exploradora
      if(w.caste==='minim' && Math.random()<0.28) agePreferred='NODRIZA';
      if(w.caste==='major' && Math.random()<0.32) agePreferred='EXPLORADORA';
      const r=Math.random();
      if(r<0.42) w.role=agePreferred;
      else if(r<0.78) w.role=w.affinity;
      else w.role=scarcest;
      w.jobAge=0; w.lastJob=w.role;
      pushEvent('evo', `🔧 ${w.id} asume oficio ${w.role}`, `Afinidad ${w.affinity} - Hier emergente`);
    }
    // jerarquía: elige líderes por fitness + seguidores + cuidado
    const score = w.fitness*1.4 + w.deliveries*0.12 + w.digsDone*0.09 + w.traits.cuidado*0.02 + w.traits.comunica*0.03 - w.mood.stress*0.5;
    w._hierScore = score;
  });
  // ordenar y asignar rangos
  const sorted=[...workers].sort((a,b)=>b._hierScore - a._hierScore);
  const n=sorted.length;
  // líder único si hay suficiente diferencia
  if(n>=5 && sorted[0]._hierScore > sorted[1]._hierScore*1.32 && sorted[0].deliveries+sorted[0].digsDone>10){ // líder necesita más mérito
    sorted.forEach(w=>{ w.hierarchy.level=0; w.rank='OBRERA'; w.hierarchy.boss=null; });
    sorted[0].hierarchy.level=3; sorted[0].rank='LÍDER';
    sorted[0].hierarchy.subordinates = sorted.slice(1,3).map(x=>x.id);
    if(n>=3){ sorted[1].hierarchy.level=2; sorted[1].rank='JEFE'; sorted[1].hierarchy.boss=sorted[0].id; }
    if(n>=4){ sorted[2].hierarchy.level=2; sorted[2].rank='JEFE'; sorted[2].hierarchy.boss=sorted[0].id; }
    for(let i=3;i<Math.min(n,6);i++){ sorted[i].hierarchy.level=1; sorted[i].rank='CAPATAZ'; sorted[i].hierarchy.boss=sorted[i%2?1:2]?.id || sorted[0].id; }
    // notificar si hay nuevo líder
    if(!window._lastLeader || window._lastLeader!==sorted[0].id){
      window._lastLeader=sorted[0].id;
      pushEvent('evo', `👑 Jerarquía: ${sorted[0].id} asciende a LÍDER`, `Capatazes: ${sorted.slice(3,6).map(x=>x.id).join(', ')}`);
    }
  } else {
    // sin líder claro, todos obreros o capataces temporales
    sorted.forEach((w,i)=>{
      if(i<2 && w._hierScore>1.2){ w.hierarchy.level=1; w.rank='CAPATAZ'; }
      else { w.hierarchy.level=0; w.rank='OBRERA'; }
    });
  }
}
let fitnessHistory=[0];
let lastMutInfo="- fundación pixel 11→8→5 -";


// === HISTORIA IMPORTANTE - drawer tuyo desplegable ===
let importantHistory=[];
let _hasNewHistory=false;
function pushImportant(type, title, detail){
  const t=new Date().toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'});
  const item={type, title, detail, time:t, day};
  importantHistory.unshift(item);
  if(importantHistory.length>90) importantHistory.pop();
  _hasNewHistory=true;
  try{ const fab=document.getElementById('historyFab'); if(fab){ fab.classList.add('hasNew'); fab.textContent='📜*'; } }catch(e){}
  try{ renderHistoryDrawer(); }catch(e){}
  try{ if(typeof pushEvent==='function' && type!=='evo') pushEvent(type, title, detail); }catch(e){}
}
function renderHistoryDrawer(){
  const body=document.getElementById('historyBody');
  if(!body) return;
  body.innerHTML='';
  const filter=document.getElementById('historyFilter')?.value || 'all';
  let list=importantHistory;
  if(filter!=='all') list=list.filter(x=>x.type===filter);
  list.slice(0,45).forEach(it=>{
    const div=document.createElement('div');
    div.className='hd-item '+it.type;
    div.innerHTML=`<div style="font-family:'Press Start 2P';font-size:7px;color:#8a7a5a">[${it.time}] D${it.day} - ${it.type.toUpperCase()}</div><div style="font-weight:bold;color:#fff;margin-top:2px">${it.title}</div>${it.detail?`<div style="color:#c9b896;margin-top:2px">${it.detail}</div>`:''}`;
    body.appendChild(div);
  });
  const count=document.getElementById('historyCount');
  if(count) count.textContent=importantHistory.length+' eventos';
}
function toggleHistory(open){
  const d=document.getElementById('historyDrawer');
  const fab=document.getElementById('historyFab');
  if(!d) return;
  const willOpen = open!==undefined ? open : !d.classList.contains('open');
  d.classList.toggle('open', willOpen);
  if(willOpen){ _hasNewHistory=false; try{ if(fab){ fab.classList.remove('hasNew'); fab.textContent='📜'; } }catch(e){} }
}

function pushEvent(type, msg, detail=""){
  const t=new Date().toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  events.unshift({type, msg, detail, time:t, gen});
  if(events.length>80) events.pop();
  renderEvents();
}
function logAntHistory(ant, msg){
  if(!ant.history) ant.history=[];
  ant.history.unshift({day, time: (time%DAY_LENGTH)/DAY_LENGTH*24, msg});
  if(ant.history.length>12) ant.history.pop();
  // también para la reina si es su hijo
  if(ant.parents && ant.parents[0]){
    const q=queens.find(q=> q.name===ant.parents[0] || q.id===ant.parents[0]);
    if(q && !q.history) q.history=[];
    if(q && q.history) { q.history.unshift({day, msg: `${ant.id} ${msg}`}); if(q.history.length>10) q.history.pop(); }
  }
}
function renderEvents(){
  const el=document.getElementById('eventLog');
  if(!el) return;
  el.innerHTML='';
  events.slice(0,30).forEach(e=>{
    const div=document.createElement('div'); div.className='evt '+e.type;
    div.innerHTML=`<time>[${e.time}] GEN${e.gen} - ${e.type.toUpperCase()}</time><br>${e.msg}${e.detail?`<br><small style="color:#8a7a5a">${e.detail}</small>`:''}`;
    el.appendChild(div);
  });
}
function checkRewardDiscovery(c,r){
  hiddenRewards.forEach(rew=>{
    if(!rew.found && Math.abs(rew.c-c)<=1 && Math.abs(rew.r-r)<=1){
      rew.found=true; rewardsFound++;
      const def = (typeof TREASURE_DEFS!=='undefined' && TREASURE_DEFS[rew.type]) ? TREASURE_DEFS[rew.type] : null;
      let handled=false;
      if(rew.type==='semillas'){ colonyFood+=10; pushEvent('discover','¡SEMILLAS!','+10 comida'); notifyCanon('🌾 SEMILLAS', 'Descubriste semillas - +10 comida', 5000); for(let i=0;i<16;i++) particles.push({x:rew.x,y:rew.y,vx:(Math.random()-0.5)*3,vy:-Math.random()*2.5,life:1,decay:0.02,color:'#ffcc00'}); pushToast(rew.x,rew.y-20,'🌾 +10 SEMILLAS','#ffcc00'); }
      else if(rew.type==='agua'){ workers.forEach(w=> w.fatigue=Math.max(0,w.fatigue-30)); pushEvent('discover','¡AGUA!','Energía para todas'); notifyCanon('💧 AGUA', 'Fuente de agua - fatiga restaurada', 5000); for(let i=0;i<14;i++) particles.push({x:rew.x,y:rew.y,vx:(Math.random()-0.5)*2,vy:(Math.random()-0.5)*2,life:1,decay:0.025,color:'#00e5ff'}); pushToast(rew.x,rew.y-20,'💧 AGUA','#00e5ff'); }
      else if(rew.type==='hongo'){ colonyFood+=6; pushEvent('discover','¡HONGO!','+6 comida'); notifyCanon('🍄 HONGO', 'Hongo nutritivo - +6 comida', 5000); for(let i=0;i<14;i++) particles.push({x:rew.x,y:rew.y,vx:(Math.random()-0.5)*2,vy:(Math.random()-0.5)*2,life:1,decay:0.02,color:'#2de67a'}); pushToast(rew.x,rew.y-20,'🍄 HONGO','#2de67a'); }
      else if(def){
        if(def.food) colonyFood+=def.food;
        if(def.mat && typeof worldMaterials!=='undefined'){ worldMaterials[def.mat]=(worldMaterials[def.mat]||0)+(def.matAmt||1); }
        if(def.xp) stats.xp+=def.xp; else stats.xp+=45;
        if(def.fatigue) workers.forEach(w=> w.fatigue=Math.max(0,w.fatigue-def.fatigue));
        pushEvent('discover', def.msg, '['+rew.c+','+rew.r+'] tier'+def.tier);
        notifyCanon(def.msg.split(' ')[0], def.msg, 4000);
        for(let i=0;i<12;i++) particles.push({x:rew.x,y:rew.y,vx:(Math.random()-0.5)*2,vy:-Math.random()*1.6,life:1,decay:0.025,color:def.color});
        pushToast(rew.x,rew.y-18, def.msg.split(' ')[0], def.color);
        handled=true;
      }
      if(!handled && def){ /* already handled */ }
      // intento de respawn inteligente: 28% chance de que al cavar profundo aparezca otro
      try{
        if(Math.random()<0.28 && hiddenRewards.filter(t=>!t.found).length<14){
          // buscar posición profunda cerca del descubrimiento pero no idéntica
          for(let a=0;a<12;a++){
            const nc=Math.max(4,Math.min(COLS-5, rew.c + Math.floor((Math.random()-0.5)*14)));
            const nr=Math.max(SURFACE_ROW+8, Math.min(ROWS-4, rew.r + Math.floor(Math.random()*8)+2));
            if(typeof spawnSmartTreasure==='function' && isValidTreasurePos(nc,nr)){ spawnSmartTreasure(nc,nr); break; }
          }
        }
      }catch(e){}
      stats.xp+=50; checkLevelUp(); markSoilDirty();
    }
  });
  // regen pasiva por tiempo: cada ~0.9 día si quedan <8 sin descubrir, añade 1
  try{
    if(typeof time!=='undefined' && time% (DAY_LENGTH*0.9) < 12 && hiddenRewards.filter(t=>!t.found).length<8){
      for(let a=0;a<8;a++){
        const c=6+Math.floor(Math.random()*(COLS-12)), r=SURFACE_ROW+10+Math.floor(Math.random()*(ROWS-SURFACE_ROW-14));
        if(typeof spawnSmartTreasure==='function' && isValidTreasurePos(c,r)){ spawnSmartTreasure(c,r); break; }
      }
    }
  }catch(e){}
}
function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
function nearestFood(from){let best=null,bd=Infinity;for(let f of foods){const d=dist(from,f); if(d<90&&d<bd){bd=d;best=f;}}return best;}
function nearestPhero(from){let best=null,bd=Infinity, bestRecruit=null, bdR=Infinity; for(let p of pheromones){const d=dist(from,p); if(p.type==='recruit' && p.strength>0.16 && d<90 && d<bdR){bdR=d;bestRecruit=p;} else if(p.strength>0.18 && d<80 && d<bd){bd=d;best=p;}} return bestRecruit||best;}
function nearestWorker(from, excludeId){let best=null,bd=Infinity; for(let w of workers){if(w.id===excludeId) continue; const d=dist(from,w); if(d<80&&d<bd){bd=d;best=w;}} return best;}
function storagePos(){return {x:pantryPos.x, y:pantryPos.y};}
function surfaceEntrance(){return {x:CENTER_COL*CELL+8,y:SURFACE_Y-4};}
function rayWallDist(x,y,angle,max){for(let d=4;d<=max;d+=4){const nx=x+Math.cos(angle)*d, ny=y+Math.sin(angle)*d; if(isSolidPixel(nx,ny)) return d;}return max;}
function inkColorForSymbol(sym){ if(sym==='⬢') return '#00e5ff'; if(sym==='⬣') return '#ffdd57'; if(sym==='◆') return '#ff6b9d'; return '#2de67a';}
function symbolForComms(c1,c2){ if(c1>0.4 && c2>0.4) return '◆'; if(c1>0.4) return '⬢'; if(c2>0.4) return '⬣'; return '⬡';}

function updateQueen(dt){
  // === FÍSICA REINA - Topo: ya no flota, cae y busca suelo como en la vida real ===
  for(let qi=queens.length-1; qi>=0; qi--){
    const q=queens[qi];
    if(q.vy==null) q.vy=0;
    // en la vida real Solenopsis/Lasius/Atta: reina casi inmóvil en cámara real, solo se mueve si la molestan o se inunda/colapsa
    // aquí: gravedad + inteligencia para pararse en suelo sólido
    const c=Math.floor(q.x/CELL), r=Math.floor(q.y/CELL);
    const belowSolid = r+1<ROWS && soil[r+1] && soil[r+1][c]===1;
    const hereSolid = soil[r] && soil[r][c]===1;
    const waterHere = water[r] && water[r][c]>0.45;
    // si está dentro de tierra sólida (bug), empujar a aire más cercano
    if(hereSolid){
      for(let dy=-2; dy<=2; dy++) for(let dx=-3; dx<=3; dx++){
        const nc=c+dx, nr=r+dy;
        if(nc>=0&&nc<COLS&&nr>=SURFACE_ROW&&nr<ROWS&&soil[nr][nc]===0 && !water[nr][nc]){
          q.x=nc*CELL+8; q.y=nr*CELL+12; q.vy=0; break;
        }
      }
    }
    // gravedad si no hay suelo debajo o hay agua que la hace flotar un poco
    if(!belowSolid || waterHere){
      q.vy = (q.vy||0) + 0.52*dt*0.065;
      q.y += q.vy*dt*0.09;
      // tope suelo
      const nr2=Math.floor(q.y/CELL);
      const nc2=Math.floor(q.x/CELL);
      if(nr2+1<ROWS && soil[nr2+1] && soil[nr2+1][nc2]===1){
        q.y=(nr2+1)*CELL - 4; // 4px sobre el suelo (pies de la reina)
        q.vy=0;
      }
      if(waterHere) q.vy*=0.92; // agua frena caída
      if(q.y>H-12){ q.y=H-12; q.vy=0; }
      if(q.y<SURFACE_Y-20){ q.y=SURFACE_Y-8; q.vy=0; }
    } else {
      q.vy*=0.82; if(Math.abs(q.vy)<0.08) q.vy=0;
      // inteligencia: si la cámara es muy pequeña o hay agua, reubicarse lento al centro de la cámara más grande cercana
      if(q.age% (DAY_LENGTH*0.7) < 12 && Math.random()<0.008){
        // buscar mejor cámara (más celdas de aire alrededor)
        let best=null, bestScore=-1;
        for(let dy=-4; dy<=4; dy++) for(let dx=-4; dx<=4; dx++){
          const nc=c+dx, nr=r+dy;
          if(nc<2||nc>=COLS-2||nr<SURFACE_ROW+2||nr>=ROWS-2) continue;
          if(soil[nr][nc]!==0) continue;
          if(water[nr][nc]>0.3) continue;
          // score por espacio libre alrededor
          let score=0;
          for(let y2=-2;y2<=2;y2++) for(let x2=-3;x2<=3;x2++) if(soil[nr+y2]&&soil[nr+y2][nc+x2]===0) score++;
          if(score>bestScore){ bestScore=score; best={x:nc*CELL+8, y:nr*CELL+12}; }
        }
        if(best && bestScore>14 && Math.hypot(best.x-q.x,best.y-q.y)>18){
          // moverse lento como reina real (no corre)
          q.x += Math.sign(best.x-q.x)*0.22*dt*0.08;
          q.y += Math.sign(best.y-q.y)*0.22*dt*0.08;
        }
      }
    }
    q.age+=dt;
    // fertilidad decae con la edad
    const ageFactor = Math.max(0.25, 1 - (q.age/q.maxAge)*0.7);
    if(q.age > q.maxAge){
      // muerte por vejez
      pushEvent('death',`♛ ${q.name||q.id||'Reina'} muere de vieja a los ${(q.age/DAY_LENGTH).toFixed(1)}d`, `Vivió ${(q.maxAge/DAY_LENGTH).toFixed(1)}d - GEN${q.genome.gen}`);
      notifyCanon('♛ REINA MUERE', `${q.name} muere a los ${(q.age/DAY_LENGTH).toFixed(1)} días - la colonia busca heredera`, 6200);
      pushToast(q.x,q.y-20,'💀 REINA','#ff3b30',3);
      // partículas de luto
      for(let i=0;i<14;i++) particles.push({x:q.x,y:q.y,vx:(Math.random()-0.5)*2,vy:-Math.random()*1.5,life:1,decay:0.015,color:'#b47aff'});
      // si era la principal, la colonia la llora
      workers.forEach(w=>{ w.mood.sadness=Math.min(1,w.mood.sadness+0.22); w.mood.loyalty*=0.85; });
      queens.splice(qi,1);
      if(queens.length===0){
        // colonia intentará criar nueva reina de una larva
        const larva = brood.find(b=>b.type==='larva');
        if(larva){
          larva.isQueen=true;
          pushEvent('evo','¡Emergencia! Larva real alimentada para nueva reina','La colonia no se rinde');
      notifyCanon('🆘 LARVA REAL', 'La colonia alimenta una larva para salvar la corona', 5200);
        } else if(workers.length>0){
          // si no hay larva, una nodriza SE transforma sí o sí si era la última reina (anti-extinción Minecraft)
          if(true){
            const cand=workers.filter(w=>w.role==='NODRIZA').sort((a,b)=>b.mood.loyalty-a.mood.loyalty)[0];
            if(cand){
              let _qn1=genPersonalName({faction:cand.faction, role:'REINA', affinity:'NODRIZA', caste:'media', parents:[], genome:cand.genome, isQueen:true, rank:'LÍDER', ageDays:0, idCode:'Q'+(queens.length+1)+'-'+Math.random().toString(36).slice(2,4).toUpperCase()});
              queens.push(ensureQueenMeta({x:cand.x,y:cand.y, genome:cand.genome, progress:0, state:'GRÁVIDA', age:0, maxAge: getQueenMaxAge(), generation:gen+1, faction:cand.faction, health:100, name:_qn1.name, personalName:_qn1.name, nameMeaning:_qn1.meaning, nameStage:_qn1.stage, id:'Q'+Math.random().toString(36).slice(2,5).toUpperCase(), eggsLaid:0, children:[], history:[]}));
              workers.splice(workers.indexOf(cand),1);
              pushEvent('birth','¡Nodriza se transforma en reina!','Metamorfosis extrema por supervivencia');
      notifyCanon('👑 NODRIZA REINA', 'Una nodriza se transforma en reina por supervivencia', 5200);
            }
          }
        }
      }
      if(queens.length>0) queen=queens[0]; // actualizar referencia principal
      continue;
    }
    // puesta de huevos - cada reina pone según alimento y fertilidad
    const need=3;
    if(colonyFood>=need){
      // FERTILIDAD EVOLUTIVA REALISTA - Lasius 4-7k (100/d pico), Atta 5M (30k/d), argentina billones
      // En juego: base 2.19/d, con evolución GEN30 puede llegar a 18/d por reina (como Atta joven), 4 reinas = 72/d → N=72*18=1296
      const _evoFert = 1 + gen*0.13 + Math.max(0, colonyIQ-108)*0.009 + (q.personality?.fertilidad? (q.personality.fertilidad-50)*0.006:0) + (fungusGardens.filter(f=>f.health>0.62).length*0.12) + (typeof inventions!=='undefined' && inventions.fungus?0.22:0);
      const rate = 0.00305 * ageFactor * (1 + (q.traits?.cuidado||50)/240) * _evoFert; // escalado evolutivo, no instantáneo
      q.progress+= dt*rate;
      if(q.progress>=100){
        q.progress=0;
        let best=workers[0]; if(best) workers.forEach(w=>{ if(w.deliveries > best.deliveries) best=w;});
        const child= best? crossover(q.genome, best.genome) : q.genome;
        const mutated=mutateGenome(child,0.13,0.55);
        // 4% de ser larva real (futura reina) si la colonia es grande y hay comida
        const isQueenLarva = workers.length>=6 && colonyFood>8 && Math.random()<0.04 + gen*0.002;
        brood.push({type:'egg', progress:0, genome:mutated.genome, time:0, isQueen:isQueenLarva, faction:q.faction, parents:[q.name||q.id, best?best.id:'-'], parentGenomes:[q.genome.id, best?best.genome.id:'-'], x:q.x+(Math.random()-0.5)*22, y:q.y+(Math.random()-0.5)*14, hunger:0});
        colonyFood-=need;
        const eggIcon2=isQueenLarva?'👑':'🥚';
        // === reina: crecimiento y personalidad ===
        q.eggsLaid=(q.eggsLaid||0)+1;
        if(!q.children) q.children=[];
        q.children.push(mutated.genome.id);
        if(q.children.length>24) q.children.shift();
        if(!q.history) q.history=[];
        q.history.unshift({day:day,time:q.age/3600,msg:`${eggIcon2} Huevo ${mutated.genome.id}${isQueenLarva?' 👑 REAL':''} con ${best?best.id:'-'} - total ${q.eggsLaid}`});
        if(q.history.length>20) q.history.pop();
        q.mood.joy=Math.min(1,q.mood.joy+0.012);
        q.mood.stress=Math.max(0,q.mood.stress-0.015);
        if(best && best.history){
          best.history.unshift({day:day,time:best.age/3600,msg:`♛ Padre de ${mutated.genome.id} con ${q.personalName||q.name}`});
          if(best.history.length>12) best.history.pop();
        }
        const eggIcon=eggIcon2;
        pushEvent('birth',`${eggIcon} ${q.name||'Reina'} pone huevo ${mutated.genome.id}${isQueenLarva?' [REINA]':''} (♛x${best?best.id:'-'})`, `Mut: ${mutated.changes.slice(0,2).join(', ')}`);
        pushToast(q.x,q.y-28,eggIcon+' HUEVO',isQueenLarva?'#ffcc00':'#b47aff');
        if(isQueenLarva) setNarration(`<b>¡Huevo real!</b> ${q.name} gesta una futura reina 👑 - la colonia crece.`);
        if(isQueenLarva) notifyCanon('👑 HUEVO REAL', `${q.name} gesta una futura reina`, 5000);
      }
    } else q.progress=Math.max(0, q.progress - dt*0.04);
    q.state= colonyFood>=3? 'GRÁVIDA' : 'HAMBRIENTA';
    // salud de reina
    if(colonyFood===0 && Math.random()<0.001) q.health-=0.5;
  }
  // mantener referencia principal
  if(queens.length>0) queen=queens[0];
}
function updateBrood(dt){
  // v8 realismo: larva necesita trofalaxia real de nodrizas
  for(let i=brood.length-1;i>=0;i--){
    const b=brood[i]; b.time+=dt;
    if(b.type==='larva'){
      // hambre real: sin nodriza con buche, se estanca y puede morir
      if(!b.hunger) b.hunger=0;
      const nurses = workers.filter(w=>w.role==='NODRIZA' && w.crop>0.14 && dist(w,{x:b.x||queens[0].x,y:b.y||queens[0].y})<64).length;
      const fed = nurses>0 || workers.some(w=>w.caste==='minim' && w.crop>0.1 && dist(w,{x:b.x||queens[0].x,y:b.y||queens[0].y})<48);
      if(fed){
        // alimentar: consume buche de nodriza o miel
        if(Math.random()<0.14){
          const donor = workers.find(w=> (w.role==='NODRIZA'||w.caste==='minim') && w.crop>0.12);
          if(donor) donor.crop=Math.max(0, donor.crop-0.09);
          else if(colonyFood>0) colonyFood=Math.max(0, colonyFood-0.022); // 0.03→0.022 (balance suave)
        }
        b.hunger=Math.max(0, b.hunger- dt*0.08);
        b.progress+= dt*0.00335;
        // calor óptimo 25°C: si nido frío/caliente, larva crece más lento (simulado por profundidad)
        if(b.y && b.y > (SURFACE_ROW+10)*CELL) b.progress+= dt*0.00042; // más cálido abajo
      } else {
        b.hunger+= dt*0.028;
        b.progress+= dt*0.00052; // casi estancada sin nodriza
        if(b.hunger> 96 && Math.random()<0.012){
          brood.splice(i,1);
          pushEvent('death','💀 Larva muere de hambre - falta nodriza con buche',`Brood ${b.genome?.id||'-'} - hambre ${b.hunger|0}`);
          continue;
        }
        // aún hambrienta, pide trofalaxia con partícula
        if(Math.random()<0.04) particles.push({x:b.x||queens[0].x, y:(b.y||queens[0].y)-6, vx:(Math.random()-0.5)*0.4, vy:-0.4, life:0.7, decay:0.02, color:'#ffaa88'});
      }
    } else {
      b.progress+= dt* (b.type==='egg'? 0.00345 : 0.00325);
    }
    if(b.progress>=100){
      if(b.type==='egg'){ b.type='larva'; b.progress=0; }
      else if(b.type==='larva'){ b.type='pupa'; b.progress=0; }
      else if(b.type==='pupa'){
        
if(workers.length < getMaxPopulation()){
          // si es larva real -> nace reina, no obrera
          if(b.isQueen){
            let _qn2=genPersonalName({faction: (b.faction!==undefined? b.faction : queens[0].faction), role:'REINA', affinity:'NODRIZA', caste:'media', parents:[b.genome.id], genome:b.genome, isQueen:true, rank:'LÍDER', ageDays:0, idCode:'Q'+(queens.length+1)+'-'+Math.random().toString(36).slice(2,4).toUpperCase()});
            const newQueen={x:queens[0].x+(Math.random()-0.5)*22, y:queens[0].y+(Math.random()-0.5)*12, genome:b.genome, progress:0, state:'GRÁVIDA', age:0, maxAge: getQueenMaxAge(), generation:gen+1, faction: b.faction!==undefined? b.faction : queens[0].faction, health:100, name:_qn2.name, personalName:_qn2.name, nameMeaning:_qn2.meaning, nameStage:_qn2.stage};
            // 35% funda nueva facción (cisma) - derrocar líderes, guerra de sucesión
            if(queens.length>=1 && Math.random()<0.35){
              const newFac=society.nextFaction++;
              newQueen.faction=newFac;
              society.factions.push({id:newFac,name:'Cisma '+(newFac),color: newFac%2?'#ff3b30':'#00e5ff',members:0,belief:'-',leader:newQueen.name});
              // algunas obreras la siguen (baja lealtad)
              let followers=0;
              workers.forEach(w=>{ if(w.mood.loyalty<0.45 && Math.random()<0.3){ w.faction=newFac; followers++; }});
              pushEvent('evo',`¡CISMA! Nueva reina ${newQueen.name} funda facción ${newFac} con ${followers} seguidoras`,`Guerra civil posible - Facciones: ${society.factions.length}`);
              notifyCanon('⚔ CISMA', `${newQueen.name} funda facción ${newFac} con ${followers} seguidoras - riesgo de guerra civil`, 6200);
              society.wars++;
            } else {
              pushEvent('birth',`👑 ¡Nace reina ${newQueen.name}!`, `GEN${b.genome.gen} - Facción ${newQueen.faction}`);
              notifyCanon('👑 NACE REINA', `${newQueen.name} eclosiona - GEN${b.genome.gen}`, 5200);
            }
            queens.push(ensureQueenMeta(newQueen));
            society.factions.find(f=>f.id===newQueen.faction).members++;
            pushToast(newQueen.x,newQueen.y-18,`👑 ${newQueen.name}`,'#ffcc00',3);
          } else {
            const ant=makeAnt(b.genome, {x:queens[0].x+(Math.random()-0.5)*18, y:queens[0].y+(Math.random()-0.5)*10}, {faction: b.faction});
            // HERENCIA TERRARIA/REAL: las nuevas nacen con más info que las anteriores
            // si la colonia ya sabe cavar, la cría hereda bonus de digNeeded y una pizca de IQ espacial
            if(gen>=2){
              ant.digNeeded = Math.max(7, ant.digNeeded - Math.floor(gen*0.42) - Math.floor(colonyIQ/55));
              ant.fitness += gen*0.06 + colonyIQ*0.002;
              // transmite preferencia de rol de los padres más aptos
              const bestParent = workers.reduce((a,b)=> a.fitness>b.fitness? a:b, workers[0]);
              if(bestParent && bestParent.role) ant.affinity = bestParent.affinity || ant.affinity;
            }
            // si los padres ya decoran/construyen, la cría empieza con trait cuidado levemente mayor
            if(decoSet.size>6 && ant.traits.cuidado<68) ant.traits.cuidado = Math.min(72, ant.traits.cuidado+2);
            workers.push(ant);
            // hereda facción y un poco del ánimo de la madre
            pushEvent('birth',`Eclosiona ${ant.id} [${ant.role}] GEN${ant.genome.gen}`, `EXP${ant.traits.exploracion} CAV${ant.traits.construccion} COM${ant.traits.comunica}`);
            if(workers.length<=5) notifyCanon('🐣 ECLOSION', `${ant.id} nace - la colonia crece`, 4800);
            pushToast(queens[0].x,queens[0].y-18,`🐣 ${ant.id}`,'#b47aff',2.6);
          }
        } else {
          pushEvent('evo',`Pupa espera: colonia en tope ${getMaxPopulation()} - cava más salas o evoluciona`,'Falta espacio/organizacion');
        }
        brood.splice(i,1);
      }
    }
  }
}
// v8 realismo: jardines fúngicos - agricultura de 50 Ma (Atta) + gestión de basureros separados
function updateFungus(dt){
  // asegurar un jardín inicial claustro (reina trae pellet)
  if(fungusGardens.length===0 && queens.length>0){
    const q=queens[0];
    fungusGardens.push({x:q.x+14, y:q.y+8, c: Math.floor((q.x+14)/16), r: Math.floor((q.y+8)/16), health:0.96, size:1.55, age:0, fed:2}); // colchón: hongo grande sano
  }
  for(let i=fungusGardens.length-1;i>=0;i--){
    const f=fungusGardens[i];
    f.age+=dt;
    // temperatura óptima simulada: profundidad + humedad; si está muy arriba se seca
    const depthFactor = Math.max(0, Math.min(1, (f.y - SURFACE_Y)/ (ROWS*CELL*0.55) ));
    const humidity = 0.72 + depthFactor*0.22 - Math.max(0, (SURFACE_Y - f.y)/200);
    const tempOk = depthFactor>0.28 && depthFactor<0.78;
    // decae si nadie lo cuida
    const tenders = workers.filter(w=> (w.role==='NODRIZA'||w.caste==='minim') && dist(w,f)<38).length;
    if(tenders===0){
      f.health -= dt*0.00018;
      if(f.health<0.22 && Math.random()<0.006) f.size=Math.max(0.6, f.size-0.04);
    } else {
      // mimims limpian y alimentan con fibra/hojas
      if(worldMaterials.fiber>0 && Math.random()<0.018*tenders){
        worldMaterials.fiber--; f.health=Math.min(1, f.health+0.035); f.size=Math.min(4.2, f.size+0.018); f.fed++;
        // producir gongylidia -> miel
        if(f.health>0.62 && Math.random()<0.42){
          colonyFood+=0.12;
          // trofalaxia indirecta: nodrizas recargan buche del hongo
          tenders && workers.filter(w=>dist(w,f)<24).forEach(w=> w.crop=Math.min(w.cropMax, w.crop+0.07));
          if(Math.random()<0.06) particles.push({x:f.x,y:f.y-8,vx:(Math.random()-0.5)*0.6,vy:-0.7,life:0.9,decay:0.022,color:'#e8d5a3'});
        }
      }
      if(tempOk) f.health=Math.min(1, f.health+ dt*0.00008);
      else f.health-= dt*0.00009;
    }
    // patógeno si basurero cerca
    for(let w of wastePiles){ if(Math.hypot(w.x-f.x,w.y-f.y)<48) f.health-= dt*0.00012; }
    if(f.health<=0){ fungusGardens.splice(i,1); pushEvent('death','🍄 Jardín fúngico muere - falta cuidado/humedad'); }
  }
  // crear nuevo jardín cuando colonia crece y aprende hongo
  if(inventions.fungus && fungusGardens.length<3 && workers.length>=8 && colonyFood>6 && Math.random()<0.0009*workers.filter(w=>w.role==='NODRIZA').length){
    const q=queens[0];
    fungusGardens.push({x:q.x+(Math.random()-0.5)*44, y:q.y+ 18+Math.random()*34, c:0,r:0, health:0.78, size:0.9, age:0, fed:0});
    pushEvent('evo','🍄 Nuevo jardín fúngico excavado',`Jardines: ${fungusGardens.length}`);
  }
}
function updateWaste(dt){
  // cada excavación genera residuo que debe ir a cámara separada
  // wastePiles son montículos aislados; si quedan cerca de cría/hongo, penaliza
  for(let i=wastePiles.length-1;i>=0;i--){
    const w=wastePiles[i];
    w.age=(w.age||0)+dt;
    // viejas llevan basura lejos (si hay viejas)
    const carriers = workers.filter(ww=> ww.age/DAY_LENGTH>1.0 && dist(ww,w)<44 && ww.state==='EXPLORAR' && !ww.food);
    if(carriers.length>0 && Math.random()<0.018){
      // mover basura a borde lejano
      w.x = Math.max(12, Math.min(W-12, w.x + (Math.random()<0.5?-1:1)*28));
      w.y = Math.max((SURFACE_ROW+2)*CELL, Math.min((ROWS-1)*CELL, w.y + (Math.random()-0.5)*16));
      carriers[0].state='LLEVANDO_BASURA'; carriers[0].wasteTarget={x:w.x,y:w.y};
      if(Math.random()<0.5) particles.push({x:w.x,y:w.y,vx:(Math.random()-0.5)*1,vy:-0.6,life:0.7,decay:0.03,color:'#6b4a2a'});
    }
    // descomposición lenta
    if(w.age> DAY_LENGTH*2.2 && Math.random()<0.004) wastePiles.splice(i,1);
  }
  // higiene: si hay mucho waste cerca de queen/brood, cría se enferma
  if(wastePiles.length>0 && brood.length>0){
    for(let b of brood){ for(let w of wastePiles){ if(Math.hypot((b.x||queens[0].x)-w.x,(b.y||queens[0].y)-w.y)<36) b.progress-= dt*0.0006; } }
  }
}
function updateMood(ant, dt){
  // decaimiento natural hacia equilibrio
  for(let k in ant.mood){
    if(k==='loyalty') ant.mood[k] += (0.65 - ant.mood[k])*0.001*dt;
    else if(k==='joy') ant.mood[k] += (0.5 - ant.mood[k])*0.002*dt;
    else ant.mood[k] *= 0.998;
    ant.mood[k]=Math.max(0,Math.min(1,ant.mood[k]));
  }
  // estrés por hacinamiento
  let near=0; workers.forEach(w=>{ if(w!==ant && Math.hypot(w.x-ant.x,w.y-ant.y)<30) near++; });
  if(near>5) ant.mood.stress = Math.min(1, ant.mood.stress + 0.001*dt);
  if(near===0 && Math.random()<0.002) ant.mood.sadness=Math.min(1, ant.mood.sadness+0.015);
  // alegría por estar cerca de reina
  if(queens.some(q=> Math.hypot(q.x-ant.x,q.y-ant.y)<50)) ant.mood.joy=Math.min(1, ant.mood.joy+0.002*dt);
}
function updateSociety(dt){
  // actualizar contadores de facciones
  society.factions.forEach(f=> f.members= workers.filter(w=>w.faction===f.id).length + queens.filter(q=>q.faction===f.id).length );
  // detectar culto: hormiga que emite mucho y es seguida
  let maxFollowers=0, prophet=null;
  workers.forEach(w=>{
    let followers=0;
    workers.forEach(o=>{ if(o!==w && o.belief===w.id) followers++; });
    w.followers=followers;
    if(followers>maxFollowers){ maxFollowers=followers; prophet=w; }
  });
  if(maxFollowers>=3){
    const cultName = prophet.id+'-ismo';
    society.cults=1;
    // actualizar facción belief
    const fac=society.factions.find(f=>f.id===prophet.faction);
    if(fac) fac.belief=cultName;
  } else society.cults=0;
  // guerra: si hay >1 facción y hay odio
  const activeFactions=society.factions.filter(f=>f.members>0);
  let war=false;
  if(activeFactions.length>1){
    // si hay encuentro agresivo reciente, marcar guerra
    for(let w of workers){
      if(w.mood.anger>0.62 && w.mood.fear<0.35){
        const foe=workers.find(o=> o.faction!==w.faction && Math.hypot(o.x-w.x,o.y-w.y)<22 );
        if(foe) war=true;
      }
    }
  }
  society.wars = war? 1:0;
  try{ if(typeof evolveLanguages==='function') evolveLanguages(dt); }catch(e){}
  try{ if(typeof checkAnthroEvo==='function') checkAnthroEvo(); }catch(e){}
  try{ if(typeof updateHierarchy==='function') updateHierarchy(dt); }catch(e){}
  // ánimo colectivo promedio
  if(workers.length>0){
    let sum={joy:0,anger:0,fear:0,sadness:0,loyalty:0,stress:0};
    workers.forEach(w=>{ for(let k in sum) sum[k]+=w.mood[k]; });
    for(let k in sum) society.mood[k]= sum[k]/workers.length;
  }
}
function renderSociety(){
  const elCount=document.getElementById('queenCount');
  if(elCount) elCount.textContent=queens.length+' ♛';
  const elAge=document.getElementById('queenAge');
  if(elAge && queens[0]){
    const q=queens[0];
    const d=(q.age/DAY_LENGTH).toFixed(1);
    const life=Math.floor((1-q.age/q.maxAge)*100);
    elAge.textContent=`${q.name} ${d}d - ${life}% vida - ${q.state}`;
  }
  const elFac=document.getElementById('factionCount');
  if(elFac) elFac.textContent=society.factions.filter(f=>f.members>0).length;
  const elList=document.getElementById('factionList');
  if(elList){
    const active=society.factions.filter(f=>f.members>0);
    elList.textContent= active.length===1? '- colonia única' : active.map(f=>`F${f.id}(${f.members})`).join(' - ');
  }
  const elWar=document.getElementById('warStatus');
  if(elWar){
    if(society.wars){ elWar.textContent='⚔ GUERRA'; elWar.style.background='#2a0000'; elWar.style.borderColor='#ff3b30'; elWar.style.color='#ff3b30'; }
    else { elWar.textContent='☮ PAZ'; elWar.style.background='#0a1a0a'; elWar.style.borderColor='#1a3d1a'; elWar.style.color='#2de67a'; }
  }
  const elCult=document.getElementById('cultStatus');
  if(elCult){
    if(society.cults){ 
      const fac=society.factions.find(f=>f.belief && f.belief!=='-');
      elCult.textContent= fac? `✡ ${fac.belief}` : '✡ culto activo';
      elCult.style.background='#1a0033'; elCult.style.borderColor='#b47aff'; elCult.style.color='#b47aff';
    } else { elCult.textContent='- sin culto'; elCult.style.background='#0a0a1a'; elCult.style.borderColor='#2a1a3d'; elCult.style.color='#8a7a5a'; }
  }
  const elMood=document.getElementById('moodBars');
  if(elMood){
    const moods=society.mood;
    const icons={joy:'😊',anger:'😠',fear:'😨',sadness:'😢',loyalty:'🤝',stress:'😓'};
    const colors={joy:'#2de67a',anger:'#ff3b30',fear:'#ffcc00',sadness:'#6b7cff',loyalty:'#00e5ff',stress:'#ff8c00'};
    elMood.innerHTML='';
    for(let k in moods){
      const v=moods[k];
      const pct=Math.round(v*100);
      const row=document.createElement('div');
      row.style.display='flex'; row.style.alignItems='center'; row.style.gap='4px';
      row.innerHTML=`<span style="width:28px">${icons[k]} ${k.slice(0,3)}</span><div style="flex:1;height:8px;background:#000;border:1px solid #000;position:relative"><div style="position:absolute;left:0;top:0;bottom:0;width:${pct}%;background:${colors[k]}"></div></div><span style="width:28px;text-align:right">${pct}%</span>`;
      elMood.appendChild(row);
    }
  }
  const elSoc=document.getElementById('societyStatus');
  if(elSoc){
    if(society.wars) elSoc.textContent='¡guerra!';
    else if(society.cults) elSoc.textContent='culto';
    else if(society.mood.stress>0.6) elSoc.textContent='tensa';
    else if(society.mood.joy>0.6) elSoc.textContent='feliz';
    else elSoc.textContent='estable';
  }
  // idioma
  try{
    const lang = society.languages[0] || society.languages[Object.keys(society.languages)[0]];
    const elFlu=document.getElementById('langFluency');
    const elSta=document.getElementById('langStatus');
    const elDic=document.getElementById('langDict');
    if(lang && elFlu){
      elFlu.textContent=Math.floor(lang.fluency*100)+'%';
      if(lang.stage==='feromonas' || lang.fluency<0.12) elSta.textContent='feromonas - hormigas reales';
      else if(lang.fluency<0.28) elSta.textContent=`señales simples - ${lang.grammar.order}`;
      else if(lang.fluency<0.5) elSta.textContent=`balbuceo → proto ${lang.grammar.order}`;
      else if(lang.fluency<0.78) elSta.textContent=`proto-idioma ${lang.grammar.order} ${lang.grammar.plural} - ya entendible`;
      else elSta.textContent=`idioma completo ${lang.grammar.order} - traducible`;
      if(elDic){
        const entries=Object.entries(lang.lex).slice(0,6).map(([k,v])=> `${k.toLowerCase()}→<b style="color:#d8b4ff">${v}</b>`).join(' - ');
        let html = entries + `<br><span style="color:#8a7a5a">orden ${lang.grammar.order} - ${Object.keys(lang.lex).length} palabras - ${lang.utterances} frases</span>`;
        try{
          const ex=genPersonalName({faction:lang.faction, role:'EXCAVADORA', affinity:'EXCAVADORA', caste:'media', parents:[], genome:{hiddenSize:8}, isQueen:false, rank:'OBRERA', ageDays:1.2, idCode:'A9X2'});
          const ex2=genPersonalName({faction:lang.faction, role:'NODRIZA', affinity:'NODRIZA', caste:'media', parents:['Kira'], genome:{hiddenSize:8}, isQueen:false, rank:'OBRERA', ageDays:1.2, idCode:'A1B2'});
          html += `<br><span style="color:#fff">ej. ${ex.name} <span style="color:#b47aff">(${ex.meaning})</span> - ${ex2.name} <span style="color:#b47aff">(${ex2.meaning})</span></span>`;
        }catch(e){}
        elDic.innerHTML=html;
      }
    }
  }catch(e){}
}
function closeAntProfile(immediate=false){
  const m=document.getElementById('antProfile'); if(!m) return;
  if(immediate){
    m.style.transform='translateY(-12px) scaleY(0)';
    m.style.opacity='0';
    m.style.display='none';
    m.style.top='0'; m.style.height=''; m.style.right=''; m.style.width=''; m.style.maxWidth='';
    m.removeAttribute('data-open');
    m.removeAttribute('data-ant');
    clampView();
    return;
  }
  m.style.transform='translateY(-12px) scaleY(0)';
  m.style.opacity='0';
  m.removeAttribute('data-open');
  setTimeout(()=>{
    if(m.getAttribute('data-open')) return; // reopened quickly
    m.style.display='none'; m.style.top='0'; m.style.height=''; m.style.right=''; m.style.width=''; m.style.maxWidth='';
    m.removeAttribute('data-ant');
    clampView();
  }, 220);
}
function showAntProfile(ant){
  const modal=document.getElementById('antProfile');
  const facCol=society.factions.find(f=>f.id===ant.faction)?.color || '#ffcc00';
  hudText('profileTitle', `${antDisplayName(ant)} [${ant.role}] F${ant.faction}`); document.getElementById('profileTitle').title=ant.nameMeaning||ant.id;
  hudStyle('profileFactionDot', facCol);
  const ageD=(ant.age/DAY_LENGTH).toFixed(1), maxD=(ant.maxAge/DAY_LENGTH).toFixed(1);
  hudText('profileId', `${antDisplayName(ant)} (${ant.id}) - ${ageD}d / ${maxD}d - ❤ ${Math.floor(ant.health)}%${ant.isQueen?' 👑':''}`); document.getElementById('profileId').title=ant.nameMeaning||'';
  hudText('profileRole', `${ant.role} - F${ant.faction} - GEN-${ant.genome.gen} - ${ant.genome.id}`);
  // mood icons
  const moodEl=document.getElementById('profileMoodIcons');
  moodEl.innerHTML='';
  for(let k in ant.mood){
    const v=ant.mood[k];
    const icons={joy:'😊',anger:'😠',fear:'😨',sadness:'😢',loyalty:'🤝',stress:'😓'};
    const col={joy:'#2de67a',anger:'#ff3b30',fear:'#ffcc00',sadness:'#6b7cff',loyalty:'#00e5ff',stress:'#ff8c00'}[k];
    const abbr={joy:'ALE',anger:'IRA',fear:'MIE',sadness:'TRI',loyalty:'LEA',stress:'EST'}[k];
    const d=document.createElement('div');
    d.style.cssText='background:#000;border:1px solid #1a1a1a;padding:3px 2px;display:flex;flex-direction:column;align-items:center;gap:1px;line-height:1;text-align:center';
    d.innerHTML=`<span style="font-size:11px;line-height:1;color:${col}">${icons[k]}</span><span style="font-family:\'Press Start 2P\';font-size:5px;color:#8a7a5a;letter-spacing:0.2px">${abbr}</span><span style="font-family:\'Press Start 2P\';font-size:7px;color:${col}">${Math.round(v*100)}%</span>`;
    d.title=`${k} ${Math.round(v*100)}%`;
    moodEl.appendChild(d);
  }
  // traits
  const tEl=document.getElementById('profileTraits');
  tEl.innerHTML='';
  for(let k of ['exploracion','construccion','recoleccion','cuidado','comunica']){
    const v=ant.traits[k];
    const col=k==='exploracion'?'#00e5ff':k==='construccion'?'#ff3b30':k==='recoleccion'?'#2de67a':k==='cuidado'?'#b47aff':'#ffcc00';
    const label=k==='exploracion'?'EXPL':k==='construccion'?'CAVA':k==='recoleccion'?'RECO':k==='cuidado'?'CUID':'TINT';
    const d=document.createElement('div');
    d.style.cssText='background:rgba(255,255,255,0.03);border:1px solid #1a1a1a;padding:4px';
    d.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;font-family:\'Press Start 2P\';font-size:6px;color:#c9b896;letter-spacing:0.3px"><span>${label}</span><span style="color:${col};font-size:7px">${v}</span></div><div style="height:8px;background:#0a0a0a;border:1px solid #000;margin-top:3px;position:relative;overflow:hidden"><div style="height:100%;width:${v}%;background:${col};box-shadow:inset 0 1px 0 rgba(255,255,255,0.2)"></div></div>`;
    tEl.appendChild(d);
  }
  hudText('profileFitness', (ant.fitness||0).toFixed(2));
  hudText('profileDeliveries', `${ant.deliveries} entregas - ${ant.digsDone} excavs - ${ant.commsSent} tintas`);
  hudText('profileCrimes', `${ant.crimes} - ${ant.followers} seguidores`);
  hudText('profileBelief', ant.belief? `cree en ${ant.belief}-ismo` : (ant.followers>0? `lider de ${ant.followers} ` : '- sin culto'));
  // árbol
  const treeEl=document.getElementById('profileTree');
  let treeHtml='';
  if(ant.parents && ant.parents.length){
    treeHtml+=`<div>👑 Madre: <b style="color:#b47aff">${ant.parents[0]}</b> <span style="color:#8a7a5a">+ ${ant.parents[1]||'-'}</span></div>`;
    treeHtml+=`<div style="margin:4px 0;color:#8a7a5a">↓</div>`;
  } else {
    treeHtml+=`<div style="color:#8a7a5a">Fundadora - sin padres registrados</div><div style="margin:4px 0">↓</div>`;
  }
  treeHtml+=`<div><b style="background:${facCol};color:#000;padding:1px 4px">${ant.id}</b> <span style="color:#8a7a5a">GEN-${ant.genome.gen}</span> ${ant.isQueen?'👑':''}</div>`;
  if(ant.children && ant.children.length){
    treeHtml+=`<div style="margin:4px 0;color:#8a7a5a">↓ hijos</div><div>${ant.children.slice(0,6).join(' - ')}${ant.children.length>6?' …':''}</div>`;
  } else if(ant.deliveries>0){
    treeHtml+=`<div style="margin-top:6px;color:#8a7a5a">Ha contribuido genéticamente a ${ant.deliveries} crías</div>`;
  }
  // buscar hijos reales: buscar brood/workers con parents que incluyan este id
  const kids = [...workers, ...queens].filter(o=> o.parents && o.parents.includes(ant.id)).map(o=>o.id);
  if(kids.length && (!ant.children||ant.children.length===0)){
    treeHtml+=`<div style="margin:4px 0;color:#8a7a5a">↓ descendencia directa</div><div>${kids.join(' - ')}</div>`;
  }
  treeEl.innerHTML=treeHtml;
  // historial
  const histEl=document.getElementById('profileHistory');
  histEl.innerHTML='';
  if(ant.history && ant.history.length){
    ant.history.slice(0,5).forEach(h=>{
      const d=document.createElement('div');
      d.style.cssText='border-bottom:1px solid #1a1a1a;padding:4px 0';
      d.innerHTML=`<span style="color:#8a7a5a">D${h.day} ${Math.floor(h.time)}h</span> - ${h.msg}`;
      histEl.appendChild(d);
    });
  } else {
    histEl.innerHTML='<span style="color:#8a7a5a">Sin historial - es joven</span>';
  }
  // canvas mini
  const pc=document.getElementById('profileCanvas');
  if(pc){
    const pctx=pc.getContext('2d');
    pctx.imageSmoothingEnabled=false;
    pctx.clearRect(0,0,64,64);
    pctx.fillStyle='#0a0a0a'; pctx.fillRect(0,0,64,64);
    // dibujar hormiga grande compacta
    pctx.fillStyle= facCol; pctx.fillRect(0,0,64,3);
    pctx.fillStyle='#1a140f'; pctx.fillRect(6,12,52,36);
    // usar sprite si existe
    if(useAnthro && typeof anthroSprite!=='undefined' && anthroReady){
      const cellW=128, cellH=128;
      let sIdx= ant.role==='EXCAVADORA'?1: ant.role==='EXPLORADORA'?0:2;
      if(ant.isQueen) sIdx=3;
      const sx=sIdx*cellW, sy=0;
      try{ pctx.drawImage(anthroSprite, sx,sy,cellW,cellH, 10,6,44,44); }catch(e){}
    } else if(typeof antSprite!=='undefined' && antSpriteReady){
      const nSprites=3, sw=antSprite.width/nSprites, sh=antSprite.height;
      let sIdx= ant.role==='EXCAVADORA'?1: ant.role==='EXPLORADORA'?2:0;
      const sx=sIdx*sw;
      try{ pctx.drawImage(antSprite, sx,0,sw,sh, 12,14,40,24); }catch(e){}
    } else {
      pctx.fillStyle='#c47a0a'; pctx.fillRect(16,20,32,14);
    }
    pctx.fillStyle='#fff'; pctx.font='bold 8px "Press Start 2P"'; pctx.textAlign='center'; pctx.fillText(ant.role.slice(0,3),32,58);
  }
  // botones
  document.getElementById('btnFollowAnt').onclick=()=>{
    workers.forEach(w=>w.selected=false); ant.selected=true; selectedAntIndex=workers.indexOf(ant);
    closeAntProfile();
  };
  document.getElementById('btnExileAnt').onclick=()=>{
    const newFac=society.nextFaction++;
    society.factions.push({id:newFac,name:'Exilio '+ant.id,color:'#ff3b30',members:1,belief:'-',leader:ant.id});
    ant.faction=newFac; ant.mood.anger=Math.min(1,ant.mood.anger+0.3); ant.mood.loyalty=0.1;
    pushEvent('war',`⚔ ${ant.id} exiliada a F${newFac} - destierro político`,`Facción nueva por decisión del jugador`);
        notifyCanon('⚔ EXILIO', `${ant.id} desterrada a facción ${newFac}`, 5000);
    closeAntProfile(); updateColonyUI();
  };
  // FIX: no apilar - si ya hay perfil abierto, ciérralo inmediato antes de abrir nuevo
  // dropdown desde debajo del calendario, mismo ancho que calendario (168px) para cuadre perfecto
  try{ closeQueenProfile(true); }catch(e){}
  // si ya está abierto este mismo modal con otra hormiga, solo actualiza contenido sin apilar
  const isOpen = modal.getAttribute('data-open')==='1' && modal.style.display!=='none';
  const prevAnt = modal.getAttribute('data-ant');
  if(isOpen && prevAnt===ant.id){
    // misma hormiga, solo refrescar y pulso
    modal.style.transform='translateY(0) scaleY(1)'; modal.style.opacity='1';
    return;
  }
  if(isOpen){
    // otra hormiga distinta: cierra inmediato y reabre para evitar stack visual
    modal.style.display='none';
    modal.removeAttribute('data-open');
  }
  const calEl=document.getElementById('calendarWidget');
  const calH = calEl ? calEl.offsetHeight : 180;
  const calW = calEl ? calEl.offsetWidth : 168;
  // dropdown exacto bajo calendario - mismo ancho dimensional (14px offset del widget + calH + gap 4)
  const calTop = calEl ? calEl.getBoundingClientRect().top : 14;
  // si getBoundingClientRect da 0 en headless, fallback a 14
  const _topOff = (calTop && calTop>2 && calTop<100) ? Math.round(calTop) : 14;
  modal.style.top = (_topOff + calH + 4) + 'px';
  modal.style.right = '14px';
  modal.style.left = 'auto';
  modal.style.width = '220px';
  modal.style.maxWidth = '220px';
  modal.style.height = '';
  modal.style.maxHeight = `calc(100vh - ${(_topOff + calH + 28)}px)`;
  modal.style.border = '4px solid #000';
  modal.style.borderTop = 'none';
  modal.style.boxShadow = '6px 6px 0 #000';
  modal.style.overflowY='auto';
  modal.style.transformOrigin='top';
  modal.style.transform='translateY(-12px) scaleY(0)';
  modal.style.opacity='0';
  modal.style.display='block';
  modal.setAttribute('data-open','1');
  modal.setAttribute('data-ant', ant.id);
  void modal.offsetWidth;
  modal.style.transition='transform 0.22s cubic-bezier(.2,.8,.2,1), opacity 0.22s';
  modal.style.transform='translateY(0) scaleY(1)';
  modal.style.opacity='1';
  // tabs
  try{
    const tabs=modal.querySelectorAll('#profileTabs [data-ptab]');
    const panes={rasgos:document.getElementById('profileTab_rasgos'), estado:document.getElementById('profileTab_estado'), arbol:document.getElementById('profileTab_arbol'), hist:document.getElementById('profileTab_hist')};
    tabs.forEach(btn=>{
      btn.onclick=(e)=>{
        e.stopPropagation();
        tabs.forEach(b=>{ b.style.background='#1a140f'; b.style.color='#8a7a5a'; });
        btn.style.background='var(--amber)'; btn.style.color='#000';
        const tab=btn.dataset.ptab;
        for(let k in panes){ if(panes[k]) panes[k].style.display = (k===tab?'block':'none'); }
      };
    });
    // default to rasgos
    tabs.forEach(b=>{ b.style.background='#1a140f'; b.style.color='#8a7a5a'; });
    const first=modal.querySelector('#profileTabs [data-ptab="rasgos"]');
    if(first){ first.style.background='var(--amber)'; first.style.color='#000'; }
    for(let k in panes){ if(panes[k]) panes[k].style.display = (k==='rasgos'?'block':'none'); }
  }catch(e){}
  // no empuja el mapa - overlay limpio, el reloj ya no tapa porque el pan tiene margen extra
  clampView(); updateZoomLabel();

}
function handleDeath(ant, reason){
  const idx=workers.indexOf(ant);
  if(idx>=0) workers.splice(idx,1);
  // partículas y evento
  for(let i=0;i<10;i++) particles.push({x:ant.x,y:ant.y,vx:(Math.random()-0.5)*2,vy:(Math.random()-0.5)*2,life:1,decay:0.025,color: reason==='vejez'?'#8a7a5a' : reason==='asesinato'?'#ff3b30' : '#555'});
  let msg=`💀 ${ant.id} muere`;
  if(reason==='vejez') msg+=` de vieja (${(ant.age/DAY_LENGTH).toFixed(1)}d)`;
  else if(reason==='hambre') msg+=' de hambre';
  else if(reason==='asesinato') msg+=` asesinada por ${ant.killer||'otra'}`;
  else if(reason==='guerra') msg+=` en guerra facción ${ant.faction}`;
  else msg+=` (${reason})`;
  pushEvent('death',msg, `Facción ${ant.faction} - Rol ${ant.role} - Ánimo J${(ant.mood.joy*100)|0} I${(ant.mood.anger*100)|0}`);
  // tristeza colectiva
  workers.forEach(w=>{ if(w.faction===ant.faction) w.mood.sadness=Math.min(1,w.mood.sadness+0.08); });
}
let lastGenTime=0; let _lastGenHint=0;
function checkLevelUp(){
  // realista: no se puede subir GEN cada segundo aunque pongas x16 - mínimo 0.34 días entre GEN (~6.8 min a x1, ~25s a x16)
  if(time - lastGenTime < DAY_LENGTH*0.34 && gen>=1){
    if(stats.xp >= stats.xpToNext && time - _lastGenHint > DAY_LENGTH*0.12){
      _lastGenHint=time;
      const falta=((DAY_LENGTH*0.34 - (time-lastGenTime))/DAY_LENGTH).toFixed(2);
      pushToast(W/2,H/2-10,'⏳ GEN madurando '+falta+'d','#8a7a5a',1.2);
    }
    return;
  }
  while(stats.xp >= stats.xpToNext){
    if(time - lastGenTime < DAY_LENGTH*0.34) break;
    stats.xp-=stats.xpToNext; stats.nivel++; stats.xpToNext=Math.floor(stats.xpToNext*1.55); gen++; lastGenTime=time;
    const res=mutateGenome(queen.genome,0.10,0.45);
    queen.genome=res.genome; lastMutInfo=res.changes.slice(0,2).join(' | ');
    pushEvent('evo',`Evolución GEN-${gen}: ${lastMutInfo}`,`Nodos ${queen.genome.hiddenSize} - FIT ${(colonyFitness||0).toFixed(2)} - IQ ${colonyIQ}`);
    fitnessHistory.push(colonyFitness); if(fitnessHistory.length>36) fitnessHistory.shift();
    colonyIQ=100 + Math.floor(gen*3.8) + Math.floor((queen.genome.hiddenSize-8)*3.5) + Math.floor(Math.min(colonyFitness,8.5)*2.1); // realista: +3.8 por gen no +7, fitness no explota
    if(colonyIQ>280) colonyIQ=280 + Math.floor((colonyIQ-280)*0.18); // tope realista, genias >280 cuesta muchísimo
    mutations++; pushToast(W/2, H/2 - 40, `🧬 GEN ${gen} - IQ ${colonyIQ}`,'#ffcc00',2.4);
  }
}
function getSensorsForAnt(ant){
  let foodAngle=0, foodDist=0;
  const nf=nearestFood(ant);
  if(nf){const ang=Math.atan2(nf.y-ant.y, nf.x-ant.x); let diff=((ang-ant.angle+Math.PI*3)%(Math.PI*2)-Math.PI); foodAngle=diff/Math.PI; foodDist=1-Math.min(1,dist(ant,nf)/280);}
  let pheroStr=0, pheroAng=0;
  const ph=nearestPhero(ant);
  if(ph){const ang=Math.atan2(ph.y-ant.y, ph.x-ant.x); let diff=((ang-ant.angle+Math.PI*3)%(Math.PI*2)-Math.PI); pheroAng=diff/Math.PI; pheroStr=ph.strength;}
  if(pheroStr<0.1 && commInks.length){
    let best=null,bd=Infinity;
    for(let ink of commInks){const d=dist(ant,ink); if(d<60 && d<bd){bd=d;best=ink;}}
    if(best){const ang=Math.atan2(best.y-ant.y, best.x-ant.x); let diff=((ang-ant.angle+Math.PI*3)%(Math.PI*2)-Math.PI); pheroAng=diff/Math.PI; pheroStr=best.life*0.7;}
  }
    const wallLeft= gameSpeed>8 ? 0.52 : 1 - rayWallDist(ant.x, ant.y, ant.angle - Math.PI/4, 40)/40;
  const wallCenter= 1 - rayWallDist(ant.x, ant.y, ant.angle, 40)/40;
  const wallRight= gameSpeed>8 ? 0.52 : 1 - rayWallDist(ant.x, ant.y, ant.angle + Math.PI/4, 40)/40;
  const fatigue=ant.fatigue/100;
  const carrying=ant.food?1:0;
  const neigh=nearestWorker(ant, ant.id);
  let commIn1=0, commIn2=0;
  if(neigh && dist(ant,neigh)<80){commIn1= neigh.commOut? neigh.commOut[0]:0; commIn2= neigh.commOut? neigh.commOut[1]:0;}
  if(commInks.length){
    for(let ink of commInks){ if(dist(ant,ink)<14){
      if(ink.sym==='⬢'){commIn1=0.8; commIn2=-0.2;}
      else if(ink.sym==='⬣'){commIn1=-0.2; commIn2=0.8;}
      else if(ink.sym==='◆'){commIn1=0.8; commIn2=0.8;}
      break;
    }}
  }
  return [foodAngle, foodDist, pheroStr, pheroAng, wallLeft, wallCenter, wallRight, fatigue, carrying, commIn1, commIn2];
}
function updateAnt(ant, dt){
  // herramientas: forja cerca del almacén/taller si es inteligente
  if(!ant.tool && !ant.food && dist(ant, storagePos())<26 && Math.random()<0.009){
    tryCraftTool(ant);
  }
  // edad ya sumada en loop, aquí solo lógica social/emocional
  if(!ant.mood) ant.mood={joy:0.5,anger:0,fear:0,sadness:0,loyalty:0.6,stress:0};
  if(ant.fatigue>80) ant.mood.stress=Math.min(1, ant.mood.stress+0.003);
  if(ant.blocked>20) ant.mood.anger=Math.min(1, ant.mood.anger+0.008);
  if(ant.state==='CAVANDO' && ant.digProgress>0) ant.mood.joy=Math.min(1, ant.mood.joy+0.004);
  let near = workers.find(o=> o!==ant && Math.hypot(o.x-ant.x,o.y-ant.y)<18);
  if(near){
    if(near.faction!==ant.faction && ant.mood.anger>0.55 && near.mood.anger>0.45 && Math.random()<0.009){
      ant.mood.anger=Math.min(1, ant.mood.anger+0.18); near.mood.anger=Math.min(1, near.mood.anger+0.15);
      ant.mood.fear=Math.min(1, ant.mood.fear+0.12); near.mood.fear=Math.min(1, near.mood.fear+0.12);
      const dmg = 8 + Math.random()*14 + ant.aggression*12;
      near.health-=dmg; ant.health-= dmg*0.6;
      for(let i=0;i<6;i++) particles.push({x:(ant.x+near.x)/2,y:(ant.y+near.y)/2,vx:(Math.random()-0.5)*3,vy:(Math.random()-0.5)*2,life:0.9,decay:0.04,color:'#ff3b30'});
      pushToast((ant.x+near.x)/2,(ant.y+near.y)/2,'⚔️','#ff3b30',1.2);
      if(near.health<=0){
        near.killer=ant.id; handleDeath(near, 'guerra'); ant.mood.joy=Math.min(1, ant.mood.joy+0.14); ant.crimes++; society.crimes++;
        pushImportant('crime',`⚔ ${ant.id} (F${ant.faction}) mata a ${near.id} (F${near.faction}) en guerra`, `Ira ${(ant.mood.anger*100)|0}% - Facciones ${society.factions.length}`);
        notifyCanon('⚔ ASESINATO', `${ant.id} mata a ${near.id} en guerra de facciones`, 5000);
      }
      if(ant.health<=0){ ant.killer=near.id; handleDeath(ant,'guerra'); }
      if(Math.random()<0.4) society.wars=1;
      return;
    }
    if(near.faction===ant.faction){
      if(near.mood.sadness>0.6 && ant.mood.joy>0.5 && Math.random()<0.015){
        near.mood.sadness=Math.max(0, near.mood.sadness-0.12); near.mood.joy=Math.min(1, near.mood.joy+0.08);
        if(Math.random()<0.3) near.belief=ant.id;
      }
      if(ant.food && !ant.food.isSoil && near.mood.anger>0.65 && near.mood.loyalty<0.35 && Math.random()<0.006){
        near.food=ant.food; ant.food=null;
        near.mood.joy=Math.min(1, near.mood.joy+0.18); ant.mood.anger=Math.min(1, ant.mood.anger+0.25); ant.mood.sadness=Math.min(1, ant.mood.sadness+0.18);
        pushImportant('crime',`🦹 ${near.id} roba miel a ${ant.id} (F${ant.faction})`,`Crimen - Lealtad ${(near.mood.loyalty*100)|0}%`);
        near.crimes++; society.crimes++;
        for(let i=0;i<5;i++) particles.push({x:ant.x,y:ant.y,vx:(Math.random()-0.5)*2,vy:-1,life:0.8,decay:0.03,color:'#ffcc00'});
      }
      if(near.followers>=3 && near.mood.anger>0.6 && queens[0] && queens[0].age>5000 && time-lastCoup>DAY_LENGTH*1.8 && Math.random()<0.0015){ lastCoup=time; 
        if(Math.random()<0.5){
          pushEvent('evo',`👑 ¡Golpe! ${near.id} y ${near.followers} seguidoras derrocan a ${queens[0].name}`,`Culto ${near.id}-ismo toma el poder`);
          notifyCanon('👑 GOLPE DE ESTADO', `${near.id} derroca a ${queens[0].name} con ${near.followers} seguidoras`, 6200);
          queens[0].health-=40;
        }
      }
    }
    if(near.commsSent>5 && Math.random()<0.012 && ant.mood.loyalty>0.5){
      ant.belief=near.id;
      ant.mood.loyalty=Math.min(1, ant.mood.loyalty+0.04);
    }
  }
  if(ant.deliveries===0 && ant.age>400 && Math.random()<0.001) ant.mood.sadness=Math.min(1, ant.mood.sadness+0.05);
  // === TROFALAXIA REAL: intercambio buche a buche (estómago social) ===
  if(ant.tandemCooldown>0) ant.tandemCooldown-=dt;
  if(Math.random()<0.045 && ant.crop>0.38){
    const near = nearestWorker(ant, ant.id);
    if(near && dist(ant,near)<13.5 && near.crop < near.cropMax*0.58){
      const give = Math.min(0.42, ant.crop, near.cropMax - near.crop);
      ant.crop-=give; near.crop+=give;
      ant.fitness+=0.05; near.fitness+=0.05;
      near.mood.joy=Math.min(1, near.mood.joy+0.04);
      if(Math.random()<0.5) particles.push({x:(ant.x+near.x)/2, y:(ant.y+near.y)/2-4, vx:(Math.random()-0.5)*0.5, vy:-0.6, life:0.9, decay:0.025, color:'#ffe9a3'});
    }
  }
  // === TANDEM RUNNING: reclutamiento 1-a-1 en colonia pequeña (Pontier) ===
  if(!ant.tandemCooldown) ant.tandemCooldown=0;
  if(ant.food && !ant.food.isSoil && workers.length<16 && Math.random()<0.007 && ant.tandemCooldown<=0 && !ant.tandemPartner){
    const follower = workers.find(w=>w.id!==ant.id && w.state==='EXPLORAR' && !w.food && !w.tandemPartner && dist(ant,w)<26);
    if(follower){
      ant.tandemPartner=follower.id; follower.tandemPartner=ant.id;
      ant.state='TANDEM_LEADER'; follower.state='TANDEM_FOLLOWER'; follower.targetFood=ant.targetFood || ant.food;
      ant.tandemCooldown=320; follower.tandemCooldown=320;
      pushEvent('evo',`🤝 Tandem ${ant.id} → ${follower.id}`,`Guía 1-a-1 a comida - colonia pequeña`);
    }
  }
  if(ant.mood.sadness>0.82) ant.mood.joy=Math.max(0, ant.mood.joy-0.01);
  if(ant.mood.anger>0.75) ant.mood.loyalty=Math.max(0, ant.mood.loyalty-0.008);
  // === FÍSICA REAL: gravedad ===
  // helpers internos
  function hasGrip(_x,_y){
    const _c=Math.floor(_x/CELL), _r=Math.floor((_y+10)/CELL);
    if(_r>=0&&_r<ROWS&&_c>=0&&_c<COLS){
      if(soil[_r]&&soil[_r][_c]===1) return 'floor';
      for(let s of structures){ if(_c>=s.c&&_c<s.c+s.w && _r>=s.r&&_r<s.r+s.h) return 'floor'; }
    }
    // hormigas reales: arolia + garras + pelos = trepan cualquier cosa (hasta vidrio) y duermen en techo
    for(let dr=-1; dr<=1; dr++) for(let dc=-1; dc<=1; dc++){
      if(dr===0&&dc===0) continue;
      const nc=_c+dc, nr=_r+dr;
      const checkR = dr===-1 ? Math.floor((_y-8)/CELL) : _r;
      if(nc<0||nc>=COLS||checkR<SURFACE_ROW||checkR>=ROWS) continue;
      if(soil[checkR]&&soil[checkR][nc]===1){
        const dx=nc*CELL+8 - _x, dy=checkR*CELL+8 - _y;
        if(Math.hypot(dx,dy) < 18.5) return 'wall';
      }
      for(let s of structures){ if(nc>=s.c&&nc<s.c+s.w && checkR>=s.r&&checkR<s.r+s.h) return 'wall'; }
    }
    // borde diagonal cercano también agarra (18% antes, ahora más generoso)
    const _r2=_r; const _c1=_c-1,_c2=_c+1;
    if(_c1>=0&&soil[_r2]&&soil[_r2][_c1]===1 && Math.hypot((_c1*CELL+8)-_x, (_r2*CELL+8)-_y) < 18) return 'wall';
    if(_c2<COLS&&soil[_r2]&&soil[_r2][_c2]===1 && Math.hypot((_c2*CELL+8)-_x, (_r2*CELL+8)-_y) < 18) return 'wall';
    return null;
  }
  function hasFloorBelow(_x,_y){ return !!hasGrip(_x,_y); }
  if(ant.y < SURFACE_Y - 12){
    if(Math.abs(ant.x - (CENTER_COL*CELL+8)) > 28){
      ant.y = SURFACE_Y - 6;
      ant.angle = Math.PI/2 + (Math.random()-0.5)*0.3;
      ant.blocked = 0;
      if(ant.sensors) ant.sensors.wallCenter = 1;
    } else {
      if(!ant.vy) ant.vy = 0;
      ant.vy += 0.52 * (gameSpeed>1?1.6:1);
      ant.y += ant.vy;
      if(ant.y >= SURFACE_Y - 6){ ant.y = SURFACE_Y - 6; ant.vy=0; ant.angle = Math.PI/2; }
      if(ant.y < SURFACE_Y - 12) return;
    }
    ant.vy = 0;
  } else {
    // SOTERRADO: física real hormiga - pueden trepar paredes/techo con arolia, no solo piso
    const grip=hasGrip(ant.x, ant.y);
    const gripWall = grip==='wall';
    if(!grip){
      if(ant.vy===undefined) ant.vy=0;
      ant.vy += 0.62 * (gameSpeed>1?1.35:1);
      let fallX= ant.x + Math.cos(ant.angle)*0.28;
      if(canMove(fallX, ant.y)) ant.x = fallX;
      ant.y += ant.vy;
      let cr=Math.floor((ant.y+10)/CELL), cc=Math.floor(ant.x/CELL);
      if(cr>=ROWS) { ant.y=(ROWS-1)*CELL-10; ant.vy=0; }
      else if(soil[cr]&&soil[cr][cc]===1){
        ant.y = cr*CELL - 10;
        ant.vy=0;
        ant.fatigue=Math.min(100, ant.fatigue+0.6);
        if(ant.vy>3 && Math.random()<0.18) particles.push({x:ant.x,y:ant.y+10,vx:(Math.random()-0.5)*0.7,vy:-0.6,life:0.6,decay:0.05,color:'#8b7a5a'});
      } else {
        if(ant.state==='CAVANDO') { ant.state='EXPLORAR'; ant.digTarget=null; }
        ant.x = Math.max(12, Math.min(W-12, ant.x));
        ant.y = Math.max(8, Math.min(ROWS*CELL-12, ant.y));
        if(ant.vy>7) ant.vy=7;
        return;
      }
    } else if(gripWall){
      if(ant.vy) ant.vy*=0.72;
      if(ant.vy && Math.abs(ant.vy)>0.6) ant.vy= Math.max(-1.2, Math.min(1.2, ant.vy*0.5));
      ant.fatigue+=0.006*gameSpeed;
      ant._climbing=true;
      // física real: la cabeza apunta a donde trepa (arriba/abajo por pared), no solo izq-der
      // calcula pared más cercana para orientar la cabeza
      const _c=Math.floor(ant.x/CELL), _r=Math.floor((ant.y+10)/CELL);
      let bestWall=null, bestD=99;
      for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++){
        if(dr===0&&dc===0) continue;
        const nc=_c+dc, nr=_r+dr;
        if(nc<0||nc>=COLS||nr<SURFACE_ROW||nr>=ROWS) continue;
        if(soil[nr][nc]===1){
          const d=Math.hypot(nc*CELL+8-ant.x, nr*CELL+8-ant.y);
          if(d<bestD){ bestD=d; bestWall={dc,dr}; }
        }
      }
      if(bestWall){
        // si pared a izquierda/derecha -> trepar vertical (cabeza arriba/abajo)
        if(Math.abs(bestWall.dc)===1 && bestWall.dr===0){
          // vertical wall -> angle debe ser -PI/2 (arriba) o PI/2 (abajo) según destino
          // usa steer y sensores para decidir si va arriba o abajo
          const wantUp = (ant.digTarget && ant.digTarget.r < _r) || (ant.food && storagePos().y < ant.y) || Math.sin(ant.angle) < -0.3;
          const targetAngle = wantUp ? -Math.PI/2 : Math.PI/2;
          // interpola ángulo hacia vertical (física: la hormiga gira el cuerpo 90°)
          let diff=((targetAngle - ant.angle + Math.PI*3)%(Math.PI*2)-Math.PI);
          ant.angle += diff*0.14;
        } else if(bestWall.dr===-1){
          // techo -> cabeza apunta horizontal pero invertida (boca abajo)
          // mantiene ángulo horizontal pero con flip visual (se maneja en render con scaleY)
          ant._onCeiling=true;
        } else {
          ant._onCeiling=false;
        }
      }
    } else {
      if(ant.vy) ant.vy=0;
      ant._climbing=false;
      ant._onCeiling=false;
    }
    ant.x = Math.max(12, Math.min(W-12, ant.x));
    ant.y = Math.max(8, Math.min(ROWS*CELL-12, ant.y));
  }
  let steer, thrust, digIntent, comm1, comm2;
  if(gameSpeed>8 && ant._nnCooldown && ant._nnCooldown>0){
    ant._nnCooldown-=dt;
    const out = ant._nnOutCached || ant.nnOut || [0,0,0,0,0];
    steer=out[0]; thrust=(out[1]+1)/2; digIntent=(out[2]+1)/2; comm1=out[3]; comm2=out[4];
    ant.commOut=[comm1, comm2];
  } else {
    const inputs=getSensorsForAnt(ant);
    ant.sensors={foodAngle:inputs[0],foodDist:inputs[1],pheroStr:inputs[2],pheroAng:inputs[3],wallLeft:inputs[4],wallCenter:inputs[5],wallRight:inputs[6],fatigue:inputs[7],carrying:inputs[8],commIn1:inputs[9],commIn2:inputs[10]};
    const {hidden,out}=forwardNN(inputs, ant.genome);
    ant.nnHidden=hidden; ant.nnOut=out;
    ant._nnOutCached=out; ant._nnCooldown = gameSpeed>8? 5.2 : 0;
    steer=out[0]; thrust=(out[1]+1)/2; digIntent=(out[2]+1)/2; comm1=out[3]; comm2=out[4];
    ant.commOut=[comm1, comm2];
    if(Math.abs(comm1)>0.52 || Math.abs(comm2)>0.52){
      try{
        const concept = comm1>0.6?'COMIDA': comm2>0.6?'CASA': Math.abs(comm1)>0.4?'PELIGRO':'AYUDA';
        const phrase = typeof antUtterance==='function' ? antUtterance(ant, concept) : '';
        if(phrase){ ant.lastPhrase=phrase; ant.lastConcept=concept; ant.phraseTime=90; ant.lastInkPhrase=phrase; }
      }catch(e){}
    }
    if(Math.abs(comm1)>0.6 || Math.abs(comm2)>0.6){
      ant.commsSent++; commsCount++;
      if(time - ant.lastInk > 9 && Math.abs(comm1)>0.45){
        const sym=symbolForComms(comm1,comm2);
        const col=inkColorForSymbol(sym);
        commInks.push({x:ant.x, y:ant.y, sym, color:col, life:1, decay:0.0016});
        ant.lastInk=time;
        if(commInks.length>180) commInks.shift();
      }
      if(Math.random()<0.0028 && Math.abs(comm1)>0.7){
        const sym = symbolForComms(comm1,comm2);
        const neigh=nearestWorker(ant,ant.id);
        pushEvent('comms',`${ant.id} pinta ${sym} [${(comm1 ?? 0).toFixed(2)},${(comm2 ?? 0).toFixed(2)}] → ${neigh?neigh.id:'suelo'}`, `GEN${ant.genome.gen} - rol ${ant.role}`);
        if(Math.random()<0.45) setNarration(`<b>${ant.id} grita ${sym}</b> - tinta <span style="color:${inkColorForSymbol(sym)}">● ${sym==='⬢'?'¡COMIDA!':sym==='⬣'?'¡AYUDA!':sym==='◆'?'¡TESORO!':'..'}</span>`);
      }
    }
  }
  const speedBase=1.55;
  let speed=speedBase*(0.35+thrust*0.9) * (1 + Math.min(2.8, (gameSpeed-1)*0.22));
  if(ant.role==='EXCAVADORA') speed*=0.92;
  if(ant.role==='RECOLECTORA') speed*=1.08;
  if(ant.role==='EXPLORADORA') speed*=1.12;
  if(typeof workers!=='undefined' && workers.length<=2) speed*=1.45; // turbo rescate 1-hormiga (polivalente)
  // ánimo afecta velocidad: deprimida va lento, asustada corre, enojada embiste
  if(ant.mood.sadness>0.65) speed*= (0.78 - (ant.mood.sadness-0.65)*0.5);
  if(ant.mood.joy>0.7) speed*=1.08;
  if(ant.mood.fear>0.6) speed*=1.14;
  if(ant.mood.stress>0.7) speed*=0.88;
  // facción: si hay guerra, se mueve más rápido hacia enemigo
  if(society.wars && ant.mood.anger>0.5) speed*=1.06;
  // animación suave - walkPhase basado en distancia real, cap para no hiper a x16
  const moveDelta = Math.min(speed, 3.4) * 0.042;
  ant._walkPhase = (ant._walkPhase||0) + moveDelta;
  ant._bobPhase = (ant._bobPhase||0) + 0.052 + moveDelta*0.12;
  if(ant._renderX===undefined){ ant._renderX=ant.x; ant._renderY=ant.y; }
  // lerp visual 0.28 = smooth incluso a x16 sin jitter
  ant._renderX += (ant.x - ant._renderX) * 0.32;
  ant._renderY += (ant.y - ant._renderY) * 0.32;
  if(ant._climbing) speed*=0.72;
  // herramienta
  if(ant.tool==='pick') speed*=1.16;
  if(ant.tool==='trowel') speed*=1.09;
  if(ant.state!=='DESCANSAR'){
    ant.fatigue+=dt*0.10;
    if(ant.fatigue>86 && Math.random()<0.02) ant.state='DESCANSAR';
  }else{
    ant.fatigue-=dt*0.6;
    if(ant.fatigue<=12) ant.state='EXPLORAR';
    const deep={x:CENTER_COL*CELL, y:(SURFACE_ROW+12)*CELL};
    const ang=Math.atan2(deep.y-ant.y, deep.x-ant.x);
    ant.angle+=(((ang-ant.angle+Math.PI*3)%(Math.PI*2)-Math.PI)*0.04);
    const nx=ant.x+Math.cos(ant.angle)*speed*0.22, ny=ant.y+Math.sin(ant.angle)*speed*0.22;
    if(canMove(nx,ny)){ant.x=nx;ant.y=ny;}
    return;
  }
  ant.fatigue=Math.max(0,Math.min(100,ant.fatigue));
  if(ant.state==='TANDEM_LEADER'){
    const follower = workers.find(w=>w.id===ant.tandemPartner);
    if(!follower || dist(ant,follower)>34 || follower.state!=='TANDEM_FOLLOWER'){
      ant.state='EXPLORAR'; ant.tandemPartner=null;
      if(follower){ follower.state='EXPLORAR'; follower.tandemPartner=null; }
      return;
    }
    if(dist(ant,follower)>13.5){
      if(Math.random()<0.14) pheromones.push({x:ant.x,y:ant.y,strength:0.52,life:1,type:'recruit'});
      return;
    }
    const tgt = ant.targetFood || nearestFood(ant) || {x:ant.x+Math.cos(ant.angle)*40, y:ant.y+Math.sin(ant.angle)*40};
    const ang=Math.atan2(tgt.y-ant.y, tgt.x-ant.x);
    ant.angle+= ((ang-ant.angle+Math.PI*3)%(Math.PI*2)-Math.PI)*0.14;
    const nx=ant.x+Math.cos(ant.angle)* (1.02*gameSpeed), ny=ant.y+Math.sin(ant.angle)*(1.02*gameSpeed);
    if(canMove(nx,ny)){ant.x=nx; ant.y=ny;}
    if(dist(ant,tgt)<10){ ant.state='VOLVER_COMIDA'; follower.state='EXPLORAR'; follower.tandemPartner=null; ant.tandemPartner=null; }
    if(Math.random()<0.09) pheromones.push({x:ant.x,y:ant.y,strength:0.48,life:1,type:'recruit'});
    return;
  }
  if(ant.state==='TANDEM_FOLLOWER'){
    const leader = workers.find(w=>w.id===ant.tandemPartner);
    if(!leader || leader.state!=='TANDEM_LEADER' || dist(ant,leader)>36){
      ant.state='EXPLORAR'; ant.tandemPartner=null;
      if(leader){ leader.tandemPartner=null; if(leader.state==='TANDEM_LEADER') leader.state='EXPLORAR';}
      return;
    }
    const ang=Math.atan2(leader.y-ant.y, leader.x-ant.x);
    ant.angle+= ((ang-ant.angle+Math.PI*3)%(Math.PI*2)-Math.PI)*0.19;
    const nx=ant.x+Math.cos(ant.angle)* (1.18*gameSpeed), ny=ant.y+Math.sin(ant.angle)*(1.18*gameSpeed);
    if(canMove(nx,ny)){ant.x=nx; ant.y=ny;}
    return;
  }
  if(ant.state==='LLEVANDO_BASURA' && ant.wasteTarget){
    const tgt=ant.wasteTarget;
    const ang=Math.atan2(tgt.y-ant.y, tgt.x-ant.x);
    ant.angle+= ((ang-ant.angle+Math.PI*3)%(Math.PI*2)-Math.PI)*0.13;
    const nx=ant.x+Math.cos(ant.angle)*1.05*gameSpeed, ny=ant.y+Math.sin(ant.angle)*1.05*gameSpeed;
    if(canMove(nx,ny)){ant.x=nx; ant.y=ny;}
    if(dist(ant,tgt)<10){
      // deja basura en cámara de desecho
      wastePiles.push({x:tgt.x+(Math.random()-0.5)*12, y:tgt.y+(Math.random()-0.5)*10, age:0});
      if(wastePiles.length>22) wastePiles.shift();
      ant.state='EXPLORAR'; ant.wasteTarget=null; ant.fitness+=0.12;
    }
    return;
  }
  if(ant.state==='CAVANDO' && ant.digTarget){
    const tx=(ant.digTarget.c+0.5)*CELL, ty=(ant.digTarget.r+0.5)*CELL;
    const ang=Math.atan2(ty-ant.y, tx-ant.x);
    let diff=((ang-ant.angle+Math.PI*3)%(Math.PI*2)-Math.PI); ant.angle+=diff*0.18;
    const d=dist(ant,{x:tx,y:ty});
    if(d>10){
      const nx=ant.x+Math.cos(ant.angle)*speed*0.82, ny=ant.y+Math.sin(ant.angle)*speed*0.82;
      if(canMoveIgnoreTarget(nx,ny,ant.digTarget)){ant.x=nx;ant.y=ny;}else{
        // intentar deslizar por pared: probar solo X o solo Y (ignorando bloque objetivo)
        const sx=ant.x+Math.cos(ant.angle)*speed*0.45;
        const sy=ant.y+Math.sin(ant.angle)*speed*0.45;
        if(canMoveIgnoreTarget(sx,ant.y,ant.digTarget)) ant.x=sx;
        else if(canMoveIgnoreTarget(ant.x,sy,ant.digTarget)) ant.y=sy;
        else ant.angle+=(Math.random()-0.5)*0.7;
      }
    }else{
      const toolDig = ant.tool==='pick'?1.38 : ant.tool==='trowel'?1.18 : 1;
      ant.digProgress+=(1.6+ (ant.role==='EXCAVADORA'?0.28:0.12)*10)*Math.max(1, gameSpeed*0.85)*toolDig;
      if(Math.random()<0.65) particles.push({x:tx+(Math.random()-0.5)*10,y:ty+(Math.random()-0.5)*10,vx:(Math.random()-0.5)*1.4,vy:-Math.random()*1.4,life:1,decay:0.04,color:'#8b5a2b'});
      if(Math.random()<0.18) particles.push({x:tx,y:ty-8,vx:(Math.random()-0.5)*0.6,vy:-0.9,life:1,decay:0.03,color:'#ffcc00'});
      if(ant.digProgress>=ant.digNeeded){
        const _mt = (soilType[ant.digTarget.r]&&soilType[ant.digTarget.r][ant.digTarget.c])||1; if(_mt===7 && (gen<8 || !inventions.masonry)){ ant.digTarget=null; ant.digProgress=0; ant.state='EXPLORAR'; pushToast(ant.x,ant.y-10,'⛔ BEDROCK','#555'); return; }
        soil[ant.digTarget.r][ant.digTarget.c]=0; if(soilType[ant.digTarget.r]) soilType[ant.digTarget.r][ant.digTarget.c]=0; markSoilDirty(); ant.digsDone++; digs++; colonyFitness+=0.35; if(digs%6===0) pushImportant('invention', `⛏ ${digs} bloques cavados`, `GEN${typeof gen!=='undefined'?gen:0} - ${workers.filter(w=>w.state==='CAVANDO').length} activas en [${ant.digTarget?ant.digTarget.c:''},${ant.digTarget?ant.digTarget.r:''}]`);
        // residuo real: la tierra excavada va a basurero, no desaparece
        if(Math.random()<0.52){ wastePiles.push({x:tx, y:ty, age:0, type:_mt}); if(wastePiles.length>24) wastePiles.shift(); }
        // cosecha de material según estrato
        if(_mt===2 && Math.random()<0.72){ worldMaterials.clay+=1; if(inventions.clay) colonyFitness+=0.06; }
        else if(_mt===3 && Math.random()<0.62){ worldMaterials.sand+=1; }
        else if(_mt===4 && Math.random()<0.55){ worldMaterials.stone+=1; if(inventions.stone) colonyFitness+=0.05; }
        else if(_mt===1 && Math.random()<0.22){ worldMaterials.fiber+=1; } // raíces
        if(_mt===4) pushToast(tx,ty-16,'⛏ PIEDRA','#8a8a8a',1.3);
        else if(_mt===2) pushToast(tx,ty-16,'✓ TÚNEL','#d4a574',1.3);
        else pushToast(tx,ty-16,'✓ TÚNEL','#2de67a',1.3);
        logAntHistory(ant, `abrió túnel [${ant.digTarget.c},${ant.digTarget.r}]`);
        checkRewardDiscovery(ant.digTarget.c, ant.digTarget.r);
        if(Math.random()<0.28){
          const neigh=[[ -1,0],[1,0],[0,-1],[0,1]];
          for(let [dx,dy] of neigh) if(Math.random()<0.45){
            const nc=ant.digTarget.c+dx, nr=ant.digTarget.r+dy;
            if(nr>=SURFACE_ROW&&nr<ROWS&&nc>=0&&nc<COLS&&soil[nr][nc]===1&&Math.random()<0.5){ soil[nr][nc]=0; if(soilType[nr]) soilType[nr][nc]=0; markSoilDirty(); }
          }
        }
        if(Math.random()<0.015 && countChambers()>4){
          const empties=[]; for(let r=SURFACE_ROW;r<ROWS;r++) for(let c=0;c<COLS;c++) if(soil[r][c]===0) empties.push({c,r});
          if(empties.length>40){
            const pick=empties[Math.floor(Math.random()*empties.length)];
            for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){
              const nc=pick.c+dx, nr=pick.r+dy;
              if(nr>=SURFACE_ROW&&nr<ROWS&&nc>=0&&nc<COLS) if(Math.random()<0.6){ soil[nr][nc]=1; if(soilType[nr]) soilType[nr][nc]= (Math.random()<0.6?4:2); markSoilDirty(); }
            }
            accidents++; pushEvent('accident',`¡DERRUMBE en [${pick.c},${pick.r}]!`, `Cámaras: ${countChambers()}`);
            notifyCanon('💥 DERRUMBE', `Túnel colapsa en [${pick.c},${pick.r}]`, 5000); pushToast(pick.c*CELL,pick.r*CELL,'💥 DERRUMBE','#ff3b30',2.8);
            for(let i=0;i<10;i++) particles.push({x:pick.c*CELL,y:pick.r*CELL,vx:(Math.random()-0.5)*2,vy:(Math.random()-0.5)*2,life:1,decay:0.03,color:'#ff3b30'});
          }
        }
        for(let i=0;i<7;i++) particles.push({x:tx,y:ty,vx:(Math.random()-0.5)*2,vy:(Math.random()-0.5)*2,life:1,decay:0.03,color:'#ffcc00'});
        // ARQUITECTURA REAL: si es excavadora veterana o colonia avanzada, abre cámara en vez de solo 1 bloque
        if((ant.traits.construccion>62 || gen>=4) && Math.random()< (0.08 + gen*0.012 + colonyIQ*0.0006) && countChambers()<18){
          const w= 3 + Math.floor(Math.random()*2) + (gen>6?1:0); // 3-5 ancho (Disc shape real: más ancho que alto)
          const h= 2 + Math.floor(Math.random()*2);
          const carved= excavateChamber(ant.digTarget.c, ant.digTarget.r, w, h, ant);
          if(carved>4){
            pushEvent('build',`🏛 ${ant.id} esculpe cámara ${w}x${h} [${ant.digTarget.c},${ant.digTarget.r}]`, `Arquitectura real - ${carved} celdas - GEN${gen}`);
            // no volver con tierra si hizo cámara grande, sigue excavando
            if(Math.random()<0.35) ant.state='EXPLORAR';
          }
        }
        ant.food={amount:1,isSoil:true}; ant.digTarget=null; ant.digProgress=0; ant.state='VOLVER_TIERRA';
      }
    }
    return;
  }
  if(ant.state==='VOLVER_TIERRA'){
    // decidir si construir una pared estratégica en vez de solo tirar tierra en la entrada
    if(!ant.buildTarget){
      const buildChance = 0.16 + (ant.traits.construccion/100)*0.22 + Math.min(0.14, (colonyIQ-100)/520) + gen*0.009; // más lento al inicio
      const canBuild = ant.role==='EXCAVADORA' || ant.role==='NODRIZA' || ant.traits.construccion>48;
      if(canBuild && Math.random()<buildChance){
        const site=findBuildSite(ant);
        if(site){ ant.buildTarget=site; ant.buildProgress=0; }
      }
    }
    const tgt = ant.buildTarget ? {x:ant.buildTarget.c*CELL+8, y:ant.buildTarget.r*CELL+8} : surfaceEntrance();
    const ang=Math.atan2(tgt.y-ant.y, tgt.x-ant.x);
    const bias=steer*0.22;
    ant.angle+=(((ang-ant.angle+Math.PI*3)%(Math.PI*2)-Math.PI)*0.11 + bias*0.07);
    const nx=ant.x+Math.cos(ant.angle)*speed, ny=ant.y+Math.sin(ant.angle)*speed;
    // al construir, ignorar el propio bloque destino si es túnel (vacío) - necesita llegar
    const can = ant.buildTarget ? canMove(nx,ny) : canMove(nx,ny);
    if(can){ant.x=nx;ant.y=ny;ant.blocked=0;}else{ant.blocked++; ant.angle+=0.32; if(ant.blocked>44){ant.state='EXPLORAR';ant.blocked=0; ant.buildTarget=null;}}
    if(dist(ant,tgt)<10){
      if(ant.buildTarget){
        // intenta estructura compleja primero si son inteligentes
        if(tryBuildComplexStructure(ant, ant.buildTarget)){
          ant.buildTarget=null; ant.food=null; ant.state='EXPLORAR'; ant.blocked=0; return;
        }
        // colocar bloque: de túnel pasa a tierra - forma cámara
        const c=ant.buildTarget.c, r=ant.buildTarget.r;
        if(soil[r][c]===0){
          // progreso constructivo con andamiaje - no instantáneo, se ve poco a poco (suficientes frames)
          ant.buildProgress = (ant.buildProgress||0) + dt*0.11;
          if(ant.buildProgress < 1.0){
            // andamiaje pixel mientras construye + polvo
            if(Math.random()<0.22) particles.push({x:c*CELL+8 + (Math.random()-0.5)*8, y:r*CELL+8, vx:(Math.random()-0.5)*1.0,vy:-Math.random()*0.9,life:1,decay:0.035,color:'#8b5a2b'});
            return;
          }
          ant.buildProgress=0;
          soil[r][c]=1; markSoilDirty();
          // material usado: si son inteligentes usan piedra/arcilla/madera según stock
          let usedType=1;
          if(inventions.wood && worldMaterials.wood>0 && ant.traits.construccion>62 && Math.random()<0.28){ worldMaterials.wood--; usedType=1; decoSet.add(dkey(c,r)); }
          else if(inventions.stone && worldMaterials.stone>2 && Math.random()<0.32){ worldMaterials.stone-=2; usedType=4; }
          else if(inventions.clay && worldMaterials.clay>1 && Math.random()<0.38){ worldMaterials.clay-=1; usedType=2; }
          else if(worldMaterials.sand>1 && Math.random()<0.18){ worldMaterials.sand-=1; usedType=3; }
          if(soilType[r]) soilType[r][c]=usedType;
          if(usedType===4) pushToast(tgt.x,tgt.y-10,'🧱 PIEDRA','#8a8a8a',1.4);
          else if(usedType===2) pushToast(tgt.x,tgt.y-10,'🏺 ARCILLA','#c2a080',1.4);
          // ingeniera decora: solo si han aprendido (gen>=3, IQ>130, cámaras>=3) y por gusto cuidado alto
          const canDecorate = gen>=3 && colonyIQ>132 && countChambers()>=4; // realista: decorar no desde GEN2
          if(canDecorate && ant.traits.cuidado>62 && Math.random() < 0.09 + ant.traits.cuidado*0.002){
            decoSet.add(dkey(c,r)); markSoilDirty();
            // bonus extra por embellecer
            colonyFitness+=0.12; ant.fitness+=0.18;
          }
          // refuerzo visual: si forma una cámara pequeña, bonus fitness
          const chambersBefore=countChambers();
          for(let i=0;i<6;i++) particles.push({x:tgt.x+(Math.random()-0.5)*10,y:tgt.y+(Math.random()-0.5)*10,vx:(Math.random()-0.5)*1.2,vy:-Math.random()*1.2,life:1,decay:0.04,color:'#6b3a1f'});
          if(usedType===1) pushToast(tgt.x,tgt.y-10,'🧱 PARED','#8b5a2b',1.6);
          const after=countChambers();
          if(after>=chambersBefore) { colonyFitness+=0.28; ant.fitness+=0.45; }
          pushEvent('build',`${ant.id} construye pared [${c},${r}]`, `Cámaras ${after} - IQ ${colonyIQ}`);
          if(Math.random()<0.35) setNarration(`<b>${ant.id} levanta un muro</b> en [${c},${r}] - la colonia diseña sus cuartos.`);
        }
        ant.buildTarget=null;
      } else {
        // TERRARIA: si lleva tierra, intenta rellenar un hueco útil cerca de donde está, no solo en entrada
        // busca el hueco vacío más cercano con apoyo (para no poner tierra flotando)
        if(ant.food && ant.food.isSoil){
          let best=null, bestD=Infinity;
          for(let dr=-2;dr<=2;dr++) for(let dc=-2;dc<=2;dc++){
            const nc=Math.floor(ant.x/CELL)+dc, nr=Math.floor(ant.y/CELL)+dr;
            if(nr<SURFACE_ROW||nr>=ROWS||nc<0||nc>=COLS) continue;
            if(soil[nr][nc]!==0) continue;
            // necesita apoyo debajo para no flotar (Terraria)
            const hasSupport = (nr+1<ROWS && soil[nr+1][nc]===1) || (nc>0&&nr+1<ROWS&&soil[nr+1][nc-1]===1) || (nc<COLS-1&&nr+1<ROWS&&soil[nr+1][nc+1]===1);
            if(!hasSupport) continue;
            const d=Math.hypot(nc*CELL+8-ant.x, nr*CELL+8-ant.y);
            if(d<bestD && d<28){ bestD=d; best={c:nc,r:nr}; }
          }
          if(best){
            soil[best.r][best.c]=1; soilType[best.r][best.c]=1; markSoilDirty();
            ant.food=null; ant.state='EXPLORAR'; ant.blocked=0;
            for(let i=0;i<5;i++) particles.push({x:best.c*CELL+8,y:best.r*CELL+8,vx:(Math.random()-0.5)*1,vy:-0.4,life:0.6,decay:0.04,color:'#6b3a1f'});
            pushEvent('build',`${ant.id} rellena [${best.c},${best.r}] con tierra (Terraria)`, `Reconstrucción - GEN${gen}`);
            return;
          }
        }
        mound.push({x:tgt.x+(Math.random()-0.5)*22,y:SURFACE_Y-2,h:4+Math.random()*5});
        if(mound.length>30) mound.shift();
      }
      ant.food=null; ant.state='EXPLORAR'; ant.blocked=0;
    }
    return;
  }
  const carrying=!!ant.food && !ant.food.isSoil;
  if(carrying){
    ant.state='VOLVER_COMIDA';
    let tgt=storagePos();
    // waypoint Minecraft: si estás en la superficie (y < 100) y lejos del hueco central, ve primero a la boca del túnel para no atravesar tierra en diagonal
    const shaftX = CENTER_COL*CELL+8;
    if(ant.y < SURFACE_Y+12 && Math.abs(ant.x - shaftX) > 24){
      tgt={x: shaftX, y: SURFACE_Y-6};
    }
    const ang=Math.atan2(tgt.y-ant.y, tgt.x-ant.x);
    const steerBias=steer*0.55;
    let diff=((ang-ant.angle+Math.PI*3)%(Math.PI*2)-Math.PI);
    ant.angle+= diff*0.07 + steerBias*0.08;
    if(Math.abs(ant.sensors.commIn1)>0.5) ant.angle+= ant.sensors.commIn1*0.04;
    const nx=ant.x+Math.cos(ant.angle)*speed, ny=ant.y+Math.sin(ant.angle)*speed;
    if(canMove(nx,ny)){ant.x=nx;ant.y=ny;ant.blocked=0;}else{ ant.blocked++; ant.angle+=(Math.random()-0.5)*0.9 + 0.12; if(ant.blocked>32){ ant.angle+=Math.PI*0.45; ant.blocked=0; /* no abandonar miel: seguir intentando VOLVER_COMIDA */ } }
    if(time-ant.lastPhero>11){ const isRecruit=!!ant.food && !ant.food.isSoil; const amt=isRecruit?(ant.food.amount||1):1; pheromones.push({x:ant.x,y:ant.y,strength: isRecruit? 0.92+amt*0.18 : 0.38, life:1, type: isRecruit?'recruit':'explore', quality: amt}); ant.lastPhero=time; }
    if(dist(ant,tgt)<14){
      const amt=ant.food.amount; ant.food=null; ant.targetFood=null; ant.deliveries++; deliveries++; colonyFood+=amt;
      // trofalaxia: la forrajera llena su buche y comparte luego
      ant.crop=Math.min(ant.cropMax||1.6, (ant.crop||0)+ amt*0.38);
      const xpGain=amt*14+7; stats.xp+=xpGain; // -40% XP, lleva tiempo
      pushEvent('food',`${ant.id} entrega x${amt} → despensa (total ${colonyFood})`, `GIRO ${(steer ?? 0).toFixed(2)} - TINTA [${(comm1 ?? 0).toFixed(1)},${(comm2 ?? 0).toFixed(1)}]`);
      logAntHistory(ant, `entregó ${amt} miel`); ant.mood.joy=Math.min(1, ant.mood.joy+0.12);
      pushToast(tgt.x,tgt.y-18,`+${amt} 🍯`,'#ffcc00',1.8);
      setNarration(`<b>${ant.id} entregó ${amt} 🍯</b> - despensa <b>${colonyFood}</b>.`);
      colonyFitness+=1.0; ant.fitness+=1.0;
      ant.fatigue=Math.max(0,ant.fatigue-14);
      if(foods.length<3 && Math.random()<0.7) spawnFoodSurface(CENTER_COL*CELL+8 + (Math.random()-0.5)*220,1+Math.floor(Math.random()*2));
      for(let i=0;i<9;i++) particles.push({x:tgt.x,y:tgt.y,vx:(Math.random()-0.5)*3,vy:-Math.random()*2,life:1,decay:0.025,color:'#ffcc00'});
      ant.blocked=0; checkLevelUp();
    }
    return;
  }
  if(ant.targetFood && !foods.includes(ant.targetFood)) ant.targetFood=null;
  if(!ant.targetFood){
    let nf=null, bd=Infinity;
    for(let f of foods){const d=dist(ant,f); if(d<90 && d<bd){bd=d;nf=f;}}
    if(nf) ant.targetFood=nf;
    else{
      const wallAvg=(ant.sensors.wallLeft+ant.sensors.wallCenter+ant.sensors.wallRight)/3;
      if(digIntent>0.48 && wallAvg>0.18 && Math.random()<0.11 && (ant.role==='EXCAVADORA' || Math.random()<0.38)){
        const frontier=findFrontier();
        if(frontier.length){
          // Topo: muestrear en vez de filtrar las miles de celdas del frontier (coste fijo por hormiga
          // y por tick). Se guardan unas pocas candidatas cercanas VALIDAS y se elige una al azar,
          // que es lo que daba el filtro viejo; el frontier puede venir del cache unos ms viejo,
          // asi que cada celda se comprueba contra el suelo real antes de asignarsela.
          const _fn=frontier.length;
          let _cands=null, _far=null, _bestD=Infinity;
          for(let _k=0;_k<20;_k++){
            if(_cands && _cands.length>=4) break;
            const _f=frontier[(Math.random()*_fn)|0];
            const _row=soil[_f.r]; if(!_row || _row[_f.c]!==1) continue;
            const _d=Math.hypot((_f.c+0.5)*CELL-ant.x,(_f.r+0.5)*CELL-ant.y);
            if(_d<90){ if(!_cands) _cands=[]; _cands.push(_f); }
            else if(_d<_bestD){ _bestD=_d; _far=_f; }
          }
          const pick=_cands&&_cands.length ? _cands[(Math.random()*_cands.length)|0] : (_far || frontier[(Math.random()*_fn)|0]);
          if(pick){
          // cavado más rápido si es excavadora, tiene rasgo alto o colonia evolucionada
          const bonus = (ant.role==='EXCAVADORA'? 8:0) + Math.floor(ant.traits.construccion/18) + Math.floor(colonyIQ/45) + Math.min(6, gen);
          ant.digTarget=pick; ant.digProgress=0;
          const _type=soilType[pick.r]&&soilType[pick.r][pick.c]; const _hard = _type===7? 38 : _type===6? 14 : _type===4? 9 : _type===2? 4 : _type===3? -4 : 0; // Terraria: bedrock 38, pizarra 14, piedra 9, arcilla 4, arena -4 (blanda pero cae)
          // LEY REAL: piedra necesita herramienta/poder. Sin pico, 3x más lento y con chance de fallar
          const needPower = (_type===4? 1.2 : _type===6? 2.2 : _type===7? 3.5 : 0);
          const hasPower = (ant.tool==='pick' || (colonyIQ>124 && gen>=3) || inventions.stone) ? 1.0 : 0.55;
          const hardMult = needPower>0 && hasPower<0.9 ? (1.6 + needPower*0.8) : 1;
          ant.digNeeded= (_type===7 && (gen<8 || colonyIQ<148 || !inventions.masonry))? 999 : Math.max(9, Math.floor((26 - bonus + _hard)*hardMult)); ant.state='CAVANDO'; 
          // Topo - solo icono ⛏ en la hormiga, texto va al strip inferior (no lluvia de texto)
          pushToast(pick.c*CELL+8,pick.r*CELL+8,'⛏',_hard>5?'#8a8a8a':'#ff7a00',0.9);
          try{ const lab=_hard>5?'PIEDRA DURA':_hard>2?'ARCILLA':'VA A CAVAR'; pushImportant('invention', `⛏ ${lab} [${pick.c},${pick.r}]`, `${ant.id} [${ant.role}] → ${lab.toLowerCase()} - ${workers.filter(w=>w.state==='CAVANDO').length} activas`); }catch(e){}
          // Topo - en vez de spam, si ya hay varios cavando, resume en el strip inferior
          const _digsNow = workers.filter(w=>w.state==='CAVANDO').length;
          if(_digsNow>2){
            setNarration(`<b>${_digsNow+1} excavadoras cavando</b> - ver reportes abajo para detalles <small>[${pick.c},${pick.r}]</small>`);
          } else if(Math.random()<0.28) setNarration(`<b>${ant.id} [${ant.role}] va a cavar</b> en [${pick.c},${pick.r}] - mira el polvo.`);
          return;
          }
        }
      }
      if(ant.sensors.pheroStr>0.22 && Math.abs(ant.sensors.pheroAng)<0.7){
        const ph=nearestPhero(ant);
        if(ph){const ang=Math.atan2(ph.y-ant.y, ph.x-ant.x); ant.angle+=(((ang-ant.angle+Math.PI*3)%(Math.PI*2)-Math.PI)*0.09 + steer*0.10); ant.state='BUSCAR';}
      }else if(Math.abs(ant.sensors.commIn1)>0.55){
        ant.angle+= ant.sensors.commIn1*0.12 + steer*0.08; ant.state='BUSCAR';
      }
    }
  }
  if(ant.targetFood){
    const targ=ant.targetFood;
    const ang=Math.atan2(targ.y-ant.y, targ.x-ant.x);
    let diff=((ang-ant.angle+Math.PI*3)%(Math.PI*2)-Math.PI);
    ant.angle+= diff*0.06 + steer*0.13;
    if(ant.sensors.wallLeft>0.7) ant.angle+=0.18;
    if(ant.sensors.wallRight>0.7) ant.angle-=0.18;
    const nx=ant.x+Math.cos(ant.angle)*speed, ny=ant.y+Math.sin(ant.angle)*speed;
    if(canMove(nx,ny)){ant.x=nx;ant.y=ny;ant.blocked=0;}else{
      if(canMove(ant.x+Math.cos(ant.angle)*speed, ant.y)) ant.x+=Math.cos(ant.angle)*speed*0.45;
      else if(canMove(ant.x, ant.y+Math.sin(ant.angle)*speed)) ant.y+=Math.sin(ant.angle)*speed*0.45;
      else {ant.blocked++; ant.angle+=(Math.random()-0.5)*1.0; if(ant.blocked>36) ant.targetFood=null;}
    }
    if(dist(ant,targ)< (targ.r? targ.r+14:16)){
      const idx=foods.indexOf(targ);
      if(idx>=0){
        const cap=2+(ant.role==='RECOLECTORA'?1:0)+(ant.tool==='basket'?1:0);
        const take=Math.min(cap, targ.amount);
        if(targ.amount>take) targ.amount-=take; else {foods.splice(idx,1);}
        ant.food={amount:take}; ant.targetFood=null; ant.blocked=0; colonyFitness+=0.35;
        ant.commOut=[0.9, 0.7];
        commInks.push({x:ant.x,y:ant.y,sym:'⬢',color:'#00e5ff',life:1,decay:0.0014});
        pushToast(ant.x,ant.y-22,'⬢ ¡MIEL!','#00e5ff',1.6);
        setNarration(`<b>${ant.id} encontró miel x${take}!</b> Pinta <span style="color:#00e5ff">⬢ CIAN</span> y vuelve.`);
        for(let i=0;i<3;i++) pheromones.push({x:ant.x,y:ant.y,strength:0.88,life:1,type:'recruit',quality:2});
      }
    }
  }else{
    ant.state='EXPLORAR';
    ant.angle+= steer*0.14 + (Math.random()-0.5)*0.04;
    if(ant.sensors.wallLeft>0.65) ant.angle+=0.22;
    if(ant.sensors.wallRight>0.65) ant.angle-=0.22;
    if(ant.sensors.wallCenter>0.75) ant.angle+= (Math.random()-0.5)*1.2;
    const nx=ant.x+Math.cos(ant.angle)*speed*0.84, ny=ant.y+Math.sin(ant.angle)*speed*0.84;
    if(canMove(nx,ny)){ant.x=nx;ant.y=ny;ant.blocked=0;}else{ant.angle+=(Math.random()-0.5)*1.2; ant.blocked++; if(ant.blocked>26) ant.angle+=Math.PI*0.5;}
  }
  ant.x=Math.max(8,Math.min(W-8,ant.x)); ant.y=Math.max(8,Math.min(H-8,ant.y));
  // corrección física: si quedó dentro de tierra sólida (no en superficie ni cavando su bloque), empujar a túnel cercano
  if(ant.y >= SURFACE_Y && isSolidPixel(ant.x,ant.y)){
    let pushed=false;
    // si está cavando, permitir estar cerca de su target (a 14px)
    const isDiggingOwn = ant.state==='CAVANDO' && ant.digTarget && Math.hypot(ant.x-(ant.digTarget.c*CELL+8), ant.y-(ant.digTarget.r*CELL+8)) < 18;
    if(!isDiggingOwn){
      for(let rad=8; rad<=16; rad+=4){
        for(let ang=0; ang<Math.PI*2; ang+=Math.PI/4){
          const nx=ant.x+Math.cos(ang)*rad, ny=ant.y+Math.sin(ang)*rad;
          if(!isSolidPixel(nx,ny) && ny>=SURFACE_Y-8){ ant.x=nx; ant.y=ny; pushed=true; break; }
        }
        if(pushed) break;
      }
      if(!pushed && ant.y < SURFACE_Y+20) ant.y=SURFACE_Y-6; // fallback a superficie
    }
  }
  // si está muy alto fuera del shaft, lo bajamos
  if(ant.y < SURFACE_Y - 12 && Math.abs(ant.x - (CENTER_COL*CELL+8)) > 28) ant.y = SURFACE_Y - 6;
  // mantener dentro del vidrio visible (no se salen de la screen)
  ant.x = Math.max(12, Math.min(W-12, ant.x));
  ant.y = Math.max(8, Math.min(H-12, ant.y));
}

/* ===== RENDER PIXEL ART ===== */
function drawPixelRect(x,y,w,h,fill,stroke){
  if(fill){ctx.fillStyle=fill; ctx.fillRect(Math.floor(x),Math.floor(y),w,h);}
  if(stroke){ctx.strokeStyle=stroke; ctx.lineWidth=1; ctx.strokeRect(Math.floor(x)+0.5,Math.floor(y)+0.5,w-1,h-1);}
}
// adjust helper defined near renderLoop

// ===== CACHE DE SUELO - solo se redibuja cuando cambia (cavar/construir) =====
function rebuildSoilCache(isMini){
  if(!soilCacheCtx) return;
  isMini = isMini===true;
  soilCacheCtx.clearRect(0,0,W,H);
  let cStart=0,cEnd=COLS,rStart=SURFACE_ROW,rEnd=ROWS; // cache usa mapa completo
  for(let r=rStart;r<rEnd;r++) for(let c=cStart;c<cEnd;c++){
    const x=c*CELL, y=r*CELL;
    if(soil[r][c]===1){
      const depth=r-SURFACE_ROW;
      const isDeco = hasDeco(c,r);
      const t=(soilType[r]&&soilType[r][c])||1;
      let base;
      if(isDeco){
        if(t===4) base='#8e7d72';
        else if(t===3) base='#b8a88e';
        else if(t===2) base=depth<7?'#9c6b3a':'#a67c52';
        else base=depth<7?'#9c6b3a':'#8b5a2b';
      } else {
        if(t===2) base= depth<3?'#8b5a32':depth<7?'#a06b33':'#7a4a2a'; // arcilla rojiza
        else if(t===3) base= depth<3?'#c2b280':depth<7?'#d4c5a0':depth<12?'#c9b896':'#b0a080'; // arena clara
        else if(t===4) base= depth<12?'#6e6e6e':depth<18?'#5a5a5a':'#4a4a4a'; // piedra gris
        else base= depth<3?'#7a4a2a':depth<7?'#6b3a1f':depth<12?'#5a2a0a':depth<18?'#4a1e0a':'#3a1505'; // topsoil
      }
      soilCacheCtx.fillStyle=base; soilCacheCtx.fillRect(x-0.5,y-0.5,CELL+1,CELL+1);
      // veta de profundidad con dos tonos
      const dark = depth%2===0 ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.10)';
      soilCacheCtx.fillStyle=dark; soilCacheCtx.fillRect(x,y+CELL-2,CELL,2);
      if(depth%4===0){soilCacheCtx.fillStyle='#2e1000'; soilCacheCtx.fillRect(x,y, CELL,1); soilCacheCtx.fillStyle='rgba(255,255,255,0.06)'; soilCacheCtx.fillRect(x,y+1,CELL,1);}
      if(isDeco){
        // muro embellecido: franja clara y puntito decorativo
        soilCacheCtx.fillStyle='rgba(255,220,150,0.18)'; soilCacheCtx.fillRect(x+2,y+3,12,2);
        soilCacheCtx.fillStyle='#d9b48a'; soilCacheCtx.fillRect(x+7,y+6,2,2); soilCacheCtx.fillRect(x+5,y+8,1,1);
      }
      // textura pixel moteada realista - 3 capas
      const seed = (c*17 + r*13 + depth*5) % 16;
      if(seed<3){ soilCacheCtx.fillStyle='#8b5a2b'; soilCacheCtx.fillRect(x+3,y+4,2,2); soilCacheCtx.fillRect(x+11,y+9,1,1); }
      if(seed===5){ soilCacheCtx.fillStyle='#3d1f00'; soilCacheCtx.fillRect(x+6,y+7,3,2); soilCacheCtx.fillStyle='#a67c52'; soilCacheCtx.fillRect(x+7,y+8,1,1); }
      if(seed===7){ soilCacheCtx.fillStyle='rgba(0,0,0,0.22)'; soilCacheCtx.fillRect(x+4,y+10,4,2); }
      if(seed===9){ soilCacheCtx.fillStyle='rgba(255,255,255,0.07)'; soilCacheCtx.fillRect(x+9,y+3,2,2); soilCacheCtx.fillRect(x+2,y+12,1,1); }
      // piedrita + raiz
      if(!isMini){
        if((c*7+r*11)%14===0){ soilCacheCtx.fillStyle='#9c6b3a'; soilCacheCtx.fillRect(x+5,y+5,4,3); soilCacheCtx.fillStyle='#d9b48a'; soilCacheCtx.fillRect(x+6,y+6,1,1); soilCacheCtx.fillStyle='#2e0f00'; soilCacheCtx.fillRect(x+8,y+7,1,1); }
        if((c+r)%9===0){ soilCacheCtx.fillStyle='#4a2a0a'; soilCacheCtx.fillRect(x+2,y+2,1,4); soilCacheCtx.fillStyle='#6b3a1f'; soilCacheCtx.fillRect(x+3,y+3,1,2); } // raicilla vertical
        if(depth>8 && (c*3+r*5)%20===0){ soilCacheCtx.fillStyle='#2e1a0a'; soilCacheCtx.fillRect(x+10,y+2,1,6); } // veta profunda
      }
    }else{
      // túnel - suelo compactado realista, no plano
      // base crema con variación por profundidad
      const tunnelBase = (r-SURFACE_ROW)<4 ? '#fff1c8' : (r-SURFACE_ROW)<10 ? '#fff8dc' : '#ffedc0';
      soilCacheCtx.fillStyle=tunnelBase; soilCacheCtx.fillRect(x-0.5,y-0.5,CELL+1,CELL+1);
      // suelo pisoteado más oscuro abajo
      soilCacheCtx.fillStyle='#f5d8a0'; soilCacheCtx.fillRect(x,y+CELL-5,CELL,3); soilCacheCtx.fillStyle='#e8c99a'; soilCacheCtx.fillRect(x,y+CELL-3,CELL,2);
      // granito fino en suelo
      const tseed = (c*11+r*7)%10;
      if(tseed===2){ soilCacheCtx.fillStyle='#e0c080'; soilCacheCtx.fillRect(x+4,y+11,2,1); }
      if(tseed===5){ soilCacheCtx.fillStyle='rgba(0,0,0,0.08)'; soilCacheCtx.fillRect(x+9,y+8,1,1); }
      // pared con ladrillo pixel donde colinda con tierra - más realista con mortero
      const up = r>0 && soil[r-1][c]===1, down = r<ROWS-1 && soil[r+1][c]===1, left=c>0&&soil[r][c-1]===1, right=c<COLS-1&&soil[r][c+1]===1;
      if(up){
        soilCacheCtx.fillStyle='#2e0f00'; soilCacheCtx.fillRect(x,y,CELL,4); 
        soilCacheCtx.fillStyle='#8b5a2b'; soilCacheCtx.fillRect(x,y, CELL,1);
        soilCacheCtx.fillStyle='#4a2510'; soilCacheCtx.fillRect(x+2,y+2,4,1); soilCacheCtx.fillRect(x+10,y+2,4,1); // ladrillitos
      }
      if(down){soilCacheCtx.fillStyle='#2e0f00'; soilCacheCtx.fillRect(x,y+CELL-4,CELL,4); soilCacheCtx.fillStyle='#1a0a00'; soilCacheCtx.fillRect(x,y+CELL-2,CELL,2);}
      if(left){soilCacheCtx.fillStyle='#2e0f00'; soilCacheCtx.fillRect(x,y,4,CELL); soilCacheCtx.fillStyle='#6b3a1f'; soilCacheCtx.fillRect(x+1,y+4,1,4); soilCacheCtx.fillRect(x+1,y+10,1,4);}
      if(right){soilCacheCtx.fillStyle='#2e0f00'; soilCacheCtx.fillRect(x+CELL-4,y,4,CELL); soilCacheCtx.fillStyle='#4a2510'; soilCacheCtx.fillRect(x+CELL-2,y+3,1,6);}
      // brillo interior arriba (luz del túnel)
      soilCacheCtx.fillStyle='rgba(255,255,255,0.45)'; soilCacheCtx.fillRect(x+4,y+4, CELL-8,1);
      if(!up){ soilCacheCtx.fillStyle='rgba(255,255,255,0.15)'; soilCacheCtx.fillRect(x+2,y+2,2,2); }
    }
  }
  soilCacheDirty=false;
}
// === TEXTURAS DEFINITIVAS 01 - SUPERFICIES ATLAS ===
const texSuperficies = new Image();
texSuperficies.src = 'assets/textures/categoria_01_superficies.png';
let texSuperficiesReady = false;
texSuperficies.onload = ()=>{ texSuperficiesReady=true; markSoilDirty(); setTimeout(()=>{markSoilDirty(); try{rebuildSoilCache();}catch(e){}}, 400); tlog('[TEX] superficies 2048 atlas ready'); };
texSuperficies.onerror = ()=>console.warn('[TEX] superficies failed');
const TEX_TILE = 512, TEX_INNER = 480, TEX_BORDER = 16;
function texSrc(col,row){ return {sx: col*TEX_TILE+TEX_BORDER, sy: row*TEX_TILE+TEX_BORDER, sw: TEX_INNER, sh: TEX_INNER}; }
const TEX_MAP = {
  sky: texSrc(0,0),
  grass: texSrc(1,0),
  topsoil: texSrc(2,0),
  clay: texSrc(3,0),
  sand: texSrc(0,1),
  stone: texSrc(1,1),
  slate: texSrc(2,1),
  bedrock: texSrc(3,1),
  air: texSrc(0,2),
  rim: texSrc(1,2),
  deco: texSrc(2,2),
  vein: texSrc(3,2),
  puddle: texSrc(0,3),
  mound: texSrc(1,3)
};
// === PISOS ESTACIONES - Living Pixel vivo (4 estaciones + estados) ===
const texCielos = new Image(); texCielos.src = 'assets/textures/categoria_05_cielos_completo.png?v=20261012un'; let texCielosReady=false;
const texBrote = new Image(); texBrote.src = 'assets/textures/cielo_brote_4climas.png?v=20261012un'; let texBroteReady=false; texBrote.onload=()=>{ texBroteReady=true; tlog('[TEX] brote ready'); }; texCielos.onload=()=>{ texCielosReady=true; tlog('[TEX] cielos completo ready'); };
const texSurfaceFull = new Image(); texSurfaceFull.src = 'assets/textures/categoria_01_surface_fullgrass.png?v=20261012un'; let texSurfaceFullReady=false; texSurfaceFull.onload=()=>{ texSurfaceFullReady=true; markSoilDirty(); tlog('[TEX] surface fullgrass ready'); };
const texPisos = new Image();
texPisos.src = 'assets/textures/categoria_01_platformer_pisos_SB.png?v=20261012un&t='+Date.now();
let texPisosReady=false;
texPisos.onload=()=>{ texPisosReady=true; markSoilDirty(); tlog('[TEX] pisos SB NEON '+texPisos.width+'x'+texPisos.height+' ready', texPisos.src); try{ rebuildSoilCache(); }catch(e){}; try{ markSoilDirty(); }catch(e){}; };
texPisos.onerror=()=>console.warn('[TEX] pisos estaciones failed');
const PISOS_TW=352, PISOS_TH=192, PISOS_BORDER=6; // platformer side view 1408x768 4x4 grid
function pisosSrc(col,row){ return {sx: col*PISOS_TW+PISOS_BORDER, sy: row*PISOS_TH+PISOS_BORDER, sw: PISOS_TW-PISOS_BORDER*2, sh: PISOS_TH-PISOS_BORDER*2}; }
const PISOS_MAP={
  spring: pisosSrc(0,0), summer: pisosSrc(1,0), autumn: pisosSrc(2,0), winter: pisosSrc(3,0),
  springWet: pisosSrc(0,1), summerDry: pisosSrc(1,1), autumnMuddy: pisosSrc(2,1), winterFrozen: pisosSrc(3,1),
  clay: pisosSrc(0,2), sand: pisosSrc(1,2), stone: pisosSrc(2,2), slate: pisosSrc(3,2),
  clayWet: pisosSrc(0,3), sandWet: pisosSrc(1,3), stoneWet: pisosSrc(2,3), slateWet: pisosSrc(3,3)
}; // 4x4 platformer side view: row0 seasons, row1 estados intermedios húmedo/seco, row2 base, row3 estados húmedos

// Override rebuildSoilCache to use atlas when ready
const _origRebuildSoilCache = rebuildSoilCache;
rebuildSoilCache = function(){
  if(!soilCacheCtx) return;
  if(!texSuperficiesReady){
    return _origRebuildSoilCache();
  }
  soilCacheCtx.clearRect(0,0,W,H);
  // need imageSmoothing false for pixel
  soilCacheCtx.imageSmoothingEnabled=false;
  const _cacheSeason=(()=>{ try{ return getCalendarData().seasonIdx|0; }catch(e){ return 0; } })();
  const _cacheWet=(()=>{ try{ return !!(weather && (weather.type==='rain'||weather.type==='storm')); }catch(e){ return false; } })();
  for(let r=SURFACE_ROW;r<ROWS;r++) for(let c=0;c<COLS;c++){
    const x=c*CELL, y=r*CELL;
    if(soil[r][c]===1){
      const depth=r-SURFACE_ROW;
      const isDeco = hasDeco(c,r);
      const t=(soilType[r]&&soilType[r][c])||1;
      let src;
      // Platformer side view: estaciones + estados intermedios (humedo/seco/helado) - vista lateral con pasto arriba
      // Topo: estacion y clima valen para TODO el mapa - antes se leian por celda (getCalendarData
      // armando cadenas 4608 veces) y por eso reconstruir el cache costaba 2.4 ms en BIG.
      const _season=_cacheSeason, _isWet=_cacheWet;
      // LÓGICA GRASS REALISTA: solo pasto si está en contacto directo con aire libre (cielo o hueco). Si está cubierto, es tierra pelada.
      const _isExposed = (r===SURFACE_ROW) || (r>0 && soil[r-1] && soil[r-1][c]===0);
      const _isSurfaceFull = (r===SURFACE_ROW) && _isExposed; // full grass for top surface
      const _isTopGrass = _isExposed && ((r===SURFACE_ROW) || (t===1)) && !_isSurfaceFull;
      const _isTopDirt = !_isExposed && (t===1); // topsoil cubierto -> tierra sin pasto
      const _isDeepClay = (t===2), _isDeepSand=(t===3), _isDeepStone=(t===4||t===6);
      // Full grass surface uses separate texture
      if(_isSurfaceFull && texSurfaceFullReady){
        src = {sx:6, sy:6, sw:340, sh:180, isFull:true};
      } else if(texPisosReady && (_isTopGrass || _isDeepClay || _isDeepSand || _isDeepStone)){
        if(_isTopGrass){
          if(r===SURFACE_ROW && window.DEBUG_GRASS) tlog('[GRASS] surface',r,c, 'exposed',_isExposed,'t',t,'season',_season,'src',src);
          if(_isWet && _season!==3) src=PISOS_MAP.springWet;
          else if(_season===0) src=PISOS_MAP.spring;
          else if(_season===1) src=PISOS_MAP.summer;
          else if(_season===2) src=PISOS_MAP.autumn;
          else src=PISOS_MAP.winter;
          if(_season===1 && !_isWet && Math.random()<0.3) src=PISOS_MAP.summerDry;
        } else if(_isDeepClay) src = _isWet? PISOS_MAP.clayWet : PISOS_MAP.clay;
          if(r===SURFACE_ROW+1 && window.DEBUG_GRASS) tlog('[GRASS] below',r,c, 't',t,'src',src);
        else if(_isDeepSand) src = _isWet? PISOS_MAP.sandWet : PISOS_MAP.sand;
        else if(_isDeepStone) src = _isWet? PISOS_MAP.stoneWet : PISOS_MAP.stone;
      }
      // Si es topsoil pero cubierto, forzar tierra pelada del atlas clásico (no platformer)
      if(_isTopDirt){
        src = TEX_MAP.topsoil;
      }
      if(!src){
        if(isDeco) src = TEX_MAP.deco;
        else if(r===SURFACE_ROW) src = TEX_MAP.grass;
        else if(t===1) src = TEX_MAP.topsoil;
        else if(t===2) src = TEX_MAP.clay;
        else if(t===3) src = TEX_MAP.sand;
        else if(t===4) src = TEX_MAP.stone;
        else if(t===6) src = TEX_MAP.slate;
        else if(t===7) src = TEX_MAP.bedrock;
        else src = TEX_MAP.topsoil;
      }
      try{
        if(src && src.isFull && texSurfaceFullReady){
          soilCacheCtx.drawImage(texSurfaceFull, src.sx, src.sy, src.sw, src.sh, x-1, y-1, CELL+2, CELL+2);
        } else {
          const _isPisosSrc = texPisosReady && src && (src===PISOS_MAP.spring||src===PISOS_MAP.summer||src===PISOS_MAP.autumn||src===PISOS_MAP.winter||src===PISOS_MAP.springWet||src===PISOS_MAP.summerDry||src===PISOS_MAP.clay||src===PISOS_MAP.sand||src===PISOS_MAP.stone||src===PISOS_MAP.clayWet||src===PISOS_MAP.sandWet||src===PISOS_MAP.stoneWet);
          if(_isPisosSrc) soilCacheCtx.drawImage(texPisos, src.sx, src.sy, src.sw, src.sh, x-1, y-1, CELL+2, CELL+2);
          else soilCacheCtx.drawImage(texSuperficies, src.sx, src.sy, src.sw, src.sh, x-1, y-1, CELL+2, CELL+2);
        }
      }catch(e){ soilCacheCtx.fillStyle='#ff0000'; soilCacheCtx.fillRect(x-0.5,y-0.5,CELL+1,CELL+1); }
      // overlay vein speckle for stone? atlas already has vein tile but we can occasionally overlay
      // keep subtle shadow for depth
      if(depth%6===0){
        soilCacheCtx.fillStyle='rgba(0,0,0,0.08)';
        soilCacheCtx.fillRect(x,y+CELL-2,CELL,1);
      }
    } else {
      // túnel aire con textura beige + rim donde colinda
      const up = r>0 && soil[r-1][c]===1, down = r<ROWS-1 && soil[r+1][c]===1, left=c>0&&soil[r][c-1]===1, right=c<COLS-1&&soil[r][c+1]===1;
      // base aire
      try{
        soilCacheCtx.drawImage(texSuperficies, TEX_MAP.air.sx, TEX_MAP.air.sy, TEX_MAP.air.sw, TEX_MAP.air.sh, x-1, y-1, CELL+2, CELL+2);
      }catch(e){ soilCacheCtx.fillStyle='#fff8dc'; soilCacheCtx.fillRect(x-0.5,y-0.5,CELL+1,CELL+1); }
      // rim overlay if adjacent soil - use rim tile with alpha? For now draw dark border rects as before but could use rim tile
      if(up||down||left||right){
        // draw rim frame using atlas rim tile at low opacity overlay
        // simple dark border
        soilCacheCtx.fillStyle='rgba(46,15,0,0.45)';
        if(up) soilCacheCtx.fillRect(x,y,CELL,3);
        if(down) soilCacheCtx.fillRect(x,y+CELL-3,CELL,3);
        if(left) soilCacheCtx.fillRect(x,y,3,CELL);
        if(right) soilCacheCtx.fillRect(x+CELL-3,y,3,CELL);
      }
    }
  }
  // draw puddles/mounds atlas on top
  for(let m of mound){
    const mx=Math.floor(m.x/16)*16, my=Math.floor(m.y/16)*16;
    const src = m.isPuddle ? TEX_MAP.puddle : TEX_MAP.mound;
    try{ soilCacheCtx.drawImage(texSuperficies, src.sx, src.sy, src.sw, src.sh, mx-0.5, my-0.5, CELL+1, CELL+1); }catch(e){}
  }
  soilCacheDirty=false;
};
tlog('[TEX] superficies override instalado');

// === TEXTURAS DEFINITIVAS 02 - VEGETACIÓN ATLAS 1024 ===
const texVegetacion = new Image();
texVegetacion.src = 'assets/textures/categoria_02_vegetacion.png';
let texVegetacionReady = false;
texVegetacion.onload = ()=>{ texVegetacionReady=true; tlog('[TEX] vegetacion 1024 atlas ready'); };
texVegetacion.onerror = ()=>console.warn('[TEX] vegetacion failed');
const VEG_TILE = 341, VEG_INNER = 280, VEG_BORDER = 30;
function vegSrc(col,row){ return {sx: col*VEG_TILE+VEG_BORDER, sy: row*VEG_TILE+VEG_BORDER, sw: VEG_INNER, sh: VEG_INNER}; }
const VEG_MAP = {
  clover: vegSrc(0,0),
  grassTuft: vegSrc(1,0),
  flowerY: vegSrc(2,0),
  flowerW: vegSrc(0,1),
  berryBush: vegSrc(1,1),
  mushroom: vegSrc(2,1),
  sapling: vegSrc(0,2),
  fruitTree: vegSrc(1,2),
caveMush: vegSrc(2,2)
};
// === TEXTURAS DEFINITIVAS 03 - ALIMENTOS ATLAS 2816 ===
const texAlimentos = new Image();
texAlimentos.src = 'assets/textures/categoria_03_alimentos.png';
// miel regenerada individual PNG blanco 66KB - carga ligera para no congelar
const texHoneyNew = new Image();
texHoneyNew.src = 'assets/textures/honey_tight_transparent.png';
let texHoneyNewReady=false;
texHoneyNew.onload = ()=>{ texHoneyNewReady=true; tlog('[TEX] honey 283x366 ready'); };
let texAlimentosReady = false;
texAlimentos.onload = ()=>{ texAlimentosReady=true; tlog('[TEX] alimentos 2816 atlas ready'); };
texAlimentos.onerror = ()=>console.warn('[TEX] alimentos failed');
const ALIM_TW = 704, ALIM_TH = 768, ALIM_BORDER = 52;
// crop tighter around the food (food is ~200x200 centered, so use 280x280 centered)
const ALIM_CROP = 380; // PNG fondo blanco regenerado desde cero // regenerada miel blanca 283x366 desde cero, crop amplio para no cortar
function alimSrc(col,row){ 
  const cx = col*ALIM_TW+ALIM_TW/2, cy = row*ALIM_TH+ALIM_TH/2;
  return {sx: Math.floor(cx - ALIM_CROP/2), sy: Math.floor(cy - ALIM_CROP/2), sw: ALIM_CROP, sh: ALIM_CROP}; 
}
const ALIM_MAP = {
  honey: alimSrc(0,0),
  berry: alimSrc(1,0),
  mushroom: alimSrc(2,0),
  apple: alimSrc(3,0),
  seed: alimSrc(1,1),
grassSeed: alimSrc(2,1)
};
// === TEXTURAS DEFINITIVAS 05 - ESTRUCTURAS ATLAS 1024 ===
const texEstructuras = new Image();
// texEstructuras disabled - cleaned
let texEstructurasReady = false;
texEstructuras.onload = ()=>{ texEstructurasReady=true; tlog('[TEX] estructuras 1024 atlas ready'); };
texEstructuras.onerror = ()=>console.warn('[TEX] estructuras failed');
const EST_TW = 512, EST_TH = 512, EST_BORDER = 24;
function estSrc(col,row){ return {sx: col*EST_TW+EST_BORDER, sy: row*EST_TH+EST_BORDER, sw: EST_TW-EST_BORDER*2, sh: EST_TH-EST_BORDER*2}; }
const EST_MAP = {
  workshop: estSrc(0,0),
  granary: estSrc(1,0),
  bridge: estSrc(0,1),
  tower: estSrc(1,1)
};
// === TEXTURAS DEFINITIVAS 04 - MATERIALES ATLAS 2172 ===
const texMateriales = new Image();
// texMateriales disabled - cleaned
let texMaterialesReady = false;
texMateriales.onload = ()=>{ texMaterialesReady=true; tlog('[TEX] materiales 2172 atlas ready'); };
texMateriales.onerror = ()=>console.warn('[TEX] materiales failed');
const MAT_TW = 434, MAT_TH = 724, MAT_BORDER = 18;
function matSrc(col,row){ return {sx: col*MAT_TW+MAT_BORDER, sy: row*MAT_TH+MAT_BORDER, sw: MAT_TW-MAT_BORDER*2, sh: MAT_TH-MAT_BORDER*2}; }
const MAT_MAP = {
  stone: matSrc(0,0),
  clay: matSrc(1,0),
  sand: matSrc(2,0),
  fiber: matSrc(3,0),
  wood: matSrc(4,0)
};
// === TEXTURAS DEFINITIVAS 06 - HERRAMIENTAS ATLAS 1408 ===
const texHerramientas = new Image();
// texHerramientas disabled
let texHerramientasReady = false;
texHerramientas.onload = ()=>{ texHerramientasReady=true; tlog('[TEX] herramientas 1408 atlas ready'); };
texHerramientas.onerror = ()=>console.warn('[TEX] herramientas failed');
const HER_TW = 469, HER_TH = 768, HER_BORDER = 20;
function herSrc(col,row){ return {sx: col*HER_TW+HER_BORDER, sy: row*HER_TH+HER_BORDER, sw: HER_TW-HER_BORDER*2, sh: HER_TH-HER_BORDER*2}; }
const HER_MAP = {
  pick: herSrc(0,0),
  basket: herSrc(1,0),
  trowel: herSrc(2,0)
};
// === TEXTURAS DEFINITIVAS 07 - PERSONAJES ATLAS 1024 ===
const texPersonajes = new Image();
// texPersonajes disabled
let texPersonajesReady = false;
texPersonajes.onload = ()=>{ texPersonajesReady=true; tlog('[TEX] personajes 1024 atlas ready'); };
texPersonajes.onerror = ()=>console.warn('[TEX] personajes failed');
const PER_TW = 256, PER_TH = 256, PER_BORDER = 8;
function perSrc(col,row){ return {sx: col*PER_TW+PER_BORDER, sy: row*PER_TH+PER_BORDER, sw: PER_TW-PER_BORDER*2, sh: PER_TH-PER_BORDER*2}; }
const PER_MAP = {
  minim: perSrc(0,0), media: perSrc(1,0), major: perSrc(2,0), queen: perSrc(3,0),
  excavadora: perSrc(0,1), recolectora: perSrc(1,1), exploradora: perSrc(2,1), nodriza: perSrc(3,1),
  anthroExc: perSrc(0,3), anthroRec: perSrc(1,3), anthroExp: perSrc(2,3), sleeping: perSrc(3,3)
};
// === TEXTURAS DEFINITIVAS 08 - BROOD ATLAS 720 ===
const texBrood = new Image();
// texBrood disabled
let texBroodReady = false;
texBrood.onload = ()=>{ texBroodReady=true; tlog('[TEX] brood 720 atlas ready'); };
texBrood.onerror = ()=>console.warn('[TEX] brood failed');
const BROOD_TW = 360, BROOD_TH = 485, BROOD_BORDER = 12;
function broodSrc(col,row){ return {sx: col*BROOD_TW+BROOD_BORDER, sy: row*BROOD_TH+BROOD_BORDER, sw: BROOD_TW-BROOD_BORDER*2, sh: BROOD_TH-BROOD_BORDER*2}; }
const BROOD_MAP = {
  egg: broodSrc(0,0), larva: broodSrc(1,0), pupa: broodSrc(0,1), queenLarva: broodSrc(1,1), fungus: broodSrc(0,2), waste: broodSrc(1,2)
};
// === TEXTURAS DEFINITIVAS 09 - SENALES ATLAS 1024 ===
const texSenales = new Image();
// texSenales disabled
let texSenalesReady = false;
texSenales.onload = ()=>{ texSenalesReady=true; tlog('[TEX] senales 1024 atlas ready'); };
texSenales.onerror = ()=>console.warn('[TEX] senales failed');
const SIG_TW = 341, SIG_TH = 512, SIG_BORDER = 14;
function sigSrc(col,row){ return {sx: col*SIG_TW+SIG_BORDER, sy: row*SIG_TH+SIG_BORDER, sw: SIG_TW-SIG_BORDER*2, sh: SIG_TH-SIG_BORDER*2}; }
const SIG_MAP = {
  recruit: sigSrc(0,0), explore: sigSrc(1,0), inkCyan: sigSrc(2,0), inkYellow: sigSrc(0,1), inkMagenta: sigSrc(1,1), inkWhite: sigSrc(2,1)
};
// === TEXTURAS DEFINITIVAS 10 - CLIMA ATLAS 2048 ===
const texClima = new Image();
texClima.src = 'assets/textures/categoria_10_clima_efectos.png';
let texClimaReady = false;
texClima.onload = ()=>{ texClimaReady=true; tlog('[TEX] clima 2048 atlas ready'); };
texClima.onerror = ()=>console.warn('[TEX] clima failed');
const CLIMA_TW = 682, CLIMA_TH = 1024, CLIMA_BORDER = 18;
function climaSrc(col,row){ return {sx: col*CLIMA_TW+CLIMA_BORDER, sy: row*CLIMA_TH+CLIMA_BORDER, sw: CLIMA_TW-CLIMA_BORDER*2, sh: CLIMA_TH-CLIMA_BORDER*2}; }
const CLIMA_MAP = {
  rain: climaSrc(0,0), lightning: climaSrc(1,0), night: climaSrc(2,0), dust: climaSrc(0,1), toast: climaSrc(1,1), shadow: climaSrc(2,1)
};
// === TEXTURAS DEFINITIVAS 11 - OCULTOS ATLAS 2048 ===
const texOcultos = new Image();
// texOcultos disabled
let texOcultosReady = false;
texOcultos.onload = ()=>{ texOcultosReady=true; tlog('[TEX] ocultos 2048 atlas ready'); };
texOcultos.onerror = ()=>console.warn('[TEX] ocultos failed');
const OCU_TW = 682, OCU_TH = 2048, OCU_BORDER = 16;
function ocuSrc(col,row){ return {sx: col*OCU_TW+OCU_BORDER, sy: row*OCU_TH+OCU_BORDER, sw: OCU_TW-OCU_BORDER*2, sh: OCU_TH-OCU_BORDER*2}; }
const OCU_MAP = {
  seeds: ocuSrc(0,0), water: ocuSrc(1,0), fungus: ocuSrc(2,0)
};
// === TEXTURAS DEFINITIVAS 12 - UI ATLAS 1448 ===
const texUI = new Image();
// texUI disabled
let texUIReady = false;
texUI.onload = ()=>{ texUIReady=true; tlog('[TEX] ui 1448 atlas ready'); };
texUI.onerror = ()=>console.warn('[TEX] ui failed');


function drawFarm(ctx,W,H,isMini=false){
  const useZoom=!isMini && view.zoom!==1;
  if(useZoom){ctx.save(); ctx.scale(view.zoom,view.zoom); ctx.translate(Math.floor(-view.x),Math.floor(-view.y)); ctx.imageSmoothingEnabled=false;}
  ctx.imageSmoothingEnabled=false;
  if(!soil || !soil.length || !soil[0]){ ctx.fillStyle='#6b3a1f'; ctx.fillRect(0,SURFACE_Y,W,H-SURFACE_Y); ctx.fillStyle='#3a9d23'; ctx.fillRect(0,SURFACE_Y-12,W,12); /* no return, sigue dibujando cielo */ }
  // SKY pixel - con ciclo día/noche y clima
  const gameHour = (time % DAY_LENGTH) / DAY_LENGTH * 24;
  const isDay = gameHour>=4.5 && gameHour<=19.5; // Terraria 15h día (4:30-19:30) 9h noche
  const dusk = (gameHour>19.5 && gameHour<20.5) || (gameHour>5 && gameHour<5.8);
  let skyTop='#0a0f2a', skyBot='#1a2a5a';
  if(isDay){
    if(weather.type==='rain' || weather.type==='storm'){ skyTop='#5a6a7a'; skyBot='#7a8a9a'; }
    else if(dusk){ skyTop='#ff7a3d'; skyBot='#ffcc66'; }
    else { skyTop='#7ec8e3'; skyBot='#a8e0f0'; }
  } else {
    skyTop='#05091a'; skyBot='#0f1a3a';
  }
  // SKY EXTENDIDO - cubre toda la pantalla incluso al panear 175px más arriba (Topo pidió ver cielo derecho)
  const skyGrad=ctx.createLinearGradient(0,-H*1.8,0,SURFACE_Y);
  skyGrad.addColorStop(0,skyTop); skyGrad.addColorStop(1,skyBot);
  ctx.fillStyle=skyGrad; ctx.fillRect(-W*1.5, -H*1.8, W*4, SURFACE_Y + H*1.8);
  // cielo BROTE - textura nueva 4 climas con tiempo (día/noche/dusk modulado por gradient+overlay)
  const sIdxNow = (typeof getCalendarData==='function' ? getCalendarData().seasonIdx : 0) % 4;
  const isBrote = sIdxNow===0;
  if(isBrote && typeof texBrote!=='undefined' && texBroteReady){
    try{
      let wIdx=0;
      const wt = (typeof weather!=='undefined' && weather.type) ? weather.type : 'clear';
      if(wt==='cloudy') wIdx=1;
      else if(wt==='rain') wIdx=2;
      else if(wt==='storm') wIdx=3;
      const tw = texBrote.width/4, th = texBrote.height;
      const sx = wIdx*tw;
      let alpha = 0.34;
      if(wt==='rain') alpha=0.30;
      if(wt==='storm') alpha=0.36;
      if(!isDay) alpha *= 0.82;
      ctx.globalAlpha=alpha;
      // Topo fix: cielo textura drift sincronizado con nubes y clima, cubre todo el viewport sin cortes
      let skyDrift = (time * 0.055) % W;
      for(let ix=-2; ix<=3; ix++){
        ctx.drawImage(texBrote, sx, 0, tw, th, ix*W + skyDrift - W, -H*1.8, W, SURFACE_Y + H*1.8);
      }
      ctx.globalAlpha=1;
    }catch(e){ ctx.globalAlpha=1; }
  } else if(typeof texCielos!=='undefined' && texCielosReady){
    try{
      const sIdx = sIdxNow;
      let wIdx=0;
      const wt = (typeof weather!=='undefined' && weather.type) ? weather.type : 'clear';
      if(wt==='cloudy') wIdx=1;
      else if(wt==='rain') wIdx=2;
      else if(wt==='storm') wIdx=3;
      const tw2 = texCielos.width/4, th2 = texCielos.height/4;
      const sx = wIdx*tw2, sy = sIdx*th2;
      ctx.globalAlpha=0.28;
      // Topo fix: drift sincronizado
      let skyDrift2 = (time * 0.055) % W;
      for(let ix=-2; ix<=3; ix++){
        ctx.drawImage(texCielos, sx, sy, tw2, th2, ix*W + skyDrift2 - W, -H*1.8, W, SURFACE_Y + H*1.8);
      }
      ctx.globalAlpha=1;
    }catch(e){ ctx.globalAlpha=1; }
  }
  // sol / luna pixel que se mueve con la hora - Topo fix: más arriba y cielo sincronizado
  if(!isMini){
    const sunX = (gameHour/24)*W;
    const sunY = isDay? 10 + Math.sin((gameHour-6)/13*Math.PI)*18 : 14 + Math.sin((gameHour-20)/8*Math.PI)*14;
    if(isDay){
      // sol más alto, inicia el día visible
      ctx.fillStyle= weather.type==='storm'? '#ffaa44' : '#ffdd57';
      ctx.fillRect(Math.floor(sunX)-14, Math.floor(sunY),28,28); ctx.fillStyle='#fff8dc'; ctx.fillRect(Math.floor(sunX)-10,Math.floor(sunY)+4,8,8); ctx.fillStyle='#ffaa00'; ctx.fillRect(Math.floor(sunX)+6,Math.floor(sunY),4,4);
      // rayos si no llueve
      if(weather.type==='clear' && !dusk){
        ctx.fillStyle='rgba(255,255,255,0.18)'; ctx.fillRect(Math.floor(sunX)-18,Math.floor(sunY)+6,4,16); ctx.fillRect(Math.floor(sunX)+18,Math.floor(sunY)+6,4,16);
      }
    } else {
      // luna
      ctx.fillStyle='#e8e8d8'; ctx.fillRect(Math.floor(sunX)-12, Math.floor(sunY),22,22); ctx.fillStyle='#c8c8b8'; ctx.fillRect(Math.floor(sunX)-6,Math.floor(sunY)+6,4,4); ctx.fillStyle='#05091a'; ctx.fillRect(Math.floor(sunX)+4,Math.floor(sunY)+2,6,6);
      // estrellas fijas (no random cada frame para no parpadear)
      ctx.fillStyle='rgba(255,255,255,0.9)'; for(let i=0;i<18;i++){ const sx=(i*67 + 11)%W, sy=8+(i*13)%22; ctx.fillRect(sx,sy,1,1); }
    }
    // nubes bloque - drift natural sincronizado con textura cielo, cubre todo el ancho
    const cloudAlpha = weather.type==='clear'? 0.92 : weather.type==='cloudy'? 0.85 : 0.62;
    ctx.globalAlpha=cloudAlpha;
    ctx.fillStyle='#ffffff';
    // 8 nubes distribuidas, drift con skyDrift para sincronía total cielo
    let cloudDrift = (time * 0.04) % (W*2);
    for(let i=0;i<8;i++){
      let baseX = (i * (W/4.2) + cloudDrift) % (W*1.9) - W*0.45;
      let y = 14 + (i%3)*7 + Math.sin(i*0.9 + time*0.001)*3;
      let w = 30 + (i%3)*10;
      let h = 10 + (i%2)*4;
      // variación por clima: más densas si nublado/lluvia
      if(weather.type==='rain' || weather.type==='storm'){ w+=6; h+=2; y+=1; }
      let cx = Math.floor(baseX);
      // dibujo pixel nube con bordes suaves
      ctx.fillRect(cx,y,w,h);
      ctx.fillRect(cx-6,y+4,6,6);
      ctx.fillRect(cx+w,y+4,6,6);
      if(i%2===0){ ctx.fillRect(cx+8,y-2,12,3); }
    }
    ctx.globalAlpha=1;
    // oscurecimiento al anochecer / tormenta
    if(isNight || weather.type==='storm'){
      const darkAlpha = isNight? 0.22 + Math.sin(time*0.01)*0.04 : 0.18;
      ctx.fillStyle=`rgba(0,0,0,${darkAlpha})`; ctx.fillRect(0,0,W,SURFACE_Y);
    }
    if(dusk){
      ctx.fillStyle='rgba(255,122,61,0.18)'; ctx.fillRect(0,0,W,SURFACE_Y);
    }
  }
  // PRADERA VIVA - fertilidad real, evoluciona con días, lluvia y tiempo
  for(let c=0;c<COLS;c++){
    const hasHole = soil[SURFACE_ROW][c]===0 || (SURFACE_ROW+1<ROWS && soil[SURFACE_ROW+1][c]===0);
    if(hasHole) continue;
    const x=c*CELL;
    const f=fertility[c]||0.5;
    const earthDark = f>0.72?'#2a1808': f>0.55?'#2e1a0a':'#33200c';
    ctx.fillStyle=earthDark; ctx.fillRect(x,SURFACE_Y-16,CELL,16);
    ctx.fillStyle='#3d2a0a'; ctx.fillRect(x,SURFACE_Y-16,CELL,2);
    const season = Math.floor((day/12)%4);
    let g1='#2e7a1a', g2='#3a9d23', g3='#4abf2e';
    if(season===3){ g1='#3a5a12'; g2='#4a6a1a'; g3='#5a7a1e'; }
    else if(season===2){ g1='#2e6b12'; g2='#3a8d18'; g3='#4aaf1e'; }
    const fertAlpha = 0.7 + f*0.35;
    ctx.globalAlpha=fertAlpha;
    ctx.fillStyle=g1; ctx.fillRect(x,SURFACE_Y-14,CELL,12);
    ctx.fillStyle=g2; ctx.fillRect(x,SURFACE_Y-12,CELL,8);
    ctx.fillStyle=g3; ctx.fillRect(x,SURFACE_Y-14,CELL,3);
    ctx.globalAlpha=1;
    ctx.fillStyle='#1e4a0f'; ctx.fillRect(x,SURFACE_Y-2,CELL,2);
    if(f>0.78 && (c*7)%5===0){
      ctx.fillStyle='rgba(46,154,32,0.22)'; ctx.fillRect(x+2,SURFACE_Y-10,12,6);
    }
  }
  if(!isMini){
    for(let pl of plants){
      if(pl.cave) continue;
      if(pl.c<0||pl.c>=COLS) continue;
      if(soil[SURFACE_ROW][pl.c]===0) continue;
      const px=Math.floor(pl.x), py=SURFACE_Y-14;
      const g=pl.growth;
      const sway=Math.sin(time*0.014 + pl.x*0.09)* (0.5 + g*0.4);
      // atlas definitive
      if(texVegetacionReady){
        let src=null;
        if(pl.type==='clover') src=VEG_MAP.clover;
        else if(pl.type==='grassTuft') src=VEG_MAP.grassTuft;
        else if(pl.type==='flowerY') src=VEG_MAP.flowerY;
        else if(pl.type==='flowerW') src=VEG_MAP.flowerW;
        else if(pl.type==='berryBush') src=VEG_MAP.berryBush;
        else if(pl.type==='mushroom') src=VEG_MAP.mushroom;
        else if(pl.type==='sapling') src=VEG_MAP.sapling;
        else if(pl.type==='fruitTree') src=VEG_MAP.fruitTree;
        else src=VEG_MAP.clover;
        if(src){
          ctx.imageSmoothingEnabled=false;
          // size by growth: 18 at g0 → 36 at g1, bigger for trees
          let baseW=22, baseH=22;
          if(pl.type==='berryBush'){ baseW=28; baseH=28; }
          else if(pl.type==='fruitTree'){ baseW=36; baseH=36; }
          else if(pl.type==='sapling'){ baseW=24; baseH=30; }
          else if(pl.type==='mushroom'){ baseW=20; baseH=20; }
          const s = g<0.25?0.55: g<0.55?0.75: g<0.85?0.92:1;
          const dw=Math.floor(baseW*s), dh=Math.floor(baseH*s);
          // sway offset
          const dx = Math.floor(px - dw/2 + sway);
          const dy = Math.floor(py - dh + 6);
          try{ ctx.drawImage(texVegetacion, src.sx, src.sy, src.sw, src.sh, dx, dy, dw, dh); }catch(e){}
          // fruit indicator if mature berry/mushroom/tree with cooldown ready
          if((pl.type==='berryBush' || pl.type==='mushroom' || pl.type==='fruitTree') && g>0.88 && pl.fruitCooldown<120){
            ctx.fillStyle='rgba(255,255,255,0.85)'; ctx.fillRect(dx+dw/2-1, dy-2,2,2);
          }
          continue; // atlas drawn, skip old rects
        }
      }
      // fallback procedural if atlas not ready (kept for safety)
      const g2=g;
      if(pl.type==='clover'){
        const sz = 3 + g2*4;
        ctx.fillStyle=g2<0.3?'#2d6a1a': g2<0.7?'#3a8d22':'#2e9a1e';
        ctx.fillRect(px+sway*0.3, py - sz, 3, sz);
        if(g2>0.45){
          ctx.fillStyle='#3fcf2e'; ctx.fillRect(px-2+sway*0.2, py - sz +1, 3,2); ctx.fillRect(px+2+sway*0.2, py - sz +2, 3,2);
          ctx.fillStyle='#1e5a0f'; ctx.fillRect(px+1+sway*0.2, py - sz +3,1,1);
        }
        if(g2>0.85){ ctx.fillStyle='#7ad35f'; ctx.fillRect(px+1+sway*0.3, py - sz,1,1); }
      } else if(pl.type==='grassTuft'){
        const h= 4 + g2*6;
        ctx.fillStyle='#2d7a1a'; ctx.fillRect(px+sway, py - h, 2, h); ctx.fillStyle='#7ad35f'; ctx.fillRect(px+sway, py - h,1,2);
        if(g2>0.6){ ctx.fillStyle='#3a9d23'; ctx.fillRect(px+4+sway*0.5, py - (h*0.6),1, h*0.6); }
      } else if(pl.type==='flowerY'){
        const h=5+g2*5;
        ctx.fillStyle='#2a7a1a'; ctx.fillRect(px, py - h, 2, h);
        if(g2>0.42){
          const fx=px+1, fy=py - h -2;
          ctx.fillStyle=g2>0.85?'#ffdd57':'#e0c044'; ctx.fillRect(fx-1,fy,4,2); ctx.fillRect(fx,fy-1,2,4);
          ctx.fillStyle='#fff'; ctx.fillRect(fx,fy+1,1,1); ctx.fillStyle='#7a4a00'; ctx.fillRect(fx, fy+2,1,1);
          if(g2>0.9){ ctx.fillStyle='rgba(255,221,87,0.45)'; ctx.fillRect(fx-2,fy-1,6,1); }
        }
      } else if(pl.type==='flowerW'){
        const h=5+g2*5;
        ctx.fillStyle='#2a7a1a'; ctx.fillRect(px, py - h, 2, h);
        if(g2>0.42){
          const fx=px+1, fy=py - h -2;
          ctx.fillStyle='#ffffff'; ctx.fillRect(fx-1,fy,4,2); ctx.fillRect(fx,fy-1,2,4);
          ctx.fillStyle='#ffdd57'; ctx.fillRect(fx,fy+1,1,1);
        }
      } else if(pl.type==='berryBush'){
        const h= 7 + g2*10;
        ctx.fillStyle='#5a3a1a'; ctx.fillRect(px, py - h, 3, h);
        if(g2>0.32){
          const fh = g2<0.6? 10 : g2<0.85? 14 : 18;
          ctx.fillStyle=g2<0.5?'#2e6b1a': g2<0.8?'#2d7a1a':'#1e8a0f';
          ctx.fillRect(px-6, py - h - fh +6, 14, fh);
          ctx.fillStyle='#3fbf2e'; ctx.fillRect(px-4, py - h - fh +8, 8,4);
          if(g2>0.72){ ctx.fillStyle='#1a4a0f'; ctx.fillRect(px-2, py - h -2, 2,2); }
          if(g2>0.88){
            ctx.fillStyle='#6a1a7a'; ctx.fillRect(px-5, py - h -6,3,3); ctx.fillRect(px+3, py - h -8,3,3);
            ctx.fillStyle='#a83ac2'; ctx.fillRect(px-4, py - h -5,1,1); ctx.fillRect(px+4, py - h -7,1,1);
            ctx.fillStyle='#d27aee'; ctx.fillRect(px+1, py - h -10,3,3);
          }
        }
      } else if(pl.type==='mushroom'){
        const h= 2 + g2*5;
        ctx.fillStyle='#d9c8b0'; ctx.fillRect(px, py - h,2, h+1);
        if(g2>0.35){
          const capW = 8 + g2*6, capH= 5 + g2*3;
          ctx.fillStyle=g2<0.7?'#c27a3a':'#d68a4a';
          ctx.fillRect(px - capW/2 +1, py - h - capH, capW, capH);
          ctx.fillStyle='#fff8dc'; ctx.fillRect(px - capW/2 +2, py - h - capH +2,2,2); ctx.fillRect(px+2, py - h - capH+1,2,1);
          ctx.fillStyle='#8b5a2b'; ctx.fillRect(px, py -1,2,2);
        }
      } else if(pl.type==='fruitTree'){
        const h= 6 + g2*20;
        ctx.fillStyle='#5a2a0a'; ctx.fillRect(px, py - h, 4, h);
        if(g2>0.22){
          const crownY = py - h - (g2*12);
          const crownR = g2<0.45? 10 : g2<0.78? 16 : 20;
          ctx.fillStyle=g2<0.5?'#2e8a1f': g2<0.8?'#1e7a0f':'#0f5a0a';
          ctx.fillRect(px - crownR/2, crownY, crownR, crownR*0.75);
          ctx.fillStyle='#3fbf2e'; ctx.fillRect(px - crownR/2+3, crownY+3, crownR-6, 4);
          if(g2>0.72){ ctx.fillStyle='#3a1a05'; ctx.fillRect(px+1, py - h +4, 2, 6); }
          if(g2>0.58){
            const appleY = crownY + 6;
            ctx.fillStyle='#d91e1e'; ctx.fillRect(px - crownR/2 +4, appleY, 3,3); ctx.fillRect(px + crownR/2 -6, appleY+2, 3,3); ctx.fillRect(px -2, appleY+4, 3,3);
            ctx.fillStyle='#ff6b6b'; ctx.fillRect(px - crownR/2 +5, appleY+1,1,1); ctx.fillStyle='#fff'; ctx.fillRect(px -1, appleY+5,1,1);
            if(g2>0.88){ ctx.fillStyle='#ff2a2a'; ctx.fillRect(px+2, appleY-4,3,3); ctx.fillStyle='#ffd93d'; ctx.fillRect(px+3, appleY-3,1,1); }
          }
          ctx.fillStyle='rgba(0,0,0,0.18)'; ctx.fillRect(px+3, py -2, 2, 2);
        }
      } else if(pl.type==='sapling'){
        const h= 4 + g2*18;
        ctx.fillStyle='#6b3a1f'; ctx.fillRect(px, py - h, 3, h);
        if(g2>0.25){
          const crownY = py - h - (g2*10);
          const crownR = g2<0.4? 6 : g2<0.7? 10 : 16;
          ctx.fillStyle=g2<0.4?'#7ad35f': g2<0.7?'#3a9d23':'#1e6a0f';
          ctx.fillRect(px - crownR/2, crownY, crownR, crownR*0.7);
          ctx.fillStyle='#2d7a1a'; ctx.fillRect(px - crownR/2+2, crownY+2, crownR-4,2);
          if(g2>0.85){ ctx.fillStyle='#3a5a0f'; ctx.fillRect(px - crownR/2 -2, crownY+4,2,6); ctx.fillRect(px + crownR/2, crownY+4,2,6); }
        }
      }
    }
    for(let x=0;x<W;x+=14){
      const c=Math.floor(x/CELL);
      if(c>=0&&c<COLS && (soil[SURFACE_ROW][c]===0 || (SURFACE_ROW+1<ROWS && soil[SURFACE_ROW+1][c]===0))) continue;
      const _pl=getPlantAt(c);
      if(_pl && _pl.growth>0.62 && _pl.type!=='grassTuft') continue;
      const seed=(x*13)%7;
      const f=fertility[c]||0.5;
      if(f<0.42 && Math.random()<0.5) continue;
      const h1= 4 + (seed%4) + f*2;
      const sway=Math.sin(time*0.015 + x*0.08)*0.6;
      ctx.fillStyle= seed<2? '#1e5a0f' : seed<4? '#2d7a1a' : '#3a9d23';
      ctx.fillRect(x+3+sway, SURFACE_Y-14 - h1, 2, h1);
      ctx.fillStyle='#7ad35f'; ctx.fillRect(x+3+sway, SURFACE_Y-14 - h1, 1, 2);
      if(seed%3===0 && f>0.55){
        ctx.fillStyle='#2d7a1a'; ctx.fillRect(x+7+sway*0.5, SURFACE_Y-14 - (3+f*2), 1, 3+f*2);
      }
    }
    for(let x=20;x<W;x+=48){
      const c=Math.floor(x/CELL);
      if(c>=0&&c<COLS && (soil[SURFACE_ROW][c]===0 || (SURFACE_ROW+1<ROWS && soil[SURFACE_ROW+1][c]===0))) continue;
      ctx.fillStyle=fertility[c]>0.72?'#6b4a2a':'#5a3a1a'; ctx.fillRect(x, SURFACE_Y-4,4,2); ctx.fillStyle='#8b5a2b'; ctx.fillRect(x+1,SURFACE_Y-5,2,1);
    }
  }
  // soil & tunnels - PIXEL ART DETALLADO REALISTA - con LOD para x16 smooth
  // (debug preview removido)
  // CACHE: si hay cache válido y no es mini, usarla (ahora con worldW correcto)
  if(!isMini && soilCacheCanvas && !soilCacheDirty){ // FIX AZUL REACTIVADO sf: cache con pisos platformer
    // dibujar cache del mundo completo (1024x576) - el zoom ya hizo translate
      ctx.imageSmoothingEnabled=false; ctx.drawImage(soilCacheCanvas, 0, 0);
  } else {
    // si está dirty, reconstruir cache en background y dibujar directo este frame
    if(!isMini && soilCacheCanvas && soilCacheDirty){
      try{ rebuildSoilCache(); }catch(e){ console.warn('rebuild fail',e); soilCacheDirty=false; }
    }
    let cStart=0,cEnd=COLS,rStart=SURFACE_ROW,rEnd=ROWS;
  if(useZoom){cStart=Math.max(0,Math.floor(view.x/CELL)-1); cEnd=Math.min(COLS,Math.ceil((view.x+W/view.zoom)/CELL)+1); rStart=Math.max(SURFACE_ROW,Math.floor(view.y/CELL)-1); rEnd=Math.min(ROWS,Math.ceil((view.y+H/view.zoom)/CELL)+1);}
  for(let r=rStart;r<rEnd;r++) for(let c=cStart;c<cEnd;c++){
    const x=c*CELL, y=r*CELL;
    if(soil[r][c]===1){
      const depth=r-SURFACE_ROW;
      const isDeco = hasDeco(c,r);
      const t=(soilType[r]&&soilType[r][c])||1;
      let base;
      if(isDeco){
        if(t===4) base='#8e7d72';
        else if(t===3) base='#b8a88e';
        else if(t===2) base=depth<7?'#9c6b3a':'#a67c52';
        else base=depth<7?'#9c6b3a':'#8b5a2b';
      } else {
        if(t===2) base= depth<3?'#8b5a32':depth<7?'#a06b33':'#7a4a2a'; // arcilla rojiza
        else if(t===3) base= depth<3?'#c2b280':depth<7?'#d4c5a0':depth<12?'#c9b896':'#b0a080'; // arena clara
        else if(t===4) base= depth<12?'#6e6e6e':depth<18?'#5a5a5a':'#4a4a4a'; // piedra gris
        else base= depth<3?'#7a4a2a':depth<7?'#6b3a1f':depth<12?'#5a2a0a':depth<18?'#4a1e0a':'#3a1505'; // topsoil
      }
      ctx.fillStyle=base; ctx.fillRect(x-0.3,y-0.3,CELL+0.6,CELL+0.6);
      // veta de profundidad con dos tonos
      const dark = depth%2===0 ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.10)';
      ctx.fillStyle=dark; ctx.fillRect(x-0.3,y+CELL-2.3,CELL+0.6,2.6);
      if(depth%4===0){ctx.fillStyle='#2e1000'; ctx.fillRect(x,y, CELL,1); ctx.fillStyle='rgba(255,255,255,0.06)'; ctx.fillRect(x,y+1,CELL,1);}
      if(isDeco){
        // muro embellecido: franja clara y puntito decorativo
        ctx.fillStyle='rgba(255,220,150,0.18)'; ctx.fillRect(x+2,y+3,12,2);
        ctx.fillStyle='#d9b48a'; ctx.fillRect(x+7,y+6,2,2); ctx.fillRect(x+5,y+8,1,1);
      }
      // textura pixel moteada realista - 3 capas (LOD: skip si x16 para no lagear)
      if(gameSpeed<=4){
        const seed = (c*17 + r*13 + depth*5) % 16;
        if(seed<3){ ctx.fillStyle='#8b5a2b'; ctx.fillRect(x+3,y+4,2,2); ctx.fillRect(x+11,y+9,1,1); }
        if(seed===5){ ctx.fillStyle='#3d1f00'; ctx.fillRect(x+6,y+7,3,2); ctx.fillStyle='#a67c52'; ctx.fillRect(x+7,y+8,1,1); }
        if(seed===7){ ctx.fillStyle='rgba(0,0,0,0.22)'; ctx.fillRect(x+4,y+10,4,2); }
        if(seed===9){ ctx.fillStyle='rgba(255,255,255,0.07)'; ctx.fillRect(x+9,y+3,2,2); ctx.fillRect(x+2,y+12,1,1); }
        // piedrita + raiz (solo si no lagea)
        if(!isMini){
          if((c*7+r*11)%14===0){ ctx.fillStyle='#9c6b3a'; ctx.fillRect(x+5,y+5,4,3); ctx.fillStyle='#d9b48a'; ctx.fillRect(x+6,y+6,1,1); ctx.fillStyle='#2e0f00'; ctx.fillRect(x+8,y+7,1,1); }
          if((c+r)%9===0){ ctx.fillStyle='#4a2a0a'; ctx.fillRect(x+2,y+2,1,4); ctx.fillStyle='#6b3a1f'; ctx.fillRect(x+3,y+3,1,2); }
          if(depth>8 && (c*3+r*5)%20===0){ ctx.fillStyle='#2e1a0a'; ctx.fillRect(x+10,y+2,1,6); }
        }
      }
    }else{
      // túnel - suelo compactado realista, no plano
      // base crema con variación por profundidad
      const hasWater = water[r] && water[r][c]>0.08;
      if(hasWater){
        const wa=water[r][c];
        // Topo - agua unificada que fluye (no charcos separados) - estilo reloj pixelado
        const leftW = c>0 && water[r][c-1]>0.08 ? water[r][c-1] : 0;
        const rightW = c<COLS-1 && water[r][c+1]>0.08 ? water[r][c+1] : 0;
        const upW = r>0 && water[r-1] && water[r-1][c]>0.08 ? water[r-1][c] : 0;
        const downW = r+1<ROWS && water[r+1] && water[r+1][c]>0.08 ? water[r+1][c] : 0;
        // color por profundidad/cantidad como madera del reloj pero en azul
        let col = wa>0.62? '#1a4a7a' : wa>0.38? '#2e6ea6' : wa>0.18? '#4a8fcc' : '#7ec8e3';
        if(r<SURFACE_ROW+2 && wa<0.3) col='#8ec8f0'; // charco superficial claro
        const isSurface = !upW || upW < 0.12;
        // dibujar bloque base unificado con solape para no dejar grid blanco
        ctx.fillStyle=col; ctx.fillRect(x-1, y-1, CELL+2, CELL+2);
        // conectar laterales: rellenar hueco 1px entre celdas vecinas con agua
        if(leftW>0.08) ctx.fillRect(x-1, y, 1, CELL);
        if(rightW>0.08) ctx.fillRect(x+CELL, y, 1, CELL);
        if(upW>0.08) ctx.fillRect(x, y-1, CELL, 1);
        if(downW>0.08) ctx.fillRect(x, y+CELL, CELL, 1);
        // borde oscuro sutil como el reloj (solo donde no hay vecino con agua)
        ctx.fillStyle='rgba(0,0,0,0.18)';
        if(!downW) ctx.fillRect(x-1, y+CELL, CELL+2, 1);
        if(!leftW) ctx.fillRect(x-1, y-1, 1, CELL+2);
        if(!rightW) ctx.fillRect(x+CELL, y-1, 1, CELL+2);
        // onda superior animada solo en superficie del cuerpo de agua
        if(isSurface){
          const wave = Math.sin(time*0.022 + c*0.85 + r*0.2)*1.6;
          const w2 = Math.sin(time*0.018 + c*1.1)*0.9;
          ctx.fillStyle='rgba(255,255,255,0.38)'; ctx.fillRect(x+1+wave, y+1, CELL-2, 1);
          ctx.fillStyle='rgba(255,255,255,0.22)'; ctx.fillRect(x+2+w2, y+3, CELL-4, 1);
          // reflejo pixelado estilo reloj
          if(wa>0.42){ ctx.fillStyle='rgba(255,255,255,0.16)'; ctx.fillRect(x+3, y+2, 2,1); }
        } else {
          // interior: vetas sutiles de flujo
          if((c+r)%3===0){ ctx.fillStyle='rgba(255,255,255,0.08)'; ctx.fillRect(x+4, y+6, 3,1); }
        }
      } else {
        const tunnelBase = (r-SURFACE_ROW)<4 ? '#fff1c8' : (r-SURFACE_ROW)<10 ? '#fff8dc' : '#ffedc0';
        ctx.fillStyle=tunnelBase; ctx.fillRect(x-0.5,y-0.5,CELL+1,CELL+1);
      // suelo pisoteado más oscuro abajo
      ctx.fillStyle='#f5d8a0'; ctx.fillRect(x,y+CELL-5,CELL,3); ctx.fillStyle='#e8c99a'; ctx.fillRect(x,y+CELL-3,CELL,2);
      // granito fino en suelo
      const tseed = (c*11+r*7)%10;
      if(tseed===2){ ctx.fillStyle='#e0c080'; ctx.fillRect(x+4,y+11,2,1); }
      if(tseed===5){ ctx.fillStyle='rgba(0,0,0,0.08)'; ctx.fillRect(x+9,y+8,1,1); }
      // pared con ladrillo pixel donde colinda con tierra - más realista con mortero
      const up = r>0 && soil[r-1][c]===1, down = r<ROWS-1 && soil[r+1][c]===1, left=c>0&&soil[r][c-1]===1, right=c<COLS-1&&soil[r][c+1]===1;
      if(up){
        ctx.fillStyle='#2e0f00'; ctx.fillRect(x,y,CELL,4); 
        ctx.fillStyle='#8b5a2b'; ctx.fillRect(x,y, CELL,1);
        ctx.fillStyle='#4a2510'; ctx.fillRect(x+2,y+2,4,1); ctx.fillRect(x+10,y+2,4,1); // ladrillitos
      }
      if(down){ctx.fillStyle='#2e0f00'; ctx.fillRect(x,y+CELL-4,CELL,4); ctx.fillStyle='#1a0a00'; ctx.fillRect(x-0.3,y+CELL-2.3,CELL+0.6,2.6);}
      if(left){ctx.fillStyle='#2e0f00'; ctx.fillRect(x,y,4,CELL); ctx.fillStyle='#6b3a1f'; ctx.fillRect(x+1,y+4,1,4); ctx.fillRect(x+1,y+10,1,4);}
      if(right){ctx.fillStyle='#2e0f00'; ctx.fillRect(x+CELL-4,y,4,CELL); ctx.fillStyle='#4a2510'; ctx.fillRect(x+CELL-2,y+3,1,6);}
      // brillo interior arriba (luz del túnel)
      ctx.fillStyle='rgba(255,255,255,0.45)'; ctx.fillRect(x+4,y+4, CELL-8,1);
      if(!up){ ctx.fillStyle='rgba(255,255,255,0.15)'; ctx.fillRect(x+2,y+2,2,2); }
      }
    }
  }
  // hongos de cueva en túneles húmedos - atlas
  if(!isMini){
    for(let pl of plants){
      if(!pl.cave) continue;
      if(soil[pl.rr] && soil[pl.rr][pl.c]===0){
        if(texVegetacionReady){
          const src=VEG_MAP.caveMush;
          const g=pl.growth;
          ctx.imageSmoothingEnabled=false;
          const base=22; const sc = g<0.3?0.6: g<0.7?0.85:1;
          const dw=Math.floor(base*sc), dh=Math.floor(base*sc);
          const x=pl.c*CELL+8 - dw/2, y=pl.rr*CELL+8 - dh/2 +2;
          const sway=Math.sin(time*0.012 + pl.c*0.7)*1.2;
          try{ ctx.drawImage(texVegetacion, src.sx, src.sy, src.sw, src.sh, Math.floor(x+sway), Math.floor(y), dw, dh); }catch(e){}
          continue;
        }
        const x=pl.c*CELL+6, y=pl.rr*CELL+8;
        const g=pl.growth;
        if(g>0.12){
          ctx.fillStyle='#d9c8b0'; ctx.fillRect(x+2, y-2,2,3);
          const capW=6+Math.floor(g*6), capH=4+Math.floor(g*2);
          ctx.fillStyle=g>0.6?'#8a6a9a':'#6a4a7a';
          ctx.fillRect(x - capW/2 +3, y-2 - capH, capW, capH);
          ctx.fillStyle='#e8d8f0'; ctx.fillRect(x - capW/2 +4, y-2 - capH+1,1,1);
          if(g>0.85){ ctx.fillStyle='#fff'; ctx.fillRect(x, y-2 - capH,1,1); }
        }
      }
    }
  }
  } // end soil direct else
  // GRIETAS PROGRESIVAS - animación experta sin salto: 0→25→55→85→100% con líneas que crecen
  if(!isMini){
    for(let w of workers){ if(w.state==='CAVANDO' && w.digTarget){
      let prog=Math.max(0,Math.min(1,(w.digProgress||0)/(w.digNeeded||8)));
      let cx=w.digTarget.c*CELL, cy=w.digTarget.r*CELL;
      let stage= prog<0.25?0: prog<0.55?1: prog<0.85?2:3;
      if(stage>=0){ ctx.fillStyle='rgba(0,0,0,0.50)'; ctx.fillRect(cx+7,cy+7,2,2); }
      if(stage>=1){ ctx.strokeStyle='rgba(0,0,0,0.88)'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(cx+4,cy+4); ctx.lineTo(cx+12,cy+12); ctx.moveTo(cx+12,cy+4); ctx.lineTo(cx+4,cy+12); ctx.stroke(); }
      if(stage>=2){ ctx.fillStyle='rgba(255,255,220,0.18)'; ctx.fillRect(cx+5,cy+2,6,1); ctx.fillStyle='rgba(0,0,0,0.25)'; ctx.fillRect(cx+2,cy+8,12,1); }
      if(stage>=3){ ctx.fillStyle='#2e0f00'; ctx.fillRect(cx+2,cy+7,12,2); ctx.fillStyle='#8b5a2b'; ctx.fillRect(cx+3,cy+7,10,1); ctx.fillStyle='rgba(255,255,120,0.12)'; ctx.fillRect(cx+1,cy+1,CELL-2,2); }
    }}
  }
  // estructuras complejas (taller, granero, puente, torre) - textura pixel detallada + construcción progresiva 4s
  drawStructures(ctx,W,H,isMini);
  // hongos de cueva ya dibujados arriba
  // hidden rewards - atlas 11 ocultos
  if(!isMini){
    hiddenRewards.forEach(rw=>{
      const x=rw.c*CELL, y=rw.r*CELL;
      if(!rw.found){
// (rama de texturas de ocultos quitada: estaba desactivada con if(false) y el cofre ya lleva su '?' pintado)
const pulse = Math.floor(time*0.08)%2;
        ctx.fillStyle= pulse? '#ffcc00' : '#ffaa00'; ctx.fillRect(x+2,y+2,12,12);
        ctx.strokeStyle='#000'; ctx.lineWidth=2; ctx.strokeRect(x+2,y+2,12,12);
        ctx.fillStyle='#000'; ctx.font='bold 10px "Press Start 2P"'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('?',x+8,y+9);
        ctx.fillStyle='#fff'; ctx.fillRect(x+4,y+4,2,2);
      } else {
        // Topo - textura simple codificada por premio (sencilla 8x8 pixel)
        const t=rw.type;
        // fondo según tier
        let bg='#2de67a', border='#000';
        if(t==='agua') bg='#00e5ff';
        else if(t==='fibra') bg='#d9c8a8';
        else if(t==='piedra') bg='#9a9a9a';
        else if(t==='arcilla') bg='#c08040';
        else if(t==='ambar') bg='#ffb700';
        else if(t==='semillaRara') bg='#b47aff';
        else if(t==='hongo' || t==='hongoCueva') bg='#8b5a2b';
        else if(t==='semillas') bg='#ffcc00';
        ctx.fillStyle=bg; ctx.fillRect(x+2,y+2,12,12);
        ctx.strokeStyle='#000'; ctx.lineWidth=1.5; ctx.strokeRect(x+2,y+2,12,12);
        ctx.fillStyle='#000'; ctx.globalAlpha=0.12; ctx.fillRect(x+2,y+13,12,1); ctx.globalAlpha=1;
        // icono pixel 8x8 centrado
        const cx=x+8, cy=y+8;
        ctx.imageSmoothingEnabled=false;
        if(t==='semillas'){
          ctx.fillStyle='#fff8dc'; ctx.fillRect(cx-3,cy-2,6,4); ctx.fillStyle='#ffcc00'; ctx.fillRect(cx-2,cy-1,2,2); ctx.fillRect(cx+1,cy,1,1); ctx.fillStyle='#8a6a00'; ctx.fillRect(cx-1,cy+1,2,1);
        } else if(t==='agua'){
          ctx.fillStyle='#fff'; ctx.fillRect(cx-2,cy-3,4,6); ctx.fillStyle='#00b8ff'; ctx.fillRect(cx-1,cy-1,2,3); ctx.fillStyle='#fff'; ctx.fillRect(cx-1,cy-2,1,1);
        } else if(t==='hongo' || t==='hongoCueva'){
          ctx.fillStyle='#fff'; ctx.fillRect(cx-2,cy+1,4,2); ctx.fillStyle=t==='hongoCueva'?'#4a2a0a':'#c0392b'; ctx.fillRect(cx-4,cy-2,8,4); ctx.fillStyle='#fff'; ctx.fillRect(cx-2,cy-1,1,1);
        } else if(t==='fibra'){
          ctx.fillStyle='#fff8dc'; ctx.fillRect(cx-4,cy-2,8,2); ctx.fillRect(cx-4,cy+1,8,2); ctx.fillStyle='#8a7a5a'; ctx.fillRect(cx-3,cy,6,1);
        } else if(t==='piedra'){
          ctx.fillStyle='#5a5a5a'; ctx.fillRect(cx-3,cy-2,6,5); ctx.fillStyle='#c8c8c8'; ctx.fillRect(cx-2,cy-1,2,1);
        } else if(t==='arcilla'){
          ctx.fillStyle='#a65820'; ctx.fillRect(cx-3,cy-1,6,4); ctx.fillStyle='#ffaa66'; ctx.fillRect(cx-2,cy,1,1);
        } else if(t==='ambar'){
          ctx.fillStyle='#ff8c00'; ctx.fillRect(cx-3,cy-2,6,6); ctx.fillStyle='#fff8dc'; ctx.fillRect(cx-1,cy-1,2,2); ctx.fillStyle='#fff'; ctx.fillRect(cx,cy-1,1,1);
        } else if(t==='semillaRara'){
          ctx.fillStyle='#fff'; ctx.fillRect(cx-2,cy-3,4,6); ctx.fillStyle='#b47aff'; ctx.fillRect(cx-1,cy-1,2,3); ctx.fillStyle='#fff'; ctx.fillRect(cx,cy,1,1); ctx.fillStyle='rgba(180,122,255,0.5)'; ctx.fillRect(cx-3,cy-3,6,6);
        }
        // brillo
        ctx.fillStyle='rgba(255,255,255,0.35)'; ctx.fillRect(x+3,y+3,8,1);
      }
    });
  }
  // === ANIMACIÓN DE CAVADO DETALLADA - bloque agrietándose ===
  if(!isMini){
    for(let ant of workers){
      if(ant.state==='CAVANDO' && ant.digTarget){
        const c=ant.digTarget.c, r=ant.digTarget.r;
        const x=c*CELL, y=r*CELL;
        const prog = Math.min(1, ant.digProgress/ant.digNeeded);
        // base soil still there but cracking
        if(prog < 1){
          // overlay grietas que crecen
          ctx.fillStyle='rgba(0,0,0,0.14)'; ctx.fillRect(x+2,y+2,12,12);
          ctx.strokeStyle='#1a0a00'; ctx.lineWidth=1;
          if(prog > 0.15){
            // grieta 1 diagonal
            ctx.beginPath(); ctx.moveTo(x+4,y+4); ctx.lineTo(x+8,y+8); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(x+8,y+4); ctx.lineTo(x+4,y+8); ctx.stroke();
          }
          if(prog > 0.35){
            ctx.beginPath(); ctx.moveTo(x+3,y+10); ctx.lineTo(x+10,y+3); ctx.stroke();
            ctx.fillStyle='#2a1200'; ctx.fillRect(x+5,y+5,2,2);
          }
          if(prog > 0.6){
            // bloque oscurecido y con trozos sueltos
            ctx.fillStyle='rgba(0,0,0,0.22)'; ctx.fillRect(x+1,y+1,14,14);
            ctx.fillStyle='#8b5a2b'; ctx.fillRect(x+3,y+3,3,3); ctx.fillRect(x+10,y+9,2,2);
            // vibración pixel del bloque (shake)
            const shake = (Math.sin(time*1.8 + c*7)*1.2) * prog;
            ctx.fillStyle='rgba(255,204,0,0.18)'; ctx.fillRect(x+6+shake,y+7,2,2);
          }
          if(prog > 0.85){
            // a punto de caer - destellos
            ctx.fillStyle='#ffcc00'; ctx.fillRect(x+6,y+6,4,4); ctx.fillStyle='#fff'; ctx.fillRect(x+7,y+7,1,1);
          }
          // barra de progreso pixel sobre el bloque
          ctx.fillStyle='#000'; ctx.fillRect(x+1,y-5,14,3); ctx.strokeStyle='#000'; ctx.strokeRect(x+1,y-5,14,3);
          ctx.fillStyle= prog>0.6 ? '#ff3b30' : '#ffcc00'; ctx.fillRect(x+2,y-4, Math.floor(prog*12),1);
        }
      }
    }
  }
  // === ANIMACIÓN DE CONSTRUCCIÓN - andamiaje progresivo con suficientes frames ===
  if(!isMini){
    for(let ant of workers){
      if(ant.buildTarget && (ant.buildProgress||0)>0){
        const c=ant.buildTarget.c, r=ant.buildTarget.r;
        const x=c*CELL, y=r*CELL;
        const prog = Math.min(1, ant.buildProgress);
        // andamiaje de madera bastidores
        ctx.fillStyle='rgba(107,58,31,0.28)'; ctx.fillRect(x+1,y+1,14,14);
        ctx.strokeStyle='#5a3a1a'; ctx.lineWidth=1; ctx.setLineDash([2,2]); ctx.strokeRect(x+2,y+2,12,12); ctx.setLineDash([]);
        // ladrillos apareciendo poco a poco (4 ladrillos)
        const bricks = Math.floor(prog*4);
        for(let b=0;b<bricks;b++){
          const bx = x+3 + (b%2)*6, by = y+4 + Math.floor(b/2)*5;
          ctx.fillStyle='#8b5a2b'; ctx.fillRect(bx,by,5,3);
          ctx.fillStyle='#d9b48a'; ctx.fillRect(bx+1,by+1,1,1);
          ctx.fillStyle='rgba(0,0,0,0.18)'; ctx.fillRect(bx,by+3,5,1);
        }
        if(prog>0.25){
          ctx.fillStyle='#c2a080'; ctx.fillRect(x+10,y+10,4,4); ctx.fillStyle='#8b5a2b'; ctx.fillRect(x+11,y+11,2,1);
        }
        ctx.fillStyle='#000'; ctx.fillRect(x+1,y-5,14,3); ctx.strokeStyle='#000'; ctx.strokeRect(x+1,y-5,14,3);
        ctx.fillStyle='#2de67a'; ctx.fillRect(x+2,y-4, Math.floor(prog*12),1);
      }
    }
  }
  // frontier glow pixel
  if(!isMini && showFront && view.zoom>0.8){
    const frontier=findFrontier();
    const pulse=(Math.sin(time*0.05)*0.5+0.5);
    const _stride=Math.max(1,Math.ceil(frontier.length/120)); // Topo: capar el resaltado a ~120 celdas
    const _near=new Set(); for(let a of workers){ _near.add(((a.y/CELL)|0)*1024+((a.x/CELL)|0)); }
    for(let _fi=0;_fi<frontier.length;_fi+=_stride){
      const f=frontier[_fi];
      let near=false;
      for(let dr=-5;dr<=5 && !near;dr++) for(let dc=-5;dc<=5;dc++){ if(_near.has((f.r+dr)*1024+(f.c+dc))){ near=true; break; } }
      if(!near) continue;
      const x=f.c*CELL, y=f.r*CELL;
      ctx.strokeStyle=`rgba(255,122,0,${0.25+pulse*0.35})`; ctx.lineWidth=2; ctx.setLineDash([4,4]); ctx.strokeRect(x+1,y+1,14,14); ctx.setLineDash([]);
      ctx.fillStyle=`rgba(255,204,0,${0.10+pulse*0.12})`; ctx.fillRect(x+3,y+3,10,10);
      if(view.zoom>1.5 && pulse>0.7){ctx.fillStyle='#ff7a00'; ctx.fillRect(x+6,y+6,4,4);}
    }
  }
  // fungus gardens pixel - atlas 08
  if(!isMini){
    for(let f of fungusGardens){
      const fx=Math.floor(f.x), fy=Math.floor(f.y);

      const sz=Math.floor(7+f.size*2.2);
      const pulseF = Math.sin(time*0.012 + fx*0.05)*0.5;
      ctx.fillStyle= f.health>0.58 ? '#e8dcc6' : f.health>0.32 ? '#d4c2a3' : '#a89078';
      ctx.fillRect(fx-sz/2 + pulseF, fy-sz/2, sz, sz);
      if(f.health>0.48){
        ctx.fillStyle='#fff8dc'; for(let i=0;i<3;i++) ctx.fillRect(fx-3+(i*3), fy-2, 2,2);
        ctx.fillStyle='#e8d5a3'; ctx.fillRect(fx-1,fy+1,2,2);
      }
      ctx.strokeStyle='rgba(90,58,22,0.32)'; ctx.lineWidth=1; ctx.strokeRect(fx-sz/2, fy-sz/2, sz, sz);
      if(f.health<0.62){ ctx.fillStyle='#000'; ctx.fillRect(fx-8,fy-sz/2-5,16,2); ctx.fillStyle= f.health>0.32 ? '#ffcc00' : '#ff3b30'; ctx.fillRect(fx-7,fy-sz/2-4, Math.floor(f.health*14),1); }
    }
    // waste piles - montón marrón oscuro separado
    for(let w of wastePiles){
      const wx=Math.floor(w.x), wy=Math.floor(w.y);
      ctx.fillStyle='#3d2a14'; ctx.fillRect(wx-5, wy-4,10,8);
      ctx.fillStyle='#5a3a18'; ctx.fillRect(wx-4, wy-3,8,2);
      ctx.fillStyle='#1a0f05'; ctx.fillRect(wx-3, wy+2,6,1);
      if(w.age!==undefined && w.age> DAY_LENGTH*1.2){ ctx.fillStyle='rgba(120,90,40,0.18)'; ctx.fillRect(wx-6,wy-5,12,10); } // descomposición
    }
  }
  // brood pile - atlas definitivo 08
  if(!isMini){
    for(let b of brood){
      const bx=Math.floor(b.x|| (queens[0]?.x||W/2)), by=Math.floor(b.y|| (queens[0]?.y||SURFACE_Y+20));
      if(b.y && isSolidPixel(b.x, b.y)) continue;
      const wiggle = Math.sin(time*0.018 + bx*0.09)*0.7;

      const pulse = (Math.sin(time*0.022 + bx*0.11)*0.5+0.5);
      if(b.type==='egg'){
        ctx.fillStyle='#fff8dc'; ctx.globalAlpha=0.92; ctx.fillRect(bx-2+wiggle, by-2, 4,3); ctx.globalAlpha=1;
        ctx.fillStyle='#d9c8a3'; ctx.fillRect(bx-1+wiggle, by-1,2,1);
        ctx.fillStyle='#b8a080'; ctx.fillRect(bx+1+wiggle, by,1,1);
        if(pulse>0.72){ ctx.fillStyle='rgba(255,255,255,0.22)'; ctx.fillRect(bx-2+wiggle, by-2,4,1); }
      } else if(b.type==='larva'){
        ctx.fillStyle='#fffaf0'; ctx.fillRect(bx-4+wiggle, by-2,8,4);
        ctx.fillStyle='#e8d5a3'; ctx.fillRect(bx-3+wiggle, by,6,1);
        ctx.fillStyle='#d9c8a3'; ctx.fillRect(bx+1+wiggle, by-1,1,1);
        if((b.hunger||0)>48){ ctx.fillStyle='#ffaa88'; ctx.fillRect(bx+3, by,1,1); }
      } else if(b.type==='pupa'){
        const col = b.progress<30?'#e8dcc6': b.progress<70?'#d4c2a3':'#b8a080';
        ctx.fillStyle=col; ctx.fillRect(bx-3, by-3,6,6);
        ctx.fillStyle='#8a7a5a'; ctx.fillRect(bx-3, by-3,6,1);
        ctx.fillStyle='#fff8dc'; ctx.fillRect(bx-1, by-1,1,1);
        if(b.isQueen){ ctx.strokeStyle='#ffcc00'; ctx.lineWidth=1; ctx.strokeRect(bx-4, by-4,8,8); }
      }
    }
  }
  // mound pixel
  for(let m of mound){
    const mx=Math.floor(m.x), my=SURFACE_Y;
    ctx.fillStyle='#6b3a1f'; ctx.fillRect(mx-8, my-m.h,16,m.h);
    ctx.fillStyle='#8b5a2b'; ctx.fillRect(mx-6, my-m.h,12,4);
    ctx.fillStyle='#fff8dc'; ctx.fillRect(mx-6, my-m.h+2,8,2);
    ctx.fillStyle='#3d1f00'; ctx.fillRect(mx-8, my-2,16,2);
  }
  // entrance pixel
  ctx.fillStyle='#fff8dc'; ctx.fillRect(CENTER_COL*CELL+8-20,SURFACE_Y-10,40,10); ctx.strokeStyle='#000'; ctx.lineWidth=3; ctx.strokeRect(CENTER_COL*CELL+8-20,SURFACE_Y-10,40,10);
  if(!isMini){
    const bob = Math.sin(time*0.08)*2; // kept for subtle hole animation but no text

    // DESPENSA emergente - sin letrero, solo la miel donde ellas decidan (pantryPos)
    const s1={x:pantryPos.x, y:pantryPos.y};
    // gotitas sin cartel - la despensa se reconoce porque ahí está la miel acumulada
    // Topo: un tarro vive en una celda de túnel. Si no hay cámara cavada, no hay miel almacenada a la vista.
    const _ppc=Math.floor(s1.x/CELL), _ppr=Math.floor(s1.y/CELL);
    const _spots=[];
    for(let _dy=-1;_dy<=1;_dy++) for(let _dx=-2;_dx<=2;_dx++){
      const _rr=_ppr+_dy, _cc=_ppc+_dx;
      if(_rr<SURFACE_ROW||_rr>=ROWS||_cc<0||_cc>=COLS) continue;
      if(Array.isArray(soil)&&soil[_rr]&&soil[_rr][_cc]===0) _spots.push({x:_cc*CELL+2,y:_rr*CELL+4});
    }
    const _jars=Math.max(0, Math.min(colonyFood, _spots.length*2, 16));
    for(let i=0;i<_jars;i++){
      const sp=_spots[i>>1]; if(!sp) continue;
      const px=sp.x+(i&1)*7, py=sp.y;
      ctx.fillStyle='#000'; ctx.fillRect(px,py,6,8);
      ctx.fillStyle= i%3===0? '#ffcc33' : '#ffda66'; ctx.fillRect(px+1,py+1,4,6);
      ctx.fillStyle='#fff'; ctx.fillRect(px+1,py+1,1,2);
      ctx.fillStyle='#ff8c00'; ctx.fillRect(px+1,py+6,4,1);
    }
    const s2={x:queen.x,y:queen.y};
  }
  // inks
  if(showInk && !isMini){
    for(let ink of commInks){
      const a=ink.life;
      // tinta sutil: puntito 6px con símbolo 5px y alpha bajo
      ctx.globalAlpha=a*0.58;
      ctx.fillStyle=ink.color; ctx.beginPath(); ctx.arc(Math.floor(ink.x), Math.floor(ink.y), 3.5, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha=a*0.88;
      ctx.fillStyle='#000'; ctx.font='bold 6px "Press Start 2P"'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(ink.sym, Math.floor(ink.x), Math.floor(ink.y)+0.5);
      ctx.globalAlpha=1;
    }
  }
  if(showTrail && !isMini){
    for(let p of pheromones){
      if(isSolidPixel(p.x,p.y)) continue;
      const a=p.life; const isExplore=(p.type==='explore');

      ctx.globalAlpha=a*(isExplore?0.13:0.19);
      ctx.fillStyle= isExplore? 'rgba(120,200,150,1)' : 'rgba(255,204,0,1)'; ctx.beginPath(); ctx.arc(Math.floor(p.x), Math.floor(p.y), isExplore?2.4:3, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha=a*(isExplore?0.28:0.46);
      ctx.fillStyle= isExplore? 'rgba(180,235,200,1)' : 'rgba(255,232,120,1)'; ctx.beginPath(); ctx.arc(Math.floor(p.x), Math.floor(p.y), isExplore?1.0:1.35, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha=1;
    }
  }
  // FOODS - gota de miel pixel art pequeña, no contamina
  function drawHoneyDrop(ctx,cx,cy,amt){
    const col = amt>=3 ? '#ffb700' : amt===2 ? '#ffcc33' : '#ffda66';
    const acol = amt>=3 ? '#ff8c00' : '#ffaa22';
    // tamaño según cantidad: 8x10, 10x12, 12x14
    const w = amt>=3? 12 : amt===2? 10 : 8;
    const h = amt>=3? 14 : amt===2? 12 : 10;
    const x = Math.floor(cx - w/2), y = Math.floor(cy - h/2);
    // sombra sutil
    ctx.fillStyle='rgba(0,0,0,0.18)'; ctx.fillRect(x+2, y+h, w-2, 2);
    // contorno gota (pixel)
    // cuerpo con forma gota
    ctx.fillStyle='#000';
    // outline - dibujar silueta gota
    if(w===12){
      // 12x14 outline
      ctx.fillRect(x+4,y,4,1); ctx.fillRect(x+2,y+1,8,1); ctx.fillRect(x+1,y+2,10,1);
      for(let yy=3; yy<10; yy++) ctx.fillRect(x,y+yy,12,1);
      ctx.fillRect(x+1,y+10,10,1); ctx.fillRect(x+2,y+11,8,1); ctx.fillRect(x+3,y+12,6,1); ctx.fillRect(x+5,y+13,2,1);
    } else if(w===10){
      ctx.fillRect(x+3,y,4,1); ctx.fillRect(x+2,y+1,6,1); ctx.fillRect(x+1,y+2,8,1);
      for(let yy=3; yy<9; yy++) ctx.fillRect(x,y+yy,10,1);
      ctx.fillRect(x+1,y+9,8,1); ctx.fillRect(x+2,y+10,6,1); ctx.fillRect(x+4,y+11,2,1);
    } else {
      ctx.fillRect(x+3,y,2,1); ctx.fillRect(x+2,y+1,4,1); ctx.fillRect(x+1,y+2,6,1);
      for(let yy=3; yy<8; yy++) ctx.fillRect(x,y+yy,8,1);
      ctx.fillRect(x+1,y+8,6,1); ctx.fillRect(x+2,y+9,4,1);
    }
    // relleno interior ámbar
    ctx.fillStyle=col;
    if(w===12){
      ctx.fillRect(x+1,y+3,10,7); ctx.fillRect(x+2,y+10,8,1); ctx.fillRect(x+3,y+11,6,1);
      ctx.fillRect(x+2,y+2,8,1); ctx.fillRect(x+4,y+1,4,1);
    } else if(w===10){
      ctx.fillRect(x+1,y+3,8,6); ctx.fillRect(x+2,y+9,6,1); ctx.fillRect(x+3,y+2,6,1);
    } else {
      ctx.fillRect(x+1,y+3,6,5); ctx.fillRect(x+2,y+8,4,1); ctx.fillRect(x+2,y+2,4,1);
    }
    // brillo interior más oscuro abajo
    ctx.fillStyle=acol; ctx.fillRect(x+2,y+h-4, w-4,2);
    // brillo blanco pequeño arriba-izq
    ctx.fillStyle='#fff'; 
    if(w===12){ ctx.fillRect(x+3,y+3,2,2); ctx.fillRect(x+3,y+5,1,2); }
    else if(w===10){ ctx.fillRect(x+3,y+3,2,2); }
    else { ctx.fillRect(x+2,y+3,1,2); }
    // puntita de miel abajo
    ctx.fillStyle='#fff8b0'; ctx.fillRect(x+w/2-0.5,y+h-2,1,1);
  }
  // FOOD POR TIPO MATERIAL - Terraria/Dwarf Fortress: cada alimento textura y podredumbre propia
  function drawFoodItem(ctx,cx,cy,f){
    const amt=f.amount||1, type=f.ftype||'honey', fresh=f.fresh!=null? f.fresh : 1;
    const def=FOOD_DEFS[type]||FOOD_DEFS.honey;
    const rot=1-fresh;
    // atlas definitivo 03 - cada food en su celda transparente
    // miel nueva regenerada: usa PNG individual 66KB para no congelar (atlas 4MB pesado)
    if(type==='honey' && typeof texHoneyNewReady!=='undefined' && texHoneyNewReady){
      ctx.imageSmoothingEnabled=false;
      const base = amt>=6? 9 : amt>=3? 7 : amt===2? 6 : 5;
      const s2 = 1 + Math.min(amt-1,5)*0.04;
      const dw2=Math.floor(base*s2), dh2=Math.floor(base*s2*1.18);
      const dx2=Math.floor(cx - dw2/2), dy2=Math.floor(cy - dh2/2 -1);
      try{ ctx.drawImage(texHoneyNew, 0,0, texHoneyNew.width, texHoneyNew.height, dx2, dy2, dw2, dh2); }catch(e){}
      if(amt>1){ ctx.fillStyle='#000'; ctx.font='6px "Press Start 2P"'; ctx.textAlign='center'; ctx.fillText(''+amt, cx, dy2+dh2+6); }
      return;
    }
    if(texAlimentosReady){
      let src=null;
      if(type==='honey') src=ALIM_MAP.honey;
      else if(type==='berry') src=ALIM_MAP.berry;
      else if(type==='mushroom') src=ALIM_MAP.mushroom;
      else if(type==='apple') src=ALIM_MAP.apple;
      else if(type==='seed') src=ALIM_MAP.seed;
      else if(type==='grassSeed') src=ALIM_MAP.grassSeed;
      else src=ALIM_MAP.honey;
      if(src){
        ctx.imageSmoothingEnabled=false;
        // miel subida un pelo por pedido - 5-9px base (un pelo más que 4-6), cabe en celda 16px
        const base = amt>=6? 9 : amt>=3? 7 : amt===2? 6 : 5;
        const s = 1 + Math.min(amt-1,5)*0.04;
        const dw=Math.floor(base*s), dh=Math.floor(base*s*1.18);
        const dx=Math.floor(cx - dw/2), dy=Math.floor(cy - dh/2 -1);
        // sombra sutil 1px en suelo para legibilidad, sin bloque negro
        // try{ ctx.fillStyle='rgba(0,0,0,0.12)'; ctx.fillRect(dx+1, dy+dh-1, dw-2, 1); }catch(e){}
        try{ ctx.drawImage(texAlimentos, src.sx, src.sy, src.sw, src.sh, dx, dy, dw, dh); }catch(e){}
        // podredumbre overlay si hace falta
        if(rot>0.45){
          ctx.fillStyle= rot>0.65? 'rgba(60,20,0,0.32)' : 'rgba(60,40,0,0.18)';
          ctx.fillRect(dx+dw*0.2, dy+dh*0.5, dw*0.6, dh*0.25);
        }
        if(amt>1){
          ctx.fillStyle='#000'; ctx.font='6px "Press Start 2P"'; ctx.textAlign='center'; ctx.fillText(''+amt, cx, dy+dh+6);
        }
        return;
      }
    }
    // fallback procedural si atlas no listo
    const w = amt>=3? 12 : amt===2? 10 : 8;
    const h = amt>=3? 14 : amt===2? 12 : 10;
    if(type==='honey'){
      drawHoneyDrop(ctx,cx,cy,amt);
      if(rot>0.5){
        ctx.fillStyle='rgba(60,40,0,0.22)'; ctx.fillRect(Math.floor(cx-w/2), Math.floor(cy-h/2), w, h);
      }
      return;
    }
    if(type==='berry'){
      const x=Math.floor(cx-4), y=Math.floor(cy-4);
      const col = rot>0.6 ? '#4a144a' : rot>0.3? '#5a1a5a' : def.color;
      const cap = rot>0.6 ? '#6a2a6a' : def.cap;
      ctx.fillStyle='#000'; ctx.fillRect(x-1,y-1,10,10);
      ctx.fillStyle=col; ctx.fillRect(x,y,6,6); ctx.fillRect(x+4,y+2,4,4);
      ctx.fillStyle=cap; ctx.fillRect(x+1,y+1,2,2); ctx.fillRect(x+5,y+3,1,1);
      if(rot>0.4){ ctx.fillStyle='rgba(0,0,0,0.35)'; ctx.fillRect(x+2,y+2,3,3); }
      if(amt>1){ ctx.fillStyle='#000'; ctx.font='6px "Press Start 2P"'; ctx.textAlign='center'; ctx.fillText(''+amt, cx, y+12); }
      return;
    }
    if(type==='mushroom'){
      const x=Math.floor(cx-4), y=Math.floor(cy-6);
      const stemCol = rot>0.5? '#9a7a5a' : '#d9c8b0';
      const capCol = rot>0.5? '#6b4420' : def.cap;
      ctx.fillStyle='#000'; ctx.fillRect(x+2,y,4,10);
      ctx.fillStyle=stemCol; ctx.fillRect(x+3,y+2,2,8);
      ctx.fillStyle='#000'; ctx.fillRect(x,y,8,6);
      ctx.fillStyle=capCol; ctx.fillRect(x+1,y+1,6,4);
      ctx.fillStyle='#fff8dc'; ctx.fillRect(x+2,y+2,1,1);
      if(rot>0.4){ ctx.fillStyle='rgba(40,20,0,0.35)'; ctx.fillRect(x+1,y+1,6,1); }
      return;
    }
    if(type==='apple'){
      const x=Math.floor(cx-5), y=Math.floor(cy-5);
      const col = rot>0.6 ? '#6b0f0f' : def.color;
      ctx.fillStyle='#000'; ctx.fillRect(x-1,y-1,10,10);
      ctx.fillStyle=col; ctx.fillRect(x,y,8,8);
      ctx.fillStyle=def.cap; ctx.fillRect(x+2,y+2,2,2); ctx.fillStyle='#fff'; ctx.fillRect(x+1,y+1,1,1);
      if(rot>0.4){ ctx.fillStyle='rgba(0,0,0,0.28)'; ctx.fillRect(x+2,y+5,4,2); }
      ctx.fillStyle='#7a4a1a'; ctx.fillRect(x+3,y-2,2,2);
      return;
    }
    if(type==='seed' || type==='grassSeed'){
      const x=Math.floor(cx-3), y=Math.floor(cy-3);
      ctx.fillStyle='#000'; ctx.fillRect(x-1,y-1,6,5);
      ctx.fillStyle=def.color; ctx.fillRect(x,y,4,3);
      ctx.fillStyle=def.cap; ctx.fillRect(x+1,y+1,1,1);
      if(amt>2){ ctx.fillStyle='#000'; ctx.font='5px "Press Start 2P"'; ctx.textAlign='center'; ctx.fillText('x'+amt, cx, y+7); }
      return;
    }
    drawHoneyDrop(ctx,cx,cy,amt);
  }
  for(let f of foods){
    const bob=Math.sin(time*0.03+f.pulse)*1.2;
    const cx=f.x, cy=f.y+bob;
    drawFoodItem(ctx,cx,cy,f);
    // indicador stockpile DF: verde si está a salvo en granero/despensa, no se pudre
    if(!isMini && isFoodInStockpile(f)){
      ctx.strokeStyle='rgba(45,230,122,0.55)'; ctx.lineWidth=1; ctx.strokeRect(Math.floor(cx-6), Math.floor(cy-6), 12, 12);
      // barrilito pixel indicador
      ctx.fillStyle='rgba(45,230,122,0.18)'; ctx.fillRect(Math.floor(cx-6), Math.floor(cy+6), 12, 2);
    }
    // barra podredumbre si no está a salvo y empieza a pudrirse (>0.3)
    if(!isMini && f.rot!=null && f.rot>0.28 && !isFoodInStockpile(f)){
      ctx.fillStyle='#000'; ctx.fillRect(Math.floor(cx-6), Math.floor(cy-8), 12, 3);
      ctx.fillStyle= f.rot>0.65 ? '#ff3b30' : '#ffcc00';
      ctx.fillRect(Math.floor(cx-5), Math.floor(cy-7), Math.floor(f.rot*10), 1);
    }
    // número solo si zoom alto
    if(!isMini && view.zoom>1.8 && f.amount>1){
      ctx.fillStyle='#000'; ctx.font='6px "Press Start 2P"'; ctx.textAlign='center'; ctx.fillText(''+f.amount, cx, cy+12);
    }
  }
  // QUEEN(S) pixel - ahora pueden ser varias, cada una con su facción
  for(let qi=0; qi<queens.length; qi++){
    const queen=queens[qi];
    const qx=queen.x, qy=queen.y;
    const facCol = society.factions.find(f=>f.id===queen.faction)?.color || '#b47aff';
    if(!isMini){ctx.fillStyle='rgba(0,0,0,0.2)'; ctx.fillRect(qx-20,qy+12,40,6);}
    ctx.save(); ctx.translate(qx,qy);
    // respiración experta - volumen constante como Stardew bob 1px, sin salto
    let qBreath=Math.sin(time*0.019+qi*1.7)*0.035+1; ctx.scale(qBreath, 2-qBreath);
    // si está vieja, se ve más pálida
    const ageAlpha = queen.age>6000? 0.7 : 1;
    ctx.globalAlpha=ageAlpha;
    // REINA GRAFICA REALISTA - sprite 96x32 2f transparente (idle + poniendo huevo), respira con scale
    if(queenSpriteReady && queenSprite.width){
      // frame 1 cuando está a >72% de poner huevo (panza con huevo visible)
      const qF = (queen.progress>0.72) ? 1 : (Math.floor(time*0.018+qi)%2===0?0:0); // mayormente idle, laying solo cuando grávida
      const sw=queenSprite.width/2, sh=queenSprite.height;
      ctx.imageSmoothingEnabled=false;
      // sombra
      ctx.fillStyle='rgba(0,0,0,0.22)'; ctx.fillRect(-18,12,36,6);
      // sprite 48x32 dibujado centrado
      ctx.drawImage(queenSprite, qF*sw,0,sw,sh, -24,-16,48,32);
      // barra facción bajo la reina
      ctx.fillStyle=facCol; ctx.fillRect(-14,16,28,3); ctx.strokeStyle='#000'; ctx.strokeRect(-14,16,28,3);
    } else if(useAnthro && anthroReady){
      const cellW=128, cellH=128;
      const sx=3*cellW;
      ctx.imageSmoothingEnabled=false;
      ctx.drawImage(anthroSprite, sx, 0, cellW, cellH, -18, -22, 36, 36);
      ctx.fillStyle=facCol; ctx.fillRect(-14,16,28,3); ctx.strokeStyle='#000'; ctx.strokeRect(-14,16,28,3);
    } else {
      ctx.fillStyle='#3a1f5a'; ctx.strokeStyle=facCol; ctx.lineWidth=2;
      ctx.fillRect(-18,-8,22,16); ctx.strokeRect(-18,-8,22,16);
      ctx.fillStyle='#6b3ab4'; ctx.fillRect(-16,-6,18,4);
      ctx.fillStyle='#fff'; ctx.fillRect(-12,4,10,2);
      ctx.fillStyle='#2a1740'; ctx.fillRect(-2,-10,10,16); ctx.strokeRect(-2,-10,10,16);
      ctx.fillStyle='#1a0a2e'; ctx.fillRect(8,-8,12,14); ctx.strokeRect(8,-8,12,14);
      ctx.fillStyle='#ffcc00'; ctx.fillRect(-4,-18,18,6); ctx.fillStyle='#ffaa00'; ctx.fillRect(-4,-18,18,2); ctx.strokeStyle= queen.faction===0? '#000' : facCol; ctx.strokeRect(-4,-18,18,6);
      ctx.fillStyle='#000'; ctx.font='8px "Press Start 2P"'; ctx.textAlign='center'; ctx.fillText('♛',5,-14);
    }
    // ojos - si está enferma, ojos rojos
    if(queen.health<40){ ctx.fillStyle='#ff3b30'; } else ctx.fillStyle='#ffcc00';
    ctx.fillRect(12,-4,4,4); ctx.fillRect(12,4,4,4);
    ctx.fillStyle='#fff'; ctx.fillRect(13,-3,1,1);
    if(!isMini && queen.progress>0){
      ctx.fillStyle='#000'; ctx.fillRect(-18,-22,36,6); ctx.strokeStyle=facCol; ctx.strokeRect(-18,-22,36,6);
      ctx.fillStyle=facCol; ctx.fillRect(-17,-21, Math.floor(queen.progress*0.34),4);
    }
    // barra de vida/edad
    if(!isMini){
      ctx.fillStyle='#000'; ctx.fillRect(-18,14,36,3);
      const lifePct=Math.max(0, 1 - queen.age/queen.maxAge);
      ctx.fillStyle= lifePct>0.5? '#2de67a' : lifePct>0.2? '#ffcc00' : '#ff3b30';
      ctx.fillRect(-18,14, Math.floor(36*lifePct),3);
    }
    ctx.globalAlpha=1;
    ctx.restore();
    if(!isMini){
      ctx.fillStyle='#000'; ctx.fillRect(qx-38,qy-32,76,14); ctx.strokeStyle=facCol; ctx.lineWidth=2; ctx.strokeRect(qx-38,qy-32,76,14);
      ctx.fillStyle='#fff'; ctx.font='7px "Press Start 2P"'; ctx.textAlign='center'; 
      const ageD=(queen.age/DAY_LENGTH).toFixed(1);
      ctx.fillText(`♛ ${queen.name} ${ageD}d`,qx,qy-24);
      // facción pequeña
      if(queens.length>1){
        ctx.fillStyle=facCol; ctx.font='6px "Press Start 2P"'; ctx.fillText(`F${queen.faction}`,qx,qy-34);
      }
    }
  }
  // brood pixel
  brood.forEach((b,i)=>{
    const angle=(i*1.25)+ time*0.018;
    const bx=queen.x+ Math.cos(angle)*(20 + (i%3)*8);
    const by=queen.y+ Math.sin(angle)*(12 + (i%2)*6) + 12;
    if(!isMini) {ctx.fillStyle='rgba(0,0,0,0.15)'; ctx.fillRect(bx-8,by+6,16,4);}
    if(b.type==='egg'){ctx.fillStyle='#fffef0'; ctx.fillRect(bx-6,by-8,12,14); ctx.strokeStyle='#000'; ctx.lineWidth=2; ctx.strokeRect(bx-6,by-8,12,14); ctx.fillStyle='#ffcc00'; ctx.fillRect(bx-2,by-2,4,4);}
    else if(b.type==='larva'){ctx.fillStyle='#f5e6c8'; ctx.fillRect(bx-8,by-4,16,8); ctx.strokeStyle='#000'; ctx.strokeRect(bx-8,by-4,16,8); ctx.fillStyle='#8b5a2b'; ctx.fillRect(bx-3,by-1,6,2);}
    else{ctx.fillStyle='#8b5a2b'; ctx.fillRect(bx-7,by-6,14,12); ctx.strokeStyle='#000'; ctx.strokeRect(bx-7,by-6,14,12); ctx.fillStyle='#ffcc00'; ctx.fillRect(bx-2,by-2,4,4);}
    if(!isMini){
      ctx.fillStyle='#000'; ctx.fillRect(bx-8,by-14,16,5); ctx.fillStyle= b.type==='egg'?'#fffef0':b.type==='larva'?'#f5e6c8':'#b47aff'; ctx.fillRect(bx-7,by-13, Math.floor(b.progress/100*14),3);
    }
  });
  // WORKERS pixel art - BIG
  _bubbleOccupied=[];
  workers.forEach((ant, idx)=>{
    const _rx=ant._renderX||ant.x, _ry=ant._renderY||ant.y;
    // vision cones
    if(showEyes && !isMini){
      const isSel=ant.selected;
      const alphaBase = isSel ? 0.22 : 0.07;
      const angles=[-Math.PI/4, 0, Math.PI/4];
      const cols=['255,59,48','255,204,0','0,229,255'];
      angles.forEach((da,i)=>{
        const ang=ant.angle+da; const d=rayWallDist(ant.x, ant.y, ang, 40);
        if(d>8){
          ctx.fillStyle=`rgba(${cols[i]},${alphaBase})`;
          ctx.beginPath(); ctx.moveTo(ant.x, ant.y); ctx.arc(ant.x, ant.y, d, ang-0.2, ang+0.2); ctx.closePath(); ctx.fill();
          ctx.strokeStyle=`rgba(${cols[i]},${isSel?0.6:0.2})`; ctx.lineWidth=isSel?2:1; ctx.setLineDash(isSel?[6,4]:[]); ctx.beginPath(); ctx.moveTo(ant.x, ant.y); ctx.lineTo(ant.x+Math.cos(ang)*d, ant.y+Math.sin(ang)*d); ctx.stroke(); ctx.setLineDash([]);
          if(isSel){ctx.fillStyle=`rgba(${cols[i]},0.95)`; ctx.fillRect(Math.floor(ant.x+Math.cos(ang)*d)-2, Math.floor(ant.y+Math.sin(ang)*d)-2,4,4);}
        }
      });
      const neigh=nearestWorker(ant, ant.id);
      if(neigh && dist(ant,neigh)<80 && Math.abs(ant.commOut[0])>0.42){
        ctx.strokeStyle=`rgba(0,229,255,${isSel?0.5:0.15})`; ctx.setLineDash([6,6]); ctx.lineWidth=isSel?2:1; ctx.beginPath(); ctx.moveTo(ant.x,ant.y); ctx.lineTo(neigh.x,neigh.y); ctx.stroke(); ctx.setLineDash([]);
        if(isSel){const mx=(ant.x+neigh.x)/2, my=(ant.y+neigh.y)/2; ctx.fillStyle='#000'; ctx.fillRect(mx-12,my-10,24,10); ctx.strokeStyle='#00e5ff'; ctx.strokeRect(mx-12,my-10,24,10); ctx.fillStyle='#00e5ff'; ctx.font='7px "Press Start 2P"'; ctx.textAlign='center'; ctx.fillText(symbolForComms(ant.commOut[0],ant.commOut[1]), mx, my-3);}
      }
    }
    if(!isMini){ctx.fillStyle='rgba(0,0,0,0.20)'; ctx.fillRect(_rx-18, _ry+13,36,6); ctx.fillStyle='rgba(0,0,0,0.12)'; ctx.fillRect(_rx-16, _ry+14,32,4);}
    ctx.save(); ctx.translate(_rx,_ry); if(ant._climbing){ ctx.rotate(ant.angle); } else { const flip=Math.cos(ant.angle)<0?-1:1; ctx.scale(flip,1); }
    // patas realistas ahora en sprite sheet 6f (si está cargado, no dibujar procedural para no duplicar y ahorrar)
    if(!isMini && !antWalk6Ready){
      const _wp = ant._walkPhase||0;
      const moving = ant.state!=='DESCANSAR' && ant.state!=='CAVANDO';
      if(useAnthro && anthroReady){
        for(let side=-1; side<=1; side+=2){
          const phase = _wp*1.25 + (side<0?0:Math.PI);
          const swing = Math.sin(phase)*5;
          const lift = moving ? Math.max(0, Math.sin(phase))*4 : 0;
          ctx.fillStyle='#1a0a00'; ctx.fillRect(side*3 -1, 6, 2, 6);
          ctx.fillStyle='#2e1a0a';
          const kneeX = side*3 + swing*0.35;
          const kneeY = 12 - lift*0.6;
          ctx.fillRect(kneeX-1, kneeY, 2, 6);
          ctx.fillStyle='#3a1a05';
          ctx.fillRect(kneeX + swing*0.25 -1, kneeY+6, 3, 2);
        }
      } else {
        for(let side=-1; side<=1; side+=2){
          for(let leg=0; leg<3; leg++){
            const baseX = (leg-1)*7;
            const baseY = 2 + (leg===1?1:0);
            const phase = _wp*2.4 + leg*1.07 + (side<0?0:Math.PI);
            const swing = Math.sin(phase)*6.5;
            const lift = moving ? Math.max(0, Math.sin(phase))*3.2 : 0;
            ctx.fillStyle='#0f0700';
            ctx.fillRect(baseX + side*4, baseY, 1, 3);
            ctx.fillStyle='#1e0f00';
            ctx.fillRect(baseX + side*4 + swing*0.22, baseY+3 - lift*0.3, 1, 4);
            ctx.fillStyle='#2a1500';
            ctx.fillRect(baseX + side*4 + swing*0.55, baseY+6 - lift*0.2, 1, 4);
            if(lift>1.2){
              ctx.fillStyle='#3d1f00';
              ctx.fillRect(baseX + side*4 + swing, baseY+9, 2,1);
            }
          }
        }
      }
    }
    // sprite realista - hormiga auténtica pixel
    const animBob = Math.sin(ant._bobPhase||0)*0.7;
    ctx.translate(0, animBob);
    if(ant.selected && !isMini){
      // aura en pies + flechita arriba - estilo Terraria/Stardew, sin recuadro entrelineado
      const pulse = Math.sin((ant._bobPhase||0)*1.1 + idx*0.7)*0.5 + Math.sin((ant._walkPhase||0)*1.3)*0.2;
      // aura pulsante bajo pies
      ctx.save();
      ctx.fillStyle='rgba(255,204,0,0.22)';
      ctx.beginPath(); ctx.ellipse(0, 16, 14 + pulse*2, 4.5 + pulse*0.6, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle='rgba(255,204,0,0.45)';
      ctx.beginPath(); ctx.ellipse(0, 16, 7 + pulse*1.2, 2.2 + pulse*0.3, 0, 0, Math.PI*2); ctx.fill();
      ctx.restore();
      // flechita amarilla pixel arriba
      ctx.save();
      const bob = Math.sin((ant._bobPhase||0)*1.6 + idx)*1.2;
      ctx.translate(0, -20 + bob);
      ctx.fillStyle='#ffcc00'; ctx.strokeStyle='#000'; ctx.lineWidth=2;
      // triángulo flecha ▼
      ctx.beginPath(); ctx.moveTo(-6, -3); ctx.lineTo(6, -3); ctx.lineTo(0, 5); ctx.closePath(); ctx.fill(); ctx.stroke();
      // brillo interno
      ctx.fillStyle='#fff8dc'; ctx.fillRect(-2,-2,4,1);
      ctx.restore();
    }
    if(useAnthro && anthroReady && anthroSprite.width){
      // antropomorfo detallado - 4x2 sheet, pero con poses por estado y animación de 4 fases
      const cellW=128, cellH=128;
      let sIdx=0;
      if(ant.role==='EXCAVADORA') sIdx=1;
      else if(ant.role==='EXPLORADORA') sIdx=0;
      else if(ant.role==='NODRIZA') sIdx=2;
      else if(ant.rank==='LÍDER' || ant.rank==='JEFE') sIdx=3;
      else sIdx=0;
      if(ant.isQueen) sIdx=3;
      // animación 4 fases: walk 0-1, dig 0-1 con swing, idle
      // FRAME EXPERTO - misma base que hormiga real: walk 6f→2f mapeado @110ms, idle 4f @520ms, dig hold 200ms (Stardew/Shovel)
      let frame=0;
      const _wp=ant._walkPhase||0;
      const _bp=ant._bobPhase||0;
      // evolución más allá de lo real: GEN≥7 + IQ>148 walk más fluido 90ms (super-hormiga)
      let walkSpeedMul = (gen>=7 && colonyIQ>148) ? 1.22 : 1.0;
      let movingAnthro = ant.state!=='DESCANSAR' && ant.state!=='CAVANDO' && (ant.state==='EXPLORAR'||ant.state==='BUSCAR'||ant.state==='VOLVER_COMIDA'||ant.state==='VOLVER_TIERRA'||ant.state==='TANDEM_LEADER'||ant.food);
      if(ant._onCeiling && !isMini){ ctx.save(); ctx.scale(1,-1); } // techo: boca abajo
      if(ant.state==='CAVANDO' && (workers.filter(w=>w.state==='CAVANDO').length<=3 || ant.selected)){
        // DIG 4 fases simuladas con 2 frames: F0 windup, F1 strike doble duración (hold 200ms)
        let p = _bp*1.65 + idx*0.9;
        let cycle = p % 5; // 1+2+1+1
        if(cycle<1) frame=0; else if(cycle<3) frame=1; else if(cycle<4) frame=0; else frame=1;
      } else if(ant.state==='DESCANSAR'){
        frame = 0; // duerme en F0 con scale 0.92
      } else if(movingAnthro){
        // WALK mapeado 2f @110ms (90ms si super-evo) - distance-based para respetar velocidad
        let p = _wp*0.88 + idx*0.33;
        frame = Math.floor((p*1.6*walkSpeedMul) % 2);
      } else {
        // IDLE 4 fases @520ms con 2 frames
        let p = _bp*0.60 + idx*0.35;
        let cyc = Math.floor(p % 4);
        frame = cyc % 2;
      }
      const sx=sIdx*cellW, sy=frame*cellH;
      const dw = 30, dh = 30;
      // animación corporal detallada
      const walkPhase = (ant._walkPhase||0)*1.05 + idx*0.3;
      const walkSwing = Math.sin(walkPhase)*0.32;
      const bob = Math.sin(ant._bobPhase||0)*0.9;
      const breath = Math.sin((ant._bobPhase||0)*0.32 + idx*0.4)*0.3;
      // pose según estado
      let offY = bob;
      let rot = walkSwing*0.055;
      let scaleY = 1;
      if(ant._onCeiling && !isMini){ ctx.save(); ctx.scale(1,-1); } // techo: boca abajo
      if(ant.state==='CAVANDO' && (workers.filter(w=>w.state==='CAVANDO').length<=3 || ant.selected)){
        // agachado y picando con hold 200ms - time-based (bobPhase) para que no se freeze si walkPhase stall
        offY = Math.sin((ant._bobPhase||0)*2.6+idx)*1.4 + 1.2;
        rot = Math.sin((ant._bobPhase||0)*2.8+idx)*0.22;
        scaleY = 0.94;
      } else if(ant.food){
        offY = Math.sin((ant._bobPhase||0)*0.9+idx)*0.5;
        rot = walkSwing*0.03;
      } else if(ant.state==='DESCANSAR'){
        offY = 2.2; rot=0; scaleY=0.92;
      }
      ctx.translate(0, offY);
      ctx.rotate(rot);
      ctx.scale(1, scaleY);
      // respiración sutil
      ctx.translate(0, breath*0.3);
      ctx.imageSmoothingEnabled=false;
      ctx.drawImage(anthroSprite, sx, sy, cellW, cellH, -dw/2, -dh/2+2, dw, dh);
      // sombra dinámica
      const shadowW = ant.state==='CAVANDO'? dw-12 : dw-8;
      ctx.fillStyle='rgba(0,0,0,'+(ant.state==='CAVANDO'?0.22:0.18)+')';
      ctx.fillRect(-shadowW/2, dh/2+1, shadowW, 2+Math.abs(Math.sin(walkPhase))*1.2);
      // antenas wiggle (detalle)
      const antWiggle = Math.sin((ant._bobPhase||0)*1.4+idx*1.7)*1.1;
      ctx.fillStyle='rgba(0,0,0,0.9)';
      // se dibujan sobre el sprite, solo si no está en descanso
      if(ant.state!=='DESCANSAR'){
        ctx.fillRect(-1+antWiggle, -dh/2-2, 1, 3);
        ctx.fillRect(3-antWiggle, -dh/2-2, 1, 3);
      }
      // herramienta de excavadora: pico que balancea
      if(ant.role==='EXCAVADORA' && ant.state==='CAVANDO'){
        ctx.save();
        ctx.translate(10, -2);
        const pickSwing = Math.sin((ant._walkPhase||0)*2.0+idx)*0.9;
        ctx.rotate(pickSwing);
        ctx.fillStyle='#6b3a1f'; ctx.fillRect(0,-2,14,3);
        ctx.fillStyle='#8b9bb4'; ctx.fillRect(12,-5,8,6); ctx.strokeStyle='#000'; ctx.strokeRect(12,-5,8,6);
        ctx.restore();
      }
    } else if(antWalk6Ready && antWalk6.width){
      // SISTEMA EXPERTO 4 SHEETS - walk 6f @110ms (Shovel 6f / Celeste 4f), idle 4f @520ms, dig 4f con hold impacto 200ms, rest 2f @600ms - todo transparente 32x16 grid uniforme
      const dw=30, dh=14;
      if(ant.state==='CAVANDO' && antDigReady && antDig4.width){
        // DIG 4f - cave con hold en golpe (F1 dura 2 unidades de 5) - pesa real como Shovel Knight
        const nF=4, sw=antDig4.width/4, sh=antDig4.height;
        let p=(ant._bobPhase||0)*1.65 + idx*0.9; // per-ant desync, time-based (bobPhase 0.052/tick)
        let cycle=p%5; // 1+2+1+1 =5 - F1 doble duración
        let fIdx=0; if(cycle<1) fIdx=0; else if(cycle<3) fIdx=1; else if(cycle<4) fIdx=2; else fIdx=3;
        // vibración de pico contra tierra (0.6px aleatorio) - peso sin salto de frames
        ctx.translate((Math.random()-0.5)*0.7, (Math.random()-0.5)*0.4);
        ctx.imageSmoothingEnabled=false;
        ctx.drawImage(antDig4, fIdx*sw,0,sw,sh, -dw/2, -dh/2, dw, dh);
      } else if(ant.state==='DESCANSAR' && antRestReady && antRest2.width){
        // REST 2f @600ms - respira tendida, patas recogidas, ojos cerrados
        const nF=2, sw=antRest2.width/2, sh=antRest2.height;
        let p=(ant._bobPhase||0)*0.42 + idx*0.5;
        let fIdx=Math.floor(p % 2);
        ctx.imageSmoothingEnabled=false;
        ctx.scale(1,0.98);
        ctx.drawImage(antRest2, fIdx*sw,0,sw,sh, -dw/2, -dh/2+1, dw, dh);
      } else {
        const moving = ant.state!=='DESCANSAR' && ant.state!=='CAVANDO' && ( (ant._walkPhase||0)>0.08 || ant.state==='BUSCAR' || ant.state==='VOLVER_COMIDA' || ant.state==='VOLVER_TIERRA' || ant.state==='LLEVANDO_BASURA' || ant.state==='EXPLORAR' || ant.state==='TANDEM_LEADER' || ant.state==='TANDEM_FOLLOWER' );
        if(moving){
          // WALK 6f - 32x16 tripod 3.2px + bob 1px ya en sheet, distance-based para que x16 no sea hiperveloz
          // evolución más allá de lo real: GEN≥7 IQ>148 → 90ms super-fluido, GEN6 → 100ms
          let evoMul = (gen>=7 && colonyIQ>148) ? 1.32 : (gen>=6 && colonyIQ>140) ? 1.15 : 1.0;
          const nF=6, sw=antWalk6.width/6, sh=antWalk6.height;
          let phase=(ant._walkPhase||0)*0.88 + idx*0.33;
          let fIdx=Math.floor((phase*1.6*evoMul) % nF);
          let walkSwing=Math.sin(phase)*0.12;
          ctx.rotate(walkSwing*0.025);
          ctx.imageSmoothingEnabled=false;
          ctx.drawImage(antWalk6, fIdx*sw,0,sw,sh, -dw/2, -dh/2, dw, dh);
        } else {
          // IDLE 4f @520ms - respiración volumen constante, antena 0.5px, bob 0.5px ya en sheet
          if(antIdleReady && antIdle4.width){
            const nF=4, sw=antIdle4.width/4, sh=antIdle4.height;
            let p=(ant._bobPhase||0)*0.60 + idx*0.35;
            let fIdx=Math.floor(p % nF);
            ctx.imageSmoothingEnabled=false;
            ctx.drawImage(antIdle4, fIdx*sw,0,sw,sh, -dw/2, -dh/2, dw, dh);
          } else {
            // fallback walk idle 0-1
            const nF=6, sw=antWalk6.width/6, sh=antWalk6.height;
            let fIdx=Math.floor(Math.abs(Math.sin((ant._bobPhase||0)*0.6))*1.2)%2;
            ctx.imageSmoothingEnabled=false;
            ctx.drawImage(antWalk6, fIdx*sw,0,sw,sh, -dw/2, -dh/2, dw, dh);
          }
        }
      }
    } else if(antSpriteReady && antSprite.width){
      const nSprites = 3;
      const sw = antSprite.width / nSprites;
      const sh = antSprite.height;
      let sIdx = 0;
      if(ant.role==='EXCAVADORA') sIdx=1;
      else if(ant.role==='EXPLORADORA') sIdx=2;
      else if(ant.role==='NODRIZA') sIdx=0;
      else sIdx=0;
      const sx = sIdx * sw;
      const dw = 30, dh = 14;
      const walkPhase = (ant._walkPhase||0)*1.12 + idx*0.4;
      const walkSwing = Math.sin(walkPhase)*0.45;
      const bob2 = Math.sin(ant._bobPhase||0)*0.6;
      ctx.translate(0, bob2);
      ctx.rotate(walkSwing*0.05);
      const stepScale = 1 + Math.sin(walkPhase*2)*0.04;
      ctx.scale(1, stepScale);
      ctx.imageSmoothingEnabled=false;
      ctx.drawImage(antSprite, sx, 0, sw, sh, -dw/2, -dh/2, dw, dh);
      // antenas wiggle para hormiga común
      if(ant.state!=='DESCANSAR'){
        const wig = Math.sin((ant._bobPhase||0)*1.6+idx)*0.8;
        ctx.fillStyle='#1a0a00'; ctx.fillRect(-8+wig, -dh/2-1, 1, 2); ctx.fillRect(6-wig, -dh/2-1, 1, 2);
      }
    } else {
      // fallback procedural simple mientras carga
      ctx.fillStyle='#c47a0a'; ctx.fillRect(-14,-5,28,10); ctx.strokeStyle='#000'; ctx.strokeRect(-14,-5,28,10);
      ctx.fillStyle='#000'; ctx.font='8px "Press Start 2P"'; ctx.textAlign='center'; ctx.fillText(ant.role[0],0,2);
    }
    // food - gotita pequeña junto a mandíbula - wobble 0.5px experta viscosa
    if(ant.food){
      let wobX=Math.sin((ant._bobPhase||0)*1.4+idx)*0.5, wobY=Math.sin((ant._walkPhase||0)*1.7+idx)*0.35;
      if(ant.food.isSoil){
        ctx.fillStyle='#6b3a1f'; ctx.fillRect(8+wobX,-10+wobY,8,6); ctx.strokeStyle='#000'; ctx.lineWidth=1; ctx.strokeRect(8+wobX,-10+wobY,8,6);
        ctx.fillStyle='#8b5a2b'; ctx.fillRect(9+wobX,-9+wobY,2,1);
      }else{
        // gotita 6x8
        const col = ant.food.amount>=3 ? '#ffb700' : ant.food.amount===2 ? '#ffcc33' : '#ffda66';
        ctx.fillStyle='#000'; ctx.fillRect(8+wobX,-14+wobY,6,8);
        ctx.fillStyle=col; ctx.fillRect(9+wobX,-13+wobY,4,6);
        ctx.fillStyle='#fff'; ctx.fillRect(9+wobX,-12+wobY,1,2);
        ctx.fillStyle='#ff8c00'; ctx.fillRect(9+wobX,-8+wobY,4,1);
        if(ant.food.amount>1){ ctx.fillStyle='#000'; ctx.font='6px "Press Start 2P"'; ctx.fillText(''+ant.food.amount,11+wobX,-15+wobY); }
      }
    }
    if(ant.fatigue>72){ctx.fillStyle='#00e5ff'; ctx.font='10px "Press Start 2P"'; ctx.textAlign='center'; ctx.fillText('Z', -2,-14);}
    if(ant.state==='CAVANDO'){
      const prog=Math.floor(ant.digProgress/ant.digNeeded*10);
      ctx.fillStyle='#000'; ctx.fillRect(-18,-20,36,6); ctx.strokeStyle='#ff7a00'; ctx.lineWidth=2; ctx.strokeRect(-18,-20,36,6);
      ctx.fillStyle='#ff7a00'; ctx.fillRect(-17,-19, Math.floor(prog*3.4),4);
    }
    ctx.restore();
    // herramienta equipada - realista: mandíbula si no es anthro, mano si ya evolucionó
    if(ant.tool && !isMini){
      if(!useAnthro){
        // fase mandibular: refuerzo en boca, no pala en mano
        const mx = 9, my = -5;
        if(ant.tool==='pick'){
          // mandíbulas reforzadas con piedra
          ctx.fillStyle='#8b9bb4'; ctx.fillRect(mx,my,5,3); ctx.strokeStyle='#000'; ctx.lineWidth=1; ctx.strokeRect(mx,my,5,3);
          ctx.fillStyle='#4a2510'; ctx.fillRect(mx-3,my+1,3,2); // mandíbula base
          ctx.fillStyle='#fff'; ctx.fillRect(mx+1,my+1,1,1);
        } else if(ant.tool==='basket'){
          // cesta mandibular pequeña (hoja)
          ctx.fillStyle='#c2a080'; ctx.fillRect(mx-1,my,6,4); ctx.strokeStyle='#000'; ctx.strokeRect(mx-1,my,6,4);
          ctx.fillStyle='#8b5a2b'; ctx.fillRect(mx-1,my,6,1);
        } else if(ant.tool==='trowel'){
          ctx.fillStyle='#7a7a7a'; ctx.fillRect(mx,my,4,2); ctx.strokeStyle='#000'; ctx.strokeRect(mx,my,4,2);
          ctx.fillStyle='#6b3a1f'; ctx.fillRect(mx-2,my+1,2,1);
        }
      } else {
        const tx=Math.floor(ant.x)+10, ty=Math.floor(ant.y)-16;
        ctx.fillStyle='#000'; ctx.fillRect(tx,ty,12,9); ctx.strokeStyle='#000'; ctx.strokeRect(tx,ty,12,9);
        if(ant.tool==='pick'){
          ctx.fillStyle='#6b3a1f'; ctx.fillRect(tx+2,ty+4,8,2);
          ctx.fillStyle='#8b9bb4'; ctx.fillRect(tx+7,ty+2,5,4); ctx.strokeStyle='#000'; ctx.strokeRect(tx+7,ty+2,5,4);
        } else if(ant.tool==='basket'){
          ctx.fillStyle='#c2a080'; ctx.fillRect(tx+2,ty+3,8,5); ctx.fillStyle='#8b5a2b'; ctx.fillRect(tx+2,ty+3,8,1); ctx.fillRect(tx+2,ty+6,8,1);
          ctx.fillStyle='#fff8dc'; ctx.fillRect(tx+4,ty+4,1,1);
        } else if(ant.tool==='trowel'){
          ctx.fillStyle='#6b3a1f'; ctx.fillRect(tx+2,ty+5,6,2);
          ctx.fillStyle='#7a7a7a'; ctx.fillRect(tx+8,ty+2,4,5); ctx.strokeStyle='#000'; ctx.strokeRect(tx+8,ty+2,4,5);
        }
      }
    }
    // facción y ánimo - puntito de color y barra de vida
    if(!isMini){
      const facCol = society.factions.find(f=>f.id===ant.faction)?.color || '#ffcc00';
      // puntito facción arriba-izq
      ctx.fillStyle=facCol; ctx.fillRect(Math.floor(ant.x)-12, Math.floor(ant.y)-17, 5,5); ctx.strokeStyle='#000'; ctx.lineWidth=1; ctx.strokeRect(Math.floor(ant.x)-12, Math.floor(ant.y)-17,5,5);
      // barra de vida si está herida o vieja
      if(ant.health<95 || ant.age>500){
        const lifePct=Math.max(0, ant.health/100);
        ctx.fillStyle='#000'; ctx.fillRect(Math.floor(ant.x)-10, Math.floor(ant.y)+10, 20,3);
        ctx.fillStyle= lifePct>0.5? '#2de67a' : lifePct>0.25? '#ffcc00' : '#ff3b30';
        ctx.fillRect(Math.floor(ant.x)-10, Math.floor(ant.y)+10, Math.floor(20*lifePct),3);
        // edad como puntitos si es vieja
        if(ant.age>600){
          {
        let ax=ant.x, ay=ant.y+18;
        if(useZoom){
          const left = view.x+20, right=view.x+W/view.zoom-20;
          const top=view.y+8, bottom=view.y+H/view.zoom-8;
          ax=Math.max(left, Math.min(right, ax));
          ay=Math.max(top, Math.min(bottom, ay));
        }
        ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.font='6px "Press Start 2P"'; ctx.textAlign='center'; ctx.fillText((ant.age/DAY_LENGTH).toFixed(1)+'d', ax, ay);
      }
        }
      }
      // indicador de ánimo fuerte
      if(ant.mood.anger>0.62){
        ctx.fillStyle='#ff3b30'; ctx.fillRect(Math.floor(ant.x)+8, Math.floor(ant.y)-16, 3,3);
      } else if(ant.mood.sadness>0.62){
        ctx.fillStyle='#6b7cff'; ctx.fillRect(Math.floor(ant.x)+8, Math.floor(ant.y)-16, 3,3);
      } else if(ant.mood.joy>0.72){
        ctx.fillStyle='#2de67a'; ctx.fillRect(Math.floor(ant.x)+8, Math.floor(ant.y)-16, 3,3);
      }
      // si es de culto, estrellita
      if(ant.belief){
        ctx.fillStyle='#b47aff'; ctx.font='8px "Press Start 2P"'; ctx.textAlign='center'; ctx.fillText('✡', ant.x, ant.y-22);
      }
    }
    // BUBBLE - mini iconito pegado al costado (no tapa cuando se aglomeran)
    if(!isMini){
      const _roleCol = ant.role==='EXCAVADORA' ? '#ff3b30' : ant.role==='EXPLORADORA' ? '#00e5ff' : ant.role==='NODRIZA' ? '#b47aff' : '#ffcc00';
      let icon="·", col="#1a1a1a", tcol="#fff8dc", bcol=_roleCol;
      let hasLang=false;
      if(ant.lastPhrase && ant.phraseTime>0 && ant.lastPhrase!==''){
        const lang=getLanguage(ant.faction);
        if(lang.stage!=='feromonas' && lang.fluency>=0.16){
          icon="🗣️"; col='#1a1030'; tcol='#d8b4ff'; bcol='#b47aff';
          ant.phraseTime--; hasLang=true;
        } else { ant.phraseTime=0; }
      }
      if(!hasLang){
        if(ant.state==='CAVANDO' && (workers.filter(w=>w.state==='CAVANDO').length<=3 || ant.selected)){ 
          // Topo - si hay >3 cavando, no llover ⛏ individuales; se resume abajo en el strip
          const digCount = (typeof workers!=='undefined'? workers.filter(w=>w.state==='CAVANDO').length : 0);
          if(digCount>3 && !ant.selected){ icon=""; col=''; } else { icon="⛏"; col='#2a0a0a'; tcol='#ff9a6e'; bcol='#ff3b30'; }
        }
        else if(ant.food && !ant.food.isSoil){ icon="🍯"; col='#0a1f0a'; tcol='#86efac'; bcol='#2de67a'; }
        else if(ant.food && ant.food.isSoil){ icon="🪨"; col='#1f1405'; tcol='#ffcc00'; bcol='#ffcc00'; }
        else if(ant.state==='DESCANSAR'){ icon="💤"; col='#0a1a22'; tcol='#7dd3ff'; bcol='#00e5ff'; }
        else if(ant.state==='VOLVER_COMIDA'){ icon="🏠"; col='#0a1f14'; tcol='#86efac'; bcol='#2de67a'; }
        else if(Math.abs(ant.commOut[0])>0.55){ icon=symbolForComms(ant.commOut[0],ant.commOut[1]); col='#0a1a22'; tcol='#7dd3ff'; bcol='#00e5ff'; }
        else if(ant.sensors.pheroStr>0.3){ icon="👃"; col='#1a1030'; tcol='#d8b4ff'; bcol='#b47aff'; }
        else if(ant.sensors.foodDist>0.35){ icon="🔍"; col='#1a1a05'; tcol='#ffdd57'; bcol='#ffcc00'; }
        else { icon="·"; col='#1a1a1a'; tcol='#8a7a5a'; bcol='#3a2a1a'; }
      }
      // iconito 11x11 pegado al costado, no encima centrado - no tapa
      const zoom = useZoom ? view.zoom : 1;
      const iconS = 11;
      let ix = ant.x + 13, iy = ant.y - 11;
      // si está trepando vertical, lo ponemos al costado del cuerpo (rota con ella)
      if(ant._climbing){ ix = ant.x + 10; iy = ant.y - 8; }
      if(useZoom){
        const pad=6/zoom;
        const left = view.x + iconS/zoom + pad;
        const right = view.x + W/zoom - iconS/zoom - pad;
        const top = view.y + iconS/zoom + pad;
        const bottom = view.y + H/zoom - iconS/zoom - pad;
        ix = Math.max(left, Math.min(right, ix));
        iy = Math.max(top, Math.min(bottom, iy));
        ctx.fillStyle='#000'; ctx.fillRect(ix-1, iy-1, (iconS+2)/zoom, (iconS+2)/zoom);
        ctx.fillStyle=col; ctx.fillRect(ix, iy, iconS/zoom, iconS/zoom);
        ctx.strokeStyle=bcol; ctx.lineWidth=Math.max(1,1.5/zoom); ctx.strokeRect(ix, iy, iconS/zoom, iconS/zoom);
        ctx.fillStyle=tcol; ctx.font=`${Math.max(7,9/zoom)}px monospace`; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(icon, ix+iconS/2/zoom, iy+iconS/2/zoom+0.5);
        // progreso: barrita que se llena según acción (cavando / llevando / durmiendo)
        let _p=null;
        if(ant.state==='CAVANDO' && ant.digNeeded>0) _p=Math.max(0,Math.min(1, ant.digProgress/ant.digNeeded));
        else if(ant.state==='DESCANSAR') _p=Math.max(0,Math.min(1, 1 - (ant.fatigue-12)/88));
        else if(ant.food && !ant.food.isSoil){ const d=Math.hypot(ant.x-storagePos().x, ant.y-storagePos().y); _p=Math.max(0,Math.min(1,1-d/180)); }
        else if(ant.food && ant.food.isSoil){ const tgt=ant.buildTarget||ant.wasteTarget; if(tgt){ const d=Math.hypot(ant.x-(tgt.c*CELL+8), ant.y-(tgt.r*CELL+8)); _p=Math.max(0,Math.min(1,1-d/120)); } }
        else if(ant.state==='VOLVER_TIERRA' && ant.wasteTarget){ const d=Math.hypot(ant.x-(ant.wasteTarget.c*CELL+8), ant.y-(ant.wasteTarget.r*CELL+8)); _p=Math.max(0,Math.min(1,1-d/120)); }
        if(_p!==null){
          const barH=2/zoom, barY= iy + (iconS-2)/zoom;
          ctx.fillStyle='rgba(0,0,0,0.65)'; ctx.fillRect(ix+1/zoom, barY, (iconS-2)/zoom, barH);
          ctx.fillStyle=bcol; ctx.fillRect(ix+1/zoom, barY, (iconS-2)/zoom*_p, barH);
          if(_p>0.92){ ctx.fillStyle='#fff'; ctx.fillRect(ix+1/zoom + (iconS-2)/zoom*_p -1/zoom, barY, 1/zoom, barH); }
        }
      } else {
        ix = Math.max(iconS+4, Math.min(W - iconS -4, ix));
        iy = Math.max(iconS+4, Math.min(H - iconS -4, iy));
        ctx.fillStyle='#000'; ctx.fillRect(ix-1, iy-1, iconS+2, iconS+2);
        ctx.fillStyle=col; ctx.fillRect(ix, iy, iconS, iconS); ctx.strokeStyle=bcol; ctx.lineWidth=1; ctx.strokeRect(ix, iy, iconS, iconS);
        ctx.fillStyle=tcol; ctx.font='9px monospace'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(icon, ix+iconS/2, iy+iconS/2+0.5);
        let _p2=null;
        if(ant.state==='CAVANDO' && ant.digNeeded>0) _p2=Math.max(0,Math.min(1, ant.digProgress/ant.digNeeded));
        else if(ant.state==='DESCANSAR') _p2=Math.max(0,Math.min(1, 1 - (ant.fatigue-12)/88));
        else if(ant.food && !ant.food.isSoil){ const d=Math.hypot(ant.x-storagePos().x, ant.y-storagePos().y); _p2=Math.max(0,Math.min(1,1-d/180)); }
        else if(ant.food && ant.food.isSoil){ const tgt=ant.buildTarget||ant.wasteTarget; if(tgt){ const d=Math.hypot(ant.x-(tgt.c*CELL+8), ant.y-(tgt.r*CELL+8)); _p2=Math.max(0,Math.min(1,1-d/120)); } }
        else if(ant.state==='VOLVER_TIERRA' && ant.wasteTarget){ const d=Math.hypot(ant.x-(ant.wasteTarget.c*CELL+8), ant.y-(ant.wasteTarget.r*CELL+8)); _p2=Math.max(0,Math.min(1,1-d/120)); }
        if(_p2!==null){
          const barH=2, barY= iy + iconS -2;
          ctx.fillStyle='rgba(0,0,0,0.65)'; ctx.fillRect(ix+1, barY, iconS-2, barH);
          ctx.fillStyle=bcol; ctx.fillRect(ix+1, barY, (iconS-2)*_p2, barH);
          if(_p2>0.92){ ctx.fillStyle='#fff'; ctx.fillRect(ix+1 + (iconS-2)*_p2 -1, barY, 1, barH); }
        }
      }
      if(ant.selected){
        // clamp selected HUD - usa iconito como ancla, no burbuja vieja
        let sx=ix, sy=iy-18;
        if(useZoom){
          const left2=view.x+44+4, right2=view.x+W/view.zoom-44-4;
          sx = Math.max(left2, Math.min(right2, ix));
        }
        ctx.fillStyle='#000'; ctx.fillRect(sx-44, sy, 88, 10); ctx.strokeStyle='#ffcc00'; ctx.lineWidth=2; ctx.strokeRect(sx-44, sy, 88,10);
        ctx.fillStyle='#ff3b30'; ctx.font='6px "Press Start 2P"'; ctx.fillText(`◉${(ant.sensors?.wallLeft ?? 0).toFixed(1)}`, sx-20, sy+6);
        ctx.fillStyle='#ffcc00'; ctx.fillText(`◉${(ant.sensors?.wallCenter ?? 0).toFixed(1)}`, sx, sy+6);
        ctx.fillStyle='#00e5ff'; ctx.fillText(`◉${(ant.sensors?.wallRight ?? 0).toFixed(1)}`, sx+20, sy+6);
        ctx.fillStyle='#fff'; ctx.font='7px "Press Start 2P"'; ctx.fillText(ant.id, sx, sy-10);
      }
    }
  });
  // toasts pixel
  if(!isMini){
    for(let t of toasts){
      ctx.globalAlpha=t.life*0.95;
      const w2 = t.txt.length*7 + 20;
      let tx=Math.floor(t.x), ty=Math.floor(t.y);
      if(useZoom){
        const left = view.x + w2/2 + 6, right = view.x + W/view.zoom - w2/2 - 6;
        const top = view.y + 10, bottom = view.y + H/view.zoom - 10;
        tx = Math.max(left, Math.min(right, tx));
        ty = Math.max(top, Math.min(bottom, ty));
      } else {
        tx = Math.max(w2/2+6, Math.min(W - w2/2 -6, tx));
        ty = Math.max(10, Math.min(H-10, ty));
      }
      ctx.fillStyle='#000'; ctx.fillRect(tx-w2/2+2, ty-10+2, w2, 16);
      ctx.fillStyle=t.color; ctx.fillRect(tx-w2/2, ty-10, w2, 14); ctx.strokeStyle='#000'; ctx.lineWidth=3; ctx.strokeRect(tx-w2/2, ty-10, w2,14);
      ctx.fillStyle='#000'; ctx.font='7px "Press Start 2P"'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(t.txt, tx, ty-2);
      ctx.globalAlpha=1;
    }
  }
  for(let p of particles){ctx.globalAlpha=p.life; ctx.fillStyle=p.color; ctx.fillRect(Math.floor(p.x)-2,Math.floor(p.y)-2,4,4); ctx.strokeStyle='#000'; ctx.lineWidth=1; ctx.strokeRect(Math.floor(p.x)-2,Math.floor(p.y)-2,4,4);}
  ctx.globalAlpha=1;
  // clima lluvia/relámpago
  if(!isMini && (weather.type==='rain' || weather.type==='storm')){
    ctx.fillStyle= weather.type==='storm'? 'rgba(30,40,60,0.22)' : 'rgba(40,50,70,0.12)';
    ctx.fillRect(0,0,W,H);
    ctx.strokeStyle= weather.type==='storm'? 'rgba(160,190,255,0.9)' : 'rgba(160,190,255,0.65)'; ctx.lineWidth=1;
    for(let rp of weather.rainParticles){
      const rx=Math.floor(rp.x), ry=Math.floor(rp.y);
      ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx-1, ry+7); ctx.stroke();
      ctx.fillStyle='rgba(255,255,255,0.6)'; ctx.fillRect(rx, ry+3,1,1);
    }
    if(lightningTimer>0){
      const flashAlpha = lightningTimer>7? 0.45 : lightningTimer>3? 0.22 : 0.08;
      ctx.fillStyle=`rgba(255,255,220,${flashAlpha})`; ctx.fillRect(0,0,W,H);
      if(lightningTimer>8){
        ctx.strokeStyle='rgba(255,255,200,0.9)'; ctx.lineWidth=2;
        const lx=W*0.3 + Math.random()*W*0.4;
        ctx.beginPath(); ctx.moveTo(lx,0); ctx.lineTo(lx+8, 40); ctx.lineTo(lx-4, 80); ctx.lineTo(lx+6, SURFACE_Y); ctx.stroke();
      }
    }
  }
  if(useZoom) ctx.restore();
  if(!isMini){
    const grad=ctx.createRadialGradient(W/2,H/2, Math.min(W,H)*0.5, W/2,H/2, Math.max(W,H)*0.9);
    grad.addColorStop(0,'rgba(0,0,0,0)'); grad.addColorStop(1,'rgba(0,0,0,0.18)');
    ctx.fillStyle=grad; ctx.fillRect(0,0,W,H);
  }
  ctx.strokeStyle='#000';ctx.lineWidth=6;ctx.strokeRect(0,0,W,H);
}
function adjust(hex,amt){const c=parseInt(hex.slice(1),16);let r=(c>>16)+amt,g=((c>>8)&255)+amt,b=(c&255)+amt;r=Math.max(0,Math.min(255,r));g=Math.max(0,Math.min(255,g));b=Math.max(0,Math.min(255,b));return `rgb(${r},${g},${b})`;}

let last=performance.now();
let lastRealWall=Date.now();
let lastSpawn=0;
let _lastSaveReal=Date.now();
// offline catch-up at startup: if page was closed, advance time based on real time
try{
  const savedAt = parseInt(localStorage.getItem('antfarm_lastReal')||'0',10);
  const savedTime = parseFloat(localStorage.getItem('antfarm_time')||'NaN');
  if(savedAt && !isNaN(savedTime) && Date.now()-savedAt < 86400000*7){
    const offlineMs = Date.now()-savedAt;
    const offlineDt = offlineMs*0.06*1.0; // at x1
    const maxOffline = DAY_LENGTH*2.2; // max 2.2 días offline
    const add = Math.min(offlineDt, maxOffline);
    if(add> DAY_LENGTH*0.02){
      time+=add;
      tlog('[offline] +'+(add/DAY_LENGTH).toFixed(2)+'d por '+Math.floor(offlineMs/1000)+'s fuera');
      // que no parezca trampa: notificar
      setTimeout(()=>{ try{ pushEvent('evo','⏳ Tiempo offline '+(add/DAY_LENGTH).toFixed(2)+'d','La colonia siguió mientras no mirabas'); }catch(e){} }, 900);
    }
  }
}catch(e){}
function tickStep(dt){
  if(paused) return;
  time+=dt;
    // día y clima - todo escala con el día, no va más rápido que el sol
    day = Math.floor(time / DAY_LENGTH) + 1;
    // Topo: antes esto corria en CADA tick (60/s de lecturas y escrituras de DOM). updateColonyUI ya lo llama throttled.
    const gameHour = (time % DAY_LENGTH) / DAY_LENGTH * 24;
    isNight = gameHour < 5.5 || gameHour > 19.5;
    // clima realista: cambia cada 3-5h de juego
    weather.timer+=dt;
    if(weather.timer > weather.nextChange){
      weather.timer=0; weather.nextChange= DAY_LENGTH*(0.18+Math.random()*0.16);
      const r=Math.random();
      const season = Math.floor((day/12)%4); // 0 primavera,1 verano,2 otoño,3 invierno
      if(r<0.62) weather.type='clear';
      else if(r<0.78) weather.type='cloudy';
      else if(r<0.92) weather.type='rain';
      else weather.type='storm';
      weather.intensity = weather.type==='rain'? 0.5+Math.random()*0.5 : weather.type==='storm'? 0.85+Math.random()*0.15 : 0;
      if(weather.type==='storm') lightningTimer= 40+Math.random()*120;
      // en invierno más lluvia
      if(season===3 && Math.random()<0.3) { weather.type='rain'; weather.intensity=0.6; }
    }
    // partículas de lluvia con gravedad real - Topo fix: cubre TODO el cielo sincronizado, no solo -12
    if(weather.type==='rain' || weather.type==='storm'){
      const count = weather.type==='storm'? 6:3;
      for(let i=0;i<count;i++) weather.rainParticles.push({x:Math.random()*W, y: -H*1.8 + Math.random()* (H*1.8 + SURFACE_Y + 24), vx:-0.8+Math.random()*0.6, vy:2+Math.random()*2, life:1, vy0:2+Math.random()*2});
    }
    if(weather.rainParticles.length>280) weather.rainParticles.splice(0, weather.rainParticles.length-280);
    for(let i=weather.rainParticles.length-1;i>=0;i--){
      const rp=weather.rainParticles[i];
      // gravedad real
      rp.vy += 0.52;
      rp.x += rp.vx;
      rp.y += rp.vy;
      // colisión con pasto/suelo: si toca superficie sólida, rebota/salpicadura y muere
      const col = Math.floor(rp.x/CELL);
      const rowSurface = SURFACE_ROW;
      // si está sobre el cielo, sigue; si llega al pasto
      if(rp.y >= SURFACE_Y - 4){
        // ¿hay hueco (túnel abierto) debajo? si soil es 0, la gota cae por el hueco y sigue dentro del túnel hasta el fondo
        const r = Math.floor(rp.y/CELL);
        const isHole = (col>=0&&col<COLS && r>=SURFACE_ROW && r<ROWS && soil[r] && soil[r][col]===0);
        const isSolidBelow = !isHole && rp.y >= SURFACE_Y - 2;
        if(isSolidBelow){
          // salpicadura en pasto firme
          particles.push({x:rp.x, y:SURFACE_Y-2, vx:(Math.random()-0.5)*1.2, vy:-1.2-Math.random()*1.0, life:1, decay:0.08, color:'#7ec8e3'});
          // charco temporal que ayuda a ablandar tierra (bonus de excavación)
          if(Math.random()<0.12) mound.push({x:rp.x, y:SURFACE_Y-1, h:1, isPuddle:true, life:  DAY_LENGTH*0.08});
          weather.rainParticles.splice(i,1);
          continue;
        }
        // si es hueco, deja que caiga dentro del túnel hasta encontrar suelo de túnel
        if(isHole){
          // buscar suelo de túnel debajo
          let foundFloor=false;
          for(let rr=r; rr<ROWS; rr++){
            if(soil[rr][col]===1){ // suelo sólido del túnel
              if(rp.y >= rr*CELL -2){
                particles.push({x:rp.x, y:rr*CELL-2, vx:(Math.random()-0.5)*0.8, vy:-0.8, life:0.9, decay:0.09, color:'#a0d8ff'});
                foundFloor=true;
                break;
              }
            }
          }
          if(foundFloor){ weather.rainParticles.splice(i,1); continue; }
        }
      }
      // viento leve y gravedad lateral
      rp.vx += (Math.sin(time*0.02 + rp.x*0.01)*0.02);
      if(rp.y>H+20 || rp.x< -W*0.6 || rp.x> W*1.6) weather.rainParticles.splice(i,1);
      // limitar velocidad terminal
      if(rp.vy> 14) rp.vy=14;
    }
    // charcos se evaporan y ablandan: si hay puddle, reduce digNeeded cercano
    for(let i=mound.length-1;i>=0;i--){
      const m=mound[i];
      if(m.isPuddle){
        m.life = (m.life|| DAY_LENGTH*0.08) - 1*gameSpeed;
        if(m.life<=0) mound.splice(i,1);
      }
    }
    if(lightningTimer>0) lightningTimer-=dt;
    else if(weather.type==='storm' && Math.random()<0.0015) lightningTimer= 10;

    // throttling en x16 para no congelar
    const fast = gameSpeed>7;
    const tickId = (window._tickId=(window._tickId||0)+1);
    const doFalling = !fast || (tickId%3===0);
    const doEco = !fast || (tickId%8===0);
    const doFungus = !fast || (tickId%6===0);
    updateQueen(dt); updateBrood(dt);
    try{
      if(doFungus) updateFungus(dt);
      if(doFalling) try{ updateFallingSand(dt*0.42); }catch(e){}
      if(doEco) try{ checkWorldExpansion(); }catch(e){}
    }catch(e){ console.error('fungus',e); }
    try{ if(doEco) updateWaste(dt); }catch(e){ console.error('waste',e); }
    try{ if(doEco) updateEcosystem(dt); }catch(e){ console.error('eco',e); }
    // ===== ANTI-EXTINCIÓN ESTILO MINECRAFT - nunca te quedas a 0 =====
    // 1) Anti-extinción mejorado: si quedan 0-2 obreras, reina entra en CRÍA DE EMERGENCIA ACELERADA (0.20d clutch 2)
    const _rescueMode = workers.length<=2 && queens.length>0;
    const _emThresh = _rescueMode ? DAY_LENGTH*0.20 : DAY_LENGTH*0.55;
    if(workers.length<=2 && queens.length>0 && brood.filter(b=>b.type==='egg').length<4){
      queens.forEach(q=>{
        q.emergencyProgress=(q.emergencyProgress||0)+dt;
        if(q.emergencyProgress > _emThresh){
          q.emergencyProgress=0;
          q.health=Math.max(8, q.health - (_rescueMode? 8:12));
          // clutch: 2 huevos si rescate, 1 si normal
          const _clutch = _rescueMode ? 2 : 1;
          for(let _c=0;_c<_clutch;_c++){
            const g=mutateGenome(q.genome,0.12,0.5).genome;
            brood.push({type:'egg', progress:0, genome:g, time:0, isQueen:false, faction:q.faction, parents:[q.name||q.id,'emergencia'], parentGenomes:[q.genome.id,'-']});
          }
          pushEvent('birth',_rescueMode? '🆘 ¡CLUTCH de emergencia! Reina pone 2 huevos (rescate)':'🆘 Huevo de emergencia - la reina sacrifica vida',_rescueMode? 'Rescate activo: 1-2 hormigas → turbo + doble puesta':'Colonia al límite - Minecraft: nunca 0');
          notifyCanon(_rescueMode?'🆘 CLUTCH RESCATE':'🆘 HUEVO EMERGENCIA', _rescueMode?'¡Doble puesta! La colonia no muere':'La reina sacrifica vida para no extinguirse', 5200);
          pushToast(q.x,q.y-24,_rescueMode?'🆘x2 RESCATE':'🆘 EMERGENCIA','#ff3b30');
          setNarration(_rescueMode? `<b>¡Rescate!</b> ${q.name} pone 2 huevos - turbo activado`:`<b>¡Emergencia!</b> ${q.name} pone sin miel - la colonia no muere.`);
        }
      });
    } else {
      queens.forEach(q=> q.emergencyProgress=0);
    }
    // 2) Sin reina pero con obreras: coronación garantizada tras 0.22 día (~4.4 min)
    if(queens.length===0 && workers.length>0){
      let larva=brood.find(b=>b.type==='larva');
      if(larva && !larva.isQueen){ larva.isQueen=true; pushEvent('evo','👑 Larva coronada (rescate)','Anti-extinción: nueva reina asegurada');
          notifyCanon('👑 LARVA CORONADA', 'Una larva es coronada reina de emergencia', 5200); }
      else if(!larva){
        window._queenlessTime=(window._queenlessTime||0)+dt;
        if(window._queenlessTime > DAY_LENGTH*0.22){
          window._queenlessTime=0;
          const cand=workers.filter(w=>w.role==='NODRIZA').sort((a,b)=>b.mood.loyalty-a.mood.loyalty)[0] || [...workers].sort((a,b)=>b.fitness-a.fitness)[0];
          if(cand){
            let _qn3=genPersonalName({faction:cand.faction, role:'REINA', affinity:'NODRIZA', caste:'media', parents:[], genome:cand.genome, isQueen:true, rank:'LÍDER', ageDays:0, idCode:'Q'+(queens.length+1)+'-'+Math.random().toString(36).slice(2,4).toUpperCase()});
              queens.push(ensureQueenMeta({x:cand.x,y:cand.y, genome:cand.genome, progress:0, state:'GRÁVIDA', age:0, maxAge: getQueenMaxAge(), generation:gen+1, faction:cand.faction, health:85, name:_qn3.name, personalName:_qn3.name, nameMeaning:_qn3.meaning, nameStage:_qn3.stage, id:'Q'+Math.random().toString(36).slice(2,5).toUpperCase(), eggsLaid:0, children:[], history:[]}));
            workers.splice(workers.indexOf(cand),1);
            if(queens.length>0) queen=queens[0];
            pushEvent('birth','👑 '+cand.id+' se convierte en reina (rescate)','Última reina muerta → nodriza asciende');
            notifyCanon('👑 ASCENSO', `${cand.id} asciende a reina - la colonia sobrevive`, 5600);
            pushToast(cand.x,cand.y-18,'👑 NUEVA REINA','#b47aff',3);
            setNarration(`<b>${cand.id}</b> asciende a reina - la colonia sigue viva.`);
          }
        }
      }
    } else window._queenlessTime=0;
    // 3) Nada de nada pero queda cría: acelerar x2.5
    if(queens.length===0 && workers.length===0 && brood.length>0){
      brood.forEach(b=> b.progress+= dt*0.0042); // más lento
    }
    // 4) Inmigración Minecraft: si <3 obreras, cada ~1.1 días llega forastera 45%
    window._immigTimer=(window._immigTimer||0)+dt;
    if(workers.length<3 && queens.length>0 && brood.length<2){
      if(window._immigTimer> DAY_LENGTH*1.1){
        window._immigTimer=0;
        if(Math.random()<0.45){
          const g=mutateGenome(queens[0].genome,0.22,0.7).genome;
          const ant=makeAnt(g,{x: Math.random()<0.5? 24: W-24, y:SURFACE_Y-6},{faction:queens[0].faction});
          ant.age= DAY_LENGTH*0.35;
          workers.push(ant);
          pushEvent('evo','🚶 Inmigrante '+ant.id+' se une','Rescate poblacional - Minecraft respawn');
          notifyCanon('🚶 INMIGRANTE', `${ant.id} llega de fuera - la colonia no se extingue`, 5200);
          pushToast(ant.x,ant.y-16,'🚶 INMIGRANTE','#00e5ff');
        }
      }
    } else if(workers.length>=3) window._immigTimer=0;
    // 5) Comida de rescate: si 0 comida y 0 honey en mapa durante 0.75 día (~15 min)
    window._foodlessTimer=(window._foodlessTimer||0)+dt;
    if(foods.length===0 && colonyFood===0 && workers.length>0){
      if(window._foodlessTimer> DAY_LENGTH*0.75){
        window._foodlessTimer=0;
        spawnFoodSurface(CENTER_COL*CELL+8 + (Math.random()-0.5)*260,1);
        spawnFoodSurface(CENTER_COL*CELL+8 + (Math.random()-0.5)*260,1);
        pushEvent('evo','🍯 Comida salvaje brota','La naturaleza evita extinción');
          notifyCanon('🍯 RESCATE', 'Brota comida salvaje - la naturaleza ayuda', 5000);
      }
    } else if(foods.length>0 || colonyFood>0) window._foodlessTimer=0;

    // envejecimiento y muerte por vejez / hambre
    for(let i=workers.length-1;i>=0;i--){
      const w=workers[i];
      w.age+=dt;
      updateMood(w, dt);
      // vejez
      if(w.age > w.maxAge){
        if(Math.random()<0.008) handleDeath(w,'vejez');
        else { w.health-=0.04*dt; if(w.health<=0) handleDeath(w,'vejez'); }
        continue;
      }
      // hambre extrema
      // RESCATE: con 1-2 hormigas, no mueren de hambre el primer día de hambruna y trabajan 1.5x (polivalente)
      if(workers.length<=2){ w._rescueTurbo = 1.5; w.health = Math.min(100, w.health+0.02); } else { w._rescueTurbo = 1; }
      if(colonyFood===0 && w.age>300 && Math.random()<(workers.length<=2?0.00018:0.0006)) { w.health-=0.8; if(w.health<=0 && workers.length>2) handleDeath(w,'hambre'); else if(w.health<=0) w.health=8; }
      // depresión severa puede llevar a muerte
      if(w.mood.sadness>0.92 && w.mood.joy<0.12 && Math.random()<0.0004) handleDeath(w,'tristeza');
    }
    // actualizar cada hormiga (si sigue viva)
    for(let w of [...workers]) updateAnt(w, dt);
    updateSociety(dt);
    // estructuras: construcción progresiva poco a poco ~4s reales (expert: sin salto)
    for(let s of structures){ s.age=(s.age||0)+dt; if(s.buildProgress===undefined) s.buildProgress=0; s.buildProgress=Math.min(1, (s.age)/(DAY_LENGTH*0.007)); }
    // --- despensa y cámara real emergentes: las ingenieras deciden ---
    _pantryTimer+=dt;
    if(_pantryTimer> DAY_LENGTH*0.12){ // cada ~0.12 día (~2.4 min) reevalúa mejor cámara
      _pantryTimer=0;
      const best=findLargestChamber();
      if(best && best.size>=10){
        // si la mejor cámara es >=30% más grande que la actual y está a >40px, migra despensa (las obreras la mudan)
        const curCells= (()=>{
          let cnt=0; for(let dy=-2;dy<=2;dy++) for(let dx=-3;dx<=3;dx++){ const cc=Math.floor(pantryPos.x/CELL)+dx, rr=Math.floor(pantryPos.y/CELL)+dy; if(rr>=SURFACE_ROW&&rr<ROWS&&cc>=0&&cc<COLS&&soil[rr][cc]===0) cnt++; }
          return cnt;
        })();
        const dist=Math.hypot(best.x-pantryPos.x, best.y-pantryPos.y);
        if(best.size > curCells*1.3 && dist>40){
          // migración gradual
          pantryPos.x += (best.x - pantryPos.x)*0.22;
          pantryPos.y += (best.y - pantryPos.y)*0.22;
          pushEvent('evo', `🏗 Despensa migrada hacia [${Math.floor(best.x/CELL)},${Math.floor(best.y/CELL)}]`, `Cámara ${best.size} celdas - votado por constructoras`);
          notifyCanon('🏗 DESPENSA MÓVIL', `Las arquitectas mudan la despensa a cámara más amplia`, 4800);
          for(let i=0;i<8;i++) particles.push({x:pantryPos.x,y:pantryPos.y,vx:(Math.random()-0.5)*2,vy:-Math.random()*1.5,life:1,decay:0.02,color:'#00e5ff'});
        } else {
          // pequeño ajuste hacia el centro de la mejor cámara
          pantryPos.x += (best.x - pantryPos.x)*0.04;
          pantryPos.y += (best.y - pantryPos.y)*0.04;
        }
      }
    }
    // reina puede reubicarse si la cámara actual es pequeña y hay una mejor a >50px
    _queenMoveTimer+=dt;
    if(_queenMoveTimer> DAY_LENGTH*0.28 && queens.length===1){
      _queenMoveTimer=0;
      const best=findLargestChamber();
      if(best && best.size>=14){
        let qCells=0; for(let dy=-2;dy<=2;dy++) for(let dx=-3;dx<=3;dx++){ const cc=Math.floor(queen.x/CELL)+dx, rr=Math.floor(queen.y/CELL)+dy; if(rr>=SURFACE_ROW&&rr<ROWS&&cc>=0&&cc<COLS&&soil[rr][cc]===0) qCells++; }
        const qDist=Math.hypot(best.x-queen.x, best.y-queen.y);
        if(best.size > qCells*1.5 && qDist>52){
          // la reina camina lentamente hacia la nueva cámara (arquitectas la guían)
          queen.x += Math.sign(best.x-queen.x)*0.7*gameSpeed;
          queen.y += Math.sign(best.y-queen.y)*0.7*gameSpeed;
          if(Math.hypot(best.x-queen.x,best.y-queen.y)<18){
            queen.x=best.x; queen.y=best.y;
            pushEvent('evo', `👑 Reina relocada a [${Math.floor(best.x/CELL)},${Math.floor(best.y/CELL)}]`, `Cámara ${best.size} - ingeniería colectiva`);
            notifyCanon('👑 CÁMARA REAL', `La reina se muda a palacio más amplio y bonito`, 5200);
          }
        }
      }
    }
    renderSociety();
    for(let i=pheromones.length-1;i>=0;i--){ const t=pheromones[i].type||'recruit'; const dec = t==='explore'? 0.0011 : 0.0032; pheromones[i].life-=dec; pheromones[i].strength=pheromones[i].life * (t==='explore'?0.62:1); if(pheromones[i].life<=0) pheromones.splice(i,1);}
    if(pheromones.length>200) pheromones.splice(0, pheromones.length-200);
    if(gameSpeed>8 && pheromones.length>130) pheromones.splice(0, pheromones.length-130);
    for(let i=commInks.length-1;i>=0;i--){commInks[i].life-=commInks[i].decay*gameSpeed; if(commInks[i].life<=0) commInks.splice(i,1);}
    for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.x+=p.vx;p.y+=p.vy;p.vy+=0.07;p.life-=p.decay;if(p.life<=0) particles.splice(i,1);}
    if(particles.length>240) particles.splice(0, particles.length-240);
    if(gameSpeed>8 && particles.length>160) particles.splice(0, particles.length-160);
    for(let i=toasts.length-1;i>=0;i--){const t=toasts[i]; t.life-=t.decay; t.y+=t.vy*gameSpeed; if(t.life<=0) toasts.splice(i,1);}
    // FÍSICA MIEL - gravedad: si está en el cielo cae hasta tocar suelo o superficie (Topo reportó miel flotando)
    for(let i=foods.length-1;i>=0;i--){
      const f=foods[i];
      if(f.grounded) continue;
      if(f.y < SURFACE_Y-6){
        f.vy = (f.vy||0) + 0.38*dt*0.6;
        f.y += f.vy*dt*0.08;
        if(f.y >= SURFACE_Y-8){ f.y=SURFACE_Y-8; f.vy=0; f.grounded=true; }
      } else {
        // bajo tierra: verificar si hay suelo sólido debajo
        const col=Math.floor(f.x/CELL), row=Math.floor(f.y/CELL);
        if(row>=0 && row<ROWS-1 && col>=0 && col<COLS && soil[row+1] && soil[row+1][col]===1){
          f.grounded=true; f.vy=0;
        } else if(f.y < H-10){
          f.vy = (f.vy||0) + 0.38*dt*0.6;
          f.y += f.vy*dt*0.08;
          // tope suelo del mundo
          if(f.y>H-12){ f.y=H-12; f.vy=0; f.grounded=true; }
        } else { f.grounded=true; }
      }
    }
    // COMIDA REALISTA - Dwarf Fortress + leyes reales: se pudre si no está en almacén/granero, semillas/miel no
    for(let i=foods.length-1;i>=0;i--){
      const f=foods[i]; const def=FOOD_DEFS[f.ftype||'honey']||FOOD_DEFS.honey;
      if(def.rotDays>=90){ f.fresh=1; continue; }
      const preserved=isFoodInStockpile(f);
      const inc = (preserved? 0.12 : 1.0) * dt / (def.rotDays * DAY_LENGTH);
      f.rot = Math.min(1, (f.rot||0)+inc);
      f.fresh = 1 - f.rot;
      if(f.rot>=1){
        // podrido: miasma DF + partícula + abono desperdicio
        for(let k=0;k<7;k++) particles.push({x:f.x, y:f.y, vx:(Math.random()-0.5)*1.6, vy:-Math.random()*1.4-0.3, life:1, decay:0.045, color: f.ftype==='berry'? '#7a3a8a' : f.ftype==='mushroom'? '#8b5a2b' : '#6b4a1a'});
        wastePiles.push({x:f.x, y:f.y, age:0});
        // estrés a hormigas cercanas (miasma DF)
        for(let w of workers){ if(Math.hypot(w.x-f.x,w.y-f.y)<36) w.mood.stress=Math.min(1,w.mood.stress+0.07); }
        if(Math.random()<0.28) pushEvent('death','☠️ '+def.name+' podrida en ['+Math.floor(f.x/CELL)+','+Math.floor(f.y/CELL)+']','No estaba en granero/despensa - Dwarf Fortress stockpile');
        foods.splice(i,1);
      }
    }
    colonyFitness= workers.reduce((s,w)=>s+w.fitness,0)/Math.max(1,workers.length) + Math.min(7, deliveries*0.048 + Math.log2((deliveries||1)+1)*0.55); // tope 7, no escala infinita
    const _fCap=surfaceFoodCap(), _fW=Math.round(260*worldAreaRatio()); // Topo: la pradera rinde según lo que quepa en el mapa
    if(time-lastSpawn> DAY_LENGTH*0.035 && foods.length<_fCap){ // ~0.84h juego = 2.5 min real, Minecraft respawn
      spawnFoodSurface(CENTER_COL*CELL+8 + (Math.random()-0.5)*_fW,Math.random()<0.15?2:1); lastSpawn=time;
    } else if(time-lastSpawn> DAY_LENGTH*0.018 && foods.length<Math.max(2,_fCap-2) && Math.random()<0.18){spawnFoodSurface(CENTER_COL*CELL+8 + (Math.random()-0.5)*_fW,1); lastSpawn=time;}
    colonyIQ=100 + Math.floor(gen*3.8) + Math.floor((workers.reduce((s,w)=>s+w.genome.hiddenSize,0)/Math.max(1,workers.length)-8)*3.5) + Math.floor(Math.min(colonyFitness,8.5)*2.1);
    if(colonyIQ>280) colonyIQ=280+Math.floor((colonyIQ-280)*0.18);
    updateColonyUI();
    // guardar progreso cada ~5s para offline
    if(Date.now()-_lastSaveReal > 5000){
      _lastSaveReal=Date.now();
      try{ localStorage.setItem('antfarm_lastReal', String(Date.now())); localStorage.setItem('antfarm_time', String(time)); }catch(e){}
    }
}
function loop(now){ try{
  if(!_topoHasWorld){ // Topo: nada existe aún, no simular ni renderizar granja
    // solo mantener UI de menú, no avanzar tiempo
    requestAnimationFrame(loop);
    return;
  }
  const rawDt=now-last; last=now; const dtMs=Math.min(rawDt, 42); // clamp 42ms evita lag spike
  let dt=dtMs*0.06 * gameSpeed;
  const wallNow=Date.now();
  const wallDelta=wallNow-lastRealWall; lastRealWall=wallNow;
  // si el navegador suspendió el tab, wallDelta será mucho mayor que dtMs -> recuperar tiempo real
  if(wallDelta > dtMs + 900){
    let wallDt = wallDelta*0.06 * gameSpeed;
    wallDt = Math.min(wallDt, DAY_LENGTH*0.7); // no más de 0.7d por frame
    if(wallDt > dt) dt = wallDt;
  }
  // subdividir dt grande para estabilidad (evita saltos y muertes falsas)
  const maxStep=Math.max(6, 28/(gameSpeed>4?Math.ceil(gameSpeed/4):1)); // a x16 subdivide más para evitar túneles
  let steps=0;
  while(dt>0.001 && steps<60){
    const step=Math.min(dt, maxStep);
    tickStep(step);
    dt-=step;
    steps++;
    // si la colonia es grande y dt enorme, no bloquear el hilo más de 60 pasos (~1.6d) por frame, el resto se hará en el siguiente frame
    if(steps>=60 && dt>0){ time+=dt; break; }
  }
  renderLoop();
  requestAnimationFrame(loop);
  }catch(e){ console.error('loop',e); requestAnimationFrame(loop); }
}
requestAnimationFrame(loop);
// tick de respaldo cuando el tab está oculto: rAF se throttlea a ~1fps, este interval mantiene vivo aunque sea a 5fps
setInterval(()=>{ try{ if(!paused){ const now=performance.now(); // forzar un loop extra
  // no llamar directamente a loop para no duplicar last, solo avanzar un poco si hace mucho que no hay frame
  if(performance.now()-last > 400){ loop(performance.now()); }
} }catch(e){} }, 220);
// Worker de respaldo que no se throttlea tanto como rAF en algunos navegadores
try{
  const wCode=`setInterval(()=>postMessage('tick'), 180);`;
  const wBlob=new Blob([wCode], {type:'application/javascript'});
  const wUrl=URL.createObjectURL(wBlob);
  const bgWorker=new Worker(wUrl);
  bgWorker.onmessage=()=>{
    if(document.hidden && !paused){
      const now=performance.now();
      if(now-last > 350) loop(now);
    }
  };
  // guardar referencia para no ser GC
  window._bgWorker=bgWorker;
} catch(e){ tlog('[TOPO] worker fallback no disponible', e.message); }
// nunca pausar por visibilidad: asegurar que paused siga false aunque cambie el tab
 document.addEventListener('visibilitychange', ()=>{
  if(!document.hidden){
    // al volver, recalcular wallDelta en el próximo loop
    last=performance.now();
    lastRealWall=Date.now();
  }
});
let _miniAt=0;
function _miniTick(){ const n=performance.now(); if(n-_miniAt<70) return false; _miniAt=n; return true; }
function renderLoop(){ try{ if(!_topoHasWorld){ return; } try{ updateDepthRuler(); }catch(e){}
  ctx.clearRect(0,0,W,H);
  drawFarm(ctx,W,H,false);
  if(_miniTick()){
  tbCtx.clearRect(0,0,200,56);
  tbCtx.fillStyle='#7ec8e3'; tbCtx.fillRect(0,0,200,10); tbCtx.fillStyle='#3a9d23'; tbCtx.fillRect(0,10,200,4);
  tbCtx.fillStyle='#fff8dc'; tbCtx.fillRect(0,14,200,42);
  for(let r=0;r<4;r++) for(let c=0;c<20;c++){const sr=Math.floor((r/4)*(ROWS-SURFACE_ROW))+SURFACE_ROW;const sc=Math.floor((c/20)*COLS);const isSoil=soil[sr]&&soil[sr][sc]===1;tbCtx.fillStyle=isSoil?'#5a2a0a':'#fff8dc';tbCtx.fillRect(c*10,14+r*10,10,10);}
  const qx=(queen.x/W)*200, qy=14+(queen.y/H)*40;tbCtx.fillStyle='#b47aff';tbCtx.fillRect(Math.floor(qx)-3,Math.floor(qy)-2,6,4);
  workers.forEach(w=>{const mx=(w.x/W)*200, my=14+(w.y/H)*40;tbCtx.fillStyle=w.role==='EXCAVADORA'?'#ff3b30':w.role==='EXPLORADORA'?'#00e5ff':w.role==='NODRIZA'?'#b47aff':'#ffcc00';tbCtx.fillRect(Math.floor(mx)-2,Math.floor(my)-1,4,2);});
  for(let f of foods){const fx=(f.x/W)*200; const my = f.y < SURFACE_Y ? 6 : 14 + ((f.y - SURFACE_Y)/(H-SURFACE_Y))*40; tbCtx.fillStyle='#ffaa00';tbCtx.fillRect(Math.floor(fx)-2,Math.floor(my)-2,4,4);}
  for(let ink of commInks){const ix=(ink.x/W)*200, iy=14+(ink.y/H)*40; tbCtx.fillStyle=ink.color; tbCtx.globalAlpha=ink.life*0.9; tbCtx.fillRect(Math.floor(ix)-1,Math.floor(iy)-1,2,2); tbCtx.globalAlpha=1;}
  const vx=(view.x/W)*200, vy=14+(view.y/H)*40, vw=(W/view.zoom/W)*200, vh=(H/view.zoom/H)*40;
  tbCtx.strokeStyle='#ffcc00'; tbCtx.lineWidth=2; tbCtx.setLineDash([4,4]); tbCtx.strokeRect(vx,vy,vw,vh); tbCtx.setLineDash([]);
  }
  try{ _panelsMaybeDraw(); }catch(e){ drawNN(); } // Topo: los paneles se refrescan a ~7fps y solo si estan visibles
}catch(e){ console.error('renderLoop',e); }
}
let _topoHudMissingWarned=false;
function updateColonyUI(){
  try{ updateColonyUIInner(); }
  catch(e){
    // Un nodo de HUD que falte no puede congelar nada: se avisa una vez y se sigue.
    if(!_topoHudMissingWarned){
      _topoHudMissingWarned=true;
      const at=e && e.stack ? String(e.stack).split('\n').slice(1,3).join(' <- ') : '';
      console.warn('[HUD] nodos ausentes:', e.message, at); tlog('[HUD] aviso -> '+at);
    }
  }
  // Topo: el reloj se repinta SIEMPRE, al final y fuera del try. Ningun fallo del HUD
  // puede volver a dejar la hora clavada (eso era el "dia congelado").
}
function updateColonyUIInner(){
  if(!shouldUpdateUI()) return;
  if(!_topoHasWorld) return; // sin mundo no hay colonia que pintar (evita leer queen.state cuando es null)
  try{ hudText('hPop', workers.length+'/'+getMaxPopulation()); }catch(e){ hudText('hPop', workers.length); }
  hudText('hFood', colonyFood);
  hudText('hGen', gen);
  hudText('hFit', (colonyFitness||0).toFixed(2));
  hudText('hIQ', colonyIQ);
  hudText('hQueen', queen.state);
  // Topo - economía visible con iconos
  try{
    const ef=document.getElementById('ecoFood'); if(ef) ef.textContent=colonyFood;
    const efi=document.getElementById('ecoFiber'); if(efi) efi.textContent=worldMaterials.fiber||0;
    const es=document.getElementById('ecoStone'); if(es) es.textContent=worldMaterials.stone||0;
    const ec=document.getElementById('ecoClay'); if(ec) ec.textContent=worldMaterials.clay||0;
    const ew=document.getElementById('ecoWood'); if(ew) ew.textContent=worldMaterials.wood||0;
    const bar=document.getElementById('economyBar'); if(bar){ bar.title=`🍯${colonyFood} 🌿${worldMaterials.fiber||0} 🪨${worldMaterials.stone||0} 🧱${worldMaterials.clay||0} 🪵${worldMaterials.wood||0}`; }
  }catch(e){}
  hudText('hLvl', stats.nivel);
  hudText('hXpText', `${Math.floor(stats.xp)}/${stats.xpToNext}`);
  hudStyle('hXpFill', 'width', (stats.xp/stats.xpToNext*100)+'%');
  hudText('hudFood', foods.length);
  hudText('hudDig', digs);
  hudText('hudBrood', brood.length);
  hudText('hudComms', commInks.length);
  hudText('camLabel', countChambers()+' CÁMARAS');
  const gameHour = (time % DAY_LENGTH) / DAY_LENGTH * 24;
  const hh=Math.floor(gameHour), mm=Math.floor((gameHour%1)*60);
  const wIcon= weather.type==='rain'?'🌧':weather.type==='storm'?'⛈':weather.type==='cloudy'?'☁️':'☀️';
  const isDay = gameHour>=6 && gameHour<=19;
  hudText('timeLabel', `D${day} ${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')} ${wIcon}${isDay?'☀️':'🌙'}`);
  document.getElementById('timeLabel').title=`Día ${day} - ${weather.type} - ${isDay?'día':'noche'}`;
  try{ hudText('cPop', workers.length+'/'+getMaxPopulation()+' +'+queens.length+'♛'); }catch(e){ document.getElementById('cPop').textContent=workers.length + ' +1♛'; }
  try{ hudText('cPopDetail', workers.length+'/'+getMaxPopulation()+' obreras + '+queens.length+' reina(s) - ' + brood.length + ' crías - tope '+getMaxPopulation()); }catch(e){ document.getElementById('cPopDetail').textContent=workers.length+' obreras + 1 reina - ' + brood.length + ' crías'; }
  hudText('cFood', colonyFood);
  hudText('cFit', (colonyFitness||0).toFixed(2));
  hudText('cIQ', colonyIQ);
  renderSociety();
  let iqLabel='hormiga real';
  if(colonyIQ>300) iqLabel='¡SOBREHUMANA!';
  else if(colonyIQ>250) iqLabel='supera humano';
  else if(colonyIQ>200) iqLabel='muy superior';
  else if(colonyIQ>150) iqLabel='super-hormiga';
  else if(colonyIQ>110) iqLabel='evolucionada';
  hudText('cIQLabel', iqLabel+' (100=real)');
  hudText('cCham', countChambers());
  hudText('cRew', rewardsFound+'/3');
  hudText('cComms', commInks.length);
  hudText('qGen', queen.genome.gen);
  hudText('qEggs', brood.filter(b=>b.type==='egg').length);
  hudText('qFert', colonyFood>=3? 'ALTA':'BAJA');
  hudStyle('qProgress', 'width', queen.progress+'%');
  hudText('qProgressLabel', queen.progress>=100? '¡listo!': `próximo ${Math.floor(queen.progress)}%`);
  hudText('queenStatus', queen.state);
  const counts={RECOLECTORA:0,EXCAVADORA:0,NODRIZA:0,EXPLORADORA:0};
  workers.forEach(w=> counts[w.role]=(counts[w.role]||0)+1);
  const total=workers.length||1;
  hudText('rRec', counts.RECOLECTORA);
  hudText('rCav', counts.EXCAVADORA);
  hudText('rNod', counts.NODRIZA);
  hudText('rExp', counts.EXPLORADORA);
  hudText('rRecD', Math.floor(counts.RECOLECTORA/total*100)+'%');
  hudText('rCavD', Math.floor(counts.EXCAVADORA/total*100)+'%');
  hudText('rNodD', Math.floor(counts.NODRIZA/total*100)+'%');
  hudText('rExpD', Math.floor(counts.EXPLORADORA/total*100)+'%');
  hudText('antCountLabel', workers.length+' obreras');
  hudText('colonyAge', Math.floor(time/3600)+' min reales ('+(time/DAY_LENGTH).toFixed(2)+'d)');
  const broodRow=document.getElementById('broodRow');
  broodRow.innerHTML='';
  brood.forEach(b=>{
    const d=document.createElement('div');
    d.className='brood-dot '+b.type;
    d.title=b.type+' '+Math.floor(b.progress)+'%';
    d.textContent=b.type==='egg'?'●':b.type==='larva'?'~':'◆';
    broodRow.appendChild(d);
  });
  for(let i=brood.length;i<6;i++){const d=document.createElement('div'); d.className='brood-dot'; d.style.background='#111'; d.style.borderColor='#000'; broodRow.appendChild(d);}
  // antList solo cada 380ms o si cambia el número - evita 60x/s innerHTML (lag)
  const nowAL=performance.now(); const needAL = (nowAL - lastAntListUpdate > 380) || cachedAntCount!==workers.length;
  if(needAL){
    lastAntListUpdate=nowAL; cachedAntCount=workers.length;
  const list=document.getElementById('antList');
  list.innerHTML='';
  workers.forEach((w,i)=>{
    const chip=document.createElement('div');
    chip.className='ant-chip'+(w.selected?' selected':'');
    const col = w.role==='EXCAVADORA'?'#ff3b30':w.role==='EXPLORADORA'?'#00e5ff':w.role==='NODRIZA'?'#b47aff':'#ffcc00';
    const facCol = society.factions.find(f=>f.id===w.faction)?.color || col;
    const stateIcon = w.state==='CAVANDO'?'⛏':w.food && !w.food.isSoil?'🍯':w.state==='DESCANSAR'?'💤':w.food?'🪨':'🔍';
    // mood emoji
    let moodIcon='😐';
    if(w.mood.anger>0.62) moodIcon='😠';
    else if(w.mood.sadness>0.62) moodIcon='😢';
    else if(w.mood.joy>0.72) moodIcon='😊';
    else if(w.mood.fear>0.55) moodIcon='😨';
    else if(w.mood.stress>0.65) moodIcon='😓';
    const ageD=(w.age/DAY_LENGTH).toFixed(1);
    chip.innerHTML=`<div class="ant-mini" style="color:${col};border-color:${facCol};border-width:3px">${w.role[0]}</div><div style="flex:1;min-width:0"><b title="${w.nameMeaning||''}">${antDisplayName(w)}</b><span style="font-size:7px;color:#8a7a5a"> ${w.personalName!==w.id?'('+w.id+')':''}</span> <span style="font-size:10px;background:${facCol};color:#000;padding:1px 3px;border-radius:3px">F${w.faction}</span> <span style="font-size:14px">${stateIcon}</span> <span style="font-size:12px">${moodIcon}</span><br><small>${w.role} - ${ageD}d - ❤${Math.floor(w.health)}${w.isQueen?' 👑':''}</small>all><br><small style="color:${col}">${w.commOut[0]>0.4?symbolForComms(w.commOut[0],w.commOut[1]):'·'} FIT ${(w.fitness ?? 0).toFixed(1)}</small></div><div style="font-family:Press Start 2P;font-size:7px;color:#8a7a5a;text-align:right">${w.genome.id}<br><span style="background:${w.food?'#2de67a':'#000'};color:${w.food?'#000':'#666'};padding:2px 4px">${w.food? 'x'+w.food.amount:'-'}</span></div>`;
    chip.onclick=()=>{workers.forEach(a=>a.selected=false); w.selected=true; selectedAntIndex=i;};
    chip.ondblclick=()=> showAntProfile(w);
    list.appendChild(chip);
  });
  } // end antList throttling
  const sel=workers[selectedAntIndex] || workers[0];
  if(sel){
    hudText('selectedName', sel.id + ' ['+sel.role+']');
    const t=traitsFromGenome(sel.genome);
    hudText('tExp', t.exploracion);
    hudText('tCav', t.construccion);
    hudText('tRec', t.recoleccion);
    hudText('tCui', t.cuidado);
    hudText('tCom', t.comunica);
    hudStyle('bExp', 'width', t.exploracion+'%');
    hudStyle('bCav', 'width', t.construccion+'%');
    hudStyle('bRec', 'width', t.recoleccion+'%');
    hudStyle('bCui', 'width', t.cuidado+'%');
    hudStyle('bCom', 'width', t.comunica+'%');
    hudHtml('dnaStr', genomeToDNA(sel.genome).replace(/(.{8})/g,'$1 ').trim().split('').map((ch)=> Math.random()<0.07?`<b>${ch}</b>`:ch).join('').slice(0,140));
    hudText('genId', `GEN-${sel.genome.gen} - ${sel.genome.id} - ${sel.genome.hiddenSize*11+sel.genome.hiddenSize+sel.genome.hiddenSize*5+5} genes`);
    hudText('nodeCount', sel.genome.hiddenSize);
    hudText('fitVal', (sel.fitness ?? 0).toFixed(2));
    hudText('commsVal', sel.commsSent);
    hudText('lastMut', lastMutInfo);
    hudText('maxFit', Math.max(0,...fitnessHistory).toFixed(2));
    hudText('avgNodes', (workers.reduce((s,w)=>s+w.genome.hiddenSize,0)/Math.max(1,workers.length)).toFixed(1));
    hudText('avgComms', commInks.length);
    hudText('rewardDetail', rewardsFound+'/3');
    const hudSel=document.getElementById('hudSel');
    const hudTxt=document.getElementById('hudSelTxt');
    if(sel && hudSel){
      hudSel.style.display='flex';
      if(hudTxt) hudTxt.textContent=`${sel.id} [${sel.role}] - 3 OJOS ${(sel.sensors?.wallLeft ?? 0).toFixed(1)}/${(sel.sensors?.wallCenter ?? 0).toFixed(1)}/${(sel.sensors?.wallRight ?? 0).toFixed(1)} - TINTA ${(sel.sensors?.commIn1 ?? 0).toFixed(1)},${(sel.sensors?.commIn2 ?? 0).toFixed(1)}`;
    }
  }
  hudText('tbPop', workers.length);
  try{ const _v=document.getElementById('velAntCount'); if(_v) _v.textContent=workers.length; const _c=document.getElementById('calAntCount'); if(_c) _c.textContent=workers.length; }catch(e){}
  hudText('tbIQ', colonyIQ);
  hudText('tbName', 'Colonia GEN'+gen);
  hudStyle('tbXp', 'width', (stats.xp/stats.xpToNext*100)+'%');
  // === MUNDO VIVO UI ===
  try{
    const avgF = fertility.length? (fertility.reduce((a,b)=>a+b,0)/fertility.length*100)|0 : 58;
    const ecoF=document.getElementById('ecoFert'); if(ecoF) ecoF.textContent= avgF+'%';
    const seas=['primavera','verano','otoño','invierno'][Math.floor((day/12)%4)]||'primavera';
    const sEl=document.getElementById('ecoSeason'); if(sEl) sEl.textContent=seas+' - día '+(worldAge.toFixed(1));
    const ageEl=document.getElementById('ecoAge'); if(ageEl) ageEl.textContent='día '+day+' - '+seas;
    const wMap={clear:'☀️ claro', cloudy:'☁️ nublado', rain:'🌧 lluvia', storm:'⛈ tormenta'};
    const wEl=document.getElementById('ecoWeather'); if(wEl) wEl.textContent=wMap[weather.type]||weather.type;
    const rEl=document.getElementById('ecoRain'); if(rEl) rEl.textContent=(weather.type==='rain'||weather.type==='storm')? 'húmedo +fert':'seco';
    const plEl=document.getElementById('ecoPlants'); if(plEl) plEl.textContent=plants.length+' 🌿';
    const types={}; plants.forEach(p=> types[p.type]=(types[p.type]||0)+1);
    const typEl=document.getElementById('ecoPlantTypes'); if(typEl){
      const top=Object.entries(types).sort((a,b)=>b[1]-a[1]).slice(0,2).map(k=>k[0]).join(', ')||'-';
      typEl.textContent=top;
    }
    const mS=document.getElementById('matStone'); if(mS) mS.textContent=worldMaterials.stone;
    const mC=document.getElementById('matClay'); if(mC) mC.textContent=worldMaterials.clay;
    const mSa=document.getElementById('matSand'); if(mSa) mSa.textContent=worldMaterials.sand;
    const mF=document.getElementById('matFiber'); if(mF) mF.textContent=worldMaterials.fiber;
    const mW=document.getElementById('matWood'); if(mW) mW.textContent=worldMaterials.wood;
    const matsBox=document.getElementById('ecoMats'); if(matsBox){
      const hasAny = worldMaterials.stone+worldMaterials.clay+worldMaterials.sand+worldMaterials.fiber+worldMaterials.wood>0;
      matsBox.style.opacity=hasAny? '1':'0.55';
    }
    const invEl=document.getElementById('ecoInv'); if(invEl){
      const unlocked=[];
      if(inventions.stone) unlocked.push('🪨 piedra');
      if(inventions.clay) unlocked.push('🏺 arcilla');
      if(inventions.fiber) unlocked.push('🧵 fibra');
      if(inventions.wood) unlocked.push('🪵 madera');
      if(inventions.fungus) unlocked.push('🍄 hongo');
      const toolCount=workers.filter(w=>w.tool).length;
      const structCount=structures.length;
      let txt = unlocked.length? '✓ '+unlocked.join(' - '): '- aún cavan tierra común -';
      if(structCount) txt += ` | 🏗 ${structCount} ${structures.map(s=>STRUCTURE_DEFS[s.type].name).join(', ')}`;
      if(toolCount) txt += ` - 🔧 ${toolCount} herramientas`;
      invEl.textContent=txt;
      invEl.style.color= unlocked.length||structCount?'#2de67a':'#8a7a5a';
    }
    const log=document.getElementById('ecoLog'); if(log){
      if(structures.length){
        const names=structures.map(s=>STRUCTURE_DEFS[s.type].name).join(', ');
        if(worldAge>2.5 && structures.some(s=>s.type==='tower')) log.textContent=`🏰 Torre vigía erguida - ${names} - el mundo ya tiene arquitectura`;
        else if(worldAge>1.8 && structures.some(s=>s.type==='workshop')) log.textContent=`🛠️ Taller activo - ${names} - fabrican herramientas`;
        else log.textContent=`🏗 ${structures.length} estructuras: ${names} - el mundo se vuelve civilizado`;
      } else if(plants.some(p=>p.type==='fruitTree' && p.growth>0.58)){
        log.textContent='🍎 Manzanos frutales maduran - caen 3 manzanas cada cosecha';
      } else if(worldAge<0.5) log.textContent='La pradera respira. El pasto crece poco a poco. Riega con lluvia natural.';
      else if(worldAge<1.2) log.textContent='Florecen las primeras flores. Las hormigas ya cosechan néctar.';
      else if(worldAge<2.2) log.textContent='Arbustos de bayas aparecen donde hay fertilidad. El mundo se diversifica.';
      else if(inventions.stone||inventions.clay) log.textContent='¡Materiales! Cavan piedra, arcilla y arena según la capa. Ya inventan.';
      else log.textContent='Bosquecillos jóvenes crecen. Hongos en cuevas húmedas. Sigue lloviendo.';
    }
  }catch(e){}
  // si ficha de reina abierta, refrescar en vivo (vida, huevos, progreso)
  try{
    const qm=document.getElementById('queenProfile');
    if(qm && qm.style.display!=='none' && qm.style.transform==='translateX(0)'){
      const q=queens[selectedQueenIndex]||queens[0];
      if(q){
        // refresco ligero sin reabrir animación
        const ageD=(q.age/DAY_LENGTH).toFixed(1), maxD=(q.maxAge/DAY_LENGTH).toFixed(1);
        const elId=document.getElementById('queenProfileId'); if(elId) elId.textContent = `${queenDisplayName(q)} (${q.id}) - ${ageD}d / ${maxD}d - ❤ ${Math.floor(q.health)}%`;
        const elEggs=document.getElementById('queenEggsLaid'); if(elEggs) elEggs.textContent=q.eggsLaid||0;
        const elHealth=document.getElementById('queenHealthVal'); if(elHealth) elHealth.textContent=Math.floor(q.health)+'%';
        const elProg=document.getElementById('queenProgressBar'); if(elProg) elProg.style.width=(q.progress||0)+'%';
        const elProgLbl=document.getElementById('queenProgressLbl'); if(elProgLbl) elProgLbl.textContent='huevo '+Math.floor(q.progress||0)+'%';
        const elBrood=document.getElementById('queenBroodCount'); if(elBrood) elBrood.textContent=brood.filter(b=> b.mother===q.id || (!b.mother && q===queens[0])).length;
        const growth=queenGrowthFromGenome(q.genome,q.age,q.maxAge);
        const elLvl=document.getElementById('queenGrowthLvl'); if(elLvl) elLvl.textContent=growth.nivel;
        const elSize=document.getElementById('queenGrowthSize'); if(elSize) elSize.textContent=growth.talla+' px';
        const elProg2=document.getElementById('queenGrowthProg'); if(elProg2) elProg2.textContent=growth.progreso+'% vida';
      }
    }
  }catch(e){}
  try{ if(typeof updateCalendarWidget==='function') updateCalendarWidget(); }catch(e){}
  updateActionButtons();
}

let _panelsAt=0, _panelsSig='';
function _panelVisible(){
  try{ const el=nnCanvas; if(!el) return false;
    if(el.offsetParent===null && typeof el.offsetWidth==='number' && el.offsetWidth===0) return false;
    return true;
  }catch(e){ return true; }
}
function _panelsMaybeDraw(){
  if(!_panelVisible()) return;
  const now=performance.now();
  const sig=selectedAntIndex+'|'+((workers[selectedAntIndex]&&workers[selectedAntIndex].id)||'')+'|'+workers.length;
  if(now-_panelsAt<140 && sig===_panelsSig) return;
  _panelsAt=now; _panelsSig=sig;
  drawNN(); drawSensors(); drawChart();
}
function drawNN(){
  const sel=workers[selectedAntIndex] || workers[0];
  if(!sel) return;
  const g=sel.genome;
  const w=nnCanvas.width, h=nnCanvas.height;
  nctx.clearRect(0,0,w,h);
  nctx.fillStyle='#050505'; nctx.fillRect(0,0,w,h);
  nctx.fillStyle='rgba(255,204,0,0.04)'; for(let x=0;x<w;x+=8) for(let y=0;y<h;y+=8) nctx.fillRect(x,y,1,1);
  const inX=28, hidX=w/2, outX=w-28;
  const inStep=(h-20)/(INPUT_SIZE-1||1), hidStep=(h-20)/(g.hiddenSize-1||1), outStep=(h-20)/(OUTPUT_SIZE-1||1);
  for(let hi=0;hi<g.hiddenSize;hi++) for(let ii=0;ii<INPUT_SIZE;ii++){
    const x1=inX,y1=10+ii*inStep,x2=hidX,y2=10+hi*hidStep;
    const wv=g.w1[hi][ii]; const alpha=Math.min(0.85,Math.abs(wv)*0.5+0.11);
    nctx.strokeStyle=wv>0?`rgba(45,230,122,${alpha})`:`rgba(255,59,48,${alpha})`;
    nctx.lineWidth=Math.min(2.5,Math.abs(wv)*1.4+0.5);
    nctx.beginPath();nctx.moveTo(x1+7,y1);nctx.lineTo(x2-7,y2);nctx.stroke();
  }
  for(let oi=0;oi<OUTPUT_SIZE;oi++) for(let hi=0;hi<g.hiddenSize;hi++){
    const x1=hidX,y1=10+hi*hidStep,x2=outX,y2=10+oi*outStep;
    const wv=g.w2[oi][hi]; const alpha=Math.min(0.85,Math.abs(wv)*0.5+0.11);
    nctx.strokeStyle=wv>0?`rgba(45,230,122,${alpha})`:`rgba(255,59,48,${alpha})`;
    nctx.lineWidth=Math.min(2.5,Math.abs(wv)*1.4+0.5);
    nctx.beginPath();nctx.moveTo(x1+7,y1);nctx.lineTo(x2-7,y2);nctx.stroke();
  }
  for(let i=0;i<INPUT_SIZE;i++){
    const y=10+i*inStep; const val=Object.values(sel.sensors || {})[i]||0; const act=(val+1)/2;
    let col='rgba(45,230,122,'; if(i>=4 && i<=6) col='rgba(255,204,0,'; if(i>=9) col='rgba(0,229,255,';
    nctx.fillStyle=col+(0.22+act*0.72)+')'; nctx.fillRect(inX-7,y-7,14,14); nctx.strokeStyle='#000'; nctx.lineWidth=2; nctx.strokeRect(inX-7,y-7,14,14);
    nctx.fillStyle='#000'; nctx.font='bold 7px JetBrains Mono'; nctx.textAlign='center'; nctx.textBaseline='middle'; nctx.fillText(i>=9?'C':(i>=4&&i<=6?'◉':'I'),inX,y+0.5);
  }
  for(let h=0;h<g.hiddenSize;h++){
    const y=10+h*hidStep; const v=sel.nnHidden[h]||0; const act=(v+1)/2;
    nctx.fillStyle=`rgba(180,122,255,${0.22+act*0.72})`; nctx.shadowColor='#b47aff'; nctx.shadowBlur=act*7; nctx.fillRect(hidX-7,y-7,14,14); nctx.shadowBlur=0;
    nctx.strokeStyle='#000'; nctx.lineWidth=2; nctx.strokeRect(hidX-7,y-7,14,14);
    nctx.fillStyle='#000'; nctx.font='bold 7px JetBrains Mono'; nctx.textAlign='center'; nctx.fillText('●',hidX,y+0.5);
  }
  const outLabels=['GIRO','VEL','CAVA','T1','T2'];
  for(let o=0;o<OUTPUT_SIZE;o++){
    const y=10+o*outStep; const v=sel.nnOut[o]||0; const act=(v+1)/2;
    let col=o===0?'#ffcc00':o===1?'#2de67a':o===2?'#ff3b30':o===3?'#00e5ff':'#b47aff';
    nctx.fillStyle=col; nctx.globalAlpha=0.22+act*0.72; nctx.fillRect(outX-7,y-7,14,14); nctx.globalAlpha=1;
    nctx.strokeStyle='#000'; nctx.lineWidth=2; nctx.strokeRect(outX-7,y-7,14,14);
    nctx.fillStyle='#000'; nctx.font='bold 7px JetBrains Mono'; nctx.textAlign='center'; nctx.fillText(outLabels[o][0],outX,y+0.5);
  }
  nctx.fillStyle='rgba(255,255,255,0.32)'; nctx.font='7px JetBrains Mono'; nctx.textAlign='center'; nctx.fillText('11 SENSORES',inX,h-3); nctx.fillText('OCULTA',hidX,h-3); nctx.fillText('5 ACCIONES',outX,h-3);
  hudText('outSteer', (sel.nnOut[0]||0).toFixed(2));
  hudText('outSpeed', (((sel.nnOut[1]||0)+1)/2).toFixed(2));
  hudText('outDig', (((sel.nnOut[2]||0)+1)/2).toFixed(2));
  hudText('outC1', (sel.nnOut[3]||0).toFixed(2));
  hudText('outC2', (sel.nnOut[4]||0).toFixed(2));
}
function drawSensors(){
  const sel=workers[selectedAntIndex]||workers[0];
  if(!sel) return;
  const cont=document.getElementById('sensors');
  const names=[
    {k:'foodAngle',label:'ANG COMIDA',col:'#ffcc00'},
    {k:'foodDist',label:'DIST COMIDA',col:'#2de67a'},
    {k:'pheroStr',label:'FEROMONA',col:'#b47aff'},
    {k:'pheroAng',label:'ANG FER',col:'#b47aff'},
    {k:'wallLeft',label:'OJO IZQ -45°',col:'#ff3b30'},
    {k:'wallCenter',label:'OJO CENT 0°',col:'#ffcc00'},
    {k:'wallRight',label:'OJO DER +45°',col:'#00e5ff'},
    {k:'fatigue',label:'FATIGA',col:'#00e5ff'},
    {k:'carrying',label:'CARGA',col:'#ffcc00'},
    {k:'commIn1',label:'TINTA 1',col:'#00e5ff'},
    {k:'commIn2',label:'TINTA 2',col:'#b47aff'},
  ];
  cont.innerHTML='';
  names.forEach(s=>{
    const val=sel.sensors[s.k]!==undefined? sel.sensors[s.k]:0;
    const norm= s.k==='foodAngle'||s.k==='pheroAng'||s.k==='commIn1'||s.k==='commIn2' ? (val+1)/2 : val;
    const pct=Math.max(0,Math.min(100,norm*100));
    const row=document.createElement('div'); row.className='sensor';
    row.innerHTML=`<div class="sensor-label">${s.label}</div><div class="sensor-bar"><div class="sensor-fill" style="width:${pct}%;background:${s.col}"></div></div><div class="sensor-val">${val.toFixed(2)}</div>`;
    cont.appendChild(row);
  });
}
function drawChart(){
  const w=chartCanvas.width,h=chartCanvas.height;
  cctx.clearRect(0,0,w,h);
  cctx.fillStyle='#050505';cctx.fillRect(0,0,w,h);
  cctx.fillStyle='rgba(255,255,255,0.03)';for(let x=0;x<w;x+=18) cctx.fillRect(x,0,1,h);for(let y=0;y<h;y+=16) cctx.fillRect(0,y,w,1);
  if(fitnessHistory.length<2) return;
  const maxF=Math.max(1,...fitnessHistory)*1.25, minF=Math.min(0,...fitnessHistory);
  const range=maxF-minF||1;
  cctx.fillStyle='rgba(255,255,255,0.28)';cctx.font='7px JetBrains Mono';cctx.textAlign='right';cctx.fillText(maxF.toFixed(1),w-2,8);cctx.fillText(minF.toFixed(1),w-2,h-2);
  cctx.strokeStyle='#2de67a';cctx.lineWidth=2;cctx.shadowColor='#2de67a';cctx.shadowBlur=6;cctx.beginPath();
  fitnessHistory.forEach((f,i)=>{const x=4+i/(Math.max(1,fitnessHistory.length-1))*(w-8);const y=h-6-((f-minF)/range)*(h-12);if(i===0)cctx.moveTo(x,y);else cctx.lineTo(x,y);});
  cctx.stroke();cctx.shadowBlur=0;
  fitnessHistory.forEach((f,i)=>{const x=4+i/(Math.max(1,fitnessHistory.length-1))*(w-8);const y=h-6-((f-minF)/range)*(h-12);cctx.fillStyle=i===fitnessHistory.length-1?'#ffcc00':'#2de67a';cctx.fillRect(x-1.5,y-1.5,3,3);});
  cctx.fillStyle='rgba(255,255,255,0.32)';cctx.font='7px JetBrains Mono';cctx.textAlign='left';cctx.fillText(`GEN ${gen}`,4,10);
  hudText('chartLabel', `${fitnessHistory.length} gen - max ${(Math.max(...fitnessHistory,0)).toFixed(2)} - IQ ${colonyIQ}`);
}

/* INPUTS */
let isDragging=false, dragStartScreen={x:0,y:0}, dragStartView={x:0,y:0}, hasPanned=false;
wrap.addEventListener('wheel',e=>{
  e.preventDefault();
  const rect=canvas.getBoundingClientRect();
  const sx=rect.width? (e.clientX-rect.left)/rect.width*W : W/2;
  const sy=rect.height? (e.clientY-rect.top)/rect.height*H : H/2;
  const delta= e.deltaY<0? 1.12 : 0.88;
  const nz=clamp(view.zoom*delta,0.6,3.2);
  if((nz===0.6 && delta<1) || (nz===3.2 && delta>1)){ if(Math.random()<0.12) showNotify('warn', nz===3.2?'Zoom máximo 320%':'Zoom mínimo 60%', nz===3.2?'No puedes acercar más.':'No puedes alejar más.',1200); }
  setZoom(view.zoom*delta, sx, sy);
},{passive:false});
canvas.addEventListener('mousedown',e=>{
  isDragging=true; hasPanned=false;
  dragStartScreen={x:e.clientX,y:e.clientY};
  dragStartView={x:view.x,y:view.y};
});
window.addEventListener('mousemove',e=>{
  const rect=canvas.getBoundingClientRect();
  const sx=rect.width? (e.clientX-rect.left)/rect.width*W : W/2;
  const sy=rect.height? (e.clientY-rect.top)/rect.height*H : H/2;
  const wpos=screenToWorld(sx,sy);
  mouse.x=wpos.x; mouse.y=wpos.y;
  if(isDragging){
    const dx=rect.width? (e.clientX-dragStartScreen.x)/rect.width*W/view.zoom : 0;
    const dy=rect.height? (e.clientY-dragStartScreen.y)/rect.height*H/view.zoom : 0;
    if(Math.hypot(dx,dy)>4) hasPanned=true;
    if(view.zoom>1.02 || hasPanned){
      const b=getPanBounds();
      view.x=clamp(dragStartView.x - dx,b.minX,b.maxX);
      view.y=clamp(dragStartView.y - dy,b.minY,b.maxY);
    }
  } else {
    // hover feedback - cursor pointer cuando hay hormiga debajo
    try{
      const sxH=rect.width? (e.clientX-rect.left)/rect.width*W : W/2;
      const syH=rect.height? (e.clientY-rect.top)/rect.height*H : H/2;
      const posH=screenToWorld(sxH,syH);
      let hover=null;
      const hr = Math.max(24, 18 / Math.max(0.7, view.zoom)) + 6;
      workers.forEach(w=>{ if(Math.hypot(w.x-posH.x,w.y-posH.y)<hr) hover=w; });
      if(!hover){
        for(let qq of queens){ if(Math.hypot(qq.x-posH.x, qq.y-posH.y) < Math.max(30, 22/Math.max(0.7,view.zoom))+8) { hover=qq; break; } }
      }
      canvas.style.cursor = hover ? 'pointer' : 'crosshair';
    }catch(_){}
  }
});
window.addEventListener('mouseup',()=>{setTimeout(()=>{isDragging=false;},50);});
canvas.addEventListener('click',e=>{
  if(hasPanned){ hasPanned=false; return; }
  const rect=canvas.getBoundingClientRect();
  const sx=rect.width? (e.clientX-rect.left)/rect.width*W : W/2;
  const sy=rect.height? (e.clientY-rect.top)/rect.height*H : H/2;
  const pos=screenToWorld(sx,sy);
  const x=pos.x, y=pos.y;
  let clicked=null; let bestDist=Infinity;
  // radio generoso escalado con zoom para que sea fácil clickear con calendario encima
  const hitR = Math.max(22, 16 / Math.max(0.7, view.zoom)) + 8;
  workers.forEach((w,i)=>{ const d=Math.hypot(w.x-x,w.y-y); if(d<hitR && d<bestDist){ bestDist=d; clicked=i; }});
  if(clicked!==null){
    workers.forEach(w=>w.selected=false); workers[clicked].selected=true; selectedAntIndex=clicked;
    pushEvent('evo',`Siguiendo a ${workers[clicked].id} [${workers[clicked].role}]`, `OJOS ${(workers[clicked].sensors?.wallLeft ?? 0).toFixed(2)}/${(workers[clicked].sensors?.wallCenter ?? 0).toFixed(2)}/${(workers[clicked].sensors?.wallRight ?? 0).toFixed(2)} - TINTA [${(workers[clicked].commOut?.[0] ?? 0).toFixed(2)},${(workers[clicked].commOut?.[1] ?? 0).toFixed(2)}]`);
    setNarration(`<b>Sigues a ${workers[clicked].id} [${workers[clicked].role}]</b> - mira su burbuja gigante y sus 3 ojos.`);
    // mostrar perfil con click (si ya estaba seleccionada, abre perfil)
    if(workers[clicked].selected) setTimeout(()=> showAntProfile(workers[clicked]), 80);
    return;
  }
  // Reina clickeable - clase única con perfil propio (soporta múltiples reinas)
  let clickedQueen=null, clickedQueenIdx=-1;
  for(let qi=0; qi<queens.length; qi++){
    const qq=queens[qi];
    const qHitR = Math.max(30, 22 / Math.max(0.7, view.zoom)) + 8;
    if(Math.hypot(qq.x-x, qq.y-y)<qHitR){ clickedQueen=qq; clickedQueenIdx=qi; break; }
  }
  if(clickedQueen){
    ensureQueenMeta(clickedQueen);
    selectedQueenIndex=clickedQueenIdx;
    // feedback narración
    pushEvent('evo',`👑 ${queenDisplayName(clickedQueen)} seleccionada - REINA F${clickedQueen.faction}`, `GEN${clickedQueen.genome.gen} - ${clickedQueen.genome.hiddenSize} nodos - 👑 ${clickedQueen.eggsLaid||0} huevos - ❤ ${Math.floor(clickedQueen.health)}%`);
    setNarration(`<b>👑 ${queenDisplayName(clickedQueen)} [REINA F${clickedQueen.faction}]</b> - ${clickedQueen.personality? clickedQueen.personality.fertilidad+' fertilidad - '+clickedQueen.personality.feromona+' feromona':''} - <b>${Math.max(0,3-colonyFood)} 🍯</b> para huevo. <small>Click abre ficha única.</small>`);
    // abrir ficha reina tras 70ms (como hormiga)
    setTimeout(()=> showQueenProfile(clickedQueen), 70);
    return;
  }
  // click vacío cierra perfiles para no estorbar visualmente
  if(clicked===null && clickedQueen===null){
    try{ closeAntProfile(); }catch(_){}
    try{ closeQueenProfile(); }catch(_){}
  }
  if(e.shiftKey){
    if(y>SURFACE_Y){
      const c=Math.floor(x/CELL), r=Math.floor(y/CELL);
      const frontier=findFrontier();
      let best=null,bd=Infinity;
      for(let f of frontier){const d=Math.hypot(f.c-c,f.r-r); if(d<bd){bd=d;best=f;}}
      if(best&&bd<7){
        const sel=workers[selectedAntIndex]||workers[0];
        if(sel){sel.digTarget=best; sel.digProgress=0; sel.digNeeded=Math.max(14,22); sel.state='CAVANDO'; pushEvent('evo',`Orden CAVAR [${best.c},${best.r}] a ${sel.id}`); pushImportant('invention', `⛏ ORDEN CAVAR [${best.c},${best.r}]`, `${sel.id} excavando - ver strip inferior`); pushToast(best.c*CELL,best.r*CELL,'⛏ ORDEN','#ffcc00'); showNotify('ok','¡A cavar!',''+sel.id+' va a ['+best.c+','+best.r+'] - mira el polvo.');}
      }else{
        if(y<SURFACE_Y+4){ showNotify('warn','No se puede cavar aquí','Shift+Click solo bajo tierra cerca del borde.'); pushToast(x,y,'✕ LEJOS','#ff3b30');}
        else { showNotify('warn','Muy lejos del frente','No hay pared a <7 celdas.'); for(let i=0;i<5;i++) pheromones.push({x:x+(Math.random()-0.5)*14,y:y+(Math.random()-0.5)*14,strength:0.72,life:1,type:'explore'}); pushToast(x,y,'· FEROMONA','#7ac8a0');}
      }
    }else{
      spawnFoodAt(x,y,1+Math.floor(Math.random()*2));
      pushEvent('food',`Miel en [${Math.floor(x)},${Math.floor(y)}]`);
      pushToast(x,y,'🍯 MIEL','#ffcc00');
    }
  }else{
    spawnFoodAt(x,y,1+Math.floor(Math.random()*2));
    pushEvent('food',`Miel en [${Math.floor(x)},${Math.floor(y)}] ${y<SURFACE_Y?' (sup)':'(túnel)'}`);
    pushToast(x,y,'🍯 MIEL','#ffcc00');
  }
});
canvas.addEventListener('dblclick',e=>{
  const rect=canvas.getBoundingClientRect();
  const sx=rect.width? (e.clientX-rect.left)/rect.width*W : W/2;
  const sy=rect.height? (e.clientY-rect.top)/rect.height*H : H/2;
  const pos=screenToWorld(sx,sy);
  const b2=getPanBounds();
  view.x=clamp(pos.x - W/view.zoom/2,b2.minX,b2.maxX);
  view.y=clamp(pos.y - H/view.zoom/2,b2.minY,b2.maxY);
});
canvas.addEventListener('contextmenu',e=>{e.preventDefault(); const rect=canvas.getBoundingClientRect(); const sx=rect.width? (e.clientX-rect.left)/rect.width*W : W/2; const sy=rect.height? (e.clientY-rect.top)/rect.height*H : H/2; const pos=screenToWorld(sx,sy); spawnFoodAt(pos.x,pos.y,3); pushEvent('food',`Miel grande en [${Math.floor(pos.x)},${Math.floor(pos.y)}]`); pushToast(pos.x,pos.y,'🍯 GRANDE','#ffcc00');});

document.getElementById('btnZoomIn').onclick=()=>{ const n=Math.min(3.2,view.zoom*1.25); if(n===view.zoom && view.zoom>=3.19) showNotify('warn','Zoom máximo','320% - no puedes acercar más.',1800); setZoom(n);};
document.getElementById('btnZoomOut').onclick=()=>{ const minZ=getMinZoom(); const n=Math.max(minZ,view.zoom*0.8); if(n===view.zoom && view.zoom<=0.61) showNotify('warn','Zoom mínimo','60%.',1600); setZoom(n);};
document.getElementById('btnZoomReset').onclick=()=>{ const z=getMinZoom(); view.zoom=z; view.x=(W - W/z)/2; view.y=(H - H/z)/2; clampView(); updateZoomLabel(); };
document.getElementById('togEyes').onclick=(e)=>{showEyes=!showEyes; e.currentTarget.classList.toggle('on',showEyes);};
document.getElementById('togTrail').onclick=(e)=>{showTrail=!showTrail; e.currentTarget.classList.toggle('on',showTrail);};
document.getElementById('togInk').onclick=(e)=>{showInk=!showInk; e.currentTarget.classList.toggle('on',showInk);};
document.getElementById('togFront').onclick=(e)=>{showFront=!showFront; e.currentTarget.classList.toggle('on',showFront);};
let isExpanded=false;
document.getElementById('btnExpand').onclick=()=>{
  isExpanded=!isExpanded;
  document.querySelector('main').classList.toggle('collapsed',isExpanded);
  hudText('btnExpand', isExpanded?'◀ PANEL':'⛶ GRANDE');
  if(isExpanded) showNotify('ok','Vista gigante','Panel oculto - granja a pantalla completa. Click de nuevo para volver.',2600);
};
document.getElementById('btnFood').onclick=()=>{
  const cx=view.x + W/view.zoom/2 + (Math.random()-0.5)*80;
  const cy=view.y + H/view.zoom/2 + (Math.random()-0.5)*60;
  spawnFoodAt(clamp(cx,20,W-20), clamp(cy,20,H-20),2);
  pushEvent('food',`Miel en vista [${Math.floor(cx)},${Math.floor(cy)}]`);
  pushToast(cx,cy,'🍯 MIEL','#ffcc00');
};
document.getElementById('btnBreed').onclick=()=>{ if(colonyFood<3){showNotify('error','¡FALTA COMIDA!','Necesitas <b>3 🍯</b>. Tienes <b>'+colonyFood+' 🍯</b>. <small>Suelta miel y espera entregas.</small>'); pushToast(queen.x,queen.y-22,'♛ 3 🍯 REQUERIDOS','#ff3b30'); return;} queen.progress=100; showNotify('ok','¡Huevo en camino!','Reina gestando.'); };
document.getElementById('btnMut').onclick=()=>{
  const sel=workers[selectedAntIndex]||workers[0];
  if(!sel) return;
  const res=mutateGenome(sel.genome,0.22,0.75);
  sel.genome=res.genome; sel.traits=traitsFromGenome(sel.genome);
  lastMutInfo=res.changes.slice(0,2).join(' | ');
  pushEvent('evo',`Mutación forzada ${sel.id}: ${lastMutInfo}`, `Nuevo DNA ${sel.genome.id} - 11→${sel.genome.hiddenSize}→5`);
  pushToast(sel.x,sel.y-28,'🧬 MUTACIÓN','#ffcc00');
  mutations++; gen++; fitnessHistory.push(colonyFitness); if(fitnessHistory.length>36) fitnessHistory.shift();
  colonyIQ=100 + Math.floor(gen*3.8) + Math.floor((sel.genome.hiddenSize-8)*3.5) + Math.floor(Math.min(colonyFitness,8.5)*2.1);
};
document.getElementById('btnLay').onclick=()=>{if(colonyFood>=3){queen.progress=100; showNotify('ok','¡Huevo encargado!','Gastaste 3 🍯.');}else{showNotify('error','No puedes poner huevo','Te faltan <b>'+(3-colonyFood)+' 🍯</b>. Tienes '+colonyFood+'/3.'); pushToast(queen.x,queen.y-18,'♛ FALTAN '+(3-colonyFood)+' 🍯','#ff3b30');}};
document.getElementById('btnHatch').onclick=()=>{ if(brood.length===0){showNotify('warn','No hay crías','La reina aún no puso huevos.'); return;} brood.forEach(b=> b.progress=100); pushToast(queen.x,queen.y-10,'⏩ ¡ECLOSIÓN!','#b47aff'); showNotify('ok','¡Eclosión!',''+brood.length+' crías.'); };
document.getElementById('btnPause').onclick=()=>{paused=!paused; hudText('btnPause', paused?'▶':'⏸');};
function syncCorner(n){
  // también sincroniza nueva barra vel
  try{ const vv={1:document.getElementById('btnVel1'),2:document.getElementById('btnVel2'),4:document.getElementById('btnVel4'),8:document.getElementById('btnVel8'),16:document.getElementById('btnVel16')}; Object.entries(vv).forEach(([k,b])=>{ if(!b) return; const on=parseInt(k)===n; b.style.background=on?'#ffcc00':'#3a2a14'; b.style.color=on?'#000':'#fff8dc'; }); }catch(e){}
  const k1=document.getElementById('btnCorner1'), k2=document.getElementById('btnCorner2'), k4=document.getElementById('btnCorner4'), k8=document.getElementById('btnCorner8'), k16=document.getElementById('btnCorner16');
  [k1,k2,k4,k8,k16].forEach(b=>{ if(!b) return; b.style.background='#2a2012'; b.style.color='#fff8dc'; b.classList.remove('on'); });
  const a = n===1?k1:n===2?k2:n===4?k4:n===8?k8:k16;
  if(a){ 
    if(n===1||n===2) a.style.background='var(--amber)';
    else if(n===4) a.style.background='#ff3b30';
    else if(n===8) a.style.background='#b47aff';
    else if(n===16) a.style.background='#ffcc00';
    a.style.color=n===8?'#fff':'#000';
    a.classList.add('on');
  }
}
const SPEED_STEPS=[1,2,4,8,16,32,64];
const SPEED_TINT={1:'var(--amber)',2:'var(--amber)',4:'#ff3b30',8:'#b47aff',16:'#ffcc00',32:'#ff9a3c',64:'#ff5a2a'};
function setGameSpeed(n){
  // Topo: velocidades 1..64. Los botones se repintan por patron de id, no por id concreto:
  // asi agregar o quitar un boton del markup no puede dejar un reference roto (fue lo que rompio x32).
  const N=SPEED_STEPS.includes(n)?n:1;
  gameSpeed=N; turbo=N>1;
  for(const b of document.querySelectorAll('button[id]')){
    const m=/^(btnSpeed|btnVel|btnCorner)(\d+)(b?)$/.exec(b.id);
    if(!m) continue;
    const v=+m[2], on=v===N, corner=m[1]==='btnCorner';
    if(corner){ b.textContent = v===1 ? '▶' : 'x'+v; b.title = v===1?'Pausar':'velocidad x'+v; }
    b.style.background = on ? (SPEED_TINT[v]||'#ffcc00') : (corner?'#2a0f00':(m[1]==='btnVel'?'#3e2a14':'#2a2012'));
    b.style.color = on ? '#000' : '#fff8dc';
    b.style.borderColor = on ? '#000' : (corner?'#000':'#3a2a1a');
  }
  const bt=document.getElementById('btnTurbo');
  if(bt) bt.textContent='⚡x'+N;
  syncCorner(N);
  if(N>1) pushToast(W/2, H/2-18, '⚡ x'+N, N>=16?'#ff9a3c':(N>=8?'#b47aff':(N===4?'#ff3b30':'#ffcc00')),1.2);
  else pushToast(W/2, H/2-18, '▶ x1','#8a7a5a',0.9);
  try{ saveIfChanged(); }catch(e){}
}
document.getElementById('btnTurbo').onclick=()=>{
  const idx=SPEED_STEPS.indexOf(gameSpeed);
  setGameSpeed(SPEED_STEPS[(idx+1)%SPEED_STEPS.length]);
};
SPEED_STEPS.forEach(v=>{
  ['btnSpeed'+v,'btnSpeed'+v+'b','btnVel'+v,'btnCorner'+v].forEach(id=>{
    const el=document.getElementById(id);
    if(el && !el.dataset.wired){ el.dataset.wired='1'; el.addEventListener('click', ()=> setGameSpeed(v)); }
  });
});
document.getElementById('btnSpeed2')?.addEventListener('click', ()=> setGameSpeed(2));
document.getElementById('btnSpeed4')?.addEventListener('click', ()=> setGameSpeed(4));
document.getElementById('btnSpeed8')?.addEventListener('click', ()=> setGameSpeed(8));
document.getElementById('btnSpeed16')?.addEventListener('click', ()=> setGameSpeed(16));

document.getElementById('btnSpeed1b')?.addEventListener('click', ()=> setGameSpeed(1));
document.getElementById('btnCorner1')?.addEventListener('click', ()=> setGameSpeed(1));
setTimeout(()=>syncCorner(gameSpeed), 700);
document.getElementById('btnCorner2')?.addEventListener('click', ()=> setGameSpeed(2));
document.getElementById('btnCorner4')?.addEventListener('click', ()=> setGameSpeed(4));
document.getElementById('btnCorner8')?.addEventListener('click', ()=> setGameSpeed(8));
document.getElementById('btnCorner16')?.addEventListener('click', ()=> setGameSpeed(16));

// velAntBar - nueva barra VEL+OBRERAS sobre calendario
document.getElementById('btnVelPause')?.addEventListener('click', ()=>{ paused=!paused; hudStyle('btnVelPause', 'background', paused?'#ffcc00':'#1a140f'); document.getElementById('btnVelPause').style.color=paused?'#000':'#8a7a5a'; });
document.getElementById('btnVel1')?.addEventListener('click', ()=> setGameSpeed(1));
document.getElementById('btnVel2')?.addEventListener('click', ()=> setGameSpeed(2));
document.getElementById('btnVel4')?.addEventListener('click', ()=> setGameSpeed(4));
document.getElementById('btnVel8')?.addEventListener('click', ()=> setGameSpeed(8));
document.getElementById('btnVel16')?.addEventListener('click', ()=> setGameSpeed(16));


document.getElementById('btnCornerPause')?.addEventListener('click', ()=>{ paused=!paused; hudText('btnCornerPause', paused?'▶':'⏸'); document.getElementById('btnPause').textContent=paused?'▶':'⏸'; const c=document.getElementById('btnCornerPause'); if(paused){c.style.background='var(--red)'; c.style.color='#fff';} else {c.style.background='#1a140f'; c.style.color='#fff8dc';} });

document.getElementById('btnSpeed2b')?.addEventListener('click', ()=> setGameSpeed(2));
document.getElementById('btnSpeed4b')?.addEventListener('click', ()=> setGameSpeed(4));
// x8 and x16 not in ai-pane, but handle if exists
document.getElementById('btnSpeed8b')?.addEventListener('click', ()=> setGameSpeed(8));
document.getElementById('btnSpeed16b')?.addEventListener('click', ()=> setGameSpeed(16));

let _fastForwarding=false;
function passDays(nDays=1){
  if(_fastForwarding) return;
  if(nDays!==1) nDays=1; // solo 1 día para no exigir máquina
  _fastForwarding=true;
  const btn=document.getElementById('btnDay1');
  if(btn){ btn.textContent='⏳ 1 DÍA...'; btn.disabled=true; btn.style.opacity='0.6'; }
  pushToast(W/2, H/2-18, '⏩ Avanzando 1 DÍA real...', '#ff8800', 1.0);
  // Fast-forward real: corre el loop a x64 sin renderizar cada frame para no lagear
  const targetTime = time + nDays*DAY_LENGTH;
  const prevSpeed = gameSpeed;
  const wasPaused = paused;
  paused=false;
  // Desactivar render para ir rápido, solo lógica
  let steps=0;
  const maxStepsPerFrame = 12; // para no congelar UI
  function fastStep(){
    let inner=0;
    while(time < targetTime && inner < maxStepsPerFrame){
      // dt como en el loop normal pero a x64
      const dtMs = 16; // aprox 60fps
      let dt=dtMs*0.06 * 16; // x16 base para no desbordar, subdividido por maxStep
      // Usar el update real del juego si existe
      if(typeof updateWorld==='function'){
        updateWorld(dt);
      } else {
        // fallback: avanzar tiempo y simular un poco
        time += dt;
        // Simular crecimiento mínimo si no hay updateWorld
        for(let pl of plants) if(pl.growth<1) pl.growth = Math.min(1, pl.growth + 0.00012*dt);
      }
      time += dt*0.25; // pequeño extra para llegar a target
      if(time > targetTime) time = targetTime;
      inner++; steps++;
    }
    // Actualizar UI cada frame
    if(typeof updateDepthRuler==='function') try{ updateDepthRuler(); }catch(e){}
    if(time < targetTime){
      requestAnimationFrame(fastStep);
    } else {
      // Fin
      _fastForwarding=false;
      if(btn){ btn.textContent='⏩ +1 DÍA'; btn.disabled=false; btn.style.opacity='1'; }
      gameSpeed=prevSpeed; if(wasPaused) paused=true;
      pushToast(W/2, H/2-10, '✅ +1 DÍA completado', '#2de67a', 1.2);
      pushEvent('evo','⏩ +1 DÍA real simulado', 'Día '+Math.floor(time/DAY_LENGTH)+' - hormigas trabajaron el día entero');
      markSoilDirty();
      if(typeof drawFarm==='function') try{ drawFarm(document.getElementById('farmCanvas').getContext('2d'), W, H, false); }catch(e){}
    }
  }
  fastStep();
}
// Listeners para Pass Day
document.getElementById('btnDay1')?.addEventListener('click', ()=> passDays(1));



document.getElementById('btnTaskbar').onclick=()=>{taskbarMode=!taskbarMode; document.getElementById('taskbar').classList.toggle('visible',taskbarMode);};
document.getElementById('btnRestore').onclick=()=>{taskbarMode=false; document.getElementById('taskbar').classList.remove('visible');};
document.getElementById('btnTbFood').onclick=()=>{spawnFoodAt(CENTER_COL*CELL+8 + (Math.random()-0.5)*260, Math.random()*(H-120)+60,2); pushToast(W/2,H/2,'🍯','#ffcc00');};
document.querySelectorAll('.ai-tab').forEach(tab=>{
  tab.onclick=()=>{
    document.querySelectorAll('.ai-tab').forEach(t=>t.classList.remove('active'));
    tab.classList.add('active');
    hudStyle('tab-colony', 'display', tab.dataset.tab==='colony'?'block':'none');
    hudStyle('tab-brain', 'display', tab.dataset.tab==='brain'?'block':'none');
    hudStyle('tab-history', 'display', tab.dataset.tab==='history'?'block':'none');
  };
});
document.getElementById('btnSimple').onclick=()=>{
  hudStyle('simplePanel', 'display', 'block');
  hudStyle('expertPanel', 'display', 'none');
  hudStyle('btnSimple', 'background', 'var(--amber)'); document.getElementById('btnSimple').style.color='#000';
  hudStyle('btnExpert', 'background', '#2a2012'); document.getElementById('btnExpert').style.color='#fff8dc';
};
document.getElementById('btnExpert').onclick=()=>{
  hudStyle('simplePanel', 'display', 'none');
  hudStyle('expertPanel', 'display', 'block');
  hudStyle('btnExpert', 'background', 'var(--amber)'); document.getElementById('btnExpert').style.color='#000';
  hudStyle('btnSimple', 'background', '#2a2012'); document.getElementById('btnSimple').style.color='#fff8dc';
};
document.getElementById('btnClearHist').onclick=()=>{events=[]; renderEvents();};
window.addEventListener('keydown',e=>{
  if(e.code==='Space'){paused=!paused; e.preventDefault();}
  if(e.key==='1'){ setGameSpeed(1); }
  if(e.key==='2'){ setGameSpeed(2); }
  if(e.key==='4'){ setGameSpeed(4); }
  if(e.key==='8'){ setGameSpeed(8); }
  if(e.key==='6'){ setGameSpeed(16); }
  if(e.key==='m'||e.key==='M') document.getElementById('btnFood').click();
  if(e.key==='+'||e.key==='=') setZoom(view.zoom*1.2);
  if(e.key==='-'||e.key==='_') setZoom(view.zoom*0.82);
  if(e.key==='0'){view.x=205;view.y=12;view.zoom=1.38;clampView();updateZoomLabel();}
  { const b=getPanBounds(); if(e.key==='ArrowLeft') view.x=clamp(view.x-22,b.minX,b.maxX); if(e.key==='ArrowRight') view.x=clamp(view.x+22,b.minX,b.maxX); if(e.key==='ArrowUp') view.y=clamp(view.y-22,b.minY,b.maxY); if(e.key==='ArrowDown') view.y=clamp(view.y+22,b.minY,b.maxY); clampView(); }
  if(e.key.toLowerCase()==='o') document.getElementById('togEyes').click();
  if(e.key.toLowerCase()==='t') document.getElementById('togTrail').click();
  if(e.key.toLowerCase()==='i') document.getElementById('togInk').click();
  if(e.key.toLowerCase()==='f') document.getElementById('togFront').click();
});
// === ONBOARDING LOGIC ===
function buildOnSteps(){
  return [
    {
      title: "🐜 TU GRANJA",
      body: `<div style="display:flex;gap:12px;align-items:center"><div style="width:52px;height:52px;background:#fff8dc;border:3px solid #000;display:grid;place-items:center;font-size:24px;box-shadow:3px 3px 0 #000">🌍</div><div><div style="font-family:'Press Start 2P',monospace;font-size:9px;color:#ffcc00">3 HORMIGAS + REINA</div><div style="font-family:'VT323',monospace;font-size:18px;color:#fff8dc;margin-top:6px;line-height:1.25">Este es tu vidrio. Obsérvalas, aliméntalas y ve cómo construyen su mundo.</div></div></div>`,
      hint: "Tu colonia te espera"
    },
    {
      title: "🍯 COMIDA",
      body: `<div style="display:flex;gap:12px;align-items:center"><div style="width:52px;height:52px;background:#ffcc00;border:3px solid #000;display:grid;place-items:center;font-size:24px;box-shadow:3px 3px 0 #000">🍯</div><div><div style="font-family:'Press Start 2P',monospace;font-size:9px;color:#ffcc00">TOCA EL PASTO</div><div style="font-family:'VT323',monospace;font-size:18px;color:#fff8dc;margin-top:6px;line-height:1.25">Toca el pasto de arriba para soltar miel. La llevan a casa y la reina podrá poner huevos.</div></div></div>`,
      hint: "Toca el pasto"
    },
    {
      title: "💬 MÍRALAS",
      body: `<div style="display:flex;gap:12px;align-items:center"><div style="width:52px;height:52px;background:#000;border:3px solid #000;display:grid;place-items:center;font-size:20px;box-shadow:3px 3px 0 #000">👁️</div><div><div style="font-family:'Press Start 2P',monospace;font-size:9px;color:#2de67a">CADA UNA HABLA</div><div style="font-family:'VT323',monospace;font-size:18px;color:#fff8dc;margin-top:6px;line-height:1.25">Sobre su cabeza verás qué hace. Toca una para ver su ficha y seguirla.</div></div></div>`,
      hint: "Toca una hormiga"
    },
    {
      title: "🌧️ UN MUNDO VIVO",
      body: `<div style="display:flex;gap:12px;align-items:center"><div style="width:52px;height:52px;background:#7ec8e3;border:3px solid #000;display:grid;place-items:center;font-size:22px;box-shadow:3px 3px 0 #000">🌦️</div><div><div style="font-family:'Press Start 2P',monospace;font-size:9px;color:#7ec8e3">CLIMA Y TIEMPO REAL</div><div style="font-family:'VT323',monospace;font-size:18px;color:#fff8dc;margin-top:6px;line-height:1.25">Llueve, hace viento y pasa el tiempo. Todo sigue aunque no estés mirando.</div></div></div>`,
      hint: "Vive solo"
    }
  ];
}
let ON_STEPS = buildOnSteps();
let onIdx=0;
function renderOn(){
  ON_STEPS = buildOnSteps();
  const step=ON_STEPS[onIdx];
  hudHtml('onStep', `<div style="font-family:'Press Start 2P',monospace;font-size:10px;color:#fff;margin-bottom:12px">${step.title}</div>${step.body}`);
  hudHtml('onDots', ON_STEPS.map((_,i)=>`<span style="width:${i===onIdx?18:10}px;height:10px;background:${i===onIdx?'#ffcc00':'#2a2012'};border:2px solid #000;display:inline-block;box-shadow:2px 2px 0 #000"></span>`).join(''));
  hudText('onHint', step.hint);
  hudText('onNext', onIdx===ON_STEPS.length-1 ? 'EMPEZAR ✓' : 'SIGUIENTE →');
  hudStyle('onNext', 'background', onIdx===ON_STEPS.length-1 ? '#2de67a' : '#ffcc00');
  if(step.action) step.action();
}
function closeOn(){
  const el=document.getElementById('onboarding')||document.getElementById('onboardingLegacy')||document.getElementById('onboardingModal');
  if(!el) return;
  el.style.transition='opacity 0.3s'; el.style.opacity='0';
  setTimeout(()=>el.remove(),320);
  // quita el hide de solo colonia? No, lo mantenemos, pero avisamos
}
function attachOnHandlers(){
  const nxt=document.getElementById('onNext');
  const skp=document.getElementById('onSkip');
  const stp=document.getElementById('onStep');
  if(!nxt || !skp || !stp){ setTimeout(attachOnHandlers, 80); return; }
  // evitar doble listener
  if(nxt._onAttached) return; nxt._onAttached=true;
  nxt.addEventListener('click', (e)=>{
    e.preventDefault(); e.stopPropagation();
    if(onIdx < ON_STEPS.length-1){ onIdx++; renderOn(); }
    else closeOn();
  });
  skp.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); closeOn(); });
  try{ renderOn(); }catch(e){ console.error('onboarding render',e); }
  // fallback si sigue vacío tras 600ms
  setTimeout(()=>{
    const el=document.getElementById('onStep');
    if(el && !el.innerHTML.trim()){
      el.innerHTML=`<div style="font-family:'Press Start 2P',monospace;font-size:10px;color:#fff;margin-bottom:12px">🐜 TU GRANJA</div><div style="font-family:'VT323',monospace;font-size:18px;color:#fff8dc">Toca el pasto para soltar miel y mira cómo la llevan a casa. Toca una hormiga para ver su ficha.</div>`;
      console.warn('onboarding fallback injected');
    }
  }, 680);
}

// === REINA: perfil único clickeable (clase única) ===
function closeQueenProfile(immediate=false){
  const m=document.getElementById('queenProfile'); if(!m) return;
  if(immediate){
    m.style.transform='translateY(-12px) scaleY(0)';
    m.style.opacity='0';
    m.style.display='none';
    m.style.top='0'; m.style.height=''; m.style.right=''; m.style.width=''; m.style.maxWidth='';
    m.removeAttribute('data-open');
    m.removeAttribute('data-queen');
    clampView();
    return;
  }
  m.style.transform='translateY(-12px) scaleY(0)';
  m.style.opacity='0';
  m.removeAttribute('data-open');
  setTimeout(()=>{
    if(m.getAttribute('data-open')) return;
    m.style.display='none'; m.style.top='0'; m.style.height=''; m.style.right=''; m.style.width=''; m.style.maxWidth='';
    m.removeAttribute('data-queen');
    clampView();
  }, 220);
}
function showQueenProfile(q){
  if(!q) q=queens[selectedQueenIndex]||queens[0];
  if(!q) return;
  ensureQueenMeta(q);
  const modal=document.getElementById('queenProfile');
  if(!modal){ console.warn('queenProfile missing'); return; }
  const fac = society.factions.find(f=>f.id===q.faction);
  const facCol = fac? fac.color : '#b47aff';
  const facName = fac? fac.name : 'Colonia';
  // título
  const titleEl=document.getElementById('queenProfileTitle');
  if(titleEl) { titleEl.textContent = `${queenDisplayName(q)} 👑 REINA F${q.faction}`; titleEl.title=q.nameMeaning||''; }
  const dot=document.getElementById('queenProfileDot');
  if(dot) dot.style.background=facCol;
  // id / edad / vida
  const ageD=(q.age/DAY_LENGTH).toFixed(1), maxD=(q.maxAge/DAY_LENGTH).toFixed(1);
  const idEl=document.getElementById('queenProfileId');
  if(idEl) idEl.textContent = `${queenDisplayName(q)} (${q.id}) - ${ageD}d / ${maxD}d - ❤ ${Math.floor(q.health)}%`;
  const roleEl=document.getElementById('queenProfileRole');
  if(roleEl) roleEl.textContent = `REINA - F${q.faction} - ${facName} - GEN-${q.genome.gen} - ${q.genome.id} - LVL ${queenGrowthFromGenome(q.genome,q.age,q.maxAge).nivel}`;
  // mood
  const moodEl=document.getElementById('queenProfileMood');
  if(moodEl){
    moodEl.innerHTML='';
    for(let k in q.mood){
      const v=q.mood[k];
      const icons={joy:'😊',anger:'😠',fear:'😨',sadness:'😢',loyalty:'🤝',stress:'😓'};
      const col={joy:'#2de67a',anger:'#ff3b30',fear:'#ffcc00',sadness:'#6b7cff',loyalty:'#00e5ff',stress:'#ff8c00'}[k]||'#fff';
      const abbr={joy:'ALE',anger:'IRA',fear:'MIE',sadness:'TRI',loyalty:'LEA',stress:'EST'}[k]||k.slice(0,3).toUpperCase();
      const d=document.createElement('div');
      d.style.cssText='background:#000;border:1px solid #1a1a1a;padding:3px 2px;display:flex;flex-direction:column;align-items:center;gap:1px;line-height:1;text-align:center';
      d.innerHTML=`<span style="font-size:11px;line-height:1;color:${col}">${icons[k]||'●'}</span><span style="font-family:\'Press Start 2P\';font-size:5px;color:#8a7a5a;letter-spacing:0.2px">${abbr}</span><span style="font-family:\'Press Start 2P\';font-size:7px;color:${col}">${Math.round(v*100)}%</span>`;
      d.title=`${k} ${Math.round(v*100)}%`;
      moodEl.appendChild(d);
    }
  }
  // personalidad 6
  const persEl=document.getElementById('queenProfilePersonalities');
  if(persEl){
    persEl.innerHTML='';
    const pers=q.personality||queenPersonalityFromGenome(q.genome);
    const cols={fertilidad:'#ff6b9d', feromona:'#b47aff', maternal:'#2de67a', dominancia:'#ff3b30', resiliencia:'#00e5ff', longevidad:'#ffcc00'};
    const labels={fertilidad:'FERTIL', feromona:'FEROMONA', maternal:'MATERNAL', dominancia:'DOMIN', resiliencia:'RESIST', longevidad:'LONGEV'};
    for(let k of ['fertilidad','feromona','maternal','dominancia','resiliencia','longevidad']){
      const v=pers[k];
      const col=cols[k];
      const d=document.createElement('div');
      d.innerHTML=`<div style="display:flex;justify-content:space-between;font-family:Press Start 2P;font-size:7px;color:#8a7a5a"><span>${labels[k]}</span><span style="color:${col}">${v}</span></div><div style="height:8px;background:#000;border:1px solid #000;margin-top:2px"><div style="height:100%;width:${v}%;background:${col}"></div></div>`;
      persEl.appendChild(d);
    }
  }
  // traits genome
  const traitsEl=document.getElementById('queenProfileTraits');
  if(traitsEl){
    traitsEl.innerHTML='';
    const ttraits=q.traits||traitsFromGenome(q.genome);
    for(let k of ['exploracion','construccion','recoleccion','cuidado','comunica']){
      const v=ttraits[k];
      const col=k==='exploracion'?'#00e5ff':k==='construccion'?'#ff3b30':k==='recoleccion'?'#2de67a':k==='cuidado'?'#b47aff':'#ffcc00';
      const d=document.createElement('div');
      d.innerHTML=`<div style="display:flex;justify-content:space-between;font-family:Press Start 2P;font-size:7px;color:#8a7a5a"><span>${k.slice(0,4).toUpperCase()}</span><span style="color:${col}">${v}</span></div><div style="height:8px;background:#000;border:1px solid #000;margin-top:2px"><div style="height:100%;width:${v}%;background:${col}"></div></div>`;
      traitsEl.appendChild(d);
    }
  }
  // crecimiento / evolución
  const growth=queenGrowthFromGenome(q.genome,q.age,q.maxAge);
  const elLvl=document.getElementById('queenGrowthLvl'); if(elLvl) elLvl.textContent=growth.nivel;
  const elSize=document.getElementById('queenGrowthSize'); if(elSize) elSize.textContent=growth.talla+' px';
  const elProg=document.getElementById('queenGrowthProg'); if(elProg) elProg.textContent=growth.progreso+'% vida';
  const elHealth=document.getElementById('queenHealthVal'); if(elHealth) elHealth.textContent=Math.floor(q.health)+'%';
  const elEggs=document.getElementById('queenEggsLaid'); if(elEggs) elEggs.textContent=q.eggsLaid||0;
  const elBrood=document.getElementById('queenBroodCount'); if(elBrood) elBrood.textContent=brood.filter(b=> b.mother===q.id || (!b.mother && q===queens[0])).length;
  const elGen=document.getElementById('queenGenomeId'); if(elGen) elGen.textContent=`GEN-${q.genome.gen} - ${q.genome.id} - ${q.genome.hiddenSize} nodos`;
  const elDna=document.getElementById('queenDnaStr'); if(elDna) elDna.textContent=genomeToDNA(q.genome).slice(0,120);
  const workersOfFaction = workers.filter(w=>w.faction===q.faction).length;
  const elPop=document.getElementById('queenFollowers'); if(elPop) elPop.textContent=workersOfFaction+' obreras - F'+q.faction;
  const elState=document.getElementById('queenStateLabel'); if(elState) elState.textContent=q.state||'GRÁVIDA';
  const elProgBar=document.getElementById('queenProgressBar'); if(elProgBar) elProgBar.style.width=(q.progress||0)+'%';
  const elProgLbl=document.getElementById('queenProgressLbl'); if(elProgLbl) elProgLbl.textContent='huevo '+Math.floor(q.progress||0)+'%';
  // árbol / linaje
  const treeEl=document.getElementById('queenProfileTree');
  if(treeEl){
    let html='';
    if(q.parents && q.parents.length){
      html+=`<div>👑 Madre: <b style="color:#b47aff">${q.parents[0]}</b> <span style="color:#8a7a5a">+ ${q.parents[1]||'-'}</span></div><div style="margin:4px 0;color:#8a7a5a">↓</div>`;
    } else {
      html+=`<div style="color:#8a7a5a">Fundadora - sin padres registrados (Día 0)</div><div style="margin:4px 0">↓</div>`;
    }
    html+=`<div><b style="background:${facCol};color:#000;padding:1px 4px">${queenDisplayName(q)}</b> <span style="color:#8a7a5a">GEN-${q.genome.gen}</span> 👑</div>`;
    // hijos: buscar workers/queens con parents que incluyan q.id
    const kids = [...workers, ...queens].filter(o=> o.parents && o.parents.includes(q.id)).map(o=>o.id);
    const direct = q.children||[];
    const allKids = [...new Set([...direct, ...kids])];
    if(allKids.length){
      html+=`<div style="margin:6px 0;color:#8a7a5a">↓ ${allKids.length} descendientes directos</div><div style="line-height:1.6">${allKids.slice(0,12).join(' - ')}${allKids.length>12?' …':''}</div>`;
    } else {
      html+=`<div style="margin-top:6px;color:#8a7a5a">Sin descendencia registrada aún - pon el primer huevo</div>`;
    }
    treeEl.innerHTML=html;
  }
  // historial
  const histEl=document.getElementById('queenProfileHistory');
  if(histEl){
    histEl.innerHTML='';
    const h = q.history||[];
    if(h.length){
      h.slice(0,6).forEach(ev=>{
        const d=document.createElement('div');
        d.style.cssText='border-bottom:1px solid #1a1a1a;padding:4px 0';
        d.innerHTML=`<span style="color:#8a7a5a">D${ev.day||0} ${Math.floor(ev.time||0)}h</span> - ${ev.msg}`;
        histEl.appendChild(d);
      });
    } else {
      histEl.innerHTML='<span style="color:#8a7a5a">Sin historial - es joven. Cada huevo y migración quedará aquí.</span>';
    }
  }
  // canvas
  const pc=document.getElementById('queenProfileCanvas');
  if(pc){
    const pctx=pc.getContext('2d');
    pctx.imageSmoothingEnabled=false;
    pctx.clearRect(0,0,64,64);
    pctx.fillStyle='#000'; pctx.fillRect(0,0,64,64);
    pctx.fillStyle=facCol; pctx.fillRect(0,0,64,3);
    // sprite reina - 64 canvas como hormiga, centrado
    if(typeof queenSprite!=='undefined' && queenSpriteReady){
      try{
        const sw=queenSprite.width/2, sh=queenSprite.height;
        const frame = (q.progress||0)>72?1:0;
        pctx.drawImage(queenSprite, frame*sw,0,sw,sh, 8,10,48,34);
      }catch(e){ pctx.fillStyle='#c47a0a'; pctx.fillRect(16,18,32,24); }
    } else {
      pctx.fillStyle='#b47aff'; pctx.fillRect(18,20,28,18);
    }
    pctx.fillStyle='#fff'; pctx.font='bold 6px "Press Start 2P"'; pctx.textAlign='center'; pctx.fillText('REINA',32,56);
    pctx.font='5px "Press Start 2P"'; pctx.fillStyle=facCol; pctx.fillText('F'+q.faction,32,62);
  }
  // botones
  const btnFollow=document.getElementById('btnFollowQueen');
  if(btnFollow) btnFollow.onclick=()=>{
    // centrar cámara en reina
    const b2=getPanBounds(); view.x=clamp(q.x - W/view.zoom/2,b2.minX,b2.maxX); view.y=clamp(q.y - H/view.zoom/2,b2.minY,b2.maxY);
    pushEvent('evo',`👁 Siguiendo a ${queenDisplayName(q)}`, `Cámara centrada en reina F${q.faction}`);
  };
  const btnFeed=document.getElementById('btnFeedQueen');
  if(btnFeed) btnFeed.onclick=()=>{
    if(colonyFood>=2){
      colonyFood-=2; q.health=Math.min(100,q.health+18); q.mood.joy=Math.min(1,q.mood.joy+0.08); q.progress=Math.min(100,q.progress+18);
      if(!q.history) q.history=[]; q.history.unshift({day:day,time:q.age/3600,msg:'🍯 Alimentada por cuidadora +18% vida'});
      if(q.history.length>20) q.history.pop();
      pushEvent('food',`🍯 Reina ${queenDisplayName(q)} alimentada +18%`, `2 🍯 gastadas`);
      showQueenProfile(q);
      if(typeof updateColonyUI==='function') updateColonyUI();
    } else {
      if(typeof showNotify==='function') showNotify('warn','Sin comida','Necesitas 2 🍯 para alimentar a la reina',2500);
    }
  };
  const btnMove=document.getElementById('btnMoveQueen');
  if(btnMove) btnMove.onclick=()=>{
    // intentar migrar a cámara más grande
    const best=findLargestChamber();
    if(best && Math.hypot(best.x - q.x, best.y - q.y)>40){
      pushEvent('evo',`👑 ${queenDisplayName(q)} migra - orden del jugador`, `[${Math.floor(best.x/CELL)},${Math.floor(best.y/CELL)}]`);
      q.x=best.x; q.y=best.y;
      if(!q.history) q.history=[]; q.history.unshift({day:day,time:q.age/3600,msg:'🚚 Migración ordenada a cámara grande'});
      showQueenProfile(q);
    } else {
      if(typeof showNotify==='function') showNotify('warn','No hay cámara mejor','Cava una sala más grande primero',2500);
    }
  };
  // FIX: dropdown idéntico a hormiga - 220px, top bajo calendario, sin scroll interno, tabs
  try{ closeAntProfile(true); }catch(e){}
  const isOpenQ = modal.getAttribute('data-open')==='1' && modal.style.display!=='none';
  const prevQ = modal.getAttribute('data-queen');
  if(isOpenQ && prevQ===q.id){
    modal.style.transform='translateY(0) scaleY(1)'; modal.style.opacity='1';
    return;
  }
  if(isOpenQ){
    modal.style.display='none';
    modal.removeAttribute('data-open');
  }
  const calEl=document.getElementById('calendarWidget');
  const calH = calEl ? calEl.offsetHeight : 180;
    const _qTop = calEl ? (calEl.getBoundingClientRect().top||14) : 14;
  const _qOff = (_qTop && _qTop>2 && _qTop<100) ? Math.round(_qTop):14;
  modal.style.top = (_qOff + calH + 4) + 'px';
  modal.style.right = '14px';
  modal.style.left = 'auto';
  modal.style.width = '220px';
  modal.style.maxWidth = '220px';
  modal.style.height = '';
  modal.style.maxHeight = `calc(100vh - ${(_qOff + calH + 28)}px)`;
  modal.style.border = '4px solid #000';
  modal.style.borderTop = 'none';
  modal.style.boxShadow = '6px 6px 0 #000';
  modal.style.overflow='hidden';
  modal.style.transformOrigin='top';
  modal.style.transform='translateY(-12px) scaleY(0)';
  modal.style.opacity='0';
  modal.style.display='block';
  modal.setAttribute('data-open','1');
  modal.setAttribute('data-queen', q.id);
  void modal.offsetWidth;
  modal.style.transition='transform 0.22s cubic-bezier(.2,.8,.2,1), opacity 0.22s';
  modal.style.transform='translateY(0) scaleY(1)';
  modal.style.opacity='1';
  // tabs idénticos a hormiga - 4 pestañas rasgo/estado/arbol/hist
  try{
    const tabs=modal.querySelectorAll('#queenProfileTabs [data-qtab]');
    const panes={rasgos:document.getElementById('queenTab_rasgos'), estado:document.getElementById('queenTab_estado'), arbol:document.getElementById('queenTab_arbol'), hist:document.getElementById('queenTab_hist')};
    tabs.forEach(btn=>{
      btn.onclick=(e)=>{
        e.stopPropagation();
        tabs.forEach(b=>{ b.style.background='#1a140f'; b.style.color='#8a7a5a'; });
        btn.style.background='var(--amber)'; btn.style.color='#000';
        const tab=btn.dataset.qtab;
        for(let k in panes){ if(panes[k]) panes[k].style.display = (k===tab?'block':'none'); }
      };
    });
    tabs.forEach(b=>{ b.style.background='#1a140f'; b.style.color='#8a7a5a'; });
    const first=modal.querySelector('#queenProfileTabs [data-qtab="rasgos"]');
    if(first){ first.style.background='var(--amber)'; first.style.color='#000'; }
    for(let k in panes){ if(panes[k]) panes[k].style.display = (k==='rasgos'?'block':'none'); }
  }catch(e){}
  clampView(); updateZoomLabel();
  selectedQueenIndex=queens.indexOf(q);
}


// === CALENDARIO DE LA COLONIA - Sistema único colmena (inspirado Stardew pero propio) ===
// Estudiado Stardew: 28 días/estación, 4 estaciones/año, 112 días/año, calendario mural con 28 casillas y HUD fecha+hora.
// Nuestro sistema único: 12 días/estación, 4 estaciones, 48 días/año, semana de 6 días (roles hormiga), HUD compacto + modal 3x4.
let calViewYear=1, calViewSeason=0;
const CAL_WEEKDAYS = ['OBRERA','EXCAVADORA','EXPLORADORA','NODRIZA','TEJEDORA','REPOSO'];
const CAL_WEEK_ABBR = ['OBR','EXC','EXP','NOD','TEJ','REP'];
const CAL_SEASONS = [
  {id:'brote', name:'BROTE', long:'Primavera', icon:'🌱', color:'#2de67a', bg:'#1e3a1e', desc:'Brote - todo germina'},
  {id:'sol', name:'SOL', long:'Verano', icon:'☀️', color:'#ffcc00', bg:'#3a2d0a', desc:'Sol - calor y cosecha rápida'},
  {id:'cosecha', name:'COSECHA', long:'Otoño', icon:'🍂', color:'#c2a080', bg:'#3a1e0a', desc:'Cosecha - bayas y hongos'},
  {id:'escarcha', name:'ESCARCHA', long:'Invierno', icon:'❄️', color:'#7ec8e3', bg:'#1a2a3a', desc:'Escarcha - lento y frío'}
];
function getCalendarData(atDay=null, atTime=null){
  const d = atDay!==null? atDay : (typeof day!=='undefined'? day : 1);
  const tm = atTime!==null? atTime : (typeof time!=='undefined'? time : 0);
  const year = Math.floor((d-1)/48)+1;
  const dayOfYear = ((d-1)%48)+1;
  const seasonIdx = Math.floor((d-1)/12)%4;
  const dayOfSeason = ((d-1)%12)+1;
  const weekIdx = ((d-1)%6);
  const weekDay = CAL_WEEKDAYS[weekIdx];
  const weekAbbr = CAL_WEEK_ABBR[weekIdx];
  const weekOfSeason = Math.floor((dayOfSeason-1)/6)+1; // 1-2
  const weekOfYear = Math.floor((dayOfYear-1)/6)+1; // 1-8
  const season = CAL_SEASONS[seasonIdx];
  const gameHour = (tm % DAY_LENGTH) / DAY_LENGTH * 24;
  const hour = Math.floor(gameHour);
  const minute = Math.floor((gameHour - hour)*60);
  const isDay = gameHour>=4.5 && gameHour<=19.5;
  const isDusk = (gameHour>19.5 && gameHour<20.5) || (gameHour>5 && gameHour<5.8);
  const dayProgress = ((tm % DAY_LENGTH)/DAY_LENGTH);
  const seasonProgress = (dayOfSeason-1)/12;
  const yearProgress = (dayOfYear-1)/48;
  return {d, year, dayOfYear, seasonIdx, dayOfSeason, weekIdx, weekDay, weekAbbr, weekOfSeason, weekOfYear, season, gameHour, hour, minute, isDay, isDusk, dayProgress, seasonProgress, yearProgress};
}
let _calClockCanvas=null, _calClockCtx=null;
function drawCalClock(gameHour, isDay, seasonIdx){
  if(!_calClockCanvas) { _calClockCanvas=document.getElementById('calClock'); if(!_calClockCanvas) return; _calClockCtx=_calClockCanvas.getContext('2d'); }
  const ctx=_calClockCtx; let W=124, H=18;
  ctx.imageSmoothingEnabled=false;
  ctx.clearRect(0,0,W,H);
  // arco base (ya en tu arte, pero lo redibujamos para animar hormiga encima)
  ctx.strokeStyle='#1a0f00'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(6,14); ctx.quadraticCurveTo(W/2,2,W-6,14); ctx.stroke();
  ctx.strokeStyle='rgba(0,0,0,0.10)'; ctx.setLineDash([2,2]); ctx.beginPath(); ctx.moveTo(W*0.33,14); ctx.lineTo(W*0.33,5); ctx.stroke(); ctx.beginPath(); ctx.moveTo(W*0.67,14); ctx.lineTo(W*0.67,5); ctx.stroke(); ctx.setLineDash([]);
  ctx.font='6px monospace'; ctx.textAlign='center'; ctx.fillStyle='#8a7a5a'; ctx.fillText('☀', W/2, 8);
  ctx.font='6px monospace'; ctx.fillStyle='#7ec8e3'; ctx.fillText('☾',4,10); ctx.fillText('☾',W-4,10);
  // hormiguita caminando sobre arco - 100% fiel a tus hormigas sueltas (marrón 3 segmentos)
  let t, px, py, flip=1;
  if(gameHour>=6 && gameHour<18){ t=(gameHour-6)/12; px=6+(W-12)*t; py=14 - Math.sin(Math.PI*t)*10; flip=t<0.52?1:-1; }
  else { let nt=gameHour>=18?(gameHour-18)/12:(gameHour+6)/12; px=6+(W-12)*nt; py=12; }
  ctx.fillStyle='rgba(0,0,0,0.22)'; ctx.fillRect(px-4, py+2, 8, 1);
  ctx.save(); ctx.translate(px,py); ctx.scale(flip,1);
  const bob=Math.sin(Date.now()*0.007 + gameHour)*0.45; ctx.translate(0,bob);
  ctx.fillStyle='#1a0a00'; ctx.fillRect(-5,-2,10,4);
  ctx.fillStyle='#7a2a0a'; ctx.fillRect(-4,-1,8,2);
  ctx.fillStyle='#000'; ctx.fillRect(-6,-1,1,1);
  const ph=Date.now()*0.012; for(let i=0;i<2;i++){ const sw=Math.sin(ph+i)*0.9; ctx.fillStyle='#1a0a00'; ctx.fillRect(-2+sw*0.3,2,1,1); }
  if(gameHour<6||gameHour>=18){ ctx.fillStyle='#7dd3ff'; ctx.font='5px "Press Start 2P"'; ctx.textAlign='center'; ctx.fillText('Z',6,-4); }
  ctx.restore();
}

function updateCalendarWidget(){
  try{
    const cal=getCalendarData();
    // fondo estación (nuevo id calSeasonBG, compat con calSeasonBox)
    const seasonBox=document.getElementById('calSeasonBG') || document.getElementById('calSeasonBox');
    const iconEl=document.getElementById('calSeasonIcon');
    const nameEl=document.getElementById('calSeasonName');
    const yearEl=document.getElementById('calYear');
    const dayNumEl=document.getElementById('calDayNum');
    const weekEl=document.getElementById('calWeekday');
    const seasonDayEl=document.getElementById('calSeasonDay');
    const dateFullEl=document.getElementById('calDateFull');
    const worldAgeEl=document.getElementById('calWorldAge');
    const dayBar=document.getElementById('calDayBar');
    const seasonBar=document.getElementById('calSeasonBar');
    const timeEl=document.getElementById('calTimeText');
    const weaEl=document.getElementById('calWea');
    const dayNightEl=document.getElementById('calDayNightLabel');
    if(iconEl) iconEl.textContent=cal.season.icon;
    if(nameEl) { nameEl.textContent=cal.season.name; nameEl.style.color='#000'; }
    if(yearEl) yearEl.textContent='AÑO '+cal.year;
    if(seasonBox){
      const bannerCols=['#3aa99e','#ffcc33','#d07a2e','#cfe9ff'];
      const borderCols=['#0f3a35','#7a4a00','#5a2a0a','#1a3a5a'];
      seasonBox.className='cal-season-bg s-'+['prima','vera','oto','inv'][cal.seasonIdx];
      seasonBox.style.background=bannerCols[cal.seasonIdx]||bannerCols[0];
      seasonBox.style.borderColor=borderCols[cal.seasonIdx]||borderCols[0];
      seasonBox.style.color='#000';
    }
    const soilEl=document.getElementById('calSoil');
    if(soilEl){
      const soilCols=['#5a7a3a','#8b5a2b','#c46a1a','#3d2a1a'];
      soilEl.style.background=soilCols[cal.seasonIdx]||soilCols[0];
      // borde superior nieve en escarcha
      if(cal.seasonIdx===3) soilEl.style.borderTop='4px solid #e0f0ff';
      else soilEl.style.borderTop='4px solid #1a0f00';
    }
    if(dayNumEl) dayNumEl.textContent=cal.dayOfSeason;
    if(weekEl) weekEl.textContent=cal.weekDay;
    if(seasonDayEl) seasonDayEl.innerHTML='Season day<br><b>'+cal.dayOfSeason+'/12 Sem '+cal.weekOfSeason+'</b>';
    if(dateFullEl) dateFullEl.textContent='DÍA '+cal.dayOfSeason+' - AÑO '+cal.year;
    if(worldAgeEl){
      // fiel a tu arte: World Age: 39 039 in world (usa tiempo total)
      const wAge = Math.floor(time/10).toLocaleString();
      worldAgeEl.innerHTML='World Age:<br>'+wAge+' in world';
    }
    if(dayBar) dayBar.style.width=Math.floor(cal.dayOfSeason/12*100)+'%';
    if(seasonBar){
      const barCols=['#2de67a','#ffcc00','#8b5a2b','#7ec8e3'];
      seasonBar.style.width=Math.floor(cal.seasonProgress*100)+'%';
      seasonBar.style.background=barCols[cal.seasonIdx]||barCols[0];
    }
    if(timeEl){
      const hh=String(cal.hour).padStart(2,'0'), mm=String(cal.minute).padStart(2,'0');
      timeEl.textContent=hh+':'+mm;
      timeEl.style.color= cal.isDay? '#ffcc00' : '#7ec8e3';
    }
    if(dayNightEl){
      let label='DÍA';
      if(cal.gameHour<4.5 || cal.gameHour>19.5) label='NOCHE';
      else if(cal.gameHour<6) label='AMANECER';
      else if(cal.gameHour>19) label='ANOCHECER';
      else if(cal.gameHour>=12 && cal.gameHour<14) label='MEDIODÍA';
      dayNightEl.textContent=label;
      dayNightEl.style.color= cal.isDay? '#ffcc00' : '#7ec8e3';
    }
    if(weaEl){
      try{
        const wMap={clear:'☀️', cloudy:'☁️', rain:'🌧', storm:'⛈'};
        const wtype=(typeof weather!=='undefined' && weather && weather.type) ? weather.type : 'clear';
        weaEl.textContent=wMap[wtype]||'☀️';
        weaEl.title= wtype+' - '+cal.season.long;
      }catch(_){ weaEl.textContent='☀️'; }
    }
    drawCalClock(cal.gameHour, cal.isDay, cal.seasonIdx);
    // debug visible
    if(window._calDbg) console.log('CAL UPDATE', cal.dayOfSeason, cal.season.name, cal.hour+':'+String(cal.minute).padStart(2,'0'));
    const tl=document.getElementById('timeLabel');
    if(tl){
      const hh=String(cal.hour).padStart(2,'0'), mm=String(cal.minute).padStart(2,'0');
      tl.textContent=hh+':'+mm;
      tl.style.color= cal.isDay? '#ffcc00' : '#7ec8e3';
    }
    const ecoAge=document.getElementById('ecoAge');
    if(ecoAge) ecoAge.textContent='Año '+cal.year+' - Día '+cal.dayOfSeason+' '+cal.season.name;
  }catch(e){ /* no crash */ }
}

// === RELOJ DE LA COLONIA - INTEGRADO 444x244 escalado a 360x198 + MINIMIZADO ===
(() => {
  const CFG_RC = { DAYS_PER_SEASON: 12, DAYS_PER_WEEK: 3, CASTES: ['OBRERA','SOLDADO','EXPLORADORA'] };
  const SEASONS_RC = [
    { id:'brote',    name:'BROTE',    icon:'sprout', bn:'#3fa07a', bh:'#6fd0a4', bd:'#1f5c45', bar:'#58c042' },
    { id:'sol',      name:'SOL',      icon:'sun',    bn:'#f3c326', bh:'#ffe36a', bd:'#b8860b', bar:'#f0b020' },
    { id:'cosecha',  name:'COSECHA',  icon:'leaf',   bn:'#c0661a', bh:'#e8923f', bd:'#7a3b0c', bar:'#e0701e' },
    { id:'escarcha', name:'ESCARCHA', icon:'flake',  bn:'#8fbfe0', bh:'#c4e4f7', bd:'#4f84ab', bar:'#6fc3e8' }
  ];
  function rcMakeSprite(rows,pal,scale=1){
    const h=rows.length,w=rows[0].length;
    const c=document.createElement('canvas'); c.width=w*scale; c.height=h*scale;
    const g=c.getContext('2d');
    for(let y=0;y<h;y++) for(let x=0;x<w;x++){
      const ch=rows[y][x];
      if(ch!=='.' && pal[ch]){ g.fillStyle=pal[ch]; g.fillRect(x*scale,y*scale,scale,scale); }
    }
    return c;
  }
  const RC_ANT_PAL={a:'#2a1a10',t:'#3d2616',h:'#2a1a10',l:'#140a04',x:'#140a04',r:'#7a3a1a'};
  const RC_ANT_A=['l..l.l....x.','.aaa.ttt.hh.','aaaar.tt.hhh','.aaa.ttt.hh.','l.l..l....x.','............'];
  const RC_ANT_B=['.l..l.l...x.','.aaa.ttt.hh.','aaaar.tt.hhh','.aaa.ttt.hh.','..l.l..l..x.','............'];
  const rcAntCanvasA=rcMakeSprite(RC_ANT_A,RC_ANT_PAL), rcAntCanvasB=rcMakeSprite(RC_ANT_B,RC_ANT_PAL);
  const rcAntUrlA=rcAntCanvasA.toDataURL(), rcAntUrlB=rcAntCanvasB.toDataURL();
  const RC_ICONS={
    sprout:{pal:{g:'#7bd04a',G:'#3f9a2c',s:'#2f6f1e'},rows:['.........','..gg.gg..','.gGGgGGg.','.gGGgGGg.','..gg.gg..','....s....','....s....','....s....','.........']},
    sun:{pal:{o:'#ffb21e',y:'#ffe14a'},rows:['....o....','.o.....o.','..yyyyy..','..yyyyy..','oyyyyyyyo','..yyyyy..','..yyyyy..','.o.....o.','....o....']},
    leaf:{pal:{l:'#f3a21b',L:'#e8531e',s:'#5a2e0c'},rows:['......ll.','....llLl.','...llLLl.','..llLLLl.','..lLLLl..','.lLLLl...','slLLl....','s.ll.....','s........']},
    flake:{pal:{w:'#ffffff'},rows:['....w....','.w..w..w.','..w.w.w..','...www...','wwwwwwwww','...www...','..w.w.w..','.w..w..w.','....w....']},
    moon:{pal:{m:'#ffe9a0',d:'#d9b95a'},rows:['...mmm...','..mmd....','.mmd.....','.mmd.....','.mmd.....','.mmd.....','..mmd....','...mmmm..','.........']}
  };
  function rcIconURL(name,scale=2){ const i=RC_ICONS[name]; return rcMakeSprite(i.rows,i.pal,scale).toDataURL(); }
  const RC_LW=222, RC_LH=122;
  function rcRng(seed){ return ()=>{ seed|=0; seed=seed+0x6D2B79F5|0; let t=Math.imul(seed ^ seed>>>15,1|seed); t=t+Math.imul(t ^ t>>>7,61|t)^t; return ((t ^ t>>>14)>>>0)/4294967296; };}
  function rcPx(g,x,y,w,h,c){ g.fillStyle=c; g.fillRect(Math.round(x),Math.round(y),w,h); }
  function rcBrush(g,x,y,r,c){ for(let dy=-r;dy<=r;dy++) for(let dx=-r;dx<=r;dx++) if(dx*dx+dy*dy<=r*r+1) rcPx(g,x+dx,y+dy,1,1,c); }
  function rcPath(g,pts,r,c){ for(let i=0;i<pts.length-1;i++){ const [x0,y0]=pts[i],[x1,y1]=pts[i+1]; const n=Math.max(Math.abs(x1-x0),Math.abs(y1-y0)); for(let s=0;s<=n;s++) rcBrush(g,x0+(x1-x0)*s/n,y0+(y1-y0)*s/n,r,c);} }
  const RC_THEMES={
    brote:{soil:['#6b4423','#7d5230','#5a371b','#8a5d36'],tun:'#3d2412',rim:'#4d2f18',stone:['#8d8378','#6e665c']},
    sol:{soil:['#b98a50','#c99a60','#a67a42','#d9b27a'],tun:'#8a5a2a',rim:'#9c6c36',stone:['#e0c89c','#c4a574']},
    cosecha:{soil:['#c96f17','#dc8528','#b25f12','#e69a35'],tun:'#7a3f0a',rim:'#963f0d',stone:['#e8b06a','#a0541a']},
    escarcha:{soil:['#5b3a22','#6a4629','#4b2f1b','#76522f'],tun:'#2e1c10',rim:'#3a2314',stone:['#8fa3b5','#6d8196']}
  };
  function rcDrawTop(g,id,r){
    for(let x=0;x<RC_LW;x++){
      const h=10+Math.floor(r()*3);
      if(id==='brote'){ for(let y=0;y<h;y++) rcPx(g,x,y,1,1,y<3?'#7bd04a':y<h-3?'#4caf3a':'#2f7d2a'); rcPx(g,x,h,1,1,'#24591b'); if(r()<.18) rcPx(g,x,-1+Math.floor(r()*2),1,3,'#7bd04a'); }
      else if(id==='sol'){ for(let y=0;y<h;y++) rcPx(g,x,y,1,1,y<3?'#f2d768':y<h-3?'#dfb344':'#a87a2a'); rcPx(g,x,h,1,1,'#7a5518'); }
      else if(id==='cosecha'){ for(let y=0;y<h;y++) rcPx(g,x,y,1,1,y<h-3?'#8a4a14':'#6a3510'); rcPx(g,x,h,1,1,'#4a2408'); }
      else { for(let y=0;y<h-2;y++) rcPx(g,x,y,1,1,y<4?'#f4faff':'#c9e2f5'); if(r()<.3){ const len=2+Math.floor(r()*4); for(let k=0;k<len;k++) rcPx(g,x,h-2+k,1,1,'#dff0fb'); } }
    }
    if(id==='cosecha'){
      const cols=['#e8531e','#f3a21b','#b8360f','#d9801a'];
      for(let i=0;i<34;i++){ const lx=Math.floor(r()*(RC_LW-4)), ly=Math.floor(r()*10)-1, c=cols[Math.floor(r()*4)]; rcPx(g,lx,ly,3,2,c); rcPx(g,lx+1,ly-1,1,1,c); rcPx(g,lx+2,ly+2,1,1,'#4a2408'); }
    }
    if(id==='brote'){ for(let i=0;i<6;i++){ const sx=12+Math.floor(r()*(RC_LW-24)); rcPx(g,sx,-3,1,4,'#3f9a2c'); rcPx(g,sx-2,-4,2,2,'#7bd04a'); rcPx(g,sx+1,-5,2,2,'#7bd04a'); } }
  }
  function rcDrawBackground(canvas,id,seed){
    const g=canvas.getContext('2d'); g.imageSmoothingEnabled=false;
    const T=RC_THEMES[id], r=rcRng(seed);
    for(let y=0;y<RC_LH;y++) for(let x=0;x<RC_LW;x++){ const v=r(); rcPx(g,x,y,1,1,v<.70?T.soil[0]:v<.82?T.soil[1]:v<.94?T.soil[2]:T.soil[3]); }
    for(let i=0;i<40;i++) rcPx(g,r()*RC_LW,14+r()*(RC_LH-14),3+r()*5,1+r()*2,T.soil[1]);
    for(let i=0;i<16;i++){ const sx=r()*(RC_LW-5), sy=16+r()*(RC_LH-20), sw=2+Math.floor(r()*3); rcPx(g,sx,sy,sw,2,T.stone[0]); rcPx(g,sx,sy+2,sw,1,T.stone[1]); }
    const main=[[212,78],[196,80],[180,87],[160,95],[140,99],[120,96],[100,100],[80,106],[58,108],[34,104]];
    rcPath(g,main,5,T.rim); rcPath(g,main,4,T.tun);
    const branch=[[140,99],[146,108],[150,114]]; rcPath(g,branch,4,T.rim); rcPath(g,branch,3,T.tun);
    [[150,114,7],[34,104,6]].forEach(([cx,cy,rr])=>{ rcBrush(g,cx,cy,rr+1,T.rim); rcBrush(g,cx,cy,rr,T.tun); });
    for(let dx=-10;dx<=10;dx++) for(let dy=-7;dy<=7;dy++){ const e=(dx*dx)/100+(dy*dy)/49; if(e<=1.25) rcPx(g,208+dx,76+dy,1,1,e<=1?T.tun:T.rim); }
    for(let dx=-12;dx<=12;dx++) rcPx(g,208+dx,68-Math.round(Math.sqrt(Math.max(0,1-dx*dx/144))*3),1,2,T.soil[1]);
    rcDrawTop(g,id,r);
    const n=11; for(let i=0;i<n;i++){ const ax=10+Math.floor(r()*(RC_LW-30)), ay=22+Math.floor(r()*(RC_LH-36)); const rot=Math.floor(r()*4), flip=r()<.5; g.save(); g.translate(ax+6,ay+3); g.rotate(rot*Math.PI/2); if(flip) g.scale(-1,1); g.drawImage(r()<.5?rcAntCanvasA:rcAntCanvasB,-6,-3); g.restore(); }
  }
  const rcBgsEl=document.getElementById('rcBgs');
  const rcBannersEl=document.getElementById('rcBanners');
  if(rcBgsEl && rcBannersEl){
    SEASONS_RC.forEach((s,i)=>{
      const cv=document.createElement('canvas'); cv.width=RC_LW; cv.height=RC_LH; cv.className='rc-bg'; cv.style.width='444px'; cv.style.height='244px'; rcBgsEl.appendChild(cv);
      rcDrawBackground(cv,s.id,1000+i*77); s.canvas=cv;
      const b=document.createElement('div'); b.className='rc-banner'; b.style.setProperty('--bn',s.bn); b.style.setProperty('--bh',s.bh); b.style.setProperty('--bd',s.bd);
      const l=new Image(), rImg=new Image(); l.src=rImg.src=rcIconURL(s.icon,2);
      const t=document.createElement('span'); t.textContent=s.name;
      b.append(l,t,rImg); rcBannersEl.appendChild(b); s.banner=b;
    });
  }
  const rcSun=document.getElementById('rcIcoSun'), rcMoon=document.getElementById('rcIcoMoon');
  if(rcSun) rcSun.src=rcIconURL('sun',2);
  if(rcMoon) rcMoon.src=rcIconURL('moon',2);

  const rcEl={
    time:document.getElementById('rcTime'), phase:document.getElementById('rcPhase'), walker:document.getElementById('rcWalker'), night:document.getElementById('rcNight'),
    big:document.getElementById('rcBigday'), caste:document.getElementById('rcCaste'), diaN:document.getElementById('rcDiaN'), anoN:document.getElementById('rcAnoN'), sday:document.getElementById('rcSdayV'),
    world:document.getElementById('rcWorldV'), pfill:document.getElementById('rcPfill'), snow:document.getElementById('rcSnowcap'), sun:rcSun, moon:rcMoon,
    miniTime:document.getElementById('rcMiniTime'), miniDay:document.getElementById('rcMiniDay'), miniSeason:document.getElementById('rcMiniSeason'), miniIcon:document.getElementById('rcMiniIcon'), miniWrap:document.getElementById('rcMini'), miniBar:document.getElementById('rcMiniBar')
  };
  function rcPhaseOf(h){ if(h>=5&&h<10) return 'AMANECER'; if(h>=10&&h<16) return 'MEDIODÍA'; if(h>=16&&h<20) return 'TARDE'; return 'NOCHE'; }
  function rcNightAmt(h){ if(h>=22||h<4) return 1; if(h>=20) return (h-20)/2; if(h<6) return 1-(h-4)/2; return 0; }
  const RC_P0=[17,46+30], RC_P1=[66,-8+30], RC_P2=[115,46+30];
  function rcArcPoint(t){ const u=1-t; const x=u*u*RC_P0[0]+2*u*t*RC_P1[0]+t*t*RC_P2[0]; const y=u*u*RC_P0[1]+2*u*t*RC_P1[1]+t*t*RC_P2[1]; const dx=2*u*(RC_P1[0]-RC_P0[0])+2*t*(RC_P2[0]-RC_P1[0]); const dy=2*u*(RC_P1[1]-RC_P0[1])+2*t*(RC_P2[1]-RC_P1[1]); return {x,y,a:Math.atan2(dy,dx)}; }
  function rcPlaceWalker(h){
    if(!rcEl.walker) return;
    let t,dir; if(h>=5&&h<21){ t=(h-5)/16; dir=1; } else { const hh=h>=21?h-21:h+3; t=1-hh/8; dir=-1; }
    const p=rcArcPoint(Math.min(1,Math.max(0,t)));
    rcEl.walker.style.left=p.x+'px'; rcEl.walker.style.top=p.y+'px';
    rcEl.walker.style.transform=`translate(-50%,-90%) rotate(${p.a}rad) scaleX(${dir})`;
  }
  function rcSetSeason(idx){
    SEASONS_RC.forEach((s,i)=>{ s.canvas&&s.canvas.classList.toggle('on',i===idx); s.banner&&s.banner.classList.toggle('on',i===idx); });
    if(rcEl.pfill) rcEl.pfill.style.backgroundColor=SEASONS_RC[idx].bar;
    if(rcEl.snow) rcEl.snow.classList.toggle('on',SEASONS_RC[idx].id==='escarcha');
    if(rcEl.miniWrap) rcEl.miniWrap.style.setProperty('--rc-mini-bg', SEASONS_RC[idx].bn);
    if(rcEl.miniBar) rcEl.miniBar.style.backgroundColor=SEASONS_RC[idx].bar;
    if(rcEl.miniSeason){ rcEl.miniSeason.style.setProperty('--bn', SEASONS_RC[idx].bn); rcEl.miniSeason.style.background=SEASONS_RC[idx].bn; }
  }
  let rcLastSeason=-1, rcLastDay=-1, rcLastMinute=-1, rcLastPhase='';
  window.updateRcClock = function(){
    try{
      const cal = (typeof getCalendarData==='function') ? getCalendarData() : null;
      if(!cal) return;
      const season = cal.seasonIdx;
      const dayInSeason = cal.dayOfSeason;
      const year = cal.year;
      const dayIdx = cal.d -1;
      const hour = cal.gameHour;
      const minute = cal.minute;
      const totalMin = (typeof time!=='undefined'? time/10 : dayIdx*1440+hour*60+minute);
      if(season!==rcLastSeason){ rcSetSeason(season); rcLastSeason=season; }
      if(dayInSeason!==rcLastDay){
        if(rcEl.big) { rcEl.big.textContent=dayInSeason; rcEl.big.classList.remove('pop'); void rcEl.big.offsetWidth; rcEl.big.classList.add('pop'); }
        if(rcEl.caste) rcEl.caste.textContent=CFG_RC.CASTES[(dayInSeason-1)%CFG_RC.CASTES.length];
        if(rcEl.diaN) rcEl.diaN.textContent=cal.d;
        if(rcEl.anoN) rcEl.anoN.textContent=year;
        if(rcEl.sday) rcEl.sday.textContent=`${dayInSeason}/12 Sem ${cal.weekOfSeason}`;
        if(rcEl.miniDay) rcEl.miniDay.textContent=dayInSeason;
        if(rcEl.miniSeason){
          const s=SEASONS_RC[season];
          const nameEl=document.getElementById('rcMiniSeasonName');
          if(nameEl) nameEl.textContent=s.name;
          if(rcEl.miniIcon) rcEl.miniIcon.src=rcIconURL(s.icon,2);
        }
        rcLastDay=dayInSeason;
      }
      const curMinute = Math.floor(hour*60+minute);
      if(curMinute!==rcLastMinute){
        if(rcEl.time) rcEl.time.textContent=`${String(cal.hour).padStart(2,'0')}:${String(cal.minute).padStart(2,'0')}`;
        if(rcEl.world) rcEl.world.textContent=`${String(Math.floor(totalMin)).replace(/\B(?=(\d{3})+(?!\d))/g,' ')} min`;
        if(rcEl.miniTime) rcEl.miniTime.textContent=`${String(cal.hour).padStart(2,'0')}:${String(cal.minute).padStart(2,'0')}`;
        const ph=rcPhaseOf(hour);
        if(ph!==rcLastPhase){
          if(rcEl.phase) rcEl.phase.textContent=ph; rcLastPhase=ph;
          const isNight=ph==='NOCHE';
          if(rcEl.sun) rcEl.sun.style.filter=isNight?'grayscale(1) brightness(.6)':'none';
          if(rcEl.moon) rcEl.moon.style.filter=isNight?'none':'grayscale(1) brightness(.7)';
        }
        rcLastMinute=curMinute;
      }
      const frac=(dayInSeason-1 + (hour*60+minute)/1440)/12;
      if(rcEl.pfill) rcEl.pfill.style.width=(frac*100).toFixed(2)+'%';
      if(rcEl.miniBar){ rcEl.miniBar.style.width=(frac*100).toFixed(2)+'%'; rcEl.miniBar.style.backgroundColor=SEASONS_RC[season].bar; }
      if(rcEl.night) rcEl.night.style.opacity=(rcNightAmt(hour)*0.42).toFixed(3);
      rcPlaceWalker(hour);
    }catch(e){ console.warn('rc update',e); }
  };
  // walker animation flip
  let rcFlip=false;
  if(rcEl.walker) rcEl.walker.src=rcAntUrlA;
  setInterval(()=>{ rcFlip=!rcFlip; if(rcEl.walker) rcEl.walker.src=rcFlip?rcAntUrlB:rcAntUrlA; },220);
  // hook into existing updateCalendarWidget
  const _origUpdateCal = window.updateCalendarWidget;
  if(typeof _origUpdateCal==='function'){
    window.updateCalendarWidget = function(){ try{ _origUpdateCal(); }catch(e){} try{ window.updateRcClock(); }catch(e){} };
  } else {
    const _int=setInterval(()=>{ if(typeof getCalendarData==='function') window.updateRcClock(); },200);
  }
  // initial
  setTimeout(()=>{ try{ window.updateRcClock(); }catch(e){} },400);
  tlog('[RC] Reloj de la Colonia integrado 360x198 + mini 32px');
})();

function renderCalendarGrid(viewYear, viewSeason){
  const grid=document.getElementById('calGrid');
  const titleEl=document.getElementById('calModalTitle');
  const iconEl=document.getElementById('calModalIcon');
  const subEl=document.getElementById('calModalSubtitle');
  const yearEl=document.getElementById('calModalYear');
  const infoEl=document.getElementById('calModalInfo');
  if(!grid) return;
  const calNow=getCalendarData();
  const season=CAL_SEASONS[viewSeason];
  if(titleEl) titleEl.textContent=season.name+' - '+season.long;
  if(iconEl) iconEl.textContent=season.icon;
  if(subEl) subEl.textContent=season.desc;
  if(yearEl) yearEl.textContent='AÑO '+viewYear;
  // tabs active
  document.querySelectorAll('.cal-tab').forEach(el=>{
    el.classList.toggle('active', parseInt(el.dataset.s)===viewSeason);
  });
  grid.innerHTML='';
  const startDay = (viewYear-1)*48 + viewSeason*12 + 1; // día absoluto del 1 del mes
  for(let d=1; d<=12; d++){
    const absDay = startDay + d -1;
    const dayData=getCalendarData(absDay, 0);
    const isToday = absDay===calNow.d && viewYear===calNow.year && viewSeason===calNow.seasonIdx;
    const isPast = absDay < calNow.d;
    const isFuture = absDay > calNow.d;
    const cell=document.createElement('div');
    cell.className='cal-cell'+(isToday?' today': isPast?' past': isFuture?' future':'');
    // icono evento simple: si es día de lluvia pasada, o si hay brood cerca (simulado)
    let icon='·';
    if(isToday) icon='⭐';
    else if(absDay%5===0) icon='🍯';
    else if(absDay%7===0) icon='🌧';
    else if(absDay%11===0) icon='👑';
    cell.innerHTML=`<div class="cal-cell-num">${d}</div><div class="cal-cell-week">${dayData.weekAbbr}</div><div class="cal-cell-icon">${icon}</div>`;
    cell.title=`Día ${absDay} (Año ${viewYear} - ${season.name} ${d}/12) - ${dayData.weekDay}${isToday?' - HOY':''}`;
    grid.appendChild(cell);
  }
  if(infoEl){
    infoEl.textContent=`${calNow.season.icon} Día ${calNow.dayOfSeason} de ${calNow.season.name} - Año ${calNow.year} - ${calNow.weekDay} (semana ${calNow.weekOfSeason}/2) - ${String(calNow.hour).padStart(2,'0')}:${String(calNow.minute).padStart(2,'0')} ${calNow.isDay?'☀️ día':'🌙 noche'}`;
  }
  calViewYear=viewYear; calViewSeason=viewSeason;
}
function showCalendarModal(){
  const m=document.getElementById('calendarModal');
  if(!m) return;
  const cal=getCalendarData();
  calViewYear=cal.year; calViewSeason=cal.seasonIdx;
  renderCalendarGrid(calViewYear, calViewSeason);
  m.classList.add('open');
}
function closeCalendarModal(){
  const m=document.getElementById('calendarModal');
  if(m) m.classList.remove('open');
}
function initCalendar(){
  const w=document.getElementById('calendarWidget');
  const collBtn=document.getElementById('calCollapseBtn');
  if(collBtn && w){
    collBtn.onclick=(e)=>{
      e.stopPropagation();
      w.classList.toggle('collapsed');
      collBtn.textContent = w.classList.contains('collapsed') ? '+' : '-';
      // cerrar dropdowns si se colapsa
      if(w.classList.contains('collapsed')){
        try{ closeAntProfile(true); closeQueenProfile(true); }catch(_){}
      }
      // reajusta top de dropdowns si está expandido
      try{ const ant=document.getElementById('antProfile'); if(ant && ant.getAttribute('data-open')){ const h=w.offsetHeight; ant.style.top=(h+4)+'px'; ant.style.maxHeight=`calc(100vh - ${h+28}px)`; } }catch(_){}
      try{ const q=document.getElementById('queenProfile'); if(q && q.getAttribute('data-open')){ const h=w.offsetHeight; q.style.top=(h+4)+'px'; q.style.maxHeight=`calc(100vh - ${h+28}px)`; } }catch(_){}
    };
    // click en header no abre modal si está colapsado? deja que header click toggle? No, widget click abre modal solo si no colapsado
  }
  if(w) w.onclick=(e)=>{
    if(e.target && e.target.id==='calCollapseBtn') return;
    if(w.classList.contains('collapsed')) return;
    showCalendarModal();
  };
  const btnClose=document.getElementById('btnCloseCalendar');
  if(btnClose) btnClose.onclick=closeCalendarModal;
  const modal=document.getElementById('calendarModal');
  if(modal) modal.onclick=(e)=>{ if(e.target.id==='calendarModal') closeCalendarModal(); };
  document.querySelectorAll('.cal-tab').forEach(el=>{
    el.onclick=()=>{ const s=parseInt(el.dataset.s); renderCalendarGrid(calViewYear, s); };
  });
  const prev=document.getElementById('btnCalPrev');
  if(prev) prev.onclick=()=>{ calViewYear=Math.max(1,calViewYear-1); renderCalendarGrid(calViewYear, calViewSeason); };
  const next=document.getElementById('btnCalNext');
  if(next) next.onclick=()=>{ calViewYear++; renderCalendarGrid(calViewYear, calViewSeason); };
  const today=document.getElementById('btnCalToday');
  if(today) today.onclick=()=>{ const cal=getCalendarData(); renderCalendarGrid(cal.year, cal.seasonIdx); };
  // tecla Esc cierra calendario también
  window.addEventListener('keydown',e=>{ if(e.key==='Escape'){ const m=document.getElementById('calendarModal'); if(m && m.classList.contains('open')) closeCalendarModal(); }});
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', initCalendar);
else initCalendar();
setTimeout(initCalendar, 500);

// Calendario idle translúcido para ver borde derecho sin colapsar
(function(){
  let idleTimer=null;
  const w=document.getElementById('calendarWidget');
  if(!w) return;
  const setIdle=()=> w.classList.add('idle');
  const clearIdle=()=> { w.classList.remove('idle'); if(idleTimer) clearTimeout(idleTimer); idleTimer=setTimeout(setIdle, 3800); };
  w.addEventListener('mouseenter', clearIdle);
  w.addEventListener('mouseleave', clearIdle);
  w.addEventListener('click', clearIdle);
  clearIdle();
})();

setTimeout(initCalendar, 1200);

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', attachOnHandlers);
else attachOnHandlers();
setTimeout(attachOnHandlers, 400);
setTimeout(attachOnHandlers, 1200);
// Cierre de perfil - se adjunta diferido porque #antProfile está tras el script
function attachProfileClose(){
  const pf=document.getElementById('antProfile');
  const btn=document.getElementById('btnCloseProfile');
  if(btn) btn.onclick=()=> closeAntProfile();
  if(pf) pf.onclick=(e)=>{ if(e.target.id==='antProfile') closeAntProfile(); };
  const qf=document.getElementById('queenProfile');
  const qbtn=document.getElementById('btnCloseQueen');
  if(qbtn) qbtn.onclick=()=> closeQueenProfile();
  if(qf) qf.onclick=(e)=>{ if(e.target.id==='queenProfile') closeQueenProfile(); };
  const qBox=document.getElementById('queenBox');
  if(qBox) qBox.onclick=()=>{ const q=queens[0]; if(q) showQueenProfile(q); };
  const qAvatar=document.querySelector('.queen-avatar');
  if(qAvatar) qAvatar.style.cursor='pointer';
  // también click en estado / progreso abre ficha
  const qStat=document.getElementById('queenStatus');
  if(qStat) { qStat.style.cursor='pointer'; qStat.onclick=()=>{ const q=queens[0]; if(q) showQueenProfile(q); }; }
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', attachProfileClose);
else attachProfileClose();
setTimeout(attachProfileClose, 400);
window.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    const el=document.getElementById('onboarding')||document.getElementById('onboardingLegacy')||document.getElementById('onboardingModal');
    if(el && el.style.display!=='none' && el.style.opacity!=='0') try{ closeOn(); }catch(_){}
    const pf=document.getElementById('antProfile');
    if(pf && pf.style.display!=='none' && pf.style.transform!=='translateX(100%)') closeAntProfile();
    const qf=document.getElementById('queenProfile');
    if(qf && qf.style.display!=='none' && qf.style.transform!=='translateX(100%)') closeQueenProfile();
  }
});
// Fallback: click anywhere on overlay background closes? No, keep.
// Debug log
tlog('[TOPO] onboarding listo', ON_STEPS.length);
try{
  if(localStorage.getItem('antFarm_onboarded')==='1'){
    const ob=document.getElementById('onboarding')||document.getElementById('onboardingLegacy')||document.getElementById('onboardingModal');
    if(ob){ ob.style.display='none'; ob.style.opacity='0'; }
    tlog('[TOPO] onboarding saltado por marca previa');
  }
  const _origCloseOn = typeof closeOn==='function' ? closeOn : null;
  if(_origCloseOn){
    const wrappedCloseOn = function(){
      try{ localStorage.setItem('antFarm_onboarded','1'); }catch(e){}
      return _origCloseOn.apply(this, arguments);
    };
    if(typeof window!=='undefined') window.closeOn = wrappedCloseOn;
    // also patch global closeOn if defined later
    try{ closeOn = wrappedCloseOn; }catch(e){}
  }
  const skipBtn=document.getElementById('onSkip');
  if(skipBtn) skipBtn.addEventListener('click', ()=>{ try{ localStorage.setItem('antFarm_onboarded','1'); }catch(e){} });
  const nextBtn=document.getElementById('onNext');
  if(nextBtn) nextBtn.addEventListener('click', ()=>{
    const dots=document.getElementById('onDots');
    // if last step, mark onboarded
    try{
      const curStep = window._onStepIdx || 0;
      if(curStep >= (typeof ON_STEPS!=='undefined'? ON_STEPS.length-1 : 3)) localStorage.setItem('antFarm_onboarded','1');
    }catch(e){}
  });
}catch(e){}

// Ajuste mundo nuevo: empieza con mieles cerca del nido (anti-extinción)
// FIX TOP 2026-10-15: este bloque corría sin mundo (queen=null) y lanzaba TypeError ->
// todo lo que viene después en app.js (SAVE, contador de hormigas, flujo de menú) quedaba muerto.
if(_topoHasWorld){
  try{
    foods.length=0;
    colonyFood=startReserveFood(); // reserva proporcional al tamaño del terreno
    if(queen) queen.progress=0;
    digs=0; mound.length=0;
    const _sf3=startSurfaceFood(); const _sp3=Math.max(24, Math.round(38*worldAreaRatio()*0.9));
    for(let i=0;i<_sf3;i++) spawnFoodSurface(CENTER_COL*CELL+8 + (Math.random()-0.5)*(_sp3*3) + (i-Math.floor(_sf3/2))*_sp3, 1+Math.floor(Math.random()*1.6));
    lastSpawn=time; // evita spawn inmediato extra
  }catch(e){ console.warn('[TOPO] ajuste mundo nuevo pospuesto', e.message); }
} else { tlog('[TOPO] ajuste de mundo nuevo diferido - se aplicará al crear/cargar'); }


// === SAVE PERSISTENTE - la granja sobrevive a recargar ===
const SAVE_KEY='antFarm_fullSave_v2';
const SAVE_VER='20261015a';
const LS_ALIVE='antfarm_worldAlive';
const LS_INGAME='antfarm_inGame';
// grids a string de digitos: 8x menos bytes que JSON de arrays (BIG 96x48 entra en localStorage)
function _encGrid(g){ try{ if(!Array.isArray(g)) return []; return g.map(r=>{ let s=''; for(let i=0;i<r.length;i++){ let v=r[i]|0; if(v<0)v=0; if(v>9)v=9; s+=v; } return s; }); }catch(e){ return []; } }
function _decGrid(s, w, h){ if(!Array.isArray(s)||!s.length) return null; const out=[]; for(let r=0;r<s.length && r<h;r++){ const str=String(s[r]||''); const row=new Array(w).fill(1); for(let c=0;c<w;c++){ const ch=str.charCodeAt(c); row[c] = isNaN(ch)?0:(ch-48); } out.push(row); } while(out.length<h){ const row=new Array(w).fill(1); out.push(row); } return out; }
function _encWater(g){ try{ if(!Array.isArray(g)) return []; return g.map(r=>{ let s=''; for(let i=0;i<r.length;i++){ let v=Math.round((r[i]||0)*9); if(v<0)v=0; if(v>9)v=9; s+=v; } return s; }); }catch(e){ return []; } }
function _decWater(s, w, h){ if(!Array.isArray(s)||!s.length) return null; const out=[]; for(let r=0;r<s.length && r<h;r++){ const str=String(s[r]||''); const row=new Array(w).fill(0); for(let c=0;c<w;c++){ const ch=str.charCodeAt(c); row[c]= isNaN(ch)?0:Math.max(0,(ch-48))/9; } out.push(row); } while(out.length<h) out.push(new Array(w).fill(0)); return out; }

function topoHasSave(){
  try{
    const raw=localStorage.getItem(SAVE_KEY);
    if(!raw) return null;
    const d=JSON.parse(raw);
    if(!d || !Array.isArray(d.soil) || d.soil.length===0) return null;
    const pop = Array.isArray(d.workers)? d.workers.length : 0;
    if(pop===0 && !(Array.isArray(d.queens)&&d.queens.length)) return null;
    return { day:d.day||1, pop, cols:d.COLS||64, rows:d.ROWS||36, savedAt:d.savedAt||0, v:d.v||'1' };
  }catch(e){ return null; }
}
window.topoHasSave=topoHasSave;

let _lastSaveSig='';
function serializeSave(force){
  try{
    if(!_topoHasWorld) return false;                       // no pisar una partida buena desde el menu
    if(!Array.isArray(soil) || soil.length===0) return false;
    if((!workers || workers.length===0) && (!queens || queens.length===0)) return false;
    const data={
      v:SAVE_VER, savedAt:Date.now(), day,
      time, gen, colonyIQ, colonyFood, digs, deliveries, accidents, rewardsFound, mutations, commsCount, worldAge,
      ROWS, COLS, SURFACE_ROW,
      soil:_encGrid(soil), soilType:_encGrid(soilType), water:_encWater(water),
      fertility: Array.isArray(fertility)? fertility.map(v=>Math.round((v||0)*100)) : [],
      plants: Array.isArray(plants)? plants.slice(0,160).map(p=>({c:p.c,x:p.x,y:p.y,type:p.type,growth:p.growth,age:p.age,fc:p.fruitCooldown,v:p.variant})) : [],
      hiddenRewards: Array.isArray(hiddenRewards)? hiddenRewards.map(h=>({c:h.c,r:h.r,type:h.type,found:!!h.found,x:h.x,y:h.y,tier:h.depthTier})) : [],
      foods: Array.isArray(foods)? foods.slice(0,90).map(f=>({x:f.x,y:f.y,amount:f.amount,max:f.max,ftype:f.ftype,grounded:!!f.grounded})) : [],
      mound: Array.isArray(mound)? mound.filter(m=>m && !m.isPuddle).slice(0,300).map(m=>({x:m.x,y:m.y,h:m.h})) : [],
      // Topo: JSON.stringify ya serializa profundo; los spreads ({...w}) copiaban cada hormiga DOS veces
      workers, queens, brood, fungusGardens, wastePiles, structures,
      queen: queen|| null,
      worldMaterials: {...worldMaterials},
      inventions: {...inventions},
      society,
      pantryPos: {...pantryPos},
      view: {...view},
      stats: {...stats},
      weather: {type:weather.type, intensity:weather.intensity, nextChange:weather.nextChange},
      gameSpeed, useAnthro,
      events: events.slice(0,45).map(e=>({type:e.type,msg:e.msg,detail:e.detail,time:e.time,gen:e.gen})),
      sizeKey: (()=>{ try{ return localStorage.getItem('antfarm_worldSize')||''; }catch(e){ return ''; } })()
    };
    const _sig=(time|0)+'|'+digs+'|'+colonyFood+'|'+workers.length+'|'+deliveries+'|'+_soilRev;
    if(!force && _sig===_lastSaveSig){ // nada que contar: no volver a serializar el mundo entero
      try{ localStorage.setItem('antfarm_lastReal', String(Date.now())); localStorage.setItem('antfarm_time', String(time)); }catch(e){}
      return false;
    }
    const json=JSON.stringify(data);
    _lastSaveSig=_sig;
    localStorage.setItem(SAVE_KEY, json);
    localStorage.setItem(LS_ALIVE,'1');
    localStorage.setItem('antfarm_worldSize_cols', String(COLS));
    localStorage.setItem('antfarm_worldSize_rows', String(ROWS));
    localStorage.setItem('antfarm_lastReal', String(Date.now()));
    localStorage.setItem('antfarm_time', String(time));
    return true;
  }catch(e){ console.warn('save fail',e); if(e && e.name==='QuotaExceededError'){ try{ localStorage.removeItem('antfarm_evt_log'); }catch(_){} } return false; }
}

function deserializeSave(){
  try{
    const raw=localStorage.getItem(SAVE_KEY);
    if(!raw) return false;
    const data=JSON.parse(raw);
    if(!data || !Array.isArray(data.soil) || data.soil.length===0) return false;
    // 1) dimensiones primero: W/H/canvas/soilCache deben coincidir con el mapa guardado
    COLS = data.COLS||64; ROWS = data.ROWS||36;
    if(data.SURFACE_ROW) SURFACE_ROW = data.SURFACE_ROW;
    SURFACE_Y = SURFACE_ROW*CELL; CENTER_COL = Math.floor(COLS/2);
    W = COLS*CELL; H = ROWS*CELL;
    try{ const cv=document.getElementById('farmCanvas'); if(cv){ cv.width=W; cv.height=H; if(cv.getContext) cv.getContext('2d').imageSmoothingEnabled=false; } }catch(e){}
    try{ initSoilCache(); if(soilCacheCanvas){ soilCacheCanvas.width=W; soilCacheCanvas.height=H; if(soilCacheCtx) soilCacheCtx.imageSmoothingEnabled=false; } }catch(e){}
    // 2) grids
    const s=_decGrid(data.soil, COLS, ROWS); if(!s) return false; soil=s;
    let st=_decGrid(data.soilType, COLS, ROWS); if(!st){ st=Array.from({length:ROWS},(_,r)=>Array.from({length:COLS},(_,c)=> r<SURFACE_ROW?0:1)); } soilType=st;
    let wt=_decWater(data.water, COLS, ROWS); if(!wt) wt=Array.from({length:ROWS},()=>new Array(COLS).fill(0)); water=wt;
    if(Array.isArray(data.fertility) && data.fertility.length) fertility=data.fertility.map(v=>(v||0)/100);
    else fertility=Array.from({length:COLS},()=>0.55);
    while(fertility.length<COLS) fertility.push(0.55);
    // 3) entidades
    workers = Array.isArray(data.workers)? data.workers : [];
    workers.forEach(w=>{ w.selected=false; if(w.digTarget===undefined) w.digTarget=null; });
    queens = Array.isArray(data.queens)? data.queens : [];
    if(data.queen && !queens.length) queens=[data.queen];
    if(!queens.length){ // nunca sin reina: respawn de la fundadora
      try{ resetNameRegistry(); queens=[freshFounder({x:CENTER_COL*CELL+8,y:(SURFACE_ROW+8)*CELL+8,genome:makeGenome(),progress:0,state:'GRÁVIDA',age:0,maxAge:DAY_LENGTH*16,generation:0,faction:0,health:100,eggsLaid:0,broodTended:0,children:[],history:[],parents:[]})]; }catch(e){}
    }
    queens.forEach(q=>{ try{ ensureQueenMeta(q); }catch(e){} });
    queen = queens[0] || null;
    brood = Array.isArray(data.brood)? data.brood : [];
    fungusGardens = data.fungusGardens||[]; wastePiles = data.wastePiles||[];
    structures = data.structures||[];
    foods = Array.isArray(data.foods)? data.foods.map(f=>({...f, r:5+(f.amount||1)*2, pulse:Math.random()*3, rot:0, fresh:1, spawnDay:f.spawnDay||1, vy:0, grounded:f.grounded!==false})) : [];
    plants = Array.isArray(data.plants)? data.plants.map(p=>({c:p.c,x:p.x,y:p.y,type:p.type,growth:p.growth,maxGrowth:1,age:p.age||0,fruitCooldown:p.fc||0,variant:p.v||0})) : [];
    hiddenRewards = Array.isArray(data.hiddenRewards)? data.hiddenRewards.map(h=>({c:h.c,r:h.r,type:h.type,found:h.found,x:h.x,y:h.y,depthTier:h.tier||1})) : [];
    mound = Array.isArray(data.mound)? data.mound.map(m=>({x:m.x,y:m.y,h:m.h})) : [];
    worldMaterials = data.worldMaterials||worldMaterials; inventions = data.inventions||inventions;
    society = data.society||society; pantryPos = data.pantryPos||{x:CENTER_COL*CELL+8,y:(SURFACE_ROW+8)*CELL+8};
    if(data.stats) stats = {...stats, ...data.stats};
    if(data.weather && typeof data.weather==='object'){ weather.type=data.weather.type||'clear'; weather.intensity=data.weather.intensity||0; weather.nextChange=data.weather.nextChange||800; weather.rainParticles=[]; }
    if(Array.isArray(data.events)){ events.length=0; data.events.forEach(e=>events.push(e)); }
    time = data.time||time; gen = data.gen||gen; colonyIQ = data.colonyIQ||colonyIQ;
    colonyFood = data.colonyFood||colonyFood; digs = data.digs||digs;
    if(data.day) day = data.day; else day = Math.floor(time/DAY_LENGTH)+1;
    if(data.worldAge) worldAge = data.worldAge;
    deliveries = data.deliveries||deliveries; accidents = data.accidents||0; rewardsFound = data.rewardsFound||0;
    mutations = data.mutations||0; commsCount = data.commsCount||0;
    try{ if(data.gameSpeed && gameSpeed!==data.gameSpeed && typeof setGameSpeed==='function') setGameSpeed(data.gameSpeed); else gameSpeed=data.gameSpeed||gameSpeed; }catch(e){ gameSpeed=data.gameSpeed||gameSpeed; }
    useAnthro = !!data.useAnthro;
    if(data.view && typeof data.view.x==='number') view = {...view, ...data.view};
    _topoHasWorld = true;
    paused = false;
    markSoilDirty(); try{ markSoilDirty(); }catch(e){}
    try{ localStorage.setItem(LS_ALIVE,'1'); }catch(e){}
    try{ clampView(); updateDepthRuler(); updateColonyUI(); renderEvents(); }catch(e){}
    try{ _updateBothAntCounts(); }catch(e){}
    last = performance.now(); lastRealWall = Date.now();
    tlog('[TOPO] save cargado:', workers.length+' obreras, '+queens.length+' reinas, día '+day+' · mundo '+COLS+'x'+ROWS);
    return true;
  }catch(e){ console.warn('load fail',e); return false; }
}

// entrada al juego desde una partida guardada (menu -> continuar o auto-resume)
function topoResumeGame(opts){
  const silent = opts && opts.silent;
  if(!deserializeSave()) return false;
  try{
    document.body.classList.add('game-started');
    const ar=document.getElementById('appRoot'); if(ar) ar.style.display='flex';
    const vb=document.getElementById('velAntBar'); if(vb) vb.style.visibility='visible';
    const cw=document.getElementById('calendarWidget'); if(cw) cw.style.visibility='visible';
    ['splashScreen','mainMenu','createSizeScreen','loadScreen','settingsScreen','creditsScreen','onboardingModal','onboardingLegacy','worldGenScreen'].forEach(id=>{ const el=document.getElementById(id); if(el) el.style.display='none'; });
    localStorage.setItem(LS_INGAME,'1');
  }catch(e){}
  // progreso offline a ritmo normal (sin acelerar)
  try{
    const meta=topoHasSave();
    if(meta && meta.savedAt){ const add=Math.min(DAY_LENGTH*2.2, (Date.now()-meta.savedAt)*0.06); if(add>DAY_LENGTH*0.02){ time+=add; day=Math.floor(time/DAY_LENGTH)+1; } }
  }catch(e){}
  try{ checkWorldExpansion(); }catch(e){}
  try{ clampView(); updateColonyUI(); _updateBothAntCounts(); }catch(e){}
  if(!silent){ try{ pushToast(W/2, SURFACE_Y-40, '🐜 Granja reanudada · Día '+day, '#2de67a'); }catch(e){} pushEvent('evo','💾 Partida reanudada', workers.length+' obreras · Día '+day); }
  return true;
}
window.topoResumeGame=topoResumeGame;

// auto-save: cada 4s solo si hay mundo; al cerrar/ocultar tab siempre
let _lastAutoSave=0;
setInterval(()=>{ try{ if(_topoHasWorld){ if(serializeSave()) _lastAutoSave=Date.now(); } }catch(e){} }, 4200);
window.addEventListener('beforeunload', ()=>{ try{ localStorage.setItem(LS_INGAME, _topoHasWorld?'1':'0'); serializeSave(); }catch(e){} });
document.addEventListener('visibilitychange', ()=>{ if(document.hidden){ try{ serializeSave(); }catch(e){} } else { try{ last=performance.now(); lastRealWall=Date.now(); }catch(e){} } });
window.addEventListener('pagehide', ()=>{ try{ serializeSave(); }catch(e){} });
// borrar partida (consola o boton de la pantalla de carga)
window._clearSave=()=>{ try{ localStorage.removeItem(SAVE_KEY); localStorage.removeItem(LS_ALIVE); localStorage.removeItem(LS_INGAME); localStorage.removeItem('antfarm_lastReal'); localStorage.removeItem('antfarm_time'); }catch(e){} location.reload(); };
// === GRANJAS MÚLTIPLES: la anterior se archiva, no se destruye ===
const FARMS_KEY='antfarm_farms';
function topoListFarms(){
  try{ const raw=localStorage.getItem(FARMS_KEY); if(!raw) return []; const a=JSON.parse(raw); return Array.isArray(a)?a:[]; }catch(e){ return []; }
}
function topoWriteFarms(list){
  // recorta hasta que quepa (localStorage ~5MB con BIG de 48KB por granja)
  for(let n=list.length; n>=0; n--){
    try{ localStorage.setItem(FARMS_KEY, JSON.stringify(list.slice(0,n))); return true; }catch(e){ }
  }
  return false;
}
function topoArchiveCurrent(label){
  try{
    const raw=localStorage.getItem(SAVE_KEY); if(!raw) return false;
    const d=JSON.parse(raw); if(!d || !Array.isArray(d.soil) || !d.soil.length) return false;
    const list=topoListFarms();
    const at=Date.now();
    list.unshift({ id:'f'+at.toString(36), label: label||('Granja '+(d.COLS||64)+'x'+(d.ROWS||36)), sizeKey:d.sizeKey||'',
                   cols:d.COLS||64, rows:d.ROWS||36, savedAt:at, day:d.day||1, pop:(d.workers||[]).length, snap:raw });
    if(list.length>5) list.length=5;
    return topoWriteFarms(list);
  }catch(e){ console.warn('archive fail',e); return false; }
}
function topoRestoreFarm(id){
  try{
    const f=topoListFarms().find(x=>x.id===id); if(!f || !f.snap) return false;
    topoArchiveCurrent('Granja activa (antes de cambiar)');
    localStorage.setItem(SAVE_KEY, f.snap);
    localStorage.setItem('antfarm_worldSize', f.sizeKey||'');
    localStorage.setItem('antfarm_worldSize_cols', String(f.cols));
    localStorage.setItem('antfarm_worldSize_rows', String(f.rows));
    return true;
  }catch(e){ return false; }
}
function topoDeleteFarm(id){ try{ const list=topoListFarms().filter(x=>x.id!==id); topoWriteFarms(list); return true; }catch(e){ return false; } }
window.topoListFarms=topoListFarms; window.topoArchiveCurrent=topoArchiveCurrent;
window.topoRestoreFarm=topoRestoreFarm; window.topoDeleteFarm=topoDeleteFarm;
window.topoDropCurrent=()=>{ try{ localStorage.removeItem(SAVE_KEY); localStorage.removeItem(LS_ALIVE); localStorage.removeItem(LS_INGAME); return true; }catch(e){ return false; } };

window.serializeSave=serializeSave;
window.deserializeSave=deserializeSave;
window._topoSaveKey=SAVE_KEY;
// el inline de index.html lee window._topoHasWorld / window.COLS / window.ROWS: exponerlos con getter/setter
try{
  Object.defineProperty(window,'_topoHasWorld',{ get:()=>_topoHasWorld, set:v=>{ _topoHasWorld=!!v; }, configurable:true });
  Object.defineProperty(window,'COLS',{ get:()=>COLS, set:v=>{ COLS=v|0; }, configurable:true });
  Object.defineProperty(window,'ROWS',{ get:()=>ROWS, set:v=>{ ROWS=v|0; }, configurable:true });
}catch(e){}

if(_topoHasWorld && queen && queen.genome) pushEvent('birth', 'Colonia fundada - Reina ' + (queen.personalName||queen.name) + ' + obreras', 'DNA reina ' + queen.genome.id + ' - IQ 100 - puede llegar a 380');
if(_topoHasWorld){
  pushEvent('evo','Granja lista: túneles claros, suelo oscuro, colonia activa', 'Cada hormiga muestra qué hace con su burbuja');
  setNarration('<b>Tu granja está lista.</b> <small>Mira las burbujas: <b style="color:#ffcc00">🔍</b> explora · <b style="color:#2de67a">🍯→CASA</b> · <b style="color:#ff3b30">⛏ CAVA</b> · <b style="color:#00e5ff">⬢</b> avisa. Pon miel en el pasto para empezar.</small>');
}
try{ renderEvents(); updateColonyUI(); updateZoomLabel(); }catch(e){ console.error('initUI',e); }



function _updateBothAntCounts(){ try{
      let n=0;
      if(typeof workers!=='undefined' && Array.isArray(workers)) n = workers.length;
      // Fallback si workers aún no existe pero hay reina
      if(n===0 && typeof queen!=='undefined' && queen) n=1;
      const v=document.getElementById('velAntCount'); if(v) v.textContent=n;
      const c=document.getElementById('calAntCount'); if(c) c.textContent=n;
      const tb=document.getElementById('tbPop'); if(tb) tb.textContent=n;
      const hPop=document.getElementById('hPop'); if(hPop && typeof getMaxPopulation==='function'){ try{ hPop.textContent=n+'/'+getMaxPopulation(); }catch(e){ hPop.textContent=n; } }
    }catch(e){ console.warn('antCount',e); }
}
setInterval(_updateBothAntCounts, 350);
setTimeout(_updateBothAntCounts, 600);
setTimeout(_updateBothAntCounts, 1800);





// === FLOW TOPO - Splash → MainMenu → Create/Load → Onboarding (no solape) ===
(function(){
  const splash=document.getElementById('splashScreen');
  const main=document.getElementById('mainMenu');
  const createSc=document.getElementById('createSizeScreen');
  const loadSc=document.getElementById('loadScreen');
  const settingsSc=document.getElementById('settingsScreen');
  const creditsSc=document.getElementById('creditsScreen');
  const onboarding=document.getElementById('onboardingModal');
  // Topo 2026-10-14: el menu tenia que salir de en medio. hideAll() no ocultaba #mainMenu, asi que
  // la pantalla de tamanos quedaba DETRAS del menu (misma capa fija, z 9997 vs 9998) y el click en
  // un tamano caia sobre el boton CREAR de encima: parecia que "no pasaba nada".
  function hideAll(){ [splash,main,createSc,loadSc,settingsSc,creditsSc,onboarding].forEach(el=>{ if(el) el.style.display='none'; }); const leg=document.getElementById('onboardingLegacy'); if(leg) leg.style.display='none'; }
  function show(el){ if(!el) return; hideAll(); el.style.display='flex'; }
  // Splash 1.1s -> si hay granja guardada y estabas dentro, se reanuda sola; si no, MainMenu
  function topoShowMainMenu(){
    if(main){ main.style.display='flex'; try{ topoRefreshContinueBtn(); }catch(e){} }
  }
  window.topoRefreshContinueBtn = function(){
    if(!main) return;
    const meta = (typeof topoHasSave==='function')? topoHasSave() : null;
    let btn=document.getElementById('btnMainContinue');
    if(meta){
      if(!btn){
        btn=document.createElement('button');
        btn.id='btnMainContinue';
        btn.className='pixel-btn primary';
        btn.style.cssText='width:100%;justify-content:center;padding:16px;font-size:10px;background:#2de67a;color:#0a0a0a;border-color:#000;margin-bottom:2px';
        const ref=document.getElementById('btnMainCreate');
        main.querySelector('div').insertBefore(btn, ref);
        btn.onclick=(ev)=>{
          ev&&ev.preventDefault(); tlog('[TOPO] continuar click');
          if(_topoHasWorld){ topoCloseMenuToGame(); try{ clampView(); updateColonyUI(); }catch(e){} return; }
          if(!topoResumeGame()){ if(main) main.style.display='none'; show(createSc); }
        };
      }
      const ago = meta.savedAt? Math.max(0, Date.now()-meta.savedAt) : 0;
      const mins=Math.floor(ago/60000);
      const when = mins<1? 'hace segundos' : mins<60? 'hace '+mins+' min' : mins<1440? 'hace '+Math.floor(mins/60)+'h' : 'hace '+Math.floor(mins/1440)+'d';
      btn.innerHTML='▶ CONTINUAR · DÍA '+meta.day+' · '+meta.cols+'×'+meta.rows+' · '+meta.pop+' 🐜 <span style=\"font-size:7px;color:#1a140f\">('+when+')</span>';
    } else if(btn){ btn.remove(); }
  };
  if(splash && main){
    setTimeout(()=>{
      splash.style.opacity='0';
      let inGame=false; try{ inGame = localStorage.getItem('antfarm_inGame')==='1' && !!topoHasSave(); }catch(e){}
      setTimeout(()=>{
        splash.style.display='none';
        if(inGame){
          const ok = topoResumeGame({silent:false});
          if(ok){ tlog('[TOPO] auto-resume OK'); return; }
          try{ localStorage.setItem('antfarm_inGame','0'); }catch(e){}
        }
        topoShowMainMenu();
      }, 820);
    }, 1100);
  }
  // Main buttons
  const btnCreate=document.getElementById('btnMainCreate');
  const btnLoad=document.getElementById('btnMainLoad');
  const btnSettings=document.getElementById('btnMainSettings');
  const btnCredits=document.getElementById('btnMainCredits');
  if(btnCreate){ btnCreate.onclick=(e)=>{ e&&e.preventDefault(); tlog('[TOPO] btnMainCreate click'); show(createSc); }; }
  // Topo: ESC / botón ➜ guarda y abre el menú (la colonia sigue viviendo detrás)
  window.topoOpenMenu = function(){
    if(!_topoHasWorld) return;
    try{ serializeSave(); localStorage.setItem('antfarm_inGame','0'); }catch(e){}
    if(main){ main.style.display='flex'; try{ topoRefreshContinueBtn(); }catch(e){} }
  };
  window.topoCloseMenuToGame = function(){
    if(main) main.style.display='none';
    hideAll();
    try{ document.body.classList.add('game-started'); localStorage.setItem('antfarm_inGame','1'); }catch(e){}
  };
  document.addEventListener('keydown', (e)=>{
    if(e.key!=='Escape' && e.key!=='Esc') return;
    const menuVisible = main && getComputedStyle(main).display!=='none';
    if(menuVisible){ e.preventDefault(); topoCloseMenuToGame(); return; }
    if(!_topoHasWorld) return;
    const inp=e.target && e.target.tagName; if(inp==='INPUT'||inp==='TEXTAREA'||inp==='SELECT') return;
    e.preventDefault(); topoOpenMenu();
  });
  if(btnLoad) btnLoad.onclick=()=>{
    // lista real desde el slot de guardado + formato viejo
    const list=document.getElementById('loadList');
    if(list){
      list.innerHTML='';
      const saves=[];
      try{
        const meta=(typeof topoHasSave==='function')? topoHasSave():null;
        if(meta){
          const ago=meta.savedAt? Math.max(0,Date.now()-meta.savedAt):0;
          const mins=Math.floor(ago/60000);
          const when = !meta.savedAt? '-' : mins<1? 'hace segundos' : mins<60? 'hace '+mins+' min' : mins<1440? 'hace '+Math.floor(mins/60)+'h' : new Date(meta.savedAt).toLocaleString('es-PE');
          saves.push({key:SAVE_KEY, label:'MI GRANJA', size:meta.cols+'×'+meta.rows, day:meta.day, pop:meta.pop, when});
        }
        for(const k of ['antfarm_save_v4','antfarm_save_v3','antfarm_save_v2','antfarm_save']){
          const raw=localStorage.getItem(k); if(!raw) continue;
          try{ const d=JSON.parse(raw); if(!d || !Array.isArray(d.workers) || !d.workers.length) continue;
            saves.push({key:k, label:'PARTIDA ANTIGUA', size:(d.COLS||64)+'×'+(d.ROWS||36), day:d.day||1, pop:d.workers.length, when:d.savedAt? new Date(d.savedAt).toLocaleString('es-PE') : 'sin fecha'});
          }catch(e){}
        }
      }catch(e){ console.warn('loadList',e); }
      if(!saves.length){
        const empty=document.createElement('div');
        empty.style.cssText='padding:22px 10px;text-align:center;font-family:VT323,monospace;font-size:15px;color:#8a7a5a';
        empty.innerHTML='No hay granjas guardadas todavía.<br><span style="color:#5a4a3a;font-size:12px">Crea una desde el menú y se guardará sola cada 4 segundos.</span>';
        list.appendChild(empty);
        const b=document.createElement('button');
        b.className='pixel-btn primary'; b.style.cssText='width:100%;justify-content:center'; b.textContent='➕ CREAR GRANJA NUEVA';
        b.onclick=()=> show(createSc);
        list.appendChild(b);
      }
      topoListFarms().forEach(f=>{
        const ago=f.savedAt? Math.max(0,Date.now()-f.savedAt):0; const mins=Math.floor(ago/60000);
        saves.push({ key:'ARCHIVE:'+f.id, label:'📦 '+f.label, size:f.cols+'×'+f.rows, day:f.day, pop:f.pop,
                     when: mins<1?'hace segundos': mins<60? 'hace '+mins+' min' : mins<1440? 'hace '+Math.floor(mins/60)+'h' : new Date(f.savedAt).toLocaleString('es-PE') });
      });
      saves.forEach(s=>{
        const div=document.createElement('div');
        div.style.cssText='background:#000;border:2px solid #000;padding:8px;display:flex;flex-direction:column;gap:6px';
        div.innerHTML=`<div style="font-family:'Press Start 2P',monospace;font-size:7px;color:#ffcc00">${s.label} · ${s.size}</div><div style="font-family:'VT323',monospace;font-size:13px;color:#c9b896">Día ${s.day} · ${s.pop} hormigas · guardada ${s.when}</div><div style="display:flex;gap:6px"><button class="pixel-btn small" data-load="${s.key}" style="flex:1">▶ CARGAR</button><button class="pixel-btn small" data-del="${s.key}" style="background:#1a0f00;color:#8a7a5a">🗑</button></div>`;
        list.appendChild(div);
      });
      setTimeout(()=>{
        list.querySelectorAll('[data-load]').forEach(b=>{
          b.onclick=()=>{
            let k=b.getAttribute('data-load');
            b.textContent='⏳ CARGANDO...';
            try{
              if(k && k.indexOf('ARCHIVE:')===0){
                const id=k.slice(8);
                if(!topoRestoreFarm(id)){ b.textContent='✕ ARCHIVO DAÑADO'; b.disabled=true; return; }
                k=SAVE_KEY;
              }
              if(k && k!==SAVE_KEY){
                const raw2=localStorage.getItem(k);
                if(raw2){ const d=JSON.parse(raw2); if(d && d.workers) localStorage.setItem(SAVE_KEY, JSON.stringify(d)); }
              }
            }catch(e){}
            const ok = topoResumeGame({silent:false});
            if(!ok){ b.textContent='✕ DAÑADA - CREA UNA'; b.disabled=true; console.warn('[TOPO] carga fallida', k); }
          };
        });
        list.querySelectorAll('[data-del]').forEach(b=>{
          b.onclick=()=>{
            const k=b.getAttribute('data-del');
            try{
              if(k.indexOf('ARCHIVE:')===0){ topoDeleteFarm(k.slice(8)); }
              else { localStorage.removeItem(k); localStorage.removeItem('antfarm_worldAlive'); localStorage.removeItem('antfarm_inGame'); localStorage.removeItem('antfarm_lastReal'); localStorage.removeItem('antfarm_time'); }
            }catch(e){}
            b.closest('div').style.opacity='0.3';
            try{ topoRefreshContinueBtn(); }catch(e){}
          };
        });
      }, 60);
    }
    show(loadSc);
  };
  function renderSettingsFarms(){
    const box=document.getElementById('settingsFarms'); if(!box) return;
    box.innerHTML='';
    const cur=(typeof topoHasSave==='function')? topoHasSave():null;
    const head=document.createElement('div');
    head.style.cssText="font-family:'Press Start 2P',monospace;font-size:7px;color:#ffcc00";
    head.textContent='GRANJA ACTIVA';
    box.appendChild(head);
    const a=document.createElement('div');
    a.style.cssText="font-family:'VT323',monospace;font-size:13px;color:#c9b896";
    a.textContent = cur? ('Día '+cur.day+' · '+cur.pop+' hormigas · '+cur.cols+'×'+cur.rows) : 'ninguna todavía';
    box.appendChild(a);
    const list=(typeof topoListFarms==='function')? topoListFarms():[];
    if(list.length){
      const h2=document.createElement('div');
      h2.style.cssText="font-family:'Press Start 2P',monospace;font-size:7px;color:#ffcc00;margin-top:6px";
      h2.textContent='ARCHIVADAS ('+list.length+')';
      box.appendChild(h2);
      list.forEach(f=>{
        const row=document.createElement('div');
        row.style.cssText='display:flex;gap:6px;align-items:center';
        row.innerHTML=`<span style="flex:1;font-family:'VT323',monospace;font-size:12px;color:#8a7a5a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${f.label}</span>`;
        const lb=document.createElement('button'); lb.className='pixel-btn small'; lb.textContent='▶'; lb.title='Cambiar a esta granja';
        lb.onclick=()=>{ if(topoRestoreFarm(f.id)) topoResumeGame({silent:false}); };
        const db=document.createElement('button'); db.className='pixel-btn small'; db.textContent='🗑'; db.style.cssText='background:#1a0f00;color:#8a7a5a'; db.title='Borrar del archivo';
        db.onclick=()=>{ topoDeleteFarm(f.id); renderSettingsFarms(); };
        row.appendChild(lb); row.appendChild(db); box.appendChild(row);
      });
    }
    const w=document.getElementById('btnWipeSave');
    if(w) w.onclick=()=>{ gameConfirm('¿Borrar todo?', 'Se van la granja guardada y el archivo completo. No hay vuelta atrás.', ()=>{ try{ localStorage.removeItem(FARMS_KEY); }catch(e){} try{ if(window._clearSave) window._clearSave(); }catch(e){} try{ renderSettingsFarms(); }catch(e){} }); };
  }
  if(btnSettings) btnSettings.onclick=()=>{ show(settingsSc); try{ renderSettingsFarms(); }catch(e){} };
  if(btnCredits) btnCredits.onclick=()=> show(creditsSc);
  // closes
  document.querySelectorAll('[data-close]').forEach(b=>{
    b.onclick=()=>{
      // si el menú se abrió desde dentro de la partida (ESC), VOLVER regresa al juego
      if(_topoHasWorld && document.body.classList.contains('game-started')){ topoCloseMenuToGame(); return; }
      hideAll(); if(main){ main.style.display='flex'; try{ topoRefreshContinueBtn(); }catch(e){} }
    };
  });
  // create size -> onboarding (no solape)
  const sizes={small:{cols:48,rows:28}, medium:{cols:64,rows:36}, big:{cols:96,rows:48}};
  // === FLUJO DE SIEMBRA (único dueño: app.js) ===
  // Topo: blindado - un solo flujo, reentrancia bloqueada, ningun paso puede dejar la pantalla
  // de carga colgada y si algo revienta se ve el porqué con boton de reintento.
  let _topoCreating=false;
  function topoGenScreenEls(){
    return {
      sc: document.getElementById('worldGenScreen'),
      bar: document.getElementById('genBar'),
      txt: document.getElementById('genBarText'),
      st: document.getElementById('genStatus'),
      sub: document.getElementById('genSub'),
      size: document.getElementById('genSizeLabel'),
      seed: document.getElementById('genSeedLabel')
    };
  }
  function topoGenFail(msg){
    _topoCreating=false;
    try{ const g=topoGenScreenEls(); if(g.sc) g.sc.style.display='none'; }catch(e){}
    gameAlert('⚠ LA SIEMBRA SE ATASCÓ', (msg||'motivo desconocido')+'\n\nReintenta desde CREAR NUEVA GRANJA. Si se repite, recarga (Ctrl+Shift+R): la colonia se guarda sola cada pocos segundos.',
      ()=>{ try{ if(main) main.style.display='flex'; }catch(e){} });
  }
  function topoBeginCreate(sizeKey, s){
    if(_topoCreating){ tlog('[TOPO] siembra en curso - click ignorado'); return; }
    _topoCreating=true;
    try{
      localStorage.setItem('antfarm_worldSize', sizeKey);
      localStorage.setItem('antfarm_worldSize_cols', s.cols);
      localStorage.setItem('antfarm_worldSize_rows', s.rows);
      localStorage.setItem('antfarm_createdAt', new Date().toISOString());
    }catch(e){ console.warn('ls fail',e); }
    try{ hideAll(); }catch(e){}
    const g=topoGenScreenEls();
    const done=()=>{ _topoCreating=false; };
    if(!g.sc){ // sin pantalla de carga: sembrar ya
      try{ topoCreateFreshWorld(s.cols, s.rows); }catch(e){ console.error('[TOPO] create', e); topoGenFail(e && e.message); return; }
      done(); try{ if(onboarding) onboarding.style.display='flex'; }catch(e){} return;
    }
    if(g.size) g.size.textContent = String(sizeKey).toUpperCase() + ' ' + s.cols + 'x' + s.rows + ' • ' + (s.cols*s.rows) + ' celdas';
    if(g.seed) g.seed.textContent = 'Seed: ' + Math.floor(Math.random()*999999999).toString(36).toUpperCase() + '  |  ' + new Date().toLocaleString('es-PE');
    g.sc.style.display='flex';
    if(g.bar) g.bar.style.width='0%';
    if(g.txt) g.txt.textContent='0%';
    if(g.st) g.st.textContent='Tallando terreno...';
    // el tiempo de siembra va con las celdas reales: un 48x28 no espera lo mismo que un 96x48
    const _cells=s.cols*s.rows;
    const stepMs=Math.max(120, Math.min(430, Math.round(_cells/9)));
    const steps=[
      {p:16, msg:'Tallando terreno...', sub:_cells+' celdas en capas'},
      {p:40, msg:'Sembrando plantas...', sub:'Pradera fértil en expansión'},
      {p:64, msg:'Escondiendo tesoros...', sub:'Cofres según quepa en el terreno'},
      {p:86, msg:'Llamando a la fundadora...', sub:'Reina + obreras listas'},
      {p:100, msg:'¡Mundo listo!', sub:'Pulsa para entrar'}
    ];
    let idx=0, finished=false, iv=0, wd=0;
    const t0=Date.now();
    function finish(err){
      if(finished) return; finished=true;
      try{ clearInterval(iv); }catch(e){}
      try{ clearInterval(wd); }catch(e){}
      done();
      if(err){ topoGenFail(err && err.message ? err.message : String(err)); return; }
      setTimeout(()=>{
        try{ if(g.sc) g.sc.style.display='none'; }catch(e){}
        // Topo: la colonia se guarda YA, antes del onboarding: si el navegador se cierra o recarga
        // sin pulsar EMPEZAR, la granja no se pierde (antes quedaba solo en memoria).
        try{ if(typeof serializeSave==='function') serializeSave(true); }catch(e){ console.warn('save post-crear', e.message); }
        try{ if(typeof topoArchiveCurrent==='function') topoArchiveCurrent('Granja Día '+day+' · '+COLS+'×'+ROWS); }catch(e){}
        try{ if(typeof topoRefreshContinueBtn==='function') topoRefreshContinueBtn(); }catch(e){}
        try{ if(onboarding) onboarding.style.display='flex'; }catch(e){}
        try{ if(typeof pushToast==='function') pushToast( (typeof W!=='undefined'?W/2:200), 100, 'Mundo '+sizeKey+' generado', '#2de67a'); }catch(e){}
      }, 240);
    }
    iv=setInterval(()=>{
      try{
        if(idx>=steps.length){
          try{ topoCreateFreshWorld(s.cols, s.rows); }catch(e){ console.error('[TOPO] create', e); finish(e); return; }
          finish(null);
          return;
        }
        const st=steps[idx++];
        if(g.bar) g.bar.style.width=st.p+'%';
        if(g.txt) g.txt.textContent=st.p+'%';
        if(g.st) g.st.textContent=st.msg;
        if(g.sub) g.sub.textContent=st.sub;
      }catch(e){ console.error('[TOPO] paso de siembra', e); finish(e); }
    }, stepMs);
    // vigilante: si por lo que sea el intervalo se corta (pestaña en segundo plano, error ajeno),
    // la pantalla de carga no se queda para siempre
    wd=setInterval(()=>{ if(finished) return; const max=steps.length*stepMs+12000; if(Date.now()-t0>max) finish(new Error('tiempo de siembra agotado')); }, 1500);
  }
  function handleSizeChoice(sizeKey){
    if(_topoCreating){ tlog('[TOPO] siembra en curso - click ignorado'); return; }
    const s=sizes[sizeKey]||sizes.medium;
    let meta=null;
    try{ meta=(typeof topoHasSave==='function')? topoHasSave():null; }catch(e){ console.warn('estado de guardado', e.message); }
    if(meta){
      // Topo: confirmacion dentro del juego (el confirm() nativo no existe en iframes sandboxeados)
      gameConfirm('¿Sobrescribir tu granja actual?',
        'Día '+meta.day+' · '+meta.pop+' hormigas · '+meta.cols+'×'+meta.rows+'\n\nAl crear otra, la actual pasa a «Archivadas» y podrás recuperarla desde CARGAR.',
        ()=>{
          try{ topoArchiveCurrent('Granja Día '+meta.day+' · '+meta.cols+'×'+meta.rows); }catch(e){ console.warn('archivar', e.message); }
          try{ localStorage.removeItem(SAVE_KEY); localStorage.removeItem('antfarm_worldAlive'); localStorage.removeItem('antfarm_time'); localStorage.removeItem('antfarm_lastReal'); }catch(e){}
          _topoHasWorld=false;
          topoBeginCreate(sizeKey, s);
        },
        ()=>{ try{ if(main) main.style.display='flex'; }catch(e){} });
      return;
    }
    topoBeginCreate(sizeKey, s);
  }
  document.querySelectorAll('#createSizeScreen [data-size]').forEach(b=>{
    b.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); handleSizeChoice(b.dataset.size); });
  });
  // delegado global por si cache vieja o attach temprano falla
  document.addEventListener('click', (e)=>{
    if(e.defaultPrevented) return; // el listener directo ya se ocupó de este click
    const t=e.target.closest && e.target.closest('#createSizeScreen [data-size]');
    if(t){ e.preventDefault(); e.stopPropagation(); handleSizeChoice(t.dataset.size); }
    const c=e.target.closest && e.target.closest('#mainMenu #btnMainCreate');
    if(c){ e.preventDefault(); e.stopPropagation(); try{ hideAll(); const cs=document.getElementById('createSizeScreen'); if(cs) cs.style.display='flex'; }catch(_){ } }
  });
  // log attach
  window._topoFlowReady = true;
  tlog('[TOPO] FLOW ready, createSc', !!createSc, 'onboarding', !!onboarding);

  const btnOn=document.getElementById('btnOnboardingStart');
  if(btnOn) btnOn.onclick=()=>{
    if(onboarding) onboarding.style.display='none';
    if(main) main.style.display='none';
    hideAll();
    try{ document.body.classList.add('game-started'); const ar=document.getElementById('appRoot'); if(ar) ar.style.display='flex'; const vb=document.getElementById('velAntBar'); if(vb) vb.style.visibility='visible'; const cw=document.getElementById('calendarWidget'); if(cw) cw.style.visibility='visible'; }catch(e){}
    // reanudar loop si estaba pausado en menu
    // aplicar tamaño y reinit — Topo: mundo ya generado en pantalla carga, no regenerar si existe
    try{
      const c=parseInt(localStorage.getItem('antfarm_worldSize_cols')||'64');
      const r=parseInt(localStorage.getItem('antfarm_worldSize_rows')||'36');
      if(!_topoHasWorld || COLS!==c || ROWS!==r){
        if(typeof topoCreateFreshWorld==='function') topoCreateFreshWorld(c,r);
      } else {
        tlog('[TOPO] mundo ya existe, skip regen');
      }
      try{ localStorage.setItem('antfarm_inGame','1'); }catch(e){}
      try{ if(typeof serializeSave==='function') serializeSave(true); }catch(e){}
    }catch(e){ console.error('fresh world',e); }
    try{ if(typeof pushToast==='function') pushToast(W/2,H/2-20,'🐜 ¡Granja creada!',' #2de67a'); }catch(e){}
  };
  // si ya hay mundo creado y no es primera vez, saltar splash? No, siempre splash breve
})();
