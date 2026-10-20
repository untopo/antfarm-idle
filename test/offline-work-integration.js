// test/offline-work-integration.js — obras y losa abiertas se liquidan; nada nuevo se aprueba solo.
const {sb,ctx,vm,store}=require('./world-perf-proflib.js');
let ok=0,fail=0;
function check(name,cond,extra){if(cond){ok++;console.log('  ok   '+name);}else{fail++;console.log('  FAIL '+name+(extra!==undefined?' → '+JSON.stringify(extra):''));}}
const now=Date.now();
vm.runInContext(`
  topoCreateFreshWorld(48,28);
  const __s=structures.find(s=>s.type==='store');__s.built=true;__s.work=__s.workNeeded;__s.buildProgress=1;
  economyLedger.replaceMaterials({clay:12,fiber:9,wood:4,stone:4},'offline work fixture');
  economyLedger.setFood(12,'offline work fixture');
  approveColonyProject('clay_jars');
  const __a=colonyProjects.activeRef(),__builder=workers[0],__slabWorker=workers[1];
  colonyProjects.setCrew([__builder.id]);
  __slabWorker.state='CAVANDO';__slabWorker.digTarget={c:umbral.c0,r:umbral.r};__slabWorker.digProgress=0;__slabWorker._umbralLead=true;
  umbral.hp=2;umbral.hpMax=Math.max(2,umbral.hpMax);
  window.__offlineWorkBefore={project:JSON.parse(JSON.stringify(__a)),clay:economyLedger.materials.clay,fiber:economyLedger.materials.fiber,
    umbrales:umbralesRotos,rows:ROWS,proposals:colonyProjects.completed().length};
  serializeSave(true);
`,ctx);
let save=JSON.parse(store.get('antFarm_fullSave_v2'));save.savedAt=now-60*60*1000;store.set('antFarm_fullSave_v2',JSON.stringify(save));
vm.runInContext(`
  deserializeSave();const __report=_applyOfflineAfterLoad(${now});
  window.__offlineWorkAfter={report:__report,active:colonyProjects.active(),completed:colonyProjects.completed(),clay:economyLedger.materials.clay,
    fiber:economyLedger.materials.fiber,heldClay:economyLedger.materialHeld('clay'),heldFiber:economyLedger.materialHeld('fiber'),umbrales:umbralesRotos,rows:ROWS};
`,ctx);
const before=sb.__offlineWorkBefore,after=sb.__offlineWorkAfter;
check('la obra ya aprobada termina durante la ausencia',!after.active&&after.completed.length===1&&after.completed[0].type==='clay_jars',after.completed);
check('materiales comprometidos se cargan y pagan exactamente una vez',after.clay===before.clay-3&&after.fiber===before.fiber-2&&after.heldClay===0&&after.heldFiber===0,
  {before:{clay:before.clay,fiber:before.fiber},after:{clay:after.clay,fiber:after.fiber},held:[after.heldClay,after.heldFiber]});
const projectReceipt=after.report.applied.project,slabReceipt=after.report.applied.slab;
check('el recibo identifica materiales, nombre y ubicación de la obra',projectReceipt.materialsConsumed.clay===3&&projectReceipt.materialsConsumed.fiber===2&&projectReceipt.name&&Number.isFinite(projectReceipt.anchor.x)&&Number.isFinite(projectReceipt.anchor.y),projectReceipt);
check('el recibo conserva ubicación y daño físico de la losa',slabReceipt.completed&&slabReceipt.damage>0&&Number.isFinite(slabReceipt.anchor.x)&&Number.isFinite(slabReceipt.anchor.y),slabReceipt);
check('la cuadrilla que ya mordía la losa abre una sola banda',after.umbrales===before.umbrales+1&&after.report.applied.slabCompleted===true,{before:before.umbrales,after:after.umbrales});
check('el agregado registra obra y losa como eventos discretos ordenados',after.report.events.filter(e=>e.kind==='project_complete').length===1&&after.report.events.filter(e=>e.kind==='slab_complete').length===1,
  after.report.events.map(e=>e.kind));
check('el regreso no aprueba otra obra ni encadena otra losa',after.completed.length===1&&!after.active&&after.umbrales===before.umbrales+1,
  {completed:after.completed.length,active:after.active,umbrales:after.umbrales});

const nowDig=now+100000;
vm.runInContext(`(()=>{
  topoCreateFreshWorld(48,28);queens[0].health=10;const s=storageStructure(false);s.built=true;s.work=s.workNeeded;s.buildProgress=1;
  const f=worldStats().frontier.find(p=>soilType[p.r]&&soilType[p.r][p.c]!==17&&soilType[p.r][p.c]!==15&&puedeAbrirSuperficie(p.c,p.r)),w=workers[0];
  w.state='CAVANDO';w.digTarget={c:f.c,r:f.r};w.digProgress=0;w.digNeeded=100;brood=[{type:'egg',progress:0,isQueen:false,time:0,x:queens[0].x,y:queens[0].y,hunger:0}];serializeSave(true);window.__partialDigBefore={id:w.id,c:f.c,r:f.r};
})()`,ctx);
let digSave=JSON.parse(store.get('antFarm_fullSave_v2'));digSave.savedAt=nowDig-31000;store.set('antFarm_fullSave_v2',JSON.stringify(digSave));
vm.runInContext(`(()=>{deserializeSave();const r=_applyOfflineAfterLoad(${nowDig}),f=window.__partialDigBefore,w=workers.find(x=>x.id===f.id);window.__partialDigAfter={soil:soil[f.r][f.c],progress:w&&w.digProgress,needed:w&&w.digNeeded,applied:r.applied.digs,brood:r.applied.brood,summary:_offlineReturnModel(r)};})()`,ctx);
const partial=sb.__partialDigAfter;
check('un frente incompleto conserva el avance agregado y su ubicación',partial.soil===1&&partial.progress>0&&partial.progress<partial.needed&&partial.applied.advanced===1&&partial.applied.last.c===sb.__partialDigBefore.c&&partial.applied.last.r===sb.__partialDigBefore.r,partial);
check('el resumen distingue avance parcial de una excavación terminada',partial.summary.changes.some(x=>x.label==='EXCAVATION FRONTS ADVANCED')&&!partial.summary.changes.some(x=>x.label==='EXCAVATIONS OPENED'),partial.summary.changes);
check('la cría parcial también queda aplicada y explicada',partial.brood.advanced===1&&partial.summary.changes.some(x=>x.label==='BROOD CARE ADVANCED'),{brood:partial.brood,changes:partial.summary.changes});

const nowStore=now+200000;
vm.runInContext(`(()=>{
  topoCreateFreshWorld(48,28);queens[0].health=10;const s=storageStructure(false);s.work=0;s.buildProgress=0;
  serializeSave(true);window.__storeBefore={builders:[...(s.builders||[])],built:s.built,projects:colonyProjects.completed().length};
})()`,ctx);
let storeSave=JSON.parse(store.get('antFarm_fullSave_v2'));storeSave.savedAt=nowStore-5*60*1000;store.set('antFarm_fullSave_v2',JSON.stringify(storeSave));
vm.runInContext(`(()=>{deserializeSave();const r=_applyOfflineAfterLoad(${nowStore});const s=storageStructure(false);window.__storeAfter={report:r,built:s&&s.built,progress:s&&s.buildProgress,flags:_offlineProgressFlags(),projects:colonyProjects.completed().length,food:economyLedger.food,capacity:capacidadAlmacen()};})()`,ctx);
const storeBefore=sb.__storeBefore,storeAfter=sb.__storeAfter;
check('la cuadrilla fundadora termina el almacén ya iniciado',storeBefore.builders.length>0&&storeBefore.built===false&&storeAfter.built===true&&storeAfter.progress===1&&storeAfter.report.applied.project.kind==='store'&&storeAfter.report.applied.project.completed,
  {before:storeBefore,after:storeAfter});
check('terminar el almacén desbloquea el siguiente tope sin elegir otra obra',storeAfter.flags.firstChamber===true&&storeAfter.projects===0,storeAfter);
check('el tiempo restante ya puede usar los estantes recién terminados',storeAfter.report.applied.food.harvested>0&&storeAfter.food>storeSave.colonyFood&&storeAfter.food<=storeAfter.capacity+1e-7,
  {before:storeSave.colonyFood,after:storeAfter.food,capacity:storeAfter.capacity,harvested:storeAfter.report.applied.food.harvested});

console.log(`\n${ok} ok · ${fail} FALLOS`);process.exit(fail?1:0);
