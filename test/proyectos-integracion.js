/**
 * proyectos-integracion.js — usa app.js real en VM: compromiso -> carga física -> entrega -> trabajo.
 */
const {ctx,vm}=require('./world-perf-proflib.js');
const run=src=>vm.runInContext(src,ctx);
let pass=0,fail=0;
const ok=(cond,msg,detail='')=>{if(cond){pass++;console.log('ok   '+msg+(detail?' · '+detail:''));}else{fail++;console.log('FAIL '+msg+(detail?' · '+detail:''));}};

run(`topoCreateFreshWorld(48,28);
(function(){
  const s=storageStructure(false),a=_storeAnchor(s);
  for(const id of s.builders){const w=workers.find(x=>x.id===id);w.x=a.x;w.y=a.y;}
  for(let i=0;i<220&&!s.built;i++)for(const id of s.builders){const w=workers.find(x=>x.id===id);w.fatigue=0;workOnStore(w,1,1);}
  const rr=Math.min(ROWS-3,s.r+s.h+2),mid=s.c+1;
  for(let y=s.r+s.h;y<=rr;y++){soil[y][mid]=0;soilType[y][mid]=0;}
  for(let c=Math.max(2,s.c-7);c<=Math.min(COLS-3,s.c+9);c++){soil[rr][c]=0;soilType[rr][c]=0;}
  markSoilDirty();refreshExploration(true);
  economyLedger.replaceMaterials({clay:60,fiber:60,wood:60,stone:60},'project integration stock');
  economyLedger.setFood(24,'project integration food');
  globalThis.__projectRoomRow=rr;
})();
function __findProjectSite(type,startC){
  for(let r=__projectRoomRow;r<ROWS-2;r++)for(let c=startC||2;c<COLS-2;c++){const q=projectSiteCheck(type,c,r);if(q.ok)return q.site;}
  for(let r=SURFACE_ROW+1;r<ROWS-2;r++)for(let c=2;c<COLS-2;c++){const q=projectSiteCheck(type,c,r);if(q.ok)return q.site;}
  return null;
}
function __finishActiveProject(capturePickup){
  const store=storagePos();let pickup=null,guard=0;
  while(colonyProjects.activeRef()&&!colonyProjects.allDelivered()&&guard++<160){
    const a=colonyProjects.activeRef();if(!(a.crew||[]).length)_assignColonyProjectCrew(true);
    const w=workers.find(x=>x.id===(a.crew||[])[0]);if(!w)break;
    w.fatigue=0;w.food=null;w.wasteTarget=null;w.x=store.x;w.y=store.y;
    workOnColonyProject(w,2,1);
    if(!pickup&&w.projectCargo)pickup={state:w.state,cargo:{...w.projectCargo},balance:{...economyLedger.materials},held:economyLedger.materialHeld(w.projectCargo.kind,a.id)};
    const site=colonyProjectAnchor(a);w.x=site.x;w.y=site.y;workOnColonyProject(w,2,1);
  }
  guard=0;
  while(colonyProjects.activeRef()&&guard++<180){
    const a=colonyProjects.activeRef();if(!(a.crew||[]).length)_assignColonyProjectCrew(true);
    const w=workers.find(x=>x.id===(a.crew||[])[0]);if(!w)break;
    w.fatigue=0;const site=colonyProjectAnchor(a);w.x=site.x;w.y=site.y;workOnColonyProject(w,8,1);
  }
  return {pickup,guard,active:colonyProjects.active(),completed:colonyProjects.completed()};
}`);

console.log('\n· reserve floor and atomic approval');
const jars=run(`(()=>{setProjectReserve('clay',4);const before={clay:economyLedger.materials.clay,fiber:economyLedger.materials.fiber,avail:economyLedger.materialAvailable('clay'),cap:capacidadAlmacen()};
  const start=approveColonyProject('clay_jars');const a=colonyProjects.active(),crew=(a.crew||[]).map(id=>{const w=workers.find(x=>x.id===id);return{id,age:w.age,trait:w.traits.construccion,xp:w.jobExperience.build,profession:antProfession(w)}});
  const second=colonyProjects.start('tunnel_braces',{c:4,r:10},economyLedger.availableMaterials());
  const worker=workers.find(w=>w.id===a.crew[0]),store=storagePos(),clayBefore=economyLedger.materials.clay;economyLedger.setFood(_reservaVital(),'survival priority test');worker.x=store.x;worker.y=store.y;worker.fatigue=0;workOnColonyProject(worker,2,1);const survival={cargo:!!worker.projectCargo,clay:economyLedger.materials.clay,blocked:colonyProjects.active().blocked};economyLedger.setFood(24,'resume project test');
  return{before,start,a,crew,second,survival,clayBefore,after:{clay:economyLedger.materials.clay,fiber:economyLedger.materials.fiber,heldClay:economyLedger.materialHeld('clay'),availableClay:economyLedger.materialAvailable('clay')}};})()`);
ok(jars.before.clay===jars.after.clay&&jars.before.fiber===jars.after.fiber,'aprobar compromete sin descontar el saldo');
ok(jars.after.heldClay===3&&jars.after.availableClay===jars.before.clay-4-3,'mínimo y compromiso salen de disponibilidad, no de balances');
ok(jars.second.reason==='one_active_project','el libro rechaza una segunda obra activa');
ok(jars.crew.length>=1&&jars.crew.length<=3&&jars.crew.every(x=>Number.isFinite(x.age)&&Number.isFinite(x.trait)&&Number.isFinite(x.xp)),'la cuadrilla emerge de edad, rasgo y experiencia',jars.crew.map(x=>x.id+'/'+x.profession).join(', '));
ok(!jars.survival.cargo&&jars.survival.clay===jars.clayBefore&&jars.survival.blocked==='SURVIVAL PRIORITY','la supervivencia detiene el proyecto sin gastar su compromiso');

console.log('\n· physical pickup, delivery and visible builder work');
const jarsDone=run(`(()=>{const clay0=economyLedger.materials.clay,fiber0=economyLedger.materials.fiber,cap0=capacidadAlmacen(),r=__finishActiveProject(true);return{...r,clay0,fiber0,clay1:economyLedger.materials.clay,fiber1:economyLedger.materials.fiber,cap0,cap1:capacidadAlmacen(),count:colonyProjects.completedCount('clay_jars'),holds:economyLedger.materialHeld('clay'),builderXp:Math.max(...workers.map(w=>w.jobExperience.build))};})()`);
ok(jarsDone.pickup&&jarsDone.pickup.cargo.amount===1&&jarsDone.pickup.state==='HAUL_PROJECT','una unidad existe como carga visible después de salir del almacén');
ok(jarsDone.clay0-jarsDone.clay1===3&&jarsDone.fiber0-jarsDone.fiber1===2&&jarsDone.holds===0,'cada coste se consume una vez al recogerlo, nunca al aprobar o entregar');
ok(!jarsDone.active&&jarsDone.count===1&&jarsDone.builderXp>0,'trabajo de constructoras completa y enseña el oficio');
ok(jarsDone.cap1===jarsDone.cap0+12,'CLAY JARS añade 12 de capacidad sin borrar excedentes',jarsDone.cap0+' → '+jarsDone.cap1);

console.log('\n· FORWARD CACHE changes a real return route');
const cache=run(`(()=>{const site=__findProjectSite('forward_cache',2),cap0=capacidadAlmacen(),start=approveColonyProject('forward_cache',site),done=__finishActiveProject();const p=colonyProjects.completed().find(x=>x.type==='forward_cache'),a=colonyProjectAnchor(p),w=workers[0];delete w._deliveryNodeId;w.x=a.x;w.y=a.y;const target=storageTargetFor(w);return{site,start,done:!colonyProjects.active(),nodes:storageDeliveryNodes(),target,cap0,cap1:capacidadAlmacen(),operational:_projectSiteOperational(p)};})()`);
ok(cache.site&&cache.start.ok&&cache.done&&cache.operational,'FORWARD CACHE exige y conserva un sitio abierto conectado');
ok(cache.nodes.length===2&&cache.target.type==='forward_cache','una forrajera profunda elige el nuevo nodo físico, no una bonificación abstracta');
ok(cache.cap1===cache.cap0+6,'el cache remoto añade su capacidad pequeña comprobable');

console.log('\n· TUNNEL BRACES protects only the selected zone');
const braces=run(`(()=>{const site=__findProjectSite('tunnel_braces',22),start=approveColonyProject('tunnel_braces',site);__finishActiveProject();const p=colonyProjects.completed().find(x=>x.type==='tunnel_braces'),inside={c:p.site.c,r:p.site.r},outside={c:Math.min(COLS-2,p.site.c+5),r:p.site.r};soil[inside.r][inside.c]=0;soil[outside.r][outside.c]=0;markSoilDirty();const before=soil[inside.r][inside.c],fallen=safeNestCollapse(inside.c,inside.r,()=>0);return{site,start,braced:isBracedCell(inside.c,inside.r),outside:isBracedCell(outside.c,outside.r),insideSoil:soil[inside.r][inside.c],before,fallen};})()`);
ok(braces.start.ok&&braces.braced&&!braces.outside,'TUNNEL BRACES protege una zona 5×3 y no todo el mapa');
ok(braces.before===0&&braces.insideSoil===0,'un derrumbe forzado no rellena la celda apuntalada');

console.log('\n· FUNGUS BED turns delivered substrate into a maintained bed, not free food');
const fungus=run(`(()=>{const site=__findProjectSite('fungus_bed',28),food0=economyLedger.food,fiber0=economyLedger.materials.fiber,start=approveColonyProject('fungus_bed',site);__finishActiveProject();const p=colonyProjects.completed().find(x=>x.type==='fungus_bed'),g=fungusGardens.find(x=>x.projectId===p.id);return{site,start,food0,food1:economyLedger.food,fiber0,fiber1:economyLedger.materials.fiber,garden:g&&{fed:g.fed,health:g.health,c:g.c,r:g.r},invented:inventions.fungus};})()`);
ok(fungus.start.ok&&fungus.garden&&fungus.garden.fed===4&&fungus.invented,'FUNGUS BED crea un lecho físico con la fibra entregada');
ok(fungus.food1===fungus.food0&&fungus.fiber0-fungus.fiber1===4,'el lecho no acredita comida gratis y consume exactamente su sustrato');

console.log('\n· no manual profession controls and one STORES entry');
const fs=require('fs'),html=fs.readFileSync('ant-farm-rpg/index.html','utf8'),app=fs.readFileSync('ant-farm-rpg/js/app.js','utf8');
ok((html.match(/id="invSheet"/g)||[]).length===1&&/_colonyProjectsHtml\(\)/.test(app),'PROJECTS vive dentro de la única hoja NEST STORES');
ok(!/data-(?:assign|worker)-project|assignProjectWorker|setProjectWorker/.test(html+app),'no hay asignación manual de constructoras');

console.log(`\nCOLONY PROJECTS: ${pass} ok · ${fail} fallos`);
if(fail)process.exit(1);
