/**
 * A live founding colony must not be a single vertical drill. One emergent deep shift coexists with
 * side scouts; excavated soil returns through the real mouth, so upward traffic is visible as well.
 */
process.env.TEST_SEED='41';
process.env.TEST_CLOCK='simulated';
const {ctx,vm}=require('./world-perf-proflib.js');
let pass=0,fail=0;
const ok=(cond,msg,detail='')=>{if(cond){pass++;console.log('  ok   '+msg+(detail?' · '+detail:''));}else{fail++;console.log('  FAIL '+msg+(detail?' · '+detail:''));}};
const result=vm.runInContext(`(()=>{
  topoCreateFreshWorld(48,28);paused=false;gameSpeed=8;
  const initial=new Set(nestReachableData().cells.map(p=>p.join(','))),inside=new Set(),lateralIds=new Set(),returned=new Set(),foragersUp=new Set();
  const assigned=[];let error='';
  try{
    for(let step=0;step<1800;step++){
      tickStep(3);
      for(const w of workers){
        if(w.y>SURFACE_Y+20)inside.add(w.id);
        if(w._lateralScout){
          lateralIds.add(w.id);
          if(w.digTarget&&!assigned.some(x=>x.id===w.id&&x.c===w.digTarget.c&&x.r===w.digTarget.r))assigned.push({id:w.id,c:w.digTarget.c,r:w.digTarget.r,step});
        }
        if(lateralIds.has(w.id)&&inside.has(w.id)&&w.y<SURFACE_Y-2)returned.add(w.id);
        if(inside.has(w.id)&&w._excursion&&w.y<SURFACE_Y-2)foragersUp.add(w.id);
      }
    }
  }catch(e){error=String(e&&e.stack||e);}
  const added=nestReachableData().cells.filter(p=>!initial.has(p.join(','))&&Math.abs(p[0]-CENTER_COL)>1);
  return {error,digs,day,initial:initial.size,open:nestReachableData().cells.length,assigned,
    left:added.filter(p=>p[0]<CENTER_COL-1),right:added.filter(p=>p[0]>CENTER_COL+1),
    lateralIds:[...lateralIds],returned:[...returned],foragersUp:[...foragersUp],
    manualControls:document.querySelectorAll('[data-assign-profession],#professionPicker').length};
})()`,ctx);

console.log('\n· the nest grows down, left, right, and back through its mouth');
ok(!result.error,'the real simulation loop completes without an exception',result.error);
ok(result.manualControls===0,'no profession or excavation worker is manually assigned');
ok(result.assigned.length>=1,'traits and colony need elect a visible lateral excavation shift',JSON.stringify(result.assigned.slice(0,4)));
ok(result.left.length>0&&result.right.length>0,'connected tunnels open naturally on both sides of the founding shaft',`left ${result.left.length} · right ${result.right.length}`);
ok(result.left.length+result.right.length>=2&&result.digs>=2,'the side branches are physical new cells, not target markers',`${result.left.length+result.right.length} new side cells · ${result.digs} digs · ${result.initial} → ${result.open} currently open`);
ok(result.returned.some(id=>result.lateralIds.includes(id)),'a side excavator physically climbs above the grass to dump soil',result.returned.join(', '));
ok(result.foragersUp.length>=1,'an independent founder also climbs into the meadow for food',result.foragersUp.join(', '));

console.log(`\nEXPLORACIÓN TRIDIRECCIONAL: ${pass} ok · ${fail} fallos`);if(fail)process.exit(1);
