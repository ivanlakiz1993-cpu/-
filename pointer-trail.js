(() => {
  const enabled = window.matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
  if (!enabled.matches) return;

  const overlay = document.createElement('div');
  overlay.className = 'pointer-trail';
  overlay.setAttribute('aria-hidden', 'true');
  const canvas = document.createElement('canvas');
  canvas.className = 'pointer-trail__canvas';
  const context = canvas.getContext('2d');
  if (!context) return;
  overlay.append(canvas);
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
  let lastDirectionX = 0;
  let lastDirectionY = 0;
  let innerX = 0;
  let innerY = 0;
  let innerVelocityX = 0;
  let innerVelocityY = 0;
  let innerTargetX = 0;
  let innerTargetY = 0;
  let hoveredControl = null;
  const points = [];
  const resize = () => {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    points.length = 0;
  };
  resize();
  window.addEventListener('resize', resize);
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
    context.clearRect(0, 0, window.innerWidth, window.innerHeight);
    while (points.length && now - points[0].time > 220) points.shift();
    if (points.length > 1) {
      const tail = points[0];
      const head = points[points.length - 1];
      const fade = Math.max(0, 1 - (now - lastMove) / 220);
      const stroke = (width, color) => {
        const gradient = context.createLinearGradient(tail.x, tail.y, head.x, head.y);
        gradient.addColorStop(0, `rgba(${color}, 0)`);
        gradient.addColorStop(1, `rgba(${color}, ${fade * .42})`);
        context.beginPath();
        context.moveTo(tail.x, tail.y);
        for (let i = 1; i < points.length - 1; i++) {
          const midpointX = (points[i].x + points[i + 1].x) / 2;
          const midpointY = (points[i].y + points[i + 1].y) / 2;
          context.quadraticCurveTo(points[i].x, points[i].y, midpointX, midpointY);
        }
        context.lineTo(head.x, head.y);
        context.lineWidth = width;
        context.lineCap = 'round';
        context.lineJoin = 'round';
        context.strokeStyle = gradient;
        context.stroke();
      };
      stroke(20, '143, 143, 143');
      stroke(18, '255, 255, 255');
    }
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
      const stale = now - lastMove > 80;
      if (distance >= 1) {
        const directionX = deltaX / distance;
        const directionY = deltaY / distance;
        const reversed = lastDirectionX * directionX + lastDirectionY * directionY < 0;
        if (distance > 50 || reversed || stale) points.length = 0;
        lastDirectionX = directionX;
        lastDirectionY = directionY;
      }
      if (distance >= 1 && distance <= 50 && !stale) {
        if (!points.length) points.push({ x, y, time: now });
        points.push({ x: nextX, y: nextY, time: now });
        let trailLength = 0;
        for (let i = points.length - 1; i > 0; i--) {
          trailLength += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
          if (trailLength > 70) {
            points.splice(0, i + 1);
            break;
          }
        }
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
    lastDirectionX = 0;
    lastDirectionY = 0;
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
  document.addEventListener('site:consultation-modal-open', () => {
    const modal = document.querySelector('.consultation-modal[open]');
    if (!modal) return;
    modal.append(overlay);
    overlay.setAttribute('popover', 'manual');
    try { overlay.showPopover(); } catch { overlay.removeAttribute('popover'); }
  });
  document.addEventListener('site:consultation-modal-close', () => {
    if (overlay.matches(':popover-open')) overlay.hidePopover();
    overlay.removeAttribute('popover');
    document.body.append(overlay);
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
