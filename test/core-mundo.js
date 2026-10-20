'use strict';
const M=require('../ant-farm-rpg/core/mundo.js');
const {BANDAS}=require('../ant-farm-rpg/core/bandas.js');
let ok=0,fail=0;
function check(cond,msg){ if(cond){ok++; console.log('ok   '+msg);}else{fail++; console.error('FAIL '+msg);} }
function signature(seed,w=96,h=72){
  let s=''; for(let d=0;d<h;d+=3) for(let c=0;c<w;c+=3) s+=M.worldGeologyHost(seed,c,d).toString(20)+','+M.worldDepositAt(seed,c,d).toString(20)+';';
  return s;
}

check(typeof M.worldGeologyHost==='function'&&typeof M.worldSitesForRange==='function','el núcleo exporta geología, biomas e historia física');
check(M.worldSeed32('ant farm')===M.worldSeed32('ant farm'),'una semilla textual se normaliza de forma estable');
const a=signature(918273),b=signature(918273);
check(a===b,'la misma semilla produce exactamente el mismo subsuelo');
let changed=0,sampled=0;
for(let d=0;d<72;d+=3) for(let x=0;x<96;x+=3){
  sampled++;
  if(M.worldGeologyHost(918273,x,d)!==M.worldGeologyHost(918274,x,d)||M.worldDepositAt(918273,x,d)!==M.worldDepositAt(918274,x,d)) changed++;
}
check(changed/sampled>0.25,'otra semilla altera ampliamente el subsuelo ('+changed+'/'+sampled+' celdas muestreadas)');

const valid=new Set(BANDAS.map(x=>x.tipo));
let allValid=true,adjSame=0,adjTotal=0,rowMixed=0;
for(let seed=1;seed<=8;seed++) for(let d=0;d<76;d++){
  const row=[];
  for(let x=0;x<112;x++){
    const t=M.worldGeologyHost(seed,x,d); if(!valid.has(t)) allValid=false; row.push(t);
    if(x){adjTotal++; if(t===row[x-1]) adjSame++;}
  }
  if(new Set(row).size>1) rowMixed++;
}
check(allValid,'toda roca anfitriona pertenece a una banda física válida');
check(adjSame/adjTotal>0.82,'los estratos conservan continuidad local ('+(100*adjSame/adjTotal).toFixed(1)+'% de vecinos)');
check(rowMixed>80,'hay estratos ondulados y lentes: '+rowMixed+' filas mezclan materiales');

let predominant=true;
for(let i=0;i<BANDAS.length;i++){
  const next=BANDAS[i+1]?BANDAS[i+1].desde:BANDAS[i].desde+12;
  const d=Math.min(next-2,BANDAS[i].desde+Math.max(1,Math.floor((next-BANDAS[i].desde)/2)));
  const counts=new Map();
  for(let seed=1;seed<=12;seed++) for(let x=0;x<128;x++){
    const t=M.worldGeologyHost(seed,x,d); counts.set(t,(counts.get(t)||0)+1);
  }
  const winner=[...counts].sort((x,y)=>y[1]-x[1])[0][0]; if(winner!==BANDAS[i].tipo) predominant=false;
}
check(predominant,'la profundidad decide el material predominante sin imponer franjas perfectas');

let deposits=0,total=0,withNeighbour=0,fringe=0; const byType=new Map();
for(let seed=1;seed<=10;seed++) for(let d=0;d<88;d++) for(let x=0;x<112;x++){
  total++; const q=M.worldDepositAt(seed,x,d); if(!q) continue;
  deposits++; byType.set(q,(byType.get(q)||0)+1);
  if(M.worldDepositAt(seed,x+1,d)===q||M.worldDepositAt(seed,x-1,d)===q||M.worldDepositAt(seed,x,d+1)===q||M.worldDepositAt(seed,x,d-1)===q) withNeighbour++;
  const def=M.WORLD_DEPOSITS.find(z=>z.type===q); if(Math.abs(d-def.center)>def.core) fringe++;
}
const oreRate=deposits/total;
check(oreRate>0.018&&oreRate<0.075,'las inclusiones son ocasionales, no otra capa ('+(oreRate*100).toFixed(2)+'%)');
check(byType.size===M.WORLD_DEPOSITS.length,'aparecen todas las familias de depósito a lo largo de la profundidad');
check(withNeighbour/deposits>0.34,'las inclusiones forman vetas conectadas por encima del azar ('+(100*withNeighbour/deposits).toFixed(1)+'%)');
check(fringe>120,'existen trazas pobres fuera del núcleo de su zona ('+fringe+' muestras)');

let stable=true;
for(let d=0;d<35;d++) for(let x=0;x<64;x++){
  const before=M.worldGeologyHost(444,x,d)+'/'+M.worldDepositAt(444,x,d);
  // Querying much deeper coordinates cannot consume RNG or alter an earlier coordinate.
  M.worldGeologyHost(444,x+96,d+80); M.worldDepositAt(444,x+96,d+80);
  const after=M.worldGeologyHost(444,x,d)+'/'+M.worldDepositAt(444,x,d);
  if(before!==after) stable=false;
}
check(stable,'abrir profundidad nueva no rerrollea ninguna celda anterior');

const cavesA=M.worldCavesForRange(424242,48,28,37),cavesB=M.worldCavesForRange(424242,48,28,37);
check(JSON.stringify(cavesA)===JSON.stringify(cavesB),'la misma losa revela siempre la misma cueva física');
check(JSON.stringify(cavesA)!==JSON.stringify(M.worldCavesForRange(424243,48,28,37)),'otra semilla cambia las cámaras de la banda nueva');
check(cavesA.length>=1&&cavesA.length<=2&&cavesA.every(q=>q.rx>=1&&q.rx<47&&q.ry>=29&&q.ry<36&&q.loot.length===6),'las cámaras y candidatos de botín quedan dentro de la ampliación');

const profile=M.createWorldProfile(778899,96);
const p2=M.createWorldProfile(778899,96);
check(JSON.stringify(profile)===JSON.stringify(p2)&&profile.styles.length>=2,'el perfil histórico oculto es determinista y tiene estilos coherentes');
check(M.worldSitesForRange(profile,96,0,14).length===0,'no hay ruinas en el suelo fundacional antes del descenso');
const full=M.worldSitesForRange(profile,96,15,95);
const split=[...M.worldSitesForRange(profile,96,15,47),...M.worldSitesForRange(profile,96,48,95)];
check(JSON.stringify(full)===JSON.stringify(split),'materializar por ampliaciones conserva exactamente los mismos sitios');
check(new Set(full.map(s=>s.id)).size===full.length&&full.every(s=>s.style<profile.styles.length),'los sitios tienen ID único y remiten a un estilo causal existente');
check(full.every(s=>profile.cycles[s.cycle]&&profile.cycles[s.cycle].style===s.style&&profile.cycles[s.cycle].collapse===s.scar),'cada sitio hereda estilo y cicatriz de una fase histórica concreta');
check(full.filter(s=>s.scar==='water').every(s=>s.flood>0&&s.kind==='waterworks'),'una misma causa oculta deja pistas relacionadas, no ruido independiente');
check(full.every(s=>s.repairStyle==null||(s.repairStyle<profile.styles.length&&s.repairStyle!==s.style)),'las reparaciones, cuando existen, reutilizan otro estilo histórico');
check(full.length>=3&&full.length<=12,'los vestigios son escasos a lo largo de 80 filas ('+full.length+' sitios)');
check(full.every(s=>s.depth>=15&&!/temple|tomb|altar/i.test(s.kind)),'los datos de vestigio usan formas físicas, no interpretaciones');
let siteCount=0,oddities=0,oddityValid=true;
for(let seed=1;seed<=500;seed++) for(const s of M.worldSitesForRange(M.createWorldProfile(seed,96),96,15,150)){
  siteCount++; if(s.oddity){ oddities++; if(s.oddity<1||s.oddity>3) oddityValid=false; }
}
const oddityRate=oddities/Math.max(1,siteCount);
check(oddityValid&&oddityRate>0.007&&oddityRate<0.035,'los guiños diegéticos son válidos y realmente raros ('+(oddityRate*100).toFixed(2)+'% de sitios)');

const biomeIds=new Set(); let biomeAdjacent=0,biomeTotal=0;
for(let seed=1;seed<=8;seed++) for(let d=7;d<61;d+=2){
  let prev=''; for(let x=0;x<120;x+=2){ const id=M.worldBiomeAt(seed,x,d).id; biomeIds.add(id); if(prev){biomeTotal++; if(prev===id) biomeAdjacent++;} prev=id; }
}
check(biomeIds.size>=6,'la profundidad descubre varios ambientes ('+[...biomeIds].join(', ')+')');
check(biomeAdjacent/biomeTotal>0.78,'los biomas forman regiones continuas, no ruido por celda');

console.log(`\n${fail?'❌ '+fail+' fallos':'✅ '+ok+' ok'} · geología e historia procedural`);
if(fail) process.exitCode=1;
