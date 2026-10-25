const hero = document.querySelector('.hero');
const heroReveals = [...document.querySelectorAll('.hero-reveal')];
const benefitsSection = document.querySelector('.benefits');
const benefitsStage = document.querySelector('.benefits-stage');
const benefitTitle = document.querySelector('[data-benefit-title]');
const benefitDescription = document.querySelector('[data-benefit-description]');
const benefitCopy = document.querySelector('[data-benefit-copy]');
const benefitArt = document.querySelector('[data-benefit-art]');
const benefitMore = document.querySelector('[data-benefit-more]');
const benefitImage = document.querySelector('[data-benefit-image]');
const benefitButtons = [...document.querySelectorAll('[data-benefit-index]')];
let restartBenefitTextReveal = () => {
  if (!benefitTitle || !benefitDescription || benefitCopy?.dataset.state !== '0') return;
  window.siteTextReveal?.animate([benefitTitle, benefitDescription], { restart: true });
};
const prepareTextLines = (element) => window.siteTextReveal?.prepare(element);
document.querySelectorAll('.work-card[data-default-state]').forEach((card) => {
  const images = [...card.querySelectorAll('[data-card-background]')];
  const modes = [...card.querySelectorAll('[data-card-mode]')];
  let selectedState = card.dataset.defaultState;
  let touchSelectionActive = false;
  const setState = (state) => {
    images.forEach((image) => {
      const isActive = image.dataset.cardBackground === state;
      image.classList.toggle('is-active', isActive);
      if (!isActive || !image.dataset.src) return;
      if (image.dataset.sizes) image.sizes = image.dataset.sizes;
      if (image.dataset.srcset) image.srcset = image.dataset.srcset;
      image.src = image.dataset.src;
      delete image.dataset.src;
    });
  };
  setState(selectedState);
  const restoreState = () => {
    if (touchSelectionActive) {
      setState(selectedState);
      return;
    }
    const focusedMode = modes.find((mode) => mode === document.activeElement);
    const hoveredMode = modes.find((mode) => mode.matches(':hover'));
    setState(focusedMode?.dataset.cardMode || hoveredMode?.dataset.cardMode || selectedState);
  };

  card.addEventListener('click', (event) => {
    if (event.target.closest('a[href]')) return;
    const mode = event.target.closest('[data-card-mode]');
    if (mode) {
      selectedState = mode.dataset.cardMode;
    } else {
      const currentIndex = modes.findIndex((button) => button.dataset.cardMode === selectedState);
      selectedState = modes[(currentIndex + 1) % modes.length].dataset.cardMode;
    }
    setState(selectedState);
  });

  modes.forEach((button) => {
    button.addEventListener('pointerdown', (event) => {
      if (event.pointerType !== 'touch') return;
      touchSelectionActive = true;
      selectedState = button.dataset.cardMode;
      setState(selectedState);
    });
    button.addEventListener('pointerenter', (event) => {
      if (event.pointerType === 'touch') return;
      setState(button.dataset.cardMode);
    });
    button.addEventListener('focus', () => setState(button.dataset.cardMode));
    button.addEventListener('pointerleave', (event) => {
      if (event.pointerType === 'touch') {
        restoreState();
        return;
      }
      const nextMode = event.relatedTarget?.closest?.('[data-card-mode]');
      if (nextMode && card.contains(nextMode)) setState(nextMode.dataset.cardMode);
      else restoreState();
    });
    button.addEventListener('blur', restoreState);
  });
});

const projectCtaVideo = document.querySelector('.project-cta__video');
if (projectCtaVideo) {
  const videoSource = projectCtaVideo.querySelector('source[data-src]');
  let videoNearViewport = false;
  let shouldSkipBackgroundVideo = matchMedia('(prefers-reduced-motion: reduce)').matches
    || navigator.connection?.saveData;
  const playVideo = () => {
    if (!videoSource || shouldSkipBackgroundVideo) return;
    if (!videoSource.src) {
      videoSource.src = videoSource.dataset.src;
      projectCtaVideo.load();
    }
    if (!document.hidden && videoNearViewport) projectCtaVideo.play().catch(() => {});
  };
  projectCtaVideo.addEventListener('loadeddata', () => projectCtaVideo.classList.add('is-ready'), { once: true });
  projectCtaVideo.addEventListener('error', () => projectCtaVideo.classList.remove('is-ready'));
  if (projectCtaVideo.readyState >= 2) projectCtaVideo.classList.add('is-ready');
  if (!shouldSkipBackgroundVideo && 'IntersectionObserver' in window) {
    const videoObserver = new IntersectionObserver(([entry]) => {
      videoNearViewport = Boolean(entry?.isIntersecting);
      if (videoNearViewport) playVideo();
      else projectCtaVideo.pause();
    }, { rootMargin: '240px 0px' });
    videoObserver.observe(projectCtaVideo);
  } else if (!shouldSkipBackgroundVideo) {
    videoNearViewport = true;
    playVideo();
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) projectCtaVideo.pause();
    else if (videoNearViewport) playVideo();
  });
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change', event => {
    shouldSkipBackgroundVideo = event.matches || navigator.connection?.saveData;
    if (shouldSkipBackgroundVideo) projectCtaVideo.pause();
    else if (videoNearViewport) playVideo();
  });
}

const newsCards = [...document.querySelectorAll('.news-card[data-news-background]')];
const setNewsCardBackground = card => {
  const original = card.dataset.newsBackground;
  const pixelWidth = Math.ceil(card.getBoundingClientRect().width * (window.devicePixelRatio || 1));
  const candidates = [640, 1280, 1920];
  const selectedWidth = candidates.find(width => width >= pixelWidth);
  const source = selectedWidth && /\.webp$/i.test(original)
    ? original.replace(/\.webp$/i, `-${selectedWidth}w.webp`)
    : original;
  if (card.dataset.loadedBackground === source) return;
  card.style.backgroundImage = `url("${source}")`;
  card.dataset.loadedBackground = source;
};
if ('IntersectionObserver' in window) {
  const newsCardObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const card = entry.target;
      setNewsCardBackground(card);
      newsCardObserver.unobserve(card);
      if ('ResizeObserver' in window) new ResizeObserver(() => setNewsCardBackground(card)).observe(card);
    });
  }, { rootMargin: '320px' });
  newsCards.forEach(card => newsCardObserver.observe(card));
} else {
  newsCards.forEach(setNewsCardBackground);
}

document.querySelectorAll('.project-cta__button, .submit').forEach((button) => {
  button.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch') return;
    const bounds = button.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * 100;
    const y = ((event.clientY - bounds.top) / bounds.height) * 100;
    button.style.setProperty('--cursor-x', `${x}%`);
    button.style.setProperty('--cursor-y', `${y}%`);
  });
});

const benefitStates = [
  {
    title: 'Гарантийные обязательства',
    description: 'Полный комплект лицензий и сертификатов необходимых для разработки, производства и испытаний',
  },
  {
    title: 'Качественные услуги',
    description: 'Используем современное оборудование, соблюдаем технические требования и обеспечиваем стабильное качество на всех этапах проекта',
  },
  {
    title: 'Полный цикл производства',
    description: 'Выполняем все этапы работ — от разработки и изготовления печатных плат до сборки, тестирования и выпуска готового электронного модуля.',
  },
];
let benefitScrollStep = 0;
let advanceBenefitCardByScroll = null;

if (benefitsSection && benefitsStage && benefitTitle && benefitDescription && benefitCopy && benefitArt && benefitImage) {
  let activeBenefit = 0;
  let scrollFrame = 0;
  let imageSwapVersion = 0;
  let copySwapVersion = 0;

  const benefitArtwork = [
    { src: 'assets/benefit-warranty.webp', srcset: 'assets/benefit-warranty-640w.webp 640w, assets/benefit-warranty.webp 1024w', className: 'benefit-image--guarantee' },
    { src: 'assets/benefit-quality.webp', srcset: 'assets/benefit-quality-640w.webp 640w, assets/benefit-quality-1280w.webp 1280w, assets/benefit-quality.webp 1878w', className: 'benefit-image--quality' },
    { src: 'assets/benefit-production.webp', srcset: 'assets/benefit-production-640w.webp 640w, assets/benefit-production-1280w.webp 1280w, assets/benefit-production.webp 1432w', className: 'benefit-image--production' },
  ];
  const preloadedBenefitArtwork = new Array(benefitArtwork.length);
  preloadedBenefitArtwork[0] = benefitImage;
  const preloadBenefitArtwork = index => {
    if (preloadedBenefitArtwork[index]) return preloadedBenefitArtwork[index];
    const { src } = benefitArtwork[index];
    const image = new Image();
    image.sizes = '(max-width: 37.5rem) 100vw, (max-width: 56.25rem) 58vw, 60vw';
    image.srcset = benefitArtwork[index].srcset;
    image.decoding = 'async';
    image.src = src;
    image.decode?.().catch(() => {});
    preloadedBenefitArtwork[index] = image;
    return image;
  };
  if ('IntersectionObserver' in window) {
    const benefitArtworkObserver = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      preloadBenefitArtwork(1);
      benefitArtworkObserver.disconnect();
    }, { rootMargin: '480px 0px' });
    benefitArtworkObserver.observe(benefitsSection);
  }



  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const syncBenefitMore = (index) => {
    const isVisible = index === 2 || window.innerWidth <= 600;
    benefitMore.hidden = !isVisible;
    benefitMore.classList.toggle('is-visible', isVisible);
  };

  const updateBenefitText = (index) => {
    const state = benefitStates[index];
    [benefitTitle, benefitDescription].forEach((element) => element.classList.remove('text-reveal--active'));
    benefitTitle.textContent = state.title;
    benefitDescription.textContent = state.description;
    benefitCopy.dataset.state = String(index);
    if (index === 0) {
      [benefitTitle, benefitDescription].forEach(prepareTextLines);
    } else {
      [benefitTitle, benefitDescription].forEach((element) => {
        element.classList.remove('text-reveal');
        delete element.dataset.textRevealReady;
        delete element.dataset.textRevealContent;
      });
      // The orange square marks the subtitle even when letter animation is off.
      benefitTitle.classList.add('text-reveal--active');
    }
    benefitCopy.classList.add('is-visible');
    syncBenefitMore(index);
    benefitButtons.forEach((button, buttonIndex) => {
      const isActive = buttonIndex === index;
      button.classList.toggle('is-active', isActive);
      if (isActive) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
  };
  const setBenefitCard = (index) => {
    benefitArt.dataset.state = String(index);
    const version = ++imageSwapVersion;
    if (Number(benefitImage.dataset.imageIndex) === index) {
      benefitImage.classList.remove('is-changing');
      return;
    }

    const nextArtwork = benefitArtwork[index];
    const nextImage = preloadBenefitArtwork(index);
    benefitImage.classList.add('is-changing');

    const swapImage = async () => {
      if (version !== imageSwapVersion) return;
      benefitImage.sizes = '(max-width: 37.5rem) 100vw, (max-width: 56.25rem) 58vw, 60vw';
      benefitImage.srcset = nextArtwork.srcset;
      benefitImage.src = nextArtwork.src;
      benefitImage.className = `benefit-image ${nextArtwork.className} is-active is-changing`;
      benefitImage.dataset.imageIndex = String(index);
      try {
        await (nextImage.decode?.() ?? benefitImage.decode?.());
      } catch {}
      if (version !== imageSwapVersion) return;
      requestAnimationFrame(() => {
        if (version === imageSwapVersion) benefitImage.classList.remove('is-changing');
      });
    };

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) swapImage();
    else window.setTimeout(swapImage, 220);
  };

  const showBenefit = (index) => {
    if (index === activeBenefit) return;
    activeBenefit = index;
    setBenefitCard(index);

    const version = ++copySwapVersion;
    const animateCopy = index === 0 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    benefitCopy.classList.toggle('is-switching', animateCopy);
    const swapText = () => {
      if (version !== copySwapVersion) return;
      updateBenefitText(index);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (version === copySwapVersion) {
          benefitCopy.classList.remove('is-switching');
          if (index === 0) restartBenefitTextReveal();
        }
      }));
    };

    if (!animateCopy) swapText();
    else window.setTimeout(swapText, 180);
  };

  const updateBenefitFromScroll = () => {
    scrollFrame = 0;
    const sectionTop = benefitsSection.getBoundingClientRect().top + window.scrollY;
    const stageHeight = benefitsStage.offsetHeight || window.innerHeight;
    const mobile = window.matchMedia('(max-width:37.5rem)').matches;
    const stickyTop = mobile ? (parseFloat(getComputedStyle(benefitsStage).top) || 0) : 0;
    const availableScroll = Math.max(1, benefitsSection.offsetHeight - stageHeight - stickyTop);
    benefitScrollStep = mobile ? availableScroll / benefitStates.length : stageHeight;
    const stateIndex = clamp(Math.floor((window.scrollY - sectionTop) / benefitScrollStep), 0, benefitStates.length - 1);
    showBenefit(stateIndex);
  };

  let benefitScrollActivationLocked = false;
  let benefitScrollActivationTimer = 0;
  let benefitTargetIndex = null;
  advanceBenefitCardByScroll = (scrollDirection, originScrollY = window.scrollY, inputType = 'touch', wheelBurst = false) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !benefitScrollStep) return false;
    const direction = Math.sign(scrollDirection);
    if (!direction) return false;
    const sectionTop = benefitsSection.getBoundingClientRect().top + window.scrollY;
    const mobile = window.matchMedia('(max-width:37.5rem)').matches;
    const stickyTop = mobile ? (parseFloat(getComputedStyle(benefitsStage).top) || 0) : 0;
    const availableScroll = Math.max(1, benefitsSection.offsetHeight - benefitsStage.offsetHeight - stickyTop);
    if (window.scrollY < sectionTop || window.scrollY > sectionTop + availableScroll) return false;

    const sourceScrollY = originScrollY >= sectionTop && originScrollY <= sectionTop + availableScroll
      ? originScrollY
      : window.scrollY;
    const visibleIndex = Math.max(0, Math.min(benefitStates.length - 1,
      Math.floor((sourceScrollY - sectionTop) / benefitScrollStep)));
    if (benefitTargetIndex === null) benefitTargetIndex = visibleIndex;
    const nextIndex = benefitTargetIndex + direction;
    if (nextIndex < 0 || nextIndex >= benefitStates.length) return false;
    if (inputType === 'wheel' && wheelBurst && benefitScrollActivationLocked) {
      window.clearTimeout(benefitScrollActivationTimer);
      benefitScrollActivationTimer = window.setTimeout(() => { benefitScrollActivationLocked = false; }, 160);
      return true;
    }

    benefitTargetIndex = nextIndex;
    if (inputType === 'wheel' && wheelBurst) {
      benefitScrollActivationLocked = true;
      window.clearTimeout(benefitScrollActivationTimer);
      benefitScrollActivationTimer = window.setTimeout(() => { benefitScrollActivationLocked = false; }, 160);
    }
    window.scrollTo({
      top: sectionTop + benefitScrollStep * nextIndex,
      behavior: 'smooth',
    });
    return true;
  };

  const requestBenefitUpdate = () => {
    if (!scrollFrame) scrollFrame = window.requestAnimationFrame(updateBenefitFromScroll);
  };

  const updateBenefitScale = () => {
    if (window.innerWidth >= 1200) {
      const scale = Math.min(1, benefitsStage.clientWidth / 1720, benefitsStage.clientHeight / 995);
      benefitsStage.style.setProperty('--benefit-scale', String(scale));
    } else {
      benefitsStage.style.removeProperty('--benefit-scale');
    }
    syncBenefitMore(activeBenefit);
    requestBenefitUpdate();
  };

  window.addEventListener('scroll', requestBenefitUpdate, { passive: true });
  window.addEventListener('resize', updateBenefitScale, { passive: true });
  benefitButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const index = Number(button.dataset.benefitIndex);
      benefitTargetIndex = index;
      const sectionTop = benefitsSection.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: sectionTop + (benefitScrollStep || benefitsStage.offsetHeight) * index, behavior: 'smooth' });
    });
  });
  updateBenefitScale();
  updateBenefitFromScroll();
}

if (hero && heroReveals.length && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  if (window.siteMosaicIncoming || document.querySelector('.mosaic-transition')) {
    // The incoming page mosaic reveals the cover itself; a second black grid
    // here would stack over it and leave the destination looking blank.
    heroReveals.forEach((reveal) => reveal.remove());
  } else {
    const columns = 16;
    const rows = 9;
    const centerRow = (rows - 1) / 2;
    const centerColumn = (columns - 1) / 2;
    const maxDistance = Math.hypot(centerRow, centerColumn);
    const tileEntries = Array.from({ length: rows * columns }, (_, index) => ({
      row: Math.floor(index / columns),
      column: index % columns,
      tiles: []
    }));
    heroReveals.forEach((reveal) => {
      const tiles = document.createDocumentFragment();
      tileEntries.forEach((entry) => {
        const tile = document.createElement('span');
        tile.className = 'hero-reveal__tile';
        tiles.append(tile);
        entry.tiles.push(tile);
      });
      reveal.append(tiles);
    });

    const startHeroReveal = () => {
      window.setTimeout(() => {
        requestAnimationFrame(() => {
          tileEntries.forEach(({ tiles, row, column }) => {
            const distance = Math.hypot(row - centerRow, column - centerColumn) / maxDistance;
            const randomOffset = Math.random() * 0.35;
            const delay = distance * 480 + randomOffset * 500;
            tiles.forEach((tile) => {
              tile.style.setProperty('--tile-delay', `${delay}ms`);
              tile.classList.add('is-revealed');
            });
          });
        });
        window.setTimeout(() => heroReveals.forEach((reveal) => reveal.remove()), 1900);
      }, 200);
    };
    const heroBackground = hero.querySelector('.hero-bg img');
    if (!heroBackground || heroBackground.complete) {
      Promise.resolve(heroBackground?.decode?.()).catch(() => {}).then(startHeroReveal);
    } else {
      const startAfterLoad = () => Promise.resolve(heroBackground.decode?.()).catch(() => {}).then(startHeroReveal);
      heroBackground.addEventListener('load', startAfterLoad, { once: true });
      heroBackground.addEventListener('error', startHeroReveal, { once: true });
    }
  }
}

const contactForm = document.querySelector('.contact-form');
const contactSubmitButton = contactForm.querySelector('.submit');
const contactSubmitLabel = contactSubmitButton.querySelector('span');
const contactFeedback = contactForm.querySelector('.form-feedback');
let contactSubmissionPending = false;
let contactSubmissionSucceeded = false;
contactForm.addEventListener('input', () => {
  if (contactSubmissionPending) return;
  contactSubmissionSucceeded = false;
  contactForm.classList.remove('is-submitted');
  contactSubmitButton.disabled = false;
  contactFeedback.textContent = '';
});
contactForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (contactSubmissionPending || contactSubmissionSucceeded) return;
  if (window.location.protocol === 'file:') {
    contactFeedback.textContent = 'Форма отправляется с опубликованного сайта по HTTPS. Откройте сайт по веб-адресу и попробуйте ещё раз.';
    return;
  }

  const formData = new FormData(contactForm);
  const payload = Object.fromEntries(formData.entries());
  payload._replyto = formData.get('email');
  const formPageUrl = new URL(window.location.href);
  formPageUrl.hash = '';
  payload._url = formPageUrl.href;

  contactSubmissionPending = true;
  contactForm.setAttribute('aria-busy', 'true');
  contactSubmitButton.disabled = true;
  contactSubmitLabel.textContent = 'Отправляем…';
  contactFeedback.textContent = '';

  try {
    const response = await fetch('https://formsubmit.co/ajax/gromf1493@mail.ru', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const result = await response.json();

    const submissionSucceeded = result.success === true || result.success === 'true';
    if (!response.ok || !submissionSucceeded) throw new Error('FormSubmit did not accept the request');

    contactSubmissionSucceeded = true;
    contactForm.classList.add('is-submitted');
    contactFeedback.textContent = 'Заявка отправлена. Если это первая отправка, подтвердите адрес в письме от FormSubmit.';
  } catch (error) {
    contactSubmitButton.disabled = false;
    contactFeedback.textContent = 'Не удалось связаться с формой. Проверьте соединение и подтвердите адрес в FormSubmit, если ещё не сделали этого.';
  } finally {
    contactSubmissionPending = false;
    contactForm.removeAttribute('aria-busy');
    contactSubmitLabel.textContent = 'Отправить';
  }
});

// Smooth and slow wheel input across the page. Reduced-motion preferences keep
// the browser's native wheel scrolling behaviour.
{
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const hasTouchInput = navigator.maxTouchPoints > 0 || window.matchMedia('(any-pointer: coarse)').matches;
  const wheelDistanceScale = .5;
  const settlingTime = 280;
  let frame = 0;
  let position = window.scrollY;
  let destination = position;
  let previousTime = 0;
  let activeSettlingTime = settlingTime;

  const stop = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    previousTime = 0;
  };
  const advance = (time) => {
    const elapsed = previousTime ? Math.min(50, time - previousTime) : 16.67;
    previousTime = time;
    position += (destination - position) * (1 - Math.exp(-elapsed / activeSettlingTime));
    if (Math.abs(destination - position) < .5) position = destination;
    window.scrollTo({ top: position, behavior: 'instant' });
    frame = position === destination ? 0 : requestAnimationFrame(advance);
    if (!frame) previousTime = 0;
  };

  window.addEventListener('wheel', (event) => {
    if (reducedMotion.matches || !finePointer.matches || hasTouchInput || event.ctrlKey || event.metaKey || !event.deltaY ||
        Math.abs(event.deltaX) > Math.abs(event.deltaY) ||
        event.target.closest('textarea, .menu-drawer') ||
        document.documentElement.classList.contains('menu-open')) return;
    if (advanceBenefitCardByScroll?.(event.deltaY, window.scrollY, 'wheel', Math.abs(event.deltaY) < 35)) {
      if (event.cancelable) event.preventDefault();
      stop();
      return;
    }
    const distance = event.deltaY * (event.deltaMode === 1 ? 40 : event.deltaMode === 2 ? innerHeight : 1) * wheelDistanceScale;
    const limit = Math.max(0, document.documentElement.scrollHeight - innerHeight);
    if (!event.cancelable || !limit) return;
    event.preventDefault();
    if (!frame) position = destination = window.scrollY;
    activeSettlingTime = event.deltaMode === 0 && Math.abs(event.deltaY) < 35 ? 90 : settlingTime;
    const maxLead = innerHeight * .9;
    destination = Math.max(0, Math.min(limit, position + Math.max(-maxLead, Math.min(maxLead, destination + distance - position))));
    if (!frame) frame = requestAnimationFrame(advance);
  }, { passive: false });

  ['pointerdown', 'touchstart', 'keydown', 'hashchange', 'popstate'].forEach((type) => {
    window.addEventListener(type, stop, { passive: true });
  });
  reducedMotion.addEventListener('change', stop);
  window.addEventListener('resize', stop, { passive: true });
}

