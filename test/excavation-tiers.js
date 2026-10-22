/** Terraria-like excavation progression without human pickaxes. */
process.env.TEST_SEED='211';process.env.TEST_CLOCK='simulated';
const {ctx,vm}=require('./world-perf-proflib.js');let pass=0,fail=0;
const run=s=>vm.runInContext(s,ctx),ok=(c,m,d='')=>{console.log((c?'  ok   ':'  FAIL ')+m+(d?' · '+d:''));c?pass++:fail++;};

console.log('\n· exact material power ladder');
const matrix=run(`(()=>{topoCreateFreshWorld(48,28);paused=true;workers=workers.slice(0,1);const w=workers[0];gen=0;colonyIQ=100;inventions.masonry=false;w.adaptations={};
  const row=t=>[1,2,3,4,6,8,11,9,12,16,10,13,14,7,15,19].map(mt=>_canExcavateMaterial(mt,w));
  const out={t0:row()};for(let t=1;t<=4;t++){w.adaptations.mandibles=t;out['t'+t]=row();}return out;})()`);
const accessible=(row,i)=>row[i]===true;
ok(matrix.t0.slice(0,5).every(Boolean)&&!matrix.t0.slice(5).some(Boolean),'natural jaws open ordinary stone/slate but not the first ore tier');
ok(accessible(matrix.t1,5)&&accessible(matrix.t1,6)&&!accessible(matrix.t1,7),'tier I opens copper and quartzite, not iron');
ok(accessible(matrix.t2,7)&&accessible(matrix.t2,8)&&accessible(matrix.t2,9)&&!accessible(matrix.t2,10),'tier II opens iron, marble and gemstone, not gold');
ok(accessible(matrix.t3,10)&&accessible(matrix.t3,11)&&!accessible(matrix.t3,12),'tier III opens gold and obsidian, not basalt');
ok(accessible(matrix.t4,12)&&!accessible(matrix.t4,13)&&!accessible(matrix.t4,14)&&!accessible(matrix.t4,15),'tier IV opens basalt while bedrock, magma and world core remain special');

console.log('\n· bedrock and the impossible-to-lose evolutionary route');
const fallback=run(`(()=>{const w=workers[0];w.adaptations={mandibles:4};gen=4;colonyIQ=134;inventions.masonry=false;const noMasonry=_canExcavateMaterial(7,w);inventions.masonry=true;const equipped=_canExcavateMaterial(7,w);
  w.adaptations={};const stages=[];for(const [g,iq,mt] of [[2,114,11],[3,116,12],[3,118,13],[4,122,14]]){gen=g;colonyIQ=iq;stages.push(_canExcavateMaterial(mt,w));}
  gen=8;colonyIQ=148;inventions.masonry=true;const evolvedBedrock=_canExcavateMaterial(7,w);return{noMasonry,equipped,stages,evolvedBedrock};})()`);
ok(!fallback.noMasonry&&fallback.equipped,'tier IV needs learned deep masonry for bedrock');
ok(fallback.stages.every(Boolean),'colony evolution eventually reaches all four ordinary tiers without spending');
ok(fallback.evolvedBedrock,'late evolution plus masonry remains the universal bedrock route');

console.log('\n· one explicit approval advances one physical ant by one tier');
const purchase=run(`(()=>{topoCreateFreshWorld(48,28);paused=true;workers=workers.slice(0,1);const w=workers[0];w.health=100;w.adaptations={};gen=4;colonyIQ=150;inventions.stone=true;inventions.masonry=true;
  economyLedger.replaceMaterials({stone:10,cobre:10,hierro:10,oro:10},'tier fixture');economyLedger.clearJournal();const receipts=[];
  for(let i=0;i<4;i++)receipts.push(approveBodyAdaptation('mandibles'));
  const before={stone:economyLedger.materials.stone,cobre:economyLedger.materials.cobre,hierro:economyLedger.materials.hierro,oro:economyLedger.materials.oro},fifth=approveBodyAdaptation('mandibles'),debits=economyLedger.history().filter(x=>x.account==='material'&&x.delta<0);
  return{tiers:receipts.map(x=>x.tier),ids:receipts.map(x=>x.antId),tier:antMandibleTier(w),materials:{stone:economyLedger.materials.stone,cobre:economyLedger.materials.cobre,hierro:economyLedger.materials.hierro,oro:economyLedger.materials.oro},fifth,before,debits,reasons:debits.map(x=>x.reason)};})()`);
ok(purchase.tiers.join(',')==='1,2,3,4'&&new Set(purchase.ids).size===1&&purchase.tier===4,'the strongest miner advances I → II → III → IV without skipping');
ok(JSON.stringify(purchase.materials)===JSON.stringify({stone:7,cobre:7,hierro:7,oro:8}),'each tier pays exactly its displayed previous-layer materials',JSON.stringify(purchase.materials));
ok(purchase.debits.length===7&&purchase.reasons.every(x=>/player-approved mandibles tier [1-4] adaptation/.test(x)),'every material debit is auditable and player-approved',purchase.reasons.join(' · '));
ok(!purchase.fifth.ok&&purchase.fifth.reason==='complete'&&JSON.stringify(purchase.before)===JSON.stringify(purchase.materials),'a complete chain disables further spending');

console.log('\n· migration and emergent recipient selection');
const selection=run(`(()=>{topoCreateFreshWorld(48,28);paused=true;workers=workers.slice(0,2);const a=workers[0],b=workers[1];a.health=b.health=100;a.adaptations={mandibles:true};b.adaptations={};a.traits.construccion=1;b.traits.construccion=99;const migrated=antMandibleTier(a),plan=_adaptationPlan('mandibles');a.tool='pick';a.adaptations={};const legacy=antMandibleTier(a);return{migrated,legacy,chosen:plan.ant.id,a:a.id,level:plan.level,legacyField:'tool' in a};})()`);
ok(selection.migrated===1&&selection.legacy===1&&!selection.legacyField,'boolean and legacy-pick saves migrate to anatomical tier I');
ok(selection.chosen===selection.a&&selection.level===2,'the colony progresses its existing specialist before starting a second chain');

console.log(`\nEXCAVATION TIERS: ${pass} ok · ${fail} failures`);process.exit(fail?1:0);
