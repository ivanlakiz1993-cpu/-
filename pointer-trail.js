(() => {
  const enabled = window.matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
  if (!enabled.matches) return;

  const overlay = document.createElement('div');
  overlay.className = 'pointer-trail';
  overlay.setAttribute('aria-hidden', 'true');
  const traces = Array.from({ length: 6 }, () => {
    const trace = document.createElement('span');
    trace.className = 'pointer-trail__trace';
    overlay.append(trace);
    return trace;
  });
  const dot = document.createElement('span');
  dot.className = 'pointer-trail__dot';
  overlay.append(dot);
  document.body.append(overlay);
  document.documentElement.classList.add('has-pointer-trail');

  let x = 0;
  let y = 0;
  let active = false;
  let frame = 0;
  const points = [];

  const draw = (now) => {
    frame = 0;
    for (let i = 0; i < traces.length; i++) {
      const point = points[i];
      const age = point ? (now - point.time) / 220 : 1;
      const opacity = point ? Math.max(0, (1 - age) * (.36 - i * .045)) : 0;
      traces[i].style.opacity = String(opacity);
      if (point) traces[i].style.transform = `translate(${point.x - 3}px, ${point.y - 3}px) scale(${1 - i * .12})`;
    }
    while (points.length && now - points[points.length - 1].time > 220) points.pop();
    if (points.length) frame = requestAnimationFrame(draw);
  };

  const move = (event) => {
    if (event.pointerType !== 'mouse') {
      hide();
      document.documentElement.classList.remove('has-pointer-trail');
      return;
    }
    document.documentElement.classList.add('has-pointer-trail');
    const nextX = event.clientX;
    const nextY = event.clientY;
    if (active) {
      const distance = Math.hypot(nextX - x, nextY - y);
      if (distance > 35) points.length = 0;
      else if (distance >= 4) {
        points.unshift({ x, y, time: performance.now() });
        points.length = Math.min(points.length, traces.length);
      }
    }
    x = nextX;
    y = nextY;
    active = true;
    overlay.classList.add('is-visible');
    dot.style.transform = `translate(${x - 10}px, ${y - 10}px)`;
    if (!frame && points.length) frame = requestAnimationFrame(draw);
  };

  const hide = () => {
    active = false;
    points.length = 0;
    overlay.classList.remove('is-visible');
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  };

  document.addEventListener('pointermove', move, { passive: true });
  document.addEventListener('pointerout', (event) => {
    if (!event.relatedTarget) hide();
  });
  window.addEventListener('blur', hide);
  document.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'mouse') return;
    for (let i = 0; i < 2; i++) {
      const wave = document.createElement('span');
      wave.className = `pointer-trail__wave${i ? ' pointer-trail__wave--second' : ''}`;
      wave.style.left = `${event.clientX}px`;
      wave.style.top = `${event.clientY}px`;
      overlay.append(wave);
      wave.addEventListener('animationend', () => wave.remove(), { once: true });
    }
  });
  enabled.addEventListener('change', () => {
    if (!enabled.matches) {
      hide();
      document.documentElement.classList.remove('has-pointer-trail');
    } else {
      document.documentElement.classList.add('has-pointer-trail');
    }
  });
})();
