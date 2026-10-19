(() => {
  const menuButton = document.querySelector('.menu-toggle');
  const navigation = document.querySelector('#site-nav');
  const menuDrawer = document.querySelector('.menu-drawer');
  if (menuButton && navigation && menuDrawer) {
    const setMenuOpen = open => {
      menuButton.setAttribute('aria-expanded', String(open));
      menuButton.setAttribute('aria-label', open ? '\u0417\u0430\u043a\u0440\u044b\u0442\u044c \u043c\u0435\u043d\u044e' : '\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u043c\u0435\u043d\u044e');
      navigation.classList.toggle('open', open);
      menuDrawer.classList.toggle('is-open', open);
      navigation.setAttribute('aria-hidden', String(!open));
      document.documentElement.classList.toggle('menu-open', open);
    };
    menuButton.addEventListener('click', () => setMenuOpen(menuButton.getAttribute('aria-expanded') !== 'true'));
    navigation.addEventListener('click', event => {
      if (event.target.closest('a')) setMenuOpen(false);
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') setMenuOpen(false);
    });
    document.addEventListener('click', event => {
      if (menuButton.getAttribute('aria-expanded') === 'true' && !menuDrawer.contains(event.target)) setMenuOpen(false);
    });
  }

  const filter = document.querySelector('#news-filter');
  const grid = document.querySelector('#news-stories');
  if (!filter || !grid) return;
  const cards = [...grid.querySelectorAll('.news-page__card')];
  const update = () => {
    let visible = 0;
    cards.forEach(card => {
      const show = filter.value === 'all' || card.dataset.category === filter.value;
      card.hidden = !show;
      visible += Number(show);
    });
    grid.classList.toggle('is-empty', visible === 0);
  };
  filter.addEventListener('change', update);
  update();
})();
