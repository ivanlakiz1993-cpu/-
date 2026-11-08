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
  let drawnBounds = null;
  const clearTrail = () => {
    if (!drawnBounds) return;
    context.clearRect(drawnBounds.x, drawnBounds.y, drawnBounds.width, drawnBounds.height);
    drawnBounds = null;
  };
  const resize = () => {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    points.length = 0;
    drawnBounds = null;
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
    dot.style.transform = `translate(${x - 10}px, ${y - 10}px)`;
    if (active) overlay.classList.add('is-visible');
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
    clearTrail();
    const lifetime = 220;
    const cutoff = now - lifetime;
    while (points.length > 1 && points[1].time <= cutoff) points.shift();
    if (points.length && points[0].time <= cutoff) {
      if (points.length === 1) points.length = 0;
      else {
        const from = points[0];
        const to = points[1];
        const fraction = (cutoff - from.time) / (to.time - from.time);
        points[0] = { x: from.x + (to.x - from.x) * fraction,
          y: from.y + (to.y - from.y) * fraction, time: cutoff };
      }
    }
    if (points.length > 1) {
      const distances = [0];
      for (let i = 1; i < points.length; i++) {
        distances[i] = distances[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
      }
      const length = distances[distances.length - 1];
      const fade = Math.max(0, 1 - (now - lastMove) / lifetime);
      if (length > 0 && fade > 0) {
        // Resample the actual path, including fast moves, without disconnected strokes.
        const samples = [];
        for (let i = 1; i < points.length; i++) {
          const from = points[i - 1];
          const to = points[i];
          const segment = distances[i] - distances[i - 1];
          const steps = Math.max(1, Math.ceil(segment));
          for (let j = 1; j <= steps; j++) {
            const t = j / steps;
            const progress = (distances[i - 1] + segment * t) / length;
            samples.push({ x: from.x + (to.x - from.x) * t,
              y: from.y + (to.y - from.y) * t, progress,
              radius: 9 * Math.pow(progress, .8) });
          }
        }
        const left = Math.min(...points.map(point => point.x)) - 11;
        const top = Math.min(...points.map(point => point.y)) - 11;
        drawnBounds = { x: left, y: top,
          width: Math.max(...points.map(point => point.x)) - left + 11,
          height: Math.max(...points.map(point => point.y)) - top + 11 };
        context.save();
        // Clip the entire ribbon to the rear half-plane, including its width on turns.
        const reach = Math.hypot(canvas.width, canvas.height) + 100;
        const sideX = -lastDirectionY * reach;
        const sideY = lastDirectionX * reach;
        context.beginPath();
        context.moveTo(x + sideX, y + sideY);
        context.lineTo(x - sideX, y - sideY);
        context.lineTo(x - sideX - lastDirectionX * reach, y - sideY - lastDirectionY * reach);
        context.lineTo(x + sideX - lastDirectionX * reach, y + sideY - lastDirectionY * reach);
        context.closePath();
        context.clip();
        // Each layer is one union of disks: overlaps cannot create bright seams.
        // Nested layers fade along arc length, even on loops and sharp bends.
        const layers = 32;
        context.fillStyle = '#fff';
        context.globalAlpha = 1 - Math.pow(1 - .42 * fade, 1 / layers);
        for (let layer = 0; layer < layers; layer++) {
          context.beginPath();
          for (const sample of samples) {
            if (sample.progress <= layer / layers) continue;
            context.moveTo(sample.x + sample.radius, sample.y);
            context.arc(sample.x, sample.y, sample.radius, 0, Math.PI * 2);
          }
          context.fill();
        }
        context.restore();
      }
    }
    if (points.length || Math.abs(innerX) + Math.abs(innerY) + Math.abs(innerVelocityX) + Math.abs(innerVelocityY) + Math.abs(innerTargetX) + Math.abs(innerTargetY) > .03) {
      frame = requestAnimationFrame(draw);
    } else {
      lastFrame = 0;
    }
  };

  const move = (event) => {
    if (!enabled.matches) return;
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
      if (distance > 0) {
        lastDirectionX = deltaX / distance;
        lastDirectionY = deltaY / distance;
        if (now - lastMove > 220) points.length = 0;
        if (!points.length) points.push({ x, y, time: Math.max(lastMove, now - 220) });
        points.push({ x: nextX, y: nextY, time: now });
        // Keep exactly the newest 70px, interpolating inside the boundary segment.
        let trailLength = 0;
        for (let i = points.length - 1; i > 0; i--) {
          const newer = points[i];
          const older = points[i - 1];
          const segment = Math.hypot(newer.x - older.x, newer.y - older.y);
          if (trailLength + segment > 70) {
            const fraction = (70 - trailLength) / segment;
            points.splice(0, i, {
              x: newer.x + (older.x - newer.x) * fraction,
              y: newer.y + (older.y - newer.y) * fraction,
              time: newer.time + (older.time - newer.time) * fraction
            });
            break;
          }
          trailLength += segment;
        }
        // Retain only the connected rear section; a loop must not leave detached islands.
        for (let i = points.length - 2; i >= 0; i--) {
          const older = points[i];
          const behind = (nextX - older.x) * lastDirectionX + (nextY - older.y) * lastDirectionY;
          if (behind >= 0) continue;
          const newer = points[i + 1];
          const newerBehind = (nextX - newer.x) * lastDirectionX + (nextY - newer.y) * lastDirectionY;
          const fraction = newerBehind / (newerBehind - behind);
          points.splice(0, i + 1, {
            x: newer.x + (older.x - newer.x) * fraction,
            y: newer.y + (older.y - newer.y) * fraction,
            time: newer.time + (older.time - newer.time) * fraction
          });
          break;
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
    clearTrail();
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
