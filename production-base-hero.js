(() => {
  const section = document.querySelector('[data-production-base-hero]');
  const stage = section?.querySelector('[data-production-base-stage]');
  const imageLayers = section ? [...section.querySelectorAll('[data-base-image]')] : [];
  const areas = section ? [...section.querySelectorAll('[data-base-area]')] : [];
  const title = section?.querySelector('.production-base-hero__title');
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');

  if (!section || !stage || !title || imageLayers.length !== 5 || areas.length !== imageLayers.length) return;

  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
  const stepSize = 1 / imageLayers.length;
  const imageRevealDuration = stepSize * 0.4;
  const titleRevealStart = imageRevealDuration;
  const titleRevealDuration = stepSize * 0.2;
  const areaRevealOffset = stepSize * 0.6;
  const areaRevealDuration = stepSize * 0.3;
  let animationFrame = 0;

  const revealProgress = (progress, start, duration) =>
    clamp((progress - start) / duration);

  const applyProgress = (progress) => {
    const currentState = Math.min(imageLayers.length - 1, Math.floor(progress / stepSize));

    imageLayers.forEach((imageLayer, index) => {
      const start = index * stepSize;
      const reveal = revealProgress(progress, start, imageRevealDuration);
      imageLayer.classList.toggle('is-active', index <= currentState);
      imageLayer.classList.toggle('is-current', index === currentState);
      imageLayer.style.setProperty('--production-base-image-reveal', `${reveal * 100}%`);
    });

    const titleReveal = revealProgress(progress, titleRevealStart, titleRevealDuration);
    title.style.setProperty('--production-base-title-reveal', `${titleReveal * 100}%`);

    let visibleAreas = 0;
    areas.forEach((area, index) => {
      const start = index * stepSize + areaRevealOffset;
      const reveal = revealProgress(progress, start, areaRevealDuration);
      area.classList.toggle('is-visible', reveal > 0);
      area.style.setProperty('--production-base-area-reveal', `${reveal * 100}%`);
      if (reveal > 0) visibleAreas += 1;
    });

    section.dataset.stateIndex = String(currentState);
    section.dataset.visibleAreas = String(visibleAreas);
  };

  const updateFromScroll = () => {
    animationFrame = 0;

    if (motionPreference.matches) {
      applyProgress(1);
      return;
    }

    const sectionTop = section.getBoundingClientRect().top + window.scrollY;
    const scrollRange = Math.max(1, section.offsetHeight - stage.offsetHeight);
    const animationStart = sectionTop - Math.min(stage.offsetHeight, window.innerHeight);
    const progress = clamp((window.scrollY - animationStart) / scrollRange);
    applyProgress(progress);
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
      applyProgress(1);
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
