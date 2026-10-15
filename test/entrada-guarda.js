/**
 * La boca del nido: estrecha, en el sitio elegido, y nada crece en el aire.
 *
 * Queja del dueño (captura): las hormigas abrian un crater arriba que las dejaba expuestas y al
 * lado de la entrada salian plantas y hongos flotando. Dos reglas lo cortan y esta prueba las
 * mide con el bucle real corriendo dos dias:
 *   - la fila del cesped solo cede en la columna de la entrada y sus vecinas (3 columnas),
 *   - una planta sin suelo debajo, o un hongo sin techo, no puede existir.
 *
 *   node test/entrada-guarda.js
 */
const { sb, ctx, vm } = require('/home/user/test/world-perf-proflib.js');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ok   ' + msg); } else { fail++; console.log('  FAIL ' + msg); } };

vm.runInContext(`topoCreateFreshWorld(48, 28); paused=false; gameSpeed=64;
  window._step = () => loop(performance.now());
  window._foto = () => JSON.stringify({
    dia: Math.floor(time/DAY_LENGTH)+1,
    boca: (()=>{ const v=[]; for(let c=0;c<COLS;c++) if(soil[SURFACE_ROW][c]===0) v.push(c); return v; })(),
    entrada: entradaCol,
    plantasAire: plants.filter(p=>!p.cave && soil[SURFACE_ROW][p.c]!==1).length,
    hongosAire: plants.filter(p=>p.cave && p.rr!==undefined && (!soil[p.rr-1] || soil[p.rr-1][p.cr]===0)).length,
    hongos: plants.filter(p=>p.cave).length, plantas: plants.length,
    ob: workers.length
  });
  // el caso que rompia la pagina real: galeria cavada JUSTO bajo la capa de raices en ocho columnas
  // lejos de la entrada. Antes la gravedad se llevaba el cesped dentro del tunel y al dia siguiente
  // el nido tenia crater. Aqui se llama a updateFallingSand 60 veces y se mide la fila de cesped.
  window._derrumbe = () => {
    for(let c=CENTER_COL+4;c<CENTER_COL+12;c++){ soil[SURFACE_ROW+1][c]=0; if(soilType[SURFACE_ROW+1]) soilType[SURFACE_ROW+1][c]=0; }
    for(let i=0;i<60;i++) updateFallingSand(16);
    markSoilDirty();
    const v=[]; for(let c=0;c<COLS;c++) if(soil[SURFACE_ROW][c]===0) v.push(c);
    return v;
  };`, ctx);

const step = sb._step;
let t = 1;
let foto = null;
for (let f = 0; f < 230 * 2 * 2; f++) { sb.performance.now = () => t; t += 42; step(); if (f % 230 === 229) foto = JSON.parse(sb._foto()); }

// las cuatro comprobaciones del predicado, sin simulacion de por medio
const reglas = JSON.parse(vm.runInContext(`JSON.stringify({
  fuera: puedeAbrirSuperficie(CENTER_COL+9, SURFACE_ROW),
  dentro: puedeAbrirSuperficie(CENTER_COL, SURFACE_ROW),
  abajo: puedeAbrirSuperficie(CENTER_COL+9, SURFACE_ROW+4),
  detras: puedeAbrirSuperficie(CENTER_COL, SURFACE_ROW-1)
})`, ctx));

console.log('  dos dias de bucle real:', JSON.stringify(foto));
ok(foto.boca.length <= 3, `la boca mide ${foto.boca.length} columnas (tope 3) despues de dos dias de excavacion`);
ok(foto.boca.every(c => Math.abs(c - foto.entrada) <= 1), `la boca sigue centrada en la columna elegida (${foto.entrada}): ${foto.boca.join(',')}`);
ok(foto.plantasAire === 0, `ninguna planta cuelga sobre un hueco (${foto.plantas} plantas, 0 colgando)`);
ok(foto.hongosAire === 0, `ningun hongo crece sin techo (${foto.hongos} hongos de cueva)`);
ok(reglas.fuera === false, 'una calada a 9 columnas de la entrada NO abre el cesped');
ok(reglas.dentro === true, 'en la columna de la entrada, el cesped si cede');
ok(reglas.abajo === true, 'bajo el cesped se puede cavar libremente');
ok(reglas.detras === false, 'el aire sobre el cesped no es excavable');
ok(foto.ob >= 4, `y las obreras siguen aqui: ${foto.ob}`);

const bocaTrasDerrumbe = JSON.parse(vm.runInContext('JSON.stringify(window._derrumbe())', ctx));
ok(bocaTrasDerrumbe.length <= 3, `abiendo galeria bajo las raices en 8 columnas, la capa de cesped NO se desploma: boca sigue en ${bocaTrasDerrumbe.length} (${bocaTrasDerrumbe.join(',')})`);

console.log('\n' + pass + ' ok' + (fail ? ' · ' + fail + ' FALLOS' : ' · la entrada respeta el sitio elegido'));
process.exit(fail ? 1 : 0);
