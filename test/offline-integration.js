// test/offline-integration.js — el adaptador carga primero y liquida una sola vez el delta físico.
const fs=require('fs');
const {sb,ctx,vm,store}=require('./world-perf-proflib.js');
const app=fs.readFileSync('/home/user/ant-farm-rpg/js/app.js','utf8');
let ok=0,fail=0;
function check(name,cond,extra){if(cond){ok++;console.log('  ok   '+name);}else{fail++;console.log('  FAIL '+name+(extra!==undefined?' → '+JSON.stringify(extra):''));}}

check('ya no existe ninguno de los dos adelantos provisionales',
  !app.includes('offline catch-up at startup')&&!app.includes('(Date.now()-meta.savedAt)*0.06')&&!app.includes('const offlineDt = offlineMs*0.06'));
check('CONTINUE aplica únicamente el adaptador posterior a deserializeSave',
  /function topoResumeGame\(opts\)\{[\s\S]{0,180}deserializeSave\(\)[\s\S]{0,900}_applyOfflineAfterLoad\(Date\.now\(\)\)/.test(app));
check('el adaptador nunca recorre tickStep para recuperar ausencia',
  !app.slice(app.indexOf('function _applyOfflineAfterLoad'),app.indexOf('// Entry from a saved farm')).includes('tickStep('));

const now=Date.now();
vm.runInContext(`
  topoCreateFreshWorld(48,28);
  const _store=structures.find(s=>s.type==='store');
  _store.built=true;_store.work=_store.workNeeded;_store.buildProgress=1;
  economyLedger.setFood(5,'offline integration start');
  const _front=worldStats().frontier.find(p=>soilType[p.r]&&soilType[p.r][p.c]!==17&&soilType[p.r][p.c]!==15&&puedeAbrirSuperficie(p.c,p.r));
  const _w=workers[0];_w.state='CAVANDO';_w.digTarget={c:_front.c,r:_front.r};_w.digProgress=Math.max(0,_w.digNeeded-1);
  brood=[{type:'pupa',progress:99,genome:JSON.parse(JSON.stringify(_w.genome)),time:0,isQueen:false,faction:_w.faction,parents:[],parentGenomes:[],x:queens[0].x,y:queens[0].y,hunger:0}];
  window.__offlineFixture={c:_front.c,r:_front.r,time:time,workers:workers.length,food:economyLedger.food};
  serializeSave(true);
`,ctx);
const fixture=sb.__offlineFixture;
let data=JSON.parse(store.get('antFarm_fullSave_v2'));
// Simula un guardado J: sin metadatos offline, dos horas atrás.
delete data.offline;data.v='20261020j';data.savedAt=now-2*60*60*1000;
store.set('antFarm_fullSave_v2',JSON.stringify(data));
vm.runInContext(`
  deserializeSave();
  window.__beforeOffline={time,workers:workers.length,food:economyLedger.food,physical:foods.reduce((n,f)=>n+(f.amount||0),0),soil:soil[${fixture.r}][${fixture.c}],savedAt:_loadedSaveSavedAt};
  const _r=_applyOfflineAfterLoad(${now});
  window.__afterOffline={time,workers:workers.length,food:economyLedger.food,physical:foods.reduce((n,f)=>n+(f.amount||0),0),soil:soil[${fixture.r}][${fixture.c}],report:_r,summary:_offlineReturnModel(_r),
    brood:brood.length,receipt:_lastOfflineReceipt,save:JSON.parse(localStorage.getItem(SAVE_KEY))};
  const _once={time,workers:workers.length,food:economyLedger.food,digs,events:events.length};
  const _again=_applyOfflineAfterLoad(${now});
  window.__duplicateOffline={once:_once,again:_again,after:{time,workers:workers.length,food:economyLedger.food,digs,events:events.length}};
`,ctx);
const before=sb.__beforeOffline,after=sb.__afterOffline,dup=sb.__duplicateOffline;
const expectedGame=2*60*60*1000*.06;
check('un save anterior migra y acredita las dos horas válidas',Math.abs((after.time-before.time)-expectedGame)<1e-6,{before:before.time,after:after.time});
check('la pupa abierta eclosiona y no desaparece',after.workers===before.workers+1&&after.report.applied.brood.workerHatches===1,{before:before.workers,after:after.workers,brood:after.brood});
check('sólo termina el frente que ya estaba asignado',before.soil===1&&after.soil===0&&after.report.applied.digsCompleted===1,{before:before.soil,after:after.soil,digs:after.report.applied.digsCompleted});
check('el informe aplicado conserva ubicación y materiales reales de la excavación',after.report.applied.digs.last&&after.report.applied.digs.last.c===fixture.c&&after.report.applied.digs.last.r===fixture.r&&after.report.applied.digs.materials&&typeof after.report.applied.digs.materials==='object',after.report.applied.digs);
check('la comida final procede de existencias físicas y respeta capacidad',after.report.applied.food.harvested>0&&after.food<=after.report.food.capacity+1e-7&&after.food>=0,after.report.applied.food);
check('el adaptador conserva cada ración entre prado, estante y consumo',
  Math.abs((before.physical-after.physical)-after.report.applied.food.harvested)<1e-7&&Math.abs((before.food+before.physical)-(after.food+after.physical)-after.report.applied.food.consumed)<1e-7,
  {before:{stored:before.food,physical:before.physical},after:{stored:after.food,physical:after.physical},applied:after.report.applied.food});
check('el informe conserva tope, iteraciones y cuello de botella comprobables',after.report.window.capHours===8&&after.report.iterations<4096&&typeof after.report.bottleneck==='string',
  {cap:after.report.window.capHours,it:after.report.iterations,b:after.report.bottleneck});
check('la liquidación guarda recibo y versión de esquema offline',after.save.offline&&after.save.offline.v===1&&after.save.offline.receipt.sourceSavedAt===before.savedAt,after.save.offline);
check('el modelo de regreso resume el recibo sin una segunda simulación',after.summary.time.label==='2H'&&after.summary.changes.some(x=>x.label==='WORKERS HATCHED')&&after.summary.changes.some(x=>x.label==='EXCAVATIONS OPENED')&&after.summary.suggestions.length===2,after.summary);
check('el resumen pendiente se guarda hasta su única presentación',Array.isArray(after.save.offline.pending)&&after.save.offline.pending.length===1&&after.save.offline.pending[0].key===after.summary.key&&Array.isArray(after.save.offline.presented)&&after.save.offline.presented.length===0,after.save.offline);
check('repetir apply sobre el mismo sello no cambia ningún saldo',dup.again===null&&JSON.stringify(dup.once)===JSON.stringify(dup.after),dup);

// El save escrito tras liquidar tiene un timestamp nuevo: otra carga inmediata tampoco repite el delta.
vm.runInContext(`
  const __reloadOk=deserializeSave(),__reloadT=time,__reloadW=workers.length,__reloadF=economyLedger.food,__reloadD=digs;
  const __reloadR=_applyOfflineAfterLoad(${now+10000});
  window.__reloadOffline={ok:__reloadOk,result:__reloadR,before:{t:__reloadT,w:__reloadW,f:__reloadF,d:__reloadD},after:{t:time,w:workers.length,f:economyLedger.food,d:digs}};
`,ctx);
const reload=sb.__reloadOffline;
check('recargar inmediatamente no duplica tiempo, nacimientos, comida ni excavación',reload.ok&&reload.result&&reload.result.skipped&&JSON.stringify(reload.before)===JSON.stringify(reload.after),reload);

vm.runInContext(`
  _offlineUnlocks={lineage:true,lateStage:true};_lastOfflineReceipt={sourceSavedAt:123,creditedMs:999};
  topoCreateFreshWorld(48,28);serializeSave(true);
  window.__freshOfflineMeta=JSON.parse(localStorage.getItem(SAVE_KEY)).offline;
`,ctx);
const fresh=sb.__freshOfflineMeta;
check('una granja nueva no hereda tope ni recibo offline de la archivada',fresh&&fresh.unlocks.lineage===false&&fresh.unlocks.lateStage===false&&fresh.receipt===null&&Array.isArray(fresh.pending)&&fresh.pending.length===0&&Array.isArray(fresh.presented)&&fresh.presented.length===0,fresh);
vm.runInContext(`(()=>{_offlineReturnPending=[];_offlinePresentedStamps.clear();const base={window:{creditedMs:60000,rawMs:60000,capHours:4},bottleneck:'none',idleGameUnits:0,events:[],applied:{food:{harvested:0,consumed:0},brood:{},project:{},digs:{completed:0,advanced:0,materials:{}},slab:{},structuresCompleted:0}};const a=_queueOfflineReturn({...base,receipt:{sourceSavedAt:101,creditedMs:60000,capHours:4}}),b=_queueOfflineReturn({...base,receipt:{sourceSavedAt:202,creditedMs:60000,capHours:4}}),again=_queueOfflineReturn({...base,receipt:{sourceSavedAt:101,creditedMs:60000,capHours:4}});window.__offlineQueue={a:a&&a.key,b:b&&b.key,again,n:_offlineReturnPending.length,keys:_offlineReturnPending.map(x=>x.key)};})()`,ctx);
const queued=sb.__offlineQueue;
check('si quedaron dos recibos pendientes se conservan en orden y sin duplicar sellos',queued.n===2&&queued.keys[0]===queued.a&&queued.keys[1]===queued.b&&queued.again===null,queued);

console.log(`\n${ok} ok · ${fail} FALLOS`);
process.exit(fail?1:0);
