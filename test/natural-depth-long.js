/** Natural long descent diagnostic/acceptance: no direct expansion, carved cells, HP or tech injection. */
process.env.TEST_SEED=process.env.TEST_SEED||'23';
process.env.TEST_CLOCK='simulated';
const {sb,ctx,vm}=require('./world-perf-proflib.js');
const size=(process.argv[2]||'small').toLowerCase(),days=Number(process.argv[3]||45);
const [cols,rows]=size==='big'?[96,48]:size==='medium'?[64,36]:[48,28];
vm.runInContext(`topoCreateFreshWorld(${cols},${rows});paused=false;gameSpeed=64;last=performance.now();lastRealWall=Date.now();renderLoop=()=>{};
window.__naturalStep=()=>loop(performance.now());
window.__naturalPhoto=()=>{const reach=nestReachableData(),deep=reach.cells.reduce((m,p)=>Math.max(m,p[1]),SURFACE_ROW);return{day:time/DAY_LENGTH+1,rows:ROWS,limit:worldDepthLimit,deep,openings:umbralesRotos,core:worldCoreFound,underworld:deep>=worldUnderworldStart(),workers:workers.length,queens:queens.length,brood:brood.length,food:colonyFood,digs,gen,iq:colonyIQ,slabs:soilType.flat().filter(t=>t===17).length,deepWorkers:workers.filter(w=>w._pozoPrincipal).length,lateral:workers.filter(w=>w._lateralExplorer||w._lateralScout).length};};
window.__naturalDebug=()=>{const start=Math.max(SURFACE_ROW,_exploredDeepest-2),end=Math.min(ROWS,worldCoreStart());return{ants:workers.map(w=>({id:w.id,state:w.state,row:(w.y/CELL)|0,col:(w.x/CELL)|0,shaft:!!w._pozoPrincipal,lat:!!(w._lateralExplorer||w._lateralScout),food:!!w.food,target:!!w.targetFood,dig:w.digTarget,fat:+(w.fatigue||0).toFixed(1),retreat:!!w._magmaRetreat})),center:Array.from({length:Math.max(0,end-start)},(_,i)=>{const r=start+i;return[r,soil[r][CENTER_COL],soilType[r][CENTER_COL]];}),pending:_depthFrontPending()};};`,ctx);
let t=1;sb.performance.now=()=>t;
// Retain the proven acceptance cadence used by the long-life simulation; only painting is stubbed.
const cadence=460,maxFrames=Math.ceil(days*cadence);let p=sb.__naturalPhoto(),lastDay=0,everLateral=0;
console.log(`NATURAL ${size.toUpperCase()} ${cols}×${rows} → ${p.limit} · seed ${process.env.TEST_SEED} · no injected progress`);
for(let f=0;f<maxFrames&&!p.core;f++){
  t+=42;sb.__naturalStep();
  if(f%cadence===cadence-1){p=sb.__naturalPhoto();everLateral=Math.max(everLateral,p.lateral);const d=Math.floor(p.day);if(d!==lastDay){lastDay=d;console.log(`  d${String(d).padStart(2)} rows ${String(p.rows).padStart(3)}/${p.limit} deep ${String(p.deep).padStart(3)} open ${p.openings} · ants ${p.workers} q${p.queens} b${p.brood} · food ${p.food.toFixed(1)} · digs ${p.digs} gen${p.gen} iq${p.iq.toFixed(0)} · shaft ${p.deepWorkers} lateral ${p.lateral}`);}}
}
p=sb.__naturalPhoto();let fail=0;const ok=(c,m)=>{console.log((c?'  ok   ':'  FAIL ')+m);if(!c)fail++;};
ok(p.slabs===0,'zero intermediate slabs were created');
ok(p.openings>=1,'the connected natural shaft opened at least one backing chunk');
ok(p.workers>0&&p.queens>0,'the colony remained physically alive');
ok(everLateral>0,'the same run elected physical lateral scouts as well as a deep pioneer');
ok(p.core&&p.rows===p.limit&&p.deep>=p.limit-4,`ants physically reached the visible world core by Day ${p.day.toFixed(2)} (${p.deep}/${p.limit-1})`);
if(fail)console.log(JSON.stringify(sb.__naturalDebug(),null,2));
console.log(`NATURAL ${size.toUpperCase()}: ${5-fail} ok · ${fail} failures`);process.exit(fail?1:0);
