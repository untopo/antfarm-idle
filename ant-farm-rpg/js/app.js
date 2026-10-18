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
  food:(typeof economyLedger.food!=='undefined'?economyLedger.food:0), digs:(typeof digs!=='undefined'?digs:0),
  paused:(typeof paused!=='undefined'?paused:null), started: document.body.classList.contains('game-started'),
  queen: (typeof queen!=='undefined'&&queen)? (queen.personalName||queen.name||'reina'):null }; }catch(e){ return {error:e.message}; } };
function initSoilCache(){ const worldW=1024, worldH=576; // 64*16, 36*16 - no usar COLS antes de que exista
 soilCacheCanvas=document.createElement('canvas'); soilCacheCanvas.width=worldW; soilCacheCanvas.height=worldH; const c=soilCacheCanvas.getContext('2d'); if(c) c.imageSmoothingEnabled=false; soilCacheCtx=c; soilCacheDirty=true; }
initSoilCache();
let soilDirtyCells=null, _soilRepaints=0, _soilCellRepaints=0, _soilFullRepaints=0;
const SOIL_INCREMENTAL_MAX=260; // mas celdas sucias que esto sale mas barato repintar el mapa entero
// markSoilDirty()            -> cambio estructural: se repinta todo el nido
// markSoilDirty(c,r)         -> se anade esa celda y sus 4 vecinas (el muro del tunel depende de ellas)
function markSoilDirty(c,r){
  _soilRev++; soilCacheDirty=true;
  if(c===undefined||r===undefined){ soilDirtyCells=null; return; }   // estructural: mapa entero
  if(soilDirtyCells===false) return;                                  // lote ya enclavado a mapa entero
  if(soilDirtyCells===null) soilDirtyCells=new Set();
  // el anillo entero (3x3): los azulejos del atlas se dibujan con 1 px de sangre sobre la vecina
  // (x-1, CELL+2), asi que lo que se ve en el borde de esta celda lo pinta tambien la de al lado.
  // Sin el anillo, el resultado por celdas no coincidia pixel a pixel con el mapa entero.
  for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++) soilDirtyCells.add((c+dc)+','+(r+dr));
  // Si el lote se pasa del umbral se queda en modo "todo" hasta que se pinte: sin reabrir la lista
  if(soilDirtyCells.size>SOIL_INCREMENTAL_MAX){ soilDirtyCells=false; return; }
}
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

// Las hormigas se pintan a mano (ver _hormigaVoxel). Los cinco PNG de cuerpo -walk6, idle4,
// dig4, rest2 y la reina- salian de una hoja recortada que no concordaba con el mundo de
// bloques: de cerca se veia el canto del recorte y de lejos era una mancha. Se quitan la
// carga, el decode y cinco peticiones al arranque. El boton ANTHRO sigue valiendo: lo que
// changea es la POSTURA, no el fichero (vease la rama anthropo del pintor).
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
let anthroStyle=0; // 0=cuarteto, 1=chibi, 2=capucha: los tres con el mismo dibujo
function cycleAnthroStyle(){
  // Antes cada estilo cargaba su PNG; esos ficheros se fueron del proyecto y lo unico que
  // producian eran 404. El ciclo se queda como changeo de nombre porque hay tecla asignada.
  anthroStyle=(anthroStyle+1)%3;
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
// La unidad de la fatiga: 100 puntos por jornada de trabajo (y 1/14 de jornada devolver el aliento).
// Antes se contaba por frame, asi que la escala se iba arriba en cuanto el reloj se aceleraba.
const _fatUnidad = 100/DAY_LENGTH;
let gameSpeed=1, turbo=false, time=DAY_LENGTH*0.28, paused=false, taskbarMode=false, mouse={x:W/2,y:SURFACE_Y-10};
let deliveries=0, digs=0, accidents=0, rewardsFound=0, gen=0, mutations=0, commsCount=0;
// One ledger owns every ration and material. The two global accessors keep old saves, diagnostics and
// browser-console commands compatible while all assignments still pass through the core book.
const economyLedger=createEconomyLedger();
Object.defineProperties(globalThis,{
  colonyFood:{enumerable:true,configurable:true,get:()=>economyLedger.food,set:v=>economyLedger.setFood(v,'legacy food assignment')},
  worldMaterials:{enumerable:true,configurable:true,get:()=>economyLedger.materials,set:v=>economyLedger.replaceMaterials(v,'legacy material assignment')}
});
window.economyLedger=economyLedger;
let colonyFitness=0, colonyIQ=100; let lastCoup=0;
let selectedAntIndex=0;
let selectedQueenIndex=0;
let stats={nivel:1,xp:0,xpToNext:360}; // realista: GEN cuesta trabajo, no 2 entregas
let foods=[], pheromones=[], particles=[], mound=[], hiddenRewards=[], events=[];
let commInks=[], toasts=[];
let soil=[];
let water=[]; // physical liquid mass per cell; it may exceed 1 briefly under pressure
let waterVisual=[]; // interpolated visible level: water must be watchable, not teleport between cells
let waterFlow=new Map(); // recent conservative transfers, keyed by "c,r" for falling/spill animation
let _waterVisualActive=false;
// One seed owns geology, hydrology and the hidden past. Sites are materialised lazily as slabs open,
// but their position and evidence were already determined by this seed.
let worldSeed=0, worldProfile=null;
let ancientSites=[];
let ancientMasonry=[];
let _ancientArtCells=new Map(), _ancientMasonryCells=new Map(), _generatedSiteIds=new Set();
let decoSet=new Set(); // celdas decoradas por arquitectas (clave numerica dkey(c,r), nada de cadenas por celda)
function dkey(c,r){ return (r<<12)|c; }
function hasDeco(c,r){ return decoSet.size>0 && decoSet.has(dkey(c,r)); }
// === MUNDO VIVO EXTERIOR ===
let soilType=[]; // physical block/deposit type; bands now describe predominance, not perfect stripes
let geologyHost=[]; // host rock under an ore inclusion, used to render mixed seams naturally
let fertility=[]; // por columna 0-1
let plants=[]; // vegetación exterior
// Material balances live in economyLedger; `worldMaterials` above is only its compatibility view.
// Lo que la colonia ha HECHO con cada material (minarlo, cargarlo, llevarlo). De aqui saldra el invento:
// sin arbol de tecnologia escrito, solo costumbre y observacion.
let antsAtascados=0;
let materialUso={};
// habitos de cultivo: cuantas veces ha guardado cada celda comida de huerto, y cuantos votos hay contados
let _huertoVotos={}; let _huertoVotosN=0;
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

// ===== LA ESCALERA =====
// Topo pidio que cavar hacia abajo valga la pena: cada capa mas dura, cada capa con su material, y un
// limite que se ROMPE y destapa la siguiente. Las referencias que hay detras:
//   - Terraria  los minerales van por piso (cobre arriba, hierro por el medio, oro mas abajo, y lo ultimo
//               del mundo en el pozo del infierno). La idea que copia esto: la profundidad ES el requisito,
//               no un numero de generacion. Nadie te regala el oro, llegas o no llegas.
//   - SteamWorld Dig  bajar cuesta (aqui: fatiga y dureza) y cada capa tiene su color, para saber donde
//               estas sin leer numeros.
//   - Motherload y Deep Rock Galactic  hondo hay riesgo ademas de premio: el magma de la ultima banda no
//               se cava, se sufre.
//   - Core Keeper / Aground / Dwarf Fortress  las cuevas vacias ya son un premio (sitio donde respirar) y
//               una ruina contada en bloques vale mas que una cutscene.
// Ocho bandas, una losa al final de cada una, y reliquias que se quedan en la vitrina de la colonia.
// La escalera de bandas vive en core/bandas.js (carga antes que este archivo).

// ---- TESOROS DE LA ESCALERA ----
// Antes este cuadro vivia DENTRO de initSoil y checkRewardDiscovery lo leia desde fuera con un
// `typeof TREASURE_DEFS!=='undefined'` que mentia: def salia null y ningun tesoro de tier>=2 hacia nada
// al descubrirse (ni fibra, ni ambar, ni nada). Subirlo a nivel de modulo arregla eso y permite que cada
// banda tenga lo suyo. `reliquia:` = se queda para siempre en la VITRINA y da un bonus pequeno y visible.
// El sorteo vive en core/tesoros.js; aqui solo se le pasa el progreso de la colonia.
function pickTreasureType(depthTier){
  const prog = (typeof gen!=='undefined'?gen:0) + (typeof colonyIQ!=='undefined'? colonyIQ-100:0)/40;
  return pickTreasure(depthTier, prog);
}

// ---- EL UMBRAL: la losa que cierra la escalera ----
// No es un muro invisible ni un «ya no hay filas»: es una fila de roca con PUNTOS DE VIDA de la colonia
// entera. Cada excavadora que llega le arranca una astilla; cuando cede, el mundo crece una banda y la
// losa se convierte en el primer piso de esa banda. Se ve desde el mapa: los bichos se apiñan abajo.
let umbral=null;              // {r,c0,c1,hp,hpMax,banda}
let bandaMax=0;               // banda mas honda que el mapa cubre hoy
let umbralesRotos=0;          // losas reventadas: lo que se lee en el panel
let reliquias=[];             // {tipo,nombre,piso,dia,gen,lore,bonus}
let bonusCava=0;              // +velocidad de excavacion por reliquia (0.02-0.05 cada una, tope 0.30)
let magmaCells=[];            // indice del magma: la kamera solo mira esto, no el mapa entero
const UMBRAL_HP=(b)=> 16 + b*13;
function reindexMagma(){
  magmaCells=[];
  if(!Array.isArray(soilType)) return;
  for(let r=ROWS-1;r>SURFACE_ROW;r--){
    const row=soilType[r]; if(!row) continue;
    for(let c=0;c<COLS;c++) if(row[c]===15) magmaCells.push({r,c,x:c*CELL,y:r*CELL});
  }
}
function colocarUmbral(){
  if(!Array.isArray(soil) || soil.length<8) return;
  const r=ROWS-1;
  if(r<=SURFACE_ROW+4) return;
  for(let c=0;c<COLS;c++){
    if(soil[r]) soil[r][c]=1;
    if(soilType[r]) soilType[r][c]=17;
  }
  const b=bandaDe(r-SURFACE_ROW);
  // IMPORTANTE: la losa puede estar clavada en medio de una banda (en el mapa pequeno el ultimo piso
  // es PIEDRA y la losa es PIEDRA). Lo que interesa para el juego es lo que HAY DETRAS, asi que la
  // losa lleva los dos numeros: `banda` donde esta y `guarda` la que se abre al romperla.
  const guarda=Math.min(BANDAS.length-1, bandaDe(r+1-SURFACE_ROW));
  umbral={r, c0:2, c1:COLS-3, hp:UMBRAL_HP(guarda), hpMax:UMBRAL_HP(guarda), banda:b, guarda:guarda};
  bandaMax=Math.max(bandaMax, bandaDe(Math.max(SURFACE_ROW+1, ROWS-2)-SURFACE_ROW));
  markSoilDirty();
  tlog('[UMBRAL] losa en fila '+r+' ('+NOMBRE_BANDA(b)+') guarda '+NOMBRE_BANDA(guarda)+' · hp '+umbral.hp);
}
function puedeGolpearUmbral(){
  if(!umbral) return false;
  if(workers.length<3) return false;
  if(umbral.guarda>=5 && !inventions.masonry) return false;  // del marmol en adelante hace falta canteria
  return true;
}
function _reclutaFrenteUmbral(lider,u){
  if(!lider||lider.id==='TEST'||!u||!workers||workers.length<2) return;
  const crewCap=Math.min(8,Math.max(4,Math.floor(workers.length*0.24)));
  const leaderCounted=!!(lider.digTarget&&lider.digTarget.r===u.r&&soilType[u.r]&&soilType[u.r][lider.digTarget.c]===17);
  // The biter clears digTarget for the few lines that call golpearUmbral(), then restores it. Count her
  // during that gap; otherwise every bite recruits one extra helper and eventually drafts everyone.
  const already=workers.filter(w=>w.digTarget&&w.digTarget.r===u.r&&soilType[u.r]&&soilType[u.r][w.digTarget.c]===17).length+(leaderCounted?0:1);
  const slots=Math.max(0,crewCap-already); if(!slots) return;
  // The ant that discovered the slab remains the lead biter. Helpers make the collective work visible,
  // but must not demote the leader to the deliberately slow support rate or recruit the whole colony.
  const libres=workers.filter(w=>w!==lider&&!(w.digTarget&&w.digTarget.r===u.r)&&w.health>20&&(w.fatigue||0)<82&&!w.food&&!w._magmaRetreat&&w.state!=='CONTROLAR_AGUA'&&Math.abs(((w.y/CELL)|0)-u.r)<=2)
    .sort((a,b)=>Math.hypot(a.x-lider.x,a.y-lider.y)-Math.hypot(b.x-lider.x,b.y-lider.y));
  let n=0;
  for(const w of libres){
    let col=-1,bd=Infinity,at=Math.round(w.x/CELL);
    for(let c=u.c0;c<=u.c1;c++){
      if(!soil[u.r]||soil[u.r][c]!==1||!soilType[u.r]||soilType[u.r][c]!==17||!soil[u.r-1]||soil[u.r-1][c]!==0) continue;
      const d=Math.abs(c-at); if(d<bd){bd=d;col=c;}
    }
    if(col<0) continue;
    w.targetFood=null; w.wasteTarget=null; w.buildTarget=null;
    const same=w.digTarget&&w.digTarget.r===u.r&&w.digTarget.c===col;
    w.digTarget={r:u.r,c:col}; if(!same) w.digProgress=0;
    w.digNeeded=Math.max(5,11-Math.min(6,gen*0.5)); w.state='CAVANDO'; w._pozoPrincipal=true; w._umbralSupport=true; w._obraUmbralHasta=time+DAY_LENGTH*0.12;
    if(++n>=slots) break;
  }
}
function golpearUmbral(ant){
  const u=umbral; if(!u) return false;
  if(ant&&ant.id!=='TEST'){
    let lead=workers.find(w=>w!==ant&&w._umbralLead&&w.health>0&&(w.fatigue||0)<88&&w.state!=='DESCANSAR'&&!w._magmaRetreat);
    if(!lead){
      for(const w of workers) if(w!==ant) delete w._umbralLead;
      ant._umbralLead=true; delete ant._umbralSupport;
    }else if(!ant._umbralLead) ant._umbralSupport=true;
  }
  const exc = (ant && ant.role==='EXCAVADORA')? 0.55 : 0;
  const golpe = 1 + exc + (inventions.masonry?0.6:0) + Math.min(1.4, (typeof gen!=='undefined'?gen:0)*0.07)
              + Math.max(0,((typeof colonyIQ!=='undefined'?colonyIQ:100)-100))/200 + bonusCava;
  u.hp = Math.max(0, u.hp - golpe);
  _reclutaFrenteUmbral(ant,u);
  const c = (ant && Number.isFinite(ant.x))? Math.floor(ant.x/CELL) : u.c0;
  try{
    for(let i=0;i<4;i++) particles.push({x:c*CELL+6, y:u.r*CELL+8, vx:(Math.random()-0.5)*2.4, vy:-Math.random()*1.8, life:1, decay:0.035, color:'#c8c8d8', bloque:true});
    if(ant && Math.random()<0.35) pushToast(c*CELL+8, u.r*CELL-4, '⛏', '#c8c8d8', 0.8);
    markSoilDirty(c, u.r);
    if(ant) logAntHistory(ant, 'muerde la losa ('+Math.round(u.hp)+' por aguantar)');
  }catch(e){}
  if(u.hp<=0){ abrirUmbral(); return true; }
  return false;
}
function abrirUmbral(){
  const u=umbral; if(!u) return false;
  const nuevo=Math.min(BANDAS.length-1, bandaDe(u.r - SURFACE_ROW + 1));   // lo que hay DETRAS de la losa
  umbral=null;
  for(let c=0;c<COLS;c++){                                  // la losa se disuelve: primer piso de la banda
    if(soil[u.r]) soil[u.r][c]=1;
    if(soilType[u.r]) soilType[u.r][c]=_geoType(c,u.r);
  }
  const suelo=SURFACE_ROW + BANDAS[nuevo].desde + PISOS_BANDA;
  const add=Math.max(6, suelo-(ROWS-1));
  // expandWorld en modo silencioso: el aviso de «mundo expandido» lo da esta funcion, que sabe el nombre
  // de la banda. Sin el flag salian dos tarjetas diciendo lo mismo (el dueno lo dijo: una cifra, un sitio).
  try{ expandWorld(add, true); }catch(e){ console.warn('expandWorld tras umbral', e); }
  bandaMax=Math.max(bandaMax, Math.min(nuevo, bandaDe(Math.max(SURFACE_ROW+1, ROWS-2)-SURFACE_ROW))); umbralesRotos++;
  try{ workers.forEach(w=>{ w._pozoPrincipal=false; delete w._umbralSupport; delete w._umbralLead; if(w.digTarget&&w.digTarget.r===u.r){ w.digTarget=null; w.digProgress=0; if(w.state==='CAVANDO') w.state='EXPLORAR'; } }); }catch(e){}
  stats.xp += 90 + 30*nuevo; colonyFitness += 2.2;
  // Romper una losa es trabajo evolutivo igual que una entrega. Antes el XP se sumaba pero GEN no
  // se comprobaba hasta la siguiente entrega; una colonia podía haber ganado la generación en día 3
  // y seguir mostrando GEN0 hasta el día 4. El hito se liquida en el mismo instante en que ocurre.
  checkLevelUp();
  markSoilDirty(); reindexMagma();
  pushEvent('evo', '🕳️ UMBRAL ROTO · '+NOMBRE_BANDA(nuevo), 'el mapa llega a '+ROWS+' filas - '+reliquias.length+' reliquias en la vitrina');
  notifyCanon('🕳️ ¡NUEVA PROFUNDIDAD!', NOMBRE_BANDA(nuevo)+' - la colonia huele piedra mojada y algo mas duro', 6400);
  pushImportant('invention', '🕳️ SE ABRIÓ '+NOMBRE_BANDA(nuevo), 'la losa de la fila '+u.r+' cedio · piso '+(suelo-SURFACE_ROW)+' disponible');
  tlog('[UMBRAL] roto en fila '+u.r+' · banda '+nuevo+' ('+NOMBRE_BANDA(nuevo)+') · ROWS='+ROWS);
  return true;
}
function anotarReliquia(def, c, r){
  if(!def || !def.reliquia) return false;
  if(reliquias.some(x=>x.tipo===def.reliquia)) return false;      // cada maravilla, una sola vez
  reliquias.push({tipo:def.reliquia, nombre:def.reliquia, piso:r-SURFACE_ROW, dia:Math.floor(day||0),
                  gen:(typeof gen!=='undefined'?gen:0), lore:def.lore||'', bonus:def.bonus||0.02});
  bonusCava = Math.min(0.30, reliquias.reduce((a,x)=>a+(x.bonus||0),0));
  return true;
}

// ---- sembrador de botin, a nivel de modulo ----
// Subido desde dentro de initSoil: expandWorld y checkRewardDiscovery lo llamaban con
// `typeof spawnSmartTreasure==='function'`, que en el ambito de modulo era mentira -> los dos caminos
// nunca hicieron nada. Ahora la banda nueva sale con su botin puesto y al descubrir algo puede nacer
// otra cosa mas hondo.
function isValidTreasurePos(c,r){
  if(c<4||c>=COLS-4||r<SURFACE_ROW+4||r>=ROWS-3) return false;
  if(!soil[r]||soil[r][c]!==1) return false;
  // no muy cerca de otro tesoro - la separacion minima sigue la escala del mapa
  const _minD=Math.max(3, Math.min(7, Math.round(5*Math.sqrt(worldAreaRatio()))));
  for(let tr of hiddenRewards){ if(Math.hypot(tr.c-c,tr.r-r)<_minD) return false; }
  if(Math.hypot(c-CENTER_COL, r-(SURFACE_ROW+3))<6) return false;
  return true;
}
function spawnSmartTreasure(c,r,forcedType){
  if(!isValidTreasurePos(c,r)) return null;
  const depth=r-SURFACE_ROW;
  const tier = 1+bandaDe(depth);                 // el suelo manda: la banda ES el requisito
  const type=forcedType||pickTreasureType(tier);
  hiddenRewards.push({c,r,type,found:false,x:c*CELL+8,y:r*CELL+8, depthTier:tier});
  return true; // siempre truthy: el contador debe subir aunque el tipo caiga raro
}

function _fastGeoHost(c,r){
  const depth=Math.max(0,r-SURFACE_ROW),seg=Math.floor(c/8),u=(c-seg*8)/8,t=u*u*(3-2*u);
  const a=worldHash(worldSeed,seg,0,110),b=worldHash(worldSeed,seg+1,0,110);
  const warp=((a+(b-a)*t)-0.5)*7;
  let bi=worldBandAt(Math.max(0,depth+warp),BANDAS);
  const patch=worldHash(worldSeed,Math.floor(c/5),Math.floor(depth/4),111);
  if(patch<0.115&&bi>0) bi--;
  else if(patch>0.94&&bi<BANDAS.length-1&&depth>=BANDAS[bi+1].desde-4) bi++;
  if(depth<14){
    const soft=worldHash(worldSeed,Math.floor(c/4),Math.floor(depth/3),112);
    if(depth>2&&soft<0.22) return 2;
    if(depth>5&&soft>0.79) return 3;
    if(depth>11&&worldHash(worldSeed,c,depth,113)<0.055) return 4;
  }
  return BANDAS[bi].tipo;
}
function _buildGeologyRows(startR,endR){
  const lo=Math.max(0,startR|0),hi=Math.max(lo,endR|0),hosts=[],types=[];
  // Cache coarse samples once per slice. Rehashing the same two column anchors for every row made a
  // SMALL world's creation pay thousands of identical noise calls.
  const warp=new Array(COLS);
  for(let c=0;c<COLS;c++){
    const seg=Math.floor(c/8),u=(c-seg*8)/8,t=u*u*(3-2*u);
    const a=worldHash(worldSeed,seg,0,110),b=worldHash(worldSeed,seg+1,0,110);
    warp[c]=((a+(b-a)*t)-0.5)*7;
  }
  const maxDepth=Math.max(0,hi-SURFACE_ROW),patchCols=Math.ceil(COLS/5)+1,softCols=Math.ceil(COLS/4)+1;
  const patches=Array.from({length:Math.ceil((maxDepth+1)/4)+1},(_,y)=>Array.from({length:patchCols},(_,x)=>worldHash(worldSeed,x,y,111)));
  const softs=Array.from({length:Math.ceil((maxDepth+1)/3)+1},(_,y)=>Array.from({length:softCols},(_,x)=>worldHash(worldSeed,x,y,112)));
  for(let r=lo;r<hi;r++){
    const hr=new Array(COLS),tr=new Array(COLS),depth=Math.max(0,r-SURFACE_ROW);
    for(let c=0;c<COLS;c++){
      let h=0;
      if(r>=SURFACE_ROW){
        let bi=worldBandAt(Math.max(0,depth+warp[c]),BANDAS);
        const px=Math.floor(c/5),py=Math.floor(depth/4),pu0=(c-px*5)/5,pv0=(depth-py*4)/4,pu=pu0*pu0*(3-2*pu0),pv=pv0*pv0*(3-2*pv0);
        const pa=patches[py][px]+(patches[py][px+1]-patches[py][px])*pu,pb=patches[py+1][px]+(patches[py+1][px+1]-patches[py+1][px])*pu,patch=pa+(pb-pa)*pv;
        if(patch<0.115&&bi>0) bi--;
        else if(patch>0.94&&bi<BANDAS.length-1&&depth>=BANDAS[bi+1].desde-4) bi++;
        h=BANDAS[bi].tipo;
        if(depth<14){
          const sx=Math.floor(c/4),sy=Math.floor(depth/3),su0=(c-sx*4)/4,sv0=(depth-sy*3)/3,su=su0*su0*(3-2*su0),sv=sv0*sv0*(3-2*sv0);
          const sa=softs[sy][sx]+(softs[sy][sx+1]-softs[sy][sx])*su,sb=softs[sy+1][sx]+(softs[sy+1][sx+1]-softs[sy+1][sx])*su,soft=sa+(sb-sa)*sv;
          if(depth>2&&soft<0.22) h=2; else if(depth>5&&soft>0.79) h=3;
        }
      }
      hr[c]=h; tr[c]=h;
    }
    hosts.push(hr); types.push(tr);
  }
  // A few deterministic walkers create crooked seams. Their core lies near the useful depth, while
  // poor tails can cross a neighbouring stratum. This is both cheaper and less blob-like than rolling
  // every cell independently against a band table.
  for(const q of (typeof WORLD_DEPOSITS!=='undefined'?WORLD_DEPOSITS:[])){
    // A walker may bend up to its maximum length. Include neighbouring chunks so generating a later
    // slice reproduces veins that began outside that slice instead of cutting them at expansion seams.
    const first=Math.floor((Math.max(0,lo-SURFACE_ROW)-24)/6),last=Math.floor((Math.max(0,hi-1-SURFACE_ROW)+24)/6);
    const attempts=Math.max(1,Math.ceil(COLS/40));
    for(let chunk=first;chunk<=last;chunk++) for(let a=0;a<attempts;a++){
      // One seam is anchored in each deposit's useful core; all others are statistical. This keeps
      // progression readable without banning poor traces from neighbouring strata.
      const anchor=a===0&&chunk===Math.floor(q.center/6);
      const baseD=anchor?q.center:chunk*6+Math.floor(worldHash(worldSeed,chunk,a,q.salt+10)*6),dist=Math.abs(baseD-q.center);
      if(dist>q.trace) continue;
      const richness=Math.max(0,1-dist/q.trace);
      if(!anchor&&worldHash(worldSeed,chunk,a,q.salt+11)>0.004+Math.pow(richness,3)*0.82) continue;
      let cc=2+Math.floor(worldHash(worldSeed,chunk,a,q.salt+12)*Math.max(1,COLS-4));
      let dd=baseD,dir=worldHash(worldSeed,chunk,a,q.salt+13)<0.5?-1:1;
      const poorTail=!anchor&&dist>=q.core;
      const len=anchor?12+Math.floor(worldHash(worldSeed,chunk,a,q.salt+14)*5):poorTail?2+Math.floor(worldHash(worldSeed,chunk,a,q.salt+14)*4):4+Math.floor(worldHash(worldSeed,chunk,a,q.salt+14)*(5+richness*9));
      for(let k=0;k<len;k++){
        if(anchor) dd=baseD+Math.round(Math.sin(k*0.72)*2);
        const rr=SURFACE_ROW+Math.round(dd),idx=rr-lo;
        if(idx>=0&&idx<types.length&&cc>0&&cc<COLS-1&&rr>SURFACE_ROW+1){ types[idx][cc]=q.type; }
        if(idx>=0&&idx<types.length&&richness>0.55&&worldHash(worldSeed,chunk,k+a*31,q.salt+15)>0.76){ const nc=cc+(dir>0?-1:1); if(nc>0&&nc<COLS-1) types[idx][nc]=q.type; }
        cc+=dir;
        if(cc<=1||cc>=COLS-2){ dir*=-1; cc=Math.max(2,Math.min(COLS-3,cc)); }
        const bend=worldHash(worldSeed,chunk,k+a*37,q.salt+16);
        if(bend<0.22) dd-=1; else if(bend>0.78) dd+=1;
        if(worldHash(worldSeed,chunk,k+a*41,q.salt+17)<0.10) dir*=-1;
      }
    }
  }
  return {hosts,types};
}
function _geoHost(c,r){
  if(geologyHost[r]&&geologyHost[r][c]) return geologyHost[r][c];
  const depth=Math.max(0,r-SURFACE_ROW);
  try{ return worldGeologyHost(worldSeed,c,depth); }catch(_e){ return tipoDePiso(depth); }
}
function _geoType(c,r){
  const host=_geoHost(c,r);
  try{ return worldDepositAt(worldSeed,c,Math.max(0,r-SURFACE_ROW))||host; }catch(_e){ return host; }
}
function _isDepositType(t){ return t===8||t===9||t===10||t===16||t===18; }
function _visualHost(t,c,r){ return _isDepositType(t)?_geoHost(c,r):t; }
function _ancientStyle(i){
  const styles=worldProfile&&worldProfile.styles;
  return styles&&styles.length?styles[Math.abs(i|0)%styles.length]:{palette:['#9b3f2b','#d58a4f','#39251e'],motif:'rings',stroke:1,joint:'clay'};
}
function _ancientPixel(map,site,wx,wy,color,size){
  wx=Math.round(wx); wy=Math.round(wy); const c=Math.floor(wx/CELL),r=Math.floor(wy/CELL);
  if(c<0||c>=COLS||r<SURFACE_ROW||r>=ROWS) return;
  // Centuries remove pieces, not whole murals uniformly. The same missing flecks return after reload.
  try{ if(worldHash(site.muralSeed,wx,wy,913)<site.damage*0.34) return; }catch(_e){}
  const key=c+','+r; if(!map.has(key)) map.set(key,[]);
  map.get(key).push({x:wx-c*CELL,y:wy-r*CELL,color,size:size||1});
}
function _ancientLine(map,site,x0,y0,x1,y1,color,size){
  x0=Math.round(x0);y0=Math.round(y0);x1=Math.round(x1);y1=Math.round(y1);
  const dx=Math.abs(x1-x0),sx=x0<x1?1:-1,dy=-Math.abs(y1-y0),sy=y0<y1?1:-1; let err=dx+dy;
  for(let guard=0;guard<2048;guard++){
    _ancientPixel(map,site,x0,y0,color,size);
    if(x0===x1&&y0===y1) break;
    const e2=2*err; if(e2>=dy){err+=dy;x0+=sx;} if(e2<=dx){err+=dx;y0+=sy;}
  }
}
function _ancientEllipse(map,site,cx,cy,rx,ry,color,size){
  const steps=Math.max(16,Math.ceil((rx+ry)*2.2)); let px=cx+rx,py=cy;
  for(let i=1;i<=steps;i++){ const a=i/steps*Math.PI*2,nx=cx+Math.cos(a)*rx,ny=cy+Math.sin(a)*ry; _ancientLine(map,site,px,py,nx,ny,color,size);px=nx;py=ny; }
}
function _buildAncientArt(site,map){
  const st=_ancientStyle(site.style), col=st.palette[0], pale=st.palette[1], size=st.stroke||1;
  const cx=site.c*CELL+CELL/2, cy=site.r*CELL+CELL/2;
  const rx=Math.max(CELL*2,(site.w*CELL)/2-8), ry=Math.max(CELL,(site.h*CELL)/2-7);
  const motif=st.motif;
  if(motif==='tide'){
    for(let band=-1;band<=1;band++){ let px=cx-rx,py=cy+band*5;
      for(let x=-Math.floor(rx);x<=rx;x+=3){ const nx=cx+x,ny=cy+band*5+Math.sin((x+site.muralSeed%17)*0.10)*4; _ancientLine(map,site,px,py,nx,ny,band===0?pale:col,size);px=nx;py=ny; }
    }
  }else if(motif==='rings'){
    _ancientEllipse(map,site,cx,cy,rx*0.72,ry*0.72,col,size); _ancientEllipse(map,site,cx,cy,rx*0.40,ry*0.42,pale,size);
    _ancientLine(map,site,cx-rx*0.88,cy,cx+rx*0.88,cy,col,1);
  }else if(motif==='network'){
    const pts=[[-.72,-.35],[-.25,.38],[.05,-.42],[.48,.27],[.76,-.22],[.18,.05]];
    for(let i=0;i<pts.length;i++){
      const a=pts[i],b=pts[(i*2+3)%pts.length],ax=cx+a[0]*rx,ay=cy+a[1]*ry,bx=cx+b[0]*rx,by=cy+b[1]*ry;
      _ancientLine(map,site,ax,ay,bx,by,i%2?pale:col,size); _ancientEllipse(map,site,ax,ay,2+i%2,2,col,1);
    }
  }else if(motif==='procession'){
    _ancientEllipse(map,site,cx,cy,5,7,pale,size);
    for(let i=-3;i<=3;i++){ const ax=cx+i*11,ay=cy+Math.sin(i*1.7)*4; _ancientEllipse(map,site,ax,ay,2,2,col,1); _ancientLine(map,site,ax-4,ay,ax+4,ay,col,1); }
  }else if(motif==='split'){
    _ancientLine(map,site,cx,cy+ry*.8,cx,cy-ry*.75,pale,size);
    for(let i=-2;i<=2;i++){ const yy=cy+i*ry*.26,dir=i%2?1:-1; _ancientLine(map,site,cx,yy,cx+dir*rx*(.45+.08*Math.abs(i)),yy-ry*.22,col,size); }
  }else{
    for(let yy=-1;yy<=1;yy++) for(let xx=-3;xx<=3;xx++) _ancientEllipse(map,site,cx+xx*9+(yy&1)*4,cy+yy*8,3,5,(xx+yy)&1?col:pale,1);
  }
  // Extremely rare, deterministic marginal marks: small enough to belong to the mural and never
  // announced. A player who notices one can wonder whether the odd grouping is deliberate.
  const ox=cx-rx*.72,oy=cy+ry*.63;
  if(site.oddity===1){ for(const p of [[0,0],[2,0],[3,-2],[1,-4],[-2,-3],[-3,0],[-1,2]]) _ancientPixel(map,site,ox+p[0],oy+p[1],pale,1); }
  else if(site.oddity===2){ _ancientEllipse(map,site,ox,oy,2,3,pale,1); for(const p of [[-2,-2,-5,-4],[2,-2,5,-4],[-2,1,-5,3],[2,1,5,3]]) _ancientLine(map,site,ox+p[0],oy+p[1],ox+p[2],oy+p[3],col,1); }
  else if(site.oddity===3){ for(let i=0;i<4;i++) _ancientPixel(map,site,ox+i*2,oy,col,1); for(let i=0;i<2;i++) _ancientPixel(map,site,ox+11+i*2,oy,col,1); }
}
function rebuildAncientIndexes(){
  _ancientArtCells=new Map(); _ancientMasonryCells=new Map(); _generatedSiteIds=new Set();
  for(const m of ancientMasonry||[]){ const key=m.c+','+m.r; if(!_ancientMasonryCells.has(key)) _ancientMasonryCells.set(key,[]); _ancientMasonryCells.get(key).push(m); }
  for(const s of ancientSites||[]){ _generatedSiteIds.add(s.id); _buildAncientArt(s,_ancientArtCells); }
}
function _paintAncientEvidence(g,c,r,solid){
  const key=c+','+r;
  if(!solid){
    const marks=_ancientArtCells.get(key); if(!marks||!marks.length) return;
    for(const p of marks){ g.fillStyle=p.color; g.fillRect(c*CELL+p.x,r*CELL+p.y,p.size||1,p.size||1); }
    return;
  }
  const stones=_ancientMasonryCells.get(key); if(!stones||!stones.length) return;
  const st=_ancientStyle(stones[0].style),x=c*CELL,y=r*CELL;
  g.fillStyle=st.palette[2]||'#2d241e'; g.fillRect(x+2,y+5,CELL-4,1); g.fillRect(x+4,y+11,CELL-7,1);
  if(((c*5+r*3)&1)===0){ g.fillStyle=st.palette[0]; g.fillRect(x+7,y+3,1,10); }
  // Related sites carry related residue: soot, pale tide lines or root scoring. These marks are clues,
  // never captions; later repairs can visibly use another established palette.
  const scar=stones[0].scar;
  if(scar==='heat'){ g.fillStyle='rgba(18,12,10,.58)'; g.fillRect(x+2,y+12,CELL-5,2); }
  else if(scar==='water'){ g.fillStyle='rgba(166,203,194,.42)'; g.fillRect(x+1,y+8,CELL-2,1); }
  else if(scar==='roots'){ g.fillStyle='rgba(84,62,36,.55)'; g.fillRect(x+5,y+1,1,6); g.fillRect(x+6,y+6,3,1); }
}
function _materializeAncientSite(raw,rowLo,rowHi){
  const site=Object.assign({},raw,{r:SURFACE_ROW+raw.depth});
  const top=Math.max(rowLo,site.r-Math.floor(site.h/2)),bot=Math.min(rowHi,site.r+Math.floor(site.h/2));
  const left=Math.max(2,site.c-Math.floor(site.w/2)),right=Math.min(COLS-3,site.c+Math.floor(site.w/2));
  if(top>bot||left>right) return false;
  let carved=0;
  for(let r=top;r<=bot;r++) for(let c=left;c<=right;c++){
    if(!soil[r]||!soilType[r]||soilType[r][c]===17) continue;
    const nx=(c-site.c)/Math.max(1,site.w/2),ny=(r-site.r)/Math.max(1,site.h/2);
    const inside=nx*nx+ny*ny<0.92;
    let scar=0; try{ scar=worldHash(site.muralSeed,c,r,701); }catch(_e){ scar=Math.random(); }
    if(inside&&scar>site.damage*0.20){ soil[r][c]=0; soilType[r][c]=0; carved++; }
  }
  if(!carved) return false;
  // Worked fragments survive around the cavity. Their mismatched repairs make the structure readable
  // without naming it or explaining why it was abandoned.
  for(let r=Math.max(SURFACE_ROW,top-1);r<=Math.min(ROWS-1,bot+1);r++) for(let c=Math.max(1,left-1);c<=Math.min(COLS-2,right+1);c++){
    if(soil[r]&&soil[r][c]===1){
      let near=false; for(const d of [[1,0],[-1,0],[0,1],[0,-1]]) if(soil[r+d[1]]&&soil[r+d[1]][c+d[0]]===0) near=true;
      if(near&&worldHash(site.muralSeed,c,r,702)>0.35){
        const repaired=site.repairStyle!=null&&worldHash(site.muralSeed,c,r,704)<(site.repairRate||0);
        ancientMasonry.push({c,r,style:repaired?site.repairStyle:site.style,site:site.id,scar:site.scar||''});
      }
    }
  }
  // A flooded room is only initial mass. It drains, levels and eventually empties; no invisible emitter
  // refills it. Rain and explicitly marked future springs are separate inputs.
  if(site.flood>0){
    const waterLine=site.r+Math.floor(site.h*0.20);
    for(let r=top;r<=bot;r++) for(let c=left;c<=right;c++) if(soil[r]&&soil[r][c]===0&&r>=waterLine){
      const amt=Math.max(0.10,Math.min(0.95,site.flood+(r-waterLine)*0.10-worldHash(site.muralSeed,c,r,703)*0.12));
      water[r][c]=Math.max(water[r][c]||0,amt); _waterActive=true;
    }
  }
  ancientSites.push(site); return true;
}
function materializeWorldHistory(rowLo,rowHi){
  if(!worldSeed) return 0;
  if(!worldProfile) worldProfile=createWorldProfile(worldSeed,COLS);
  const lo=Math.max(SURFACE_ROW+8,rowLo|0),hi=Math.min(ROWS-2,rowHi|0); if(lo>hi) return 0;
  // h is at most 7: reserve four built rows below a centre and overlap four old rows on the next
  // expansion. A ruin is therefore identical whether its depth existed on day one or arrived lazily.
  const queryLo=Math.max(15,lo-SURFACE_ROW-4),queryHi=hi-SURFACE_ROW-4;
  if(queryHi<queryLo) return 0;
  const sites=worldSitesForRange(worldProfile,COLS,queryLo,queryHi); let n=0;
  for(const site of sites){
    if(_generatedSiteIds.has(site.id)) continue;
    if(_materializeAncientSite(site,SURFACE_ROW+8,ROWS-2)){ _generatedSiteIds.add(site.id); n++; }
  }
  rebuildAncientIndexes();
  if(n) markSoilDirty();
  return n;
}
function initSoil(){
  soil=Array.from({length:ROWS},(_,r)=>Array.from({length:COLS},(_,c)=> r<SURFACE_ROW?0:1));
  if(!worldSeed) worldSeed=worldSeed32(Math.floor(Math.random()*4294967296));
  worldProfile=createWorldProfile(worldSeed,COLS);
  ancientSites=[]; ancientMasonry=[]; _generatedSiteIds=new Set(); rebuildAncientIndexes();
  water=Array.from({length:ROWS},()=>Array(COLS).fill(0));
  waterVisual=Array.from({length:ROWS},()=>Array(COLS).fill(0)); waterFlow=new Map(); _waterVisualActive=false;
  const _geo=_buildGeologyRows(0,ROWS); geologyHost=_geo.hosts; soilType=_geo.types;
  // Depth is a tendency, not a ruler-straight command. Warped strata, neighbouring lenses and
  // crooked deposits make every seed readable as geology while deeper rows still predominate.
  // Y el fuego: en la ultima banda el magma asoma entre el basalto. No se cava, calienta y gasta fatiga.
  const _FUEGO=BANDAS.length-1;
  for(let r=SURFACE_ROW+BANDAS[_FUEGO].desde; r<ROWS-1; r++){
    for(let c=1;c<COLS-1;c++){
      if(soilType[r][c]!==BANDAS[_FUEGO].tipo) continue;
      if(worldHash(worldSeed,c,r,1501)>0.055) continue;
      soilType[r][c]=15;
      for(let k=0;k<2;k++){ const cc2=c+(worldHash(worldSeed,c+k,r,1502)<0.5?-1:1); if(cc2>0&&cc2<COLS-1&&soilType[r][cc2]===14&&worldHash(worldSeed,cc2,r+k,1503)<0.6) soilType[r][cc2]=15; }
    }
  }
  reindexMagma();
  colocarUmbral();
  // (antes los metales se sembraban aqui con umbrales de piso a mano; ahora la pasada por bandas de
  //  arriba, con VETA_P, deja el cobre en PIEDRA, el hierro en PIZARRA y el oro en CUARCITA)
  const cc=CENTER_COL; entradaCol=cc;
  // pozo inicial - la UNICA boca del nido: tres columnas de cesped, el resto queda blindado
  carveRect(cc-1,SURFACE_ROW,3,7);
  carveRect(cc-1,SURFACE_ROW+7,3,2);
  // The first traces may exist in a disconnected side chamber. Deeper sites do not exist in the
  // matrices until their slab is opened, but their positions are already fixed by worldSeed.
  materializeWorldHistory(SURFACE_ROW+8,ROWS-2);
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
  // Los tesoros y su sorteo subieron a nivel de modulo (TESOROS DE LA ESCALERA, arriba), porque
  // checkRewardDiscovery los leia desde fuera y no los veia.
  // (isValidTreasurePos y spawnSmartTreasure subieron a nivel de modulo: expandWorld y el respawn tras
  //  descubrir un tesoro los llamaban desde fuera y el guardaNulo de `typeof spawnSmartTreasure` hacia
  //  que no pasaran nada - ni cofres nuevos al cavar, ni botin en las bandas que se abrian)
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
  // huecos de prueba de la Escalera (test/profundidad.js): leer y forzar el estado sin depender del azar
  window._escalera=()=>({umbral: umbral? {r:umbral.r,hp:Math.round(umbral.hp*10)/10,hpMax:umbral.hpMax,banda:umbral.banda,guarda:umbral.guarda} : null,
                         bandaMax, umbralesRotos, filas:ROWS, pisos:ROWS-SURFACE_ROW,
                         losa: (soilType[ROWS-1]? soilType[ROWS-1][3] : -1),
                         losaSuelo: (soil[ROWS-1]? soil[ROWS-1][3] : -1), magma:magmaCells.length,
                         bandaFondo: bandaDe(Math.max(0,ROWS-2-SURFACE_ROW)),
                         vetas:{cobre:economyLedger.materials.cobre||0, hierro:economyLedger.materials.hierro||0, oro:economyLedger.materials.oro||0,
                                cuarzo:economyLedger.materials.cuarzo||0, gema:economyLedger.materials.gema||0, obsidiana:economyLedger.materials.obsidiana||0},
                         reliquias:reliquias.length, bonusCava});
  window._morderUmbral=(n)=>{ for(let i=0;i<(n||1);i++) golpearUmbral({id:'TEST',role:'EXCAVADORA',x:umbral?umbral.r*0+ (umbral.c0*CELL):0, y:umbral?umbral.r*CELL:0}); return window._escalera(); };
  window._irABanda=(b)=>{   // deja la losa a un mordisco y la revienta: el test quiere ver la banda, no esperar
    for(let i=0;i<14 && bandaMax < b; i++){
      if(!umbral) colocarUmbral();
      if(!umbral) break;
      umbral.hp = Math.min(umbral.hp, 1);
      if(!abrirUmbral()) break;
    }
    return window._escalera();
  };
  window._treasures=()=>hiddenRewards.map(t=>({c:t.c,r:t.r,type:t.type,found:t.found}));
  window._worldEvidence=()=>({seed:worldSeed,sites:ancientSites.map(s=>({id:s.id,c:s.c,r:s.r,kind:s.kind,biome:s.biome})),masonry:ancientMasonry.length,artCells:_ancientArtCells.size});
  // gancho de prueba: pega obreras de mentira repartidas por el nido para ver como se lee una colonia grande
  // sin esperar diez dias de simulacion. Vive solo en consola; el juego no lo llama nunca.
  window._fakes=(n)=>{ try{
      const base=workers[0]; if(!base) return 0;
      for(let i=0;i<n;i++){
        const cl=JSON.parse(JSON.stringify(base));
        cl.x=4*CELL+((i*37)%Math.max(1,COLS-8))*CELL+3; cl.y=(SURFACE_ROW+4)*CELL+((i*53)%12)*CELL+4;
        cl.state='IDLE'; cl.selected=false; cl._renderX=cl.x; cl._renderY=cl.y; cl._debugFake=true;
        workers.push(cl);
      }
      return workers.length;
    }catch(err){ console.warn('_fakes',err&&err.message); return -1; } };
  markSoilDirty();
}
// === LA ENTRADA ===
// Topo (pedido del dueño): la boca del nido es UNA y es estrecha. Antes cualquier calada en la
// fila del cesped abria hueco, y el desprendimiento de vecinos abria otro al azar: al segundo dia
// tenian un crater de media superficie que las dejaba expuestas y hacia crecer musgo y hongos en el
// aire, junto a la entrada. La fila de cesped solo se rompe en la columna de la entrada y sus dos
// vecinas (3 columnas: lo que ya abre initSoil), y el sitio elegido se respeta al recargar.
let entradaCol = -1;
function detectarEntrada(){
  let best=CENTER_COL, bd=Infinity;
  for(let c=0;c<COLS;c++){ if(soil[SURFACE_ROW] && soil[SURFACE_ROW][c]===0){ const d=Math.abs(c-CENTER_COL); if(d<bd){bd=d;best=c;} } }
  entradaCol=best; return best;
}
function _bocaAncho(){ let n=0; for(let c=0;c<COLS;c++) if(soil[SURFACE_ROW] && soil[SURFACE_ROW][c]===0) n++; return n; }
// puede abrirse esta celda? fuera de la entrada, el cesped no se toca
function puedeAbrirSuperficie(c, r){
  if(r>SURFACE_ROW) return true;
  if(r<0 || r<SURFACE_ROW) return false;
  if(soil[r][c]===0) return true;
  const ec = entradaCol>=0? entradaCol : detectarEntrada();
  if(Math.abs(c-ec)>1) return false;
  return _bocaAncho()<=3;
}
function carveRect(c,r,w,h){for(let y=r;y<r+h;y++)for(let x=c;x<c+w;x++)if(y>=0&&y<ROWS&&x>=0&&x<COLS){if(y<=SURFACE_ROW && !puedeAbrirSuperficie(x,y)) continue; soil[y][x]=0; if(soilType[y]) soilType[y][x]=0; markSoilDirty();}}

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
      if(t===15 || t===17) continue;              // el fuego y la losa no se allanan: hay que ganarselos
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
    if(ant && ant.traits.construccion>50) economyLedger.creditMaterial('sand',Math.floor(carved*0.12),'chamber excavation');
    return carved;
  }
  return 0;
}

function carveOval(cx,cy,rx,ry){for(let y=cy-ry;y<=cy+ry;y++)for(let x=cx-rx;x<=cx+rx;x++){if(y<0||y>=ROWS||x<0||x>=COLS)continue;const dx=(x-cx)/rx,dy=(y-cy)/ry;if(dx*dx+dy*dy<=1){soil[y][x]=0; if(soilType[y]) soilType[y][x]=0; markSoilDirty();}}}
// === EXPANSIÓN DE MUNDO TERRARIA/STARBOUND - mapa más profundo si la colonia puede ===
// Como Terraria Small 4200x1200 → Large 8400x2400, tu granja empieza 64x36 y puede crecer 96x120 si cavan profundo
function expandWorld(addRows, silencioso){
  const oldRows=ROWS;
  const newRows=ROWS+addRows;
  // Generate this slice from the same seed as the initial world: lazy depth, never rerolled depth.
  const _newGeo=_buildGeologyRows(oldRows,newRows);
  for(let r=oldRows;r<newRows;r++){
    const i=r-oldRows;
    soil.push(Array(COLS).fill(1));
    water.push(Array(COLS).fill(0));
    waterVisual.push(Array(COLS).fill(0));
    geologyHost.push(_newGeo.hosts[i]);
    soilType.push(_newGeo.types[i]);
  }
  // Geology for unopened rows comes from the same seed as the original map. There is no second,
  // more generous loot pass: opening a slab reveals the world that was already implied, not a reroll.
  // y si la banda que se abre es la ultima, su fuego
  if(bandaDe((newRows-1)-SURFACE_ROW)>=BANDAS.length-1){
    for(let r=Math.max(oldRows,SURFACE_ROW+BANDAS[BANDAS.length-1].desde); r<newRows-1; r++){
      for(let c=1;c<COLS-1;c++){
        if(soilType[r][c]!==BANDAS[BANDAS.length-1].tipo || worldHash(worldSeed,c,r,1501)>0.055) continue;
        soilType[r][c]=15;
      }
    }
  }
  // LA CUEVA: el hueco vacio ya es premio (Core Keeper, Dwarf Fortress). Una o dos camaras grandes en la
  // banda nueva, con botin dentro - asi «bajar» se ve como un sitio, no como un numero.
  const _nc=1+((Math.random()*2)|0);
  for(let i=0;i<_nc;i++){
    const rx=5+Math.floor(Math.random()*Math.max(1,COLS-10));
    const ry=Math.min(newRows-3, oldRows+1+Math.floor(Math.random()*Math.max(1,newRows-oldRows-2)));
    const rxr=3+Math.floor(Math.random()*3), ryr=2+Math.floor(Math.random()*2);
    for(let y=ry-ryr;y<=ry+ryr;y++){
      if(y<=SURFACE_ROW+1||y>=newRows-1) continue;
      for(let x=rx-rxr;x<=rx+rxr;x++){
        if(x<1||x>=COLS-1||!soil[y]) continue;
        const dx=(x-rx)/rxr, dy=(y-ry)/ryr;
        if(dx*dx+dy*dy<=1 && soil[y][x]===1){ soil[y][x]=0; if(soilType[y]) soilType[y][x]=0; markSoilDirty(x,y); }
      }
    }
    for(let a=0;a<6;a++){
      const cc=rx-3+Math.floor(Math.random()*7), rr=ry+1+Math.floor(Math.random()*3);
      if(spawnSmartTreasure(cc,rr)) break;
    }
  }
  ROWS=newRows;
  materializeWorldHistory(oldRows,newRows-2);
  // El alto lógico, el lienzo visible y el cache tienen que crecer juntos. Antes solo crecían las
  // matrices: H seguía en la fila de la primera losa, la física sujetaba a todas en y=H-12 y la
  // despensa podía mudarse a una cámara que ni las hormigas ni la cámara alcanzaban. Al recargar sí
  // se recalculaba H, por eso la misma partida cambiaba de comportamiento después de un F5.
  H=ROWS*CELL;
  try{
    const _cv=document.getElementById('farmCanvas');
    if(_cv){ _cv.height=H; if(ctx) ctx.imageSmoothingEnabled=false; }
    soilCacheCanvas.height=H; soilCacheCanvas.width=COLS*CELL;
    // Cambiar el tamano del lienzo REINICIA su contexto: sin volver a apagar el suavizado, las filas
    // recien liberadas salen borrosas (el dueno lo llamo «texturas raras»). Y el aviso de repintado
    // tenia que ser UNO solo - marcar dos veces convertia «mapa entero» en «lote vacio», asi que las
    // filas nuevas no se dibujaban hasta recargar la pagina, que es justo lo que se le veia.
    const _cc = soilCacheCtx || soilCacheCanvas.getContext('2d');
    if(_cc) _cc.imageSmoothingEnabled=false;
    soilCacheCtx=_cc;
    soilDirtyCells=null; soilCacheDirty=true; _soilRev++;
  }catch(e){}
  if(!silencioso){
    pushEvent('evo',`🌍 Mundo expandido +`+addRows+` filas → `+ROWS+` profundidad`, `progresivo: más profundo = más duro y más recompensas`);
    notifyCanon('🌍 MAPA MÁS PROFUNDO', `El mundo crece a `+ROWS+` filas - las excavadoras llegaron al fondo`, 5200);
  }
  // y el nuevo techo: otra losa, otra banda que ganarse. Sin esto la escalera se acaba y vuelven a
  // estar cavando en el vacio.
  colocarUmbral(); reindexMagma();
  try{ for(let i=0;i<4;i++){ const c=4+Math.floor(Math.random()*(COLS-8)), r=oldRows+Math.floor(Math.random()*Math.max(2,newRows-oldRows)); spawnSmartTreasure(c,r); } }catch(e){}
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
      // Topo: la fila del cesped tampoco se desploma. Medido en Chrome real al dia 5: la colonia
      // habia cavado bajo la capa de raices y la gravedad habia abierto un boquete del columna 23
      // a 47 - el "abren una abertura enorme arriba que las deja expuestas" no venia de cavar el
      // cesped (eso ya esta blindado) sino del cesped cayendo dentro del tunel de al lado.
      if(r===SURFACE_ROW && !puedeAbrirSuperficie(c, r)) continue;
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
        // misma escala que las marcas: 0 arriba del todo de la barra = el piso (SURFACE_Y), abajo = el
        // fondo del mapa. Si se reparte el mundo entero, pinchar en el numero 10 no llevaba al 10.
        const rect=ruler.getBoundingClientRect();
        const pct=Math.max(0, Math.min(1, (clientY-rect.top)/Math.max(1,rect.height)));
        const _pisos=Math.max(2, ROWS-SURFACE_ROW);
        const worldY=SURFACE_Y + pct*_pisos*CELL;
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
    // LOS NUMEROS CUENTAN DESDE EL PISO. La hilera del cesped es la 0 y hacia abajo 5, 10, 15...; arriba
    // del piso no hay profundidad que medir, hay cielo, y por eso antes el «0» colgaba en el aire y el
    // reparto de la barra se comia las tres filas del prado. Los materiales salen del mapa de verdad (y
    // siguen valiendo cuando el mundo crece), no de una lista fija que se quedo corta al expandir.
    const _pisos = Math.max(2, ROWS - SURFACE_ROW);
    const _paso = _pisos>96? 25 : _pisos>60? 15 : _pisos>34? 10 : 5;
    const levels=[]; for(let dv=0; dv<_pisos; dv+=_paso) levels.push(dv);
    if(levels[levels.length-1] < _pisos-2) levels.push(_pisos-1);
    // LA BARRA TAMBIEN DICE HASTA DONDE SE PUEDE BAILAR. Con el mundo pequeno (448 px de mapa) y una pantalla
    // de 576, la camara no puede centrar nada por debajo de la fila 4: pinchar «15» se quedaba en el borde y
    // el numero parecia mentir (medido en Chrome: el piso decia 336 y la camara paraba en 288). Los pisos que
    // no se pueden centrar siguen escritos - la profundidad es real aunque la pantalla no la recorra - pero su
    // cartel lo dice, para que el numero prometido y el salto sean la misma cosa.
    const _viewH = (typeof H!=='undefined'? H:576)/(view.zoom||1);
    const _maxCentrable = Math.floor((ROWS*CELL - _viewH/2 - SURFACE_Y)/CELL);
    // el 0 (la raya del cesped) es la referencia: si no cabe, la camara se queda arriba del todo y se ve igual,
    // asi que ese no se avisa - el aviso es para los pisos hondo que la pantalla no puede centrar.
    const _pisoProfundo = (d)=> d>0 && d>_maxCentrable;
    const NOMBRE_SUELO={0:'AIRE',1:'TIERRA',2:'ARCILLA',3:'ARENA',4:'PIEDRA',5:'PIEDRA',6:'PIZARRA',7:'ROCAMA',8:'COBRE',9:'HIERRO',10:'ORO',
                       11:'CUARCITA',12:'MARMOL',13:'OBSIDIANA',14:'BASALTO',15:'MAGMA',16:'GEMAS',17:'LOSA',18:'SAL'};
    const _materialEn = (d)=>{
      const r = Math.min(ROWS-1, SURFACE_ROW + d);
      let cuenta={};
      for(let cc=1;cc<COLS-1;cc++){ const t=soilType[r] ? soilType[r][cc] : 0; if(t) cuenta[t]=(cuenta[t]||0)+1; }
      let mejor=0, mejc=-1;
      for(const k in cuenta){ if(cuenta[k]>mejc){ mejor=+k; mejc=cuenta[k]; } }
      return NOMBRE_SUELO[mejor] || 'TIERRA';
    };
    const names = levels.map(d=> (d===0? 'EL PISO' : d+' · ' + _materialEn(d)) );
    const cols = levels.map(d=> d===0? '#7ec8e3' : (function(){ const m=_materialEn(d);
      return m==='ARENA'?'#e8cf8a': m==='ARCILLA'?'#c47a52': m==='PIEDRA'?'#9a9a9a': m==='PIZARRA'?'#6b7a8a': m==='ROCAMA'?'#3a3a44':
             m==='CUARCITA'?'#c9c2d8': m==='MARMOL'?'#8a7fa0': m==='OBSIDIANA'?'#5a3a8a': m==='BASALTO'?'#7a4030': m==='MAGMA'?'#ff6a1e':
             m==='GEMAS'?'#7ad3ff': m==='LOSA'?'#c8c8d8': m==='SAL'?'#dfe8ee':
             m==='COBRE'?'#c8703a': m==='HIERRO'?'#b9bcc6': m==='ORO'?'#e8c14b':'#ffcc00'; })());
    // asegurar marcas existen
    levels.forEach((d,i)=>{
      let el=ruler.querySelector('.depth-mark-'+i);
      if(!el){
        el=document.createElement('div'); el.className='depth-mark depth-mark-'+i;
        el.innerHTML='<i>'+d+'</i>';
        el.title = _pisoProfundo(d)
          ? 'Piso '+d+' (ahi toca '+names[i]+') - desde ahi ya se ve el fondo: la pantalla no da para centrarlo'
          : 'Bajar al piso '+d+' (ahi toca '+names[i]+')';
        el.style.opacity = _pisoProfundo(d) ? '0.55' : el.style.opacity;
        el.onclick=()=>{ // click como scrollbar
          const targetY = SURFACE_Y + d*CELL - (typeof H!=='undefined'?H:576)/(view.zoom||1)/2;
          view.y = Math.max(0, Math.min(ROWS*CELL - (typeof H!=='undefined'?H:576)/(view.zoom||1), targetY));
          clampView(); updateDepthRuler();
        };
        ruler.appendChild(el);
        const line=document.createElement('div'); line.className='depth-line depth-line-'+i;
        ruler.appendChild(line);
      }
      // la barra representa del PISO al FONDO del mundo: el cielo no es un piso que medir
      const worldY = SURFACE_Y + d*CELL;
      const totalH = _pisos*CELL;
      const pct = (d*CELL)/totalH;
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
    const _pisosV = Math.max(2, ROWS-SURFACE_ROW);
    const totalH2 = _pisosV*CELL;
    const viewH = (typeof H!=='undefined'? H: 576)/ (view.zoom||1);
    const viewTop = (view.y||0) - SURFACE_Y;
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
  if(umbral) return;   // con la Escalera montada el mundo NO crece solo: crece cuando la colonia revienta la losa
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
    if(!_pieSuperficie(c)) continue;    // sin tierra debajo del cesped no se siembra: no hay donde prender
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

// === AGUA FÍSICA CONSERVATIVA: llena, sube por presión y rebosa ===
let _waterActive=false;
function addWater(c,r,amt=0.7){
  if(c<0||c>=COLS||r<0||r>=ROWS||soil[r][c]!==0) return 0;
  // Una fuente puede presurizar temporalmente una celda llena. El núcleo eleva y desborda ese exceso;
  // limitarlo aquí a 1 borraba lluvia y convertía cada cavidad llena en un sumidero sin fondo.
  if(floodBarriers.has(c+','+r)) return 0;
  let added=0;
  if(typeof addWaterMass==='function') added=addWaterMass(water,soil,c,r,amt,floodBarriers);
  else { added=Math.max(0,Number(amt)||0); water[r][c]=(Number(water[r][c])||0)+added; }
  if(added>0) _waterActive=true;
  return added;
}
let _waterPhase=0, _waterFlowSweep=0;
function recordWaterFlow(fc,fr,tc,tr,amount,kind){
  const now=performance.now(), put=(c,r,dx,dy,out)=>{
    const key=c+','+r,old=waterFlow.get(key);
    if(old&&now-old.at<180){ old.dx+=dx*amount; old.dy+=dy*amount; old.amount=Math.min(2,old.amount+amount); old.at=now; old.kind=kind; old.out=old.out||out; }
    else waterFlow.set(key,{dx:dx*amount,dy:dy*amount,amount,at:now,kind,out:!!out});
  };
  put(fc,fr,tc-fc,tr-fr,true); put(tc,tr,tc-fc,tr-fr,false);
}
function updateWater(dt){
  // La lluvia entra por los huecos expuestos. addWater conserva la presión, así que un pozo lleno
  // alcanza su borde y se extiende a la siguiente cámara en lugar de tragarse el sobrante.
  if(weather && (weather.type==='rain'||weather.type==='storm')){
    const rainAmt = weather.type==='storm'? 0.018*dt*0.04 : 0.012*dt*0.04;
    for(let c=0;c<COLS;c++){
      if(Math.random()<0.18) addWater(c, SURFACE_ROW, rainAmt);
      if(soil[SURFACE_ROW][c]===0 && Math.random()<0.08) addWater(c, SURFACE_ROW+1, rainAmt*0.6);
    }
  }
  let flow={moved:0,overflow:0,mass:0};
  // Dry worlds are the common case. Do not scan every cell twice per tick until a real source exists.
  if(_waterActive&&typeof stepWaterGrid==='function'){
    flow=stepWaterGrid(water,soil,{dt,passes:2,phase:_waterPhase++,barriers:floodBarriers,onFlow:recordWaterFlow});
    _waterActive=flow.mass>0.0001;
    if((++_waterFlowSweep&31)===0){ const now=performance.now(); for(const [k,v] of waterFlow) if(now-v.at>900) waterFlow.delete(k); }
  }

  // La evaporación sí es un sumidero físico explícito; bajo tierra sigue siendo muy lenta.
  if(_waterActive&&weather&&weather.type==='clear') for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    if(water[r][c]<=0) continue;
    if(r<=SURFACE_ROW+2) water[r][c]=Math.max(0,water[r][c]-0.000025*dt);
    else {
      // Porous earth absorbs shallow residual moisture after a storm. This is an explicit, slow sink;
      // floods remain long enough to require a dam, while a 0.2-cell puddle cannot paralyse a shaft forever.
      let porous=false;
      for(const d of [[1,0],[-1,0],[0,1],[0,-1]]){ const rr=r+d[1],cc=c+d[0]; if(soil[rr]&&soil[rr][cc]===1&&(!soilType[rr]||soilType[rr][cc]<=3)){ porous=true; break; } }
      if(porous&&water[r][c]<0.55) water[r][c]=Math.max(0,water[r][c]-0.0000035*dt);
    }
  }
  if(_waterActive||floodControl.target) updateFloodResponse(dt);
}

const WATER_AVOID_LEVEL=0.22;
const WATER_ESCAPE_LEVEL=WATER_AVOID_LEVEL;
function waterAtCell(c,r){
  return r>=0&&r<ROWS&&c>=0&&c<COLS&&water[r]?Math.max(0,Number(water[r][c])||0):0;
}
function waterAtPixel(x,y){ return waterAtCell(Math.floor(x/CELL),Math.floor(y/CELL)); }
function isDryOpenCell(c,r,limit=WATER_AVOID_LEVEL){
  return r>=0&&r<ROWS&&c>=0&&c<COLS&&soil[r]&&soil[r][c]===0&&waterAtCell(c,r)<limit;
}
// Escape is deliberately different from normal pathfinding: a submerged ant may cross wet cells if
// each step is the shortest available route toward a genuinely dry cell. Blocking all wet movement
// inside canMove() would imprison precisely the ants that need to get out.
function findWaterEscapeStep(entity,maxNodes=900,preferDeep=false){
  const sc=Math.max(0,Math.min(COLS-1,Math.floor(entity.x/CELL)));
  const sr=Math.max(0,Math.min(ROWS-1,Math.floor(entity.y/CELL)));
  if(!soil[sr]||soil[sr][sc]!==0) return null;
  const key=(c,r)=>c+','+r, start=key(sc,sr), q=[[sc,sr,0]], prev=new Map([[start,null]]);
  let found=null,bestScore=Infinity,head=0;
  while(head<q.length&&head<maxNodes){
    const [c,r,depth]=q[head++];
    if((c!==sc||r!==sr)&&isDryOpenCell(c,r,0.14)){
      const score=depth+Math.max(0,sr-r)*6-Math.max(0,r-sr)*0.18;
      if(score<bestScore){ bestScore=score; found=[c,r]; }
      if(!preferDeep) break;
    }
    const raw=preferDeep?[[c-1,r],[c+1,r],[c,r+1],[c,r-1]]:[[c,r-1],[c-1,r],[c+1,r],[c,r+1]];
    const next=raw
      .filter(p=>p[0]>=0&&p[0]<COLS&&p[1]>=0&&p[1]<ROWS&&soil[p[1]]&&soil[p[1]][p[0]]===0&&!prev.has(key(p[0],p[1])))
      .sort((a,b)=>waterAtCell(a[0],a[1])-waterAtCell(b[0],b[1]));
    for(const p of next){ prev.set(key(p[0],p[1]),[c,r]); q.push([p[0],p[1],depth+1]); }
  }
  if(!found){
    // No dry shore in range: still choose the least flooded open neighbour instead of wandering
    // deeper. This makes the behaviour safe even in a temporarily closed cistern.
    const near=(preferDeep?[[sc-1,sr],[sc+1,sr],[sc,sr+1],[sc,sr-1]]:[[sc,sr-1],[sc-1,sr],[sc+1,sr],[sc,sr+1]]).filter(p=>soil[p[1]]&&soil[p[1]][p[0]]===0);
    near.sort((a,b)=>waterAtCell(a[0],a[1])-waterAtCell(b[0],b[1]));
    if(!near.length||waterAtCell(near[0][0],near[0][1])>=waterAtCell(sc,sr)-0.015) return null;
    found=near[0];
  }
  let cur=found, parent=prev.get(key(cur[0],cur[1]));
  while(parent&&!(parent[0]===sc&&parent[1]===sr)){ cur=parent; parent=prev.get(key(cur[0],cur[1])); }
  return {c:cur[0],r:cur[1],x:cur[0]*CELL+CELL/2,y:cur[1]*CELL+CELL/2};
}
function canAntMove(ant,x,y){
  if(!canMove(x,y)) return false;
  if(!_waterActive) return true;
  const target=waterAtPixel(x,y), current=waterAtPixel(ant.x,ant.y);
  if(current>=WATER_ESCAPE_LEVEL) return target<=current+0.015; // escape branch may move through water, never deeper
  // At high speed a tick can span several cells. Sample the segment so a dry landing on the far bank
  // cannot disguise a leap through a flooded tunnel.
  const length=Math.hypot(x-ant.x,y-ant.y),steps=Math.max(1,Math.ceil(length/(CELL*.48)));
  for(let i=1;i<=steps;i++) if(waterAtPixel(ant.x+(x-ant.x)*i/steps,ant.y+(y-ant.y)*i/steps)>=WATER_AVOID_LEVEL) return false;
  return target<WATER_AVOID_LEVEL;
}
function canAntMoveIgnoreTarget(ant,x,y,targetCell){
  if(!canMoveIgnoreTarget(x,y,targetCell)) return false;
  if(!_waterActive) return true;
  const target=waterAtPixel(x,y),current=waterAtPixel(ant.x,ant.y);
  if(current>=WATER_ESCAPE_LEVEL) return target<=current+0.015;
  const length=Math.hypot(x-ant.x,y-ant.y),steps=Math.max(1,Math.ceil(length/(CELL*.48)));
  for(let i=1;i<=steps;i++) if(waterAtPixel(ant.x+(x-ant.x)*i/steps,ant.y+(y-ant.y)*i/steps)>=WATER_AVOID_LEVEL) return false;
  return target<WATER_AVOID_LEVEL;
}

// Hydrological covers block water but not ants. They are the safe answer in the founding shaft:
// sealing that only doorway with soil would save the chamber by killing the colony.
const floodBarriers=new Set();
const floodControl={target:null,workerId:null,scan:0,incident:0,worldKey:''};
function _floodWorkCells(target){
  if(!target) return [];
  return [[target.c,target.r-1],[target.c-1,target.r],[target.c+1,target.r],[target.c,target.r+1]]
    .filter(p=>isDryOpenCell(p[0],p[1],0.20));
}
function _clearFloodAssignment(ant){
  if(!ant) return;
  delete ant.floodTarget; delete ant.floodWork; ant.floodProgress=0;
  if(ant.state==='CONTROLAR_AGUA') ant.state='EXPLORAR';
}
function _floodReachableNest(){
  const seeds=[];
  // Lives define the protected side of a dam. pantryPos can relocate upstream while a forager is
  // lost; using it as a second seed made the colony chase rain toward the surface and roof every row.
  if(queens&&queens[0]) seeds.push([Math.floor(queens[0].x/CELL),Math.floor(queens[0].y/CELL)]);
  else if(workers&&workers.length){ const deep=[...workers].sort((a,b)=>b.y-a.y)[0]; seeds.push([Math.floor(deep.x/CELL),Math.floor(deep.y/CELL)]); }
  const seen=new Set(),q=[];
  for(const s of seeds){
    // If the queen stands in a water-only grate, begin on the chamber side (same row/down), never on
    // the upstream side. Gaps left/right remain connected until the whole shaft cross-section is safe.
    for(const d of [[0,0],[-1,0],[1,0],[0,1]]){ const c=s[0]+d[0],r=s[1]+d[1],k=c+','+r; if(c<0||c>=COLS||r<SURFACE_ROW||r>=ROWS||!soil[r]||soil[r][c]!==0||floodBarriers.has(k)||seen.has(k)) continue; seen.add(k); q.push([c,r]); }
  }
  let head=0;
  while(head<q.length&&head<COLS*ROWS){
    const [c,r]=q[head++];
    for(const d of [[1,0],[-1,0],[0,1],[0,-1]]){ const nc=c+d[0],nr=r+d[1],k=nc+','+nr; if(nc<0||nc>=COLS||nr<SURFACE_ROW||nr>=ROWS||seen.has(k)||floodBarriers.has(k)||!soil[nr]||soil[nr][nc]!==0) continue; seen.add(k); q.push([nc,nr]); }
  }
  return seen;
}
function _chooseFloodTarget(){
  let total=0,best=null,bestScore=-Infinity;
  let store=null; try{ store=storagePos(); }catch(e){}
  const threatened=_floodReachableNest();
  const qc=queens&&queens[0]?Math.floor(queens[0].x/CELL):-99, qr=queens&&queens[0]?Math.floor(queens[0].y/CELL):-99;
  for(let r=SURFACE_ROW+1;r<ROWS-1;r++) for(let c=1;c<COLS-1;c++){
    const amount=waterAtCell(c,r); if(amount<=0.03||soil[r][c]!==0||!threatened.has(c+','+r)) continue;
    total+=Math.min(amount,2);
    if(amount<0.18) continue;
    const work=_floodWorkCells({c,r}); if(!work.length) continue;
    let open=0; for(const p of [[c,r-1],[c-1,r],[c+1,r],[c,r+1]]) if(soil[p[1]]&&soil[p[1]][p[0]]===0) open++;
    const dq=Math.hypot(c-qc,r-qr), ds=store?Math.hypot(c-store.x/CELL,r-store.y/CELL):99;
    const nearColony=Math.min(dq,ds);
    const neck=Math.max(0,3-open)*2.8;
    const source=waterAtCell(c,r-1)>0.22?1.8:0;
    const score=amount*7+neck+source+Math.max(0,11-nearColony)*0.65-r*0.004;
    if(score>bestScore){ bestScore=score; best={c,r,score,nearColony}; }
  }
  // A remote teaspoon is scenery, not an emergency. Near brood/queen chambers responds earlier.
  if(!best||(total<0.28&&best.nearColony>7)||(total<0.12)) return null;
  return best;
}
function updateFloodResponse(dt){
  const worldKey=COLS+'x'+ROWS;
  if(floodControl.worldKey!==worldKey){ floodControl.target=null; floodControl.workerId=null; floodControl.scan=0; floodControl.worldKey=worldKey; }
  floodControl.scan-=dt;
  let worker=floodControl.workerId?workers.find(a=>a.id===floodControl.workerId):null;
  const t=floodControl.target;
  if(t&&(soil[t.r][t.c]!==0||waterAtCell(t.c,t.r)<0.16||!_floodWorkCells(t).length)){
    _clearFloodAssignment(worker); floodControl.target=null; floodControl.workerId=null; worker=null;
  }
  if(floodControl.scan>0) return;
  if(floodControl.target&&!_floodReachableNest().has(floodControl.target.c+','+floodControl.target.r)){
    _clearFloodAssignment(worker); floodControl.target=null; floodControl.workerId=null; worker=null;
  }
  floodControl.scan=24;
  if(!floodControl.target) floodControl.target=_chooseFloodTarget();
  if(!floodControl.target) return;
  if(!worker||worker.health<=20||worker._magmaRetreat){
    _clearFloodAssignment(worker);
    const cells=_floodWorkCells(floodControl.target);
    worker=workers.filter(a=>a.health>24&&!a.food&&!a._magmaRetreat&&a.state!=='CONTROLAR_AGUA')
      .sort((a,b)=>{
        const da=Math.min(...cells.map(p=>Math.hypot(a.x-(p[0]+0.5)*CELL,a.y-(p[1]+0.5)*CELL)));
        const db=Math.min(...cells.map(p=>Math.hypot(b.x-(p[0]+0.5)*CELL,b.y-(p[1]+0.5)*CELL)));
        return da-db-(a.traits.construccion-b.traits.construccion)*0.08;
      })[0];
    if(worker){
      worker.floodTarget={c:floodControl.target.c,r:floodControl.target.r}; worker.floodProgress=0;
      worker.state='CONTROLAR_AGUA'; worker.targetFood=null; worker.digTarget=null; worker.buildTarget=null; worker._route=null;
      floodControl.workerId=worker.id; floodControl.incident++;
      pushEvent('eco','🌊 Inundación detectada: una obrera prepara un dique',`Brecha ${floodControl.target.c},${floodControl.target.r}`);
      pushToast(worker.x,worker.y-15,'🌊 ¡DIQUE!','#62c8ff',2.4);
    }
  }
}
function _sealFloodCell(ant,target){
  if(!target||!soil[target.r]||soil[target.r][target.c]!==0) return false;
  const trapped=waterAtCell(target.c,target.r); water[target.r][target.c]=0;
  // The three founding-shaft columns are the colony's only route to food and the first slab. There the
  // ants build a permeable-to-ants roof/grate; elsewhere they can safely pack the whole breach with soil.
  const passable=Math.abs(target.c-CENTER_COL)<=1||target.r<=SURFACE_ROW+1;
  let kind=1;
  if(passable){
    floodBarriers.add(target.c+','+target.r);
    const cross=[CENTER_COL-1,CENTER_COL,CENTER_COL+1].every(c=>floodBarriers.has(c+','+target.r));
    if(cross&&queens&&queens[0]) pantryPos={x:queens[0].x,y:queens[0].y};
  } else {
    soil[target.r][target.c]=1;
    if(economyLedger&&economyLedger.materials.clay>0){ economyLedger.debitMaterial('clay',1,{reason:'emergency flood barrier'}); kind=2; }
    if(soilType[target.r]) soilType[target.r][target.c]=kind;
  }
  if(trapped>0&&typeof displaceWaterMass==='function') displaceWaterMass(water,soil,target.c,target.r,trapped,floodBarriers);
  markSoilDirty(target.c,target.r);
  pushEvent('eco',passable?'🪵 Entrada cubierta contra el agua':'🧱 Brecha de agua sellada',passable?'Techo drenante: corta el agua sin cerrar el paso de las hormigas':kind===2?'Dique de arcilla; el agua fue desplazada, no borrada':'Dique de tierra compactada; el agua fue desplazada, no borrada');
  pushToast((target.c+0.5)*CELL,target.r*CELL,passable?'🪵 CUBIERTO':'🧱 SELLADO','#9de5ff',3);
  for(let i=0;i<12;i++) particles.push({x:(target.c+0.5)*CELL,y:(target.r+0.5)*CELL,vx:(Math.random()-.5)*1.5,vy:-Math.random(),life:1,decay:.04,color:'#8ecae6'});
  stats.xp+=20; colonyFitness+=0.3; if(ant) ant.fitness=(ant.fitness||0)+0.4; checkLevelUp();
  _clearFloodAssignment(ant); floodControl.target=null; floodControl.workerId=null; floodControl.scan=18;
  return true;
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
    if(pl.cave){
      if(pl.rr!==undefined && (!soil[pl.rr] || soil[pl.rr][pl.cr]!==0)){
        plants.splice(i,1); continue;   // el tunel se rellenó: el hongo se queda sin camara
      }
    }
    // sin pie no hay raiz: la planta no se arranca de golpe (eso no lo ve nadie y no explica nada), se
    // seca delante de la camara - encoge, pierde el color y deja de dar fruto hasta desaparecer
    const _pie = pl.cave ? _pieCueva(pl.cr!==undefined?pl.cr:pl.c, pl.rr) : _pieSuperficie(pl.c);
    if(!_pie){
      pl.seca = 1;
      pl.growth -= 0.0022*dt;
      pl.age+=dt;
      if(pl.growth <= 0.02){ plants.splice(i,1); continue; }
      // Seca significa seca: no compensa el encogimiento con crecimiento solar ni vuelve a dar fruto.
      // Antes ambas cuentas ocurrían en el mismo paso y una mata sin raíz podía seguir produciendo.
      continue;
    } else if(pl.seca) pl.seca = 0;
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
            if(inventions.fiber && Math.random()<0.3) economyLedger.creditMaterial('fiber',1,'flower harvest');
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
            if(inventions.fungus) economyLedger.creditMaterial('fiber',1,'mushroom harvest');
            pl.fruitCooldown=DAY_LENGTH*0.58;
          }
        } else if(pl.type==='fruitTree'){
          // manzano frutal: 3 manzanas cada 0.75d cuando maduro
          if(foods.length<10){
            for(let k=0;k<3;k++) spawnFoodAt(pl.x + (Math.random()-0.5)*18, SURFACE_Y-8, 1, 'apple');
            // textura de fruto también da fibra y ocasional madera
            if(inventions.wood && Math.random()<0.12) economyLedger.creditMaterial('wood',1,'fruit tree harvest');
            if(Math.random()<0.22) economyLedger.creditMaterial('fiber',1,'fruit tree harvest');
            pushEvent('food','🍎 Manzanas caen del árbol','Frutal maduro '+pl.growth.toFixed(2));
            pl.fruitCooldown=DAY_LENGTH*(0.78+Math.random()*0.32);
          } else pl.fruitCooldown=DAY_LENGTH*0.18;
        } else if(pl.type==='sapling'){
          // árbol crece por fases: 0-0.35 brote, 0.35-0.75 joven, 0.75-1 árbol
          if(pl.growth>=0.98 && Math.random()<0.08 && foods.length<7){
            spawnFoodAt(pl.x, SURFACE_Y-8, 1, 'seed'); // hojas / frutos
            pl.fruitCooldown=DAY_LENGTH*1.1;
            if(inventions.wood) economyLedger.creditMaterial('wood',1,'sapling harvest');
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
      if(!_pieSuperficie(c)) continue; // solo superficie de tierra, y con tierra debajo
      const hasPlant = plants.some(pl=> pl.c===c && !pl.cave);
      if(hasPlant) continue; // ya ocupado
      // buscar vecino con pasto maduro (clover/grassTuft >0.62) en 8 direcciones Terraria
      let neighborMature=false;
      for(let dc=-1; dc<=1; dc++) for(let dr=-1; dr<=1; dr++){
        if(dc===0 && dr===0) continue;
        const nc=c+dc; if(nc<0||nc>=COLS) continue;
        const np = plants.find(pl=> pl.c===nc && (pl.type==='clover' || pl.type==='grassTuft') && pl.growth>0.62);
        if(np && _pieSuperficie(nc)) { neighborMature=true; break; }
      }
      if(!neighborMature) continue;
      // luz: al aire, sobre cesped de verdad (el hueco abierto por debajo ya lo descarta el pie)
      if(!_pieSuperficie(c)) continue;
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
        if(_pieCueva(c,r) && soil[r-1] && soil[r-1][c]!==0 && Math.random()<0.0006){ // techo y suelo: nada de crecer en el aire
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
  if(!economyLedger.canAffordMaterials(def.need)) return false;
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
  if(canBuildStructure('granary') && economyLedger.food>8 && structures.filter(s=>s.type==='granary').length < 2) candidates.push('granary');
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
  economyLedger.payMaterials(def.need,'structure '+type);
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
  if(type==='granary') economyLedger.creditFood(4,'granary completed'); // bonus almacén
  return true;
}
function tryCraftTool(ant){
  if(ant.tool) return false; // ya tiene
  const opts=[];
  if(inventions.stone && gen>=TOOL_DEFS.pick.gen && colonyIQ>=TOOL_DEFS.pick.iq && economyLedger.materials.stone>=2) opts.push('pick');
  if(inventions.fiber && gen>=TOOL_DEFS.basket.gen && colonyIQ>=TOOL_DEFS.basket.iq && economyLedger.materials.fiber>=2) opts.push('basket');
  if(inventions.clay && gen>=TOOL_DEFS.trowel.gen && colonyIQ>=TOOL_DEFS.trowel.iq && economyLedger.materials.clay>=1 && economyLedger.materials.stone>=1) opts.push('trowel');
  if(!opts.length) return false;
  const t=opts[Math.floor(Math.random()*opts.length)];
  const def=TOOL_DEFS[t];
  economyLedger.payMaterials(def.need,'tool '+t);
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
  // CIELO PISABLE (Topo: «hay un monton de recursos al aire libre que no agarran»). Arriba del cesped solo
  // habia aire en una franja de 28 px centrada en el pozo: el resto del prado era muro, asi que una gota de
  // miel a 40 px de la boca era LITERALMENTE inalcanzable y la excursion se reducian a asomarse al agujero.
  // Se queda un techo de 34 px sobre la raya del cesped - lo justo para que no suban volando a la nada - y el
  // prado entero es transitable; la x ya la sujeta el fisico (12..W-12), asi que no se pierden de pantalla.
  if(y < SURFACE_Y - 34) return true;
  return soil[r][c]===1;
}
// === ENRUTADO POR GALERIAS ===
// Topo: cuando una hormiga se atasca, girar no la saca: en un nido de galerias de 1-2 celdas hay
// que mandarla por donde se puede. Y no es un capricho visual - medido: una forrajera clavada en
// la esquina del mapa con su miel y otra con 574 pasos bloqueados seguidos => las entregas se
// paraban, la despensa no llegaba a 3, la reina no ponia y NACIA nadie. BFS sobre celdas abiertas
// (tope de nodos, recalcular espaciado por hormiga y solo cuando hay atasco: en el paseo normal no
// se paga nada).
function routeStep(ant, gx, gy){
  const sc=Math.floor(ant.x/CELL), sr=Math.floor(ant.y/CELL), tc=Math.floor(gx/CELL), tr=Math.floor(gy/CELL);
  if(!isFinite(sc)||!isFinite(sr)||!isFinite(tc)||!isFinite(tr)) return null;
  if(sc<0||sr<0||tc<0||tr<0||sc>=COLS||sr>=ROWS||tc>=COLS||tr>=ROWS) return null;
  if(sc===tc && sr===tr){ ant._routeNext=null; return null; }
  // Water changes routes even when the soil does not. A short flow epoch keeps a cached dry route
  // cheap while preventing an ant from following yesterday's tunnel into today's flood.
  const clave = sr+','+sc+'>'+tr+','+tc+'@'+Math.floor(_waterPhase/8);
  if(ant._routeGoal===clave && ant._routeUntil>time) return ant._routeNext;
  const prev=new Map(); const q=[[sr,sc]]; prev.set(sr+','+sc, null);
  let head=0, vistos=0, found=null;
  while(head<q.length && vistos<Math.min(5000,COLS*ROWS)){
    const cur=q[head++]; vistos++;
    if(cur[0]===tr && cur[1]===tc){ found=cur; break; }
    const vks=[[cur[0]+1,cur[1]],[cur[0]-1,cur[1]],[cur[0],cur[1]+1],[cur[0],cur[1]-1]];
    for(const n of vks){
      const k=n[0]+','+n[1];
      if(prev.has(k)) continue;
      if(!soil[n[0]] || soil[n[0]][n[1]]!==0) continue;
      if(waterAtCell(n[1],n[0])>=WATER_AVOID_LEVEL) continue; // dry routes only; escape has its own BFS
      prev.set(k, cur); q.push(n);
    }
  }
  ant._routeGoal=clave; ant._routeUntil=time+240;
  if(!found){ ant._routeNext=null; return null; }
  let cur=found, paso=null;
  while(cur && !(cur[0]===sr && cur[1]===sc)){ paso=cur; cur=prev.get(cur[0]+','+cur[1]); }
  ant._routeNext = paso? {x:paso[1]*CELL+8, y:paso[0]*CELL+8} : null;
  return ant._routeNext;
}
// Una calada es sólida y no puede ser la meta del BFS. Para que la integrante del pozo vuelva a su
// frente tras descansar, se enruta hasta una de las caras ya abiertas del bloque.
function routeStepToDig(ant, target){
  if(!target) return null;
  const cands=[];
  for(const d of [[0,-1],[-1,0],[1,0],[0,1]]){
    const c=target.c+d[0], r=target.r+d[1];
    if(c<0||c>=COLS||r<SURFACE_ROW||r>=ROWS||!soil[r]||soil[r][c]!==0) continue;
    if(waterAtCell(c,r)>=WATER_AVOID_LEVEL) continue;
    cands.push({c,r,d:Math.hypot((c+0.5)*CELL-ant.x,(r+0.5)*CELL-ant.y)});
  }
  cands.sort((a,b)=>a.d-b.d);
  for(const p of cands){
    if(Math.floor(ant.x/CELL)===p.c && Math.floor(ant.y/CELL)===p.r){
      // Estar en la celda vecina no basta: puede haber quedado contra su arista y el radio físico
      // todavía pisa la pared lateral. Primero se recentra; después ya puede acercarse al bloque.
      const _centro={x:p.c*CELL+8,y:p.r*CELL+8};
      if(Math.hypot(_centro.x-ant.x,_centro.y-ant.y)>2){ ant._routeNext=_centro; return _centro; }
      ant._routeNext=null; return null;
    }
    const paso=routeStep(ant,p.c*CELL+8,p.r*CELL+8);
    if(paso) return paso;
  }
  return null;
}
// Topo: la basura va a la camara de residuo, no repartida por todo el nido. Antes cada calada
// plantaba su monticulo y habia tres sitios que empujaban sin acordarse del tope: en un mundo
// pequeno se veian 24-27 monticulos, la higiene castigaba el tope de poblacion (x0.72) y la cria
// se enfermaba por todas partes. Uno solo: se absorbe en el monticulo mas cercano si esta a tiro,
// y el numero depende del tamano del mundo.
const _wasteTopes = () => Math.max(4, Math.min(12, Math.round(9*worldAreaRatio()) + (inventions&&inventions.waste?2:0)));
function addWaste(x, y, type){
  if(!isFinite(x) || !isFinite(y)) return null;
  const tope = _wasteTopes();
  let best=null, bd=56;
  for(const w of wastePiles){ const d=Math.hypot(w.x-x, w.y-y); if(d<bd){ bd=d; best=w; } }
  if(best){ best.amount=(best.amount||1)+1; best.x=(best.x*3+x)/4; best.y=(best.y*3+y)/4; best.age=0; return best; }
  const p={x, y, age:0, amount:1, type};
  wastePiles.push(p);
  while(wastePiles.length>tope) wastePiles.shift();
  return p;
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
// Las gotas se SUMAN: si cae miel junto a otra gota, se echa encima en vez de plantar una migaja nueva.
// Medido al dia 21 con la colonia reducida a 3 hormigas: `miel 33` en el mapa y `despensa 0,6`. No es que
// falte comida - es que un viaje de media jornada para cargar UNA racion no paga, y como la miel no se
// pudre el prado se llena de gotitas que nadie recoge. Junta la misma miel en 4 gotas gordas y el viaje
// rinde, las reclutadas van al mismo sitio y la colonia puede comer mientras sigue cavando.
const _GOTA_MERGE_PX2 = 26*26, _GOTA_TOPE = 5;
function _juntaGota(sx, sy, amt, ftype, alAire){
  for(const g of foods){
    if(g.ftype!==ftype || g.amount>=_GOTA_TOPE) continue;
    if((g.x-sx)*(g.x-sx)+(g.y-sy)*(g.y-sy) > _GOTA_MERGE_PX2) continue;
    g.amount=Math.min(_GOTA_TOPE, (g.amount||1)+amt); g.max=Math.max(g.max||1, g.amount); g.r=5+g.amount*2;
    return;
  }
  foods.push({x:sx,y:sy,amount:amt,max:amt,r:5+amt*2,pulse:Math.random()*Math.PI*2, ftype, rot:0, fresh:1, spawnDay:1, vy:0, grounded:!!alAire});
}
function spawnFoodAt(x,y,amt=1, ftype='honey'){ _juntaGota(clamp(x,16,W-16), clamp(y, 8, H-8), amt, ftype, false); }
function spawnFoodSurface(x,amt=1, ftype='honey'){ _juntaGota(clamp(x+(Math.random()*20-10),20,W-20), SURFACE_Y-8, amt, ftype, true); }
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
  const canBreed = economyLedger.food>=3;
  const btnBreed=document.getElementById('btnBreed');
  const btnLay=document.getElementById('btnLay');
  const btnHatch=document.getElementById('btnHatch');
  if(btnBreed){btnBreed.disabled=!canBreed; btnBreed.title= canBreed ? 'Gastar 3 🍯' : `FALTA ${3-economyLedger.food} 🍯 (tienes ${economyLedger.food})`;}
  if(btnLay){btnLay.disabled=!canBreed; btnLay.title= canBreed ? 'Gastar 3 🍯' : `FALTA ${3-economyLedger.food} 🍯`;}
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
// Topo: las reglas del mapa se traducen a cada tamano, tambien la fundacion.
// 48x28 = 0,58 del area de referencia | 64x36 = 1 | 96x48 = 2. Las obreras iniciales crecen
// con la raiz del area (un mapa el doble de grande no duplica las manos: multiplica las galerias
// que hay que atender) y las reinas con el area entera, porque cada reina pide camara propia.
function sizeProfile(){
  const a=worldAreaRatio();
  return {
    area: a,
    founderWorkers: Math.max(4, Math.min(9, Math.round(5*Math.sqrt(a)))),
    maxQueens: Math.max(1, Math.min(4, 1+Math.floor(a))),
    broodSlots: Math.max(6, Math.min(12, Math.round(6*Math.sqrt(a))))
  };
}
// Si nace/usurpa una reina por encima de lo que el nido sostiene, se va con tierra en la boca.
// No se esconde: se cuenta. Y la que se va se va al enjambre, no al vacio.
// Cuantas coronas mantiene este nido: el tope del mundo y, por debajo, lo que la colonia puede
// alimentar. Medido en medium al dia 7: 3 reinas con 36 obreras, 8 muertas por jornada en guerras
// entre facciones y 0 obreras al dia 13. Dos coronas son cosa de colonias con cien bocas.
function reinasPermitidas(){
  const _boca = Math.max(0, (workers&&workers.length)||0);
  return Math.max(1, Math.min(sizeProfile().maxQueens, 1 + (_boca>=70?1:0) + (_boca>=160?1:0)));
}
function enforceQueenCap(motivo){
  const cap=sizeProfile().maxQueens;
  // Solo se expulsa si el nido esta por encima del tope del mundo o si hay boca de sobra para pagar
  // el enjambre: quedarse sin ninguna corona por una regla de cupo es peor que convivir tres dias.
  let salidas=0;
  while(queens.length>cap || (queens.length>reinasPermitidas() && workers.length>=40)){
    // se queda la que mejor pinta tiene, no siempre la primera de la lista: si la madre esta
    // agonizando y nacio una heredera sana, el nido se queda con la heredera y la madre se va volando.
    const _pinta=(x)=> (x.health||100) + Math.max(0, 1-((x.age||0)/(x.maxAge||DAY_LENGTH*15)))*60 + (x===queens[0]?10:0);
    let qm=null, pm=-Infinity;
    for(const x of queens){
      if((society?.factions||[]).some(f=>f.leader===x.name && f.id===x.faction && f.members>2)) continue;
      const p=_pinta(x); if(p<pm || qm===null){ if(qm===null || p<pm){ qm=x; pm=p; } }
    }
    const q = qm || queens[queens.length-1];
    queens.splice(queens.indexOf(q),1);
    salidas++;
    const txt=`${q.name} vuela lejos: el nido de ${COLS}x${ROWS} solo sostiene ${Math.min(cap,reinasPermitidas())} reinas (${motivo})`;
    pushEvent('evo','🍯 ENJAMBRE '+txt.split(':')[0], txt);
    notifyCanon('🍯 ENJAMBRE', txt, 5600);
    try{ pushToast(q.x, q.y-18, '🍯 vuela','#c08060',3); }catch(e){}
    try{ foods.push({x:q.x,y:q.y,type:'seed',amount:2,vy:-0.4,vx:(Math.random()-0.5)*0.8,born:time}); }catch(e){}
  }
  if(salidas){
    try{ society.factions.forEach(f=>{ f.members=workers.filter(w=>w.faction===f.id).length + queens.filter(q=>q.faction===f.id).length; }); }catch(e){}
    markSoilDirty();
  }
  return salidas;
}
// Las formulas de reservas viven en core/economia.js; aqui solo se les pasa el tamano del mapa.
function startReserveFood(){ return reservaInicialComida(worldAreaRatio()); }
function startSurfaceFood(){ return reservaSuperficie(worldAreaRatio()); }
function surfaceFoodCap(){ return topeSuperficie(worldAreaRatio()); }
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
// el glifo del tiempo que ve el dueño en la barra: una sola tabla, para que el reloj de arriba y el
// titulo del lienzo no se contradigan (y para que la nieve no salga con solecito)
function glifoClima(t){ return t==='rain'? '🌧' : t==='storm'? '⛈' : t==='snow'? '🌨' : t==='cloudy'? '☁️' : '☀️'; }
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
  const _fp=sizeProfile();
  for(let i=0;i<_fp.founderWorkers;i++){
    const off = (i-(_fp.founderWorkers-1)/2)*26;
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
  // Topo: al sobre-escribir un mundo habia que limpiar TAMBIEN lo que se hereda del suelo (jardines
  // de hongo, monticulos de residuo, estructuras, charcos): quedaban residuos del mapa anterior en
  // el nuevo - el "residuo al sobre escribir un mundo" que señalo el dueño.
  try{ wastePiles.length=0; fungusGardens.length=0; structures.length=0; }catch(e){ console.warn('limpieza herencia', e.message); }
  try{ if(typeof water!=='undefined' && water) water.forEach(r=>r.fill(0)); }catch(e){}
  try{ _waterActive=false; floodBarriers.clear(); floodControl.target=null; floodControl.workerId=null; floodControl.scan=0; floodControl.worldKey=''; }catch(e){}
  try{ window._foodlessTimer=0; }catch(e){}
  day=1; time=DAY_LENGTH*0.28; deliveries=0; digs=0; gen=0; worldAge=0;
  worldSeed=worldSeed32(Math.floor(Math.random()*4294967296));
  worldProfile=createWorldProfile(worldSeed,COLS); ancientSites=[]; ancientMasonry=[]; _generatedSiteIds=new Set(); rebuildAncientIndexes();
  economyLedger.setFood(Math.max(2,Math.round(startReserveFood()/2)),'fresh world reserve');
  economyLedger.replaceMaterials({},'fresh world reset'); colonyFitness=0;
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
    const _fp=sizeProfile();
    for(let i=0;i<_fp.founderWorkers;i++){
      const off=(i-(_fp.founderWorkers-1)/2)*26;
      workers.push(makeAnt(mutateGenome(queen.genome,0.18,0.6).genome, {x: CENTER_COL*CELL+8 + off + (Math.random()-0.5)*10, y: SURFACE_Y-6}));
    }
    workers.forEach((w,i)=> w.angle=(i*2.1)+Math.random()*0.6);
    if(workers[0]) workers[0].selected=true;
  }catch(e){ console.error('queen/workers fresh',e); }
  try{ detectarEntrada(); }catch(e){}
  markSoilDirty(); try{ markSoilDirty(); }catch(e){}
  // ajuste anti-extinción aplicado al nacer el mundo (antes corría en load y crasheaba)
  try{
    // Topo: la reserva de fundacion tiene que dar para las primeras puestas mientras las
    // forrajeras arrancan (una entrega = 1-2, un huevo = 3). Con 7 la colonia se quedaba sin
    // despensa el dia 2 y nunca volvia a poner: 0 nacimientos para siempre.
    economyLedger.setFood(Math.max(12,startReserveFood()+startSurfaceFood()),'founding provisions'); if(queen) queen.progress=0; digs=0;
    const _sf2=startSurfaceFood(); const _spread=Math.max(24, Math.round(38*worldAreaRatio()*0.9));
    for(let i=0;i<_sf2;i++) spawnFoodSurface(CENTER_COL*CELL+8 + (Math.random()-0.5)*(_spread*3) + (i-Math.floor(_sf2/2))*_spread, 1+Math.floor(Math.random()*1.6));
    // Topo: la colonia fundacional tambien nace con provisiones DENTRO del nido, al lado de la
    // despensa. Sin esto, la unica miel del mapa estaba arriba y las 4-5 obreras iniciales se
    // pasaban los primeros dias escarbando el tunel sin entregar nada: la despensa se iba a 0,
    // la reina no pone huevos con menos de 3, y nadie llegaba a nacer. Fundacion claustral real.
    try{
      const _dentro = Math.max(2, Math.min(4, Math.round(3*worldAreaRatio())));
      for(let i=0;i<_dentro;i++) spawnFoodAt(pantryPos.x + (Math.random()-0.5)*46, pantryPos.y + (Math.random()-0.5)*30, 1, 'honey');
    }catch(e){ console.warn('provision fundacional', e.message); }
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
      const def = TREASURE_DEFS[rew.type] || null;   // antes el typeof mentia y def salia null: ni fibra, ni ambar
      let handled=false;
      if(rew.type==='semillas'){ economyLedger.creditFood(10,'seed treasure'); pushEvent('discover','¡SEMILLAS!','+10 comida'); notifyCanon('🌾 SEMILLAS', 'Descubriste semillas - +10 comida', 5000); for(let i=0;i<16;i++) particles.push({x:rew.x,y:rew.y,vx:(Math.random()-0.5)*3,vy:-Math.random()*2.5,life:1,decay:0.02,color:'#ffcc00'}); pushToast(rew.x,rew.y-20,'🌾 +10 SEMILLAS','#ffcc00'); }
      else if(rew.type==='agua'){ workers.forEach(w=> w.fatigue=Math.max(0,w.fatigue-30)); pushEvent('discover','¡AGUA!','Energía para todas'); notifyCanon('💧 AGUA', 'Fuente de agua - fatiga restaurada', 5000); for(let i=0;i<14;i++) particles.push({x:rew.x,y:rew.y,vx:(Math.random()-0.5)*2,vy:(Math.random()-0.5)*2,life:1,decay:0.025,color:'#00e5ff'}); pushToast(rew.x,rew.y-20,'💧 AGUA','#00e5ff'); }
      else if(rew.type==='hongo'){ economyLedger.creditFood(6,'mushroom treasure'); pushEvent('discover','¡HONGO!','+6 comida'); notifyCanon('🍄 HONGO', 'Hongo nutritivo - +6 comida', 5000); for(let i=0;i<14;i++) particles.push({x:rew.x,y:rew.y,vx:(Math.random()-0.5)*2,vy:(Math.random()-0.5)*2,life:1,decay:0.02,color:'#2de67a'}); pushToast(rew.x,rew.y-20,'🍄 HONGO','#2de67a'); }
      else if(def){
        if(def.food) economyLedger.creditFood(def.food,'treasure '+rew.type);
        if(def.mat) economyLedger.creditMaterial(def.mat,def.matAmt||1,'treasure '+rew.type);
        if(def.xp) stats.xp+=def.xp; else stats.xp+=45;
        if(def.fatigue) workers.forEach(w=> w.fatigue=Math.max(0,w.fatigue-def.fatigue));
        const _grito = def.msg || ('¡'+String(def.reliquia||rew.type||'TESORO').toUpperCase()+'!');
        if(def.reliquia && anotarReliquia(def, rew.c, rew.r)){
          const _pis=(rew.r-SURFACE_ROW);
          pushEvent('evo', `🏺 RELIQUIA A LA VITRINA · ${def.reliquia}`, `piso ${_pis} · +${Math.round((def.bonus||0.02)*100)}% de excavacion para siempre (ahora ${Math.round(bonusCava*100)}%)`);
          notifyCanon('🏺 '+def.reliquia.toUpperCase(), def.lore||'la colonia la sube a la vitrina', 6400);
          for(let i=0;i<10;i++) particles.push({x:rew.x,y:rew.y,vx:(Math.random()-0.5)*1.6,vy:-Math.random()*2.2,life:1,decay:0.02,color:def.color, bloque:true});
        }
        pushEvent('discover', _grito, '['+rew.c+','+rew.r+'] '+NOMBRE_BANDA(def.tier-1));
        notifyCanon(_grito.split(' ')[0], _grito, 4000);
        for(let i=0;i<12;i++) particles.push({x:rew.x,y:rew.y,vx:(Math.random()-0.5)*2,vy:-Math.random()*1.6,life:1,decay:0.025,color:def.color});
        pushToast(rew.x,rew.y-18, _grito.split(' ')[0], def.color);
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


// === EL ALMACEN: UN SITIO, NO UN NUMERO FLOTANDO ===
// Topo (pedido del dueño): la comida y los materiales almacenados tienen que VEGERSE en la camara
// donde ellas los guardan, apoyados en el suelo de la galeria - como un almacen de verdad, no una
// fila de gotitas suspendidas en medio de la celda que no decian nada. Cada recurso tiene su propio
// monton y su propio color de atlas.
// Cuanta cria cabe en la camara: la del tamano del mundo mas lo que la colonia gane abriendo
// camaras. Era el techo invisible del «se mueren todas y no nacen mas»: en mundo pequeno el fijo
// era 6, y con obreras que mueren de vejez a los 5 dias una colonia de 15 no podia reponerse - la
// fila de la camara era mas lenta que la mortandad, la despensa subia y nadie la convertia en hormigas.
// Ahora criar es un logro del nido: mas camaras, mas cuna.
function capacidadCria(){
  let base=6; try{ base=sizeProfile().broodSlots||6; }catch(e){}
  let camaras=1; try{ camaras=Math.max(1, worldStats().chambers||1); }catch(e){}
  const extra=Math.max(0,(camaras-1)*2) + granerosConstruidos()*2;
  return Math.max(3, Math.min(base+extra, base*3+12));
}
window.capacidadCria=capacidadCria;
// La reserva vital no se gasta en puestas automáticas: es el suelo que mantiene al superorganismo
// vivo mientras las forrajeras vuelven. La fórmula pura vive en core/economia.js.
function _reservaVital(){ try{ return reservaVitalComida(); }catch(e){ return 5; } }
// Lo que hace falta para poner otro huevo: debe quedar la reserva vital Y debe poder sostenerse la
// camada. Son dos suelos alternativos, no dos facturas que se suman (sumarlos frenaba la reposición
// justo cuando las fundadoras empezaban a morir de viejas).
function _sostieneCriar(){ try{ return Math.max(_reservaVital()+3, 3+1.9*brood.length); }catch(e){ return 8; } }
const _MAT_DEFS = [
  {k:'stone', n:'STONE',  col:'#9a9a9a', col2:'#6e6e6e', icon:'\u{1FAA8}', sirve:'walls and pickaxe tools'},
  {k:'clay',  n:'CLAY',   col:'#c47a52', col2:'#8f5433', icon:'\u{1F9F1}', sirve:'walls, granaries, and jars'},
  {k:'sand',  n:'SAND',   col:'#e8cf8a', col2:'#b99f5f', icon:'\u231B', sirve:'foundations and tunnel drainage'},
  {k:'fiber', n:'FIBER',  col:'#8fbf5f', col2:'#5d8438', icon:'\u{1F33F}', sirve:'baskets, ropes, and padding'},
  {k:'wood',  n:'WOOD',   col:'#a97a44', col2:'#7a5528', icon:'\u{1FAB5}', sirve:'scaffolds, bridges, and roofs'},
  {k:'cobre', n:'COPPER', col:'#c8703a', col2:'#7c3f1c', icon:'\u{1F7E0}', sirve:'points, sheets, and something shiny'},
  {k:'hierro',n:'IRON',   col:'#b9bcc6', col2:'#5f6470', icon:'\u2699\u{FE0E}', sirve:'hard frames: picks, supports, and armor'},
  {k:'oro',   n:'GOLD',   col:'#e8c14b', col2:'#8a6a12', icon:'\u{1F7E1}', sirve:'rustproof: offerings, ornaments, and contacts'}
];
function storagePos(){
  // Topo: el almacen es el GRANERO que ellas construyen; si todavia no hay ninguno, la camara que
  // eligieron como despensa (pantryPos). Antes la miel viajaba siempre a pantryPos aunque hubiera
  // granero: el almacen existia en el numero, no en el mapa.
  try{
    let mejor=null, md=Infinity;
    for(const st of structures){
      if(!st || st.type!=='granary' || st.built===false) continue;
      const gx=(st.c+ (st.w||3)/2)*CELL, gy=(st.r+(st.h||2)/2)*CELL;
      const d=Math.hypot(gx-pantryPos.x, gy-pantryPos.y);
      if(d<md){ md=d; mejor={x:gx, y:gy}; }
    }
    if(mejor) return mejor;
  }catch(e){}
  return {x:pantryPos.x, y:pantryPos.y};
}
// celdas libres de la camara de almacen, con el suelo primero (lo que se apoya, se apoya)
function storageCells(){
  const p=storagePos(); const c0=Math.floor(p.x/CELL), r0=Math.floor(p.y/CELL); const out=[];
  for(let r=r0-1;r<=r0+1;r++){
    for(let c=c0-2;c<=c0+2;c++){
      if(r<SURFACE_ROW||r>=ROWS||c<0||c>=COLS) continue;
      if(soil[r] && soil[r][c]===0) out.push({c, r, suelo: !!(soil[r+1] && soil[r+1][c]!==0)});
    }
  }
  out.sort((x,y)=> (y.suelo?1:0)-(x.suelo?1:0) || y.r-x.r || x.c-y.c);
  return out;
}
function granerosConstruidos(){ let n=0; try{ for(const st of structures){ if(st && st.type==='granary' && st.built!==false) n++; } }catch(e){} return n; }
function capacidadAlmacen(){ return 14 + storageCells().length*2 + granerosConstruidos()*12; }
// UN CUADRO, SIEMPRE DEL MISMO TAMAÑO. El dueno lo pidio claro: las siluetas distintas (bote, losa,
// monton) se leian mal a 16 px y no decian que eran. Todo es un cuadrado de 6x6 con su borde negro y su
// franja de apoyo; lo unico que cambia es el color, y los metales llevan encima dos puntitos del tono
// claro (asi se distingue el cobre del hierro sin leer nada). Lo que hay dentro se cuenta por cuadros:
// mas material = mas cuadros, no cuadros mas gordos.
const _CUADRO=6;
function _boteAlmacen(cx, cy, w, h, col, col2, brillo, puntos){
  // el mismo sello que el terreno: nada de marco negro, si no cara de arriba clara, canto de abajo oscuro
  // y la junta de un pixel que separa un bulto del siguiente
  _bloque(ctx, cx, cy-h, w, h, col);
  // la banda de contenido va por el MEDIO: si pisa la ultima fila se come la sombra del bloque y el
  // bulto lee al reves que el terreno (luz abajo), que es justamente lo que se quito del atlas
  ctx.fillStyle=col2; ctx.fillRect(cx+1, cy-Math.max(2,Math.round(h*0.62)), w-2, Math.max(1,Math.round(h*0.28)));
  if(brillo){ ctx.fillStyle='#fff'; ctx.fillRect(cx+1, cy-h+1, 1, Math.max(1,Math.round(h*0.4))); }
  if(puntos){ ctx.fillStyle=puntos; ctx.fillRect(cx+1, cy-h+1, 1, 1); ctx.fillRect(cx+3, cy-3, 1, 1); }
}
// cuantos cuadros le tocan a una cantidad: 1 hasta 8, 2 hasta 27, 3 hasta 64, 4 mas
function _cuadrosDe(n){ return n<=0?0 : n<=8?1 : n<=27?2 : n<=64?3 : 4; }
const _METAL_PUNTO={cobre:'#ffb877', hierro:'#e6ecf6', oro:'#fff2a8'};
function dibujarAlmacen(){
  const celdas=storageCells();
  if(!celdas.length) return;
  // 1) las raciones de miel: los mismos cuadros de 6x6, en ambar, apoyados en el suelo de la celda
  const _raciones=Math.max(0, Math.floor(economyLedger.food||0));
  const miel=Math.max(0, Math.min(_cuadrosDe(_raciones)*2, celdas.length, 8 + granerosConstruidos()*4));
  let i=0;
  for(; i<miel; i++){
    const cd=celdas[i%celdas.length]; if(!cd) continue;
    const bx=cd.c*CELL + 4, by=cd.r*CELL + CELL - 1;
    _boteAlmacen(bx, by, _CUADRO, _CUADRO, (i%3===0)?'#ffcc33':'#ffda66', '#ff8c00', true, null);
  }
  // 2) materiales: un monton por recurso, con su propio color y tamano segun cuanto hay
  for(let m=0;m<_MAT_DEFS.length;m++){
    const d=_MAT_DEFS[m], n=Math.max(0, Math.floor(economyLedger.materials[d.k]||0));
    if(!n) continue;
    const alto=_cuadrosDe(n);                              // cuantos cuadros, no cuanto de gordos
    const cd=celdas[(i+m)%celdas.length]; if(!cd) continue;
    const base=cd.r*CELL + CELL - 1;
    // en fila, del centro de la celda hacia fuera: la cantidad se lee de un golpe y nada flota
    const _ancho = alto*_CUADRO + (alto-1)*1;
    const bx0 = cd.c*CELL + Math.max(1, Math.round((CELL-_ancho)/2));
    for(let p=0;p<alto;p++) _boteAlmacen(bx0 + p*(_CUADRO+1), base, _CUADRO, _CUADRO, d.col, d.col2, p===alto-1, _METAL_PUNTO[d.k]||null);
    i+=1;
  }
  // 3) la marca de la camara: un travesaño de madera en el techo, para que se vea QUE es un sitio
  // 3) LA CAMARA, no botes sueltos en un agujero (Topo: «el almacen tiene que ser una estructura de verdad»).
  // Se enmarca el contorno de las celdas abiertas - dintel, suelo y dos postes - y con cada granero que
  // construyen sale un travesano mas: la obra se ve en el muro, no hace falta contarla en un cartel.
  let _c0=1e9,_c1=-1e9,_r0=1e9,_r1=-1e9;
  for(const cd of celdas){ if(cd.c<_c0)_c0=cd.c; if(cd.c>_c1)_c1=cd.c; if(cd.r<_r0)_r0=cd.r; if(cd.r>_r1)_r1=cd.r; }
  if(_c1>=_c0 && _r1>=_r0){
    const x0=_c0*CELL, y0=_r0*CELL, x1=(_c1+1)*CELL, y1=(_r1+1)*CELL;
    ctx.fillStyle='#3a2610';
    ctx.fillRect(x0-2, y0-2, (x1-x0)+4, 3);
    ctx.fillRect(x0-2, y1-1, (x1-x0)+4, 3);
    ctx.fillRect(x0-2, y0-2, 3, (y1-y0)+4);
    ctx.fillRect(x1-1, y0-2, 3, (y1-y0)+4);
    ctx.fillStyle='#5b3d1c'; ctx.fillRect(x0+1, y0-1, (x1-x0)-2, 1);
    for(let k=0;k<Math.min(3, granerosConstruidos());k++){
      const yy = y0 + Math.round((_r1-_r0+1)*CELL*(k+1)/4);
      ctx.fillStyle='#4a3214'; ctx.fillRect(x0+1, yy-1, (x1-x0)-2, 2);
    }
  }
  const top=celdas[celdas.length-1];
  if(top){ ctx.fillStyle='#4a3214'; ctx.fillRect(top.c*CELL-CELL, top.r*CELL+1, CELL*5, 2); ctx.fillStyle='#2a1b0a'; ctx.fillRect(top.c*CELL-CELL, top.r*CELL+3, CELL*5, 1); }
}
function surfaceEntrance(){return {x:CENTER_COL*CELL+8,y:SURFACE_Y-4};}
function rayWallDist(x,y,angle,max){for(let d=4;d<=max;d+=4){const nx=x+Math.cos(angle)*d, ny=y+Math.sin(angle)*d; if(isSolidPixel(nx,ny)) return d;}return max;}
function inkColorForSymbol(sym){ if(sym==='⬢') return '#00e5ff'; if(sym==='⬣') return '#ffdd57'; if(sym==='◆') return '#ff6b9d'; return '#2de67a';}
function symbolForComms(c1,c2){ if(c1>0.4 && c2>0.4) return '◆'; if(c1>0.4) return '⬢'; if(c2>0.4) return '⬣'; return '⬡';}

// Egg + attended larva + pupa take about 1.3 game days; the extra quarter-day absorbs travel and
// a poorly tended larva. Succession starts from remaining lifetime, not from an arbitrary age ratio.
const QUEEN_SUCCESSOR_LEAD_DAYS=1.55;
function _royalDevelopmentRemaining(b){
  if(!b) return Infinity;
  const left=Math.max(0,100-(Number(b.progress)||0));
  if(b.type==='egg') return left/0.00345 + 100/0.00235 + 100/0.00325;
  if(b.type==='larva') return left/0.00235 + 100/0.00325;
  if(b.type==='pupa') return left/0.00325;
  return Infinity;
}
function _prepareSuccessor(q){
  if(queens.length!==1) return null;
  const existing=brood.find(b=>b.isQueen);
  if(existing){ q._successionPlanned=true; return existing; }
  const remaining=(q.maxAge||0)-(q.age||0), lead=DAY_LENGTH*QUEEN_SUCCESSOR_LEAD_DAYS;
  if(remaining>lead&&(q.health||100)>=46) return null;
  // Caste is still plastic in egg/larva. Prefer the youngest available brood so the timing remains
  // legible; if there is none, reserve the queen's next egg and advance only that natural laying cycle.
  const candidate=brood.filter(b=>!b.isQueen&&(b.type==='egg'||b.type==='larva'))
    .sort((a,b)=>(a.type==='egg'?0:1)-(b.type==='egg'?0:1)||(a.progress||0)-(b.progress||0))[0];
  if(candidate) candidate.isQueen=true;
  else { q._royalNext=true; q.progress=Math.max(q.progress||0,84); }
  if(!q._successionAnnounced){
    q._successionAnnounced=true;
    pushEvent('evo','👑 La colonia prepara heredera antes de la vejez',`Quedan ${(Math.max(0,remaining)/DAY_LENGTH).toFixed(1)} días; desarrollo real ≈${QUEEN_SUCCESSOR_LEAD_DAYS} días`);
    notifyCanon('👑 SUCESIÓN', 'La colonia alimenta una heredera antes de que muera la reina', 5200);
  }
  q._successionPlanned=true;
  return candidate||null;
}

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
        if(nc>=0&&nc<COLS&&nr>=SURFACE_ROW&&nr<ROWS&&soil[nr][nc]===0 && (!water[nr] || !water[nr][nc])){
          q.x=nc*CELL+8; q.y=nr*CELL+12; q.vy=0; break;
        }
      }
    }
    // Una reina inundada no se deja caer más hondo: busca la costa seca conectada y evacúa. Las
    // obreras reciben a la vez la alarma para sellar la brecha mediante updateFloodResponse().
    if(waterHere){
      q.state='HUIR_INUNDACION'; q.vy=0;
      const shore=findWaterEscapeStep(q,900,true);
      if(shore){
        const ang=Math.atan2(shore.y-q.y,shore.x-q.x),step=Math.min(4.2,0.055*dt+0.8);
        const nx=q.x+Math.cos(ang)*step,ny=q.y+Math.sin(ang)*step;
        if(canMove(nx,ny)&&waterAtPixel(nx,ny)<=waterHere+0.015){ q.x=nx; q.y=ny; }
      }
      if(q.mood){ q.mood.fear=Math.min(1,(q.mood.fear||0)+0.04); q.mood.stress=Math.min(1,(q.mood.stress||0)+0.02); }
    // gravedad si no hay suelo debajo
    } else if(!belowSolid){
      q.vy = (q.vy||0) + 0.52*dt*0.065;
      q.y += q.vy*dt*0.09;
      // tope suelo
      const nr2=Math.floor(q.y/CELL);
      const nc2=Math.floor(q.x/CELL);
      if(nr2+1<ROWS && soil[nr2+1] && soil[nr2+1][nc2]===1){
        q.y=(nr2+1)*CELL - 4; // 4px sobre el suelo (pies de la reina)
        q.vy=0;
      }
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
          if(water[nr] && water[nr][nc]>0.3) continue;
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
    _prepareSuccessor(q);
    // fertilidad decae con la edad
    const ageFactor = Math.max(0.25, 1 - (q.age/q.maxAge)*0.7);
    // La vieja no consume su prórroga desde el nacimiento (ese era el fallo: los siete días se
    // agotaban mucho antes de envejecer). Sólo espera una vez llegada la muerte y únicamente hasta
    // que la heredera viva pueda tomar el relevo. `isQueen` es la propiedad real de la cría.
    const _sucesoraViva = queens.some(x=>x!==q);
    const _realEnCamino = brood.some(b=>b.isQueen);
    const _muriendo = q.age>q.maxAge || (q._agonia||0)>DAY_LENGTH*0.7;
    const _maxAguante = _realEnCamino ? DAY_LENGTH*2.2 : DAY_LENGTH*7;
    if(_muriendo && !_sucesoraViva && (q.edadPospuesta||0)<_maxAguante){
      q.edadPospuesta=(q.edadPospuesta||0)+dt;
      if(!q._avisoAguante){ q._avisoAguante=true; pushEvent('evo', _realEnCamino?'♛ la reina espera a la heredera que ya crece':'♛ la reina se aguanta: aún no hay heredera'); }
    } else if(_muriendo){
      // muerte por vejez, o porque llevaba demasiado tiempo a cero de salud
      const _agonia = (q._agonia||0) > DAY_LENGTH*0.7 && q.age <= q.maxAge;
      if(_agonia) pushEvent('evo', `♛ ${q.name||q.id||'Reina'} se apaga`, 'Llevaba un día entero sin fuerzas - la colonia da paso a la heredera');
      pushEvent('death',`♛ ${q.name||q.id||'Reina'} ${_agonia?'muere agotada':'muere de vieja'} a los ${(q.age/DAY_LENGTH).toFixed(1)}d`, `Vivió ${(q.maxAge/DAY_LENGTH).toFixed(1)}d - GEN${q.genome.gen}`);
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
            // Topo: el rescate contra la extincion EXIGIA una obrera con rol NODRIZA, y ese rol no
            // existe hasta GEN2 con IQ112 - en una colonia joven la candidata nunca aparecia, la
            // corona se quedaba vacia y «no quedaba nadie vivo». Cualquier obrera puede coronarse
            // (lo hacen las hormigas reales); el rol y la lealtad solo puntuan para elegir cual.
            const cand=[...workers].sort((a,b)=>{ const _p=(x)=>((x.affinity==='NODRIZA'||x.role==='NODRIZA')?1:0)+((x.mood&&x.mood.loyalty)||0)*0.9+((x.health||0)/140); return _p(b)-_p(a); })[0];
            if(cand){
              let _qn1=genPersonalName({faction:cand.faction, role:'REINA', affinity:'NODRIZA', caste:'media', parents:[], genome:cand.genome, isQueen:true, rank:'LÍDER', ageDays:0, idCode:'Q'+(queens.length+1)+'-'+Math.random().toString(36).slice(2,4).toUpperCase()});
              queens.push(ensureQueenMeta({x:cand.x,y:cand.y, genome:cand.genome, progress:0, state:'GRÁVIDA', age:0, maxAge: getQueenMaxAge(), generation:gen+1, faction:cand.faction, health:100, name:_qn1.name, personalName:_qn1.name, nameMeaning:_qn1.meaning, nameStage:_qn1.stage, id:'Q'+Math.random().toString(36).slice(2,5).toUpperCase(), eggsLaid:0, children:[], history:[]}));
              enforceQueenCap("se corona del bando de las nodrizas");
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
    // Topo: la puesta se raciona por lo que la colonia PUEDE MANTENER, no por un umbral plano.
    // Cada cria ya puesta reclama su parte y la camara de cria tiene sitio limitado (broodSlots del
    // tamano del mundo): con el fijo de 3 la reina se comia la despensa en huevos, las larvas se
    // quedaban sin nada y el ciclo se paraba justo cuando empezaba a andar.
    // El coeficiente es lo que de verdad cuesta criar a una de esas, no un capricho: una larva entera
    // se cria con 1,8 de despensa (lo mide test/brood-hatch.js) y el huevo y la pupa tambien comen. Con
    // 0,6 la reina de la semilla 2 se comio 17 raciones en 6 puestas en dos dias, la despensa cayo a 2,
    // las larvas se quedaron sin nada y la colonia entero se apago al dia 9 - mientras 8 gotas de miel
    // esperaban en el prado. Racionarse por lo que puede MANTENER es la unica salida.
    const _sostiene = _sostieneCriar();
    const _sitio = brood.length < capacidadCria();
    // Hasta diez obreras la fundadora puede completar la puesta con sus reservas corporales. No
    // inventa comida: la parte que falta se paga en salud, mientras las cinco raciones vitales se
    // quedan en la despensa. Así la primera cohorte reemplaza a las fundadoras antes de su vejez.
    const _puestaCorporal = workers.length<10 && economyLedger.food>=_reservaVital() && (q.health||0)>18;
    if((economyLedger.food>=_sostiene || _puestaCorporal) && _sitio){
      // FERTILIDAD EVOLUTIVA REALISTA - Lasius 4-7k (100/d pico), Atta 5M (30k/d), argentina billones
      // En juego: base 2.19/d, con evolución GEN30 puede llegar a 18/d por reina (como Atta joven), 4 reinas = 72/d → N=72*18=1296
      const _evoFert = 1 + gen*0.13 + Math.max(0, colonyIQ-108)*0.009 + (q.personality?.fertilidad? (q.personality.fertilidad-50)*0.006:0) + (fungusGardens.filter(f=>f.health>0.62).length*0.12) + (typeof inventions!=='undefined' && inventions.fungus?0.22:0);
      // Boca que alimenta = puesta que se sostiene: una fundadora sola pone a un ritmo; una colonia
      // de 15 obreras trasegando miel no puede seguir poniendo igual si no quiere que la vejez les
      // gane la carrera (era exactamente el «no nacen mas» del mundo pequeno).
      const _bocas = 1 + Math.min(2.2, Math.max(0, workers.length-2)*0.16);
      const rate = 0.00305 * ageFactor * (1 + (q.traits?.cuidado||50)/240) * _evoFert * _bocas; // escalado evolutivo, no instantáneo
      q.progress+= dt*rate;
      if(q.progress>=100){
        q.progress=0;
        let best=workers[0]; if(best) workers.forEach(w=>{ if(w.deliveries > best.deliveries) best=w;});
        const child= best? crossover(q.genome, best.genome) : q.genome;
        const mutated=mutateGenome(child,0.13,0.55);
        // 4% de ser larva real (futura reina) si la colonia es grande y hay comida. Y si la unica
        // corona esta mayor o sin fuerzas, la heredera deja de ser un azar: se busca ya, con la
        // madre todavia en pie para poder alimentarla (esperar a que moria era lo que apagaba la
        // dinastia: sin larva real en ese momento no habia rescate posible).
        const _hayHeredera = brood.some(b=>b.isQueen) || queens.length>1;
        const _enVentana = (q.maxAge-q.age)<=DAY_LENGTH*QUEEN_SUCCESSOR_LEAD_DAYS || (q.health||100)<46;
        // La sucesión programada no exige seis obreras ni gastar la reserva vital: precisamente debe
        // salvar una colonia SMALL debilitada. q._royalNext fue reservado por _prepareSuccessor().
        const _necesitaHeredera = queens.length===1&&!_hayHeredera&&(_enVentana||q._royalNext);
        const isQueenLarva = !!q._royalNext || _necesitaHeredera || (workers.length>=6 && economyLedger.food>8 && queens.length < reinasPermitidas() && Math.random()<0.04 + gen*0.002);
        if(isQueenLarva) q._royalNext=false;
        brood.push({type:'egg', progress:0, genome:mutated.genome, time:0, isQueen:isQueenLarva, faction:q.faction, parents:[q.name||q.id, best?best.id:'-'], parentGenomes:[q.genome.id, best?best.genome.id:'-'], x:q.x+(Math.random()-0.5)*22, y:q.y+(Math.random()-0.5)*14, hunger:0});
        const _pagoPuesta=economyLedger.debitFood(need,{floor:_reservaVital(),partial:true,reason:'queen lays egg'});
        if(_pagoPuesta<need) q.health=Math.max(4,(q.health||100)-(need-_pagoPuesta)*1.8);
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
    q.state= economyLedger.food>=3? 'GRÁVIDA' : 'HAMBRIENTA';
    // salud de reina. Topo: la vida de la corona NO era un numero que hiciera nada - bajaba de cero
    // (se leia -69 en el panel) y la reina seguia poniendo: un cadaver util que bloqueaba la
    // succession, porque la heredera solo se buscaba CUANDO la reina moria, y ella nunca mora.
    if(economyLedger.food===0 && Math.random()<0.001) q.health=Math.max(0, (q.health||100)-0.5);
    q.health=Math.max(0, q.health||0);
    if(q.health<=0) q._agonia=(q._agonia||0)+dt; else q._agonia=Math.max(0,(q._agonia||0)-dt*0.5);
  }
  // mantener referencia principal
  if(queens.length>0) queen=queens[0];
}
// Topo: la cria ya puesta no puede depender de que siga quedando una reina viva. Si la colonia
// se queda sin reinas (hambre, vejez, golpe de estado) los huevos y pupas que ya estan en el
// nido siguen su curso: el ancla pasa a ser el enjambre de obreras y, si tampoco queda ninguna,
// el centro del nido. Antes esto reventaba con "queens[0] is undefined" y NACER no ocurria
// nunca mas: el contador se quedaba en 0 mientras los huevos se veian crecer.
function broodAnchor(){
  if(queens.length>0) return queens[0];
  if(workers.length>0){ let sx=0, sy=0, n=0; for(const w of workers){ if(w && isFinite(w.x) && isFinite(w.y)){ sx+=w.x; sy+=w.y; n++; } }
    if(n>0) return {x:sx/n, y:sy/n, faction:workers[0].faction||0}; }
  return {x:CENTER_COL*CELL, y:(SURFACE_ROW+8)*CELL, faction:0};
}
function updateBrood(dt){
  // v8 realismo: larva necesita trofalaxia real de nodrizas
  const an = broodAnchor();
  const silentQueenless = queens.length===0;
  for(let i=brood.length-1;i>=0;i--){
    const b=brood[i]; b.time+=dt;
    const bxp = (b.x!==undefined && b.x!==null) ? b.x : an.x;
    const byp = (b.y!==undefined && b.y!==null) ? b.y : an.y;
    if(b.type==='larva'){
      // Topo: la camada fundacional NO puede exigir una especialista. Los roles salen de
      // updateHierarchy, que no arranca hasta gen>=2 e IQ>=112 - o sea, en GEN0 nadie es NODRIZA,
      // y con la regla vieja (solo NODRIZA/minim con buche alimentan) TODAS las larvas de la
      // primera generacion morian de hambre antes de la primera eclosion: la colonia no podia
      // nacer a si misma. Regla real y en tres niveles:
      //   1) cualquier obrera con buche regurgita (la nodriza lo hace mas lejos y mas rapido)
      //   2) si no queda nadie, la reina cria sola a costa de sus reservas (fundacion claustral)
      //   3) si tampoco, la larva picotea la despensa, a ritmo reducido
      // Y sin comida en ninguna de las tres, se estanca y puede morir - pero con margen, no a la
      // primera noche.
      if(!b.hunger) b.hunger=0;
      const nido = {x:bxp, y:byp};
      const nodriza = workers.filter(w=> dist(w,nido)<64 && (w.crop||0)>0.14 && w.role==='NODRIZA').length;
      const cualquiera = workers.some(w=> dist(w,nido)<44 && (w.crop||0)>0.12);
      const real = queens.length>0 && dist(queens[0],nido)<96 && (economyLedger.food>=0.5 || (queens[0].crop||0)>0.1);
      const nivel = nodriza>0 ? 1 : (cualquiera || workers.some(w=>w.caste==='minim' && (w.crop||0)>0.1 && dist(w,nido)<48)) ? 2 : real ? 3 : economyLedger.food>0.6 ? 4 : 0;
      if(nivel>0){
        // El coste se paga EN PROPORCION al crecimiento de este paso, no por intentos al azar: el
        // bucle llama a esto decenas de veces por frame y un "-0.02 por sorteo" vaciaba la
        // despensa entera en un dia (la colonia moria de hambre justo por alimentarse).
        const _rate = nivel===1?0.00335:nivel===2?0.00285:nivel===3?0.00225:0.00175;
        const _g = dt*_rate;
        b.progress += _g;
        if(nivel<=2){
          const donor = workers.find(w=> (w.role==='NODRIZA'||w.caste==='minim'||(w.crop||0)>0.16) && (w.crop||0)>0.12);
          if(donor) donor.crop = Math.max(0, (donor.crop||0) - _g*0.020);
        }
        if(nivel>=3){
          const _costeCria=_g*(nivel===3?0.030:0.018);
          // Con reina viva, la reserva de cinco raciones no se toca: si no queda excedente, la
          // fundadora alimenta la larva con sus reservas corporales. Sin reina sí se permite usar
          // la despensa para que una cría ya puesta pueda refundar la colonia.
          const _sueloComida=queens.length>0?_reservaVital():0;
          const _pagado=economyLedger.debitFood(_costeCria,{floor:_sueloComida,partial:true,reason:'brood care'});
          // Criar sola le cuesta, SI: solo cuando la despensa no llega para lo que la cria pide.
          // Con el granero lleno quien alimenta es la colonia, y la reina no deveria estar pagando
          // 20 puntos de vida por jornada (medido: 100 -> 60 en dos dias con 7 obreras trabajando),
          // porque una reina que se apaga a la mitad de su vida es una sucesion forzada cada semana.
          if(queens.length>0 && (_pagado<_costeCria || economyLedger.food < _sostieneCriar())) queens[0].health = Math.max(4, (queens[0].health||100) - _g*0.02);
        }
        b.hunger=Math.max(0, b.hunger- dt*(nivel<=2?0.08:0.045));
        if(byp > (SURFACE_ROW+10)*CELL) b.progress+= dt*0.00042; // más cálido abajo
        b.tended=(b.tended||0)+1;
      } else {
        b.hunger+= dt*0.028;
        b.progress+= dt*0.00052; // casi estancada sin nadie que la atienda
        if(b.hunger> 150 && Math.random()<0.006){
          brood.splice(i,1);
          pushEvent('death','💀 Larva muere de hambre - sin nodriza ni despensa',`Brood ${b.genome?.id||'-'} - hambre ${b.hunger|0}`);
          continue;
        }
        if(Math.random()<0.04) particles.push({x:bxp, y:byp-6, vx:(Math.random()-0.5)*0.4, vy:-0.4, life:0.7, decay:0.02, color:'#ffaa88'});
      }
    } else {
      b.progress+= dt* (b.type==='egg'? 0.00345 : 0.00325);
    }
    if(b.progress>=100){
      if(b.type==='egg'){ b.type='larva'; b.progress=0; }
      else if(b.type==='larva'){ b.type='pupa'; b.progress=0; }
      else if(b.type==='pupa'){
        
if(b.isQueen || workers.length < getMaxPopulation()){
          // La corona no ocupa una plaza obrera: una heredera nunca queda bloqueada por el tope SMALL.
          // si es larva real -> nace reina, no obrera
          if(b.isQueen){
            let _qn2=genPersonalName({faction: (b.faction!==undefined? b.faction : (queens[0]? queens[0].faction : 0)), role:'REINA', affinity:'NODRIZA', caste:'media', parents:[b.genome.id], genome:b.genome, isQueen:true, rank:'LÍDER', ageDays:0, idCode:'Q'+(queens.length+1)+'-'+Math.random().toString(36).slice(2,4).toUpperCase()});
            const newQueen={x:an.x+(Math.random()-0.5)*22, y:an.y+(Math.random()-0.5)*12, genome:b.genome, progress:0, state:'GRÁVIDA', age:0, maxAge: getQueenMaxAge(), generation:gen+1, faction: b.faction!==undefined? b.faction : queens[0].faction, health:100, name:_qn2.name, personalName:_qn2.name, nameMeaning:_qn2.meaning, nameStage:_qn2.stage};
            // 35% funda nueva facción (cisma) - PERO solo si la corona no cabe en el nido. Mientras la
            // colonia la aguanta, la hermana se suma a la corte: fundar una facción rival dentro del mismo
            // tunel era fabricar una guerra civil que se comia a las obreras (medido en big al dia 11:
            // 28 muertas en guerra, 3 reinas y 25 obreras - la colonia se quedaba sin brazos).
            if(queens.length>=1 && Math.random()<0.35 && queens.length >= reinasPermitidas()){
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
            { const _fc=society.factions.find(f=>f.id===newQueen.faction); if(_fc) _fc.members++; }
            pushToast(newQueen.x,newQueen.y-18,`👑 ${newQueen.name}`,'#ffcc00',3);
            if(!silentQueenless) pushEvent('birth','👑 La cria refunda la dinastia',`Sin reina viva: ${newQueen.name} nace y gobierna`);
            enforceQueenCap('nace de cría real');
          } else {
            const ant=makeAnt(b.genome, {x:an.x+(Math.random()-0.5)*18, y:an.y+(Math.random()-0.5)*10}, {faction: b.faction!==undefined? b.faction : an.faction});
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
            // Sacar adelante una obrera también es progreso evolutivo observable. La eclosión aporta
            // menos que una entrega grande, pero evita que un linaje que cría bien quede en GEN0 sólo
            // porque sus fundadoras hicieron pocos viajes o caladas durante esos mismos tres días.
            stats.xp+=20; checkLevelUp();
            // hereda facción y un poco del ánimo de la madre
            pushEvent('birth',`Eclosiona ${ant.id} [${ant.role}] GEN${ant.genome.gen}`, `EXP${ant.traits.exploracion} CAV${ant.traits.construccion} COM${ant.traits.comunica}`);
            if(workers.length<=5) notifyCanon('🐣 ECLOSION', `${ant.id} nace - la colonia crece`, 4800);
            pushToast(an.x,an.y-18,`🐣 ${ant.id}`,'#b47aff',2.6);
            if(silentQueenless) notifyCanon('🐣 REVIENTA EL HUEVO', `${ant.id} nace sin reina - las nodrizas la coronaran enseguida`, 5200);
          }
        } else {
          // A promised birth must not disappear at the cap. The mature pupa waits at 100% and hatches
          // as soon as an old worker frees a place — the previous unconditional splice caused SMALL
          // colonies to show future births, discard them, and then vanish in one ageing wave.
          b.progress=100; b._capWaiting=true;
          if(!b._capWarnedAt||time-b._capWarnedAt>DAY_LENGTH*0.5){
            b._capWarnedAt=time||1;
            pushEvent('evo',`Pupa espera: colonia en tope ${getMaxPopulation()} - cava más salas o evoluciona`,'No se pierde: eclosiona en cuanto quede una plaza');
          }
          continue;
        }
        brood.splice(i,1);
      }
    }
  }
}
// El voto que ensaya el cultivo: donde se suelta el sustrato (mugrón y tierra) y donde se guarda la comida
// de huerto, ahi puede prender el hongo. Se apunta la celda que se pisa en ese momento, con mas peso para el
// humus que para la miel, porque el jardin de hormigas cutter Atta CRECE sobre el sustrato que ellas traen.
function _votaHuerto(x, y, peso){
  try{
    const c=Math.floor(x/CELL), r=Math.floor((y+8)/CELL);
    if(r<=SURFACE_ROW || r>=ROWS-1 || c<1 || c>=COLS-1) return;
    if(!soil[r] || soil[r][c]!==0) return;                    // tiene que ser camara abierta
    if(!soil[r+1] || soil[r+1][c]===0) return;                 // y con suelo debajo donde apoyar
    const k=c+','+r; _huertoVotos[k]=(_huertoVotos[k]||0)+peso; _huertoVotosN+=peso;
  }catch(e){}
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
    // decae si nadie lo cuida. Topo: antes "cuidar" exigia un ROL (NODRIZA o caste minim) que en
    // una colonia fundacional no existe - los roles llegan con GEN>=2 e IQ>=112 - y encima habia
    // que gastar fibra. Resultado medido en la partida real: el jardin, que es la despensa de
    // verdad de una hormiga cortahojas, nunca produce, los jardines mueren y la colonia depende al
    // 100% de subir a la superficie por miel; en cuanto el nido se muda hondo, las entregas caen a
    // media al dia, la despensa se clava en 1-2 y la reina no pone (pide 3) -> no nace nadie.
    // Cualquier obrera que este alli alimenta y limpia; la fibra pasa a ser un extra.
    const tenders = workers.filter(w=> !w.food && w.state!=='DESCANSAR' && dist(w,f)<38).length;
    if(tenders===0){
      f.health -= dt*0.00010;
      if(f.health<0.22 && Math.random()<0.006) f.size=Math.max(0.6, f.size-0.04);
    } else {
      // mimims limpian y alimentan; con fibra rinden mas
      if(Math.random()<0.018*tenders){
        if(economyLedger.materials.fiber>0 && Math.random()<0.5){ economyLedger.debitMaterial('fiber',1,{reason:'fungus garden care'}); f.size=Math.min(4.2, f.size+0.018); }
        f.health=Math.min(1, f.health+0.035); f.fed++;
        // trofalaxia indirecta: las que estan comiendo hongo recargan buche
        workers.filter(w=>dist(w,f)<24).forEach(w=> w.crop=Math.min(w.cropMax, (w.crop||0)+0.07));
        if(Math.random()<0.06) particles.push({x:f.x,y:f.y-8,vx:(Math.random()-0.5)*0.6,vy:-0.7,life:0.9,decay:0.022,color:'#e8d5a3'});
      }
      if(tempOk) f.health=Math.min(1, f.health+ dt*0.00008);
      else f.health-= dt*0.00009;
    }
    // COSECHA: el jardin echa gongylidia y una obrera la lleva al granero con el mismo camino que
    // la miel de la superficie (que ya funciona). Sin esto la produccion quedaba en el hongo y la
    // despensa de la colonia no se enteraba.
    // El tope de la cosecha mira lo que hay CERCA del jardin, no la miel esparcida por la superficie
    // (la miel no se pudre, asi que el mapa se llena de gotas lejanas y el jardin dejaba de dar
    // fruto justo cuando la colonia era grande - medido: 36 gotas fuera y cosecha a cero).
    const _sp=storagePos(); let _aMano=0;
    for(const _f of foods){ if(Math.hypot(_f.x-f.x, _f.y-f.y) < CELL*16) _aMano++; }
    if(f.health>0.5 && f.size>0.8 && _aMano < Math.max(3, Math.round(workers.length*0.6)) && Math.random()<dt*0.0022*f.size*f.health){
      spawnFoodAt(f.x, f.y, 1 + Math.round(f.size||1), 'mushroom');   // hongo grande, bocado grande
      if(Math.random()<0.25) pushToast(f.x, f.y-14, '🍄', '#e8d5a3', 1.1);
    }
    // patógeno si basurero cerca
    for(let w of wastePiles){ if(Math.hypot(w.x-f.x,w.y-f.y)<48) f.health-= dt*0.00012; }
    // y si le quitan el lecho (alguien cava el suelo de la camara) el sustrato se va: se apaga rapido
    if(!soil[f.r+1] || soil[f.r+1][f.c]===0) f.health -= dt*0.0016;
    if(f.health<=0){ fungusGardens.splice(i,1); pushEvent('death', (!soil[f.r+1] || soil[f.r+1][f.c]===0) ? '🍄 Jardín fúngico perdido - le cavaron el suelo de debajo' : '🍄 Jardín fúngico muere - falta cuidado/humedad'); }
  }
  // crear nuevo jardín cuando la colonia crece y aprende hongo. El sitio y el momento salen del USO (los
  // votos de las obreras que guardan setas y semillas alli), no del dado: asi el huerto aparece donde la
  // comida ya pasa, y una colonia con mas gen e inteligencia lo aprende con menos ensayos - el oficio se
  // hereda, no se regala. Si los votos se acumulan sin tener el invento, es que ELLOAS lo descubren: el
  // invento de `fungus` se abre desde el contador, igual que se abrira el de los metales (ROADMAP 2.7).
  if(fungusGardens.length<3+Math.floor(workers.length/18) && workers.length>=6 && economyLedger.food>4){
    const _umbral = Math.max(2, Math.round(11 - gen*1.6 - Math.max(0,(colonyIQ-112))/9));
    let _mejor=null, _votos=0, _clave=null;
    for(const k in _huertoVotos){ if(_huertoVotos[k] > _votos){ const p=k.split(','); _mejor={c:+p[0], r:+p[1]}; _votos=_huertoVotos[k]; _clave=k; } }
    if(_mejor && _votos >= _umbral){
      const gx=_mejor.c*CELL+8, gy=_mejor.r*CELL+8;
      let _vecino=null;
      for(const g of fungusGardens){ if(Math.hypot(g.x-gx,g.y-gy)<CELL*3) _vecino=g; }
      if(_vecino && (_vecino.fed||0) < 18){
        // el huerto de al lado todavia tiene hambre: los votos son cuidado, no siembra nueva
        _vecino.fed=Math.min(24, (_vecino.fed||0)+0.5);
        _vecino.health=Math.min(1, _vecino.health+0.02);
        delete _huertoVotos[_clave];
        if(!inventions.fungus && (_vecino.fed||0) >= 10){
          // y el invento sale de esto: si le llevan sustrato y lo mantienen, YA saben cultivar - nadie se lo
          // conto, lo cuentan los votos.
          inventions.fungus=true;
          pushEvent('invention',`🍄 Cultivo descubierto: ${_votos} cargas de sustrato manten el jardin de la camara`, `Aprendizaje por uso - GEN${gen}, IQ ${Math.round(colonyIQ)}`);
          notifyCanon('🍄 CULTIVO', 'Las obreras aprenden a mantener el hongo donde tiran el sustrato', 5200);
        }
      } else if(!soil[_mejor.r] || soil[_mejor.r][_mejor.c]!==0 || !soil[_mejor.r+1] || soil[_mejor.r+1][_mejor.c]===0){
        delete _huertoVotos[_clave];                          // alguien tumbo el suelo: se busca otro rincon
        // (y no se funda sobre el vacio: el hongo necesita lecho, igual que la mata necesita tierra)
      } else {
        fungusGardens.push({x:gx, y:gy, c:_mejor.c, r:_mejor.r, health:0.78, size:0.9, age:0, fed:0});
        delete _huertoVotos[_clave];
        inventions.fungus=true;
        pushEvent('evo','🍄 Nuevo jardín fúngico, en el rincón que ellas usan',`Jardines: ${fungusGardens.length} · ${_votos} cargas votan ese suelo`);
        notifyCanon('🍄 HUERTO NUEVO', `El trafico de la colonia abre un jardin en [${_mejor.c},${_mejor.r}]`, 4800);
        if(Math.random()<0.6) pushToast(gx, gy-14, '🍄', '#2de67a', 1.4);
      }
    }
  }
  // los habitos viejos se enfrian: si una celda lleva un dia sin votos, deja de competir
  if(_huertoVotosN > 40 && (time % (DAY_LENGTH*2)) < 200){ for(const k in _huertoVotos){ _huertoVotos[k]-=1; if(_huertoVotos[k]<=0) delete _huertoVotos[k]; } _huertoVotosN=0; }
}
function updateWaste(dt){
  // cada excavación genera residuo que debe ir a cámara separada
  // wastePiles son montículos aislados; si quedan cerca de cría/hongo, penaliza
  for(let i=wastePiles.length-1;i>=0;i--){
    const w=wastePiles[i];
    w.age=(w.age||0)+dt;
    // viejas llevan basura lejos (si hay viejas)
    const carriers = workers.filter(ww=> ww.age/DAY_LENGTH>1.0 && dist(ww,w)<44 && ww.state==='EXPLORAR' &&
      !ww.food && !ww.targetFood && !ww.digTarget && !ww.wasteTarget && !ww._pozoPrincipal);
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
    const wa = broodAnchor();
    for(let b of brood){ for(let w of wastePiles){ if(Math.hypot((b.x!==undefined&&b.x!==null?b.x:wa.x)-w.x,(b.y!==undefined&&b.y!==null?b.y:wa.y)-w.y)<36) b.progress-= dt*0.0006; } }
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
function _esconderVuelta(){ for(const id of ['btnVolver','btnVolverQ']){ const v=document.getElementById(id); if(v) v.style.display='none'; } _rosterVuelta=false; }
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
  try{ _esconderVuelta(); }catch(e){}
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
  try{ cerrarInventario(); }catch(e){} // uno u otro: la hoja del perfil y el inventario no se apilan
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
    const label=k==='exploracion'?'EXPL':k==='construccion'?'DIG':k==='recoleccion'?'GATH':k==='cuidado'?'CARE':'COMM';
    const d=document.createElement('div');
    d.style.cssText='background:rgba(255,255,255,0.03);border:1px solid #1a1a1a;padding:4px';
    d.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;font-family:\'Press Start 2P\';font-size:6px;color:#c9b896;letter-spacing:0.3px"><span>${label}</span><span style="color:${col};font-size:7px">${v}</span></div><div style="height:8px;background:#0a0a0a;border:1px solid #000;margin-top:3px;position:relative;overflow:hidden"><div style="height:100%;width:${v}%;background:${col};box-shadow:inset 0 1px 0 rgba(255,255,255,0.2)"></div></div>`;
    tEl.appendChild(d);
  }
  hudText('profileFitness', (ant.fitness||0).toFixed(2));
  hudText('profileDeliveries', `${ant.deliveries} deliveries · ${ant.digsDone} tunnels excavated · ${ant.commsSent} ink marks`);
  try{
    const _tk = [['exploracion','exploring the nest'],['construccion','digging and building'],['recoleccion','gathering food'],['cuidado','tending brood'],['comunica','communicating with others']];
    const _ord = _tk.map(k => ({ n: k[1], v: Math.round(ant.traits[k[0]] || 0) })).sort((a, b) => b.v - a.v);
    const _g = document.getElementById('profileTraitsGist');
    if(_g) _g.textContent = 'Best trait: ' + _ord[0].n + ' (' + _ord[0].v + ' of 100). Weakest: ' + _ord[_ord.length - 1].n + ' (' + _ord[_ord.length - 1].v + ').';
  }catch(e){}
  hudText('profileCrimes', `${ant.crimes} fights · ${ant.followers} followers`);
  hudText('profileBelief', ant.belief? `believes in ${ant.belief}-ism` : (ant.followers>0? `leads ${ant.followers}` : '— no cult'));
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
    // EL RETRATO CON EL MISMO PINCEL que el lienzo: la hormiga de la hoja y la del barro son
    // la misma figura, aquI mas grande. Antes esto era un rectAngulo liso de un solo color,
    // porque los PNG del avatar se fueron del proyecto y el pincel de reserva no pintaba nada
    // que se pareciera a una hormiga. El tamano se pasa por `s`, no por ctx.scale: escalar con
    // decimales borra los bordes y el retrato es lo unico que se mira de cerca sin zoom.
    pctx.save(); pctx.translate(30,30);
    _hormigaVoxel(pctx, ant, 1.6, false, ant.id|0);
    pctx.restore();
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
  modal.style.width = '326px';
  modal.style.maxWidth = 'calc(100vw - 28px)';
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
  modal.style.overflowY='auto'; asentarHoja(modal);
  requestAnimationFrame(()=>{ asentarHoja(modal); });
  modal.style.opacity='1';
  // tabs
  try{
    const tabs=modal.querySelectorAll('#profileTabs [data-ptab]');
    // `cerebro` va aqui dentro o la pestana 🧠 MENTE no se abriria nunca: el boton cambia el display de lo
    // que hay en ESTE mapa, y una hoja que no esta apuntada se queda escondida para siempre (medido: la
    // pestana se marcaba activa y el panel seguia en display:none).
    const panes={rasgos:document.getElementById('profileTab_rasgos'), estado:document.getElementById('profileTab_estado'), arbol:document.getElementById('profileTab_arbol'), hist:document.getElementById('profileTab_hist'), cerebro:document.getElementById('profileTab_cerebro')};
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
// LOCOMOCION A X64 (medido, y queda aqui para que nadie lo vuelva a intentar sin saber el precio). El paso
// de cada tick es 1.05*gameSpeed, o sea 67 px a x64: cuatro celdas de golpe. Partirlo en trozos de 8 px hace
// que la hormiga deje de saltar por encima de las paredes y tenga que pasar por las galerias, que es lo
// correcto... y la colonia se muere de hambre: la recogida de miel se vuelve 5-8 veces mas lenta y la
// economia entera esta calibrada con el salto (medido: 0 obreras y 0 raciones al dia 8 en las 3 semillas con
// el paso partido, con y sin el contador de golpes corregido). Si algun dia se intenta, hay que reequilibrar
// forrajeo y puesta a la vez; no es un parche de un turno.
function updateAnt(ant, dt){
  // La marca de la primera cuadrilla dura toda la obra, no solo una calada. Así la obrera que ya está
  // abajo encadena el siguiente bloque en vez de ser sustituida por otra que vuelve a empezar desde el
  // nido. Al abrir la primera losa se retira el encargo para siempre.
  if(ant._pozoPrincipal && umbralesRotos>0) ant._pozoPrincipal=false;
  // Once the slab recruits a visible crew, ordinary job selection cannot dissolve it one tick later.
  // Water, injury and carried soil still override this below; the reservation only protects active,
  // healthy helpers for a short work shift.
  if(ant._umbralSupport){
    const t=ant.digTarget,valid=umbral&&t&&t.r===umbral.r&&soilType[t.r]&&soilType[t.r][t.c]===17&&time<(ant._obraUmbralHasta||0)&&ant.health>20&&(ant.fatigue||0)<88;
    if(valid&&!ant.food&&!ant._magmaRetreat){ ant.targetFood=null; ant.wasteTarget=null; ant.buildTarget=null; ant.state='CAVANDO'; }
    else if(!valid){ delete ant._umbralSupport; delete ant._obraUmbralHasta; }
  }
  // La cuadrilla reservada no acepta una calada lateral por el reflejo de atasco mientras espera a
  // que vuelva la comida. Su único frente, hasta la losa, vive en las tres columnas de la boca.
  if(ant._pozoPrincipal && umbralesRotos===0 && ant.digTarget && Math.abs(ant.digTarget.c-CENTER_COL)>1 &&
     !(soilType[ant.digTarget.r]&&soilType[ant.digTarget.r][ant.digTarget.c]===17)){
    ant.digTarget=null; ant.digProgress=0; if(ant.state==='CAVANDO') ant.state='EXPLORAR';
  }
  // Una tarea interrumpida no conserva objetivos fantasma. El descanso, la basura o una entrega
  // podían cambiar el estado pero dejar `digTarget`; después la misma obrera acumulaba calada,
  // tierra en la boca y objetivo de miel a la vez, y ninguna rama era ya dueña de su movimiento.
  if(ant.digTarget && ant.state!=='CAVANDO' && ant.state!=='DESCANSAR'){
    ant.digTarget=null; ant.digProgress=0;
  }
  // La tierra ya extraída se devuelve antes de aceptar otro encargo. Si se durmió cargada, al
  // despertar recupera VOLVER_TIERRA en el siguiente paso en vez de quedar como EXPLORAR cargada.
  if(ant.food && ant.food.isSoil){
    ant.targetFood=null; ant.wasteTarget=null;
    if(ant.state!=='VOLVER_TIERRA' && ant.state!=='DESCANSAR'){
      ant.digTarget=null; ant.digProgress=0; ant.state='VOLVER_TIERRA';
    }
  }
  // Igual con la basura: una siesta puede cambiar el estado, no borrar el encargo. Al despertar
  // recupera el transporte en vez de pasear eternamente con un `wasteTarget` invisible.
  if(ant.wasteTarget && !(ant.food&&ant.food.isSoil) && ant.state!=='LLEVANDO_BASURA' && ant.state!=='DESCANSAR'){
    ant.targetFood=null; ant.digTarget=null; ant.digProgress=0; ant.state='LLEVANDO_BASURA';
  }
  // Emergencia acuática antes que cualquier oficio. Una obrera mojada puede cruzar agua para salir,
  // pero elige siempre el primer paso hacia una celda seca; el movimiento ordinario no obtiene esa
  // excepción. Así no se suicida entrando y tampoco queda encarcelada por la propia regla de evasión.
  const _waterHere=waterAtPixel(ant.x,ant.y);
  if(_waterHere>=WATER_ESCAPE_LEVEL){
    if(ant.state!=='HUIR_AGUA') ant._stateBeforeWater=ant.state;
    ant.state='HUIR_AGUA'; ant.targetFood=null; ant.digTarget=null; ant.digProgress=0; ant.buildTarget=null;
    if(!ant.mood) ant.mood={joy:0.5,anger:0,fear:0,sadness:0,loyalty:0.6,stress:0};
    ant.mood.fear=Math.min(1,(ant.mood.fear||0)+0.08); ant.mood.stress=Math.min(1,(ant.mood.stress||0)+0.025);
    const shore=findWaterEscapeStep(ant);
    if(shore){
      const ang=Math.atan2(shore.y-ant.y,shore.x-ant.x); ant.angle+=((ang-ant.angle+Math.PI*3)%(Math.PI*2)-Math.PI)*0.42;
      const swim=Math.min(7,1.7+Math.sqrt(Math.max(1,gameSpeed))*0.62);
      const nx=ant.x+Math.cos(ant.angle)*swim, ny=ant.y+Math.sin(ant.angle)*swim;
      // Geometry only here: canAntMove intentionally refuses wet cells, while an escape path may need
      // several wet cells before reaching its shore.
      if(canMove(nx,ny)){ ant.x=nx; ant.y=ny; ant.blocked=0; }
      else { ant.angle=ang; const sx=ant.x+Math.cos(ang)*swim, sy=ant.y+Math.sin(ang)*swim; if(canMove(sx,sy)){ ant.x=sx; ant.y=sy; ant.blocked=0; } else ant.blocked++; }
    } else ant.angle-=0.35;
    ant.fatigue=Math.min(100,ant.fatigue+0.02*dt);
    return;
  } else if(ant.state==='HUIR_AGUA'){
    ant.state=ant.floodTarget?'CONTROLAR_AGUA':'EXPLORAR'; delete ant._stateBeforeWater;
  }
  // SALIDA GLOBAL DEL ATASCO. El atasco no era un problema del forrajeo: una hormiga SIN objetivo puede
  // quedar encajada en una celda y contar blocked hasta 4.430 pasos, porque las unicas reglas que miran
  // el atasco viven dentro de la persecucion de la miel. Medido en el mundo pequeno con seis dias de
  // simulacion: `enSuperficie 0 de 11` desde el dia 5, nueve gotas de miel intactas en el prado, y AW14
  // clavada en (430,262) con blk 724 -> 4430 sin que nada la sacara. O sea: no es que no sean
  // aventureras, es que quedan encajadas abajo y no vuelven a ver el cielo.
  // ENCAJADA = no se ha movido del sitio, no «ha chocado n veces». Todas las ramas de movimiento ponian
  // blocked=0 con cada paso que podian dar, y una hormiga que rebota contra una pared SIEMPRE puede dar un
  // pasito lateral: su contador de golpes se borraba y ninguna cura de atasco (ni la A* que ya existia ni
  // ninguna nueva) llegaba a disparar. Medido: AH9R rebotando 120 ticks en x=452, y 371..432, blk 0, con
  // la camara de basura a 31 px a la derecha; y AW14 paseando en circulo 4.430 pasos sin objetivo.
  // Los estados que se trabajan en un sitio fijo no son encajamiento: la que cava se queda pegada a la pared
  // hasta romperla, y la del jardin del hongo vive encima de su parcela. Si se las cuenta como atascadas, el
  // rescate les reinicia el progreso cada 40 ticks y no terminan nunca (medido: 814 rescates en 8 dias).
  const _paradaHonesta = ant.state==='TRABAJAR_JARDIN' || ant.state==='DESCANSAR'
    || (ant.state==='CAVANDO' && ant.digTarget);
  if(!ant.isQueen && !_paradaHonesta){
    const _conObj = !!(ant.targetFood || ant.wasteTarget || ant.food || ant.digTarget);
    ant._ciclo = (ant._ciclo||0) + 1;
    const _cada = _conObj ? 40 : 120;
    if(ant._ciclo % _cada === 0){
      if(ant._anclaX === undefined){ ant._anclaX=ant.x; ant._anclaY=ant.y; }
      else {
        const _neto = Math.hypot(ant.x-ant._anclaX, ant.y-ant._anclaY);
        if(_neto < (_conObj? 6: 8)) ant.blocked = 61;                 // que las curas que ya existen tengan su oportunidad
        else { ant.blocked = Math.min(ant.blocked||0, 8); }
        ant._anclaX = ant.x; ant._anclaY = ant.y;
      }
    }
  }
  if((ant.blocked||0) > 60 && !ant.isQueen){
    ant.blocked = 0;
    const _sinObjetivo = !(ant.targetFood || ant.wasteTarget || ant.food || ant.digTarget);
    if(_sinObjetivo){
      // paseando y dando vueltas en el mismo rincon: basta con regalarle un rumbo nuevo
      ant.angle += Math.PI*0.5 + (Math.random()-0.5)*0.9;
    } else {
      const _yoR=Math.floor((ant.y+8)/CELL), _yoC=Math.floor(ant.x/CELL);
      // a) busca aire pisable cerca; subir puntua mas que bajar, porque arriba esta la comida
      let _aire=null, _da=1e9;
      for(let r=_yoR-6; r<=_yoR+6; r++){
        if(r<SURFACE_ROW-1 || r>=ROWS) continue;
        for(let c=_yoC-6; c<=_yoC+6; c++){
          if(c<0 || c>=COLS || !soil[r] || soil[r][c]!==0) continue;
          const d = Math.abs(r-_yoR) + Math.abs(c-_yoC) - (r<_yoR ? 1.1 : 0);
          if(d<_da){ _da=d; _aire={r,c}; }
        }
      }
      // b) si hay aire pero no lo alcanza, la solucion es cavar LA PARED que le estorba, no empujarla
      let _cavar=null, _bc=1e9;
      if(_aire) for(let dr=-1; dr<=1; dr++) for(let dc=-1; dc<=1; dc++){
        const r=_yoR+dr, c=_yoC+dc;
        if(r<SURFACE_ROW || r>=ROWS || c<0 || c>=COLS) continue;
        if(!soil[r] || soil[r][c]!==1) continue;                       // solo tierra suelta
        if(soilType[r] && (soilType[r][c]===7 || soilType[r][c]===15 || soilType[r][c]===17)) continue;   // roca madre, fuego y LOSA: no son una salida de atasco
        const haciaAire = Math.abs(r-_aire.r) + Math.abs(c-_aire.c);
        if(haciaAire > _da+1) continue;                                // que el golpe abra hacia el hueco
        const coste = haciaAire + (dr>0? 0.5:0) + Math.random()*0.3;
        if(coste<_bc){ _bc=coste; _cavar={r,c}; }
      }
      if(_cavar){
        // si ya estaba cavando ESA celda, no le borres el progreso: solo cambia de objetivo si es otra
        if(!ant.digTarget || ant.digTarget.r!==_cavar.r || ant.digTarget.c!==_cavar.c){ ant.digTarget=_cavar; ant.digProgress=0; }
        ant.state='CAVANDO';
        if(!ant.food) ant.targetFood=null;                             // que no persiga dos cosas a la vez
        antsAtascados = (antsAtascados||0)+1;
      } else if(_aire){
        ant.angle = Math.atan2((_aire.r+0.5)*CELL - ant.y, (_aire.c+0.5)*CELL - ant.x);
        if(!ant.food && !ant.digTarget) ant.state='EXPLORAR';
      } else {
        ant.angle += Math.PI*0.5 + (Math.random()-0.5)*0.8;           // ni aire ni tierra: que pruebe por detras
      }
    }
  }
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
    // La carga es {amount}, no una posición. Solo se recluta si queda una fuente real a la que guiar.
    const _tandemFood=(ant.targetFood && Number.isFinite(ant.targetFood.x) && Number.isFinite(ant.targetFood.y)) ? ant.targetFood : nearestFood(ant);
    const follower = _tandemFood && workers.find(w=>w.id!==ant.id && w.state==='EXPLORAR' && !w.food && !w.tandemPartner && dist(ant,w)<26);
    if(follower){
      ant.tandemPartner=follower.id; follower.tandemPartner=ant.id;
      ant.targetFood=_tandemFood; follower.targetFood=_tandemFood;
      ant.state='TANDEM_LEADER'; follower.state='TANDEM_FOLLOWER';
      ant.tandemCooldown=320; follower.tandemCooldown=320;
      pushEvent('evo',`🤝 Tandem ${ant.id} → ${follower.id}`,`Guía 1-a-1 a comida - colonia pequeña`);
    }
  }
  if(ant.mood.sadness>0.82) ant.mood.joy=Math.max(0, ant.mood.joy-0.01);
  if(ant.mood.anger>0.75) ant.mood.loyalty=Math.max(0, ant.mood.loyalty-0.008);
  // === FÍSICA REAL: gravedad ===
  // helpers internos
  function hasGrip(_x,_y){
    const _c=Math.floor(_x/CELL), _footR=Math.floor((_y+10)/CELL);
    if(_footR>=0&&_footR<ROWS&&_c>=0&&_c<COLS){
      if(soil[_footR]&&soil[_footR][_c]===1) return 'floor';
      for(let s of structures){ if(_c>=s.c&&_c<s.c+s.w && _footR>=s.r&&_footR<s.r+s.h) return 'floor'; }
    }
    // Arolia + garras: medir la distancia al BORDE real de la pared que rodea el cuerpo. Antes se
    // mezclaba la fila de los pies con la de la cabeza y, durante media celda de cada paso, no se
    // miraba la pared que estaba justo al lado. En un pozo de tres celdas la hormiga trepaba hasta
    // y=150, perdia agarre, caia y repetia para siempre aunque el BFS señalara la salida correcta.
    const _bodyR=Math.floor(_y/CELL), _alcance=13; // radio del cuerpo (7 px) + patas; no cruza dos celdas
    function _tocaRect(x0,y0,x1,y1){
      const dx=_x<x0?x0-_x:_x>x1?_x-x1:0;
      const dy=_y<y0?y0-_y:_y>y1?_y-y1:0;
      return dx*dx+dy*dy <= _alcance*_alcance;
    }
    for(let dr=-1; dr<=1; dr++) for(let dc=-1; dc<=1; dc++){
      const nc=_c+dc, nr=_bodyR+dr;
      if(nc<0||nc>=COLS||nr<SURFACE_ROW||nr>=ROWS) continue;
      if(soil[nr]&&soil[nr][nc]===1 && _tocaRect(nc*CELL,nr*CELL,(nc+1)*CELL,(nr+1)*CELL)) return 'wall';
      for(let s of structures){
        if(nc>=s.c&&nc<s.c+s.w && nr>=s.r&&nr<s.r+s.h &&
           _tocaRect(s.c*CELL,s.r*CELL,(s.c+s.w)*CELL,(s.r+s.h)*CELL)) return 'wall';
      }
    }
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
      if(canAntMove(ant,fallX, ant.y)) ant.x = fallX;
      ant.y += ant.vy;
      let cr=Math.floor((ant.y+10)/CELL), cc=Math.floor(ant.x/CELL);
      if(cr>=ROWS) { ant.y=(ROWS-1)*CELL-10; ant.vy=0; }
      else if(soil[cr]&&soil[cr][cc]===1){
        ant.y = cr*CELL - 10;
        ant.vy=0;
        ant.fatigue=Math.min(100, ant.fatigue + _fatUnidad*0.9);  // aterrizar de una caida cuesta
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
      ant.fatigue += _fatUnidad*dt*0.5;  // trepar cansa medio punto mas que andar (antes multiplicaba por gameSpeed y se iba al doble)
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
          // El destino manda, no la suerte del angulo. Faltaba el caso de IDA: la que persigue una gota en el
          // prado no lleva digTarget ni comida, asi que «subo o bajo» se decidia por como miraba al chocar con
          // la pared - media veces trepaba hacia el nido y nunca salia. Medido: con 5 de 27 obreras con
          // objetivo en la superficie, `enSuperficie 0 de 27` (daban vueltas dentro del pozo).
          const wantUp = (ant.digTarget && ant.digTarget.r < _r) || (ant.food && storagePos().y < ant.y) || ant._quiereSubir || Math.sin(ant.angle) < -0.3;
          // Agarrada a pared y trepando, las garras vencen la caída. Antes conservaba vy>0, subía unos
          // píxeles y volvía a caer aunque la cabeza apuntara correctamente hacia arriba.
          if(wantUp && ant.vy>0) ant.vy=0;
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

  // Ingeniería de emergencia: una sola obrera se acerca por celdas secas y tapona la brecha. No se
  // mete en el agua para construir; si la geometría cambia, updateFloodResponse buscará otra cara.
  if(ant.state==='CONTROLAR_AGUA'&&ant.floodTarget){
    const target=ant.floodTarget;
    if(!soil[target.r]||soil[target.r][target.c]!==0||waterAtCell(target.c,target.r)<0.14){
      _clearFloodAssignment(ant); floodControl.target=null; floodControl.workerId=null; return;
    }
    let work=ant.floodWork;
    if(!work||!isDryOpenCell(work.c,work.r,0.22)){
      const cells=_floodWorkCells(target).sort((a,b)=>Math.hypot((a[0]+.5)*CELL-ant.x,(a[1]+.5)*CELL-ant.y)-Math.hypot((b[0]+.5)*CELL-ant.x,(b[1]+.5)*CELL-ant.y));
      if(!cells.length){ _clearFloodAssignment(ant); floodControl.workerId=null; return; }
      work=ant.floodWork={c:cells[0][0],r:cells[0][1]}; ant._routeUntil=0;
    }
    const workPos={x:(work.c+.5)*CELL,y:(work.r+.5)*CELL};
    const inCell=Math.floor(ant.x/CELL)===work.c&&Math.floor(ant.y/CELL)===work.r;
    const targetPos={x:(target.c+.5)*CELL,y:(target.r+.5)*CELL};
    // A dry ant on either face can pack a grate into the wet cell. Previously only the preselected
    // face counted; if water rose over that face while she travelled, a worker already touching the
    // breach waited for days (and abandoned the first slab) instead of closing it.
    const safeAdjacent=waterAtPixel(ant.x,ant.y)<WATER_AVOID_LEVEL&&dist(ant,targetPos)<CELL*1.8;
    if(inCell||dist(ant,workPos)<8||safeAdjacent){
      ant.angle=Math.atan2((target.r+.5)*CELL-ant.y,(target.c+.5)*CELL-ant.x);
      ant.floodProgress=(ant.floodProgress||0)+dt*0.09*(ant.tool==='trowel'?1.28:1);
      ant.fatigue=Math.min(100,ant.fatigue+0.03*dt);
      if(Math.random()<0.22) particles.push({x:(target.c+.5)*CELL,y:(target.r+.5)*CELL,vx:(Math.random()-.5),vy:-.4,life:.7,decay:.05,color:'#82cde8'});
      if(ant.floodProgress>=1) _sealFloodCell(ant,target);
      return;
    }
    let waypoint=workPos;
    const routed=routeStep(ant,workPos.x,workPos.y); if(routed) waypoint=routed;
    const ang=Math.atan2(waypoint.y-ant.y,waypoint.x-ant.x); ant.angle+=((ang-ant.angle+Math.PI*3)%(Math.PI*2)-Math.PI)*0.24;
    const nx=ant.x+Math.cos(ant.angle)*speed,ny=ant.y+Math.sin(ant.angle)*speed;
    if(canAntMove(ant,nx,ny)){ ant.x=nx; ant.y=ny; ant.blocked=0; }
    else { ant.blocked++; ant._routeUntil=0; ant.angle=ang; }
    return;
  }

  if(ant.state!=='DESCANSAR'){
    // Unidades: la fatiga se media por FRAME y el reloj simula en milisegundos escalados, asi que a
    // dt~42 (x64) o incluso a x1 la escala subia +1,7 por paso: cualquier obrera estaba al 100% en un
    // segundo de tiempo real y ya no volvia a bajar (medido: 28 de 28 hormigas con fatiga>92, `forr 0`,
    // y el input de fatiga de la red clavado en 1,0 - o sea, "no tengo ganas" permanente). Ahora se mide
    // en jornadas: una jornada entera de trabajo la agota, ni un segundo.
    ant.fatigue += _fatUnidad*dt*1.0;
    // Con la miel en la boca el sorteo del 2% no la sacaba nunca (vease arriba): si va cargada y
    // al limite, se para en seco y descansa AHII, sin soltar la carga.
    if(ant.fatigue>92 && (ant.food || ant.state!=='DESCANSAR') && (ant.blocked||0)>3) ant.state='DESCANSAR';
    else if(ant.fatigue>86 && Math.random()<0.02) ant.state='DESCANSAR';
  }else{
    ant.fatigue -= _fatUnidad*dt*14;   // la siesta devuelve el aire en ~1,7 horas de juego
    if(ant.fatigue<=12){
      ant.state=ant.digTarget&&soil[ant.digTarget.r]&&soil[ant.digTarget.r][ant.digTarget.c]===1?'CAVANDO':'EXPLORAR';
    }
    const deep={x:CENTER_COL*CELL, y:(SURFACE_ROW+12)*CELL};
    const ang=Math.atan2(deep.y-ant.y, deep.x-ant.x);
    ant.angle+=(((ang-ant.angle+Math.PI*3)%(Math.PI*2)-Math.PI)*0.04);
    const nx=ant.x+Math.cos(ant.angle)*speed*0.22, ny=ant.y+Math.sin(ant.angle)*speed*0.22;
    if(canAntMove(ant,nx,ny)){ant.x=nx;ant.y=ny;}
    return;
  }
  // El magma no se cava: se patea al lado. Si hay fuego a un bloque de distancia la fatiga sube y, si
  // se pasa de la raya, la obrera suelta lo que lleva y sube a la superficie. Es el peaje honesto de la
  // ultima banda - sin peaje no hay tension, y sin tension 'bajar al fuego' es solo leer un numero.
  if(magmaCells.length && Array.isArray(soilType)){
    const _ar=(ant.y/CELL)|0, _ac=(ant.x/CELL)|0;
    let _fuego=false;
    for(let dr=-1;dr<=1 && !_fuego;dr++){
      const _rr=_ar+dr; if(_rr<0||_rr>=ROWS||!soilType[_rr]||!soil[_rr]) continue;
      for(let dc=-1;dc<=1;dc++){
        const _cc=_ac+dc; if(_cc<0||_cc>=COLS) continue;
        if(soil[_rr][_cc]===1 && soilType[_rr][_cc]===15){ _fuego=true; break; }
      }
    }
    if(_fuego){
      ant.fatigue=Math.min(100, ant.fatigue+2.3); ant._quemando=time;
      if(ant.fatigue>84){
        ant.digTarget=null; ant.digProgress=0; ant.buildTarget=null; ant._magmaRetreat=true; ant.state='VOLVER_TIERRA';
        if(Math.random()<0.06) pushToast(ant.x,ant.y-12,'🔥','#ff6a1e');
        if(!ant._fuegoAviso || time-ant._fuegoAviso>600){ ant._fuegoAviso=time; pushEvent('accident', `🔥 ${ant.id} sale escaldada del basalto`, `piso ${_ar-SURFACE_ROW} - fatiga ${Math.round(ant.fatigue)}`); }
      }
    }
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
    if(canAntMove(ant,nx,ny)){ant.x=nx; ant.y=ny;}
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
    if(canAntMove(ant,nx,ny)){ant.x=nx; ant.y=ny;} else ant.blocked++;
    return;
  }
  if(ant.state==='LLEVANDO_BASURA' && ant.wasteTarget){
    const tgt=ant.wasteTarget;
    const ang=Math.atan2(tgt.y-ant.y, tgt.x-ant.x);
    ant.angle+= ((ang-ant.angle+Math.PI*3)%(Math.PI*2)-Math.PI)*0.13;
    const nx=ant.x+Math.cos(ant.angle)*1.05*gameSpeed, ny=ant.y+Math.sin(ant.angle)*1.05*gameSpeed;
    if(canAntMove(ant,nx,ny)){ant.x=nx; ant.y=ny;} else ant.blocked++;
    if(dist(ant,tgt)<10){
      // deja basura en cámara de desecho
      addWaste(tgt.x+(Math.random()-0.5)*12, tgt.y+(Math.random()-0.5)*10);
      _votaHuerto(ant.x, ant.y, 2);           // el mugron deja el suelo senalado: ahi prendara el hongo
      if(wastePiles.length>22) wastePiles.shift();
      ant.state='EXPLORAR'; ant.wasteTarget=null; ant.fitness+=0.12;
    }
    return;
  }
  if(ant.state==='CAVANDO' && ant.digTarget){
    // Cinco raciones son reserva, no combustible de obra. La cuadrilla conserva el frente y espera;
    // en cuanto entra una entrega continúa exactamente donde estaba, sin aceptar una calada lateral.
    const _muerdeLosa=soilType[ant.digTarget.r]&&soilType[ant.digTarget.r][ant.digTarget.c]===17;
    // The protected five rations stop opening new tunnels, not a crew already standing on the slab:
    // biting it spends no food. Freezing that last metre at exactly 5 made viable SMALL seeds miss T4.
    if(ant._pozoPrincipal&&economyLedger.food<=_reservaVital()&&!_muerdeLosa) return;
    const tx=(ant.digTarget.c+0.5)*CELL, ty=(ant.digTarget.r+0.5)*CELL;
    const d=dist(ant,{x:tx,y:ty});
    let _metaCava={x:tx,y:ty}, _cavaEnRuta=false;
    // Solo la obra principal necesita conservar un frente remoto. Los frentes espontáneos siguen
    // usando su locomoción original; así no se convierte cada calada lateral en un BFS costoso.
    if(ant._pozoPrincipal && d>CELL*1.35){
      const _pasoCava=routeStepToDig(ant,ant.digTarget);
      if(_pasoCava){ _metaCava=_pasoCava; _cavaEnRuta=true; }
      else if(d>CELL*3){
        // El frente pertenecía a otra bolsa de aire: caminar en línea recta sólo la deja mordiendo una
        // pared ajena. Lo suelta para que el selector elija, esta vez, una frontera conectada.
        ant.digTarget=null; ant.digProgress=0; ant.state='EXPLORAR'; return;
      }
    }
    // En una galería de una celda el centro cabe, aunque una pata haya quedado dentro de la arista
    // anterior. El nodo BFS es aire contiguo: recentrar ahí sólo cuando la postura actual es inválida
    // evita que la cuadrilla pase jornadas enteras vibrando en el borde de su propio pozo.
    if(_cavaEnRuta && !canMove(ant.x,ant.y) && !isSolidPixel(_metaCava.x,_metaCava.y) && dist(ant,_metaCava)<CELL*2){
      ant.x=_metaCava.x; ant.y=_metaCava.y; ant.vy=0;
    }
    const ang=Math.atan2(_metaCava.y-ant.y, _metaCava.x-ant.x);
    let diff=((ang-ant.angle+Math.PI*3)%(Math.PI*2)-Math.PI); ant.angle+=diff*(_cavaEnRuta?0.34:0.18);
    if(d>10){
      const _distPaso=dist(ant,_metaCava);
      const _velCava=_cavaEnRuta ? Math.min(speed*0.82,Math.max(2,_distPaso*0.72)) : speed*0.82;
      const nx=ant.x+Math.cos(ant.angle)*_velCava, ny=ant.y+Math.sin(ant.angle)*_velCava;
      if(canAntMoveIgnoreTarget(ant,nx,ny,ant.digTarget)){ant.x=nx;ant.y=ny;}else if(_cavaEnRuta && !isSolidPixel(nx,ny)){
        // El BFS trabaja por celdas abiertas, pero la física usa un radio de siete píxeles. Si una
        // obrera queda pegada a la arista de una galería de una celda, ese radio puede rechazar todos
        // los pasos aunque su centro y el siguiente nodo estén en aire. Déjala recentrarse dentro de
        // la ruta; el centro nunca atraviesa suelo y, una vez separado del borde, vuelve al radio normal.
        ant.x=nx; ant.y=ny;
      }else{
        // intentar deslizar por pared: probar solo X o solo Y (ignorando bloque objetivo)
        const sx=ant.x+Math.cos(ant.angle)*_velCava*0.55;
        const sy=ant.y+Math.sin(ant.angle)*_velCava*0.55;
        if(canAntMoveIgnoreTarget(ant,sx,ant.y,ant.digTarget)) ant.x=sx;
        else if(canAntMoveIgnoreTarget(ant,ant.x,sy,ant.digTarget)) ant.y=sy;
        else ant.angle+=(Math.random()-0.5)*0.7;
      }
    }else{
      const toolDig = ant.tool==='pick'?1.38 : ant.tool==='trowel'?1.18 : 1;
      const _digGain=(1.6+(ant.role==='EXCAVADORA'?0.28:0.12)*10)*Math.max(1,gameSpeed*0.85)*toolDig;
      const _esLosa=soilType[ant.digTarget.r]&&soilType[ant.digTarget.r][ant.digTarget.c]===17;
      const _esApoyoUmbral=ant._umbralSupport&&_esLosa;
      const _esLiderUmbral=ant._umbralLead&&_esLosa;
      // Support is mostly visual; the lead advances steadily but still slowly enough for the communal
      // effort to remain visible instead of deleting a fresh slab in a single high-speed frame.
      ant.digProgress+=_esApoyoUmbral?Math.min(_digGain,0.055):(_esLiderUmbral?Math.min(_digGain,0.65):_digGain);
      if(Math.random()<0.65) particles.push({x:tx+(Math.random()-0.5)*10,y:ty+(Math.random()-0.5)*10,vx:(Math.random()-0.5)*1.4,vy:-Math.random()*1.4,life:1,decay:0.04,color:'#8b5a2b'});
      if(Math.random()<0.18) particles.push({x:tx,y:ty-8,vx:(Math.random()-0.5)*0.6,vy:-0.9,life:1,decay:0.03,color:'#ffcc00'});
      if(ant.digProgress>=ant.digNeeded){
        // el cesped solo cede en la boca: si el frente apuntaba a otra parte, se rinde y cava abajo
        if(!puedeAbrirSuperficie(ant.digTarget.c, ant.digTarget.r)){
          // se rinde y vuelve a elegir: dejarla en CAVANDO sin objetivo la congelaba (otro paro,
          // que es justo lo que no vale), y EXPLORAR es el estado desde el que se asigna frente
          ant.digTarget=null; ant.digProgress=0; ant.state='EXPLORAR'; ant.blocked=0;
          if(Math.random()<0.25) pushToast(ant.x, ant.y-12, '🚫', '#8a8a8a', 0.9);
          return;
        }
        const _mt = (soilType[ant.digTarget.r]&&soilType[ant.digTarget.r][ant.digTarget.c])||1;
        // LA VETA PAGA: el material va al almacen de la colonia y se apunta cuanto se ha sacado, porque
        // el USO de estos metales no lo va a decidir una receta escrita por nosotros: lo van averiguando
        // ellas a fuerza de cargarlo, intentarlo y ver que aguanta (herramienta, lamina, adorno).
        if(_mt===8 || _mt===9 || _mt===10){
          const _mat = _mt===8?'cobre':_mt===9?'hierro':'oro';
          const _amt = 1 + (ant.tool==='pick'?1:0) + (colonyIQ>132?1:0);
          economyLedger.creditMaterial(_mat,_amt,'ore extraction');
          if(!materialUso[_mat]) materialUso[_mat]={mina:0, carga:0, tocado:0};
          materialUso[_mat].mina += _amt;
          pushToast(ant.digTarget.c*CELL+8, ant.digTarget.r*CELL+8, _mat==='cobre'?'\u{1F7E0}':(_mat==='hierro'?'\u2699\u{FE0E}':'\u{1F7E1}'), '#ffd76a', 1.4);
          pushEvent('discover', `\u26CF ${ant.id} saca ${_mat} x${_amt} de la roca`, `veta en [${ant.digTarget.c},${ant.digTarget.r}] - la colonia atesora ${economyLedger.materials[_mat]}`);
          logAntHistory(ant, `extrajo ${_mat} x${_amt}`);
          colonyFitness += _mat==='oro'?0.9:0.55;
        } if(_mt===17){                                  // la losa: el bloque NO se quita, se agrieta
          const _objetivoLosa={r:ant.digTarget.r,c:ant.digTarget.c};
          ant.digTarget=null; ant.digProgress=0; ant.food=null; ant.state='CAVANDO'; ant._pozoPrincipal=true;
          const _abierta=golpearUmbral(ant);
          // A bite is one work cycle, not the end of the assignment. Keeping the same reachable face
          // lets the leader and helpers continue; dropping it here left the leader idle after one hit.
          if(!_abierta&&umbral&&soilType[_objetivoLosa.r]&&soilType[_objetivoLosa.r][_objetivoLosa.c]===17) ant.digTarget=_objetivoLosa;
          return;
        } if(_mt===15){                                   // el magma no se cava: achicharra y ya esta
          ant.digTarget=null; ant.digProgress=0; ant.state='VOLVER_TIERRA'; ant.fatigue=Math.min(100,ant.fatigue+9);
          pushToast(ant.x,ant.y-10,'🔥 QUEMA','#ff6a1e'); return;
        } if(_mt===7 && (gen<8 || !inventions.masonry)){ ant.digTarget=null; ant.digProgress=0; ant.state='EXPLORAR'; pushToast(ant.x,ant.y-10,'⛔ BEDROCK','#555'); return; }
        soil[ant.digTarget.r][ant.digTarget.c]=0; if(soilType[ant.digTarget.r]) soilType[ant.digTarget.r][ant.digTarget.c]=0; markSoilDirty(ant.digTarget.c,ant.digTarget.r); ant.digsDone++; digs++; colonyFitness+=0.35;
        // La evolución mide trabajo de la colonia, no solo viajes de miel. Una calada vale menos de
        // la mitad de una entrega mínima (8 frente a 21 XP), pero una fundación que excava de verdad
        // puede alcanzar GEN1 aunque su linaje tarde en coronar el pozo de salida.
        stats.xp+=8; checkLevelUp();
        if(digs%6===0) pushImportant('invention', `⛏ ${digs} bloques cavados`, `GEN${typeof gen!=='undefined'?gen:0} - ${workers.filter(w=>w.state==='CAVANDO').length} activas en [${ant.digTarget?ant.digTarget.c:''},${ant.digTarget?ant.digTarget.r:''}]`);
        // residuo real: la tierra excavada va a basurero, no desaparece
        if(Math.random()<0.52){ addWaste(tx, ty, _mt); }
        // cosecha de material según estrato
        if(_mt===2 && Math.random()<0.72){ economyLedger.creditMaterial('clay',1,'soil excavation'); if(inventions.clay) colonyFitness+=0.06; }
        else if(_mt===3 && Math.random()<0.62){ economyLedger.creditMaterial('sand',1,'soil excavation'); }
        else if(_mt===4 && Math.random()<0.55){ economyLedger.creditMaterial('stone',1,'soil excavation'); if(inventions.stone) colonyFitness+=0.05; }
        else if(_mt===1 && Math.random()<0.22){ economyLedger.creditMaterial('fiber',1,'root excavation'); } // raíces
        if(_mt===4) pushToast(tx,ty-16,'⛏ PIEDRA','#8a8a8a',1.3);
        else if(_mt===2) pushToast(tx,ty-16,'✓ TÚNEL','#d4a574',1.3);
        else pushToast(tx,ty-16,'✓ TÚNEL','#2de67a',1.3);
        logAntHistory(ant, `abrió túnel [${ant.digTarget.c},${ant.digTarget.r}]`);
        checkRewardDiscovery(ant.digTarget.c, ant.digTarget.r);
        if(Math.random()<0.28){
          const neigh=[[ -1,0],[1,0],[0,-1],[0,1]];
          for(let [dx,dy] of neigh) if(Math.random()<0.45){
            const nc=ant.digTarget.c+dx, nr=ant.digTarget.r+dy;
            if(nr>=SURFACE_ROW&&nr<ROWS&&nc>=0&&nc<COLS&&soil[nr][nc]===1&&puedeAbrirSuperficie(nc,nr)&&Math.random()<0.5){ soil[nr][nc]=0; if(soilType[nr]) soilType[nr][nc]=0; markSoilDirty(nc,nr); }
          }
        }
        if(Math.random()<0.015 && countChambers()>4){
          const empties=[]; for(let r=SURFACE_ROW;r<ROWS;r++) for(let c=0;c<COLS;c++) if(soil[r][c]===0) empties.push({c,r});
          if(empties.length>40){
            const pick=empties[Math.floor(Math.random()*empties.length)];
            for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){
              const nc=pick.c+dx, nr=pick.r+dy;
              if(nr>=SURFACE_ROW&&nr<ROWS&&nc>=0&&nc<COLS) if(Math.random()<0.6){ soil[nr][nc]=1; if(soilType[nr]) soilType[nr][nc]= (Math.random()<0.6?4:2); markSoilDirty(nc,nr); }
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
        if(ant._pozoPrincipal){
          // En el pozo la misma integrante encadena caladas: deja el escombro profundo (con coste
          // higiénico) y conserva el relevo hasta la primera losa, en vez de volver al nido o sortear
          // una excavadora lejana después de CADA bloque.
          addWaste(tx,ty,_mt); ant.food=null;
          ant.digTarget=null; ant.digProgress=0; ant.state='EXPLORAR';
        } else {
          ant.food={amount:1,isSoil:true}; ant.digTarget=null; ant.digProgress=0; ant.state='VOLVER_TIERRA';
        }
      }
    }
    return;
  }
  if(ant.state==='VOLVER_TIERRA'){
    // decidir si construir una pared estratégica en vez de solo tirar tierra en la entrada. Una
    // obrera escaldada no se detiene a construir: primero sale del basalto y recupera el aliento.
    if(!ant.buildTarget && !ant._magmaRetreat){
      const buildChance = 0.16 + (ant.traits.construccion/100)*0.22 + Math.min(0.14, (colonyIQ-100)/520) + gen*0.009; // más lento al inicio
      const canBuild = ant.role==='EXCAVADORA' || ant.role==='NODRIZA' || ant.traits.construccion>48;
      if(canBuild && Math.random()<buildChance){
        const site=findBuildSite(ant);
        if(site){ ant.buildTarget=site; ant.buildProgress=0; }
      }
    }
    const tgt = ant.buildTarget && !ant._magmaRetreat ? {x:ant.buildTarget.c*CELL+8, y:ant.buildTarget.r*CELL+8} : surfaceEntrance();
    const ang=Math.atan2(tgt.y-ant.y, tgt.x-ant.x);
    const bias=steer*0.22;
    ant.angle+=(((ang-ant.angle+Math.PI*3)%(Math.PI*2)-Math.PI)*0.11 + bias*0.07);
    const nx=ant.x+Math.cos(ant.angle)*speed, ny=ant.y+Math.sin(ant.angle)*speed;
    // al construir, ignorar el propio bloque destino si es túnel (vacío) - necesita llegar
    const can = ant.buildTarget ? canAntMove(ant,nx,ny) : canAntMove(ant,nx,ny);
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
          soil[r][c]=1; markSoilDirty(c,r);
          // material usado: si son inteligentes usan piedra/arcilla/madera según stock
          let usedType=1;
          if(inventions.wood && economyLedger.materials.wood>0 && ant.traits.construccion>62 && Math.random()<0.28){ economyLedger.debitMaterial('wood',1,{reason:'wall decoration'}); usedType=1; decoSet.add(dkey(c,r)); }
          else if(inventions.stone && economyLedger.materials.stone>2 && Math.random()<0.32){ economyLedger.debitMaterial('stone',2,{reason:'wall construction'}); usedType=4; }
          else if(inventions.clay && economyLedger.materials.clay>1 && Math.random()<0.38){ economyLedger.debitMaterial('clay',1,{reason:'wall construction'}); usedType=2; }
          else if(economyLedger.materials.sand>1 && Math.random()<0.18){ economyLedger.debitMaterial('sand',1,{reason:'wall construction'}); usedType=3; }
          if(soilType[r]) soilType[r][c]=usedType;
          if(usedType===4) pushToast(tgt.x,tgt.y-10,'🧱 PIEDRA','#8a8a8a',1.4);
          else if(usedType===2) pushToast(tgt.x,tgt.y-10,'🏺 ARCILLA','#c2a080',1.4);
          // ingeniera decora: solo si han aprendido (gen>=3, IQ>130, cámaras>=3) y por gusto cuidado alto
          const canDecorate = gen>=3 && colonyIQ>132 && countChambers()>=4; // realista: decorar no desde GEN2
          if(canDecorate && ant.traits.cuidado>62 && Math.random() < 0.09 + ant.traits.cuidado*0.002){
            decoSet.add(dkey(c,r)); markSoilDirty(c,r);
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
            soil[best.r][best.c]=1; soilType[best.r][best.c]=1; markSoilDirty(best.c,best.r);
            ant.food=null;
            if(ant._magmaRetreat){ ant._magmaRetreat=false; ant.state='DESCANSAR'; } else ant.state='EXPLORAR';
            ant.blocked=0;
            for(let i=0;i<5;i++) particles.push({x:best.c*CELL+8,y:best.r*CELL+8,vx:(Math.random()-0.5)*1,vy:-0.4,life:0.6,decay:0.04,color:'#6b3a1f'});
            pushEvent('build',`${ant.id} rellena [${best.c},${best.r}] con tierra (Terraria)`, `Reconstrucción - GEN${gen}`);
            return;
          }
        }
        mound.push({x:tgt.x+(Math.random()-0.5)*22,y:SURFACE_Y-2,h:4+Math.random()*5});
        if(mound.length>30) mound.shift();
      }
      ant.food=null;
      if(ant._magmaRetreat){ ant._magmaRetreat=false; ant.state='DESCANSAR'; }
      else ant.state='EXPLORAR';
      ant.blocked=0;
    }
    return;
  }
  const carrying=!!ant.food && !ant.food.isSoil;
  if(carrying && ant.state!=='DESCANSAR'){
    ant.state='VOLVER_COMIDA';
    let tgt=storagePos();
    // waypoint Minecraft: si estás en la superficie (y < 100) y lejos del hueco central, ve primero a la boca del túnel para no atravesar tierra en diagonal
    const shaftX = CENTER_COL*CELL+8;
    if(ant.y < SURFACE_Y+12 && Math.abs(ant.x - shaftX) > 24){
      tgt={x: shaftX, y: SURFACE_Y-6};
    }
    // si lleva demasiado bloqueada, el objetivo directo no vale: que siga la galeria
    if(ant.blocked>10){ const _rs = routeStep(ant, tgt.x, tgt.y); if(_rs) tgt=_rs; }
    const ang=Math.atan2(tgt.y-ant.y, tgt.x-ant.x);
    const steerBias=steer*0.55;
    let diff=((ang-ant.angle+Math.PI*3)%(Math.PI*2)-Math.PI);
    ant.angle+= diff*0.07 + steerBias*0.08;
    if(Math.abs(ant.sensors.commIn1)>0.5) ant.angle+= ant.sensors.commIn1*0.04;
    const nx=ant.x+Math.cos(ant.angle)*speed, ny=ant.y+Math.sin(ant.angle)*speed;
    if(canAntMove(ant,nx,ny)){ant.x=nx;ant.y=ny;ant.blocked=0;}else{ ant.blocked++; ant.angle+=(Math.random()-0.5)*0.9 + 0.12; if(ant.blocked>32){ ant.angle+=Math.PI*0.45; ant.blocked=0; /* no abandonar miel: seguir intentando VOLVER_COMIDA */ } }
    if(time-ant.lastPhero>11){ const isRecruit=!!ant.food && !ant.food.isSoil; const amt=isRecruit?(ant.food.amount||1):1; pheromones.push({x:ant.x,y:ant.y,strength: isRecruit? 0.92+amt*0.18 : 0.38, life:1, type: isRecruit?'recruit':'explore', quality: amt}); ant.lastPhero=time; }
    let _guarda = dist(ant,tgt)<14;
    // Una obrera que lleva media jornada dando vueltas DENTRO del nido no esta perdida: esta en un
    // rincon sin galeria hasta el punto exacto de los tarros. La miel se guarda ahi mismo - lo que
    // importa es que entre en el nido, no que acierte con la celda - y ella vuelve libre a por mas.
    if(!_guarda && ant.y > SURFACE_Y+CELL && (time-(ant._cargaDesde||-1e9)) > DAY_LENGTH*0.22){
      // LA DESPENSA NO PUEDE SER UN PUNTO DEL AIRE. Antes valia el sitio donde una obrera hubiera soltado la
      // carga, aunque fuera un tunel de una celda: los botes quedaban flotando y al dia siguiente no habia nada
      // dibujado, porque la camara no tenia ni suelo donde apoyar los cuadros. Se funda donde hay piso y al
      // menos cinco celdas abiertas alrededor; si no, se busca la camara mas grande; y si tampoco la hay, se
      // deja donde estaba - no se muda el almacen a la nada.
      const _fc=Math.round(ant.x/CELL), _fr=Math.round(ant.y/CELL);
      let _abiertas=0;
      for(let r=_fr-1;r<=_fr+1;r++) for(let c=_fc-2;c<=_fc+2;c++){
        if(r<SURFACE_ROW||r>=ROWS||c<0||c>=COLS) continue;
        if(soil[r] && soil[r][c]===0) _abiertas++;
      }
      const _piso = !!((soil[_fr+1] && soil[_fr+1][_fc]!==0));
      if(_abiertas>=5 && _piso){ pantryPos={x:_fc*CELL+8, y:_fr*CELL+8}; }
      else {
        const _big=findLargestChamber();
        if(_big) pantryPos={x:Math.round(_big.x/CELL)*CELL+8, y:Math.round(_big.y/CELL)*CELL+8};
      }
      _guarda=true;
      if(Math.random()<0.5) pushToast(ant.x, ant.y-14, '\u{1F360} aquí', '#ffcc00', 1.1);
    }
    if(_guarda){
      const amt=ant.food.amount;
      // EL HUERTO SE APRENDE CARGANDO, NO PULSANDO. Cada vez que una obrera guarda una seta o una semilla
      // apunta el suelo que pisa en ese momento: el sitio por donde ya pasa la comida es donde el hongo prende
      // solo, y ese es el que ella misma elige con su trabajo. El boton del jugador sigue valiendo, pero ya
      // no es el unico camino (antes, sin el click, la colonia solo huertea por un dado de 0,0016/tick junto
      // a la camara de la cria, amonton los jardines en un rincon y el resto del nido se quedaba sin cosecha).
      _votaHuerto(ant.x, ant.y, (ant.food.type==='mushroom'||ant.food.type==='seed'||ant.food.type==='berry') ? 2 : 1);
      ant.food=null; ant.targetFood=null; ant.deliveries++; deliveries++; economyLedger.creditFood(amt,'worker delivery');
      // trofalaxia: la forrajera llena su buche y comparte luego
      ant.crop=Math.min(ant.cropMax||1.6, (ant.crop||0)+ amt*0.38);
      const xpGain=amt*14+7; stats.xp+=xpGain; // -40% XP, lleva tiempo
      pushEvent('food',`${ant.id} entrega x${amt} → despensa (total ${economyLedger.food})`, `GIRO ${(steer ?? 0).toFixed(2)} - TINTA [${(comm1 ?? 0).toFixed(1)},${(comm2 ?? 0).toFixed(1)}]`);
      logAntHistory(ant, `entregó ${amt} miel`); ant.mood.joy=Math.min(1, ant.mood.joy+0.12);
      pushToast(tgt.x,tgt.y-18,`+${amt} 🍯`,'#ffcc00',1.8);
      setNarration(`<b>${ant.id} entregó ${amt} 🍯</b> - despensa <b>${economyLedger.food}</b>.`);
      colonyFitness+=1.0; ant.fitness+=1.0;
      ant.fatigue=Math.max(0,ant.fatigue-14);
      // Topo: la superficie se reabastece segun el tamano de la colonia, no con un fijo de 3: con
      // 6-8 obreras y 3 gotas en el mapa, las entregas no daban para mantener la despensa sobre el
      // umbral de puesta (3) y la cria se cortaba justo cuando empezaba a andar.
      if(foods.length < Math.max(3, Math.round(workers.length*0.8)) && Math.random()<0.9) spawnFoodSurface(CENTER_COL*CELL+8 + (Math.random()-0.5)*220,1+Math.floor(Math.random()*2));
      for(let i=0;i<9;i++) particles.push({x:tgt.x,y:tgt.y,vx:(Math.random()-0.5)*3,vy:-Math.random()*2,life:1,decay:0.025,color:'#ffcc00'});
      ant.blocked=0; checkLevelUp();
    }
    return;
  }
  if(ant.targetFood && !foods.includes(ant.targetFood)) ant.targetFood=null;
  // EXCURSION (Topo: «las hormigas tienen que ser aventureras, no se si es su personalidad actual»). Subir al
  // prado no puede depender solo del hambre: medido con la colonia a 27 obreras y 197 raciones en el
  // almacen, `enSuperficie 0 de 27` y 19 gotas de miel tiradas por el cesped - una colonia que come bien ya
  // no explora nunca, se queda abajo y deja el techo lleno de migajas. Las ganas las pone el rasgo EXPL
  // (18..100) y el oficio; un cupo de una de cada cuatro evita dejar el nido vacio.
  if(!ant.isQueen && !ant.food && !ant.targetFood && !ant.digTarget && !ant.wasteTarget
     && economyLedger.food > 4 && (ant._excursionHasta||0) < time
     // ...y es una salida de ADULTA, no de fundadora: con la colonia corta de manos o la hormiga cansada, la
     // excursion cuesta la colonia entera (medido: la semilla 2 se apagaba al dia 4 con 8 obreras despues de
     // mandarla a una gota a 200 px, cuando antes llegaba al dia 21). Solo sale la que sobra, la que esta
     // fresca, y hasta una gota que se pueda traer en un rato.
     && workers.length >= 10 && ant.fatigue < 42 && (ant.age||0) > DAY_LENGTH*0.35){
    let _fuera = 0;
    for(const _w of workers){ if(_w._excursion && dist(_w, storagePos()) > CELL*6) _fuera++; }
    const _cupo = Math.max(1, Math.floor(workers.length/4));
    const _ganas = (ant.traits && ant.traits.exploracion ? ant.traits.exploracion : 40)
                 + (ant.affinity==='EXPLORADORA'? 25:0) + (colonyIQ>140? 10:0);
    if(_fuera < _cupo && _ganas >= 70){
      let _fx=null, _fd=Infinity;
      for(const _x of foods){ const _dd=dist(ant,_x); if(_dd<_fd){ _fd=_dd; _fx=_x; } }
      if(_fx && _fd > CELL*22) _fx=null;   // demasiado lejos para un paseo: que la recoja otra u otro dia
      if(_fx){
        ant.targetFood=_fx; ant._excursion=true; ant._excursionHasta = time + DAY_LENGTH*0.9;
        if(Math.random()<0.22) pushToast(ant.x, ant.y-12, '\u{1F9ED}', '#8fbf5f', 1.3);
      } else ant._excursionHasta = time + DAY_LENGTH*0.3;   // no hay nada arriba: lo intenta mas tarde
    }
  }
  if(ant._excursion && !ant.targetFood && dist(ant, storagePos()) < 24) ant._excursion=false;
  // Topo: despensa vacia = hay que salir a por miel, aunque el manjar este fuera del radio de los
  // sensores (90px). Las fundadoras no tienen rol RECOLECTORA hasta que la colonia evoluciona, asi
  // que sin este impulso se quedaban en el tunel y la colonia nunca juntaba los 3 de la despensa
  // que pide la puesta. Es hambre, no especializacion: lo dispara solo con la despensa baja.
  // HAMBRUNA: con la despensa por debajo de lo que la cria necesita, la media colonia «que cava» ya
  // no vale. Medido en 3 semillas de 20 dias: dos se apagaron al dia 11-12 con 5-10 gotas de miel a la
  // vista y la otra llego a 55 obreras - la diferencia era si la colonia juntaba comida a tiempo. Si
  // aprieta el hambre, TODAS salen y el enfriamiento no existe; mientras haya colchon se mantiene la
  // regla de media colonia para que el hormiguero siga creciendo.
  const _aprieto = economyLedger.food < 1.5;
  const _pocaComida = economyLedger.food <= 5; // T1: al tocar el suelo, se come antes de abrir otro frente
  // Five rations remain untouchable, but once GEN1 has six workers the colony can spare exactly one
  // fresh worker to keep the founding shaft alive. Digging spends no food; everyone else keeps the
  // forage assignment. Without this relief all workers could hold the same distant food target while
  // the shaft stayed abandoned forever at the protected floor.
  const _obraConReserva=umbralesRotos===0&&gen>=1&&workers.length>=6&&economyLedger.food>=_reservaVital();
  const _pozoReservado=workers.some(w=>w.health>20&&(w.fatigue||0)<88&&!w._magmaRetreat&&w.state!=='DESCANSAR'&&w.state!=='CONTROLAR_AGUA'&&w._pozoPrincipal);
  let _relevoReserva=null;
  if(_obraConReserva&&_pocaComida&&!_pozoReservado){
    let _mejor=Infinity;
    for(const w of workers){
      if(w.health<=35||(w.fatigue||0)>=72||w.food||w.digTarget||w.wasteTarget||w._magmaRetreat||w.state!=='EXPLORAR') continue;
      const _fila=(w.y/CELL)|0, _construccion=w.traits&&w.traits.construccion||0;
      const _coste=(w.fatigue||0)-_fila*1.4-_construccion*0.08;
      if(_coste<_mejor){ _mejor=_coste; _relevoReserva=w; }
    }
    if(_relevoReserva===ant){
      ant.targetFood=null; ant._excursion=false; ant._pozoPrincipal=true; ant.state='EXPLORAR';
    }
  }
  // La cuadrilla profunda se detiene en la reserva, pero no conserva una excursión a la superficie
  // cuando la despensa ya se recuperó: ese doble objetivo dejaba su calada congelada durante días.
  if(ant._pozoPrincipal && ant.targetFood && !ant.food && !_aprieto) ant.targetFood=null;
  // Quien va a por miel con la despensa floja NO se decide por sorteo de nombre: la regla de la paridad
  // del id dejaba a media colonia mirando la miel para siempre, y las que nacian heredaban el «no» de su
  // estirpe (el dueno lo vio como hormigas que pasan el rato sin hacer nada). Ahora: va todo el que no
  // tiene una calada asignada, y las recolectoras aunque la tengan. La obra no se para - solo la manda
  // la comida, no la rifa.
  const _conTunel = (ant.state==='CAVANDO' && !!ant.digTarget);
  if(!ant.targetFood && !ant.food && (_aprieto || _pocaComida) && (!ant._pozoPrincipal || _aprieto) &&
     (time - (ant._frustrada||-1e9)) >= (_aprieto ? 0 : 900) &&
     (_aprieto || !_conTunel || ant.role==='RECOLECTORA' || ant.affinity==='RECOLECTORA')) {
    // Si todas salen a por miel, nadie cava y el hormiguero no crece (y sin camaras nuevas el tope de
    // poblacion se queda clavado) - eso paso al medirlo: 0 bloques cavados en 75 s de reloj.
    let _f=null,_d=Infinity; for(const _x of foods){ const _dd=dist(ant,_x); if(_dd<_d){_d=_dd;_f=_x;} }
    if(_f && (_aprieto || _d<640)) ant.targetFood=_f;   // con hambre no hay distancia larga
  }
  if(!ant.targetFood){
    let nf=null, bd=Infinity;
    for(let f of foods){const d=dist(ant,f); if(d<90 && d<bd){bd=d;nf=f;}}
    // La integrante del pozo no abandona una obra profunda por una migaja que pase cerca; conserva
    // el turno hasta la losa. Sólo una crisis real la moviliza: al tocar la reserva espera mientras
    // las recolectoras reponen, en vez de emprender desde el fondo un viaje que congela ambos trabajos.
    if(nf && (!ant._pozoPrincipal || _aprieto)) ant.targetFood=nf;
    else{
      const wallAvg=(ant.sensors.wallLeft+ant.sensors.wallCenter+ant.sensors.wallRight)/3;
      const _frustrada = (time - (ant._frustrada||-1e9)) < 900; // viene de estrellarse: que abra paso
      // y con la despensa a cero no se abre galeria nueva: primero se come, despues se excava
      // y con la despensa floja no se abre calada NUEVA por gusto: solo para salir de un atasco, o si
      // la colonia ya tiene de qué comer (primero se come, despues se excava)
      // Reflejo colectivo minimo: si la despensa aguanta y no hay ningun frente activo, la obrera
      // libre con mayor rasgo de construccion abre uno. La red sigue decidiendo las demas excavadoras.
      // Esto evita que un linaje viable se quede en cero por heredar todas una salida «cavar» baja.
      let _constructoraTurno=null;
      const _hayFrenteActivo=workers.some(w=>w.health>0 && w.state==='CAVANDO' && w.digTarget);
      const _hayFrentePozo=workers.some(w=>w.health>0&&(w.fatigue||0)<88&&!w._magmaRetreat&&w.state==='CAVANDO'&&w.digTarget&&w._pozoPrincipal);
      const _primerUmbralPendiente=umbralesRotos===0;
      const _puedePozo=_primerUmbralPendiente && (gen>=1 || day>=3);
      // An exhausted/flood-fighting pioneer keeps her history marker but no longer monopolises the
      // shaft. A fresh worker may take over, so one tired founder cannot stall T4 for the whole colony.
      const _cuadrillaPozo=_primerUmbralPendiente ? workers.find(w=>w.health>0&&(w.fatigue||0)<88&&!w._magmaRetreat&&w.state!=='DESCANSAR'&&w.state!=='CONTROLAR_AGUA'&&w._pozoPrincipal) : null;
      if((!_pocaComida||_obraConReserva) && (!_hayFrenteActivo || (_puedePozo && !_hayFrentePozo))){
        // Si ya hay una integrante de la cuadrilla y está libre, conserva ella el relevo: normalmente
        // sigue junto al último bloque abierto y no tiene que atravesar de nuevo todo el hormiguero.
        if(_cuadrillaPozo && !_cuadrillaPozo.food && !_cuadrillaPozo.targetFood && !_cuadrillaPozo.digTarget &&
           !_cuadrillaPozo.wasteTarget && _cuadrillaPozo.state!=='DESCANSAR') _constructoraTurno=_cuadrillaPozo;
        if(!_constructoraTurno) for(const w of workers){
          if(w.health<=0 || w.food || w.targetFood || w.digTarget || w.wasteTarget || w.state==='DESCANSAR') continue;
          if(!_constructoraTurno || (w.traits&&w.traits.construccion||0) > (_constructoraTurno.traits&&_constructoraTurno.traits.construccion||0)) _constructoraTurno=w;
        }
      }
      const _instintoObra = _constructoraTurno===ant;
      const _pozoPuedeCavar = !ant._pozoPrincipal || (_instintoObra && _puedePozo && (!_pocaComida||_obraConReserva));
      // Al llegar juntas al umbral, las constructoras reconocen la obra común sin volver a sortear
      // su impulso neuronal. Así se forma un frente visible antes del primer mordisco, no una obrera
      // solitaria que por azar toca la losa mientras las demás pasean por la misma galería.
      const _juntoAlUmbral=!!(umbral && puedeGolpearUmbral() && Math.abs(((ant.y/CELL)|0)-umbral.r)<=1);
      if(_pozoPuedeCavar && !_aprieto && (_juntoAlUmbral || _frustrada || _instintoObra || (!_pocaComida && digIntent>0.48 && wallAvg>0.18 && Math.random()<0.11 && (ant.role==='EXCAVADORA' || Math.random()<0.38)))){
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
            if(!puedeAbrirSuperficie(_f.c, _f.r)) continue; // cesped blindado: no es un frente valido
            const _d=Math.hypot((_f.c+0.5)*CELL-ant.x,(_f.r+0.5)*CELL-ant.y) - (_f.r-SURFACE_ROW)*1.35;   // EL POZO TIRA: a igualdad de pasos, gana el frente mas hondo
            if(_d<90){ if(!_cands) _cands=[]; _cands.push(_f); }
            else if(_d<_bestD){ _bestD=_d; _far=_f; }
          }
          let pick=_cands&&_cands.length ? _cands[(Math.random()*_cands.length)|0] : (_far || frontier[(Math.random()*_fn)|0]);
          // FRENTE PRINCIPAL: la excavadora de reserva mantiene un pozo dentro de las tres columnas de la
          // boca hasta romper la primera losa. El resto conserva sus frentes y camaras laterales.
          if(_instintoObra && _puedePozo && umbral && (!_cuadrillaPozo || _cuadrillaPozo===ant)){
            let _frentePozo=null, _fd=Infinity;
            for(let _pc=CENTER_COL-1;_pc<=CENTER_COL+1;_pc++){
              for(let _pr=umbral.r;_pr>SURFACE_ROW;_pr--){
                if(!soil[_pr] || soil[_pr][_pc]!==1 || !soil[_pr-1] || soil[_pr-1][_pc]!==0) continue;
                const _pt=soilType[_pr]&&soilType[_pr][_pc];
                if(_pt===15 || (_pt===7 && (gen<8 || !inventions.masonry))) continue;
                if(_pt===17 && !puedeGolpearUmbral()) continue;
                const _candidatoPozo={r:_pr,c:_pc};
                const _cercaPozo=Math.hypot((_pc+0.5)*CELL-ant.x,(_pr+0.5)*CELL-ant.y);
                // «Aire encima» no significa «conectado»: una cámara aislada puede quedar justo sobre
                // el bloque más hondo. La cuadrilla sólo adopta un frente al que llega por sus galerías.
                if(_cercaPozo>CELL*2.2 && !routeStepToDig(ant,_candidatoPozo)) continue;
                const _pd=Math.abs((_pc+0.5)*CELL-ant.x);
                if(!_frentePozo || _pr>_frentePozo.r || (_pr===_frentePozo.r && _pd<_fd)){
                  _frentePozo=_candidatoPozo; _fd=_pd;
                }
                break;
              }
            }
            if(_frentePozo){ pick=_frentePozo; ant._pozoPrincipal=true; }
          } else if(ant!==_cuadrillaPozo || !_primerUmbralPendiente) ant._pozoPrincipal=false;
          // Las obras del umbral: si la losa esta a tiro y la colonia ya puede morderla, parte de las
          // excavadoras dejan el frente y van a ella. Sin esto el avance depende de que el azar ponga
          // una hormiga encima de la losa, y eso no es una decision de la colonia, es una ruleta.
          const _yaEnUmbral=umbral?workers.filter(w=>w.digTarget&&w.digTarget.r===umbral.r&&soilType[umbral.r]&&soilType[umbral.r][w.digTarget.c]===17).length:0;
          const _cupoUmbral=Math.min(8,Math.max(4,Math.floor(workers.length*0.24)));
          if(umbral && _yaEnUmbral<_cupoUmbral && puedeGolpearUmbral() && (ant.role==='EXCAVADORA'||(ant.traits&&ant.traits.construccion>52)) && (_juntoAlUmbral||Math.random()<0.5)){
            // para morder la losa hay que tener donde pararse: una casilla de aire justo encima. Se busca la
            // columna con hueco MAS CERCANA a la hormiga (antes se usaba la columna de la propia hormiga y,
            // si ahi arriba aun no habian cavado, la obra de la losa no empezaba nunca).
            const _cAnt=Math.max(umbral.c0, Math.min(umbral.c1, Math.round(ant.x/CELL)));
            let _cLos=-1, _cd=1e9;
            for(let off=0; off<=COLS; off++){
              for(const sgn of (off===0?[0]:[-1,1])){
                const cc=_cAnt+sgn*off;
                if(cc<umbral.c0||cc>umbral.c1) continue;
                if(!soil[umbral.r]||soil[umbral.r][cc]!==1||!soilType[umbral.r]||soilType[umbral.r][cc]!==17) continue;
                if(!soil[umbral.r-1]||soil[umbral.r-1][cc]!==0) continue;              // sin hueco encima, no hay obra
                const d=Math.abs(cc-_cAnt);
                if(d<_cd){ _cd=d; _cLos=cc; }
                break;
              }
              if(_cLos>=0) break;
            }
            // solo se les encarga la losa a las que YA estan al lado: una obrera en la fila 21 no puede
            // bajar volando a la 27, y darle el objetivo lejos era ponerla a rebotar contra la pared
            // (blocked subiendo y cero picoteos). Bajar hasta la losa lo hace el sesgo de profundidad del
            // frente, que es el mecanismo normal de la colonia.
            if(_cLos>=0 && Math.abs(((ant.y/CELL)|0) - umbral.r)<=1) pick={r:umbral.r, c:_cLos};
          }
          // The slab is also part of the generic frontier. Once the visible crew is full, reject a
          // random frontier pick that happens to land on it; otherwise the generic path bypasses the
          // recruitment cap and drafts nearly every nearby worker.
          if(pick&&soilType[pick.r]&&soilType[pick.r][pick.c]===17){
            const onSlabNow=workers.filter(w=>w.digTarget&&w.digTarget.r===pick.r&&soilType[pick.r][w.digTarget.c]===17).length;
            if(onSlabNow>=_cupoUmbral) pick=null;
          }
          if(pick){
          // cavado más rápido si es excavadora, tiene rasgo alto o colonia evolucionada
          const bonus = (ant.role==='EXCAVADORA'? 8:0) + Math.floor(ant.traits.construccion/18) + Math.floor(colonyIQ/45) + Math.min(6, gen);
          ant.digTarget=pick; ant.digProgress=0;
          const _type=soilType[pick.r]&&soilType[pick.r][pick.c]; const _hard = durezaDe(_type); // la tabla vive en BANDAS/DUREZA_EXTRA: bedrock 38, magma 999, y cada banda lo suyo
          if(_type===17){
            const lead=workers.find(w=>w!==ant&&w._umbralLead&&w.digTarget&&w.digTarget.r===pick.r);
            if(lead){ ant._umbralSupport=true; delete ant._umbralLead; }
            else { ant._umbralLead=true; delete ant._umbralSupport; }
            ant._obraUmbralHasta=time+DAY_LENGTH*0.12; ant._pozoPrincipal=true;
          }
          // LEY REAL: piedra necesita herramienta/poder. Sin pico, 3x más lento y con chance de fallar
          const _np={4:1.2, 6:2.2, 8:1.9, 9:2.6, 10:3.0, 7:3.5, 11:2.8, 12:3.2, 13:3.6, 14:3.9, 16:3.1, 18:2.0};
          const needPower = _np[_type]||0;
          const hasPower = (ant.tool==='pick' || (colonyIQ>124 && gen>=3) || inventions.stone) ? 1.0 : 0.55;
          const hardMult = needPower>0 && hasPower<0.9 ? (1.6 + needPower*0.8) : 1;
          // La LOSA (17) no se cava: se muerde. digNeeded corto a proposito, para que la obrera vuelva
          // una y otra vez al mismo sitio y el umbral baje entre todas - que es lo que da la sensacion de
          // haza colectiva, no de un numero que sube solo. Magma (15) y roca madre (7) siguen cerrados.
          ant.digNeeded= _type===17 ? Math.max(5, 11 - Math.min(6,gen*0.5))
                       : (_type===15 || (_type===7 && (gen<8 || colonyIQ<148 || !inventions.masonry)))? 999
                       : Math.max(9, Math.floor((26 - bonus + _hard)*hardMult)/(1+bonusCava)); ant.state='CAVANDO';
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
    // Topo: una forrajera que lleva cien pasos golpeandose contra la galeria no va a llegar
    // andando. Suelta el bocado y se pone a cavar. Medido en la partida real: 6 hormigas paradas
    // con 830-2536 pasos bloqueados, cero bloques cavados, cero entregas, despensa clavada en 2.2
    // y la reina sin poner - o sea, que no nacia nadie. Una obrera atascada que cava destruye el
    // atasco; una que se queda quieta hunde la colonia.
    if(ant.blocked>70){
      ant.blocked=0; ant._frustrada=time;
      // El comentario de arriba prometa «se pone a cavar» y el codigo solo soltaba el bocado: la obrera
      // se quedaba dando vueltas junto a la miel y la colonia entera se morria de hambre con 8-10 gotas
      // a la vista (medido: despena clavada en 0,5 y miel 8 en el mapa, dia 12, extincion). Ahora cava la
      // pared que la separa; si no hay pared que cavar (la gota esta en terreno duro) si que abandona.
      const _tR = Math.floor(targ.y/CELL), _tC = Math.floor(targ.x/CELL);
      const _yoR = Math.floor(ant.y/CELL), _yoC = Math.floor(ant.x/CELL);
      let _abrir = null, _bestD = 1e9;
      for(let dr=-1; dr<=1; dr++) for(let dc=-1; dc<=1; dc++){
        const r=_yoR+dr, c=_yoC+dc;
        if(r<0||c<0||r>=ROWS||c>=COLS) continue;
        if(soil[r][c]!==1) continue;                              // solo tierra suelta, no roca ni vacio
        if(soilType[r] && (soilType[r][c]===7 || soilType[r][c]===15 || soilType[r][c]===17)) continue;   // bedrock, magma y la losa no se cavan para abrir paso
        if(r <= SURFACE_ROW) continue;                         // no abrir el cielo por arriba
        const d = Math.hypot((c-_tC)*CELL, (r-_tR)*CELL) - (dr*0.6+dc*0.2);
        if(d < _bestD){ _bestD=d; _abrir={r, c}; }
      }
      if(_abrir && _bestD < CELL*6){ ant.digTarget=_abrir; ant.digProgress=0; ant.state='CAVANDO'; }
      else ant.targetFood=null;
    }
    // Topo: el regreso a la despensa ya tenia punto de paso por la boca del tunel; la SALIDA a por
    // miel no. En un tunel de 3 celdas, apuntar en linea recta al bocado se clava contra la pared y
    // a los 36 pasos bloqueados la hormiga abandonaba el objetivo: las entregas se paraban en cuanto
    // la colonia bajaba al nido, la despensa no se reponia y la reina dejaba de poner. Mismo truco
    // en los dos sentidos: primero la boca, luego la miel.
    const _centroBoca=CENTER_COL*CELL+8;
    // Se corona por el labio del mismo lado que la comida, no por el centro del pozo: en un hueco de
    // tres celdas el centro queda lejos de ambas paredes y la trepadora pierde el agarre. Cambia de lado
    // abajo, donde sí puede caminar, y sube después pegada a esa pared.
    const _boca={x:_centroBoca+(targ.x<_centroBoca?-CELL:CELL), y:SURFACE_Y-6};
    // Para cruzar de dentro a fuera no hay atajo: pie del pozo → labio elegido → miel. Si viene de una
    // galería más profunda vuelve primero al pie conocido (la boca inicial acaba en SURFACE_ROW+8).
    const _cruzaBoca=((targ.y<SURFACE_Y)!==(ant.y<SURFACE_Y-5));
    let _meta=targ;
    if(_cruzaBoca){
      const _pieY=(SURFACE_ROW+8)*CELL+8;
      if(ant.y>_pieY+CELL*0.6) _meta={x:_boca.x,y:_pieY};
      else if(Math.abs(ant.x-_boca.x)>CELL*0.45){
        const _fila=Math.max(SURFACE_ROW+1,Math.min(SURFACE_ROW+8,Math.floor(ant.y/CELL)));
        _meta={x:_boca.x,y:_fila*CELL+8};
      } else _meta=_boca;
    }
    // para la fisica del pozo: mi destino esta por encima de mi? (sin esto no sabe trepar hacia arriba en la ida)
    ant._quiereSubir=(targ.y<ant.y-4);
    if(_cruzaBoca || ant.blocked>10 || umbralesRotos>0){ const _rs=routeStep(ant,_meta.x,_meta.y); if(_rs) _meta=_rs; }
    const ang=Math.atan2(_meta.y-ant.y,_meta.x-ant.x);
    let diff=((ang-ant.angle+Math.PI*3)%(Math.PI*2)-Math.PI);
    // La red decide ir a por la comida; una vez comprometida, el camino transitable manda sobre el giro
    // exploratorio. Mezclarlos hacía que linajes con steer≈±1 caminaran en círculos sin salir nunca.
    const _aire=ant.y<SURFACE_Y+14 && targ.y<SURFACE_Y+14;
    ant.angle+=diff*(_aire?0.45:0.32);
    if(!_aire){
      if(ant.sensors.wallLeft>0.7) ant.angle+=0.18;
      if(ant.sensors.wallRight>0.7) ant.angle-=0.18;
    }
    const nx=ant.x+Math.cos(ant.angle)*speed, ny=ant.y+Math.sin(ant.angle)*speed;
    if(canAntMove(ant,nx,ny)){ant.x=nx;ant.y=ny;ant.blocked=0;}else{
      if(canAntMove(ant,ant.x+Math.cos(ant.angle)*speed, ant.y)) ant.x+=Math.cos(ant.angle)*speed*0.45;
      else if(canAntMove(ant,ant.x, ant.y+Math.sin(ant.angle)*speed)) ant.y+=Math.sin(ant.angle)*speed*0.45;
      else {ant.blocked++; ant.angle+=(Math.random()-0.5)*1.0; if(ant.blocked>36 && ant.y<SURFACE_Y+10) ant.targetFood=null;}
    }
    if(dist(ant,targ)< (targ.r? targ.r+14:16)){
      const idx=foods.indexOf(targ);
      if(idx>=0){
        const cap=2+(ant.role==='RECOLECTORA'?1:0)+(ant.tool==='basket'?1:0);
        const take=Math.min(cap, targ.amount);
        if(targ.amount>take) targ.amount-=take; else {foods.splice(idx,1);}
        ant.food={amount:take}; ant.targetFood=null; ant.blocked=0; colonyFitness+=0.35; ant._cargaDesde=time;
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
    if(canAntMove(ant,nx,ny)){ant.x=nx;ant.y=ny;ant.blocked=0;}else{ant.angle+=(Math.random()-0.5)*1.2; ant.blocked++; if(ant.blocked>26) ant.angle+=Math.PI*0.5;}
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
function paintCacheCell(c,r,isMini){
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
      // El CREMA se acab6 (era '#fff1c8' y parpadeaba cuando el cuadro caia en la ruta vieja): el hueco
      // lo pinta el mismo ayudante que usa la cache y el minimapa, asi que no hay dos versiones que ver.
      pintarHuecoVoxel(soilCacheCtx,c,r,true);
    }
}

// --- repintado incremental: lo usa CUALQUIER pintor que este en pie (procedural o atlas) ---
// paintCellActive cambia cuando el override del atlas entra en juego; asi el atajo no depende de
// que version de rebuildSoilCache sea la ultima definida (antes pasaba que el override se comia
// el repintado por celdas y cada calada volvia a costar un mapa entero).
let paintCellActive=null, _soilSeason=0, _soilWet=false, _soilNieve=false, _soilIncWarned=0, _voxMini=false;
function soilIncrementalReady(isMini){
  return !isMini && !!paintCellActive && !!soilDirtyCells && soilDirtyCells!==false
    && soilDirtyCells.size>0 && soilDirtyCells.size*6 < COLS*(ROWS-SURFACE_ROW);
}
function soilRepaintDirtyCells(){
  // Topo: se repinta el lote, no el mapa. Geometria delicada: cada azulejo del atlas se dibuja con
  // 1 px de sangre sobre la vecina (x-1 .. CELL+2), y en un rebuild completo la sangre de la celda
  // de la derecha es la que gana en el borde. Para que el resultado sea pixel a pixel el mismo:
  //   - se pinta en orden de fila, como el mapa completo;
  //   - se pinta UNA celda de holgura alrededor del lote (es la que gana en los bordes del lote);
  //   - se recorta a 1 px mas alla del lote: la sangre de la celda de holgura no puede manchar
  //     lo que le pertenece a la siguiente, que no esta en juego.
  const cells=[...soilDirtyCells];
  let minC=COLS,minR=ROWS,maxC=-1,maxR=-1;
  for(const key of cells){
    const q=key.split(','), c=+q[0], r=+q[1];
    if(r<SURFACE_ROW||r>=ROWS||c<0||c>=COLS) continue;
    if(c<minC)minC=c; if(c>maxC)maxC=c; if(r<minR)minR=r; if(r>maxR)maxR=r;
  }
  if(maxC<0){ soilDirtyCells=null; soilCacheDirty=false; return []; }
  const g=soilCacheCtx;
  const pc0=Math.max(0,minC-1), pc1=Math.min(COLS-1,maxC+1);
  const pr0=Math.max(SURFACE_ROW,minR-1), pr1=Math.min(ROWS-1,maxR+1);
  g.save();
  g.beginPath();
  g.rect(minC*CELL-1, minR*CELL-1, (maxC-minC+1)*CELL+2, (maxR-minR+1)*CELL+2);
  g.clip();
  for(let r=pr0;r<=pr1;r++) for(let c=pc0;c<=pc1;c++) paintCellActive(c,r);
  g.restore();
  const n=(pc1-pc0+1)*(pr1-pr0+1);
  soilDirtyCells=null; soilCacheDirty=false; _soilRepaints++; _soilCellRepaints+=n;
  return cells;
}
function soilRepaintMoundsOver(cells){
  // los monticulos y charcos se dibujan ENCIMA del cache: si alguna celda tocada llevaba uno,
  // hay que volver a ponerlo o desaparecería al cavar al lado
  if(!cells || !cells.length || !mound || !mound.length) return;
  const touched=new Set(cells);
  for(const m of mound){
    const mc=Math.floor(m.x/CELL), mr=Math.floor(m.y/CELL);
    let toca=false;
    for(let dc=-1;dc<=1 && !toca;dc++) for(let dr=-1;dr<=1 && !toca;dr++) toca=touched.has((mc+dc)+','+(mr+dr));
    if(toca) soilDrawMoundTile(m);
  }
}
function soilDrawMoundTile(m){
  // monticulo y charco como voxel bajo: un ladron de tierra apoyado en el suelo, con su cara de arriba clara.
  // (Estaban definidas DOS veces esta funcion, la copia antigua sobraba.)
  try{
    const mx=Math.floor(m.x/16)*16, my=Math.floor(m.y/16)*16;
    if(m.isPuddle){
      soilCacheCtx.fillStyle='#3b5f86'; soilCacheCtx.fillRect(mx+1,my+10,14,4);
      soilCacheCtx.fillStyle='#6f9dc4'; soilCacheCtx.fillRect(mx+2,my+10,12,1);
    } else {
      soilCacheCtx.fillStyle='#6b4520'; soilCacheCtx.fillRect(mx+2,my+8,12,7);
      soilCacheCtx.fillStyle='#a2763c'; soilCacheCtx.fillRect(mx+3,my+8,10,2);
      soilCacheCtx.fillStyle='#3f2610'; soilCacheCtx.fillRect(mx+13,my+10,1,5);
    }
  }catch(e){}
}
function rebuildSoilCache(isMini){
  if(!soilCacheCtx) return;
  isMini = isMini===true;
  // Topo: repintado incremental. Cavar un bloque no puede costar un mapa entero: si lo que
  // cambio es una parte pequena del nido, se repintan solo esas celdas y sus vecinas (los muros
  // de tunel se dibujan segun lo que tienen alrededor). Si el cambio es estructural (nacer el
  // mundo, cargar partida, cambiar de piel) se pinta todo, como siempre.
  paintCellActive = function(c,r){ paintCacheCell(c,r,isMini); };
  if(soilIncrementalReady(isMini)){
    try{
      const cells=soilRepaintDirtyCells();
      if(!isMini) soilRepaintMoundsOver(cells);
      return;
    }catch(e){ /* si algo huele mal, se pinta el mapa entero: nunca un cache a medias */
      if(DEBUG_TOPO) console.warn('[SOIL] repintado incremental fallido, pintando todo:', e.message);
      soilDirtyCells=null;
    }
  }
  soilCacheCtx.clearRect(0,0,W,H);
  let _sawWater=false;
  for(let r=SURFACE_ROW;r<ROWS;r++) for(let c=0;c<COLS;c++){ paintCacheCell(c,r,isMini); if(water&&water[r]&&water[r][c]>0.0001) _sawWater=true; }
  if(!isMini) _waterActive=_sawWater;
  // el lote pendiente del cache principal NO se lo come una pasada mini (mini pinta el mismo
  // lienzo sin microdetalles; si consumiera la lista, la siguiente calada no se repintaria)
  if(!isMini){ soilCacheDirty=false; soilDirtyCells=null; }
  _soilRepaints++; _soilFullRepaints++;
}
// === TEXTURAS DEFINITIVAS 01 - SUPERFICIES ATLAS ===
const texSuperficies = new Image();
// TILES VOXEL (Topo: «simplifica los gráficos, que sean voxels simples con ligeras diferencias entre
// cada uno»): el suelo ya NO es un atlas reescalado. Se pinta a mano, cara a cara, asi que no se pide nada.
// El PNG sigue en disco por si se quiere volver atras, pero no se descarga.
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
// CIELO: se retiran las dos imagenes (categoria_05_cielos_completo.png y cielo_brote_4climas.png). Se
// pedian al disco, se pintaban encima del degradado con desplazamiento de viento y salian costuras. El
// cielo de ahora esta codificado (ver drawFarm), asi que ni siquiera se descargan.
const texCielos = new Image(); let texCielosReady=false;
const texBrote = new Image(); let texBroteReady=false;
const texSurfaceFull = new Image(); let texSurfaceFullReady=false;   // no se pide: la capa de pasto va dibujada
const texPisos = new Image();
let texPisosReady=false;

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
// Tabla de materiales del voxel. Cada uno lleva su color base y una forma distinta de enselear la diferencia:
// la tierra con piedritas, la arcilla en mantas, la arena con granos, la piedra y la pizarra con una grieta,
// la roca madre sin nada (es maciza) y los metales con dos o tres puntos del tono del metal, que es como se
// anuncia una veta a 16 px sin que se confunda con el tunel de al lado.
const _VOX = {
  1:{col:'#8a5a2b', pinta:'piedras'},   2:{col:'#b0673f', pinta:'mantas'},
  3:{col:'#d3b473', pinta:'granos'},    4:{col:'#8d8d8d', pinta:'grieta'},
  5:{col:'#94887a', pinta:'grieta'},     6:{col:'#6b7a8a', pinta:'grietaLarga'},
  7:{col:'#3a3a44', pinta:'ninguna'},
  8:{col:'#8d8d8d', pinta:'veta', punto:'#e0884a'},
  9:{col:'#847f86', pinta:'veta', punto:'#d7dce8'},
  10:{col:'#8d8d8d', pinta:'veta', punto:'#f0cf5e'},
  // y lo que hay por debajo, que es la razon de cavar:
  11:{col:'#c9c2d8', pinta:'veta', punto:'#f4f0ff'},   // cuarcita: clara, chispeante
  12:{col:'#4a4552', pinta:'veta', punto:'#c8a6ff'},   // marmol negro con veta de gemas
  13:{col:'#241f2e', pinta:'brillo'},                    // obsidiana
  14:{col:'#4a2a20', pinta:'grietaLarga'},               // basalto
  15:{col:'#ff6a1e', pinta:'lumbre'},                     // MAGMA (no se cava)
  16:{col:'#8d8d8d', pinta:'veta', punto:'#7ad3ff'},     // veta de gemas
  17:{col:'#2b2b33', pinta:'cincel'},                     // LA LOSA DEL UMBRAL
  18:{col:'#dfe8ee', pinta:'granos'}                       // sal de roca
};
// El pasto cambia con la estacion y con la humedad, como antes, pero son 4 px de color: nada de losas
// reescaladas que salian con costuras entre celda y celda.
const _HIERBA = ['#5aa02c','#7ec23a','#b07a2a','#e9f2fb'];
const _HIERBA_SECA = '#a8a02c';
// ─────────── EL SELLO DE LA CASA ───────────
// Topo pidio «voxel graphics and technology sencilla»: todo lo dibujado a mano sale por aqui. Un rectangulo
// de color con su cara de luz arriba, su sombra abajo, su corte en el lado y su junta de un pixel. El terreno
// ya iba asi; ahora van igual las plantas, la miel, la comida y los objetos, para que el prado y la colmena
// se lean como el mismo mundo de bloques y no como pegatinas de otro dibujante.
function _tilde16(h,dd){
  const n=parseInt(h.slice(1),16);
  const r1=Math.max(0,Math.min(255,(n>>16)+dd)), r2=Math.max(0,Math.min(255,((n>>8)&255)+dd)), r3=Math.max(0,Math.min(255,(n&255)+dd));
  return '#'+((r1<<16)|(r2<<8)|r3).toString(16).padStart(6,'0');
}
function _bloque(g,x,y,w,h,col,k){
  k = (k===undefined)? 1 : k;
  const x0=Math.floor(x), y0=Math.floor(y), w0=Math.max(1,Math.floor(w)), h0=Math.max(1,Math.floor(h));
  g.fillStyle=col; g.fillRect(x0,y0,w0,h0);
  if(h0>=2){ g.fillStyle=_tilde16(col,Math.round(40*k)); g.fillRect(x0,y0,w0,1); g.fillStyle=_tilde16(col,-Math.round(46*k)); g.fillRect(x0,y0+h0-1,w0,1); }
  if(h0>=5 && w0>=2){ g.fillStyle=_tilde16(col,-24); g.fillRect(x0+w0-1,y0+1,1,h0-2); }
  if(w0>=4 && h0>=3){ g.fillStyle='rgba(0,0,0,0.14)'; g.fillRect(x0,y0,1,h0); }
}

// ── LA HORMIGA DE BLOQUES ───────────────────────────────────────────────────
// La hormiga era un PNG de 30x14 pegado encima del mundo: de cerca se le veia el recorte,
// de lejos era una mancha, y las patas -que ya estaban dibujadas a mano- quedaron apagadas
// por un «si el PNG no cargo» que nunca se cumplia. Aqui se pinta con la misma regla que el
// terreno, el sol y las plantas: cara clara arriba, canto derecho a sombra, base oscura y
// junta de 1 px entre segmentos. Gana tres cosas: se lee a cualquier zoom, las patas vuelven
// y el arranque pide cinco imagenes menos. El abdomen es un octogono de bloques (panas de
// 1 px arriba y abajo) porque un rectangulo perfecto parece un ladrillo, no un bicho.
//   s    = tamano del caste (1 = media). Todo se redondea a entero: medio pixel de vaiven no
//          se ve, solo cuesta relleno y saca borde borroso.
//   mini = mapa de bolsillo: silueta de tres bloques y nada mas, que a ese tamano no hay patas.
function _hormigaVoxel(g, ant, s, mini, idx){
  const Q = v => Math.round(v*s);
  const st = ant.state, caste = ant.caste||'media', rol = ant.role||'FORRAJEADORA';
  const cavando = st==='CAVANDO', durmiendo = st==='DESCANSAR';
  const moviendo = !cavando && !durmiendo;
  const i = (((Number.isFinite(+idx)? (+idx|0) : 0) % 7) + 7) % 7;   // el id puede no ser numero: sin esto, NaN y antenas invisibles
  const _wp = ant._walkPhase||0, _bp = ant._bobPhase||0;
  const anthropo = !!useAnthro && !mini;
  let base = ant.isQueen? '#a06a20' : (caste==='major'? '#8f5510' : caste==='minim'? '#c98a2a' : '#b06a10');
  const tinte = rol==='EXCAVADORA'? '#ff3b30' : rol==='EXPLORADORA'? '#00e5ff' : rol==='NODRIZA'? '#b47aff' : '#ffcc00';
  // pose: se agacha al cavar, se hunde al dormir, y al andar el cuerpo sube UN bloque entero
  const bob = (moviendo && Math.sin(_bp*1.0 + i) > 0.55) ? -1 : 0;
  const oy = bob + (durmiendo? 1 : cavando? 1 : 0);
  const _golpe = cavando ? (Math.floor(_bp*1.8 + i) % 2) : 0;   // 0 = levanta, 1 = picazo

  // ── patas ────────────────────────────────────────────────────────────────
  // Tres por lado en trípode: las del otro lado van oscuras y cortas, detras del cuerpo;
  // las de aqui delante son dos cascos (fémur y tibia) y levantan un bloque al pasar.
  const _piernas = (g, cerca)=>{
    for(let n=0; n<3; n++){
      const bx = Q(-3 + n*3.4);
      const fase = _wp*2.6 + n*2.09 + (cerca? 0 : 1.05);
      const swing = Math.sin(fase);
      const levanta = moviendo && swing > 0.42;
      const y0 = Q(3) + oy;
      g.fillStyle = cerca? '#2e1a0a' : '#170c02';
      g.fillRect(bx, y0, 1, 2);
      const rodilla = bx + Math.round(swing*2);
      g.fillRect(rodilla, y0+2 + (levanta?-1:0), 1, durmiendo?1:2);
      if(cerca && !durmiendo){ g.fillStyle='#432204'; g.fillRect(rodilla + (levanta?-1:0), y0+4-(levanta?1:0), 2, 1); }
    }
  };

  if(mini){
    // silueta: abdomen, tórax y cabeza
    _bloque(g, Q(-11), Q(-3)+oy, Q(8), Q(6), base);
    _bloque(g, Q(-3), Q(-2)+oy, Q(5), Q(4), base);
    _bloque(g, Q(2), Q(-3)+oy, Q(5), Q(5), _tilde16(base, 14));
    g.fillStyle=tinte; g.fillRect(Q(-2), Q(-2)+oy, Q(3), 1);
    return;
  }

  if(anthropo){
    // EVOLUCION HUMANOIDE - antes era otro PNG (que ya no existe). Bipedo con su cara clara,
    // sus dos piernas y su capucha segun el estilo que se changea con la tecla.
    const _cabeza = anthroStyle===1? 9 : 7;                                  // chibi: testa grande
    const _brazo = Math.round(Math.sin(_wp*1.6 + i)*2);
    g.fillStyle='#2e1a0a'; g.fillRect(Q(-4), Q(6), 3, 5); g.fillRect(Q(1), Q(6), 3, 5);
    _bloque(g, Q(-6), Q(-4)+oy, Q(12), Q(10), base);
    if(anthroStyle===2){ g.fillStyle='#4a2a6a'; g.fillRect(Q(-7), Q(-9)+oy, Q(14), 4); }
    _bloque(g, Q(-4), Q(-12)+oy, Q(1)+_cabeza, Q(8), _tilde16(base, 14));
    g.fillStyle='#fff8dc'; g.fillRect(Q(-1), Q(-10)+oy, 2, 2);
    g.fillStyle='#1a0a00'; g.fillRect(Q(1), Q(-10)+oy, 1, 2);
    g.fillStyle='#2e1a0a'; g.fillRect(Q(6), Q(-2)+_brazo+oy, 3, 3); g.fillRect(Q(-9), Q(-2)-_brazo+oy, 3, 3);
    g.fillStyle=tinte; g.fillRect(Q(-5), Q(-4)+oy, Q(10), 1);
    if(ant.isQueen){ _bloque(g, Q(-4), Q(-16)+oy, Q(9), Q(4), '#ffcc00'); }
    return;
  }

  _piernas(g, false);                                        // las de atras, tras el cuerpo

  // aguijon + abdomen (octogono de bloques)
  const gx = Q(-15), gy = Q(-5)+oy, gw = Q(11), gh = Q(9);
  _bloque(g, gx, gy, gw, gh, base);
  if(gh>=9){ g.fillStyle=_tilde16(base,26); g.fillRect(gx+1, gy+1, gw-2, 1); }
  g.fillStyle = base;
  g.fillRect(gx+Q(2), gy-1, gw-Q(4), 1);
  g.fillRect(gx+Q(2), gy+gh, gw-Q(4), 1);
  g.fillStyle = _tilde16(base,-46);
  g.fillRect(gx-1, gy+Q(3), 1, Q(3));
  // talle: dos pixeles desnudos, la junta que delata que es un insecto y no una albondiga
  g.fillStyle = _tilde16(base,-74); g.fillRect(Q(-4), Q(-1)+oy, 2, Q(4));
  // torax
  _bloque(g, Q(-2), Q(-4)+oy, Q(8), Q(8), base);
  g.fillStyle = tinte; g.fillRect(Q(-1), Q(-4)+oy, Q(6), 1);  // franja del oficio: ni letrero ni burbuja
  // cabeza: baja cuando pica
  const hy = Q(-3) + oy + (cavando? 1 + _golpe : 0);
  _bloque(g, Q(6), hy, Q(8), Q(7), _tilde16(base, 12));
  // mandibulas: se abren con el golpe y cierran la carga
  const _boca = cavando? (1 - _golpe) : (ant.food? 1 : 0);
  g.fillStyle = '#1a0a00'; g.fillRect(Q(14), hy+Q(2)-_boca, caste==='major'? Q(5):Q(3), 2);
  if(caste==='major'){ g.fillRect(Q(14), hy+Q(4)+_boca, Q(4), 2); }
  // ojo: dos de luz con su pupila; dormida = una raya, sin Z ni letrero
  if(durmiendo){ g.fillStyle='#1a0a00'; g.fillRect(Q(9), hy+Q(2), 3, 1); }
  else { g.fillStyle='#fff8dc'; g.fillRect(Q(9), hy+Q(1), 2, 2); g.fillStyle='#1a0a00'; g.fillRect(Q(10), hy+Q(1), 1, 2); }
  // antenas: nudillo y punta, bailan un bloque entero (no medio)
  const wig = Math.round(Math.sin(_bp*1.5 + i*1.7));
  g.fillStyle = '#2e1a0a';
  g.fillRect(Q(12)+wig, hy-Q(3), 1, 3); g.fillRect(Q(13)+wig, hy-Q(4), 1, 1);
  g.fillRect(Q(10)-wig, hy-Q(3), 1, 3); g.fillRect(Q(11)-wig, hy-Q(4), 1, 1);
  if(ant.isQueen){
    // corona: tres puntas de oro apoyadas EN la cabeza (el desplazamiento se calcula sobre el
    // alto de la cabeza, no sobre un numero fijo: a escala de reina lo fijo la dejaba flotando)
    const _cy = hy - Q(6);
    _bloque(g, Q(6), _cy, Q(8), Q(4), '#ffcc00');
    g.fillStyle='#fff8dc';
    g.fillRect(Q(7), _cy-1, 1, 2); g.fillRect(Q(10), _cy-1, 1, 2); g.fillRect(Q(13), _cy-1, 1, 2);
  }
  _piernas(g, true);                                         // las de delante, sobre el cuerpo

  // LA CARGA VA AQUI DENTRO, prendida de las mandibulas: es parte del cuerpo, no un letrero que
  // el lienzo cuelga encima. Asi la hoja de perfil ensena a la hormiga con lo que lleva, y en el
  // mapa de bolsillo se ve un punto del color de la miel (una colonia cargada se distingue).
  if(ant.food){
    const _w = Math.round(Math.sin(_bp*1.4 + i)*1.2);
    if(ant.food.isSoil){
      _bloque(g, Q(15)+_w, hy-Q(1), Q(8), Q(6), '#6b3a1f');
      g.fillStyle='#8b5a2b'; g.fillRect(Q(16)+_w, hy, 2, 1);
    } else {
      const _col = ant.food.amount>=3 ? '#ffb700' : ant.food.amount===2 ? '#ffcc33' : '#ffda66';
      _bloque(g, Q(15)+_w, hy-Q(2), Q(7), Q(8), _col);      // al altura de las mandibulas: se ve que la lleva sujeta
      g.fillStyle='#fff8dc'; g.fillRect(Q(16)+_w, hy-Q(1), 1, 2);
      // la cantidad NO se escribe: en grupo eran veinte numeritos flotando
    }
  } else if(mini && ant.isQueen){
    g.fillStyle='#ffcc00'; g.fillRect(Q(1), Q(-6)+oy, 2, 2);
  }
}
// el verde del prado: el MISMO que pinta la franja de hierba del terreno, para que una mata plantada encima
// de una casilla no sea de otro color que la propia casilla
function _hierbaHoy(){
  let h=_HIERBA[(_soilSeason|0)%4]||_HIERBA[0];
  if((_soilSeason|0)===1 && !_soilWet) h=_HIERBA_SECA;
  if(_soilWet && (_soilSeason|0)!==3) h=_tilde16(h,-14);
  return h;
}
// lo que cambia de un tipo a otro sin cambiar de dibujante: dos plantas seguidas no salen calcadas
// EL PIE DE UNA PLANTA (Topo: «si no hay pasto, tierra o una superficie apropiada, no deberia crecer
// nada»). Dos cosas, y las dos de verdad: la casilla de la superficie intacta y tierra debajo para meter
// la raiz. Con la casilla de abajo abierta -una calada que pasa rozando el cesped, o la boca del nido-
// la mata se queda colgando sobre el hueco: eso era lo que se veia. Se usa el MISMO criterio que pinta
// la franja de hierba (ahi donde no hay pasto tampoco hay planta), para que no se contradigan.
function _pieSuperficie(c){
  try{ return !!soil[SURFACE_ROW] && !!soil[SURFACE_ROW+1] && soil[SURFACE_ROW][c]!==0 && soil[SURFACE_ROW+1][c]!==0; }
  catch(e){ return false; }
}
// y la seta de tunele: su propia casilla tiene que ser hueco (la camara) y debajo tiene que haber suelo
// donde se agarra el micelio; sin suelo no hay sustrato, por mucho que la camara siga abierta
function _pieCueva(cr,rr){
  try{ return !!soil[rr] && !!soil[rr+1] && soil[rr][cr]===0 && soil[rr+1][cr]!==0; }
  catch(e){ return false; }
}
function _humorPlant(ax,ay,n){ return (Math.floor(ax)*7 + Math.floor(ay)*13 + n*29) % 5; }

// ============================ LA PARED DE FONDO DEL HUECO ============================
// Topo (2026-10-16): «los graficos del fondo del mapa se glitchean, hay un flash solo en la textura de
// fondo de las cuevas. Crea una textura voxel acorde para el fondo de la cueva que de ese efecto de pared
// de fondo, como en Terraria». Dos cosas, y las dos se arreglan aqui:
//
//  1. EL FLASH. El tunel se pintaba de dos maneras distintas segun la ruta: la cache usa bloque oscuro,
//     y el camino de emergencia de `drawFarm` (y el `paintCacheCell` viejo) usaba un crema `#fff1c8`.
//     Cuando habia un repintado pendiente en el aire, ESE cuadro salia por el camino viejo y toda la
//     cueva parpadeaba clara. Se acaba el doble pintor: un solo ayudante dibuja el hueco, y lo llaman
//     las tres rutas (cache, mini y emergencia). Si las tres pintan lo mismo, no hay nada que parpadee.
//  2. LA PARED. Antes el hueco era aire negro (#1c1108) y ya. Terraria ensena otra cosa: detras del
//     tunel hay roca QUEDA, sin tallar, del material de esa capa, con sus hiladas de ladrillo y su junta.
//     Eso es lo que da profundidad: el hueco se ve HUECO porque detras hay una pared, no porque sea negro.
//     El tono sale del material que rodea el cuadro (asi la cueva de piedra es gris, la de obsidiana
//     violeta casi negro y la del basalto cocida), y cada ladrillo lleva su media tilde por coordenada:
//     dos casillas seguidas no pueden salir calcadas, y como el ruido no depende del reloj no parpadea.
const PARED_FONDO = {
  1:'#43291a', 2:'#4d2e1d', 3:'#5b4c37', 4:'#3d3d44', 5:'#37343d',
  6:'#333b46', 7:'#312f3a', 8:'#3f3a32', 9:'#3a3d44', 10:'#403a2e',
  11:'#4b4657', 12:'#2b2730', 13:'#1b1626', 14:'#31201c', 15:'#5e2a14',
  16:'#3a3a44', 17:'#2a262e', 18:'#4d4f56'
};
function _paredDe(t){ return PARED_FONDO[t] || '#3a2f26'; }

// ── LA PARED DE FONDO DEL HUECO, v2 (2026-10-16, despues de verla pintada) ──
// La primera pasada salia como UNA PERSIANA: hiladas de 4 px con la junta muy marcada, y el musgo de 3 px
// se leia como polvo suelto. Mirada en el lienzo, la pared tiene que leerse como LADRILLO DETRAS del tune
// (lo que hace Terraria): piezas de 8x8 con junta de un pixel en las DOS direcciones y la junta solo un
// punto mas oscura que la pieza. Cambios, y por que:
//   · hilada de 8 px (no 4): menos lineas, menos rayas de persiana;
//   · mortero a -22 % (era -30 %) y en horizontal Y vertical con el mismo peso: la reja desaparece;
//   · el tono de cada pieza entra por el hash de la PIEZA (no de la casilla), asi el patrón es continuo
//     a traves de las casillas y dos casillas seguidas siguen sin salir calcadas;
//   · fuera el musgo verde (parecia glitch); en las bandas duras queda una chispa de 1 px, y en las de
//     tierra las raices que cuelgan, que es lo que de verdad dice «estamos cerca de arriba».
function pintarHuecoVoxel(g, c, r, det){
  const x = c*CELL, y = r*CELL;
  const _soil1 = (rr,cc)=> (rr<0||cc<0||rr>=ROWS||cc>=COLS) ? true : !!(soil[rr] && soil[rr][cc]===1);
  let t = 0;
  const _vec = [[-1,0],[1,0],[0,-1],[0,1]];
  for(let i=0;i<4;i++){ const rr=r+_vec[i][0], cc=c+_vec[i][1];
    if(rr>=0 && rr<ROWS && cc>=0 && cc<COLS && soil[rr] && soil[rr][cc]===1 && soilType[rr] && soilType[rr][cc]>0){ t = _visualHost(soilType[rr][cc],cc,rr); break; } }
  if(!t){ try{ t = _geoHost(c,r); }catch(e){ t = 1; } if(!t) t = 1; }
  const base = _paredDe(t);
  const up = _soil1(r-1,c), down = _soil1(r+1,c), izq = _soil1(r,c-1), der = _soil1(r,c+1);
  const abiertos = (!up?1:0)+(!down?1:0)+(!izq?1:0)+(!der?1:0);
  const camara = abiertos >= 2;
  const mort = adjust(base, -22);
  const luz  = adjust(base,  12);
  // 1) mortero de fondo: si una pieza no se pinta, lo que se ve es la junta, no un hueco negro
  g.fillStyle = mort; g.fillRect(x, y, CELL, CELL);
  // 2) las piezas de 8x8, con la hilada superior desplazada medio ladrillo (el clasicazo del aparejo)
  for(let i=0;i<2;i++){
    const yy = y + i*8, salta = ((r*2 + i) % 2) ? 4 : 0;
    for(let k=-1;k<3;k++){
      const bxc = c*2 + k + ((r*2 + i) % 2 ? 1 : 0);           // columna de pieza, continua entre casillas
      const byr = r*2 + i;
      const x0 = x + salta + k*8, px0 = Math.max(x, x0 + 1), px1 = Math.min(x+CELL, x0 + 8);
      if(px1 <= px0) continue;
      const kk = ((bxc*13 + byr*7 + ((bxc*5) % 3)) % 7) - 3;    // -3..+3: cada pieza, su tilde
      g.fillStyle = _tilde16(base, kk);
      g.fillRect(px0, yy + 1, px1 - px0, 6);
    }
    g.fillStyle = mort; g.fillRect(x, yy, CELL, 1);             // junta de la hilada
    for(let k=-1;k<3;k++){ const jx = x + salta + k*8 + 7;
      if(jx > x && jx < x+CELL) g.fillRect(jx, yy + 1, 1, 6); }  // junta vertical, misma fuerza que la otra
    if(det && ((c*3 + r*5 + i) % 5) === 0){                      // y una arista iluminada por pieza, rara
      g.fillStyle = luz; g.fillRect(x + 1 + ((c*7 + i*5) % 8), yy + 2, 2, 1);
    }
  }
  // 3) el techo: sombra de voladizo, suave y en dos pasos (una barra negra era lo que hacia el hueco
  //    parece un boton en lugar de un tune
  if(up){ g.fillStyle='rgba(0,0,0,0.30)'; g.fillRect(x, y, CELL, 2); g.fillStyle='rgba(0,0,0,0.42)'; g.fillRect(x, y, CELL, 1); }
  // 4) el suelo: la linea de apoyo sobre la que van las hormigas y su canto claro
  if(down){ g.fillStyle = adjust(base, -14); g.fillRect(x, y+CELL-2, CELL, 2); g.fillStyle = luz; g.fillRect(x, y+CELL-1, CELL, 1); }
  const kk2 = (c*11 + r*7) % 9;
  if(det && kk2 === 2){ g.fillStyle = adjust(base, 20); g.fillRect(x+4+((c*5)%6), y+CELL-3, 2, 1); }   // cascote
  if(det && kk2 === 5){ g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(x+9-((r*3)%4), y+CELL-4, 1, 1); }  // y su sombra
  // 5) raices que cuelgan, solo en las bandas de tierra (tipos 1-3) y solo donde hay roca encima
  if(det && up && (t===1||t===2||t===3) && (kk2===0||kk2===4)){
    const rx = x+3+((c*3)%9), largo = 3 + ((c+r)%3);
    g.fillStyle = '#2b1a0c'; g.fillRect(rx, y+2, 1, largo);
    g.fillStyle = '#43291a'; g.fillRect(rx+1, y+2+largo, 1, 1);
  }
  // 6) en las bandas duras, una chispa minima en un rincon de la pieza (cuarcita y marmol brillan; antes
  //    era musgo verde y parecia un pixel suelto de la nada)
  if(det && camara && (t===11||t===12||t===16) && ((c*5 + r*3) % 11) === 0){
    g.fillStyle = 'rgba(255,255,255,0.20)'; g.fillRect(x+2+((c*7)%9), y+3+((r*5)%7), 1, 1);
  }
  // 7) camara amplia: la pared se hunde un punto arriba (entrada de luz por el tune
  if(camara){ g.fillStyle = 'rgba(0,0,0,0.14)'; g.fillRect(x, y, CELL, 2); }
  // 8) el corte contra la roca tallada: 1 px, y solo donde de verdad hay material (un marco por los
  //    cuatro lados era una reja: eso se quito el 2026-10-15 y sigue fuera)
  const corte = adjust(base, -40);
  g.fillStyle = corte;
  if(up)  g.fillRect(x, y+2, CELL, 1);
  if(izq) g.fillRect(x, y+2, 1, CELL-4);
  if(der) g.fillRect(x+CELL-1, y+2, 1, CELL-4);
  if(soilType[r] && (soilType[r][c-1]===17 || soilType[r][c+1]===17)){ g.fillStyle='#57536b'; g.fillRect(x,y,CELL,1); }
  _paintAncientEvidence(g,c,r,false);
}

// El agua de los charcos y de la lluvia: la dibujaba SOLO el camino de emergencia de drawFarm, o sea
// que aparecia y desaparecia segun si habia o no repintado pendiente. Misma razon, misma solucion: un
// ayudante que llaman las dos rutas. Se pinta ENCIMA del cache (es lo unico del terreno que se mueve).
function pintarAguaVoxel(g,c,r){
  const x=c*CELL,y=r*CELL,now=performance.now();
  if(!waterVisual[r]) waterVisual[r]=Array(COLS).fill(0);
  const actual=water&&water[r]?Math.max(0,Number(water[r][c])||0):0;
  const target=Math.min(1,actual), old=Math.max(0,Number(waterVisual[r][c])||0);
  // Visual mass follows physical mass instead of snapping to it. A finite pocket can therefore be
  // watched draining cell by cell even when several conservative transfers happened between frames.
  let vis=old+(target-old)*(target>old?0.28:0.16);
  if(Math.abs(vis-target)<0.008) vis=target;
  waterVisual[r][c]=vis;
  if(vis<=0.006&&actual<=0.006) return;
  _waterVisualActive=true;
  const amount=Math.max(actual,vis);
  const leftW=c>0?Math.max(water[r][c-1]||0,(waterVisual[r]&&waterVisual[r][c-1])||0):0;
  const rightW=c<COLS-1?Math.max(water[r][c+1]||0,(waterVisual[r]&&waterVisual[r][c+1])||0):0;
  const upW=r>0&&water[r-1]?Math.max(water[r-1][c]||0,(waterVisual[r-1]&&waterVisual[r-1][c])||0):0;
  const downW=r+1<ROWS&&water[r+1]?Math.max(water[r+1][c]||0,(waterVisual[r+1]&&waterVisual[r+1][c])||0):0;
  const flow=waterFlow.get(c+','+r),recent=flow&&now-flow.at<760?flow:null;
  const belowOpen=r+1<ROWS&&soil[r+1]&&soil[r+1][c]===0;
  const falling=belowOpen&&downW<0.72&&(amount>0.025)&&((recent&&recent.dy>0)||downW<0.16);
  let col=amount>0.72?'#174a78':amount>0.40?'#2b6fa8':amount>0.18?'#4b91ca':'#79bee5';
  if(r<SURFACE_ROW+2&&amount<0.30) col='#86c8ee';
  if(falling){
    const strength=Math.max(amount,recent?Math.min(1,recent.amount*2.2):0),w=Math.max(2,Math.min(9,Math.round(2+strength*6)));
    const sx=x+Math.round((CELL-w)/2)+(recent?Math.sign(recent.dx||0):0);
    g.fillStyle='rgba(5,22,38,0.32)'; g.fillRect(sx-1,y-1,w+2,CELL+2);
    g.fillStyle=col; g.fillRect(sx,y-1,w,CELL+2);
    const dash=((now*0.018+r*5+c*3)|0)%7;
    g.fillStyle='rgba(220,245,255,0.52)'; g.fillRect(sx+1,y-2+dash,Math.max(1,w-3),3);
    g.fillStyle='rgba(255,255,255,0.20)'; g.fillRect(sx+w-2,y+((dash+8)%13),1,4);
    // The donor still has a visible lip while it empties; the stream does not masquerade as a full tile.
    if(vis>0.18){ const cap=Math.max(1,Math.round(vis*4)); g.fillStyle=col; g.fillRect(x+2,y,CELL-4,cap); }
    return;
  }
  const h=Math.max(1,Math.min(CELL,Math.round(vis*CELL))),top=y+CELL-h;
  g.fillStyle='rgba(4,22,40,0.28)'; g.fillRect(x-1,top-1,CELL+2,h+2);
  g.fillStyle=col; g.fillRect(x,top,CELL,h);
  // Neighbouring partial levels join at their shared edge instead of showing disconnected blue cubes.
  if(leftW>0.02){ const lh=Math.max(1,Math.round(Math.min(vis,leftW,1)*CELL)); g.fillRect(x-1,y+CELL-lh,1,lh); }
  if(rightW>0.02){ const rh=Math.max(1,Math.round(Math.min(vis,rightW,1)*CELL)); g.fillRect(x+CELL,y+CELL-rh,1,rh); }
  if(downW>0.08){ g.fillRect(x,y+CELL,CELL,1); }
  g.fillStyle='rgba(0,0,0,0.20)'; g.fillRect(x,y+CELL-1,CELL,1);
  const exposed=upW<0.08||upW+0.08<vis;
  if(exposed){
    const wave=Math.round(Math.sin(now*0.020+c*0.83+r*0.17));
    g.fillStyle='rgba(235,250,255,0.52)'; g.fillRect(x+1+wave,top,Math.max(2,CELL-2-Math.abs(wave)),1);
    if(h>5){ g.fillStyle='rgba(255,255,255,0.18)'; g.fillRect(x+3-wave,top+2,4,1); }
  }
  if(recent&&Math.abs(recent.dx)>Math.abs(recent.dy)&&exposed){
    const dir=Math.sign(recent.dx),tongue=Math.max(2,Math.min(7,Math.round(recent.amount*10)));
    g.fillStyle='rgba(126,200,235,0.72)'; g.fillRect(dir>0?x+CELL-1:x-tongue+1,top+1,tongue,2);
  }
  if(actual>1.001||(recent&&recent.dy<0)){
    g.fillStyle='rgba(230,248,255,0.42)'; g.fillRect(x+4+((c+r)&3),top+3,2,2); g.fillRect(x+10-((c*3+r)&3),top+7,1,1);
  }
}

function pintarBarreraAgua(g,c,r){
  if(!floodBarriers.has(c+','+r)) return;
  const x=c*CELL,y=r*CELL;
  g.fillStyle='rgba(20,12,5,0.72)'; g.fillRect(x,y+2,CELL,3); g.fillRect(x,y+11,CELL,3);
  g.fillStyle='#9a6b38'; for(let k=1;k<CELL;k+=5) g.fillRect(x+k,y+1,2,CELL-2);
  g.fillStyle='#d6ae73'; g.fillRect(x+1,y+2,CELL-2,1);
  g.fillStyle='#79c9e8'; g.fillRect(x+3,y+7,3,2); g.fillRect(x+10,y+7,3,2);
}

function paintCacheCellTextured(c,r){
  const g=soilCacheCtx, x=c*CELL, y=r*CELL;
  const _h=((c*7+r*13)%5), _h2=((c*11+r*5)%4);       // el "ruido" sale de la coordenada: no parpadea al repintar
  if(soil[r][c]!==1){
    // el hueco no es aire negro: detras hay PARED de la roca que queda, sin tallar (ver pintarHuecoVoxel)
    pintarHuecoVoxel(g,c,r,!_voxMini);
    return;
  }
  const t=(soilType[r]&&soilType[r][c])||1;
  const hostT=_visualHost(t,c,r);
  const d=_VOX[hostT]||_VOX[1];
  const exp = (r===SURFACE_ROW) || (r>0 && soil[r-1] && soil[r-1][c]===0);   // en contacto con el aire
  // cada bloque lleva su media tilde de tono (-2..+2) y sus marcas en su sitio: dos casillas seguidas del
  // mismo material no pueden salir calcadas, que era la queja. Establecido por coordenada, no al azar.
  // OJO: todo esto se hace sobre el HEX, porque adjust() devuelve 'rgb(...)' y realimentarlo producia un
  // color invalido que canvas se tragaba en silencio (la franja de luz salia del color del relleno anterior).
  let col=_tilde16(d.col, _h - 2);
  const _px=(n)=>((c*13 + r*7 + n*29 + _h*5 + _h2*3) % 11) + 2;
  if(_soilWet) col=_tilde16(col,-16);                                             // mojado: mas oscuro y apagado
  const luz=adjust(col, 42), sombra=adjust(col,-56), corte=adjust(col,-28);
  // cara frontal
  g.fillStyle=col; g.fillRect(x,y,CELL,CELL);
  // cara de arriba (la luz del sol entra por arriba: eso es lo que hace que lea como bloque y no como mancha)
  g.fillStyle=luz; g.fillRect(x,y,CELL,3);
  // arista inferior y corte del lado: la sombra del bloque
  g.fillStyle=sombra; g.fillRect(x,y+CELL-2,CELL,2);
  g.fillStyle=corte; g.fillRect(x+CELL-1,y+3,1,CELL-5);
  // la linea entre celda y celda: 1 px apenas marcado, para que el terreno se lea en bloques
  g.fillStyle='rgba(0,0,0,0.16)'; g.fillRect(x,y,1,CELL);
  // y la diferencia ligera de cada material
  if(d.pinta==='piedras'){
    g.fillStyle=sombra; g.fillRect(x+_px(1),y+4+_px(2)%8,2,2); g.fillStyle=luz; g.fillRect(x+_px(4),y+_px(5)%9+3,2,1);
    if(_h>2){ g.fillStyle=sombra; g.fillRect(x+_px(7),y+11,2,1); }
  } else if(d.pinta==='mantas'){
    g.fillStyle=luz; g.fillRect(x+1+(_h%3),y+5+_h2,10-(_h%4),1); g.fillStyle=sombra; g.fillRect(x+3,y+10+(_h%3),8-(_h2%3),1);
  } else if(d.pinta==='granos'){
    g.fillStyle=luz; g.fillRect(x+_px(1),y+_px(2)%10+3,1,1); g.fillRect(x+_px(3),y+_px(4)%9+4,1,1);
    g.fillStyle=sombra; g.fillRect(x+_px(5),y+_px(6)%8+6,1,1);
    if(_h%2===0){ g.fillStyle=luz; g.fillRect(x+_px(8),y+_px(9)%6+8,1,1); }
  } else if(d.pinta==='grieta'){
    g.fillStyle=sombra; const _k=_px(2)%4;
    g.fillRect(x+3+_k,y+4,1,1); g.fillRect(x+4+_k,y+5,1,1); g.fillRect(x+5+_k,y+6,2,1); g.fillRect(x+6+_k,y+7,1,1);
  } else if(d.pinta==='grietaLarga'){
    g.fillStyle=sombra; const _k=_h%3;
    for(let o=0;o<4;o++) g.fillRect(x+2+o*3+_k, y+3+o*3, 2,1);
    if(_h2%2===0){ g.fillStyle=luz; g.fillRect(x+_px(3),y+12,3,1); }
  } else if(d.pinta==='veta'){
    g.fillStyle=d.punto;
    g.fillRect(x+_px(1),y+4+_px(2)%7,2,2); g.fillRect(x+_px(4),y+_px(5)%8+3,2,2);
    if(((c*7+r*5)%3)!==0) g.fillRect(x+_px(7),y+11,2,2);
  } else if(d.pinta==='brillo'){
    // obsidiana: negro con dos caras de vidrio. Se lee «corte» sin necesidad de degradado.
    g.fillStyle='rgba(255,255,255,0.11)'; g.fillRect(x+2,y+3,5,2); g.fillRect(x+8,y+9,5,2);
    g.fillStyle='rgba(122,211,255,0.10)'; g.fillRect(x+3,y+11,3,1);
  } else if(d.pinta==='lumbre'){
    // magma: nucleo claro, costra oscura alrededor. El resplandor que lo acompana se pinta en drawFarm,
    // porque aqui dentro (el cache del suelo) un parpadeo quedaria congelado hasta el proximo repintado.
    g.fillStyle='#2a1208'; g.fillRect(x,y,CELL,CELL);
    g.fillStyle='#ff8c1a'; g.fillRect(x+2,y+4,CELL-4,CELL-8);
    g.fillStyle='#ffe08a'; g.fillRect(x+4,y+6,CELL-8,3);
    g.fillStyle='#8a2a08'; g.fillRect(x,y+CELL-3,CELL,3);
  } else if(d.pinta==='cincel'){
    // LA LOSA: siempre igual de maciza, pero con las mordeduras puestas. El progreso del umbral se ve en
    // el propio bloque (astillas quitadas = grietas), no solo en la barra de arriba.
    const _rot = umbral? Math.max(0, Math.min(1, 1-(umbral.hp/umbral.hpMax))) : 0;
    g.fillStyle=sombra;
    g.fillRect(x+2,y+3,3,1); g.fillRect(x+5,y+6,2,1); g.fillRect(x+9,y+2,2,1);
    if(_rot>0.12){ g.fillStyle='#0d0704'; g.fillRect(x+3,y+2,1,7); g.fillRect(x+4,y+9,2,1); }
    if(_rot>0.34){ g.fillRect(x+8,y+3,1,8); g.fillRect(x+9,y+11,3,1); }
    if(_rot>0.58){ g.fillRect(x+12,y+2,1,9); }
    if(_rot>0.80){ g.fillStyle='#ffcc00'; g.fillRect(x+2,y+13,CELL-4,1); }   // a un mordisco de ceder
  }
  // Ore is an inclusion in host rock, not a whole perfectly coloured cube. The seam crosses a few
  // pixels and can continue into neighbouring host types, which makes it readable without looking tiled.
  if(_isDepositType(t)){
    const ore=t===8?'#c87842':t===9?'#c2c8d0':t===10?'#e8c94f':t===18?'#e8eef2':'#b999e8';
    const oreHi=t===8?'#e6a06a':t===9?'#eef2f4':t===10?'#fff09a':t===18?'#ffffff':'#e2ccff';
    const sl=((c*5+r*3+t)&3), oy=4+((c*7+r*11)%6);
    g.fillStyle=adjust(ore,-28); g.fillRect(x+1,y+oy+1,4,1); g.fillRect(x+5,y+oy,4,1); g.fillRect(x+9,y+oy-1+sl%2,5,1);
    g.fillStyle=ore; g.fillRect(x+3+sl,y+3,2,2); g.fillRect(x+10-sl,y+9,2,2);
    g.fillStyle=oreHi; g.fillRect(x+4+sl,y+3,1,1); if(((c+r+t)&1)===0) g.fillRect(x+11-sl,y+9,1,1);
  }
  _paintAncientEvidence(g,c,r,true);
  // el pasto: encima del bloque, 4 px de color de estacion y dos o tres pixeles de hoja que asoman
  if(exp && (r===SURFACE_ROW || hostT===1)){
    let hcol=_HIERBA[(_soilSeason|0)%4]||_HIERBA[0];
    if((_soilSeason|0)===1 && !_soilWet) hcol=_HIERBA_SECA;
    if(_soilWet && (_soilSeason|0)!==3) hcol=adjust(hcol,-14);
    g.fillStyle=hcol; g.fillRect(x,y,CELL,4);
    g.fillStyle=adjust(hcol,34); g.fillRect(x,y,CELL,1);
    if(!_voxMini){   // en el minimapa la celda es mas pequena que el detalle: los hilos que asoman se emborronarian
      if(_h<3){ g.fillStyle=hcol; g.fillRect(x+2+_h*4,y-2,1,2); g.fillRect(x+5+_h*4,y-1,1,1); }
      if(_h2===1){ g.fillStyle=adjust(hcol,-30); g.fillRect(x+11,y-1,1,1); }
    }
  }
  // la humedad se ve tambien como una mecha clara arriba, no como textura nueva
  if(_soilWet && !exp){ g.fillStyle='rgba(140,180,220,0.10)'; g.fillRect(x+1,y+1,CELL-3,1); }
  // y si esta nevando, la capa: dos pixeles palidos encima del bloque, con su borde de arriba mas claro.
  // Se pinta en el cache (y se marca el repintado al cambiar el clima), no encima en cada cuadro.
  if(_soilNieve && exp){ g.fillStyle='rgba(232,242,252,0.76)'; g.fillRect(x,y-4,CELL,5); g.fillStyle='rgba(255,255,255,0.88)'; g.fillRect(x,y-4,CELL,1); }
}

rebuildSoilCache = function(isMini){
  if(!soilCacheCtx) return;
  paintCellActive = paintCacheCellTextured;   // todo dibujado: no hay textura que esperar
  _voxMini = isMini===true;                        // la pasada mini pinta el mismo lienzo, sin microdetalle
  _soilSeason=(()=>{ try{ return getCalendarData().seasonIdx|0; }catch(e){ return 0; } })();
  _soilWet=(()=>{ try{ return !!(weather && (weather.type==='rain'||weather.type==='storm')); }catch(e){ return false; } })();
  _soilNieve=(()=>{ try{ return !!(weather && weather.type==='snow'); }catch(e){ return false; } })();
  // atajo: una calada repinta 5 celdas, no las 4608 del mapa
  if(soilIncrementalReady(isMini)){
    try{
      const cells=soilRepaintDirtyCells();
      if(!isMini) soilRepaintMoundsOver(cells);
      return;
    }catch(e){
      if(_soilIncWarned<3){ _soilIncWarned++; console.warn('[SOIL] repintado por lotes fallido, pintando el mapa entero:', e.message); }
      soilDirtyCells=null;
    }
  }
  soilCacheCtx.clearRect(0,0,W,H);
  // need imageSmoothing false for pixel
  soilCacheCtx.imageSmoothingEnabled=false;
  for(let r=SURFACE_ROW;r<ROWS;r++) for(let c=0;c<COLS;c++) paintCacheCellTextured(c,r);
  // draw puddles/mounds atlas on top
  for(const m of mound) soilDrawMoundTile(m);
  // el lote pendiente del cache principal no se lo come una pasada mini (asi lo hace la definicion que
  // esto reemplaza; aqui se habia perdido el guardado y la pasada del minimapa dejaba el cuadro principal
  // con su repintado pendiente en el aire)
  if(!isMini){ soilCacheDirty=false; soilDirtyCells=null; }
  _soilRepaints++; _soilFullRepaints++;
  window.__soilDbg = {canvas:soilCacheCanvas, cell:CELL};   // gancho de medida: test/voxel-graficos.js
};
tlog('[TEX] superficies override instalado');

// === TEXTURAS DEFINITIVAS 02 - VEGETACIÓN ATLAS 1024 ===
const texVegetacion = new Image();
// texVegetacion.src ya NO se pide: plantas, comida y miel se pintan en bloques (ver _bloque). El PNG sigue en disco.
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
// texAlimentos.src ya NO se pide: plantas, comida y miel se pintan en bloques (ver _bloque). El PNG sigue en disco.
// miel regenerada individual PNG blanco 66KB - carga ligera para no congelar
const texHoneyNew = new Image();
// texHoneyNew.src ya NO se pide: plantas, comida y miel se pintan en bloques (ver _bloque). El PNG sigue en disco.
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
// EL CLIMA Y EL CIELO YA NO TIENEN PLIEGO: lluvia, nieve, nubes, sol, luna y luceros se pintan aqui mismo,
// en bloques (ver _bloque). El PNG de categoria_10_clima_efectos.png sigue en disco por si se quiere volver
// atras, pero no se descarga: es el ultimo que quedaba del mundo (las hormigas conservan sus sprites, que
// es lo que el dueño dijo de dejar igual).
const texClima = new Image();
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


// Dos colores hex ('#rrggbb') se mezclan con f (0..1). Sin dependencias y sin PNG: el cielo es codigo.
function _hex2rgb(h){ const n=parseInt(String(h).slice(1),16); return [(n>>16)&255,(n>>8)&255,n&255]; }
function _rgb2hex(a){ return '#'+a.map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join(''); }
function _mezcla16(h1,h2,f){ const A=_hex2rgb(h1), B=_hex2rgb(h2); const k=Math.max(0,Math.min(1,f)); return _rgb2hex([A[0]+(B[0]-A[0])*k, A[1]+(B[1]-A[1])*k, A[2]+(B[2]-A[2])*k]); }
// paleta por horas: se buscan los dos nodos que enmarcan la hora y se interpola (amanecer y ocaso incluidos)
function _cieloMezcla(hora, h0,c0, h1,c1, h2,c2, h3,c3, h4,c4, h5,c5, h6,c6){
  const nod=[[h0,c0],[h1,c1],[h2,c2],[h3,c3],[h4,c4],[h5,c5],[h6,c6]];
  for(let i=0;i<nod.length-1;i++){
    const A=nod[i], B=nod[i+1];
    if(hora>=A[0] && hora<=B[0]) return _mezcla16(A[1], B[1], (hora-A[0])/Math.max(0.001,B[0]-A[0]));
  }
  return nod[nod.length-1][1];
}
let _cieloEst = 0, _cieloEstDia = -1;
function drawFarm(ctx,W,H,isMini=false){
  const useZoom=!isMini && view.zoom!==1;
  // LA CAJA QUE DE VERDAD SE VE, en coordenadas del mundo. Casi todos los rellenos "de capa"
  // (el cielo, el oscurecido de noche, el velo de la lluvia, el destello del rayo) se echaban
  // sobre 0,0,W,H: con la camara acercada eso es pintar hasta 16 veces lo que asoma por la
  // ventana, y el lienzo no perdonaba ni uno. Cada capa cubre desde aqui lo visible y ni un
  // pixel mas. Medido a x10: de 66.829 rellenos por cuadro a 1.711, con 20 ms de mediana.
  const _cvx = useZoom? Math.floor(view.x) : 0, _cvy = useZoom? Math.floor(view.y) : 0;
  const _cvw = Math.ceil(useZoom? W/view.zoom : W) + 2, _cvh = Math.ceil(useZoom? H/view.zoom : H) + 2;
  if(useZoom){ctx.save(); ctx.scale(view.zoom,view.zoom); ctx.translate(Math.floor(-view.x),Math.floor(-view.y)); ctx.imageSmoothingEnabled=false;}
  ctx.imageSmoothingEnabled=false;
  if(!soil || !soil.length || !soil[0]){ ctx.fillStyle='#6b3a1f'; ctx.fillRect(0,SURFACE_Y,W,H-SURFACE_Y); ctx.fillStyle='#3a9d23'; ctx.fillRect(0,SURFACE_Y-12,W,12); /* no return, sigue dibujando cielo */ }
  // SKY pixel - con ciclo día/noche y clima
  const gameHour = (time % DAY_LENGTH) / DAY_LENGTH * 24;
  const isDay = gameHour>=4.5 && gameHour<=19.5; // Terraria 15h día (4:30-19:30) 9h noche
  const dusk = (gameHour>19.5 && gameHour<20.5) || (gameHour>5 && gameHour<5.8);
  // CIELO CODIFICADO, SIN TEXTURA PNG. El cielo es una franja de color que cambia con la hora y con el
  // clima y cubre TODO el fondo de la pantalla, tambien lo que asoma cuando la camara sube por encima del
  // prado. Se quito el PNG de cielos: dos capas desplazadas por el viento, a alpha 0,28 y 0,36, cortaban
  // costuras y dejaban bandas - eso era la «textura rara» del cielo.
  const _horas = gameHour;
  const _cielo  = _cieloMezcla(_horas, 0, '#04081c', 5.0, '#3a4a7a', 7.5, '#7ec8e3', 17.0, '#8fc4e8', 19.2, '#ff7a3d', 20.6, '#101a3a', 24, '#04081c');
  const _sueloCielo  = _cieloMezcla(_horas, 0, '#0b1230', 5.0, '#c88a6a', 7.5, '#a8e0f0', 17.0, '#bfe8f5', 19.2, '#ffcc66', 20.6, '#16203f', 24, '#0b1230');
  const _wt = (typeof weather!=='undefined' && weather.type) ? weather.type : 'clear';
  const _nievando = _wt==='snow';
  const _nublado = _wt==='cloudy'? 0.35 : _wt==='rain'? 0.62 : _wt==='storm'? 0.80 : _nievando? 0.55 : 0;
  // CUATRO CIELOS, NO UNO CON FILTRO (Topo: «el de los cielos y climas distintos»). La estacion lava las
  // anclas de hora: la primavera clarea el azul, el verano calienta el horizonte, el otono lo ensucia de
  // oro y el invierno lo vuelve palido y corto. Y encima pasan las nubes, que siguen el mismo tinte.
  let _est = _cieloEst;
  if(_cieloEstDia !== (day|0)){
    _cieloEstDia = day|0;
    try{ const _cal = getCalendarData(); if(_cal && typeof _cal.seasonIdx==='number') _est = _cieloEst = _cal.seasonIdx|0; }catch(e){}
  }
  const _LAVIDA = [['#7fd8e8',0.10],['#ffe9a8',0.13],['#e0a45c',0.16],['#cfe4f5',0.24]];
  const _lv = _LAVIDA[_est%4]||_LAVIDA[0];
  let _top = _mezcla16(_cielo, _lv[0], _lv[1]);
  let _bot = _mezcla16(_sueloCielo, _lv[0], _lv[1]*0.55);
  if(_nievando){ _top=_mezcla16(_top,'#e8f2ff',0.30); _bot=_mezcla16(_bot,'#dceaf8',0.26); }
  const _tinte = _nublado>0 ? _mezcla16(_top, _nievando?'#9fb4c8':'#4a5560', _nublado*0.75) : _top;
  const _tinte2 = _nublado>0 ? _mezcla16(_bot, _nievando?'#c8d8e8':'#6a7684', _nublado*0.60) : _bot;
  // el degradado va de arriba del mapa a la raya del cesped, que es la franja de cielo que de verdad se
  // ve: con -H*1.8 de recorrido todo lo visible caia en el ultimo diez por ciento y el cielo salia un
  // color plano (el alba no se enteraba). El relleno sigue cubriendo el hueco de la camara, por eso.
  // EL CIELO, EN FAJAS DE DIECISEIS. El degradado suave era lo ultimo que quedaba del dibujo
  // antiguo: sobre un mundo de bloques una rampa continua se leia como niebla y AdemAs
  // costaba un degradado nuevo por cuadro (tres paradas, recomponer, y encima alpha). Se
  // recorre la misma rampa pero saltando de bloque en bloque, y la tabla de colores se
  // guarda: mientras el tono no cambie (y cambia una vez cada hora del juego) no se vuelve
  // a mezclar. Cada faja es un rectAngulo duro, sin interpolaciOn.
  const _tope = SURFACE_Y|0, _n = Math.max(4, Math.ceil((_tope + Math.ceil(H*1.8))/16));
  const _key = _tinte+_tinte2+'|'+_tope+'|'+_n;
  if(drawFarm._fajasKey !== _key){
    const _fajas = new Array(_n);
    const _yTop = -Math.ceil(H*1.8/16)*16;
    for(let i=0;i<_n;i++){
      const f = (_yTop + i*16) / Math.max(16,_tope);
      _fajas[i] = f<=0 ? _tinte : (f>=0.62 ? _tinte2 : _mezcla16(_tinte,_tinte2, f/0.62));
    }
    drawFarm._fajas = _fajas; drawFarm._fajasKey = _key; drawFarm._fajasTop = _yTop;
  }
  {
    const _f = drawFarm._fajas, _top = drawFarm._fajasTop;
    // la rampa entera mide ~100 fajas; por la ventana entran las que tocan, ni una mas
    let _i0 = Math.floor((_cvy - _top)/16), _i1 = Math.ceil((_cvy + _cvh - _top)/16);
    _i0 = Math.max(0, _i0); _i1 = Math.min(_f.length, _i1);
    for(let i=_i0;i<_i1;i++){ ctx.fillStyle=_f[i]; ctx.fillRect(_cvx, _top + i*16, _cvw, 16); }
  }
  if(!isMini){
    // luceros fijos, con un poco de paralaje al subir la camara; solo de noche y sin nubes encima
    if(!isDay && _nublado<0.4){
      const _noche = Math.min(1, Math.max(0, (gameHour>20? (24-gameHour)/3.2 : (5.2-gameHour)/3.2 )));
      ctx.fillStyle='rgba(255,255,255,'+(0.55+0.35*_noche).toFixed(2)+')';
      // Las posiciones se reparten por la FRANJA DE CIELO QUE DE VERDAD SE VE (de arriba del mapa a la raya del
      // cesped), no por encima: colocadas a SURFACE_Y - 1,25*H quedaban fuera del alcance de la camara en un
      // mundo pequeno (la camera no puede subir de view.y=0) y los luceros nunca se llegaban a pintar.
      const _banda = Math.max(24, SURFACE_Y - 26);
      for(let st=0; st<26; st++){
        const sx2 = ((st*97)%23)*44 + ((st%5)*7) - W*0.4 - (view.x||0)*0.08;
        const sy2 = 6 + ((st*61)%29)/29*_banda + (view.y||0)*0.12;
        if(sy2 > SURFACE_Y-18) continue;
        const _tw = 1 + (st%3===0?1:0);
        if(sx2+_tw < _cvx || sx2 > _cvx+_cvw) continue;              // y los que caen a la izquierda o a la derecha, tampoco
        ctx.fillRect(Math.floor(sx2), Math.floor(sy2), _tw, _tw);   // entero: un lucero de medio pixel es una mancha
      }
    }
    // nubes dibujadas, no de textura: tres franjas redondeadas que se cruzan segun el viento
    if(_nublado>0.1){
      const _vel = _wt==='storm'? 26 : _wt==='rain'? 14 : 7;
      ctx.globalAlpha=(0.16+0.34*_nublado);
      ctx.fillStyle= _nievando? '#8ea3b8' : '#141a22';
      for(let cb=0; cb<7; cb++){
        const cx2 = ((time*0.001*_vel + cb*260) % (W*1.9)) - W*0.45;   // anclada al mundo: si se
        // ancla a la ventana, la nube salta de sitio cada vez que se mueve la camara
        const cy2 = SURFACE_Y - H*1.05 + ((cb*53)%9)*15;
        const aw = 88 + (cb%3)*36, ah = 12 + (cb%2)*4, _cx = Math.floor(cx2), _cy = Math.floor(cy2);
        if(_cx+aw+24 < _cvx || _cx > _cvx+_cvw) continue;          // y fuera de la ventana, ni se intenta
        ctx.fillRect(_cx, _cy, aw, ah);
        ctx.fillRect(_cx+16, _cy-Math.round(ah*0.6), Math.round(aw*0.6), Math.round(ah*0.7));   // la pana de arriba
      }
      ctx.globalAlpha=1;
    }
  }
  // sol / luna pixel que se mueve con la hora - Topo fix: más arriba y cielo sincronizado
  if(!isMini){
    const sunX = (gameHour/24)*W;
    const sunY = isDay? 10 + (1 - Math.sin((gameHour-6)/13*Math.PI))*22 : 14 + Math.sin((gameHour-20)/8*Math.PI)*14;   // mediodia arriba (10), alba y ocaso bajos (32)
    if(isDay){
      // sol más alto, inicia el día visible
      // el sol es un bloque de 28 con su cara clara arriba y su canto oscuro abajo, como todo lo demas;
      // y en invierno describe un arco mas bajo, que es como se ve el dia corto de verdad
      const _bajo = _est===3 ? 10 : _est===1 ? -6 : 0;
      ctx.fillStyle='#fff8dc'; ctx.fillRect(Math.floor(sunX)-10,Math.floor(sunY)+_bajo+4,8,8);
      _bloque(ctx,Math.floor(sunX)-14, Math.floor(sunY)+_bajo, 28,28, weather.type==='storm'? '#ffaa44' : '#ffdd57');
      ctx.fillStyle='#ffaa00'; ctx.fillRect(Math.floor(sunX)+6,Math.floor(sunY)+_bajo,4,4);
      // rayos si no llueve
      if(weather.type==='clear' && !dusk){
        ctx.fillStyle='rgba(255,255,255,0.18)'; ctx.fillRect(Math.floor(sunX)-18,Math.floor(sunY)+6,4,16); ctx.fillRect(Math.floor(sunX)+18,Math.floor(sunY)+6,4,16);
      }
    } else {
      // luna
      _bloque(ctx,Math.floor(sunX)-12, Math.floor(sunY),22,22,'#e8e8d8'); ctx.fillStyle='#c8c8b8'; ctx.fillRect(Math.floor(sunX)-6,Math.floor(sunY)+6,4,4); ctx.fillStyle='#05091a'; ctx.fillRect(Math.floor(sunX)+4,Math.floor(sunY)+2,6,6);
      // estrellas fijas (no random cada frame para no parpadear)
      ctx.fillStyle='rgba(255,255,255,0.9)'; for(let i=0;i<18;i++){ const sx=(i*67 + 11)%W, sy=8+(i*13)%22; if(sx<_cvx || sx>_cvx+_cvw) continue; ctx.fillRect(sx,sy,1,1); }
    }
    // nubes bloque - drift natural sincronizado con textura cielo, cubre todo el ancho
    const cloudAlpha = weather.type==='clear'? 0.92 : weather.type==='cloudy'? 0.85 : 0.62;
    ctx.globalAlpha=cloudAlpha;
    ctx.fillStyle='#ffffff';
    // 8 nubes distribuidas, drift con skyDrift para sincronía total cielo
    let cloudDrift = (time * 0.04) % (W*2);
    for(let i=0;i<8;i++){
      let baseX = (i * (W/4.2) + cloudDrift) % (W*1.9) - W*0.45;
      if(baseX + 90 < _cvx || baseX > _cvx+_cvw+24) continue;       // la nube no asoma por la ventana
      let y = 14 + (i%3)*7 + Math.sin(i*0.9 + time*0.001)*3;
      let w = 30 + (i%3)*10;
      let h = 10 + (i%2)*4;
      // variación por clima: más densas si nublado/lluvia
      if(weather.type==='rain' || weather.type==='storm'){ w+=6; h+=2; y+=1; }
      let cx = Math.floor(baseX);
      // dibujo pixel nube con bordes suaves
      _bloque(ctx,cx,y,w,h,'#ffffff');
      _bloque(ctx,cx-6,y+4,6,6,'#f2f7ff');
      _bloque(ctx,cx+w,y+4,6,6,'#eaf1fb');
      if(i%2===0){ _bloque(ctx,cx+8,Math.floor(y)-4,12,4,'#f2f7ff'); }   // el gorrito de la nube, en bloque y entero
    }
    ctx.globalAlpha=1;
    // oscurecimiento al anochecer / tormenta
    if(isNight || weather.type==='storm'){
      const darkAlpha = isNight? 0.22 + Math.sin(time*0.01)*0.04 : 0.18;
      ctx.fillStyle=`rgba(0,0,0,${darkAlpha})`; ctx.fillRect(_cvx,_cvy,_cvw,Math.max(0,Math.min(SURFACE_Y,_cvy+_cvh)-_cvy));
    }
    if(dusk){
      ctx.fillStyle='rgba(255,122,61,0.18)'; ctx.fillRect(_cvx,_cvy,_cvw,Math.max(0,Math.min(SURFACE_Y,_cvy+_cvh)-_cvy));
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
    if(_nievando){ ctx.fillStyle='rgba(238,246,255,0.80)'; ctx.fillRect(x,SURFACE_Y-18,CELL,6); ctx.fillStyle='rgba(255,255,255,0.62)'; ctx.fillRect(x,SURFACE_Y-19,CELL,1); }
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
      // PLANTAS EN BLOQUES (Topo: «haced lo mismo con las plantas, super simplificadas»). El atlas de
      // vegetacion deja de pedirse y cada tipo se pinta aqui, con su cara de luz y su sombra, del mismo
      // corte que los cuadros del terreno. El despliegue sale de la coordenada de la planta: dos matas
      // seguidas no salen calcadas y al repintar no parpadea (nada de Math.random en el pintado).
      // y si esta seca (perdio la tierra debajo) el mismo dibujo sale en color paja: se ve como se cae,
      // en vez de desaparecer de golpe y sin explicacion
      const _verdeVivo=_hierbaHoy();
      const _v= pl.seca? _mezcla16(_verdeVivo,'#b8762e',0.72) : _verdeVivo, _vC=_tilde16(_v,36), _vO=_tilde16(_v,-42);
      const _hp=(n)=>_humorPlant(px,py,n);
      const g2=g;
      if(pl.type==='clover'){
        const sz=3+g2*4 + (_hp(0)?0:1);
        _bloque(ctx,px-1+sway*0.3,py-sz,3,sz,_v);
        if(g2>0.45){ _bloque(ctx,px-3+sway*0.2,py-sz+1,4,3,_vC); _bloque(ctx,px+2+sway*0.2,py-sz+2,4,3,_v); }
        if(g2>0.85){ ctx.fillStyle='#fff8dc'; ctx.fillRect(Math.floor(px+1+sway*0.3),Math.floor(py-sz),1,1); }
      } else if(pl.type==='grassTuft'){
        const h=4+g2*6+_hp(1)%2, x0=px+sway;
        _bloque(ctx,x0,py-h,2,h,_v);
        _bloque(ctx,x0+3,py-Math.round(h*0.72),2,Math.round(h*0.72),_vO);
        if(g2>0.6){ _bloque(ctx,x0-3,py-Math.round(h*0.55),1,Math.round(h*0.55),_vC); }
        ctx.fillStyle=_vC; ctx.fillRect(Math.floor(x0),Math.floor(py-h),1,1);
      } else if(pl.type==='flowerY'||pl.type==='flowerW'){
        const h=5+g2*5+_hp(2)%2, amarillo=pl.type==='flowerY';
        _bloque(ctx,px,py-h,2,h,_v);
        if(g2>0.42){
          const fx=px+1, fy=py-h-2;
          const pet = amarillo? (g2>0.85?'#ffdd57':'#e0c044') : '#f2f0e4';
          _bloque(ctx,fx-2,fy,5,3,pet); _bloque(ctx,fx,fy-2,2,6,pet);
          ctx.fillStyle=amarillo?'#7a4a00':'#ffdd57'; ctx.fillRect(Math.floor(fx),Math.floor(fy+1),1,1);
          if(g2>0.9){ ctx.fillStyle='rgba(255,221,87,0.40)'; ctx.fillRect(Math.floor(fx-3),Math.floor(fy-1),7,1); }
        }
      } else if(pl.type==='berryBush'){
        const h=7+g2*10+_hp(3)%2;
        _bloque(ctx,px,py-h,3,h,'#5a3a1a');
        if(g2>0.32){
          const fh=(g2<0.6?10:g2<0.85?14:18)+_hp(4)%3;
          _bloque(ctx,px-6,py-h-fh+6,14,fh,_v);
          _bloque(ctx,px-4,py-h-fh+8,8,4,_vC);
          if(g2>0.72){ _bloque(ctx,px-2,py-h-2,3,2,_vO); }
          if(g2>0.88){
            const _mad = _tilde16('#8b2ba0', _hp(1)%2?0:18);
            _bloque(ctx,px-5,py-h-6,3,3,_mad); _bloque(ctx,px+3,py-h-8,3,3,'#6a1a7a'); _bloque(ctx,px+1,py-h-10,3,3,_mad);
            ctx.fillStyle='#d27aee'; ctx.fillRect(Math.floor(px-4),Math.floor(py-h-5),1,1); ctx.fillRect(Math.floor(px+4),Math.floor(py-h-7),1,1);
          }
        }
      } else if(pl.type==='mushroom'){
        const h=2+g2*5+_hp(2)%2;
        _bloque(ctx,px,py-h,2,h+1,'#d9c8b0');
        if(g2>0.35){
          const capW=8+g2*6+_hp(3)%3, capH=5+g2*3;
          _bloque(ctx,px-capW/2+1,py-h-capH,capW,capH, g2<0.7?'#c27a3a':'#d68a4a');
          ctx.fillStyle='#fff8dc'; ctx.fillRect(Math.floor(px-capW/2+2),Math.floor(py-h-capH+2),2,1);
          ctx.fillRect(Math.floor(px+2),Math.floor(py-h-capH+1),2,1);
          ctx.fillStyle='#8b5a2b'; ctx.fillRect(Math.floor(px),Math.floor(py-1),2,2);
        }
      } else if(pl.type==='fruitTree'){
        const h=6+g2*20+_hp(4)%3;
        _bloque(ctx,px,py-h,4,h,'#5a2a0a');
        if(g2>0.22){
          const crownY=py-h-(g2*12), crownR=(g2<0.45?10:g2<0.78?16:20)+_hp(1)%4;
          _bloque(ctx,px-crownR/2,crownY,crownR,Math.round(crownR*0.75), g2<0.5?_v: g2<0.8?_tilde16(_v,-18):_vO);
          _bloque(ctx,px-crownR/2+3,crownY+3,crownR-6,4,_vC);
          if(g2>0.72){ ctx.fillStyle='#3a1a05'; ctx.fillRect(Math.floor(px+1),Math.floor(py-h+4),2,6); }
          if(g2>0.58){
            const appleY=crownY+6;
            _bloque(ctx,px-crownR/2+4,appleY,3,3,'#d91e1e'); _bloque(ctx,px+crownR/2-6,appleY+2,3,3,'#d91e1e');
            _bloque(ctx,px-2,appleY+4,3,3,'#c01818');
            ctx.fillStyle='#ff8a8a'; ctx.fillRect(Math.floor(px-crownR/2+5),Math.floor(appleY+1),1,1);
            if(g2>0.88){ _bloque(ctx,px+2,appleY-4,3,3,'#ff2a2a'); ctx.fillStyle='#ffd93d'; ctx.fillRect(Math.floor(px+3),Math.floor(appleY-3),1,1); }
          }
          _bloque(ctx,px+3,py-2,2,2,'#2a1b08');
        }
      } else if(pl.type==='sapling'){
        const h=4+g2*18+_hp(0)%3;
        _bloque(ctx,px,py-h,3,h,'#6b3a1f');
        if(g2>0.25){
          const crownY=py-h-(g2*10), crownR=(g2<0.4?6:g2<0.7?10:16)+_hp(2)%3;
          _bloque(ctx,px-crownR/2,crownY,crownR,Math.round(crownR*0.7), g2<0.4?_vC: g2<0.7?_v:_vO);
          if(g2>0.85){ _bloque(ctx,px-crownR/2-2,crownY+4,2,6,_vO); _bloque(ctx,px+crownR/2,crownY+4,2,6,_vO); }
        }
      } else {
        // lo que no sea de los tipos conocidos: un mata baja, para que ninguna planta quede invisible
        _bloque(ctx,px-2,py-4,5,4,_v);
      }
      // la fruta lista se sigue anunciando como lo que es: un punto claro en la copa, no un cartel
      if((pl.type==='berryBush' || pl.type==='mushroom' || pl.type==='fruitTree') && g>0.88 && pl.fruitCooldown<120){
        ctx.fillStyle='rgba(255,255,255,0.85)'; ctx.fillRect(Math.floor(px-1),Math.floor(py-6),2,2);
      }
    }
    for(let x=0;x<W;x+=14){
      const c=Math.floor(x/CELL);
      if(c>=0&&c<COLS && (soil[SURFACE_ROW][c]===0 || (SURFACE_ROW+1<ROWS && soil[SURFACE_ROW+1][c]===0))) continue;
      const _pl=getPlantAt(c);
      if(_pl && _pl.growth>0.62 && _pl.type!=='grassTuft') continue;
      const seed=(x*13)%7;
      const f=fertility[c]||0.5;
      // la fertilidad manda de forma estable (antes era Math.random por frame: el prado parpadeaba y
      // podian salir y desaparecer briznas sin que nadie las plantara)
      if(f<0.42 && ((x*5+3)%7)<3) continue;
      const _v=_hierbaHoy(), sway=Math.sin(time*0.015 + x*0.08)*0.6;
      const h1= 4 + (seed%4) + Math.round(f*2);
      _bloque(ctx,x+3+sway,SURFACE_Y-14-h1,2,h1, seed<2? _tilde16(_v,-26) : seed<4? _v : _tilde16(_v,18));
      if(seed%3===0 && f>0.55){ _bloque(ctx,x+7+sway*0.5,SURFACE_Y-14-(3+f*2),1,3+f*2,_tilde16(_v,10)); }
      if(f>0.78 && seed===5){ _bloque(ctx,x+10+sway,SURFACE_Y-18,2,2,'#f2f0e4'); }
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
  let cStart=0,cEnd=COLS,rStart=SURFACE_ROW,rEnd=ROWS;
  if(useZoom){cStart=Math.max(0,Math.floor(view.x/CELL)-1); cEnd=Math.min(COLS,Math.ceil((view.x+W/view.zoom)/CELL)+1); rStart=Math.max(SURFACE_ROW,Math.floor(view.y/CELL)-1); rEnd=Math.min(ROWS,Math.ceil((view.y+H/view.zoom)/CELL)+1);}
  if(!isMini && soilCacheCanvas){
    // TOP0 - EL FLASH DE LAS CUEVAS, CERRADO (2026-10-16). Como estaba montado, habia DOS pintores del
    // terreno: el cache (hueco con pared oscura) y este camino a mano (hueco CREMA '#fff1c8' y el agua).
    // El condicionante era `!soilCacheDirty`: cualquier cuadro con repintado pendiente (o sea, casi cada vez
    // que una hormiga muerde) salia pintado a mano, y al siguiente volvian el cache y el oscuro. Eso es lo
    // que el dueño vio como «un flash solo en la textura de fondo de las cuevas». Ahora el mundo principal
    // SIEMPRE se pinta desde el cache: si esta pendiente se reconstruye en este mismo cuadro y se dibuja el
    // cache, y encima solo se repasa lo que de verdad se mueve (el agua). El camino a mano queda para el
    // minimapa, que no tiene cache. Y como los dos llaman al MISMO ayudante de hueco, aunque alguien
    // vuelva a caer aqui no va a ver dos cuevas distintas.
    if(soilCacheDirty){
      try{ rebuildSoilCache(); }catch(e){ console.warn('rebuild fail',e); soilCacheDirty=false; }
    }
    ctx.imageSmoothingEnabled=false; ctx.drawImage(soilCacheCanvas, 0, 0);
    const _drawWater=_waterActive||_waterVisualActive; _waterVisualActive=false;
    if(_drawWater) for(let r=SURFACE_ROW;r<ROWS;r++) for(let c=0;c<COLS;c++){
      const _wa=water&&water[r]?(water[r][c]||0):0,_wv=waterVisual&&waterVisual[r]?(waterVisual[r][c]||0):0;
      if(_wa>0.006||_wv>0.006) pintarAguaVoxel(ctx,c,r);
    }
    if(floodBarriers.size) for(let r=rStart;r<rEnd;r++) for(let c=cStart;c<cEnd;c++){ if(floodBarriers.has(c+','+r)) pintarBarreraAgua(ctx,c,r); }
  }
  if(isMini || !soilCacheCanvas){
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
      // El hueco y el agua del minimapa salen de los mismos ayudantes que la cache: si manana se pinta
      // distinto en uno y otro lado, se ve. Hoy no se puede.
      pintarHuecoVoxel(ctx,c,r,false);
      if((_waterActive||_waterVisualActive)&&((water&&water[r]&&water[r][c]>0.006)||(waterVisual&&waterVisual[r]&&waterVisual[r][c]>0.006))) pintarAguaVoxel(ctx,c,r);
      if(floodBarriers.size&&floodBarriers.has(c+','+r)) pintarBarreraAgua(ctx,c,r);
    }
  }
  // hongos de cueva en túneles húmedos - atlas
  if(!isMini){
    for(let pl of plants){
      if(!pl.cave) continue;
      if(soil[pl.rr] && soil[pl.rr][pl.c]===0){
        // (fuera el atlas de vegetacion: la seta de cueva se pinta en bloques, como todo)
        const x=pl.c*CELL+6, y=pl.rr*CELL+8;
        const g=pl.growth;
        if(g>0.12){
          const _h=_humorPlant(pl.c*CELL,pl.rr*CELL,1);
          _bloque(ctx,x+2,y-2,2,3, pl.seca? '#8f8374' : '#d9c8b0');
          const capW=6+Math.floor(g*6)+_h%3, capH=4+Math.floor(g*2);
          _bloque(ctx,x-capW/2+3,y-2-capH,capW,capH, pl.seca? (g>0.6?'#7a6a5a':'#5a4a3f') : (g>0.6?'#8a6a9a':'#6a4a7a'));
          ctx.fillStyle='#e8d8f0'; ctx.fillRect(Math.floor(x-capW/2+4),Math.floor(y-2-capH+1),2,1);
          if(g>0.85){ ctx.fillStyle='#fff'; ctx.fillRect(Math.floor(x),Math.floor(y-2-capH),1,1); }
          // y su apoyo: la fila de abajo hace sombra sobre el suelo del tunel
          ctx.fillStyle='rgba(0,0,0,0.30)'; ctx.fillRect(Math.floor(x-capW/2+3),Math.floor(y+1),capW,1);
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
      if(stage>=1){ ctx.fillStyle='rgba(0,0,0,0.72)'; ctx.fillRect(cx+4,cy+4,2,2); ctx.fillRect(cx+6,cy+6,2,2); ctx.fillRect(cx+8,cy+8,2,2); ctx.fillRect(cx+10,cy+10,2,2); }  // la grieta, en escalones: un trazo fino no se veia a x1
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
        // El oculto ya no se anuncia con un '?' clavado encima de cada casilla: eran noventa letreros fijos
        // diciendo donde esta el botin, y el dueño lo que pidio fue que lo averiguen las hormigas. La senal
        // ahora es la propia colonia: cuando alguna pisa cerca, el bloque brilla un momento.
        let _cerca=false;
        for(const w of workers){ if(Math.abs(w.x-(rw.c*CELL+8))<CELL*3 && Math.abs(w.y-(rw.r*CELL+8))<CELL*3){ _cerca=true; break; } }
        if(_cerca){ const pulse=Math.floor(time*0.08)%2; ctx.fillStyle=pulse?'rgba(255,220,120,0.34)':'rgba(255,190,90,0.20)'; ctx.fillRect(x+3,y+3,10,10); }
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
        else if(TREASURE_DEFS[t]) bg=TREASURE_DEFS[t].color;   // y lo demas sale del propio cuadro: nada de olvidar tipos nuevos
        _bloque(ctx,x+2,y+2,12,12,bg);
        // icono pixel 8x8 centrado
        const cx=x+8, cy=y+8;
        if(TREASURE_DEFS[t] && TREASURE_DEFS[t].reliquia){
          // rombo de cuatro bloques: «esto es una maravilla», legible a x1 sin leer el cartel.
          // OJO: despues de declarar cx/cy - pintarlo antes era un ReferenceError que cortaba el cuadro.
          ctx.fillStyle='#fff8dc';
          ctx.fillRect(cx-1,cy-4,2,2); ctx.fillRect(cx-4,cy-1,2,2); ctx.fillRect(cx+2,cy-1,2,2); ctx.fillRect(cx-1,cy+2,2,2);
        }
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
          ctx.fillStyle='rgba(26,10,0,0.80)';
          if(prog > 0.15){
            // grieta 1: una X de bloques de 2 px (un trazo de ancho 1 desaparecia a x1)
            ctx.fillRect(x+4,y+4,2,2); ctx.fillRect(x+6,y+6,2,2); ctx.fillRect(x+8,y+8,2,2);
            ctx.fillRect(x+8,y+4,2,2); ctx.fillRect(x+6,y+6,2,2); ctx.fillRect(x+4,y+8,2,2);
          }
          if(prog > 0.35){
            ctx.fillRect(x+3,y+9,2,2); ctx.fillRect(x+5,y+7,2,2); ctx.fillRect(x+7,y+5,2,2); ctx.fillRect(x+9,y+3,2,2);
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
      ctx.fillStyle='rgba(60,38,12,0.34)'; ctx.fillRect(Math.floor(fx-sz/2), Math.floor(fy+sz/2)-1, sz, 1); ctx.fillRect(Math.floor(fx+sz/2)-1, Math.floor(fy-sz/2), 1, sz);   // el canto del bulto, a la manera del terreno: un borde duro, no un trazo
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
  {
    // la boca del nido: losa de bloque, con su cara de luz y su canto. El marco negro de 3 px
    // era el ultimo recuerdo del dibujo viejo: en este mundo los bultos se delimitan solos.
    const _bx=CENTER_COL*CELL+8-20, _by=SURFACE_Y-10;
    _bloque(ctx,_bx,_by,40,10,'#f4e9cf');
    ctx.fillStyle='rgba(0,0,0,0.30)'; ctx.fillRect(_bx+6,_by+3,28,5);          // el hueco, dentro
    ctx.fillStyle='#1a1208'; ctx.fillRect(_bx+8,_by+4,24,3);
  }
  if(!isMini){
    const bob = Math.sin(time*0.08)*2; // kept for subtle hole animation but no text

    // El almacen de la colonia, dibujado en su camara (tarros y montones apoyados)
    try{ dibujarAlmacen(); }catch(e){}
    const s2={x:queen.x,y:queen.y};
  }
  // inks
  if(showInk && !isMini){
    // tope SOLO de dibujo: la lista entera sigue viva para que las obreras se lean unas a otras; lo que no
    // se pinta es lo mas viejo. Borrarlas desde aqui si cambio el comportamiento de la colonia (lo probé).
    const _tin = commInks.length>90 ? commInks.slice(-90) : commInks;
    const _dejaLetra = commInks.length<=48;                          // con mucho ajetreo quedan los puntos; la letra se lee en la ficha
    for(let ink of _tin){
      const a=ink.life;
      // tinta sutil: puntito 6px con símbolo 5px y alpha bajo
      ctx.globalAlpha=a*0.58;
      ctx.fillStyle=ink.color; ctx.fillRect(Math.floor(ink.x)-3, Math.floor(ink.y)-3, 7, 7);
      ctx.fillStyle='rgba(255,255,255,0.20)'; ctx.fillRect(Math.floor(ink.x)-3, Math.floor(ink.y)-3, 7, 1);
      ctx.fillStyle='rgba(0,0,0,0.28)'; ctx.fillRect(Math.floor(ink.x)-3, Math.floor(ink.y)+3, 7, 1);
      ctx.globalAlpha=a*0.88;
      if(_dejaLetra){ ctx.fillStyle='#000'; ctx.font='bold 6px "Press Start 2P"'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(ink.sym, Math.floor(ink.x), Math.floor(ink.y)+0.5); }
      ctx.globalAlpha=1;
    }
  }
  if(showTrail && !isMini){
    // el rastro se pinta SOLO de las mas recientes: la colonia sigue oliendo todas (la lista es
    // del paso de simulacion, no del lienzo), pero 5.000 rombitos por cuadro no los mira nadie.
    const _fer = pheromones.length>1100 ? pheromones.slice(-1100) : pheromones;
    for(let p of _fer){
      if(isSolidPixel(p.x,p.y)) continue;
      const a=p.life; const isExplore=(p.type==='explore');

      ctx.globalAlpha=a*(isExplore?0.13:0.19);
      // el rastro es un rombo de bloques: ocho rellenos duros en vez de dos paths con curvas,
      // y a x1 el centro sigue leyendose porque es de 2x2, no de 1.3 px de radio
      const _px=Math.floor(p.x), _py=Math.floor(p.y), _r=isExplore?2:3;
      ctx.fillStyle= isExplore? 'rgba(120,200,150,1)' : 'rgba(255,204,0,1)';
      ctx.fillRect(_px-_r, _py-_r+1, _r*2, _r*2-2);
      ctx.fillRect(_px-_r+1, _py-_r, _r*2-2, 1);
      ctx.fillRect(_px-_r+1, _py+_r-1, _r*2-2, 1);
      ctx.globalAlpha=a*(isExplore?0.28:0.46);
      ctx.fillStyle= isExplore? 'rgba(180,235,200,1)' : 'rgba(255,232,120,1)';
      ctx.fillRect(_px-1, _py-1, 2, 2);
      ctx.globalAlpha=1;
    }
  }
  // FOODS - gota de miel pixel art pequeña, no contamina
  function drawHoneyDrop(ctx,cx,cy,amt){
    // LA MIEL EN BLOQUES (Topo: «lo mismo con la miel, super simplificada»): la gota es un escalon de tres
    // franjas - cuello, barriga y punta - con su cara clara arriba y su ambar apagado abajo. Mide 8-14 px
    // segun cuanto hay, que es la banda que pidio el dueño, y ya no hay contorno negro ni PNG que descargar.
    const col = amt>=3 ? '#ffb700' : amt===2 ? '#ffcc33' : '#ffda66';
    const w = amt>=3? 12 : amt===2? 10 : 8;
    const h = amt>=3? 14 : amt===2? 12 : 10;
    const x = Math.floor(cx - w/2), y = Math.floor(cy - h/2);
    ctx.fillStyle='rgba(0,0,0,0.22)'; ctx.fillRect(x+2, y+h, w-3, 1);                 // apoyo en el suelo
    const _cuello=Math.max(4, w-4), _y1=y+Math.round(h*0.30), _y2=y+Math.round(h*0.74);
    _bloque(ctx, x+(w-_cuello)/2, y, _cuello, Math.round(h*0.30), _tilde16(col, 24));
    _bloque(ctx, x, _y1, w, _y2-_y1, col);
    _bloque(ctx, x+2, _y2, Math.max(2,w-4), Math.max(2, y+h-_y2-1), _tilde16(col,-46));
    ctx.fillStyle='#fff8dc'; ctx.fillRect(x+2, _y1+1, 2, 1);                          // el brillo de siempre, dos pixeles
    if(amt>=3){ ctx.fillStyle='rgba(255,248,176,0.55)'; ctx.fillRect(x+w-3, _y1+2, 1, 2); }
  }
  // gancho de medida (test/voxel-objetos.js): pinta UNA gota en un lienzo suelto y dice cuanto mide el
  // bulto entero. Es la funcion de pintar de verdad, no una copia: si alguien cambia la banda de tamano, aqui salta.
  if(!window._muestraMiel){ window._muestraMiel=(amt)=>{ try{
      const c=document.createElement('canvas'); c.width=32; c.height=32; const g=c.getContext('2d');
      drawHoneyDrop(g,16,16,amt);
      const d=g.getImageData(0,0,32,32).data; let x0=99,x1=-1,y0=99,y1=-1;   // solo lo opaco: la linea de apoyo no cuenta como gota
      for(let i=0;i<d.length;i+=4){ if(d[i+3]<200) continue; const px=(i/4)%32, py=Math.floor((i/4)/32);
        if(px<x0)x0=px; if(px>x1)x1=px; if(py<y0)y0=py; if(py>y1)y1=py; }
      const _lum=(yy)=>{ let t=0,n=0; for(let px=0;px<32;px++){ const i=(yy*32+px)*4; if(d[i+3]<200) continue; t+=0.3*d[i]+0.59*d[i+1]+0.11*d[i+2]; n++; } return n? t/n : -1; };
      const _arriba=_lum(y0), _medio=_lum(Math.floor((y0+y1)/2)), _abajo=_lum(y1);
      return { w:x1-x0+1, h:y1-y0+1, x0, y0, arriba:_arriba, medio:_medio, abajo:_abajo };
    }catch(e){ return { error:e.message }; } }; }
  // CADA ALIMENTO, EL SUYO: cada tipo tiene su bulto y su podredumbre a la vista
  function drawFoodItem(ctx,cx,cy,f){
    const amt=f.amount||1, type=f.ftype||'honey', fresh=f.fresh!=null? f.fresh : 1;
    const def=FOOD_DEFS[type]||FOOD_DEFS.honey;
    const rot=1-fresh;
    // la cantidad se lee en el bulto, no con un numero escrito: cada tres unidades asoma un cuadrito al lado
    // del racimo. Los digitos sueltos por toda la despensa eran justo la mudanza de letreros que el dueño no quiere.
    const _bulto=()=>{ const q=Math.max(1,Math.min(4,Math.floor((amt-1)/3)));
      for(let i=0;i<q;i++){ const bx=Math.floor(cx+4+i*3), by=Math.floor(cy+4);
        ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(bx,by+1,3,2);
        ctx.fillStyle=i%2?'#c9a06a':'#b98f57'; ctx.fillRect(bx,by,3,2); } };
    // (los dos atlas de comida y de miel dejan de consultarse: todo esto se pinta a mano, en bloques)
    const w = amt>=3? 12 : amt===2? 10 : 8;
    const h = amt>=3? 14 : amt===2? 12 : 10;
    // CADA ALIMENTO, SU BULTO: dos tonos, luz arriba y sombra abajo, sin contorno negro. Lo que se pudre
    // se ve pudrir (la franja oscura), y lo que hay debajo del racimo es el suelo, no un numero.
    if(type==='honey'){
      drawHoneyDrop(ctx,cx,cy,amt);
      if(rot>0.5){ ctx.fillStyle='rgba(60,40,0,0.22)'; ctx.fillRect(Math.floor(cx-w/2), Math.floor(cy-h/2), w, h); }
      return;
    }
    if(type==='berry'){
      const x=Math.floor(cx-4), y=Math.floor(cy-4);
      const col = rot>0.6 ? '#4a144a' : rot>0.3? '#5a1a5a' : def.color;
      const cap = rot>0.6 ? '#6a2a6a' : def.cap;
      ctx.fillStyle='rgba(0,0,0,0.22)'; ctx.fillRect(x+1,y+9,8,1);
      _bloque(ctx,x,y,6,6,col); _bloque(ctx,x+4,y+2,4,4,_tilde16(col,26));
      ctx.fillStyle=cap; ctx.fillRect(x+1,y+1,2,1);
      if(rot>0.4){ ctx.fillStyle='rgba(0,0,0,0.35)'; ctx.fillRect(x+2,y+3,3,2); }
      if(amt>2){ _bulto(); }
      return;
    }
    if(type==='mushroom'){
      const x=Math.floor(cx-4), y=Math.floor(cy-6);
      const stemCol = rot>0.5? '#9a7a5a' : '#d9c8b0';
      const capCol = rot>0.5? '#6b4420' : def.cap;
      ctx.fillStyle='rgba(0,0,0,0.22)'; ctx.fillRect(x+1,y+10,7,1);
      _bloque(ctx,x+3,y+2,2,8,stemCol);
      _bloque(ctx,x,y,8,6,capCol);
      ctx.fillStyle='#fff8dc'; ctx.fillRect(x+1,y+1,2,1);
      if(rot>0.4){ ctx.fillStyle='rgba(40,20,0,0.35)'; ctx.fillRect(x+1,y+4,6,1); }
      return;
    }
    if(type==='apple'){
      const x=Math.floor(cx-5), y=Math.floor(cy-5);
      const col = rot>0.6 ? '#6b0f0f' : def.color;
      ctx.fillStyle='rgba(0,0,0,0.22)'; ctx.fillRect(x+1,y+8,8,1);
      _bloque(ctx,x,y,8,8,col);
      ctx.fillStyle=def.cap; ctx.fillRect(x+2,y+2,2,1); ctx.fillStyle='#fff'; ctx.fillRect(x+1,y+1,1,1);
      if(rot>0.4){ ctx.fillStyle='rgba(0,0,0,0.28)'; ctx.fillRect(x+2,y+5,4,2); }
      _bloque(ctx,x+3,y-2,2,2,'#7a4a1a');
      return;
    }
    if(type==='seed' || type==='grassSeed'){
      const x=Math.floor(cx-3), y=Math.floor(cy-3);
      ctx.fillStyle='rgba(0,0,0,0.22)'; ctx.fillRect(x,y+4,6,1);
      _bloque(ctx,x,y,4,3,def.color);
      ctx.fillStyle=def.cap; ctx.fillRect(x+1,y+1,1,1);
      if(amt>2){ _bulto(); }
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
    // respiracion: sube y baja UN bloque entero. Escalar el cuerpo con decimales (lo que
    // habia) enturbia todos los bordes de la figura mas mirada de la colonia.
    const _qb = Math.sin(time*0.006 + qi*1.7) > 0.3 ? -1 : 0;
    ctx.translate(0, _qb);
    if(queen.age>6000){ ctx.globalAlpha=0.7; }                     // vieja: se la ve mas palida
    _hormigaVoxel(ctx, queen, 1.75, isMini, qi);                   // corona aparte, la pinta el pintor
    if(!isMini && queen.progress>0){
      // la barra de puesta: un bloque negro con dentro el color de la faccion, sin contorno
      ctx.fillStyle='#000'; ctx.fillRect(-18,-40,36,5);
      ctx.fillStyle=facCol; ctx.fillRect(-17,-39, Math.max(1,Math.floor(queen.progress*0.34)),3);
    }
    if(!isMini){
      ctx.fillStyle='#000'; ctx.fillRect(-18,22,36,3);
      const lifePct=Math.max(0, 1 - queen.age/queen.maxAge);
      ctx.fillStyle= lifePct>0.5? '#2de67a' : lifePct>0.2? '#ffcc00' : '#ff3b30';
      ctx.fillRect(-18,22, Math.floor(36*lifePct),3);
    }
    ctx.globalAlpha=1;
    ctx.restore();
    if(!isMini && (queen.selected || workers.length<=8)){   // su placa sigue la norma de las obreras: detalle solo si la colonya es pequena o la tienes pinchada
      ctx.fillStyle='#000'; ctx.fillRect(qx-38,qy-34,76,14); ctx.fillStyle=facCol; ctx.fillRect(qx-37,qy-33,74,1);
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
    // la cria se pinta como lo demas: bulto, cara clara arriba y canto abajo. El borde
    // negro de 2 px hacia que cada huevo pareciera un icono de interfaz pegado en el nido.
    if(b.type==='egg'){
      _bloque(ctx,bx-6,by-8,12,14,'#fffef0');
      ctx.fillStyle='rgba(0,0,0,0.18)'; ctx.fillRect(bx-6,by-2,2,5);
    } else if(b.type==='larva'){
      _bloque(ctx,bx-8,by-4,16,8,'#f5e6c8');
      ctx.fillStyle='#8b5a2b'; ctx.fillRect(bx-5,by-1,2,1); ctx.fillRect(bx+1,by-1,2,1);
    } else {
      _bloque(ctx,bx-7,by-6,14,12,'#8b5a2b');
      ctx.fillStyle='#ffcc00'; ctx.fillRect(bx-2,by-3,4,2);
    }
    if(!isMini){
      ctx.fillStyle='#000'; ctx.fillRect(bx-8,by-14,16,5); ctx.fillStyle= b.type==='egg'?'#fffef0':b.type==='larva'?'#f5e6c8':'#b47aff'; ctx.fillRect(bx-7,by-13, Math.floor(b.progress/100*14),3);
    }
  });
  // WORKERS pixel art - BIG
  // UNA CUENTA POR CUADRO, NO POR HORMIGA. `workers.filter(w=>w.state==='CAVANDO').length`
  // estaba dentro del bucle de pintado (y tres veces): con 60 obreras eran 10.800 recorridos
  // por cuadro para saber un numero que no cambia entre relleno y relleno. Lo mismo con el
  // color de faccion, que se buscaba con .find() hormiga a hormiga.
  let _cavandoAhora = 0; for(let _w of workers){ if(_w.state==='CAVANDO') _cavandoAhora++; }
  const _facCol = new Map(); for(let _f of society.factions) _facCol.set(_f.id, _f.color);
  _bubbleOccupied=[];
  workers.forEach((ant, idx)=>{
    const _rx=ant._renderX||ant.x, _ry=ant._renderY||ant.y;
    // LO QUE NO ESTA A LA VISTA NO SE PINTA. Con x16 la camara ensena una fraccion pequena
    // del mapa y sin embargo todas las obreras pasaban por el pintor: el recorte deja el
    // cuadro en lo que cabe. La simulacion no se toca (eso corre en su propio paso) y la
    // frase pendiente se sigue consumiendo, que su reloj vive aqui dentro (vicio viejo).
    if(!isMini && useZoom){
      const _mg = 44, _an = W/view.zoom, _al = H/view.zoom;
      if(_rx < view.x-_mg || _rx > view.x+_an+_mg || _ry < view.y-_mg || _ry > view.y+_al+_mg){
        if(ant.phraseTime>0) ant.phraseTime--;
        return;
      }
    }
    // UNA HORMIGA ES UNA HORMIGA (Topo: «tienen muchas cosas encima y cuando hay muchas no se ve que estan
    // haciendo; que solo sean hormigas y al pinchar una muestre el detalle»). La burbuja de accion, la barra
    // de vida, el punto de faccion, la edad, el animo, la herramienta y las barras de progreso se pintan
    // SOLO en la que tienes seleccionada - y mientras la colonia no llegue a 9, que son los dias en los que
    // hay que aprender que significa cada senal. La carga si se ve, pero como bulto en las mandibulas: eso ya
    // es parte del cuerpo, no un letrero.
    const _solo = !(ant.selected || ant.isQueen || workers.length <= 8);
    // vision cones
    if(showEyes && !isMini && !_solo){
      const isSel=ant.selected;
      const alphaBase = isSel ? 0.22 : 0.07;
      // EL HAZ, EN BLOQUES. Antes era un abanico con bezier y linea discontinua: en el barro
      // se convertia en una mancha y cada cuadro costaba un path por hormiga. Ahora se muestrea
      // el rayo de cuatro en cuatro y se pinta un cuadrito que se ensancha al alejarse: se lee
      // por donde mira y sale mas barato (cero paths, cero dash).
      const angles=[-Math.PI/4, 0, Math.PI/4];
      const cols=['255,59,48','255,204,0','0,229,255'];
      angles.forEach((da,i)=>{
        const ang=ant.angle+da; const d=rayWallDist(ant.x, ant.y, ang, 40);
        if(d>8){
          ctx.fillStyle=`rgba(${cols[i]},${alphaBase})`;
          for(let r=6;r<d;r+=4){
            const _a = Math.max(1, Math.round(r/26));
            const _px = Math.floor(ant.x+Math.cos(ang)*r), _py = Math.floor(ant.y+Math.sin(ang)*r);
            ctx.fillRect(_px-_a, _py-_a, 1+_a*2, 1+_a*2);
          }
          if(isSel){ctx.fillStyle=`rgba(${cols[i]},0.95)`; ctx.fillRect(Math.floor(ant.x+Math.cos(ang)*d)-2, Math.floor(ant.y+Math.sin(ang)*d)-2,4,4);}
        }
      });
      const neigh=nearestWorker(ant, ant.id);
      if(neigh && dist(ant,neigh)<80 && Math.abs(ant.commOut[0])>0.42){
        // el aviso entre dos olfativas: bloque de dos en dos, con su marco de pixeles la elegida
        ctx.fillStyle=`rgba(0,229,255,${isSel?0.5:0.15})`;
        const _vx=neigh.x-ant.x, _vy=neigh.y-ant.y, _n=Math.max(2, Math.round(Math.hypot(_vx,_vy)/5));
        for(let k=1;k<_n;k++){ ctx.fillRect(Math.floor(ant.x+_vx*k/_n), Math.floor(ant.y+_vy*k/_n), 2, 2); }
        if(isSel){
          const mx=Math.floor((ant.x+neigh.x)/2), my=Math.floor((ant.y+neigh.y)/2);
          ctx.fillStyle='#000'; ctx.fillRect(mx-12,my-10,24,10);
          ctx.fillStyle='#00e5ff'; ctx.fillRect(mx-11,my-9,22,1); ctx.fillRect(mx-11,my+7,22,1);
        }
      }
    }
    // la sombra al suelo es un bloque duro: una elipse difuminada sobre el barro no se ve
    if(!isMini){ ctx.fillStyle='rgba(0,0,0,0.18)'; ctx.fillRect(Math.floor(_rx)-6, Math.floor(_ry)+8, 13, 2); }
    ctx.save(); ctx.translate(Math.floor(_rx),Math.floor(_ry));
    if(ant._climbing){ ctx.rotate(ant.angle); } else { const flip=Math.cos(ant.angle)<0?-1:1; ctx.scale(flip,1); }
    if(ant._onCeiling && !isMini){ ctx.scale(1,-1); }   // techo: boca abajo, mismo dibujo
    // tamano por caste, y en el mapa de bolsillo todo se encoge a la mitad
    const _esc = ant.isQueen? 1.75 : (ant.caste==='major'? 1.3 : ant.caste==='minim'? 0.82 : 1) * (isMini? 0.6 : 1);
    _hormigaVoxel(ctx, ant, _esc, isMini, idx);
    // la carga la pinta el propio pintor de la hormiga (ver _hormigaVoxel): es parte del cuerpo
    ctx.restore();
    if(_solo) return;                     // y hasta aqui llega la hormiga: lo demas es ficha de la elegida
    // herramienta equipada: madera y metal con su cara de luz, sin contorno negro de 3 px
    if(ant.tool && !isMini){
      const _tx=Math.floor(ant.x)+(ant._climbing?9:10), _ty=Math.floor(ant.y)-16;
      if(ant.tool==='pick'){
        _bloque(ctx,_tx,_ty+4,11,3,'#6b3a1f');
        _bloque(ctx,_tx+9,_ty+1,6,5,'#8b9bb4');
      } else if(ant.tool==='basket'){
        _bloque(ctx,_tx,_ty+2,10,7,'#c2a080');
        ctx.fillStyle='#8b5a2b'; ctx.fillRect(_tx+1,_ty+5,8,1);
        ctx.fillStyle='#fff8dc'; ctx.fillRect(_tx+2,_ty+3,1,1);
      } else if(ant.tool==='trowel'){
        _bloque(ctx,_tx,_ty+4,7,3,'#6b3a1f');
        _bloque(ctx,_tx+6,_ty+1,5,6,'#7a7a7a');
      }
    }
    // facción y ánimo - puntito de color y barra de vida
    if(!isMini){
      const facCol = _facCol.get(ant.faction) || '#ffcc00';
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
        if(ant.state==='CAVANDO' && (_cavandoAhora<=3 || ant.selected)){
          // Topo - si hay >3 cavando, no llover ⛏ individuales; se resume abajo en el strip
          const digCount = _cavandoAhora;
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
      // LOS NUMEROS DE LOS SENSORES YA NO FLotan SOBRE LA HORMIGA. Esto era un
      // ◉0.5 ◉0.0 ◉0.0 en negro y oro pegado a la elegida: los mismos decimales que ahora
      // lleva la hoja en 🧠 MENTE (ahi se leen, con nombre y sin tapar el barro). Sobre el
      // lienzo quedaba un cuadro de interfaz flotando entre las hormigas, que es justo lo que
      // se pidi6 fuera. La marca de la elegida sigue: su aura en el suelo y su flecha.
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
      ctx.fillStyle=t.color; ctx.fillRect(tx-w2/2, ty-10, w2, 14);
      ctx.fillStyle='rgba(255,255,255,0.22)'; ctx.fillRect(tx-w2/2+1, ty-9, w2-2, 1);
      ctx.fillStyle='rgba(0,0,0,0.35)'; ctx.fillRect(tx-w2/2+1, ty+2, w2-2, 1);
      ctx.fillStyle='#000'; ctx.font='7px "Press Start 2P"'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(t.txt, tx, ty-2);
      ctx.globalAlpha=1;
    }
  }
  for(let p of particles){ctx.globalAlpha=p.life;
    // astilla de tierra y migaja de miel: un bloque con su cara de luz arriba y su canto
    // abajo, exactamente la firma del terreno. Antes habia dos caminos (uno redondo y otro
    // cuadrado) y los dos se veian de familia distinta; ahora el camino es `_bloque`, el mismo
    // primitiva que el barro. Cuando el color no es hexadecimal (particulas translucidas, las
    // de la antorcha) la firma se imita a mano, porque `_tilde16` solo entiende '#rrggbb'.
    const _x=Math.floor(p.x)-1, _y=Math.floor(p.y)-1, _sz=3;
    if(/^#[0-9a-fA-F]{6}$/.test(p.color)){
      _bloque(ctx,_x,_y,_sz,_sz,p.color, p.bloque?1:0.7);
    } else {
      ctx.fillStyle=p.color; ctx.fillRect(_x,_y,_sz,_sz);
      ctx.fillStyle='rgba(255,255,255,0.26)'; ctx.fillRect(_x,_y,_sz,1);
      ctx.fillStyle='rgba(0,0,0,0.30)'; ctx.fillRect(_x,_y+_sz-1,_sz,1);
    }
  }

  // === LO QUE ARDE ABAJO Y LA LOSA QUE LOS TAPA ===
  // El magma se pinta en el cache del suelo (es estable) pero aqui va el RESPLANDOR, que parpadea: si se
  // congelara en el cache dejaria de ser lumbre. Solo se recorre la lista de casillas de fuego, no el mapa.
  if(!isMini && magmaCells.length){
    const _lat = 1 + Math.floor(time*0.06)%2;
    for(const mc of magmaCells){
      const mx=mc.x, my=mc.y;
      if(mx+CELL < _cvx || mx > _cvx+_cvw || my+CELL < _cvy || my > _cvy+_cvh) continue;
      ctx.fillStyle='rgba(255,120,30,0.13)'; ctx.fillRect(mx-CELL,my-CELL,CELL*3,CELL*3);
      ctx.fillStyle='rgba(255,190,90,0.16)'; ctx.fillRect(mx-2,my-2-_lat,CELL+4,CELL+4);
    }
  }
  // Y la losa lleva encima su barra: la colonia entera muerde la misma piedra y eso tiene que verse sin
  // abrir el panel. Dos rectangulos, ni un trazo.
  if(!isMini && umbral){
    const _uy=umbral.r*CELL-6;
    if(_uy > _cvy-12 && _uy < _cvy+_cvh){
      const _w0=Math.min(_cvw-8, COLS*CELL-8), _x0=Math.max(_cvx+4, 4);
      const _p0=Math.max(0, Math.min(1, 1-(umbral.hp/umbral.hpMax)));
      _bloque(ctx,_x0,_uy,_w0,4,'#1a140f');
      if(_p0>0.01) _bloque(ctx,_x0+1,_uy+1,Math.max(1,Math.floor((_w0-2)*_p0)),2, _p0>0.8?'#ffcc00':'#c8c8d8');
    }
  }
  ctx.globalAlpha=1;
  // clima lluvia/relámpago
  if(!isMini && (weather.type==='rain' || weather.type==='storm' || weather.type==='snow')){
    const _nev = weather.type==='snow';
    // el velo del aguacero, del temporal y de la nevada: una capa, no una textura
    ctx.fillStyle= weather.type==='storm'? 'rgba(30,40,60,0.22)' : _nev? 'rgba(214,230,244,0.15)' : 'rgba(40,50,70,0.12)';
    ctx.fillRect(_cvx,_cvy,_cvw,_cvh);
    for(let rp of weather.rainParticles){
      const rx=Math.floor(rp.x), ry=Math.floor(rp.y);
      if(_nev){
        _bloque(ctx, rx-1, ry-1, 3, 3, '#eef6ff');          // copo de tres pixeles con su luz y su sombra
      } else {
        // la gota es un rectangulo de 1 px de ancho con la punta de arriba mas clara y el pie mas oscuro:
        // el mismo sello del terreno, estirado. Antes era un trazo con lineWidth, que a x1 salia borroso.
        const _largo = weather.type==='storm'? 9 : 7;
        ctx.fillStyle='rgba(150,190,230,0.62)'; ctx.fillRect(rx, ry, 1, _largo);
        ctx.fillStyle='rgba(224,242,255,0.95)'; ctx.fillRect(rx, ry, 1, 1);
        ctx.fillStyle='rgba(80,110,160,0.60)'; ctx.fillRect(rx, ry+_largo-1, 1, 1);
      }
    }
    if(lightningTimer>0){
      const flashAlpha = lightningTimer>7? 0.45 : lightningTimer>3? 0.22 : 0.08;
      ctx.fillStyle=`rgba(255,255,220,${flashAlpha})`; ctx.fillRect(_cvx,_cvy,_cvw,_cvh);
      if(lightningTimer>8){
        // el relampago, en cuadritos de tres: y sobre todo CON POSICION FIJA mientras dura el destello.
        // Antes se echaba a suerte cada cuadro y el rayo saltaba de un lado a otro del cielo (parpadeo).
        const _sem = Math.floor(lightningTimer)*97;
        const lx=W*0.28 + ((_sem%53)/53)*W*0.44;
        ctx.fillStyle='rgba(255,255,214,0.92)';
        for(let t=0;t<8;t++){
          const _dx = ((_sem + t*13)%5) - 2 + (t%2?3:-3);
          ctx.fillRect(Math.floor(lx + _dx*(t/2)), Math.floor(t*(SURFACE_Y/8)), 3, Math.ceil(SURFACE_Y/8));
        }
      }
    }
  }
  if(useZoom) ctx.restore();
  if(!isMini){
    // LA VIÑETA, EN ESCALONES. Un degradado radial sobre todo el lienzo es el peor relleno
    // posible (tres paradas interpoladas por pixel) y AdemAs redondea el borde del mapa,
    // que en este juego es un canto. Tres anillos de bloque dan la misma idea de foco por
    // una fracciOn del coste y dejan la silueta del mundo cuadrada.
    const _gros = Math.max(12, Math.round(Math.min(W,H)*0.055));
    for(let an=0; an<3; an++){
      ctx.fillStyle = 'rgba(0,0,0,' + (0.075 - an*0.024).toFixed(3) + ')';
      const e = an*_gros;
      ctx.fillRect(e, e, W-2*e, _gros);
      ctx.fillRect(e, H-e-_gros, W-2*e, _gros);
      ctx.fillRect(e, e+_gros, _gros, Math.max(0,H-2*e-2*_gros));
      ctx.fillRect(W-e-_gros, e+_gros, _gros, Math.max(0,H-2*e-2*_gros));
    }
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
      // y en pleno invierno esa lluvia se cuaja: NIEVE. Es el unico modo de que el cielo invierno se vea
      // distinto y no solo mas gris. Es un clima de pintar: la nieve no moja (el suelo mira solo rain/storm
      // en _soilWet) ni ablanda la tierra, asi que no mueve la economia - que es lo que se queria probar.
      if(season===3 && weather.type==='rain' && Math.random()<0.6){ weather.type='snow'; weather.intensity=0.5+Math.random()*0.4; }
      try{ markSoilDirty(); }catch(e){}   // y el suelo se entera: la capa de nieve y el brillo mojado se repintan
    }
    // partículas de lluvia con gravedad real - Topo fix: cubre TODO el cielo sincronizado, no solo -12
    if(weather.type==='rain' || weather.type==='storm' || weather.type==='snow'){
      const _nev = weather.type==='snow';
      const count = weather.type==='storm'? 6 : _nev? 4 : 3;
      // y se siembran DENTRO de la franja de cielo que de verdad se ve (hasta 150 px por encima del mapa),
      // no repartidas por el vacio de arriba del todo: con el reparto viejo el aguacero tenia sus gotas
      // fuera del alcance de la camara, y nevando se enteraba uno por el velo pero no veia un solo copo.
      const _techo = -Math.round(H*0.34), _sueloGotas = SURFACE_Y + 26;
      for(let i=0;i<count;i++) weather.rainParticles.push({x:Math.random()*(COLS*CELL), y: _techo + Math.random()*(_sueloGotas - _techo), vx:_nev? -0.35+Math.random()*0.7 : -0.8+Math.random()*0.6, vy:_nev? 0.4+Math.random()*0.5 : 2+Math.random()*2, life:1, vy0:2+Math.random()*2, snow:_nev});
    }
    if(weather.rainParticles.length>280) weather.rainParticles.splice(0, weather.rainParticles.length-280);
    for(let i=weather.rainParticles.length-1;i>=0;i--){
      const rp=weather.rainParticles[i];
      // gravedad real
      rp.vy += rp.snow? 0.055 : 0.52;   // el copo cae despacio; la gota, con gravedad de verdad
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
          if(rp.snow){
            // la nieve no salpica: se queda un momento y se va, en cuadritos de 3 px
            particles.push({x:rp.x, y:SURFACE_Y-3, vx:(Math.random()-0.5)*0.25, vy:-0.15, life:1, decay:0.02, color:'#eef6ff', bloque:true});
          } else {
            particles.push({x:rp.x, y:SURFACE_Y-2, vx:(Math.random()-0.5)*1.2, vy:-1.2-Math.random()*1.0, life:1, decay:0.08, color:'#7ec8e3'});
          }
          // charco temporal que ayuda a ablandar tierra (bonus de excavación)
          if(!rp.snow && Math.random()<0.12) mound.push({x:rp.x, y:SURFACE_Y-1, h:1, isPuddle:true, life:  DAY_LENGTH*0.08});   // charcos: los hace el agua, no la nieve
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
      rp.vx += (Math.sin(time*0.02 + rp.x*0.01)*(rp.snow?0.10:0.02));
      if(rp.snow) rp.x += Math.sin(time*0.028 + rp.y*0.05)*0.55;   // y se mece, que la nieve no cae a plomo
      if(rp.y>H+20 || rp.x< -W*0.6 || rp.x> W*1.6) weather.rainParticles.splice(i,1);
      // limitar velocidad terminal
      if(rp.vy > (rp.snow? 2.1 : 14)) rp.vy = rp.snow? 2.1 : 14;
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
            brood.push({type:'egg', progress:0, genome:g, time:0, isQueen:false, faction:q.faction, mother:q.id, x:q.x+(Math.random()-0.5)*20, y:q.y+(Math.random()-0.5)*12, hunger:0, parents:[q.name||q.id,'emergencia'], parentGenomes:[q.genome.id,'-']});
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
              enforceQueenCap("se corona del bando de las nodrizas");
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
    if(foods.length===0 && economyLedger.food===0 && workers.length>0){
      if(window._foodlessTimer> DAY_LENGTH*0.75){
        window._foodlessTimer=0;
        spawnFoodSurface(CENTER_COL*CELL+8 + (Math.random()-0.5)*260,1);
        spawnFoodSurface(CENTER_COL*CELL+8 + (Math.random()-0.5)*260,1);
        pushEvent('evo','🍯 Comida salvaje brota','La naturaleza evita extinción');
          notifyCanon('🍯 RESCATE', 'Brota comida salvaje - la naturaleza ayuda', 5000);
      }
    } else if(foods.length>0 || economyLedger.food>0) window._foodlessTimer=0;

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
      if(economyLedger.food===0 && w.age>300 && Math.random()<(workers.length<=2?0.00018:0.0006)) { w.health-=0.8; if(w.health<=0 && workers.length>2) handleDeath(w,'hambre'); else if(w.health<=0) w.health=8; }
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
        addWaste(f.x, f.y);
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
// ── UN SOLO MOTOR DE CUADRO ────────────────────────────────────────────────
// El bucle se re-programaba a si mismo con requestAnimationFrame y, encima, habia DOS
// rescatadores (un setInterval cada 220 ms y un Worker cada 180 ms) que llamaban a loop()
// cuando sospechaban que el cuadro se habia atrasado. El primer cuadro siempre es lento (carga
// del mundo), asi que nacia una cadena extra; cada cadena pinta el mundo ENTERO, con lo que
// el retraso criaba cadenas y las cadenas criaban retraso. Medido en Chrome: DIEZ llamadas a
// loop por cuadro de pantalla y 68 ms de mediana por cuadro, con la colonia de siempre. Aqui
// manda un unico programador: si ya hay cuadro pedido no se pide otro, y si alguien llama a
// loop mientras el bucle esta corriendo, esa llamada se ignora en seco.
let _cuadroGen=0, _cuadroPendiente=false, _cuadroCorriendo=false;
function pedirCuadro(){
  if(_cuadroCorriendo || _cuadroPendiente) return;            // ya hay un cuadro en el aire: no se pinta dos veces
  const mi = ++_cuadroGen;
  _cuadroPendiente = true;
  requestAnimationFrame(function(ts){
    _cuadroPendiente = false;
    if(mi !== _cuadroGen) return;                              // una cadena anterior se adelanto: este cuadro sobra y se retira
    loop(ts);
  });
}
function loop(now){
  if(_cuadroCorriendo) return;
  _cuadroCorriendo=true;
  try{
  if(!_topoHasWorld){ // Topo: nada existe aún, no simular ni renderizar granja
    // solo mantener UI de menú, no avanzar tiempo
    _cuadroCorriendo=false; pedirCuadro(); return;
  }
  // passDays owns simulation while its fast-forward is running. Letting this regular loop call
  // tickStep at the same time made a “+1 day” jump race two clocks and sometimes overshoot by days.
  // Keep painting so the UI stays responsive, but leave every simulation step to fastStep().
  if(typeof _fastForwarding!=='undefined' && _fastForwarding){
    renderLoop(); _cuadroCorriendo=false; pedirCuadro(); return;
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
  }catch(e){ console.error('loop',e); }
  _cuadroCorriendo=false;
  pedirCuadro();
}
pedirCuadro();
// tick de respaldo cuando el tab está oculto: rAF se throttlea a ~1fps, este interval mantiene vivo aunque sea a 5fps
setInterval(()=>{ try{ if(!paused){ const now=performance.now(); // forzar un loop extra
  // no llamar directamente a loop para no duplicar last, solo avanzar un poco si hace mucho que no hay frame
      if(performance.now()-last > 400){ _cuadroPendiente=false; loop(performance.now()); }
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
      if(now-last > 350){ _cuadroPendiente=false; loop(now); }
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
  hudText('hFood', economyLedger.food);
  hudText('hGen', gen);
  hudText('hFit', (colonyFitness||0).toFixed(2));
  hudText('hIQ', colonyIQ);
  hudText('hQueen', queen.state);
  // Topo - economía visible con iconos
  try{
    const ef=document.getElementById('ecoFood'); if(ef) ef.textContent=economyLedger.food;
    const efi=document.getElementById('ecoFiber'); if(efi) efi.textContent=economyLedger.materials.fiber||0;
    const es=document.getElementById('ecoStone'); if(es) es.textContent=economyLedger.materials.stone||0;
    const ec=document.getElementById('ecoClay'); if(ec) ec.textContent=economyLedger.materials.clay||0;
    const ew=document.getElementById('ecoWood'); if(ew) ew.textContent=economyLedger.materials.wood||0;
    const bar=document.getElementById('economyBar'); if(bar){ bar.title=`🍯${economyLedger.food} 🌿${economyLedger.materials.fiber||0} 🪨${economyLedger.materials.stone||0} 🧱${economyLedger.materials.clay||0} 🪵${economyLedger.materials.wood||0}`; }
  }catch(e){}
  hudText('hLvl', stats.nivel);
  hudText('hXpText', `${Math.floor(stats.xp)}/${stats.xpToNext}`);
  hudStyle('hXpFill', 'width', (stats.xp/stats.xpToNext*100)+'%');
  hudText('hudFood', foods.length);
  hudText('hudDig', digs);
  hudText('hudBrood', brood.length);
  hudText('hudComms', commInks.length);
  hudText('camLabel', countChambers()+' CÁMARAS');
  // (el #timeLabel lo escribe updateCalendarWidget: un solo dueno, y ahi lleva tambien el glifo del clima)
  try{ hudText('cPop', workers.length+'/'+getMaxPopulation()+' +'+queens.length+'♛'); }catch(e){ document.getElementById('cPop').textContent=workers.length + ' +1♛'; }
  try{ hudText('cPopDetail', workers.length+'/'+getMaxPopulation()+' obreras + '+queens.length+' reina(s) - ' + brood.length + ' crías - tope '+getMaxPopulation()); }catch(e){ document.getElementById('cPopDetail').textContent=workers.length+' obreras + 1 reina - ' + brood.length + ' crías'; }
  hudText('cFood', economyLedger.food);
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
  hudText('qFert', economyLedger.food>=3? 'ALTA':'BAJA');
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
  // El numero de obreras vive en la barra de arriba (y ahi se puede pinchar para ver la lista). El que
  // habia debajo del reloj estaba repitiendo lo mismo, asi que se quita de en medio: una cifra, un sitio.
  try{ const _v=document.getElementById('velAntCount'); if(_v) _v.textContent=workers.length; }catch(e){}
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
    const wNom={clear:'clear', cloudy:'cloudy', rain:'rain', storm:'storm', snow:'snow'};
    const wEl=document.getElementById('ecoWeather'); if(wEl) wEl.textContent=glifoClima(weather.type)+' '+(wNom[weather.type]||weather.type);
    const rEl=document.getElementById('ecoRain'); if(rEl) rEl.textContent=(weather.type==='rain'||weather.type==='storm')? 'húmedo +fert':'seco';
    const plEl=document.getElementById('ecoPlants'); if(plEl) plEl.textContent=plants.length+' 🌿';
    const types={}; plants.forEach(p=> types[p.type]=(types[p.type]||0)+1);
    const typEl=document.getElementById('ecoPlantTypes'); if(typEl){
      const top=Object.entries(types).sort((a,b)=>b[1]-a[1]).slice(0,2).map(k=>k[0]).join(', ')||'-';
      typEl.textContent=top;
    }
    // === LA VITRINA y el estado de la LOSA ===
    // Dos lineas del panel del mundo que antes no existian: cuantas losas lleva rotas la colonia y que
    // maravillas sac abajo. Se reconstruye solo si cambia algo (el panel se refresca a 7 fps y una lista
    // de nodos por cuadro en cada refresco es DOM gratis que nadie pide).
    try{
      const _uEl=document.getElementById('ecoUmbral');
      if(_uEl){
        if(umbral){
          const _p=Math.max(0, Math.min(100, Math.round((1-umbral.hp/umbral.hpMax)*100)));
          _uEl.innerHTML=`<b style="color:#c8c8d8">🕳️ LOSA · ${NOMBRE_BANDA(umbral.guarda)}</b> · mordida ${_p}%`+
                         (puedeGolpearUmbral()? '' : `<span style="color:#8a5a3a"> · falta ${umbral.guarda>=5?'cantería (GEN6+IQ145)':'más boca que alimentar'}</span>`);
        } else {
          _uEl.innerHTML=`<b style="color:#ffcc00">🕳️ ${umbralesRotos} losas rotas</b> · ${NOMBRE_BANDA(bandaMax)} · el fondo ya es minable`;
        }
      }
      const _vEl=document.getElementById('ecoRelics'), _vh=document.getElementById('ecoRelicHint');
      const _sig=reliquias.length+'|'+(umbral?Math.round(umbral.hp):'x');
      if(_vh) _vh.textContent=reliquias.length? reliquias.length+' en la vitrina' : 'vacia';
      if(_vEl && _vEl.dataset.sig!==_sig){
        _vEl.dataset.sig=_sig;
        if(!reliquias.length){
          _vEl.innerHTML='<span style="color:#5a4a6a">Nada asombroso todavia. Hay que bajar a la PIZARRA o mas hondo para encontrar reliquias.</span>';
        } else {
          _vEl.innerHTML=reliquias.map(x=>{
            const _d=TREASURE_DEFS[Object.keys(TREASURE_DEFS).find(k=>TREASURE_DEFS[k].reliquia===x.tipo)||'']||{};
            const _col=_d.color||'#c8a6ff';
            return '<div style="display:flex;gap:6px;align-items:center;line-height:1.15;margin-bottom:3px" title="'+(x.lore||'')+'">'+
                   '<span style="width:9px;height:9px;flex:0 0 9px;background:'+_col+';box-shadow:1px 1px 0 #000,inset 0 1px 0 rgba(255,255,255,.4)"></span>'+
                   '<span style="color:#e9dcc0;flex:1 1 auto">'+x.tipo+'</span>'+
                   '<span style="color:#8a7a5a">piso '+x.piso+' · D'+x.dia+'</span></div>';
          }).join('')+'<div style="color:#2de67a;margin-top:2px">+'+Math.round(bonusCava*100)+'% excavación por reliquias</div>';
        }
      }
    }catch(e){}

    const mS=document.getElementById('matStone'); if(mS) mS.textContent=economyLedger.materials.stone;
    const mC=document.getElementById('matClay'); if(mC) mC.textContent=economyLedger.materials.clay;
    const mSa=document.getElementById('matSand'); if(mSa) mSa.textContent=economyLedger.materials.sand;
    const mF=document.getElementById('matFiber'); if(mF) mF.textContent=economyLedger.materials.fiber;
    const mW=document.getElementById('matWood'); if(mW) mW.textContent=economyLedger.materials.wood;
    const matsBox=document.getElementById('ecoMats'); if(matsBox){
      const hasAny = economyLedger.materials.stone+economyLedger.materials.clay+economyLedger.materials.sand+economyLedger.materials.fiber+economyLedger.materials.wood>0;
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
function _panelHojaVisible(){
  // La hoja de perfil, abierta y con su pestana 🧠 MENTE ensefando, TAMBIEN hay que repintarla: el panel
  // lateral esta sellado y si solo se mira `_panelVisible()` la hoja se quedaria con el ultimo cuadro pinte
  // y con las frases de cuando se abrio. Se responde con el id de la hormiga ensenada, que es la firma.
  try{
    const m=document.getElementById('antProfile'); if(!m || !m.getAttribute('data-open')) return null;
    const p=document.getElementById('profileTab_cerebro'); if(!p || p.style.display==='none') return null;
    return m.getAttribute('data-ant')||'';
  }catch(e){ return null; }
}
function _panelsMaybeDraw(){
  const hoja=_panelHojaVisible();
  if(!_panelVisible() && hoja===null) return;
  const now=performance.now();
  const sig=selectedAntIndex+'|'+((workers[selectedAntIndex]&&workers[selectedAntIndex].id)||'')+'|'+workers.length+'|'+(hoja||'');
  if(now-_panelsAt<140 && sig===_panelsSig) return;
  _panelsAt=now; _panelsSig=sig;
  if(_panelVisible()){ drawNN(); drawSensors(); drawChart(); }
  try{ pintarCerebroHoja(); }catch(e){}
}
// pintarRed pinta la rejilla de neuronas de UNA hormiga en el canvas que le den. Antes era el cuerpo de
// drawNN a secas; se parte en dos para que la hoja de perfil pueda ensenar la MISMA rejilla sin copiar la
// matematica (dos copias de esto se desincronizan en cuanto alguien toca un grosor, y aqui ya la toqué: la
// hoja es mas chica, asi que el cuadro y la letra llevan su propio tamano con `grande`).
function pintarRed(cv, cx, sel, o){
  o = o || {};
  const g = sel.genome || {hiddenSize:8,w1:[],w2:[]}, w = cv.width, h = cv.height;
  const B = o.grande ? 8 : 7, F = o.grande ? 9 : 7;   // medio cuadro y letra
  cx.clearRect(0,0,w,h);
  cx.fillStyle='#050505'; cx.fillRect(0,0,w,h);
  cx.fillStyle='rgba(255,204,0,0.04)'; for(let x=0;x<w;x+=8) for(let y=0;y<h;y+=8) cx.fillRect(x,y,1,1);
  const inX=B*4, hidX=w/2, outX=w-B*4;
  const inStep=(h-20)/(INPUT_SIZE-1||1), hidStep=(h-20)/(g.hiddenSize-1||1), outStep=(h-20)/(OUTPUT_SIZE-1||1);
  for(let hi=0;hi<g.hiddenSize;hi++) for(let ii=0;ii<INPUT_SIZE;ii++){
    const y1=10+ii*inStep, y2=10+hi*hidStep;
    const wv=(g.w1[hi]||[])[ii]||0; const alpha=Math.min(0.85,Math.abs(wv)*0.5+0.11);
    cx.strokeStyle=wv>0?`rgba(45,230,122,${alpha})`:`rgba(255,59,48,${alpha})`;
    cx.lineWidth=Math.min(2.5,Math.abs(wv)*1.4+0.5);
    cx.beginPath();cx.moveTo(inX+B,y1);cx.lineTo(hidX-B,y2);cx.stroke();
  }
  for(let oi=0;oi<OUTPUT_SIZE;oi++) for(let hi=0;hi<g.hiddenSize;hi++){
    const y1=10+hi*hidStep, y2=10+oi*outStep;
    const wv=g.w2[oi][hi]; const alpha=Math.min(0.85,Math.abs(wv)*0.5+0.11);
    cx.strokeStyle=wv>0?`rgba(45,230,122,${alpha})`:`rgba(255,59,48,${alpha})`;
    cx.lineWidth=Math.min(2.5,Math.abs(wv)*1.4+0.5);
    cx.beginPath();cx.moveTo(hidX+B,y1);cx.lineTo(outX-B,y2);cx.stroke();
  }
  for(let i=0;i<INPUT_SIZE;i++){
    const y=10+i*inStep; const val=Object.values(sel.sensors || {})[i]||0; const act=(val+1)/2;
    let col='rgba(45,230,122,'; if(i>=4 && i<=6) col='rgba(255,204,0,'; if(i>=9) col='rgba(0,229,255,';
    cx.fillStyle=col+(0.22+act*0.72)+')'; cx.fillRect(inX-B,y-B,B*2,B*2); cx.strokeStyle='#000'; cx.lineWidth=2; cx.strokeRect(inX-B,y-B,B*2,B*2);
    cx.fillStyle='#000'; cx.font='bold '+F+'px JetBrains Mono'; cx.textAlign='center'; cx.textBaseline='middle'; cx.fillText(i>=9?'C':(i>=4&&i<=6?'◉':'I'),inX,y+0.5);
  }
  for(let hh=0;hh<g.hiddenSize;hh++){
    const y=10+hh*hidStep; const v=sel.nnHidden[hh]||0; const act=(v+1)/2;
    cx.fillStyle=`rgba(180,122,255,${0.22+act*0.72})`; cx.shadowColor='#b47aff'; cx.shadowBlur=act*7; cx.fillRect(hidX-B,y-B,B*2,B*2); cx.shadowBlur=0;
    cx.strokeStyle='#000'; cx.lineWidth=2; cx.strokeRect(hidX-B,y-B,B*2,B*2);
    cx.fillStyle='#000'; cx.font='bold '+F+'px JetBrains Mono'; cx.textAlign='center'; cx.fillText('●',hidX,y+0.5);
  }
  const outLabels=['GIRO','VEL','CAVA','T1','T2'];
  for(let oo=0;oo<OUTPUT_SIZE;oo++){
    const y=10+oo*outStep; const v=(sel.nnOut&&sel.nnOut[oo])||0; const act=(v+1)/2;
    let col=oo===0?'#ffcc00':oo===1?'#2de67a':oo===2?'#ff3b30':oo===3?'#00e5ff':'#b47aff';
    cx.fillStyle=col; cx.globalAlpha=0.22+act*0.72; cx.fillRect(outX-B,y-B,B*2,B*2); cx.globalAlpha=1;
    cx.strokeStyle='#000'; cx.lineWidth=2; cx.strokeRect(outX-B,y-B,B*2,B*2);
    cx.fillStyle='#000'; cx.font='bold '+F+'px JetBrains Mono'; cx.textAlign='center'; cx.fillText(outLabels[oo][0],outX,y+0.5);
  }
  cx.fillStyle='rgba(255,255,255,0.32)'; cx.font=F+'px JetBrains Mono'; cx.textAlign='center';
  cx.fillText('LO QUE NOTE',inX,h-3); cx.fillText('MEZCLA',hidX,h-3); cx.fillText('LO QUE HACE',outX,h-3);
}
function drawNN(){
  const sel=workers[selectedAntIndex] || workers[0];
  if(!sel || !nnCanvas || !nctx) return;
  pintarRed(nnCanvas, nctx, sel);
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

/* =====================================================================================
   EL CEREBRO EN PALABRAS (dentro de la hoja de perfil)  ·  LA LISTA DE HORMIGAS ACTIVAS
   Topo (dueño, 2026-10-16): «dentro de la hoja de perfil es mejor, con la misma estetica;
   asegurate de que todo quepa bonito y ordenado y haz que la informacion sea facilmente
   comprensible para cada persona... quiero una lista facil de acceder de todas las hormigas
   activas, tal vez haciendo click al numero de hormigas activas».
   Dos reglas de la casa que aqui mandan: (1) el panel lateral sigue sellado - la puerta a
   estos datos es la HOJA, no un tercer sitio; (2) la rejilla la pinta `pintarRed`, la misma
   funcion de siempre, asi que no hay dos versiones del cerebro que se desincronizen.
   ===================================================================================== */
// Frases CORTAS a proposito: caben en la columna de la lista (330 px) sin que la tarea se vaya con puntos
// suspensivos, y en el cerebro son el resumen de una linea. La tarea larga, si alguien la quiere leida, esta
// en el `title` de la fila.
const MENTE_TAREAS = {
  EXPLORAR:'explores the nest', CAVANDO:'digs', VOLVER_COMIDA:'returns with food', VOLVER_TIERRA:'hauls soil',
  DESCANSAR:'rests', BUSCAR:'searches', TANDEM_LEADER:'guides another ant', TANDEM_FOLLOWER:'follows a guide',
  LLEVANDO_BASURA:'hauls waste', TRABAJAR_JARDIN:'tends the garden', IDLE:'has no task', ALIMENTAR_REINA:'shares food',
  CUIDAR_CRIA:'tends brood', PELEAR:'fights', HUÍR:'flees', CONTROLAR_AGUA:'controls a flood', HUIR_AGUA:'escapes water',
};
const _pctv = v => Math.max(0, Math.min(100, Math.round((isFinite(v)?v:0)*100)));
const _lado = a => a>0.22 ? 'to the right' : (a<-0.22 ? 'to the left' : 'straight ahead');
const _grado = v => v>0.72 ? 'strongly' : (v>0.45 ? 'decisively' : (v>0.2 ? 'slightly' : 'not at all'));
function _franja(pct, col){
  return '<div class="lm-barra"><div style="width:' + pct + '%;background:' + col + '"></div></div>';
}
function _lineaMente(etq, texto, pct, col){
  return '<div class="linea-mente"><b>' + etq + '</b><div><span>' + texto + '</span>'
       + (pct===null ? '' : _franja(pct, col)) + '</div></div>';
}
// Todo lo que sabe la hormiga, contado como se lo contarias a alguien que nunca vio el codigo.
function cerebroEnPalabras(ant){
  const s = ant.sensors || {}, out = (ant.nnOut && ant.nnOut.length) ? ant.nnOut : [0,0,0,0,0];
  const casillas = CELL || 16;
  const filas = [], nums = [], gist = [];
  // ---- lo que entra por las antenas y los ojos ----
  const dFood = Math.round((1-(s.foodDist||0))*280/casillas);
  if((s.foodDist||0) > 0.02){
    filas.push(_lineaMente('SCENT', 'Smells food ' + _lado(s.foodAngle||0) + ', about ' + dFood + ' cells away' + (dFood<=5?' — almost on top of it':(dFood>24?' — still far away':'')), _pctv(s.foodDist||0), '#2de67a'));
    gist.push('food pulls her ' + _lado(s.foodAngle||0));
  } else {
    filas.push(_lineaMente('SCENT', 'No food scent nearby', 2, '#2de67a'));
    gist.push('smells no food');
  }
  const ph = s.pheroStr || 0;
  if(ph > 0.1){
    filas.push(_lineaMente('TRAIL', 'Follows a trail ' + _lado(s.pheroAng||0) + ' (' + _pctv(ph) + '% strength): another ant passed here', _pctv(ph), '#b47aff'));
    gist.push('a trail calls her ' + _lado(s.pheroAng||0));
  } else filas.push(_lineaMente('TRAIL', 'No pheromone trail nearby', Math.max(2, _pctv(ph)), '#b47aff'));
  const ojos = [['left', s.wallLeft||0], ['ahead', s.wallCenter||0], ['right', s.wallRight||0]];
  const ciego = ojos.map(o => ({k:o[0], v:o[1]})).sort((a,b) => b.v-a.v)[0];
  const libres = ojos.filter(o => o[1] < 0.35).map(o => o[0]);
  const vista = ciego.v > 0.7 ? ('A <b style="color:#ff3b30">wall is touching her</b> on the ' + ciego.k)
            : ciego.v > 0.4  ? ('A wall is approaching on the ' + ciego.k)
            : 'Sees open ground';
  filas.push(_lineaMente('EYES', vista + (libres.length ? ' · can move ' + libres.join(' and ') : ''), _pctv(ciego.v), '#ffcc00'));
  if(libres.length) gist.push('sees space ' + libres.join(' and ')); else gist.push('is between walls');
  const fat = s.fatigue || 0;
  filas.push(_lineaMente('BODY', 'Feels ' + (fat>0.66?'very tired':(fat>0.33?'tired':'fresh')) + ' (' + _pctv(fat) + '% fatigue)' + (ant.food?' · carries food in her mandibles':''), Math.max(2, fat), '#00e5ff'));
  if(ant.food) gist.push('is carrying food'); else if(fat>0.55) gist.push('is low on energy');
  const oye = Math.max(Math.abs(s.commIn1||0), Math.abs(s.commIn2||0));
  filas.push(_lineaMente('INK', oye>0.35 ? 'Receives and reads another ant’s signal' : 'Receives no signal', Math.max(2, oye), '#ff8c00'));
  // ---- lo que decide ----
  const giro = out[0]||0, paso = ((out[1]||0)+1)/2, cava = ((out[2]||0)+1)/2, c1 = out[3]||0, c2 = out[4]||0;
  filas.push('<div class="linea-mente" style="background:#000"><b style="color:#ffcc00">DECIDES</b><div><span>'
    + (Math.abs(giro)<0.15 ? 'Keeps straight' : 'Turns ' + (giro>0?'right':'left') + ' ' + _grado(Math.abs(giro)))
    + ' · moves ' + (paso>0.78?'quickly':(paso>0.5?'at a steady pace':(paso>0.25?'at a stroll':'at a crawl')))
    + ' · ' + (cava>0.6 ? 'strong urge to dig' : (cava>0.35 ? 'mild urge to dig' : 'no urge to dig'))
    + '</span>' + _franja(Math.round(paso*100), '#2de67a') + '</div></div>');
  const concept = c1>0.6 ? 'FOOD' : (c2>0.6 ? 'HOME' : (Math.abs(c1)>0.4 ? 'DANGER' : 'HELP'));
  const muy = Math.max(Math.abs(c1), Math.abs(c2)) > 0.52;
  filas.push(_lineaMente('CALLS', muy ? 'Will paint a <b style="color:#00e5ff">' + concept + '</b> symbol to alert the others' : 'Is not calling anyone', Math.max(2, Math.round(Math.max(Math.abs(c1),Math.abs(c2))*100)), '#00e5ff'));
  if(muy) gist.push('wants to signal ' + concept.toLowerCase());
  // ---- los numeros, para el que los quiera ----
  const clave = [['foodAngle','food angle'],['foodDist','food proximity'],['pheroStr','trail strength'],['pheroAng','trail angle'],['wallLeft','left eye -45°'],['wallCenter','center eye 0°'],['wallRight','right eye +45°'],['fatigue','fatigue'],['carrying','carrying'],['commIn1','ink 1'],['commIn2','ink 2']];
  nums.push('INPUT (11 sensors, -1 to 1)');
  for(const k of clave) nums.push('  ' + k[1] + ' = ' + ((s[k[0]]||0)).toFixed(2));
  nums.push('OUTPUT (5 decisions)');
  nums.push('  turn = ' + giro.toFixed(2) + '   stride = ' + paso.toFixed(2) + '   dig = ' + cava.toFixed(2) + '   t1 = ' + c1.toFixed(2) + '   t2 = ' + c2.toFixed(2));
  nums.push('WIRING: ' + INPUT_SIZE + ' inputs → ' + ((ant.genome&&ant.genome.hiddenSize)||0) + ' hidden → ' + OUTPUT_SIZE + ' outputs · GEN ' + ((ant.genome&&ant.genome.gen)||0));
  if(gameSpeed > 8) nums.push('At x16, neural steps are skipped; left and right eye values are approximate (0.52) instead of measured.');
  return { html: filas.join(''), nums: nums.join('\n'), gist: (MENTE_TAREAS[ant.state] ? (ant.role||'worker').toLowerCase() + ' ' + MENTE_TAREAS[ant.state] : (ant.role||'worker').toLowerCase() + ' moving') + ', and ' + gist.join(', ') + '.' };
}
let _cerebroNums = false;
function _hojaPerfilAbierta(id){
  const m = document.getElementById(id);
  return !!(m && m.getAttribute('data-open'));
}
function pintarCerebroHoja(){
  if(!_hojaPerfilAbierta('antProfile') && !_hojaPerfilAbierta('queenProfile')) return;
  // Solo la hoja de la OBRERA: la red (getSensorsForAnt + forwardNN) se le corre a las obreras en su paso
  // (app.js:3441); a la reina no la mueve esa red, asi que ensenarle «lo que esta pensando» seria inventar.
  for(const [hoja, lienzo, caja, numeros, panel] of [['antProfile','profileNn','profileMind','profileMindNums','profileTab_cerebro']]){
    const pane = document.getElementById(panel); if(!pane || pane.style.display === 'none') continue;
    const m = document.getElementById(hoja); if(!m || !m.getAttribute('data-open')) continue;
    const id = m.getAttribute('data-ant'); if(!id) continue;
    const ant = workers.find(w => w.id === id) || queens.find(q => q.id === id); if(!ant) continue;
    const c = cerebroEnPalabras(ant);
    const g = document.getElementById('profileMindGist');
    if(g) g.textContent = c.gist;
    const el = document.getElementById(caja); if(el) el.innerHTML = c.html;
    const nm = document.getElementById(numeros);
    if(nm){ nm.textContent = c.nums; nm.style.display = _cerebroNums ? 'block' : 'none'; }
    const cv = document.getElementById(lienzo);
    if(cv && cv.getContext) pintarRed(cv, cv.getContext('2d'), ant, { grande: true });
  }
}
// ---- LA LISTA ----
let _rosterAbierto = false, _rosterFiltro = 'TODAS', _rosterAt = 0, _rosterVuelta = false;
const ROSTRO_GRUPOS = [['TODAS','todas'], ['REINA','♛ reinas'], ['OBRERA','🐜 obreras'], ['CHICA','· chicas'], ['SOLDADO','⚔ soldadoras']];
function _rosterDe(ant){
  if(ant.isQueen) return 'REINA';
  if(ant.caste === 'major') return 'SOLDADO';
  if(ant.caste === 'minim') return 'CHICA';
  return 'OBRERA';
}
const ROSTRO_ICO = { REINA:'♛', OBRERA:'🐜', CHICA:'·', SOLDADO:'⚔' };
function rosterActivas(){
  const todas = queens.concat(workers);
  return todas.filter(a => a && a.deathDay == null).filter(a => _rosterFiltro === 'TODAS' || _rosterDe(a) === _rosterFiltro);
}
function pintarRoster(){
  _rosterAt = performance.now();
  const cuerpo = document.getElementById('rosterCuerpo'); if(!cuerpo) return;
  const todas = queens.concat(workers);
  const por = { REINA:0, OBRERA:0, CHICA:0, SOLDADO:0 };
  for(const a of todas) por[_rosterDe(a)]++;
  const tit = document.getElementById('rosterTitle');
  if(tit) tit.textContent = '🐜 HORMIGAS ACTIVAS · ' + todas.length;
  const ch = document.getElementById('rosterFiltros');
  if(ch && !ch.dataset.montado){
    ch.dataset.montado = '1';
    ch.innerHTML = ROSTRO_GRUPOS.map(g => '<button class="chip-roster" data-f="' + g[0] + '" aria-pressed="' + (g[0]===_rosterFiltro ? 'true' : 'false') + '">' + g[1] + (g[0]==='TODAS' ? ' ' + todas.length : (por[g[0]] ? ' ' + por[g[0]] : '')) + '</button>').join('');
    for(const b of ch.querySelectorAll('[data-f]')) b.onclick = (e) => {
      e.stopPropagation(); _rosterFiltro = b.dataset.f; ch.dataset.montado = ''; pintarRoster();
    };
  } else if(ch){
    for(const b of ch.querySelectorAll('[data-f]')){ const n = b.dataset.f === 'TODAS' ? todas.length : por[b.dataset.f]; b.textContent = ROSTRO_GRUPOS.find(g => g[0] === b.dataset.f)[1] + (n ? ' ' + n : ''); b.setAttribute('aria-pressed', b.dataset.f === _rosterFiltro ? 'true' : 'false'); }
  }
  const sel = document.querySelector('#antProfile[data-open]');
  const lista = rosterActivas();
  // El refresco periodico (cada 900 ms desde el contador de la barra) NO puede estar reescribiendo las
  // filas siempre: se comia los clics que caian en medio y perdia el hover. Se compara una firma barata
  // (quien esta, que esta haciendo, su vida y su edad) y si no cambio nada, se sale sin tocar el DOM.
  const firma = _rosterFiltro + '|' + (sel ? sel.getAttribute('data-ant') : '') + '#' + lista.map(a => a.id + '|' + (a.state||'') + '|' + Math.round(a.health||0) + '|' + ((a.age||0)/DAY_LENGTH).toFixed(1)).join(',');
  if (cuerpo.dataset.firma === firma) return;
  cuerpo.dataset.firma = firma;
  const scrolled = cuerpo.scrollTop;
  const filas = lista.slice(0, 240).map(a => {
    const vida = Math.max(0, Math.min(100, Math.round(a.health || 0)));
    const edad = ((a.age || 0) / DAY_LENGTH).toFixed(1);
    const tarea = MENTE_TAREAS[a.state] || (a.state ? String(a.state).toLowerCase().replace(/_/g, ' ') : 'sin reporte');
    const completo = (a.role || 'OBRERA') + ' · ' + (MENTE_TAREAS[a.state] || (a.state ? String(a.state).toLowerCase().replace(/_/g, ' ') : 'sin reporte')) + ' · vida ' + vida + '% · ' + edad + ' días';
    return '<button class="ficha-hormiga" data-id="' + a.id + '" title="' + completo.replace(/"/g, '') + '"' + (sel && sel.getAttribute('data-ant') === a.id ? ' data-seleccionada="1"' : '') + '>'
      + '<span class="fh-caste" style="color:' + (a.isQueen ? '#ffcc00' : '#fff8dc') + '">' + ROSTRO_ICO[_rosterDe(a)] + '</span>'
      + '<span style="min-width:0"><span class="fh-nombre">' + (typeof antDisplayName==='function'?antDisplayName(a):a.id) + ' · ' + a.id + '</span>'
      + '<br><span class="fh-tarea">' + (a.role||'OBRERA') + ' · ' + tarea + '</span></span>'
      + '<span class="fh-dato" style="text-align:right">❤ ' + vida + '%<br><span style="color:#8a7a5a;font-size:9px">' + edad + ' d · GEN ' + ((a.genome&&a.genome.gen)||0) + '</span></span>'
      + '</button>';
  }).join('');
  cuerpo.innerHTML = (lista.length ? filas : '<div style="font-family:\'VT323\',monospace;font-size:16px;color:#8a7a5a;padding:6px 2px">No hay ninguna en este filtro.</div>')
    + (lista.length > 240 ? '<div style="font-family:\'VT323\',monospace;font-size:14px;color:#8a7a5a;text-align:center">…y ' + (lista.length-240) + ' más (la colonia no cabe entera en una hoja: usa los filtros)</div>' : '');
  cuerpo.scrollTop = scrolled;
  for(const b of cuerpo.querySelectorAll('.ficha-hormiga')) b.onclick = (e) => {
    e.stopPropagation();
    const a = queens.find(q => q.id === b.dataset.id) || workers.find(w => w.id === b.dataset.id);
    if(!a) return;
    _rosterVuelta = true; cerrarRoster();
    if(a.isQueen) showQueenProfile(a); else showAntProfile(a);
    const bot = document.getElementById(a.isQueen ? 'btnVolverQ' : 'btnVolver');
    if(bot) bot.style.display = 'inline-block';
  };
}
function abrirRoster(){
  const sh = document.getElementById('rosterSheet'); if(!sh) return;
  try{ cerrarInventario(); }catch(e){}
  // una hoja a la vez, tambien con los perfiles: si no, la lista se monta encima del perfil abierto y en la
  // pantalla quedan dos cabeceras de la misma columna (medido en la captura: el perfil asomaba por debajo).
  try{ closeAntProfile(true); }catch(e){}
  try{ closeQueenProfile(); }catch(e){}
  _rosterAbierto = true; sh.setAttribute('data-open','1'); sh.style.display = 'flex';
  _asentarBajoCalendario(sh);
  pintarRoster();
  const b = document.getElementById('btnRoster'); if(b) b.setAttribute('data-abierto','1');
  requestAnimationFrame(() => { sh.style.transform='translateY(0) scaleY(1)'; sh.style.opacity='1'; asentarHoja(sh); });
}
function cerrarRoster(){
  const sh = document.getElementById('rosterSheet'); if(!sh) return;
  _rosterAbierto = false; sh.removeAttribute('data-open');
  sh.style.transform = 'translateY(-12px) scaleY(0)'; sh.style.opacity = '0';
  const b = document.getElementById('btnRoster'); if(b) b.removeAttribute('data-abierto');
  setTimeout(() => { if(!_rosterAbierto) sh.style.display = 'none'; }, 240);
}
function alternarRoster(){ if(_rosterAbierto) cerrarRoster(); else abrirRoster(); }
function cerrarHojasDerecha(){ try{ cerrarRoster(); }catch(e){} }
function initRosterYCerebro(){
  const b = document.getElementById('btnRoster');
  if(b && !b.dataset.wired){ b.dataset.wired='1'; b.onclick = (e) => { if(e) e.stopPropagation(); alternarRoster(); }; }
  const c = document.getElementById('btnCloseRoster');
  if(c && !c.dataset.wired){ c.dataset.wired='1'; c.onclick = cerrarRoster; }
  const sh = document.getElementById('rosterSheet');
  if(sh && !sh.dataset.wired){ sh.dataset.wired='1'; sh.onclick = (e) => { if(e.target === sh) cerrarRoster(); }; }
  for(const idb of ['btnVolver','btnVolverQ']){
    const v = document.getElementById(idb);
    if(v && !v.dataset.wired){ v.dataset.wired='1'; v.onclick = (e) => { e.stopPropagation(); v.style.display='none'; _rosterVuelta=false; abrirRoster(); }; }
  }
  // la pestana 🧠 MENTE: al elegirla (o al pulsar «ver numeros») se pinta la hoja, no el panel sellado
  const tabs = document.getElementById('profileTabs');
  if(tabs && !tabs.dataset.cerebro){
    tabs.dataset.cerebro = '1';
    tabs.addEventListener('click', () => { try{ pintarCerebroHoja(); }catch(e){} });
  }
  const n = document.getElementById('btnCerebroNumeros');
  if(n && !n.dataset.wired){
    n.dataset.wired = '1';
    n.onclick = (e) => {
      e.stopPropagation(); _cerebroNums = !_cerebroNums;
      n.textContent = _cerebroNums ? 'a ocultar los números' : 'ver números';
      n.style.background = _cerebroNums ? '#ffcc00' : '#1a140f';
      n.style.color = _cerebroNums ? '#000' : '#8a7a5a';
      try{ pintarCerebroHoja(); }catch(err){}
    };
  }
  window.addEventListener('keydown', (e) => {
    if(e.key !== 'l' && e.key !== 'L') return;
    const t = e.target; if(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    e.preventDefault(); alternarRoster();
  });
}
initRosterYCerebro();

/* INPUTS */
let isDragging=false, dragStartScreen={x:0,y:0}, dragStartView={x:0,y:0}, hasPanned=false;
wrap.addEventListener('wheel',e=>{
  e.preventDefault();
  const rect=canvas.getBoundingClientRect();
  const sx=rect.width? (e.clientX-rect.left)/rect.width*W : W/2;
  const sy=rect.height? (e.clientY-rect.top)/rect.height*H : H/2;
  const delta= e.deltaY<0? 1.12 : 0.88;
  const nz=clamp(view.zoom*delta,0.6,3.2);
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
    setNarration(`<b>👑 ${queenDisplayName(clickedQueen)} [REINA F${clickedQueen.faction}]</b> - ${clickedQueen.personality? clickedQueen.personality.fertilidad+' fertilidad - '+clickedQueen.personality.feromona+' feromona':''} - <b>${Math.max(0,3-economyLedger.food)} 🍯</b> para huevo. <small>Click abre ficha única.</small>`);
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

document.getElementById('btnZoomIn').onclick=()=>{ setZoom(Math.min(3.2,view.zoom*1.25)); };
document.getElementById('btnZoomOut').onclick=()=>{ const minZ=getMinZoom(); setZoom(Math.max(minZ,view.zoom*0.8)); };
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
document.getElementById('btnBreed').onclick=()=>{ if(economyLedger.food<3){showNotify('error','¡FALTA COMIDA!','Necesitas <b>3 🍯</b>. Tienes <b>'+economyLedger.food+' 🍯</b>. <small>Suelta miel y espera entregas.</small>'); pushToast(queen.x,queen.y-22,'♛ 3 🍯 REQUERIDOS','#ff3b30'); return;} queen.progress=100; showNotify('ok','¡Huevo en camino!','Reina gestando.'); };
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
document.getElementById('btnLay').onclick=()=>{if(economyLedger.food>=3){queen.progress=100; showNotify('ok','¡Huevo encargado!','Gastaste 3 🍯.');}else{showNotify('error','No puedes poner huevo','Te faltan <b>'+(3-economyLedger.food)+' 🍯</b>. Tienes '+economyLedger.food+'/3.'); pushToast(queen.x,queen.y-18,'♛ FALTAN '+(3-economyLedger.food)+' 🍯','#ff3b30');}};
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
// El tope de la casa es x16 (Topo, 2026-10-15: «lo de velocidad 32 y 64, bórralo»). Los botones x32 y x64
// vivian en las dos tiras selladas por la regla MODO SOLO COLONIA - no estaban muertos, estaban SIN PUERTA:
// el bucle de abajo los cablageaba por patron de id. Se borran del markup y de los pasos, para que tampoco
// el boton turbo pueda ciclar a ellos. El juego puede seguir corriendo a 32 o 64 cuando una prueba lo pide
// (todas las condiciones son gameSpeed>8 / >1, no igualdad con 32 o 64), pero la pantalla no ofrece el paso.
const SPEED_STEPS=[1,2,4,8,16];
const SPEED_TINT={1:'var(--amber)',2:'var(--amber)',4:'#ff3b30',8:'#b47aff',16:'#ffcc00'};
function setGameSpeed(n){
  // Topo: velocidades 1..64. Los botones se repintan por patron de id, no por id concreto:
  // asi agregar o quitar un boton del markup no puede dejar un reference roto (fue lo que rompio x32).
  // Pedir un paso que la pantalla ya no ofrece (x32, x64) NO puede significar «volver a x1»: eso dejo
  // el reloj de la plaza congelado y el prado sin cavar en las pruebas, que pedian x64 para que el tiempo
  // moviese. El que pide de mas se lleva el tope de la casa; el que pide un valor suelto baja al paso
  // inmediato mas cercano. Y 0 o negativo sigue siendo x1.
  const N=SPEED_STEPS.includes(n)?n:(n>=SPEED_STEPS[SPEED_STEPS.length-1] ? SPEED_STEPS[SPEED_STEPS.length-1] : (SPEED_STEPS.filter(s=>s<=n).pop()||1));
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
  try{ if(typeof serializeSave==='function') serializeSave(true); }catch(e){}
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
  const prevTurbo = turbo;
  const wasPaused = paused;
  paused=false;
  // El progreso de cada calada se multiplica por gameSpeed (linea ~2989), no por dt. Si el salto
  // acelera solo el reloj, las obreras trabajan a x1 durante un dia simulado y no abren nada:
  // por eso el fast-forward pone la velocidad de verdad y la devuelve al terminar.
  gameSpeed=16; turbo=true;
  // The regular loop keeps rendering but does not simulate while this fast-forward owns the clock.
  let steps=0;
  let _ffWarned=false;
  const maxStepsPerFrame = 12; // para no congelar la interfaz
  function fastStep(){
    let inner=0;
    while(time < targetTime && inner < maxStepsPerFrame){
      // dt como en el loop normal pero a x64
      const dtMs = 16; // aprox 60fps
      let dt=dtMs*0.06 * 16; // x16 base para no desbordar
      // Topo: simulacion de verdad, el MISMO subdivide-pasos del bucle principal sin render.
      // Antes esto llamaba a tickStep(dt) del tiron: el reloj avanzaba pero cada hormiga solo
      // recibia un golpe de progreso por frame, o sea un dia saltado no excavaba nada.
      const _ffMax=Math.max(6, 28/Math.ceil(16/4));
      let _ffSteps=0;
      try{
        while(dt>0.001 && _ffSteps<60){ const _s=Math.min(dt,_ffMax); tickStep(_s); dt-=_s; _ffSteps++; }
        if(_ffSteps>=60 && dt>0.001) time+=dt;
      }
      catch(e){
        if(!_ffWarned){ _ffWarned=true; console.warn('[FF] tickStep fallo, adelantando solo el reloj:', e.message); }
        time += dt;
      }
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
      // Solo devuelvo la velocidad si el salto la sigue teniendo: si el jugador cambio de
      // velocidad MIENTRAS saltaba el dia, gana la eleccion del jugador, no mi prevSpeed.
      if(gameSpeed===16){ gameSpeed=prevSpeed; turbo=prevTurbo; }
      if(wasPaused) paused=true;
      try{ if(typeof serializeSave==='function') serializeSave(true); }catch(e){}
      pushToast(W/2, H/2-10, '✅ +1 DÍA simulado', '#2de67a', 1.2);
      pushEvent('evo','⏩ +1 DÍA simulado', 'Día '+Math.floor(time/DAY_LENGTH)+' - '+(typeof digs!=='undefined'?digs:'0')+' bloques cavados en total');
      markSoilDirty();
      if(typeof drawFarm==='function') try{ drawFarm(document.getElementById('farmCanvas').getContext('2d'), W, H, false); }catch(e){}
    }
  }
  fastStep();
}
// Listeners para Pass Day
document.getElementById('btnDay1')?.addEventListener('click', (e)=>{ try{ e.stopPropagation(); }catch(_){ } passDays(1); });



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
      title: "🐜 YOUR FARM",
      body: `<div style="display:flex;gap:12px;align-items:center"><div style="width:52px;height:52px;background:#fff8dc;border:3px solid #000;display:grid;place-items:center;font-size:24px;box-shadow:3px 3px 0 #000">🌍</div><div><div style="font-family:'Press Start 2P',monospace;font-size:9px;color:#ffcc00">3 ANTS + QUEEN</div><div style="font-family:'VT323',monospace;font-size:18px;color:#fff8dc;margin-top:6px;line-height:1.25">This is your observation glass. Watch them, feed them, and see how they build their world.</div></div></div>`,
      hint: "Your colony is waiting"
    },
    {
      title: "🍯 FOOD",
      body: `<div style="display:flex;gap:12px;align-items:center"><div style="width:52px;height:52px;background:#ffcc00;border:3px solid #000;display:grid;place-items:center;font-size:24px;box-shadow:3px 3px 0 #000">🍯</div><div><div style="font-family:'Press Start 2P',monospace;font-size:9px;color:#ffcc00">TAP THE MEADOW</div><div style="font-family:'VT323',monospace;font-size:18px;color:#fff8dc;margin-top:6px;line-height:1.25">Tap the meadow above to drop honey. Workers carry it home so the queen can lay eggs.</div></div></div>`,
      hint: "Tap the meadow"
    },
    {
      title: "💬 WATCH THEM",
      body: `<div style="display:flex;gap:12px;align-items:center"><div style="width:52px;height:52px;background:#000;border:3px solid #000;display:grid;place-items:center;font-size:20px;box-shadow:3px 3px 0 #000">👁️</div><div><div style="font-family:'Press Start 2P',monospace;font-size:9px;color:#2de67a">EVERY ANT SPEAKS</div><div style="font-family:'VT323',monospace;font-size:18px;color:#fff8dc;margin-top:6px;line-height:1.25">Her bubble shows what she is doing. Tap an ant to open her profile and follow her.</div></div></div>`,
      hint: "Tap an ant"
    },
    {
      title: "🌧️ A LIVING WORLD",
      body: `<div style="display:flex;gap:12px;align-items:center"><div style="width:52px;height:52px;background:#7ec8e3;border:3px solid #000;display:grid;place-items:center;font-size:22px;box-shadow:3px 3px 0 #000">🌦️</div><div><div style="font-family:'Press Start 2P',monospace;font-size:9px;color:#7ec8e3">REAL WEATHER AND TIME</div><div style="font-family:'VT323',monospace;font-size:18px;color:#fff8dc;margin-top:6px;line-height:1.25">Rain falls, wind blows, and time passes. The world keeps living while you are away.</div></div></div>`,
      hint: "It lives on its own"
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
  hudText('onNext', onIdx===ON_STEPS.length-1 ? 'START ✓' : 'NEXT →');
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
      el.innerHTML=`<div style="font-family:'Press Start 2P',monospace;font-size:10px;color:#fff;margin-bottom:12px">🐜 YOUR FARM</div><div style="font-family:'VT323',monospace;font-size:18px;color:#fff8dc">Tap the meadow to drop honey and watch the workers carry it home. Tap an ant to open her profile.</div>`;
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
  try{ _esconderVuelta(); }catch(e){}
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
    // la reina, con el mismo pintor y su corona (ver el retrato de la obrera)
    pctx.save(); pctx.translate(32,32);
    _hormigaVoxel(pctx, q, 1.5, false, q.id|0);
    pctx.restore();
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
    if(economyLedger.food>=2){
      economyLedger.debitFood(2,{reason:'player feeds queen'}); q.health=Math.min(100,q.health+18); q.mood.joy=Math.min(1,q.mood.joy+0.08); q.progress=Math.min(100,q.progress+18);
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
  modal.style.width = '326px';
  modal.style.maxWidth = 'calc(100vw - 28px)';
  modal.style.height = '';
  modal.style.maxHeight = `calc(100vh - ${(_qOff + calH + 28)}px)`;
  modal.style.border = '4px solid #000';
  modal.style.borderTop = 'none';
  modal.style.boxShadow = '6px 6px 0 #000';
  modal.style.overflow='hidden'; modal.style.overflowY='auto';
  modal.style.transformOrigin='top';
  modal.style.transform='translateY(-12px) scaleY(0)';
  modal.style.opacity='0';
  modal.style.display='block';
  modal.setAttribute('data-open','1');
  modal.setAttribute('data-queen', q.id);
  void modal.offsetWidth;
  modal.style.transition='transform 0.22s cubic-bezier(.2,.8,.2,1), opacity 0.22s';
  modal.style.transform='translateY(0) scaleY(1)';
  modal.style.overflowY='auto'; asentarHoja(modal);
  requestAnimationFrame(()=>{ asentarHoja(modal); });
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
const CAL_WEEKDAYS = ['WORKER','DIGGER','SCOUT','NURSE','WEAVER','REST'];
const CAL_WEEK_ABBR = ['WRK','DIG','SCT','NUR','WVE','RST'];
const CAL_SEASONS = [
  {id:'brote', name:'SPROUT', long:'Spring', icon:'🌱', color:'#2de67a', bg:'#1e3a1e', desc:'Sprout — everything germinates'},
  {id:'sol', name:'SUN', long:'Summer', icon:'☀️', color:'#ffcc00', bg:'#3a2d0a', desc:'Sun — heat and quick harvests'},
  {id:'cosecha', name:'HARVEST', long:'Autumn', icon:'🍂', color:'#c2a080', bg:'#3a1e0a', desc:'Harvest — berries and mushrooms'},
  {id:'escarcha', name:'FROST', long:'Winter', icon:'❄️', color:'#7ec8e3', bg:'#1a2a3a', desc:'Frost — slow and cold'}
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
    if(seasonDayEl) seasonDayEl.innerHTML='Season day<br><b>'+cal.dayOfSeason+'/12 Week '+cal.weekOfSeason+'</b>';
    if(dateFullEl) dateFullEl.textContent='DAY '+cal.dayOfSeason+' — YEAR '+cal.year;
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
      let label='DAY';
      if(cal.gameHour<4.5 || cal.gameHour>19.5) label='NIGHT';
      else if(cal.gameHour<6) label='DAWN';
      else if(cal.gameHour>19) label='DUSK';
      else if(cal.gameHour>=12 && cal.gameHour<14) label='NOON';
      dayNightEl.textContent=label;
      dayNightEl.style.color= cal.isDay? '#ffcc00' : '#7ec8e3';
    }
    drawCalClock(cal.gameHour, cal.isDay, cal.seasonIdx);
    // debug visible
    if(window._calDbg) console.log('CAL UPDATE', cal.dayOfSeason, cal.season.name, cal.hour+':'+String(cal.minute).padStart(2,'0'));
    const tl=document.getElementById('timeLabel');
    if(tl){
      const hh=String(cal.hour).padStart(2,'0'), mm=String(cal.minute).padStart(2,'0');
      // un solo dueno escribe #timeLabel: la hora, sin huecos. El tiempo que hace vive en MUNDO VIVO.
      tl.textContent=hh+':'+mm;
      tl.title= 'Day ' + cal.d + ' — ' + cal.season.long + ' — ' + (cal.isDay? 'day' : 'night');
      tl.style.color= cal.isDay? '#ffcc00' : '#7ec8e3';
    }
    const ecoAge=document.getElementById('ecoAge');
    if(ecoAge) ecoAge.textContent='Year '+cal.year+' — Day '+cal.dayOfSeason+' '+cal.season.name;
  }catch(e){ /* no crash */ }
}

// === RELOJ DE LA COLONIA - INTEGRADO 444x244 escalado a 360x198 + MINIMIZADO ===
(() => {
  const CFG_RC = { DAYS_PER_SEASON: 12, DAYS_PER_WEEK: 3, CASTES: ['WORKER','SOLDIER','SCOUT'] };
  const SEASONS_RC = [
    { id:'brote',    name:'SPROUT',  icon:'sprout', bn:'#3fa07a', bh:'#6fd0a4', bd:'#1f5c45', bar:'#58c042' },
    { id:'sol',      name:'SUN',     icon:'sun',    bn:'#f3c326', bh:'#ffe36a', bd:'#b8860b', bar:'#f0b020' },
    { id:'cosecha',  name:'HARVEST', icon:'leaf',   bn:'#c0661a', bh:'#e8923f', bd:'#7a3b0c', bar:'#e0701e' },
    { id:'escarcha', name:'FROST',   icon:'flake',  bn:'#8fbfe0', bh:'#c4e4f7', bd:'#4f84ab', bar:'#6fc3e8' }
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
  function rcPhaseOf(h){ if(h>=5&&h<10) return 'DAWN'; if(h>=10&&h<16) return 'NOON'; if(h>=16&&h<20) return 'EVENING'; return 'NIGHT'; }
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
        if(rcEl.sday) rcEl.sday.textContent=`${dayInSeason}/12 Week ${cal.weekOfSeason}`;
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
          const isNight=ph==='NIGHT';
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
  if(yearEl) yearEl.textContent='YEAR '+viewYear;
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
    cell.title=`Day ${absDay} (Year ${viewYear} — ${season.name} ${d}/12) — ${dayData.weekDay}${isToday?' — TODAY':''}`;
    grid.appendChild(cell);
  }
  if(infoEl){
    infoEl.textContent=`${calNow.season.icon} Day ${calNow.dayOfSeason} of ${calNow.season.name} — Year ${calNow.year} — ${calNow.weekDay} (Week ${calNow.weekOfSeason}/2) — ${String(calNow.hour).padStart(2,'0')}:${String(calNow.minute).padStart(2,'0')} ${calNow.isDay?'☀️ day':'🌙 night'}`;
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
    // Topo: los controles que viven dentro del propio panel (la fila de obreras lleva el boton
    // +1 DIA) no pueden abrir el calendario al pulsarlos; solo el cristal del reloj lo abre.
    if(e.target && e.target.closest && e.target.closest('button,select,input')) return;
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
    economyLedger.setFood(startReserveFood(),'initial world adjustment'); // reserva proporcional al tamaño del terreno
    if(queen) queen.progress=0;
    digs=0; mound.length=0;
    const _sf3=startSurfaceFood(); const _sp3=Math.max(24, Math.round(38*worldAreaRatio()*0.9));
    for(let i=0;i<_sf3;i++) spawnFoodSurface(CENTER_COL*CELL+8 + (Math.random()-0.5)*(_sp3*3) + (i-Math.floor(_sf3/2))*_sp3, 1+Math.floor(Math.random()*1.6));
    lastSpawn=time; // evita spawn inmediato extra
  }catch(e){ console.warn('[TOPO] ajuste mundo nuevo pospuesto', e.message); }
} else { tlog('[TOPO] ajuste de mundo nuevo diferido - se aplicará al crear/cargar'); }


// === SAVE PERSISTENTE - la granja sobrevive a recargar ===
const SAVE_KEY='antFarm_fullSave_v2';
const SAVE_VER='20261018a';
const LS_ALIVE='antfarm_worldAlive';
const LS_INGAME='antfarm_inGame';
// grids a string de digitos: 8x menos bytes que JSON de arrays (BIG 96x48 entra en localStorage)
// One base-20 character per cell keeps saves compact while preserving every physical type (0–18).
// Decimal saves from earlier builds are a strict subset, so this is also their migration path.
const _GRID_DIGITS='0123456789abcdefghij';
function _encGrid(g){
  try{
    if(!Array.isArray(g)) return [];
    return g.map(row=>{ let s=''; for(let i=0;i<row.length;i++){ const v=Math.max(0,Math.min(19,row[i]|0)); s+=_GRID_DIGITS[v]; } return s; });
  }catch(_e){ return []; }
}
function _decGrid(encoded,w,h){
  if(!Array.isArray(encoded)||!encoded.length) return null;
  const out=[];
  for(let r=0;r<encoded.length&&r<h;r++){
    const str=String(encoded[r]||''),row=new Array(w).fill(1);
    for(let c=0;c<w;c++){
      const ch=(str[c]||'').toLowerCase(),v=_GRID_DIGITS.indexOf(ch);
      row[c]=v<0?0:v;
    }
    out.push(row);
  }
  while(out.length<h) out.push(new Array(w).fill(1));
  return out;
}
function _encWater(g){ try{ if(!Array.isArray(g)) return []; return g.map(r=>{ let s='~'; for(let i=0;i<r.length;i++){ let v=Math.round(Math.max(0,Number(r[i])||0)*8); if(v>35)v=35; s+=v.toString(36); } return s; }); }catch(e){ return []; } }
function _decWater(s, w, h){ if(!Array.isArray(s)||!s.length) return null; const out=[]; for(let r=0;r<s.length && r<h;r++){ const str=String(s[r]||''), modern=str[0]==='~', off=modern?1:0; const row=new Array(w).fill(0); for(let c=0;c<w;c++){ const raw=str[c+off]; if(raw===undefined) continue; const n=modern?parseInt(raw,36):(raw.charCodeAt(0)-48); row[c]=Number.isFinite(n)?Math.max(0,n)/(modern?8:9):0; } out.push(row); } while(out.length<h) out.push(new Array(w).fill(0)); return out; }

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
      time, gen, colonyIQ, colonyFood:economyLedger.food, digs, deliveries, accidents, rewardsFound, mutations, commsCount, worldAge,
      ROWS, COLS, SURFACE_ROW, worldSeed,
      ancientSites:Array.isArray(ancientSites)?ancientSites.map(s=>({id:s.id,c:s.c,r:s.r,depth:s.depth,w:s.w,h:s.h,style:s.style,kind:s.kind,biome:s.biome,damage:s.damage,flood:s.flood,cycle:s.cycle,scar:s.scar,repairStyle:s.repairStyle,repairRate:s.repairRate,oddity:s.oddity||0,muralSeed:s.muralSeed})):[],
      ancientMasonry:Array.isArray(ancientMasonry)?ancientMasonry.slice(0,1800).map(m=>({c:m.c,r:m.r,style:m.style,site:m.site,scar:m.scar||''})):[],
      soil:_encGrid(soil), soilType:_encGrid(soilType), water:_encWater(water),
      floodBarriers:[...floodBarriers].slice(0,240),
      fertility: Array.isArray(fertility)? fertility.map(v=>Math.round((v||0)*100)) : [],
      plants: Array.isArray(plants)? plants.slice(0,160).map(p=>({c:p.c,x:p.x,y:p.y,type:p.type,growth:p.growth,age:p.age,fc:p.fruitCooldown,v:p.variant})) : [],
      hiddenRewards: Array.isArray(hiddenRewards)? hiddenRewards.map(h=>({c:h.c,r:h.r,type:h.type,found:!!h.found,x:h.x,y:h.y,tier:h.depthTier})) : [],
      // la escalera: que banda tiene abierta la colonia, que hay en la vitrina y cuanto aguanta la losa
      bandaMax, umbralesRotos, bonusCava,
      reliquias: Array.isArray(reliquias)? reliquias.map(x=>({tipo:x.tipo,piso:x.piso,dia:x.dia,gen:x.gen,lore:x.lore,bonus:x.bonus})) : [],
      umbral: umbral? {r:umbral.r, hp:Math.round(umbral.hp*10)/10, hpMax:umbral.hpMax, banda:umbral.banda} : null,
      foods: Array.isArray(foods)? foods.slice(0,90).map(f=>({x:f.x,y:f.y,amount:f.amount,max:f.max,ftype:f.ftype,grounded:!!f.grounded})) : [],
      mound: Array.isArray(mound)? mound.filter(m=>m && !m.isPuddle).slice(0,300).map(m=>({x:m.x,y:m.y,h:m.h})) : [],
      // Topo: JSON.stringify ya serializa profundo; los spreads ({...w}) copiaban cada hormiga DOS veces
      workers, queens, brood, fungusGardens, wastePiles, structures,
      queen: queen|| null,
      worldMaterials: {...economyLedger.materials},
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
    const _sig=(time|0)+'|'+digs+'|'+economyLedger.food+'|'+workers.length+'|'+deliveries+'|'+_soilRev;
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
    worldSeed=worldSeed32(data.worldSeed||Math.floor(Math.random()*4294967296));
    worldProfile=createWorldProfile(worldSeed,COLS);
    ancientSites=Array.isArray(data.ancientSites)?data.ancientSites.map(s=>Object.assign({},s,{r:Number.isFinite(Number(s.r))?Number(s.r):SURFACE_ROW+(Number(s.depth)||0)})):[];
    ancientMasonry=Array.isArray(data.ancientMasonry)?data.ancientMasonry.map(m=>({...m})):[];
    rebuildAncientIndexes();
    geologyHost=_buildGeologyRows(0,ROWS).hosts;
    try{ const cv=document.getElementById('farmCanvas'); if(cv){ cv.width=W; cv.height=H; if(cv.getContext) cv.getContext('2d').imageSmoothingEnabled=false; } }catch(e){}
    try{ initSoilCache(); if(soilCacheCanvas){ soilCacheCanvas.width=W; soilCacheCanvas.height=H; if(soilCacheCtx) soilCacheCtx.imageSmoothingEnabled=false; } }catch(e){}
    // 2) grids
    const s=_decGrid(data.soil, COLS, ROWS); if(!s) return false; soil=s;
    let st=_decGrid(data.soilType, COLS, ROWS); if(!st){ st=Array.from({length:ROWS},(_,r)=>Array.from({length:COLS},(_,c)=> r<SURFACE_ROW?0:1)); } soilType=st;
    let wt=_decWater(data.water, COLS, ROWS); if(!wt) wt=Array.from({length:ROWS},()=>new Array(COLS).fill(0)); water=wt;
    waterVisual=water.map(row=>row.map(v=>Math.min(1,Math.max(0,Number(v)||0)))); waterFlow=new Map();
    _waterActive=water.some(row=>row.some(v=>v>0.0001)); _waterVisualActive=_waterActive;
    floodBarriers.clear(); if(Array.isArray(data.floodBarriers)) for(const key of data.floodBarriers){ const p=String(key).split(',').map(Number); if(p.length===2&&p.every(Number.isInteger)&&p[0]>=0&&p[0]<COLS&&p[1]>=0&&p[1]<ROWS) floodBarriers.add(p[0]+','+p[1]); }
    if(Array.isArray(data.fertility) && data.fertility.length) fertility=data.fertility.map(v=>(v||0)/100);
    else fertility=Array.from({length:COLS},()=>0.55);
    while(fertility.length<COLS) fertility.push(0.55);
    // 3) entidades
    workers = Array.isArray(data.workers)? data.workers : [];
    workers.forEach(w=>{ w.selected=false; if(w.digTarget===undefined) w.digTarget=null; delete w.floodTarget; delete w.floodWork; if(w.state==='CONTROLAR_AGUA'||w.state==='HUIR_AGUA') w.state='EXPLORAR'; });
    try{ floodControl.target=null; floodControl.workerId=null; floodControl.scan=0; floodControl.worldKey=''; }catch(e){}
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
    // --- la escalera vuelve como estaba (o se repone la losa: un guardado viejo no la tiene y sin losa
    //     el mundo se queda sin techo, que es justo lo que el umbral evita) ---
    bandaMax = Math.max(0, data.bandaMax|0); umbralesRotos = Math.max(0, data.umbralesRotos|0);
    reliquias = Array.isArray(data.reliquias)? data.reliquias.map(x=>{ const tipo=LEGADO_RELIQUIA[x.tipo]||(x.tipo==='Nest of the Old Colony'?'Worked Chamber Fragment':x.tipo); return {tipo,nombre:tipo,piso:x.piso|0,dia:x.dia|0,gen:x.gen|0,lore:x.lore||'',bonus:x.bonus||0.02}; }) : [];
    bonusCava = Math.min(0.30, Number(data.bonusCava)||reliquias.reduce((a,x)=>a+(x.bonus||0),0));
    umbral = null;
    try{
      if(data.umbral && soil[data.umbral.r] && soilType[data.umbral.r] && soilType[data.umbral.r][2]===17){
        umbral={r:data.umbral.r|0, c0:2, c1:COLS-3, hp:Number(data.umbral.hp)||UMBRAL_HP(data.umbral.banda|0),
                hpMax:Number(data.umbral.hpMax)||UMBRAL_HP(data.umbral.banda|0), banda:data.umbral.banda|0};
      } else if(Array.isArray(soilType) && soilType.length && soilType[soilType.length-1] && soilType[soilType.length-1][2]!==17){
        colocarUmbral();
      }
      reindexMagma();
    }catch(e){ console.warn('escalera al cargar', e); }
    mound = Array.isArray(data.mound)? data.mound.map(m=>({x:m.x,y:m.y,h:m.h})) : [];
    economyLedger.replaceMaterials(data.worldMaterials||{},'load save'); inventions = data.inventions||inventions;
    society = data.society||society; pantryPos = data.pantryPos||{x:CENTER_COL*CELL+8,y:(SURFACE_ROW+8)*CELL+8};
    if(data.stats) stats = {...stats, ...data.stats};
    if(data.weather && typeof data.weather==='object'){ weather.type=data.weather.type||'clear'; weather.intensity=data.weather.intensity||0; weather.nextChange=data.weather.nextChange||800; weather.rainParticles=[]; }
    if(Array.isArray(data.events)){ events.length=0; data.events.forEach(e=>events.push(e)); }
    time = data.time||time; gen = data.gen||gen; colonyIQ = data.colonyIQ||colonyIQ;
    if(data.colonyFood!==undefined) economyLedger.setFood(data.colonyFood,'load save'); digs = data.digs||digs;
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
  try{ detectarEntrada(); }catch(e){ console.warn('entrada', e.message); } // el sitio elegido se respeta
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
      // Topo: antes, con cero obreras y reina viva, el numero saltaba a 1 y el lote de UI ponia 0
      // en el turno siguiente: el contador titilaba entre 0 y 1. El letrero dice OBRERAS ACTIVAS,
      // asi que aqui solo se cuentan obreras; la reina tiene su propio sitio.
      const v=document.getElementById('velAntCount'); if(v) v.textContent=n;
      if(_rosterAbierto && performance.now()-_rosterAt>900) pintarRoster();   // la lista se refresca si esta abierta
      const tb=document.getElementById('tbPop'); if(tb) tb.textContent=n;
      const hPop=document.getElementById('hPop'); if(hPop && typeof getMaxPopulation==='function'){ try{ hPop.textContent=n+'/'+getMaxPopulation(); }catch(e){ hPop.textContent=n; } }
      updateEcoHud();
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
      const when = mins<1? 'seconds ago' : mins<60? mins+' min ago' : mins<1440? Math.floor(mins/60)+'h ago' : Math.floor(mins/1440)+'d ago';
      btn.innerHTML='▶ CONTINUE · DAY '+meta.day+' · '+meta.cols+'×'+meta.rows+' · '+meta.pop+' 🐜 <span style=\"font-size:7px;color:#1a140f\">('+when+')</span>';
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
    }, 1500);   // 1,5 + 0,82 = 2,3 s de logo: lo que dura la animacion de la pantalla de inicio
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
          const when = !meta.savedAt? '-' : mins<1? 'seconds ago' : mins<60? mins+' min ago' : mins<1440? Math.floor(mins/60)+'h ago' : new Date(meta.savedAt).toLocaleString('en-US');
          saves.push({key:SAVE_KEY, label:'MY FARM', size:meta.cols+'×'+meta.rows, day:meta.day, pop:meta.pop, when});
        }
        for(const k of ['antfarm_save_v4','antfarm_save_v3','antfarm_save_v2','antfarm_save']){
          const raw=localStorage.getItem(k); if(!raw) continue;
          try{ const d=JSON.parse(raw); if(!d || !Array.isArray(d.workers) || !d.workers.length) continue;
            saves.push({key:k, label:'LEGACY SAVE', size:(d.COLS||64)+'×'+(d.ROWS||36), day:d.day||1, pop:d.workers.length, when:d.savedAt? new Date(d.savedAt).toLocaleString('en-US') : 'no date'});
          }catch(e){}
        }
      }catch(e){ console.warn('loadList',e); }
      if(!saves.length){
        const empty=document.createElement('div');
        empty.style.cssText='padding:22px 10px;text-align:center;font-family:VT323,monospace;font-size:15px;color:#8a7a5a';
        empty.innerHTML='There are no saved farms yet.<br><span style="color:#5a4a3a;font-size:12px">Create one from the menu; it will save itself every 4 seconds.</span>';
        list.appendChild(empty);
        const b=document.createElement('button');
        b.className='pixel-btn primary'; b.style.cssText='width:100%;justify-content:center'; b.textContent='➕ CREATE NEW FARM';
        b.onclick=()=> show(createSc);
        list.appendChild(b);
      }
      topoListFarms().forEach(f=>{
        const ago=f.savedAt? Math.max(0,Date.now()-f.savedAt):0; const mins=Math.floor(ago/60000);
        saves.push({ key:'ARCHIVE:'+f.id, label:'📦 '+f.label, size:f.cols+'×'+f.rows, day:f.day, pop:f.pop,
                     when: mins<1?'seconds ago': mins<60? mins+' min ago' : mins<1440? Math.floor(mins/60)+'h ago' : new Date(f.savedAt).toLocaleString('en-US') });
      });
      saves.forEach(s=>{
        const div=document.createElement('div');
        div.style.cssText='background:#000;border:2px solid #000;padding:8px;display:flex;flex-direction:column;gap:6px';
        div.innerHTML=`<div style="font-family:'Press Start 2P',monospace;font-size:7px;color:#ffcc00">${s.label} · ${s.size}</div><div style="font-family:'VT323',monospace;font-size:13px;color:#c9b896">Day ${s.day} · ${s.pop} ants · saved ${s.when}</div><div style="display:flex;gap:6px"><button class="pixel-btn small" data-load="${s.key}" style="flex:1">▶ LOAD</button><button class="pixel-btn small" data-del="${s.key}" style="background:#1a0f00;color:#8a7a5a">🗑</button></div>`;
        list.appendChild(div);
      });
      setTimeout(()=>{
        list.querySelectorAll('[data-load]').forEach(b=>{
          b.onclick=()=>{
            let k=b.getAttribute('data-load');
            b.textContent='⏳ LOADING...';
            try{
              if(k && k.indexOf('ARCHIVE:')===0){
                const id=k.slice(8);
                if(!topoRestoreFarm(id)){ b.textContent='✕ CORRUPTED ARCHIVE'; b.disabled=true; return; }
                k=SAVE_KEY;
              }
              if(k && k!==SAVE_KEY){
                const raw2=localStorage.getItem(k);
                if(raw2){ const d=JSON.parse(raw2); if(d && d.workers) localStorage.setItem(SAVE_KEY, JSON.stringify(d)); }
              }
            }catch(e){}
            const ok = topoResumeGame({silent:false});
            if(!ok){ b.textContent='✕ CORRUPTED — CREATE ONE'; b.disabled=true; console.warn('[TOPO] load failed', k); }
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
    head.textContent='ACTIVE FARM';
    box.appendChild(head);
    const a=document.createElement('div');
    a.style.cssText="font-family:'VT323',monospace;font-size:13px;color:#c9b896";
    a.textContent = cur? ('Day '+cur.day+' · '+cur.pop+' ants · '+cur.cols+'×'+cur.rows) : 'none yet';
    box.appendChild(a);
    const list=(typeof topoListFarms==='function')? topoListFarms():[];
    if(list.length){
      const h2=document.createElement('div');
      h2.style.cssText="font-family:'Press Start 2P',monospace;font-size:7px;color:#ffcc00;margin-top:6px";
      h2.textContent='ARCHIVED ('+list.length+')';
      box.appendChild(h2);
      list.forEach(f=>{
        const row=document.createElement('div');
        row.style.cssText='display:flex;gap:6px;align-items:center';
        row.innerHTML=`<span style="flex:1;font-family:'VT323',monospace;font-size:12px;color:#8a7a5a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${f.label}</span>`;
        const lb=document.createElement('button'); lb.className='pixel-btn small'; lb.textContent='▶'; lb.title='Switch to this farm';
        lb.onclick=()=>{ if(topoRestoreFarm(f.id)) topoResumeGame({silent:false}); };
        const db=document.createElement('button'); db.className='pixel-btn small'; db.textContent='🗑'; db.style.cssText='background:#1a0f00;color:#8a7a5a'; db.title='Delete from archive';
        db.onclick=()=>{ topoDeleteFarm(f.id); renderSettingsFarms(); };
        row.appendChild(lb); row.appendChild(db); box.appendChild(row);
      });
    }
    const w=document.getElementById('btnWipeSave');
    if(w) w.onclick=()=>{ gameConfirm('Delete everything?', 'The active farm and the entire archive will be erased. This cannot be undone.', ()=>{ try{ localStorage.removeItem(FARMS_KEY); }catch(e){} try{ if(window._clearSave) window._clearSave(); }catch(e){} try{ renderSettingsFarms(); }catch(e){} }); };
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

// === HUD DE RESERVAS E INVENTARIO ===
// Topo (pedido del dueño): la colonia tiene que ver su moneda -cuanta miel y cuantos materiales hay
// dentro del nido- sin abrir un libro, y tiene que poder entrar al detalle desde el mismo sitio donde
// se cuentan las obreras activas. Los numeros viven aqui; la barra de arriba se retiro para no decir
// lo mismo dos veces, y el detalle no se apila encima del perfil de una hormiga (uno u otro).
function _ecoTxt(id, v){ const e=document.getElementById(id); if(e && e.textContent!==String(v)) e.textContent=String(v); }
let _invAbierto=false;
function updateEcoHud(){
  try{
    _ecoTxt('velFoodCount', Math.max(0, Math.floor(economyLedger.food)));
    _ecoTxt('velMatFiber', Math.max(0, Math.floor(economyLedger.materials.fiber||0)));
    _ecoTxt('velMatStone', Math.max(0, Math.floor(economyLedger.materials.stone||0)));
    _ecoTxt('velMatClay',  Math.max(0, Math.floor(economyLedger.materials.clay||0)));
    _ecoTxt('velMatWood',  Math.max(0, Math.floor(economyLedger.materials.wood||0)));
    _ecoTxt('velMatSand',  Math.max(0, Math.floor(economyLedger.materials.sand||0)));
    _ecoTxt('velMatRooms', storageCells().length);
    if(_invAbierto) pintarInventario();
  }catch(e){ /* un nodo que falte no puede parar el bucle */ }
}
function _filaInv(icono, nombre, valor, nota, color){
  return '<div style="display:flex;align-items:center;gap:7px;background:#000;border:2px solid #000;padding:5px 6px">'
    + '<span style="font-size:13px;line-height:1;filter:drop-shadow(1px 1px 0 #000)">'+icono+'</span>'
    + '<span style="flex:1;min-width:0;font-family:\'VT323\',monospace;font-size:14px;color:#c9b896;letter-spacing:0.3px">'+nombre
    + (nota? '<br><span style="font-size:11px;color:#7a6a4e">'+nota+'</span>' : '')+'</span>'
    + '<b style="font-family:\'Press Start 2P\',monospace;font-size:11px;color:'+(color||'#ffcc00')+';text-shadow:1px 1px 0 #000">'+valor+'</b></div>';
}
function pintarInventario(){
  const body=document.getElementById('invBody'); if(!body) return;
  const celdas=storageCells(), p=storagePos(), cap=capacidadAlmacen();
  const miel=Math.max(0, Math.floor(economyLedger.food));
  const lleno=Math.max(0, Math.min(100, Math.round(miel/Math.max(1,cap)*100)));
  let html='';
  html += '<div style="background:#2a0f00;border:3px solid #000;padding:7px 8px">'
    + '<div style="display:flex;align-items:baseline;gap:6px"><span style="font-size:16px">🍯</span>'
    + '<b style="font-family:\'Press Start 2P\',monospace;font-size:16px;color:#ffcc00;text-shadow:1px 1px 0 #000">'+miel+'</b>'
    + '<span style="font-family:\'VT323\',monospace;font-size:13px;color:#c9b896">rations · capacity '+cap+'</span></div>'
    + '<div style="height:7px;background:#000;border:2px solid #000;margin-top:6px"><div style="height:100%;width:'+lleno+'%;background:linear-gradient(90deg,#ffcc00,#ff8c00)"></div></div>'
    + '</div>';
  html += '<div style="font-family:\'VT323\',monospace;font-size:12px;color:#7a6a4e;line-height:1.25">Saved in '
    + (celdas.length? '<b style="color:#c9b896">'+celdas.length+' '+(celdas.length===1?'cell':'cells')+'</b> of chamber <b style="color:#c9b896">['+Math.floor(p.x/CELL)+','+Math.floor(p.y/CELL)+']</b>' : '<b style="color:#ff8c00">no excavated chamber</b>')
    + (granerosConstruidos()? ' · granaries: '+granerosConstruidos() : '') + '</div>';
  for(const d of _MAT_DEFS){
    html += _filaInv(d.icon, d.n, Math.max(0, Math.floor(economyLedger.materials[d.k]||0)), d.sirve, '#fff8dc');
  }
  try{
    const herramientas={pick:['⛏','PICK'],basket:['🧺','BASKET'],trowel:['🪝','TROWEL']};
    const partes=[];
    for(const k in herramientas){ const n=workers.filter(w=>w.tool===k).length; if(n) partes.push(herramientas[k][0]+' '+herramientas[k][1]+' ×'+n); }
    const estructur=structures.filter(st=>st&&st.built!==false).length;
    if(partes.length||estructur) html += '<div style="font-family:\'VT323\',monospace;font-size:12px;color:#7a6a4e;line-height:1.3">'
      + (partes.length? partes.join(' · ')+'<br>':'') + (estructur? 'standing structures: <b style="color:#c9b896">'+estructur+'</b>' : '') + '</div>';
    const crias=brood.length;
    html += '<div style="font-family:\'VT323\',monospace;font-size:12px;color:#7a6a4e">brood in chamber: <b style="color:#c9b896">'+crias+'</b> · accumulated waste: <b style="color:#c9b896">'+wastePiles.length+'</b></div>';
  }catch(e){}
  if(body.dataset.stamp!==html){ body.innerHTML=html; body.dataset.stamp=html; }
}
// Topo (dueño, 2026-10-15): «en el menu del inventario o almacen quiero que puedas scrollear, porque hay
// muchos items y algunos no se pueden ver». Habia dos cosas mal. Una de caja: la hoja del almacen cortaba
// su lista contra el borde y el `overflow-y:auto` del cuerpo no tenia nada que scrollear (el envoltorio
// interior pedian `min-height:100%`, que contra un padre de altura auto no resolve, asi que la caja nunca
// quedaba limitada). Y otra de cuentas: el alto maximo se calculaba con `calendarWidget.offsetHeight` en el
// instante de abrir - si el calendario aun estaba montando, la cuenta salia corta y la hoja se salia por
// abajo de la pantalla, que es justo lo que queda invisibles. `asentarHoja` usa el borde superior REAL de
// la hoja (medido despues de pintar) y deja que lo que no cabe se recorra.
// Las hojas de la esquina superior derecha arrancan JUSTO debajo del calendario, midido (no a pulso): si se
// las deja con un `top` fijo, en cuanto el calendario crece o se pliega la hoja se mete debajo y su cabecera
// queda under un widget con mas z-index - el click y la rueda se los lleva el reloj, y la lista parece no
// scrollear. Se usa el borde inferior real del widget; si no hay widget (modo plegado), se va a la barra.
function _asentarBajoCalendario(el){
  if(!el) return 0;
  try{
    const cal=document.getElementById('calendarWidget');
    const bar=document.getElementById('velAntBar');
    const r=cal? cal.getBoundingClientRect() : null;
    const bajo=r && r.bottom>0 ? Math.round(r.bottom+6) : (bar? Math.round(bar.getBoundingClientRect().bottom+6) : 76);
    el.style.top = bajo + 'px';
    return bajo;
  }catch(e){ return 0; }
}
function asentarHoja(el){
  if(!el) return 0;
  try{
    // Ojo: durante la apertura la hoja viene con `translateY(-12px)` y la animacion la deja 12 px mas
    // abajo. Medir el borde con getBoundingClientRect ahi da un topo cortito y la hoja se sale por abajo
    // de la pantalla (medido: de 228 a 628 en una ventana de 620). Se lee el `top` de layout, que no
    // conoce de transformaciones.
    const st=parseFloat(getComputedStyle(el).top);
    const top=isFinite(st)&&st>0? st : Math.round(el.getBoundingClientRect().top);
    if(!(top>0)) return 0;
    const alto=Math.max(180, (window.innerHeight||800) - top - 10);
    // ...y con `!important`, porque el CSS de la hoja de perfil declara su max-height asi (una regla
    // importante del estilo gana a un style inline normal: medido, la hoja seguia midiendo 400 px con
    // 382 pedidos). Con important declarada en la hoja misma, la cuenta de arriba es la que manda.
    el.style.setProperty('max-height', alto+'px', 'important');
    const oy=getComputedStyle(el).overflowY;
    if(oy!=='auto' && oy!=='scroll') el.style.overflowY='auto';
    el.style.overscrollBehavior='contain';   // y la rueda no se escapa al mundo
    return alto;
  }catch(e){ return 0; }
}
function abrirInventario(){
  const sh=document.getElementById('invSheet'); if(!sh) return;
  try{ closeAntProfile(); }catch(e){}
  try{ closeQueenProfile(); }catch(e){}
  _invAbierto=true; sh.setAttribute('data-open','1'); sh.style.display='flex';
  _asentarBajoCalendario(sh);
  pintarInventario();
  requestAnimationFrame(()=>{ sh.style.transform='translateY(0) scaleY(1)'; sh.style.opacity='1'; asentarHoja(sh); });
}
function cerrarInventario(){
  const sh=document.getElementById('invSheet'); if(!sh) return;
  _invAbierto=false; sh.removeAttribute('data-open');
  sh.style.transform='translateY(-12px) scaleY(0)'; sh.style.opacity='0';
  setTimeout(()=>{ if(!_invAbierto) sh.style.display='none'; }, 240);
}
window.abrirInventario=abrirInventario; window.cerrarInventario=cerrarInventario;
// el calendario se pliega con — (y cambia de alto): las hojas abiertas se vuelven a sentar debajo
try{ document.getElementById('calCollapseBtn') && document.getElementById('calCollapseBtn').addEventListener('click', ()=>{
  requestAnimationFrame(()=>{ for(const id of ['invSheet','rosterSheet','antProfile','queenProfile']){ const e=document.getElementById(id); if(e && (e.getAttribute('data-open')||e.classList.contains('open'))){ _asentarBajoCalendario(e); asentarHoja(e); } } });
}); }catch(e){}
function initInventarioHud(){
  const b=document.getElementById('btnInventory');
  if(b && !b.dataset.wired){ b.dataset.wired='1'; b.onclick=(e)=>{ if(e) e.stopPropagation(); if(_invAbierto) cerrarInventario(); else abrirInventario(); }; }
  const c=document.getElementById('btnCloseInv');
  if(c && !c.dataset.wired){ c.dataset.wired='1'; c.onclick=cerrarInventario; }
  const sh=document.getElementById('invSheet');
  if(sh && !sh.dataset.wired){ sh.dataset.wired='1'; sh.onclick=(e)=>{ if(e.target===sh) cerrarInventario(); }; }
  const go=document.getElementById('btnInvGo');
  if(go && !go.dataset.wired){ go.dataset.wired='1'; go.onclick=()=>{
    try{ const p=storagePos(); const b2=getPanBounds(); view.x=clamp(p.x - W/view.zoom/2, b2.minX, b2.maxX); view.y=clamp(p.y - H/view.zoom/2, b2.minY, b2.maxY); clampView(); pushToast(p.x, p.y-18, '🍯', '#ffcc00', 1.4); }catch(e){}
  }; }
  window.addEventListener('keydown', e=>{
    if(e.key==='Escape' && _invAbierto){ cerrarInventario(); return; }
    if((e.key==='i'||e.key==='I') && _topoHasWorld && !e.ctrlKey && !e.metaKey && !e.altKey){
      const t=e.target; if(t && (t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.isContentEditable)) return;
      e.preventDefault(); if(_invAbierto) cerrarInventario(); else abrirInventario();
    }
  });
  try{ const w=document.getElementById('velAntBar'); if(w && !w.dataset.wired){ w.dataset.wired='1'; w.onclick=(e)=>{ if(e.target && e.target.closest && e.target.closest('button')) return; }; } }catch(e){}
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', initInventarioHud);
else initInventarioHud();
setTimeout(initInventarioHud, 600);
