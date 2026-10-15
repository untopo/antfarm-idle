/**
 * Los primeros dias: la colonia fundacional tiene que sola alimentarse, poner y CRIAR.
 *
 * Es la prueba de la queja "se mueren y nunca nace nadie, ni con las obreras vivas". Aqui no se
 * fuerza nada: se crea el mundo pequeno y se deja correr el bucle real (loop + tickStep) dos dias
 * y medio, mirando cuatro cosas que antes fallaban todas a la vez:
 *   - la miel llega a la despensa (sin entregas no hay puesta: la reina exige 3),
 *   - la despensa no se vacia (el coste de criar era por intento al azar, decenas de veces por
 *     frame, y se comia el granero entero en un dia),
 *   - la cria pasa por huevo -> larva -> pupa sin morir de hambre (en GEN0 nadie es NODRIZA y la
 *     regla vieja solo dejaba alimentar a las nodrizas),
 *   - y nace al menos una obrera nueva antes del dia 3.
 *
 *   node test/foundacion-dias.js [dias]
 */
const { sb, ctx, vm } = require('/home/user/test/world-perf-proflib.js');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ok   ' + msg); } else { fail++; console.log('  FAIL ' + msg); } };

const DIAS = Number(process.argv[2] || 2.5);
vm.runInContext(`topoCreateFreshWorld(48, 28); paused=false; gameSpeed=64;
  window._step = () => loop(performance.now());
  window._foto = () => JSON.stringify({
    dia: Math.floor(time/DAY_LENGTH)+1, ob: workers.length, deliveries, digs,
    food: colonyFood, huevos: brood.filter(b=>b.type==='egg').length,
    larvas: brood.filter(b=>b.type==='larva').length, pupas: brood.filter(b=>b.type==='pupa').length,
    etapas: brood.length, vidas: workers.filter(w=>w.health>0).length
  });`, ctx);

const paso = sb._step, foto = sb._foto;   // una sola compilacion: compilar cada frame se comia la memoria del lote
const alNacer = JSON.parse(foto());
let t = 1;
const FRAMES_POR_MEDIO_DIA = 230;
const historial = [];
for (let f = 0; f < Math.ceil(FRAMES_POR_MEDIO_DIA * DIAS * 2); f++) {
  sb.performance.now = () => t; t += 42;
  paso();
  if (f % FRAMES_POR_MEDIO_DIA === FRAMES_POR_MEDIO_DIA - 1) historial.push(JSON.parse(foto()));
}

console.log(`\nmundo pequeno 48x28 · ${DIAS} dias simulados · ${FRAMES_POR_MEDIO_DIA * 2} frames por dia`);
for (const h of historial) console.log(`   dia ${h.dia}: ${h.ob} obreras · cria ${h.huevos}h/${h.larvas}l/${h.pupas}p · entregas ${h.deliveries} · despensa ${Math.round(h.food * 10) / 10}`);

const ultimo = historial[historial.length - 1];
ok(alNacer.food >= 12, 'el mundo nace con provisiones de fundacion en la despensa (' + Math.round(alNacer.food) + ')');
ok(historial.every((h) => h.food >= 1), 'la despensa no se vacia del todo en los primeros dias (minimo ' + Math.round(Math.min(...historial.map((h) => h.food))) + ')');
ok(ultimo.deliveries >= 2, 'las obreras entregan miel a la despensa (' + ultimo.deliveries + ' entregas)');
const etapas = new Set(historial.flatMap((h) => [h.huevos && 'huevo', h.larvas && 'larva', h.pupas && 'pupa'].filter(Boolean)));
ok(etapas.has('huevo') && etapas.has('larva'), 'la cria recorre huevo y larva sin morir (etapas vistas: ' + [...etapas].join('+') + ')');
ok(ultimo.ob > alNacer.ob, 'nacen obreras nuevas solas: ' + alNacer.ob + ' -> ' + ultimo.ob + ' en ' + ultimo.dia + ' dias');
ok(ultimo.vidas === ultimo.ob, 'y las que nacen siguen vivas al final (' + ultimo.vidas + '/' + ultimo.ob + ')');
// Y el tuneo tiene que seguir excavando: si la hambruna de la despensa manda a TODAS a por miel,
// no cava nadie, no hay camaras nuevas y el tope de poblacion se clava.
ok(ultimo.digs > alNacer.digs, 'y mientras comen, siguen cavando: ' + (ultimo.digs - alNacer.digs) + ' bloques abiertos en ' + ultimo.dia + ' dias');

console.log('\n' + pass + ' ok' + (fail ? ' · ' + fail + ' FALLOS' : ' · la colonia arranca sola'));
process.exit(fail ? 1 : 0);
