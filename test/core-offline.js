// test/core-offline.js — el regreso usa delta + eventos discretos, nunca cuadros animados.
const assert=require('assert');
const {HOUR_MS,offlineCapHours,computeOfflineWindow,advanceOffline}=require('../ant-farm-rpg/core/offline.js');
let ok=0;
function test(name,fn){try{fn();ok++;console.log('  ok   '+name);}catch(e){console.error('  FAIL '+name+' → '+e.message);process.exitCode=1;}}
const near=(a,b,t=1e-6)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`);
const windowFor=hours=>({savedAt:1000,now:1000+hours*HOUR_MS,rawMs:hours*HOUR_MS,creditedMs:hours*HOUR_MS,discardedMs:0,capHours:24,capMs:24*HOUR_MS,minAwayMs:0,reason:'ok'});

test('el tope físico sube exactamente 4 → 8 → 12 → 24 h',()=>{
  assert.deepStrictEqual([
    offlineCapHours({}),offlineCapHours({firstChamber:true}),offlineCapHours({lineage:true}),offlineCapHours({lateStage:true})
  ],[4,8,12,24]);
});

test('el reloj hacia atrás y las ausencias diminutas no producen nada',()=>{
  assert.equal(computeOfflineWindow({savedAt:2000,now:1000}).creditedMs,0);
  assert.equal(computeOfflineWindow({savedAt:1000,now:20000,minAwayMs:30000}).creditedMs,0);
});

test('una fundación acredita como máximo cuatro horas reales',()=>{
  const w=computeOfflineWindow({savedAt:1000,now:1000+19*HOUR_MS,progress:{}});
  assert.equal(w.creditedMs,4*HOUR_MS);assert.equal(w.reason,'capped');assert.equal(w.discardedMs,15*HOUR_MS);
});

test('recolección respeta comida física y capacidad sin crear stock',()=>{
  const r=advanceOffline({window:windowFor(2),food:{stored:4,capacity:10,reserve:3,surface:20,forageRate:2/72000},
    workers:{count:4,maxPopulation:12},broodCapacity:8,careCapacity:0});
  near(r.food.stored,10);near(r.food.harvested,6);near(r.food.surface,14);
  assert.equal(r.bottleneck,'storage');assert.ok(r.iterations<20);
});

test('la cría atraviesa etapas y se detiene de verdad en el tope de población',()=>{
  const r=advanceOffline({window:windowFor(1),food:{stored:20,capacity:20,reserve:5,surface:0,forageRate:0},
    workers:{count:2,maxPopulation:2},broodCapacity:5,careCapacity:5,
    brood:[{id:'b1',type:'pupa',progress:99},{id:'b2',type:'egg',progress:99}],queens:[]});
  assert.equal(r.workers.workerHatches,0);
  const p=r.brood.find(x=>x.id==='b1');assert.equal(p.type,'pupa');assert.equal(p.progress,100);assert.equal(p.waiting,true);
  assert.ok(r.events.some(e=>e.kind==='brood_stage'&&e.id==='b2'));
  assert.equal(r.bottleneck,'population');
});

test('una pupa eclosiona si hay plaza y aumenta la población una sola vez',()=>{
  const r=advanceOffline({window:windowFor(.1),food:{stored:5,capacity:8,reserve:5,surface:0,forageRate:0},
    workers:{count:2,maxPopulation:3},broodCapacity:4,careCapacity:0,brood:[{id:'p',type:'pupa',progress:99}]});
  assert.equal(r.workers.count,3);assert.equal(r.workers.workerHatches,1);
  assert.equal(r.events.filter(e=>e.kind==='hatch').length,1);assert.ok(!r.brood.some(x=>x.id==='p'));
});

test('ninguna puesta puede gastar por debajo de la reserva ni crear comida',()=>{
  const initial={stored:5,surface:24},r=advanceOffline({window:windowFor(4),food:{...initial,capacity:10,reserve:9,forageRate:4/72000},
    workers:{count:3,maxPopulation:12},broodCapacity:8,careCapacity:4,queens:[{id:'q',progress:99,rate:.01,enabled:true}]});
  near(r.food.stored+r.food.surface+r.food.consumed,initial.stored+initial.surface);
  assert.ok(r.food.stored>=9-1e-7);assert.ok(r.food.eggsConsumed<=initial.stored+initial.surface-9+1e-7);
});

test('la reina sólo pone con espacio y comida sobre la reserva',()=>{
  const common={window:windowFor(.25),workers:{count:2,maxPopulation:10},broodCapacity:2,careCapacity:2,
    queens:[{id:'q',progress:99,rate:.01,enabled:true}],brood:[],eggFoodFloor:5,eggCost:3};
  const noFood=advanceOffline({...common,food:{stored:7.9,capacity:20,reserve:5,surface:0,forageRate:0}});
  assert.equal(noFood.events.filter(e=>e.kind==='egg_laid').length,0);near(noFood.food.stored,7.9);
  const yes=advanceOffline({...common,food:{stored:12,capacity:20,reserve:5,surface:0,forageRate:0}});
  assert.ok(yes.events.some(e=>e.kind==='egg_laid'));assert.ok(yes.food.eggsConsumed>=3);
  assert.ok(yes.brood.length<=2);
});

test('obras, losa y frentes abiertos avanzan por eventos, sin inventar otro trabajo',()=>{
  const r=advanceOffline({window:windowFor(1),food:{stored:8,capacity:8,reserve:5,surface:0,forageRate:0},
    workers:{count:6,maxPopulation:20},broodCapacity:0,careCapacity:0,
    project:{id:'P',haulRemaining:2,haulRate:2/72000,work:0,workNeeded:80,workRate:80/72000,enabled:true},
    slab:{id:'S',hp:20,hpMax:20,rate:20/72000,enabled:true},
    digs:[{id:'D',progress:1,needed:10,rate:10/72000,enabled:true,payload:{c:4,r:9}}]});
  assert.equal(r.project.completed,true);assert.equal(r.project.hauled,2);
  assert.equal(r.slab.completed,true);assert.equal(r.digs[0].completed,true);
  assert.equal(r.events.filter(e=>e.kind==='project_complete').length,1);
  assert.equal(r.events.filter(e=>e.kind==='slab_complete').length,1);
  assert.equal(r.events.filter(e=>e.kind==='dig_complete').length,1);
});

test('una obra de almacén abre capacidad para el tiempo que aún queda',()=>{
  const r=advanceOffline({window:windowFor(1),food:{stored:8,capacity:8,reserve:5,surface:20,forageRate:4/72000},
    workers:{count:4,maxPopulation:12},broodCapacity:0,
    project:{id:'STORE',foodFloor:6,capacityAfter:20,haulRemaining:0,work:0,workNeeded:20,workRate:20/72000,enabled:true}});
  assert.equal(r.project.completed,true);assert.equal(r.food.capacity,20);assert.ok(r.food.stored>8,'stock '+r.food.stored);assert.ok(r.food.harvested>0);
});

test('sin cuadrilla, un proyecto abierto conserva exactamente su estado',()=>{
  const r=advanceOffline({window:windowFor(4),food:{stored:9,capacity:12,reserve:5,surface:0,forageRate:0},
    workers:{count:5,maxPopulation:12},broodCapacity:0,project:{id:'P',haulRemaining:3,haulRate:0,work:7,workNeeded:84,workRate:0}});
  assert.equal(r.project.haulRemaining,3);assert.equal(r.project.work,7);assert.equal(r.bottleneck,'project_crew');
});

test('un evento ya maduro se liquida en t=0 sin necesitar cuadros de relleno',()=>{
  const r=advanceOffline({window:windowFor(.01),food:{stored:5,capacity:5,reserve:5,surface:0,forageRate:0},
    workers:{count:1,maxPopulation:2},broodCapacity:2,brood:[{id:'ready',type:'pupa',progress:100}]});
  assert.equal(r.workers.workerHatches,1);assert.equal(r.events[0].kind,'hatch');assert.equal(r.events[0].atGameUnits,0);
});

test('una obra aprobada reanuda cuando la recolección supera su suelo de comida',()=>{
  const r=advanceOffline({window:windowFor(1),food:{stored:5,capacity:12,reserve:5,surface:20,forageRate:3/72000},
    workers:{count:4,maxPopulation:10},broodCapacity:0,
    project:{id:'P',foodFloor:6,haulRemaining:0,work:0,workNeeded:20,workRate:20/72000,enabled:true}});
  assert.equal(r.project.completed,true);assert.ok(r.food.stored>=6);
});

test('dos deltas consecutivos conservan el mismo estado final que un delta único',()=>{
  const base={food:{stored:7,capacity:15,reserve:5,surface:40,forageRate:2/72000},workers:{count:3,maxPopulation:10},broodCapacity:8,careCapacity:4,
    brood:[{id:'a',type:'egg',progress:10},{id:'b',type:'larva',progress:20}],queens:[]};
  const once=advanceOffline({...base,window:windowFor(2)}),first=advanceOffline({...base,window:windowFor(1)});
  const second=advanceOffline({...base,window:windowFor(1),food:{...base.food,stored:first.food.stored,surface:first.food.surface},
    workers:{count:first.workers.count,maxPopulation:first.workers.maxPopulation},brood:first.brood});
  near(second.food.stored,once.food.stored);near(second.food.surface,once.food.surface);
  assert.equal(second.workers.count,once.workers.count);assert.deepStrictEqual(second.brood,once.brood);
});

test('el cálculo agregado no escala con cuadros ni con las horas ausente',()=>{
  const r=advanceOffline({window:windowFor(24),food:{stored:5,capacity:100,reserve:5,surface:500,forageRate:10/72000},
    workers:{count:5,maxPopulation:10},broodCapacity:0});
  assert.ok(r.iterations<20,'iteraciones '+r.iterations);
  assert.ok(r.totalGameUnits>5e6);
});

if(!process.exitCode)console.log(`\n${ok} ok · 0 FALLOS`);
