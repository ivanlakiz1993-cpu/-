/* Perspective projection of the reference-based 3D surface model. */
(() => {
  const stage = document.querySelector('.metrics-desktop');
  const canvas = stage?.querySelector('canvas');
  const copy = stage?.querySelector('.metrics-desktop__copy');
  if (!stage || !canvas || !copy) return;
  const context = canvas.getContext('2d');
  if (!context) return;

  const desktop = matchMedia('(min-width: 901px)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const points = window.HelicopterModel?.points || [];
  let frame = 0;
  const initialRect=stage.getBoundingClientRect();
  let visible = initialRect.bottom>0 && initialRect.top<innerHeight;
  let width = 0;
  let height = 0;
  let pointerX = 0;
  let pointerY = 0;
  let yaw = -.48;
  let pitch = .24;
  let progress = 0;
  let lastTime = 0;
  const buckets = Array.from({length:6},()=>[]);
  const projected = points.map(()=>({x:0,y:0,z:0,size:0,bucket:0}));

  const stop = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
  };

  const render = (time) => {
    frame = 0;
    if (!visible || !desktop.matches || document.hidden || !width || !height) return;
    const elapsed = Math.min(50, lastTime ? time - lastTime : 16);
    lastTime = time;
    const ease = 1 - Math.exp(-elapsed / 180);
    const rect = stage.getBoundingClientRect();
    // Neutral composition when the block reaches the top; turn as it scrolls away.
    const targetProgress = reduced.matches ? 0 : Math.max(-.12, Math.min(1, -rect.top / rect.height));
    progress += (targetProgress - progress) * ease;
    yaw += (-.48 + (reduced.matches?0:pointerX * .25) + progress * Math.PI * 1.8 - yaw) * ease;
    pitch += (.24 + (reduced.matches?0:pointerY * .12) + progress * .65 - pitch) * ease;
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const cx = Math.cos(pitch), sx = Math.sin(pitch);
    context.clearRect(0, 0, width, height);

    const rotorAngle = reduced.matches ? .35 : time * .0008;
    const rc = Math.cos(rotorAngle), rs = Math.sin(rotorAngle);
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    buckets.forEach(bucket=>{bucket.length=0;});
    for(let i=0;i<points.length;i++) {
        const point=points[i];
        const normalZ=(-point.nx*sy+point.nz*cy)*cx+point.ny*sx;
        if(!point.doubleSided && normalZ<-.02) continue;
        let ox=point.x, oy=point.y, oz=point.z;
        if(point.group==='mainRotor') {
          ox=point.x*rc-point.z*rs; oz=point.x*rs+point.z*rc;
        } else if(point.group==='tailRotor') {
          const tc=Math.cos(rotorAngle*2.5),ts=Math.sin(rotorAngle*2.5);
          ox=-4.6+(point.x+4.6)*tc-(point.y-.64)*ts;
          oy=.64+(point.x+4.6)*ts+(point.y-.64)*tc;
        }
        const x = ox * cy + oz * sy;
        const z = -ox * sy + oz * cy;
        const y = oy * cx - z * sx;
        const depth = oy * sx + z * cx;
        const perspective = 16 / (16 - depth);
        const p=projected[i];
        p.x=x*perspective; p.y=-y*perspective; p.z=depth;
        p.size=Math.max(.55,width/1920*(point.edge?1.35:.9)*perspective);
        p.bucket=Math.min(5,Math.floor(point.light*(point.doubleSided?1:(.45+.55*Math.max(0,normalZ)))*6));
        minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);
        minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);
        buckets[p.bucket].push(p);
    }
    // Fit all rotated geometry inside a dedicated region below the copy.
    const copyBottom=copy.getBoundingClientRect().bottom-rect.top;
    const regionTop=Math.max(height*.4,copyBottom+height*.035);
    const regionBottom=height*.95;
    const regionHeight=Math.max(1,regionBottom-regionTop);
    const fit=Math.min(width*.86/Math.max(1,maxX-minX),regionHeight*.9/Math.max(1,maxY-minY));
    const centerX=width*.52-(minX+maxX)*.5*fit;
    const centerY=(regionTop+regionBottom)*.5-(minY+maxY)*.5*fit;
    context.save();
    context.beginPath();context.rect(width*.05,regionTop,width*.9,regionHeight);context.clip();
    for(let bucket=0;bucket<6;bucket++) {
      context.beginPath();
      for(const p of buckets[bucket]) {
        const px=centerX+p.x*fit,py=centerY+p.y*fit;
        context.moveTo(px+p.size,py);context.arc(px,py,p.size,0,Math.PI*2);
      }
      context.strokeStyle=`rgba(218,211,195,${.09+bucket*.145})`;
      context.lineWidth=Math.max(.45,width/1920*.65);
      context.stroke();
    }
    context.restore();
    stage.classList.add('is-rendered');
    stage.classList.toggle('is-animated',!reduced.matches);
    if(!reduced.matches) frame = requestAnimationFrame(render);
  };

  const start = () => {
    if (visible && desktop.matches && !document.hidden && points.length && !frame) {
      render(performance.now());
    }
  };

  const resize = () => {
    stop();
    const rect = stage.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    const ratio = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    start();
  };

  resize();
  stage.addEventListener('pointermove', (event) => {
    const rect = stage.getBoundingClientRect();
    pointerX = (event.clientX - rect.left) / rect.width * 2 - 1;
    pointerY = (event.clientY - rect.top) / rect.height * 2 - 1;
  }, { passive: true });
  stage.addEventListener('pointerleave', () => { pointerX = 0; pointerY = 0; });
  const updateMode = () => {
    stop();
    stage.classList.remove('is-animated');
    if (desktop.matches) { resize(); start(); }
  };
  desktop.addEventListener('change', updateMode);
  reduced.addEventListener('change', updateMode);
  document.addEventListener('visibilitychange', () => { stop(); start(); });
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(stage);
  else window.addEventListener('resize', resize, { passive: true });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start(); else stop();
    }).observe(stage);
  } else { visible = true; start(); }
})();
