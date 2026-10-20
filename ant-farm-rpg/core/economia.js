'use strict';
// core/economia.js — reglas puras y libro único de comida/materiales.
// UMD: funciona con <script> en navegador y con require() en las pruebas Node.
(function(root, factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  if(root) Object.assign(root,api);
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const ECONOMY_MATERIALS=Object.freeze(['stone','clay','sand','fiber','wood','cobre','hierro','oro','cuarzo','gema','obsidiana','meteorito']);
  const MATERIAL_KEYS=ECONOMY_MATERIALS;
  const n=v=>Number.isFinite(Number(v))?Math.max(0,Number(v)):0;
  const entero=v=>Math.max(0,Math.floor(n(v)));

  function reservaInicialComida(areaRatio){return Math.max(5,Math.min(20,Math.round(12*n(areaRatio||1))));}
  function reservaSuperficie(areaRatio){return Math.max(2,Math.min(10,Math.round(5*n(areaRatio||1))));}
  function topeSuperficie(areaRatio){return Math.max(3,Math.min(14,Math.round(8*n(areaRatio||1))));}
  function reservaVitalComida(){return 5;}
  function puedePagar(materiales,coste){
    materiales=materiales||{}; coste=coste||{};
    return Object.keys(coste).every(k=>n(materiales[k])>=n(coste[k]));
  }
  function pagar(materiales,coste){
    if(!puedePagar(materiales,coste)) return false;
    for(const k of Object.keys(coste||{})) materiales[k]=n(materiales[k])-n(coste[k]);
    return true;
  }
  function normalizaMateriales(src){
    const out={}; for(const k of MATERIAL_KEYS) out[k]=n(src&&src[k]);
    for(const k of Object.keys(src||{})) if(!(k in out)) out[k]=n(src[k]);
    return out;
  }
  function normalizaCoste(src){
    const out={};
    for(const k of Object.keys(src||{})){ const v=n(src[k]); if(v>0) out[k]=v; }
    return out;
  }

  function createEconomyLedger(initial){
    const init=initial||{};
    let food=n(init.food),foodFloor=entero(init.foodFloor),seq=0;
    const materials=normalizaMateriales(init.materials||{});
    const materialFloors=normalizaMateriales(init.materialFloors||{});for(const k of Object.keys(materialFloors))materialFloors[k]=entero(materialFloors[k]);
    const holds={}; // token -> {material: units}. A hold is a promise, not a second balance.
    const journal=[];
    const log=(account,key,delta,balance,reason)=>{
      if(!delta) return;
      const r=String(reason||'unspecified'),prev=journal[journal.length-1];
      if(prev&&prev.account===account&&prev.key===key&&prev.reason===r&&Math.sign(prev.delta)===Math.sign(delta)){
        prev.delta+=delta;prev.balance=balance;prev.count=(prev.count||1)+1;return;
      }
      journal.push({id:++seq,account,key:key||null,delta,balance,reason:r,count:1});
      if(journal.length>240) journal.splice(0,journal.length-240);
    };
    const ensureKey=k=>{
      k=String(k||'');
      if(!(k in materials)) materials[k]=0;
      if(!(k in materialFloors)) materialFloors[k]=0;
      return k;
    };
    const heldFor=(kind,token)=>{
      kind=String(kind||'');
      if(token!==undefined&&token!==null){ const h=holds[String(token)]; return h?n(h[kind]):0; }
      let total=0; for(const id of Object.keys(holds)) total+=n(holds[id]&&holds[id][kind]);
      return total;
    };
    const cleanHold=id=>{
      const h=holds[id]; if(!h) return;
      for(const k of Object.keys(h)) if(!(h[k]>0)) delete h[k];
      if(!Object.keys(h).length) delete holds[id];
    };
    const api={
      get food(){return food;},
      set food(v){api.setFood(v,'direct assignment');},
      get materials(){return materials;},
      setFood(v,reason){const next=n(v),d=next-food;food=next;log('food',null,d,food,reason||'set food');return food;},
      creditFood(amount,reason){const a=n(amount);if(!a)return food;food+=a;log('food',null,a,food,reason||'food credit');return food;},
      setFoodFloor(amount,reason){const next=entero(amount),d=next-foodFloor;foodFloor=next;log('food_floor',null,d,foodFloor,reason||'food reserve policy');return foodFloor;},
      foodFloor(){return foodFloor;},
      foodAvailable(options){const o=options||{},floor=o.survival?0:Math.max(entero(o.floor),foodFloor);return Math.max(0,food-floor);},
      debitFood(amount,options){
        const o=options||{},a=n(amount);if(!a)return 0;
        const floor=o.survival?0:Math.max(entero(o.floor),foodFloor),available=Math.max(0,food-floor);
        const paid=o.partial?Math.min(a,available):(available>=a?a:0);
        if(paid){food-=paid;log('food',null,-paid,food,o.reason||'food debit');}
        return paid;
      },
      materialBalance(kind){const k=ensureKey(kind);return materials[k];},
      setMaterial(kind,amount,reason){
        const k=ensureKey(kind),next=n(amount),d=next-n(materials[k]);materials[k]=next;log('material',k,d,next,reason||'set material');return next;
      },
      creditMaterial(kind,amount,options){
        const k=ensureKey(kind),a=n(amount);if(!a)return materials[k];
        materials[k]=n(materials[k])+a;log('material',k,a,materials[k],typeof options==='string'?options:(options&&options.reason)||'material credit');return materials[k];
      },
      setMaterialFloor(kind,amount,options){
        const k=ensureKey(kind),next=entero(amount),d=next-materialFloors[k];materialFloors[k]=next;
        log('material_floor',k,d,next,typeof options==='string'?options:(options&&options.reason)||'material reserve policy');return next;
      },
      materialFloor(kind){const k=ensureKey(kind);return materialFloors[k];},
      materialHeld(kind,token){return heldFor(kind,token);},
      materialAvailable(kind,options){
        const k=ensureKey(kind),o=options||{};
        if(o.survival) return n(materials[k]);
        return Math.max(0,n(materials[k])-n(materialFloors[k])-heldFor(k));
      },
      availableMaterials(options){
        const out={}; const keys=new Set([...Object.keys(materials),...Object.keys(materialFloors)]);
        for(const k of keys) out[k]=api.materialAvailable(k,options);
        return out;
      },
      debitMaterial(kind,amount,options){
        const k=ensureKey(kind),o=options||{},a=n(amount);if(!a)return 0;
        const available=api.materialAvailable(k,o),paid=o.partial?Math.min(a,available):(available>=a?a:0);
        if(paid){materials[k]=n(materials[k])-paid;log('material',k,-paid,materials[k],o.reason||'material debit');}
        return paid;
      },
      canAffordMaterials(cost,options){
        const c=normalizaCoste(cost);return Object.keys(c).every(k=>api.materialAvailable(k,options)>=c[k]);
      },
      payMaterials(cost,reasonOrOptions){
        const c=normalizaCoste(cost),o=typeof reasonOrOptions==='string'?{reason:reasonOrOptions}:(reasonOrOptions||{});
        if(!api.canAffordMaterials(c,o)) return false;
        for(const k of Object.keys(c)) api.debitMaterial(k,c[k],{...o,partial:false,reason:o.reason||'material payment'});
        return true;
      },
      holdMaterials(token,cost,options){
        const id=String(token||''),o=options||{},c=normalizaCoste(cost);
        if(!id||!Object.keys(c).length||holds[id]) return false;
        if(!o.force&&!api.canAffordMaterials(c)) return false;
        holds[id]={...c};
        for(const k of Object.keys(c)) log('material_hold',k,c[k],heldFor(k),o.reason||'project commitment');
        return {...holds[id]};
      },
      releaseHold(token,reason){
        const id=String(token||''),h=holds[id]; if(!h) return {};
        const released={...h}; delete holds[id];
        for(const k of Object.keys(released)) log('material_hold',k,-released[k],heldFor(k),reason||'commitment released');
        return released;
      },
      consumeHeldMaterial(token,kind,amount,options){
        const id=String(token||''),k=ensureKey(kind),o=options||{},h=holds[id],a=n(amount);
        if(!h||!a) return 0;
        const promised=n(h[k]),physical=Math.max(0,n(materials[k])-n(materialFloors[k]));
        const available=Math.min(promised,physical),paid=o.partial?Math.min(a,available):(available>=a?a:0);
        if(!paid) return 0;
        materials[k]=n(materials[k])-paid;h[k]=promised-paid;
        log('material',k,-paid,materials[k],o.reason||'held material picked up');
        log('material_hold',k,-paid,heldFor(k),o.reason||'held material picked up');
        cleanHold(id);return paid;
      },
      replaceMaterials(next,reason){
        const fresh=normalizaMateriales(next||{}),keys=new Set([...Object.keys(materials),...Object.keys(fresh)]);
        for(const k of keys){const old=n(materials[k]),v=n(fresh[k]);materials[k]=v;log('material',k,v-old,v,reason||'replace materials');}
        return materials;
      },
      clearHolds(reason){for(const id of Object.keys(holds)) api.releaseHold(id,reason||'clear commitments');},
      resetRules(reason){
        api.clearHolds(reason||'reset economy rules');foodFloor=0;
        for(const k of Object.keys(materialFloors)) materialFloors[k]=0;
      },
      load(snapshot,reason){
        const src=snapshot&&typeof snapshot==='object'?snapshot:{};
        api.setFood(src.food||0,reason||'load ledger');api.replaceMaterials(src.materials||{},reason||'load ledger');api.resetRules(reason||'load ledger rules');
        if(src.floors){api.setFoodFloor(src.floors.food||0,reason||'load ledger rules');for(const k of Object.keys(src.floors.materials||{}))api.setMaterialFloor(k,src.floors.materials[k],reason||'load ledger rules');}
        for(const id of Object.keys(src.holds||{}))api.holdMaterials(id,src.holds[id],{force:true,reason:reason||'load ledger holds'});
        return api;
      },
      snapshot(){
        const holdCopy={};for(const id of Object.keys(holds)) holdCopy[id]={...holds[id]};
        return {food,materials:{...materials},floors:{food:foodFloor,materials:{...materialFloors}},holds:holdCopy};
      },
      history(limit){const count=Math.max(0,Number(limit)||journal.length);return journal.slice(-count).map(e=>({...e}));},
      clearJournal(){journal.length=0;}
    };
    if(init.holds&&typeof init.holds==='object') for(const id of Object.keys(init.holds)) api.holdMaterials(id,init.holds[id],{force:true,reason:'initial holds'});
    api.clearJournal();return api;
  }

  return {ECONOMY_MATERIALS,MATERIAL_KEYS,reservaInicialComida,reservaSuperficie,topeSuperficie,reservaVitalComida,puedePagar,pagar,createEconomyLedger};
});
