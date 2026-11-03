(() => {
  const hero = document.querySelector('.production-hero');
  const industries = document.querySelector('[data-production-industries]');
  const stage = industries?.querySelector('[data-industries-stage]');
  const stack = industries?.querySelector('[data-industries-stack]');
  const cards = stack ? [...stack.querySelectorAll('[data-industry-image]')] : [];
  const options = industries ? [...industries.querySelectorAll('[data-industry-option]')] : [];
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');

  if (!hero || !industries || !stage || !stack || cards.length < 2 || options.length !== cards.length) return;

  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
  let animationFrame = 0;

  const clearMotionStyles = () => {
    hero.style.removeProperty('--production-hero-media-opacity');
    hero.style.removeProperty('--production-hero-media-scale');
    hero.style.removeProperty('--production-hero-content-opacity');
    hero.style.removeProperty('--production-hero-content-y');
    industries.style.removeProperty('--industries-entry-opacity');
    industries.style.removeProperty('--industries-entry-scale');
    stack.style.removeProperty('--industry-offset');
    options.forEach((option, index) => {
      option.classList.toggle('is-active', index === 0);
      if (index === 0) option.setAttribute('aria-current', 'true');
      else option.removeAttribute('aria-current');
    });
  };

  const updateMotion = () => {
    animationFrame = 0;
    if (motionPreference.matches) return;

    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const heroExit = clamp((viewportHeight - hero.getBoundingClientRect().bottom) / viewportHeight);
    const industryEntry = clamp((viewportHeight - industries.getBoundingClientRect().top) / viewportHeight);

    hero.style.setProperty('--production-hero-media-opacity', (1 - heroExit * 0.48).toFixed(3));
    hero.style.setProperty('--production-hero-media-scale', (1 - heroExit * 0.1).toFixed(3));
    hero.style.setProperty('--production-hero-content-opacity', (1 - heroExit).toFixed(3));
    hero.style.setProperty('--production-hero-content-y', `${(-2.5 * heroExit).toFixed(2)}rem`);
    industries.style.setProperty('--industries-entry-opacity', industryEntry.toFixed(3));
    industries.style.setProperty('--industries-entry-scale', (0.96 + industryEntry * 0.04).toFixed(3));

    const sectionTop = industries.getBoundingClientRect().top + window.scrollY;
    const scrollRange = Math.max(1, industries.offsetHeight - stage.offsetHeight);
    const cardProgress = clamp((window.scrollY - sectionTop) / scrollRange) * (cards.length - 1);
    const cardStep = cards[1].getBoundingClientRect().top - cards[0].getBoundingClientRect().top;
    const activeIndex = Math.min(cards.length - 1, Math.round(cardProgress));

    stack.style.setProperty('--industry-offset', `${(-cardStep * cardProgress).toFixed(2)}px`);
    options.forEach((option, index) => {
      const isActive = index === activeIndex;
      option.classList.toggle('is-active', isActive);
      if (isActive) option.setAttribute('aria-current', 'true');
      else option.removeAttribute('aria-current');
    });
  };

  const scheduleUpdate = () => {
    if (!animationFrame) animationFrame = window.requestAnimationFrame(updateMotion);
  };

  const syncMotionPreference = () => {
    const enabled = !motionPreference.matches;
    document.body.classList.toggle('production-scroll-motion', enabled);
    industries.classList.toggle('is-enhanced', enabled);
    if (enabled) scheduleUpdate();
    else clearMotionStyles();
  };

  window.addEventListener('scroll', scheduleUpdate, { passive: true });
  window.addEventListener('resize', scheduleUpdate);
  if (motionPreference.addEventListener) motionPreference.addEventListener('change', syncMotionPreference);
  else motionPreference.addListener(syncMotionPreference);

  syncMotionPreference();
})();
