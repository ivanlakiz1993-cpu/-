/* Scroll controls one helicopter/camera; elapsed time drives only its rotors. */
(() => {
  const intro=document.querySelector('.intro-sequence');
  const hero=intro?.querySelector('.hero'),section=intro?.querySelector('.metrics');
  const stage=section?.querySelector('.metrics-desktop');
  const sceneFrame=stage?.querySelector('.metrics-desktop__frame'),canvas=stage?.querySelector('canvas');
  const copies=[...(stage?.querySelectorAll('[data-achievement]')||[])];
  const model=window.HelicopterModel,storyboard=window.HelicopterStoryboard;
  if(!intro||!hero||!sceneFrame||!canvas||!model||!storyboard||!window.HelicopterRenderer)return;
  const renderer=window.HelicopterRenderer.create(canvas,model);
  if(!renderer)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const splitMedia=matchMedia('(min-width: 1200px)');
  const root=document.documentElement,{sample,poses,matrix,lerp,smooth}=storyboard;
  let enabled=false,splitEnabled=false,splitOverlay=null,contextLost=false,raf=0,resizeFrame=0,viewport=innerHeight;
  let sceneWidth=0,sceneHeight=0,entryStart=0,entryDistance=0,sequenceStart=0,sequenceDistance=0,end=0;
  let splitIntroTop=0,splitPreTravel=0,splitSeam=0,splitTopTravel=0,splitBottomTravel=0;
  let layoutWidth=0,layoutHeight=0,lastTime=0,rotorTime=0,lastScroll=NaN,target=0,progress=0;
  let state=sample(0);
  // Fit the airframe, not the spinning rotor envelope. This keeps the scale fixed
  // during holds and lets blades cross the edges of close-ups, as in the reference.
  const calibrations=poses.map(pose=>{
    const m=matrix(pose.rotation);
    let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
    for(const p of model.points){
      if(p.group!=='body')continue;
      const x=m[0]*p.x+m[1]*p.y+m[2]*p.z,y=m[3]*p.x+m[4]*p.y+m[5]*p.z,z=m[6]*p.x+m[7]*p.y+m[8]*p.z;
      const perspective=22/(22-z);
      left=Math.min(left,x*perspective);right=Math.max(right,x*perspective);
      top=Math.min(top,-y*perspective);bottom=Math.max(bottom,-y*perspective);
    }
    const [bx,by,bw,bh]=pose.box,scale=Math.min(bw*1920/(right-left),bh*pose.height/(bottom-top));
    return {scale,x:(bx+bw/2)*1920-(left+right)/2*scale,y:(by+bh/2)*pose.height-(top+bottom)/2*scale};
  });
  function stop(){cancelAnimationFrame(raf);raf=0;lastTime=0;}
  function ensureSplitOverlay(){
    if(splitOverlay)return;
    splitOverlay=document.createElement('div');
    splitOverlay.className='hero-split';
    splitOverlay.setAttribute('aria-hidden','true');
    for(const side of ['top','bottom']){
      const half=document.createElement('div'),copy=hero.cloneNode(true);
      half.className=`hero-split__half hero-split__half--${side}`;
      copy.removeAttribute('aria-label');
      copy.querySelectorAll('[id]').forEach(node=>node.removeAttribute('id'));
      copy.querySelector('.hero-reveal')?.remove();
      copy.inert=true;
      half.append(copy);splitOverlay.append(half);
    }
    document.body.append(splitOverlay);
  }
  function sizeFrame(){
    const width=Math.min(stage.clientWidth,viewport*1920/state.height),height=width*state.height/1920;
    if(Math.abs(width-sceneWidth)<.01&&Math.abs(height-sceneHeight)<.01)return;
    sceneWidth=width;sceneHeight=height;
    sceneFrame.style.setProperty('--metrics-frame-width',`${width}px`);
    sceneFrame.style.setProperty('--metrics-frame-height',`${height}px`);
    renderer.resize(width,height,devicePixelRatio||1);
  }
  function compose(){
    state=sample(progress);sizeFrame();
    stage.dataset.scene=String(state.scene);stage.dataset.progress=state.progress.toFixed(5);
    copies.forEach((copy,i)=>{
      copy.style.opacity=String(state.achievement[i]);
      copy.style.setProperty('--copy-shift',`${state.textY[i]*sceneWidth/1920}px`);
    });
  }
  function updateScroll(){
    const scroll=window.scrollY;
    if(splitEnabled){
      const coverScroll=Math.max(0,Math.min(splitPreTravel,scroll-splitIntroTop));
      const opening=smooth((scroll-entryStart)/entryDistance);
      splitOverlay.style.setProperty('--hero-split-top-offset',`${-coverScroll-opening*splitTopTravel}px`);
      splitOverlay.style.setProperty('--hero-split-bottom-offset',`${-coverScroll+opening*splitBottomTravel}px`);
      splitOverlay.style.visibility=opening>=1?'hidden':'visible';
    }
    target=Math.max(0,Math.min(1,(scroll-sequenceStart)/sequenceDistance));
    if(scroll<=entryStart||scroll>=end){progress=target;compose();}
    lastScroll=scroll;
  }
  function draw(time){
    raf=0;if(!enabled||document.hidden)return;
    if(window.scrollY!==lastScroll)updateScroll();
    if(window.scrollY<entryStart||window.scrollY>=end||root.classList.contains('menu-open')){lastTime=0;return;}
    const dt=lastTime?Math.min(50,time-lastTime):16.67;lastTime=time;rotorTime+=dt;
    // Short scrub smoothing removes wheel-event steps. It settles to the exact
    // scroll pose; there is no autonomous rotation or breathing of the airframe.
    if(progress!==target){
      progress=lerp(progress,target,1-Math.exp(-dt/95));
      if(Math.abs(progress-target)<.000015)progress=target;
      compose();
    }
    const a=calibrations[state.from],b=calibrations[state.to],unit=sceneWidth/1920;
    const arc=Math.sin(Math.PI*state.mix);
    renderer.render({matrix:state.matrix,
      scale:lerp(a.scale,b.scale,state.mix)*unit*(1+arc*.12),
      centerX:lerp(a.x,b.x,state.mix)*unit,
      centerY:lerp(a.y,b.y,state.mix)*unit-arc*sceneHeight*.035,
      angle:rotorTime*.0032});
    stage.classList.add('is-rendered');
    raf=requestAnimationFrame(draw);
  }
  function wake(){if(enabled&&!raf&&!document.hidden)draw(performance.now());}
  function measure(){
    resizeFrame=0;if(!enabled)return;
    viewport=innerHeight;
    const heroHeight=hero.offsetHeight,introTop=intro.getBoundingClientRect().top+scrollY;
    sequenceDistance=viewport*4.8;
    entryDistance=splitEnabled?viewport*.85:0;
    splitIntroTop=introTop;
    splitPreTravel=splitEnabled?Math.max(0,heroHeight-viewport):0;
    const splitHold=splitEnabled?viewport*.18:0;
    entryStart=splitEnabled?introTop+splitPreTravel+splitHold:introTop+heroHeight-viewport;
    sequenceStart=splitEnabled?entryStart+entryDistance:introTop+heroHeight;
    const runHeight=splitPreTravel+splitHold+entryDistance+sequenceDistance+viewport*1.5;
    end=splitEnabled?introTop+runHeight:sequenceStart+runHeight;
    if(splitEnabled){
      const line=hero.querySelector('.grid-mid');
      splitSeam=Math.max(0,Math.min(viewport-1,line.getBoundingClientRect().top-hero.getBoundingClientRect().top));
      splitTopTravel=Math.max(0,splitSeam-splitPreTravel);
      splitBottomTravel=viewport-splitSeam+splitPreTravel;
      intro.style.setProperty('--intro-hero-height',`${heroHeight}px`);
      splitOverlay.style.setProperty('--hero-split-y',`${splitSeam}px`);
      splitOverlay.style.setProperty('--hero-split-hero-height',`${heroHeight}px`);
    }
    intro.style.setProperty('--metrics-run-height',`${runHeight}px`);
    updateScroll();progress=target;compose();wake();
  }
  function requestMeasure(){if(!resizeFrame)resizeFrame=requestAnimationFrame(measure);}
  function configure(){
    stop();enabled=!reduced.matches&&!contextLost;
    splitEnabled=enabled&&splitMedia.matches;
    if(splitEnabled)ensureSplitOverlay();
    root.classList.toggle('metrics-sequence',enabled);
    root.classList.toggle('hero-split-active',splitEnabled);
    hero.inert=false;
    if(!splitEnabled)intro.style.removeProperty('--intro-hero-height');
    if(enabled)measure();
    else {intro.style.removeProperty('--metrics-run-height');intro.style.removeProperty('--intro-hero-height');stage.classList.remove('is-rendered');}
  }
  window.addEventListener('scroll',()=>{if(enabled){updateScroll();wake();}},{passive:true});
  window.addEventListener('resize',requestMeasure,{passive:true});
  reduced.addEventListener('change',configure);splitMedia.addEventListener('change',configure);
  document.addEventListener('visibilitychange',()=>{stop();wake();});
  canvas.addEventListener('webglcontextlost',()=>{contextLost=true;configure();});
  new MutationObserver(()=>{if(root.classList.contains('menu-open'))stop();else wake();}).observe(root,{attributes:true,attributeFilter:['class']});
  if('ResizeObserver' in window)new ResizeObserver(()=>{
    const w=intro.clientWidth,h=hero.offsetHeight;
    if(w!==layoutWidth||h!==layoutHeight){layoutWidth=w;layoutHeight=h;requestMeasure();}
  }).observe(hero);
  document.fonts?.ready.then(requestMeasure);
  configure();
})();
