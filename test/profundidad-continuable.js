/**
 * No world size may end at its first visible slab. Deep masonry must be learnable in normal play,
 * later slabs must expand the physical arrays repeatedly, and bedrock must become mineable eventually.
 */
process.env.TEST_SEED='109';
process.env.TEST_CLOCK='simulated';
const {ctx,vm}=require('./world-perf-proflib.js');
let pass=0,fail=0;
const ok=(cond,msg,detail='')=>{if(cond){pass++;console.log('  ok   '+msg+(detail?' · '+detail:''));}else{fail++;console.log('  FAIL '+msg+(detail?' · '+detail:''));}};
const run=src=>vm.runInContext(src,ctx);

console.log('\n· the promised deep-masonry key exists in ordinary progression');
const unlock=run(`(()=>{
  topoCreateFreshWorld(48,28);paused=true;
  const original=umbral.guarda;umbral.guarda=5;const quartz=puedeGolpearUmbral();umbral.guarda=6;const marbleBefore=puedeGolpearUmbral();umbral.guarda=original;
  gen=6;colonyIQ=145;digs=28;worldAge=1.1;inventions.stone=true;inventions.clay=true;checkInventions();
  umbral.guarda=6;const marbleAfter=puedeGolpearUmbral();umbral.guarda=original;
  return{quartz,marbleBefore,marbleAfter,masonry:inventions.masonry,events:importantHistory.map(x=>String(x.title||x.msg||''))};
})()`);
ok(unlock.quartz,'quartzite is progress, not an incorrectly early masonry wall');
ok(!unlock.marbleBefore,'black marble still communicates a genuine late-game gate');
ok(unlock.masonry&&unlock.marbleAfter,'GEN6 + IQ145 + stone + clay actually learns deep masonry');
ok(unlock.events.some(x=>/masonry/i.test(x)),'the unlock is announced instead of changing invisibly',unlock.events.slice(-3).join(' | '));

console.log('\n· every world size keeps adding real depth after repeated slabs');
for(const [name,cols,rows] of [['SMALL',48,28],['MEDIUM',64,36],['BIG',96,48]]){
  const result=run(`(()=>{
    topoCreateFreshWorld(${cols},${rows});paused=true;gen=8;colonyIQ=150;inventions.stone=true;inventions.clay=true;checkInventions();
    const records=[];
    for(let i=0;i<8;i++){
      const beforeRows=ROWS,beforeBroken=umbralesRotos,guard=umbral&&umbral.guarda,can=puedeGolpearUmbral();
      if(!can||!umbral){records.push({i,beforeRows,guard,can,stopped:true});break;}
      umbral.hp=.01;golpearUmbral({id:'TEST',role:'EXCAVADORA',x:CENTER_COL*CELL+8,y:(umbral.r-1)*CELL+8});
      records.push({i,beforeRows,afterRows:ROWS,beforeBroken,afterBroken:umbralesRotos,guard,can,next:umbral&&umbral.guarda});
    }
    return{records,rows:ROWS,broken:umbralesRotos,band:bandaMax,masonry:inventions.masonry,bedrock:_canExcavateMaterial(7),magma:_canExcavateMaterial(15)};
  })()`);
  ok(result.masonry&&result.records.length===8&&result.records.every(x=>x.can&&!x.stopped),name+' can open eight consecutive thresholds',JSON.stringify(result.records.map(x=>x.guard)));
  ok(result.records.every(x=>x.afterRows>x.beforeRows&&x.afterBroken===x.beforeBroken+1),name+' grows physical rows at every threshold',result.records.map(x=>x.beforeRows+'→'+x.afterRows).join(', '));
  ok(result.broken===8&&result.rows>rows,' '+name+' has no fixed bottom after reaching the final geological band',`${rows}→${result.rows} rows · band ${result.band}`);
  ok(result.bedrock&&!result.magma,name+' eventually works bedrock while magma remains a route-around hazard');
}

console.log(`\nPROFUNDIDAD CONTINUABLE: ${pass} ok · ${fail} fallos`);if(fail)process.exit(1);
