const pageMotionPreference = matchMedia('(prefers-reduced-motion: reduce)');

// Count the laboratory metrics once when they enter the viewport.
if (!pageMotionPreference.matches && 'IntersectionObserver' in window) {
  const counters = [...document.querySelectorAll('[data-count-up]')].map(element => ({
    element,
    target: Number(element.dataset.countUpValue),
    suffix: element.dataset.countUpSuffix || ''
  })).filter(counter => Number.isFinite(counter.target));

  counters.forEach(({ element, suffix }) => { element.textContent = `0${suffix}`; });

  const counterObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      counterObserver.unobserve(entry.target);
      const counter = counters.find(item => item.element === entry.target);
      if (!counter) return;

      const duration = 1400;
      const startTime = performance.now();
      const animate = now => {
        const progress = Math.min(1, (now - startTime) / duration);
        const easedProgress = 1 - Math.pow(1 - progress, 3);
        const value = Math.round(counter.target * easedProgress).toLocaleString('ru-RU');
        const nextText = `${value}${counter.suffix}`;
        if (entry.target.textContent !== nextText) entry.target.textContent = nextText;
        if (progress < 1 && !pageMotionPreference.matches) requestAnimationFrame(animate);
        else {
          const finalText = `${counter.target.toLocaleString('ru-RU')}${counter.suffix}`;
          if (entry.target.textContent !== finalText) entry.target.textContent = finalText;
        }
      };
      requestAnimationFrame(animate);
    });
  }, { threshold: 0.35 });

  counters.forEach(({ element }) => counterObserver.observe(element));
}

// Phones own their scene inside the cover; larger screens use the shared journey.
const heroStage = document.querySelector('.testing-stage');
const heroDevice = document.querySelector('[data-testing-equipment]');
const heroVisual = document.querySelector('.testing-journey__visual');
if (heroStage && heroDevice && heroVisual) {
  const anchor = document.createElement('div');
  anchor.className = 'testing-stage__device-anchor';
  anchor.setAttribute('aria-hidden', 'true');
  heroStage.append(anchor);
  const visualTrack = heroVisual.parentElement;
  const originalTrackParent = visualTrack.parentElement;
  const originalTrackNext = visualTrack.nextSibling;
  const mobileCover = matchMedia('(max-width: 40.625rem)');
  const mountCoverScene = () => {
    if (mobileCover.matches) anchor.append(visualTrack);
    else originalTrackParent.insertBefore(visualTrack, originalTrackNext);
  };
  mobileCover.addEventListener('change', mountCoverScene);
  mountCoverScene();
  let heroFrame = 0;
  const positionHeroDevice = (force = false) => {
    heroFrame = 0;
    const isMobile = matchMedia('(max-width: 40.625rem)').matches;
    if (isMobile) heroStage.parentElement.style.setProperty('--mobile-cover-height', `${heroStage.offsetHeight}px`);
    else heroStage.parentElement.style.removeProperty('--mobile-cover-height');
    if (isMobile || !matchMedia('(max-width: 68.75rem)').matches) {
      heroDevice.style.removeProperty('--hero-device-x');
      heroDevice.style.removeProperty('--hero-device-y');
      heroDevice.style.removeProperty('--hero-device-scale');
      return;
    }
    const stage = heroStage.getBoundingClientRect();
    const target = anchor.getBoundingClientRect();
    const scene = heroVisual.getBoundingClientRect();
    const progress = Math.max(0, Math.min(1, -stage.top / stage.height));
    const weight = 1 - progress * progress * (3 - 2 * progress);
    // Compensate for the camera's rotation-safe empty space inside the canvas.
    heroDevice.style.setProperty('--hero-device-scale', String(1 + .25 * weight));
    heroDevice.style.setProperty('--hero-device-x', `${(target.left + target.width / 2 - scene.left - scene.width / 2) * weight}px`);
    heroDevice.style.setProperty('--hero-device-y', `${(target.top + target.height / 2 - scene.top - scene.height / 2) * weight}px`);
  };
  let forceHeroUpdate = false;
  const scheduleHeroDevice = (force = false) => {
    forceHeroUpdate ||= force;
    if (!heroFrame) heroFrame = requestAnimationFrame(() => {
      const shouldForce = forceHeroUpdate;
      forceHeroUpdate = false;
      positionHeroDevice(shouldForce);
    });
  };
  addEventListener('scroll', () => {
    if (!matchMedia('(max-width: 40.625rem)').matches) scheduleHeroDevice();
  }, { passive: true });
  addEventListener('resize', () => scheduleHeroDevice(true), { passive: true });
  new ResizeObserver(() => scheduleHeroDevice(true)).observe(heroStage);
  document.fonts?.ready.then(() => scheduleHeroDevice(true));
  scheduleHeroDevice(true);
}

const faqList = document.querySelector('.testing-faq__list');
if (faqList) {
  const faqItems = [...faqList.querySelectorAll('.testing-faq__item')];
  const faqDuration = pageMotionPreference.matches ? 0 : 380;
  const faqAnimations = new WeakMap();

  const animateFaqAnswer = (answer, from, to) => {
    const previousAnimation = faqAnimations.get(answer);
    if (previousAnimation) {
      previousAnimation.cancel();
      faqAnimations.delete(answer);
    }
    if (!faqDuration || !answer.animate || Math.abs(from - to) < 1) return Promise.resolve(true);
    const animation = answer.animate([
      { height: `${from}px`, opacity: from ? 1 : 0 },
      { height: `${to}px`, opacity: to ? 1 : 0 }
    ], { duration: faqDuration, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both' });
    faqAnimations.set(answer, animation);
    return animation.finished.catch(() => {}).then(() => {
      if (faqAnimations.get(answer) !== animation) return false;
      animation.cancel();
      faqAnimations.delete(answer);
      return true;
    });
  };

  const closeFaqItem = item => {
    if (!item.open) return;
    const answer = item.querySelector('.testing-faq__answer');
    if (!answer) {
      item.open = false;
      return;
    }
    const from = answer.getBoundingClientRect().height;
    item.dataset.closing = 'true';
    item.open = false;
    animateFaqAnswer(answer, from, 0).then(finished => {
      if (finished && !item.open) item.removeAttribute('data-closing');
    });
  };

  const openFaqItem = item => {
    const answer = item.querySelector('.testing-faq__answer');
    const from = item.hasAttribute('data-closing') ? answer?.getBoundingClientRect().height ?? 0 : 0;
    item.removeAttribute('data-closing');
    item.open = true;
    if (answer) animateFaqAnswer(answer, from, answer.scrollHeight);
  };

  faqList.addEventListener('click', event => {
    const summary = event.target.closest('.testing-faq__item > summary');
    if (!summary) return;
    event.preventDefault();
    const item = summary.parentElement;
    if (item.open) {
      closeFaqItem(item);
      return;
    }
    for (const other of faqItems) {
      if (other !== item && other.open) closeFaqItem(other);
    }
    openFaqItem(item);
  });
}

// Keep wheel and touch scrolling as smooth as on the homepage without snapping
// the browser abruptly to section boundaries.
{
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const hasTouchInput = navigator.maxTouchPoints > 0 || matchMedia('(any-pointer: coarse)').matches;
  const wheelDistanceScale = .5;
  const settlingTime = 280;
  let frame = 0;
  let position = scrollY;
  let destination = position;
  let previousTime = 0;
  let activeSettlingTime = settlingTime;

  const stop = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    previousTime = 0;
  };
  const advance = time => {
    const elapsed = previousTime ? Math.min(50, time - previousTime) : 16.67;
    previousTime = time;
    position += (destination - position) * (1 - Math.exp(-elapsed / activeSettlingTime));
    if (Math.abs(destination - position) < .5) position = destination;
    scrollTo({ top: position, behavior: 'instant' });
    frame = position === destination ? 0 : requestAnimationFrame(advance);
    if (!frame) previousTime = 0;
  };

  addEventListener('wheel', event => {
    const target = event.target instanceof Element ? event.target : null;
    if (pageMotionPreference.matches || !finePointer.matches || hasTouchInput || event.ctrlKey || event.metaKey || !event.deltaY ||
        Math.abs(event.deltaX) > Math.abs(event.deltaY) ||
        target?.closest('input, textarea, select, .menu-drawer, [contenteditable]') ||
        document.documentElement.classList.contains('menu-open')) return;
    const distance = event.deltaY * (event.deltaMode === 1 ? 40 : event.deltaMode === 2 ? innerHeight : 1) * wheelDistanceScale;
    const limit = Math.max(0, document.documentElement.scrollHeight - innerHeight);
    if (!event.cancelable || !limit) return;
    event.preventDefault();
    if (!frame) position = destination = scrollY;
    activeSettlingTime = event.deltaMode === 0 && Math.abs(event.deltaY) < 35 ? 90 : settlingTime;
    const maxLead = innerHeight * .9;
    destination = Math.max(0, Math.min(limit, position + Math.max(-maxLead, Math.min(maxLead, destination + distance - position))));
    if (!frame) frame = requestAnimationFrame(advance);
  }, { passive: false });

  ['pointerdown', 'touchstart', 'keydown', 'hashchange', 'popstate'].forEach(type => addEventListener(type, stop, { passive: true }));
  pageMotionPreference.addEventListener('change', stop);
  addEventListener('resize', stop, { passive: true });
}

if (!pageMotionPreference.matches && 'IntersectionObserver' in window) {
  const reveal = (elements, stagger = 0) => elements.forEach((element, index) => {
    if (!element || element.hasAttribute('data-scroll-reveal')) return;
    // The shared page-entry mask already reveals the first screen.
    if (window.sitePageEntryPending && element.closest('.topbar, .menu-drawer, .testing-stage')) return;
    element.setAttribute('data-scroll-reveal', '');
    element.style.setProperty('--reveal-delay', `${Math.min(index * stagger, 420)}ms`);
  });
  const revealGroup = (selector, stagger = 0) => reveal([...document.querySelectorAll(selector)], stagger);
  revealGroup('.topbar .brand-mark, .topbar .brand > span, .menu-toggle > span, .menu-toggle .menu-icon > i', 75);
  revealGroup('.nav .menu-nav-links a, .nav .menu-social__link', 55);
  revealGroup('.climate-tests__visuals', 120);
  revealGroup('.climate-tests__pagination button', 100);
  revealGroup('.mechanical-tests__shaker img', 100);

  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -5% 0px' });
  document.querySelectorAll('[data-scroll-reveal]').forEach(element => revealObserver.observe(element));
  document.documentElement.classList.add('testing-motion-ready');
  window.setTimeout(() => {
    if (!document.querySelector('.testing-stage__copy h2.is-visible')) {
      document.documentElement.classList.remove('testing-motion-ready');
    }
  }, 1800);
}

document.querySelectorAll('.testing-stage__button').forEach(button => {
  button.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch') return;
    const bounds = button.getBoundingClientRect();
    button.style.setProperty('--cursor-x', `${((event.clientX - bounds.left) / bounds.width) * 100}%`);
    button.style.setProperty('--cursor-y', `${((event.clientY - bounds.top) / bounds.height) * 100}%`);
  });
});

// Climate equipment and specifications switch together during scrolling.
const climateCarousel = document.querySelector('[data-climate-carousel]');
if (climateCarousel) {
  const climateTrack = climateCarousel.querySelector('.climate-tests__track');
  const climateStage = climateCarousel.querySelector('.climate-tests__stage');
  const climateBody = climateCarousel.querySelector('.climate-tests__body');
  const climateVisuals = climateCarousel.querySelector('.climate-tests__visuals');
  const cameraStack = climateCarousel.querySelector('.climate-tests__camera-stack');
  const cameras = [...climateCarousel.querySelectorAll('[data-climate-camera]')];
  const pages = [...climateCarousel.querySelectorAll('[data-climate-page]')];
  const title = climateCarousel.querySelector('[data-climate-camera-title]');
  const highTemperature = climateCarousel.querySelector('[data-climate-high-temp]');
  const lowTemperature = climateCarousel.querySelector('[data-climate-low-temp]');
  const humidityRow = climateCarousel.querySelector('[data-climate-humidity]');
  const cameraSpecs = [
    { title: 'Климатическая камера S-B-8200', highTemperature: 'до 210 °C', lowTemperature: 'до −80 °C', humidity: true },
    { title: 'Климатическая камера THCB-125', highTemperature: 'до 150 °C', lowTemperature: 'до −70 °C', humidity: false }
  ];
  let activeCamera = -1;
  let climateFrame = 0;
  let manualSelectionScrollY = null;
  let climateVisualOffset = 0;
  const clampClimate = value => Math.max(0, Math.min(1, value));

  const showClimateState = index => {
    if (index === activeCamera) return;
    const preserveVisualPosition = climateVisuals && activeCamera >= 0;
    const visualBottom = preserveVisualPosition ? climateVisuals.getBoundingClientRect().bottom : null;
    activeCamera = index;
    cameras.forEach((image, imageIndex) => {
      image.classList.toggle('is-active', imageIndex === index);
      image.classList.toggle('is-before', imageIndex < index);
      image.classList.toggle('is-after', imageIndex > index);
    });
    pages.forEach((page, pageIndex) => {
      const active = pageIndex === index;
      page.classList.toggle('is-active', active);
      page.setAttribute('aria-pressed', String(active));
    });
    const spec = cameraSpecs[index];
    if (title) title.textContent = spec.title;
    if (highTemperature) highTemperature.textContent = spec.highTemperature;
    if (lowTemperature) lowTemperature.textContent = spec.lowTemperature;
    if (humidityRow) {
      humidityRow.classList.toggle('is-unavailable', !spec.humidity);
      humidityRow.setAttribute('aria-hidden', String(!spec.humidity));
    }
    if (preserveVisualPosition && visualBottom !== null) {
      // Keep the camera's bottom edge fixed while specs change the content height.
      const layoutBottom = climateVisuals.getBoundingClientRect().bottom - climateVisualOffset;
      climateVisualOffset = visualBottom - layoutBottom;
      climateVisuals.style.setProperty('--climate-visual-y', `${climateVisualOffset}px`);
    }
  };

  const updateClimateState = () => {
    climateFrame = 0;
    // Responsive layouts use their paginator/swipes, not an empty scroll runway.
    if (matchMedia('(max-width: 68.75rem)').matches) {
      if (activeCamera < 0) showClimateState(0);
      return;
    }
    if (manualSelectionScrollY !== null) {
      const unlockDistance = Math.max(24, window.innerHeight * .12);
      if (Math.abs(window.scrollY - manualSelectionScrollY) < unlockDistance) return;
      manualSelectionScrollY = null;
    }
    const trackBounds = climateTrack?.getBoundingClientRect();
    const pinDistance = climateTrack && climateStage ?
      climateTrack.offsetHeight - climateStage.offsetHeight : 0;
    let progress;
    if (pinDistance > 1 && trackBounds) {
      progress = clampClimate(-trackBounds.top / pinDistance);
    } else if (climateVisuals && climateBody && matchMedia('(max-width: 43.75rem)').matches) {
      const stickyTop = window.innerHeight * 0.2;
      const bodyTop = climateBody.getBoundingClientRect().top + window.scrollY;
      const holdStart = bodyTop + climateVisuals.offsetTop - stickyTop;
      const holdDistance = climateBody.offsetHeight - climateVisuals.offsetTop - climateVisuals.offsetHeight;
      progress = clampClimate((window.scrollY - holdStart) / Math.max(1, holdDistance));
    } else {
      const bounds = climateCarousel.getBoundingClientRect();
      progress = clampClimate((window.innerHeight - bounds.top) /
        (window.innerHeight + bounds.height));
    }
    showClimateState(progress >= 0.5 ? 1 : 0);
  };
  const scheduleClimateUpdate = () => {
    if (!climateFrame) climateFrame = requestAnimationFrame(updateClimateState);
  };

  const selectClimateManually = index => {
    manualSelectionScrollY = window.scrollY;
    showClimateState(index);
  };
  pages.forEach((page, index) => page.addEventListener('click', () => selectClimateManually(index)));
  let swipeStart = null;
  cameraStack?.addEventListener('touchstart', event => {
    if (event.changedTouches.length !== 1) return;
    const touch = event.changedTouches[0];
    swipeStart = { x: touch.clientX, y: touch.clientY };
  }, { passive: true });
  cameraStack?.addEventListener('touchend', event => {
    if (!swipeStart || event.changedTouches.length !== 1) return;
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - swipeStart.x;
    const deltaY = touch.clientY - swipeStart.y;
    swipeStart = null;
    if (Math.abs(deltaX) < 36 || Math.abs(deltaX) <= Math.abs(deltaY)) return;
    const current = Math.max(0, activeCamera);
    const next = Math.max(0, Math.min(cameras.length - 1, current + (deltaX < 0 ? 1 : -1)));
    if (next !== current) selectClimateManually(next);
  }, { passive: true });
  cameraStack?.addEventListener('touchcancel', () => { swipeStart = null; }, { passive: true });
  addEventListener('scroll', scheduleClimateUpdate, { passive: true });
  addEventListener('resize', () => {
    climateVisualOffset = 0;
    climateVisuals?.style.removeProperty('--climate-visual-y');
    scheduleClimateUpdate();
  }, { passive: true });
  if ('ResizeObserver' in window) new ResizeObserver(scheduleClimateUpdate).observe(climateCarousel);
  scheduleClimateUpdate();
}
