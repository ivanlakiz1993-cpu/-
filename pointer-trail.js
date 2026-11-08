(() => {
  const enabled = window.matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
  const overlay = document.createElement('div');
  overlay.className = 'pointer-trail';
  overlay.setAttribute('aria-hidden', 'true');
  const canvas = document.createElement('canvas');
  canvas.className = 'pointer-trail__canvas';
  const context = canvas.getContext('2d');
  if (!context) return;
  const dot = document.createElement('span');
  dot.className = 'pointer-trail__dot';
  overlay.append(canvas, dot);
  document.body.append(overlay);

  const color = '#f0f2f0';
  const lifetime = 150;
  const points = [];
  const target = { x: 0, y: 0 };
  const position = { x: 0, y: 0 };
  let active = false;
  let frame = 0;
  let directionX = 1;
  let directionY = 0;
  let drawnBounds = null;
  const clickable = 'a[href], button, input, textarea, select, label, summary, [role="button"], [role="link"], [contenteditable="true"], [data-cursor]';

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

  const hover = (event) => {
    const control = event.target instanceof Element ? event.target.closest(clickable) : null;
    dot.classList.toggle('is-interactive', Boolean(control && !control.matches(':disabled, [aria-disabled="true"]')));
  };

  const draw = (now) => {
    frame = 0;
    // Keep the head on the pointer; only its short history forms the trail.
    position.x = target.x;
    position.y = target.y;
    dot.style.transform = `translate3d(${position.x}px, ${position.y}px, 0)`;
    overlay.classList.add('is-visible');
    clearTrail();

    const last = points[points.length - 1];
    if (!last || Math.hypot(position.x - last.x, position.y - last.y) >= 1.5) {
      points.push({ x: position.x, y: position.y, time: now });
    }
    while (points.length && now - points[0].time > lifetime) points.shift();
    if (points.length >= 3) {
      const left = [];
      const right = [];
      for (let i = 0; i < points.length; i++) {
        const point = points[i];
        const previous = points[Math.max(0, i - 1)];
        const next = points[Math.min(points.length - 1, i + 1)];
        const dx = next.x - previous.x;
        const dy = next.y - previous.y;
        const distance = Math.hypot(dx, dy) || 1;
        const width = (1.5 + 7.5 * Math.max(0, 1 - (now - point.time) / lifetime)) / 2;
        left.push({ x: point.x - dy / distance * width, y: point.y + dx / distance * width });
        right.push({ x: point.x + dy / distance * width, y: point.y - dx / distance * width });
      }
      const tail = points[0];
      const head = points[points.length - 1];
      const gradient = context.createLinearGradient(tail.x, tail.y, head.x, head.y);
      gradient.addColorStop(0, 'rgba(240, 242, 240, 0)');
      gradient.addColorStop(1, color);
      const minX = Math.min(...points.map(point => point.x)) - 36;
      const minY = Math.min(...points.map(point => point.y)) - 36;
      drawnBounds = { x: minX, y: minY,
        width: Math.max(...points.map(point => point.x)) - minX + 36,
        height: Math.max(...points.map(point => point.y)) - minY + 36 };
      context.save();
      // Keep the reference's curved glow, but respect the requested rear-only trail.
      const reach = Math.hypot(canvas.width, canvas.height) + 100;
      const sideX = -directionY * reach;
      const sideY = directionX * reach;
      context.beginPath();
      context.moveTo(position.x + sideX, position.y + sideY);
      context.lineTo(position.x - sideX, position.y - sideY);
      context.lineTo(position.x - sideX - directionX * reach, position.y - sideY - directionY * reach);
      context.lineTo(position.x + sideX - directionX * reach, position.y + sideY - directionY * reach);
      context.closePath();
      context.clip();
      context.beginPath();
      context.moveTo(left[0].x, left[0].y);
      for (let i = 1; i < left.length; i++) context.lineTo(left[i].x, left[i].y);
      for (let i = right.length - 1; i >= 0; i--) context.lineTo(right[i].x, right[i].y);
      context.closePath();
      context.fillStyle = gradient;
      context.shadowColor = color;
      context.shadowBlur = 10;
      context.fill();
      context.restore();
    }
    if (points.length) {
      frame = requestAnimationFrame(draw);
    }
  };

  const hide = () => {
    active = false;
    points.length = 0;
    clearTrail();
    overlay.classList.remove('is-visible');
    dot.classList.remove('is-interactive');
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  };
  const move = (event) => {
    if (!enabled.matches) return;
    if (event.pointerType !== 'mouse') {
      hide();
      document.documentElement.classList.remove('has-pointer-trail');
      return;
    }
    document.documentElement.classList.add('has-pointer-trail');
    const dx = event.clientX - target.x;
    const dy = event.clientY - target.y;
    const distance = Math.hypot(dx, dy);
    if (distance) {
      directionX = dx / distance;
      directionY = dy / distance;
    }
    target.x = event.clientX;
    target.y = event.clientY;
    if (!active) {
      position.x = target.x;
      position.y = target.y;
      points.length = 0;
      active = true;
    }
    hover(event);
    if (!frame) frame = requestAnimationFrame(draw);
  };
  document.addEventListener('pointermove', move, { passive: true });
  document.addEventListener('pointerover', hover, { passive: true });
  document.addEventListener('pointerout', event => {
    if (!event.relatedTarget) hide();
  });
  window.addEventListener('blur', hide);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) hide();
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
  const updateEnabled = () => {
    if (!enabled.matches) hide();
    document.documentElement.classList.toggle('has-pointer-trail', enabled.matches);
  };
  enabled.addEventListener('change', updateEnabled);
  updateEnabled();
})();
