/**
 * Cría (huevos → larvas → pupas → nace).
 *
 * Caza el fallo que dejaba la granja con el contador de hormigas en 0 para siempre: si la colonia
 * se quedaba sin reinas, el nacimiento buscaba `queens[0].x` para colocar a la recién nacida y
 * reventaba con "Cannot read properties of undefined". La cría seguía viéndose crecer (los
 * medidores suben antes del calculate) pero nunca salía una hormiga.
 *
 * No reimplementa nada: ejecuta el app.js real en un DOM de juguete y llama a updateBrood().
 */
const { ctx, vm } = require('/home/user/test/world-perf-proflib.js');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ok   ' + msg); } else { fail++; console.log('  FAIL ' + msg); } };

vm.runInContext('paused=true; gameSpeed=1; const _dt = 900;', ctx);

// utilidades dentro del contexto del juego
const setup = (src) => vm.runInContext(`
  function _nido(){ return {x:queens.length?queens[0].x:CENTER_COL*CELL, y:queens.length?queens[0].y:(SURFACE_ROW+8)*CELL}; }
  function _limpiar(){ brood.length=0; }
  function _pupa(mas){ brood.length=0; brood.push(Object.assign({type:'pupa',progress:99.4,time:0,genome:makeGenome(),isQueen:false,faction:0,parents:['-','-'],parentGenomes:['-','-']},_nido(),mas||{})); }
  function _zumbido(n){ return (()=>{ try{ for(let i=0;i<n;i++) updateBrood(900); return null; }catch(e){ return (e.constructor&&e.constructor.name)+': '+e.message; } })(); }
`, ctx);

function caso(nombre, fn) {
  try {
    const r = vm.runInContext('(' + fn.toString() + ')()', ctx);
    ok(r.pasa, nombre + (r.detalle ? ' (' + r.detalle + ')' : ''));
  } catch (e) {
    ok(false, nombre + ' — el propio test peto: ' + e.message);
  }
}

console.log('\n=== test/brood-hatch.js ===');

// Un mundo real, con reina fundadora y sus obreras.
vm.runInContext('topoCreateFreshWorld(48, 28); paused=true;', ctx);
setup();

const arranca = vm.runInContext('({reinas:queens.length, obreras:workers.length})', ctx);
ok(arranca.reinas === 1 && arranca.obreras > 0, 'mundo de prueba con reina y obreras (' + arranca.obreras + ' obreras)');

// 1 · camino feliz: con reina viva la pupa nace obrera.
caso('con reina, la pupa eclosiona y nace una obrera', () => {
  const antes = workers.length;
  _pupa();
  const err = _zumbido(6);
  const despues = workers.length;
  return { pasa: !err && despues === antes + 1 && brood.length === 0, detalle: 'obreras ' + antes + '->' + despues + (err ? ', error: ' + err : '') };
});

// 2 · EL BUG: colonia exterminada (sin reinas y sin obreras), queda cría -> tiene que nacer.
caso('sin ninguna hormiga viva, la pupa igual nace (colonia exterminada)', () => {
  const reinas = queens.splice(0, queens.length);
  const obreras = workers.splice(0, workers.length);
  _pupa();
  const err = _zumbido(6);
  const nacidas = workers.length;
  const out = { pasa: !err && nacidas === 1, detalle: 'nacen ' + nacidas + (err ? ', error: ' + err : '') };
  Array.prototype.push.apply(queens, reinas); Array.prototype.push.apply(workers, obreras);
  return out;
});

// 3 · sin reina, la nodriza hambrienta tampoco revienta: la larva busca el ancla del enjambre.
caso('larva sin coordenadas y sin reina: no rompe y sigue su ritmo', () => {
  const reinas = queens.splice(0, queens.length);
  const w = workers[0]; if (w) { w.role = 'NODRIZA'; w.crop = 0.6; }
  brood.length = 0;
  brood.push({ type: 'larva', progress: 10, time: 0, genome: makeGenome(), isQueen: false, faction: 0, hunger: 0, parents: ['-','-'], parentGenomes: ['-','-'] });
  const err = _zumbido(6);
  const b = brood[0];
  const out = { pasa: !err && !!b && b.progress > 10, detalle: 'progreso ' + (b ? Math.round(b.progress * 10) / 10 : 'perdido') + ' (la nodriza la alimenta)' + (err ? ', error: ' + err : '') };
  Array.prototype.push.apply(queens, reinas);
  return out;
});

// 4 · pupa real sin reina: nace una reina que refunda la dinastia.
caso('pupa real sin reina: nace una reina y la colonia sigue', () => {
  const reinas = queens.splice(0, queens.length);
  _pupa({ isQueen: true });
  const err = _zumbido(6);
  const nuevas = queens.length;
  const out = { pasa: !err && nuevas === 1 && !!queens[0] && !!queens[0].name, detalle: 'reinas ' + nuevas + (queens[0] && queens[0].name ? ', ' + queens[0].name : '') + (err ? ', error: ' + err : '') };
  if (!err && nuevas >= 1) { /* la nueva reina se queda: ya no hace falta restaurar */ }
  else Array.prototype.push.apply(queens, reinas);
  return out;
});

// 5 · el tope de poblacion sigue mandando, pero no puede borrar un nacimiento prometido. La pupa
// madura espera y ocupa la primera plaza que deja una obrera vieja: esto cierra la extincion SMALL.
caso('con la colonia en su tope, la pupa espera y nace al liberarse una plaza', () => {
  const plantas = plants.splice(0, plants.length);
  const hongos = fungusGardens.splice(0, fungusGardens.length);
  const edad = worldAge; worldAge = 0;
  const tope = getMaxPopulation();
  while (workers.length < tope) workers.push(Object.assign({}, workers[0]));
  _pupa();
  const err1 = _zumbido(6);
  const espera = !err1 && brood.length === 1 && brood[0].type === 'pupa' && brood[0].progress >= 100 && workers.length === tope;
  workers.pop();
  const err2 = _zumbido(1);
  const nace = !err2 && brood.length === 0 && workers.length === tope;
  const out = {
    pasa: espera && nace,
    detalle: 'tope ' + tope + ' · espera madura ' + espera + ' · nace al quedar plaza ' + nace + ((err1||err2) ? ', error: ' + (err1||err2) : '')
  };
  Array.prototype.push.apply(plants, plantas); Array.prototype.push.apply(fungusGardens, hongos); worldAge = edad;
  return out;
});

// 6 · los huevos de emergencia nacen dentro del nido (con x/y), no flotando sin posicion.
caso('la puesta de emergencia deja los huevos dentro del nido', () => {
  // dejar el mundo como al principio: una colonia con tope disponible
  const reinas0 = queens[0] || (queens[0] = freshFounder({ x: CENTER_COL * CELL, y: (SURFACE_ROW + 8) * CELL, genome: makeGenome(), progress: 0, state: 'GRÁVIDA', age: 0, maxAge: DAY_LENGTH * 15, generation: 0, faction: 0, health: 100, eggsLaid: 0, broodTended: 0, children: [], history: [], parents: [] }));
  ensureQueenMeta(reinas0);
  while (workers.length > 1) workers.pop();
  const q = queens[0];
  brood.length = 0;
  q.emergencyProgress = DAY_LENGTH * 0.20 - 1;
  q.health = 100;
  paused = false; gameSpeed = 1;
  for (let i = 0; i < 6; i++) loop(performance.now());
  paused = true;
  const huevos = brood.filter(b => b.type === 'egg');
  const conPos = huevos.filter(b => isFinite(b.x) && isFinite(b.y)).length;
  return { pasa: huevos.length > 0 && conPos === huevos.length, detalle: 'huevos ' + huevos.length + ', con posicion ' + conPos };
});


// 7 · FUNDACION: en GEN0 nadie es NODRIZA (los roles llegan con la jerarquia, gen>=2 e IQ>=112).
// Con la regla vieja la primera camada entera moria de hambre y la colonia no podia nacerse.
caso('sin ninguna nodriza, la reina alimenta a sus larvas y la cria avanza', () => {
  while (workers.length > 0) workers.pop();
  colonyFood = 40; queens[0].health = 100;
  brood.length = 0;
  brood.push({ type: 'larva', progress: 0, time: 0, genome: makeGenome(), isQueen: false, faction: 0, hunger: 0, x: queens[0].x, y: queens[0].y, parents: ['-','-'], parentGenomes: ['-','-'] });
  const err = _zumbido(60);
  const b = brood[0];
  return { pasa: !err && !!b && b.progress > 6 && b.hunger < 6, detalle: 'progreso ' + Math.round(b.progress * 10) / 10 + ', hambre ' + Math.round(b.hunger) + ' (cria sola)' + (err ? ', error: ' + err : '') };
});

// 8 · Cualquier obrera con buche regurgita: no hace falta que se llame NODRIZA.
caso('una obrera cualquiera con el buche lleno alimenta la larva', () => {
  brood.length = 0;
  const w = workers[0] || makeAnt(makeGenome(), { x: queens[0].x, y: queens[0].y }, {});
  if (!workers.includes(w)) workers.push(w);
  w.role = 'EXPLORADORA'; w.crop = 0.9; w.x = queens[0].x; w.y = queens[0].y;
  brood.push({ type: 'larva', progress: 0, time: 0, genome: makeGenome(), isQueen: false, faction: 0, hunger: 40, x: queens[0].x + 6, y: queens[0].y + 4, parents: ['-','-'], parentGenomes: ['-','-'] });
  const err = _zumbido(40);
  const b = brood[0];
  // Ojo: si va rapida pasa de larva a pupa y el progreso se reinicia -> se comprueba la etapa.
  const crece = !!b && (b.type !== 'larva' || b.progress > 4);
  const out = { pasa: !err && crece && b.hunger < 10, detalle: (b ? b.type + ' al ' + Math.round(b.progress) + '%' : 'perdida') + ', hambre ' + (b ? Math.round(b.hunger) : '-') + ' sin roles especiales' };
  w.crop = 0.9;
  return out;
});

// 9 · El coste de criar NO puede ser por intento aleatorio: el bucle llama a esto decenas de
// veces por frame y vaciaba la despensa en un dia (la colonia se mataba por alimentarse).
caso(' alimentar a una larva entera desde la despensa cuesta piezas, no el granero', () => {
  const reinas = queens.splice(0, queens.length);
  const obreras = workers.splice(0, workers.length);
  colonyFood = 50;
  brood.length = 0;
  const b = { type: 'larva', progress: 0, time: 0, genome: makeGenome(), isQueen: false, faction: 0, hunger: 0, parents: ['-','-'], parentGenomes: ['-','-'] };
  brood.push(b);
  let llamadas = 0;
  while (b.type === 'larva' && b.progress < 100 && llamadas < 40000) { updateBrood(2); llamadas++; }
  const gastado = Math.round((50 - colonyFood) * 100) / 100;
  const out = { pasa: b.progress >= 100 || b.type !== 'larva', detalle: 'larva criada y pasada a ' + b.type + ' gastando ' + gastado + ' de despensa en ' + llamadas + ' pasos' };
  Array.prototype.push.apply(queens, reinas); Array.prototype.push.apply(workers, obreras);
  return out;
});

// 10 · El contador de OBRERAS no puede inventarse una: con la colonia a cero y reina viva tiene que marcar
// 0 en los DOS sitios que existen ahora - la barra de arriba y la taskbar (antes titilaba 0/1). Y desde
// 2026-10-16 hay que comprobar además que el TERCER sitio ya no está: el dueño pidió quitar la cifra que
// repetía debajo del reloj («esa información ya está en la barra de arriba... la de abajo sobra»), así que
// el numero vive en un solo sitio de la pantalla y ahi se pincha para ver la lista.
caso('el contador de obreras marca 0 en los dos sitios que quedan, el del reloj ya no existe, y vuelve al valor real', () => {
  const perdidas = workers.splice(0, workers.length);
  _updateBothAntCounts();
  const leido = ['velAntCount', 'tbPop'].map((i) => String(document.getElementById(i).textContent)).join('/');
  const okCero = leido === '0/0';
  // (que el sitio del reloj DESAPARECIO de verdad se comprueba en test/hojas-legibles.js, sobre el markup y
  // sobre el codigo servido: aqui el arnes de jsdom inventa un elemento para cualquier id que se le pida,
  // asi que «getElementById» no puede usarse como prueba de que algo existe.)
  const puerta = !!document.getElementById('btnRoster');
  Array.prototype.push.apply(workers, perdidas);
  _updateBothAntCounts();
  const deVuelta = String(document.getElementById('velAntCount').textContent);
  return { pasa: okCero && puerta && deVuelta === String(workers.length), detalle: 'con 0 obreras: ' + leido + ' · de vuelta ' + deVuelta + '/' + workers.length + ' · la cifra es boton: ' + puerta };
});

console.log('\n' + pass + ' ok' + (fail ? ' · ' + fail + ' FALLOS' : ' · cria a punto'));
process.exit(fail ? 1 : 0);
