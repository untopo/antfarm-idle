// Pure regression for conservative water: pressure rises, a full basin spills, and plugs displace.
const assert=require('assert');
const {addWaterMass,displaceWaterMass,stepWaterGrid,waterMass}=require('../ant-farm-rpg/core/agua.js');
let checks=0;
function ok(condition,message){ assert.ok(condition,message); checks++; }
function near(a,b,eps=1e-8){ return Math.abs(a-b)<=eps; }
function world(rows,cols){ return {soil:Array.from({length:rows},()=>Array(cols).fill(1)),water:Array.from({length:rows},()=>Array(cols).fill(0))}; }

{
  const {soil,water}=world(4,4); soil[1][1]=0;
  ok(addWaterMass(water,soil,1,1,1.7)===1.7,'the source accepts all supplied water');
  ok(near(water[1][1],1.7),'a full cell keeps pressure instead of clamping it away');
  ok(addWaterMass(water,soil,0,0,2)===0,'solid terrain rejects a source');
}

{
  const {soil,water}=world(8,11);
  // Four-cell-wide basin, a right-hand lip, and an outside shaft.
  for(let r=2;r<=6;r++) for(let c=2;c<=5;c++) soil[r][c]=0;
  for(let c=5;c<=8;c++) soil[2][c]=0;
  for(let r=2;r<=6;r++) soil[r][8]=0;
  addWaterMass(water,soil,3,3,18);
  const before=waterMass(water);
  let spillReports=0;
  for(let i=0;i<160;i++) spillReports+=stepWaterGrid(water,soil,{dt:2,passes:3,phase:i}).overflow;
  const outside=water.reduce((sum,row)=>sum+(row[8]||0),0);
  ok(near(waterMass(water),before,1e-7),'flow conserves total mass');
  ok(outside>0.5,'a filled basin spills beyond its lip');
  ok(water[6][3]>0.9,'gravity still fills the bottom of the original pit');
  ok(spillReports>0,'the core reports overflow/pressure movement');
  ok(water.every(row=>row.every(v=>v>=0&&Number.isFinite(v))),'flow leaves finite, non-negative cells');
}

{
  const {soil,water}=world(6,7);
  for(let r=1;r<5;r++) for(let c=1;c<6;c++) soil[r][c]=0;
  water[3][3]=0.8;
  const before=waterMass(water);
  water[3][3]=0; soil[3][3]=1;
  const moved=displaceWaterMass(water,soil,3,3,before);
  ok(near(moved,before),'plug displacement finds connected open volume');
  ok(near(waterMass(water),before),'placing a plug displaces rather than deletes water');
  ok(water[3][3]===0,'the sealed cell remains dry');
}

{
  const {soil,water}=world(5,5);
  for(let r=1;r<4;r++) soil[r][2]=0;
  addWaterMass(water,soil,2,1,1);
  for(let i=0;i<12;i++) stepWaterGrid(water,soil,{dt:1,passes:2,phase:i});
  ok(water[3][2]>0.8,'ordinary filling still falls into the deepest open cell');
  ok(near(waterMass(water),1),'vertical settling does not leak mass');
}

{
  const {soil,water}=world(6,5),barriers=new Set(['2,3']);
  for(let r=1;r<5;r++) soil[r][2]=0;
  addWaterMass(water,soil,2,1,1,null);
  for(let i=0;i<20;i++) stepWaterGrid(water,soil,{dt:2,passes:2,phase:i,barriers});
  ok(water[4][2]===0,'a hydrological cover blocks water below it');
  ok(near(waterMass(water),1),'a passable cover blocks flow without consuming water');
  ok(addWaterMass(water,soil,2,3,0.5,barriers)===0,'sources cannot inject through a cover');
}

{
  const {soil,water}=world(3,3); soil[1][1]=0; water[1][1]=0.7; soil[1][1]=1;
  stepWaterGrid(water,soil,{dt:1,passes:1});
  ok(near(waterMass(water),0.7),'a fully enclosed terrain change retains pressure until an outlet exists');
}
console.log(`core-agua: ${checks} ok`);
