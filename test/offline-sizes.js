// test/offline-sizes.js — el adaptador agregado no depende de las dimensiones del lienzo.
const {sb,ctx,vm,store}=require('./world-perf-proflib.js');
const sizes=[[48,28],[64,36],[96,48]];let ok=0,fail=0;
const check=(name,cond,extra)=>{if(cond){ok++;console.log('  ok   '+name);}else{fail++;console.log('  FAIL '+name+' → '+JSON.stringify(extra));}};
for(let i=0;i<sizes.length;i++){
  const [cols,rows]=sizes[i],now=Date.now()+i*100000;
  vm.runInContext(`(()=>{
    topoCreateFreshWorld(${cols},${rows});const s=structures.find(x=>x.type==='store');s.built=true;s.work=s.workNeeded;s.buildProgress=1;
    const w=workers[0];queens[0].health=10;queens[0].progress=0;brood=[{type:'pupa',progress:99,genome:JSON.parse(JSON.stringify(w.genome)),time:0,isQueen:false,faction:w.faction,x:queens[0].x,y:queens[0].y,hunger:0}];
    economyLedger.setFood(8,'offline size fixture');serializeSave(true);
  })()`,ctx);
  const save=JSON.parse(store.get('antFarm_fullSave_v2'));save.savedAt=now-60*60*1000;store.set('antFarm_fullSave_v2',JSON.stringify(save));
  vm.runInContext(`(()=>{deserializeSave();const t=time,n=workers.length,r=_applyOfflineAfterLoad(${now});window.__offlineSize={cols:COLS,rows:ROWS,dt:time-t,before:n,after:workers.length,cap:r.window.capHours,it:r.iterations,limit:r.eventLimit,food:economyLedger.food,capacity:r.food.capacity};})()`,ctx);
  const r=sb.__offlineSize,label=cols+'×'+rows;
  check(label+' conserva dimensiones y acredita exactamente una hora',r.cols===cols&&r.rows===rows&&Math.abs(r.dt-216000)<1e-6,r);
  check(label+' eclosiona la cría una sola vez',r.after===r.before+1,r);
  check(label+' usa tope físico 8 h sin desbordar economía ni eventos',r.cap===8&&!r.limit&&r.it<4096&&r.food>=0&&r.food<=r.capacity+1e-7,r);
}
console.log(`\n${ok} ok · ${fail} FALLOS`);process.exit(fail?1:0);
