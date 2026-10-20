'use strict';
// ANT FARM texture-pack runtime. The generated manifest is the only coordinate source: callers draw
// stable sprite names and never know where a tile lives inside colony-atlas.png.
(function(root){
  const manifest=root&&root.COLONY_TEXTURE_MANIFEST;
  const state={status:manifest?'loading':'missing-manifest',error:null,image:null,draws:0,misses:0};
  const listeners=[];
  const notify=()=>{while(listeners.length){try{listeners.shift()(api);}catch(_){}}};
  const sprite=name=>manifest&&manifest.sprites?manifest.sprites[String(name||'')]||null:null;
  const imagePath=()=>{
    if(!manifest)return '';
    // index.html is the game root; the manifest and PNG live together under assets/textures.
    return 'assets/textures/'+manifest.meta.image+'?v='+encodeURIComponent(manifest.meta.version||'1');
  };
  function load(){
    if(!manifest||typeof Image==='undefined'){if(!manifest)state.error='manifest unavailable';return api;}
    const img=new Image();state.image=img;img.decoding='async';
    img.onload=()=>{state.status='ready';state.error=null;notify();};
    img.onerror=()=>{state.status='error';state.error='atlas image failed to load';notify();};
    img.src=imagePath();return api;
  }
  function draw(ctx,name,x,y,w,h,options){
    const s=sprite(name),img=state.image,o=options||{};
    if(!ctx||!s||state.status!=='ready'||!img){state.misses++;return false;}
    const dw=Number.isFinite(Number(w))?Number(w):(s.native&&s.native.w)||s.w;
    const dh=Number.isFinite(Number(h))?Number(h):(s.native&&s.native.h)||s.h;
    const dx=Math.round(Number(x)||0),dy=Math.round(Number(y)||0);
    ctx.save();ctx.imageSmoothingEnabled=false;
    if(o.alpha!==undefined)ctx.globalAlpha*=Math.max(0,Math.min(1,Number(o.alpha)||0));
    if(o.flipX||o.flipY){
      ctx.translate(dx+(o.flipX?dw:0),dy+(o.flipY?dh:0));ctx.scale(o.flipX?-1:1,o.flipY?-1:1);
      ctx.drawImage(img,s.x,s.y,s.w,s.h,0,0,dw,dh);
    }else ctx.drawImage(img,s.x,s.y,s.w,s.h,dx,dy,dw,dh);
    ctx.restore();state.draws++;return true;
  }
  function drawAt(ctx,name,x,y,scale,options){
    const s=sprite(name);if(!s)return false;
    const k=Number.isFinite(Number(scale))?Number(scale):1,n=s.native||{w:s.w,h:s.h},p=s.pivot||{x:n.w/2,y:n.h};
    return draw(ctx,name,Number(x)-p.x*k,Number(y)-p.y*k,n.w*k,n.h*k,options);
  }
  const api={
    manifest,
    state,
    load,
    has:name=>!!sprite(name),
    sprite:name=>{const s=sprite(name);return s?JSON.parse(JSON.stringify(s)):null;},
    draw,
    drawAt,
    ready(){return state.status==='ready';},
    whenReady(fn){if(typeof fn!=='function')return api;if(state.status==='ready'||state.status==='error'||state.status==='missing-manifest')fn(api);else listeners.push(fn);return api;},
    stats(){return {status:state.status,draws:state.draws,misses:state.misses,sprites:manifest?Object.keys(manifest.sprites||{}).length:0};}
  };
  if(root)root.colonyTexturePack=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
  load();
})(typeof globalThis!=='undefined'?globalThis:this);
