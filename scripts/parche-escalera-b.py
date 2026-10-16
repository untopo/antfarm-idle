#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Parche B: pintar la escalera (bloques nuevos, la losa, el fuego), abrir bandas al romper la losa,
vitrina de reliquias en el panel, guardado, y la regla de profundidad con nombres nuevos."""
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

# ---------------------------------------------------------------- 0. subir el sembrador de tesoros a nivel de modulo
rep_re('sembrador-fuera',
    r"  function isValidTreasurePos\(c,r\)\{.*?\n    return true; // siempre truthy: el contador de colocados debe subir aunque el tipo caiga raro\n  \}\n",
    "  // (isValidTreasurePos y spawnSmartTreasure subieron a nivel de modulo: expandWorld y el respawn tras\n"
    "  //  descubrir un tesoro los llamaban desde fuera y el guardaNulo de `typeof spawnSmartTreasure` hacia\n"
    "  //  que no pasaran nada - ni cofres nuevos al cavar, ni botin en las bandas que se abrian)\n")

NUEVO_SEMBRADOR = r"""// ---- sembrador de botin, a nivel de modulo ----
// Subido desde dentro de initSoil: expandWorld y checkRewardDiscovery lo llamaban con
// `typeof spawnSmartTreasure==='function'`, que en el ambito de modulo era mentira -> los dos caminos
// nunca hicieron nada. Ahora la banda nueva sale con su botin puesto y al descubrir algo puede nacer
// otra cosa mas hondo.
function isValidTreasurePos(c,r){
  if(c<4||c>=COLS-4||r<SURFACE_ROW+4||r>=ROWS-3) return false;
  if(!soil[r]||soil[r][c]!==1) return false;
  // no muy cerca de otro tesoro - la separacion minima sigue la escala del mapa
  const _minD=Math.max(3, Math.min(7, Math.round(5*Math.sqrt(worldAreaRatio()))));
  for(let tr of hiddenRewards){ if(Math.hypot(tr.c-c,tr.r-r)<_minD) return false; }
  if(Math.hypot(c-CENTER_COL, r-(SURFACE_ROW+3))<6) return false;
  return true;
}
function spawnSmartTreasure(c,r,forcedType){
  if(!isValidTreasurePos(c,r)) return null;
  const depth=r-SURFACE_ROW;
  const tier = 1+bandaDe(depth);                 // el suelo manda: la banda ES el requisito
  const type=forcedType||pickTreasureType(tier);
  hiddenRewards.push({c,r,type,found:false,x:c*CELL+8,y:r*CELL+8, depthTier:tier});
  return true; // siempre truthy: el contador debe subir aunque el tipo caiga raro
}

function initSoil(){"""
rep('initSoil-ancla', "function initSoil(){", NUEVO_SEMBRADOR)

# ---------------------------------------------------------------- 1. paleta voxel de las bandas nuevas
rep('vox-nuevos',
    """  10:{col:'#8d8d8d', pinta:'veta', punto:'#f0cf5e'}
};""",
    """  10:{col:'#8d8d8d', pinta:'veta', punto:'#f0cf5e'},
  // y lo que hay por debajo, que es la razon de cavar:
  11:{col:'#c9c2d8', pinta:'veta', punto:'#f4f0ff'},   // cuarcita: clara, chispeante
  12:{col:'#4a4552', pinta:'veta', punto:'#c8a6ff'},   // marmol negro con veta de gemas
  13:{col:'#241f2e', pinta:'brillo'},                    // obsidiana
  14:{col:'#4a2a20', pinta:'grietaLarga'},               // basalto
  15:{col:'#ff6a1e', pinta:'lumbre'},                     // MAGMA (no se cava)
  16:{col:'#8d8d8d', pinta:'veta', punto:'#7ad3ff'},     // veta de gemas
  17:{col:'#2b2b33', pinta:'cincel'},                     // LA LOSA DEL UMBRAL
  18:{col:'#dfe8ee', pinta:'granos'}                       // sal de roca
};""")

# ---------------------------------------------------------------- 2. patrones nuevos del pintor
rep('pintas-nuevas',
    """  } else if(d.pinta==='veta'){
    g.fillStyle=d.punto;
    g.fillRect(x+_px(1),y+4+_px(2)%7,2,2); g.fillRect(x+_px(4),y+_px(5)%8+3,2,2);
    if(((c*7+r*5)%3)!==0) g.fillRect(x+_px(7),y+11,2,2);
  }""",
    """  } else if(d.pinta==='veta'){
    g.fillStyle=d.punto;
    g.fillRect(x+_px(1),y+4+_px(2)%7,2,2); g.fillRect(x+_px(4),y+_px(5)%8+3,2,2);
    if(((c*7+r*5)%3)!==0) g.fillRect(x+_px(7),y+11,2,2);
  } else if(d.pinta==='brillo'){
    // obsidiana: negro con dos caras de vidrio. Se lee «corte» sin necesidad de degradado.
    g.fillStyle='rgba(255,255,255,0.11)'; g.fillRect(x+2,y+3,5,2); g.fillRect(x+8,y+9,5,2);
    g.fillStyle='rgba(122,211,255,0.10)'; g.fillRect(x+3,y+11,3,1);
  } else if(d.pinta==='lumbre'){
    // magma: nucleo claro, costra oscura alrededor. El resplandor que lo acompana se pinta en drawFarm,
    // porque aqui dentro (el cache del suelo) un parpadeo quedaria congelado hasta el proximo repintado.
    g.fillStyle='#2a1208'; g.fillRect(x,y,CELL,CELL);
    g.fillStyle='#ff8c1a'; g.fillRect(x+2,y+4,CELL-4,CELL-8);
    g.fillStyle='#ffe08a'; g.fillRect(x+4,y+6,CELL-8,3);
    g.fillStyle='#8a2a08'; g.fillRect(x,y+CELL-3,CELL,3);
  } else if(d.pinta==='cincel'){
    // LA LOSA: siempre igual de maciza, pero con las mordeduras puestas. El progreso del umbral se ve en
    // el propio bloque (astillas quitadas = grietas), no solo en la barra de arriba.
    const _rot = umbral? Math.max(0, Math.min(1, 1-(umbral.hp/umbral.hpMax))) : 0;
    g.fillStyle=sombra;
    g.fillRect(x+2,y+3,3,1); g.fillRect(x+5,y+6,2,1); g.fillRect(x+9,y+2,2,1);
    if(_rot>0.12){ g.fillStyle='#0d0704'; g.fillRect(x+3,y+2,1,7); g.fillRect(x+4,y+9,2,1); }
    if(_rot>0.34){ g.fillRect(x+8,y+3,1,8); g.fillRect(x+9,y+11,3,1); }
    if(_rot>0.58){ g.fillRect(x+12,y+2,1,9); }
    if(_rot>0.80){ g.fillStyle='#ffcc00'; g.fillRect(x+2,y+13,CELL-4,1); }   // a un mordisco de ceder
  }""")

# ---------------------------------------------------------------- 3. expandWorld: banda por banda
rep_re('expand-mundo',
    r"  // expandir soil y soilType\n  for\(let r=oldRows;r<newRows;r\+\+\)\{.*?\n  \}\n  ROWS=newRows;",
    r"""  // expandir soil y soilType - ya no con una tabla a mano: la Escalera decide el tipo por piso
  for(let r=oldRows;r<newRows;r++){
    const depth=r-SURFACE_ROW;
    soil.push(Array(COLS).fill(1));
    soilType.push(Array.from({length:COLS},()=>tipoDePiso(depth)));
  }
  // vetas de la banda nueva (la misma VETA_P del mapa inicial, un pelin mas generosa: lo recien abierto
  // tiene que notarse en la colonia, si no la recompensa es invisible)
  for(let r=oldRows;r<newRows;r++){
    const _b=bandaDe(r-SURFACE_ROW), _vb=vetaDeBanda(_b);
    if(_vb===null) continue;
    const _vt=BANDAS[_b].tipo, _p=(VETA_P[_b]||0.03)*1.5;
    for(let c=1;c<COLS-1;c++){
      if(soilType[r][c]!==_vt) continue;
      if(Math.random()>_p) continue;
      soilType[r][c]=_vb;
      for(let k=0;k<2;k++){
        const rr=r+Math.floor(Math.random()*2), cc2=c+Math.floor(Math.random()*3)-1;
        if(rr>ROWS-2||cc2<1||cc2>=COLS-1) continue;
        if(soilType[rr][cc2]===_vt) soilType[rr][cc2]=_vb;
      }
    }
  }
  // y si la banda que se abre es la ultima, su fuego
  if(bandaDe((newRows-1)-SURFACE_ROW)>=BANDAS.length-1){
    for(let r=Math.max(oldRows,SURFACE_ROW+BANDAS[BANDAS.length-1].desde); r<newRows-1; r++){
      for(let c=1;c<COLS-1;c++){
        if(soilType[r][c]!==BANDAS[BANDAS.length-1].tipo || Math.random()>0.06) continue;
        soilType[r][c]=15;
      }
    }
  }
  // LA CUEVA: el hueco vacio ya es premio (Core Keeper, Dwarf Fortress). Una o dos camaras grandes en la
  // banda nueva, con botin dentro - asi «bajar» se ve como un sitio, no como un numero.
  const _nc=1+((Math.random()*2)|0);
  for(let i=0;i<_nc;i++){
    const rx=5+Math.floor(Math.random()*Math.max(1,COLS-10));
    const ry=Math.min(newRows-3, oldRows+1+Math.floor(Math.random()*Math.max(1,newRows-oldRows-2)));
    const rxr=3+Math.floor(Math.random()*3), ryr=2+Math.floor(Math.random()*2);
    for(let y=ry-ryr;y<=ry+ryr;y++){
      if(y<=SURFACE_ROW+1||y>=newRows-1) continue;
      for(let x=rx-rxr;x<=rx+rxr;x++){
        if(x<1||x>=COLS-1||!soil[y]) continue;
        const dx=(x-rx)/rxr, dy=(y-ry)/ryr;
        if(dx*dx+dy*dy<=1 && soil[y][x]===1){ soil[y][x]=0; if(soilType[y]) soilType[y][x]=0; markSoilDirty(x,y); }
      }
    }
    for(let a=0;a<6;a++){
      const cc=rx-3+Math.floor(Math.random()*7), rr=ry+1+Math.floor(Math.random()*3);
      if(spawnSmartTreasure(cc,rr)) break;
    }
  }
  ROWS=newRows;""")

rep('expand-cierre',
    """  pushEvent('evo',`🌍 Mundo expandido +`+addRows+` filas → `+ROWS+` profundidad`, `progresivo: más profundo = más duro y más recompensas`);
  notifyCanon('🌍 MAPA MÁS PROFUNDO', `El mundo crece a `+ROWS+` filas - las excavadoras llegaron al fondo`, 5200);
  // revelar recompensas más profundas si hay
}""",
    """  if(!silencioso){
    pushEvent('evo',`🌍 Mundo expandido +`+addRows+` filas → `+ROWS+` profundidad`, `progresivo: más profundo = más duro y más recompensas`);
    notifyCanon('🌍 MAPA MÁS PROFUNDO', `El mundo crece a `+ROWS+` filas - las excavadoras llegaron al fondo`, 5200);
  }
  // y el nuevo techo: otra losa, otra banda que ganarse. Sin esto la escalera se acaba y vuelven a
  // estar cavando en el vacio.
  colocarUmbral(); reindexMagma();
  try{ for(let i=0;i<4;i++){ const c=4+Math.floor(Math.random()*(COLS-8)), r=oldRows+Math.floor(Math.random()*Math.max(2,newRows-oldRows)); spawnSmartTreasure(c,r); } }catch(e){}
}""")
rep('expand-firma', "function expandWorld(addRows){", "function expandWorld(addRows, silencioso){")

# ---------------------------------------------------------------- 4. el expansor viejo, ahora solo de emergencia
rep('expansor-viejo',
    """let _lastExpand=0;
function checkWorldExpansion(){
  if(Date.now()-_lastExpand < 5200) return; // debounce 5.2s""",
    """let _lastExpand=0;
function checkWorldExpansion(){
  if(umbral) return;   // con la Escalera montada el mundo NO crece solo: crece cuando la colonia revienta la losa
  if(Date.now()-_lastExpand < 5200) return; // debounce 5.2s""")

# ---------------------------------------------------------------- 5. descubrir tesoros: reliquias
rep('def-fija',
    """      const def = (typeof TREASURE_DEFS!=='undefined' && TREASURE_DEFS[rew.type]) ? TREASURE_DEFS[rew.type] : null;""",
    """      const def = TREASURE_DEFS[rew.type] || null;   // antes el typeof mentia y def salia null: ni fibra, ni ambar""")

rep('reliquia-efecto',
    """        if(def.fatigue) workers.forEach(w=> w.fatigue=Math.max(0,w.fatigue-def.fatigue));
        pushEvent('discover', def.msg, '['+rew.c+','+rew.r+'] tier'+def.tier);""",
    """        if(def.fatigue) workers.forEach(w=> w.fatigue=Math.max(0,w.fatigue-def.fatigue));
        if(def.reliquia && anotarReliquia(def, rew.c, rew.r)){
          const _pis=(rew.r-SURFACE_ROW);
          pushEvent('evo', `🏺 RELIQUIA A LA VITRINA · ${def.reliquia}`, `piso ${_pis} · +${Math.round((def.bonus||0.02)*100)}% de excavacion para siempre (ahora ${Math.round(bonusCava*100)}%)`);
          notifyCanon('🏺 '+def.reliquia.toUpperCase(), def.lore||'la colonia la sube a la vitrina', 6400);
          for(let i=0;i<10;i++) particles.push({x:rew.x,y:rew.y,vx:(Math.random()-0.5)*1.6,vy:-Math.random()*2.2,life:1,decay:0.02,color:def.color, bloque:true});
        }
        pushEvent('discover', def.msg, '['+rew.c+','+rew.r+'] tier'+def.tier);""")

# ---------------------------------------------------------------- 6. marker del tesoro: color y rombo de reliquia
rep('marker-color',
    """        else if(t==='semillas') bg='#ffcc00';
        _bloque(ctx,x+2,y+2,12,12,bg);""",
    """        else if(t==='semillas') bg='#ffcc00';
        else if(TREASURE_DEFS[t]) bg=TREASURE_DEFS[t].color;   // y lo demas sale del propio cuadro: nada de olvidar tipos nuevos
        _bloque(ctx,x+2,y+2,12,12,bg);
        if(TREASURE_DEFS[t] && TREASURE_DEFS[t].reliquia){
          // rombo de cuatro bloques: «esto es una maravilla», legible a x1 sin leer el cartel
          ctx.fillStyle='#fff8dc';
          ctx.fillRect(cx-1,cy-4,2,2); ctx.fillRect(cx-4,cy-1,2,2); ctx.fillRect(cx+2,cy-1,2,2); ctx.fillRect(cx-1,cy+2,2,2);
        }""")

# ---------------------------------------------------------------- 7. el fuego: peaje de la ultima banda
rep('quemadura',
    """  ant.fatigue=Math.max(0,Math.min(100,ant.fatigue));""",
    """  // El magma no se cava: se patea al lado. Si hay fuego a un bloque de distancia la fatiga sube y, si
  // se pasa de la raya, la obrera suelta lo que lleva y sube a la superficie. Es el peaje honesto de la
  // ultima banda - sin peaje no hay tension, y sin tension 'bajar al fuego' es solo leer un numero.
  if(magmaCells.length && Array.isArray(soilType)){
    const _ar=(ant.y/CELL)|0, _ac=(ant.x/CELL)|0;
    let _fuego=false;
    for(let dr=-1;dr<=1 && !_fuego;dr++){
      const _rr=_ar+dr; if(_rr<0||_rr>=ROWS||!soilType[_rr]||!soil[_rr]) continue;
      for(let dc=-1;dc<=1;dc++){
        const _cc=_ac+dc; if(_cc<0||_cc>=COLS) continue;
        if(soil[_rr][_cc]===1 && soilType[_rr][_cc]===15){ _fuego=true; break; }
      }
    }
    if(_fuego){
      ant.fatigue=Math.min(100, ant.fatigue+2.3); ant._quemando=time;
      if(ant.fatigue>84){
        ant.digTarget=null; ant.digProgress=0; ant.state='VOLVER_TIERRA';
        if(Math.random()<0.06) pushToast(ant.x,ant.y-12,'🔥','#ff6a1e');
        if(!ant._fuegoAviso || time-ant._fuegoAviso>600){ ant._fuegoAviso=time; pushEvent('accident', `🔥 ${ant.id} sale escaldada del basalto`, `piso ${_ar-SURFACE_ROW} - fatiga ${Math.round(ant.fatigue)}`); }
      }
    }
  }
  ant.fatigue=Math.max(0,Math.min(100,ant.fatigue));""")

# ---------------------------------------------------------------- 8. resplandor + barra de la losa
rep('glow-losa',
    """  ctx.globalAlpha=1;
  // clima lluvia/relámpago""",
    """  // === LO QUE ARDE ABAJO Y LA LOSA QUE LOS TAPA ===
  // El magma se pinta en el cache del suelo (es estable) pero aqui va el RESPLANDOR, que parpadea: si se
  // congelara en el cache dejaria de ser lumbre. Solo se recorre la lista de casillas de fuego, no el mapa.
  if(!isMini && magmaCells.length){
    const _lat = 1 + Math.floor(time*0.06)%2;
    for(const mc of magmaCells){
      const mx=mc.x, my=mc.y;
      if(mx+CELL < _cvx || mx > _cvx+_cvw || my+CELL < _cvy || my > _cvy+_cvh) continue;
      ctx.fillStyle='rgba(255,120,30,0.13)'; ctx.fillRect(mx-CELL,my-CELL,CELL*3,CELL*3);
      ctx.fillStyle='rgba(255,190,90,0.16)'; ctx.fillRect(mx-2,my-2-_lat,CELL+4,CELL+4);
    }
  }
  // Y la losa lleva encima su barra: la colonia entera muerde la misma piedra y eso tiene que verse sin
  // abrir el panel. Dos rectangulos, ni un trazo.
  if(!isMini && umbral){
    const _uy=umbral.r*CELL-6;
    if(_uy > _cvy-12 && _uy < _cvy+_cvh){
      const _w0=Math.min(_cvw-8, COLS*CELL-8), _x0=Math.max(_cvx+4, 4);
      const _p0=Math.max(0, Math.min(1, 1-(umbral.hp/umbral.hpMax)));
      _bloque(ctx,_x0,_uy,_w0,4,'#1a140f');
      if(_p0>0.01) _bloque(ctx,_x0+1,_uy+1,Math.max(1,Math.floor((_w0-2)*_p0)),2, _p0>0.8?'#ffcc00':'#c8c8d8');
    }
  }
  ctx.globalAlpha=1;
  // clima lluvia/relámpago""")

# ---------------------------------------------------------------- 9. la regla de profundidad conoce las bandas
rep('regla-nombres',
    """    const NOMBRE_SUELO={0:'AIRE',1:'TIERRA',2:'ARCILLA',3:'ARENA',4:'PIEDRA',5:'PIEDRA',6:'PIZARRA',7:'ROCAMA',8:'COBRE',9:'HIERRO',10:'ORO'};""",
    """    const NOMBRE_SUELO={0:'AIRE',1:'TIERRA',2:'ARCILLA',3:'ARENA',4:'PIEDRA',5:'PIEDRA',6:'PIZARRA',7:'ROCAMA',8:'COBRE',9:'HIERRO',10:'ORO',
                       11:'CUARCITA',12:'MARMOL',13:'OBSIDIANA',14:'BASALTO',15:'MAGMA',16:'GEMAS',17:'LOSA',18:'SAL'};""")
rep('regla-colores',
    """      return m==='ARENA'?'#e8cf8a': m==='ARCILLA'?'#c47a52': m==='PIEDRA'?'#9a9a9a': m==='PIZARRA'?'#6b7a8a': m==='ROCAMA'?'#3a3a44':
             m==='COBRE'?'#c8703a': m==='HIERRO'?'#b9bcc6': m==='ORO'?'#e8c14b':'#ffcc00'; })());""",
    """      return m==='ARENA'?'#e8cf8a': m==='ARCILLA'?'#c47a52': m==='PIEDRA'?'#9a9a9a': m==='PIZARRA'?'#6b7a8a': m==='ROCAMA'?'#3a3a44':
             m==='CUARCITA'?'#c9c2d8': m==='MARMOL'?'#8a7fa0': m==='OBSIDIANA'?'#5a3a8a': m==='BASALTO'?'#7a4030': m==='MAGMA'?'#ff6a1e':
             m==='GEMAS'?'#7ad3ff': m==='LOSA'?'#c8c8d8': m==='SAL'?'#dfe8ee':
             m==='COBRE'?'#c8703a': m==='HIERRO'?'#b9bcc6': m==='ORO'?'#e8c14b':'#ffcc00'; })());""")

# ---------------------------------------------------------------- 10. panel: vitrina y estado del umbral
VITRINA_JS = r"""    // === LA VITRINA y el estado de la LOSA ===
    // Dos lineas del panel del mundo que antes no existian: cuantas losas lleva rotas la colonia y que
    // maravillas sac abajo. Se reconstruye solo si cambia algo (el panel se refresca a 7 fps y una lista
    // de nodos por cuadro en cada refresco es DOM gratis que nadie pide).
    try{
      const _uEl=document.getElementById('ecoUmbral');
      if(_uEl){
        if(umbral){
          const _p=Math.max(0, Math.min(100, Math.round((1-umbral.hp/umbral.hpMax)*100)));
          _uEl.innerHTML=`<b style="color:#c8c8d8">🕳️ LOSA · ${NOMBRE_BANDA(umbral.banda+1)}</b> · mordida ${_p}%`+
                         (puedeGolpearUmbral()? '' : `<span style="color:#8a5a3a"> · falta ${umbral.banda>=5?'cantería (GEN6+IQ145)':'más boca que alimentar'}</span>`);
        } else {
          _uEl.innerHTML=`<b style="color:#ffcc00">🕳️ ${umbralesRotos} losas rotas</b> · ${NOMBRE_BANDA(bandaMax)} · el fondo ya es minable`;
        }
      }
      const _vEl=document.getElementById('ecoRelics'), _vh=document.getElementById('ecoRelicHint');
      const _sig=reliquias.length+'|'+(umbral?Math.round(umbral.hp):'x');
      if(_vh) _vh.textContent=reliquias.length? reliquias.length+' en la vitrina' : 'vacia';
      if(_vEl && _vEl.dataset.sig!==_sig){
        _vEl.dataset.sig=_sig;
        if(!reliquias.length){
          _vEl.innerHTML='<span style="color:#5a4a6a">Nada asombroso todavia. Hay que bajar a la PIZARRA o mas hondo para encontrar reliquias.</span>';
        } else {
          _vEl.innerHTML=reliquias.map(x=>{
            const _d=TREASURE_DEFS[Object.keys(TREASURE_DEFS).find(k=>TREASURE_DEFS[k].reliquia===x.tipo)||'']||{};
            const _col=_d.color||'#c8a6ff';
            return '<div style="display:flex;gap:6px;align-items:center;line-height:1.15;margin-bottom:3px" title="'+(x.lore||'')+'">'+
                   '<span style="width:9px;height:9px;flex:0 0 9px;background:'+_col+';box-shadow:1px 1px 0 #000,inset 0 1px 0 rgba(255,255,255,.4)"></span>'+
                   '<span style="color:#e9dcc0;flex:1 1 auto">'+x.tipo+'</span>'+
                   '<span style="color:#8a7a5a">piso '+x.piso+' · D'+x.dia+'</span></div>';
          }).join('')+'<div style="color:#2de67a;margin-top:2px">+'+Math.round(bonusCava*100)+'% excavación por reliquias</div>';
        }
      }
    }catch(e){}

"""
rep('panel-vitrina',
    """    const mS=document.getElementById('matStone'); if(mS) mS.textContent=worldMaterials.stone;""",
    VITRINA_JS + "    const mS=document.getElementById('matStone'); if(mS) mS.textContent=worldMaterials.stone;")

# ---------------------------------------------------------------- 11. guardado y carga
rep('save',
    """      hiddenRewards: Array.isArray(hiddenRewards)? hiddenRewards.map(h=>({c:h.c,r:h.r,type:h.type,found:!!h.found,x:h.x,y:h.y,tier:h.depthTier})) : [],""",
    """      hiddenRewards: Array.isArray(hiddenRewards)? hiddenRewards.map(h=>({c:h.c,r:h.r,type:h.type,found:!!h.found,x:h.x,y:h.y,tier:h.depthTier})) : [],
      // la escalera: que banda tiene abierta la colonia, que hay en la vitrina y cuanto aguanta la losa
      bandaMax, umbralesRotos, bonusCava,
      reliquias: Array.isArray(reliquias)? reliquias.map(x=>({tipo:x.tipo,piso:x.piso,dia:x.dia,gen:x.gen,lore:x.lore,bonus:x.bonus})) : [],
      umbral: umbral? {r:umbral.r, hp:Math.round(umbral.hp*10)/10, hpMax:umbral.hpMax, banda:umbral.banda} : null,""")

rep('load',
    """    hiddenRewards = Array.isArray(data.hiddenRewards)? data.hiddenRewards.map(h=>({c:h.c,r:h.r,type:h.type,found:h.found,x:h.x,y:h.y,depthTier:h.tier||1})) : [];""",
    """    hiddenRewards = Array.isArray(data.hiddenRewards)? data.hiddenRewards.map(h=>({c:h.c,r:h.r,type:h.type,found:h.found,x:h.x,y:h.y,depthTier:h.tier||1})) : [];
    // --- la escalera vuelve como estaba (o se repone la losa: un guardado viejo no la tiene y sin losa
    //     el mundo se queda sin techo, que es justo lo que el umbral evita) ---
    bandaMax = Math.max(0, data.bandaMax|0); umbralesRotos = Math.max(0, data.umbralesRotos|0);
    reliquias = Array.isArray(data.reliquias)? data.reliquias.map(x=>({tipo:x.tipo,nombre:x.tipo,piso:x.piso|0,dia:x.dia|0,gen:x.gen|0,lore:x.lore||'',bonus:x.bonus||0.02})) : [];
    bonusCava = Math.min(0.30, Number(data.bonusCava)||reliquias.reduce((a,x)=>a+(x.bonus||0),0));
    umbral = null;
    try{
      if(data.umbral && soil[data.umbral.r] && soilType[data.umbral.r] && soilType[data.umbral.r][2]===17){
        umbral={r:data.umbral.r|0, c0:2, c1:COLS-3, hp:Number(data.umbral.hp)||UMBRAL_HP(data.umbral.banda|0),
                hpMax:Number(data.umbral.hpMax)||UMBRAL_HP(data.umbral.banda|0), banda:data.umbral.banda|0};
      } else if(Array.isArray(soilType) && soilType.length && soilType[soilType.length-1] && soilType[soilType.length-1][2]!==17){
        colocarUmbral();
      }
      reindexMagma();
    }catch(e){ console.warn('escalera al cargar', e); }""")

# ---------------------------------------------------------------- 12. huecos de prueba
rep('huecos',
    """  window._spawnTreasure=(c,r,t)=>spawnSmartTreasure(c,r,t);""",
    """  window._spawnTreasure=(c,r,t)=>spawnSmartTreasure(c,r,t);
  // huecos de prueba de la Escalera (test/profundidad.js): leer y forzar el estado sin depender del azar
  window._escalera=()=>({umbral: umbral? {r:umbral.r,hp:umbral.hp,hpMax:umbral.hpMax,banda:umbral.banda} : null,
                         bandaMax, umbralesRotos, filas:ROWS, pisos:ROWS-SURFACE_ROW,
                         losa: (soilType[ROWS-1]? soilType[ROWS-1][3] : -1),
                         vetas:{cobre:worldMaterials.cobre||0, hierro:worldMaterials.hierro||0, oro:worldMaterials.oro||0,
                                cuarzo:worldMaterials.cuarzo||0, gema:worldMaterials.gema||0, obsidiana:worldMaterials.obsidiana||0},
                         reliquias:reliquias.length, bonusCava});
  window._morderUmbral=(n)=>{ for(let i=0;i<(n||1);i++) golpearUmbral({id:'TEST',role:'EXCAVADORA',x:umbral?umbral.r*0+ (umbral.c0*CELL):0, y:umbral?umbral.r*CELL:0}); return window._escalera(); };
  window._irABanda=(b)=>{   // deja la losa a un mordisco y la revienta: el test quiere ver la banda, no esperar
    while(bandaMax < b){
      if(!umbral) colocarUmbral();
      if(!umbral) break;
      umbral.hp = Math.min(umbral.hp, 1);
      abrirUmbral();
    }
    return window._escalera();
  };""")

io.open(RUTA,'w',encoding='utf-8').write(src)
print('parche B aplicado (%d trozos): %s' % (len(hechas), ' · '.join(hechas)))
