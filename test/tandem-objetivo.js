/** Regresión: una carga {amount} no puede usarse como objetivo {x,y} de un tándem. */
process.env.TEST_SEED='1';
process.env.TEST_CLOCK='simulated';
const { sb, ctx, vm }=require('./world-perf-proflib.js');
let pass=0,fail=0;
const ok=(c,m)=>{if(c){pass++;console.log('  ok   '+m);}else{fail++;console.log('  FAIL '+m);}};
let error=null, estado=null;
try{
  vm.runInContext(`topoCreateFreshWorld(48,28);
    workers=workers.slice(0,2);
    const lider=workers[0], seguidora=workers[1];
    lider.x=CENTER_COL*CELL+8; lider.y=(SURFACE_ROW+4)*CELL+8;
    seguidora.x=lider.x+8; seguidora.y=lider.y; seguidora.state='EXPLORAR'; seguidora.food=null;
    lider.food={amount:2}; lider.targetFood=null; lider.tandemPartner=null; lider.tandemCooldown=0; lider.crop=0;
    const fuente={x:lider.x+20,y:lider.y,amount:3,r:8}; foods=[fuente];
    Math.random=()=>0;
    updateAnt(lider,0.1);
    window._tandemEstado={
      lider:lider.state, seguidora:seguidora.state,
      mismo:lider.targetFood===fuente && seguidora.targetFood===fuente,
      finito:Number.isFinite(seguidora.targetFood&&seguidora.targetFood.x) && Number.isFinite(seguidora.targetFood&&seguidora.targetFood.y)
    };`,ctx);
  estado=sb._tandemEstado;
}catch(e){error=e;}
ok(!error,'el reclutamiento no produce coordenadas NaN'+(error?' · '+error.message:''));
ok(estado&&estado.lider==='TANDEM_LEADER'&&estado.seguidora==='TANDEM_FOLLOWER','se forma el tándem 1-a-1');
ok(estado&&estado.mismo&&estado.finito,'ambas reciben una fuente real con x,y');
console.log('\n'+pass+' ok'+(fail?' · '+fail+' FALLOS':' · objetivo de tándem válido'));
process.exit(fail?1:0);
