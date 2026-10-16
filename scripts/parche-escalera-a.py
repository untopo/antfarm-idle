#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Parche A: LA ESCALERA - bandas de profundidad, durezas, vetas raras por banda, el UMBRAL (losa que
cierra la escalera y se rompe a mordiscos entre todas), reliquias con vitrina y peligro de magma.
Se apoya en lo que ya habia: soilType/_VOX/frontier de excavacion/expandWorld/hiddenRewards/regla."""
import io, sys, re

RUTA = 'ant-farm-rpg/js/app.js'
src = io.open(RUTA, encoding='utf-8').read()
hechas = []

def rep(clave, old, new):
    global src
    n = src.count(old)
    if n != 1:
        sys.exit('FALLO [%s]: el trozo viejo aparece %d veces (queria 1)' % (clave, n))
    src = src.replace(old, new, 1)
    hechas.append(clave)

def rep_re(clave, pat, new):
    global src
    m = re.search(pat, src, re.S)
    if not m:
        sys.exit('FALLO [%s]: no encontro el patron' % clave)
    src = src[:m.start()] + new + src[m.end():]
    hechas.append(clave)

# ---------------------------------------------------------------- 0. materiales nuevos
rep('worldMaterials',
    "let worldMaterials={stone:0, clay:0, sand:0, fiber:0, wood:0};",
    "let worldMaterials={stone:0, clay:0, sand:0, fiber:0, wood:0, cobre:0, hierro:0, oro:0, cuarzo:0, gema:0, obsidiana:0, meteorito:0};")

# ---------------------------------------------------------------- 1. la escalera, a nivel de modulo
ESCALERA = r"""// ===== LA ESCALERA =====
// Topo pidio que cavar hacia abajo valga la pena: cada capa mas dura, cada capa con su material, y un
// limite que se ROMPE y destapa la siguiente. Las referencias que hay detras:
//   - Terraria  los minerales van por piso (cobre arriba, hierro por el medio, oro mas abajo, y lo ultimo
//               del mundo en el pozo del infierno). La idea que copia esto: la profundidad ES el requisito,
//               no un numero de generacion. Nadie te regala el oro, llegas o no llegas.
//   - SteamWorld Dig  bajar cuesta (aqui: fatiga y dureza) y cada capa tiene su color, para saber donde
//               estas sin leer numeros.
//   - Motherload y Deep Rock Galactic  hondo hay riesgo ademas de premio: el magma de la ultima banda no
//               se cava, se sufre.
//   - Core Keeper / Aground / Dwarf Fortress  las cuevas vacias ya son un premio (sitio donde respirar) y
//               una ruina contada en bloques vale mas que una cutscene.
// Ocho bandas, una losa al final de cada una, y reliquias que se quedan en la vitrina de la colonia.
const BANDAS=[
  {n:'RAÍCES',         desde:0,  tipo:1,  dureza:0,   veta:null, pinta:'piedras',      color:'#8a5a2b'},
  {n:'BARRO',          desde:3,  tipo:2,  dureza:4,   veta:null, pinta:'mantas',       color:'#b0673f'},
  {n:'ARENA MOVEDIZA', desde:8,  tipo:3,  dureza:-4,  veta:null, pinta:'granos',       color:'#d3b473'},
  {n:'PIEDRA',         desde:14, tipo:4,  dureza:9,   veta:8,    pinta:'grieta',       color:'#8d8d8d'},
  {n:'PIZARRA',        desde:22, tipo:6,  dureza:14,  veta:9,    pinta:'grietaLarga',  color:'#6b7a8a'},
  {n:'CUARCITA',       desde:30, tipo:11, dureza:18,  veta:10,   pinta:'veta',         color:'#c9c2d8'},
  {n:'MÁRMOL NEGRO',   desde:38, tipo:12, dureza:23,  veta:16,   pinta:'veta',         color:'#4a4552'},
  {n:'OBSIDIANA',      desde:46, tipo:13, dureza:29,  veta:16,   pinta:'brillo',       color:'#241f2e'},
  {n:'BASALTO ÍGNEO',  desde:55, tipo:14, dureza:34,  veta:10,   pinta:'grietaLarga',  color:'#4a2a20'},
];
const PISOS_BANDA=8;                     // grosor de banda que se abre de golpe (la losa se come uno)
const VETA_P=[0,0,0,0.052,0.040,0.032,0.026,0.022,0.018];   // mas hondo = mas escaso
// Tipos que no son banda: 5 piedra suelta, 7 roca madre, 8 cobre, 9 hierro, 10 oro, 15 MAGMA (no se
// cava), 16 veta de gemas, 17 LA LOSA DEL UMBRAL, 18 sal de roca.
const DUREZA_EXTRA={5:6, 7:38, 8:15, 9:20, 10:26, 15:999, 16:22, 17:999, 18:12};
function bandaDe(piso){ let b=0; for(let i=0;i<BANDAS.length;i++) if(piso>=BANDAS[i].desde) b=i; return b; }
function tipoDePiso(piso){ return BANDAS[bandaDe(piso)].tipo; }
function durezaDe(t){
  for(let i=0;i<BANDAS.length;i++) if(BANDAS[i].tipo===t) return BANDAS[i].dureza;
  return DUREZA_EXTRA[t]||0;
}
const NOMBRE_BANDA=(b)=>BANDAS[Math.max(0,Math.min(BANDAS.length-1,b|0))].n;
const COLOR_BANDA=(b)=>BANDAS[Math.max(0,Math.min(BANDAS.length-1,b|0))].color;
function vetaDeBanda(b){ return BANDAS[Math.max(0,Math.min(BANDAS.length-1,b))].veta; }

// ---- TESOROS DE LA ESCALERA ----
// Antes este cuadro vivia DENTRO de initSoil y checkRewardDiscovery lo leia desde fuera con un
// `typeof TREASURE_DEFS!=='undefined'` que mentia: def salia null y ningun tesoro de tier>=2 hacia nada
// al descubrirse (ni fibra, ni ambar, ni nada). Subirlo a nivel de modulo arregla eso y permite que cada
// banda tenga lo suyo. `reliquia:` = se queda para siempre en la VITRINA y da un bonus pequeno y visible.
const TREASURE_DEFS = {
  // banda 0-1 (raices y barro): lo de siempre, comida y material de relleno
  semillas:   {food:10, mat:null,      w:22, color:'#ffcc00', msg:'¡SEMILLAS! +10 comida', tier:1},
  agua:       {food:0,  mat:null, fatigue:30, w:20, color:'#00e5ff', msg:'¡AGUA! fatiga restaurada', tier:1},
  hongo:      {food:6,  mat:null,      w:18, color:'#2de67a', msg:'¡HONGO! +6 comida', tier:1},
  // banda 2-3 (arena y piedra): materiales de obra y las primeras cuevas
  fibra:      {food:2,  mat:'fiber',   matAmt:2, w:14, color:'#c9b896', msg:'¡FIBRA! +2 fibra', tier:2},
  piedra:     {food:0,  mat:'stone',   matAmt:2, w:12, color:'#8a8a8a', msg:'¡PIEDRA! +2 piedra', tier:2},
  arcilla:    {food:0,  mat:'clay',    matAmt:1, w:10, color:'#a08060', msg:'¡ARCILLA! +1 arcilla', tier:2},
  hongoCueva: {food:8,  mat:null,      w:8,  color:'#6b3a1f', msg:'¡HONGO CUEVA! +8 comida', tier:2},
  anfora:     {food:26, mat:null,      w:5,  color:'#ffb700', msg:'¡ÁNFORA DE MIEL! +26 comida', tier:2},
  // banda 4-5 (pizarra y cuarcita): aqui empiezan las cosas asombrosas
  fosil:      {food:0,  mat:null, xp:120, w:5, color:'#e8dcc0', tier:3, reliquia:'Fósil de hormiga león',
               lore:'Una trampa de arena de hace mil dias: el cono tallado y la victima dentro.', bonus:0.02},
  geoda:      {food:0,  mat:'cuarzo', matAmt:3, xp:90, w:5, color:'#c8a6ff', tier:4, reliquia:'Geoda de cuarzo',
               lore:'Dieciseis caras de cristal en un puno de tierra. Alumbran el tunel si las dejas sueltas.', bonus:0.02},
  ambar:      {food:0,  mat:null, xp:80, w:6, color:'#ffb700', tier:3, reliquia:'Ámbar con una hormiga dentro',
               lore:'Se ve la pata levantada, como si fuera a empezar a correr. Lleva aqui muchisimo tiempo.', bonus:0.02},
  semillaRara:{food:14, mat:'fiber', matAmt:1, w:7, color:'#b47aff', msg:'¡SEMILLA RARA! +14 comida', tier:3},
  // banda 6-7 (marmol y obsidiana): luz, sal y vidrio negro
  lente:      {food:0,  mat:null, xp:150, w:4, color:'#7ad3ff', tier:5, reliquia:'Lente de cristal de roca',
               lore:'Algo la tall y lo pulio. No hay nadie aqui para contarlo.', bonus:0.03},
  sal:        {food:0,  mat:'cuarzo', matAmt:2, w:6, color:'#e9f2fb', msg:'¡SAL DE ROCA! +2 cuarzo', tier:6},
  hongoLinterna:{food:10, mat:null, xp:130, w:4, color:'#2de67a', tier:6, reliquia:'Hongo linterna',
               lore:'Aguanta encendido tres dias bajo tierra. Donde lo plantas, la colonia trabaja mas rato.', bonus:0.03},
  lagrima:    {food:0,  mat:'obsidiana', matAmt:2, xp:180, w:3, color:'#9a6bff', tier:7, reliquia:'Lágrima de obsidiana',
               lore:'Vidrio negro, frio, con una gota congelada a media bajada. Cava mas rapido quien la tiene.', bonus:0.04},
  // banda 8 (basalto igneo): lo que no deberia estar ahi abajo
  corazon:    {food:20, mat:null, xp:300, w:2, color:'#ff3b30', tier:8, reliquia:'Corazón de colina',
               lore:'Late una vez cada cuatro segundos. La camara de la reina lo escucha.', bonus:0.05},
  meteorito:  {food:0,  mat:'meteorito', matAmt:1, xp:220, w:2, color:'#ff8c00', tier:9, reliquia:'Meteorito hundido',
               lore:'No es de aqui. La roca tiene la corteza de quemarse entrando y aun esta caliente.', bonus:0.05},
  nidoAntiguo:{food:0,  mat:'obsidiana', matAmt:1, xp:260, w:2, color:'#c9b896', tier:9, reliquia:'Nido de la colonia vieja',
               lore:'Camaras pequenas, huevos vacios, y un tunel ciego que no lleva a ninguna parte. Se fue como se van todas.', bonus:0.03},
};
// El sorteo: la banda manda (pool por tier) y la prog de la colonia solo pesa, no bloquea. Antes un
// pool vacio hacia que `type` saliera undefined y se sembraran 200 cofres vacios: el suelo de reserva
// se queda por eso.
function pickTreasureType(depthTier){
  const tier = Math.max(1, Math.min(9, depthTier|0));
  const prog = (typeof gen!=='undefined'?gen:0) + (typeof colonyIQ!=='undefined'? colonyIQ-100:0)/40;
  let pool;
  if(tier===1)      pool=['semillas','agua','hongo'];
  else if(tier===2) pool=['semillas','hongo','fibra','anfora','piedra'];
  else if(tier===3) pool=['fibra','arcilla','hongoCueva','fosil','piedra'];
  else if(tier===4) pool=['piedra','arcilla','geoda','hongoCueva','fibra'];
  else if(tier===5) pool=['geoda','ambar','arcilla','semillaRara','piedra'];
  else if(tier===6) pool=['lente','geoda','sal','ambar'];
  else if(tier===7) pool=['hongoLinterna','lagrima','sal','lente'];
  else if(tier===8) pool=['lagrima','corazon','hongoLinterna','lente'];
  else              pool=['meteorito','corazon','nidoAntiguo','lagrima'];
  if(prog<2) pool=pool.filter(t=> (TREASURE_DEFS[t].tier||1)<4);
  if(prog<1) pool=pool.filter(t=> (TREASURE_DEFS[t].tier||1)<3);
  if(!pool.length) pool=['semillas','agua','hongo','fibra'];
  const weights = pool.map(t=>{
    let w=TREASURE_DEFS[t].w||1;
    if((TREASURE_DEFS[t].tier||1) > tier) w*=0.55;      // que se cuele algo mejor de lo que toca, pocas veces
    return w;
  });
  const tot=weights.reduce((a,b)=>a+b,0);
  let r=Math.random()*tot; for(let i=0;i<pool.length;i++){ r-=weights[i]; if(r<=0) return pool[i]; }
  return pool[0];
}

// ---- EL UMBRAL: la losa que cierra la escalera ----
// No es un muro invisible ni un «ya no hay filas»: es una fila de roca con PUNTOS DE VIDA de la colonia
// entera. Cada excavadora que llega le arranca una astilla; cuando cede, el mundo crece una banda y la
// losa se convierte en el primer piso de esa banda. Se ve desde el mapa: los bichos se apiñan abajo.
let umbral=null;              // {r,c0,c1,hp,hpMax,banda}
let bandaMax=0;               // banda mas honda que el mapa cubre hoy
let umbralesRotos=0;          // losas reventadas: lo que se lee en el panel
let reliquias=[];             // {tipo,nombre,piso,dia,gen,lore,bonus}
let bonusCava=0;              // +velocidad de excavacion por reliquia (0.02-0.05 cada una, tope 0.30)
let magmaCells=[];            // indice del magma: la kamera solo mira esto, no el mapa entero
const UMBRAL_HP=(b)=> 16 + b*13;
function reindexMagma(){
  magmaCells=[];
  if(!Array.isArray(soilType)) return;
  for(let r=ROWS-1;r>SURFACE_ROW;r--){
    const row=soilType[r]; if(!row) continue;
    for(let c=0;c<COLS;c++) if(row[c]===15) magmaCells.push({r,c,x:c*CELL,y:r*CELL});
  }
}
function colocarUmbral(){
  if(!Array.isArray(soil) || soil.length<8) return;
  const r=ROWS-1;
  if(r<=SURFACE_ROW+4) return;
  for(let c=0;c<COLS;c++){
    if(soil[r]) soil[r][c]=1;
    if(soilType[r]) soilType[r][c]=17;
  }
  const b=bandaDe(r-SURFACE_ROW);
  umbral={r, c0:2, c1:COLS-3, hp:UMBRAL_HP(b), hpMax:UMBRAL_HP(b), banda:b};
  bandaMax=Math.max(bandaMax, b);
  markSoilDirty();
  tlog('[UMBRAL] losa en fila '+r+' · banda '+b+' ('+NOMBRE_BANDA(b)+') · hp '+umbral.hp);
}
function puedeGolpearUmbral(){
  if(!umbral) return false;
  if(workers.length<3) return false;
  if(umbral.banda>=5 && !inventions.masonry) return false;   // del marmol en adelante hace falta canteria
  return true;
}
function golpearUmbral(ant){
  const u=umbral; if(!u) return false;
  const exc = (ant && ant.role==='EXCAVADORA')? 0.55 : 0;
  const golpe = 1 + exc + (inventions.masonry?0.6:0) + Math.min(1.4, (typeof gen!=='undefined'?gen:0)*0.07)
              + Math.max(0,((typeof colonyIQ!=='undefined'?colonyIQ:100)-100))/200 + bonusCava;
  u.hp = Math.max(0, u.hp - golpe);
  const c = (ant && Number.isFinite(ant.x))? Math.floor(ant.x/CELL) : u.c0;
  try{
    for(let i=0;i<4;i++) particles.push({x:c*CELL+6, y:u.r*CELL+8, vx:(Math.random()-0.5)*2.4, vy:-Math.random()*1.8, life:1, decay:0.035, color:'#c8c8d8', bloque:true});
    if(ant && Math.random()<0.35) pushToast(c*CELL+8, u.r*CELL-4, '⛏', '#c8c8d8', 0.8);
    markSoilDirty(c, u.r);
    if(ant) logAntHistory(ant, 'muerde la losa ('+Math.round(u.hp)+' por aguantar)');
  }catch(e){}
  if(u.hp<=0){ abrirUmbral(); return true; }
  return false;
}
function abrirUmbral(){
  const u=umbral; if(!u) return false;
  const nuevo=Math.min(BANDAS.length-1, u.banda+1);
  umbral=null;
  for(let c=0;c<COLS;c++){                                  // la losa se disuelve: primer piso de la banda
    if(soil[u.r]) soil[u.r][c]=1;
    if(soilType[u.r]) soilType[u.r][c]=tipoDePiso(u.r-SURFACE_ROW);
  }
  const suelo=SURFACE_ROW + BANDAS[nuevo].desde + PISOS_BANDA;
  const add=Math.max(6, suelo-(ROWS-1));
  try{ expandWorld(add); }catch(e){ console.warn('expandWorld tras umbral', e); }
  bandaMax=Math.max(bandaMax, nuevo); umbralesRotos++;
  stats.xp += 90 + 30*nuevo; colonyFitness += 2.2;
  markSoilDirty(); reindexMagma();
  pushEvent('evo', '🕳️ UMBRAL ROTO · '+NOMBRE_BANDA(nuevo), 'el mapa llega a '+ROWS+' filas - '+reliquias.length+' reliquias en la vitrina');
  notifyCanon('🕳️ ¡NUEVA PROFUNDIDAD!', NOMBRE_BANDA(nuevo)+' - la colonia huele piedra mojada y algo mas duro', 6400);
  pushImportant('invention', '🕳️ SE ABRIÓ '+NOMBRE_BANDA(nuevo), 'la losa de la fila '+u.r+' cedio · piso '+(suelo-SURFACE_ROW)+' disponible');
  tlog('[UMBRAL] roto en fila '+u.r+' · banda '+nuevo+' ('+NOMBRE_BANDA(nuevo)+') · ROWS='+ROWS);
  return true;
}
function anotarReliquia(def, c, r){
  if(!def || !def.reliquia) return false;
  if(reliquias.some(x=>x.tipo===def.reliquia)) return false;      // cada maravilla, una sola vez
  reliquias.push({tipo:def.reliquia, nombre:def.reliquia, piso:r-SURFACE_ROW, dia:Math.floor(day||0),
                  gen:(typeof gen!=='undefined'?gen:0), lore:def.lore||'', bonus:def.bonus||0.02});
  bonusCava = Math.min(0.30, reliquias.reduce((a,x)=>a+(x.bonus||0),0));
  return true;
}

"""
rep('escalera', "function initSoil(){", ESCALERA + "function initSoil(){")

# ---------------------------------------------------------------- 2. cuadro viejo, fuera (regex: dentro de initSoil)
rep_re('tesoros-viejos-fuera',
    r"  // === TESOROS INTELIGENTES.*?\n    return pool\[0\];\n  \}\n",
    "  // Los tesoros y su sorteo subieron a nivel de modulo (TESOROS DE LA ESCALERA, arriba), porque\n"
    "  // checkRewardDiscovery los leia desde fuera y no los veia.\n")

# ---------------------------------------------------------------- 3. tesoro: tier por banda
rep('spawn-smart',
    """  function spawnSmartTreasure(c,r,forcedType){
    if(!isValidTreasurePos(c,r)) return null;
    const depth=r-SURFACE_ROW;
    const tier = depth<10?0 : depth<20?1 : 2;
    const type=forcedType||pickTreasureType(tier);""",
    """  function spawnSmartTreasure(c,r,forcedType){
    if(!isValidTreasurePos(c,r)) return null;
    const depth=r-SURFACE_ROW;
    const tier = 1+bandaDe(depth);                 // el suelo manda: la banda ES el requisito
    const type=forcedType||pickTreasureType(tier);""")

# ---------------------------------------------------------------- 4. estratos por banda + fuego + losa
rep('estratos',
    """    if(r<SURFACE_ROW) return 0;
    const depth=r-SURFACE_ROW;
    // progresivo strata: cuanto más profundo, más duro (pickaxe power)
    if(depth<3) return 1; // 1 topsoil fértil - pico cobre, 1 hit
    if(depth<8) return 2; // 2 arcilla - 2 hits, necesita excavadora
    if(depth<14) return 3; // 3 arena clara - 1 hit pero GRAVEDAD: cae si sin apoyo (arena inestable)
    if(depth<22) return 4; // 4 piedra - 3 hits, necesita IQ/tools
    if(depth<30) return 4; // 4 piedra profunda - 4 hits
    if(depth<38) return 6; // 6 pizarra - 5 hits, requiere piedra+arcilla tools
    return 7; // 7 bedrock - casi irrompible (solo GEN10+IQ150+masonry)
  }));""",
    """    if(r<SURFACE_ROW) return 0;
    // La Escalera: el tipo sale de la banda (BANDAS arriba). Raices, barro, arena movediza, piedra,
    // pizarra, cuarcita, marmol negro, obsidiana y basalto igneo. Mas hondo = mas duro y mas raro.
    return tipoDePiso(r-SURFACE_ROW);
  }));
  // Vetas: cada banda escupe su metal dentro de su franja y nada mas arriba ni nada mas abajo, con la
  // probabilidad cayendo a medida que baja (VETA_P). Que un filon de oro sea raro es lo que lo hace oro.
  for(let r=SURFACE_ROW+1; r<ROWS-1; r++){
    const _b=bandaDe(r-SURFACE_ROW), _vb=vetaDeBanda(_b);
    if(_vb===null) continue;
    const _vt=BANDAS[_b].tipo, _p=VETA_P[_b]||0.03;
    for(let c=1;c<COLS-1;c++){
      if(soilType[r][c]!==_vt) continue;
      if(Math.random()>_p) continue;
      soilType[r][c]=_vb;
      for(let k=0;k<1+Math.floor(Math.random()*3);k++){        // nido de 2-4: una celda suelta no se ve
        const rr=r+Math.floor(Math.random()*2), cc2=c+Math.floor(Math.random()*3)-1;
        if(rr>ROWS-2||cc2<1||cc2>=COLS-1) continue;
        if(soilType[rr][cc2]===_vt || soilType[rr][cc2]===BANDAS[_b].tipo) soilType[rr][cc2]=_vb;
      }
    }
  }
  // Y el fuego: en la ultima banda el magma asoma entre el basalto. No se cava, calienta y gasta fatiga.
  const _FUEGO=BANDAS.length-1;
  for(let r=SURFACE_ROW+BANDAS[_FUEGO].desde; r<ROWS-1; r++){
    for(let c=1;c<COLS-1;c++){
      if(soilType[r][c]!==BANDAS[_FUEGO].tipo) continue;
      if(Math.random()>0.055) continue;
      soilType[r][c]=15;
      for(let k=0;k<2;k++){ const cc2=c+(Math.random()<0.5?-1:1); if(cc2>0&&cc2<COLS-1&&soilType[r][cc2]===14&&Math.random()<0.6) soilType[r][cc2]=15; }
    }
  }
  reindexMagma();
  colocarUmbral();""")

# ---------------------------------------------------------------- 5. viejo bucle de yacimientos, fuera
rep_re('vetas-viejas-fuera',
    r"  // YACIMIENTOS\. El subsuelo no puede ser solo tierra.*?\n  \}\n(?=  const cc=CENTER_COL)",
    "  // (antes los metales se sembraban aqui con umbrales de piso a mano; ahora la pasada por bandas de\n"
    "  //  arriba, con VETA_P, deja el cobre en PIEDRA, el hierro en PIZARRA y el oro en CUARCITA)\n")

# ---------------------------------------------------------------- 6. excavadoras: dureza, losa, sesgo hacia abajo
rep('dureza-cavar',
    """          const _type=soilType[pick.r]&&soilType[pick.r][pick.c]; const _hard = _type===7? 38 : _type===10? 26 : _type===9? 20 : _type===8? 15 : _type===6? 14 : _type===4? 9 : _type===2? 4 : _type===3? -4 : 0; // Terraria: bedrock 38, pizarra 14, piedra 9, arcilla 4, arena -4 (blanda pero cae)""",
    """          const _type=soilType[pick.r]&&soilType[pick.r][pick.c]; const _hard = durezaDe(_type); // la tabla vive en BANDAS/DUREZA_EXTRA: bedrock 38, magma 999, y cada banda lo suyo""")

rep('digNeeded-losa',
    """          ant.digNeeded= (_type===7 && (gen<8 || colonyIQ<148 || !inventions.masonry))? 999 : Math.max(9, Math.floor((26 - bonus + _hard)*hardMult)); ant.state='CAVANDO';""",
    """          // La LOSA (17) no se cava: se muerde. digNeeded corto a proposito, para que la obrera vuelva
          // una y otra vez al mismo sitio y el umbral baje entre todas - que es lo que da la sensacion de
          // haza colectiva, no de un numero que sube solo. Magma (15) y roca madre (7) siguen cerrados.
          ant.digNeeded= _type===17 ? Math.max(5, 11 - Math.min(6,gen*0.5))
                       : (_type===15 || (_type===7 && (gen<8 || colonyIQ<148 || !inventions.masonry)))? 999
                       : Math.max(9, Math.floor((26 - bonus + _hard)*hardMult)/(1+bonusCava)); ant.state='CAVANDO';""")

rep('needPower',
    """          const needPower = (_type===4? 1.2 : _type===8? 1.9 : _type===9? 2.6 : _type===10? 3.0 : _type===6? 2.2 : _type===7? 3.5 : 0);""",
    """          const _np={4:1.2, 6:2.2, 8:1.9, 9:2.6, 10:3.0, 7:3.5, 11:2.8, 12:3.2, 13:3.6, 14:3.9, 16:3.1, 18:2.0};
          const needPower = _np[_type]||0;""")

# sesgo: con dos frentes igual de cerca, la hormiga elige el bajo. Y un tercio de las excavadoras,
# si la losa esta abierta a golpes, va a la losa.
rep('sesgo-abajo',
    """            const _d=Math.hypot((_f.c+0.5)*CELL-ant.x,(_f.r+0.5)*CELL-ant.y);
            if(_d<90){ if(!_cands) _cands=[]; _cands.push(_f); }
            else if(_d<_bestD){ _bestD=_d; _far=_f; }
          }
          const pick=_cands&&_cands.length ? _cands[(Math.random()*_cands.length)|0] : (_far || frontier[(Math.random()*_fn)|0]);""",
    """            const _d=Math.hypot((_f.c+0.5)*CELL-ant.x,(_f.r+0.5)*CELL-ant.y) - (_f.r-SURFACE_ROW)*1.35;   // EL POZO TIRA: a igualdad de pasos, gana el frente mas hondo
            if(_d<90){ if(!_cands) _cands=[]; _cands.push(_f); }
            else if(_d<_bestD){ _bestD=_d; _far=_f; }
          }
          let pick=_cands&&_cands.length ? _cands[(Math.random()*_cands.length)|0] : (_far || frontier[(Math.random()*_fn)|0]);
          // Las obras del umbral: si la losa esta a tiro y la colonia ya puede morderla, parte de las
          // excavadoras dejan el frente y van a ella. Sin esto el avance depende de que el azar ponga
          // una hormiga encima de la losa, y eso no es una decision de la colonia, es una ruleta.
          if(umbral && puedeGolpearUmbral() && (ant.role==='EXCAVADORA'||ant.traits.construccion>52) && Math.random()<0.42){
            const _c=Math.max(umbral.c0, Math.min(umbral.c1, Math.round(ant.x/CELL)));
            if(soil[umbral.r] && soil[umbral.r][_c]===1 && soilType[umbral.r] && soilType[umbral.r][_c]===17){
              if(soil[umbral.r-1] && soil[umbral.r-1][_c]===0) pick={r:umbral.r, c:_c};   // hay hueco donde pararse
            }
          }""")

# ---------------------------------------------------------------- 7. morder la losa al acabar el golpe
rep('morder-losa',
    """        } if(_mt===7 && (gen<8 || !inventions.masonry)){ ant.digTarget=null; ant.digProgress=0; ant.state='EXPLORAR'; pushToast(ant.x,ant.y-10,'⛔ BEDROCK','#555'); return; }""",
    """        } if(_mt===17){                                  // la losa: el bloque NO se quita, se agrieta
          ant.digTarget=null; ant.digProgress=0; ant.food=null; ant.state='CAVANDO';
          golpearUmbral(ant);
          return;
        } if(_mt===15){                                   // el magma no se cava: achicharra y ya esta
          ant.digTarget=null; ant.digProgress=0; ant.state='VOLVER_TIERRA'; ant.fatigue=Math.min(100,ant.fatigue+9);
          pushToast(ant.x,ant.y-10,'🔥 QUEMA','#ff6a1e'); return;
        } if(_mt===7 && (gen<8 || !inventions.masonry)){ ant.digTarget=null; ant.digProgress=0; ant.state='EXPLORAR'; pushToast(ant.x,ant.y-10,'⛔ BEDROCK','#555'); return; }""")

# ---------------------------------------------------------------- 8. no romper la losa desde otras rutas
rep('unstick-losa',
    """        if(soilType[r] && soilType[r][c]===7) continue;                // la roca madre no se cava""",
    """        if(soilType[r] && (soilType[r][c]===7 || soilType[r][c]===15 || soilType[r][c]===17)) continue;   // roca madre, fuego y LOSA: no son una salida de atasco""")
rep('abrir-pared-losa',
    """        if(!soil[r] || soil[r][c]!==1) continue;              // solo tierra suelta, no roca ni vacio
        if(soilType[r] && soilType[r][c]===7) continue;        // bedrock no se cava""",
    """        if(soil[r][c]!==1) continue;                              // solo tierra suelta, no roca ni vacio
        if(soilType[r] && (soilType[r][c]===7 || soilType[r][c]===15 || soilType[r][c]===17)) continue;   // bedrock, magma y la losa no se cavan para abrir paso""")
rep('camara-losa',
    """      const t=soilType[nr][nc];
      if(t===7 && gen<7) continue;""",
    """      const t=soilType[nr][nc];
      if(t===7 && gen<7) continue;
      if(t===15 || t===17) continue;              // el fuego y la losa no se allanan: hay que ganarselos""")

io.open(RUTA,'w',encoding='utf-8').write(src)
print('parche A aplicado (%d trozos): %s' % (len(hechas), ' · '.join(hechas)))
