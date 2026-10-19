/* TOPO STUDIOS -> ANT FARM
 * Approved 640x360 voxel intro, block tunnel transition, and living main-menu backdrop.
 * The intro is always shown on a visit, can be skipped/replayed, and becomes a static card when
 * prefers-reduced-motion is enabled. Actual menu actions remain native DOM buttons in app.js.
 */
(function(){
  'use strict';
  const cv=document.getElementById('splashTopo');
  const menuCv=document.getElementById('mainMenuCanvas');
  const revealCv=document.getElementById('topoMenuReveal');
  const splash=document.getElementById('splashScreen');
  const main=document.getElementById('mainMenu');
  if(!cv||!splash) return;
  let g=cv.getContext('2d');
  if(!g) return;
  g.imageSmoothingEnabled=false;

  const W=640,H=360,INTRO_START=450,INTRO_DUR=4800,EXIT_START=5250,MENU_START=5780,MENU_OPEN=6400,DUR=6600;
  const systemReduced=!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  function menuPreferences(){const fallback={motion:'system',ambience:true};try{return {...fallback,...(window.topoGetMenuSettings?window.topoGetMenuSettings():{})}}catch(e){return fallback}}
  function motionIsReduced(){const p=menuPreferences();return p.motion==='reduced'||(p.motion==='system'&&systemReduced)}
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  const smooth=x=>{x=clamp(x);return x*x*(3-2*x)};
  const ease=x=>1-Math.pow(1-clamp(x),3);
  const outBack=x=>{x=clamp(x)-1;return 1+2.3*x*x*x+1.3*x*x};
  const hash=(x,y,s=0)=>{let n=(x*374761393+y*668265263+s*1442695041)|0;n=(n^(n>>>13))*1274126177;return ((n^(n>>>16))>>>0)/4294967295};
  function tint(hex,d){const n=parseInt(hex.slice(1),16),q=c=>Math.max(0,Math.min(255,c+d));return '#'+((q(n>>16)<<16)|(q(n>>8&255)<<8)|q(n&255)).toString(16).padStart(6,'0')}
  function rect(x,y,w,h,c,a=1){g.globalAlpha=a;g.fillStyle=c;g.fillRect(Math.round(x),Math.round(y),Math.max(1,Math.round(w)),Math.max(1,Math.round(h)));g.globalAlpha=1}
  function cube(x,y,w,h,c,k=1){x=Math.round(x);y=Math.round(y);w=Math.max(1,Math.round(w));h=Math.max(1,Math.round(h));rect(x,y,w,h,c);if(h>=3){rect(x,y,w,1,tint(c,Math.round(34*k)));rect(x,y+h-1,w,1,tint(c,-Math.round(42*k)))}if(w>=4&&h>=5)rect(x+w-1,y+1,1,h-2,tint(c,-22));if(w>=8&&h>=8)rect(x+2,y+2,Math.max(1,w-5),1,tint(c,12),.45)}

  const FONT={
    A:['01110','10001','10001','11111','10001','10001','10001'],C:['01111','10000','10000','10000','10000','10000','01111'],D:['11110','10001','10001','10001','10001','10001','11110'],E:['11111','10000','10000','11110','10000','10000','11111'],F:['11111','10000','10000','11110','10000','10000','10000'],G:['01111','10000','10000','10111','10001','10001','01110'],I:['11111','00100','00100','00100','00100','00100','11111'],L:['10000','10000','10000','10000','10000','10000','11111'],M:['10001','11011','10101','10101','10001','10001','10001'],N:['10001','11001','10101','10011','10001','10001','10001'],O:['01110','10001','10001','10001','10001','10001','01110'],P:['11110','10001','10001','11110','10000','10000','10000'],R:['11110','10001','10001','11110','10100','10010','10001'],S:['01111','10000','10000','01110','00001','00001','11110'],T:['11111','00100','00100','00100','00100','00100','00100'],U:['10001','10001','10001','10001','10001','10001','01110'],W:['10001','10001','10001','10101','10101','11011','10001'],Y:['10001','10001','01010','00100','00100','00100','00100']
  };
  function textWidth(text,s){return [...text].reduce((a,ch)=>a+(ch===' '?4:6)*s,0)-s}
  function glyph(ch,x,y,s,face,shine=0){const rows=FONT[ch]||[];rows.forEach((r,yy)=>[...r].forEach((v,xx)=>{if(v!=='1')return;const px=x+xx*s,py=y+yy*s;rect(px+Math.max(2,s*.35),py+Math.max(3,s*.45),s,s,'#100a06');rect(px+s-1,py+2,Math.max(2,s*.32),s-1,tint(face,-48));cube(px,py,s,s,face,.7);if(shine>0&&hash(xx,yy,ch.charCodeAt(0))>1-shine)rect(px+2,py+2,Math.max(1,s-5),1,'#fff0a2')}))}
  function wordChars(text,cx,y,s,face,t,startAt,stagger,offsetFn){let x=Math.round(cx-textWidth(text,s)/2);[...text].forEach((ch,i)=>{if(ch===' '){x+=4*s;return}const q=clamp((t-startAt-i*stagger)/360),show=smooth(q);if(show>0){const off=offsetFn?offsetFn(i,show,q):{x:0,y:0};g.globalAlpha=show;glyph(ch,x+off.x,y+off.y,s,face,q>.85?.16:0);g.globalAlpha=1}x+=6*s})}
  function staticWord(text,cx,y,s,col){wordChars(text,cx,y,s,col,10000,0,0,()=>({x:0,y:0}))}
  function glyphCells(text,cx,y,s,fn){let x=Math.round(cx-textWidth(text,s)/2),letter=0;[...text].forEach(ch=>{if(ch===' '){x+=4*s;return}const rows=FONT[ch]||[];rows.forEach((row,yy)=>[...row].forEach((v,xx)=>{if(v==='1')fn({x:x+xx*s,y:y+yy*s,xx,yy,letter,top:yy===0||!rows[yy-1]||rows[yy-1][xx]!=='1'})}));x+=6*s;letter++})}

  function sky(t){const cols=['#11182d','#19243e','#283653','#495166','#80645f','#bd7754'];cols.forEach((c,i)=>rect(0,i*228/cols.length,W,228/cols.length+1,c));for(let i=0;i<37;i++){if((Math.floor(t/360)+i*3)%19===0)continue;const x=Math.floor(hash(i,2,80)*W),y=9+Math.floor(hash(i,3,81)*135),sz=i%13===0?2:1;rect(x,y,sz,sz,i%6===0?'#ffe08b':'#dce5f0',.55+.45*smooth(t/500))}}
  function moon(){const x=548,y=32;cube(x+8,y,34,42,'#ead9a5');cube(x,y+8,50,28,'#ead9a5');rect(x+10,y+10,8,6,'#a99c7b');rect(x+31,y+26,7,6,'#b8aa86');rect(x+34,y+9,5,4,'#c8ba94');rect(x+4,y+12,2,19,'#fff0c2',.5)}
  function cloud(x,y,scale=1){cube(x,y,48*scale,11*scale,'#d8c6b4',.35);cube(x+12*scale,y-8*scale,32*scale,12*scale,'#eee2cf',.35);rect(x+2*scale,y+9*scale,44*scale,3*scale,'#9a8b82')}
  function hills(t){const far='#30384d',near='#39443e';for(let x=0;x<W;x+=20){const h=18+Math.floor(hash(x,1,55)*29);rect(x,228-h,22,h,far)}for(let x=0;x<W;x+=16){const h=8+Math.floor(hash(x,2,56)*18);rect(x,228-h,18,h,near)}for(let x=35;x<W;x+=95){const sway=Math.round(Math.sin(t*.002+x)*2);rect(x+sway,197,3,31,'#28342b');rect(x-9+sway,203,12,3,'#28342b');rect(x+2+sway,211,11,3,'#28342b')}}
  function terrain(t){const gy=228,pal=['#3f6728','#76502c','#8e5c33','#a66d3d','#bb824c','#cea061','#dfb779'];for(let y=gy;y<H;y+=16)for(let x=0;x<W;x+=16){const row=(y-gy)/16,c=pal[Math.min(pal.length-1,row|0)];cube(x,y,16,16,tint(c,Math.floor((hash(x/16,y/16,5)-.5)*18)),.55)}for(let x=0;x<W;x+=16){cube(x,gy-9,16,12,tint('#3f7428',Math.floor((hash(x,7,3)-.5)*16)),.6);const h=4+Math.floor(hash(x,9,4)*9),sway=Math.round(Math.sin(t*.003+x*.07)*1.5);rect(x+3+sway,gy-9-h,2,h,'#62a936');if(x%48===0)rect(x+9-sway,gy-11-h/2,2,h/2+2,'#80c449')}for(let i=0;i<28;i++){const x=Math.floor(hash(i,11,1)*W/4)*4,y=247+Math.floor(hash(i,13,2)*92);rect(x,y,2,10+(i%5)*6,'#57321a');if(i%2===0)rect(x-6,y+10+(i%4)*4,8,2,'#57321a');if(i%7===0)rect(x+1,y+24,6,2,'#704321')}for(let i=0;i<23;i++){const x=Math.floor(hash(i,17,2)*W),y=240+Math.floor(hash(i,19,4)*105);cube(x,y,5+i%5,3+i%3,i%3?'#85776d':'#68645f',.4)}rect(83,305,22,3,'#d2b37a');rect(83,296,3,10,'#d2b37a');rect(91,299,14,3,'#d2b37a')}
  function beetle(t){if(t>1510)return;const q=smooth((t-250)/1180),x=221-q*252,y=216+Math.round(Math.sin(t*.035));cube(x,y,11,7,'#2a1715');rect(x+2,y+2,3,2,'#b7472f');const step=Math.floor(t/95)%2;rect(x-3,y+1+step,3,2,'#130a08');rect(x+11,y+3-step,3,2,'#130a08');rect(x+1,y+7,2,2+step,'#130a08');rect(x+8,y+7,2,3-step,'#130a08')}
  function mouth(cx,gy,p){const w=Math.round(70*p);rect(cx-w/2,gy-7,w,33,'#170b06');rect(cx-w/2+8,gy-7,Math.max(1,w-16),5,'#020101');rect(cx-w/2+5,gy+21,Math.max(1,w-10),4,'#291408')}
  function cracks(cx,gy,p){if(p<=0)return;const n=Math.floor(p*8);for(let i=0;i<n;i++){rect(cx+(i%2?1:-1)*i*3,gy-14-i*4,2,6,'#160b06');if(i===3||i===6)rect(cx+(i%2?1:-1)*i*3-(i===3?13:0),gy-1-i*4,i===3?14:12,2,'#160b06')}}
  const moundPieces=[[-48,6,22,16],[-29,-7,25,20],[-8,-18,25,27],[14,-12,26,22],[37,5,20,17],[-20,-31,22,17],[5,-36,25,21]];
  function moundIntro(cx,gy,t){const u=smooth((t-1160)/760),arc=Math.sin(u*Math.PI),settled=[[-101,11],[-79,10],[-70,12],[58,11],[86,12],[-82,-7],[72,-8]];moundPieces.forEach((p,i)=>{const startX=cx+p[0],startY=gy-12+p[1],targetX=cx+settled[i][0],targetY=gy+settled[i][1]-p[3],pre=t>720&&t<1180?Math.round(Math.sin(t*.075+i*1.4)*Math.min(4,(t-720)/190)):0,x=startX+(targetX-startX)*u+pre,y=startY+(targetY-startY)*u-arc*(10+(i%4)*4);cube(x,y,p[2],p[3],tint('#976039',Math.floor((hash(i,3,8)-.5)*25)),.68)})}

  let particles=[],once=new Set();
  function emit(key,x,y,n,power=1,pal=['#87502c','#b87842','#d1a067']){if(once.has(key))return;once.add(key);for(let i=0;i<n;i++){const a=hash(i,key.length,33)*Math.PI*2,speed=(.7+hash(i,key.length,34)*2.4)*power;particles.push({x:x+(hash(i,1,key.length)-.5)*10,y:y+(hash(i,2,key.length)-.5)*7,vx:Math.cos(a)*speed,vy:-Math.abs(Math.sin(a)*speed)-.7,life:42+hash(i,3,key.length)*38,size:2+(hash(i,4,key.length)>.62?2:0)+(hash(i,5,key.length)>.9?2:0),c:pal[Math.floor(hash(i,6,key.length)*pal.length)],kind:'dirt'})}}
  function sparkle(key,x,y,n=8){if(once.has(key))return;once.add(key);for(let i=0;i<n;i++)particles.push({x,y,vx:(hash(i,7,4)-.5)*2.2,vy:(hash(i,8,5)-.5)*2.2,life:22+hash(i,9,6)*20,size:i%3?2:3,c:i%2?'#fff3b0':'#ffcc33',kind:'spark'})}
  function drawParticles(dt){for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;if(p.kind==='dirt'){p.vy+=.13*dt;p.vx*=.989}else{p.vx*=.97;p.vy*=.97}p.life-=dt;if(p.life<=0||p.y>H+8){particles.splice(i,1);continue}if(p.kind==='spark'){rect(p.x-2,p.y,5,1,p.c);rect(p.x,p.y-2,1,5,p.c)}else cube(p.x,p.y,p.size,p.size,p.c,.55)}}
  function clod(cx,headTop,t){if(t<1470||t>3040)return;let x=cx,y=headTop-8;if(t>2310){const q=clamp((t-2310)/730);x=cx+q*128;y=headTop-8-Math.sin(q*Math.PI)*88+q*26}cube(x-12,y,25,10,'#915c32');rect(x-7,y-8,3,9,'#5ea235');rect(x+1,y-11,3,12,'#79bd43');rect(x+8,y-7,2,8,'#4c8b2b')}
  function hardHat(cx,headTop,st={}){const bounce=Math.round(st.bounce||0),tilt=Math.round(st.tilt||0),x=cx+tilt*2,y=headTop-18-bounce;const gold='#f2bd05',bright='#ffe36a',mid='#d79b00',dark='#9d6500';rect(x-24,y+24,48,4,'#2b2116');rect(x-16,y+27,32,2,'#17110c');cube(x-39,y+19+Math.max(0,tilt),78,8,mid,.65);rect(x-34,y+19+Math.max(0,tilt),66,2,bright,.8);cube(x-30+tilt,y+11,60,11,gold,.7);cube(x-24+tilt*2,y+5,48,11,gold,.7);cube(x-15+tilt*2,y,30,9,bright,.65);cube(x-4+tilt*2,y-4,8,10,bright,.7);rect(x-30+tilt,y+13,5,8,dark);rect(x+25+tilt,y+13,5,8,dark);rect(x-19+tilt*2,y+7,22,2,'#fff1a0',.75);rect(x+14+tilt*2,y+7,5,9,tint(gold,-32))}
  function mole(cx,feet,st){const squash=st.squash||0,stretch=st.stretch||0,blink=st.blink,look=st.look||0,smile=st.smile,reach=st.reach||0,breath=st.breath||0;feet+=breath;const fur='#625b55',mid='#756c64',light='#898078',dark='#302a26',deep='#211c19',pink='#e59aa4',muzzle='#b7a79c',claw='#f1e5cf';const top=feet-92-stretch*9+squash*7;rect(cx-48,feet+17,96,8,'#120906',.58);cube(cx-35,feet-48,70,62,mid);cube(cx-43,feet-31,86,43,fur);cube(cx-27,top+8,54,48,fur);cube(cx-19,top,38,12,light);cube(cx-34,top+20,68,31,fur);rect(cx-31,top+23,5,27,tint(fur,24));rect(cx+27,top+24,5,26,tint(fur,-30));rect(cx-16,top+5,31,3,'#a1988e',.5);rect(cx-39,feet-25,5,29,tint(fur,18));rect(cx+35,feet-24,5,28,deep);for(let i=0;i<9;i++){const fx=cx-30+hash(i,2,70)*60,fy=top+18+hash(i,3,71)*53;rect(fx,fy,3+(i%2),2,i%3===0?light:dark,.55)}cube(cx-19,top+43,38,20,muzzle,.55);cube(cx-8,top+39,16,12,pink,.65);rect(cx-6,top+41,5,2,'#ffd1d5',.65);rect(cx-31,top+52,14,2,'#4b3b34');rect(cx+18,top+52,14,2,'#4b3b34');rect(cx-35,top+58,17,1,'#d8c9bd');rect(cx+19,top+58,17,1,'#d8c9bd');if(blink){rect(cx-22,top+28,10,2,dark);rect(cx+12,top+28,10,2,dark)}else{cube(cx-20+look,top+25,6,8,deep,.3);cube(cx+14+look,top+25,6,8,deep,.3);rect(cx-18+look,top+26,2,2,'#fff4d6');rect(cx+16+look,top+26,2,2,'#fff4d6')}rect(cx-7,top+62,6,8,'#fff9e9');rect(cx+2,top+62,6,8,'#fff9e9');if(smile){rect(cx-12,top+73,24,3,deep);rect(cx-15,top+70,4,4,deep);rect(cx+11,top+70,4,4,deep)}cube(cx-51,feet-27,25,18,claw,.55);rect(cx-54,feet-16,6,3,'#fffaf0');rect(cx-45,feet-14,6,3,'#fffaf0');rect(cx-36,feet-13,6,3,'#fffaf0');const armX=cx+27,armY=feet-27-reach*75;cube(armX,armY,24+reach*31,17,reach>.15?light:claw,.55);cube(cx+44+reach*30,armY-2,17,18,claw,.55);rect(cx+57+reach*30,armY+1,5,3,'#fffaf0');rect(cx+58+reach*30,armY+7,5,3,'#fffaf0');hardHat(cx,top,{bounce:st.helmetBounce||0,tilt:st.helmetTilt||0})}
  function logo(t){const topStart=2630,subStart=3020,nudge=smooth((t-3590)/250),crooked=(1-nudge)*14;wordChars('TOPO',320,4,8,'#e6b62e',t,topStart,85,(i,show)=>({x:0,y:Math.round((1-outBack(show))*-72)}));wordChars('STUDIOS',320,70,3,'#fff0ca',t,subStart,48,(i,show)=>({x:0,y:Math.round((1-ease(show))*17)+(i===6?Math.round(crooked):0)}));if(t>3700)sparkle('logo-click',385,101,10);if(t>3490&&t<3730){const q=Math.floor((t-3490)/80);if(q>=0)sparkle('touch'+q,381,106,2)}}
  function drawIntro(t,dt){sky(t);moon();cloud(62+(t*.005)%75,72,1);cloud(390-(t*.003)%52,118,.72);hills(t);terrain(t);beetle(t);const gy=228,cx=320;const falsePeek=t<1200?ease((t-610)/180)*(1-ease((t-930)/180))*22:0;mouth(cx,gy,clamp((t-500)/300));cracks(cx,gy,smooth((t-760)/510));moundIntro(cx,gy-12,t);if(falsePeek>1){cube(cx-10,gy+5-falsePeek,20,13,'#665e57');cube(cx-6,gy-falsePeek,12,8,'#e59aa4');rect(cx-4,gy+1-falsePeek,3,2,'#ffd2d6');hardHat(cx,gy+5-falsePeek,{bounce:2,tilt:Math.sin(t*.04)>0?1:0})}const launch=ease((t-1220)/430)*78,overshoot=t>1530&&t<2020?Math.sin((t-1530)/490*Math.PI)*17:0,settle=ease((t-1940)/360)*34,rise=launch+overshoot-settle;let feet=gy+34-rise;if(t>1180){const sneeze=smooth((t-2210)/90)*(1-smooth((t-2400)/120)),inhale=smooth((t-2070)/130)*(1-smooth((t-2200)/80)),reach=smooth((t-3440)/180)*(1-smooth((t-3740)/150)),blink=sneeze>.15||(t>4220&&t<4330),look=t>3250&&t<3450?3:t>3900&&t<4100?-2:0,helmetBounce=Math.max(0,overshoot*.22)+sneeze*7,helmetTilt=t>1510&&t<2450?Math.round(Math.sin(t*.026)*1.4):0;mole(cx,feet,{squash:sneeze*.85,stretch:overshoot/20-inhale*.35,blink,look,smile:t>3890,reach,breath:t>3890?Math.round(Math.sin(t*.006)):0,helmetBounce,helmetTilt});const beat=Math.floor((t-1190)/76);if(t<1770)emit('eruption'+beat,cx+(beat%2?37:-37),gy-30-Math.min(54,rise*.45),5,1.45);if(sneeze>.1){const sn=Math.floor((t-2210)/55);emit('sneeze'+sn,cx+16,feet-105,5,1.3,['#8b542e','#bf8149','#d3a66b','#6ca43a'])}clod(cx,feet-116,t)}if(t>1790&&t<2110){const b=Math.floor((t-1790)/80);emit('settle'+b,cx+(b%2?24:-24),gy-12,2,.5)}logo(t);drawParticles(dt);if(t>3900){const q=smooth((t-3900)/360);rect(cx-50,gy-9,100,2,'#ffcc33',.16*q)}}

  function voxelMask(progress,opening,ox,oy){const cell=32,p=clamp(progress),max=Math.hypot(Math.max(ox,W-ox),Math.max(oy,H-oy));for(let y=0;y<H;y+=cell)for(let x=0;x<W;x+=cell){const d=Math.hypot(x+cell/2-ox,y+cell/2-oy)/max,score=clamp(d*.78+hash(x/cell,y/cell,88)*.22);const covered=opening?score>p:score<p;if(covered)rect(x,y,cell+1,cell+1,'#030201')}}
  /* The handoff never paints a second, fixed-size copy of ANT FARM. The real responsive menu is
     laid out underneath, its live canvas is captured at viewport size, and voxel cells are removed
     from that capture. Every first visible title/button pixel therefore already has its final size. */
  let menuRaf=0,menuLast=0,menuW=0,menuH=0,visualEpoch=performance.now();
  function mainCanvasSize(){
    if(!menuCv)return null;
    const w=Math.max(1,Math.round(menuCv.clientWidth||innerWidth||640)),h=Math.max(1,Math.round(menuCv.clientHeight||innerHeight||360));
    if(menuCv.width!==w||menuCv.height!==h){menuCv.width=w;menuCv.height=h;menuW=w;menuH=h}else{menuW=w;menuH=h}
    const x=menuCv.getContext('2d');x.imageSmoothingEnabled=false;return x;
  }
  function mainRect(xc,x,y,w,h,c,a=1){xc.globalAlpha=a;xc.fillStyle=c;xc.fillRect(Math.round(x),Math.round(y),Math.max(1,Math.round(w)),Math.max(1,Math.round(h)));xc.globalAlpha=1}
  function mainCube(xc,x,y,w,h,c,k=1){x=Math.round(x);y=Math.round(y);w=Math.max(1,Math.round(w));h=Math.max(1,Math.round(h));mainRect(xc,x,y,w,h,c);if(h>=3){mainRect(xc,x,y,w,1,tint(c,Math.round(34*k)));mainRect(xc,x,y+h-1,w,1,tint(c,-Math.round(42*k)))}if(w>=4&&h>=5)mainRect(xc,x+w-1,y+1,1,h-2,tint(c,-22))}
  function mixHex(a,b,t){const A=parseInt(a.slice(1),16),B=parseInt(b.slice(1),16),m=(x,y)=>Math.round(x+(y-x)*t);return '#'+((m(A>>16,B>>16)<<16)|(m(A>>8&255,B>>8&255)<<8)|m(A&255,B&255)).toString(16).padStart(6,'0')}
  function mainTitleCellWalk(text,cx,y,s,fn){let x=Math.round(cx-textWidth(text,s)/2),letter=0;[...text].forEach(ch=>{if(ch===' '){x+=4*s;return}const rows=FONT[ch]||[];rows.forEach((row,yy)=>[...row].forEach((v,xx)=>{if(v==='1')fn({x:x+xx*s,y:y+yy*s,xx,yy,letter,top:yy===0||!rows[yy-1]||rows[yy-1][xx]!=='1'})}));x+=6*s;letter++})}
  function mainTinyWorker(xc,x,y,s,t){const u=Math.max(1,Math.floor(s/5)),step=Math.floor(t/180)%2,ink='#21130b',joint='#6f431d';mainRect(xc,x,y+u,3*u,2*u,ink);mainRect(xc,x+4*u,y+u,2*u,2*u,joint);mainRect(xc,x+7*u,y+u,3*u,2*u,ink);mainRect(xc,x+u,y+3*u,u,2*u+step*u,ink);mainRect(xc,x+5*u,y+3*u,u,3*u-step*u,ink);mainRect(xc,x+8*u,y+3*u,u,2*u+step*u,ink);mainRect(xc,x+8*u,y-u,u,2*u,ink);mainRect(xc,x+10*u,y-2*u,2*u,u,ink)}
  function ambientAnt(xc,x,y,t,flip,scale){
    const s=Math.max(1,scale||1),step=Math.floor(t/150)%2,dir=flip?-1:1,ink='#1a100b',body='#3a2114';
    xc.save();xc.translate(Math.round(x),Math.round(y));xc.scale(dir,1);
    mainCube(xc,0,2,7*s,5*s,body,.35);mainCube(xc,9*s,3,4*s,4*s,ink,.3);mainCube(xc,15*s,2,6*s,5*s,body,.35);
    [[2,7,0],[6,7,1],[10,7,0],[13,7,1],[17,7,0],[20,7,1]].forEach((l,i)=>{const d=(step^(l[2]))?2:0;mainRect(xc,l[0]*s,l[1]*s,Math.max(1,s),3*s+d,ink)});
    mainRect(xc,18*s,-1,Math.max(1,s),4*s,ink);mainRect(xc,20*s,-2,3*s,Math.max(1,s),ink);xc.restore();
  }
  function drawResponsiveMenu(now){
    const x=mainCanvasSize();if(!x)return;
    const w=menuW,h=menuH,prefs=menuPreferences(),still=motionIsReduced()||!prefs.ambience,clock=still?34000:Math.max(0,now-visualEpoch),cycle=(clock%120000)/120000;
    const sunWave=(Math.sin(cycle*Math.PI*2-Math.PI/2)+1)/2,day=clamp((sunWave-.08)/.76),dusk=1-Math.abs(day-.5)*2;
    const skyNight=['#0b1326','#15233b','#24324a','#403848','#6d463d','#8a553f'],skyDay=['#4d90bd','#6ca8ca','#8cc2d5','#bad8d9','#e8c78d','#edaa67'];
    x.clearRect(0,0,w,h);const surface=Math.round(h*.84);
    for(let i=0;i<skyNight.length;i++)mainRect(x,0,i*surface/skyNight.length,w,surface/skyNight.length+1,mixHex(skyNight[i],skyDay[i],day));
    const starsAlpha=clamp(1-day*1.35);for(let i=0;i<Math.max(30,Math.round(w/28));i++){const sx=Math.floor(hash(i,41,3)*w),sy=8+Math.floor(hash(i,43,4)*surface*.55);mainRect(x,sx,sy,i%11===0?2:1,i%11===0?2:1,i%5?'#e6edf4':'#ffe18a',(.35+hash(i,9,2)*.65)*starsAlpha)}
    const orbit=cycle*Math.PI*2-Math.PI,orbX=w*.5+Math.cos(orbit)*w*.39,orbY=surface*.77-Math.sin(orbit)*surface*.63,orb=Math.max(26,Math.min(58,Math.round(Math.min(w,h)*.075)));
    if(day>.08){mainCube(x,orbX-orb/2,orbY-orb/2,orb,orb,mixHex('#f39a42','#ffd85a',day));mainRect(x,orbX-orb*.23,orbY-orb*.2,orb*.46,Math.max(2,orb*.07),'#fff3ad',.55)}
    else{const mx=w-orbX,my=surface*.77+Math.sin(orbit)*surface*.63;mainCube(x,mx-orb*.42,my-orb*.42,orb*.84,orb*.84,'#e9ddb5');mainRect(x,mx-orb*.25,my-orb*.12,orb*.16,orb*.12,'#a99d80');mainRect(x,mx+orb*.06,my+orb*.1,orb*.13,orb*.1,'#b8aa86')}
    const cloudSpeed=still?0:clock*.006;for(let c=0;c<4;c++){const cw=54+(c%3)*19,ch=9+(c%2)*3,cx=((hash(c,5,1)*w+cloudSpeed*(.65+c*.16))%(w+cw*2))-cw,cy=surface*(.14+c*.105);mainRect(x,cx,cy,cw,ch,'#f4eadc',.34+day*.36);mainRect(x,cx+cw*.2,cy-ch*.75,cw*.52,ch*1.15,'#fff8e9',.28+day*.42);mainRect(x,cx+3,cy+ch-2,cw-7,3,'#8893a0',.26)}
    const far=mixHex('#172638','#48665c',day),near=mixHex('#17231f','#395a3d',day);const hillStep=Math.max(15,Math.round(w/54));
    for(let hx=0;hx<w;hx+=hillStep){const hh=18+Math.floor(hash(hx,45,6)*Math.min(66,h*.11));mainRect(x,hx,surface-hh,hillStep+2,hh,hx%(hillStep*2)?far:near);if(day<.32&&hash(hx,2,7)>.76)mainRect(x,hx+hillStep*.44,surface-hh*.55,2,2,'#ffd36a',.65)}
    const block=Math.max(12,Math.round(w/58)),grassH=Math.max(11,Math.round(h*.032));
    for(let bx=0;bx<w;bx+=block){mainCube(x,bx,surface,block,grassH,tint(mixHex('#264928','#4f842e',day),Math.floor((hash(bx,47,2)-.5)*14)),.55);const gh=4+Math.floor(hash(bx,49,3)*10),sway=still?0:Math.round(Math.sin(clock*.003+bx)*1.3);mainRect(x,bx+3+sway,surface-gh,Math.max(1,block*.1),gh,mixHex('#3c7138','#78b844',day));if(hash(bx,4,9)>.8)mainRect(x,bx+block*.62-sway,surface-gh*.65,2,2,dusk>.45?'#f4bd55':'#d9e87b')}
    for(let by=surface+grassH;by<h;by+=block)for(let bx=0;bx<w;bx+=block)mainCube(x,bx,by,block,block,tint(by<surface+block*2?'#80512e':'#a37144',Math.floor((hash(bx,by,11)-.5)*14)),.5);
    const sub=!!(main&&main.classList.contains('is-subscreen'));
    if(sub&&prefs.ambience&&!motionIsReduced())for(let i=0;i<3;i++){const span=w+160,xp=((clock*(.018+i*.005)+i*w*.37)%span)-80,flip=i===1;ambientAnt(x,flip?w-xp:xp,surface-13-(i%2)*4,clock+i*170,flip,w<520?1:1.2)}
    if(!sub){
      const portrait=h>w*1.08,target=portrait?w*.76:Math.min(w*.53,720),s=Math.max(4,Math.floor(target/45)),tw=textWidth('ANT FARM',s),ty=Math.round(portrait?h*.065:h*.05),left=Math.round((w-tw)/2);
      mainTitleCellWalk('ANT FARM',w/2,ty,s,o=>{const seed=o.xx+o.yy*7+o.letter*31,face=seed%5===0?'#a86c3f':'#915a35';mainRect(x,o.x+Math.max(1,s*.28),o.y+Math.max(2,s*.42),s,s,'#29170e');mainCube(x,o.x,o.y,s,s,face,.55);if(o.top){mainRect(x,o.x,o.y,s,Math.max(1,s*.24),seed%3?'#6fa63b':'#82bb45');if(seed%4===0)mainRect(x,o.x+s*.28,o.y-s*.42,Math.max(1,s*.24),Math.max(2,s*.55),'#83c14b')}if(seed%6===0)mainRect(x,o.x+s*.3,o.y+s*.42,Math.max(1,s*.42),Math.max(1,s*.25),'#432616')});
      const rootY=ty+8*s;mainRect(x,left+s*4,rootY,tw-s*8,Math.max(1,s*.22),'#422516',.55);for(let i=0;i<9;i++){const rx=left+s*6+i*(tw-s*12)/8;mainRect(x,rx,rootY,Math.max(1,s*.2),s*(.7+(i%3)*.25),'#684020',.6)}mainTinyWorker(x,left+s*1.25,ty+s*2.12,s,still?0:clock);
    }
  }
  window.topoRenderMenuFrame=drawResponsiveMenu;
  function startMainVisual(){
    if(!menuCv||menuRaf)return;menuLast=0;
    const loop=now=>{if(!main||getComputedStyle(main).display==='none'){menuRaf=0;return}const moving=menuPreferences().ambience&&!motionIsReduced();if(!menuLast||now-menuLast>(moving?65:999999)){drawResponsiveMenu(now);menuLast=now}if(!moving){menuRaf=0;return}menuRaf=requestAnimationFrame(loop)};
    menuRaf=requestAnimationFrame(loop);
  }
  window.topoStartMenuVisual=startMainVisual;

  let revealStarted=false,revealCtx=null,revealW=0,revealH=0;
  function sizeReveal(){
    if(!revealCv)return null;const d=Math.min(2,Math.max(1,devicePixelRatio||1)),w=Math.max(1,innerWidth||640),h=Math.max(1,innerHeight||360);
    if(revealCv.width!==Math.round(w*d)||revealCv.height!==Math.round(h*d)){revealCv.width=Math.round(w*d);revealCv.height=Math.round(h*d)}
    revealW=w;revealH=h;revealCtx=revealCv.getContext('2d');revealCtx.setTransform(d,0,0,d,0,0);revealCtx.imageSmoothingEnabled=false;return revealCtx;
  }
  function beginResponsiveReveal(){
    if(revealStarted)return;revealStarted=true;
    if(typeof window.topoPrepareMainMenu==='function')window.topoPrepareMainMenu();else if(main){main.style.display='flex';main.setAttribute('aria-hidden','true')}
    drawResponsiveMenu(performance.now());sizeReveal();
    splash.classList.add('is-menu-reveal');splash.style.background='transparent';cv.style.opacity='0';
    if(revealCv)revealCv.style.display='block';
  }
  function clearElementBands(ctx,el,p,index){
    if(!el||getComputedStyle(el).display==='none')return;const r=el.getBoundingClientRect(),band=Math.max(5,Math.round(r.height/6));
    for(let y=0,n=0;y<r.height;y+=band,n++){const threshold=.14+index*.055+hash(index,n,121)*.42;if(p>=threshold)ctx.clearRect(Math.floor(r.left-18),Math.floor(r.top+y-2),Math.ceil(r.width+36),Math.ceil(Math.min(band+4,r.height-y+4)))}
  }
  function drawResponsiveReveal(progress,now){
    beginResponsiveReveal();const ctx=sizeReveal();if(!ctx||!menuCv)return;const p=smooth(progress);
    drawResponsiveMenu(now);ctx.clearRect(0,0,revealW,revealH);ctx.drawImage(menuCv,0,0,menuCv.width,menuCv.height,0,0,revealW,revealH);
    const cell=Math.max(28,Math.min(52,Math.round(Math.min(revealW,revealH)/13)));
    for(let y=0;y<revealH;y+=cell)for(let x=0;x<revealW;x+=cell){const dist=Math.hypot(x+cell/2-revealW*.5,y+cell/2-revealH*.45)/Math.hypot(revealW*.55,revealH*.58),score=clamp(dist*.62+hash(x/cell,y/cell,123)*.38);if(score>p){mainRect(ctx,x,y,cell+1,cell+1,score-p<.11?'#2b1a10':'#030201');if(score-p<.08)mainRect(ctx,x,y,cell+1,3,'#6f4527',.7)}}
    [...main.querySelectorAll('.topo-menu-option')].filter(b=>!b.hidden).forEach((b,i)=>clearElementBands(ctx,b,p,i));
    clearElementBands(ctx,document.getElementById('btnMainReplayIntro'),p,7);
  }

  let introRaf=0,startAt=0,lastT=0,pausedAt=0,pauseStamp=0,finishing=false,reducedTimer=0,introReduced=false,reducedRevealAt=0;
  function cleanReveal(){revealStarted=false;if(revealCv){revealCv.style.display='none';const r=revealCv.getContext('2d');if(r)r.clearRect(0,0,revealCv.width,revealCv.height)}splash.classList.remove('is-menu-reveal');splash.style.background='';cv.style.opacity='1'}
  function finishIntro(){if(finishing)return;finishing=true;cancelAnimationFrame(introRaf);introRaf=0;clearTimeout(reducedTimer);splash.style.display='none';splash.setAttribute('aria-hidden','true');cleanReveal();if(typeof window.topoShowMainMenu==='function')window.topoShowMainMenu({initial:true});else if(main){main.style.display='flex';main.setAttribute('aria-hidden','false')}startMainVisual()}
  function frame(now){
    if(pausedAt){introRaf=0;return}const t=Math.min(DUR,now-startAt),dt=lastT?Math.min(2.2,Math.max(.2,(t-lastT)/16.67)):1;lastT=t;
    if(t<MENU_START){const it=clamp(t-INTRO_START,0,INTRO_DUR);drawIntro(it,dt);if(t<INTRO_START)voxelMask(smooth(t/INTRO_START),true,320,215);if(t>=EXIT_START)voxelMask(smooth((t-EXIT_START)/(MENU_START-EXIT_START)),false,320,236)}
    else drawResponsiveReveal((t-MENU_START)/(DUR-MENU_START),now);
    if(t>=DUR){introRaf=0;requestAnimationFrame(finishIntro);return}introRaf=requestAnimationFrame(frame)
  }
  function reducedRevealFrame(now){if(!reducedRevealAt)reducedRevealAt=now;drawResponsiveReveal((now-reducedRevealAt)/520,now);if(now-reducedRevealAt>=520){finishIntro();return}introRaf=requestAnimationFrame(reducedRevealFrame)}
  function replayIntro(){
    clearTimeout(reducedTimer);cancelAnimationFrame(introRaf);if(menuRaf){cancelAnimationFrame(menuRaf);menuRaf=0}cleanReveal();particles=[];once.clear();lastT=0;pausedAt=0;finishing=false;reducedRevealAt=0;introReduced=motionIsReduced();
    if(main){main.style.display='none';main.classList.remove('is-subscreen','is-intro-reveal');main.setAttribute('aria-hidden','true')}splash.style.display='flex';splash.setAttribute('aria-hidden','false');
    if(introReduced){g.clearRect(0,0,W,H);drawIntro(INTRO_DUR,1);reducedTimer=setTimeout(()=>{reducedRevealAt=0;introRaf=requestAnimationFrame(reducedRevealFrame)},680)}
    else{startAt=performance.now();introRaf=requestAnimationFrame(frame)}
  }
  function skipIntro(){if(splash.style.display==='none')return;clearTimeout(reducedTimer);cancelAnimationFrame(introRaf);particles=[];once.clear();lastT=0;beginResponsiveReveal();drawResponsiveReveal(1,performance.now());finishIntro()}
  function togglePause(){if(introReduced||splash.style.display==='none'||revealStarted)return;if(!pausedAt){pausedAt=Math.min(DUR,performance.now()-startAt);pauseStamp=performance.now();cancelAnimationFrame(introRaf);introRaf=0}else{startAt+=performance.now()-pauseStamp;pausedAt=0;lastT=0;introRaf=requestAnimationFrame(frame)}}
  window.topoReplayIntro=replayIntro;window.topoSkipIntro=skipIntro;
  const skip=document.getElementById('topoIntroSkip');if(skip)skip.addEventListener('click',skipIntro);
  const replay=document.getElementById('btnMainReplayIntro');if(replay)replay.addEventListener('click',replayIntro);
  document.addEventListener('keydown',e=>{const introVisible=splash.style.display!=='none';if(introVisible&&(e.key==='Enter'||e.key==='Escape')){e.preventDefault();skipIntro();return}if(introVisible&&e.key===' '){e.preventDefault();togglePause();return}if(!introVisible&&e.key.toLowerCase()==='r'&&main&&getComputedStyle(main).display!=='none'){e.preventDefault();replayIntro()}});
  document.addEventListener('topo-settings-change',()=>{menuLast=0;if(menuRaf){cancelAnimationFrame(menuRaf);menuRaf=0}if(main&&getComputedStyle(main).display!=='none')startMainVisual()});
  window.addEventListener('resize',()=>{menuLast=0;if(revealStarted)drawResponsiveReveal(clamp((performance.now()-startAt-MENU_START)/(DUR-MENU_START)),performance.now());if(main&&getComputedStyle(main).display!=='none')startMainVisual()});
  replayIntro();
})();
