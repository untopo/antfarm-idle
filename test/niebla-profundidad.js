/**
 * niebla-profundidad.js — el mapa conocido crece con la galería, no con el generador.
 *
 * Contrato:
 *   - sólo se recuerdan aire conectado y la pared inmediata;
 *   - una cavidad aislada queda tapada, no interactiva y no amplía la cámara;
 *   - abrir una ruta revela la cavidad y aumenta el límite vertical con un margen corto;
 *   - la memoria sobrevive a derrumbes y guardados; un guardado antiguo migra sin radiografiar bolsas;
 *   - backing canvas, entrada y viewport usan la ventana lógica 960×576 aunque el mundo sea más alto;
 *   - sólo la excavación conectada puede pedir nuevas filas.
 */
const {ctx,vm,getEl,store}=require('/home/user/test/world-perf-proflib.js');
const run=code=>vm.runInContext(code,ctx);
let pass=0,fail=0;
const ok=(c,m,d='')=>{if(c){pass++;console.log('ok   '+m+(d?' · '+d:''));}else{fail++;console.log('FAIL '+m+(d?' · '+d:''));}};

console.log('\n· la colonia no nace con una radiografía del subsuelo');
const sealed=run(`(()=>{
  topoCreateFreshWorld(64,45);paused=true;view.zoom=2;clampView();
  const seed=nestReachableData().cells[0],c0=3,r0=ROWS-8;
  for(let r=r0-1;r<=r0+3;r++)for(let c=c0-1;c<=c0+3;c++){soil[r][c]=1;soilType[r][c]=4;}
  for(let r=r0;r<r0+3;r++)for(let c=c0;c<c0+3;c++){soil[r][c]=0;soilType[r][c]=0;}
  markSoilDirty();refreshExploration(true);
  const b=getPanBounds(),z=getMinZoom();
  window._fogCase={seed,c0,r0,b,z};
  return{seedSeen:isExploredCell(seed[0],seed[1]),isolatedSeen:isExploredCell(c0+1,r0+1),interactive:canInteractAt((c0+1.5)*CELL,(r0+1.5)*CELL),maxY:b.maxY,deep:_exploredDeepest,z};
})()`);
ok(sealed.seedSeen,'el componente de la boca sí forma parte del mapa conocido');
ok(!sealed.isolatedSeen&&!sealed.interactive,'la cavidad aislada no se ve ni acepta interacción');

const fogged=run(`(()=>{
  const f=_fogCase,rects=[],old=ctx.fillRect;ctx.fillRect=(x,y,w,h)=>rects.push([x,y,w,h]);
  drawFogOfWar(ctx,0,COLS,SURFACE_ROW,ROWS,false);ctx.fillRect=old;
  const inside=(c,r)=>{const x=(c+.5)*CELL,y=(r+.5)*CELL;return rects.some(a=>x>=a[0]&&x<a[0]+a[2]&&y>=a[1]&&y<a[1]+a[3]);};
  return{cave:inside(f.c0+1,f.r0+1),seed:inside(f.seed[0],f.seed[1]),rects:rects.length};
})()`);
ok(fogged.cave&&!fogged.seed,'la capa opaca tapa la bolsa pero deja visible el túnel conectado',`${fogged.rects} rectángulos fusionados`);

console.log('\n· excavar una ruta abre niebla, cámara y zoom de forma gradual');
const opened=run(`(()=>{
  const f=_fogCase,ec=entradaCol>=0?entradaCol:CENTER_COL,target=f.r0+1;
  for(let r=SURFACE_ROW;r<=target;r++){soil[r][ec]=0;soilType[r][ec]=0;}
  for(let c=Math.min(ec,f.c0+1);c<=Math.max(ec,f.c0+1);c++){soil[target][c]=0;soilType[target][c]=0;}
  markSoilDirty();refreshExploration(true);clampView();
  const b=getPanBounds(),z=getMinZoom();
  return{seen:isExploredCell(f.c0+1,f.r0+1),interactive:canInteractAt((f.c0+1.5)*CELL,(f.r0+1.5)*CELL),
    oldMax:f.b.maxY,newMax:b.maxY,oldZ:f.z,newZ:z,bottom:exploredBottomY(),vh:VIEW_H/view.zoom,physical:H-VIEW_H/view.zoom};
})()`);
ok(opened.seen&&opened.interactive,'la misma cavidad se descubre al existir una ruta física');
ok(opened.newMax>opened.oldMax,'el límite de desplazamiento baja con el frente',`${opened.oldMax.toFixed(1)} → ${opened.newMax.toFixed(1)}`);
ok(opened.newMax<=opened.bottom-opened.vh+0.001&&opened.newMax<=opened.physical+0.001,'la cámara no rebasa frente ni fondo físico');
ok(opened.newZ<opened.oldZ,'el zoom panorámico también gana profundidad',`${opened.oldZ.toFixed(2)} → ${opened.newZ.toFixed(2)}`);

console.log('\n· lo explorado se recuerda, pero la migración antigua no inventa recuerdos');
const memory=run(`(()=>{
  const f=_fogCase,ec=entradaCol>=0?entradaCol:CENTER_COL,target=f.r0+1;
  // Derrumbe de la única unión horizontal: la cámara ya estuvo allí y debe conservar el dibujo.
  const bridge=ec<f.c0+1?f.c0: f.c0+2;soil[target][bridge]=1;soilType[target][bridge]=4;markSoilDirty(bridge,target);
  const disconnected=!isNestCellConnected(f.c0+1,f.r0+1),remembered=isExploredCell(f.c0+1,f.r0+1);
  serializeSave(true);const raw=localStorage.getItem(_topoSaveKey);
  _loadExploration([]);const erased=!isExploredCell(f.c0+1,f.r0+1);
  localStorage.setItem(_topoSaveKey,raw);const loaded=deserializeSave(),restored=isExploredCell(f.c0+1,f.r0+1);
  const old=JSON.parse(raw);delete old.explored;localStorage.setItem(_topoSaveKey,JSON.stringify(old));_loadExploration([]);
  const migrated=deserializeSave(),legacyHidden=!isExploredCell(f.c0+1,f.r0+1),legacySeed=isExploredCell(entradaCol,SURFACE_ROW);
  return{disconnected,remembered,erased,loaded,restored,migrated,legacyHidden,legacySeed};
})()`);
ok(memory.disconnected&&memory.remembered,'un derrumbe corta el acceso sin borrar la memoria visual');
ok(memory.erased&&memory.loaded&&memory.restored,'save/load restaura las celdas exploradas');
ok(memory.migrated&&memory.legacyHidden&&memory.legacySeed,'un guardado antiguo conoce su nido conectado, no cavidades aisladas');

console.log('\n· canvas creciente, puntero y cámara hablan la misma ventana lógica');
const viewport=run(`(()=>{
  topoCreateFreshWorld(64,45);paused=true;view.zoom=2;view.x=12;view.y=34;clampView();
  const p=farmPointer({clientX:480,clientY:288});
  const scales=[],old=ctx.scale;ctx.scale=(x,y)=>scales.push([x,y]);drawFarm(ctx,W,H,false);ctx.scale=old;
  return{x:p.x,y:p.y,vx:view.x,vy:view.y,W,H,first:scales[0],logical:[VIEW_W,VIEW_H]};
})()`);
ok(Math.abs(viewport.x-(viewport.vx+240))<.01&&Math.abs(viewport.y-(viewport.vy+144))<.01,'el centro del panel se convierte con 960×576, no con la altura del mundo',`${viewport.x}, ${viewport.y}`);
ok(viewport.H===720&&viewport.first&&Math.abs(viewport.first[0]-viewport.W/960)<1e-9&&Math.abs(viewport.first[1]-viewport.H/576)<1e-9,'el render normaliza el backing 1024×720 antes de aplicar cámara');

console.log('\n· sólo el frente conectado puede agrandar el mundo');
const expansion=run(`(()=>{
  topoCreateFreshWorld(48,28);paused=true;umbral=null;gen=3;colonyIQ=140;digs=40;
  while(workers.length<6)workers.push(makeAnt(makeGenome(),{x:CENTER_COL*CELL+8,y:SURFACE_Y-6}));
  const c=2,r=ROWS-1;for(let rr=ROWS-3;rr<ROWS;rr++)for(let cc=1;cc<4;cc++){soil[rr][cc]=1;soilType[rr][cc]=4;}
  soil[r][c]=0;soilType[r][c]=0;markSoilDirty();const rows0=ROWS;_lastExpand=-1e12;checkWorldExpansion();const afterPocket=ROWS;
  const ec=entradaCol>=0?entradaCol:CENTER_COL;for(let rr=SURFACE_ROW;rr<rows0;rr++){soil[rr][ec]=0;soilType[rr][ec]=0;}
  markSoilDirty();_lastExpand=-1e12;checkWorldExpansion();return{rows0,afterPocket,afterTunnel:ROWS};
})()`);
ok(expansion.afterPocket===expansion.rows0,'una bolsa abierta junto al fondo no solicita filas');
ok(expansion.afterTunnel>expansion.rows0,'una galería conectada hasta el fondo sí amplía el mundo',`${expansion.rows0} → ${expansion.afterTunnel}`);

console.log(`\nNIEBLA Y PROFUNDIDAD: ${pass} ok · ${fail} fallos`);
if(fail)process.exit(1);
