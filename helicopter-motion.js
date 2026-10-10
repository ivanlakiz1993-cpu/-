/* One 3D helicopter. Scroll controls its pose and copy; time controls rotors only. */
(() => {
  const intro = document.querySelector('.intro-sequence');
  const hero = intro?.querySelector('.hero');
  const section = intro?.querySelector('.metrics');
  const stage = section?.querySelector('.metrics-desktop');
  const sceneFrame = stage?.querySelector('.metrics-desktop__frame');
  const canvas = stage?.querySelector('canvas');
  const copies = [...(stage?.querySelectorAll('[data-achievement]') || [])];
  const model = window.HelicopterModel;
  const storyboard = window.HelicopterStoryboard;
  if (!intro || !hero || !section || !stage || !sceneFrame || !canvas || !model?.points.length || !storyboard) return;
  const context = canvas.getContext('2d');
  if (!context) return;

  const desktop = matchMedia('(min-width: 901px)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const root = document.documentElement;
  const {points} = model;
  const {sample, poses, matrix, lerp, smooth} = storyboard;
  const buckets = Array.from({length: 8}, () => []);
  const projected = points.map(() => ({x:0, y:0, size:0}));
  let enabled = false;
  let raf = 0;
  let resizeFrame = 0;
  let viewport = innerHeight;
  let sceneWidth = 0;
  let sceneHeight = 0;
  let entryStart = 0;
  let entryDistance = 0;
  let sequenceStart = 0;
  let sequenceDistance = 0;
  let end = 0;
  let layoutWidth = 0;
  let layoutHeight = 0;
  let lastTime = 0;
  let rotorTime = 0;
  let lastScroll = NaN;
  let state = sample(0);
  const calibrations = [];

  // Calibrate each composition with frozen rotor geometry; spinning blades must
  // never change the fitted scale or move the body when the user stops scrolling.
  for (const pose of poses) {
    const m = matrix(pose.rotation);
    let left=Infinity, right=-Infinity, top=Infinity, bottom=-Infinity;
    for (const point of points) {
      const x=m[0]*point.x+m[1]*point.y+m[2]*point.z;
      const y=m[3]*point.x+m[4]*point.y+m[5]*point.z;
      const z=m[6]*point.x+m[7]*point.y+m[8]*point.z;
      const perspective=16/(16-z);
      left=Math.min(left,x*perspective); right=Math.max(right,x*perspective);
      top=Math.min(top,-y*perspective); bottom=Math.max(bottom,-y*perspective);
    }
    const [bx,by,bw,bh]=pose.box;
    const scale=Math.min(bw*1920/(right-left),bh*pose.height/(bottom-top));
    calibrations.push({scale, x:(bx+bw/2)*1920-(left+right)/2*scale,
      y:(by+bh/2)*pose.height-(top+bottom)/2*scale});
  }
  function stop() { cancelAnimationFrame(raf); raf=0; lastTime=0; }
  function sizeFrame() {
    const width=Math.min(stage.clientWidth,viewport*1920/state.height);
    const height=width*state.height/1920;
    if (Math.abs(width-sceneWidth)<.01 && Math.abs(height-sceneHeight)<.01) return;
    sceneWidth=width; sceneHeight=height;
    sceneFrame.style.setProperty('--metrics-frame-width',`${width}px`);
    sceneFrame.style.setProperty('--metrics-frame-height',`${height}px`);
    const dpr=Math.min(devicePixelRatio||1,1.5);
    const pixelWidth=Math.max(1,Math.round(width*dpr));
    const pixelHeight=Math.max(1,Math.round(height*dpr));
    if(canvas.width!==pixelWidth || canvas.height!==pixelHeight) {
      canvas.width=pixelWidth; canvas.height=pixelHeight;
    }
    context.setTransform(pixelWidth/width,0,0,pixelHeight/height,0,0);
  }
  function updateScroll() {
    const scroll=window.scrollY;
    const entry=smooth((scroll-entryStart)/entryDistance);
    intro.style.setProperty('--metrics-entry',String(entry));
    intro.style.setProperty('--hero-opacity',String(1-entry));
    hero.inert=entry>.98;
    state=sample((scroll-sequenceStart)/sequenceDistance);
    stage.dataset.scene=String(state.scene);
    stage.dataset.progress=state.progress.toFixed(5);
    copies.forEach((copy,index)=>{copy.style.opacity=String(state.achievement[index]);});
    sizeFrame();
    lastScroll=scroll;
  }
  function draw(time) {
    raf=0;
    if(!enabled || document.hidden) return;
    if(window.scrollY!==lastScroll) updateScroll();
    if(window.scrollY<=entryStart || window.scrollY>=end || root.classList.contains('menu-open')) {
      lastTime=0;
      return;
    }
    const elapsed=lastTime?Math.min(50,time-lastTime):0;
    lastTime=time;
    rotorTime+=elapsed;
    const angle=rotorTime*.0012;
    const rc=Math.cos(angle),rs=Math.sin(angle);
    const tc=Math.cos(angle*2.5),ts=Math.sin(angle*2.5);
    const m=state.matrix;
    const a=calibrations[state.from],b=calibrations[state.to];
    const scale=lerp(a.scale,b.scale,state.mix)*sceneWidth/1920;
    const centerX=lerp(a.x,b.x,state.mix)*sceneWidth/1920;
    const centerY=lerp(a.y,b.y,state.mix)*sceneWidth/1920;
    buckets.forEach(bucket=>{bucket.length=0;});
    context.clearRect(0,0,sceneWidth,sceneHeight);
    for(let i=0;i<points.length;i++) {
      const point=points[i];
      let x=point.x,y=point.y,z=point.z;
      let nx=point.nx,ny=point.ny,nz=point.nz;
      if(point.group==='mainRotor') {
        x=point.x*rc-point.z*rs; z=point.x*rs+point.z*rc;
        nx=point.nx*rc-point.nz*rs; nz=point.nx*rs+point.nz*rc;
      } else if(point.group==='tailRotor') {
        x=-4.6+(point.x+4.6)*tc-(point.y-.64)*ts;
        y=.64+(point.x+4.6)*ts+(point.y-.64)*tc;
        nx=point.nx*tc-point.ny*ts; ny=point.nx*ts+point.ny*tc;
      }
      const facing=m[6]*nx+m[7]*ny+m[8]*nz;
      if(!point.doubleSided && facing<-.02) continue;
      const rx=m[0]*x+m[1]*y+m[2]*z;
      const ry=m[3]*x+m[4]*y+m[5]*z;
      const rz=m[6]*x+m[7]*y+m[8]*z;
      const perspective=16/(16-rz);
      const p=projected[i];
      p.x=centerX+rx*perspective*scale;
      p.y=centerY-ry*perspective*scale;
      p.size=Math.max(.45,sceneWidth/1920*(point.edge?1.3:.85)*perspective);
      const light=point.light*(point.doubleSided?.85:.45+.55*Math.max(0,facing));
      buckets[Math.min(7,Math.floor(light*8))].push(p);
    }
    for(let bucket=0;bucket<buckets.length;bucket++) {
      context.beginPath();
      for(const p of buckets[bucket]) {
        context.moveTo(p.x+p.size,p.y);
        context.arc(p.x,p.y,p.size,0,Math.PI*2);
      }
      context.strokeStyle=`rgba(218,211,195,${.065+bucket*.077})`;
      context.lineWidth=Math.max(.45,sceneWidth/1920*.65);
      context.stroke();
    }
    stage.classList.add('is-rendered');
    raf=requestAnimationFrame(draw);
  }
  function wake() { if(enabled && !raf && !document.hidden) draw(performance.now()); }
  function measure() {
    resizeFrame=0;
    if(!enabled) return;
    viewport=window.innerHeight;
    const heroHeight=hero.offsetHeight;
    const introTop=intro.getBoundingClientRect().top+window.scrollY;
    const travel=Math.max(0,heroHeight-viewport);
    entryDistance=viewport*.8;
    sequenceDistance=viewport*4.8;
    entryStart=introTop+travel;
    sequenceStart=entryStart+entryDistance;
    // Let the last achievement rest before the pinned scene leaves the viewport.
    const finalHold=viewport*.5;
    const runHeight=travel+entryDistance+sequenceDistance+finalHold+viewport;
    end=introTop+runHeight;
    intro.style.setProperty('--intro-hero-height',`${heroHeight}px`);
    intro.style.setProperty('--hero-pin-top',`${Math.min(0,viewport-heroHeight)}px`);
    intro.style.setProperty('--metrics-run-height',`${runHeight}px`);
    updateScroll();
    wake();
  }
  function requestMeasure() { if(!resizeFrame) resizeFrame=requestAnimationFrame(measure); }
  function configure() {
    stop();
    enabled=desktop.matches && !reduced.matches;
    root.classList.toggle('metrics-sequence',enabled);
    hero.inert=false;
    if(enabled) measure();
    else {
      ['--hero-opacity','--metrics-entry'].forEach(name=>intro.style.removeProperty(name));
      stage.classList.remove('is-rendered');
    }
  }
  window.addEventListener('scroll',()=>{if(enabled){updateScroll();wake();}},{passive:true});
  window.addEventListener('resize',requestMeasure,{passive:true});
  desktop.addEventListener('change',configure);
  reduced.addEventListener('change',configure);
  document.addEventListener('visibilitychange',()=>{stop();wake();});
  new MutationObserver(()=>{if(root.classList.contains('menu-open'))stop();else wake();})
    .observe(root,{attributes:true,attributeFilter:['class']});
  if('ResizeObserver' in window) new ResizeObserver(()=>{
    const w=intro.clientWidth,h=hero.offsetHeight;
    if(w!==layoutWidth || h!==layoutHeight){layoutWidth=w;layoutHeight=h;requestMeasure();}
  }).observe(hero);
  document.fonts?.ready.then(requestMeasure);
  configure();
})();
