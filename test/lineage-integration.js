/** lineage-integration.js — a real app reset replaces the farm and retains only the lineage contract. */
process.env.TEST_SEED='73';
process.env.TEST_CLOCK='simulated';
const {ctx,vm,store}=require('./world-perf-proflib.js');
let pass=0,fail=0;
const ok=(cond,msg,detail='')=>{if(cond){pass++;console.log('  ok   '+msg+(detail?' · '+detail:''));}else{fail++;console.log('  FAIL '+msg+(detail?' · '+detail:''));}};
const run=src=>vm.runInContext(src,ctx);

run(`topoCreateFreshWorld(48,28);paused=true;`);
let before=run(`({lineage:lineageSnapshot(lineageState),relics:reliquias.length,unlock:_offlineUnlocks.lineage})`);
ok(before.lineage.flights===0&&before.lineage.amber===0,'an ordinary new farm starts without inherited amber');
ok(before.relics===0&&!before.unlock,'an ordinary new farm starts without inherited relics or lineage offline time');

const prepared=run(`(()=>{
  umbralesRotos=1;bandaMax=1;lineageRun.relicsFound=2;day=19;time=DAY_LENGTH*.8;deliveries=77;digs=41;gen=3;
  economyLedger.setFood(51,'lineage integration');economyLedger.replaceMaterials({clay:22,stone:31,fiber:8},'lineage integration');
  brood.push({id:'old-brood',type:'pupa',progress:88});pheromones.push({x:10,y:10,life:1,type:'guide'});
  colonyProjects.reserve('clay',4);
  reliquias=[{tipo:'fossil',nombre:'Fossil',piso:16,dia:9,gen:2,lore:'',bonus:.02}];bonusCava=.02;
  const oldSeed=worldSeed,oldWorkers=workers.length,quote=currentNuptialFlightQuote();
  const done=_executeNuptialFlight(1700000000999);
  return {done,oldSeed,oldWorkers,quote,after:{day,time,deliveries,digs,gen,food:economyLedger.food,materials:economyLedger.snapshot().materials,
    brood:brood.length,trails:pheromones.length,slabs:umbralesRotos,bandaMax,workers:workers.length,queens:queens.length,relics:reliquias.map(x=>x.tipo),
    bonusCava,lineage:lineageSnapshot(lineageState),runRelics:lineageRun.relicsFound,unlock:_offlineUnlocks.lineage,seed:worldSeed,baselineBand:bandaDe(Math.max(SURFACE_ROW+1,ROWS-2)-SURFACE_ROW),project:colonyProjects.snapshot()}};
})()`);
const expected=Math.sqrt(16+2*2); // depth is the founding shaft in this controlled run; two expedition relics count.
ok(prepared.quote.eligible&&prepared.done.ok,'a broken slab plus a living queen can launch the flight');
ok(Math.abs(prepared.done.award-expected)<1e-12,'the adapter credits the pure full-precision quote',String(prepared.done.award));
ok(prepared.after.seed!==prepared.oldSeed,'the old world is replaced by a newly seeded physical world');
ok(prepared.after.day===1&&prepared.after.deliveries===0&&prepared.after.digs===0&&prepared.after.gen===0,'day, expedition counters, and generation reset together');
ok(prepared.after.slabs===0&&prepared.after.bandaMax===prepared.after.baselineBand,'depth thresholds reset to the new map baseline instead of leaking',prepared.after.bandaMax+' / '+prepared.after.baselineBand);
ok(prepared.after.brood===0&&prepared.after.trails===0,'brood and temporary trails do not cross the flight');
ok((prepared.after.materials.clay||0)===0&&(prepared.after.materials.stone||0)===0,'old material stock does not cross the flight',JSON.stringify(prepared.after.materials));
ok(prepared.after.workers>0&&prepared.after.queens===1&&prepared.after.food>0,'the new map receives a real founder colony and finite provisions');
ok(prepared.after.relics.length===1&&prepared.after.relics[0]==='fossil'&&prepared.after.bonusCava===.02,'the inherited relic case and its physical bonus persist');
ok(prepared.after.runRelics===0,'the new expedition starts its own relic counter');
ok(prepared.after.lineage.flights===1&&Math.abs(prepared.after.lineage.amber-expected)<1e-12,'amber and the flight receipt persist into the new farm');
ok(prepared.after.lineage.history[0].at===1700000000999&&prepared.after.lineage.history[0].slabs===1,'the receipt describes the farm that was closed');
ok(prepared.after.unlock,'the first flight permanently opens the 12-hour lineage offline tier');

const save=JSON.parse(store.get('antFarm_fullSave_v2')||'null');
ok(save&&save.lineage&&save.lineage.flights===1&&save.lineageRun.relicsFound===0,'save serialization writes lineage and the new expedition counter');
ok(!!(save&&save.offline&&save.offline.unlocks.lineage),'the save writes the lineage offline milestone in the same transaction');

const upgrade=run(`(()=>{
  _setLineageState({...lineageSnapshot(lineageState),amber:20,earned:20});
  const store=storageStructure(false);if(store){store.built=true;store.progress=store.workNeeded||STORE_WORK_REQUIRED;}
  const cap0=capacidadAlmacen();const bought=buyPermanentLineageUpgrade('sealed_jars');const cap1=capacidadAlmacen();
  const trail=buyPermanentLineageUpgrade('trail_memory');pheromones.length=0;activeGuideTrail='TEST';guidePointsAdded=0;addGuidePoint(CENTER_COL*CELL+8,SURFACE_Y-8);
  return {bought,trail,cap0,cap1,life:pheromones[0]&&pheromones[0].life,effects:_lineageFx,state:lineageSnapshot(lineageState)};
})()`);
ok(upgrade.bought.ok&&upgrade.cap1-upgrade.cap0===2,'SEALED JARS adds exactly two protected ration slots at rank 1');
ok(upgrade.trail.ok&&Math.abs(upgrade.life-1.35*1.25)<1e-12,'TRAIL MEMORY extends only player-drawn guide life at rank 1');
ok(upgrade.state.spent===5&&upgrade.state.amber===15,'purchases spend the single earned amber wallet without rounding');

const otherEffects=run(`(()=>{
  foods.length=0;const scout=workers[0];scout.x=CENTER_COL*CELL+8;scout.y=SURFACE_Y-6;scout.health=100;scout.fatigue=5;
  const far={x:scout.x+CELL*23,y:SURFACE_Y-8,amount:1,max:1,r:8,pulse:0,ftype:'seed',rot:0,fresh:1,spawnDay:day,vy:0,grounded:true};foods.push(far);
  const before=_surfaceExcursionFood(scout);const forage=buyPermanentLineageUpgrade('forager_marks');const after=_surfaceExcursionFood(scout);
  const normalDrop=_restRecoveryAmount(100);const rest=buyPermanentLineageUpgrade('deep_rest');const amberDrop=_restRecoveryAmount(100);
  return {before:!!before,after:after===far,forage,rest,normalDrop,amberDrop,wired:updateAnt.toString().includes('_restRecoveryAmount(dt)'),state:lineageSnapshot(lineageState)};
})()`);
ok(!otherEffects.before&&otherEffects.after&&otherEffects.forage.ok,'FORAGER MARKS extends wild-food notice from 22 to 26 cells at rank 1');
ok(otherEffects.rest.ok&&Math.abs(otherEffects.amberDrop/otherEffects.normalDrop-1.15)<1e-9,'DEEP REST accelerates actual worker recovery by 15% at rank 1',otherEffects.normalDrop+' → '+otherEffects.amberDrop);
ok(otherEffects.state.spent===13&&otherEffects.state.amber===7,'all four effects still spend only the same earned amber wallet');

run(`serializeSave(true);const saved=JSON.parse(localStorage.getItem(SAVE_KEY));_setLineageState(null);lineageRun={relicsFound:99};deserializeSave(saved);`);
const loaded=run(`({state:lineageSnapshot(lineageState),run:lineageRun.relicsFound,unlock:_offlineUnlocks.lineage,fx:_lineageFx})`);
ok(loaded.state.flights===1&&Object.values(loaded.state.upgrades).every(v=>v===1),'save loading restores all finite permanent ranks and history');
ok(loaded.run===0&&loaded.unlock,'save loading restores the current expedition counter and offline milestone');
ok(loaded.fx.protectedStorageBonus===2&&loaded.fx.guideLifeMultiplier===1.25&&loaded.fx.wildForageRangeCells===4&&loaded.fx.restRecoveryMultiplier===1.15,'loaded permanent effects are rebuilt rather than cached in the save');

const legacy=run(`(()=>{const d=JSON.parse(localStorage.getItem(SAVE_KEY));delete d.lineage;delete d.lineageRun;d.reliquias=[{tipo:'old-a'},{tipo:'old-b'}];localStorage.setItem(SAVE_KEY,JSON.stringify(d));deserializeSave();return{state:lineageSnapshot(lineageState),run:lineageRun.relicsFound};})()`);
ok(legacy.state.flights===0&&legacy.state.amber===0&&legacy.run===2,'a pre-lineage save migrates safely and credits its current expedition relic discoveries',JSON.stringify(legacy));

run(`topoCreateFreshWorld(48,28);paused=true;`);
const overwritten=run(`({state:lineageSnapshot(lineageState),relics:reliquias.length,unlock:_offlineUnlocks.lineage})`);
ok(overwritten.state.flights===0&&overwritten.state.amber===0&&overwritten.relics===0&&!overwritten.unlock,'an explicit ordinary NEW FARM does not smuggle lineage across a destructive overwrite');

console.log(`\nLINEAGE INTEGRATION: ${pass} ok · ${fail} fallos`);if(fail)process.exit(1);
