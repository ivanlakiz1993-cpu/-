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

document.querySelectorAll('.testing-stage__button').forEach(button => {
  button.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch') return;
    const bounds = button.getBoundingClientRect();
    button.style.setProperty('--cursor-x', `${((event.clientX - bounds.left) / bounds.width) * 100}%`);
    button.style.setProperty('--cursor-y', `${((event.clientY - bounds.top) / bounds.height) * 100}%`);
  });
});

const sequence = document.querySelector('[data-testing-sequence]');
const stage = sequence?.querySelector('.testing-stage');
const equipment = stage?.querySelector('.testing-stage__equipment');
const equipmentImage = stage?.querySelector('.testing-stage__image');
const frostSource = stage?.querySelector('.testing-stage__frost-source');
const frostCanvas = stage?.querySelector('.testing-stage__frost');
const surfaceCanvas = stage?.querySelector('.testing-stage__effects');
const atmosphereCanvas = stage?.querySelector('.testing-stage__atmosphere');
const breadcrumb = stage?.querySelector('.testing-stage__breadcrumb');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const desktopTesting = matchMedia('(min-width: 1001px)');
const aboutSection = stage?.querySelector('.testing-about');
const heroCopy = stage?.querySelector('.testing-stage__copy');

if (sequence && stage && equipment && equipmentImage && frostSource && frostCanvas && surfaceCanvas && atmosphereCanvas) {
  const clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v));
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const canvasContext = canvas => canvas.getContext('2d');
  const maskCanvas = document.createElement('canvas');
  const maskCtx = canvasContext(maskCanvas);
  const frostMaskCanvas = document.createElement('canvas');
  const frostMaskCtx = canvasContext(frostMaskCanvas);
  let maskPixels = null, maskW = 0, maskH = 0;
  let frostThresholds = null, frostSourcePixels = null, frostMaskData = null, frostFieldW = 0, frostFieldH = 0, frostRenderProgress = -1;
  let width = 1, height = 1, objectW = 1, objectH = 1, progress = 0, raf = 0, aboutShift = 0, aboutOpacity = 0;
  let drops = [], rain = [], seed = 4099;
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
    drops = getMaskPoints(360);
  };
  const createFrostField = () => {
    if (!frostSource.complete || !frostSource.naturalWidth) return;
    frostFieldW = 360;
    frostFieldH = Math.round(frostFieldW * frostSource.naturalHeight / frostSource.naturalWidth);
    frostMaskCanvas.width = frostFieldW;
    frostMaskCanvas.height = frostFieldH;
    frostMaskCtx.clearRect(0,0,frostFieldW,frostFieldH);
    frostMaskCtx.drawImage(frostSource,0,0,frostFieldW,frostFieldH);
    frostSourcePixels = frostMaskCtx.getImageData(0,0,frostFieldW,frostFieldH).data;

    const count = frostFieldW * frostFieldH;
    const distance = new Float32Array(count);
    const diagonal = Math.SQRT2;
    const far = 1e6;
    let maxDistance = 0;
    for (let i=0;i<count;i++) distance[i] = frostSourcePixels[i*4+3] < 20 ? 0 : far;

    // A chamfer distance field lets the ice front advance from every cut edge and opening.
    for (let y=0;y<frostFieldH;y++) for (let x=0;x<frostFieldW;x++) {
      const i=y*frostFieldW+x;
      let d=distance[i];
      if(x>0)d=Math.min(d,distance[i-1]+1);
      if(y>0)d=Math.min(d,distance[i-frostFieldW]+1);
      if(x>0&&y>0)d=Math.min(d,distance[i-frostFieldW-1]+diagonal);
      if(x<frostFieldW-1&&y>0)d=Math.min(d,distance[i-frostFieldW+1]+diagonal);
      distance[i]=d;
    }
    for (let y=frostFieldH-1;y>=0;y--) for (let x=frostFieldW-1;x>=0;x--) {
      const i=y*frostFieldW+x;
      let d=distance[i];
      if(x<frostFieldW-1)d=Math.min(d,distance[i+1]+1);
      if(y<frostFieldH-1)d=Math.min(d,distance[i+frostFieldW]+1);
      if(x<frostFieldW-1&&y<frostFieldH-1)d=Math.min(d,distance[i+frostFieldW+1]+diagonal);
      if(x>0&&y<frostFieldH-1)d=Math.min(d,distance[i+frostFieldW-1]+diagonal);
      distance[i]=d;
      if(frostSourcePixels[i*4+3]>=20)maxDistance=Math.max(maxDistance,d);
    }

    frostThresholds = new Float32Array(count);
    frostMaskData = frostMaskCtx.createImageData(frostFieldW,frostFieldH);
    for (let y=0;y<frostFieldH;y++) for (let x=0;x<frostFieldW;x++) {
      const i=y*frostFieldW+x;
      if(frostSourcePixels[i*4+3]<2){frostThresholds[i]=1;continue;}
      const nx=x/Math.max(1,frostFieldW-1), ny=y/Math.max(1,frostFieldH-1);
      const inward=distance[i]/Math.max(1,maxDistance);
      const fromColdEdges=.12*(.62*nx+.38*(1-ny));
      const irregularity=.028*Math.sin(x*.071+Math.sin(y*.047)*1.8)+.019*Math.sin(y*.113-x*.039)+.012*Math.sin((x+y)*.173);
      frostThresholds[i]=clamp(.018+inward*.82+fromColdEdges+irregularity,.008,.995);
    }
    frostRenderProgress=-1;
  };
  const drawFrost = amount => {
    if (!frostThresholds || !frostSource.complete || !frostSource.naturalWidth) return;
    const reveal=clamp(amount);
    if(Math.abs(reveal-frostRenderProgress)<.0015)return;
    frostRenderProgress=reveal;
    const mask=frostMaskData;
    for(let i=0;i<frostThresholds.length;i++){
      const edge=frostThresholds[i];
      const t=clamp((reveal-(edge-.024))/.048);
      mask.data[i*4+3]=t*t*(3-2*t)*(frostSourcePixels[i*4+3]||0);
    }
    frostMaskCtx.putImageData(mask,0,0);
    const ctx=canvasContext(frostCanvas);
    ctx.setTransform(frostCanvas.width/objectW,0,0,frostCanvas.height/objectH,0,0);
    ctx.clearRect(0,0,objectW,objectH);
    if(reveal<=0)return;
    ctx.drawImage(frostSource,0,0,objectW,objectH);
    ctx.globalCompositeOperation='destination-in';
    ctx.drawImage(frostMaskCanvas,0,0,objectW,objectH);
    ctx.globalCompositeOperation='source-over';
  };
  const measure = () => {
    const dpr = Math.min(devicePixelRatio || 1, 1.6);
    const s = stage.getBoundingClientRect(), o = {width:equipment.offsetWidth,height:equipment.offsetHeight};
    width = Math.max(1,s.width); height = Math.max(1,s.height); objectW = Math.max(1,o.width); objectH = Math.max(1,o.height);
    for (const c of [surfaceCanvas,frostCanvas,atmosphereCanvas]) {
      const box = c === surfaceCanvas || c === frostCanvas ? o : s;
      c.width = Math.max(1,Math.round(box.width*dpr)); c.height = Math.max(1,Math.round(box.height*dpr));
    }
    frostRenderProgress=-1;
    rain = Array.from({length:Math.min(190,Math.ceil(width/8))},()=>({x:random()*width,y:random()*height,len:8+random()*24,speed:.35+random()*.8,phase:random()}));
    createMask();
  };
  const getProgress = () => {
    const top = sequence.getBoundingClientRect().top + scrollY;
    const timeline = clamp((scrollY-top) / Math.max(1,sequence.offsetHeight-stage.offsetHeight));
    progress = desktopTesting.matches ? clamp((timeline - .32) / .68) : timeline;
    aboutShift = desktopTesting.matches ? (reduceMotion.matches ? Number(timeline >= .12) : smooth(.015,.20,timeline)) : 0;
    aboutOpacity = desktopTesting.matches ? smooth(.09,.20,timeline)*(1-smooth(.32,.38,timeline)) : 0;
    stage.style.setProperty('--about-opacity', String(aboutOpacity));
    stage.style.setProperty('--about-y', `${reduceMotion.matches ? 0 : (1-smooth(.09,.20,timeline))*24}px`);
    const breadcrumbOpacity = 1-smooth(.035,.13,timeline);
    stage.style.setProperty('--breadcrumb-opacity', String(breadcrumbOpacity));
    if (breadcrumb) breadcrumb.inert = breadcrumbOpacity < .01;
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
  const drawSurface = (time, rainLevel) => {
    const ctx=canvasContext(surfaceCanvas);ctx.setTransform(surfaceCanvas.width/objectW,0,0,surfaceCanvas.height/objectH,0,0);ctx.clearRect(0,0,objectW,objectH);
    if (!maskPixels) return;
    const scale=Math.max(.65,objectW/900);
    for(let i=0;i<Math.floor(drops.length*rainLevel);i++){const p=drops[i],r=(2+p.r*5)*scale;drop(ctx,p.x*objectW,p.y*objectH,r,.66+.18*Math.sin(time*.002+p.phase));}
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
    const rainLevel=smooth(.205,.265,progress)*(1-smooth(.385,.445,progress));
    const heatLevel=smooth(.445,.515,progress)*(1-smooth(.625,.695,progress));
    const iceLevel=smooth(.685,.755,progress)*(1-smooth(.865,.935,progress));
    const vibe=smooth(.9,1,progress);
    const poses=[
      {x:0,y:0,s:1,r:0,z:0,rx:0,ry:0},
      {x:-.012,y:-.01,s:1.012,r:.35,z:48,rx:-1.5,ry:2.4},
      {x:.01,y:.006,s:.995,r:-.45,z:-32,rx:1.8,ry:-2.8},
      {x:-.008,y:-.004,s:1.008,r:.3,z:68,rx:-2.2,ry:3.6},
      {x:0,y:0,s:1,r:0,z:8,rx:.6,ry:-.8}
    ];
    const blend=smooth(0,1,t),a=poses[idx],b=poses[idx+1];
    const shakeX=reduceMotion.matches?0:Math.sin(time*.068)*vibe*Math.min(4,objectW*.003);
    const shakeY=reduceMotion.matches?0:Math.sin(time*.091+1.2)*vibe*Math.min(2.5,objectW*.002);
    const depthScale=Math.min(objectW/868,1);
    const shakeZ=reduceMotion.matches?0:Math.sin(time*.057+2.1)*vibe*3;
    const firstTwoSectionTurn=reduceMotion.matches?0:Math.sin(progress*Math.PI*4)*(1-smooth(.46,.52,progress));
    const figmaScale = Math.min(width/1920,1);
    const aboutX = -(Math.min(width*.1770833333,340) + 442.5*figmaScale) * aboutShift;
    const aboutY = 66 * aboutShift;
    const aboutScale = 1 - .228*aboutShift;
    equipment.style.setProperty('--equipment-x',`${aboutX+(a.x+(b.x-a.x)*blend)*objectW+shakeX}px`);
    equipment.style.setProperty('--equipment-y',`${aboutY+(a.y+(b.y-a.y)*blend)*objectH+shakeY}px`);
    equipment.style.setProperty('--equipment-scale',String((a.s+(b.s-a.s)*blend)*aboutScale));
    equipment.style.setProperty('--equipment-rotate',`${a.r+(b.r-a.r)*blend-1.2*aboutShift+.35*firstTwoSectionTurn}deg`);
    equipment.style.setProperty('--equipment-depth',`${(a.z+(b.z-a.z)*blend)*depthScale+shakeZ}px`);
    drawFrost(Math.max(aboutOpacity,iceLevel));
    equipment.style.setProperty('--equipment-tilt-x',`${a.rx+(b.rx-a.rx)*blend-.6*aboutShift-.8*iceLevel+.55*firstTwoSectionTurn}deg`);
    equipment.style.setProperty('--equipment-tilt-y',`${a.ry+(b.ry-a.ry)*blend+1.2*aboutShift+1.2*iceLevel+.8*firstTwoSectionTurn}deg`);
    stage.style.setProperty('--heat-opacity',String(heatLevel*(.72+.08*Math.sin(time*.006))));
    drawSurface(time,rainLevel);drawAtmosphere(time,rainLevel,heatLevel,vibe);
    raf=requestAnimationFrame(draw);
  };
  const requestDraw=()=>{if(!raf)raf=requestAnimationFrame(draw);};
  equipmentImage.addEventListener('load',()=>{createMask();requestDraw();},{once:true});
  frostSource.addEventListener('load',()=>{createFrostField();requestDraw();},{once:true});
  const observer=new ResizeObserver(()=>{measure();requestDraw();});observer.observe(stage);observer.observe(equipment);
  addEventListener('scroll',requestDraw,{passive:true});addEventListener('resize',()=>{measure();requestDraw();},{passive:true});document.addEventListener('visibilitychange',requestDraw);
  measure();getProgress();requestDraw();
  if(frostSource.complete)createFrostField();
}
