(() => {
  const hero = document.querySelector('.production-hero');
  const industries = document.querySelector('[data-production-industries]');
  const stage = industries?.querySelector('[data-industries-stage]');
  const stack = industries?.querySelector('[data-industries-stack]');
  const cards = stack ? [...stack.querySelectorAll('[data-industry-image]')] : [];
  const options = industries ? [...industries.querySelectorAll('[data-industry-option]')] : [];
  const heroMedia = hero?.querySelector('.production-hero__media');
  const heroVideo = heroMedia?.querySelector('.production-hero__video');
  const energyImage = cards[0]?.querySelector('img');
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const compactViewport = window.matchMedia('(max-width: 74.9375rem)');

  if (!hero || !industries || !stage || !stack || cards.length < 2 || options.length !== cards.length) return;

  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
  const lerp = (start, end, progress) => start + (end - start) * progress;
  const smoothstep = (progress) => progress * progress * (3 - 2 * progress);
  let transitionImage = null;
  let morphActive = false;
  let motionEnabled = false;
  let heroMotionEnabled = false;

  if (heroMedia && heroVideo && energyImage) {
    transitionImage = document.createElement('img');
    transitionImage.className = 'production-hero__transition-image';
    transitionImage.alt = '';
    transitionImage.setAttribute('aria-hidden', 'true');
    transitionImage.decoding = 'async';
    transitionImage.src = energyImage.currentSrc || energyImage.src;
    transitionImage.decode?.().catch(() => {});
    heroMedia.append(transitionImage);
  }

  const clearHeroMorph = () => {
    if (!heroMedia || !morphActive) return;
    morphActive = false;
    hero.classList.remove('is-morphing');
    heroMedia.classList.remove('is-morphing');
    ['left', 'top', 'width', 'height', 'border-radius', '--hero-morph-crossfade'].forEach((property) => {
      heroMedia.style.removeProperty(property);
    });
    cards[0]?.style.removeProperty('opacity');
  };

  const clearHeroScrollStyles = () => {
    clearHeroMorph();
    hero.style.removeProperty('--production-hero-media-opacity');
    hero.style.removeProperty('--production-hero-media-scale');
    hero.style.removeProperty('--production-hero-content-opacity');
    hero.style.removeProperty('--production-hero-content-y');
  };

  const updateHeroMorph = (progress, viewportHeight, heroRect, heroPageBottom) => {
    if (!heroMedia || !energyImage || progress <= 0 || progress >= 1) {
      clearHeroMorph();
      return;
    }

    const easedProgress = smoothstep(progress);
    const heroPageTop = heroPageBottom - heroRect.height;
    const startLeft = heroRect.left;
    const startTop = heroPageTop - Math.max(0, heroPageBottom - viewportHeight);
    const startWidth = heroRect.width;
    const startHeight = heroRect.height;
    const industryRect = industries.getBoundingClientRect();
    const targetLeft = industryRect.left + stage.offsetLeft + stack.offsetLeft - stack.offsetWidth / 2 + cards[0].offsetLeft;
    const targetTop = stage.offsetTop + stack.offsetTop + cards[0].offsetTop;
    const cardStyles = window.getComputedStyle(cards[0]);
    const targetWidth = Number.parseFloat(cardStyles.width);
    const targetHeight = Number.parseFloat(cardStyles.height);
    const targetRadius = Number.parseFloat(cardStyles.borderTopLeftRadius) || 0;

    heroMedia.style.left = `${lerp(startLeft, targetLeft, easedProgress).toFixed(2)}px`;
    heroMedia.style.top = `${lerp(startTop, targetTop, easedProgress).toFixed(2)}px`;
    heroMedia.style.width = `${lerp(startWidth, targetWidth, easedProgress).toFixed(2)}px`;
    heroMedia.style.height = `${lerp(startHeight, targetHeight, easedProgress).toFixed(2)}px`;
    heroMedia.style.borderRadius = `${(targetRadius * easedProgress).toFixed(2)}px`;
    heroMedia.style.setProperty('--hero-morph-crossfade', easedProgress.toFixed(3));

    if (!morphActive) {
      morphActive = true;
      hero.classList.add('is-morphing');
      heroMedia.classList.add('is-morphing');
    }
    cards[0].style.opacity = '0';
  };

  let animationFrame = 0;

  const clearMotionStyles = () => {
    clearHeroScrollStyles();
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
    if (!motionEnabled) return;

    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    if (heroMotionEnabled) {
      const heroRect = hero.getBoundingClientRect();
      const heroPageBottom = heroRect.bottom + window.scrollY;
      const heroTransitionStart = Math.max(0, heroPageBottom - viewportHeight);
      const heroTransitionProgress = clamp((window.scrollY - heroTransitionStart) / Math.max(1, heroPageBottom - heroTransitionStart));
      const heroExit = clamp((viewportHeight - heroRect.bottom) / viewportHeight);
      updateHeroMorph(heroTransitionProgress, viewportHeight, heroRect, heroPageBottom);
      hero.style.setProperty('--production-hero-media-opacity', (1 - heroExit * 0.48).toFixed(3));
      hero.style.setProperty('--production-hero-media-scale', (1 - heroExit * 0.1).toFixed(3));
      hero.style.setProperty('--production-hero-content-opacity', (1 - heroExit).toFixed(3));
      hero.style.setProperty('--production-hero-content-y', `${(-2.5 * heroExit).toFixed(2)}rem`);
    }

    const industryRect = industries.getBoundingClientRect();
    const industryEntry = clamp((viewportHeight - industryRect.top) / viewportHeight);
    industries.style.setProperty('--industries-entry-opacity', industryEntry.toFixed(3));
    industries.style.setProperty('--industries-entry-scale', (0.96 + industryEntry * 0.04).toFixed(3));

    const sectionTop = industryRect.top + window.scrollY;
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
    if (motionEnabled && !animationFrame) animationFrame = window.requestAnimationFrame(updateMotion);
  };

  const syncMotionPreference = () => {
    const enabled = !motionPreference.matches;
    const heroEnabled = enabled && !compactViewport.matches;
    const heroWasEnabled = heroMotionEnabled;
    motionEnabled = enabled;
    heroMotionEnabled = heroEnabled;
    document.body.classList.toggle('production-scroll-motion', heroEnabled);
    industries.classList.toggle('is-enhanced', enabled);
    if (heroWasEnabled && !heroEnabled) clearHeroScrollStyles();
    if (enabled) scheduleUpdate();
    else clearMotionStyles();
  };

  window.addEventListener('scroll', scheduleUpdate, { passive: true });
  window.addEventListener('resize', scheduleUpdate);
  if (motionPreference.addEventListener) motionPreference.addEventListener('change', syncMotionPreference);
  else motionPreference.addListener(syncMotionPreference);
  if (compactViewport.addEventListener) compactViewport.addEventListener('change', syncMotionPreference);
  else compactViewport.addListener(syncMotionPreference);

  syncMotionPreference();
})();
