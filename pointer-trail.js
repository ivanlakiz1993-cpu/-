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
  const inner = document.createElement('span');
  inner.className = 'pointer-trail__inner';
  dot.append(inner);
  overlay.append(dot);
  document.body.append(overlay);
  document.documentElement.classList.add('has-pointer-trail');

  let x = 0;
  let y = 0;
  let active = false;
  let frame = 0;
  let lastFrame = 0;
  let lastMove = 0;
  let innerX = 0;
  let innerY = 0;
  let innerVelocityX = 0;
  let innerVelocityY = 0;
  let innerTargetX = 0;
  let innerTargetY = 0;
  let hoveredControl = null;
  const points = [];
  const clickable = 'a[href], button, input, textarea, select, label, summary, [role="button"], [role="link"], [contenteditable="true"]';

  const controlAt = (target) => {
    const element = target instanceof Element ? target : null;
    const control = element?.closest(clickable);
    return control && !control.matches(':disabled, [aria-disabled="true"]') ? control : null;
  };

  const waveAt = (waveX, waveY, interactive, count = 2) => {
    for (let i = 0; i < count; i++) {
      const wave = document.createElement('span');
      wave.className = `pointer-trail__wave${i ? ' pointer-trail__wave--second' : ''}${interactive ? ' pointer-trail__wave--interactive' : ''}`;
      wave.style.left = `${waveX}px`;
      wave.style.top = `${waveY}px`;
      overlay.append(wave);
      wave.addEventListener('animationend', () => wave.remove(), { once: true });
    }
  };

  const draw = (now) => {
    frame = 0;
    const step = Math.min((now - (lastFrame || now)) / 16.67, 2);
    lastFrame = now;
    const damping = Math.pow(.72, step);
    innerTargetX *= damping;
    innerTargetY *= damping;
    innerVelocityX = (innerVelocityX + (innerTargetX - innerX) * .2 * step) * damping;
    innerVelocityY = (innerVelocityY + (innerTargetY - innerY) * .2 * step) * damping;
    innerX += innerVelocityX * step;
    innerY += innerVelocityY * step;
    const radius = Math.hypot(innerX, innerY);
    if (radius > 5) {
      innerX = innerX / radius * 5;
      innerY = innerY / radius * 5;
    }
    inner.style.transform = `translate(calc(-50% + ${innerX}px), calc(-50% + ${innerY}px))`;
    for (let i = 0; i < traces.length; i++) {
      const point = points[i];
      const age = point ? (now - point.time) / 220 : 1;
      const opacity = point ? Math.max(0, (1 - age) * (.36 - i * .045)) : 0;
      traces[i].style.opacity = String(opacity);
      if (point) traces[i].style.transform = `translate(${point.x - 10}px, ${point.y - 10}px)`;
    }
    while (points.length && now - points[points.length - 1].time > 220) points.pop();
    if (points.length || Math.abs(innerX) + Math.abs(innerY) + Math.abs(innerVelocityX) + Math.abs(innerVelocityY) + Math.abs(innerTargetX) + Math.abs(innerTargetY) > .03) {
      frame = requestAnimationFrame(draw);
    } else {
      lastFrame = 0;
    }
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
    const now = performance.now();
    if (active) {
      const deltaX = nextX - x;
      const deltaY = nextY - y;
      const distance = Math.hypot(deltaX, deltaY);
      if (distance > 35) points.length = 0;
      else if (distance >= 4) {
        points.unshift({ x, y, time: now });
        points.length = Math.min(points.length, traces.length);
      }
      if (distance > 0) {
        const scale = Math.min(1, 16.67 / Math.max(now - lastMove, 8));
        innerTargetX = Math.max(-5, Math.min(5, -deltaX * .4 * scale));
        innerTargetY = Math.max(-5, Math.min(5, -deltaY * .4 * scale));
      }
    }
    x = nextX;
    y = nextY;
    active = true;
    lastMove = now;
    overlay.classList.add('is-visible');
    dot.style.transform = `translate(${x - 10}px, ${y - 10}px)`;
    const control = controlAt(event.target);
    if (control !== hoveredControl) {
      hoveredControl = control;
      dot.classList.toggle('is-interactive', Boolean(control));
      if (control) waveAt(x, y, true, 1);
    }
    if (!frame) frame = requestAnimationFrame(draw);
  };

  const hide = () => {
    active = false;
    points.length = 0;
    hoveredControl = null;
    dot.classList.remove('is-interactive');
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
    waveAt(event.clientX, event.clientY, Boolean(controlAt(event.target)));
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
