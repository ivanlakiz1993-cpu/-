(() => {
  const section = document.querySelector('.development-process');
  if (!section) return;

  const steps = [...section.querySelectorAll('.development-process__step')];
  const photos = [...section.querySelectorAll('.development-process__photo')];
  if (steps.length !== photos.length) return;

  function activate(index) {
    steps.forEach((step, stepIndex) => {
      const active = stepIndex === index;
      step.classList.toggle('development-process__step--active', active);
      step.querySelector('.development-process__hit-area')?.setAttribute('aria-pressed', String(active));
      if (active) step.setAttribute('aria-current', 'step');
      else step.removeAttribute('aria-current');
      photos[stepIndex].classList.toggle('development-process__photo--active', active);
    });
  }

  steps.forEach((step, index) => {
    const control = step.querySelector('.development-process__hit-area');
    step.addEventListener('pointerenter', event => {
      if (event.pointerType === 'mouse' || event.pointerType === 'pen') activate(index);
    });
    control?.addEventListener('focus', () => activate(index));
    control?.addEventListener('click', () => activate(index));
  });
})();
