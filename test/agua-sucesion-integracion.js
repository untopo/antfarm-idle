/** Product-level deterministic regressions for flood intelligence and scheduled succession. */
const assert=require('assert');
process.env.TEST_SEED=process.env.TEST_SEED||'20261018';
process.env.TEST_CLOCK='simulated';
const {ctx,vm}=require('./world-perf-proflib.js');
const run=src=>vm.runInContext(src,ctx);
let checks=0;
function ok(value,message){ assert.ok(value,message); checks++; }
function eq(a,b,message){ const plain=a&&typeof a==='object'?JSON.parse(JSON.stringify(a)):a; assert.deepStrictEqual(plain,b,message); checks++; }
function near(a,b,eps,message){ assert.ok(Math.abs(a-b)<=eps,`${message}: ${a} vs ${b}`); checks++; }

run(`topoCreateFreshWorld(48,28); gameSpeed=1;`);

// The app uses the core without clamping: a full source rises and crosses a basin lip.
const overflow=run(`(()=>{
  soil=Array.from({length:ROWS},()=>Array(COLS).fill(1));
  water=Array.from({length:ROWS},()=>Array(COLS).fill(0));
  for(let r=8;r<=12;r++) for(let c=4;c<=7;c++) soil[r][c]=0;
  for(let c=7;c<=11;c++) soil[8][c]=0;
  for(let r=8;r<=12;r++) soil[r][11]=0;
  addWater(5,9,18); const before=waterMass(water);
  for(let i=0;i<170;i++) stepWaterGrid(water,soil,{dt:2,passes:3,phase:i});
  return {before,after:waterMass(water),outside:water.reduce((n,row)=>n+(row[11]||0),0),pressureAccepted:before};
})()`);
near(overflow.before,18,1e-9,'addWater accepts the whole source');
near(overflow.after,18,1e-7,'integrated flow conserves mass');
ok(overflow.outside>0.5,'a full app basin spills into the outside shaft');

// Pathfinding chooses the longer dry gallery and movement refuses a high-speed hop over water.
const routing=run(`(()=>{
  soil=Array.from({length:ROWS},()=>Array(COLS).fill(1));
  water=Array.from({length:ROWS},()=>Array(COLS).fill(0));
  for(let c=2;c<=6;c++){ soil[7][c]=0; soil[8][c]=0; }
  water[7][3]=water[7][4]=water[7][5]=0.8;
  const a=workers[0]; a.x=2.5*CELL; a.y=7.5*CELL; a._routeUntil=0;
  const p=routeStep(a,6.5*CELL,7.5*CELL);
  return {step:p&&[p.x/CELL,p.y/CELL],enter:canAntMove(a,3.5*CELL,7.5*CELL),jump:canAntMove(a,6.5*CELL,7.5*CELL)};
})()`);
eq(routing.step,[2.5,8.5],'BFS takes the dry detour first');
eq(routing.enter,false,'ordinary movement refuses to enter deep water');
eq(routing.jump,false,'segment sampling prevents jumping across a flooded corridor');

// An ant already submerged gets the explicit exception and reaches dry ground instead of being trapped.
const escaped=run(`(()=>{
  soil=Array.from({length:ROWS},()=>Array(COLS).fill(1));
  water=Array.from({length:ROWS},()=>Array(COLS).fill(0));
  for(let c=2;c<=8;c++) soil[10][c]=0;
  for(let c=2;c<=6;c++) water[10][c]=0.8;
  const a=workers[0]; workers=[a]; a.x=3.5*CELL; a.y=10.5*CELL; a.angle=0; a.state='EXPLORAR'; a.blocked=0; a.food=null;
  const initial=waterAtPixel(a.x,a.y);
  for(let i=0;i<70;i++) updateAnt(a,1);
  return {initial,final:waterAtPixel(a.x,a.y),x:a.x/CELL,state:a.state,health:a.health};
})()`);
ok(escaped.initial>=0.8,'escape scenario starts submerged');
ok(escaped.final<0.14&&escaped.x>6,'the submerged ant reaches a dry shore');
ok(escaped.state!=='HUIR_AGUA','the ant resumes normal work after escaping');
ok(escaped.health>0,'water avoidance does not manufacture a delayed death');

// Flood response assigns one nearby engineer, seals from a dry face and conserves displaced water.
const flood=run(`(()=>{
  topoCreateFreshWorld(48,28); gameSpeed=1;
  soil=Array.from({length:ROWS},()=>Array(COLS).fill(1));
  water=Array.from({length:ROWS},()=>Array(COLS).fill(0));
  soilType=Array.from({length:ROWS},()=>Array(COLS).fill(1));
  for(let c=8;c<=12;c++){soil[12][c]=0;soilType[12][c]=0;}
  soil[11][11]=0;soilType[11][11]=0;
  // La emergencia pertenece al nido vivo: galería seca hasta la boca, no una cámara artificial aislada.
  const ec=entradaCol>=0?entradaCol:CENTER_COL;
  for(let r=SURFACE_ROW;r<=12;r++){soil[r][ec]=0;soilType[r][ec]=0;}
  for(let c=Math.min(11,ec);c<=Math.max(11,ec);c++){soil[12][c]=0;soilType[12][c]=0;}
  markSoilDirty();water[12][12]=1.3;
  queen.x=9.5*CELL; queen.y=12.5*CELL; pantryPos={x:9.5*CELL,y:12.5*CELL};
  workers=[workers[0]]; const a=workers[0]; a.x=11.5*CELL; a.y=12.5*CELL; a.food=null; a.state='EXPLORAR';
  floodControl.target=null; floodControl.workerId=null; floodControl.scan=0; floodControl.worldKey=COLS+'x'+ROWS;
  const before=waterMass(water); updateFloodResponse(30); const assigned=a.state;
  for(let i=0;i<20&&soil[12][12]===0;i++) updateAnt(a,1);
  return {assigned,sealed:soil[12][12],atPlug:water[12][12],before,after:waterMass(water),state:a.state,target:floodControl.target};
})()`);
eq(flood.assigned,'CONTROLAR_AGUA','a nearby worker adopts the emergency task');
eq(flood.sealed,1,'the worker builds a physical flood barrier');
eq(flood.atPlug,0,'the barrier occupies the breached cell');
near(flood.after,flood.before,1e-9,'sealing displaces water instead of deleting it');
eq(flood.target,null,'the completed incident is released');

const cover=run(`(()=>{
  soil=Array.from({length:ROWS},()=>Array(COLS).fill(1)); water=Array.from({length:ROWS},()=>Array(COLS).fill(0));
  floodBarriers.clear(); const r=SURFACE_ROW+4,c=CENTER_COL;
  soil[r][c]=0; soil[r-1][c]=0; soil[r][c-1]=0; water[r][c]=0.8;
  const before=waterMass(water),a=workers[0]; _sealFloodCell(a,{c,r});
  return {open:soil[r][c]===0,covered:floodBarriers.has(c+','+r),walkable:canMove((c+.5)*CELL,(r+.5)*CELL),before,after:waterMass(water)};
})()`);
eq(cover.open,true,'the founding shaft is not plugged with soil');
eq(cover.covered,true,'the shaft receives a water-only cover');
eq(cover.walkable,true,'ants can still traverse the covered shaft');
near(cover.after,cover.before,1e-9,'a shaft cover also displaces all trapped water');

// Succession begins one development cycle before death even in SMALL with only three workers and the
// protected five-food reserve. The old queen waits for that exact isQueen brood and retires at hatch.
const succession=run(`(()=>{
  topoCreateFreshWorld(48,28); gameSpeed=1; workers=workers.slice(0,3); brood=[];
  economyLedger.setFood(5,'succession test'); queen=queens[0]; queen.progress=10;
  queen.age=queen.maxAge-DAY_LENGTH*(QUEEN_SUCCESSOR_LEAD_DAYS+0.20);
  delete queen._royalNext; delete queen._successionAnnounced; delete queen._successionPlanned;
  _prepareSuccessor(queen); const early=!!queen._royalNext;
  queen.age=queen.maxAge-DAY_LENGTH*(QUEEN_SUCCESSOR_LEAD_DAYS-0.01);
  _prepareSuccessor(queen); const planned=!!queen._royalNext, boosted=queen.progress;
  queen.progress=100; updateQueen(1);
  const royal=brood.find(b=>b.isQueen), laid=!!royal, food=economyLedger.food;
  royal.type='pupa'; royal.progress=99.9; queen.age=queen.maxAge+1; queen.edadPospuesta=0;
  updateQueen(1); const waited=queens.includes(queen)&&queen.edadPospuesta>0;
  updateBrood(100);
  const successorAlive=queens.some(q=>q!==queen&&q.age<DAY_LENGTH*0.01);
  return {early,planned,boosted,laid,food,waited,successorAlive,oldStillThere:queens.includes(queen),queens:queens.length};
})()`);
eq(succession.early,false,'succession does not start too early');
eq(succession.planned,true,'the next egg is reserved inside the development window');
ok(succession.boosted>=84,'the natural laying cycle is advanced, not replaced by a spawned queen');
eq(succession.laid,true,'the scheduled egg uses the real isQueen property');
eq(succession.food,5,'SMALL succession respects the protected food reserve');
eq(succession.waited,true,'the old queen waits while her heir is still a pupa');
eq(succession.successorAlive,true,'the heir hatches alive at the handover');
eq(succession.oldStillThere,false,'the old queen retires once the living successor exists');

console.log(`agua-sucesion-integracion: ${checks} ok`);
