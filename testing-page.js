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

// A hard reload of this long sticky page should restart at the cover, while
// browser back/forward navigation keeps its normal scroll restoration.
const testingNavigation = performance.getEntriesByType?.('navigation')?.[0];
if (testingNavigation?.type === 'reload') {
  const supportsScrollRestoration = 'scrollRestoration' in history;
  if (supportsScrollRestoration) history.scrollRestoration = 'manual';
  const resetReloadPosition = () => {
    scrollTo({ top: 0, left: 0, behavior: 'instant' });
    if (supportsScrollRestoration) history.scrollRestoration = 'auto';
  };
  scrollTo({ top: 0, left: 0, behavior: 'instant' });
  addEventListener('pageshow', resetReloadPosition, { once: true });
}

// Keep wheel and touch scrolling as smooth as on the homepage without snapping
// the browser abruptly to section boundaries.
{
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
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
    if (pageMotionPreference.matches || !finePointer.matches || event.ctrlKey || event.metaKey || !event.deltaY ||
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

{
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
  const glide = time => {
    const elapsed = glideTime ? Math.min(32, time - glideTime) : 16.67;
    glideTime = time;
    const before = scrollY;
    scrollTo({ top: before + glideVelocity * elapsed, behavior: 'instant' });
    glideVelocity *= Math.exp(-elapsed / 180);
    if (Math.abs(glideVelocity) < .025 || Math.abs(scrollY - before) < .5) stopGlide();
    else glideFrame = requestAnimationFrame(glide);
  };
  addEventListener('touchstart', event => {
    stopGlide();
    gesture = null;
    const target = event.target instanceof Element ? event.target : null;
    if (event.touches.length !== 1 || document.documentElement.classList.contains('menu-open') ||
        target?.closest('input, textarea, select, video, .menu-drawer, [contenteditable]')) return;
    const touch = event.touches[0];
    gesture = { startX: touch.clientX, startY: touch.clientY, lastY: touch.clientY, lastTime: performance.now(), velocity: 0, dragging: false };
  }, { passive: true });
  addEventListener('touchmove', event => {
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
    scrollTo({ top: scrollY + distance, behavior: 'instant' });
    gesture.velocity = gesture.velocity * .35 + distance / elapsed * .65;
    gesture.lastY = touch.clientY;
    gesture.lastTime = now;
  }, { passive: false });
  addEventListener('touchend', event => {
    if (!gesture || event.touches.length) return;
    if (gesture.dragging && !pageMotionPreference.matches && performance.now() - gesture.lastTime < 80) {
      glideVelocity = Math.max(-.8, Math.min(.8, gesture.velocity));
      if (Math.abs(glideVelocity) > .025) glideFrame = requestAnimationFrame(glide);
    }
    gesture = null;
  }, { passive: true });
  addEventListener('touchcancel', () => { gesture = null; stopGlide(); }, { passive: true });
  addEventListener('keydown', stopGlide, { passive: true });
  addEventListener('hashchange', stopGlide, { passive: true });
}

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
  revealGroup('.testing-stage__button', 125);
  revealGroup('.climate-tests__product-stack, .climate-tests__visuals', 120);
  revealGroup('.climate-tests__pagination span', 100);
  revealGroup('.mechanical-tests__ambient img, .mechanical-tests__shaker img', 100);
  revealGroup('.footer-brand .brand-mark, .footer-brand > span, .footer-nav a, .footer-legal a', 60);
  revealGroup('.footer-contact-link, .footer-social-link', 70);

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

// Scroll-linked text treatment follows the homepage timing. Keep it on section
// headings and plain copy; metric cards, list cards, spec rows, and FAQ dropdowns
// retain their existing text behavior.
if (!pageMotionPreference.matches) {
  const textTargets = [...document.querySelectorAll([
    'main h1', 'main h2', 'main h3',
    '.testing-stage__copy p', '.testing-about__text p',
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
      const start = top - viewport * .9;
      const end = Math.min(top - viewport * .48, maxScroll);
      const groupSelector = '.testing-stage__copy, .testing-about, .climate-tests__inner, .mechanical-tests__inner, .testing-faq__inner, .footer-main > div';
      const group = element.closest(groupSelector) || element;
      const siblings = textTargets.filter(target => (target.closest(groupSelector) || target) === group);
      const groupTop = Math.min(...siblings.map(target => target.getBoundingClientRect().top + scrollY - viewport * .9));
      const groupEnd = Math.max(...siblings.map(target => target.getBoundingClientRect().top + scrollY - viewport * .48));
      const groupStart = groupTop;
      const groupFinish = Math.min(maxScroll, Math.max(groupEnd, groupStart + (siblings.length > 1 ? viewport * .7 : end - start)));
      const progress = clampTextProgress((scroll - groupStart) / Math.max(1, groupFinish - groupStart));
      const groupLines = siblings.flatMap(target => linesByElement.get(target) || []);
      const firstLineIndex = groupLines.indexOf(lines[0]);
      lines.forEach((line, lineIndex) => {
        const lineProgress = clampTextProgress(progress * groupLines.length - firstLineIndex - lineIndex);
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

// Scroll-linked rain is limited to the second section. The shared product stays
// in its sticky visual while the overlays are clipped to its top face.
const rainSection = document.querySelector('.testing-about');
const rainSurface = document.querySelector('[data-rain-surface]');
const rainAmbient = document.querySelector('[data-rain-ambient]');
const rainEquipment = document.querySelector('[data-testing-equipment]');
if (rainSection && rainSurface && rainAmbient && rainEquipment) {
  const surfaceContext = rainSurface.getContext('2d');
  const ambientContext = rainAmbient.getContext('2d');
  const surfaceWidth = rainSurface.width;
  const surfaceHeight = rainSurface.height;
  const surfaceCorners = [[14, 270], [862, 12], [1218, 172], [262, 462]];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rainStreaks = Array.from({ length: 130 }, () => ({
    x: Math.random(), y: Math.random(), length: 7 + Math.random() * 12,
    speed: 0.55 + Math.random() * 0.55, alpha: 0.08 + Math.random() * 0.14
  }));
  let surfaceDrops = [];
  let ambientWidth = 0;
  let ambientHeight = 0;
  let rainDpr = 1;
  let rainFrame = 0;
  let previousRainTime = performance.now();

  const clampRain = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
  const smoothRain = (start, end, value) => {
    const t = clampRain((value - start) / (end - start));
    return t * t * (3 - 2 * t);
  };
  const mixRain = (start, end, amount) => start + (end - start) * amount;

  const resizeRainCanvas = () => {
    const bounds = rainAmbient.getBoundingClientRect();
    rainDpr = Math.min(window.devicePixelRatio || 1, 1.5);
    ambientWidth = Math.max(1, bounds.width);
    ambientHeight = Math.max(1, bounds.height);
    rainAmbient.width = Math.round(ambientWidth * rainDpr);
    rainAmbient.height = Math.round(ambientHeight * rainDpr);
    ambientContext.setTransform(rainDpr, 0, 0, rainDpr, 0, 0);
  };

  const pointOnSurface = () => {
    const across = Math.random();
    const depth = Math.random() * 0.76;
    const leftX = mixRain(surfaceCorners[0][0], surfaceCorners[1][0], across);
    const leftY = mixRain(surfaceCorners[0][1], surfaceCorners[1][1], across);
    const rightX = mixRain(surfaceCorners[3][0], surfaceCorners[2][0], across);
    const rightY = mixRain(surfaceCorners[3][1], surfaceCorners[2][1], across);
    return {
      x: mixRain(leftX, rightX, depth),
      y: mixRain(leftY, rightY, depth)
    };
  };

  const isOnSurface = (x, y) => {
    let inside = false;
    for (let i = 0, j = surfaceCorners.length - 1; i < surfaceCorners.length; j = i++) {
      const [xi, yi] = surfaceCorners[i];
      const [xj, yj] = surfaceCorners[j];
      const crosses = (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (crosses) inside = !inside;
    }
    return inside;
  };

  const makeSurfaceDrop = () => {
    const point = pointOnSurface();
    const surfaceScale = Math.max(0.2, rainSurface.getBoundingClientRect().width / surfaceWidth);
    return {
      x: point.x,
      y: point.y,
      radius: (3.5 + Math.random() * 3.8) / surfaceScale,
      speed: 18 + Math.random() * 34,
      life: 160 + Math.random() * 380,
      pause: 1.2 + Math.random() * 2.4,
      drift: (Math.random() - 0.5) * 0.16,
      pathPhase: Math.random() * Math.PI * 2,
      angle: -0.24 + (Math.random() - 0.5) * 0.18
    };
  };

  const drawSurfaceDrop = drop => {
    const { x, y, radius } = drop;
    surfaceContext.save();
    surfaceContext.translate(x, y);
    surfaceContext.rotate(drop.angle);

    // Defined meniscus, transparent body and compact highlights read as a
    // bead sitting on metal. There is no magnified/blurred image underneath.
    surfaceContext.beginPath();
    surfaceContext.ellipse(0, radius * 0.1, radius * 0.78, radius * 0.9, 0, 0, Math.PI * 2);
    surfaceContext.fillStyle = 'rgba(0,0,0,.34)';
    surfaceContext.fill();

    const body = surfaceContext.createRadialGradient(-radius * 0.27, -radius * 0.38, radius * 0.04, 0, 0, radius * 1.08);
    body.addColorStop(0, 'rgba(255,255,255,.48)');
    body.addColorStop(0.16, 'rgba(245,247,246,.2)');
    body.addColorStop(0.56, 'rgba(204,209,207,.08)');
    body.addColorStop(0.82, 'rgba(255,255,255,.2)');
    body.addColorStop(0.94, 'rgba(238,241,239,.62)');
    body.addColorStop(1, 'rgba(14,16,16,.78)');
    surfaceContext.beginPath();
    surfaceContext.ellipse(0, 0, radius * 0.72, radius, 0, 0, Math.PI * 2);
    surfaceContext.fillStyle = body;
    surfaceContext.fill();

    surfaceContext.lineWidth = Math.max(0.65, radius * 0.085);
    surfaceContext.strokeStyle = 'rgba(12,14,14,.72)';
    surfaceContext.stroke();
    surfaceContext.beginPath();
    surfaceContext.ellipse(-radius * 0.035, -radius * 0.045, radius * 0.65, radius * 0.91, 0, Math.PI * 1.08, Math.PI * 1.82);
    surfaceContext.lineWidth = Math.max(0.5, radius * 0.07);
    surfaceContext.strokeStyle = 'rgba(255,255,255,.58)';
    surfaceContext.stroke();

    surfaceContext.beginPath();
    surfaceContext.ellipse(-radius * 0.25, -radius * 0.38, radius * 0.2, radius * 0.085, -0.38, 0, Math.PI * 2);
    surfaceContext.fillStyle = 'rgba(255,255,255,.94)';
    surfaceContext.fill();
    surfaceContext.beginPath();
    surfaceContext.arc(-radius * 0.39, -radius * 0.49, Math.max(0.45, radius * 0.055), 0, Math.PI * 2);
    surfaceContext.fillStyle = 'rgba(255,255,255,.82)';
    surfaceContext.fill();
    surfaceContext.restore();
  };

  const clearRainCanvases = () => {
    ambientContext.clearRect(0, 0, ambientWidth, ambientHeight);
    surfaceContext.clearRect(0, 0, surfaceWidth, surfaceHeight);
    rainAmbient.style.opacity = '0';
    rainSurface.style.opacity = '0';
    surfaceDrops = [];
    rainEquipment.style.setProperty('--testing-rotate-y', '0deg');
    rainEquipment.style.setProperty('--testing-rotate-x', '0deg');
    rainEquipment.style.setProperty('--testing-rotate-z', '0deg');
  };

  const renderRainFrame = now => {
    rainFrame = 0;
    if (document.hidden) return;

    const rect = rainSection.getBoundingClientRect();
    const inView = rect.bottom > 0 && rect.top < window.innerHeight;
    if (!inView) {
      clearRainCanvases();
      return;
    }

    const sectionProgress = clampRain((window.innerHeight - rect.top) / (window.innerHeight + rect.height));
    const rotationProgress = smoothRain(0.02, 0.9, sectionProgress);
    const motionScale = reducedMotion ? 0.35 : 1;
    rainEquipment.style.setProperty('--testing-rotate-y', `${(28 * rotationProgress * motionScale).toFixed(2)}deg`);
    rainEquipment.style.setProperty('--testing-rotate-x', `${(10 * rotationProgress * motionScale).toFixed(2)}deg`);
    rainEquipment.style.setProperty('--testing-rotate-z', `${(-1.5 * rotationProgress * motionScale).toFixed(2)}deg`);
    const rainIntensity = smoothRain(0.025, 0.2, sectionProgress) * (1 - smoothRain(0.78, 0.96, sectionProgress));
    const wetness = smoothRain(0.035, 0.18, sectionProgress) * (1 - smoothRain(0.9, 0.99, sectionProgress));
    const dt = Math.min(0.05, Math.max(0, (now - previousRainTime) / 1000));
    previousRainTime = now;

    rainAmbient.style.opacity = rainIntensity.toFixed(3);
    rainSurface.style.opacity = wetness.toFixed(3);
    ambientContext.clearRect(0, 0, ambientWidth, ambientHeight);

    if (rainIntensity > 0.005 && ambientWidth && ambientHeight) {
      ambientContext.lineWidth = 0.8;
      ambientContext.lineCap = 'round';
      for (const streak of rainStreaks) {
        if (!reducedMotion) {
          streak.y += streak.speed * dt;
          streak.x += streak.speed * dt * 0.1;
        }
        if (streak.y > 1.08) {
          streak.y = -0.08;
          streak.x = Math.random();
        }
        if (streak.x > 1.08) streak.x = -0.08;
        const x = streak.x * ambientWidth;
        const y = streak.y * ambientHeight;
        ambientContext.strokeStyle = `rgba(220,224,222,${(streak.alpha * rainIntensity).toFixed(3)})`;
        ambientContext.beginPath();
        ambientContext.moveTo(x, y);
        ambientContext.lineTo(x + streak.length * 0.12, y + streak.length);
        ambientContext.stroke();
      }
    }

    if (wetness > 0.005) {
      surfaceContext.clearRect(0, 0, surfaceWidth, surfaceHeight);
      surfaceContext.save();
      surfaceContext.beginPath();
      surfaceCorners.forEach(([x, y], index) => index ? surfaceContext.lineTo(x, y) : surfaceContext.moveTo(x, y));
      surfaceContext.closePath();
      surfaceContext.clip();

      const desiredDrops = Math.min(38, Math.round(38 * wetness));
      const initialDrops = Math.min(desiredDrops, Math.ceil(desiredDrops * 0.2));
      while (surfaceDrops.length < initialDrops) surfaceDrops.push(makeSurfaceDrop());
      if (surfaceDrops.length < desiredDrops && !reducedMotion && Math.random() < dt * 18) {
        surfaceDrops.push(makeSurfaceDrop());
      }
      while (reducedMotion && surfaceDrops.length < desiredDrops) surfaceDrops.push(makeSurfaceDrop());

      for (const drop of surfaceDrops) {
        if (!reducedMotion && drop.pause > 0) drop.pause -= dt;
        else if (!reducedMotion) {
          const dy = drop.speed * dt;
          const dx = dy * (1.42 + drop.drift + Math.sin(drop.pathPhase) * 0.1);
          drop.x += dx;
          drop.y += dy;
          drop.life -= dy;
          drop.pathPhase += dt * 3.4;
          if (Math.random() < 0.01) drop.pause = 0.12 + Math.random() * 0.36;
        }
        drawSurfaceDrop(drop);
      }
      surfaceContext.restore();
      surfaceDrops = surfaceDrops.filter(drop => drop.life > 0 && isOnSurface(drop.x, drop.y));
    } else {
      surfaceContext.clearRect(0, 0, surfaceWidth, surfaceHeight);
      surfaceDrops = [];
    }

    if (inView || rainIntensity > 0.005 || wetness > 0.005 || surfaceDrops.length) {
      rainFrame = requestAnimationFrame(renderRainFrame);
    }
  };

  const scheduleRainFrame = () => {
    if (!rainFrame) rainFrame = requestAnimationFrame(renderRainFrame);
  };
  resizeRainCanvas();
  addEventListener('scroll', scheduleRainFrame, { passive: true });
  addEventListener('resize', () => { resizeRainCanvas(); scheduleRainFrame(); }, { passive: true });
  document.addEventListener('visibilitychange', scheduleRainFrame);
  if ('ResizeObserver' in window) new ResizeObserver(() => { resizeRainCanvas(); scheduleRainFrame(); }).observe(rainAmbient);
  scheduleRainFrame();
}

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
    const trackBounds = track.getBoundingClientRect();
    const stickyTravel = Math.max(1, track.offsetHeight - stage.offsetHeight);
    const progress = clamp(-trackBounds.top / stickyTravel);
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
