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
  'main h2', 'main h3', '[data-benefit-description]', '[data-benefit-more]',
  '.work-card-mode',
  '.project-cta__copy p', '.project-cta__button span',
  '.news-intro p', '.all-news', '.news-card > span',
  '.contact-heading p', '.contact-form .consent > span', '.contact-form .submit span',
  '.footer-main h3', '.footer-nav a', '.footer-legal a', '.footer-contact-link',
  '.footer-contacts address', '.footer-bottom'
].join(',');

{
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const targets = [...document.querySelectorAll(textRevealSelector)]
    .filter((element) => !element.closest('.hero, .metrics'));
  let revealFrame = 0;
  targets.forEach((element) => {
    element.classList.add('text-reveal');
    prepareTextLines(element);
  });
  const updateTextReveal = () => {
    revealFrame = 0;
    const viewport = window.innerHeight;
    const scroll = window.scrollY;
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - viewport);
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
      const benefitState = Number(benefitArt?.dataset.state || 0);
      if (benefitState > 0 && element.matches('[data-benefit-title], [data-benefit-description], [data-benefit-more]')) {
        start = benefitsSection.getBoundingClientRect().top + scroll + benefitsStage.offsetHeight * benefitState;
        end = start + benefitsStage.offsetHeight * .42;
      }
      const progress = motionPreference.matches ? 1 : Math.max(0, Math.min(1, (scroll - start) / Math.max(1, end - start)));
      const total = Number(element.dataset.revealLength);
      // A soft frontier crosses characters in reading order, including wrapped lines.
      const frontier = progress * (total + 8) - 4;
      element.querySelectorAll('.text-reveal__word').forEach((word) => {
        const length = Number(word.dataset.revealLength);
        const position = Number(word.dataset.revealStart);
        const left = (frontier - position - 4) / length * 100;
        const right = (frontier - position + 4) / length * 100;
        const gradient = `linear-gradient(90deg,var(--text-final-color) ${left.toFixed(2)}%,#777 ${right.toFixed(2)}%)`;
        if (word.style.backgroundImage !== gradient) word.style.backgroundImage = gradient;
      });
    });
  };
  requestTextReveal = () => {
    if (!revealFrame) revealFrame = requestAnimationFrame(updateTextReveal);
  };
  window.addEventListener('scroll', requestTextReveal, { passive: true });
  window.addEventListener('resize', requestTextReveal, { passive: true });
  motionPreference.addEventListener('change', requestTextReveal);
  document.fonts?.ready.then(requestTextReveal);
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

document.querySelector('.contact-form').addEventListener('submit', (event) => {
  event.preventDefault();
  document.querySelector('.form-feedback').textContent = 'Спасибо! Форма готова к подключению к вашей почте или CRM.';
});

const metricsSection = document.querySelector('.metrics');
if (metricsSection && 'IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const masks = [...metricsSection.querySelectorAll('.metrics-stair-mask i')];
  document.documentElement.classList.add('metrics-stair-motion');
  let metricsFrame = 0;

  const updateMetricsReveal = () => {
    metricsFrame = 0;
    masks.forEach((mask) => {
      const maskTop = mask.getBoundingClientRect().top;
      const maskHeight = Math.max(1, mask.getBoundingClientRect().height);
      const stepProgress = Math.max(0, Math.min(1, (window.innerHeight - maskTop) / (maskHeight * 2)));
      mask.style.setProperty('--stair-x', `${stepProgress * 101}%`);
    });
  };

  const requestMetricsRevealUpdate = () => {
    if (!metricsFrame) metricsFrame = window.requestAnimationFrame(updateMetricsReveal);
  };

  window.addEventListener('scroll', requestMetricsRevealUpdate, { passive: true });
  window.addEventListener('resize', requestMetricsRevealUpdate);
  updateMetricsReveal();
}


