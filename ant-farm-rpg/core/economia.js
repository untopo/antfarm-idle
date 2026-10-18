// core/economia.js — pure economy rules and the colony ledger.
// No DOM. Loaded in the browser before app.js and tested directly in Node.
// Structure/tool prices remain in js/app.js (STRUCTURE_DEFS, TOOL_DEFS): this module owns balances,
// safe payments and the formulas shared by simulation, saves and tests.
'use strict';

const ECONOMY_MATERIALS = Object.freeze([
  'stone','clay','sand','fiber','wood','cobre','hierro','oro','cuarzo','gema','obsidiana','meteorito'
]);

function _economyAmount(value){
  const n=Number(value);
  return Number.isFinite(n) && n>0 ? n : 0;
}

// Food reserves by map size (ratio = area / reference area, 0.35 … 2.6).
function reservaInicialComida(ratio){ return Math.max(5, Math.min(20, Math.round(12*ratio))); }
function reservaSuperficie(ratio){ return Math.max(2, Math.min(10, Math.round(5*ratio))); }
function topeSuperficie(ratio){ return Math.max(3, Math.min(14, Math.round(5*ratio*1.6))); }
// Five rations are not surplus. Automatic laying and brood care may spend only what is above this floor.
function reservaVitalComida(){ return 5; }

// Legacy pure helpers kept for old saves/tests and for callers that only own a material object.
function puedePagar(mats, cost){
  for(const key in cost) if((mats[key]||0) < cost[key]) return false;
  return true;
}
function pagar(mats, cost){
  if(!puedePagar(mats, cost)) return false;
  for(const key in cost) mats[key] = (mats[key]||0) - cost[key];
  return true;
}

/**
 * Single source of truth for food and materials.
 *
 * Every mutation has a reason and enters a bounded journal. debitFood returns the amount actually
 * paid, which makes reserve floors and body-funded brood explicit instead of scattering Math.max
 * assignments throughout the simulation. The material object keeps its identity so UI references and
 * compatibility accessors never go stale after loading a save.
 */
function createEconomyLedger(initial){
  let food=0, serial=0, cursor=0;
  const materials={};
  const journal=[];
  const MAX_JOURNAL=160;

  function record(account, key, delta, balance, reason){
    if(!delta) return;
    const why=String(reason||'unspecified');
    const newest=journal.length
      ? journal[journal.length<MAX_JOURNAL?journal.length-1:(cursor+MAX_JOURNAL-1)%MAX_JOURNAL]
      : null;
    // Brood care can debit tiny fractions many times per frame. Coalescing adjacent equal movements
    // keeps the ledger useful without allocating one object per larva per tick.
    if(newest && newest.account===account && newest.key===(key||null) && newest.reason===why){
      newest.delta+=delta; newest.balance=balance; newest.count=(newest.count||1)+1; return;
    }
    const entry={id:++serial, account, key:key||null, delta, balance, reason:why, count:1};
    if(journal.length<MAX_JOURNAL) journal.push(entry);
    else { journal[cursor]=entry; cursor=(cursor+1)%MAX_JOURNAL; }
  }
  function setFood(value, reason){
    const next=_economyAmount(value), delta=next-food;
    food=next; record('food',null,delta,food,reason||'set food');
    return food;
  }
  function creditFood(amount, reason){
    const add=_economyAmount(amount); if(!add) return food;
    food+=add; record('food',null,add,food,reason||'food income');
    return food;
  }
  function debitFood(amount, options){
    const wanted=_economyAmount(amount); if(!wanted) return 0;
    const opts=options||{}, floor=_economyAmount(opts.floor);
    const available=Math.max(0,food-floor);
    const paid=opts.partial ? Math.min(wanted,available) : (available>=wanted?wanted:0);
    if(paid){ food-=paid; record('food',null,-paid,food,opts.reason||'food expense'); }
    return paid;
  }
  function ensureMaterial(key){
    if(!Object.prototype.hasOwnProperty.call(materials,key)) materials[key]=0;
    return key;
  }
  function materialBalance(key){ ensureMaterial(key); return materials[key]; }
  function setMaterial(key, value, reason){
    ensureMaterial(key);
    const next=_economyAmount(value), delta=next-materials[key];
    materials[key]=next; record('material',key,delta,next,reason||'set material');
    return next;
  }
  function creditMaterial(key, amount, reason){
    const add=_economyAmount(amount); ensureMaterial(key); if(!add) return materials[key];
    materials[key]+=add; record('material',key,add,materials[key],reason||'material income');
    return materials[key];
  }
  function debitMaterial(key, amount, options){
    const wanted=_economyAmount(amount); ensureMaterial(key); if(!wanted) return 0;
    const opts=options||{}, paid=opts.partial?Math.min(wanted,materials[key]):(materials[key]>=wanted?wanted:0);
    if(paid){ materials[key]-=paid; record('material',key,-paid,materials[key],opts.reason||'material expense'); }
    return paid;
  }
  function canAffordMaterials(cost){ return puedePagar(materials,cost||{}); }
  function payMaterials(cost, reason){
    const bill=cost||{}; if(!canAffordMaterials(bill)) return false;
    for(const key in bill) debitMaterial(key,bill[key],{reason:reason||'material purchase'});
    return true;
  }
  function replaceMaterials(values, reason){
    const src=values&&typeof values==='object'?values:{};
    const keys=new Set([...ECONOMY_MATERIALS,...Object.keys(materials),...Object.keys(src)]);
    for(const key of keys) setMaterial(key,src[key]||0,reason||'load materials');
    return materials;
  }
  function load(snapshot, reason){
    const src=snapshot&&typeof snapshot==='object'?snapshot:{};
    setFood(src.food||0,reason||'load ledger');
    replaceMaterials(src.materials||{},reason||'load ledger');
    return api;
  }
  function clearJournal(){ journal.length=0; cursor=0; }
  function history(limit){
    const ordered=journal.length<MAX_JOURNAL || cursor===0
      ? journal.slice()
      : journal.slice(cursor).concat(journal.slice(0,cursor));
    return ordered.slice(-Math.max(0,Number(limit)||ordered.length)).map(entry=>({...entry}));
  }
  function snapshot(){ return {food,materials:{...materials}}; }

  const api={
    get food(){ return food; },
    get materials(){ return materials; },
    setFood,creditFood,debitFood,materialBalance,setMaterial,creditMaterial,debitMaterial,
    canAffordMaterials,payMaterials,replaceMaterials,load,snapshot,history,clearJournal
  };
  replaceMaterials({},'initialize ledger');
  if(initial) load(initial,'initialize ledger');
  clearJournal();
  return api;
}

if(typeof module!=='undefined' && module.exports){
  module.exports={
    ECONOMY_MATERIALS,createEconomyLedger,
    reservaInicialComida,reservaSuperficie,topeSuperficie,reservaVitalComida,puedePagar,pagar
  };
}
