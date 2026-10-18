// core/agua.js — deterministic, mass-conserving cellular water.
// No DOM and no game state: the app supplies its water/soil grids, rain and evaporation.
'use strict';

function _waterNumber(value){
  const n=Number(value);
  return Number.isFinite(n) && n>0?n:0;
}
function waterMass(grid){
  let total=0;
  if(!Array.isArray(grid)) return total;
  for(const row of grid) if(Array.isArray(row)) for(const value of row) total+=_waterNumber(value);
  return total;
}
function _waterBlocked(barriers,r,c){
  if(!barriers) return false;
  if(typeof barriers.has==='function') return barriers.has(c+','+r);
  return !!(barriers[r]&&barriers[r][c]);
}
function _waterOpen(soil,r,c,barriers){
  return !!(soil && soil[r]) && c>=0 && c<soil[r].length && soil[r][c]===0&&!_waterBlocked(barriers,r,c);
}

// Sources may temporarily pressurise a cell above 1. stepWaterGrid moves that excess instead of
// deleting it. This is what lets a full pit rise to its lip and spill into the next chamber.
function addWaterMass(grid,soil,c,r,amount,barriers){
  const add=_waterNumber(amount);
  if(!add || !Array.isArray(grid) || !grid[r] || !_waterOpen(soil,r,c,barriers)) return 0;
  grid[r][c]=_waterNumber(grid[r][c])+add;
  return add;
}

// Used when ants seal a wet cell: the plug occupies volume, so its water is pushed into the nearest
// connected open cells rather than vanishing. If every neighbour is sealed, pressure is retained in
// the nearest open cell that can be found.
function displaceWaterMass(grid,soil,c,r,amount,barriers){
  let left=_waterNumber(amount);
  if(!left || !Array.isArray(grid) || !Array.isArray(soil)) return 0;
  const rows=soil.length, cols=soil[0]?soil[0].length:0;
  const queue=[];
  for(const d of [[1,0],[0,-1],[0,1],[-1,0]]) queue.push([r+d[0],c+d[1]]); // down, sides, up
  const seen=new Set([r+','+c]);
  let firstOpen=null, head=0;
  while(head<queue.length && head<rows*cols && left>1e-9){
    const p=queue[head++], rr=p[0], cc=p[1], key=rr+','+cc;
    if(seen.has(key)) continue; seen.add(key);
    if(rr<0||rr>=rows||cc<0||cc>=cols||!_waterOpen(soil,rr,cc,barriers)) continue;
    if(!grid[rr]) grid[rr]=new Array(cols).fill(0);
    if(!firstOpen) firstOpen=[rr,cc];
    const room=Math.max(0,1-_waterNumber(grid[rr][cc]));
    const moved=Math.min(left,room);
    if(moved){ grid[rr][cc]=_waterNumber(grid[rr][cc])+moved; left-=moved; }
    for(const d of [[1,0],[0,-1],[0,1],[-1,0]]) queue.push([rr+d[0],cc+d[1]]);
  }
  if(left>1e-9 && firstOpen){
    const rr=firstOpen[0],cc=firstOpen[1];
    grid[rr][cc]=_waterNumber(grid[rr][cc])+left; left=0; // pressure; the next step resolves it
  }
  return _waterNumber(amount)-left;
}

function stepWaterGrid(grid,soil,options){
  const opts=options||{}, barriers=opts.barriers||null;
  if(!Array.isArray(grid)||!Array.isArray(soil)||!soil.length) return {moved:0,overflow:0,mass:0};
  const rows=Math.min(grid.length,soil.length), cols=soil[0]?soil[0].length:0;
  const dt=Math.max(0.1,Math.min(8,_waterNumber(opts.dt)||1));
  const passes=Math.max(1,Math.min(4,opts.passes|0||2));
  const fallCap=Math.min(1,0.18+dt*0.09);
  const sideCap=Math.min(0.55,0.07+dt*0.045);
  const pressureCap=Math.min(1,0.22+dt*0.10);
  let moved=0,overflow=0;
  const basePhase=opts.phase|0;
  const onFlow=typeof opts.onFlow==='function'?opts.onFlow:null;
  const emit=(fc,fr,tc,tr,amount,kind)=>{ if(onFlow&&amount>1e-9){ try{ onFlow(fc,fr,tc,tr,amount,kind); }catch(_e){} } };

  for(let pass=0;pass<passes;pass++){
    // Terrain can change between steps (an ant just placed a plug). Preserve any water that now sits
    // in solid by displacing it before the normal flow pass.
    for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){
      if(_waterOpen(soil,r,c,barriers)||!_waterNumber(grid[r]&&grid[r][c])) continue;
      const amount=_waterNumber(grid[r][c]); grid[r][c]=0;
      const shifted=displaceWaterMass(grid,soil,c,r,amount,barriers);
      if(shifted<amount-1e-9) grid[r][c]=amount-shifted; // sealed everywhere: retain pressure until an outlet exists
      moved+=shifted; if(shifted) overflow++;
    }

    // Gravity first. Iterating from the bottom upward lets a column settle without teleporting a whole
    // lake through several cells in one pass.
    for(let r=rows-2;r>=0;r--){
      for(let c=0;c<cols;c++){
        if(!_waterOpen(soil,r,c,barriers)||!_waterOpen(soil,r+1,c,barriers)) continue;
        const here=_waterNumber(grid[r][c]); if(here<=1e-9) continue;
        const below=_waterNumber(grid[r+1][c]), room=Math.max(0,1-below);
        const flow=Math.min(here,room,fallCap);
        if(flow>1e-9){ grid[r][c]=here-flow; grid[r+1][c]=below+flow; moved+=flow; emit(c,r,c,r+1,flow,'fall'); }
      }
    }

    // Supported water seeks its own level. A side cell with empty space below is a spill lip: water
    // crosses it and gravity carries it into the next chamber on the following pass.
    for(let r=rows-1;r>=0;r--){
      const reverse=((basePhase+pass+r)&1)===1;
      for(let i=0;i<cols;i++){
        const c=reverse?cols-1-i:i;
        if(!_waterOpen(soil,r,c,barriers)) continue;
        let here=_waterNumber(grid[r][c]); if(here<=0.015) continue;
        const supported=r===rows-1 || !_waterOpen(soil,r+1,c,barriers) || _waterNumber(grid[r+1]&&grid[r+1][c])>0.82 || here>1;
        if(!supported) continue;
        const dirs=((basePhase+pass+c)&1)?[-1,1]:[1,-1];
        for(const dc of dirs){
          const nc=c+dc; if(nc<0||nc>=cols||!_waterOpen(soil,r,nc,barriers)) continue;
          const side=_waterNumber(grid[r][nc]), diff=here-side;
          if(diff<=0.035) continue;
          const room=Math.max(0,1-side);
          const flow=Math.min(here,room,diff*0.5,sideCap);
          if(flow<=1e-9) continue;
          grid[r][c]=here-flow; grid[r][nc]=side+flow; here-=flow; moved+=flow; emit(c,r,nc,r,flow,'side');
          if(r+1<rows && _waterOpen(soil,r+1,nc,barriers) && _waterNumber(grid[r+1][nc])<0.15) overflow++;
        }
      }
    }

    // Pressure cannot be clamped away. If a sealed lower cell exceeds one cell-volume, the excess
    // rises; from there the lateral pass can carry it over the rim.
    for(let r=rows-1;r>0;r--){
      for(let c=0;c<cols;c++){
        if(!_waterOpen(soil,r,c,barriers)) continue;
        const here=_waterNumber(grid[r][c]); if(here<=1.000001||!_waterOpen(soil,r-1,c,barriers)) continue;
        const above=_waterNumber(grid[r-1][c]), room=Math.max(0,1-above);
        const flow=Math.min(here-1,room,pressureCap);
        if(flow>1e-9){ grid[r][c]=here-flow; grid[r-1][c]=above+flow; moved+=flow; overflow++; emit(c,r,c,r-1,flow,'rise'); }
      }
    }
  }

  // Numerical hygiene only; never clamp a legitimate pressure value because that would destroy mass.
  for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){
    const value=_waterNumber(grid[r]&&grid[r][c]);
    grid[r][c]=value<1e-8?0:value;
  }
  return {moved,overflow,mass:waterMass(grid)};
}

if(typeof module!=='undefined'&&module.exports){
  module.exports={addWaterMass,displaceWaterMass,stepWaterGrid,waterMass};
}
