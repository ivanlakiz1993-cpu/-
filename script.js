const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#site-nav');

const hero = document.querySelector('.hero');
const heroReveal = document.querySelector('.hero-reveal');
const benefitsSection = document.querySelector('.benefits');
const benefitsStage = document.querySelector('.benefits-stage');
const benefitTitle = document.querySelector('[data-benefit-title]');
const benefitDescription = document.querySelector('[data-benefit-description]');
const benefitCopy = document.querySelector('[data-benefit-copy]');
const benefitArt = document.querySelector('[data-benefit-art]');
const benefitMore = document.querySelector('[data-benefit-more]');
const benefitImages = [...document.querySelectorAll('.benefit-image')];
const benefitButtons = [...document.querySelectorAll('[data-benefit-index]')];
document.querySelectorAll('.work-card[data-default-state]').forEach((card) => {
  const images = [...card.querySelectorAll('[data-card-background]')];
  const modes = [...card.querySelectorAll('[data-card-mode]')];
  const setState = (state) => {
    images.forEach((image) => image.classList.toggle('is-active', image.dataset.cardBackground === state));
  };
  const restoreState = () => {
    const focusedMode = modes.find((mode) => mode === document.activeElement);
    const hoveredMode = modes.find((mode) => mode.matches(':hover'));
    setState(focusedMode?.dataset.cardMode || hoveredMode?.dataset.cardMode || card.dataset.defaultState);
  };

  modes.forEach((button) => {
    button.addEventListener('pointerenter', () => setState(button.dataset.cardMode));
    button.addEventListener('focus', () => setState(button.dataset.cardMode));
    button.addEventListener('pointerleave', (event) => {
      const nextMode = event.relatedTarget?.closest?.('[data-card-mode]');
      if (nextMode && card.contains(nextMode)) setState(nextMode.dataset.cardMode);
      else restoreState();
    });
    button.addEventListener('blur', restoreState);
  });
});

const workStack = document.querySelector('.work');
const workCards = workStack ? [...workStack.querySelectorAll('.work-card')] : [];
if (workStack && workCards.length > 1) {
  let wheelPauseActive = false;
  let wheelPauseDistance = 0;
  let wheelPausePassed = false;

  const getThirdCardPinPoint = () => {
    const workTop = workStack.getBoundingClientRect().top + window.scrollY;
    const styles = window.getComputedStyle(workStack);
    const topPadding = Number.parseFloat(styles.paddingTop) || 0;
    const gap = Number.parseFloat(styles.rowGap) || 0;
    const pinOffset = Number.parseFloat(window.getComputedStyle(workCards.at(-1)).top) || 0;
    const precedingCardsHeight = workCards.slice(0, -1).reduce((height, card) => height + card.offsetHeight, 0);
    return workTop + topPadding + precedingCardsHeight + gap * (workCards.length - 1) - pinOffset;
  };

  const scrollToPinPoint = (point) => {
    const root = document.documentElement;
    const previousBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    window.scrollTo(0, point);
    root.style.scrollBehavior = previousBehavior;
  };

  window.addEventListener('wheel', (event) => {
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1);
    if (delta < 0) {
      if (wheelPauseActive) {
        wheelPauseActive = false;
        wheelPauseDistance = 0;
        wheelPausePassed = false;
      } else if (wheelPausePassed && window.scrollY < getThirdCardPinPoint()) {
        wheelPausePassed = false;
      }
      return;
    }
    if (delta <= 0) return;

    const pinPoint = getThirdCardPinPoint();
    if (wheelPauseActive) {
      const pauseThreshold = Math.min(800, Math.max(560, window.innerHeight * 0.75));
      if (wheelPauseDistance + delta < pauseThreshold) {
        event.preventDefault();
        wheelPauseDistance += delta;
        return;
      }
      wheelPauseActive = false;
      wheelPausePassed = true;
      wheelPauseDistance = 0;
      return;
    }

    if (!wheelPausePassed && window.scrollY + delta >= pinPoint && window.scrollY <= pinPoint + 1) {
      event.preventDefault();
      wheelPauseActive = true;
      wheelPauseDistance = 0;
      scrollToPinPoint(pinPoint);
    }
  }, { passive: false });
}

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
  let copyFrame = 0;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const updateBenefitText = (index) => {
    const state = benefitStates[index];
    window.cancelAnimationFrame(copyFrame);
    benefitCopy.classList.remove('is-visible');
    benefitMore.classList.remove('is-visible');
    void benefitCopy.offsetWidth;
    benefitTitle.textContent = state.title;
    benefitDescription.textContent = state.description;
    benefitCopy.dataset.state = String(index);
    benefitMore.hidden = index !== 2;
    benefitButtons.forEach((button, buttonIndex) => {
      const isActive = buttonIndex === index;
      button.classList.toggle('is-active', isActive);
      if (isActive) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
    copyFrame = window.requestAnimationFrame(() => {
      benefitCopy.classList.add('is-visible');
      if (index === 2) benefitMore.classList.add('is-visible');
    });
  };

  const setBenefitCard = (index) => {
    const imageClass = ['benefit-image--guarantee', 'benefit-image--quality', 'benefit-image--production'][index];
    benefitArt.dataset.state = String(index);
    benefitImages.forEach((image) => image.classList.toggle('is-active', image.classList.contains(imageClass)));
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

  window.addEventListener('scroll', requestBenefitUpdate, { passive: true });
  window.addEventListener('resize', requestBenefitUpdate, { passive: true });
  benefitButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const index = Number(button.dataset.benefitIndex);
      const sectionTop = benefitsSection.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: sectionTop + benefitsStage.offsetHeight * index, behavior: 'smooth' });
    });
  });
  updateBenefitFromScroll();
}
if (hero && heroReveal && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const columns = 16;
  const rows = 9;
  const centerRow = (rows - 1) / 2;
  const centerColumn = (columns - 1) / 2;
  const maxDistance = Math.hypot(centerRow, centerColumn);
  const tileEntries = [];
  const tiles = document.createDocumentFragment();

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const tile = document.createElement('span');
      tile.className = 'hero-reveal__tile';
      tiles.append(tile);
      tileEntries.push({ tile, row, column });
    }
  }

  heroReveal.append(tiles);

  const startHeroReveal = () => {
    window.setTimeout(() => {
      requestAnimationFrame(() => {
        tileEntries.forEach(({ tile, row, column }) => {
          const distance = Math.hypot(row - centerRow, column - centerColumn) / maxDistance;
          const randomOffset = Math.random() * 0.35;
          const delay = distance * 480 + randomOffset * 500;
          tile.style.setProperty('--tile-delay', `${delay}ms`);
          tile.classList.add('is-revealed');
        });
      });
      window.setTimeout(() => heroReveal.remove(), 1900);
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

menuButton.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') !== 'true';
  menuButton.setAttribute('aria-expanded', String(open));
  navigation.classList.toggle('open', open);
});

navigation.addEventListener('click', (event) => {
  if (event.target.closest('a')) {
    navigation.classList.remove('open');
    menuButton.setAttribute('aria-expanded', 'false');
  }
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


