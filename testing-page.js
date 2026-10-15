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
  const frost = { width: 520, height: 336, source: null, distances: null, maxDistance: 1, pixels: null, lastStep: -1 };
  let frame = 0;

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
    frostCanvas.width = frost.width;
    frostCanvas.height = frost.height;
    frost.source = sourcePixels;
    frost.distances = distances;
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

  const drawFrost = (amount) => {
    if (!frostContext || !frost.pixels || !frost.distances) return;
    const step = Math.round(clamp(amount) * 160);
    if (step === frost.lastStep) return;
    frost.lastStep = step;
    if (step === 0) {
      frostContext.clearRect(0, 0, frost.width, frost.height);
      return;
    }
    const cutoff = (step / 160) * (frost.maxDistance + 3);
    const data = frost.pixels.data;
    for (let i = 0; i < frost.distances.length; i += 1) {
      const offset = i * 4;
      const sourceAlpha = frost.source.data[offset + 3];
      if (!sourceAlpha) {
        data[offset + 3] = 0;
        continue;
      }
      const edge = clamp((cutoff + 2 - frost.distances[i]) / 4);
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
    const transition = clamp(progress * 2);
    const desktop = desktopTesting.matches;
    const movement = desktop
      ? (reduceMotion.matches ? Number(transition >= 0.9) : smooth(0.05, 0.94, transition))
      : 0;
    drawFrost(desktop ? (reduceMotion.matches ? Number(transition >= 0.9) : smooth(0.08, 0.92, transition)) : 0);
    const aboutOpacity = desktop ? smooth(0.48, 0.68, transition) : 0;
    const copyOpacity = 1 - smooth(0.04, 0.17, progress);
    const breadcrumbOpacity = 1 - smooth(0.04, 0.17, progress);

    stage.style.setProperty('--about-opacity', String(aboutOpacity));
    stage.style.setProperty('--about-y', (reduceMotion.matches ? 0 : 24 * (1 - smooth(0.4, 0.72, transition))) + 'px');
    stage.style.setProperty('--copy-opacity', String(copyOpacity));
    stage.style.setProperty('--breadcrumb-opacity', String(breadcrumbOpacity));

    const figmaScale = Math.min(window.innerWidth / 1920, 1);
    const equipmentX = desktop
      ? -(Math.min(window.innerWidth * 0.1770833333, 340) + 442.5 * figmaScale) * movement
      : 0;
    equipment.style.setProperty('--equipment-x', equipmentX + 'px');
    equipment.style.setProperty('--equipment-y', (66 * movement) + 'px');
    equipment.style.setProperty('--equipment-scale', String(1 - 0.228 * movement));
    equipment.style.setProperty('--equipment-rotate', (-1.2 * movement) + 'deg');
    equipment.style.setProperty('--equipment-depth', '0px');
    equipment.style.setProperty('--equipment-tilt-x', '0deg');
    equipment.style.setProperty('--equipment-tilt-y', '0deg');

    if (breadcrumb) breadcrumb.inert = breadcrumbOpacity < 0.01;
    if (heroCopy) heroCopy.inert = copyOpacity < 0.01;
    if (aboutSection) {
      aboutSection.setAttribute('aria-hidden', String(aboutOpacity < 0.01));
      aboutSection.inert = aboutOpacity < 0.01;
    }
  };
  const scheduleUpdate = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };
  const observer = new ResizeObserver(scheduleUpdate);
  observer.observe(sequence);
  observer.observe(stage);
  observer.observe(equipment);
  addEventListener('scroll', scheduleUpdate, { passive: true });
  addEventListener('resize', scheduleUpdate, { passive: true });
  desktopTesting.addEventListener?.('change', scheduleUpdate);
  reduceMotion.addEventListener?.('change', scheduleUpdate);
  frostSource?.addEventListener('load', prepareFrost, { once: true });
  if (frostSource?.complete) prepareFrost();
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
