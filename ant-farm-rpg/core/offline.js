'use strict';
// core/offline.js — progreso agregado y determinista al volver.
// No conoce DOM, canvas, localStorage ni entidades animadas. Recibe sólo saldos, tasas y trabajos
// que ya estaban abiertos al guardar; devuelve un estado y eventos que el adaptador físico aplica una vez.
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  if(root) Object.assign(root,api);
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const HOUR_MS=60*60*1000;
  const EPS=1e-8;
  const OFFLINE_CAP_HOURS=Object.freeze({FOUNDING:4,FIRST_CHAMBER:8,LINEAGE:12,LATE_STAGE:24});
  const STAGES=new Set(['egg','larva','pupa']);
  const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
  const nonneg=(value,fallback=0)=>Math.max(0,finite(value,fallback));
  const integer=value=>Math.max(0,Math.floor(nonneg(value)));
  const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
  const clamp=(value,lo,hi)=>Math.max(lo,Math.min(hi,value));

  function offlineCapHours(progress){
    const p=progress&&typeof progress==='object'?progress:{};
    if(p.lateStage)return OFFLINE_CAP_HOURS.LATE_STAGE;
    if(p.lineage)return OFFLINE_CAP_HOURS.LINEAGE;
    if(p.firstChamber)return OFFLINE_CAP_HOURS.FIRST_CHAMBER;
    return OFFLINE_CAP_HOURS.FOUNDING;
  }

  function computeOfflineWindow(options){
    const o=options&&typeof options==='object'?options:{};
    const savedAt=finite(o.savedAt,0),now=finite(o.now,0);
    const capHours=offlineCapHours(o.progress);
    const capMs=capHours*HOUR_MS;
    const minAwayMs=Math.max(0,finite(o.minAwayMs,30000));
    const rawMs=savedAt>0&&now>savedAt?now-savedAt:0;
    const creditedMs=rawMs>=minAwayMs?Math.min(rawMs,capMs):0;
    let reason='ok';
    if(savedAt<=0)reason='missing_timestamp';
    else if(now<=savedAt)reason='clock_not_forward';
    else if(rawMs<minAwayMs)reason='short_absence';
    else if(rawMs>capMs)reason='capped';
    return Object.freeze({savedAt,now,rawMs,creditedMs,discardedMs:Math.max(0,rawMs-creditedMs),capHours,capMs,minAwayMs,reason});
  }

  function normalBrood(list){
    const out=[];
    for(let i=0;i<(Array.isArray(list)?list.length:0);i++){
      const raw=list[i]||{},type=STAGES.has(raw.type)?raw.type:'egg';
      out.push({
        id:String(raw.id||('brood-'+i)),type,progress:clamp(nonneg(raw.progress),0,100),
        isQueen:!!raw.isQueen,waiting:!!raw.waiting,payload:clone(raw.payload)
      });
    }
    return out;
  }

  function normalQueens(list){
    const out=[];
    for(let i=0;i<(Array.isArray(list)?list.length:0);i++){
      const raw=list[i]||{};
      out.push({
        id:String(raw.id||('queen-'+i)),progress:clamp(nonneg(raw.progress),0,100),rate:nonneg(raw.rate),
        enabled:raw.enabled!==false,royalNext:!!raw.royalNext,serial:integer(raw.serial),payload:clone(raw.payload)
      });
    }
    return out;
  }

  function normalProject(raw){
    if(!raw||typeof raw!=='object')return null;
    const workNeeded=nonneg(raw.workNeeded);
    return {
      id:String(raw.id||'project'),enabled:raw.enabled!==false,
      haulRemaining:integer(raw.haulRemaining),haulRate:nonneg(raw.haulRate),haulProgress:clamp(nonneg(raw.haulProgress),0,1-EPS),hauled:integer(raw.hauled),
      work:clamp(nonneg(raw.work),0,workNeeded),workNeeded,workRate:nonneg(raw.workRate),foodFloor:nonneg(raw.foodFloor),capacityAfter:nonneg(raw.capacityAfter),completed:workNeeded<=EPS
    };
  }

  function normalSlab(raw){
    if(!raw||typeof raw!=='object')return null;
    const hpMax=Math.max(nonneg(raw.hpMax),nonneg(raw.hp));
    return {id:String(raw.id||'slab'),enabled:raw.enabled!==false,hp:clamp(nonneg(raw.hp),0,hpMax),hpMax,rate:nonneg(raw.rate),completed:nonneg(raw.hp)<=EPS};
  }

  function normalDigs(list){
    const out=[];
    for(let i=0;i<(Array.isArray(list)?list.length:0);i++){
      const raw=list[i]||{},needed=Math.max(EPS,nonneg(raw.needed,100));
      out.push({id:String(raw.id||('dig-'+i)),enabled:raw.enabled!==false,progress:clamp(nonneg(raw.progress),0,needed),needed,rate:nonneg(raw.rate),completed:nonneg(raw.progress)>=needed-EPS,payload:clone(raw.payload)});
    }
    return out;
  }

  function advanceOffline(options){
    const o=options&&typeof options==='object'?options:{};
    const window=o.window&&typeof o.window==='object'?o.window:computeOfflineWindow(o);
    const dayLength=Math.max(1,nonneg(o.dayLength,72000));
    const gameUnitsPerMs=nonneg(o.gameUnitsPerMs,0.06);
    const totalGameUnits=nonneg(window.creditedMs)*gameUnitsPerMs;
    const maxIterations=Math.max(32,integer(o.maxIterations)||4096);
    const rates=Object.assign({egg:0.00345,larva:0.00235,pupa:0.00325},o.broodRates||{});
    rates.egg=nonneg(rates.egg);rates.larva=nonneg(rates.larva);rates.pupa=nonneg(rates.pupa);
    const larvaFoodPerProgress=nonneg(o.larvaFoodPerProgress,0.025);
    const broodCapacity=Math.max(0,integer(o.broodCapacity));
    const careCapacity=o.careCapacity===Infinity?Infinity:Math.max(0,nonneg(o.careCapacity));
    const eggCost=nonneg(o.eggCost,3),eggFoodFloor=nonneg(o.eggFoodFloor,5),eggBroodSupport=nonneg(o.eggBroodSupport,0);
    const foodRaw=o.food&&typeof o.food==='object'?o.food:{};
    const food={
      stored:nonneg(foodRaw.stored),capacity:Math.max(nonneg(foodRaw.capacity),nonneg(foodRaw.stored)),
      reserve:nonneg(foodRaw.reserve),surface:nonneg(foodRaw.surface),forageRate:nonneg(foodRaw.forageRate),
      harvested:0,broodConsumed:0,eggsConsumed:0
    };
    food.reserve=Math.min(food.reserve,food.capacity);
    const workforceRaw=o.workers&&typeof o.workers==='object'?o.workers:{};
    const workforce={count:integer(workforceRaw.count),maxPopulation:Math.max(0,integer(workforceRaw.maxPopulation)),workerHatches:0,queenHatches:0};
    const brood=normalBrood(o.brood),queens=normalQueens(o.queens),project=normalProject(o.project),slab=normalSlab(o.slab),digs=normalDigs(o.digs);
    const events=[];
    let elapsed=0,remaining=totalGameUnits,iterations=0,eventLimit=false,nextEggSerial=0;
    for(const q of queens)nextEggSerial=Math.max(nextEggSerial,q.serial||0);
    const event=(kind,data)=>events.push(Object.assign({kind,atGameUnits:elapsed},data||{}));
    const eggThreshold=()=>eggCost+Math.max(food.reserve,eggFoodFloor,eggBroodSupport*brood.length);
    function settleEvents(){
      let changed=false;
      // Metamorphosis frees nursery slots before queens evaluate a new egg at the same timestamp.
      for(let i=0;i<brood.length;){
        const b=brood[i];if(b.waiting||b.progress<100-EPS){i++;continue;}
        if(b.type==='egg'){b.type='larva';b.progress=0;event('brood_stage',{id:b.id,stage:'larva'});changed=true;i++;continue;}
        if(b.type==='larva'){b.type='pupa';b.progress=0;event('brood_stage',{id:b.id,stage:'pupa'});changed=true;i++;continue;}
        if(b.isQueen||workforce.count<workforce.maxPopulation){
          brood.splice(i,1);
          if(b.isQueen)workforce.queenHatches++;else {workforce.count++;workforce.workerHatches++;}
          event('hatch',{id:b.id,isQueen:b.isQueen,record:clone(b)});changed=true;
        }else{
          b.progress=100;b.waiting=true;event('population_wait',{id:b.id,limit:workforce.maxPopulation});changed=true;i++;
        }
      }
      for(const q of queens){
        if(q.progress<100-EPS)continue;
        if(!q.enabled||brood.length>=broodCapacity||food.stored<eggThreshold()-EPS){q.progress=Math.min(q.progress,100-EPS);continue;}
        food.stored=Math.max(food.reserve,food.stored-eggCost);food.eggsConsumed+=eggCost;
        q.progress=0;q.serial++;nextEggSerial=Math.max(nextEggSerial+1,q.serial);
        const id='offline-egg-'+q.id+'-'+nextEggSerial;
        const egg={id,type:'egg',progress:0,isQueen:q.royalNext,waiting:false,payload:{kind:'queen',queenId:q.id,serial:nextEggSerial}};
        q.royalNext=false;brood.push(egg);event('egg_laid',{id,queenId:q.id,isQueen:egg.isQueen});changed=true;
      }
      if(project&&project.enabled&&!project.completed){
        if(project.haulRemaining>0&&project.haulProgress>=1-EPS){
          project.haulRemaining--;project.haulProgress=0;project.hauled++;changed=true;
          if(project.haulRemaining===0)event('project_materials_ready',{id:project.id,hauled:project.hauled});
        }else if(project.haulRemaining===0&&project.work>=project.workNeeded-EPS){
          project.work=project.workNeeded;project.completed=true;if(project.capacityAfter>food.capacity)food.capacity=project.capacityAfter;event('project_complete',{id:project.id});changed=true;
        }
      }
      if(slab&&slab.enabled&&!slab.completed&&slab.hp<=EPS){slab.hp=0;slab.completed=true;event('slab_complete',{id:slab.id});changed=true;}
      for(const d of digs)if(d.enabled&&!d.completed&&d.progress>=d.needed-EPS){d.progress=d.needed;d.completed=true;event('dig_complete',{id:d.id,payload:clone(d.payload)});changed=true;}
      return changed;
    }

    function activeFlow(){
      const larvae=brood.filter(b=>b.type==='larva'&&!b.waiting&&b.progress<100-EPS);
      const careScale=larvae.length===0?0:(careCapacity===Infinity?1:Math.min(1,careCapacity/larvae.length));
      const desired=[];let desiredFoodRate=0;
      for(const b of larvae){const rate=rates.larva*careScale;desired.push([b,rate]);desiredFoodRate+=rate*larvaFoodPerProgress;}
      const hasSurface=food.surface>EPS&&food.forageRate>EPS;
      let forage=0,larvaScale=1;
      if(food.stored<food.reserve-EPS){
        // Primero se reconstruye la reserva. La cría no convierte alimento que aún no ha llegado.
        larvaScale=0;forage=hasSurface?food.forageRate:0;
      }else if(food.stored<=food.reserve+EPS&&desiredFoodRate>EPS){
        forage=hasSurface?Math.min(food.forageRate,Math.max(desiredFoodRate,food.capacity>food.stored+EPS?food.forageRate:desiredFoodRate)):0;
        if(forage<desiredFoodRate)larvaScale=forage/desiredFoodRate;
      }else{
        const room=food.stored<food.capacity-EPS;
        if(hasSurface&&(room||desiredFoodRate>EPS))forage=room?food.forageRate:Math.min(food.forageRate,desiredFoodRate);
      }
      const larvaRates=new Map();let consume=0;
      for(const pair of desired){const rate=pair[1]*larvaScale;larvaRates.set(pair[0].id,rate);consume+=rate*larvaFoodPerProgress;}
      return {larvaRates,consume,forage,net:forage-consume};
    }

    if(totalGameUnits>EPS)settleEvents();
    while(remaining>EPS&&iterations<maxIterations){
      iterations++;
      const flow=activeFlow(),candidates=[remaining];
      let anyRate=Math.abs(flow.net)>EPS||flow.forage>EPS||flow.consume>EPS;
      if(flow.forage>EPS)candidates.push(food.surface/flow.forage);
      if(flow.net>EPS&&food.stored<food.capacity-EPS)candidates.push((food.capacity-food.stored)/flow.net);
      if(flow.net<0&&food.stored>food.reserve+EPS)candidates.push((food.stored-food.reserve)/(-flow.net));
      if(flow.net>EPS&&food.stored<food.reserve-EPS)candidates.push((food.reserve-food.stored)/flow.net);
      const currentEggThreshold=eggThreshold();
      if(flow.net>EPS&&food.stored<currentEggThreshold-EPS)candidates.push((currentEggThreshold-food.stored)/flow.net);
      if(flow.net<0&&food.stored>currentEggThreshold+EPS)candidates.push((food.stored-currentEggThreshold)/(-flow.net));

      for(const b of brood){
        if(b.waiting||b.progress>=100-EPS)continue;
        const rate=b.type==='larva'?(flow.larvaRates.get(b.id)||0):rates[b.type];
        if(rate>EPS){candidates.push((100-b.progress)/rate);anyRate=true;}
      }
      const broodHasRoom=brood.length<broodCapacity,activeQueens=new Set();
      for(const q of queens){
        const canLay=q.enabled&&q.rate>EPS&&broodHasRoom&&food.stored>=currentEggThreshold-EPS&&!(flow.net<0&&food.stored<=currentEggThreshold+EPS);
        if(canLay&&q.progress<100-EPS){activeQueens.add(q.id);candidates.push((100-q.progress)/q.rate);anyRate=true;}
      }
      const activeProject=!!(project&&project.enabled&&!project.completed&&food.stored>=project.foodFloor-EPS&&!(flow.net<0&&food.stored<=project.foodFloor+EPS));
      if(project&&project.enabled&&!project.completed&&!activeProject&&flow.net>EPS&&food.stored<project.foodFloor-EPS)candidates.push((project.foodFloor-food.stored)/flow.net);
      if(project&&project.enabled&&!project.completed&&activeProject&&flow.net<0&&food.stored>project.foodFloor+EPS)candidates.push((food.stored-project.foodFloor)/(-flow.net));
      if(activeProject){
        if(project.haulRemaining>0&&project.haulRate>EPS){candidates.push((1-project.haulProgress)/project.haulRate);anyRate=true;}
        else if(project.haulRemaining===0&&project.workRate>EPS&&project.work<project.workNeeded-EPS){candidates.push((project.workNeeded-project.work)/project.workRate);anyRate=true;}
      }
      if(slab&&slab.enabled&&!slab.completed&&slab.rate>EPS){candidates.push(slab.hp/slab.rate);anyRate=true;}
      for(const d of digs)if(d.enabled&&!d.completed&&d.rate>EPS){candidates.push((d.needed-d.progress)/d.rate);anyRate=true;}
      if(!anyRate)break;
      let step=Math.min(...candidates.filter(x=>Number.isFinite(x)&&x>EPS));
      if(!Number.isFinite(step)||step<=EPS)step=Math.min(remaining,EPS*10);
      step=Math.min(step,remaining);

      const beforeStored=food.stored,beforeSurface=food.surface;
      const harvest=Math.min(food.surface,flow.forage*step);
      const broodCost=Math.min(food.stored+harvest,flow.consume*step);
      food.surface=Math.max(0,food.surface-harvest);
      food.stored=clamp(food.stored+harvest-broodCost,0,food.capacity);
      food.harvested+=beforeSurface-food.surface;
      food.broodConsumed+=broodCost;
      // Keep accounting stable at a full shelf or at the protected floor.
      if(Math.abs(food.stored-food.capacity)<EPS)food.stored=food.capacity;
      if(Math.abs(food.stored-food.reserve)<EPS)food.stored=food.reserve;
      if(food.stored<beforeStored-EPS&&food.stored<food.reserve)food.stored=food.reserve;

      for(const b of brood){
        if(b.waiting||b.progress>=100-EPS)continue;
        const rate=b.type==='larva'?(flow.larvaRates.get(b.id)||0):rates[b.type];
        b.progress=Math.min(100,b.progress+rate*step);
      }
      for(const q of queens)if(activeQueens.has(q.id))q.progress=Math.min(100,q.progress+q.rate*step);
      if(activeProject){
        if(project.haulRemaining>0&&project.haulRate>EPS)project.haulProgress=Math.min(1,project.haulProgress+project.haulRate*step);
        else if(project.haulRemaining===0&&project.workRate>EPS)project.work=Math.min(project.workNeeded,project.work+project.workRate*step);
      }
      if(slab&&slab.enabled&&!slab.completed&&slab.rate>EPS)slab.hp=Math.max(0,slab.hp-slab.rate*step);
      for(const d of digs)if(d.enabled&&!d.completed&&d.rate>EPS)d.progress=Math.min(d.needed,d.progress+d.rate*step);
      elapsed+=step;remaining=Math.max(0,remaining-step);

      settleEvents();
    }
    if(iterations>=maxIterations&&remaining>EPS)eventLimit=true;

    let bottleneck='none';
    if(eventLimit)bottleneck='event_limit';
    else if(brood.some(b=>b.waiting))bottleneck='population';
    else if(queens.some(q=>q.enabled&&q.progress>0)&&brood.length>=broodCapacity)bottleneck='brood_space';
    else if((brood.some(b=>b.type==='larva'&&!b.waiting)||queens.some(q=>q.enabled))&&food.surface<=EPS&&food.stored<=food.reserve+EPS)bottleneck='food';
    else if(food.surface>EPS&&food.stored>=food.capacity-EPS)bottleneck='storage';
    else if(project&&!project.completed&&food.stored<project.foodFloor-EPS)bottleneck='food';
    else if(project&&!project.completed&&project.haulRemaining>0&&project.haulRate<=EPS)bottleneck='project_crew';
    else if(project&&!project.completed&&project.haulRemaining===0&&project.workRate<=EPS)bottleneck='project_work';
    else if(slab&&!slab.completed&&slab.rate<=EPS)bottleneck='slab_crew';

    return {
      v:1,window:{...window},dayLength,gameUnitsPerMs,totalGameUnits,advancedGameUnits:elapsed,idleGameUnits:Math.max(0,totalGameUnits-elapsed),
      iterations,eventLimit,bottleneck,
      food:{...food,consumed:food.broodConsumed+food.eggsConsumed},workers:{...workforce},
      brood:clone(brood),queens:clone(queens),project:clone(project),slab:clone(slab),digs:clone(digs),events:clone(events)
    };
  }

  return {HOUR_MS,OFFLINE_CAP_HOURS,offlineCapHours,computeOfflineWindow,advanceOffline};
});
