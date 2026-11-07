(() => {
  const stack = document.querySelector('.development-services__image-stack');
  const section = stack?.closest('.development-services');
  const divider = stack?.querySelector('[data-development-image-divider]');
  if (!stack || !section || !divider) return;

  const clamp = value => Math.min(100, Math.max(0, value));
  const clampUnit = value => Math.min(1, Math.max(0, value));
  const initialValue = Number(divider.getAttribute('aria-valuenow'));
  let productReveal = Number.isFinite(initialValue) ? initialValue : 53.720508;
  const initialDrawingReveal = 100 - productReveal;
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  let activePointerId = null;
  let animationFrame = 0;
  let manualControl = false;
  let scrollRevealComplete = false;

  function update(value) {
    productReveal = clamp(value);
    const drawingReveal = 100 - productReveal;
    stack.style.setProperty('--development-image-split', `${drawingReveal}%`);
    divider.setAttribute('aria-valuenow', productReveal.toFixed(1));
    divider.setAttribute('aria-valuetext',
      `Изделие открыто снизу на ${Math.round(productReveal)}%; чертёж открыт сверху на ${Math.round(drawingReveal)}%`);
  }

  function updateFromPointer(event) {
    const bounds = stack.getBoundingClientRect();
    if (!bounds.height) return;
    const downPosition = clamp((event.clientY - bounds.top) / bounds.height * 100);
    update(100 - downPosition);
  }

  function updateFromScroll() {
    animationFrame = 0;
    if (manualControl || scrollRevealComplete) return;

    if (motionPreference.matches) {
      update(0);
      scrollRevealComplete = true;
      return;
    }

    const stackTop = stack.getBoundingClientRect().top + window.scrollY;
    const revealStart = Math.max(0, stackTop - window.innerHeight * 0.85);
    const revealEnd = Math.max(revealStart + 1, stackTop - Math.min(48, window.innerHeight * 0.05));
    const progress = clampUnit((window.scrollY - revealStart) / (revealEnd - revealStart));
    const drawingReveal = initialDrawingReveal + (100 - initialDrawingReveal) * progress;

    update(100 - drawingReveal);
    if (progress >= 1) scrollRevealComplete = true;
  }

  function scheduleScrollUpdate() {
    if (animationFrame || manualControl || scrollRevealComplete) return;
    animationFrame = window.requestAnimationFrame(updateFromScroll);
  }

  function takeManualControl() {
    manualControl = true;
    if (animationFrame) window.cancelAnimationFrame(animationFrame);
    animationFrame = 0;
  }

  divider.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    takeManualControl();
    activePointerId = event.pointerId;
    divider.focus({ preventScroll: true });
    divider.setPointerCapture(event.pointerId);
    updateFromPointer(event);
    event.preventDefault();
  });

  divider.addEventListener('pointermove', event => {
    if (event.pointerId === activePointerId) updateFromPointer(event);
  });

  const finishPointer = event => {
    if (event.pointerId === activePointerId) activePointerId = null;
  };
  divider.addEventListener('pointerup', finishPointer);
  divider.addEventListener('pointercancel', finishPointer);
  divider.addEventListener('lostpointercapture', () => { activePointerId = null; });

  divider.addEventListener('keydown', event => {
    const step = event.shiftKey ? 10 : 2;
    let next = productReveal;
    switch (event.key) {
      case 'ArrowUp':
      case 'ArrowRight':
        next += step;
        break;
      case 'ArrowDown':
      case 'ArrowLeft':
        next -= step;
        break;
      case 'PageUp':
        next += 10;
        break;
      case 'PageDown':
        next -= 10;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = 100;
        break;
      default:
        return;
    }
    event.preventDefault();
    takeManualControl();
    update(next);
  });

  window.addEventListener('scroll', scheduleScrollUpdate, { passive: true });
  window.addEventListener('resize', scheduleScrollUpdate);
  if (motionPreference.addEventListener) {
    motionPreference.addEventListener('change', scheduleScrollUpdate);
  } else {
    motionPreference.addListener(scheduleScrollUpdate);
  }

  update(productReveal);
  scheduleScrollUpdate();
})();
