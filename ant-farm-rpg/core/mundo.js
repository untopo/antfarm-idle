// core/mundo.js — deterministic geology, biomes and the hidden history of one world.
//
// The generator knows what happened; the player only sees physical traces. Nothing here produces
// exposition, culture names or a solved story. app.js turns this data into mixed strata, damaged rooms,
// faded wall art and finite water pockets as new depth is unlocked.
'use strict';

let _WORLD_NODE_BANDS=null;
try{ if(typeof module!=='undefined'&&module.exports) _WORLD_NODE_BANDS=require('./bandas.js').BANDAS; }catch(_e){}
function _worldBands(){
  try{ if(typeof BANDAS!=='undefined'&&Array.isArray(BANDAS)) return BANDAS; }catch(_e){}
  return _WORLD_NODE_BANDS||[
    {desde:0,tipo:1},{desde:3,tipo:2},{desde:8,tipo:3},{desde:14,tipo:4},{desde:22,tipo:6},
    {desde:30,tipo:11},{desde:38,tipo:12},{desde:46,tipo:13},{desde:55,tipo:14}
  ];
}
function worldSeed32(value){
  let n=Number(value);
  if(Number.isFinite(n)) return (n>>>0)||0x6d2b79f5;
  const s=String(value==null?'':value); n=2166136261;
  for(let i=0;i<s.length;i++){ n^=s.charCodeAt(i); n=Math.imul(n,16777619); }
  return (n>>>0)||0x6d2b79f5;
}
function worldMix32(n){
  n=(n^61)^(n>>>16); n=Math.imul(n,9); n=n^(n>>>4); n=Math.imul(n,0x27d4eb2d); n=n^(n>>>15);
  return n>>>0;
}
function worldHash(seed,x,y=0,salt=0){
  const n=(worldSeed32(seed)^Math.imul((x|0)+0x9e37,0x85ebca6b)^Math.imul((y|0)+0x7f4a,0xc2b2ae35)^Math.imul((salt|0)+17,0x27d4eb2d))>>>0;
  return worldMix32(n)/4294967296;
}
function _worldSmooth(t){ return t*t*(3-2*t); }
function worldNoise2(seed,x,y,salt=0){
  const x0=Math.floor(x),y0=Math.floor(y),tx=_worldSmooth(x-x0),ty=_worldSmooth(y-y0);
  const a=worldHash(seed,x0,y0,salt),b=worldHash(seed,x0+1,y0,salt),c=worldHash(seed,x0,y0+1,salt),d=worldHash(seed,x0+1,y0+1,salt);
  const ab=a+(b-a)*tx, cd=c+(d-c)*tx;
  return ab+(cd-ab)*ty;
}
function worldBandAt(depth,bands){
  const bs=bands||_worldBands(); let out=0;
  for(let i=0;i<bs.length;i++) if(depth>=bs[i].desde) out=i;
  return Math.max(0,Math.min(bs.length-1,out));
}

// Depth determines what dominates, not an absolute horizontal stripe. Broad coordinate noise bends the
// strata while a second field creates lenses from the neighbouring layer. A deeper intrusion can peek a
// few rows upward, but it cannot pull end-game rock into the founding chamber.
function worldGeologyHost(seed,c,depth,bands){
  const bs=bands||_worldBands(), d=Math.max(0,Number(depth)||0);
  const broad=(worldNoise2(seed,c*0.085,d*0.055,101)-0.5)*7.0;
  const fold=(worldNoise2(seed,c*0.19,d*0.12,102)-0.5)*2.8;
  const local=Math.max(0,d+broad+fold);
  let bi=worldBandAt(local,bs);
  const lens=worldNoise2(seed,c*0.23,d*0.21,103);
  if(lens<0.115&&bi>0) bi--;
  else if(lens>0.93&&bi<bs.length-1&&d>=bs[bi+1].desde-4) bi++;
  // Near the meadow, clay and sand form pockets rather than ruler-straight floors.
  if(d<14){
    const soft=worldNoise2(seed,c*0.16,d*0.28,104);
    if(d>2&&soft<0.22) return 2;
    if(d>5&&soft>0.79) return 3;
    if(d>11&&worldHash(seed,c,Math.floor(d),105)<0.055) return 4;
  }
  return bs[bi].tipo;
}

const WORLD_DEPOSITS=[
  {type:8,  center:18, core:9,  trace:16, salt:801}, // copper
  {type:9,  center:27, core:9,  trace:13, salt:802}, // iron
  {type:10, center:35, core:7,  trace:13, salt:803}, // gold
  {type:16, center:44, core:10, trace:17, salt:804}, // crystal/gem seam
  {type:18, center:50, core:10, trace:18, salt:805}, // rock salt
];
// Deposits follow contour lines in a smooth field, producing crooked seams with poor edges and an
// occasional isolated inclusion. Most material remains near its useful depth, but traces can exist on
// either side: progression comes from abundance and tools, not a magical zero/one boundary.
function worldDepositAt(seed,c,depth){
  const d=Math.max(0,Number(depth)||0); let pick=0,best=-1;
  for(const q of WORLD_DEPOSITS){
    const dist=Math.abs(d-q.center); if(dist>q.trace) continue;
    const core=Math.max(0,1-dist/q.core), fringe=Math.max(0,1-dist/q.trace);
    const n=worldNoise2(seed,c*0.205,d*0.265,q.salt);
    const ridge=1-Math.abs(n*2-1); // connected contour, rather than circular ore blobs
    const threshold=0.996-core*0.032-fringe*0.006;
    const isolated=worldHash(seed,c,Math.floor(d),q.salt+90)<(0.0011+core*0.0019);
    const score=(ridge-threshold)+(isolated?0.18:0);
    if(score>0&&score>best){ best=score; pick=q.type; }
  }
  return pick;
}

const WORLD_BIOMES={
  roots:{id:'roots',humidity:0.48}, clay_basin:{id:'clay_basin',humidity:0.78}, dry_vault:{id:'dry_vault',humidity:0.12},
  stone_fault:{id:'stone_fault',humidity:0.30}, fungal:{id:'fungal',humidity:0.72}, crystal_fault:{id:'crystal_fault',humidity:0.26},
  drowned:{id:'drowned',humidity:0.94}, thermal:{id:'thermal',humidity:0.08}
};
function worldBiomeAt(seed,c,depth){
  const d=Math.max(0,Number(depth)||0);
  if(d<7) return WORLD_BIOMES.roots;
  if(d>53) return WORLD_BIOMES.thermal;
  const wet=worldNoise2(seed,c*0.065,d*0.09,301);
  const mineral=worldNoise2(seed,c*0.11,d*0.075,302);
  if(d>20&&wet>0.84) return WORLD_BIOMES.drowned;
  if(d>12&&wet>0.69) return WORLD_BIOMES.fungal;
  if(d>27&&mineral>0.72) return WORLD_BIOMES.crystal_fault;
  if(wet<0.18) return WORLD_BIOMES.dry_vault;
  if(d<18&&wet>0.57) return WORLD_BIOMES.clay_basin;
  return WORLD_BIOMES.stone_fault;
}

// Caves uncovered behind a slab belong to the world seed too. Using Math.random here used to make the
// same saved world reveal a different room and could erase almost an entire ore seam on one run. Loot
// choice may still be discovered later, but the physical void and its candidate sites never reroll.
function worldCavesForRange(seed,cols,oldRows,newRows){
  const s=worldSeed32(seed),w=Math.max(12,Math.floor(Number(cols)||12));
  const lo=Math.max(0,Math.floor(Number(oldRows)||0)),hi=Math.max(lo+3,Math.floor(Number(newRows)||lo+3));
  const roomSpan=Math.max(1,hi-lo-2),count=1+Math.floor(worldHash(s,lo,hi,1601)*2),out=[];
  for(let i=0;i<count;i++){
    const rx=5+Math.floor(worldHash(s,lo+i,hi,1602)*Math.max(1,w-10));
    const ry=Math.min(hi-3,lo+1+Math.floor(worldHash(s,lo+i,hi,1603)*roomSpan));
    const rxr=3+Math.floor(worldHash(s,lo+i,hi,1604)*3),ryr=2+Math.floor(worldHash(s,lo+i,hi,1605)*2),loot=[];
    for(let a=0;a<6;a++) loot.push({
      c:rx-3+Math.floor(worldHash(s,lo+i*11+a,hi,1610+a)*7),
      r:Math.min(hi-2,ry+1+Math.floor(worldHash(s,lo+i*13+a,hi,1620+a)*3))
    });
    out.push({rx,ry,rxr,ryr,loot});
  }
  return out;
}

const WORLD_STYLE_PALETTES=[
  ['#9b3f2b','#d58a4f','#39251e'], ['#486f78','#89a9a4','#293d42'], ['#72518c','#b08ac1','#2b2134'],
  ['#8a7438','#c7ad63','#352e1e'], ['#4f7650','#88a96f','#263628']
];
const WORLD_MOTIFS=['tide','rings','network','procession','split','brood'];
const WORLD_COLLAPSES=['water','roots','subsidence','sealed','heat','abandonment'];
function createWorldProfile(seed,cols){
  const s=worldSeed32(seed), n=2+Math.floor(worldHash(s,cols,0,401)*3), styles=[];
  for(let i=0;i<n;i++){
    styles.push({
      palette:WORLD_STYLE_PALETTES[Math.floor(worldHash(s,i,1,402)*WORLD_STYLE_PALETTES.length)],
      motif:WORLD_MOTIFS[Math.floor(worldHash(s,i,2,403)*WORLD_MOTIFS.length)],
      joint:worldHash(s,i,3,404)<0.5?'resin':'clay',
      stroke:worldHash(s,i,4,405)<0.72?1:2
    });
  }
  // This causal timeline is intentionally internal. It keeps evidence coherent but is never prose for UI.
  const cycles=styles.map((style,i)=>({style:i,collapse:WORLD_COLLAPSES[Math.floor(worldHash(s,i,5,406)*WORLD_COLLAPSES.length)],age:2+Math.floor(worldHash(s,i,6,407)*9)}));
  return {version:1,seed:s,cols:cols|0,styles,cycles};
}
function _siteKind(depth,biome,r){
  if(biome.id==='drowned'||r<0.16) return 'waterworks';
  if(biome.id==='fungal'||(depth>18&&r<0.34)) return 'garden';
  if(depth>38&&r>0.78) return 'royal_hollow';
  if(depth>25&&r>0.58) return 'sealed_brood';
  if(biome.id==='crystal_fault') return 'old_gallery';
  return r<0.52?'old_gallery':'resin_span';
}
// Sites are derived from depth chunks, so generating rows lazily yields the same world as generating it
// all at once. IDs let app.js avoid materialising the same ruin twice after save/load or expansion.
function worldSitesForRange(profile,cols,startDepth,endDepth){
  if(!profile) return [];
  // Keep the founding soil legible. The first damaged works can only enter after a real descent;
  // deeper chunks then decide their own sparse spacing. Centres stay strictly inside the requested
  // slice so lazy expansion cannot mark an as-yet-unbuilt site as already materialised.
  const s=worldSeed32(profile.seed), requestedHi=Math.floor(endDepth);
  if(requestedHi<15) return [];
  const lo=Math.max(15,Math.floor(startDepth)), hi=Math.max(lo,requestedHi);
  const first=Math.floor(lo/7), last=Math.floor(hi/7), out=[];
  for(let chunk=first;chunk<=last;chunk++){
    const depth=chunk*7+3;
    if(depth<lo||depth>hi) continue;
    const chance=Math.min(0.72,0.30+depth*0.006);
    if(worldHash(s,chunk,0,501)>chance) continue;
    const margin=Math.min(7,Math.max(3,Math.floor(cols/8)));
    let c=margin+Math.floor(worldHash(s,chunk,1,502)*Math.max(1,cols-margin*2));
    const half=Math.max(4,Math.floor(cols*0.10));
    if(Math.abs(c-cols/2)<half) c=c<cols/2?Math.max(margin,c-half):Math.min(cols-margin-1,c+half);
    const biome=worldBiomeAt(s,c,depth), roll=worldHash(s,chunk,2,503);
    const w=Math.max(6,Math.min(cols-4,7+Math.floor(worldHash(s,chunk,3,504)*7)));
    const h=4+Math.floor(worldHash(s,chunk,4,505)*4);
    // Nearby depths belong to the same hidden occupation cycle. Its failure mode biases the physical
    // evidence, while occasional later repairs use another established style. The causal labels never
    // need to reach UI; they exist so repeated colours, scars and room forms agree with one another.
    const eraSpan=18+(s%7),era=Math.abs(Math.floor((depth+(s%11))/eraSpan))%Math.max(1,profile.cycles.length);
    const cycle=profile.cycles[era]||{style:0,collapse:'abandonment',age:5};
    const style=cycle.style%Math.max(1,profile.styles.length);
    let kind=_siteKind(depth,biome,roll);
    if(cycle.collapse==='water'&&roll<0.82) kind='waterworks';
    else if(cycle.collapse==='roots'&&roll<0.72) kind=biome.id==='fungal'?'garden':'resin_span';
    else if(cycle.collapse==='sealed'&&depth>24&&roll<0.76) kind='sealed_brood';
    else if(cycle.collapse==='subsidence'&&roll<0.68) kind=depth>38?'royal_hollow':'old_gallery';
    else if(cycle.collapse==='heat'&&roll<0.74) kind='old_gallery';
    const damage=Math.min(0.76,0.16+cycle.age*0.025+worldHash(s,chunk,6,507)*0.27+(cycle.collapse==='subsidence'?0.10:0));
    const nextCycle=profile.cycles[(era+1)%profile.cycles.length]||cycle;
    const repaired=nextCycle.style!==style&&worldHash(s,chunk,8,509)<0.44;
    const flood=(cycle.collapse==='water'||kind==='waterworks'||biome.id==='drowned')?(0.25+worldHash(s,chunk,7,508)*0.58):0;
    const oddityRoll=worldHash(s,chunk,10,511),oddity=oddityRoll<0.018?1+Math.floor(worldHash(s,chunk,11,512)*3):0;
    out.push({id:'buried-'+chunk,c,depth,w,h,style,kind,biome:biome.id,damage,flood,
      cycle:era,scar:cycle.collapse,repairStyle:repaired?nextCycle.style:null,repairRate:repaired?(0.10+worldHash(s,chunk,9,510)*0.24):0,oddity,
      muralSeed:worldMix32(s^Math.imul(chunk+11,0x9e3779b1))});
  }
  return out;
}

if(typeof module!=='undefined'&&module.exports){
  module.exports={WORLD_DEPOSITS,WORLD_BIOMES,worldSeed32,worldMix32,worldHash,worldNoise2,worldBandAt,
    worldGeologyHost,worldDepositAt,worldBiomeAt,worldCavesForRange,createWorldProfile,worldSitesForRange};
}
