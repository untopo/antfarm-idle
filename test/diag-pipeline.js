/**
 * Diagnostico 2: por que la colonia nueva no arranca (entregas, excavacion, donde estan las obreras).
 *   node test/diag-pipeline.js [dias]
 */
const { sb, ctx, vm } = require('/home/user/test/world-perf-proflib.js');
const DIAS = Number(process.argv[2] || 2);
vm.runInContext('topoCreateFreshWorld(48, 28); paused=false; gameSpeed=64;', ctx);

const radiografia = `(()=>{
  const celda=(x,y)=>{const r=Math.floor(y/CELL),c=Math.floor(x/CELL);return (soil[r]&&soil[r][c]!==undefined)?(soil[r][c]===0?'abierta':'solido'):'fuera';};
  const pan=storagePos();
  const enSuperficie=workers.filter(w=>w.y<SURFACE_Y+4).length;
  const conComida=workers.filter(w=>w.food).length;
  const conBuche=workers.filter(w=>(w.crop||0)>0.14).length;
  const estados={}; workers.forEach(w=>{estados[w.state||'-']=(estados[w.state||'-']||0)+1;});
  return {
    dia: Math.floor(time/DAY_LENGTH)+1,
    entregas: deliveries, cavadas: digs, abierto: worldStats().open,
    despensa: Math.round(colonyFood), miel: foods.length,
    obreras: workers.length, enSuperficie, conComida, conBuche,
    celdasAbiertasCercaDeLaDespensa: (()=>{let n=0;for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){if(celda(pan.x+dx*CELL,pan.y+dy*CELL)==='abierta')n++;}return n;})(),
    despensaCelda: celda(pan.x,pan.y),
    pan: {x:Math.round(pan.x),y:Math.round(pan.y)},
    estados,
    bloqueadas: workers.filter(w=>(w.blocked||0)>10).length,
    larvas: brood.filter(b=>b.type==='larva').length, pupas: brood.filter(b=>b.type==='pupa').length, huevos: brood.filter(b=>b.type==='egg').length,
    hambre: Math.round(Math.max(0,...brood.filter(b=>b.type==='larva').map(b=>b.hunger||0),0)),
    muerteObresas: events.filter(e=>e.type==='death'&&/muere/.test(e.msg)).length
  };
})()`;

let t = 1;
const antes = vm.runInContext(radiografia, ctx);
console.log('AL NACER EL MUNDO  ', JSON.stringify(antes));
for (let f = 0; f < 460 * DIAS; f++) { sb.performance.now = () => t; t += 42; vm.runInContext('loop(performance.now());', ctx); }
console.log(`DESPUES DE ${DIAS} DIAS   `, JSON.stringify(vm.runInContext(radiografia, ctx)));
console.log('\navisos de comida (entregas reales):');
const ev = vm.runInContext(`events.filter(e=>e.type==='food').slice(0,4).map(e=>e.msg)`, ctx);
console.log(ev.length ? ev.map(x => '   ' + x).join('\n') : '   NINGUNA: ninguna obrera ha entregado miel a la despensa');
console.log('\nestado del tunel:');
console.log(vm.runInContext(`(()=>{const c=(x,y)=>(soil[Math.floor(y/CELL)]&&soil[Math.floor(y/CELL)][Math.floor(x/CELL)]===0)?'.':'#';let s='';for(let r=SURFACE_ROW-1;r<=SURFACE_ROW+12;r++){s+=r+' '+[...Array(COLS)].map((_,i)=>c(i*CELL+8,r*CELL+8)).join('')+'\\n';}return s;})()`, ctx));
