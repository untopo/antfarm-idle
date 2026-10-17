// core/economia.js — reglas de economía como funciones puras.
// Sin DOM. Se carga en el navegador (globales) y se prueba en Node (module.exports).
// Los COSTES de estructuras y herramientas siguen en js/app.js (STRUCTURE_DEFS, TOOL_DEFS):
// aquí solo viven las fórmulas y la forma de pagar, para no duplicar datos.
'use strict';

// Reservas de comida según el tamaño del mapa (ratio = área / área de referencia, 0,35 … 2,6).
function reservaInicialComida(ratio){ return Math.max(5, Math.min(20, Math.round(12*ratio))); }
function reservaSuperficie(ratio){ return Math.max(2, Math.min(10, Math.round(5*ratio))); }
function topeSuperficie(ratio){ return Math.max(3, Math.min(14, Math.round(5*ratio*1.6))); }
// Cinco raciones no son excedente: son la reserva vital de la colonia. La reina puede criar con lo
// que haya por encima, pero la puesta automática no se come este suelo y obliga a las obreras a
// reponerlo antes de abrir trabajo nuevo. Es una regla de juego, no una concesión del bot.
function reservaVitalComida(){ return 5; }

// Materiales: un coste es un objeto {material: cantidad}. Se paga restando del inventario.
function puedePagar(mats, coste){
  for(const k in coste) if((mats[k]||0) < coste[k]) return false;
  return true;
}
// Resta el coste del inventario. Devuelve false (y no toca nada) si no alcanza.
// Mantiene el comportamiento anterior: quien llama comprueba antes; esto solo lo hace seguro.
function pagar(mats, coste){
  if(!puedePagar(mats, coste)) return false;
  for(const k in coste) mats[k] = (mats[k]||0) - coste[k];
  return true;
}

if(typeof module!=='undefined' && module.exports){
  module.exports={reservaInicialComida,reservaSuperficie,topeSuperficie,reservaVitalComida,puedePagar,pagar};
}
