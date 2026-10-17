/**
 * Diagnóstico reproducible de parones tempranos (docs/EQUILIBRIO.md).
 * Cada semilla se ejecuta desde la carga de app.js con azar y reloj simulados.
 *
 *   node test/diag-parones.js [semilla=1] [dias=3]
 *   node test/diag-parones.js barrido [dias=3] [semillas=12]
 */
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
if (args[0] === 'barrido') {
  const dias = Number(args[1] || 3), n = Number(args[2] || 12);
  console.log('semilla  parado(dias)  cavadas  entregas  comida  obreras');
  for (let seed = 1; seed <= n; seed++) {
    // Un contexto vm no reinicia todo el estado global del juego. Cada semilla va en su proceso.
    const p = spawnSync(process.execPath, [__filename, String(seed), String(dias), '--resumen'], {
      encoding: 'utf8', env: process.env, timeout: 240000
    });
    if (p.status !== 0) {
      console.log(`  ${String(seed).padStart(4)}   ERROR ${String((p.stderr || p.stdout || '')).trim().slice(0, 90)}`);
      continue;
    }
    const r = JSON.parse(p.stdout.trim());
    console.log(`  ${String(seed).padStart(4)}   ${r.parado.toFixed(2).padStart(8)}   ${String(r.final.cavadas).padStart(6)}   ${String(r.final.entregas).padStart(8)}   ${String(r.final.comida).padStart(6)}   ${String(r.final.obreras).padStart(7)}`);
  }
  process.exit(0);
}

const seed = Number(args[0] || 1), dias = Number(args[1] || 3);
process.env.TEST_SEED = String(seed);
process.env.TEST_CLOCK = 'simulated';
const { sb, ctx, vm } = require('./world-perf-proflib.js');

const FOTO = `JSON.stringify({ dia:+(time/DAY_LENGTH+1).toFixed(2), obreras: workers.filter(w=>w.health>0).length,
  comida:+colonyFood.toFixed(1), entregas:deliveries, cavadas:digs, gen:gen,
  losas:umbralesRotos, hpLosa:umbral?+umbral.hp.toFixed(1):null,
  estados:workers.reduce((m,w)=>{m[w.state]=(m[w.state]||0)+1;return m;},{}),
  sinObjetivo:workers.filter(w=>!w.digTarget&&!w.food&&!w.targetFood).length, fuentes:foods.length,
  yMin:+Math.min(...workers.map(w=>w.y)).toFixed(1), yMax:+Math.max(...workers.map(w=>w.y)).toFixed(1),
  distObjetivo:+Math.min(...workers.filter(w=>w.targetFood).map(w=>dist(w,w.targetFood)),9999).toFixed(1) })`;

let t = 1;
sb.performance.now = () => t;
vm.runInContext(`topoCreateFreshWorld(48,28); paused=false; gameSpeed=64;
  last=performance.now(); lastRealWall=Date.now();
  window._step=()=>loop(performance.now()); window._foto=()=>${FOTO};`, ctx);
const paso = sb._step, foto = sb._foto;
const muestras = [];
let ultimoDig = JSON.parse(foto()).cavadas, ultimoCambio = 1;
for (let f = 0; f < Math.ceil(460 * dias); f++) {
  t += 42;
  paso();
  if (args.includes('--traza') && f % 5 === 0) {
    const tr = vm.runInContext(`(()=>{const w=workers.filter(x=>x.targetFood).sort((a,b)=>a.y-b.y)[0];if(!w||w.y>112)return null;return JSON.stringify({t:+(time/DAY_LENGTH).toFixed(3),id:w.id,x:+w.x.toFixed(1),y:+w.y.toFixed(1),ang:+w.angle.toFixed(2),vy:+(w.vy||0).toFixed(2),sube:!!w._quiereSubir,b:w.blocked,ruta:w._routeNext,obj:{x:+w.targetFood.x.toFixed(1),y:+w.targetFood.y.toFixed(1)}})})()`, ctx);
    if (tr) console.log('TRAZA ' + tr);
  }
  if (f % 115 === 114) {
    const m = JSON.parse(foto()); muestras.push(m);
    if (m.cavadas !== ultimoDig) { ultimoDig = m.cavadas; ultimoCambio = m.dia; }
  }
}
const final = muestras[muestras.length - 1];
// El bot etiqueta por día de calendario: «día 3» abarca 3,00..3,99. La foto decimal usa el mismo
// origen, así que el cierre de ese día es <4 (no <=3).
const hasta=d=>muestras.filter(m=>m.dia<d+1);
const r = {
  seed, parado:final?Math.max(0,final.dia-ultimoCambio):0, final, muestras,
  minComida5:Math.min(...hasta(5).map(m=>m.comida)),
  dia3:hasta(3).slice(-1)[0]||null,
  dia5:hasta(5).slice(-1)[0]||null,
  primeraGen:(muestras.find(m=>m.gen>=1)||{}).dia||null
};
if (args.includes('--resumen')) console.log(JSON.stringify({seed:r.seed,parado:r.parado,minComida5:r.minComida5,dia3:r.dia3,dia5:r.dia5,primeraGen:r.primeraGen,final:r.final}));
else {
  console.log(`semilla ${seed} · ${dias} dias · parado ${r.parado.toFixed(2)} dias`);
  for (const m of muestras) console.log(JSON.stringify(m));
  if (args.includes('--objetos')) {
    console.log('OBJETOS ' + vm.runInContext(`JSON.stringify({
      almacen:storagePos(), frontera:findFrontier().length, superficie:{fila:SURFACE_ROW,y:SURFACE_Y,centro:CENTER_COL},
      mapa:Array.from({length:Math.min(15,ROWS)},(_,i)=>{const r=Math.max(0,SURFACE_ROW-2)+i;return String(r).padStart(2,'0')+' '+(soil[r]||[]).slice(Math.max(0,CENTER_COL-8),CENTER_COL+9).map(v=>v?'#':'.').join('');}),
      obreras:workers.map(w=>({id:w.id,rol:w.role,afinidad:w.affinity,x:+w.x.toFixed(1),y:+w.y.toFixed(1),
        estado:w.state,bloqueo:w.blocked,objetivo:w.targetFood?{x:+w.targetFood.x.toFixed(1),y:+w.targetFood.y.toFixed(1)}:null,
        cava:w.digTarget,out:w.nnOut&&w.nnOut.map(n=>+n.toFixed(2)),pared:w.sensors&&+[w.sensors.wallLeft,w.sensors.wallCenter,w.sensors.wallRight].reduce((a,b)=>a+b,0).toFixed(2)})),
      comidas:foods.map(f=>({x:+f.x.toFixed(1),y:+f.y.toFixed(1),cantidad:f.amount})) })`, ctx));
  }
}
