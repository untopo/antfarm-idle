/**
 * Terraria-style depth contract.
 *
 * SMALL, MEDIUM and BIG all descend through the complete geology without an intermediate full-width
 * lock. The connected tunnel opens four deterministic backing chunks, then reaches a physical
 * Underworld and a visibly unmineable three-row world core. Size changes extent, never the rule.
 */
process.env.TEST_SEED='109';
process.env.TEST_CLOCK='simulated';
const {ctx,vm}=require('./world-perf-proflib.js');
let pass=0,fail=0;
const ok=(cond,msg,detail='')=>{if(cond){pass++;console.log('  ok   '+msg+(detail?' · '+detail:''));}else{fail++;console.log('  FAIL '+msg+(detail?' · '+detail:''));}};
const run=src=>vm.runInContext(src,ctx);

console.log('\n· every size opens before the allocation edge without a progression gate');
for(const [name,cols,start,limit] of [['SMALL',48,28,84],['MEDIUM',64,36,108],['BIG',96,48,144]]){
  const first=run(`(()=>{
    topoCreateFreshWorld(${cols},${start});paused=true;workers.length=1;gen=0;colonyIQ=100;digs=0;
    const ratio0=worldAreaRatio(),slabs0=soilType.flat().filter(t=>t===17).length,ec=entradaCol>=0?entradaCol:CENTER_COL;
    for(let r=SURFACE_ROW;r<=ROWS-7;r++){soil[r][ec]=0;soilType[r][ec]=0;}
    markSoilDirty();const before=ROWS,opened=checkWorldExpansion();
    return{before,after:ROWS,opened,limit:worldDepthLimit,underworld:worldUnderworldStart(),core:worldCoreStart(),ratio0,ratio1:worldAreaRatio(),slabs0,umbral:!!umbral,workers:workers.length,gen,colonyIQ,digs};
  })()`);
  ok(first.before===start&&first.limit===limit,name+' starts light but owns the advertised complete depth',`${first.before} allocated / ${first.limit} final rows`);
  ok(first.slabs0===0&&!first.umbral,name+' has no intermediate slab or invisible full-width wall');
  ok(first.opened&&first.after>first.before,name+' opens from one connected tunnel even at GEN0, IQ100 and one worker',`${first.before}→${first.after}`);
  ok(Math.abs(first.ratio0-first.ratio1)<1e-12,name+' founding rules do not inflate when depth materialises',String(first.ratio0));

  const final=run(`(()=>{
    const rows=[ROWS];while(ROWS<worldDepthLimit){expandWorld(worldDepthProfile(COLS).chunk,true);rows.push(ROWS);}
    const hell=worldUnderworldStart(),core=worldCoreStart(),types={basalt:0,obsidian:0,magma:0,core:0},central=[];
    for(let r=hell;r<ROWS;r++)for(let c=0;c<COLS;c++){const t=soilType[r][c];if(t===14)types.basalt++;if(t===13)types.obsidian++;if(t===15)types.magma++;if(t===19)types.core++;}
    for(let r=hell;r<core;r++)for(let c=CENTER_COL-4;c<=CENTER_COL+4;c++)central.push(soilType[r][c]);
    const before=ROWS,extra=expandWorld(999,true),ec=entradaCol>=0?entradaCol:CENTER_COL;
    for(let r=SURFACE_ROW;r<core;r++){soil[r][ec]=0;soilType[r][ec]=0;}
    markSoilDirty();refreshExploration(true);view.zoom=2;view.y=1e9;clampView();const bounds=getPanBounds();
    return{rows,finalRows:ROWS,before,extra,hell,core,types,centralMagma:central.filter(t=>t===15).length,
      coreSolid:soil.slice(core).every(row=>row.every(v=>v===1)),coreTyped:soilType.slice(core).every(row=>row.every(v=>v===19)),
      coreMineable:_canExcavateMaterial(19),magmaMineable:_canExcavateMaterial(15),water:water.length,waterCols:water.every(row=>row.length===COLS),
      canvas:document.getElementById('farmCanvas').height,H,bounds,viewY:view.y,known:_exploredDeepest};
  })()`);
  ok(final.rows.length===4&&final.rows[final.rows.length-1]===limit,name+' reaches its core in the same four seamless openings',final.rows.join('→'));
  ok(final.finalRows===limit&&final.extra===false,name+' stops exactly at its advertised finite depth, not at an arbitrary cap');
  ok(final.types.basalt>0&&final.types.obsidian>0&&final.types.magma>0,name+' ends in a physical Underworld of basalt, obsidian and magma',JSON.stringify(final.types));
  ok(final.centralMagma===0,name+' retains a nine-cell mineable travel corridor through the fire');
  ok(final.coreSolid&&final.coreTyped&&!final.coreMineable&&!final.magmaMineable,name+' final three-row core is visible, solid and unmineable');
  ok(final.water===limit&&final.waterCols&&final.H===limit*16&&final.canvas===final.H,name+' expands water, physics and canvas together',`${final.H}px`);
  ok(Math.abs(final.viewY-final.bounds.maxY)<.001&&final.known>=final.core-1,name+' camera can physically scroll to the reached core',`view ${final.viewY.toFixed(1)} / ${final.bounds.maxY.toFixed(1)}`);
}

console.log('\n· Build N saves migrate out of a slab without losing their world');
const migration=run(`(()=>{
  topoCreateFreshWorld(48,28);paused=true;colocarUmbral();const oldRow=umbral.r,w=workers[0];
  w.state='CAVANDO';w.digTarget={c:umbral.c0,r:oldRow};serializeSave(true);
  const data=JSON.parse(localStorage.getItem(_topoSaveKey));delete data.depthLimit;delete data.worldCoreFound;localStorage.setItem(_topoSaveKey,JSON.stringify(data));
  const loaded=deserializeSave();return{loaded,rows:ROWS,limit:worldDepthLimit,slabs:soilType.flat().filter(t=>t===17).length,umbral:!!umbral,target:!!workers[0].digTarget,state:workers[0].state,oldRow};
})()`);
ok(migration.loaded&&migration.rows===28&&migration.limit===84,'old save keeps its existing rows and gains the SMALL final depth');
ok(migration.slabs===0&&!migration.umbral,'legacy slab becomes ordinary seeded geology');
ok(!migration.target&&migration.state==='EXPLORAR','worker formerly biting the slab is released to the seamless front');

console.log(`\nTERRARIA DEPTH: ${pass} ok · ${fail} failures`);if(fail)process.exit(1);
