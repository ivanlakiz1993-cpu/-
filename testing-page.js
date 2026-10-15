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
  let frame = 0;

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
    const aboutOpacity = desktop ? smooth(0.48, 0.68, transition) : 0;
    const copyOpacity = 1 - smooth(0.04, 0.17, progress);
    const breadcrumbOpacity = 1 - smooth(0.04, 0.17, progress);

    stage.style.setProperty('--about-opacity', String(aboutOpacity));
    stage.style.setProperty('--about-y', `${reduceMotion.matches ? 0 : 24 * (1 - smooth(0.4, 0.72, transition))}px`);
    stage.style.setProperty('--copy-opacity', String(copyOpacity));
    stage.style.setProperty('--breadcrumb-opacity', String(breadcrumbOpacity));

    const figmaScale = Math.min(window.innerWidth / 1920, 1);
    const equipmentX = desktop
      ? -(Math.min(window.innerWidth * 0.1770833333, 340) + 442.5 * figmaScale) * movement
      : 0;
    equipment.style.setProperty('--equipment-x', `${equipmentX}px`);
    equipment.style.setProperty('--equipment-y', `${66 * movement}px`);
    equipment.style.setProperty('--equipment-scale', String(1 - 0.228 * movement));
    equipment.style.setProperty('--equipment-rotate', `${-1.2 * movement}deg`);
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
  scheduleUpdate();
}
