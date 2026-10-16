// core/bandas.js — la escalera de bandas como datos y funciones puras.
// Sin DOM ni canvas: se carga en el navegador (globales) y se prueba en Node (module.exports).
// Extraido de js/app.js sin cambiar valores. Cambiar una banda aqui cambia el juego.
'use strict';
const BANDAS=[
  {n:'ROOTS',         desde:0,  tipo:1,  dureza:0,   veta:null, pinta:'piedras',      color:'#8a5a2b'},
  {n:'CLAY',          desde:3,  tipo:2,  dureza:4,   veta:null, pinta:'mantas',       color:'#b0673f'},
  {n:'QUICKSAND', desde:8,  tipo:3,  dureza:-4,  veta:null, pinta:'granos',       color:'#d3b473'},
  {n:'STONE',         desde:14, tipo:4,  dureza:9,   veta:8,    pinta:'grieta',       color:'#8d8d8d'},
  {n:'SLATE',        desde:22, tipo:6,  dureza:14,  veta:9,    pinta:'grietaLarga',  color:'#6b7a8a'},
  {n:'QUARTZITE',       desde:30, tipo:11, dureza:18,  veta:10,   pinta:'veta',         color:'#c9c2d8'},
  {n:'BLACK MARBLE',   desde:38, tipo:12, dureza:23,  veta:16,   pinta:'veta',         color:'#4a4552'},
  {n:'OBSIDIAN',      desde:46, tipo:13, dureza:29,  veta:16,   pinta:'brillo',       color:'#241f2e'},
  {n:'IGNEOUS BASALT',  desde:55, tipo:14, dureza:34,  veta:10,   pinta:'grietaLarga',  color:'#4a2a20'},
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

if(typeof module!=='undefined' && module.exports){
  module.exports={BANDAS,PISOS_BANDA,VETA_P,DUREZA_EXTRA,bandaDe,tipoDePiso,durezaDe,NOMBRE_BANDA,COLOR_BANDA,vetaDeBanda};
}
