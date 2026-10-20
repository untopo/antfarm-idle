#!/usr/bin/env node
/**
 * Quien sale al prado. El dueño dijo: «las hormigas tienen que ser aventureras; solo se quedan abajo cuando
 * hay un monton de recursos al aire libre que no agarran, o no saben como subir». Eran las dos cosas, y no
 * era caracter:
 *
 *  1) EL PRADO ERA UN BALCON DE 56 PX. `isSolidPixel` declaraba muro todo lo que estuviera mas de 28 px a
 *     la izquierda o derecha del pozo: una gota de miel a 40 px de la boca era LITERALMENTE inalcanzable, y
 *     salir se reducia a asomarse. Ahora arriba del cesped solo hay techo a 34 px de la raya (para que no
 *     suban volando a la nada) y el prado entero se pisa - la x ya la sujeta el fisico, no se pierden.
 *  2) ENCAJADAS SIN QUE NADIE LO SUPIERA. Todas las ramas de movimiento ponian `blocked=0` con cada paso que
 *     la hormiga pudiera dar, asi que una que rebota contra una pared (un pasito lateral siempre lo da) nunca
 *     sumaba golpes y ninguna cura de atasco disparaba: medido AW14 4.430 pasos dando vueltas en la misma
 *     celda y AH9R 2.200 en (443,473) con blk 0. El atasco se mide ahora por DESPLAZAMIENTO NETO (6 px en 40
 *     ticks con objetivo; 8 px en 120 si va paseando), que no se puede engañar, y el rescate cava la pared
 *     que le estorba en vez de reiniciar la excavacion que ya tenia entre manos.
 *  3) TREPAR A CIEGAS. En el pozo, «subo o bajo» se decidia por el angulo con el que habia llegado a la
 *     pared; en la ida no llevaba carga ni digTarget, asi que media veces trepaba hacia el nido. Manda el
 *     destino. Y el punto intermedio ya no se abandona a media altura: para cruzar la raya hay que pasar por
 *     la boca, y se cruza solo cuando se esta de verdad al otro lado (antes habia una franja de 30 px donde
 *     la hormiga cambiaba de opinion cada tick y rebote que te crias: 176-251-189-251 px de la miel).
 *  4) SIN MOTIVO NO SALEN. Con 197 raciones en el almacen y 19 gotas de miel en el cesped la unica regla que
 *     mandaba subir era el hambre (`enSuperficie 0 de 27`). Sube la que tiene ganas: rasgo EXPL alto u oficio
 *     EXPLORADORA, con cupo de una de cada cuatro para no dejar el nido vacio.
 *
 * La parte de comportamiento se mide a x64, que es el regimen mas brusco del juego (el paso de la hormiga
 * alli vale cuatro celdas por tick) y donde una colonia esta en una navaja: dos corridas de la misma semilla
 * difieren en decenas de obreras. Por eso lo que se AFIRMA aqui es lo geometrico, que no depende de la
 * suerte; lo conductual se reporta para poder seguirlo de cerca.
 *
 *   node test/aventureras.js
 */
const { sb, ctx, vm } = require('/home/user/test/world-perf-proflib.js');

let fallos = 0;
const ok = (cond, nombre, detalle) => {
  console.log((cond ? '  ok   ' : '  FAIL ') + nombre + (detalle ? ': ' + detalle : ''));
  if (!cond) fallos++;
};

vm.runInContext(`
window._arribaTicks = 0; window._ticks = 0;
// 'salir' medido como TIEMPO-HORMIGA por encima del cesped: una excursion dura menos que una muestra cada
// 46 ticks, y mirar de vez en cuando daba 0 aunque la hormiga estuviera arriba (y viceversa).
window._paso = () => { loop(performance.now()); window._ticks++;
  for(const w of workers){ if(w.y < SURFACE_Y) window._arribaTicks++; } };
// a) geometria: cuantas posiciones del cesped se pueden pisar
window._prado = () => {
  let libre=0, total=0, peorBoca=null;
  const y = SURFACE_Y - 6;
  for(let x=24; x<=W-24; x+=CELL){
    total++;
    if(canMove(x,y)) libre++;
  }
  return JSON.stringify({libre:libre, total:total, ancho:W, y:y});
};
// b) una gota puesta lejos del pozo: la puede alcanzar la que la persigue?
window._gota = () => {
  const x = Math.min(W-30, CENTER_COL*CELL + CELL*9), y = SURFACE_Y - 8;
  spawnFoodSurface(x, y, 'honey');
  const f = foods[foods.length-1];
  return JSON.stringify({ x:Math.round(f.x), y:Math.round(f.y), pisable:canMove(f.x, SURFACE_Y-6),
    lejosDelPozo:Math.round(Math.abs(f.x-(CENTER_COL*CELL+8))) });
};
window._foto = () => {
  let fuera=0, maxBlk=0, obj=0, worst=null; const over={};
  for(const w of workers){
    if(w.y < SURFACE_Y) { fuera++; }
    if((w.blocked||0) > maxBlk){ maxBlk=w.blocked||0; worst=w; }
    if((w.blocked||0)>60) over[w.state]=(over[w.state]||0)+1;
    if(w.targetFood) obj++;
  }
  const wd=worst?{id:worst.id,state:worst.state,x:Math.round(worst.x),y:Math.round(worst.y),
    water:Math.round(waterAtPixel(worst.x,worst.y)*100)/100,target:!!worst.targetFood,food:!!worst.food,
    dig:!!worst.digTarget,project:!!worst.projectCargo}:null;
  return JSON.stringify({ dia:Math.floor(time/DAY_LENGTH)+1, ob:workers.length, fuera:fuera, obj:obj,
    maxBlk:Math.round(maxBlk), worst:wd, over, miel:foods.length, desp:Math.round(colonyFood*10)/10, atascos:antsAtascados });
};
`, ctx);

// la geometria necesita un mundo ya excavado: se crea con la semilla 1 y ahi se mide
vm.runInContext(`
  (function(s){ let a=s>>>0; Math.random=function(){ a=(a+0x6D2B79F5)>>>0; let t=a; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; }; })(1);
  topoCreateFreshWorld(48,28); paused=true;
`, ctx);
const geo = JSON.parse(sb._prado());
ok(geo.libre / geo.total >= 0.9, 'el prado se pisa de lado a lado',
  `${geo.libre} de ${geo.total} posiciones libres (antes: 28 px alrededor del pozo)`);
const gota = JSON.parse(sb._gota());
ok(gota.pisable, 'una gota caida lejos del pozo es alcanzable',
  `a ${gota.lejosDelPozo} px del agujero, en (${gota.x},${gota.y})`);

const DIAS = Math.max(1, Number(process.env.AVENTURERAS_DIAS || 6)), TICKS_DIA = 460, MUESTRA = 46;
const SEMILLAS = String(process.env.AVENTURERAS_SEEDS || '1,2,3').split(',').map(Number).filter(Number.isFinite);
const fueraDias = [];
const shareDias = [];
for (const semilla of SEMILLAS) {
  vm.runInContext(`
    (function(s){ let a=s>>>0; Math.random=function(){ a=(a+0x6D2B79F5)>>>0; let t=a; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; }; })(${semilla});
    topoCreateFreshWorld(48,28); paused=false; gameSpeed=64; antsAtascados=0;
  `, ctx);
  let t = 1;
  const diasFuera = new Set();
  vm.runInContext('window._arribaTicks=0; window._ticks=0;', ctx);
  let peor = 0, peorDetalle = null, muestras = 0, rescates = 0, ult = null;
  for (let k = 0; k < DIAS * TICKS_DIA; k++) {
    sb.performance.now = () => t; t += 42; sb._paso();
    if (k % MUESTRA !== MUESTRA - 1) continue;
    const f = JSON.parse(sb._foto());
    muestras++; ult = f;
    if (f.fuera > 0) diasFuera.add(f.dia);
    if(f.maxBlk>peor){peor=f.maxBlk;peorDetalle={...f.worst,over:f.over,dia:f.dia};}
  }
  // antsAtascados is a cumulative count of rescue digs, not a live queue or a blocked-duration metric.
  // Keep it labelled as cumulative so a large healthy-colony total is never mistaken for one trapped ant.
  rescates = ult ? ult.atascos : 0;
  const comp = JSON.parse(vm.runInContext('JSON.stringify({a:window._arribaTicks, t:window._ticks})', ctx));
  const share = comp.t ? comp.a / comp.t : 0;
  const semillaShare = share;
  fueraDias.push(diasFuera.size);
  shareDias.push(semillaShare);
  console.log(`  semilla ${semilla}: ${(semillaShare*100).toFixed(2)}% del tiempo-hormiga arriba del cesped · ${diasFuera.size}/${DIAS} dias con alguien arriba · peor racha de golpes ${peor} · `
    + `rescates acumulados ${rescates} · dia ${ult ? ult.dia : '?'}: ${ult ? ult.ob : 0} obreras, ${ult ? ult.desp : 0} raciones, `
    + `${ult ? ult.miel : 0} gotas en el mapa`);
  if(peorDetalle)console.log('    diagnóstico peor racha: '+JSON.stringify(peorDetalle));
  ok(peor < 500, `semilla ${semilla}: ninguna pasa el dia encajada`, 'peor racha ' + peor);
}
const totalFuera = fueraDias.reduce((a, b) => a + b, 0);
const peorShare = Math.max(...shareDias);
ok(peorShare > 0, 'alguien pisa el cesped (antes era 0,00% siempre)',
  `max ${(peorShare*100).toFixed(2)}% · media ${(shareDias.reduce((a,b)=>a+b,0)/shareDias.length*100).toFixed(2)}% del tiempo-hormiga · ${totalFuera} dias con alguien arriba`);

console.log(fallos ? `\n${fallos} FALLOS` : '\ntodo en orden');
process.exit(fallos ? 1 : 0);
