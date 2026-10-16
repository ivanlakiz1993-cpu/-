const menuButton = document.querySelector('.menu-toggle');
const menuDrawer = document.querySelector('.menu-drawer');
const navigation = document.querySelector('#site-nav');
const setMenuOpen = open => {
  if (!menuButton || !menuDrawer) return;
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
  menuDrawer.classList.toggle('is-open', open);
  document.documentElement.classList.toggle('menu-open', open);
  document.body.classList.toggle('menu-open', open);
};
menuButton?.addEventListener('click', () => setMenuOpen(menuButton.getAttribute('aria-expanded') !== 'true'));
navigation?.addEventListener('click', event => { if (event.target.closest('a')) setMenuOpen(false); });
menuDrawer?.addEventListener('click', event => { if (menuButton?.getAttribute('aria-expanded') === 'true' && event.target === menuDrawer) setMenuOpen(false); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && menuButton?.getAttribute('aria-expanded') === 'true') { setMenuOpen(false); menuButton.focus(); } });
document.addEventListener('pointerdown', event => { if (menuButton?.getAttribute('aria-expanded') === 'true' && !menuDrawer?.contains(event.target)) setMenuOpen(false); });

const pageMotionPreference = matchMedia('(prefers-reduced-motion: reduce)');
const syncScrollPauses = () => document.documentElement.classList.toggle('testing-scroll-pauses', !pageMotionPreference.matches);
syncScrollPauses();
pageMotionPreference.addEventListener('change', syncScrollPauses);
if (!pageMotionPreference.matches && 'IntersectionObserver' in window) {
  const reveal = (elements, stagger = 0) => elements.forEach((element, index) => {
    if (!element || element.hasAttribute('data-scroll-reveal')) return;
    // The shared page-entry mask already reveals the first screen.
    if (window.siteMosaicIncoming && element.closest('.topbar, .menu-drawer, .testing-stage')) return;
    element.setAttribute('data-scroll-reveal', '');
    element.style.setProperty('--reveal-delay', `${Math.min(index * stagger, 420)}ms`);
  });
  const revealGroup = (selector, stagger = 0) => reveal([...document.querySelectorAll(selector)], stagger);
  revealGroup('.topbar .brand-mark, .topbar .brand > span, .menu-toggle > span, .menu-toggle .menu-icon > i', 75);
  revealGroup('.nav .menu-nav-links a, .nav .menu-social__link, .testing-stage__breadcrumb > *', 55);
  revealGroup('.testing-stage__copy h1, .testing-stage__copy p, .testing-stage__button', 125);
  revealGroup('.testing-about h2', 80);
  revealGroup('.testing-about__text > *', 110);
  revealGroup('.testing-about__metric', 100);
  revealGroup('.testing-about__number, .testing-about__label', 65);

  revealGroup('.climate-tests h2', 80);
  revealGroup('.climate-tests__product-stack, .climate-tests__visuals', 120);
  revealGroup('.climate-tests__list li', 72);
  revealGroup('.climate-tests__equipment h3, .climate-tests__equipment dl > div', 65);
  revealGroup('.climate-tests__pagination span', 100);

  revealGroup('.mechanical-tests h2', 80);
  revealGroup('.mechanical-tests__list li', 60);
  revealGroup('.mechanical-tests__ambient img, .mechanical-tests__shaker img', 100);
  revealGroup('.mechanical-tests__equipment h3, .mechanical-tests__group h4, .mechanical-tests__group dl > div', 65);

  revealGroup('.testing-faq h2', 80);
  revealGroup('.testing-faq__item', 95);
  revealGroup('.footer-brand .brand-mark, .footer-brand > span, .footer-nav a, .footer-legal a', 60);
  revealGroup('.footer-contact-link, .footer-contacts address, .footer-social h3, .footer-social-link, .footer-bottom', 70);

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
    if (!document.querySelector('.testing-stage__copy h1.is-visible')) {
      document.documentElement.classList.remove('testing-motion-ready');
    }
  }, 1800);
}

// Reveal copy line by line as it enters the viewport, matching the homepage's
// scroll-linked text treatment instead of relying only on one-time fade-ins.
if (!pageMotionPreference.matches) {
  const textTargets = [...document.querySelectorAll([
    '.testing-stage__copy h1', '.testing-stage__copy p',
    '.testing-about h2', '.testing-about__text p', '.testing-about__label',
    '.climate-tests h2', '.climate-tests__list li', '.climate-tests__equipment h3',
    '.climate-tests__equipment dt', '.climate-tests__equipment dd',
    '.mechanical-tests h2', '.mechanical-tests__list li', '.mechanical-tests__equipment h3',
    '.mechanical-tests__group h4', '.mechanical-tests__group dt', '.mechanical-tests__group dd',
    '.testing-faq h2', '.testing-faq__item summary span:first-child', '.testing-faq__answer p',
    '.testing-page>.footer h2', '.testing-page>.footer h3', '.testing-page>.footer p',
    '.testing-page>.footer address', '.testing-page>.footer .footer-bottom'
  ].join(','))];
  const linesByElement = new Map();
  let textFrame = 0;
  let textLayoutDirty = true;
  const clampTextProgress = value => Math.max(0, Math.min(1, value));

  const wrapTextWords = element => {
    if (element.querySelector('.text-reveal__word')) return;
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      if (!node.textContent.trim()) return;
      const fragment = document.createDocumentFragment();
      node.textContent.split(/(\s+)/u).forEach(part => {
        if (!part) return;
        if (/^\s+$/u.test(part)) {
          fragment.append(document.createTextNode(part));
          return;
        }
        const word = document.createElement('span');
        word.className = 'text-reveal__word';
        word.textContent = part;
        fragment.append(word);
      });
      node.replaceWith(fragment);
    });
    element.classList.add('text-reveal');
    element.style.setProperty('--text-final-color', getComputedStyle(element).color);
  };

  const measureTextLines = element => {
    const lines = [];
    element.querySelectorAll('.text-reveal__word').forEach(word => {
      const y = word.getBoundingClientRect().top;
      let line = lines[lines.length - 1];
      if (!line || Math.abs(line.y - y) > 2) {
        line = { y, length: 0, words: [] };
        lines.push(line);
      }
      const length = Array.from(word.textContent).length;
      line.words.push({ word, start: line.length, length });
      line.length += length + 1;
    });
    lines.forEach(line => { line.length = Math.max(1, line.length - 1); });
    return lines;
  };

  const requestTextFrame = () => {
    if (!textFrame) textFrame = requestAnimationFrame(updateTextReveal);
  };
  const updateTextReveal = () => {
    textFrame = 0;
    if (textLayoutDirty) {
      textTargets.forEach(element => linesByElement.set(element, measureTextLines(element)));
      textLayoutDirty = false;
    }
    const viewport = innerHeight;
    const scroll = scrollY;
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - viewport);
    textTargets.forEach(element => {
      const rect = element.getBoundingClientRect();
      const lines = linesByElement.get(element) || [];
      if (!rect.width || !rect.height || !lines.length) return;
      const top = rect.top + scroll;
      const start = top - viewport * .92;
      const end = Math.min(maxScroll, top - viewport * .42);
      const progress = clampTextProgress((scroll - start) / Math.max(1, end - start));
      lines.forEach((line, lineIndex) => {
        const lineProgress = clampTextProgress(progress * lines.length - lineIndex);
        const frontier = lineProgress * (line.length + 8) - 4;
        line.words.forEach(({ word, start: wordStart, length }) => {
          const left = (frontier - wordStart - 4) / length * 100;
          const right = (frontier - wordStart + 4) / length * 100;
          const color = getComputedStyle(element).getPropertyValue('--text-final-color').trim() || '#fff';
          const gradient = `linear-gradient(90deg,${color} ${left.toFixed(2)}%,#777 ${right.toFixed(2)}%)`;
          if (word.style.backgroundImage !== gradient) word.style.backgroundImage = gradient;
        });
      });
    });
  };

  textTargets.forEach(element => {
    wrapTextWords(element);
    const observer = new MutationObserver(() => {
      if (!element.querySelector('.text-reveal__word')) wrapTextWords(element);
      textLayoutDirty = true;
      requestTextFrame();
    });
    observer.observe(element, { childList: true, characterData: true, subtree: true });
  });
  if ('ResizeObserver' in window) {
    const textResizeObserver = new ResizeObserver(() => {
      textLayoutDirty = true;
      requestTextFrame();
    });
    textTargets.forEach(element => textResizeObserver.observe(element));
  }
  addEventListener('scroll', requestTextFrame, { passive: true });
  addEventListener('resize', () => { textLayoutDirty = true; requestTextFrame(); }, { passive: true });
  document.addEventListener('toggle', event => {
    if (event.target.matches('.testing-faq__item')) {
      textLayoutDirty = true;
      requestTextFrame();
    }
  }, true);
  document.fonts?.ready.then(() => { textLayoutDirty = true; requestTextFrame(); });
  requestTextFrame();
}

document.querySelectorAll('.testing-stage__button').forEach(button => {
  button.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch') return;
    const bounds = button.getBoundingClientRect();
    button.style.setProperty('--cursor-x', `${((event.clientX - bounds.left) / bounds.width) * 100}%`);
    button.style.setProperty('--cursor-y', `${((event.clientY - bounds.top) / bounds.height) * 100}%`);
  });
});

const climateCarousel = document.querySelector('[data-climate-carousel]');
if (climateCarousel) {
  const track = climateCarousel.querySelector('[data-climate-track]');
  const stage = climateCarousel.querySelector('[data-climate-stage]');
  const products = [...climateCarousel.querySelectorAll('[data-climate-product]')];
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
  let active = -1;
  let climateFrame = 0;
  const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

  const showClimateState = (index) => {
    if (index === active) return;
    active = index;
    products.forEach((image, imageIndex) => image.classList.toggle('is-active', imageIndex === index));
    cameras.forEach((image, imageIndex) => image.classList.toggle('is-active', imageIndex === index));
    pages.forEach((page, pageIndex) => page.classList.toggle('is-active', pageIndex === index));
    const spec = cameraSpecs[index];
    if (title) title.textContent = spec.title;
    if (highTemperature) highTemperature.textContent = spec.highTemperature;
    if (lowTemperature) lowTemperature.textContent = spec.lowTemperature;
    if (humidityRow) humidityRow.hidden = !spec.humidity;
  };

  const updateClimateState = () => {
    climateFrame = 0;
    if (!track || !stage || products.length < 2 || cameras.length < 2) return;
    const bounds = stage.getBoundingClientRect();
    const progress = clamp((innerHeight - bounds.top) / (bounds.height + innerHeight));
    showClimateState(progress >= 0.5 ? 1 : 0);
  };

  const scheduleClimateUpdate = () => {
    if (!climateFrame) climateFrame = requestAnimationFrame(updateClimateState);
  };
  const climateObserver = new ResizeObserver(scheduleClimateUpdate);
  climateObserver.observe(track);
  climateObserver.observe(stage);
  addEventListener('scroll', scheduleClimateUpdate, { passive: true });
  addEventListener('resize', scheduleClimateUpdate, { passive: true });
  scheduleClimateUpdate();
}
