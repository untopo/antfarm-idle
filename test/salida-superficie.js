/**
 * Regresión de la boca del nido. La fundadora de la semilla 1 tiene giro neuronal extremo; antes
 * subía y caía en el labio del pozo sin alcanzar una gota exterior. La red elige el objetivo, pero
 * la navegación comprometida debe llevarla por el pie y el labio transitables.
 */
process.env.TEST_SEED='1';
process.env.TEST_CLOCK='simulated';
const { sb, ctx, vm }=require('./world-perf-proflib.js');
let pass=0, fail=0;
const ok=(cond,msg)=>{ if(cond){pass++;console.log('  ok   '+msg);}else{fail++;console.log('  FAIL '+msg);} };
let t=1;
sb.performance.now=()=>t;
vm.runInContext(`topoCreateFreshWorld(48,28); paused=false; gameSpeed=64;
  last=performance.now(); lastRealWall=Date.now();
  workers=workers.slice(0,1);
  const _prueba=workers[0];
  _prueba.x=CENTER_COL*CELL+8; _prueba.y=(SURFACE_ROW+8)*CELL+8;
  _prueba.angle=0; _prueba.vy=0; _prueba.food=null; _prueba.digTarget=null; _prueba.state='EXPLORAR';
  foods.length=0;
  const _gota={x:(CENTER_COL+5)*CELL+8,y:SURFACE_Y-8,amount:2,max:2,r:9,pulse:0,ftype:'honey',rot:0,fresh:1,spawnDay:1,vy:0,grounded:true};
  foods.push(_gota); _prueba.targetFood=_gota;
  window._step=()=>loop(performance.now());
  window._estadoSalida=()=>({entregas:deliveries,comida:colonyFood,carga:!!_prueba.food,y:_prueba.y,x:_prueba.x,objetivo:!!_prueba.targetFood});`,ctx);
const inicial=sb._estadoSalida();
let errores=0, vioSuperficie=false;
for(let f=0;f<460;f++){
  t+=42;
  try{ sb._step(); const e=sb._estadoSalida(); if(e.y<96) vioSuperficie=true; }
  catch(e){errores++; if(errores<2) console.log(e.stack);}
}
const final=sb._estadoSalida();
ok(errores===0,'el trayecto no lanza excepciones');
ok(vioSuperficie,'la obrera corona el pozo y pisa el prado');
ok(final.entregas>inicial.entregas,'la obrera recoge y entrega miel ('+(final.entregas-inicial.entregas)+' entregas)');
console.log('\n'+pass+' ok'+(fail?' · '+fail+' FALLOS':' · boca transitable'));
process.exit(fail?1:0);
