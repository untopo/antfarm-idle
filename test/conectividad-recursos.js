/**
 * conectividad-recursos.js — una coordenada cercana no atraviesa roca.
 *
 * Contrato:
 *   - las bolsas de aire desconectadas no son cámaras, frentes, comida ni señales conocidas;
 *   - abrir una galería las incorpora inmediatamente al componente del nido;
 *   - ni la recogida ni la suma de gotas alcanzan a través de una pared;
 *   - el prado continúa siendo alcanzable desde la boca para no romper la fundación.
 */
const fs=require('fs');
const {ctx,vm}=require('/home/user/test/world-perf-proflib.js');
const run=code=>vm.runInContext(code,ctx);
const src=fs.readFileSync('/home/user/ant-farm-rpg/js/app.js','utf8');
let pass=0,fail=0;
const ok=(c,m,d='')=>{if(c){pass++;console.log('ok   '+m+(d?' · '+d:''));}else{fail++;console.log('FAIL '+m+(d?' · '+d:''));}};

console.log('\n· una cámara a veinte píxeles sigue detrás de la roca');
run(`topoCreateFreshWorld(48,28);paused=true;
(function(){
  const wr=CENTER_COL+2,r0=SURFACE_ROW+3;
  // Anillo sólido y sala 3x3. La obrera queda en la última columna del pozo inicial; entre ambas
  // hay exactamente una columna de roca, aunque la distancia visual sea menor que el radio antiguo.
  for(let r=r0-1;r<=r0+3;r++)for(let c=wr;c<=wr+4;c++){soil[r][c]=1;soilType[r][c]=2;}
  for(let r=r0;r<r0+3;r++)for(let c=wr+1;c<wr+4;c++){soil[r][c]=0;soilType[r][c]=0;}
  markSoilDirty();
  const ant=workers[0];ant.x=(CENTER_COL+2)*CELL-1;ant.y=(r0+1.5)*CELL;ant.state='EXPLORAR';ant.food=null;ant.targetFood=null;ant.digTarget=null;
  foods=[];const hidden={x:(wr+1)*CELL+2,y:(r0+1.5)*CELL,amount:1,max:1,r:7,ftype:'honey',rot:0,fresh:1};foods.push(hidden);
  pheromones=[{x:hidden.x,y:hidden.y,strength:1,life:1,type:'recruit'}];
  window._connCase={wr,r0,ant,hidden};
})();`);
const sealed=run(`(()=>{const x=_connCase;const s=getSensorsForAnt(x.ant);return{
  known:isNestCellConnected(x.wr+1,x.r0+1),food:isFoodReachable(x.hidden,x.ant),nearest:nearestFood(x.ant,90),
  collect:canCollectFood(x.ant,x.hidden),signal:nearestPhero(x.ant),foodDist:s[1],
  reward:isRewardAtKnownEdge({c:x.wr+2,r:x.r0+1,found:false}),stride:canAntMove(x.ant,x.hidden.x,x.hidden.y),
  dist:Math.hypot(x.ant.x-x.hidden.x,x.ant.y-x.hidden.y)
};})()`);
ok(!sealed.known,'el aire del otro lado no entra en el nido conocido');
ok(!sealed.food&&sealed.nearest===null,'la comida aislada no puede ser objetivo',`distancia directa ${sealed.dist.toFixed(1)} px`);
ok(!sealed.collect,'la mandíbula no recoge a través de la pared aunque esté dentro del radio antiguo');
ok(!sealed.stride,'un paso acelerado tampoco aterriza al otro lado de la pared');
ok(sealed.signal===null&&sealed.foodDist===0,'ni el olor ni la señal neuronal atraviesan roca');
ok(!sealed.reward,'un objeto enterrado junto a una bolsa desconocida tampoco se revela');
const cleared=run(`(()=>{const x=_connCase;x.ant.targetFood=x.hidden;updateAnt(x.ant,1);return{x:x.ant.targetFood,state:x.ant.state};})()`);
ok(cleared.x===null,'un objetivo manual o antiguo se invalida en el siguiente paso');

console.log('\n· tampoco se teletransporta comida al juntar gotas');
const split=run(`(()=>{const x=_connCase;foods=[];const y=(x.r0+1.5)*CELL;
  _juntaGota((CENTER_COL+1)*CELL+14,y,1,'honey',false);
  _juntaGota((x.wr+1)*CELL+2,y,1,'honey',false);
  return{n:foods.length,a:foods.map(f=>f.amount),line:_openResourceSegment(foods[0].x,foods[0].y,foods[1].x,foods[1].y,false)};})()`);
ok(split.n===2&&split.a.every(x=>x===1)&&!split.line,'dos gotas próximas pero separadas por roca permanecen en sus cámaras');
const waste=run(`(()=>{const x=_connCase,w=x.wr*CELL,y=(x.r0+1.5)*CELL;wastePiles=[];
  addWaste(w-2,y,1);addWaste(w+18,y,1);return{n:wastePiles.length,a:wastePiles.map(p=>p.amount)};})()`);
ok(waste.n===2&&waste.a.every(x=>x===1),'los montículos de residuo tampoco se fusionan a través de roca');

console.log('\n· la cría exige una boca en su misma galería');
const broodWall=run(`(()=>{const x=_connCase;workers=[x.ant];queens=[];queen=null;economyLedger.setFood(0,'connectivity test');
  x.ant.crop=1;x.ant.role='NODRIZA';x.ant.profession='NODRIZA';
  brood=[{type:'larva',progress:0,time:0,x:x.hidden.x,y:x.hidden.y,hunger:0,genome:makeGenome(),faction:0}];
  updateBrood(100);return{progress:brood[0]&&brood[0].progress,crop:x.ant.crop,hunger:brood[0]&&brood[0].hunger};})()`);
ok(broodWall.progress<0.1&&broodWall.crop===1&&broodWall.hunger>0,'una nodriza cercana no alimenta a través de la losa');

console.log('\n· al abrir el túnel, la misma sala se descubre sin un permiso mágico');
const opened=run(`(()=>{const x=_connCase;soil[x.r0+1][x.wr]=0;soilType[x.r0+1][x.wr]=0;markSoilDirty(x.wr,x.r0+1);
  x.ant.x=(CENTER_COL+1.5)*CELL;x.ant.y=(x.r0+1.5)*CELL;x.ant.targetFood=null;foods=[];
  const y=(x.r0+1.5)*CELL;
  _juntaGota((CENTER_COL+1)*CELL+14,y,1,'honey',false);
  _juntaGota((x.wr+1)*CELL+2,y,1,'honey',false);
  const food=foods[0];pheromones=[{x:food.x,y:food.y,strength:1,life:1,type:'recruit'}];
  return{known:isNestCellConnected(x.wr+1,x.r0+1),food:isFoodReachable(food,x.ant),nearest:nearestFood(x.ant,90)===food,
    collect:canCollectFood(x.ant,food),merged:foods.length===1&&food.amount===2,signal:nearestPhero(x.ant)!==null,
    reward:isRewardAtKnownEdge({c:x.wr+2,r:x.r0+1,found:false}),
    blocksMouth:_structureKeepsNestConnected({c:entradaCol-1,r:SURFACE_ROW},{w:3,h:1})};})()`);
ok(opened.known&&opened.food&&opened.nearest,'la abertura física incorpora sala y comida');
ok(opened.collect,'con el muro abierto la misma distancia sí permite recoger');
ok(opened.merged,'las gotas ahora comparten aire y se suman');
ok(opened.signal,'la feromona viaja sólo después de existir el paso');
ok(opened.reward,'el objeto entra en el borde conocido sólo después de conectar la sala');
ok(!opened.blocksMouth,'una constructora no puede tapiar la única conexión de la colonia');

console.log('\n· un derrumbe tampoco sella la única boca');
const collapse=run(`(()=>{topoCreateFreshWorld(48,28);const ec=entradaCol>=0?entradaCol:detectarEntrada(),before=nestReachableData().cells.length;
  const fallen=safeNestCollapse(ec,SURFACE_ROW+1,()=>0),after=nestReachableData().cells.length;
  return{fallen,before,after,mouth:soil[SURFACE_ROW][ec],connected:isNestCellConnected(ec,SURFACE_ROW),queen:_entityInKnownWalkspace(queen)};})()`);
ok(collapse.mouth===0&&collapse.connected,'el derrumbe protege la celda de entrada');
ok(collapse.queen&&collapse.after>0,'la reina y el nido siguen en el componente conectado',`${collapse.before} → ${collapse.after} celdas`);

console.log('\n· una bolsa procedural lejana no infla el hormiguero');
const census=run(`(()=>{const c0=3,r0=ROWS-7;
  for(let r=r0-1;r<=r0+3;r++)for(let c=c0-1;c<=c0+3;c++){soil[r][c]=1;soilType[r][c]=4;}
  markSoilDirty();_wsCache.at=-1e9;const before=worldStats();const n0=before.open;
  for(let r=r0;r<r0+3;r++)for(let c=c0;c<c0+3;c++){soil[r][c]=0;soilType[r][c]=0;}
  markSoilDirty();_wsCache.at=-1e9;const after=worldStats();
  const boundary=[];for(let r=r0-1;r<=r0+3;r++)for(let c=c0-1;c<=c0+3;c++)if(soil[r][c]===1)boundary.push(c+','+r);
  const frontier=new Set(after.frontier.map(p=>p.c+','+p.r));
  return{n0,n1:after.open,known:isNestCellConnected(c0,r0),foreignFrontier:boundary.some(k=>frontier.has(k)),chambers:after.chambers};})()`);
ok(!census.known,'la bolsa lejana permanece desconocida');
ok(census.n1===census.n0,'sus nueve celdas no aumentan el área útil',`${census.n0} → ${census.n1}`);
ok(!census.foreignFrontier,'sus paredes no reclutan mineras desde el otro lado del mapa');

console.log('\n· el prado y los tres tamaños conservan el mismo contrato');
const meadow=run(`(()=>{topoCreateFreshWorld(48,28);const ant=workers[0];ant.x=(CENTER_COL+.5)*CELL;ant.y=(SURFACE_ROW+5.5)*CELL;
  foods=[];const f={x:(CENTER_COL+5.5)*CELL,y:SURFACE_Y-8,amount:2,max:2,r:9,ftype:'honey',rot:0,fresh:1,grounded:true};foods.push(f);
  return{reachable:isFoodReachable(f,ant),target:nearestFood(ant,Infinity)===f};})()`);
ok(meadow.reachable&&meadow.target,'la comida exterior sigue conectada por la boca');
for(const [name,C,R] of [['small',48,28],['medium',64,36],['big',96,48]]){
  const res=run(`(()=>{topoCreateFreshWorld(${C},${R});const c=3,r=ROWS-6;
    for(let rr=r-1;rr<=r+2;rr++)for(let cc=c-1;cc<=c+2;cc++){soil[rr][cc]=1;soilType[rr][cc]=2;}
    markSoilDirty();_wsCache.at=-1e9;const n0=worldStats().open;
    for(let rr=r;rr<r+2;rr++)for(let cc=c;cc<c+2;cc++){soil[rr][cc]=0;soilType[rr][cc]=0;}
    markSoilDirty();_wsCache.at=-1e9;const n1=worldStats().open;
    return{known:isNestCellConnected(c,r),same:n0===n1};})()`);
  ok(!res.known&&res.same,`${name}: el vacío aislado no cuenta ni se conoce`);
}

console.log('\n· guardas de integración');
ok(/if\(!isFoodReachable\(_x,ant\)\) continue/.test(src),'hambre y excursión filtran por conectividad');
ok(/if\(canCollectFood\(ant,targ\)\)/.test(src),'la recogida usa alcance físico común');
ok(/const known=nestReachableData\(\)/.test(src),'cámaras y frentes nacen del componente de la entrada');

console.log(`\nCONECTIVIDAD DE RECURSOS: ${pass} ok · ${fail} fallos`);
if(fail)process.exit(1);
