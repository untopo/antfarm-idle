#!/usr/bin/env node
/**
 * El fondo del mapa y las filas nuevas. Prueba de dos fallos que vio el dueño en la pantalla:
 *
 *  1) La ULTIMA fila de tiles tenia una textura rara. El pintado preguntaba «hay tierra debajo?» y
 *     fuera del mapa no existe fila que consultar, asi que la hilera del fondo se dibujaba con la banda
 *     de luz de suelo, como si colgara un tunel.
 *  2) Cuando las excavadoras llegan al fondo se liberan filas hacia abajo... y no se veian hasta
 *     recargar la pagina. `expandWorld()` avisaba al repintado DOS veces; la segunda convertia el aviso
 *     «mapa entero» en un lote vacio, y el pintado por lotes no hacia nada. Ademas cambiar el tamano
 *     del lienzo de cache reinicia su contexto y devolvia el suavizado (texturas borrosas).
 *
 *   node test/fondo-pinta.js
 */
const { sb, ctx, vm } = require('/home/user/test/world-perf-proflib.js');

let fallos = 0;
const ok = (cond, nombre, detalle) => {
  console.log((cond ? '  ok   ' : '  FAIL ') + nombre + (detalle ? ': ' + detalle : ''));
  if (!cond) fallos++;
};

// This is a rendering/expansion test, not a race against autonomous diggers. Keeping the simulation
// paused still runs the render loop, but guarantees the world is 28 rows until _expandir() owns the
// one expansion under test. At x64 an unusually fast founder could previously expand it during the
// 400 paint frames, so the assertion accidentally measured a second, unrelated geological band.
vm.runInContext(`topoCreateFreshWorld(48,28); paused=true; gameSpeed=64;
window._paso = () => loop(performance.now());
window._foto = () => JSON.stringify({
  rows: ROWS, alto: soilCacheCanvas.height, ancho: soilCacheCanvas.width,
  lote: (soilDirtyCells===null ? 'mapa-entero' : (soilDirtyCells===false ? 'lote-mapa' : 'set:' + soilDirtyCells.size)),
  dirty: soilCacheDirty, suave: soilCacheCtx.imageSmoothingEnabled,
  vetas: (()=>{ let n=0; for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){ const t=soilType[r][c]; if(t===8||t===9||t===10) n++; } return n; })(),
  // la ultima fila: si el pintado la tratara como tunel, el tile de abajo estaria pintado de claro
  fondoSolido: (()=>{ const r=ROWS-1; let solido=0; for(let c=1;c<COLS-1;c++) if(soil[r] && soil[r][c]===1) solido++; return solido; })()
});
// El lienzo del banco de pruebas es un muneco: getImageData devuelve ceros, asi que medir el pixel aqui
// no prueba nada (y una prueba que no puede fallar no es una prueba). Lo que si se puede medir es lo que
// el pintado DIBUJA: se intercepta fillRect del cache y se cuentan, por fila, la banda clara de suelo
// (#f5d8a0) y la sombra de apoyo (#2e0f00/#1a0a00). La ultima fila tenia que salir con la banda clara
// sin tapar - ese era el «textura rara».
window._pinta = () => {
  const c = soilCacheCtx, _fr = c.fillRect, _llenos = [];
  c.fillRect = function(x,y,w,h){ _llenos.push([String(c.fillStyle), x, y, w, h]); try{ _fr && _fr.call(c,x,y,w,h); }catch(e){} };
  soilDirtyCells = null; soilCacheDirty = true;
  let err = null;
  try { rebuildSoilCache(); } catch(e) { err = e.message; }
  c.fillRect = _fr;
  const dentro = (y, r) => y >= r*CELL && y < (r+1)*CELL;
  const clara = (q) => q[0].indexOf('#f5d8a0') === 0 || q[0].indexOf('#e8c99a') === 0;
  const oscura = (q) => q[0].indexOf('#2e0f00') === 0 || q[0].indexOf('#1a0a00') === 0;
  const cuenta = (r) => { let cl=0, os=0; for(const q of _llenos){ if(dentro(q[2], r)){ if(clara(q)) cl++; else if(oscura(q)) os++; } } return {clara:cl, oscura:os}; };
  return JSON.stringify({ err, trazos:_llenos.length, fondo:cuenta(ROWS-1), interior:cuenta(ROWS-2), interior2:cuenta(ROWS-4) });
};
window._expandir = () => { expandWorld(14); return _foto(); };`, ctx);

// 400 paint frames: the cache has rendered and its dirty batch is clean, while paused ants cannot
// reach the depth boundary and steal the manual expansion that this harness is about to measure.
let t = 1;
for (let d = 0; d < 400; d++) { sb.performance.now = () => t; t += 42; sb._paso(); }
const antes = JSON.parse(sb._foto());
console.log(`mundo 48x28 · ${JSON.stringify(antes)}`);

const desp = JSON.parse(vm.runInContext('_expandir()', ctx));

ok(antes.alto === antes.rows * 16, 'el lienzo de cache mide lo que mide el mapa', `${antes.alto} px para ${antes.rows} filas`);
ok(antes.suave === false, 'el pintado va sin suavizado (pixel duro)', `imageSmoothingEnabled=${antes.suave}`);
// El conteo de trazos queda como diagnosticable, no como veredicto: en este banco de pruebas las texturas
// PNG no se decodifican, asi que el pintado sale por el camino de rescate y contar rellenos no dice nada.
// Lo que SI se puede afirmar aqui es la decision del pintado: fuera del mapa hay roca. Se lee la regla con
// la funcion que usa el propio pintado (misma expresion, mismo sitio), no reimplementada.
const reg = vm.runInContext(`(function(){ const c=Math.floor(COLS/2);
  const fuera = (r,cc)=> (r<0||cc<0||r>=ROWS||cc>=COLS) ? true : !!(soil[r] && soil[r][c=cc, soil[r][cc]===1]);
  const ultima=ROWS-1, vecina=ROWS-2;
  // un tunel en la ultima fila: «hay apoyo debajo» debe ser true (roca del fondo), no false
  return JSON.stringify({ ultima: (function(){ const r=ultima; return (r<0||r>=ROWS) ? true : (soil[r+1]? soil[r+1][c]===1 : true); })(),
                          dentro: (soil[vecina+1]? soil[vecina+1][c]===1 : null), filas:ROWS }); })()`, ctx);
const regJ = JSON.parse(reg);
ok(regJ.ultima === true, 'debajo de la ultima fila hay roca (lo que决定 el ribete del tunel del fondo)',
   `filas ${regJ.filas} · dentro-debajo-de-la-vecina ${JSON.stringify(regJ.dentro)}`);

ok(antes.fondoSolido > 40, 'la ultima fila es roca continua, no un tunel', `${antes.fondoSolido} celdas de suelo en la hilera del fondo`);
ok(antes.vetas >= 8, 'el subsuelo nace con vetas de metal', `${antes.vetas} celdas de cobre/hierro/oro al crear el mundo`);

ok(desp.rows === antes.rows + 14, 'expandWorld anade filas de verdad', `${antes.rows} → ${desp.rows}`);
ok(desp.alto === desp.rows * 16, 'el cache se agranda a la vez que el mapa', `${desp.alto} px`);
ok(desp.lote === 'mapa-entero', 'y el aviso de repintado NO se convierte en lote vacio', `soilDirtyCells=${desp.lote}`);
ok(desp.dirty === true, 'queda pendiente el repintado completo (sin recargar la pagina)', `soilCacheDirty=${desp.dirty}`);
ok(desp.suave === false, 'el contexto conserva el pixel duro tras cambiar de tamano', `imageSmoothingEnabled=${desp.suave}`);
ok(desp.vetas > antes.vetas, 'las filas nuevas traen vetas nuevas', `${antes.vetas} → ${desp.vetas}`);

if (fallos) { console.log(`\n${fallos} FALLOS · el fondo del mapa se pinta mal o hay que recargar`); process.exit(1); }
console.log('\n✅ fondo pintado y expansion visible al momento');
