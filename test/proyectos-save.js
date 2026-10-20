/** proyectos-save.js — active physical cargo and reserve policies survive save/load; F saves remain valid. */
const {ctx,vm,store}=require('./world-perf-proflib.js');
const run=s=>vm.runInContext(s,ctx);
let pass=0,fail=0;const ok=(c,m,d='')=>{if(c){pass++;console.log('ok   '+m+(d?' · '+d:''));}else{fail++;console.log('FAIL '+m+(d?' · '+d:''));}};
run(`topoCreateFreshWorld(48,28);(function(){const s=storageStructure(false),a=_storeAnchor(s);for(const id of s.builders){const w=workers.find(x=>x.id===id);w.x=a.x;w.y=a.y;}for(let i=0;i<220&&!s.built;i++)for(const id of s.builders){const w=workers.find(x=>x.id===id);w.fatigue=0;workOnStore(w,1,1);}economyLedger.replaceMaterials({clay:12,fiber:9,wood:4,stone:4},'save test');economyLedger.setFood(20,'save test');setProjectReserve('clay',2);approveColonyProject('clay_jars');const p=storagePos(),a0=colonyProjects.activeRef(),w=workers.find(x=>x.id===a0.crew[0]);w.x=p.x;w.y=p.y;w.fatigue=0;workOnColonyProject(w,2,1);})();`);
const before=run(`(()=>{const a=colonyProjects.active(),carrier=workers.find(w=>w.projectCargo);return{a,carrier:carrier&&{id:carrier.id,cargo:{...carrier.projectCargo}},materials:{...economyLedger.materials},floor:economyLedger.materialFloor('clay'),heldClay:economyLedger.materialHeld('clay'),save:serializeSave(true)}})()`);
ok(before.save&&before.a&&before.carrier,'se guarda una obra con una unidad físicamente en tránsito');
const raw=store.get('antFarm_fullSave_v2'),parsed=JSON.parse(raw);
ok(parsed.colonyProjects&&parsed.colonyProjects.active&&parsed.colonyProjects.reserves.clay===2,'el save contiene libro de proyecto y política de mínimo');

run(`resetColonyProjects();economyLedger.replaceMaterials({},'wipe');workers=[];queens=[];queen=null;soil=[];_topoHasWorld=false;`);
const loaded=run(`(()=>{const yes=deserializeSave(),a=colonyProjects.active(),carrier=workers.find(w=>w.projectCargo);return{yes,a,carrier:carrier&&{id:carrier.id,cargo:{...carrier.projectCargo}},materials:{...economyLedger.materials},floor:economyLedger.materialFloor('clay'),heldClay:economyLedger.materialHeld('clay'),availableClay:economyLedger.materialAvailable('clay')};})()`);
ok(loaded.yes&&loaded.a.id===before.a.id&&loaded.a.inTransit.clay===1,'la obra activa vuelve con el mismo tránsito');
ok(loaded.carrier&&loaded.carrier.id===before.carrier.id&&loaded.carrier.cargo.kind==='clay','la unidad sigue en las mandíbulas de la misma obrera');
ok(loaded.materials.clay===before.materials.clay&&loaded.floor===2&&loaded.heldClay===2,'saldo, mínimo y compromiso pendiente se reconstruyen sin duplicar');
ok(loaded.availableClay===loaded.materials.clay-2-2,'la disponibilidad tras cargar resta mínimo y sólo lo que sigue en el almacén');

const finished=run(`(()=>{let guard=0;while(colonyProjects.activeRef()&&guard++<220){const a=colonyProjects.activeRef();if(!(a.crew||[]).length)_assignColonyProjectCrew(true);const w=workers.find(x=>x.projectCargo)||workers.find(x=>x.id===a.crew[0]);w.fatigue=0;const target=w.projectCargo?colonyProjectAnchor(a):storagePos();w.x=target.x;w.y=target.y;workOnColonyProject(w,8,1);}return{active:colonyProjects.active(),count:colonyProjects.completedCount('clay_jars'),clay:economyLedger.materials.clay,fiber:economyLedger.materials.fiber,held:economyLedger.materialHeld('clay')};})()`);
ok(!finished.active&&finished.count===1&&finished.clay===9&&finished.fiber===7&&finished.held===0,'la obra cargada termina pagando el coste total exacto una sola vez');

const legacy={...parsed};delete legacy.colonyProjects;legacy.workers=(legacy.workers||[]).map(w=>{const x={...w};delete x.projectCargo;if(/^.+PROJECT$/.test(x.state||''))x.state='EXPLORAR';return x;});legacy.worldMaterials={clay:7,fiber:4,stone:2};store.set('antFarm_fullSave_v2',JSON.stringify(legacy));
const old=run(`(()=>{const yes=deserializeSave();return{yes,active:colonyProjects.active(),completed:colonyProjects.completed().length,reserve:colonyProjects.reserve('clay'),floor:economyLedger.materialFloor('clay'),held:economyLedger.materialHeld('clay'),clay:economyLedger.materials.clay};})()`);
ok(old.yes&&!old.active&&old.completed===0&&old.reserve===0&&old.floor===0&&old.held===0,'una partida F sin proyectos migra a un libro vacío');
ok(old.clay===7,'la migración F conserva sus materiales originales');

console.log(`\nPROJECT SAVE: ${pass} ok · ${fail} fallos`);if(fail)process.exit(1);
