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
  revealGroup('.climate-tests__visuals', 120);
  revealGroup('.climate-tests__pagination button', 100);
  revealGroup('.mechanical-tests__shaker img', 100);
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

// The same product visual runs from the lab introduction through climate and
// mechanical tests; rain and surface water give way to frost on this device.
const testingJourney = document.querySelector('[data-testing-journey]');
const rainSection = document.querySelector('.testing-about');
const climateSection = document.querySelector('.climate-tests');
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
  const frost = window.createTestingFrost?.({
    canvas: document.querySelector('[data-frost-surface]'),
    baseImage: rainEquipment.querySelector('.testing-stage__image'),
    textureSrc: 'assets/equipment-frost.png'
  });
  let frostProgress = 0;
  const rainStreaks = Array.from({ length: 165 }, () => ({
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

  // Reconstruct two orthogonal lid tangents from its photographed edges.
  // Keeping their depth components lets gravity respond to the same rotation
  // that is applied to the product, instead of prescribing a fixed diagonal.
  const unitEdge = (x, y) => {
    const length = Math.hypot(x, y);
    return { x: x / length, y: y / length };
  };
  const [lidBackLeft, lidBackRight, lidFrontRight, lidFrontLeft] = surfaceCorners;
  const lidLongEdge = unitEdge(
    lidBackRight[0] - lidBackLeft[0] + lidFrontRight[0] - lidFrontLeft[0],
    lidBackRight[1] - lidBackLeft[1] + lidFrontRight[1] - lidFrontLeft[1]
  );
  const lidDepthEdge = unitEdge(
    lidFrontLeft[0] - lidBackLeft[0] + lidFrontRight[0] - lidBackRight[0],
    lidFrontLeft[1] - lidBackLeft[1] + lidFrontRight[1] - lidBackRight[1]
  );
  const projectedDepth = 0.55;
  const edgeDot = lidLongEdge.x * lidDepthEdge.x + lidLongEdge.y * lidDepthEdge.y;
  const projectedLength = Math.sqrt((1 - projectedDepth ** 2) /
    (1 - projectedDepth ** 2 + projectedDepth ** 2 * edgeDot ** 2));
  const lidU = {
    x: lidLongEdge.x * projectedLength,
    y: lidLongEdge.y * projectedLength,
    z: Math.sqrt(1 - projectedLength ** 2)
  };
  const lidV = {
    x: lidDepthEdge.x * projectedDepth,
    y: lidDepthEdge.y * projectedDepth,
    z: -Math.sqrt(1 - projectedDepth ** 2)
  };

  const surfaceGravity = (rotationX, rotationY, rotationZ) => {
    const rx = rotationX * Math.PI / 180;
    const ry = rotationY * Math.PI / 180;
    const rz = rotationZ * Math.PI / 180;
    const rotate = vector => {
      // CSS rotateY(...) rotateX(...) rotateZ(...): Z is applied first.
      const x = vector.x * Math.cos(rz) - vector.y * Math.sin(rz);
      const y = vector.x * Math.sin(rz) + vector.y * Math.cos(rz);
      const tiltedY = y * Math.cos(rx) - vector.z * Math.sin(rx);
      const tiltedZ = y * Math.sin(rx) + vector.z * Math.cos(rx);
      return {
        x: x * Math.cos(ry) + tiltedZ * Math.sin(ry),
        y: tiltedY,
        z: -x * Math.sin(ry) + tiltedZ * Math.cos(ry)
      };
    };
    // Gravity points down the screen. Its dot products with the rotated
    // tangents give the downhill components in the product's own coordinates.
    const along = rotate(lidU).y;
    const across = rotate(lidV).y;
    return {
      x: along * lidU.x + across * lidV.x,
      y: along * lidU.y + across * lidV.y
    };
  };

  const resizeRainCanvas = () => {
    const bounds = rainAmbient.getBoundingClientRect();
    rainDpr = Math.min(window.devicePixelRatio || 1, 1.5);
    ambientWidth = Math.max(1, bounds.width);
    ambientHeight = Math.max(1, bounds.height);
    rainAmbient.width = Math.round(ambientWidth * rainDpr);
    rainAmbient.height = Math.round(ambientHeight * rainDpr);
    ambientContext.setTransform(rainDpr, 0, 0, rainDpr, 0, 0);
  };

  const pointOnSurface = (corners = surfaceCorners, maxDepth = 0.76) => {
    const across = Math.random();
    const depth = Math.random() * maxDepth;
    const leftX = mixRain(corners[0][0], corners[1][0], across);
    const leftY = mixRain(corners[0][1], corners[1][1], across);
    const rightX = mixRain(corners[3][0], corners[2][0], across);
    const rightY = mixRain(corners[3][1], corners[2][1], across);
    return {
      x: mixRain(leftX, rightX, depth),
      y: mixRain(leftY, rightY, depth)
    };
  };

  const isOnPolygon = (x, y, corners) => {
    let inside = false;
    for (let i = 0, j = corners.length - 1; i < corners.length; j = i++) {
      const [xi, yi] = corners[i];
      const [xj, yj] = corners[j];
      const crosses = (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (crosses) inside = !inside;
    }
    return inside;
  };
  const isOnSurface = (x, y) => isOnPolygon(x, y, surfaceCorners);

  const makeSurfaceDrop = () => {
    const point = pointOnSurface();
    const surfaceScale = Math.max(0.2, rainSurface.getBoundingClientRect().width / surfaceWidth);
    const size = 1.8 + Math.pow(Math.random(), 2.1) * 7.2;
    return {
      x: point.x,
      y: point.y,
      radius: size / surfaceScale,
      maxRadius: 13 / surfaceScale,
      speed: 5 + size * 2.1,
      vx: 0,
      vy: 0,
      life: 160 + Math.random() * 380,
      age: reducedMotion ? 5 : 0,
      pause: 2 + Math.random() * 4 + Math.max(0, 5 - size),
      drift: (Math.random() - 0.5) * 0.16,
      pathPhase: Math.random() * Math.PI * 2,
      shape: 0.88 + Math.random() * 0.24,
      angle: -0.29 + (Math.random() - 0.5) * 0.05
    };
  };

  const drawSurfaceDrop = drop => {
    const { x, y } = drop;
    const radius = drop.radius * (0.4 + smoothRain(0, 1.2, drop.age) * 0.6);
    surfaceContext.save();
    surfaceContext.translate(x, y);
    surfaceContext.rotate(drop.angle);
    // Project the contact patch onto the lid. A dark, filled asymmetric body
    // and two short reflections replace the upright, luminous bubble outline.
    surfaceContext.scale(radius * drop.shape, radius * 0.46);
    const localVx = (drop.vx * Math.cos(drop.angle) + drop.vy * Math.sin(drop.angle)) / drop.shape;
    const localVy = (-drop.vx * Math.sin(drop.angle) + drop.vy * Math.cos(drop.angle)) / 0.46;
    const localSpeed = Math.hypot(localVx, localVy);
    const stretch = Math.min(0.85, localSpeed / 70);
    const flowX = localSpeed > 0.001 ? localVx / localSpeed : 0;
    const flowY = localSpeed > 0.001 ? localVy / localSpeed : 0;
    const deformPoint = (px, py) => {
      if (stretch < 0.001) return [px, py];
      const along = px * flowX + py * flowY;
      const across = -px * flowY + py * flowX;
      const rear = clampRain(-along);
      const leading = clampRain((along + 1) / 2);
      // The rounded head advances, while the pinned rear narrows and lags.
      // This deforms the water itself; it does not paint a trail on the metal.
      const shifted = along + stretch * (0.18 + leading * 0.34 - rear * 0.55);
      const narrowed = across * (1 - stretch * rear * 0.35);
      return [flowX * shifted - flowY * narrowed, flowY * shifted + flowX * narrowed];
    };
    const moveTo = (px, py) => surfaceContext.moveTo(...deformPoint(px, py));
    const curveTo = (ax, ay, bx, by, cx, cy) => surfaceContext.bezierCurveTo(
      ...deformPoint(ax, ay), ...deformPoint(bx, by), ...deformPoint(cx, cy)
    );
    const outline = () => {
      surfaceContext.beginPath();
      moveTo(-1, -0.04);
      curveTo(-1.05, -0.62, -0.48, -1.04, 0.08, -0.94);
      curveTo(0.7, -1, 1.08, -0.4, 1.02, 0.13);
      curveTo(1.01, 0.71, 0.39, 1.01, -0.14, 0.89);
      curveTo(-0.72, 0.94, -1.06, 0.48, -1, -0.04);
      surfaceContext.closePath();
    };
    surfaceContext.save();
    surfaceContext.translate(0.04, 0.19);
    outline();
    surfaceContext.fillStyle = 'rgba(0,0,0,.48)';
    surfaceContext.fill();
    surfaceContext.restore();

    const body = surfaceContext.createLinearGradient(-0.2, -1, 0.2, 1);
    body.addColorStop(0, 'rgba(4,6,5,.72)');
    body.addColorStop(0.28, 'rgba(15,19,17,.38)');
    body.addColorStop(0.63, 'rgba(38,43,40,.2)');
    body.addColorStop(0.88, 'rgba(111,119,114,.3)');
    body.addColorStop(1, 'rgba(8,11,9,.65)');
    outline();
    surfaceContext.fillStyle = body;
    surfaceContext.fill();

    // A reflection has a finite footprint, rather than circling the whole bead.
    surfaceContext.beginPath();
    moveTo(-0.71, -0.33);
    curveTo(-0.51, -0.73, -0.08, -0.79, 0.27, -0.57);
    curveTo(-0.07, -0.6, -0.42, -0.39, -0.71, -0.33);
    surfaceContext.fillStyle = 'rgba(235,239,236,.55)';
    surfaceContext.fill();
    surfaceContext.beginPath();
    const [glintX, glintY] = deformPoint(-0.47, -0.54);
    surfaceContext.ellipse(glintX, glintY, 0.16, 0.1, -0.15, 0, Math.PI * 2);
    surfaceContext.fillStyle = 'rgba(255,255,255,.86)';
    surfaceContext.fill();
    surfaceContext.beginPath();
    moveTo(0.36, 0.76);
    curveTo(0.64, 0.7, 0.79, 0.56, 0.88, 0.35);
    surfaceContext.lineWidth = Math.min(0.18, 0.75 / radius);
    surfaceContext.strokeStyle = 'rgba(232,237,232,.45)';
    surfaceContext.stroke();
    surfaceContext.restore();
  };

  const mergeSurfaceDrops = () => {
    for (let i = 0; i < surfaceDrops.length; i++) {
      const first = surfaceDrops[i];
      if (first.life <= 0) continue;
      for (let j = i + 1; j < surfaceDrops.length; j++) {
        const second = surfaceDrops[j];
        if (second.life <= 0) continue;
        const dx = second.x - first.x;
        const dy = second.y - first.y;
        const along = dx * Math.cos(first.angle) + dy * Math.sin(first.angle);
        const across = (-dx * Math.sin(first.angle) + dy * Math.cos(first.angle)) / 0.46;
        if (Math.hypot(along, across) > (first.radius + second.radius) * 0.64) continue;
        const firstArea = first.radius ** 2;
        const secondArea = second.radius ** 2;
        const area = firstArea + secondArea;
        first.x = (first.x * firstArea + second.x * secondArea) / area;
        first.y = (first.y * firstArea + second.y * secondArea) / area;
        first.vx = (first.vx * firstArea + second.vx * secondArea) / area;
        first.vy = (first.vy * firstArea + second.vy * secondArea) / area;
        first.radius = Math.min(first.maxRadius, Math.sqrt(area));
        first.age = Math.max(first.age, second.age);
        first.pause = Math.min(first.pause, 0.65);
        first.speed = Math.min(44, Math.max(first.speed, second.speed) * 1.12);
        second.life = 0;
      }
    }
    surfaceDrops = surfaceDrops.filter(drop => drop.life > 0);
  };

  const clearRainCanvases = () => {
    ambientContext.clearRect(0, 0, ambientWidth, ambientHeight);
    surfaceContext.clearRect(0, 0, surfaceWidth, surfaceHeight);
    rainAmbient.style.opacity = '0';
    rainSurface.style.opacity = '0';
    frost?.clear();
    frostProgress = 0;
    surfaceDrops = [];
    rainEquipment.style.setProperty('--testing-rotate-y', '0deg');
    rainEquipment.style.setProperty('--testing-rotate-x', '0deg');
    rainEquipment.style.setProperty('--testing-rotate-z', '0deg');
  };

  const renderRainFrame = now => {
    rainFrame = 0;
    if (document.hidden) return;

    const journeyBounds = testingJourney.getBoundingClientRect();
    const journeyInView = journeyBounds.bottom > 0 && journeyBounds.top < window.innerHeight;
    if (!journeyInView) {
      clearRainCanvases();
      return;
    }

    const rect = rainSection.getBoundingClientRect();
    const sectionProgress = clampRain((window.innerHeight - rect.top) / (window.innerHeight + rect.height));
    const rotationProgress = smoothRain(0.02, 0.9, sectionProgress);
    const climateBounds = climateSection.getBoundingClientRect();
    // Crystallisation belongs to the handover between sections, independent
    // of the camera carousel's height or selected equipment.
    const climateProgress = clampRain((window.innerHeight * 0.72 - climateBounds.top) /
      (window.innerHeight * 0.92));
    const targetFrost = smoothRain(0, 1, climateProgress);
    const dt = Math.min(0.05, Math.max(0, (now - previousRainTime) / 1000));
    previousRainTime = now;
    frostProgress = reducedMotion ? targetFrost :
      frostProgress + (targetFrost - frostProgress) * (1 - Math.exp(-dt * 12));
    if (Math.abs(targetFrost - frostProgress) < 0.0005) frostProgress = targetFrost;
    const motionScale = reducedMotion ? 0.35 : 1;
    const rotationY = 28 * rotationProgress * motionScale;
    const rotationX = 10 * rotationProgress * motionScale;
    const rotationZ = -1.5 * rotationProgress * motionScale;
    rainEquipment.style.setProperty('--testing-rotate-y', `${rotationY.toFixed(2)}deg`);
    rainEquipment.style.setProperty('--testing-rotate-x', `${rotationX.toFixed(2)}deg`);
    rainEquipment.style.setProperty('--testing-rotate-z', `${rotationZ.toFixed(2)}deg`);
    const gravity = surfaceGravity(rotationX, rotationY, rotationZ);
    const rainIntensity = smoothRain(0.025, 0.2, sectionProgress) *
      (1 - smoothRain(0.78, 0.96, sectionProgress)) * (1 - smoothRain(0.02, 0.28, frostProgress));
    const wetness = smoothRain(0.035, 0.18, sectionProgress) *
      (1 - smoothRain(0.76, 0.93, sectionProgress)) * (1 - smoothRain(0.05, 0.4, frostProgress));

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

    surfaceContext.clearRect(0, 0, surfaceWidth, surfaceHeight);
    if (wetness > 0.005) {
      surfaceContext.save();
      surfaceContext.beginPath();
      surfaceCorners.forEach(([x, y], index) => index ? surfaceContext.lineTo(x, y) : surfaceContext.moveTo(x, y));
      surfaceContext.closePath();
      surfaceContext.clip();

      const desiredDrops = Math.min(72, Math.round(72 * wetness));
      const initialDrops = Math.min(desiredDrops, Math.ceil(desiredDrops * 0.2));
      while (surfaceDrops.length < initialDrops) surfaceDrops.push(makeSurfaceDrop());
      if (surfaceDrops.length < desiredDrops && !reducedMotion && Math.random() < dt * 18) {
        surfaceDrops.push(makeSurfaceDrop());
      }
      while (reducedMotion && surfaceDrops.length < desiredDrops) surfaceDrops.push(makeSurfaceDrop());

      if (!reducedMotion) mergeSurfaceDrops();
      for (const drop of surfaceDrops) {
        if (!reducedMotion) {
          drop.age += dt;
          const pinned = drop.pause > 0;
          if (pinned) drop.pause -= dt;
          const wander = Math.sin(drop.pathPhase) * drop.drift;
          const mobility = pinned ? 0 : drop.speed * 5.5;
          const targetVx = (gravity.x - gravity.y * wander) * mobility;
          const targetVy = (gravity.y + gravity.x * wander) * mobility;
          const response = 1 - Math.exp(-dt * 6);
          drop.vx += (targetVx - drop.vx) * response;
          drop.vy += (targetVy - drop.vy) * response;
          const dx = drop.vx * dt;
          const dy = drop.vy * dt;
          drop.x += dx;
          drop.y += dy;
          drop.life -= Math.hypot(dx, dy);
          drop.pathPhase += dt * 1.5;
          if (!pinned && Math.random() < dt * 0.6) drop.pause = 0.12 + Math.random() * 0.36;
        }
        drawSurfaceDrop(drop);
      }
      surfaceContext.restore();
      surfaceDrops = surfaceDrops.filter(drop => drop.life > 0 && isOnSurface(drop.x, drop.y));
    } else {
      surfaceDrops = [];
    }
    frost?.draw(frostProgress);

    if ((!reducedMotion && (rainIntensity > 0.005 || wetness > 0.005 || surfaceDrops.length)) ||
        Math.abs(targetFrost - frostProgress) > 0.0005) {
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

// Climate equipment and its specifications switch together as the section
// scrolls. This carousel is independent from the shared test-unit frost effect.
const climateCarousel = document.querySelector('[data-climate-carousel]');
if (climateCarousel) {
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
  const clampClimate = value => Math.max(0, Math.min(1, value));

  const showClimateState = index => {
    if (index === activeCamera) return;
    activeCamera = index;
    cameras.forEach((image, imageIndex) => image.classList.toggle('is-active', imageIndex === index));
    pages.forEach((page, pageIndex) => {
      const active = pageIndex === index;
      page.classList.toggle('is-active', active);
      page.setAttribute('aria-pressed', String(active));
    });
    const spec = cameraSpecs[index];
    if (title) title.textContent = spec.title;
    if (highTemperature) highTemperature.textContent = spec.highTemperature;
    if (lowTemperature) lowTemperature.textContent = spec.lowTemperature;
    if (humidityRow) humidityRow.hidden = !spec.humidity;
  };

  const updateClimateState = () => {
    climateFrame = 0;
    const bounds = climateCarousel.getBoundingClientRect();
    const progress = clampClimate((window.innerHeight - bounds.top) /
      (window.innerHeight + bounds.height));
    showClimateState(progress >= 0.5 ? 1 : 0);
  };
  const scheduleClimateUpdate = () => {
    if (!climateFrame) climateFrame = requestAnimationFrame(updateClimateState);
  };

  pages.forEach((page, index) => page.addEventListener('click', () => showClimateState(index)));
  addEventListener('scroll', scheduleClimateUpdate, { passive: true });
  addEventListener('resize', scheduleClimateUpdate, { passive: true });
  if ('ResizeObserver' in window) new ResizeObserver(scheduleClimateUpdate).observe(climateCarousel);
  scheduleClimateUpdate();
}
