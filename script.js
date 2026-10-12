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
const benefitImages = [...document.querySelectorAll('.benefit-image')];
const benefitButtons = [...document.querySelectorAll('[data-benefit-index]')];
let requestTextReveal = () => {};
let refreshTextRevealLayout = () => {};
const prepareTextLines = (element) => {
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
  let offset = 0;
  element.querySelectorAll('.text-reveal__word').forEach((word) => {
    word.dataset.revealStart = String(offset);
    word.dataset.revealLength = String(Array.from(word.textContent).length);
    offset += Number(word.dataset.revealLength) + 1;
  });
  element.dataset.revealLength = String(Math.max(1, offset - 1));
  element.style.setProperty('--text-final-color', getComputedStyle(element).color);
  if (element.closest('.benefits')) {
    element.classList.add('benefit-text-reveal');
    element.querySelectorAll('.text-reveal__word').forEach((word) => {
      if (!word.querySelector('.benefit-text__letter')) {
        word.replaceChildren(...Array.from(word.textContent, (character) => {
          const letter = document.createElement('span');
          letter.className = 'benefit-text__letter';
          letter.textContent = character;
          return letter;
        }));
      }
    });
  }
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

if (benefitsSection && benefitsStage && benefitTitle && benefitDescription && benefitCopy && benefitArt) {
  let activeBenefit = 0;
  let scrollFrame = 0;



  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const syncBenefitMore = (index) => {
    const isVisible = index === 2 || window.innerWidth <= 600;
    benefitMore.hidden = !isVisible;
    benefitMore.classList.toggle('is-visible', isVisible);
  };

  const updateBenefitText = (index) => {
    const state = benefitStates[index];
    benefitTitle.textContent = state.title;
    benefitDescription.textContent = state.description;
    benefitCopy.dataset.state = String(index);
    [benefitTitle, benefitDescription].forEach(prepareTextLines);
    refreshTextRevealLayout();
    benefitCopy.classList.add('is-visible');
    syncBenefitMore(index);
    benefitButtons.forEach((button, buttonIndex) => {
      const isActive = buttonIndex === index;
      button.classList.toggle('is-active', isActive);
      if (isActive) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
    requestTextReveal();
  };
  const setBenefitCard = (index) => {
    benefitArt.dataset.state = String(index);
    benefitImages.forEach((image, imageIndex) => {
      image.classList.toggle('is-active', imageIndex === index);
    });
  };

  const showBenefit = (index) => {
    if (index === activeBenefit) return;
    activeBenefit = index;
    updateBenefitText(index);
    setBenefitCard(index);
  };

  const updateBenefitFromScroll = () => {
    scrollFrame = 0;
    const sectionTop = benefitsSection.getBoundingClientRect().top + window.scrollY;
    const stageHeight = benefitsStage.offsetHeight || window.innerHeight;
    const stateIndex = clamp(Math.floor((window.scrollY - sectionTop) / stageHeight), 0, benefitStates.length - 1);
    showBenefit(stateIndex);
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
      window.scrollTo({ top: sectionTop + benefitsStage.offsetHeight * index, behavior: 'smooth' });
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
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const targets = [...document.querySelectorAll(textRevealSelector)]
    .filter((element) => !element.closest('.hero, .metrics, .work-card, .news-card'));
  let revealFrame = 0;
  let layoutDirty = true;
  const linesByElement = new Map();
  const clamp = (value) => Math.max(0, Math.min(1, value));
  targets.forEach((element) => {
    element.classList.add('text-reveal');
    prepareTextLines(element);
  });
  const measureLines = (element) => {
    const lines = [];
    element.querySelectorAll('.text-reveal__word').forEach((word) => {
      const y = word.getBoundingClientRect().top;
      let line = lines[lines.length - 1];
      if (!line || Math.abs(line.y - y) > 2) {
        line = { y, length: 0, words: [] };
        lines.push(line);
      }
      const length = Array.from(word.textContent).length;
      line.words.push({ word, start: line.length, length, letters: [...word.querySelectorAll('.benefit-text__letter')] });
      line.length += length + 1;
    });
    lines.forEach((line) => { line.length = Math.max(1, line.length - 1); });
    return lines;
  };
  refreshTextRevealLayout = () => {
    layoutDirty = true;
    requestTextReveal();
  };
  const updateTextReveal = () => {
    revealFrame = 0;
    if (layoutDirty) {
      targets.forEach((element) => linesByElement.set(element, measureLines(element)));
      layoutDirty = false;
    }
    const viewport = window.innerHeight;
    const scroll = window.scrollY;
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - viewport);
    const benefitState = Number(benefitArt?.dataset.state || 0);
    const groups = new Map();
    targets.forEach((element) => {
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      let top = rect.top + scroll;
      const stage = element.closest('.benefits-stage, .work-card');
      if (stage) {
        const section = stage.closest('.benefits, .work');
        const sectionTop = section.getBoundingClientRect().top + scroll;
        const stageTop = stage.matches('.work-card') ? stage.offsetTop : 0;
        top = sectionTop + stageTop + rect.top - stage.getBoundingClientRect().top;
      }
      let start = top - viewport * .9;
      let end = Math.min(top - viewport * .48, maxScroll);
      let group = element.closest('.benefits-stage, .project-cta__copy, .news-intro__copy, .contact-heading, .footer-main > div') || element;
      if (group === benefitsStage && benefitState > 0 && element === benefitsStage.querySelector('h2')) group = element;
      if (!groups.has(group)) groups.set(group, { start, end, elements: [] });
      const sequence = groups.get(group);
      sequence.start = Math.min(sequence.start, start);
      sequence.end = Math.max(sequence.end, end);
      sequence.elements.push(element);
    });
    groups.forEach((sequence, group) => {
      const lines = sequence.elements.flatMap((element) => linesByElement.get(element) || []);
      if (!lines.length) return;
      let start = sequence.start;
      let end = Math.min(maxScroll, Math.max(sequence.end,
        start + (sequence.elements.length > 1 ? viewport * .7 : 0)));
      if (group === benefitsStage) {
        const sectionTop = benefitsSection.getBoundingClientRect().top + scroll;
        start = sectionTop + (benefitState === 0 ? -viewport * .15 : benefitsStage.offsetHeight * benefitState);
        end = start + benefitsStage.offsetHeight * .9;
      } else if (group.matches('.project-cta__copy, .news-intro__copy, .contact-heading')) {
        const sectionTop = group.closest('section').getBoundingClientRect().top + scroll;
        end = Math.min(end, sectionTop - viewport * .2);
      }
      const progress = motionPreference.matches ? 1 : clamp((scroll - start) / Math.max(1, end - start));
      lines.forEach((line, lineIndex) => {
        // A line completes before the next starts, including between a heading and its copy.
        const lineProgress = clamp(progress * lines.length - lineIndex);
        const frontier = lineProgress * (line.length + 8) - 4;
        line.words.forEach(({ word, start, length, letters }) => {
          if (letters.length) {
            letters.forEach((letter, index) => {
              const amount = clamp((frontier - start - index) / 3);
              const ink = `${(amount * amount * (3 - 2 * amount) * 100).toFixed(2)}%`;
              if (letter.style.getPropertyValue('--letter-ink') !== ink) letter.style.setProperty('--letter-ink', ink);
            });
          } else {
            const left = (frontier - start - 4) / length * 100;
            const right = (frontier - start + 4) / length * 100;
            const gradient = `linear-gradient(90deg,var(--text-final-color) ${left.toFixed(2)}%,#777 ${right.toFixed(2)}%)`;
            if (word.style.backgroundImage !== gradient) word.style.backgroundImage = gradient;
          }
        });
      });
    });
  };
  requestTextReveal = () => {
    if (!revealFrame) revealFrame = requestAnimationFrame(updateTextReveal);
  };
  window.addEventListener('scroll', requestTextReveal, { passive: true });
  window.addEventListener('resize', refreshTextRevealLayout, { passive: true });
  motionPreference.addEventListener('change', requestTextReveal);
  document.fonts?.ready.then(refreshTextRevealLayout);
  requestTextReveal();
}
if (hero && heroReveals.length && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
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
    startHeroReveal();
  } else {
    heroBackground.addEventListener('load', startHeroReveal, { once: true });
    heroBackground.addEventListener('error', startHeroReveal, { once: true });
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
contactForm.addEventListener('input', () => {
  contactForm.classList.remove('is-submitted');
  contactForm.querySelector('.form-feedback').textContent = '';
});
contactForm.addEventListener('submit', (event) => {
  event.preventDefault();
  contactForm.classList.add('is-submitted');
  contactForm.querySelector('.form-feedback').textContent = 'Спасибо! Форма готова к подключению к вашей почте или CRM.';
});

// Smooth and slow wheel input across the page. Reduced-motion preferences keep
// the browser's native wheel scrolling behaviour.
{
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const wheelDistanceScale = .65;
  const settlingTime = 210;
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
  const touchScale = .5175;
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
    glideVelocity *= Math.exp(-elapsed / 220);
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
      lastTime: performance.now(), velocity: 0, dragging: false };
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
    if (gesture.dragging && !reducedMotion.matches && performance.now() - gesture.lastTime < 80) {
      glideVelocity = Math.max(-.8, Math.min(.8, gesture.velocity));
      if (Math.abs(glideVelocity) > .025) glideFrame = requestAnimationFrame(glide);
    }
    gesture = null;
  }, { passive: true });
  window.addEventListener('touchcancel', () => { gesture = null; stopGlide(); }, { passive: true });
  window.addEventListener('keydown', stopGlide, { passive: true });
  window.addEventListener('hashchange', stopGlide, { passive: true });
}


