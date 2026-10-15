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

document.querySelectorAll('.testing-stage__button').forEach(button => {
  button.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch') return;
    const bounds = button.getBoundingClientRect();
    button.style.setProperty('--cursor-x', `${((event.clientX - bounds.left) / bounds.width) * 100}%`);
    button.style.setProperty('--cursor-y', `${((event.clientY - bounds.top) / bounds.height) * 100}%`);
  });
});

const sequence = document.querySelector('[data-testing-sequence]');
const stage = sequence?.querySelector('.testing-stage');
const equipment = stage?.querySelector('.testing-stage__equipment');
const frostSource = equipment?.querySelector('.testing-stage__frost-source');
const frostCanvas = equipment?.querySelector('.testing-stage__frost');
const breadcrumb = stage?.querySelector('.testing-stage__breadcrumb');
const aboutSection = stage?.querySelector('.testing-about');
const heroCopy = stage?.querySelector('.testing-stage__copy');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const desktopTesting = matchMedia('(min-width: 1001px)');

if (sequence && stage && equipment) {
  const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
  const smooth = (start, end, value) => {
    const t = clamp((value - start) / (end - start));
    return t * t * (3 - 2 * t);
  };
  const frostContext = frostCanvas?.getContext('2d', { alpha: true });
  const frost = { width: 520, height: 336, source: null, distances: null, noise: null, maxDistance: 1, pixels: null, lastStep: -1 };
  const maskEntries = [];
  let frame = 0;
  let maskResizeFrame = 0;

  const hash = (x, y) => {
    let value = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
    value = Math.imul(value ^ (value >>> 13), 1274126177);
    return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
  };
  const valueNoise = (x, y, scale) => {
    const gx = x / scale;
    const gy = y / scale;
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const tx = gx - x0;
    const ty = gy - y0;
    const ease = value => value * value * (3 - 2 * value);
    const a = hash(x0, y0);
    const b = hash(x0 + 1, y0);
    const c = hash(x0, y0 + 1);
    const d = hash(x0 + 1, y0 + 1);
    const top = a + (b - a) * ease(tx);
    const bottom = c + (d - c) * ease(tx);
    return top + (bottom - top) * ease(ty);
  };

  const prepareMaskLines = () => {
    if (!stage || !aboutSection) return;
    maskEntries.length = 0;
    const splitIntoLines = (targets, role) => {
      const lines = [];
      targets.forEach(target => {
        const text = target.dataset.maskSource || target.textContent.trim();
        target.dataset.maskSource = text;
        const words = text.split(/\s+/u).map(value => {
          const word = document.createElement('span');
          word.textContent = value;
          word.style.display = 'inline-block';
          word.style.whiteSpace = 'nowrap';
          return word;
        });
        const measuredContent = [];
        words.forEach((word, index) => {
          if (index) measuredContent.push(document.createTextNode(' '));
          measuredContent.push(word);
        });
        target.replaceChildren(...measuredContent);

        const wordLines = [];
        let currentLine = [];
        let currentTop = null;
        words.forEach(word => {
          const top = word.getBoundingClientRect().top;
          if (currentTop !== null && Math.abs(top - currentTop) > 2) {
            wordLines.push(currentLine);
            currentLine = [];
          }
          if (!currentLine.length) currentTop = top;
          currentLine.push(word);
        });
        if (currentLine.length) wordLines.push(currentLine);

        wordLines.forEach(wordLine => {
          const line = document.createElement('span');
          line.className = 'testing-mask-line';
          line.dataset.maskRole = role;
          const inner = document.createElement('span');
          inner.className = 'testing-mask-line__inner';
          wordLine.forEach((word, index) => {
            if (index) inner.append(document.createTextNode(' '));
            inner.append(word);
          });
          line.append(inner);
          target.append(line);
          lines.push(line);
        });
      });
      return lines;
    };

    const outgoingTargets = [...stage.querySelectorAll(
      '.testing-stage__breadcrumb a, .testing-stage__breadcrumb > span, .testing-stage__copy h1, .testing-stage__copy p, .testing-stage__button > span'
    )];
    const incomingTargets = [...aboutSection.querySelectorAll(
      'h2, .testing-about__text p, .testing-about__number, .testing-about__label'
    )];
    const outgoingLines = splitIntoLines(outgoingTargets, 'out');
    const incomingLines = splitIntoLines(incomingTargets, 'in');
    outgoingLines.forEach((line, index) => maskEntries.push({
      line, role: 'out', index, total: outgoingLines.length,
    }));
    incomingLines.forEach((line, index) => maskEntries.push({
      line, role: 'in', index, total: incomingLines.length,
    }));
    stage.classList.add('is-mask-ready');
    scheduleUpdate();
  };

  const updateMaskLines = transition => {
    const metricProgress = new Map();
    let lastOutgoingProgress = 0;
    maskEntries.forEach(entry => {
      const total = Math.max(1, entry.total);
      let value;
      if (entry.role === 'out') {
        const duration = Math.min(0.06, 0.28 / total);
        const interval = total > 1 ? (0.34 - duration) / (total - 1) : 0;
        const start = 0.015 + entry.index * interval;
        value = reduceMotion.matches
          ? Number(transition >= 0.36)
          : smooth(start, start + duration, transition);
        lastOutgoingProgress = Math.max(lastOutgoingProgress, value);
      } else {
        const start = 0.68;
        const duration = Math.min(0.045, 0.28 / total);
        const interval = total > 1 ? (0.98 - start - duration) / (total - 1) : 0;
        const lineStart = start + entry.index * interval;
        value = reduceMotion.matches
          ? Number(transition >= start)
          : smooth(lineStart, lineStart + duration, transition);
        const metric = entry.line.closest('.testing-about__metric');
        if (metric && entry.line.closest('.testing-about__number')) {
          metricProgress.set(metric, value);
        }
      }
      entry.line.style.setProperty('--mask-progress', String(value));
      entry.line.style.setProperty('--mask-offset', (entry.role === 'out' ? -112 * value : 112 * (1 - value)) + '%');
      entry.line.style.setProperty('--mask-opacity', String(entry.role === 'out' ? 1 - value : value));
    });

    aboutSection?.querySelectorAll('.testing-about__metric').forEach(metric => {
      const progress = metricProgress.get(metric) || 0;
      metric.style.backgroundColor = 'rgba(0,0,0,' + (0.6 * progress) + ')';
    });
    const incomingReady = transition >= 0.68;
    if (aboutSection) {
      aboutSection.setAttribute('aria-hidden', String(!incomingReady));
      aboutSection.inert = !incomingReady;
    }
    if (heroCopy) heroCopy.inert = lastOutgoingProgress >= 0.99;
    if (breadcrumb) breadcrumb.inert = transition >= 0.36;
  };

  const prepareFrost = () => {
    if (!frostContext || !frostSource?.complete || !frostSource.naturalWidth) return;
    frost.height = Math.round(frost.width * frostSource.naturalHeight / frostSource.naturalWidth);
    const buffer = document.createElement('canvas');
    buffer.width = frost.width;
    buffer.height = frost.height;
    const bufferContext = buffer.getContext('2d', { willReadFrequently: true });
    bufferContext.drawImage(frostSource, 0, 0, frost.width, frost.height);
    const sourcePixels = bufferContext.getImageData(0, 0, frost.width, frost.height);
    const count = frost.width * frost.height;
    const inside = new Uint8Array(count);
    const distances = new Float32Array(count);
    const noise = new Float32Array(count);
    const far = frost.width + frost.height;
    let maxDistance = 1;
    for (let i = 0; i < count; i += 1) {
      inside[i] = sourcePixels.data[i * 4 + 3] > 12 ? 1 : 0;
      distances[i] = inside[i] ? far : 0;
    }
    const diagonal = Math.SQRT2;
    for (let y = 0; y < frost.height; y += 1) {
      for (let x = 0; x < frost.width; x += 1) {
        const i = y * frost.width + x;
        if (!inside[i]) continue;
        let d = distances[i];
        if (x > 0) d = Math.min(d, distances[i - 1] + 1);
        if (y > 0) d = Math.min(d, distances[i - frost.width] + 1);
        if (x > 0 && y > 0) d = Math.min(d, distances[i - frost.width - 1] + diagonal);
        if (x + 1 < frost.width && y > 0) d = Math.min(d, distances[i - frost.width + 1] + diagonal);
        distances[i] = d;
      }
    }
    for (let y = frost.height - 1; y >= 0; y -= 1) {
      for (let x = frost.width - 1; x >= 0; x -= 1) {
        const i = y * frost.width + x;
        if (!inside[i]) continue;
        let d = distances[i];
        if (x + 1 < frost.width) d = Math.min(d, distances[i + 1] + 1);
        if (y + 1 < frost.height) d = Math.min(d, distances[i + frost.width] + 1);
        if (x + 1 < frost.width && y + 1 < frost.height) d = Math.min(d, distances[i + frost.width + 1] + diagonal);
        if (x > 0 && y + 1 < frost.height) d = Math.min(d, distances[i + frost.width - 1] + diagonal);
        distances[i] = d;
        maxDistance = Math.max(maxDistance, d);
      }
    }
    for (let y = 0; y < frost.height; y += 1) {
      for (let x = 0; x < frost.width; x += 1) {
        const i = y * frost.width + x;
        if (!inside[i]) continue;
        const macro = valueNoise(x, y, 24) - 0.5;
        const mid = valueNoise(x + 13, y - 7, 9) - 0.5;
        const fine = valueNoise(x - 5, y + 17, 4) - 0.5;
        noise[i] = (macro * 0.62 + mid * 0.28 + fine * 0.1) * 2;
      }
    }

    frostCanvas.width = frost.width;
    frostCanvas.height = frost.height;
    frost.source = sourcePixels;
    frost.distances = distances;
    frost.noise = noise;
    frost.maxDistance = maxDistance;
    frost.pixels = frostContext.createImageData(frost.width, frost.height);
    for (let i = 0; i < count; i += 1) {
      const offset = i * 4;
      frost.pixels.data[offset] = sourcePixels.data[offset];
      frost.pixels.data[offset + 1] = sourcePixels.data[offset + 1];
      frost.pixels.data[offset + 2] = sourcePixels.data[offset + 2];
    }
    frost.lastStep = -1;
    scheduleUpdate();
  };

  const drawFrost = amount => {
    if (!frostContext || !frost.pixels || !frost.distances) return;
    const step = Math.round(clamp(amount) * 160);
    if (step === frost.lastStep) return;
    frost.lastStep = step;
    if (step === 0) {
      frostContext.clearRect(0, 0, frost.width, frost.height);
      return;
    }
    if (step >= 160) {
      frostContext.putImageData(frost.source, 0, 0);
      return;
    }

    const progress = step / 160;
    const cutoff = progress * (frost.maxDistance + 3);
    const roughness = Math.min(19, frost.maxDistance * 0.24) * (1 - progress * 0.45);
    const data = frost.pixels.data;
    for (let i = 0; i < frost.distances.length; i += 1) {
      const offset = i * 4;
      const sourceAlpha = frost.source.data[offset + 3];
      if (!sourceAlpha) {
        data[offset + 3] = 0;
        continue;
      }
      const variedFront = cutoff + frost.noise[i] * roughness;
      const edge = clamp((variedFront + 2 - frost.distances[i]) / 5);
      const reveal = edge * edge * (3 - 2 * edge);
      data[offset + 3] = Math.round(sourceAlpha * reveal);
    }
    frostContext.putImageData(frost.pixels, 0, 0);
  };

  const update = () => {
    frame = 0;
    const sequenceTop = sequence.getBoundingClientRect().top + scrollY;
    const scrollRange = Math.max(1, sequence.offsetHeight - stage.offsetHeight);
    const progress = clamp((scrollY - sequenceTop) / scrollRange);
    const transition = progress;
    const desktop = desktopTesting.matches;
    const objectProgress = desktop
      ? (reduceMotion.matches ? Number(transition >= 0.63) : smooth(0.35, 0.63, transition))
      : 0;
    const orbit = desktop && !reduceMotion.matches
      ? Math.sin(objectProgress * Math.PI)
      : 0;
    updateMaskLines(transition);
    drawFrost(desktop ? (reduceMotion.matches ? Number(transition >= 0.66) : smooth(0.40, 0.66, transition)) : 0);

    const figmaScale = Math.min(window.innerWidth / 1920, 1);
    const equipmentX = desktop
      ? -(Math.min(window.innerWidth * 0.1770833333, 340) + 442.5 * figmaScale) * objectProgress
      : 0;
    equipment.style.setProperty('--equipment-x', equipmentX + 'px');
    equipment.style.setProperty('--equipment-y', (66 * objectProgress - 18 * orbit) + 'px');
    equipment.style.setProperty('--equipment-scale', String(1 - 0.228 * objectProgress));
    equipment.style.setProperty('--equipment-rotate', (1.5 * orbit) + 'deg');
    equipment.style.setProperty('--equipment-depth', (84 * orbit) + 'px');
    equipment.style.setProperty('--equipment-tilt-x', ((2 + 7 * orbit) * (desktop ? 1 : 0)) + 'deg');
    equipment.style.setProperty('--equipment-tilt-y', ((-4 - 12 * orbit) * (desktop ? 1 : 0)) + 'deg');
  };
  const scheduleUpdate = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };
  const scheduleMaskResize = () => {
    if (maskResizeFrame) cancelAnimationFrame(maskResizeFrame);
    maskResizeFrame = requestAnimationFrame(() => {
      maskResizeFrame = 0;
      prepareMaskLines();
    });
  };

  const observer = new ResizeObserver(scheduleUpdate);
  observer.observe(sequence);
  observer.observe(stage);
  observer.observe(equipment);
  addEventListener('scroll', scheduleUpdate, { passive: true });
  addEventListener('resize', () => {
    scheduleUpdate();
    scheduleMaskResize();
  }, { passive: true });
  desktopTesting.addEventListener?.('change', scheduleUpdate);
  reduceMotion.addEventListener?.('change', scheduleUpdate);
  frostSource?.addEventListener('load', prepareFrost, { once: true });
  if (frostSource?.complete) prepareFrost();
  if (document.fonts?.ready) document.fonts.ready.then(prepareMaskLines);
  else prepareMaskLines();
  scheduleUpdate();
}
const climateCarousel = document.querySelector('[data-climate-carousel]');
if (climateCarousel) {
  const track = climateCarousel.querySelector('[data-climate-track]');
  const stage = climateCarousel.querySelector('[data-climate-stage]');
  const products = [...climateCarousel.querySelectorAll('[data-climate-product]')];
  const cameras = [...climateCarousel.querySelectorAll('[data-climate-camera]')];
  const pages = [...climateCarousel.querySelectorAll('[data-climate-page]')];
  const title = climateCarousel.querySelector('[data-climate-camera-title]');
  const desktop = matchMedia('(min-width: 1101px)');
  const cameraTitles = ['Климатическая камера THCB -125', 'Климатическая камера S-B-8200'];
  let active = -1;
  let climateFrame = 0;
  const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

  const showClimateState = (index) => {
    if (index === active) return;
    active = index;
    products.forEach((image, imageIndex) => image.classList.toggle('is-active', imageIndex === index));
    cameras.forEach((image, imageIndex) => image.classList.toggle('is-active', imageIndex === index));
    pages.forEach((page, pageIndex) => page.classList.toggle('is-active', pageIndex === index));
    if (title) title.textContent = cameraTitles[index];
  };

  const updateClimateState = () => {
    climateFrame = 0;
    if (!track || !stage || products.length < 2 || cameras.length < 2) return;
    const top = track.getBoundingClientRect().top + scrollY;
    const scrollable = Math.max(1, track.offsetHeight - (desktop.matches ? stage.offsetHeight : innerHeight));
    const progress = clamp((scrollY - top) / scrollable);
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
  desktop.addEventListener?.('change', scheduleClimateUpdate);
  scheduleClimateUpdate();
}