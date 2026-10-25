const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#site-nav');
const menuDrawer = document.querySelector('.menu-drawer');

navigation.querySelectorAll('.menu-nav-links a').forEach((link, rowIndex) => {
  const label = link.textContent.trim();
  link.setAttribute('aria-label', label);
  link.replaceChildren(...Array.from(label, (character, letterIndex) => {
    const letter = document.createElement('span');
    letter.className = 'menu-letter';
    letter.setAttribute('aria-hidden', 'true');
    letter.textContent = character;
    letter.style.setProperty('--letter-delay', `${70 + rowIndex * 35 + letterIndex * 12}ms`);
    return letter;
  }));
});

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
let restartBenefitTextReveal = () => {};
const prepareTextLines = (element) => {
  element.querySelector(':scope > .text-reveal__accessible')?.remove();
  const accessibleText = element.innerText.replace(/\s+/gu, ' ').trim();
  if (!element.querySelector('.text-reveal__word')) {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    textNodes.forEach((node) => {
      if (node.nodeType !== Node.TEXT_NODE || !node.textContent.trim()) return;
      const hasFlexLayout = getComputedStyle(node.parentElement).display.includes('flex');
      const fragment = document.createDocumentFragment();
      node.textContent.split(/(\s+)/u).forEach((part) => {
        if (!part) return;
        if (/^\s+$/u.test(part)) {
          fragment.append(document.createTextNode(part));
        } else {
          const word = document.createElement('span');
          word.className = 'text-reveal__word';
          word.textContent = part;
          fragment.append(word);
        }
      });
      if (hasFlexLayout) {
        const content = document.createElement('span');
        content.className = 'text-reveal__content';
        content.append(fragment);
        node.replaceWith(content);
      } else {
        node.replaceWith(fragment);
      }
    });
  }
  element.querySelectorAll('.text-reveal__word').forEach((word) => {
    if (word.querySelector('.text-reveal__letter')) return;
    word.replaceChildren(...Array.from(word.textContent, (character) => {
      const letter = document.createElement('span');
      letter.className = 'text-reveal__letter';
      letter.setAttribute('aria-hidden', 'true');
      letter.textContent = character;
      return letter;
    }));
  });
  const accessibleCopy = document.createElement('span');
  accessibleCopy.className = 'visually-hidden text-reveal__accessible';
  accessibleCopy.textContent = accessibleText;
  element.prepend(accessibleCopy);
};
document.querySelectorAll('.work-card[data-default-state]').forEach((card) => {
  const images = [...card.querySelectorAll('[data-card-background]')];
  const modes = [...card.querySelectorAll('[data-card-mode]')];
  let selectedState = card.dataset.defaultState;
  let touchSelectionActive = false;
  const setState = (state) => {
    images.forEach((image) => image.classList.toggle('is-active', image.dataset.cardBackground === state));
  };
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
  projectCtaVideo.addEventListener('loadeddata', () => projectCtaVideo.classList.add('is-ready'), { once: true });
  projectCtaVideo.addEventListener('error', () => projectCtaVideo.classList.remove('is-ready'));
  if (projectCtaVideo.readyState >= 2) projectCtaVideo.classList.add('is-ready');
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
    { src: 'assets/benefit-warranty.webp', className: 'benefit-image--guarantee' },
    { src: 'assets/benefit-quality.webp', className: 'benefit-image--quality' },
    { src: 'assets/benefit-production.webp', className: 'benefit-image--production' },
  ];
  const preloadedBenefitArtwork = benefitArtwork.map(({ src }) => {
    const image = new Image();
    image.src = src;
    image.decode?.().catch(() => {});
    return image;
  });



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
    [benefitTitle, benefitDescription].forEach(prepareTextLines);
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
    benefitImage.classList.add('is-changing');

    const swapImage = async () => {
      if (version !== imageSwapVersion) return;
      benefitImage.src = nextArtwork.src;
      benefitImage.className = `benefit-image ${nextArtwork.className} is-active is-changing`;
      benefitImage.dataset.imageIndex = String(index);
      try {
        await (preloadedBenefitArtwork[index]?.decode?.() ?? benefitImage.decode?.());
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
    benefitCopy.classList.add('is-switching');
    const swapText = () => {
      if (version !== copySwapVersion) return;
      updateBenefitText(index);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (version === copySwapVersion) {
          benefitCopy.classList.remove('is-switching');
          restartBenefitTextReveal();
        }
      }));
    };

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) swapText();
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
  advanceBenefitCardByScroll = (scrollDirection, originScrollY = window.scrollY) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !benefitScrollStep) return false;
    const sectionTop = benefitsSection.getBoundingClientRect().top + window.scrollY;
    const mobile = window.matchMedia('(max-width:37.5rem)').matches;
    const stickyTop = mobile ? (parseFloat(getComputedStyle(benefitsStage).top) || 0) : 0;
    const availableScroll = Math.max(1, benefitsSection.offsetHeight - benefitsStage.offsetHeight - stickyTop);
    if (window.scrollY < sectionTop || window.scrollY > sectionTop + availableScroll) return false;

    const sourceScrollY = originScrollY >= sectionTop && originScrollY <= sectionTop + availableScroll
      ? originScrollY
      : window.scrollY;
    const currentIndex = Math.max(0, Math.min(benefitStates.length - 1,
      Math.floor((sourceScrollY - sectionTop) / benefitScrollStep)));
    const nextIndex = currentIndex + Math.sign(scrollDirection);
    if (nextIndex < 0 || nextIndex >= benefitStates.length) return false;
    if (benefitScrollActivationLocked) return true;

    benefitScrollActivationLocked = true;
    window.setTimeout(() => { benefitScrollActivationLocked = false; }, 650);
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
      const sectionTop = benefitsSection.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: sectionTop + (benefitScrollStep || benefitsStage.offsetHeight) * index, behavior: 'smooth' });
    });
  });
  updateBenefitScale();
  updateBenefitFromScroll();
}

const textRevealSelector = [
  'main h2', 'main h3', '[data-benefit-description]',
  '.project-cta__copy p',
  '.news-intro p',
  '.contact-heading p'
].join(',');

{
  const targets = [...document.querySelectorAll(textRevealSelector)]
    .filter((element) => !element.closest('.hero, .metrics, .work-card, .news-card, .footer'));
  const groups = new Map();
  const groupsByTarget = new Map();
  const characterDelay = 22;
  targets.forEach((element) => {
    element.classList.add('text-reveal');
    prepareTextLines(element);
    const groupElement = element.closest('.benefits-stage, .project-cta__copy, .news-intro__copy, .contact-heading') || element;
    let group = groups.get(groupElement);
    if (!group) {
      group = { elements: [], started: false };
      groups.set(groupElement, group);
    }
    group.elements.push(element);
    groupsByTarget.set(element, group);
  });
  const animateElements = (elements, restart = false) => {
    if (restart) elements.forEach((element) => element.classList.remove('text-reveal--active'));
    let delay = 0;
    elements.forEach((element) => {
      const speed = element.matches('h1, h2, h3, h4, h5, h6') ? 1 : 1.2;
      element.style.setProperty('--text-letter-duration', `${240 / speed}ms`);
      element.querySelectorAll('.text-reveal__letter').forEach((letter) => {
        letter.style.setProperty('--text-letter-delay', `${delay}ms`);
        delay += characterDelay / speed;
      });
    });
    // Commit the hidden state and delays before starting the one-way reveal.
    elements.forEach((element) => { void element.offsetWidth; });
    elements.forEach((element) => element.classList.add('text-reveal--active'));
  };
  restartBenefitTextReveal = () => {
    const group = groupsByTarget.get(benefitTitle);
    if (group?.started) animateElements([benefitTitle, benefitDescription], true);
  };

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const group = groupsByTarget.get(entry.target);
        if (!entry.isIntersecting || !group || group.started) return;
        group.started = true;
        animateElements(group.elements);
        group.elements.forEach((element) => observer.unobserve(element));
      });
    }, { threshold: 0 });
    targets.forEach((element) => observer.observe(element));
  } else {
    groups.forEach((group) => {
      group.started = true;
      animateElements(group.elements);
    });
  }
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

const setMenuOpen = (open) => {
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
  menuDrawer.classList.toggle('is-open', open);
  document.documentElement.classList.toggle('menu-open', open);
  document.body.classList.toggle('menu-open', open);
};

menuButton.addEventListener('click', () => {
  setMenuOpen(menuButton.getAttribute('aria-expanded') !== 'true');
});

navigation.addEventListener('click', (event) => {
  if (event.target.closest('a')) setMenuOpen(false);
});

menuDrawer.addEventListener('click', (event) => {
  if (menuButton.getAttribute('aria-expanded') === 'true' && event.target === menuDrawer) setMenuOpen(false);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') {
    setMenuOpen(false);
    menuButton.focus();
  }
});

document.addEventListener('pointerdown', (event) => {
  if (menuButton.getAttribute('aria-expanded') === 'true' && !menuDrawer.contains(event.target)) setMenuOpen(false);
});

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
    if (reducedMotion.matches || !finePointer.matches || event.ctrlKey || event.metaKey || !event.deltaY ||
        Math.abs(event.deltaX) > Math.abs(event.deltaY) ||
        event.target.closest('textarea, .menu-drawer') ||
        document.documentElement.classList.contains('menu-open')) return;
    if (advanceBenefitCardByScroll?.(event.deltaY)) {
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

// Keep touch swipes deliberate on phones and tablets. A short, capped glide
// replaces the much longer native fling without affecting taps or pinch zoom.
{
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const touchScale = .46;
  let gesture = null;
  let glideFrame = 0;
  let glideVelocity = 0;
  let glideTime = 0;

  const stopGlide = () => {
    cancelAnimationFrame(glideFrame);
    glideFrame = 0;
    glideTime = 0;
  };
  const glide = (time) => {
    const elapsed = glideTime ? Math.min(32, time - glideTime) : 16.67;
    glideTime = time;
    const before = window.scrollY;
    window.scrollTo({ top: before + glideVelocity * elapsed, behavior: 'instant' });
    glideVelocity *= Math.exp(-elapsed / 180);
    if (Math.abs(glideVelocity) < .025 || Math.abs(window.scrollY - before) < .5) {
      stopGlide();
    } else {
      glideFrame = requestAnimationFrame(glide);
    }
  };

  window.addEventListener('touchstart', (event) => {
    stopGlide();
    gesture = null;
    if (event.touches.length !== 1 || document.documentElement.classList.contains('menu-open') ||
        event.target.closest('input, textarea, select, video, .menu-drawer, [contenteditable]')) return;
    const touch = event.touches[0];
    gesture = { startX: touch.clientX, startY: touch.clientY, lastY: touch.clientY,
      startScrollY: window.scrollY, lastTime: performance.now(), velocity: 0, dragging: false };
  }, { passive: true });

  window.addEventListener('touchmove', (event) => {
    if (!gesture || event.touches.length !== 1) return;
    const touch = event.touches[0];
    const vertical = Math.abs(touch.clientY - gesture.startY);
    if (!gesture.dragging && vertical < 2) return;
    if (!gesture.dragging && vertical <= Math.abs(touch.clientX - gesture.startX)) return;
    if (!event.cancelable) return;
    event.preventDefault();
    gesture.dragging = true;
    const now = performance.now();
    const elapsed = Math.max(1, now - gesture.lastTime);
    const distance = (gesture.lastY - touch.clientY) * touchScale;
    window.scrollTo({ top: window.scrollY + distance, behavior: 'instant' });
    gesture.velocity = gesture.velocity * .35 + distance / elapsed * .65;
    gesture.lastY = touch.clientY;
    gesture.lastTime = now;
  }, { passive: false });

  window.addEventListener('touchend', (event) => {
    if (!gesture || event.touches.length) return;
    const benefitCardAdvanced = gesture.dragging &&
      Math.abs(gesture.startY - gesture.lastY) >= Math.max(48, innerHeight * .08) &&
      advanceBenefitCardByScroll?.(gesture.startY - gesture.lastY, gesture.startScrollY);
    if (!benefitCardAdvanced && gesture.dragging && !reducedMotion.matches && performance.now() - gesture.lastTime < 80) {
      glideVelocity = Math.max(-.8, Math.min(.8, gesture.velocity));
      if (Math.abs(glideVelocity) > .025) glideFrame = requestAnimationFrame(glide);
    }
    gesture = null;
  }, { passive: true });
  window.addEventListener('touchcancel', () => { gesture = null; stopGlide(); }, { passive: true });
  window.addEventListener('keydown', stopGlide, { passive: true });
  window.addEventListener('hashchange', stopGlide, { passive: true });
}


