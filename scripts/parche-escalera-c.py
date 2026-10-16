#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Parche C: la semantica de la losa (que banda guarda, no en que fila esta), mensajes de las reliquias
y huecos de prueba mas completos. Sale del test de profundidad, que encontro esto: la losa del mapa
pequeno estaba en el fondo de PIEDRA y el codigo llamaba 'banda' a ese numero, asi que abrir una losa
declaraba dos bandas abiertas y el panel decia el nombre equivocado."""
import io, sys

RUTA = 'ant-farm-rpg/js/app.js'
src = io.open(RUTA, encoding='utf-8').read()
hechas = []

def rep(clave, old, new):
    global src
    n = src.count(old)
    if n != 1:
        sys.exit('FALLO [%s]: aparece %d veces (queria 1)' % (clave, n))
    src = src.replace(old, new, 1)
    hechas.append(clave)

# a) colocarUmbral: guarda la banda siguiente; no mueve bandaMax (eso lo decide abrirUmbral)
rep('colocar',
    """  const b=bandaDe(r-SURFACE_ROW);
  umbral={r, c0:2, c1:COLS-3, hp:UMBRAL_HP(b), hpMax:UMBRAL_HP(b), banda:b};
  bandaMax=Math.max(bandaMax, b);
  markSoilDirty();
  tlog('[UMBRAL] losa en fila '+r+' · banda '+b+' ('+NOMBRE_BANDA(b)+') · hp '+umbral.hp);""",
    """  const b=bandaDe(r-SURFACE_ROW);
  // IMPORTANTE: la losa puede estar clavada en medio de una banda (en el mapa pequeno el ultimo piso
  // es PIEDRA y la losa es PIEDRA). Lo que interesa para el juego es lo que HAY DETRAS, asi que la
  // losa lleva los dos numeros: `banda` donde esta y `guarda` la que se abre al romperla.
  const guarda=Math.min(BANDAS.length-1, bandaDe(r+1-SURFACE_ROW));
  umbral={r, c0:2, c1:COLS-3, hp:UMBRAL_HP(guarda), hpMax:UMBRAL_HP(guarda), banda:b, guarda:guarda};
  bandaMax=Math.max(bandaMax, bandaDe(Math.max(SURFACE_ROW+1, ROWS-2)-SURFACE_ROW));
  markSoilDirty();
  tlog('[UMBRAL] losa en fila '+r+' ('+NOMBRE_BANDA(b)+') guarda '+NOMBRE_BANDA(guarda)+' · hp '+umbral.hp);""")

rep('hp-umbral',
    """  if(umbral.banda>=5 && !inventions.masonry) return false;   // del marmol en adelante hace falta canteria""",
    """  if(umbral.guarda>=5 && !inventions.masonry) return false;  // del marmol en adelante hace falta canteria""")

# b) abrirUmbral: la banda que se abre es la del piso siguiente al de la losa
rep('abrir',
    """  const nuevo=Math.min(BANDAS.length-1, u.banda+1);""",
    """  const nuevo=Math.min(BANDAS.length-1, bandaDe(u.r - SURFACE_ROW + 1));   // lo que hay DETRAS de la losa""")
rep('abrir-sumar',
    """  bandaMax=Math.max(bandaMax, nuevo); umbralesRotos++;""",
    """  bandaMax=Math.max(bandaMax, Math.min(nuevo, bandaDe(Math.max(SURFACE_ROW+1, ROWS-2)-SURFACE_ROW))); umbralesRotos++;""")

# c) el panel dice el nombre de la banda que hay detras
rep('panel-nombre',
    """          _uEl.innerHTML=`<b style="color:#c8c8d8">🕳️ LOSA · ${NOMBRE_BANDA(umbral.banda+1)}</b> · mordida ${_p}%`+""",
    """          _uEl.innerHTML=`<b style="color:#c8c8d8">🕳️ LOSA · ${NOMBRE_BANDA(umbral.guarda)}</b> · mordida ${_p}%`+""")
rep('panel-requisito',
    """(puedeGolpearUmbral()? '' : `<span style="color:#8a5a3a"> · falta ${umbral.banda>=5?'cantería (GEN6+IQ145)':'más boca que alimentar'}</span>`);""",
    """(puedeGolpearUmbral()? '' : `<span style="color:#8a5a3a"> · falta ${umbral.guarda>=5?'cantería (GEN6+IQ145)':'más boca que alimentar'}</span>`);""")

# d) las reliquias necesitan su grito (notifyCanon parte de def.msg, y sin msg reventaba el descubrimiento)
rep('gritos',
    """  fosil:      {food:0,  mat:null, xp:120, w:5, color:'#e8dcc0', tier:3, reliquia:'Fósil de hormiga león',""",
    """  fosil:      {food:0,  mat:null, xp:120, w:5, color:'#e8dcc0', tier:3, msg:'¡FÓSIL! la trampa de un hormiga león', reliquia:'Fósil de hormiga león',""")
rep('gritos2',
    """  geoda:      {food:0,  mat:'cuarzo', matAmt:3, xp:90, w:5, color:'#c8a6ff', tier:4, reliquia:'Geoda de cuarzo',""",
    """  geoda:      {food:0,  mat:'cuarzo', matAmt:3, xp:90, w:5, color:'#c8a6ff', tier:4, msg:'¡GEODA! +3 cuarzo', reliquia:'Geoda de cuarzo',""")
rep('gritos3',
    """  ambar:      {food:0,  mat:null, xp:80, w:6, color:'#ffb700', tier:3, reliquia:'Ámbar con una hormiga dentro',""",
    """  ambar:      {food:0,  mat:null, xp:80, w:6, color:'#ffb700', tier:3, msg:'¡ÁMBAR! +80 XP', reliquia:'Ámbar con una hormiga dentro',""")
rep('gritos4',
    """  lente:      {food:0,  mat:null, xp:150, w:4, color:'#7ad3ff', tier:5, reliquia:'Lente de cristal de roca',""",
    """  lente:      {food:0,  mat:null, xp:150, w:4, color:'#7ad3ff', tier:5, msg:'¡LENTE! alguien talló esto', reliquia:'Lente de cristal de roca',""")
rep('gritos5',
    """  hongoLinterna:{food:10, mat:null, xp:130, w:4, color:'#2de67a', tier:6, reliquia:'Hongo linterna',""",
    """  hongoLinterna:{food:10, mat:null, xp:130, w:4, color:'#2de67a', tier:6, msg:'¡HONGO LINTERNA! +10 comida y luz', reliquia:'Hongo linterna',""")
rep('gritos6',
    """  lagrima:    {food:0,  mat:'obsidiana', matAmt:2, xp:180, w:3, color:'#9a6bff', tier:7, reliquia:'Lágrima de obsidiana',""",
    """  lagrima:    {food:0,  mat:'obsidiana', matAmt:2, xp:180, w:3, color:'#9a6bff', tier:7, msg:'¡LÁGRIMA DE OBSIDIANA! +2 vidrio negro', reliquia:'Lágrima de obsidiana',""")
rep('gritos7',
    """  corazon:    {food:20, mat:null, xp:300, w:2, color:'#ff3b30', tier:8, reliquia:'Corazón de colina',""",
    """  corazon:    {food:20, mat:null, xp:300, w:2, color:'#ff3b30', tier:8, msg:'¡CORAZÓN DE COLINA! late bajo la arena', reliquia:'Corazón de colina',""")
rep('gritos8',
    """  meteorito:  {food:0,  mat:'meteorito', matAmt:1, xp:220, w:2, color:'#ff8c00', tier:9, reliquia:'Meteorito hundido',""",
    """  meteorito:  {food:0,  mat:'meteorito', matAmt:1, xp:220, w:2, color:'#ff8c00', tier:9, msg:'¡METEORITO! aún quema', reliquia:'Meteorito hundido',""")
rep('gritos9',
    """  nidoAntiguo:{food:0,  mat:'obsidiana', matAmt:1, xp:260, w:2, color:'#c9b896', tier:9, reliquia:'Nido de la colonia vieja',""",
    """  nidoAntiguo:{food:0,  mat:'obsidiana', matAmt:1, xp:260, w:2, color:'#c9b896', tier:9, msg:'¡NIDO ANTIGUO! otra colonia, otro final', reliquia:'Nido de la colonia vieja',""")

# y el codigo de descubrimiento, tolerante: si un dia anade alguien una fila sin msg, no revienta
rep('msg-tolerante',
    """        if(def.fatigue) workers.forEach(w=> w.fatigue=Math.max(0,w.fatigue-def.fatigue));
        if(def.reliquia && anotarReliquia(def, rew.c, rew.r)){""",
    """        if(def.fatigue) workers.forEach(w=> w.fatigue=Math.max(0,w.fatigue-def.fatigue));
        const _grito = def.msg || ('¡'+String(def.reliquia||rew.type||'TESORO').toUpperCase()+'!');
        if(def.reliquia && anotarReliquia(def, rew.c, rew.r)){""")
rep('msg-tolerante2',
    """        notifyCanon(def.msg.split(' ')[0], def.msg, 4000);""",
    """        notifyCanon(_grito.split(' ')[0], _grito, 4000);""")
rep('msg-tolerante3',
    """        pushToast(rew.x,rew.y-18, def.msg.split(' ')[0], def.color);""",
    """        pushToast(rew.x,rew.y-18, _grito.split(' ')[0], def.color);""")
rep('msg-tolerante4',
    """        pushEvent('discover', def.msg, '['+rew.c+','+rew.r+'] tier'+def.tier);""",
    """        pushEvent('discover', _grito, '['+rew.c+','+rew.r+'] '+NOMBRE_BANDA(def.tier-1));""")

# e) huecos de prueba: mas datos, y el salto de bandas acotado
rep('huecos',
    """  window._escalera=()=>({umbral: umbral? {r:umbral.r,hp:umbral.hp,hpMax:umbral.hpMax,banda:umbral.banda} : null,
                         bandaMax, umbralesRotos, filas:ROWS, pisos:ROWS-SURFACE_ROW,
                         losa: (soilType[ROWS-1]? soilType[ROWS-1][3] : -1),""",
    """  window._escalera=()=>({umbral: umbral? {r:umbral.r,hp:Math.round(umbral.hp*10)/10,hpMax:umbral.hpMax,banda:umbral.banda,guarda:umbral.guarda} : null,
                         bandaMax, umbralesRotos, filas:ROWS, pisos:ROWS-SURFACE_ROW,
                         losa: (soilType[ROWS-1]? soilType[ROWS-1][3] : -1),
                         losaSuelo: (soil[ROWS-1]? soil[ROWS-1][3] : -1), magma:magmaCells.length,
                         bandaFondo: bandaDe(Math.max(0,ROWS-2-SURFACE_ROW)),""")
rep('huecos-ir',
    """    while(bandaMax < b){
      if(!umbral) colocarUmbral();
      if(!umbral) break;
      umbral.hp = Math.min(umbral.hp, 1);
      abrirUmbral();
    }""",
    """    for(let i=0;i<14 && bandaMax < b; i++){
      if(!umbral) colocarUmbral();
      if(!umbral) break;
      umbral.hp = Math.min(umbral.hp, 1);
      if(!abrirUmbral()) break;
    }""")

io.open(RUTA,'w',encoding='utf-8').write(src)
print('parche C aplicado (%d): %s' % (len(hechas), ' · '.join(hechas)))
