'use strict';
// core/proyectos.js — estado puro de COLONY PROJECTS.
// No conoce DOM, hormigas ni geometría: sólo propuestas, compromisos, entregas y trabajo.
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  if(root) Object.assign(root,api);
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const RESOURCE_KEYS=['stone','clay','sand','fiber','wood','cobre','hierro','oro'];
  const PROJECT_DEFS=Object.freeze({
    clay_jars:Object.freeze({
      id:'clay_jars',name:'CLAY JARS',icon:'JAR',placement:'store',size:Object.freeze({w:1,h:1}),
      cost:Object.freeze({clay:3,fiber:2}),work:84,max:3,color:'#d79662',
      problem:'The founding store is running out of protected shelf space.',
      effect:'+12 ration capacity at the nest store.',
      tradeoff:'Clay and fibre remain tied up in containers.'
    }),
    forward_cache:Object.freeze({
      id:'forward_cache',name:'FORWARD CACHE',icon:'BOX',placement:'open_floor',size:Object.freeze({w:2,h:1}),
      cost:Object.freeze({clay:2,fiber:2,wood:2}),work:110,max:3,color:'#c18a42',
      problem:'Long return routes keep foragers away from useful work.',
      effect:'Food may be delivered to this connected cache; +6 capacity.',
      tradeoff:'A remote cache needs a safe, connected chamber.'
    }),
    tunnel_braces:Object.freeze({
      id:'tunnel_braces',name:'TUNNEL BRACES',icon:'II',placement:'open_floor',size:Object.freeze({w:1,h:1}),
      cost:Object.freeze({wood:3,stone:2}),work:96,max:8,color:'#a8753c',
      problem:'Loose ceilings can refill a worked tunnel.',
      effect:'The chosen 5 × 3 cell zone resists cave-ins.',
      tradeoff:'Protection is local; the rest of the nest stays exposed.'
    }),
    fungus_bed:Object.freeze({
      id:'fungus_bed',name:'FUNGUS BED',icon:'FUN',placement:'open_floor',size:Object.freeze({w:1,h:1}),
      cost:Object.freeze({fiber:4,clay:2}),work:104,max:4,color:'#8fbf5f',
      problem:'The colony has substrate but too little tended growing space.',
      effect:'Builds one fed fungus bed without creating free food.',
      tradeoff:'The bed still needs tending, dry access, and a solid floor.'
    })
  });
  const ORDER=['clay_jars','forward_cache','tunnel_braces','fungus_bed'];
  const num=v=>Number.isFinite(Number(v))?Math.max(0,Number(v)):0;
  const units=v=>Math.max(0,Math.floor(num(v)));
  const clone=o=>JSON.parse(JSON.stringify(o));
  const normMap=(src,keys=RESOURCE_KEYS)=>{const out={};for(const k of keys)out[k]=units(src&&src[k]);for(const k of Object.keys(src||{}))if(!(k in out))out[k]=units(src[k]);return out;};
  const validSite=site=>site&&Number.isFinite(Number(site.c))&&Number.isFinite(Number(site.r));
  function projectDefinition(id){const d=PROJECT_DEFS[id];return d?clone(d):null;}

  function createColonyProjects(initial){
    let nextId=1,reserveMap=normMap(),active=null,completed=[];
    const completedCount=id=>completed.reduce((n,p)=>n+(p.type===id?1:0),0);
    const allDelivered=()=>{
      if(!active)return false;
      return Object.keys(active.cost).every(k=>units(active.delivered[k])>=units(active.cost[k]));
    };
    const outstanding=(kind)=>{
      if(!active)return 0;
      return Math.max(0,units(active.cost[kind])-units(active.delivered[kind])-units(active.inTransit[kind]));
    };
    const api={
      definition:projectDefinition,
      definitions(){return ORDER.map(projectDefinition);},
      reserve(kind){return units(reserveMap[String(kind||'')]);},
      reserves(){return {...reserveMap};},
      setReserve(kind,amount){const k=String(kind||'');if(!k)return 0;reserveMap[k]=units(amount);return reserveMap[k];},
      active(){return active?clone(active):null;},
      activeRef(){return active;},
      completed(){return clone(completed);},
      completedRef(){return completed;},
      completedCount,
      holds(){if(!active)return {};const out={};for(const k of Object.keys(active.cost)){const v=outstanding(k);if(v)out[k]=v;}return out;},
      outstanding,
      allDelivered,
      canStart(type,available,site){
        const d=PROJECT_DEFS[type];
        if(!d)return {ok:false,reason:'unknown_project'};
        if(active)return {ok:false,reason:'one_active_project'};
        if(completedCount(type)>=d.max)return {ok:false,reason:'project_limit'};
        if(d.placement!=='store'&&!validSite(site))return {ok:false,reason:'site_required'};
        const have=available||{};
        for(const k of Object.keys(d.cost))if(num(have[k])<d.cost[k])return {ok:false,reason:'resources',missing:k,needed:d.cost[k]-num(have[k])};
        return {ok:true};
      },
      start(type,site,available,meta){
        const check=api.canStart(type,available,site);if(!check.ok)return check;
        const d=PROJECT_DEFS[type],id='CP-'+String(nextId++).padStart(4,'0'),delivered={},inTransit={};
        for(const k of Object.keys(d.cost)){delivered[k]=0;inTransit[k]=0;}
        active={id,type,name:d.name,site:validSite(site)?{c:Math.floor(Number(site.c)),r:Math.floor(Number(site.r)),w:units(site.w)||d.size.w,h:units(site.h)||d.size.h}:null,
          cost:{...d.cost},delivered,inTransit,work:0,workNeeded:d.work,crew:[],builtBy:[],startedAt:num(meta&&meta.time),blocked:'',lastDeliveryAt:0};
        return {ok:true,project:clone(active)};
      },
      setCrew(ids){if(!active)return [];active.crew=[...new Set((ids||[]).map(String).filter(Boolean))];return [...active.crew];},
      pickup(kind,amount=1,meta){
        if(!active)return {ok:false,reason:'no_active_project'};
        const k=String(kind||''),take=Math.min(outstanding(k),units(amount));if(!take)return {ok:false,reason:'nothing_outstanding'};
        active.inTransit[k]=units(active.inTransit[k])+take;active.blocked='';active.lastPickupAt=num(meta&&meta.time);
        return {ok:true,amount:take,projectId:active.id,kind:k};
      },
      returnTransit(kind,amount=1){
        if(!active)return 0;const k=String(kind||''),back=Math.min(units(active.inTransit[k]),units(amount));active.inTransit[k]-=back;return back;
      },
      deliver(kind,amount=1,meta){
        if(!active)return {ok:false,reason:'no_active_project'};
        const k=String(kind||''),give=Math.min(units(active.inTransit[k]),units(amount));if(!give)return {ok:false,reason:'nothing_in_transit'};
        active.inTransit[k]-=give;active.delivered[k]=units(active.delivered[k])+give;active.blocked='';active.lastDeliveryAt=num(meta&&meta.time);
        return {ok:true,amount:give,allDelivered:allDelivered(),project:clone(active)};
      },
      addWork(amount,workerId,meta){
        if(!active)return {ok:false,reason:'no_active_project'};
        if(!allDelivered())return {ok:false,reason:'materials_pending'};
        const effort=num(amount);if(!effort)return {ok:false,reason:'no_work'};
        active.work=Math.min(active.workNeeded,active.work+effort);
        if(workerId&&!active.builtBy.includes(String(workerId)))active.builtBy.push(String(workerId));
        active.blocked='';
        if(active.work<active.workNeeded)return {ok:true,completed:false,progress:active.work/active.workNeeded};
        const done={...clone(active),completedAt:num(meta&&meta.time)};completed.push(done);active=null;
        return {ok:true,completed:true,project:clone(done)};
      },
      cancel(){
        if(!active)return {ok:false,reason:'no_active_project'};
        const moved=Object.values(active.inTransit).reduce((a,v)=>a+units(v),0)+Object.values(active.delivered).reduce((a,v)=>a+units(v),0);
        if(moved>0||active.work>0)return {ok:false,reason:'materials_already_moved'};
        const old=clone(active);active=null;return {ok:true,project:old};
      },
      markBlocked(reason){if(active)active.blocked=String(reason||'');return active?active.blocked:'';},
      proposals(context,limit=3){
        if(active)return [];
        const c=context||{};if(c.storeBuilt===false)return [];
        const workers=units(c.workers),gardens=units(c.gardens),fill=Math.max(0,Math.min(2,num(c.fillRatio))),depth=units(c.depthCells),haul=num(c.longHaul),risk=num(c.collapseRisk),digs=units(c.digs),stock=c.stock||{},available=c.available||stock;
        const scores={
          clay_jars:30+fill*86+Math.min(20,num(stock.clay)*2)+completedCount('clay_jars')*-18,
          forward_cache:24+Math.max(0,depth-7)*2.8+Math.min(42,haul*.18)+completedCount('forward_cache')*-20,
          tunnel_braces:20+Math.min(55,risk*10+digs*.28)+Math.max(0,depth-10)*1.1+completedCount('tunnel_braces')*-5,
          fungus_bed:22+Math.max(0,workers-gardens*7)*2.8+Math.min(24,num(stock.fiber)*2)+completedCount('fungus_bed')*-13
        };
        const reasons={
          clay_jars:fill>=.8?`The store is ${Math.round(fill*100)}% full.`:`Clay and fibre are accumulating at the founding store.`,
          forward_cache:depth>8?`Known tunnels reach ${depth} cells below the store.`:`The colony is beginning to repeat longer return routes.`,
          tunnel_braces:risk>0?`${Math.round(risk)} recent incidents expose unstable passages.`:`${digs} excavations have opened unsupported ground.`,
          fungus_bed:gardens?`${gardens} beds serve ${workers} workers.`:`Stored fibre can become a tended growing bed.`
        };
        const list=[];
        for(const id of ORDER){
          const d=PROJECT_DEFS[id];if(completedCount(id)>=d.max)continue;
          const affordable=Object.keys(d.cost).every(k=>num(available[k])>=d.cost[k]);
          list.push({...projectDefinition(id),score:scores[id],reason:reasons[id],affordable,count:completedCount(id)});
        }
        list.sort((a,b)=>b.score-a.score||ORDER.indexOf(a.id)-ORDER.indexOf(b.id));
        return list.slice(0,Math.max(1,units(limit)||3));
      },
      snapshot(){return {v:1,nextId,reserves:{...reserveMap},active:active?clone(active):null,completed:clone(completed)};},
      load(data){
        const d=data&&typeof data==='object'?data:{};nextId=Math.max(1,units(d.nextId)||1);reserveMap=normMap(d.reserves||{});completed=[];active=null;
        if(Array.isArray(d.completed))for(const raw of d.completed){
          const def=raw&&PROJECT_DEFS[raw.type];if(!def||completedCount(raw.type)>=def.max)continue;
          const p=clone(raw);p.cost={...def.cost};p.workNeeded=def.work;p.work=Math.min(def.work,num(p.work)||def.work);p.site=validSite(p.site)?{c:Math.floor(Number(p.site.c)),r:Math.floor(Number(p.site.r)),w:units(p.site.w)||def.size.w,h:units(p.site.h)||def.size.h}:null;completed.push(p);
        }
        if(d.active&&PROJECT_DEFS[d.active.type]){
          const raw=d.active,def=PROJECT_DEFS[raw.type],delivered={},inTransit={};
          for(const k of Object.keys(def.cost)){delivered[k]=Math.min(def.cost[k],units(raw.delivered&&raw.delivered[k]));inTransit[k]=Math.min(def.cost[k]-delivered[k],units(raw.inTransit&&raw.inTransit[k]));}
          active={id:String(raw.id||('CP-'+String(nextId++).padStart(4,'0'))),type:def.id,name:def.name,
            site:validSite(raw.site)?{c:Math.floor(Number(raw.site.c)),r:Math.floor(Number(raw.site.r)),w:units(raw.site.w)||def.size.w,h:units(raw.site.h)||def.size.h}:null,
            cost:{...def.cost},delivered,inTransit,work:Math.min(def.work,num(raw.work)),workNeeded:def.work,crew:Array.isArray(raw.crew)?[...new Set(raw.crew.map(String))]:[],builtBy:Array.isArray(raw.builtBy)?[...new Set(raw.builtBy.map(String))]:[],startedAt:num(raw.startedAt),blocked:String(raw.blocked||''),lastDeliveryAt:num(raw.lastDeliveryAt)};
          const serial=Number(String(active.id).replace(/\D/g,''));if(Number.isFinite(serial))nextId=Math.max(nextId,serial+1);
        }
        return api.snapshot();
      },
      reset(){nextId=1;reserveMap=normMap();active=null;completed=[];return api.snapshot();}
    };
    if(initial)api.load(initial);
    return api;
  }

  return {COLONY_PROJECT_RESOURCES:RESOURCE_KEYS,COLONY_PROJECT_ORDER:ORDER,COLONY_PROJECT_DEFS:PROJECT_DEFS,projectDefinition,createColonyProjects};
});
