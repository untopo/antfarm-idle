// test/economia-integracion.js — the app must use the core ledger without breaking legacy harness names.
const fs=require('fs');
const app=fs.readFileSync('/home/user/ant-farm-rpg/js/app.js','utf8');
const {sb,ctx,vm}=require('./world-perf-proflib.js');
let ok=0,fail=0;
function check(name,cond,extra){
  if(cond){ ok++; console.log('  ok   '+name); }
  else { fail++; console.log('  FAIL '+name+(extra!==undefined?' → '+extra:'')); }
}

check('app.js ya no declara saldos paralelos',
  !/\blet\s+colonyFood\b/.test(app) && !/\blet\s+worldMaterials\b/.test(app));
const directFood=[...app.matchAll(/economyLedger\.food\s*(?:\+\+|--|\+=|-=|\*=|\/=|=(?!=))/g)];
const directMats=[...app.matchAll(/economyLedger\.materials(?:\.[A-Za-z_$][\w$]*|\[[^\]]+\])?\s*(?:\+\+|--|\+=|-=|\*=|\/=|=(?!=))/g)];
check('app.js no escribe saldos por fuera de los métodos del libro',directFood.length===0&&directMats.length===0,
  'comida '+directFood.length+' · materiales '+directMats.length);
check('compras complejas ya no llaman al pagador suelto',!app.includes('pagar(economyLedger.materials'));

vm.runInContext(`
  topoCreateFreshWorld(48,28);
  economyLedger.clearJournal();
  colonyFood=9;
  worldMaterials={stone:4,fiber:2};
  economyLedger.creditFood(3,'integration delivery');
  economyLedger.payMaterials({stone:1,fiber:2},'integration tool');
  window.__ledgerIntegration={
    food:colonyFood,ledgerFood:economyLedger.food,
    stone:worldMaterials.stone,fiber:worldMaterials.fiber,wood:worldMaterials.wood,
    same:worldMaterials===economyLedger.materials,
    reasons:economyLedger.history().map(x=>x.reason)
  };
`,ctx);
const state=sb.__ledgerIntegration;
check('los nombres antiguos leen y escriben el mismo saldo',state.food===12&&state.ledgerFood===12&&state.same,state);
check('el pago material pasa por el libro y es exacto',state.stone===3&&state.fiber===0&&state.wood===0,state);
check('el diario explica ingresos y pagos',state.reasons.includes('integration delivery')&&state.reasons.includes('integration tool'),state.reasons.join(', '));

vm.runInContext(`worldMaterials.stone=77; topoCreateFreshWorld(64,36); window.__freshStone=worldMaterials.stone;`,ctx);
check('crear otra granja no hereda materiales',sb.__freshStone===0,sb.__freshStone);

console.log('\n'+ok+' ok · '+fail+' FALLOS');
process.exit(fail?1:0);
