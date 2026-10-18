'use strict';
const {ctx,vm}=require('./world-perf-proflib.js');
const run=code=>vm.runInContext(code,ctx);
let ok=0,fail=0;
function check(v,m){if(v){ok++;console.log('ok   '+m);}else{fail++;console.error('FAIL '+m);}}

const stats=run(`(function(){
  COLS=96; worldSeed=123456; const g=_buildGeologyRows(0,90),valid=new Set(BANDAS.map(b=>b.tipo));
  let hostValid=true,mixed=0,adj=0,adjN=0,deposits=0,total=0,linked=0; const by={},depths={};
  for(let r=SURFACE_ROW;r<90;r++){
    const row=new Set();
    for(let c=0;c<COLS;c++){
      const h=g.hosts[r][c],t=g.types[r][c]; if(!valid.has(h)) hostValid=false; row.add(h); total++;
      if(c){adjN++;if(g.hosts[r][c-1]===h)adj++;}
      if(_isDepositType(t)){
        deposits++; by[t]=(by[t]||0)+1; (depths[t]||(depths[t]=[])).push(r-SURFACE_ROW);
        if((c&&g.types[r][c-1]===t)||(c+1<COLS&&g.types[r][c+1]===t)||(r>SURFACE_ROW&&g.types[r-1][c]===t)||(r+1<90&&g.types[r+1][c]===t)) linked++;
      }
    }
    if(row.size>1)mixed++;
  }
  let predominant=true;
  for(let i=0;i<BANDAS.length;i++){
    const next=BANDAS[i+1]?BANDAS[i+1].desde:BANDAS[i].desde+12;
    const d=Math.min(next-2,BANDAS[i].desde+Math.max(1,Math.floor((next-BANDAS[i].desde)/2))),row=g.hosts[SURFACE_ROW+d],counts={};
    for(const t of row) counts[t]=(counts[t]||0)+1;
    const winner=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0][0]; if(+winner!==BANDAS[i].tipo) predominant=false;
  }
  return {hostValid,mixed,adj:adj/adjN,deposits,total,rate:deposits/total,linked:linked/Math.max(1,deposits),by,depths,predominant,
    sig:JSON.stringify(g.types),hostSig:JSON.stringify(g.hosts)};
})()`);
check(stats.hostValid,'la integración sólo usa roca anfitriona física válida');
check(stats.predominant,'cada zona mantiene su material predominante al integrarse en el mapa');
check(stats.mixed>45&&stats.adj>0.80,'las capas son onduladas pero continuas ('+stats.mixed+' filas mixtas, '+(stats.adj*100).toFixed(1)+'% vecinos)');
check(stats.rate>0.015&&stats.rate<0.075,'las vetas ocupan una fracción natural del terreno ('+(stats.rate*100).toFixed(2)+'%)');
check(Object.keys(stats.by).length===5,'la integración incluye cobre, hierro, oro, cristal y sal');
check(stats.linked>0.70,'los depósitos integrados son vetas conectadas ('+(stats.linked*100).toFixed(1)+'%)');
const means=Object.keys(stats.depths).sort((a,b)=>+a-+b).map(k=>stats.depths[k].reduce((x,y)=>x+y,0)/stats.depths[k].length);
check(means.every((x,i)=>!i||x>means[i-1]),'la abundancia descubre familias nuevas de forma progresiva ('+means.map(x=>x.toFixed(1)).join(' < ')+')');
check(Object.values(stats.depths).every(a=>new Set(a).size>=4),'ninguna veta queda ordenada en una única fila');

const repeat=run(`(function(){COLS=96;worldSeed=123456;const g=_buildGeologyRows(0,90);return {sig:JSON.stringify(g.types),hostSig:JSON.stringify(g.hosts)}})()`);
check(repeat.sig===stats.sig&&repeat.hostSig===stats.hostSig,'recrear la misma semilla repite cada bloque e inclusión');
const other=run(`(function(){COLS=96;worldSeed=123457;return JSON.stringify(_buildGeologyRows(0,90).types)})()`);
check(other!==stats.sig,'una semilla distinta produce otra geología integrada');

const lazy=run(`(function(){
  COLS=96; let mismatch=0,cells=0;
  for(let seed=1;seed<=40;seed++){
    worldSeed=seed; const all=_buildGeologyRows(0,100);
    for(const cut of [28,36,48,60]){
      const part=_buildGeologyRows(cut,100);
      for(let r=cut;r<100;r++) for(let c=0;c<COLS;c++){cells++; if(all.types[r][c]!==part.types[r-cut][c]||all.hosts[r][c]!==part.hosts[r-cut][c]) mismatch++;}
    }
  }
  return {mismatch,cells};
})()`);
check(lazy.mismatch===0,'generar '+lazy.cells+' celdas por ampliaciones no corta ni rerrollea vetas');

console.log(`\n${fail?'❌ '+fail+' fallos':'✅ '+ok+' ok'} · geología integrada en el mapa`);
if(fail) process.exitCode=1;
