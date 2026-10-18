'use strict';
const {stepWaterGrid,waterMass}=require('../ant-farm-rpg/core/agua.js');
let ok=0,fail=0;
function check(v,m){ if(v){ok++;console.log('ok   '+m);}else{fail++;console.error('FAIL '+m);} }
const eps=(a,b)=>Math.abs(a-b)<1e-8;
const open=(rows,cols)=>Array.from({length:rows},()=>Array(cols).fill(0));

{
  const soil=open(4,3),water=open(4,3),events=[]; water[0][1]=0.8; const before=waterMass(water);
  const out=stepWaterGrid(water,soil,{dt:1,passes:1,onFlow:(...e)=>events.push(e)});
  const falls=events.filter(e=>e[5]==='fall'),sum=events.reduce((n,e)=>n+e[4],0);
  check(falls.length===1&&falls[0][0]===1&&falls[0][1]===0&&falls[0][2]===1&&falls[0][3]===1,'onFlow describe la caída con origen y destino exactos');
  check(falls[0][4]>0&&falls[0][4]<0.8,'la caída informa un nivel parcial, no teletransporta la fuente completa');
  check(eps(before,waterMass(water))&&eps(out.mass,before),'la telemetría no altera la conservación de masa');
  check(eps(sum,out.moved),'sin desplazamientos ocultos, la suma visual coincide con el agua movida');
}

{
  const soil=open(3,5),water=open(3,5),events=[];
  // Solid floor supports a shallow pool, which can seek its level sideways.
  soil[2].fill(1); water[1][2]=0.72;
  stepWaterGrid(water,soil,{dt:1,passes:1,phase:0,onFlow:(...e)=>events.push(e)});
  const sides=events.filter(e=>e[5]==='side');
  check(sides.length>0&&sides.every(e=>e[1]===e[3]),'el flujo lateral emite segmentos horizontales observables');
  check(sides.every(e=>e[4]>0&&e[4]<=0.55),'cada segmento lateral informa una transferencia física acotada');
}

{
  const soil=open(3,3),water=open(3,3),events=[]; water[2][1]=1.65;
  // Bottom pressure rises after gravity and lateral flow have had their chance.
  stepWaterGrid(water,soil,{dt:1,passes:1,onFlow:(...e)=>events.push(e)});
  const rises=events.filter(e=>e[5]==='rise');
  check(rises.length===1&&rises[0][1]===2&&rises[0][3]===1,'la presión ascendente se distingue de caída y derrame');
  check(water[2][1]>=1&&water[1][1]>0,'la fuente presurizada conserva su cuerpo mientras el exceso sube');
}

{
  const soil=open(3,3),water=open(3,3); water[0][1]=0.4;
  let calls=0,threw=false;
  try{ stepWaterGrid(water,soil,{passes:1,onFlow:()=>{calls++;throw new Error('visual only');}}); }catch(_e){threw=true;}
  check(calls>0&&!threw,'un fallo del observador visual nunca rompe la física');
  check(eps(waterMass(water),0.4),'incluso con observador fallido se conserva la masa');
}

{
  const soil=open(2,2),water=open(2,2); let calls=0;
  stepWaterGrid(water,soil,{passes:2,onFlow:()=>calls++});
  check(calls===0,'no se inventan trazas visuales cuando no fluye agua');
}

console.log(`\n${fail?'❌ '+fail+' fallos':'✅ '+ok+' ok'} · telemetría conservativa del agua`);
if(fail) process.exitCode=1;
