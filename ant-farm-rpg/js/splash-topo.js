// ===== LA PANTALLA DE TOPO STUDIOS =====
// El logo era texto suelto sobre negro con una barra que se llenaba. Aqui baja al mismo mundo de bloques
// que el juego: un topo saliendo de su madriguera al atardecer, la tierra que salta, y el parpadeo final.
// Reglas de la casa que respeta:
//   - pinta con _bloque/_tilde16 si app.js ya las definió (script clasico = ambito global compartido), y si
//     no, usa la copia local: la firma es cara clara arriba, canto derecho, base oscura y junta de 1 px.
//   - nada de `arc`, nada de degradados, nada de imagens: rellenos enteros sobre una reticula de 8 px.
//   - el lienzo hace 176x88 y la hoja CSS lo duplica con image-rendering:pixelated, asi que los bloques
//     salen enteros a cualquier tamano de ventana.
//   - se para solo: cuando termina la secuencia deja el ultimo cuadro y no gasta un cuadro mas, y si el
//     dueno tiene «menos movimiento» activado sale directamente el cuadro final.
(function(){
  const cv=document.getElementById('splashTopo');
  if(!cv) return;
  const g=cv.getContext('2d');
  if(!g) return;
  g.imageSmoothingEnabled=false;

  const W=176, H=88, K=8;               // lienzo logico y celda: 22 x 11 casillas
  const SUELO=5;                        // fila de la hierba: todo lo de abajo es tierra

  // --- la firma, con copia de seguridad ---
  function _t(h,dd){
    if(typeof _tilde16==='function') return _tilde16(h,dd);
    const n=parseInt(String(h).slice(1),16);
    const r1=Math.max(0,Math.min(255,(n>>16)+dd)), r2=Math.max(0,Math.min(255,((n>>8)&255)+dd)), r3=Math.max(0,Math.min(255,(n&255)+dd));
    return '#'+((r1<<16)|(r2<<8)|r3).toString(16).padStart(6,'0');
  }
  function _b(x,y,w,h,col){
    if(typeof _bloque==='function'){ _bloque(g,x,y,w,h,col,1); return; }
    const x0=Math.round(x), y0=Math.round(y), w0=Math.max(1,Math.round(w)), h0=Math.max(1,Math.round(h));
    g.fillStyle=col; g.fillRect(x0,y0,w0,h0);
    if(h0>=2){ g.fillStyle=_t(col,40); g.fillRect(x0,y0,w0,1); g.fillStyle=_t(col,-46); g.fillRect(x0,y0+h0-1,w0,1); }
    if(h0>=5 && w0>=2){ g.fillStyle=_t(col,-24); g.fillRect(x0+w0-1,y0+1,1,h0-2); }
  }

  // --- paleta del atardecer y del terron ---
  const CIELO=['#141a33','#20294f','#33406d','#5a4a63','#8a5a4a'];
  const ESTRELLAS=[[3,1],[9,0],[16,1],[20,0],[13,0],[6,2]];
  const TIERRA=['#5aa02c','#8a5a2b','#8a5a2b','#b0673f','#b0673f','#d3b473','#6b4a24'];
  const TOPO='#5a5148', TOPO_P='rgba(0,0,0,0)';
  const HOCICO='#e39aa0', DIENTE='#fff8dc', UÑA='#e9e2cf', VIENTRE='#7b7167';

  const hash=(a,bb,n)=>(((a*73 + bb*151 + n*37) % 11) + 11) % 11;

  function monte(){ return [[9,4],[10,4],[11,4],[12,4],[10,3],[11,3]]; }   // lo que asoma del monticulo

  // --- el estado de la secuencia ---
  let t0=null, fin=false, raf=0;
  const DUR=2200;                       // 0,6 tiembla - 0,9 asoma - 1,5 sube - 2,4 se planta - 3,4 quieto
  const polvo=[];
  function sueltaPolvo(cx,cy,n){
    for(let i=0;i<n;i++) polvo.push({x:cx+((Math.random()*10)|0)-5, y:cy-2, vx:(Math.random()-0.5)*1.7, vy:-0.9-Math.random()*1.5, v:26+((Math.random()*3)|0)});
  }
  function cuadro(ts){
    if(t0===null) t0=ts;
    const t=Math.min(DUR, ts-t0);
    const p=(x)=>Math.max(0,Math.min(1,(t-x)/1));   // comodin
    g.clearRect(0,0,W,H);

    // CIELO: cinco fajas cuantizadas, sin degradado de canvas (es la misma regla que el mundo)
    for(let i=0;i<CIELO.length;i++){ g.fillStyle=CIELO[i]; g.fillRect(0,i*8,W,8); }
    const guiño=Math.floor(t/320)%2;
    ESTRELLAS.forEach((s,i)=>{ if(i===1&&guiño) return; g.fillStyle= i%2? '#e9f2fb':'#fff8dc'; g.fillRect(s[0]*8, s[1]*8+2, 2,2); });

    // TIERRA: once columnas de bloques por debajo de la hierba, cada uno con su tilde
    for(let r=SUELO;r<H/K;r++){
      const col=TIERRA[Math.min(TIERRA.length-1, r-SUELO)];
      for(let c=0;c<W/K;c++){
        const jitter = (t<900 || t>3200)? 0 : (hash(c,r,1)%2? 1:0) * (t<620||t>2000?0:0);   // sin deformacion: el bloque se mueve o no, no se estira
        _b(c*8, r*8+jitter, 8, 8, _t(col, (hash(c,r,0)-5)));
        if(r===SUELO){ g.fillStyle='#7ec23a'; g.fillRect(c*8,r*8,8,2); if(hash(c,r,3)%3===0){ g.fillStyle='#a8e05a'; g.fillRect(c*8+2+hash(c,r,4)%4,r*8-2,1,2); } }
      }
    }
    // la boca de la madriguera (un hueco de dos bloques en el centro)
    g.fillStyle='#1c1108'; g.fillRect(10*8+4, SUELO*8, 12, 10);
    g.fillStyle='#0d0704'; g.fillRect(10*8+4, SUELO*8, 12, 2);

    // FASES DEL ASOMO: hay que calcularlas ANTES del monticulo (el monticulo las mira para saber
    // que terrones ya expuls6 el topo) y antes del propio topo. Declaradas despues, el `sube`
    // del monticulo cae en la zona muerta y el lienzo revienta cada cuadro.
    const frame = Math.floor(t/166);      // cuadro cuantizado (el polvo y el temblor van a golpe)
    const empuje1 = t>580? Math.min(1,(t-580)/300) : 0;      // asoma la cabeza
    const empuje2 = t>950? Math.min(1,(t-950)/380) : 0;    // saca los hombros
    const sube = (1-Math.pow(1-empuje1,3))*8 + (1-Math.pow(1-empuje2,3))*14;   // 22 px en total
    const respira = t>1450? Math.round(Math.sin((t-1450)/300)*1) : 0;
    // MONTICULO: terrones encima del prado, en el centro
    // Los dos terrones del centro los expulsa el topo al subir (con su polvo), no se quedan de
    // sombrero encima de la cabeza: eso era lo que hacia que pareciera una caja plantada en el cerro.
    monte().forEach((m,i)=>{
      const temb = (t>420 && t<1000)? (hash(i,Math.floor(t/90),2)%3-1) : 0;
      const expulsado = (m[0]>=10 && m[0]<=11) && sube>3;
      if(expulsado){ if(frame%6===0) sueltaPolvo(m[0]*8+4, m[1]*8+4, 1); return; }   // el polvo va a golpe, no en chorro (monte() se regenera cada cuadro: no hay estado que guardar aqui)
      _b(m[0]*8, m[1]*8+temb, 8, 8, _t('#b0673f', (hash(m[0],m[1],5)-5)));
    });

    // EL TOPO: sube en dos empujones, se planta, respira y parpadea
    // Empieza doce px por debajo de la linea del prado y sube 22: con el recorte de abajo eso se lee
    // como «sale del agujero» en vez de «aparece flotando». Sin recorte, la parte enterrada se veia
    // pintada ENCIMA de la tierra, que era el defecto que delataba el montaje.
    const hocicoY = SUELO*8 + 10 - sube + respira;
    if(sube>0.5){
      const cx=10*8;                                           // el topo mide 3x3 bloques y mira a la izquierda
      g.save(); g.beginPath();
      g.rect(0,0,W,SUELO*8);                                   // todo lo que asoma por encima del prado...
      g.rect(10*8+2, SUELO*8, 16, 14);                         // ...y lo que se ve dentro de la boca
      g.clip();
      // cuerpo detras de la cabeza
      _b(cx-4, hocicoY+4, 30, 18, TOPO);
      _b(cx-4, hocicoY+16, 30, 6, VIENTRE);
      // cabeza
      _b(cx-14, hocicoY, 22, 16, TOPO);
      // hocico rosa y dos dientes
      _b(cx-20, hocicoY+6, 8, 7, HOCICO);
      g.fillStyle=DIENTE; g.fillRect(cx-19, hocicoY+13, 2,2); g.fillRect(cx-15, hocicoY+13, 2,2);
      // ojo: una rayita de 2 px; se cierra un momento al parpadear
      const parpadea = (t>1620 && t<1710) || (t>2020 && t<2100);
      g.fillStyle='#14100c'; g.fillRect(cx-9, hocicoY+5, parpadea?4:3, parpadea?1:2);
      // zarpazos: las dos manos salen y vuelven durante el segundo empujon
      const golpe = (t>600 && t<1500)? Math.abs(Math.sin((t-600)/110)) : 0;
      const dx=Math.round(golpe*4);
      _b(cx-20-dx, hocicoY+12+dx, 6, 5, UÑA);
      _b(cx-13+dx, hocicoY+14+Math.round(golpe*2), 5, 4, UÑA);
      // la tierra que salta con cada zarpazo
      if(golpe>0.85 && polvo.length<26) sueltaPolvo(cx-18, hocicoY+12, 2);
      // al final, el topo se sacude: tres bloques de tierra caen de su lomo
      if(t>1520 && t<1600 && polvo.length<20) sueltaPolvo(cx+12, hocicoY+2, 1);
      g.restore();
    }

    // POLVO: gravedad y vida, en bloques de 2 px (la misma unidad que el terreno)
    for(let i=polvo.length-1;i>=0;i--){
      const d=polvo[i];
      d.x+=d.vx; d.y+=d.vy; d.vy+=0.16; d.v--;
      if(d.v<=0 || d.y>H){ polvo.splice(i,1); continue; }
      _b(d.x, d.y, 2, 2, hash(i,0,7)%2? '#c9a06a':'#8a5a2b');
    }

    // y la linea de luz del atardecer, para que el negro de abajo no corte en seco
    g.fillStyle='rgba(255,204,0,0.10)'; g.fillRect(0,SUELO*8-2,W,2);

    if(t>=DUR){ fin=true; if(raf) cancelAnimationFrame(raf); raf=0; return; }
    raf=requestAnimationFrame(cuadro);
  }

  // La pantalla de inicio se va (opacity + display:none desde app.js): si nadie la ve, nada que animar.
  function visible(){
    const sp=document.getElementById('splashScreen');
    if(!sp) return false;
    if(sp.style.display==='none' || getComputedStyle(sp).display==='none') return false;
    return true;
  }
  function arranca(){
    if(fin || !visible()){ if(raf){ cancelAnimationFrame(raf); raf=0; } return; }
    if(!raf) raf=requestAnimationFrame(cuadro);
  }
  const menos = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(menos){ t0=-99999; cuadro(1e9-DUR+3000); fin=true; }     // cuadro final, quieto
  else{
    arranca();
    setInterval(arranca, 400);                                  // por si el navegador pausa las raf del arranque
  }
})();
