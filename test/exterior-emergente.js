/**
 * exterior-emergente.js — the first visible meadow trip is selected by colony behaviour,
 * not a manual profession control or a random worker-array race.
 */
process.env.TEST_SEED='17';
process.env.TEST_CLOCK='simulated';
const {ctx,vm}=require('./world-perf-proflib.js');
let pass=0,fail=0;
const ok=(cond,msg,detail='')=>{if(cond){pass++;console.log('  ok   '+msg+(detail?' · '+detail:''));}else{fail++;console.log('  FAIL '+msg+(detail?' · '+detail:''));}};
const run=src=>vm.runInContext(src,ctx);

const state=run(`(()=>{
  topoCreateFreshWorld(48,28);paused=true;
  while(workers.length<6)workers.push(makeAnt(queen.genome,{x:CENTER_COL*CELL+8,y:SURFACE_Y-6}));
  workers.length=6;economyLedger.setFood(10,'early excursion test');foods.length=0;
  const meadow={x:(CENTER_COL+7)*CELL+8,y:SURFACE_Y-8,amount:3,max:3,r:9,pulse:0,ftype:'honey',rot:0,fresh:1,spawnDay:1,vy:0,grounded:true};foods.push(meadow);
  workers.forEach((w,i)=>{
    w.id='TEST-'+i;w.x=CENTER_COL*CELL+8+i;w.y=SURFACE_Y-6;w.age=DAY_LENGTH*.7;w.health=100;w.fatigue=8;
    w.state='EXPLORAR';w.food=null;w.targetFood=null;w.digTarget=null;w.wasteTarget=null;w.projectCargo=null;w.buildTarget=null;
    w._excursion=false;w._excursionHasta=0;w.profession='OBRERA';w.affinity='GENERALISTA';
    w.traits={...(w.traits||{}),exploracion:22+i,recoleccion:24+i};w.jobExperience={build:0,dig:0,forage:0,explore:0,nurse:0};w._jobBookReady=false;
  });
  const scout=workers[4];scout.traits.exploracion=96;scout.traits.recoleccion=78;scout.jobExperience.explore=4;scout.jobExperience.forage=3;scout.affinity='EXPLORADORA';
  return {limit2:_surfaceExcursionLimit(2),limit4:_surfaceExcursionLimit(4),limit5:_surfaceExcursionLimit(5),limit6:_surfaceExcursionLimit(6),limit9:_surfaceExcursionLimit(9),limit10:_surfaceExcursionLimit(10),
    choice:_surfaceExcursionChoice(workers),scoutId:scout.id,food:meadow};
})()`);

console.log('\n· an early trip has a strict, colony-sized slot');
ok(state.limit2===0,'two workers keep both pairs of mandibles in the founding nest');
ok(state.limit4===1&&state.limit5===1,'a fresh four- or five-worker farm may send exactly one founder',state.limit4+' / '+state.limit5);
ok(state.limit6===1&&state.limit9===1,'six to nine workers still keep exactly one voluntary scout',state.limit6+' / '+state.limit9);
ok(state.limit10===2,'a mature ten-worker colony may support the existing quarter-sized cap',String(state.limit10));

console.log('\n· traits, age and learned work choose her without a manual control');
ok(state.choice&&state.choice.ant.id===state.scoutId,'the strongest learned explorer is selected',state.choice&&state.choice.ant.id);
ok(state.choice&&state.choice.food===state.food&&state.choice.food.y<run('SURFACE_Y'),'the assignment points to real reachable meadow food');
ok(state.choice&&state.choice.limit===1&&state.choice.active===0,'the choice reports its one available slot');

const begun=run(`(()=>{for(const w of workers)_beginSurfaceExcursion(w,workers);return workers.map(w=>({id:w.id,trip:!!w._excursion,target:w.targetFood&&w.targetFood===foods[0]}));})()`);
const trips=begun.filter(x=>x.trip);
ok(trips.length===1&&trips[0].id===state.scoutId,'one update pass reserves exactly one trip',JSON.stringify(trips));
ok(trips[0]&&trips[0].target,'the reserved scout carries the existing food target, not a duplicate marker');
ok(run('_surfaceExcursionChoice(workers)')===null,'the reservation counts before she leaves the store, so a second scout cannot slip out');

const tired=run(`(()=>{const first=workers.find(w=>w._excursion);for(const w of workers){w._excursion=false;w.targetFood=null;w._excursionHasta=0;}first.fatigue=80;const q=_surfaceExcursionChoice(workers);return{old:first.id,next:q&&q.ant.id};})()`);
ok(tired.next&&tired.next!==tired.old,'fatigue disqualifies the nominal best scout and another adult answers',JSON.stringify(tired));
const need=run(`(()=>{economyLedger.setFood(4,'test need floor');const low=_surfaceExcursionChoice(workers);economyLedger.setFood(10,'restore');foods.length=0;const none=_surfaceExcursionChoice(workers);return{low:!!low,none:!!none};})()`);
ok(!need.low,'voluntary sightseeing never competes with the low-food emergency');
ok(!need.none,'no meadow resource means no invented excursion or free resource');
const shared=run(`(()=>{const s=tickStep.toString();return s.includes('_surfaceTickChoice=_surfaceExcursionChoice(_surfaceTickWorkforce)')&&s.includes('for(let w of [...workers]) updateAnt(w,dt)');})()`);
ok(shared,'a mature colony ranks the excursion once per simulation step, not once per worker');

console.log(`\nEXTERIOR EMERGENTE: ${pass} ok · ${fail} fallos`);if(fail)process.exit(1);
