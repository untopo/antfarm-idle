/**
 * Regression for the player's report "the ants never leave the burrow".
 *
 * Start an untouched SMALL farm and run the real simulation step. No profession, food target,
 * coordinates, age, store, or worker state is injected. One founder must first be observed inside
 * the burrow, then receive an emergent excursion, climb onto the meadow, collect physical food,
 * return below the grass line, and increase her own delivery count.
 */
process.env.TEST_SEED='31';
process.env.TEST_CLOCK='simulated';
const {ctx,vm}=require('./world-perf-proflib.js');
let pass=0,fail=0;
const ok=(cond,msg,detail='')=>{if(cond){pass++;console.log('  ok   '+msg+(detail?' · '+detail:''));}else{fail++;console.log('  FAIL '+msg+(detail?' · '+detail:''));}};
const run=src=>vm.runInContext(src,ctx);

const result=run(`(()=>{
  topoCreateFreshWorld(48,28);paused=false;gameSpeed=1;
  const inside=new Set(),assigned=new Set(),outside=new Set(),picked=new Set(),returned=new Set(),delivered=new Set();
  const deliveryAtPickup=new Map(),trace=[];
  let steps=0,error='';
  try{
    for(steps=0;steps<24000&&!delivered.size;steps++){
      tickStep(3);
      for(const ant of workers){
        if(ant.y>SURFACE_Y+22)inside.add(ant.id);
        if(inside.has(ant.id)&&ant._excursion&&ant.targetFood){
          assigned.add(ant.id);
          if(trace.length<8)trace.push({step:steps,id:ant.id,phase:'assigned',x:Math.round(ant.x),y:Math.round(ant.y)});
        }
        if(assigned.has(ant.id)&&ant.y<SURFACE_Y-2){
          outside.add(ant.id);
          if(trace.length<8&&!trace.some(x=>x.id===ant.id&&x.phase==='outside'))trace.push({step:steps,id:ant.id,phase:'outside',x:Math.round(ant.x),y:Math.round(ant.y)});
        }
        if(outside.has(ant.id)&&ant._excursion&&ant.food){
          if(!picked.has(ant.id)){
            deliveryAtPickup.set(ant.id,Number(ant.deliveries)||0);
            if(trace.length<8)trace.push({step:steps,id:ant.id,phase:'picked',x:Math.round(ant.x),y:Math.round(ant.y)});
          }
          picked.add(ant.id);
        }
        if(picked.has(ant.id)&&ant.y>SURFACE_Y+18){
          returned.add(ant.id);
          if(trace.length<8&&!trace.some(x=>x.id===ant.id&&x.phase==='returned'))trace.push({step:steps,id:ant.id,phase:'returned',x:Math.round(ant.x),y:Math.round(ant.y)});
        }
        if(returned.has(ant.id)&&!ant.food&&(Number(ant.deliveries)||0)>(deliveryAtPickup.get(ant.id)||0)){
          delivered.add(ant.id);
          if(trace.length<8)trace.push({step:steps,id:ant.id,phase:'delivered',x:Math.round(ant.x),y:Math.round(ant.y)});
        }
      }
    }
  }catch(e){error=String(e&&e.stack||e);}
  return {steps,error,founders:4,currentWorkers:workers.length,day,
    inside:[...inside],assigned:[...assigned],outside:[...outside],picked:[...picked],returned:[...returned],delivered:[...delivered],trace};
})()`);

console.log('\n· untouched founding colony completes a physical meadow journey');
ok(!result.error,'the real simulation step throws no exception',result.error);
ok(result.inside.length===result.founders,'all four founders are observed inside before the excursion',result.inside.join(', '));
ok(result.assigned.length>=1,'colony need and traits select a founder without a manual profession',result.assigned.join(', '));
ok(result.outside.some(id=>result.assigned.includes(id)),'the selected founder physically crowns the shaft and walks on the meadow',JSON.stringify(result.trace));
ok(result.picked.some(id=>result.outside.includes(id)),'that same visible excursion collects a physical food object',result.picked.join(', '));
ok(result.returned.some(id=>result.picked.includes(id)),'the carrier crosses back below the grass line',result.returned.join(', '));
ok(result.delivered.some(id=>result.returned.includes(id)),'her own delivery counter rises after the return',result.delivered.join(', '));
ok(result.steps<24000,'the complete cycle finishes within the fixed simulation budget',result.steps+' steps · day '+result.day);

console.log(`\nSALIDA EMERGENTE REAL: ${pass} ok · ${fail} fallos`);
if(fail)process.exit(1);
