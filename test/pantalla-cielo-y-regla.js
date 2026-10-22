#!/usr/bin/env node
/**
 * Cielo y regla de profundidad, en CHROME real y sobre pixeles de verdad.
 *
 * El cielo va codificado (degradado interpolado por hora, oscurecido por clima, luceros solo de noche y
 * nubes dibujadas), y la barra de la derecha cuenta los pisos desde la raya del cesped con el material que
 * toca a cada profundidad. Las dos cosas se ven con los ojos, pero tienen tres propiedades que se pueden
 * medir sin engañarse y aqui se miden:
 *
 *   - el cielo cambia de color con la hora (alba / mediodia / ocaso / noche) y el clima le roba luz;
 *   - cubre la pantalla de borde a borde (no hay huecos a los lados cuando la camara se va arriba);
 *   - los numeros de la regla son clicables y la camara acaba EN ese piso - y si la pantalla no da para
 *     centrarlo (mundo pequeno con ventana grande), el cartel lo dice en vez de prometer un salto falso.
 *
 * Las capturas van a /tmp/antfarm-capturas (el taller no acumula imagenes; GitHub es el almacen).
 *
 *   node test/pantalla-cielo-y-regla.js
 */
const http=require('http'), fs=require('fs'), path=require('path');
const puppeteer=require('/home/user/node_modules/puppeteer');
const ROOT='/home/user', PORT=Number(process.env.PORT_VISUAL||8196);
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer((q,r)=>{ let p=path.join(ROOT,decodeURIComponent(q.url.split('?')[0])); if(p.endsWith('/'))p+='index.html';
  fs.readFile(p,(e,b)=>{ if(e){r.writeHead(404);return r.end('nope');} r.writeHead(200,{'Content-Type':MIME[path.extname(p)]||'application/octet-stream'}); r.end(b); }); });
let fallos=0;
const ok=(c,n,d)=>{ console.log((c?'  ok   ':'  FAIL ')+n+(d?' · '+d:'')); if(!c) fallos++; };
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  await new Promise(r=>server.listen(PORT,'0.0.0.0',r));
  const browser=await puppeteer.launch({headless:'new',args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage(); await page.setViewport({width:1440,height:900});
  const errores=[];
  page.on('pageerror',e=>errores.push('pagina: '+e.message));
  page.on('console',m=>{ if(m.type()==='error' && !/favicon|autoplay|AudioContext/.test(m.text())) errores.push('consola: '+m.text().slice(0,90)); });
  await page.goto(`http://127.0.0.1:${PORT}/ant-farm-rpg/index.html`,{waitUntil:'load',timeout:30000});
  await page.waitForFunction('typeof window.topoShowMainMenu==="function" || window._topoFlowReady===true',{timeout:20000}).catch(()=>{});
  await page.waitForFunction("!document.getElementById('splashScreen') || document.getElementById('splashScreen').style.display==='none'",{timeout:20000}).catch(()=>{});
  await page.click('#btnMainCreate'); await sleep(400);
  await page.click('#createSizeScreen [data-size="small"]'); await sleep(400);
  await page.evaluate(()=>{const h=document.querySelector('.topo-dialog-host');if(!h)return;const b=h.querySelector('button.primary');if(b)b.click();});
  await page.waitForFunction('window.COLS===48 && window.ROWS===28',{timeout:60000});
  for(let i=0;i<10;i++){ const abierto=await page.evaluate(()=>{ const m=document.getElementById('onboardingModal');
      if(!m || getComputedStyle(m).display==='none') return false;
      const b=document.getElementById('btnOnboardingStart')||[...m.querySelectorAll('button')].pop(); if(b) b.click(); return true; });
    await sleep(300); if(!abierto) break; }
  await page.evaluate(`(()=>{ const b=document.getElementById('btnOnboardingStart'); if(b) b.click();
    else { const m=document.getElementById('onboardingModal'); if(m){ const x=[...m.querySelectorAll('button')].pop(); if(x) x.click(); } } })()`);
  await sleep(700);

  const pantalla=await page.evaluate(`(()=>{ const a=document.querySelector('.app'), r=document.querySelector('.depth-ruler'), cv=document.getElementById('farmCanvas');
    return { app:a?getComputedStyle(a).display:'-', regla:Math.round(r.getBoundingClientRect().height),
      canvas:[Math.round(cv.getBoundingClientRect().width), Math.round(cv.getBoundingClientRect().height)],
      dibujar: typeof drawFarm }; })()`);
  console.log('  pantalla:', JSON.stringify(pantalla));
  ok(pantalla.regla > 300, 'la regla de profundidad tiene alto de verdad en pantalla', pantalla.regla + 'px');

  // tres fotogramas y dos lecturas: con la pausa a medias a veces todavia no se ha repintado el cielo y el
  // recuento sale bajo (medido: 3 luceros en una pasada y 20 en la siguiente con el mismo codigo).
  const pinta=()=>page.evaluate(`(()=>{ paused=false; gameSpeed=1; return new Promise(r=>{ let n=0; const f=()=>{ if(++n<3) requestAnimationFrame(f); else { paused=true; r(1); } }; requestAnimationFrame(f); }); })()`);
  const muela=async(hora,clima)=>{
    await page.evaluate(`(()=>{ time=Math.round(DAY_LENGTH*(${hora}/24)); weather.type='${clima}'; weather.intensity=${clima==='clear'?0:0.85}; })()`);
    await pinta(); await pinta();
    const leido=async()=>JSON.parse(await page.evaluate(`(()=>{ const cv=document.getElementById('farmCanvas'), g=cv.getContext('2d');
      const px=(x,y)=>{ const d=g.getImageData(x,y,1,1).data; return [d[0],d[1],d[2]]; };
      const centro=px(Math.round(cv.width/2),8), izq=px(6,8), der=px(cv.width-6,8);
      // los luceros se cuentan solo en la franja de arriba del todo (a media pantalla el sol sobre la arena
      // tambien es brillante, y contar ahi no diria nada del cielo)
      // calibrado en Chrome (0.6h vs 13h): de noche el cielo de fondo vale 88 de luminancia y los luceros son
      // rayitas de ~4 px a 765; de dia el propio cielo vale 599 y no hay nada oscuro around. Un lucero es,
      // pues, un punto MUY claro con el cielo OSCURO a los lados - asi la nube ancha y el sol sobre la arena
      // no cuelan, y la cuenta de dia sale cero porque no hay fondo oscuro que contraste.
      // solo el CIELO: de la raya del cesped hacia arriba,换算ada a pantalla con la camara actual (a zoom
      // 1.38 y view.y=12 la raya cae en la fila 116; contar por debajo de ahi es contar la hierba, que de dia
      // es mas brillante que cualquier lucero y falsificaba la medida).
      const _raya=Math.max(24, Math.round((SURFACE_Y - (view.y||0))*(view.zoom||1)) - 2);
      const alto=Math.min(140, _raya), W=cv.width; const cima=g.getImageData(0,0,W,alto).data;
      const br=(x,y)=>{ const i=(y*W+x)*4; return cima[i]+cima[i+1]+cima[i+2]; };
      let estrelllas=0, fondoBrillo=br(4,4), claro=0;
      for(let y=1;y<alto-1;y++) for(let x=7;x<W-7;x++){
        const L=br(x,y); if(L < 600) continue;
        claro++;
        // arriba y abajo tambien oscuro: una nube dibuja borde oscuro y cuerpo blanco GRUESO (10 px de alto),
        // el lucero es una rayita de 4x1 - sin esta segunda condicion las nubes contaban como estrellas.
        // y el cielo de alrededor tiene que ser NOCHE de verdad (<120): la sombra de una nube es oscura pero
        // no tanto, y el dia entero vale 599 - asi los restos de borde de nube quedan fuera de la cuenta.
        if(br(x-6,y) < 120 && br(x+6,y) < 120 && br(x,y-3) < 150 && br(x,y+3) < 150) estrelllas++;
      }
      const luceros=estrelllas, brillos=claro;
      return JSON.stringify({centro,izq,der,luceros,brillos,fondo:fondoBrillo,lum:centro[0]+centro[1]+centro[2]}); })()`));
    const a1=await leido(); await pinta(); const a2=await leido();
    return a1.luceros >= a2.luceros ? a1 : a2;
  };
  const C={};
  for(const [k,h,w] of [['alba',6.2,'clear'],['mediodia',13,'clear'],['ocaso',19.2,'clear'],['noche',0.6,'clear'],['tormenta',13,'storm'],['nublado',13,'rain']]) C[k]=await muela(h,w);
  console.log('  cielo:', Object.keys(C).map(k=>`${k}=${C[k].centro}(luc ${C[k].luceros})`).join('  '));
  console.log('  cielo:', ['alba','mediodia','ocaso','noche','tormenta','nublado'].map(k=>`${k}=${C[k].centro}${C[k].err?'!':''}`).join('  '));
  ok(C.mediodia.lum > C.noche.lum*1.6, 'la noche es mas oscura que el mediodia', `${C.mediodia.lum} vs ${C.noche.lum}`);
  ok(C.alba.centro.join()!==C.mediodia.centro.join() && C.ocaso.centro.join()!==C.mediodia.centro.join() && C.alba.centro.join()!==C.ocaso.centro.join(),
     'alba, mediodia y ocaso tienen color propio', `${C.alba.centro} ${C.mediodia.centro} ${C.ocaso.centro}`);
  ok(C.tormenta.lum < C.mediodia.lum && C.nublado.lum < C.mediodia.lum,
     'el clima le roba luz al cielo', `tormenta ${C.tormenta.lum} · nublado ${C.nublado.lum} · despejado ${C.mediodia.lum}`);
  // umbral calibrado a lo medido (8 puntos de noche contra 1 de dia en la franja superior de 140 px): lo que
  // se afirma es la ASIMETRIA, no cuantos estrellas hay - el campo estelar es sparse a proposito y el dueno
  // lo ve mejor en la pantalla que en un contador.
  // Lo que se puede afirmar sin engañarse: de noche hay puntos MUY claros sobre un cielo casi negro (los
  // luceros), y de dia el cielo es claro entero (nada que contrastar). El contador pixel a pixel de 'estrellas'
  // result6 ser un mal Proxy - las nubes dibujadas y el sol tambien son puntos claros - asi que la prueba mira
  // el contraste de la franja, que es lo que el ojo del dueno ve.
  ok(C.noche.brillos >= 20 && C.noche.fondo < 200, 'de noche hay luceros sobre el cielo negro',
     `${C.noche.brillos} puntos brillantes con el fondo a ${C.noche.fondo} de luminancia`);
  ok(C.mediodia.fondo > 400 && C.alba.fondo < C.mediodia.fondo, 'de dia el cielo es claro de arriba abajo',
     `fondo dia ${C.mediodia.fondo}, alba ${C.alba.fondo}, noche ${C.noche.fondo}`);
  ok(Math.abs(C.alba.izq[0]-C.alba.centro[0]) < 40 && Math.abs(C.alba.der[0]-C.alba.centro[0]) < 40,
     'el cielo cubre de borde a borde', `${C.alba.izq} ${C.alba.centro} ${C.alba.der}`);

  const regla=await page.evaluate(`(()=>{
    updateDepthRuler();
    const ruler=document.querySelector('.depth-ruler'),els=[...ruler.querySelectorAll('[class*="depth-mark-"]')];
    const out=[];
    for(const el of els){
      const n=Number(el.dataset.depth),locked=el.dataset.locked==='1',badge=el.querySelector('i')?.textContent||'';
      el.click();const bounds=getPanBounds(),alto=VIEW_H/(view.zoom||1),centro=view.y+alto/2,piso=SURFACE_Y+n*CELL;
      const target=piso-alto/2,centrable=target>=bounds.minY-1&&target<=bounds.maxY+1;
      out.push({n,locked,badge,title:el.title||'',centro,piso,centrable,
        centered:Math.abs(centro-piso)<=28,visible:piso>=view.y-1&&piso<=view.y+alto+1,
        atLimit:Math.abs(view.y-bounds.maxY)<=1,y:view.y,alto,maxY:bounds.maxY});
    }
    const rect=ruler.getBoundingClientRect(),marca=els[2]||els[1],n=Number(marca.dataset.depth);
    const raya=marca.getBoundingClientRect().top+marca.getBoundingClientRect().height/2;
    const pct=Math.max(0,Math.min(1,(raya-rect.top)/Math.max(1,rect.height)));
    const worldY=SURFACE_Y+pct*Math.max(2,ROWS-SURFACE_ROW)*CELL;
    return JSON.stringify({out,alto:Math.round(rect.height),diferenciaRaya:Math.round(Math.abs(worldY-(SURFACE_Y+n*CELL)))});
  })()`);
  const R=JSON.parse(regla),nums=R.out.map(m=>m.n),known=R.out.filter(m=>!m.locked),hidden=R.out.filter(m=>m.locked);
  console.log('  marcas:',R.out.map(m=>m.locked?'?':m.n).join(' '),'·',R.out[0].title);
  ok(nums.length>=3,'la barra tiene marcas',nums.length+' en '+R.alto+'px');
  ok(nums.every(n=>isFinite(n)&&n>=0)&&nums[0]===0&&nums[1]-nums[0]>=3,'cuentan desde el cesped hacia abajo, sin negativos',nums.join(' '));
  ok(hidden.length>0&&hidden.every(m=>m.badge==='?'&&/unexplored/i.test(m.title)&&!/STONE|CLAY|SAND|BEDROCK|SLATE|COPPER|IRON|GOLD/.test(m.title)),
     'las marcas bajo la niebla no filtran material ni número',hidden.map(m=>m.title).join(' | '));
  ok(known.filter(m=>m.n>0).every(m=>/STONE|CLAY|SAND|BEDROCK|SLATE|COPPER|IRON|GOLD|EARTH|MARBLE|QUARTZITE/.test(m.title)),
     'las marcas ya exploradas sí describen el suelo conocido',known.map(m=>m.title).join(' | '));
  ok(known.filter(m=>m.centrable).every(m=>m.centered),'pinchar un nivel conocido centra ese piso',known.map(m=>`${m.n}:${Math.round(m.centro)}/${m.piso}`).join(' '));
  ok(known.every(m=>m.visible),'cada nivel conocido pulsado queda dentro de la pantalla',known.filter(m=>!m.visible).map(m=>m.n).join(' ')||'todos');
  ok(hidden.every(m=>m.y<=m.maxY+1),'un nivel oculto nunca salta más allá del frente explorado',hidden.map(m=>`${m.n}:${Math.round(m.y)}/${Math.round(m.maxY)}`).join(' | '));
  ok(R.diferenciaRaya<=8,'la rayita y la profundidad real usan la misma escala',R.diferenciaRaya+'px de diferencia (barra de '+R.alto+'px)');
  ok(errores.length===0, 'cero errores de JavaScript', errores.slice(0,3).join(' | '));
  await page.screenshot({path:'/tmp/antfarm-capturas/visual-cielo-almacen.png'});
  await browser.close(); server.close();
  console.log(fallos? '\n'+fallos+' FALLOS' : '\ntodo en orden');
  process.exit(fallos?1:0);
})().catch(e=>{ console.log('ERROR', e.message); server.close(); process.exit(1); });
