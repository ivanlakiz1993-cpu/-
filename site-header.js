(() => {
  const button = document.querySelector('.menu-toggle');
  const navigation = document.querySelector('#site-nav');
  const drawer = document.querySelector('.menu-drawer');
  if (!button || !navigation || !drawer) return;

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

  const setMenuOpen = (open) => {
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    drawer.classList.toggle('is-open', open);
    navigation.setAttribute('aria-hidden', String(!open));
    document.documentElement.classList.toggle('menu-open', open);
    document.body.classList.toggle('menu-open', open);
  };

  button.addEventListener('click', () => {
    setMenuOpen(button.getAttribute('aria-expanded') !== 'true');
  });
  navigation.addEventListener('click', (event) => {
    if (event.target.closest('a')) setMenuOpen(false);
  });
  drawer.addEventListener('click', (event) => {
    if (event.target === drawer) setMenuOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || button.getAttribute('aria-expanded') !== 'true') return;
    setMenuOpen(false);
    button.focus();
  });
  document.addEventListener('pointerdown', (event) => {
    if (button.getAttribute('aria-expanded') === 'true' && !drawer.contains(event.target)) {
      setMenuOpen(false);
    }
  });
})();
