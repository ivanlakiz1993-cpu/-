/* Image-derived relief: preserves the Figma silhouette at the neutral pose. */
(() => {
  const stage = document.querySelector('.metrics-desktop');
  const canvas = stage?.querySelector('canvas');
  const image = stage?.querySelector('img');
  if (!stage || !canvas || !image) return;
  const context = canvas.getContext('2d');
  if (!context) return;

  const desktop = matchMedia('(min-width: 901px)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let points = [];
  let frame = 0;
  let visible = false;
  let width = 0;
  let height = 0;
  let pointerX = 0;
  let pointerY = 0;
  let yaw = 0;
  let pitch = 0;
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
    yaw += (pointerX * .14 + progress * .85 - yaw) * ease;
    pitch += (pointerY * .07 - progress * .18 - pitch) * ease;
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const cx = Math.cos(pitch), sx = Math.sin(pitch);
    const scale = 1 + Math.max(0, progress) * .3;
    const drift = Math.sin(time * .00065) * .003;
    context.clearRect(0, 0, width, height);

    // Draw in brightness buckets to avoid changing canvas state for every point.
    for (let bucket = 0; bucket < 6; bucket++) {
      context.fillStyle = `rgba(205,199,186,${.13 + bucket * .12})`;
      context.beginPath();
      for (const point of points) {
        if (point.bucket !== bucket) continue;
        const x = point.x * cy + point.z * sy;
        const z = -point.x * sy + point.z * cy;
        const y = point.y * cx - z * sx;
        const depth = point.y * sx + z * cx;
        const perspective = 2.8 / (2.8 - depth);
        const px = width * (.51475 + x * .8305 * perspective * scale);
        const py = height * (.5002 + y * .7086 * perspective * scale + drift);
        const size = Math.max(.65, width / 1920 * point.size * perspective);
        context.rect(px, py, size, size);
      }
      context.fill();
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

  const initialize = () => {
    if (points.length || !image.naturalWidth) return;
    try {
      const source = document.createElement('canvas');
      source.width = 1100;
      source.height = Math.round(1100 * image.naturalHeight / image.naturalWidth);
      const sourceContext = source.getContext('2d', { willReadFrequently: true });
      if (!sourceContext) return;
      sourceContext.drawImage(image, 0, 0, source.width, source.height);
      const pixels = sourceContext.getImageData(0, 0, source.width, source.height).data;
      for (let y = 0; y < source.height; y += 3) {
        for (let x = 0; x < source.width; x += 3) {
          const offset = (y * source.width + x) * 4;
          const light = (pixels[offset] * .2126 + pixels[offset + 1] * .7152 + pixels[offset + 2] * .0722) / 255;
          if (light < .075 || pixels[offset + 3] < 32) continue;
          const nx = x / source.width - .5;
          const ny = y / source.height - .5;
          // A shallow relief, not inferred hidden geometry or a full 3D model.
          const depth = Math.sin((nx + .5) * Math.PI) * Math.cos(ny * Math.PI) * .12 + light * .06;
          points.push({ x: nx, y: ny, z: depth, bucket: Math.min(5, Math.floor(light * 6)), size: .9 + light * 1.35 });
        }
      }
      resize();
    } catch {
      // Keep the original image if pixel access or canvas is unavailable.
      stage.classList.remove('is-animated');
    }
  };

  image.addEventListener('load', initialize, { once: true });
  if (image.complete) initialize();
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
