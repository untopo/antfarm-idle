// test/lineage.js — Nuptial Flight arithmetic and the earned-only permanent wallet are deterministic.
const assert=require('assert');
const {
  LINEAGE_UPGRADES,freshLineageState,normalizeLineageState,quoteNuptialFlight,completeNuptialFlight,
  nextUpgradeCost,buyLineageUpgrade,lineageEffects
}=require('../ant-farm-rpg/core/lineage.js');
let ok=0;
function test(name,fn){try{fn();ok++;console.log('  ok   '+name);}catch(e){console.error('  FAIL '+name+' → '+e.message);process.exitCode=1;}}
const near=(a,b,t=1e-12)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`);
const run=(patch={})=>({slabs:2,depth:21,nextSlabProgress:.375,relics:3,workers:7,livingQueens:1,generation:4,worldSeed:123,sizeKey:'small',...patch});

test('the formula keeps full precision and ignores stock, age, and surplus population',()=>{
  const a=quoteNuptialFlight({...run(),food:99999,materials:{clay:999},day:900,workers:7});
  const b=quoteNuptialFlight({...run(),food:0,materials:{},day:1,workers:700});
  // 16×2 + (21−8) + 8×.375 + 2×3 = 54
  assert.equal(a.score,54);near(a.award,Math.sqrt(54));near(a.award,b.award);
  assert.notEqual(a.award,Number(a.award.toFixed(2)),'internal amber must not be rounded to the HUD');
});

test('eligibility requires exactly a broken slab and a living queen',()=>{
  let q=quoteNuptialFlight(run({slabs:0,livingQueens:0,workers:0}));
  assert.equal(q.eligible,false);assert.deepStrictEqual([...q.blockers],['BREAK THE FIRST SLAB','A LIVING QUEEN IS REQUIRED']);
  q=quoteNuptialFlight(run({slabs:1,livingQueens:1,workers:0}));assert.equal(q.eligible,true);
});

test('founding depth is free and partial next-slab progress is clamped',()=>{
  assert.equal(quoteNuptialFlight(run({slabs:1,depth:3,nextSlabProgress:-2,relics:0})).depthBeyondFounder,0);
  const q=quoteNuptialFlight(run({slabs:1,depth:8,nextSlabProgress:9,relics:0}));
  assert.equal(q.score,24);near(q.award,Math.sqrt(24));
});

test('a completed flight credits amber once and writes an immutable receipt',()=>{
  const initial=freshLineageState(),r=run();
  const done=completeNuptialFlight(initial,r,1700000000123);
  assert.equal(done.ok,true);assert.equal(done.state.flights,1);near(done.state.amber,Math.sqrt(54));near(done.state.earned,Math.sqrt(54));
  assert.equal(done.state.history.length,1);assert.deepStrictEqual(done.state.history[0],{
    id:'flight-1',at:1700000000123,award:Math.sqrt(54),slabs:2,depth:21,relics:3,generation:4,worldSeed:123,sizeKey:'small'
  });
  assert.equal(initial.flights,0);assert.equal(initial.amber,0); // pure: caller state was not mutated
});

test('a locked flight never credits the wallet',()=>{
  const before=freshLineageState(),done=completeNuptialFlight(before,run({slabs:0}),100);
  assert.equal(done.ok,false);assert.equal(done.reason,'locked');assert.deepStrictEqual(done.state,before);
});

test('upgrade prices are finite, ordered, and spend only earned amber',()=>{
  let s=normalizeLineageState({amber:100,earned:100});
  const spent=[];
  for(const id of Object.keys(LINEAGE_UPGRADES)){
    const def=LINEAGE_UPGRADES[id];let prior=0;
    for(let rank=0;rank<def.max;rank++){
      const cost=nextUpgradeCost(s,id);assert.equal(cost,def.costs[rank]);assert.ok(cost>prior);prior=cost;
      const bought=buyLineageUpgrade(s,id);assert.equal(bought.ok,true);spent.push(cost);s=bought.state;
    }
    assert.equal(nextUpgradeCost(s,id),null);assert.equal(buyLineageUpgrade(s,id).reason,'maxed');
  }
  assert.equal(s.spent,spent.reduce((a,b)=>a+b,0));near(s.amber,100-s.spent);assert.equal(s.earned,100);
});

test('an empty or insufficient wallet cannot invent an upgrade',()=>{
  const empty=freshLineageState(),r=buyLineageUpgrade(empty,'trail_memory');
  assert.equal(r.ok,false);assert.equal(r.reason,'not_enough_amber');assert.deepStrictEqual(r.state,empty);
  assert.equal(buyLineageUpgrade(empty,'made_up').reason,'unknown_upgrade');
});

test('all four effects are bounded and have documented magnitudes',()=>{
  const maxed=normalizeLineageState({amber:0,earned:200,spent:200,upgrades:{trail_memory:99,sealed_jars:99,forager_marks:99,deep_rest:99}});
  assert.deepStrictEqual(maxed.upgrades,{trail_memory:3,sealed_jars:3,forager_marks:3,deep_rest:3});
  assert.deepStrictEqual(lineageEffects(maxed),{guideLifeMultiplier:1.75,protectedStorageBonus:6,wildForageRangeCells:12,restRecoveryMultiplier:1.45});
});

test('legacy and malformed saves migrate to safe finite values',()=>{
  const s=normalizeLineageState({amber:-9,earned:'x',spent:7,flights:-3,upgrades:{trail_memory:-1,sealed_jars:2.8},history:[null]});
  assert.equal(s.amber,0);assert.equal(s.spent,7);assert.equal(s.earned,7);assert.equal(s.flights,0);
  assert.equal(s.upgrades.trail_memory,0);assert.equal(s.upgrades.sealed_jars,2);assert.equal(s.history.length,1);
});

if(!process.exitCode)console.log(`lineage: ${ok} ok, 0 fallos`);
