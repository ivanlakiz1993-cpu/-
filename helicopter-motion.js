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
  const splitMedia=matchMedia('(min-width: 37.5625rem), (max-width: 37.5rem)');
  const mobileMedia=matchMedia('(max-width: 37.5rem)');
  const root=document.documentElement,{sample,poses,transitions,matrix,lerp,smooth}=storyboard;
  const mobileHelicopterTop=progress=>{
    const positions=[25.12,38.62,52.9,64.62];
    const entrances=[[.375,.47],[.645,.74],[.895,.97]];
    return positions[0]+entrances.reduce((offset,[start,end],i)=>
      offset+(positions[i+1]-positions[i])*smooth((progress-start)/(end-start)),0);
  };
  let enabled=false,splitEnabled=false,splitOverlay=null,contextLost=false,raf=0,resizeFrame=0,viewport=innerHeight;
  let sceneWidth=0,sceneHeight=0,entryStart=0,entryDistance=0,sequenceStart=0,sequenceDistance=0,end=0;
  let splitIntroTop=0,splitPreTravel=0,splitSeam=0,splitTopTravel=0,splitBottomTravel=0;
  let layoutWidth=0,layoutHeight=0,lastTime=0,rotorTime=0,lastScroll=NaN,target=0,progress=0;
  let state=sample(0);
  const rotorAngles=Array.from({length:12},(_,i)=>{
    const angle=i/12*Math.PI*2;
    return [Math.cos(angle),Math.sin(angle)];
  });
  const projectedBounds=rotation=>{
    let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
    const include=(x,y,z)=>{
      const perspective=22/(22-z),px=x*perspective,py=-y*perspective;
      left=Math.min(left,px);right=Math.max(right,px);top=Math.min(top,py);bottom=Math.max(bottom,py);
    };
    for(const p of model.points){
      if(p.group==='mainRotor'){
        const dx=p.x-model.mainRotor[0],dz=p.z-model.mainRotor[2];
        for(const [c,s] of rotorAngles){
          const x=model.mainRotor[0]+c*dx+s*dz,y=p.y,z=model.mainRotor[2]-s*dx+c*dz;
          include(rotation[0]*x+rotation[1]*y+rotation[2]*z,
            rotation[3]*x+rotation[4]*y+rotation[5]*z,
            rotation[6]*x+rotation[7]*y+rotation[8]*z);
        }
      }else if(p.group==='tailRotor'){
        const dx=p.x-model.tailRotor[0],dy=p.y-model.tailRotor[1];
        for(const [c,s] of rotorAngles){
          const x=model.tailRotor[0]+c*dx+s*dy,y=model.tailRotor[1]-s*dx+c*dy,z=p.z;
          include(rotation[0]*x+rotation[1]*y+rotation[2]*z,
            rotation[3]*x+rotation[4]*y+rotation[5]*z,
            rotation[6]*x+rotation[7]*y+rotation[8]*z);
        }
      }else{
        include(rotation[0]*p.x+rotation[1]*p.y+rotation[2]*p.z,
          rotation[3]*p.x+rotation[4]*p.y+rotation[5]*p.z,
          rotation[6]*p.x+rotation[7]*p.y+rotation[8]*p.z);
      }
    }
    return {left,right,top,bottom,width:right-left,height:bottom-top,
      centerX:(left+right)/2,centerY:(top+bottom)/2};
  };
  const mobileFit=(bounds,scale,height)=>Math.min(1.1,
    .9*Math.min(1920/(bounds.width*scale),height/(bounds.height*scale))/1.12);
  // Desktop framing follows the body. Mobile framing also fits the rotor tips,
  // including during edge-on poses, so the blades remain inside the canvas.
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
    const bounds=projectedBounds(m);
    return {scale,x:(bx+bw/2)*1920-(left+right)/2*scale,y:(by+bh/2)*pose.height-(top+bottom)/2*scale,
      mobileFit:mobileFit(bounds,scale,pose.height),mobileCenterX:bounds.centerX,mobileCenterY:bounds.centerY};
  });
  const mobileFitProfiles=transitions.map(transition=>{
    const samples=[];
    for(let i=0;i<=32;i++){
      const p=transition.start+(transition.end-transition.start)*Math.min(i/32,1-1e-7);
      const pose=sample(p,true),a=calibrations[transition.from],b=calibrations[transition.to];
      const scale=lerp(a.scale,b.scale,pose.mix);
      const height=lerp(poses[transition.from].height,poses[transition.to].height,pose.mix);
      const bounds=projectedBounds(pose.matrix);
      samples.push({mix:pose.mix,fit:mobileFit(bounds,scale,height),centerX:bounds.centerX,centerY:bounds.centerY});
    }
    const end=calibrations[transition.to];
    samples.push({mix:1,fit:end.mobileFit,centerX:end.mobileCenterX,centerY:end.mobileCenterY});
    return {from:transition.from,to:transition.to,samples};
  });
  function getMobileFit(pose){
    if(pose.from===pose.to){const point=calibrations[pose.from];return {fit:point.mobileFit,centerX:point.mobileCenterX,centerY:point.mobileCenterY};}
    const profile=mobileFitProfiles.find(item=>item.from===pose.from&&item.to===pose.to);
    if(!profile){const point=calibrations[pose.from];return {fit:point.mobileFit,centerX:point.mobileCenterX,centerY:point.mobileCenterY};}
    const samples=profile.samples;let i=1;
    while(i<samples.length-1&&samples[i].mix<pose.mix)i++;
    const a=samples[i-1],b=samples[i],t=(pose.mix-a.mix)/Math.max(.000001,b.mix-a.mix);
    return {fit:lerp(a.fit,b.fit,t)*.97,centerX:lerp(a.centerX,b.centerX,t),centerY:lerp(a.centerY,b.centerY,t)};
  }
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
      // Desktop hides the original cover and shows these split copies from the
      // first frame, so keep the reveal layer on them as well.
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
    sceneFrame.style.setProperty('--metrics-canvas-ratio',String(width/height));
    renderer.resize(width,height,devicePixelRatio||1);
  }
  function compose(){
    state=sample(progress,mobileMedia.matches);sizeFrame();
    stage.dataset.scene=String(state.scene);stage.dataset.progress=state.progress.toFixed(5);
    if(mobileMedia.matches)stage.style.setProperty('--mobile-helicopter-top',`${mobileHelicopterTop(state.progress)}%`);
    else stage.style.removeProperty('--mobile-helicopter-top');
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
      if(mobileMedia.matches){
        const hasEntered=scroll>entryStart;
        root.classList.toggle('hero-split-opening',hasEntered);
      }
      if(splitOverlay){
        splitOverlay.style.setProperty('--hero-split-y',`${splitSeam}px`);
        splitOverlay.style.setProperty('--hero-split-hero-height',`${hero.offsetHeight}px`);
        splitOverlay.style.setProperty('--hero-split-top-offset',`${-coverScroll-opening*splitTopTravel}px`);
        splitOverlay.style.setProperty('--hero-split-bottom-offset',`${-coverScroll+opening*splitBottomTravel}px`);
        splitOverlay.style.visibility=opening>=1?'hidden':'visible';
      }
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
    const mobile=mobileMedia.matches;
    const scale=lerp(a.scale,b.scale,state.mix),mobilePose=mobile?getMobileFit(state):null;
    const mobileScale=mobile?mobilePose.fit:1,animatedScale=scale*mobileScale*(1+arc*.12);
    const centerX=mobile?(960-mobilePose.centerX*animatedScale)*unit:lerp(a.x,b.x,state.mix)*unit;
    const centerY=mobile?(state.height/2-mobilePose.centerY*animatedScale)*unit:
      lerp(a.y,b.y,state.mix)*unit-arc*sceneHeight*.035;
    renderer.render({matrix:state.matrix,
      scale:animatedScale*unit,
      centerX,centerY,
      angle:rotorTime*.0032});
    stage.classList.add('is-rendered');
    raf=requestAnimationFrame(draw);
  }
  function wake(){if(enabled&&!raf&&!document.hidden)draw(performance.now());}
  function measure(){
    resizeFrame=0;if(!enabled)return;
    viewport=innerHeight;
    const heroHeight=hero.offsetHeight,introTop=intro.getBoundingClientRect().top+scrollY;
    sequenceDistance=viewport*(mobileMedia.matches?4.2:4.8);
    entryDistance=splitEnabled?viewport*.85:0;
    splitIntroTop=introTop;
    splitPreTravel=splitEnabled?Math.max(0,heroHeight-viewport):0;
    const splitHold=splitEnabled&&!mobileMedia.matches?viewport*.18:0;
    entryStart=splitEnabled?introTop+splitPreTravel+splitHold:introTop+heroHeight-viewport;
    sequenceStart=splitEnabled?entryStart+entryDistance:introTop+heroHeight;
    const runHeight=splitPreTravel+splitHold+entryDistance+sequenceDistance+viewport*1.5;
    end=splitEnabled?introTop+runHeight:sequenceStart+runHeight;
    if(splitEnabled){
      const line=hero.querySelector('.grid-mid');
      const seam=line.getBoundingClientRect().top-hero.getBoundingClientRect().top;
      splitSeam=Math.max(0,Math.min(viewport-1,seam));
      splitTopTravel=Math.max(0,splitSeam-splitPreTravel);
      splitBottomTravel=viewport-splitSeam+splitPreTravel;
      intro.style.setProperty('--intro-hero-height',`${heroHeight}px`);
      if(splitOverlay){
        splitOverlay.style.setProperty('--hero-split-y',`${splitSeam}px`);
        splitOverlay.style.setProperty('--hero-split-hero-height',`${heroHeight}px`);
      }
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
    root.classList.toggle('hero-split-opening',splitEnabled&&!mobileMedia.matches);
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
