const menuButton = document.querySelector('.menu-toggle');
const menuDrawer = document.querySelector('.menu-drawer');
const navigation = document.querySelector('#site-nav');
const setMenuOpen = open => {
  if (!menuButton || !menuDrawer) return;
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
  menuDrawer.classList.toggle('is-open', open);
  document.documentElement.classList.toggle('menu-open', open);
  document.body.classList.toggle('menu-open', open);
};
menuButton?.addEventListener('click', () => setMenuOpen(menuButton.getAttribute('aria-expanded') !== 'true'));
navigation?.addEventListener('click', event => { if (event.target.closest('a')) setMenuOpen(false); });
menuDrawer?.addEventListener('click', event => { if (menuButton?.getAttribute('aria-expanded') === 'true' && event.target === menuDrawer) setMenuOpen(false); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && menuButton?.getAttribute('aria-expanded') === 'true') { setMenuOpen(false); menuButton.focus(); } });
document.addEventListener('pointerdown', event => { if (menuButton?.getAttribute('aria-expanded') === 'true' && !menuDrawer?.contains(event.target)) setMenuOpen(false); });

const sequence = document.querySelector('[data-testing-sequence]');
const stage = sequence?.querySelector('.testing-stage');
const equipment = stage?.querySelector('.testing-stage__equipment');
const equipmentImage = stage?.querySelector('.testing-stage__image');
const surfaceCanvas = stage?.querySelector('.testing-stage__effects');
const atmosphereCanvas = stage?.querySelector('.testing-stage__atmosphere');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const desktopTesting = matchMedia('(min-width: 1001px)');
const aboutSection = stage?.querySelector('.testing-about');
const heroCopy = stage?.querySelector('.testing-stage__copy');

if (sequence && stage && equipment && equipmentImage && surfaceCanvas && atmosphereCanvas) {
  const clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v));
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const canvasContext = canvas => canvas.getContext('2d');
  const maskCanvas = document.createElement('canvas');
  const maskCtx = canvasContext(maskCanvas);
  let maskPixels = null, maskW = 0, maskH = 0;
  let width = 1, height = 1, objectW = 1, objectH = 1, progress = 0, raf = 0, aboutShift = 0;
  let drops = [], frost = [], rain = [], seed = 4099;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const getMaskPoints = count => {
    const out = []; if (!maskPixels) return out;
    let attempts = 0;
    while (out.length < count && attempts++ < count * 80) {
      const x = random(), y = random();
      const ix = Math.min(maskW - 1, (x * maskW) | 0), iy = Math.min(maskH - 1, (y * maskH) | 0);
      if (maskPixels[(iy * maskW + ix) * 4 + 3] > 100) out.push({x,y,r:random(),phase:random()});
    }
    return out;
  };
  const createMask = () => {
    if (!equipmentImage.complete || !equipmentImage.naturalWidth) return;
    maskW = 360; maskH = Math.round(maskW * equipmentImage.naturalHeight / equipmentImage.naturalWidth);
    maskCanvas.width = maskW; maskCanvas.height = maskH;
    maskCtx.clearRect(0,0,maskW,maskH); maskCtx.drawImage(equipmentImage,0,0,maskW,maskH);
    maskPixels = maskCtx.getImageData(0,0,maskW,maskH).data;
    drops = getMaskPoints(360); frost = getMaskPoints(240);
  };
  const measure = () => {
    const dpr = Math.min(devicePixelRatio || 1, 1.6);
    const s = stage.getBoundingClientRect(), o = {width:equipment.offsetWidth,height:equipment.offsetHeight};
    width = Math.max(1,s.width); height = Math.max(1,s.height); objectW = Math.max(1,o.width); objectH = Math.max(1,o.height);
    for (const c of [surfaceCanvas,atmosphereCanvas]) {
      const box = c === surfaceCanvas ? o : s;
      c.width = Math.max(1,Math.round(box.width*dpr)); c.height = Math.max(1,Math.round(box.height*dpr));
    }
    rain = Array.from({length:Math.min(190,Math.ceil(width/8))},()=>({x:random()*width,y:random()*height,len:8+random()*24,speed:.35+random()*.8,phase:random()}));
    createMask();
  };
  const getProgress = () => {
    const top = sequence.getBoundingClientRect().top + scrollY;
    const timeline = clamp((scrollY-top) / Math.max(1,sequence.offsetHeight-stage.offsetHeight));
    progress = desktopTesting.matches ? clamp((timeline - .32) / .68) : timeline;
    aboutShift = desktopTesting.matches ? (reduceMotion.matches ? Number(timeline >= .12) : smooth(.015,.20,timeline)) : 0;
    const aboutOpacity = desktopTesting.matches ? smooth(.09,.20,timeline)*(1-smooth(.32,.38,timeline)) : 0;
    stage.style.setProperty('--about-opacity', String(aboutOpacity));
    stage.style.setProperty('--about-y', `${reduceMotion.matches ? 0 : (1-smooth(.09,.20,timeline))*24}px`);
    aboutSection?.setAttribute('aria-hidden', String(aboutOpacity < .01));
    const scene = Math.min(4,Math.floor(progress*4+1e-6));
    stage.dataset.scene = ['clear','rain','heat','frost','vibration'][scene];
    const copyOpacity = 1-smooth(.035,.13,timeline);
    stage.style.setProperty('--copy-opacity', String(copyOpacity));
    if (heroCopy) heroCopy.inert = copyOpacity < .01;
  };
  const drop = (ctx,x,y,r,a) => {
    ctx.save(); ctx.globalAlpha=a;
    const g=ctx.createRadialGradient(x-r*.35,y-r*.38,r*.04,x,y,r);
    g.addColorStop(0,'rgba(255,255,255,.92)');g.addColorStop(.22,'rgba(218,242,255,.48)');g.addColorStop(.72,'rgba(105,166,206,.15)');g.addColorStop(1,'rgba(255,255,255,.55)');
    ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(x,y,r*.68,r,-.16,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='rgba(239,250,255,.64)';ctx.lineWidth=Math.max(.55,r*.1);ctx.beginPath();ctx.arc(x-r*.1,y-r*.12,r*.58,Math.PI*1.08,Math.PI*1.82);ctx.stroke();ctx.restore();
  };
  const drawSurface = (time, rainLevel, iceLevel) => {
    const ctx=canvasContext(surfaceCanvas);ctx.setTransform(surfaceCanvas.width/objectW,0,0,surfaceCanvas.height/objectH,0,0);ctx.clearRect(0,0,objectW,objectH);
    if (!maskPixels) return;
    const scale=Math.max(.65,objectW/900);
    for(let i=0;i<Math.floor(drops.length*rainLevel);i++){const p=drops[i],r=(2+p.r*5)*scale;drop(ctx,p.x*objectW,p.y*objectH,r,.66+.18*Math.sin(time*.002+p.phase));}
    if(iceLevel>0){
      ctx.save();ctx.globalCompositeOperation='source-over';ctx.fillStyle=`rgba(175,224,248,${.19*iceLevel})`;ctx.fillRect(0,0,objectW,objectH);
      const frostEdges=[
        [ctx.createLinearGradient(0,0,objectW*.24,0),0,0,objectW*.24,objectH],
        [ctx.createLinearGradient(objectW,0,objectW*.76,0),objectW*.76,0,objectW*.24,objectH],
        [ctx.createLinearGradient(0,0,0,objectH*.22),0,0,objectW,objectH*.22],
        [ctx.createLinearGradient(0,objectH,0,objectH*.78),0,objectH*.78,objectW,objectH*.22]
      ];
      for(const [gradient,x,y,w,h] of frostEdges){gradient.addColorStop(0,`rgba(226,246,255,${.58*iceLevel})`);gradient.addColorStop(.38,`rgba(196,230,248,${.27*iceLevel})`);gradient.addColorStop(1,'rgba(190,226,248,0)');ctx.fillStyle=gradient;ctx.fillRect(x,y,w,h)}
      ctx.restore();
      for(let i=0;i<Math.floor(frost.length*iceLevel);i++){
        const p=frost[i],x=p.x*objectW,y=p.y*objectH,r=(7+(i%7)*2.4)*scale;
        ctx.save();ctx.globalAlpha=.13+.34*iceLevel;ctx.strokeStyle=i%3?'rgba(215,244,255,.78)':'rgba(255,255,255,.9)';ctx.lineWidth=Math.max(.65,scale*.72);ctx.shadowColor='#b9e8ff';ctx.shadowBlur=4*scale;
        for(let k=0;k<6;k++){const a=k*Math.PI/3+p.phase,ex=x+Math.cos(a)*r,ey=y+Math.sin(a)*r;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(ex,ey);for(const t of [.48,.72]){const bx=x+Math.cos(a)*r*t,by=y+Math.sin(a)*r*t,br=r*.2*(1-t*.35);for(const side of [-1,1]){ctx.moveTo(bx,by);ctx.lineTo(bx+Math.cos(a+side*.78)*br,by+Math.sin(a+side*.78)*br)}}ctx.stroke()}ctx.restore();
      }
    }
    ctx.save();ctx.globalCompositeOperation='destination-in';ctx.drawImage(maskCanvas,0,0,objectW,objectH);ctx.restore();
  };
  const drawAtmosphere = (time, rainLevel, heatLevel, vibration) => {
    const ctx=canvasContext(atmosphereCanvas);ctx.setTransform(atmosphereCanvas.width/width,0,0,atmosphereCanvas.height/height,0,0);ctx.clearRect(0,0,width,height);
    if(rainLevel>.01){ctx.save();ctx.globalAlpha=.23*rainLevel;ctx.strokeStyle='rgba(208,230,244,.64)';ctx.lineWidth=1;for(const p of rain){const y=(p.y+time*.42*p.speed)%(height+p.len)-p.len;ctx.beginPath();ctx.moveTo(p.x,y);ctx.lineTo(p.x-2,y+p.len);ctx.stroke();}ctx.restore();}
    if(heatLevel>.01){ctx.save();ctx.globalAlpha=.22*heatLevel;ctx.strokeStyle='rgba(255,145,78,.56)';ctx.lineWidth=1;for(let j=0;j<11;j++){const by=height*.47+j*height*.018;ctx.beginPath();for(let x=0;x<=width;x+=5){const y=by+Math.sin(x*.017+time*.003+j)*heatLevel*6+Math.sin(x*.042-time*.002+j)*heatLevel*1.7;if(x===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();}ctx.restore();}
    if(vibration>.01){const left=width*.05,right=width*.95,top=height*.18,bottom=height*.82,w=right-left,h=bottom-top;ctx.save();ctx.globalAlpha=.42*vibration;ctx.strokeStyle='rgba(191,197,205,.13)';ctx.lineWidth=1;for(let i=0;i<=12;i++){const x=left+w*i/12;ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x,bottom);ctx.stroke();}for(let i=0;i<=6;i++){const y=top+h*i/6;ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke();}ctx.strokeStyle='#ff8733';ctx.shadowColor='#ff730d';ctx.shadowBlur=11;ctx.lineWidth=2;ctx.beginPath();for(let x=0;x<=w;x+=2){const peak1=Math.exp(-(((x-w*.42)/(w*.045))**2))*h*.58,peak2=Math.exp(-(((x-w*.7)/(w*.075))**2))*h*.31;const noise=Math.sin(x*.27+time*.003)*h*.013+Math.sin(x*.061+time*.002)*h*.012;const y=top+h*.62-peak1-peak2-noise;if(x===0)ctx.moveTo(left+x,y);else ctx.lineTo(left+x,y);}ctx.stroke();ctx.restore();}
  };
  const draw = time => {
    raf=0;if(document.visibilityState==='hidden')return;
    getProgress();const sceneT=progress*4,idx=Math.min(3,Math.floor(sceneT)),t=sceneT-idx;
    const ramp=(center,half)=>smooth(center-half,center+half,progress);
    const rainLevel=smooth(.205,.265,progress)*(1-smooth(.385,.445,progress));
    const heatLevel=smooth(.445,.515,progress)*(1-smooth(.625,.695,progress));
    const iceLevel=smooth(.685,.755,progress)*(1-smooth(.865,.935,progress));
    const vibe=smooth(.9,1,progress);
    const poses=[{x:0,y:0,s:1,r:0},{x:-.012,y:-.01,s:1.012,r:.25},{x:.01,y:.006,s:.995,r:-.22},{x:-.008,y:-.004,s:1.008,r:.12},{x:0,y:0,s:1,r:0}];
    const blend=smooth(0,1,t),a=poses[idx],b=poses[idx+1];
    const shakeX=reduceMotion.matches?0:Math.sin(time*.068)*vibe*Math.min(4,objectW*.003);
    const shakeY=reduceMotion.matches?0:Math.sin(time*.091+1.2)*vibe*Math.min(2.5,objectW*.002);
    const aboutX = -433.5 * aboutShift;
    const aboutY = (394.5-height/2)*aboutShift;
    equipment.style.setProperty('--equipment-x',`${aboutX+(a.x+(b.x-a.x)*blend)*objectW+shakeX}px`);
    equipment.style.setProperty('--equipment-y',`${aboutY+(a.y+(b.y-a.y)*blend)*objectH+shakeY}px`);
    equipment.style.setProperty('--equipment-scale',String(a.s+(b.s-a.s)*blend));
    equipment.style.setProperty('--equipment-rotate',`${a.r+(b.r-a.r)*blend}deg`);
    const frostTurn = iceLevel;
    equipment.style.setProperty('--equipment-tilt-x',`${-4.5*frostTurn}deg`);
    equipment.style.setProperty('--equipment-tilt-y',`${7*frostTurn}deg`);
    stage.style.setProperty('--heat-opacity',String(heatLevel*(.72+.08*Math.sin(time*.006))));
    stage.style.setProperty('--ice-opacity',String(iceLevel*.86));
    drawSurface(time,rainLevel,iceLevel);drawAtmosphere(time,rainLevel,heatLevel,vibe);
    raf=requestAnimationFrame(draw);
  };
  const requestDraw=()=>{if(!raf)raf=requestAnimationFrame(draw);};
  equipmentImage.addEventListener('load',()=>{createMask();requestDraw();},{once:true});
  const observer=new ResizeObserver(()=>{measure();requestDraw();});observer.observe(stage);observer.observe(equipment);
  addEventListener('scroll',requestDraw,{passive:true});addEventListener('resize',()=>{measure();requestDraw();},{passive:true});document.addEventListener('visibilitychange',requestDraw);
  measure();getProgress();requestDraw();
}
