/** Regresión: expandWorld debe expandir todas las rejillas, incluida water. */
process.env.TEST_SEED='2';
process.env.TEST_CLOCK='simulated';
const { sb,ctx,vm }=require('./world-perf-proflib.js');
let pass=0,fail=0;
const ok=(c,m)=>{if(c){pass++;console.log('  ok   '+m);}else{fail++;console.log('  FAIL '+m);}};
let r=null,error=null;
try{
  r=vm.runInContext(`(()=>{
    topoCreateFreshWorld(48,28); const antes=ROWS;
    expandWorld(8,true);
    const rejilla=water.length===ROWS && water.every(f=>Array.isArray(f)&&f.length===COLS);
    updateWater(1);
    const q=queens[0]; q.y=(ROWS-3)*CELL+8; q.x=CENTER_COL*CELL+8; updateQueen(q,1);
    return {antes,filas:ROWS,agua:water.length,rejilla,alto:H,lienzo:document.getElementById('farmCanvas').height};
  })()`,ctx);
}catch(e){error=e;}
ok(!error,'agua y reina se actualizan en la banda nueva'+(error?' · '+error.message:''));
ok(r&&r.filas===r.antes+8,'el mundo añade exactamente 8 filas');
ok(r&&r.rejilla&&r.agua===r.filas,'water tiene una fila completa por fila de mundo ('+(r?r.agua:'?')+'/'+(r?r.filas:'?')+')');
ok(r&&r.alto===r.filas*16&&r.lienzo===r.alto,'H y el lienzo crecen con las filas ('+(r?r.alto:'?')+' px)');
console.log('\n'+pass+' ok'+(fail?' · '+fail+' FALLOS':' · expansión coherente'));
process.exit(fail?1:0);
