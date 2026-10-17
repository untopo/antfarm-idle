/** T4: la colonia rompe la primera losa antes de terminar el día 5, sin jugador. */
process.env.TEST_SEED='1';
process.env.TEST_CLOCK='simulated';
const {sb,ctx,vm}=require('./world-perf-proflib.js');
let pass=0,fail=0,errores=0;
const ok=(c,m)=>{if(c){pass++;console.log('  ok   '+m);}else{fail++;console.log('  FAIL '+m);}};
sb.console.error=(...m)=>{errores++; if(errores<2) console.log('  sandbox: '+m.map(x=>x&&x.message||x).join(' '));};
let t=1; sb.performance.now=()=>t;
vm.runInContext(`topoCreateFreshWorld(48,28); paused=false; gameSpeed=64;
  last=performance.now(); lastRealWall=Date.now();
  window._step=()=>loop(performance.now());
  window._losa=()=>({dia:time/DAY_LENGTH+1,rotas:umbralesRotos,filas:ROWS,agua:water.length});`,ctx);
let estado=sb._losa();
for(let f=0;f<460*5 && estado.rotas<1;f++){
  t+=42; sb._step();
  if(f%10===9) estado=sb._losa();
}
estado=sb._losa();
ok(errores===0,'la progresión no lanza errores internos');
ok(estado.rotas>=1,'la colonia rompe la primera losa sola');
ok(estado.dia<6,'la rompe antes de terminar el día 5 (día '+estado.dia.toFixed(2)+')');
ok(estado.agua===estado.filas,'la expansión mantiene la rejilla de agua ('+estado.agua+'/'+estado.filas+')');
console.log('\n'+pass+' ok'+(fail?' · '+fail+' FALLOS':' · T4 cumplido'));
process.exit(fail?1:0);
