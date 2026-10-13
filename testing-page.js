const testingMenuButton = document.querySelector('.menu-toggle');
const testingMenuDrawer = document.querySelector('.menu-drawer');
const testingNavigation = document.querySelector('#site-nav');

const setTestingMenuOpen = (open) => {
  testingMenuButton.setAttribute('aria-expanded', String(open));
  testingMenuButton.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
  testingMenuDrawer.classList.toggle('is-open', open);
  document.documentElement.classList.toggle('menu-open', open);
  document.body.classList.toggle('menu-open', open);
};

testingMenuButton.addEventListener('click', () => {
  setTestingMenuOpen(testingMenuButton.getAttribute('aria-expanded') !== 'true');
});

testingNavigation.addEventListener('click', (event) => {
  if (event.target.closest('a')) setTestingMenuOpen(false);
});

testingMenuDrawer.addEventListener('click', (event) => {
  if (testingMenuButton.getAttribute('aria-expanded') === 'true' && event.target === testingMenuDrawer) {
    setTestingMenuOpen(false);
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && testingMenuButton.getAttribute('aria-expanded') === 'true') {
    setTestingMenuOpen(false);
    testingMenuButton.focus();
  }
});

document.addEventListener('pointerdown', (event) => {
  if (testingMenuButton.getAttribute('aria-expanded') === 'true' && !testingMenuDrawer.contains(event.target)) {
    setTestingMenuOpen(false);
  }
});

const testingButton = document.querySelector('.testing-cover__button');
testingButton.addEventListener('pointermove', (event) => {
  const bounds = testingButton.getBoundingClientRect();
  testingButton.style.setProperty('--cursor-x', `${event.clientX - bounds.left}px`);
  testingButton.style.setProperty('--cursor-y', `${event.clientY - bounds.top}px`);
});
