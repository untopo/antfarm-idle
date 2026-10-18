'use strict';
const {ctx,vm}=require('./world-perf-proflib.js');
const run=code=>vm.runInContext(code,ctx);
let ok=0,fail=0;
function check(v,m){if(v){ok++;console.log('ok   '+m);}else{fail++;console.error('FAIL '+m);}}

run('topoCreateFreshWorld(48,28); weather.type="clear"; water=Array.from({length:ROWS},()=>Array(COLS).fill(0)); waterVisual=Array.from({length:ROWS},()=>Array(COLS).fill(0)); waterFlow=new Map(); _waterActive=false;');

const fall=run(`(function(){
  const c=10,r=10; for(let y=r;y<=r+3;y++) soil[y][c]=0;
  water[r][c]=0.82; waterVisual[r][c]=0.82; _waterActive=true;
  const mass0=waterMass(water),levels=[];
  for(let i=0;i<3;i++){ updateWater(1); pintarAguaVoxel(ctx,c,r); levels.push({physical:water[r][c],visible:waterVisual[r][c]}); }
  return {mass0,mass1:waterMass(water),levels,flow:waterFlow.get(c+','+r)};
})()`);
check(Math.abs(fall.mass0-fall.mass1)<0.001,'animar una caída no crea ni destruye su bolsa finita');
check(fall.levels[0].physical<0.82&&fall.levels[2].physical<=fall.levels[0].physical,'la celda de origen disminuye mientras el agua cae');
check(fall.levels[0].visible>fall.levels[0].physical&&fall.levels[0].visible<0.82,'el nivel visible interpola la disminución en vez de teletransportarse');
check(fall.flow&&fall.flow.kind==='fall'&&fall.flow.dy>0,'la física deja una traza reciente de caída para el render');

const stream=run(`(function(){
  const c=14,r=11,ops=[]; soil[r][c]=0; soil[r+1][c]=0; water[r][c]=.34; water[r+1][c]=0; waterVisual[r][c]=.34;
  recordWaterFlow(c,r,c,r+1,.24,'fall');
  const g={_fill:'',set fillStyle(v){this._fill=v},get fillStyle(){return this._fill},fillRect(x,y,w,h){ops.push({x,y,w,h,fill:this._fill})}};
  pintarAguaVoxel(g,c,r); return ops;
})()`);
check(stream.some(o=>o.h>16&&o.w<14),'una transferencia vertical se dibuja como columna estrecha que cruza la celda');
check(stream.some(o=>o.h===3&&/rgba/.test(o.fill)),'la caída lleva destellos móviles y no parece un bloque azul sólido');

const partial=run(`(function(){
  const c=18,r=12,ops=[]; soil[r][c]=0; soil[r+1][c]=1; water[r][c]=.36; waterVisual[r][c]=0;
  const g={_fill:'',set fillStyle(v){this._fill=v},get fillStyle(){return this._fill},fillRect(x,y,w,h){ops.push({x,y,w,h,fill:this._fill})}};
  pintarAguaVoxel(g,c,r); return {ops,visible:waterVisual[r][c]};
})()`);
check(partial.visible>0&&partial.visible<0.36,'un charco nuevo crece mediante un nivel parcial visible');
check(partial.ops.some(o=>o.w===16&&o.h>0&&o.h<16),'el charco parcial ocupa sólo la fracción inferior de la celda');

const drain=run(`(function(){
  const c=20,r=12,seq=[]; soil[r][c]=0; soil[r+1][c]=1; water[r][c]=0; waterVisual[r][c]=1;
  for(let i=0;i<34;i++){ pintarAguaVoxel(ctx,c,r); seq.push(waterVisual[r][c]); }
  return seq;
})()`);
check(drain[0]<1&&drain[0]>0&&drain[8]<drain[0],'al agotarse la fuente, su nivel baja de forma observable durante varios cuadros');
check(drain[drain.length-1]<0.01,'la estela visual termina vaciándose por completo');

const side=run(`(function(){
  const c=24,r=12,ops=[]; soil[r][c]=0; soil[r+1][c]=1; water[r][c]=.42; waterVisual[r][c]=.42;
  recordWaterFlow(c,r,c+1,r,.3,'side');
  const g={_fill:'',set fillStyle(v){this._fill=v},get fillStyle(){return this._fill},fillRect(x,y,w,h){ops.push({x,y,w,h,fill:this._fill})}};
  pintarAguaVoxel(g,c,r); return ops;
})()`);
check(side.some(o=>o.h===2&&o.w>=2&&o.w<=7),'un derrame lateral dibuja una lengua en la dirección del flujo');

console.log(`\n${fail?'❌ '+fail+' fallos':'✅ '+ok+' ok'} · agua visible tipo voxel`);
if(fail) process.exitCode=1;
