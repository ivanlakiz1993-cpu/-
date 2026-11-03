(() => {
  const section = document.querySelector('[data-production-base-hero]');
  const stage = section?.querySelector('[data-production-base-stage]');
  const images = section ? [...section.querySelectorAll('[data-base-image]')] : [];
  const areas = section ? [...section.querySelectorAll('[data-base-area]')] : [];
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const states = [
    { imageIndex: 0, visibleAreas: 1 },
    { imageIndex: 1, visibleAreas: 2 },
    { imageIndex: 2, visibleAreas: 4 },
    { imageIndex: 3, visibleAreas: 5 },
  ];

  if (!section || !stage || images.length !== states.length || areas.length !== 5) return;

  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
  let animationFrame = 0;

  const applyState = (stateIndex) => {
    const state = states[stateIndex];

    images.forEach((image, index) => {
      image.classList.toggle('is-active', index === state.imageIndex);
    });

    areas.forEach((area, index) => {
      area.classList.toggle('is-visible', index < state.visibleAreas);
    });

    section.dataset.stateIndex = String(stateIndex);
    section.dataset.visibleAreas = String(state.visibleAreas);
  };

  const updateFromScroll = () => {
    animationFrame = 0;

    if (motionPreference.matches) {
      applyState(states.length - 1);
      return;
    }

    const sectionTop = section.getBoundingClientRect().top + window.scrollY;
    const scrollRange = Math.max(1, section.offsetHeight - stage.offsetHeight);
    const progress = clamp((window.scrollY - sectionTop) / scrollRange);
    const stateIndex = Math.round(progress * (states.length - 1));

    applyState(stateIndex);
  };

  const scheduleUpdate = () => {
    if (!animationFrame) animationFrame = window.requestAnimationFrame(updateFromScroll);
  };

  const syncMotionPreference = () => {
    const reducedMotion = motionPreference.matches;
    section.classList.toggle('is-reduced-motion', reducedMotion);

    if (reducedMotion) {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      applyState(states.length - 1);
      return;
    }

    scheduleUpdate();
  };

  section.classList.add('is-enhanced');
  window.addEventListener('scroll', scheduleUpdate, { passive: true });
  window.addEventListener('resize', scheduleUpdate);

  if (motionPreference.addEventListener) motionPreference.addEventListener('change', syncMotionPreference);
  else motionPreference.addListener(syncMotionPreference);

  syncMotionPreference();
})();
