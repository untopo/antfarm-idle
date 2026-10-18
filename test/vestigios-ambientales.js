'use strict';
const {ctx,vm}=require('./world-perf-proflib.js');
const run=code=>vm.runInContext(code,ctx);
let ok=0,fail=0;
function check(v,m){if(v){ok++;console.log('ok   '+m);}else{fail++;console.error('FAIL '+m);}}

const full=run(`(function(){
  const oldRandom=Math.random; Math.random=()=>0.731;
  COLS=64; ROWS=72; CENTER_COL=32; W=COLS*CELL; H=ROWS*CELL; worldSeed=778899; events.length=0; initSoil();
  const firstArt=[..._ancientArtCells.keys()][0]||'',firstStone=[..._ancientMasonryCells.keys()][0]||'';
  const out={sites:ancientSites.map(s=>[s.id,s.c,s.r,s.style,s.scar,s.oddity||0].join(':')).sort(),art:[..._ancientArtCells.keys()].sort(),
    masonry:ancientMasonry.length,firstArt,firstStone,events:events.map(e=>String(e.title||e.msg||''))};
  Math.random=oldRandom; return out;
})()`);
check(full.sites.length>=2&&full.sites.length<=8,'un mapa profundo contiene pocos sitios dañados ('+full.sites.length+')');
check(full.art.length>0&&full.masonry>0,'los sitios dejan murales de fondo y fragmentos construidos');
check(full.events.length===0,'materializar vestigios no abre eventos ni narra su significado');

const drawn=run(`(function(){
  const ops=[],g={_fill:'',set fillStyle(v){this._fill=v},get fillStyle(){return this._fill},fillRect(x,y,w,h){ops.push({x,y,w,h,fill:this._fill})}};
  const a='${full.firstArt}',p=a.split(',').map(Number); if(a) _paintAncientEvidence(g,p[0],p[1],false);
  const mural=ops.slice(); ops.length=0;
  const b='${full.firstStone}',q=b.split(',').map(Number); if(b) _paintAncientEvidence(g,q[0],q[1],true);
  return {mural,stone:ops};
})()`);
check(drawn.mural.length>0&&drawn.mural.every(x=>Number.isFinite(x.x)&&Number.isFinite(x.y)),'el mural se pinta directamente sobre celdas del mapa');
check(drawn.stone.length>=2,'la mampostería se reconoce por juntas físicas, no por una etiqueta');

const split=run(`(function(){
  const oldRandom=Math.random; Math.random=()=>0.731;
  COLS=64; ROWS=36; CENTER_COL=32; W=COLS*CELL; H=ROWS*CELL; worldSeed=778899; events.length=0; initSoil();
  const before=ancientSites.map(s=>s.id); expandWorld(36,true);
  const out={before,sites:ancientSites.map(s=>[s.id,s.c,s.r,s.style,s.scar,s.oddity||0].join(':')).sort(),art:[..._ancientArtCells.keys()].sort(),events:events.map(e=>String(e.title||e.msg||''))};
  Math.random=oldRandom; return out;
})()`);
check(JSON.stringify(split.sites)===JSON.stringify(full.sites),'descubrir las filas por ampliación materializa los mismos sitios que crearlas de una vez');
check(JSON.stringify(split.art)===JSON.stringify(full.art),'los murales conservan cada píxel con la misma semilla y expansión');
check(new Set(split.sites.map(x=>x.split(':')[0])).size===split.sites.length,'el solape de expansión no duplica ningún vestigio');
check(split.events.length===0,'ampliar sobre un sitio antiguo tampoco muestra un popup interpretativo');

const physical=run(`ancientSites.every(s=>!(/temple|tomb|altar|king|priest|civilization/i.test(String(s.kind)))&&
  Object.keys(s).every(k=>!(/meaning|story|translation|theory/i.test(k))))`);
check(physical,'el estado visible guarda evidencia física, no una teoría resuelta');

console.log(`\n${fail?'❌ '+fail+' fallos':'✅ '+ok+' ok'} · vestigios ambientales silenciosos`);
if(fail) process.exitCode=1;
