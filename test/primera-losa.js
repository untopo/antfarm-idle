/** First seamless depth opening: the colony extends SMALL before Day 5 without player input. */
process.env.TEST_SEED='1';
process.env.TEST_CLOCK='simulated';
const {sb,ctx,vm}=require('./world-perf-proflib.js');
let pass=0,fail=0,errores=0;
const ok=(c,m)=>{if(c){pass++;console.log('  ok   '+m);}else{fail++;console.log('  FAIL '+m);}};
sb.console.error=(...m)=>{errores++;if(errores<2)console.log('  sandbox: '+m.map(x=>x&&x.message||x).join(' '));};
let t=1;sb.performance.now=()=>t;
vm.runInContext(`topoCreateFreshWorld(48,28);paused=false;gameSpeed=64;
  last=performance.now();lastRealWall=Date.now();
  window._step=()=>loop(performance.now());
  window._depth=()=>({dia:time/DAY_LENGTH+1,openings:umbralesRotos,filas:ROWS,limite:worldDepthLimit,agua:water.length,slabs:soilType.flat().filter(v=>v===17).length});`,ctx);
let estado=sb._depth();
for(let f=0;f<460*5&&estado.openings<1;f++){
  t+=42;sb._step();if(f%10===9)estado=sb._depth();
}
estado=sb._depth();
ok(errores===0,'depth progression throws no internal errors');
ok(estado.openings>=1&&estado.filas>28,'the colony opens the first deeper chunk by itself');
ok(estado.dia<6,'it opens before the end of Day 5 (Day '+estado.dia.toFixed(2)+')');
ok(estado.slabs===0,'no intermediate slab was created');
ok(estado.agua===estado.filas&&estado.limite===84,'water grows with SMALL while its final depth remains 84 ('+estado.agua+'/'+estado.filas+')');
console.log('\n'+pass+' ok'+(fail?' · '+fail+' FAILURES':' · seamless depth fulfilled'));
process.exit(fail?1:0);
