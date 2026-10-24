/* Scroll controls one helicopter/camera; elapsed time drives only its rotors. */
(() => {
  const intro=document.querySelector('.intro-sequence');
  const hero=intro?.querySelector('.hero'),section=intro?.querySelector('.metrics');
  const stage=section?.querySelector('.metrics-desktop');
  const sceneFrame=stage?.querySelector('.metrics-desktop__frame'),canvas=stage?.querySelector('.metrics-desktop__particles');
  const sparksCanvas=stage?.querySelector('.metrics-desktop__sparks'),sparksContext=sparksCanvas?.getContext('2d');
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
  const mobileHelicopterFlight=progress=>{
    const flight=smooth((progress-.645)/(.74-.645));
    const arc=Math.sin(Math.PI*flight)**2;
    const returnFlight=smooth((progress-.84)/(.895-.84));
    const travel=flight*(1-returnFlight);
    return {top:mobileHelicopterTop(progress)-arc*7.5,left:-travel*6.5,depth:travel*1.2};
  };
  let enabled=false,splitEnabled=false,splitOverlay=null,contextLost=false,raf=0,resizeFrame=0,viewport=innerHeight;
  let sceneWidth=0,sceneHeight=0,entryStart=0,entryDistance=0,sequenceStart=0,sequenceDistance=0,end=0;
  let splitIntroTop=0,splitPreTravel=0,splitSeam=0,splitTopTravel=0,splitBottomTravel=0;
  let layoutWidth=0,layoutHeight=0,lastTime=0,rotorTime=0,lastScroll=NaN,target=0,progress=0;
  let sparksTarget=0,sparksProgress=0,sparkParticles=null,sparkRatio=1,sparkWidth=0,sparkHeight=0;
  let state=sample(0);
  function resizeSparks(width,height){
    if(!sparksContext)return;
    sparkWidth=width;sparkHeight=height;
    sparkRatio=Math.min(devicePixelRatio||1,1.5);
    const pixelWidth=Math.max(1,Math.round(width*sparkRatio)),pixelHeight=Math.max(1,Math.round(height*sparkRatio));
    if(sparksCanvas.width!==pixelWidth||sparksCanvas.height!==pixelHeight){
      sparksCanvas.width=pixelWidth;sparksCanvas.height=pixelHeight;sparkParticles=null;
    }
    sparksContext.setTransform(sparkRatio,0,0,sparkRatio,0,0);
  }
  function drawSparks(amount){
    if(!sparksContext)return;
    sparksContext.clearRect(0,0,sparkWidth,sparkHeight);
    if(!sparkParticles||amount<=0)return;
    const bins=Array.from({length:24},()=>[]),amountClamped=Math.max(0,Math.min(1,amount));
    const mobileFlight=mobileMedia.matches?mobileHelicopterFlight(state.progress):null;
    const originOffsetX=mobileFlight?mobileFlight.left/100*sceneWidth:0;
    const originOffsetY=mobileFlight?mobileFlight.top/100*sparkHeight:0;
    for(const particle of sparkParticles){
      const fall=Math.max(0,Math.min(1,(amountClamped-particle.seed*.22)/(1-particle.seed*.22)));
      if(fall<=0)continue;
      const eased=smooth(fall),fade=1-smooth((fall-.31)/.69);
      const sourceX=mobileFlight?originOffsetX+sceneWidth-particle.x:particle.x;
      const sourceY=particle.y+originOffsetY;
      const availableFall=Math.max(0,sparkHeight-sourceY);
      const fallDistance=availableFall;
      const drift=(particle.seed-.5)*sceneWidth*.045;
      const sway=Math.sin(fall*7.5+particle.seed*19)*sceneWidth*.0035;
      const x=sourceX+drift*eased+sway;
      const y=sourceY+fallDistance*eased;
      const edgeFadeDistance=Math.max(1,Math.min(sceneHeight*.3,availableFall*.24));
      const edgeFade=1-smooth((y-(sparkHeight-edgeFadeDistance))/edgeFadeDistance);
      const alpha=particle.strength*fade*edgeFade*Math.min(1,fall*7);
      if(alpha<.025)continue;
      const bin=Math.min(bins.length-1,Math.floor(alpha*bins.length));
      bins[bin].push(particle);
    }
    sparksContext.globalCompositeOperation='lighter';
    for(let i=0;i<bins.length;i++){
      if(!bins[i].length)continue;
      const opacity=(i+1)/bins.length;
      sparksContext.fillStyle=`rgba(255,${Math.round(143+opacity*76)},${Math.round(61+opacity*66)},${opacity*.18})`;
      sparksContext.beginPath();
      for(const particle of bins[i]){
        const fall=Math.max(0,Math.min(1,(amountClamped-particle.seed*.22)/(1-particle.seed*.22))),eased=smooth(fall);
        const sourceX=mobileFlight?originOffsetX+sceneWidth-particle.x:particle.x;
        const sourceY=particle.y+originOffsetY,availableFall=Math.max(0,sparkHeight-sourceY);
        const fallDistance=availableFall;
        const x=sourceX+(particle.seed-.5)*sceneWidth*.045*eased+Math.sin(fall*7.5+particle.seed*19)*sceneWidth*.0035;
        const y=sourceY+fallDistance*eased,size=(.7+particle.seed*1.15)*Math.max(.72,sceneWidth/1920);
        sparksContext.rect(x-size*.55,y-size*1.6,size*1.1,size*3.2);
      }
      sparksContext.fill();
      sparksContext.fillStyle=`rgba(255,${Math.round(205+opacity*45)},${Math.round(139+opacity*90)},${opacity*.62})`;
      sparksContext.beginPath();
      for(const particle of bins[i]){
        const fall=Math.max(0,Math.min(1,(amountClamped-particle.seed*.22)/(1-particle.seed*.22))),eased=smooth(fall);
        const sourceX=mobileFlight?originOffsetX+sceneWidth-particle.x:particle.x;
        const sourceY=particle.y+originOffsetY,availableFall=Math.max(0,sparkHeight-sourceY);
        const fallDistance=availableFall;
        const x=sourceX+(particle.seed-.5)*sceneWidth*.045*eased+Math.sin(fall*7.5+particle.seed*19)*sceneWidth*.0035;
        const y=sourceY+fallDistance*eased,size=(.7+particle.seed*1.15)*Math.max(.72,sceneWidth/1920);
        sparksContext.rect(x-size*.3,y-size*.35,size*.6,size*.7);
      }
      sparksContext.fill();
    }
    sparksContext.globalCompositeOperation='source-over';
  }
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
    const mobileBounds=projectedBounds(matrix(pose.mobileRotation||pose.rotation));
    return {scale,x:(bx+bw/2)*1920-(left+right)/2*scale,y:(by+bh/2)*pose.height-(top+bottom)/2*scale,
      mobileFit:mobileFit(mobileBounds,scale,pose.height),mobileCenterX:mobileBounds.centerX,mobileCenterY:mobileBounds.centerY};
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
    resizeSparks(sceneFrame.clientWidth,sceneFrame.clientHeight);
    renderer.resize(width,height,devicePixelRatio||1);
  }
  function compose(){
    state=sample(progress,mobileMedia.matches);sizeFrame();
    stage.dataset.scene=String(state.scene);stage.dataset.progress=state.progress.toFixed(5);
    if(mobileMedia.matches){
      const flight=mobileHelicopterFlight(state.progress);
      stage.style.setProperty('--mobile-helicopter-top',`${flight.top}%`);
      stage.style.setProperty('--mobile-helicopter-left',`${flight.left}%`);
    }else{
      stage.style.removeProperty('--mobile-helicopter-top');
      stage.style.removeProperty('--mobile-helicopter-left');
    }
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
    sparksTarget=sparksContext?Math.max(0,Math.min(1,(scroll-(sequenceStart+sequenceDistance))/Math.max(1,end-(sequenceStart+sequenceDistance)))):0;
    if(scroll<=entryStart||scroll>=end){progress=target;sparksProgress=sparksTarget;compose();}
    lastScroll=scroll;
  }
  function draw(time){
    raf=0;if(!enabled||document.hidden)return;
    if(window.scrollY!==lastScroll)updateScroll();
    if(window.scrollY<entryStart||window.scrollY>=end||root.classList.contains('menu-open')){drawSparks(sparksProgress);lastTime=0;return;}
    const dt=lastTime?Math.min(50,time-lastTime):16.67;lastTime=time;rotorTime+=dt;
    // Short scrub smoothing removes wheel-event steps. It settles to the exact
    // scroll pose; there is no autonomous rotation or breathing of the airframe.
    if(progress!==target||sparksProgress!==sparksTarget){
      progress=lerp(progress,target,1-Math.exp(-dt/95));
      if(Math.abs(progress-target)<.000015)progress=target;
      sparksProgress=lerp(sparksProgress,sparksTarget,1-Math.exp(-dt/120));
      if(Math.abs(sparksProgress-sparksTarget)<.000015)sparksProgress=sparksTarget;
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
    const mobileFlight=mobile?mobileHelicopterFlight(state.progress):null;
    const helicopterFrame={matrix:state.matrix,
      scale:animatedScale*unit,
      centerX,centerY,
      depth:mobileFlight?.depth||0,
      angle:rotorTime*.0032};
    if(sparksProgress>0&&sparkParticles===null){
      renderer.render({...helicopterFrame,disintegration:0});
      sparkParticles=renderer.captureParticles();
    }
    renderer.render({...helicopterFrame,disintegration:sparksProgress});
    drawSparks(sparksProgress);
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
