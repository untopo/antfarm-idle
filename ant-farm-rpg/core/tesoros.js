// core/tesoros.js — tesoros y reliquias de la escalera, como datos y una funcion pura de sorteo.
// Sin DOM. Se carga en el navegador (globales) y se prueba en Node (module.exports).
// `pickTreasure(tier, prog, rng)` recibe el progreso de la colonia y el azar de fuera: asi se puede probar.
'use strict';
const TREASURE_DEFS = {
  // banda 0-1 (raices y barro): lo de siempre, comida y material de relleno
  semillas:   {food:10, mat:null,      w:22, color:'#ffcc00', msg:'SEEDS! +10 food', tier:1},
  agua:       {food:0,  mat:null, fatigue:30, w:20, color:'#00e5ff', msg:'WATER! fatigue restored', tier:1},
  hongo:      {food:6,  mat:null,      w:18, color:'#2de67a', msg:'MUSHROOM! +6 food', tier:1},
  // banda 2-3 (arena y piedra): materiales de obra y las primeras cuevas
  fibra:      {food:2,  mat:'fiber',   matAmt:2, w:14, color:'#c9b896', msg:'FIBER! +2 fiber', tier:2},
  piedra:     {food:0,  mat:'stone',   matAmt:2, w:12, color:'#8a8a8a', msg:'STONE! +2 stone', tier:2},
  arcilla:    {food:0,  mat:'clay',    matAmt:1, w:10, color:'#a08060', msg:'CLAY! +1 clay', tier:2},
  hongoCueva: {food:8,  mat:null,      w:8,  color:'#6b3a1f', msg:'CAVE MUSHROOM! +8 food', tier:2},
  anfora:     {food:26, mat:null,      w:5,  color:'#ffb700', msg:'HONEY JAR! +26 food', tier:2},
  // banda 4-5 (pizarra y cuarcita): aqui empiezan las cosas asombrosas
  fosil:      {food:0,  mat:null, xp:120, w:5, color:'#e8dcc0', tier:3, msg:'FOSSIL! antlion and ant in compacted sand', reliquia:'Antlion Fossil',
               lore:'A conical depression in compacted sand; an antlion and one ant remain mineralized at its base.', bonus:0.02},
  geoda:      {food:0,  mat:'cuarzo', matAmt:3, xp:90, w:5, color:'#c8a6ff', tier:4, msg:'GEODE! +3 quartz', reliquia:'Quartz Geode',
               lore:'Sixteen crystal faces in a fistful of earth. Loose faces scatter the tunnel light.', bonus:0.02},
  ambar:      {food:0,  mat:null, xp:80, w:6, color:'#ffb700', tier:3, msg:'AMBER! +80 XP', reliquia:'Amber with an Ant Inside',
               lore:'One raised leg, folded antennae and two air bubbles remain visible inside the amber.', bonus:0.02},
  semillaRara:{food:14, mat:'fiber', matAmt:1, w:7, color:'#b47aff', msg:'RARE SEED! +14 food', tier:3},
  // banda 6-7 (marmol y obsidiana): luz, sal y vidrio negro
  lente:      {food:0,  mat:null, xp:150, w:4, color:'#7ad3ff', tier:5, msg:'FACETED CRYSTAL! one face catches the light', reliquia:'Rock-Crystal Lens',
               lore:'One face is smoother than a natural fracture and crossed by shallow parallel scratches.', bonus:0.03},
  sal:        {food:0,  mat:'cuarzo', matAmt:2, w:6, color:'#e9f2fb', msg:'ROCK SALT! +2 quartz', tier:6},
  hongoLinterna:{food:10, mat:null, xp:130, w:4, color:'#2de67a', tier:6, msg:'LANTERN MUSHROOM! +10 food and light', reliquia:'Lantern Mushroom',
               lore:'It stays lit for three days underground. Where you plant it, the colony works longer.', bonus:0.03},
  lagrima:    {food:0,  mat:'obsidiana', matAmt:2, xp:180, w:3, color:'#9a6bff', tier:7, msg:'OBSIDIAN TEAR! +2 black glass', reliquia:'Obsidian Tear',
               lore:'Black glass, cold, with a frozen drop halfway down. Whoever holds it digs faster.', bonus:0.04},
  // banda 8 (basalto igneo): lo que no deberia estar ahi abajo
  corazon:    {food:20, mat:null, xp:300, w:2, color:'#ff3b30', tier:8, msg:'HEART OF THE HILL! beating under the sand', reliquia:'Heart of the Hill',
               lore:'It beats once every four seconds. The queen\'s chamber hears it.', bonus:0.05},
  meteorito:  {food:0,  mat:'meteorito', matAmt:1, xp:220, w:2, color:'#ff8c00', tier:9, msg:'PITTED METAL! still warm', reliquia:'Sunken Meteorite',
               lore:'A dense pitted mass with a glassy black skin. The surrounding basalt is scorched and still warm.', bonus:0.05},
  nidoAntiguo:{food:0,  mat:'obsidiana', matAmt:1, xp:260, w:2, color:'#c9b896', tier:9, msg:'WORKED FRAGMENTS! fitted clay and black glass', reliquia:'Worked Chamber Fragment',
               lore:'Three fitted clay faces, soot along one edge, and shallow parallel scoring. One channel ends blindly.', bonus:0.03},
};
// El sorteo: la banda manda (pool por tier) y la prog de la colonia solo pesa, no bloquea. Antes un
// pool vacio hacia que `type` saliera undefined y se sembraran 200 cofres vacios: el suelo de reserva
// se queda por eso.
function pickTreasure(depthTier, prog, rng){
  const tier = Math.max(1, Math.min(9, depthTier|0));
  const azar = rng || Math.random;
  let pool;
  if(tier===1)      pool=['semillas','agua','hongo'];
  else if(tier===2) pool=['semillas','hongo','fibra','anfora','piedra'];
  else if(tier===3) pool=['fibra','arcilla','hongoCueva','fosil','piedra'];
  else if(tier===4) pool=['piedra','arcilla','geoda','hongoCueva','fibra'];
  else if(tier===5) pool=['geoda','ambar','arcilla','semillaRara','piedra'];
  else if(tier===6) pool=['lente','geoda','sal','ambar'];
  else if(tier===7) pool=['hongoLinterna','lagrima','sal','lente'];
  else if(tier===8) pool=['lagrima','corazon','hongoLinterna','lente'];
  else              pool=['meteorito','corazon','sal','lagrima'];
  if(prog<2) pool=pool.filter(t=> (TREASURE_DEFS[t].tier||1)<4);
  if(prog<1) pool=pool.filter(t=> (TREASURE_DEFS[t].tier||1)<3);
  if(!pool.length) pool=['semillas','agua','hongo','fibra'];
  const weights = pool.map(t=>{
    let w=TREASURE_DEFS[t].w||1;
    if((TREASURE_DEFS[t].tier||1) > tier) w*=0.55;      // que se cuele algo mejor de lo que toca, pocas veces
    return w;
  });
  const tot=weights.reduce((a,b)=>a+b,0);
  let r=azar()*tot; for(let i=0;i<pool.length;i++){ r-=weights[i]; if(r<=0) return pool[i]; }
  return pool[0];
}

// Nombres de reliquia que ya estan guardados en partidas antiguas (en español). Al cargar se traducen.
const LEGADO_RELIQUIA = {
  'Fósil de hormiga león':'Antlion Fossil', 'Geoda de cuarzo':'Quartz Geode', 'Ámbar con una hormiga dentro':'Amber with an Ant Inside',
  'Lente de cristal de roca':'Rock-Crystal Lens', 'Hongo linterna':'Lantern Mushroom', 'Lágrima de obsidiana':'Obsidian Tear',
  'Corazón de colina':'Heart of the Hill', 'Meteorito hundido':'Sunken Meteorite', 'Nido de la colonia vieja':'Worked Chamber Fragment',
};

if(typeof module!=='undefined' && module.exports){
  module.exports={TREASURE_DEFS,pickTreasure,LEGADO_RELIQUIA};
}
