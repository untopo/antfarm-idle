/** Oficios: learned from real work, age, traits and colony need; never assigned by the player. */
const fs=require('fs');
const {ctx,vm}=require('/home/user/test/world-perf-proflib.js');
const run=code=>vm.runInContext(code,ctx);
const src=fs.readFileSync('/home/user/ant-farm-rpg/js/app.js','utf8');
let pass=0,fail=0;
const ok=(c,m,d='')=>{if(c){pass++;console.log('ok   '+m+(d?' · '+d:''));}else{fail++;console.log('FAIL '+m+(d?' · '+d:''));}};

console.log('\n· una necesidad real abre plazas, no un menú');
run(`topoCreateFreshWorld(48,28);
(function(){
 const spec=[
  ['BUILD', {construccion:98,exploracion:12,recoleccion:12,cuidado:18,comunica:20}, {build:6,dig:0,forage:0,explore:0,nurse:0}, .7],
  ['MINE',  {construccion:78,exploracion:68,recoleccion:10,cuidado:10,comunica:12}, {build:0,dig:7,forage:0,explore:0,nurse:0}, 1.1],
  ['SCOUT', {construccion:10,exploracion:99,recoleccion:28,cuidado:10,comunica:75}, {build:0,dig:0,forage:0,explore:6,nurse:0}, 1.3],
  ['FORAGE',{construccion:10,exploracion:48,recoleccion:99,cuidado:12,comunica:20}, {build:0,dig:0,forage:7,explore:0,nurse:0}, 1.4],
  ['NURSE', {construccion:12,exploracion:12,recoleccion:20,cuidado:99,comunica:60}, {build:0,dig:0,forage:0,explore:0,nurse:6}, .3]
 ];
 const open=nestReachableData().cells.slice(0,spec.length);
 workers=spec.map((s,i)=>{const p=open[i];const w=makeAnt(null,{x:(p[0]+.5)*CELL,y:(p[1]+.5)*CELL});w.id=s[0];w.traits=s[1];w.jobExperience=s[2];w.age=s[3]*DAY_LENGTH;w.health=100;w.fatigue=0;w.mood.stress=0;w.profession='OBRERA';w.role='OBRERA';return w;});
 const bp=open[0];brood=[{type:'larva',x:(bp[0]+.5)*CELL,y:(bp[1]+.5)*CELL}]; economyLedger.setFood(0,'profession test'); economyLedger.replaceMaterials({},'profession test');
})();`);
const learned=run(`(()=>{const out=assignEmergentProfessions(false);return{needs:out.need,by:Object.fromEntries(workers.map(w=>[w.id,w.profession])),roles:Object.fromEntries(workers.map(w=>[w.id,w.role]))};})()`);
ok(learned.needs.pendingStore&&learned.needs.lowFood,'obra pendiente y hambre se leen como necesidades de la colonia');
ok(learned.by.BUILD==='CONSTRUCTORA','la experiencia y el rasgo de construcción hacen emerger una BUILDER');
ok(learned.by.MINE==='MINERA_PROFUNDA','el trabajo de excavación hace emerger una DEEP MINER');
ok(learned.by.SCOUT==='EXPLORADORA','la exploración practicada hace emerger una SCOUT');
ok(learned.by.FORAGE==='RECOLECTORA_EXTERIOR','las entregas hacen emerger una SURFACE FORAGER');
ok(learned.by.NURSE==='NODRIZA','el cuidado real y la edad joven hacen emerger una NURSE');
ok(learned.roles.BUILD==='EXCAVADORA'&&learned.roles.MINE==='EXCAVADORA','builder y deep miner conservan la banda legacy sin duplicar cifras de COLONY');
const automatic=run(`(()=>{for(const w of workers){w.profession='OBRERA';w.role='OBRERA';w.jobAge=0;}window._jobTimer=0;gen=0;colonyIQ=100;updateHierarchy(DAY_LENGTH*.17);return workers.map(w=>w.profession);})()`);
ok(automatic.every(p=>p!=='OBRERA'),'el reloj de trabajo activa los oficios incluso en GEN0, sin esperar una jerarquía social',automatic.join(', '));

console.log('\n· la edad y la práctica cuentan por separado de la genética');
const scores=run(`(()=>{
 const base={id:'Y',health:100,mood:{stress:0},traits:{construccion:50,exploracion:50,recoleccion:50,cuidado:50,comunica:50},jobExperience:{build:0,dig:0,forage:0,explore:0,nurse:0},profession:'OBRERA',role:'OBRERA',deliveries:0};
 const young={...base,age:.3*DAY_LENGTH},old={...base,id:'O',age:1.5*DAY_LENGTH};
 const practised={...base,id:'P',age:1*DAY_LENGTH,traits:{...base.traits,construccion:34},jobExperience:{...base.jobExperience,dig:8},deepestWork:SURFACE_ROW+15};
 const gifted={...base,id:'G',age:1*DAY_LENGTH,traits:{...base.traits,construccion:86},jobExperience:{...base.jobExperience,dig:0},deepestWork:SURFACE_ROW+2};
 return{youngN:_professionScore(young,'NODRIZA'),oldN:_professionScore(old,'NODRIZA'),youngF:_professionScore(young,'RECOLECTORA_EXTERIOR'),oldF:_professionScore(old,'RECOLECTORA_EXTERIOR'),practised:_professionScore(practised,'MINERA_PROFUNDA'),gifted:_professionScore(gifted,'MINERA_PROFUNDA')};})()`);
ok(scores.youngN>scores.oldN,'a igual experiencia, la joven encaja mejor en cuidado de cría');
ok(scores.oldF>scores.youngF,'a igual experiencia, la adulta encaja mejor fuera del nido');
ok(scores.practised>scores.gifted,'la práctica profunda puede superar una aptitud heredada mayor',scores.practised.toFixed(1)+' > '+scores.gifted.toFixed(1));

console.log('\n· al cambiar la necesidad cambia el reparto, no los botones');
const demand=run(`(()=>{
 workers=[];for(let i=0;i<12;i++){const w=makeAnt();w.age=DAY_LENGTH;w.id='W'+i;workers.push(w);} brood=[];
 let s=storageStructure(false);if(s)s.built=true;economyLedger.setFood(100,'fed');economyLedger.replaceMaterials({clay:20,stone:20,fiber:20},'stocked');
 const fed=colonyProfessionNeeds();
 if(s)s.built=false;economyLedger.setFood(0,'hungry');economyLedger.replaceMaterials({},'empty');const bp=nestReachableData().cells[0],bx=(bp[0]+.5)*CELL,by=(bp[1]+.5)*CELL;brood=[{type:'larva',x:bx,y:by},{type:'larva',x:bx,y:by},{type:'egg',x:bx,y:by}];
 const urgent=colonyProfessionNeeds();
 return{fed:fed.target,urgent:urgent.target,pending:urgent.pendingBuild,low:urgent.lowFood};})()`);
ok(demand.urgent.RECOLECTORA_EXTERIOR>demand.fed.RECOLECTORA_EXTERIOR,'el hambre abre más plazas de forrajeo exterior',demand.fed.RECOLECTORA_EXTERIOR+' → '+demand.urgent.RECOLECTORA_EXTERIOR);
ok(demand.urgent.CONSTRUCTORA>=1&&demand.pending,'un plano pendiente exige al menos una constructora');
ok(demand.urgent.NODRIZA>=1&&demand.low,'una camada con reserva baja conserva cuidado y comida como urgencias');

console.log('\n· el aprendizaje está cableado a acciones observables');
ok(/recordJobExperience\(ant,'dig'/.test(src)&&/recordJobExperience\(ant,'forage'/.test(src),'excavar y entregar comida escriben experiencia sólo al completar la acción');
ok(/recordJobExperience\(ant,'build'/.test(src)&&/recordJobExperience\(donor,'nurse'/.test(src),'construir y alimentar larvas escriben sus experiencias reales');
ok(/recordJobExperience\(ant,'explore',dt\/DAY_LENGTH/.test(src),'explorar exige tiempo efectivo en el exterior o la profundidad');
ok(!/btn[^\n]{0,40}(profession|oficio|role)|onclick[^\n]{0,80}assignEmergentProfessions/i.test(src),'no existe control de jugador para repartir oficios');

console.log('\n· compatibilidad');
const legacy=run(`(()=>{const a={role:'EXCAVADORA',lastJob:'NADA',jobExperience:{build:0,dig:4,forage:0,explore:0,nurse:0}},b={role:'EXCAVADORA',lastJob:'NADA',jobExperience:{build:5,dig:1,forage:0,explore:0,nurse:0}};return[antProfession(a),antProfession(b)];})()`);
ok(legacy[0]==='MINERA_PROFUNDA'&&legacy[1]==='CONSTRUCTORA','una partida antigua separa EXCAVADORA según su experiencia acumulada',legacy.join(' / '));

console.log(`\nOFICIOS EMERGENTES: ${pass} ok · ${fail} fallos`);
if(fail)process.exit(1);
