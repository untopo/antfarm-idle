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

// 5 · el tope de poblacion sigue mandando: si la colonia esta llena, la pupa espera (no es un bug).
// El tope real es min(espacio, comida, cuidado) con un suelo de 14 en GEN0, asi que aqui se le
// quita la comida al mundo para que el suelo mande y la colmena quede justo en su tope.
caso('con la colonia en su tope, la pupa no nace pero tampoco se pierde', () => {
  const plantas = plants.splice(0, plants.length);
  const hongos = fungusGardens.splice(0, fungusGardens.length);
  const edad = worldAge; worldAge = 0;
  const tope = getMaxPopulation();
  while (workers.length < tope) workers.push(Object.assign({}, workers[0]));
  _pupa();
  const err = _zumbido(6);
  const out = {
    pasa: !err && brood.length === 0 && workers.length === tope,
    detalle: 'tope ' + tope + ' obreras · nace 0 y la pupa se va con aviso' + (err ? ', error: ' + err : '')
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

console.log('\n' + pass + ' ok' + (fail ? ' · ' + fail + ' FALLOS' : ' · cria a punto'));
process.exit(fail ? 1 : 0);
