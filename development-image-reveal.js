(() => {
  const stack = document.querySelector('.development-services__image-stack');
  const divider = stack?.querySelector('[data-development-image-divider]');
  if (!stack || !divider) return;

  const clamp = value => Math.min(100, Math.max(0, value));
  const initialValue = Number(divider.getAttribute('aria-valuenow'));
  let productReveal = Number.isFinite(initialValue) ? initialValue : 53.720508;
  let activePointerId = null;

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

  divider.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
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
    update(next);
  });

  update(productReveal);
})();
