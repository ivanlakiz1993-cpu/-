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
  const initialAreaDelay = 120;
  let animationFrame = 0;
  let initialAreaTimer = 0;
  let initialAreaReady = false;
  let currentProgress = 0;

  const revealProgress = (progress, start, duration) =>
    clamp((progress - start) / duration);

  const applyProgress = (progress) => {
    currentProgress = progress;
    const currentState = Math.min(imageLayers.length - 1, Math.floor(progress / stepSize));
    const firstImageRevealed = progress >= imageRevealDuration;

    imageLayers.forEach((imageLayer, index) => {
      imageLayer.classList.toggle('is-active', index <= currentState);
      imageLayer.classList.toggle('is-current', index === currentState);
      if (index === 0) {
        const reveal = revealProgress(progress, 0, imageRevealDuration);
        imageLayer.style.setProperty('--production-base-image-reveal', `${reveal * 100}%`);
      }
    });

    title.classList.toggle('is-visible', firstImageRevealed);
    if (!firstImageRevealed) {
      window.clearTimeout(initialAreaTimer);
      initialAreaTimer = 0;
      initialAreaReady = false;
    }

    let visibleAreas = 0;
    areas.forEach((area, index) => {
      const visible = firstImageRevealed && (index === 0 ? initialAreaReady : currentState >= index);
      area.classList.toggle('is-visible', visible);
      if (visible) visibleAreas += 1;
    });

    section.dataset.stateIndex = String(currentState);
    section.dataset.visibleAreas = String(visibleAreas);
  };

  title.addEventListener('transitionend', (event) => {
    if (event.propertyName !== 'clip-path' || !title.classList.contains('is-visible')) return;
    window.clearTimeout(initialAreaTimer);
    initialAreaTimer = window.setTimeout(() => {
      initialAreaReady = true;
      applyProgress(currentProgress);
    }, initialAreaDelay);
  });

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
      window.clearTimeout(initialAreaTimer);
      initialAreaTimer = 0;
      initialAreaReady = true;
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
