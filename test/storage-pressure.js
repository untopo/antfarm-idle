/** storage-pressure.js — app.js real in VM: capacity, typed physical overflow, cache failure and I saves. */
const {ctx,vm}=require('./world-perf-proflib.js');
const run=src=>vm.runInContext(src,ctx);
let pass=0,fail=0;
const ok=(cond,msg,detail='')=>{if(cond){pass++;console.log('ok   '+msg+(detail?' · '+detail:''));}else{fail++;console.log('FAIL '+msg+(detail?' · '+detail:''));}};

run(`topoCreateFreshWorld(48,28);
(function(){
  const s=storageStructure(false),a=_storeAnchor(s);
  for(const id of s.builders){const w=workers.find(x=>x.id===id);w.x=a.x;w.y=a.y;}
  for(let i=0;i<240&&!s.built;i++)for(const id of s.builders){const w=workers.find(x=>x.id===id);w.fatigue=0;workOnStore(w,1,1);}
  reconcileStoragePressure({silent:true});
})();`);

console.log('\n· una entrega nunca rebasa la capacidad protegida');
const split=run(`(()=>{
  foods=foods.filter(f=>!f.storedOverflow);protectedFoodLots=[];
  const node=storageDeliveryNodes().find(n=>n.id==='main'),cap=node.capacity;
  economyLedger.setFood(cap-1,'pressure fixture');_loadProtectedFoodLots(null,economyLedger.food);reconcileStoragePressure({silent:true});
  const result=storeFoodDelivery({amount:3,ftype:'berry',rot:.2},node),pile=foods.find(f=>f.storedOverflow&&f.ftype==='berry');
  return{cap,balance:economyLedger.food,result:{accepted:result.accepted,overflow:result.overflow},pile:pile&&{amount:pile.amount,type:pile.ftype,node:pile.overflowNodeId,rot:pile.rot,preserved:isFoodInStockpile(pile),reachable:isFoodReachable(pile)},pressure:storagePressureSnapshot()};
})()`);
ok(split.result.accepted===1&&split.result.overflow===2&&split.balance===split.cap,'sólo el hueco entra en reserva protegida',JSON.stringify(split.result));
ok(split.pile&&split.pile.amount===2&&split.pile.type==='berry'&&split.pile.node==='main','el resto permanece como comida física tipada junto al nodo');
ok(!split.pile.preserved&&!split.pile.reachable,'el excedente lleno no recibe conservación ni provoca viajes en bucle');
ok(split.pressure.protected===split.cap&&split.pressure.overflow===2&&split.pressure.total===split.cap+2,'el estado separa protegido y excedente sin perder el total');

console.log('\n· el excedente alimenta la colonia al abrirse hueco y conserva deterioro por tipo');
const consume=run(`(()=>{
  const before=overflowFoodAmount(),paid=economyLedger.debitFood(1,{survival:true,reason:'pressure consumption'}),r=reconcileStoragePressure({silent:true});
  const berry=foods.find(f=>f.storedOverflow&&f.ftype==='berry');
  // Lleno de nuevo: miel y semilla quedan fuera, pero su definición no se pudre.
  const node=storageDeliveryNodes().find(n=>n.id==='main');storeFoodDelivery({amount:1,ftype:'honey'},node);storeFoodDelivery({amount:1,ftype:'seed'},node);
  const honey=foods.find(f=>f.storedOverflow&&f.ftype==='honey'),seed=foods.find(f=>f.storedOverflow&&f.ftype==='seed');
  return{before,paid,afterFirst:berry?berry.amount:0,balance:economyLedger.food,absorbed:r.absorbed,
    berryDecay:berry?foodRotProgressPerDt(berry,DAY_LENGTH):0,honeyDecay:foodRotProgressPerDt(honey,DAY_LENGTH),seedDecay:foodRotProgressPerDt(seed,DAY_LENGTH),types:[honey&&honey.ftype,seed&&seed.ftype]};
})()`);
ok(consume.paid===1&&consume.absorbed===1&&consume.afterFirst===1&&consume.balance===split.cap,'al consumirse una ración, el excedente adyacente ocupa físicamente el hueco');
ok(consume.berryDecay>0&&consume.honeyDecay===0&&consume.seedDecay===0,'perecederos se pudren; miel y semillas conservan sus reglas',consume.berryDecay.toFixed(3));
ok(consume.types[0]==='honey'&&consume.types[1]==='seed','cada pila conserva su tipo, no una cifra genérica');

console.log('\n· FORWARD CACHE sólo protege mientras el sitio está conectado y seco');
const cache=run(`(()=>{
  const s=storageStructure(true),rr=Math.min(ROWS-3,s.r+s.h+2),mid=s.c+1;
  for(let y=s.r+s.h;y<=rr;y++){soil[y][mid]=0;soilType[y][mid]=0;}
  for(let c=Math.max(2,s.c-7);c<=Math.min(COLS-4,s.c+9);c++){soil[rr][c]=0;soilType[rr][c]=0;}
  // Add a solid floor under the test row where needed.
  for(let c=2;c<COLS-2;c++)if(soil[rr+1])soil[rr+1][c]=1;
  markSoilDirty();refreshExploration(true);
  let site=null;for(let r=SURFACE_ROW+1;r<ROWS-2&&!site;r++)for(let c=2;c<COLS-3;c++){const q=projectSiteCheck('forward_cache',c,r);if(q.ok){site=q.site;break;}}
  colonyProjects.load({v:1,nextId:2,completed:[{id:'CP-CACHE',type:'forward_cache',site,work:110,workNeeded:110}]});
  const p=colonyProjects.completedRef()[0],node=storageDeliveryNodes().find(n=>n.id===p.id),cap0=capacidadAlmacen();
  const stored=storeFoodDelivery({amount:6,ftype:'seed'},node);const protectedAt=_protectedLotTotal(p.id);
  for(const q of _projectSiteCells(p))water[q.r][q.c]=WATER_AVOID_LEVEL+.2;
  const flood=reconcileStoragePressure({silent:true}),floodPile=foods.find(f=>f.storedOverflow&&f.overflowNodeId===p.id&&f.ftype==='seed');
  const flooded={cap:capacidadAlmacen(),nodes:storageDeliveryNodes().map(n=>n.id),lot:_protectedLotTotal(p.id),pile:floodPile&&floodPile.amount,balance:economyLedger.food};
  for(const q of _projectSiteCells(p))water[q.r][q.c]=0;
  const dry=reconcileStoragePressure({silent:true}),restored={cap:capacidadAlmacen(),lot:_protectedLotTotal(p.id),balance:economyLedger.food};
  // A physical disconnection removes the same six protected places again.
  const broken=_projectSiteCells(p)[0],old=soil[broken.r][broken.c];soil[broken.r][broken.c]=1;markSoilDirty();refreshExploration(true);const cut=reconcileStoragePressure({silent:true});
  const disconnected={operational:_projectSiteOperational(p),cap:capacidadAlmacen(),nodes:storageDeliveryNodes().map(n=>n.id),lot:_protectedLotTotal(p.id),pile:overflowFoodAmount(p.id)};
  soil[broken.r][broken.c]=old;markSoilDirty();refreshExploration(true);
  return{site,cap0,stored:{accepted:stored.accepted,overflow:stored.overflow},protectedAt,flood,flooded,dry,restored,cut,disconnected};
})()`);
ok(cache.site&&cache.stored.accepted===6&&cache.stored.overflow===0&&cache.protectedAt===6,'el cache acepta exactamente sus seis raciones locales');
ok(cache.flooded.cap===cache.cap0-6&&!cache.flooded.nodes.includes('CP-CACHE')&&cache.flooded.lot===0&&cache.flooded.pile>=6,'inundado pierde capacidad y materializa su reserva tipada');
ok(cache.restored.cap===cache.cap0&&cache.restored.lot===6&&cache.dry.absorbed>=6,'al secarse, el mismo alimento físico vuelve a sus estantes');
ok(!cache.disconnected.operational&&cache.disconnected.cap===cache.cap0-6&&!cache.disconnected.nodes.includes('CP-CACHE')&&cache.disconnected.lot===0,'desconectado tampoco concede capacidad ficticia');

console.log('\n· perder el almacén conserva sólo las cinco raciones físicas de supervivencia');
const emergency=run(`(()=>{
  const cp=colonyProjects.completedRef()[0];for(const q of _projectSiteCells(cp)){soil[q.r][q.c]=0;water[q.r][q.c]=0;}for(let c=cp.site.c;c<cp.site.c+(cp.site.w||2);c++)soil[cp.site.r+1][c]=1;
  markSoilDirty();refreshExploration(true);foods=foods.filter(f=>!f.storedOverflow);protectedFoodLots=[];economyLedger.setFood(9,'emergency crop fixture');_loadProtectedFoodLots(null,9);reconcileStoragePressure({silent:true});
  const s=storageStructure(true),broken=_storeFootprint(s)[0],old=soil[broken.r][broken.c];soil[broken.r][broken.c]=1;markSoilDirty();refreshExploration(true);const lost=reconcileStoragePressure({silent:true}),during={...storagePressureSnapshot(),physicalCap:capacidadAlmacen(),crop:_protectedLotTotal('emergency_crop'),main:_protectedLotTotal('main')};
  soil[broken.r][broken.c]=old;markSoilDirty();refreshExploration(true);const recovered=reconcileStoragePressure({silent:true}),after={...storagePressureSnapshot(),crop:_protectedLotTotal('emergency_crop'),main:_protectedLotTotal('main')};
  return{lost,during,recovered,after};
})()`);
ok(emergency.during.protected===5&&emergency.during.capacity===emergency.during.physicalCap+5&&emergency.during.crop===5&&emergency.during.main===0,'la reserva vital queda en buches sociales con un límite comprobable de cinco',JSON.stringify(emergency.during));
ok(emergency.during.overflow===4&&emergency.during.total===9,'todo lo demás sigue como excedente físico, sin borrarse');
ok(emergency.after.protected===9&&emergency.after.overflow===0&&emergency.after.crop===0&&emergency.after.main===9,'al recuperar el almacén, buches y pila vuelven a estantes reales');

console.log('\n· migración G y guardado J conservan cada unidad');
const save=run(`(()=>{
  // Restore geometry, clear pressure fixtures, then emulate an old locationless G balance above capacity.
  const p=colonyProjects.completedRef()[0];for(const q of _projectSiteCells(p)){soil[q.r][q.c]=0;water[q.r][q.c]=0;}for(let c=p.site.c;c<p.site.c+(p.site.w||2);c++)soil[p.site.r+1][c]=1;markSoilDirty();refreshExploration(true);
  foods=foods.filter(f=>!f.storedOverflow);protectedFoodLots=[];const cap=capacidadAlmacen(),legacy=cap+4;
  economyLedger.setFood(legacy,'G migration fixture');_loadProtectedFoodLots(null,legacy);const migrated=reconcileStoragePressure({silent:true}),before={...storagePressureSnapshot(),types:foods.filter(f=>f.storedOverflow).map(f=>f.ftype)};
  serializeSave(true);const raw=JSON.parse(localStorage.getItem(SAVE_KEY)),saved={v:raw.v,lots:raw.protectedFoodLots,overflow:raw.foods.filter(f=>f.storedOverflow)};
  protectedFoodLots=[];foods=[];economyLedger.setFood(0,'erase before round trip');const loaded=deserializeSave(),after={...storagePressureSnapshot(),types:foods.filter(f=>f.storedOverflow).map(f=>f.ftype),lots:protectedFoodLots.map(l=>({kind:l.kind,nodeId:l.nodeId,amount:l.amount}))};
  return{cap,legacy,migrated,before,saved,loaded,after};
})()`);
ok(save.before.protected===save.cap&&save.before.overflow===4&&save.before.total===save.legacy,'G migra al límite y conserva el resto como pila física');
ok(save.before.types.every(t=>t==='honey'),'la reserva G recibe un tipo migratorio estable en vez de quedar sin tipo');
ok(save.saved.v==='20261020j'&&save.saved.lots.length>=2&&save.saved.overflow.some(f=>f.storedOverflow&&f.overflowNodeId),'J guarda procedencia protegida y ubicación del excedente');
ok(save.loaded&&save.after.protected===save.before.protected&&save.after.overflow===save.before.overflow&&save.after.total===save.before.total,'cargar J restaura protegido y excedente sin duplicar ni borrar');
ok(save.after.types.includes('honey')&&save.after.lots.every(l=>l.kind&&l.nodeId&&l.amount>0),'el round trip mantiene tipos y nodos legibles');

console.log(`\nSTORAGE PRESSURE: ${pass} ok · ${fail} fallos`);if(fail)process.exit(1);
