'use strict';
// core/lineage.js — pure Nuptial Flight and amber economy.
// No DOM, canvas, storage, clock, or animated entities. Amber enters only through completeNuptialFlight;
// upgrades are finite and bought only with that earned balance.
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)Object.assign(root,api);
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const LINEAGE_VERSION=1;
  const MAX_HISTORY=24;
  const UPGRADE_DEFS=Object.freeze({
    trail_memory:Object.freeze({id:'trail_memory',name:'TRAIL MEMORY',max:3,costs:Object.freeze([2,5,9]),
      description:'Player-drawn follow trails remain readable for 25% longer per rank.'}),
    sealed_jars:Object.freeze({id:'sealed_jars',name:'SEALED JARS',max:3,costs:Object.freeze([3,7,12]),
      description:'A completed nest store protects 2 additional rations per rank.'}),
    forager_marks:Object.freeze({id:'forager_marks',name:'FORAGER MARKS',max:3,costs:Object.freeze([4,8,13]),
      description:'Scouts notice wild surface food 4 cells farther away per rank.'}),
    deep_rest:Object.freeze({id:'deep_rest',name:'DEEP REST',max:3,costs:Object.freeze([4,9,15]),
      description:'Rest restores fatigue 15% faster per rank.'})
  });
  const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
  const nonneg=(v,f=0)=>Math.max(0,finite(v,f));
  const integer=v=>Math.max(0,Math.floor(nonneg(v)));
  const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
  const copy=v=>JSON.parse(JSON.stringify(v));

  function freshLineageState(){
    return {v:LINEAGE_VERSION,amber:0,earned:0,spent:0,flights:0,upgrades:{trail_memory:0,sealed_jars:0,forager_marks:0,deep_rest:0},
      best:{slabs:0,depth:0,relics:0,award:0},history:[]};
  }

  function normalizeLineageState(raw){
    const base=freshLineageState(),src=raw&&typeof raw==='object'?raw:{};
    base.amber=nonneg(src.amber);base.earned=nonneg(src.earned);base.spent=nonneg(src.spent);base.flights=integer(src.flights);
    const upgrades=src.upgrades&&typeof src.upgrades==='object'?src.upgrades:{};
    for(const id of Object.keys(UPGRADE_DEFS))base.upgrades[id]=clamp(integer(upgrades[id]),0,UPGRADE_DEFS[id].max);
    const best=src.best&&typeof src.best==='object'?src.best:{};
    base.best={slabs:integer(best.slabs),depth:integer(best.depth),relics:integer(best.relics),award:nonneg(best.award)};
    const history=Array.isArray(src.history)?src.history:[];
    base.history=history.slice(-MAX_HISTORY).map((h,i)=>({
      id:String(h&&h.id||('flight-'+(i+1))),at:Math.max(0,Math.floor(finite(h&&h.at))),award:nonneg(h&&h.award),
      slabs:integer(h&&h.slabs),depth:integer(h&&h.depth),relics:integer(h&&h.relics),generation:integer(h&&h.generation),
      worldSeed:Math.max(0,Math.floor(finite(h&&h.worldSeed))),sizeKey:String(h&&h.sizeKey||'')
    }));
    // Never let malformed imported totals describe more spent amber than was ever earned.
    base.earned=Math.max(base.earned,base.spent+base.amber);
    return base;
  }

  function normalizeRun(raw){
    const r=raw&&typeof raw==='object'?raw:{};
    return {
      slabs:integer(r.slabs),depth:integer(r.depth),nextSlabProgress:clamp(nonneg(r.nextSlabProgress),0,1),
      relics:integer(r.relics),workers:integer(r.workers),livingQueens:integer(r.livingQueens),generation:integer(r.generation),
      worldSeed:Math.max(0,Math.floor(finite(r.worldSeed))),sizeKey:String(r.sizeKey||'')
    };
  }

  function quoteNuptialFlight(rawRun){
    const run=normalizeRun(rawRun);
    // Founding shaft depth (8 cells) is free. The rest is physical progress; inventory, waiting time and
    // population above the safe escort do not enter the payout, so hoarding cannot inflate a reset.
    const depthBeyondFounder=Math.max(0,run.depth-8);
    const score=16*run.slabs+depthBeyondFounder+8*run.nextSlabProgress+2*run.relics;
    const award=Math.sqrt(Math.max(0,score)); // full precision is stored; only presentation rounds it.
    const blockers=[];
    if(run.slabs<1)blockers.push('REACH THE FIRST DEPTH OPENING');
    if(run.livingQueens<1)blockers.push('A LIVING QUEEN IS REQUIRED');
    return Object.freeze({eligible:blockers.length===0,blockers:Object.freeze(blockers),award,score,depthBeyondFounder,run:Object.freeze(run)});
  }

  function completeNuptialFlight(rawState,rawRun,at){
    const state=normalizeLineageState(rawState),quote=quoteNuptialFlight(rawRun);
    if(!quote.eligible)return {ok:false,reason:'locked',quote,state};
    const next=copy(state),serial=next.flights+1;
    next.amber+=quote.award;next.earned+=quote.award;next.flights=serial;
    next.best.slabs=Math.max(next.best.slabs,quote.run.slabs);
    next.best.depth=Math.max(next.best.depth,quote.run.depth);
    next.best.relics=Math.max(next.best.relics,quote.run.relics);
    next.best.award=Math.max(next.best.award,quote.award);
    next.history.push({id:'flight-'+serial,at:Math.max(0,Math.floor(finite(at))),award:quote.award,slabs:quote.run.slabs,
      depth:quote.run.depth,relics:quote.run.relics,generation:quote.run.generation,worldSeed:quote.run.worldSeed,sizeKey:quote.run.sizeKey});
    if(next.history.length>MAX_HISTORY)next.history=next.history.slice(-MAX_HISTORY);
    return {ok:true,quote,state:normalizeLineageState(next)};
  }

  function nextUpgradeCost(rawState,id){
    const state=normalizeLineageState(rawState),def=UPGRADE_DEFS[id];if(!def)return null;
    const level=state.upgrades[id]||0;return level>=def.max?null:def.costs[level];
  }

  function buyLineageUpgrade(rawState,id){
    const state=normalizeLineageState(rawState),def=UPGRADE_DEFS[id];
    if(!def)return {ok:false,reason:'unknown_upgrade',state,cost:null};
    const level=state.upgrades[id]||0;
    if(level>=def.max)return {ok:false,reason:'maxed',state,cost:null};
    const cost=def.costs[level];
    if(state.amber+1e-10<cost)return {ok:false,reason:'not_enough_amber',state,cost};
    const next=copy(state);next.amber=Math.max(0,next.amber-cost);next.spent+=cost;next.upgrades[id]=level+1;
    return {ok:true,reason:'bought',state:normalizeLineageState(next),cost,level:level+1,def};
  }

  function lineageEffects(rawState){
    const s=normalizeLineageState(rawState),u=s.upgrades;
    return Object.freeze({
      guideLifeMultiplier:1+u.trail_memory*.25,
      protectedStorageBonus:u.sealed_jars*2,
      wildForageRangeCells:u.forager_marks*4,
      restRecoveryMultiplier:1+u.deep_rest*.15
    });
  }

  function lineageSnapshot(rawState){return copy(normalizeLineageState(rawState));}

  return Object.freeze({LINEAGE_VERSION,LINEAGE_UPGRADES:UPGRADE_DEFS,freshLineageState,normalizeLineageState,
    quoteNuptialFlight,completeNuptialFlight,nextUpgradeCost,buyLineageUpgrade,lineageEffects,lineageSnapshot});
});
