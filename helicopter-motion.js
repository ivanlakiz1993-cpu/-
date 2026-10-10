/* Perspective projection of the reference-based 3D surface model. */
(() => {
  const stage = document.querySelector('.metrics-desktop');
  const canvas = stage?.querySelector('canvas');
  const image = stage?.querySelector('img');
  if (!stage || !canvas || !image) return;
  const context = canvas.getContext('2d');
  if (!context) return;

  const desktop = matchMedia('(min-width: 901px)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const points = window.HelicopterModel?.points || [];
  let frame = 0;
  let visible = false;
  let width = 0;
  let height = 0;
  let pointerX = 0;
  let pointerY = 0;
  let yaw = -.48;
  let pitch = .24;
  let progress = 0;
  let lastTime = 0;

  const stop = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
  };

  const render = (time) => {
    frame = 0;
    if (!visible || !desktop.matches || reduced.matches || document.hidden) return;
    const elapsed = Math.min(50, lastTime ? time - lastTime : 16);
    lastTime = time;
    const ease = 1 - Math.exp(-elapsed / 180);
    const rect = stage.getBoundingClientRect();
    // Neutral composition when the block reaches the top; turn as it scrolls away.
    const targetProgress = Math.max(-.25, Math.min(1, -rect.top / rect.height));
    progress += (targetProgress - progress) * ease;
    yaw += (-.48 + pointerX * .25 + progress * Math.PI * 1.8 - yaw) * ease;
    pitch += (.24 + pointerY * .12 + progress * .65 - pitch) * ease;
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const cx = Math.cos(pitch), sx = Math.sin(pitch);
    const scale = 1 + Math.max(0, progress) * .3;
    const drift = Math.sin(time * .00065) * .003;
    context.clearRect(0, 0, width, height);

    const rotorAngle = time * .0008;
    const rc = Math.cos(rotorAngle), rs = Math.sin(rotorAngle);
    // Draw in brightness buckets to avoid changing canvas state for every point.
    for (let bucket = 0; bucket < 6; bucket++) {
      context.fillStyle = `rgba(218,211,195,${.12 + bucket * .15})`;
      context.beginPath();
      for (const point of points) {
        if (Math.min(5,Math.floor(point.light * 6)) !== bucket) continue;
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
        const px = width * (.59 + x * .098 * perspective * scale);
        const py = height * (.57 - y * .15 * perspective * scale + drift);
        const size = Math.max(.55, width / 1920 * (point.edge?1.55:1.05) * perspective);
        context.moveTo(px+size,py);
        context.arc(px,py,size,0,Math.PI*2);
      }
      context.strokeStyle=context.fillStyle;
      context.lineWidth=Math.max(.45,width/1920*.65);
      context.stroke();
    }
    stage.classList.add('is-animated');
    frame = requestAnimationFrame(render);
  };

  const start = () => {
    if (visible && desktop.matches && !reduced.matches && !document.hidden && points.length && !frame) {
      frame = requestAnimationFrame(render);
    }
  };

  const resize = () => {
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
    if (desktop.matches && !reduced.matches) { resize(); start(); }
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
