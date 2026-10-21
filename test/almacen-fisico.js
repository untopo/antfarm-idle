/**
 * almacen-fisico.js — el almacén es una obra estable dentro del nido conocido.
 *
 * Contrato del dueño:
 *   - aire desconectado no es conocido, alcanzable ni almacén;
 *   - el hueco por sí solo no da capacidad: una obrera construye la estructura;
 *   - abrir una cámara mayor no muda las reservas;
 *   - sólo una pérdida física real permite elegir y construir otro sitio.
 */
const fs=require('fs');
const {ctx,vm}=require('/home/user/test/world-perf-proflib.js');
const run=code=>vm.runInContext(code,ctx);
const src=fs.readFileSync('/home/user/ant-farm-rpg/js/app.js','utf8');
let pass=0,fail=0;
const ok=(c,m,d='')=>{if(c){pass++;console.log('ok   '+m+(d?' · '+d:''));}else{fail++;console.log('FAIL '+m+(d?' · '+d:''));}};

console.log('\n· fundación: primero sitio conectado, después trabajo');
run('topoCreateFreshWorld(48,28)');
let fresh=run(`(()=>{const s=storageStructure(false),a=_storeAnchor(s),fp=_storeFootprint(s);return{
  exists:!!s,type:s&&s.type,built:s&&s.built,progress:s&&s.buildProgress,builders:s&&s.builders.slice(),
  position:a,cells:storageCells().length,capacity:capacidadAlmacen(),
  open:fp.every(p=>soil[p.r][p.c]===0),connected:fp.every(p=>isNestCellConnected(p.c,p.r)),
  jobs:workers.filter(w=>s.builders.includes(w.id)).map(w=>({id:w.id,trait:w.traits.construccion,exp:w.jobExperience.build}))
}})()`);
ok(fresh.exists&&fresh.type==='store'&&fresh.built===false,'la colonia funda un plano de NEST STORE, no una cifra flotante');
ok(fresh.open&&fresh.connected,'las seis celdas del plano son aire conectado al nido vivo');
ok(fresh.cells===0&&fresh.capacity===0,'el plano sin construir todavía no conserva ni aporta capacidad');
ok(fresh.builders.length>=1&&fresh.jobs.length===fresh.builders.length,'las constructoras surgen automáticamente de las obreras aptas',fresh.builders.join(', '));

const built=run(`(()=>{const s=storageStructure(false),a=_storeAnchor(s),before=s.work||0;
  for(const id of s.builders){const w=workers.find(x=>x.id===id);w.x=a.x;w.y=a.y;}
  workOnStore(workers.find(x=>x.id===s.builders[0]),1,1);
  const afterOne=s.work;
  for(let i=0;i<140&&!s.built;i++)for(const id of s.builders){const w=workers.find(x=>x.id===id);workOnStore(w,1,1);}
  return{before,afterOne,built:s.built,progress:s.buildProgress,work:s.work,needed:s.workNeeded,builtBy:s.builtBy.slice(),cells:storageCells().length,capacity:capacidadAlmacen(),exp:workers.find(x=>x.id===s.builders[0]).jobExperience.build,pos:storagePos(),foot:_storeFootprint(s).map(p=>soil[p.r][p.c])};})()`);
ok(built.afterOne>built.before&&built.afterOne<built.needed,'el progreso avanza por una acción real, no por crear el objeto',built.before+' → '+built.afterOne.toFixed(2));
ok(built.built&&built.progress===1&&built.work>=built.needed&&built.builtBy.length>0,'el trabajo registrado completa la estructura');
ok(built.cells===6&&built.capacity===20,'la estructura terminada define seis celdas y su capacidad base',built.capacity+' raciones');
ok(built.foot.every(x=>x===0),'el almacén sigue siendo transitable: el marco no rellena su interior de tierra');
ok(built.exp>0,'la constructora conserva experiencia real de ese oficio',built.exp.toFixed(2));

console.log('\n· el footprint queda protegido de mutaciones genéricas del suelo');
const protectedCells=run(`(()=>{const s=storageStructure(true),fp=_storeFootprint(s),p=fp[1],q=fp[fp.length-1];
  const sr=Math.max(SURFACE_ROW+1,p.r-3);soil[sr][p.c]=1;soilType[sr][p.c]=3;markSoilDirty(p.c,sr);
  for(let i=0;i<12;i++)updateFallingSand(100);
  water[q.r][q.c]=.8;const floodOpen=_sealFloodCell(workers[0],{c:q.c,r:q.r});maintainPhysicalStorage();
  return{allOpen:fp.every(x=>soil[x.r][x.c]===0),sandStopped:soil[p.r-1]&&soil[p.r-1][p.c]===1,floodOpen,barrier:floodBarriers.has(q.c+','+q.r),stillStore:storageStructure(true)===s};})()`);
ok(protectedCells.allOpen&&protectedCells.sandStopped,'la gravedad deposita arena sobre el marco, nunca dentro de sus celdas');
ok(protectedCells.floodOpen&&protectedCells.barrier&&protectedCells.stillStore,'una defensa contra agua usa rejilla transitable y no sepulta el almacén');
ok(/if\(typeof isStoreCell==='function'&&isStoreCell\(nc,nr\)\) continue;/.test(src),'el relleno de tierra genérico excluye explícitamente el footprint');
const projectOverlap=run(`(()=>{const s=storageStructure(true),p=_storeFootprint(s)[0],q=projectSiteCheck('forward_cache',p.c,p.r);return q;})()`);
ok(!projectOverlap.ok,'las obras funcionales tampoco pueden solaparlo',projectOverlap.reason||'rechazado');

console.log('\n· conocimiento: una cueva enorme y desconectada sigue fuera del nido');
const isolated=run(`(()=>{const before=storagePos(),cap=capacidadAlmacen(),dc=3,dr=ROWS-7;
  for(let r=dr;r<dr+4;r++)for(let c=dc;c<dc+9;c++){soil[r][c]=0;soilType[r][c]=0;}markSoilDirty();
  const f={x:(dc+.5)*CELL,y:(dr+.5)*CELL,ftype:'berry',amount:1};
  const largest=findLargestChamber();maintainPhysicalStorage();const after=storagePos();
  return{known:isNestCellConnected(dc,dr),preserved:isFoodInStockpile(f),capBefore:cap,capAfter:capacidadAlmacen(),
    largestSize:largest&&largest.size,voidSize:36,same:before.x===after.x&&before.y===after.y};})()`);
ok(!isolated.known,'la cavidad aislada no entra en el mapa conocido');
ok(!isolated.preserved,'la comida dejada allí no recibe conservación de almacén');
ok(isolated.capAfter===isolated.capBefore,'sus 36 celdas abiertas no regalan capacidad',isolated.capBefore+' → '+isolated.capAfter);
ok(isolated.largestSize<isolated.voidSize,'findLargestChamber ya no elige el vacío global desconectado',isolated.largestSize+' conocidas frente a '+isolated.voidSize);
ok(isolated.same,'la inspección periódica no mueve la estructura estable');

const strayQueen=run(`(()=>{const s=storageStructure(true),before={...storagePos()},q=queens[0],q0={x:q.x,y:q.y},dc=3,dr=ROWS-7;
  // Una coordenada móvil no redefine el nido: reproduce la carrera natural que antes mudaba el almacén
  // dos veces entre los días 4 y 5 aunque sus seis celdas siguieran intactas.
  q.x=(dc+.5)*CELL;q.y=(dr+.5)*CELL;markSoilDirty();
  const caveKnown=isNestCellConnected(dc,dr),kept=maintainPhysicalStorage(),after={...storagePos()};
  q.x=q0.x;q.y=q0.y;
  return{caveKnown,kept:kept===s,active:!s.abandoned,same:before.x===after.x&&before.y===after.y,open:_storeFootprint(s).every(p=>soil[p.r][p.c]===0)};})()`);
ok(!strayQueen.caveKnown,'una reina con coordenadas en el vacío aislado no convierte ese vacío en nido conocido');
ok(strayQueen.kept&&strayQueen.active&&strayQueen.same&&strayQueen.open,'la posición móvil de una hormiga no abandona ni muda un almacén físicamente intacto');

console.log('\n· ni siquiera una cámara conectada mayor provoca una mudanza');
const stable=run(`(()=>{const s=storageStructure(true),before={...storagePos()},r=SURFACE_ROW+4;
  // ampliar físicamente el componente conocido a un salón mucho mayor, conectado por el borde del pozo
  for(let rr=r;rr<r+5;rr++)for(let c=CENTER_COL;c<CENTER_COL+10;c++){soil[rr][c]=0;soilType[rr][c]=0;}markSoilDirty();
  for(let i=0;i<9;i++)maintainPhysicalStorage();const after=storagePos();
  const inside=storageCells()[0],food={x:(inside.c+.5)*CELL,y:(inside.r+.5)*CELL,ftype:'berry'};
  return{same:before.x===after.x&&before.y===after.y,c:s.c,r:s.r,preserved:isFoodInStockpile(food),known:isNestCellConnected(CENTER_COL+8,r)};})()`);
ok(stable.known,'la nueva sala conectada sí pasa a ser conocida');
ok(stable.same,'pero el almacén conserva exactamente su dirección',`[${stable.c},${stable.r}]`);
ok(stable.preserved,'sólo la comida dentro del marco construido se conserva');

console.log('\n· una mejora aprobada aumenta capacidad sin levantar otro almacén');
const upgrade=run(`(()=>{const s=storageStructure(true),p0={c:s.c,r:s.r,x:storagePos().x,y:storagePos().y},cap0=capacidadAlmacen();
  gen=4;colonyIQ=140;inventions.clay=true;economyLedger.creditMaterial('clay',5,'test');economyLedger.creditMaterial('fiber',5,'test');economyLedger.setFood(20,'test');
  const balance0={clay:economyLedger.materials.clay,fiber:economyLedger.materials.fiber};
  const automatic=tryBuildComplexStructure(workers[0],{c:CENTER_COL,r:SURFACE_ROW+2});
  const untouched=economyLedger.materials.clay===balance0.clay&&economyLedger.materials.fiber===balance0.fiber;
  const start=approveColonyProject('clay_jars');let picked=0,guard=0;
  while(colonyProjects.activeRef()&&!colonyProjects.allDelivered()&&guard++<160){
    const a=colonyProjects.activeRef();if(!(a.crew||[]).length)_assignColonyProjectCrew(true);
    const w=workers.find(x=>x.id===(a.crew||[])[0]);if(!w)break;
    w.fatigue=0;w.food=null;w.wasteTarget=null;w.x=storagePos().x;w.y=storagePos().y;workOnColonyProject(w,2,1);
    if(w.projectCargo)picked++;
    const target=colonyProjectAnchor(a);w.x=target.x;w.y=target.y;workOnColonyProject(w,2,1);
  }
  guard=0;
  while(colonyProjects.activeRef()&&guard++<180){
    const a=colonyProjects.activeRef();if(!(a.crew||[]).length)_assignColonyProjectCrew(true);
    const w=workers.find(x=>x.id===(a.crew||[])[0]);if(!w)break;
    w.fatigue=0;const target=colonyProjectAnchor(a);w.x=target.x;w.y=target.y;workOnColonyProject(w,8,1);
  }
  return{automatic,untouched,start,picked,count:colonyProjects.completedCount('clay_jars'),cap0,cap1:capacidadAlmacen(),same:p0.c===s.c&&p0.r===s.r&&p0.x===storagePos().x&&p0.y===storagePos().y,open:_storeFootprint(s).every(p=>soil[p.r][p.c]===0),stores:structures.filter(x=>_storeKinds(x)&&!x.abandoned).length};})()`);
ok(!upgrade.automatic&&upgrade.untouched&&upgrade.start.ok&&upgrade.picked>0&&upgrade.count===1,'sólo el proyecto aprobado mejora el marco existente');
ok(upgrade.cap1===upgrade.cap0+12,'la mejora suma capacidad comprobable',upgrade.cap0+' → '+upgrade.cap1);
ok(upgrade.same&&upgrade.open&&upgrade.stores===1,'la mejora no teletransporta, duplica ni vuelve sólido el almacén');

console.log('\n· sólo un daño físico autoriza reconstruir');
const loss=run(`(()=>{const old=storageStructure(true),oldPos={...storagePos()},p=_storeFootprint(old)[0];soil[p.r][p.c]=1;markSoilDirty();
  const next=maintainPhysicalStorage();return{oldAbandoned:old.abandoned===true,next:!!next,nextBuilt:next&&next.built,posChanged:oldPos.x!==storagePos().x||oldPos.y!==storagePos().y,connected:next&&_storeFootprint(next).every(q=>isNestCellConnected(q.c,q.r)&&soil[q.r][q.c]===0)};})()`);
ok(loss.oldAbandoned&&loss.next&&loss.nextBuilt===false,'un colapso real abandona el marco y crea un nuevo plano, no un almacén instantáneo');
ok(loss.connected,'el reemplazo vuelve a elegirse dentro del nido conectado');

console.log('\n· una partida antigua conserva su granero y lo vuelve transitable');
const legacy=run(`(()=>{topoCreateFreshWorld(48,28);structures=[];const c=CENTER_COL-1,r=SURFACE_ROW+7;
  for(let y=r;y<r+2;y++)for(let x=c;x<c+3;x++){soil[y][x]=1;soilType[y][x]=2;}
  structures.push({c,r,w:3,h:2,type:'granary',builtBy:'OLD',age:DAY_LENGTH});
  structures.push({c:3,r:ROWS-5,w:3,h:2,type:'granary',builtBy:'OLD2',age:DAY_LENGTH});markSoilDirty();
  const s=migrateLegacyStorage();return{same:s.c===c&&s.r===r,type:s.type,built:s.built,level:s.level,open:_storeFootprint(s).every(p=>soil[p.r][p.c]===0),active:structures.filter(_storeKinds).length,oldHidden:structures.filter(x=>x.abandoned).length,cap:capacidadAlmacen()};})()`);
ok(legacy.same&&legacy.type==='store'&&legacy.built,'el granero principal antiguo se convierte en el mismo sitio, sin perder la partida');
ok(legacy.open&&legacy.active===1&&legacy.oldHidden===1,'su rectángulo sólido se abre y los duplicados históricos quedan retirados');
ok(legacy.level===3&&legacy.cap===44,'dos graneros antiguos se traducen a niveles del único almacén',`nivel ${legacy.level} · capacidad ${legacy.cap}`);

console.log('\n· guardas de código');
ok(!/pantryPos\.x\s*\+=|pantryPos\.y\s*\+=/.test(src),'no queda ninguna interpolación que haga migrar pantryPos');
ok(!/if\(_abiertas>=5[^\n]+pantryPos=/.test(src),'una recolectora atascada ya no funda almacenes al azar');
ok(/if\(workOnStore\(ant,dt,speed\)\) return;/.test(src),'el trabajo de construcción forma parte del ciclo real de cada obrera');
ok(!/const inPantry\s*=/.test(src),'la conservación ya no usa un radio mágico alrededor de pantryPos');

console.log(`\nALMACÉN FÍSICO: ${pass} ok · ${fail} fallos`);
if(fail)process.exit(1);
